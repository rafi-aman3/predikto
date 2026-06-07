# Bracket Simulator + Awards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 5 — an interactive `/bracket` simulator (order 12 groups → pick 8 thirds → auto-seeded knockout tree → tap winners to Champion → awards), scored into the existing leaderboard, plus an `/admin/settings` editor.

**Architecture:** Pure, TDD'd selectors in `src/lib/bracket.ts` (the fixed knockout template + R32 seeding + tree reconstruction) and `src/lib/bracket-scoring.ts` (group/bracket/award scoring), backed by thin DB readers/writers (`get-bracket.ts`, `bracket/actions.ts`, `bracket-recompute.ts`). New `groupPredictions` table + new `app_settings` columns. Reached-round scoring reuses real knockout match participants; group actuals reuse `computeGroupStandings`. All points live in `pointsAwarded`, so the existing `SUM(pointsAwarded)` leaderboard absorbs them via a per-user bonus.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Drizzle ORM + Supabase Postgres, Tailwind v4 (`rp-*` Retro Arcade utilities), Vitest. Pure selector / `get-*.ts` reader convention; client-safe modules must NOT import `db`; URL state via `history.replaceState`.

**Spec:** `docs/superpowers/specs/2026-06-07-bracket-and-awards-design.md`

---

## File structure

**Create:**
- `src/lib/bracket.ts` — knockout template, `buildR32Field`, `reconstructBracket`, validation (pure, no `db`)
- `src/lib/bracket.test.ts`
- `src/lib/bracket-scoring.ts` — `scoreGroupPredictions`, `pickActualAdvancingThirds`, `scoreBracket`, `scoreAwards` (pure, no `db`)
- `src/lib/bracket-scoring.test.ts`
- `src/lib/get-bracket.ts` — DB reader for the bracket page
- `src/lib/bracket-recompute.ts` — `recomputeBracketsAndGroups`, `recomputeAwards` (DB writers)
- `src/app/bracket/page.tsx` — server component (loads data, renders the client simulator)
- `src/app/bracket/actions.ts` — `saveBracket` server action
- `src/components/bracket/bracket-simulator.tsx` — top-level client component (state + section nav + save)
- `src/components/bracket/group-orderer.tsx` — the 12-group order editor
- `src/components/bracket/thirds-picker.tsx` — pick-8-of-12 thirds
- `src/components/bracket/knockout-tree.tsx` — tap-to-advance tree (read-only when locked)
- `src/components/bracket/awards-panel.tsx` — award dropdowns
- `src/app/admin/settings/page.tsx` — admin settings editor (server component)
- `src/app/admin/settings/settings-form.tsx` — client form
- `src/app/admin/settings/actions.ts` — admin save actions

**Modify:**
- `src/db/schema.ts` — add `groupPredictions` table + `app_settings` columns
- `src/lib/scoring-config.ts` — add `ptsGroupPosition`, `ptsThirdQualifier`
- `src/lib/app-settings.ts` — extend `getScoringConfig`; add `getActualAwards`, `getPredictionsLockAt`, write helpers
- `src/lib/leaderboard.ts` — `buildLeaderboard` gains optional `bonusByUser`
- `src/lib/leaderboard.test.ts` — cover the bonus
- `src/lib/get-leaderboard.ts` — read group/bracket/award points into `bonusByUser`
- `src/components/leaderboard/leaderboard-view.tsx` — pass bonus to the Overall tab
- `src/app/leaderboard/page.tsx` — thread `bonusByUser` through
- `src/app/page.tsx` — apply bonus to the homepage rank
- `src/app/admin/matches/actions.ts` — also recompute brackets/groups on result save
- `src/app/admin/page.tsx` — link to `/admin/settings`
- `src/components/home/bracket-teaser.tsx` — CTA → `/bracket`

---

## Task 1: Schema — `groupPredictions` table + `app_settings` columns

**Files:**
- Modify: `src/db/schema.ts`
- Create (generated): `drizzle/0002_*.sql`

- [ ] **Step 1: Add the new table + columns to the schema**

In `src/db/schema.ts`, add after the `bracketPredictions` table:

```ts
// One row per team per user: the predicted final group position (1..4) and, for
// position-3 rows, whether the user picked that third to advance (exactly 8 across all groups).
export const groupPredictions = pgTable('group_predictions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  groupName: text('group_name').notNull(),       // "A".."L"
  teamId: uuid('team_id').references(() => teams.id).notNull(),
  position: integer('position').notNull(),        // 1..4
  advancesAsThird: boolean('advances_as_third').default(false).notNull(),
  pointsAwarded: integer('points_awarded'),       // null until scored
}, (t) => ({ uniqUserTeam: unique().on(t.userId, t.teamId) }));
```

In the same file, add these columns to the `appSettings` table object (after `ptsSurprise`):

```ts
  ptsGroupPosition: integer('pts_group_position').default(2).notNull(),
  ptsThirdQualifier: integer('pts_third_qualifier').default(1).notNull(),
  actualGoldenBootPlayerId: uuid('actual_golden_boot_player_id').references(() => players.id),
  actualBestPlayerId: uuid('actual_best_player_id').references(() => players.id),
  actualSurpriseTeamId: uuid('actual_surprise_team_id').references(() => teams.id),
```

- [ ] **Step 2: Generate the migration**

Run: `npx drizzle-kit generate`
Expected: a new `drizzle/0002_*.sql` is created containing `CREATE TABLE "group_predictions"` and `ALTER TABLE "app_settings" ADD COLUMN ...` for the five columns. Open it and confirm.

- [ ] **Step 3: Apply the migration**

⚠️ Per project docs there is a single Supabase DB — `migrate` runs against production. This is the established workflow; the migration is purely additive (new table + nullable/defaulted columns), so it is safe on live data.

Run: `npx drizzle-kit migrate`
Expected: applies cleanly, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat(db): groupPredictions table + bracket/awards app_settings columns"
```

---

## Task 2: Scoring config — new group constants

**Files:**
- Modify: `src/lib/scoring-config.ts`

- [ ] **Step 1: Add the constants to the type + defaults**

In `src/lib/scoring-config.ts`, add `ptsGroupPosition` and `ptsThirdQualifier`:

```ts
export type ScoringConfig = {
  ptsExact: number; ptsResult: number;
  ptsReachR16: number; ptsReachQf: number; ptsReachSf: number; ptsReachFinal: number;
  ptsChampion: number; ptsRunnerUp: number; ptsGoldenBoot: number;
  ptsBestPlayer: number; ptsSurprise: number;
  ptsGroupPosition: number; ptsThirdQualifier: number;
};

export const DEFAULT_SCORING: ScoringConfig = {
  ptsExact: 3, ptsResult: 1,
  ptsReachR16: 1, ptsReachQf: 2, ptsReachSf: 3, ptsReachFinal: 5,
  ptsChampion: 10, ptsRunnerUp: 5, ptsGoldenBoot: 5,
  ptsBestPlayer: 5, ptsSurprise: 5,
  ptsGroupPosition: 2, ptsThirdQualifier: 1,
};
```

- [ ] **Step 2: Verify the project still type-checks**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). `getScoringConfig` in `app-settings.ts` is updated in Task 3; it will still compile because it spreads explicit fields — but if `tsc` flags the missing fields here, that is expected and fixed in Task 3. If so, proceed to Task 3 before committing.

- [ ] **Step 3: Commit**

```bash
git add src/lib/scoring-config.ts
git commit -m "feat(scoring): group-position + third-qualifier scoring constants"
```

---

## Task 3: app-settings — read new constants, actuals, lock; write helpers

**Files:**
- Modify: `src/lib/app-settings.ts`

- [ ] **Step 1: Extend `getScoringConfig` and add readers/writers**

Replace the body of `src/lib/app-settings.ts` with:

```ts
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { appSettings } from '@/db/schema';
import { DEFAULT_SCORING, type ScoringConfig } from './scoring-config';

/** Reads the singleton app_settings row (id=1); falls back to DEFAULT_SCORING. */
export async function getScoringConfig(): Promise<ScoringConfig> {
  const [r] = await db.select().from(appSettings).where(eq(appSettings.id, 1));
  if (!r) return DEFAULT_SCORING;
  return {
    ptsExact: r.ptsExact, ptsResult: r.ptsResult,
    ptsReachR16: r.ptsReachR16, ptsReachQf: r.ptsReachQf,
    ptsReachSf: r.ptsReachSf, ptsReachFinal: r.ptsReachFinal,
    ptsChampion: r.ptsChampion, ptsRunnerUp: r.ptsRunnerUp,
    ptsGoldenBoot: r.ptsGoldenBoot, ptsBestPlayer: r.ptsBestPlayer,
    ptsSurprise: r.ptsSurprise,
    ptsGroupPosition: r.ptsGroupPosition, ptsThirdQualifier: r.ptsThirdQualifier,
  };
}

/** Reads the editable prize text shown on the leaderboard #1. Null when unset. */
export async function getPrizeText(): Promise<string | null> {
  const [r] = await db.select().from(appSettings).where(eq(appSettings.id, 1));
  return r?.prizeText ?? null;
}

/** Global deadline for group/bracket/award predictions. Null => open. */
export async function getPredictionsLockAt(): Promise<Date | null> {
  const [r] = await db.select().from(appSettings).where(eq(appSettings.id, 1));
  return r?.predictionsLockAt ?? null;
}

export type ActualAwards = {
  goldenBootPlayerId: string | null;
  bestPlayerId: string | null;
  surpriseTeamId: string | null;
};

/** Admin-entered actual award winners (Golden Boot / Best Player / Surprise team). */
export async function getActualAwards(): Promise<ActualAwards> {
  const [r] = await db.select().from(appSettings).where(eq(appSettings.id, 1));
  return {
    goldenBootPlayerId: r?.actualGoldenBootPlayerId ?? null,
    bestPlayerId: r?.actualBestPlayerId ?? null,
    surpriseTeamId: r?.actualSurpriseTeamId ?? null,
  };
}

/** Upserts the singleton settings row. Only provided fields are written. */
export async function updateAppSettings(patch: Partial<{
  predictionsLockAt: Date | null;
  prizeText: string | null;
  actualGoldenBootPlayerId: string | null;
  actualBestPlayerId: string | null;
  actualSurpriseTeamId: string | null;
  scoring: Partial<ScoringConfig>;
}>): Promise<void> {
  const { scoring, ...rest } = patch;
  const values: Record<string, unknown> = { ...rest };
  if (scoring) {
    const map: Record<keyof ScoringConfig, string> = {
      ptsExact: 'ptsExact', ptsResult: 'ptsResult',
      ptsReachR16: 'ptsReachR16', ptsReachQf: 'ptsReachQf',
      ptsReachSf: 'ptsReachSf', ptsReachFinal: 'ptsReachFinal',
      ptsChampion: 'ptsChampion', ptsRunnerUp: 'ptsRunnerUp',
      ptsGoldenBoot: 'ptsGoldenBoot', ptsBestPlayer: 'ptsBestPlayer',
      ptsSurprise: 'ptsSurprise',
      ptsGroupPosition: 'ptsGroupPosition', ptsThirdQualifier: 'ptsThirdQualifier',
    };
    for (const k of Object.keys(scoring) as (keyof ScoringConfig)[]) {
      if (scoring[k] != null) values[map[k]] = scoring[k];
    }
  }
  await db.insert(appSettings).values({ id: 1, ...values })
    .onConflictDoUpdate({ target: appSettings.id, set: values });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/app-settings.ts
git commit -m "feat(settings): read group constants/actuals/lock + updateAppSettings writer"
```

---

## Task 4: `bracket.ts` — knockout template + `buildR32Field`

**Files:**
- Create: `src/lib/bracket.ts`
- Test: `src/lib/bracket.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/bracket.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { R32_TIES, buildR32Field, type PredictedStandings } from './bracket';

// Helper: 12 groups A..L, teams named "<group><pos>" e.g. "A1".."A4".
const standings: PredictedStandings = Object.fromEntries(
  'ABCDEFGHIJKL'.split('').map((g) => [g, [`${g}1`, `${g}2`, `${g}3`, `${g}4`]]),
);
// 8 chosen thirds (each is the position-3 team of its group):
const thirds = ['A3', 'B3', 'C3', 'D3', 'E3', 'F3', 'G3', 'H3'];

describe('R32_TIES template', () => {
  it('has 16 ties using each top-2 code once and 8 third placeholders', () => {
    expect(R32_TIES).toHaveLength(16);
    const codes = R32_TIES.flat();
    expect(codes).toHaveLength(32);
    // every winner 1A..1L and runner 2A..2L appears exactly once
    for (const g of 'ABCDEFGHIJKL') {
      expect(codes.filter((c) => c === `1${g}`)).toHaveLength(1);
      expect(codes.filter((c) => c === `2${g}`)).toHaveLength(1);
    }
    // eight distinct third placeholders 3#1..3#8
    const thirdSlots = codes.filter((c) => c.startsWith('3#'));
    expect(new Set(thirdSlots).size).toBe(8);
  });
});

describe('buildR32Field', () => {
  it('resolves top-2 codes from standings and fills thirds by group letter', () => {
    const field = buildR32Field(standings, thirds);
    expect(field).toHaveLength(16);
    // Tie 0 in the template is ["1A","3#1"] => A1 vs the first third by group order (A3).
    expect(field[0]).toEqual({ tie: 0, home: 'A1', away: 'A3' });
    // every produced team id is non-null and unique across the field
    const ids = field.flatMap((t) => [t.home, t.away]);
    expect(ids.every((x) => x !== null)).toBe(true);
    expect(new Set(ids).size).toBe(32);
  });

  it('assigns thirds deterministically by their group letter regardless of input order', () => {
    const shuffled = ['H3', 'A3', 'D3', 'C3', 'F3', 'B3', 'E3', 'G3'];
    expect(buildR32Field(standings, shuffled)).toEqual(buildR32Field(standings, thirds));
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/bracket.test.ts`
Expected: FAIL — `Cannot find module './bracket'`.

- [ ] **Step 3: Implement `bracket.ts` (template + buildR32Field)**

Create `src/lib/bracket.ts`:

```ts
import type { Stage } from './fixtures';

/** Predicted final group order: group letter -> [1st, 2nd, 3rd, 4th] team ids. */
export type PredictedStandings = Record<string, string[]>;

/**
 * The 16 R32 ties as [homeCode, awayCode]. Top-2 codes ("1A".."2L") resolve from the
 * predicted standings; third placeholders ("3#1".."3#8") are filled by the 8 chosen
 * thirds. This is our canonical knockout wiring; round-to-round propagation folds by
 * index (R16 tie k = winners of R32 ties 2k,2k+1, and so on).
 *
 * ⚠️ Pairings are a tunable data constant — verify against the official FIFA WC2026
 * bracket before launch (like the best-effort kickoff times in data/seed.json).
 */
export const R32_TIES: Array<[string, string]> = [
  ['1A', '3#1'], ['1B', '2E'], ['1C', '3#2'], ['1D', '2F'],
  ['1E', '3#3'], ['1F', '2G'], ['1G', '3#4'], ['1H', '2H'],
  ['1I', '3#5'], ['1J', '2I'], ['1K', '3#6'], ['1L', '2J'],
  ['2A', '3#7'], ['2B', '2K'], ['2C', '3#8'], ['2D', '2L'],
];

/** Number of ties at each knockout round, by index propagation. */
export const ROUND_TIES: Record<Exclude<Stage, 'group' | 'third'>, number> = {
  r32: 16, r16: 8, qf: 4, sf: 2, final: 1,
};

export type R32Tie = { tie: number; home: string | null; away: string | null };

/** Maps the 8 chosen thirds to slots 3#1..3#8, sorted by the team's group letter. */
function thirdsBySlot(standings: PredictedStandings, chosenThirds: string[]): string[] {
  const groupOf = new Map<string, string>();
  for (const [g, order] of Object.entries(standings)) {
    if (order[2] != null) groupOf.set(order[2], g);
  }
  return [...chosenThirds].sort((a, b) =>
    (groupOf.get(a) ?? 'Z').localeCompare(groupOf.get(b) ?? 'Z'));
}

function resolveCode(code: string, standings: PredictedStandings, thirds: string[]): string | null {
  if (code.startsWith('3#')) {
    const slot = Number(code.slice(2)) - 1;        // 3#1 -> index 0
    return thirds[slot] ?? null;
  }
  const pos = Number(code[0]) - 1;                  // "1" -> index 0
  const group = code.slice(1);                      // "A"
  return standings[group]?.[pos] ?? null;
}

/** Resolves the 16 R32 ties to concrete team ids from the predicted standings + thirds. */
export function buildR32Field(standings: PredictedStandings, chosenThirds: string[]): R32Tie[] {
  const thirds = thirdsBySlot(standings, chosenThirds);
  return R32_TIES.map(([h, a], tie) => ({
    tie,
    home: resolveCode(h, standings, thirds),
    away: resolveCode(a, standings, thirds),
  }));
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/bracket.test.ts`
Expected: PASS (all 4 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bracket.ts src/lib/bracket.test.ts
git commit -m "feat(bracket): knockout template + buildR32Field (TDD)"
```

---

## Task 5: `bracket.ts` — `reconstructBracket` + validation

**Files:**
- Modify: `src/lib/bracket.ts`
- Modify: `src/lib/bracket.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `src/lib/bracket.test.ts`:

```ts
import { reconstructBracket, validateBracket, type ReachedSets } from './bracket';

describe('reconstructBracket', () => {
  // Build a full deterministic run: at each round the HOME team always advances.
  const r32 = buildR32Field(standings, thirds);
  const r16Winners = r32.map((t) => t.home!);            // 16 home teams
  const reached: ReachedSets = {
    r16: new Set(r16Winners),
    qf: new Set([0, 2, 4, 6, 8, 10, 12, 14].map((i) => r16Winners[i])), // homes of r16 ties
    sf: new Set([0, 4, 8, 12].map((i) => r16Winners[i])),
    final: new Set([0, 8].map((i) => r16Winners[i])),
  };

  it('builds 16/8/4/2/1 ties with winners drawn from the next round\'s reached set', () => {
    const tree = reconstructBracket(standings, thirds, reached);
    expect(tree.r32).toHaveLength(16);
    expect(tree.r16).toHaveLength(8);
    expect(tree.qf).toHaveLength(4);
    expect(tree.sf).toHaveLength(2);
    expect(tree.final).toHaveLength(1);
    // R32 tie 0 winner is its home (A1), who is in reached.r16
    expect(tree.r32[0].winner).toBe('A1');
    // R16 tie 0 pairs winners of R32 ties 0 and 1
    expect(tree.r16[0].home).toBe(r32[0].home);
    expect(tree.r16[0].away).toBe(r32[1].home);
    // final participants come from the two SF winners
    expect(tree.final[0].home).not.toBeNull();
    expect(tree.final[0].away).not.toBeNull();
  });
});

describe('validateBracket', () => {
  const groupTeams = Object.fromEntries(
    Object.entries(standings).map(([g, o]) => [g, [...o]]),
  );
  const fullReached = (() => {
    const r32 = buildR32Field(standings, thirds);
    const homes = r32.map((t) => t.home!);
    return {
      r16: homes,
      qf: [0, 2, 4, 6, 8, 10, 12, 14].map((i) => homes[i]),
      sf: [0, 4, 8, 12].map((i) => homes[i]),
      final: [0, 8].map((i) => homes[i]),
    };
  })();

  it('accepts a complete, consistent bracket', () => {
    const res = validateBracket({ groupTeams, standings, chosenThirds: thirds, reached: fullReached });
    expect(res.ok).toBe(true);
  });

  it('rejects when a group order is not a full permutation', () => {
    const bad = { ...standings, A: ['A1', 'A1', 'A3', 'A4'] };
    const res = validateBracket({ groupTeams, standings: bad, chosenThirds: thirds, reached: fullReached });
    expect(res.ok).toBe(false);
  });

  it('rejects when not exactly 8 thirds are chosen', () => {
    const res = validateBracket({ groupTeams, standings, chosenThirds: thirds.slice(0, 7), reached: fullReached });
    expect(res.ok).toBe(false);
  });

  it('rejects an r16 set that is not one team per R32 tie', () => {
    const r32 = buildR32Field(standings, thirds);
    const homes = r32.map((t) => t.home!);
    const broken = [...homes]; broken[1] = homes[0]; // two from tie 0, none from tie 1
    const res = validateBracket({
      groupTeams, standings, chosenThirds: thirds,
      reached: { ...fullReached, r16: broken },
    });
    expect(res.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run src/lib/bracket.test.ts`
Expected: FAIL — `reconstructBracket`/`validateBracket`/`ReachedSets` not exported.

- [ ] **Step 3: Implement reconstruct + validation**

Append to `src/lib/bracket.ts`:

```ts
export type ReachedSets = {
  r16: Set<string>; qf: Set<string>; sf: Set<string>; final: Set<string>;
};

export type BracketTie = { tie: number; home: string | null; away: string | null; winner: string | null };
export type BracketTree = {
  r32: BracketTie[]; r16: BracketTie[]; qf: BracketTie[]; sf: BracketTie[]; final: BracketTie[];
};

/** The team in [home, away] that belongs to `advanced`, or null if neither/both. */
function winnerOf(home: string | null, away: string | null, advanced: Set<string>): string | null {
  const h = home != null && advanced.has(home);
  const a = away != null && advanced.has(away);
  if (h && !a) return home;
  if (a && !h) return away;
  return null;
}

/** Folds winners of the previous round into the next round's ties (pairs by index). */
function foldRound(prev: BracketTie[], advanced: Set<string>): BracketTie[] {
  const ties: BracketTie[] = [];
  for (let k = 0; k < prev.length / 2; k++) {
    const home = prev[2 * k].winner;
    const away = prev[2 * k + 1].winner;
    ties.push({ tie: k, home, away, winner: winnerOf(home, away, advanced) });
  }
  return ties;
}

/**
 * Reconstructs the full knockout tree from the predicted standings + chosen thirds +
 * per-round reached sets. Each round's winner is the participant present in the NEXT
 * round's reached set; the final's winner is left null (champion is an award pick).
 */
export function reconstructBracket(
  standings: PredictedStandings, chosenThirds: string[], reached: ReachedSets,
): BracketTree {
  const r32: BracketTie[] = buildR32Field(standings, chosenThirds).map((t) => ({
    ...t, winner: winnerOf(t.home, t.away, reached.r16),
  }));
  const r16 = foldRound(r32, reached.qf);
  const qf = foldRound(r16, reached.sf);
  const sf = foldRound(qf, reached.final);
  const final = foldRound(sf, new Set<string>());  // champion overlaid by the UI
  return { r32, r16, qf, sf, final };
}

export type ValidateInput = {
  groupTeams: Record<string, string[]>;   // the actual teams in each group (any order)
  standings: PredictedStandings;          // predicted order
  chosenThirds: string[];
  reached: { r16: string[]; qf: string[]; sf: string[]; final: string[] };
};

/** Server-side structural validation for a submitted bracket. */
export function validateBracket(input: ValidateInput): { ok: boolean; error?: string } {
  const { groupTeams, standings, chosenThirds, reached } = input;

  for (const [g, members] of Object.entries(groupTeams)) {
    const order = standings[g];
    if (!order || order.length !== members.length) return { ok: false, error: `Group ${g} order incomplete.` };
    if (new Set(order).size !== order.length) return { ok: false, error: `Group ${g} has a duplicate team.` };
    const memberSet = new Set(members);
    if (!order.every((id) => memberSet.has(id))) return { ok: false, error: `Group ${g} has an unknown team.` };
  }

  if (chosenThirds.length !== 8) return { ok: false, error: 'Pick exactly 8 third-placed teams.' };
  const thirdEligible = new Set(Object.values(standings).map((o) => o[2]));
  if (!chosenThirds.every((id) => thirdEligible.has(id))) {
    return { ok: false, error: 'A chosen third is not a 3rd-placed team.' };
  }

  // Structural check (order-independent): reconstruct the tree from the reached SETS and
  // require every tie up to the final to resolve to exactly one winner, with the right
  // count of teams per round. Reusing reconstructBracket keeps this identical to render.
  const reachedSets: ReachedSets = {
    r16: new Set(reached.r16), qf: new Set(reached.qf), sf: new Set(reached.sf), final: new Set(reached.final),
  };
  const tree = reconstructBracket(standings, chosenThirds, reachedSets);
  const rounds: Array<[keyof ReachedSets, BracketTie[], number]> = [
    ['r16', tree.r32, 16],
    ['qf', tree.r16, 8],
    ['sf', tree.qf, 4],
    ['final', tree.sf, 2],
  ];
  for (const [key, prevTies, expected] of rounds) {
    if (reachedSets[key].size !== expected) {
      return { ok: false, error: `${key.toUpperCase()} must have exactly ${expected} teams.` };
    }
    // Each previous-round tie must resolve to exactly one winner present in this set.
    if (!prevTies.every((t) => t.winner != null)) {
      return { ok: false, error: `${key.toUpperCase()} picks must be one team per tie.` };
    }
  }

  return { ok: true };
}
```

Note: validation is **order-independent** — it depends only on set membership, exactly like `reconstructBracket`. The UI may emit `reached.*` picks in any order; a duplicate pick collapses in the `Set` and trips the size check.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/bracket.test.ts`
Expected: PASS (all cases incl. Task 4).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bracket.ts src/lib/bracket.test.ts
git commit -m "feat(bracket): reconstructBracket + validateBracket (TDD)"
```

---

## Task 6: `bracket-scoring.ts` — group scoring + actual thirds

**Files:**
- Create: `src/lib/bracket-scoring.ts`
- Test: `src/lib/bracket-scoring.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/bracket-scoring.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_SCORING } from './scoring-config';
import { scoreGroupPredictions, pickActualAdvancingThirds } from './bracket-scoring';
import type { GroupStandings, StandingRow } from './standings';

const cfg = DEFAULT_SCORING;

const row = (teamId: string, points: number, gd = 0, gf = 0): StandingRow => ({
  teamId, code: teamId, name: teamId, flag: null,
  played: 3, won: 0, drawn: 0, lost: 0, gf, ga: 0, gd, points,
});

// Group A actual order: A1 > A2 > A3 > A4
const actualStandings: GroupStandings[] = [
  { groupName: 'A', rows: [row('A1', 9), row('A2', 6), row('A3', 3), row('A4', 0)] },
  { groupName: 'B', rows: [row('B1', 9), row('B2', 6), row('B3', 4, 2), row('B4', 0)] },
];

describe('scoreGroupPredictions', () => {
  it('awards exact-position points and third-qualifier points', () => {
    const predicted = [
      { teamId: 'A1', groupName: 'A', position: 1, advancesAsThird: false }, // correct -> +2
      { teamId: 'A2', groupName: 'A', position: 3, advancesAsThird: false }, // wrong pos -> 0
      { teamId: 'A3', groupName: 'A', position: 3, advancesAsThird: true },  // correct pos +2, advanced +1
      { teamId: 'A4', groupName: 'A', position: 4, advancesAsThird: false }, // correct -> +2
    ];
    const actualThirds = new Set(['A3']); // A3 advanced as a top-8 third
    const out = scoreGroupPredictions(predicted, actualStandings, actualThirds, cfg);
    const by = Object.fromEntries(out.map((o) => [o.teamId, o.pointsAwarded]));
    expect(by.A1).toBe(2);
    expect(by.A2).toBe(0);
    expect(by.A3).toBe(3);  // +2 exact position + 1 third
    expect(by.A4).toBe(2);
  });

  it('gives no third bonus when the chosen third did not actually advance', () => {
    const predicted = [{ teamId: 'B3', groupName: 'B', position: 3, advancesAsThird: true }];
    const out = scoreGroupPredictions(predicted, actualStandings, new Set<string>(), cfg);
    expect(out[0].pointsAwarded).toBe(2); // correct position only
  });
});

describe('pickActualAdvancingThirds', () => {
  it('returns the best N third-placed teams across groups by points/gd/gf', () => {
    const thirds = pickActualAdvancingThirds(actualStandings, 1);
    expect(thirds).toEqual(new Set(['B3'])); // B3 (4 pts) beats A3 (3 pts)
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run src/lib/bracket-scoring.test.ts`
Expected: FAIL — `Cannot find module './bracket-scoring'`.

- [ ] **Step 3: Implement group scoring + actual thirds**

Create `src/lib/bracket-scoring.ts`:

```ts
import type { ScoringConfig } from './scoring-config';
import type { GroupStandings } from './standings';

export type GroupPick = {
  teamId: string; groupName: string; position: number; advancesAsThird: boolean;
};

/** Per-team group points: exact-position + (chosen-third that actually advanced). */
export function scoreGroupPredictions(
  predicted: GroupPick[],
  actualStandings: GroupStandings[],
  actualAdvancingThirds: Set<string>,
  cfg: ScoringConfig,
): Array<{ teamId: string; pointsAwarded: number }> {
  const actualPos = new Map<string, number>();   // teamId -> 1..4
  for (const g of actualStandings) {
    g.rows.forEach((r, i) => actualPos.set(r.teamId, i + 1));
  }
  return predicted.map((p) => {
    let pts = 0;
    if (actualPos.get(p.teamId) === p.position) pts += cfg.ptsGroupPosition;
    if (p.advancesAsThird && actualAdvancingThirds.has(p.teamId)) pts += cfg.ptsThirdQualifier;
    return { teamId: p.teamId, pointsAwarded: pts };
  });
}

/**
 * The best `count` (default 8) third-placed teams across all groups, ranked by the same
 * tie-break as the group tables (points -> gd -> gf -> name). Used to derive who actually
 * advanced as a third for scoring.
 */
export function pickActualAdvancingThirds(
  actualStandings: GroupStandings[], count = 8,
): Set<string> {
  const thirds = actualStandings
    .map((g) => g.rows[2])
    .filter((r): r is NonNullable<typeof r> => r != null);
  thirds.sort((x, y) =>
    y.points - x.points || y.gd - x.gd || y.gf - x.gf || x.name.localeCompare(y.name));
  return new Set(thirds.slice(0, count).map((r) => r.teamId));
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/bracket-scoring.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bracket-scoring.ts src/lib/bracket-scoring.test.ts
git commit -m "feat(bracket-scoring): group-position + third-qualifier scoring (TDD)"
```

---

## Task 7: `bracket-scoring.ts` — bracket (reaches-round) + awards

**Files:**
- Modify: `src/lib/bracket-scoring.ts`
- Modify: `src/lib/bracket-scoring.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `src/lib/bracket-scoring.test.ts`:

```ts
import { scoreBracket, scoreAwards } from './bracket-scoring';

describe('scoreBracket', () => {
  const actualReached = {
    r16: new Set(['X', 'Y', 'Z']),
    qf: new Set(['X', 'Y']),
    sf: new Set(['X']),
    final: new Set(['X']),
  };
  it('awards per-stage points when the predicted team actually reached that stage', () => {
    const preds = [
      { stage: 'r16' as const, teamId: 'X' }, // +1
      { stage: 'qf' as const, teamId: 'X' },  // +2
      { stage: 'sf' as const, teamId: 'X' },  // +3
      { stage: 'final' as const, teamId: 'X' }, // +5
      { stage: 'r16' as const, teamId: 'Q' }, // not reached -> 0
    ];
    const out = scoreBracket(preds, actualReached, cfg);
    expect(out.map((o) => o.pointsAwarded)).toEqual([1, 2, 3, 5, 0]);
  });
});

describe('scoreAwards', () => {
  it('sums champion/runner-up/golden-boot/best-player/surprise for correct picks', () => {
    const predicted = {
      championTeamId: 'C', runnerUpTeamId: 'R',
      goldenBootPlayerId: 'g', bestPlayerId: 'b', surpriseTeamId: 's',
    };
    const actual = {
      championTeamId: 'C', runnerUpTeamId: 'X',   // champion right, runner-up wrong
      goldenBootPlayerId: 'g', bestPlayerId: 'z',  // golden boot right, best player wrong
      surpriseTeamId: 's',
    };
    // +10 champion + 5 golden boot + 5 surprise = 20
    expect(scoreAwards(predicted, actual, cfg)).toBe(20);
  });

  it('is zero when nothing matches or actuals are null', () => {
    const predicted = { championTeamId: 'C', runnerUpTeamId: 'R', goldenBootPlayerId: 'g', bestPlayerId: 'b', surpriseTeamId: 's' };
    const actual = { championTeamId: null, runnerUpTeamId: null, goldenBootPlayerId: null, bestPlayerId: null, surpriseTeamId: null };
    expect(scoreAwards(predicted, actual, cfg)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run src/lib/bracket-scoring.test.ts`
Expected: FAIL — `scoreBracket`/`scoreAwards` not exported.

- [ ] **Step 3: Implement bracket + awards scoring**

Append to `src/lib/bracket-scoring.ts`:

```ts
type ReachStage = 'r16' | 'qf' | 'sf' | 'final';

const REACH_POINTS = (cfg: ScoringConfig): Record<ReachStage, number> => ({
  r16: cfg.ptsReachR16, qf: cfg.ptsReachQf, sf: cfg.ptsReachSf, final: cfg.ptsReachFinal,
});

/** Per bracket-prediction row: stage points if that team actually reached the stage. */
export function scoreBracket(
  predicted: Array<{ stage: ReachStage; teamId: string }>,
  actualReached: Record<ReachStage, Set<string>>,
  cfg: ScoringConfig,
): Array<{ stage: ReachStage; teamId: string; pointsAwarded: number }> {
  const pts = REACH_POINTS(cfg);
  return predicted.map((p) => ({
    ...p,
    pointsAwarded: actualReached[p.stage].has(p.teamId) ? pts[p.stage] : 0,
  }));
}

export type AwardPicks = {
  championTeamId: string | null; runnerUpTeamId: string | null;
  goldenBootPlayerId: string | null; bestPlayerId: string | null; surpriseTeamId: string | null;
};

/** Total award points for one user. A null actual never matches. */
export function scoreAwards(predicted: AwardPicks, actual: AwardPicks, cfg: ScoringConfig): number {
  const hit = (p: string | null, a: string | null) => p != null && a != null && p === a;
  let total = 0;
  if (hit(predicted.championTeamId, actual.championTeamId)) total += cfg.ptsChampion;
  if (hit(predicted.runnerUpTeamId, actual.runnerUpTeamId)) total += cfg.ptsRunnerUp;
  if (hit(predicted.goldenBootPlayerId, actual.goldenBootPlayerId)) total += cfg.ptsGoldenBoot;
  if (hit(predicted.bestPlayerId, actual.bestPlayerId)) total += cfg.ptsBestPlayer;
  if (hit(predicted.surpriseTeamId, actual.surpriseTeamId)) total += cfg.ptsSurprise;
  return total;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/bracket-scoring.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bracket-scoring.ts src/lib/bracket-scoring.test.ts
git commit -m "feat(bracket-scoring): reaches-round + awards scoring (TDD)"
```

---

## Task 8: `get-bracket.ts` — DB reader for the bracket page

**Files:**
- Create: `src/lib/get-bracket.ts`

- [ ] **Step 1: Implement the reader**

Create `src/lib/get-bracket.ts`:

```ts
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  teams, players, groupPredictions, bracketPredictions, awardPredictions,
} from '@/db/schema';
import { getPredictionsLockAt } from './app-settings';
import { arePredictionsLocked } from './locks';

export type BracketTeam = { id: string; code: string; name: string; flag: string | null; groupName: string | null };
export type BracketPlayer = { id: string; name: string; teamId: string; goldenBootEligible: boolean; bestPlayerEligible: boolean };

export type SavedGroupPick = { groupName: string; teamId: string; position: number; advancesAsThird: boolean };
export type SavedAwards = {
  championTeamId: string | null; runnerUpTeamId: string | null;
  goldenBootPlayerId: string | null; bestPlayerId: string | null; surpriseTeamId: string | null;
};

export type BracketData = {
  teams: BracketTeam[];
  players: BracketPlayer[];
  locked: boolean;
  lockAt: number | null;                 // ms epoch, for the client countdown
  groupPicks: SavedGroupPick[];          // this user's saved order (empty if none)
  reached: { r16: string[]; qf: string[]; sf: string[]; final: string[] };
  awards: SavedAwards | null;
};

/** Loads everything the /bracket simulator needs for a given user. */
export async function getBracketData(userId: string | null, now: Date = new Date()): Promise<BracketData> {
  const lockAt = await getPredictionsLockAt();
  const [teamRows, playerRows] = await Promise.all([
    db.select().from(teams),
    db.select().from(players),
  ]);

  const teamsOut: BracketTeam[] = teamRows
    .filter((t) => t.groupName)                 // only real group teams (skip TBD placeholders)
    .map((t) => ({ id: t.id, code: t.code, name: t.name, flag: t.flag, groupName: t.groupName }));

  const playersOut: BracketPlayer[] = playerRows.map((p) => ({
    id: p.id, name: p.name, teamId: p.teamId,
    goldenBootEligible: p.goldenBootEligible, bestPlayerEligible: p.bestPlayerEligible,
  }));

  let groupPicks: SavedGroupPick[] = [];
  let reached = { r16: [] as string[], qf: [] as string[], sf: [] as string[], final: [] as string[] };
  let awards: SavedAwards | null = null;

  if (userId) {
    const [gRows, bRows, aRows] = await Promise.all([
      db.select().from(groupPredictions).where(eq(groupPredictions.userId, userId)),
      db.select().from(bracketPredictions).where(eq(bracketPredictions.userId, userId)),
      db.select().from(awardPredictions).where(eq(awardPredictions.userId, userId)),
    ]);
    groupPicks = gRows.map((g) => ({
      groupName: g.groupName, teamId: g.teamId, position: g.position, advancesAsThird: g.advancesAsThird,
    }));
    for (const b of bRows) {
      if (b.stage === 'r16' || b.stage === 'qf' || b.stage === 'sf' || b.stage === 'final') {
        reached[b.stage].push(b.teamId);
      }
    }
    const a = aRows[0];
    awards = a ? {
      championTeamId: a.championTeamId, runnerUpTeamId: a.runnerUpTeamId,
      goldenBootPlayerId: a.goldenBootPlayerId, bestPlayerId: a.bestPlayerId, surpriseTeamId: a.surpriseTeamId,
    } : null;
  }

  return {
    teams: teamsOut, players: playersOut,
    locked: arePredictionsLocked(lockAt, now),
    lockAt: lockAt ? lockAt.getTime() : null,
    groupPicks, reached, awards,
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/get-bracket.ts
git commit -m "feat(bracket): get-bracket DB reader"
```

---

## Task 9: `saveBracket` server action

**Files:**
- Create: `src/app/bracket/actions.ts`

- [ ] **Step 1: Implement the save action**

Create `src/app/bracket/actions.ts`:

```ts
'use server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  teams, groupPredictions, bracketPredictions, awardPredictions,
} from '@/db/schema';
import { createClient } from '@/lib/supabase/server';
import { getPredictionsLockAt } from '@/lib/app-settings';
import { arePredictionsLocked } from '@/lib/locks';
import { validateBracket, type PredictedStandings } from '@/lib/bracket';

export type SaveBracketInput = {
  standings: PredictedStandings;          // group -> ordered team ids
  chosenThirds: string[];                 // 8 team ids
  reached: { r16: string[]; qf: string[]; sf: string[]; final: string[] };
  awards: {
    goldenBootPlayerId: string | null; bestPlayerId: string | null; surpriseTeamId: string | null;
  };
  // champion + runner-up are derived from reached.final (the two finalists) + the user's
  // tapped champion:
  championTeamId: string | null;
};

export type SaveResult = { ok: boolean; error?: string };

export async function saveBracket(input: SaveBracketInput): Promise<SaveResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sign in to save your bracket.' };

  const lockAt = await getPredictionsLockAt();
  if (arePredictionsLocked(lockAt)) return { ok: false, error: 'Predictions are locked.' };

  // Build the actual group membership from the DB (source of truth for validation).
  const teamRows = await db.select().from(teams);
  const groupTeams: Record<string, string[]> = {};
  for (const t of teamRows) {
    if (!t.groupName) continue;
    (groupTeams[t.groupName] ??= []).push(t.id);
  }

  const v = validateBracket({
    groupTeams, standings: input.standings, chosenThirds: input.chosenThirds, reached: input.reached,
  });
  if (!v.ok) return { ok: false, error: v.error };

  // Champion (if set) must be one of the two finalists; runner-up is the other.
  let runnerUpTeamId: string | null = null;
  if (input.championTeamId) {
    if (!input.reached.final.includes(input.championTeamId)) {
      return { ok: false, error: 'Champion must be one of your two finalists.' };
    }
    runnerUpTeamId = input.reached.final.find((id) => id !== input.championTeamId) ?? null;
  }

  const userId = user.id;
  const thirdSet = new Set(input.chosenThirds);

  // Flatten group picks: one row per team, position from the predicted order.
  const groupRows = Object.entries(input.standings).flatMap(([groupName, order]) =>
    order.map((teamId, i) => ({
      userId, groupName, teamId, position: i + 1,
      advancesAsThird: i === 2 && thirdSet.has(teamId),
      pointsAwarded: null as number | null,
    })),
  );

  const bracketRows = (['r16', 'qf', 'sf', 'final'] as const).flatMap((stage) =>
    input.reached[stage].map((teamId) => ({ userId, stage, teamId, pointsAwarded: null as number | null })),
  );

  await db.transaction(async (tx) => {
    await tx.delete(groupPredictions).where(eq(groupPredictions.userId, userId));
    if (groupRows.length) await tx.insert(groupPredictions).values(groupRows);

    await tx.delete(bracketPredictions).where(eq(bracketPredictions.userId, userId));
    if (bracketRows.length) await tx.insert(bracketPredictions).values(bracketRows);

    await tx.insert(awardPredictions).values({
      userId,
      championTeamId: input.championTeamId,
      runnerUpTeamId,
      goldenBootPlayerId: input.awards.goldenBootPlayerId,
      bestPlayerId: input.awards.bestPlayerId,
      surpriseTeamId: input.awards.surpriseTeamId,
      pointsAwarded: null,
    }).onConflictDoUpdate({
      target: awardPredictions.userId,
      set: {
        championTeamId: input.championTeamId,
        runnerUpTeamId,
        goldenBootPlayerId: input.awards.goldenBootPlayerId,
        bestPlayerId: input.awards.bestPlayerId,
        surpriseTeamId: input.awards.surpriseTeamId,
        pointsAwarded: null,
      },
    });
  });

  revalidatePath('/bracket');
  revalidatePath('/leaderboard');
  return { ok: true };
}
```

Note: confirm the Supabase server-client import path matches the project (check an existing server action, e.g. `src/app/fixtures/actions.ts`, for how the authed user is obtained — reuse that exact pattern instead of `@/lib/supabase/server` if it differs).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS. If the Supabase import path was wrong, fix it to match `src/app/fixtures/actions.ts` and re-run.

- [ ] **Step 3: Commit**

```bash
git add src/app/bracket/actions.ts
git commit -m "feat(bracket): saveBracket server action with lock + validation"
```

---

## Task 10: Recompute brackets/groups/awards + wire into admin

**Files:**
- Create: `src/lib/bracket-recompute.ts`
- Modify: `src/app/admin/matches/actions.ts`

- [ ] **Step 1: Implement the recompute functions**

Create `src/lib/bracket-recompute.ts`:

```ts
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  teams, matches, groupPredictions, bracketPredictions, awardPredictions,
} from '@/db/schema';
import { getScoringConfig, getActualAwards } from './app-settings';
import { computeGroupStandings, type BoardTeam } from './standings';
import { getFixtures } from './get-fixtures';
import {
  scoreGroupPredictions, pickActualAdvancingThirds, scoreBracket, scoreAwards,
  type GroupPick,
} from './bracket-scoring';

type ReachStage = 'r16' | 'qf' | 'sf' | 'final';

/** Recomputes group + bracket pointsAwarded for ALL users from current real results. */
export async function recomputeBracketsAndGroups(): Promise<void> {
  const cfg = await getScoringConfig();
  const fixtures = await getFixtures();
  const teamRows = await db.select().from(teams);

  const boardTeams: BoardTeam[] = teamRows
    .filter((t) => t.groupName)
    .map((t) => ({ id: t.id, code: t.code, name: t.name, flag: t.flag, groupName: t.groupName }));
  const actualStandings = computeGroupStandings(boardTeams, fixtures);
  const actualThirds = pickActualAdvancingThirds(actualStandings, 8);

  // Actual reached sets = distinct participants of FINISHED-or-scheduled knockout matches
  // that have both teams assigned (admin fills TBD slots as the tournament progresses).
  const reached: Record<ReachStage, Set<string>> = {
    r16: new Set(), qf: new Set(), sf: new Set(), final: new Set(),
  };
  for (const f of fixtures) {
    const stage = f.stage as string;
    if (stage in reached && f.home && f.away) {
      reached[stage as ReachStage].add(f.home.id);
      reached[stage as ReachStage].add(f.away.id);
    }
  }

  // Group points (per row).
  const gRows = await db.select().from(groupPredictions);
  const picks: GroupPick[] = gRows.map((g) => ({
    teamId: g.teamId, groupName: g.groupName, position: g.position, advancesAsThird: g.advancesAsThird,
  }));
  const gScores = scoreGroupPredictions(picks, actualStandings, actualThirds, cfg);
  const gById = new Map(gRows.map((r) => [`${r.userId}:${r.teamId}`, r.id]));
  const gPtsByTeamUser = new Map<string, number>(); // index aligns with picks/gRows order
  gScores.forEach((s, i) => gPtsByTeamUser.set(gRows[i].id, s.pointsAwarded));
  for (const r of gRows) {
    await db.update(groupPredictions)
      .set({ pointsAwarded: gPtsByTeamUser.get(r.id) ?? 0 })
      .where(eq(groupPredictions.id, r.id));
  }

  // Bracket points (per row).
  const bRows = await db.select().from(bracketPredictions);
  const scorable = bRows
    .filter((b) => (['r16', 'qf', 'sf', 'final'] as string[]).includes(b.stage))
    .map((b) => ({ stage: b.stage as ReachStage, teamId: b.teamId }));
  const bScores = scoreBracket(scorable, reached, cfg);
  // Map back by (id): rebuild aligned with the filtered order.
  const filtered = bRows.filter((b) => (['r16', 'qf', 'sf', 'final'] as string[]).includes(b.stage));
  for (let i = 0; i < filtered.length; i++) {
    await db.update(bracketPredictions)
      .set({ pointsAwarded: bScores[i].pointsAwarded })
      .where(eq(bracketPredictions.id, filtered[i].id));
  }
}

/** Recomputes award pointsAwarded for ALL users. Champion/runner-up from the real final. */
export async function recomputeAwards(): Promise<void> {
  const cfg = await getScoringConfig();
  const fixtures = await getFixtures();
  const admin = await getActualAwards();

  // Derive actual champion/runner-up from the finished final.
  const final = fixtures.find((f) => f.stage === 'final');
  let championTeamId: string | null = null;
  let runnerUpTeamId: string | null = null;
  if (final && final.status === 'finished' && final.home && final.away
      && final.homeScore != null && final.awayScore != null && final.homeScore !== final.awayScore) {
    const homeWon = final.homeScore > final.awayScore;
    championTeamId = homeWon ? final.home.id : final.away.id;
    runnerUpTeamId = homeWon ? final.away.id : final.home.id;
  }

  const actual = {
    championTeamId, runnerUpTeamId,
    goldenBootPlayerId: admin.goldenBootPlayerId,
    bestPlayerId: admin.bestPlayerId,
    surpriseTeamId: admin.surpriseTeamId,
  };

  const aRows = await db.select().from(awardPredictions);
  for (const a of aRows) {
    const pts = scoreAwards({
      championTeamId: a.championTeamId, runnerUpTeamId: a.runnerUpTeamId,
      goldenBootPlayerId: a.goldenBootPlayerId, bestPlayerId: a.bestPlayerId, surpriseTeamId: a.surpriseTeamId,
    }, actual, cfg);
    await db.update(awardPredictions)
      .set({ pointsAwarded: pts })
      .where(eq(awardPredictions.userId, a.userId));
  }
}
```

- [ ] **Step 2: Wire into the admin match-result action**

In `src/app/admin/matches/actions.ts`, import the new functions and call them after a result save (a knockout/group result changes bracket + group + award actuals). Edit the top imports and the end of `saveResult`:

```ts
import { recomputeMatch } from '@/lib/scoring';
import { recomputeBracketsAndGroups, recomputeAwards } from '@/lib/bracket-recompute';
```

Then in `saveResult`, replace the lines after `await setMatchResult(...)`:

```ts
  await setMatchResult(matchId, home, away, status);
  await recomputeMatch(matchId);
  await recomputeBracketsAndGroups();
  await recomputeAwards();
  revalidatePath('/fixtures');
  revalidatePath('/admin/matches');
  revalidatePath('/leaderboard');
  revalidatePath('/bracket');
  return { ok: true };
```

Also wire `saveMatchMeta` to recompute brackets/groups, because filling a TBD knockout slot (metadata, not a result) changes who "reached" a round. After `await updateMatchMeta(...)`:

```ts
  await updateMatchMeta(matchId, meta);
  await recomputeBracketsAndGroups();   // filling TBD knockout slots changes reached-round actuals
  revalidatePath('/fixtures');
  revalidatePath('/admin/matches');
  revalidatePath('/leaderboard');
  revalidatePath('/bracket');
  return { ok: true };
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/bracket-recompute.ts src/app/admin/matches/actions.ts
git commit -m "feat(bracket): recompute groups/bracket/awards + wire into admin result entry"
```

---

## Task 11: Leaderboard bonus — fold group/bracket/award points into Overall

**Files:**
- Modify: `src/lib/leaderboard.ts`
- Modify: `src/lib/leaderboard.test.ts`
- Modify: `src/lib/get-leaderboard.ts`
- Modify: `src/components/leaderboard/leaderboard-view.tsx`
- Modify: `src/app/leaderboard/page.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add the failing test for the bonus**

Append to `src/lib/leaderboard.test.ts` (inside the existing `describe('buildLeaderboard', ...)` or after it):

```ts
describe('buildLeaderboard bonus', () => {
  const players: LeaderPlayer[] = [
    { id: 'a', displayName: 'A', avatarSeed: null },
    { id: 'b', displayName: 'B', avatarSeed: null },
  ];
  const p = (userId: string, matchId: string, pts: number, exact = false): ScoredPrediction =>
    ({ userId, matchId, homeScore: 0, awayScore: 0, pointsAwarded: pts, exact });

  it('adds per-user bonus points to the overall total', () => {
    const rows = buildLeaderboard(players, [p('a', 'm1', 1), p('b', 'm1', 1)], { bonusByUser: { a: 10 } });
    const a = rows.find((r) => r.userId === 'a')!;
    const b = rows.find((r) => r.userId === 'b')!;
    expect(a.points).toBe(11);
    expect(b.points).toBe(1);
    expect(a.rank).toBe(1);
  });

  it('ignores bonus when a match scope is set (per-round/by-match stay match-only)', () => {
    const rows = buildLeaderboard(
      players, [p('a', 'm1', 1)],
      { matchIdsInScope: new Set(['m1']), bonusByUser: { a: 10 } },
    );
    expect(rows.find((r) => r.userId === 'a')!.points).toBe(1);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run src/lib/leaderboard.test.ts`
Expected: FAIL — `bonusByUser` not honored (a.points is 1, not 11).

- [ ] **Step 3: Add `bonusByUser` to `buildLeaderboard`**

In `src/lib/leaderboard.ts`, change the signature and apply the bonus only when no scope is set:

```ts
export function buildLeaderboard(
  players: LeaderPlayer[],
  predictions: ScoredPrediction[],
  opts?: { matchIdsInScope?: Set<string>; bonusByUser?: Record<string, number> },
): LeaderRow[] {
  const scope = opts?.matchIdsInScope;
  const bonus = opts?.bonusByUser;
  const agg = new Map<string, { points: number; exactCount: number; predictedCount: number }>();
  for (const pl of players) agg.set(pl.id, { points: 0, exactCount: 0, predictedCount: 0 });

  for (const pred of predictions) {
    if (scope && !scope.has(pred.matchId)) continue;
    const a = agg.get(pred.userId);
    if (!a) continue;
    a.predictedCount += 1;
    a.points += pred.pointsAwarded ?? 0;
    if (pred.exact) a.exactCount += 1;
  }

  // Non-match points (group/bracket/awards) fold into the overall total only.
  if (!scope && bonus) {
    for (const [userId, pts] of Object.entries(bonus)) {
      const a = agg.get(userId);
      if (a) a.points += pts;
    }
  }
  // ... rest of the function unchanged (rows map, sort, ranking) ...
```

Leave the remainder of the function (rows construction, sort, competition ranking) exactly as-is.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/leaderboard.test.ts`
Expected: PASS (existing + the two new cases).

- [ ] **Step 5: Read group/bracket/award points in `getLeaderboardData`**

In `src/lib/get-leaderboard.ts`, extend the imports and aggregate the bonus. Change the schema import line and the `Promise.all`, and add the bonus to the return type + value:

```ts
import { db } from '@/db';
import { profiles, matchPredictions, groupPredictions, bracketPredictions, awardPredictions } from '@/db/schema';
```

Add `bonusByUser` to `LeaderboardData`:

```ts
export type LeaderboardData = {
  players: LeaderPlayer[];
  predictions: ScoredPrediction[];
  matches: MatchMeta[];
  bonusByUser: Record<string, number>;
};
```

Extend the `Promise.all` and compute the bonus before returning:

```ts
  const [fixtures, profileRows, predRows, cfg, gRows, bRows, aRows] = await Promise.all([
    getFixtures(),
    db.select().from(profiles),
    db.select().from(matchPredictions),
    getScoringConfig(),
    db.select().from(groupPredictions),
    db.select().from(bracketPredictions),
    db.select().from(awardPredictions),
  ]);

  const bonusByUser: Record<string, number> = {};
  const add = (userId: string, pts: number | null) => {
    if (pts == null) return;
    bonusByUser[userId] = (bonusByUser[userId] ?? 0) + pts;
  };
  for (const r of gRows) add(r.userId, r.pointsAwarded);
  for (const r of bRows) add(r.userId, r.pointsAwarded);
  for (const r of aRows) add(r.userId, r.pointsAwarded);
```

Add `bonusByUser` to the returned object:

```ts
  return { players, predictions, matches, bonusByUser };
```

- [ ] **Step 6: Thread the bonus into the views**

In `src/app/leaderboard/page.tsx`, destructure `bonusByUser` from `getLeaderboardData()` and pass it to the view component as a prop (add `bonusByUser={bonusByUser}` where `LeaderboardView` is rendered; add the prop to the component's props type in the next edit).

In `src/components/leaderboard/leaderboard-view.tsx`, add `bonusByUser: Record<string, number>` to its props, and pass it to the **Overall** build only:

```ts
  const overall = useMemo(
    () => buildLeaderboard(players, predictions, { bonusByUser }),
    [players, predictions, bonusByUser],
  );
  const round = useMemo(
    () => buildLeaderboard(players, predictions, { matchIdsInScope: scopeIds }),
    [players, predictions, scopeIds],
  );
```

In `src/app/page.tsx`, where the homepage rank is built, pass the bonus:

```ts
    const { players, predictions, bonusByUser } = await getLeaderboardData();
    const board = buildLeaderboard(players, predictions, { bonusByUser });
```

(Adjust the destructuring to match the existing call; `getLeaderboardData` now also returns `bonusByUser`.)

- [ ] **Step 7: Type-check + full test run**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/leaderboard.ts src/lib/leaderboard.test.ts src/lib/get-leaderboard.ts src/components/leaderboard/leaderboard-view.tsx src/app/leaderboard/page.tsx src/app/page.tsx
git commit -m "feat(leaderboard): fold group/bracket/award points into Overall total"
```

---

## Task 12: `/bracket` page shell + group orderer

**Files:**
- Create: `src/app/bracket/page.tsx`
- Create: `src/components/bracket/bracket-simulator.tsx`
- Create: `src/components/bracket/group-orderer.tsx`

- [ ] **Step 1: Server page that loads data + auth**

Create `src/app/bracket/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server';
import { getBracketData } from '@/lib/get-bracket';
import { BracketSimulator } from '@/components/bracket/bracket-simulator';

export default async function BracketPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const data = await getBracketData(user?.id ?? null);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="font-display text-cream text-2xl mb-4" style={{ textShadow: '2px 2px 0 #06231a' }}>
        Build your bracket
      </h1>
      {!user ? (
        <p className="rp-card p-4 text-pitch">Sign in to build and save your bracket.</p>
      ) : (
        <BracketSimulator data={data} signedIn />
      )}
    </main>
  );
}
```

Use the same Supabase server-client pattern as `src/app/bracket/actions.ts` (verified in Task 9).

- [ ] **Step 2: The simulator client component (state + section nav)**

Create `src/components/bracket/bracket-simulator.tsx`:

```tsx
'use client';
import { useMemo, useState, useTransition } from 'react';
import type { BracketData } from '@/lib/get-bracket';
import { GroupOrderer } from './group-orderer';
import { ThirdsPicker } from './thirds-picker';
import { KnockoutTree } from './knockout-tree';
import { AwardsPanel } from './awards-panel';
import { saveBracket } from '@/app/bracket/actions';
import type { PredictedStandings } from '@/lib/bracket';

const GROUP_NAMES = 'ABCDEFGHIJKL'.split('');

export function BracketSimulator({ data, signedIn }: { data: BracketData; signedIn: boolean }) {
  // Initialize predicted standings from saved picks, else default to DB group order.
  const [standings, setStandings] = useState<PredictedStandings>(() => buildInitialStandings(data));
  const [thirds, setThirds] = useState<string[]>(() =>
    data.groupPicks.filter((g) => g.advancesAsThird).map((g) => g.teamId));
  const [reached, setReached] = useState(() => ({ ...data.reached }));
  const [champion, setChampion] = useState<string | null>(data.awards?.championTeamId ?? null);
  const [awards, setAwards] = useState({
    goldenBootPlayerId: data.awards?.goldenBootPlayerId ?? null,
    bestPlayerId: data.awards?.bestPlayerId ?? null,
    surpriseTeamId: data.awards?.surpriseTeamId ?? null,
  });
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const groupsDone = GROUP_NAMES.every((g) => (standings[g]?.length ?? 0) === 4);
  const thirdsDone = thirds.length === 8;
  const teamById = useMemo(() => new Map(data.teams.map((t) => [t.id, t])), [data.teams]);

  function onGroupReorder(next: PredictedStandings) {
    setStandings(next);
    // Reset downstream picks that may no longer be valid.
    setThirds((prev) => prev.filter((id) => Object.values(next).some((o) => o[2] === id)));
    setReached({ r16: [], qf: [], sf: [], final: [] });
    setChampion(null);
  }

  function onSave() {
    setMsg(null);
    start(async () => {
      const res = await saveBracket({
        standings, chosenThirds: thirds, reached, awards, championTeamId: champion,
      });
      setMsg(res.ok ? 'Saved! ✅' : (res.error ?? 'Save failed.'));
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <nav className="sticky top-0 z-10 flex gap-2 flex-wrap rp-card p-2 text-sm">
        <a href="#groups" className="rp-pill px-2 py-1">Groups {GROUP_NAMES.filter((g) => standings[g]?.length === 4).length}/12</a>
        <a href="#thirds" className="rp-pill px-2 py-1">Thirds {thirds.length}/8</a>
        <a href="#bracket" className="rp-pill px-2 py-1">Bracket</a>
        <a href="#awards" className="rp-pill px-2 py-1">Awards</a>
      </nav>

      <section id="groups">
        <GroupOrderer
          groupNames={GROUP_NAMES} standings={standings} teamById={teamById}
          locked={data.locked} onChange={onGroupReorder}
        />
      </section>

      <section id="thirds" className={!groupsDone ? 'opacity-40 pointer-events-none' : ''}>
        <ThirdsPicker
          standings={standings} teamById={teamById} chosen={thirds}
          locked={data.locked} onChange={setThirds}
        />
        {!groupsDone && <p className="text-cream text-sm mt-2">Finish ordering all 12 groups first.</p>}
      </section>

      <section id="bracket" className={!(groupsDone && thirdsDone) ? 'opacity-40 pointer-events-none' : ''}>
        <KnockoutTree
          standings={standings} thirds={thirds} reached={reached} champion={champion}
          teamById={teamById} locked={data.locked}
          onReachedChange={setReached} onChampionChange={setChampion}
        />
        {!(groupsDone && thirdsDone) && <p className="text-cream text-sm mt-2">Set groups and pick 8 thirds to unlock the bracket.</p>}
      </section>

      <section id="awards">
        <AwardsPanel
          players={data.players} teams={data.teams}
          finalists={reached.final} champion={champion}
          value={awards} locked={data.locked} onChange={setAwards}
        />
      </section>

      {!data.locked && signedIn && (
        <div className="flex items-center gap-3">
          <button onClick={onSave} disabled={pending} className="rp-cta px-6 py-3">
            {pending ? 'Saving…' : 'Save bracket'}
          </button>
          {msg && <span className="text-cream">{msg}</span>}
        </div>
      )}
      {data.locked && <p className="rp-card p-3 text-pitch">🔒 Predictions are locked — this is your final bracket.</p>}
    </div>
  );
}

function buildInitialStandings(data: BracketData): PredictedStandings {
  const out: PredictedStandings = {};
  // Group teams by groupName from the DB list.
  const byGroup = new Map<string, string[]>();
  for (const t of data.teams) {
    if (!t.groupName) continue;
    (byGroup.get(t.groupName) ?? byGroup.set(t.groupName, []).get(t.groupName)!).push(t.id);
  }
  for (const [g, ids] of byGroup) out[g] = [...ids];
  // Overlay any saved order.
  if (data.groupPicks.length) {
    const byGroupSaved = new Map<string, { teamId: string; position: number }[]>();
    for (const p of data.groupPicks) {
      (byGroupSaved.get(p.groupName) ?? byGroupSaved.set(p.groupName, []).get(p.groupName)!)
        .push({ teamId: p.teamId, position: p.position });
    }
    for (const [g, picks] of byGroupSaved) {
      out[g] = picks.sort((a, b) => a.position - b.position).map((p) => p.teamId);
    }
  }
  return out;
}
```

- [ ] **Step 3: Group orderer component (up/down reordering, no drag-drop dep)**

Create `src/components/bracket/group-orderer.tsx`:

```tsx
'use client';
import type { PredictedStandings } from '@/lib/bracket';
import type { BracketTeam } from '@/lib/get-bracket';

export function GroupOrderer({
  groupNames, standings, teamById, locked, onChange,
}: {
  groupNames: string[];
  standings: PredictedStandings;
  teamById: Map<string, BracketTeam>;
  locked: boolean;
  onChange: (next: PredictedStandings) => void;
}) {
  function move(group: string, idx: number, dir: -1 | 1) {
    const order = [...(standings[group] ?? [])];
    const j = idx + dir;
    if (j < 0 || j >= order.length) return;
    [order[idx], order[j]] = [order[j], order[idx]];
    onChange({ ...standings, [group]: order });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {groupNames.map((g) => (
        <div key={g} className="rp-card p-3">
          <div className="font-display text-pitch mb-2">Group {g}</div>
          <ol className="flex flex-col gap-1">
            {(standings[g] ?? []).map((id, i) => {
              const t = teamById.get(id);
              return (
                <li key={id} className="flex items-center gap-2 text-pitch">
                  <span className="font-pixel w-5 text-center">{i + 1}</span>
                  <span className="flex-1 truncate">{t?.flag} {t?.code ?? id}</span>
                  {!locked && (
                    <span className="flex gap-1">
                      <button aria-label="up" onClick={() => move(g, i, -1)} disabled={i === 0}
                        className="rp-pill px-2 disabled:opacity-30">▲</button>
                      <button aria-label="down" onClick={() => move(g, i, 1)} disabled={i === 3}
                        className="rp-pill px-2 disabled:opacity-30">▼</button>
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Verify build (components compile; tree/thirds/awards stubs come in Task 13)**

Because `bracket-simulator.tsx` imports `ThirdsPicker`, `KnockoutTree`, and `AwardsPanel` (created in Task 13), the build will fail until Task 13. To keep this task self-contained, create minimal placeholder files now so it compiles, then flesh them out in Task 13:

Create `src/components/bracket/thirds-picker.tsx`, `knockout-tree.tsx`, `awards-panel.tsx` each with a typed no-op default for now — **but** since the plan forbids placeholders, instead **do Task 13 immediately after Task 12 without an intermediate commit/build**. Commit Task 12 + Task 13 together at the end of Task 13.

Run: `npx tsc --noEmit` will fail here (missing modules) — that is expected; proceed to Task 13.

- [ ] **Step 5: (No commit yet — combined with Task 13.)**

---

## Task 13: Thirds picker + knockout tree + awards panel

**Files:**
- Create: `src/components/bracket/thirds-picker.tsx`
- Create: `src/components/bracket/knockout-tree.tsx`
- Create: `src/components/bracket/awards-panel.tsx`

- [ ] **Step 1: Thirds picker (pick exactly 8 of the 12 third-placed teams)**

Create `src/components/bracket/thirds-picker.tsx`:

```tsx
'use client';
import type { PredictedStandings } from '@/lib/bracket';
import type { BracketTeam } from '@/lib/get-bracket';

export function ThirdsPicker({
  standings, teamById, chosen, locked, onChange,
}: {
  standings: PredictedStandings;
  teamById: Map<string, BracketTeam>;
  chosen: string[];
  locked: boolean;
  onChange: (next: string[]) => void;
}) {
  const thirdTeams = Object.values(standings).map((o) => o[2]).filter(Boolean) as string[];
  const chosenSet = new Set(chosen);

  function toggle(id: string) {
    if (locked) return;
    if (chosenSet.has(id)) onChange(chosen.filter((x) => x !== id));
    else if (chosen.length < 8) onChange([...chosen, id]);
  }

  return (
    <div className="rp-card p-3">
      <div className="font-display text-pitch mb-2">Best 8 third-placed teams ({chosen.length}/8)</div>
      <div className="flex flex-wrap gap-2">
        {thirdTeams.map((id) => {
          const t = teamById.get(id);
          const on = chosenSet.has(id);
          return (
            <button key={id} onClick={() => toggle(id)} disabled={locked || (!on && chosen.length >= 8)}
              className={`rp-pill px-3 py-1 ${on ? 'bg-gold' : ''} disabled:opacity-40`}>
              {t?.flag} {t?.code ?? id}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Knockout tree (tap-to-advance, reactive)**

Create `src/components/bracket/knockout-tree.tsx`:

```tsx
'use client';
import { useMemo } from 'react';
import { reconstructBracket, type PredictedStandings, type BracketTie } from '@/lib/bracket';
import type { BracketTeam } from '@/lib/get-bracket';

type Reached = { r16: string[]; qf: string[]; sf: string[]; final: string[] };
const ROUNDS: Array<{ key: keyof Reached; from: 'r32' | 'r16' | 'qf' | 'sf'; label: string }> = [
  { key: 'r16', from: 'r32', label: 'Round of 16' },
  { key: 'qf', from: 'r16', label: 'Quarter-finals' },
  { key: 'sf', from: 'qf', label: 'Semi-finals' },
  { key: 'final', from: 'sf', label: 'Final' },
];

export function KnockoutTree({
  standings, thirds, reached, champion, teamById, locked, onReachedChange, onChampionChange,
}: {
  standings: PredictedStandings;
  thirds: string[];
  reached: Reached;
  champion: string | null;
  teamById: Map<string, BracketTeam>;
  locked: boolean;
  onReachedChange: (next: Reached) => void;
  onChampionChange: (id: string | null) => void;
}) {
  const tree = useMemo(
    () => reconstructBracket(standings, thirds, {
      r16: new Set(reached.r16), qf: new Set(reached.qf), sf: new Set(reached.sf), final: new Set(reached.final),
    }),
    [standings, thirds, reached],
  );

  const label = (id: string | null) => {
    if (!id) return 'TBD';
    const t = teamById.get(id);
    return `${t?.flag ?? ''} ${t?.code ?? id}`.trim();
  };

  // Advance a team into round `key` from its tie. Set-based (order-independent): add the
  // picked team, remove its sibling (the tie's other participant), clear deeper rounds.
  function advance(key: keyof Reached, tie: BracketTie, teamId: string) {
    if (locked) return;
    const sibling = tie.home === teamId ? tie.away : tie.home;
    const set = new Set(reached[key]);
    if (sibling) set.delete(sibling);
    set.add(teamId);
    const next: Reached = { ...reached, [key]: [...set] };
    // Clear all rounds deeper than `key` (their picks may no longer be reachable).
    const order: (keyof Reached)[] = ['r16', 'qf', 'sf', 'final'];
    for (let d = order.indexOf(key) + 1; d < order.length; d++) next[order[d]] = [];
    onReachedChange(next);
    onChampionChange(null);
  }

  return (
    <div className="rp-card p-3 overflow-x-auto">
      {ROUNDS.map(({ key, from, label: roundLabel }) => {
        const ties = tree[from];
        return (
          <div key={key} className="mb-4">
            <div className="font-display text-pitch mb-2">{roundLabel}</div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {ties.map((tie, i) => (
                <div key={i} className="border-[3px] border-pitch rounded-lg rp-shadow-sm p-2 flex flex-col gap-1">
                  {[tie.home, tie.away].map((id, side) => {
                    const picked = id != null && reached[key].includes(id);
                    return (
                      <button key={side} disabled={locked || id == null}
                        onClick={() => id && advance(key, tie, id)}
                        className={`text-left px-2 py-1 rounded ${picked ? 'bg-gold font-bold' : ''} disabled:opacity-50`}>
                        {label(id)}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="mt-4">
        <div className="font-display text-pitch mb-2">Champion 👑</div>
        <div className="flex gap-2">
          {reached.final.map((id) => (
            <button key={id} disabled={locked} onClick={() => onChampionChange(id)}
              className={`rp-pill px-4 py-2 ${champion === id ? 'bg-gold font-bold' : ''}`}>
              {label(id)}
            </button>
          ))}
          {reached.final.length < 2 && <span className="text-pitch/60">Pick your two finalists first.</span>}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Awards panel (Golden Boot / Best Player / Surprise + read-only champion/runner-up)**

Create `src/components/bracket/awards-panel.tsx`:

```tsx
'use client';
import type { BracketTeam, BracketPlayer } from '@/lib/get-bracket';

type AwardsValue = { goldenBootPlayerId: string | null; bestPlayerId: string | null; surpriseTeamId: string | null };

export function AwardsPanel({
  players, teams, finalists, champion, value, locked, onChange,
}: {
  players: BracketPlayer[];
  teams: BracketTeam[];
  finalists: string[];
  champion: string | null;
  value: AwardsValue;
  locked: boolean;
  onChange: (next: AwardsValue) => void;
}) {
  const teamName = (id: string | null) => teams.find((t) => t.id === id)?.name ?? 'TBD';
  const runnerUp = finalists.find((id) => id !== champion) ?? null;
  const gbPlayers = players.filter((p) => p.goldenBootEligible);
  const bpPlayers = players.filter((p) => p.bestPlayerEligible);

  const set = (patch: Partial<AwardsValue>) => onChange({ ...value, ...patch });

  return (
    <div className="rp-card p-3 flex flex-col gap-3">
      <div className="font-display text-pitch">Awards</div>
      <div className="grid gap-1 sm:grid-cols-2">
        <div className="text-pitch">🏆 Champion: <b>{teamName(champion)}</b></div>
        <div className="text-pitch">🥈 Runner-up: <b>{teamName(runnerUp)}</b></div>
      </div>

      <label className="flex flex-col gap-1 text-pitch">
        Golden Boot
        <select disabled={locked} value={value.goldenBootPlayerId ?? ''}
          onChange={(e) => set({ goldenBootPlayerId: e.target.value || null })}
          className="rp-pill px-2 py-1">
          <option value="">— pick a player —</option>
          {gbPlayers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-pitch">
        Best Player
        <select disabled={locked} value={value.bestPlayerId ?? ''}
          onChange={(e) => set({ bestPlayerId: e.target.value || null })}
          className="rp-pill px-2 py-1">
          <option value="">— pick a player —</option>
          {bpPlayers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-pitch">
        Surprise team
        <select disabled={locked} value={value.surpriseTeamId ?? ''}
          onChange={(e) => set({ surpriseTeamId: e.target.value || null })}
          className="rp-pill px-2 py-1">
          <option value="">— pick a team —</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
    </div>
  );
}
```

- [ ] **Step 4: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS (the sandbox may 500 on DB-backed pages at runtime — that is the known environment limitation, not a build error; the build itself must succeed).

- [ ] **Step 5: Commit (Tasks 12 + 13 together)**

```bash
git add src/app/bracket/ src/components/bracket/
git commit -m "feat(bracket): /bracket simulator — groups, thirds, knockout tree, awards"
```

---

## Task 14: `/admin/settings` — awards actuals + lock + prize + scoring constants

**Files:**
- Create: `src/app/admin/settings/page.tsx`
- Create: `src/app/admin/settings/settings-form.tsx`
- Create: `src/app/admin/settings/actions.ts`
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Server action(s)**

Create `src/app/admin/settings/actions.ts`:

```ts
'use server';
import { revalidatePath } from 'next/cache';
import { getAdminUser } from '@/lib/admin';
import { updateAppSettings } from '@/lib/app-settings';
import { recomputeAwards, recomputeBracketsAndGroups } from '@/lib/bracket-recompute';
import type { ScoringConfig } from '@/lib/scoring-config';

export type AdminResult = { ok: boolean; error?: string };

export async function saveSettings(input: {
  predictionsLockAt: string | null;            // ISO string or null
  prizeText: string | null;
  actualGoldenBootPlayerId: string | null;
  actualBestPlayerId: string | null;
  actualSurpriseTeamId: string | null;
  scoring: Partial<ScoringConfig>;
}): Promise<AdminResult> {
  if (!(await getAdminUser())) return { ok: false, error: 'Not authorized.' };

  let lockAt: Date | null = null;
  if (input.predictionsLockAt) {
    lockAt = new Date(input.predictionsLockAt);
    if (Number.isNaN(lockAt.getTime())) return { ok: false, error: 'Invalid lock date.' };
  }

  await updateAppSettings({
    predictionsLockAt: lockAt,
    prizeText: input.prizeText,
    actualGoldenBootPlayerId: input.actualGoldenBootPlayerId,
    actualBestPlayerId: input.actualBestPlayerId,
    actualSurpriseTeamId: input.actualSurpriseTeamId,
    scoring: input.scoring,
  });

  // Changing scoring constants or award actuals affects awarded points.
  await recomputeBracketsAndGroups();
  await recomputeAwards();

  revalidatePath('/leaderboard');
  revalidatePath('/bracket');
  revalidatePath('/admin/settings');
  return { ok: true };
}
```

- [ ] **Step 2: Server page (loads current values + lists for dropdowns)**

Create `src/app/admin/settings/page.tsx`:

```tsx
import { db } from '@/db';
import { players, teams, appSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { DEFAULT_SCORING } from '@/lib/scoring-config';
import { SettingsForm } from './settings-form';

export default async function AdminSettingsPage() {
  const [playerRows, teamRows, settingsRows] = await Promise.all([
    db.select().from(players),
    db.select().from(teams),
    db.select().from(appSettings).where(eq(appSettings.id, 1)),
  ]);
  const s = settingsRows[0];

  const current = {
    predictionsLockAt: s?.predictionsLockAt ? s.predictionsLockAt.toISOString().slice(0, 16) : '',
    prizeText: s?.prizeText ?? '',
    actualGoldenBootPlayerId: s?.actualGoldenBootPlayerId ?? '',
    actualBestPlayerId: s?.actualBestPlayerId ?? '',
    actualSurpriseTeamId: s?.actualSurpriseTeamId ?? '',
    scoring: {
      ptsExact: s?.ptsExact ?? DEFAULT_SCORING.ptsExact,
      ptsResult: s?.ptsResult ?? DEFAULT_SCORING.ptsResult,
      ptsReachR16: s?.ptsReachR16 ?? DEFAULT_SCORING.ptsReachR16,
      ptsReachQf: s?.ptsReachQf ?? DEFAULT_SCORING.ptsReachQf,
      ptsReachSf: s?.ptsReachSf ?? DEFAULT_SCORING.ptsReachSf,
      ptsReachFinal: s?.ptsReachFinal ?? DEFAULT_SCORING.ptsReachFinal,
      ptsChampion: s?.ptsChampion ?? DEFAULT_SCORING.ptsChampion,
      ptsRunnerUp: s?.ptsRunnerUp ?? DEFAULT_SCORING.ptsRunnerUp,
      ptsGoldenBoot: s?.ptsGoldenBoot ?? DEFAULT_SCORING.ptsGoldenBoot,
      ptsBestPlayer: s?.ptsBestPlayer ?? DEFAULT_SCORING.ptsBestPlayer,
      ptsSurprise: s?.ptsSurprise ?? DEFAULT_SCORING.ptsSurprise,
      ptsGroupPosition: s?.ptsGroupPosition ?? DEFAULT_SCORING.ptsGroupPosition,
      ptsThirdQualifier: s?.ptsThirdQualifier ?? DEFAULT_SCORING.ptsThirdQualifier,
    },
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-serif text-2xl font-bold text-pitch">Settings</h1>
      <SettingsForm
        current={current}
        players={playerRows.map((p) => ({ id: p.id, name: p.name }))}
        teams={teamRows.filter((t) => t.groupName).map((t) => ({ id: t.id, name: t.name }))}
      />
    </div>
  );
}
```

- [ ] **Step 3: Client form**

Create `src/app/admin/settings/settings-form.tsx`:

```tsx
'use client';
import { useState, useTransition } from 'react';
import { saveSettings } from './actions';
import type { ScoringConfig } from '@/lib/scoring-config';

type Current = {
  predictionsLockAt: string; prizeText: string;
  actualGoldenBootPlayerId: string; actualBestPlayerId: string; actualSurpriseTeamId: string;
  scoring: ScoringConfig;
};

const SCORING_FIELDS: Array<[keyof ScoringConfig, string]> = [
  ['ptsExact', 'Exact score'], ['ptsResult', 'Correct result'],
  ['ptsReachR16', 'Reach R16'], ['ptsReachQf', 'Reach QF'], ['ptsReachSf', 'Reach SF'], ['ptsReachFinal', 'Reach Final'],
  ['ptsChampion', 'Champion'], ['ptsRunnerUp', 'Runner-up'],
  ['ptsGoldenBoot', 'Golden Boot'], ['ptsBestPlayer', 'Best Player'], ['ptsSurprise', 'Surprise team'],
  ['ptsGroupPosition', 'Group position (each)'], ['ptsThirdQualifier', 'Advancing 3rd (each)'],
];

export function SettingsForm({ current, players, teams }: {
  current: Current;
  players: { id: string; name: string }[];
  teams: { id: string; name: string }[];
}) {
  const [form, setForm] = useState(current);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const setScore = (k: keyof ScoringConfig, v: string) =>
    setForm((f) => ({ ...f, scoring: { ...f.scoring, [k]: Number(v) } }));

  function onSubmit() {
    setMsg(null);
    start(async () => {
      const res = await saveSettings({
        predictionsLockAt: form.predictionsLockAt || null,
        prizeText: form.prizeText || null,
        actualGoldenBootPlayerId: form.actualGoldenBootPlayerId || null,
        actualBestPlayerId: form.actualBestPlayerId || null,
        actualSurpriseTeamId: form.actualSurpriseTeamId || null,
        scoring: form.scoring,
      });
      setMsg(res.ok ? 'Saved ✅ (points recomputed)' : (res.error ?? 'Save failed.'));
    });
  }

  return (
    <div className="flex flex-col gap-4 max-w-xl">
      <label className="flex flex-col gap-1">Predictions lock at
        <input type="datetime-local" value={form.predictionsLockAt}
          onChange={(e) => setForm((f) => ({ ...f, predictionsLockAt: e.target.value }))}
          className="rp-pill px-2 py-1" />
      </label>
      <label className="flex flex-col gap-1">Prize text
        <input value={form.prizeText}
          onChange={(e) => setForm((f) => ({ ...f, prizeText: e.target.value }))}
          className="rp-pill px-2 py-1" />
      </label>

      <fieldset className="flex flex-col gap-2 border-[3px] border-pitch rounded-lg p-3">
        <legend className="font-bold px-1">Actual award winners</legend>
        <label className="flex flex-col gap-1">Golden Boot
          <select value={form.actualGoldenBootPlayerId}
            onChange={(e) => setForm((f) => ({ ...f, actualGoldenBootPlayerId: e.target.value }))}
            className="rp-pill px-2 py-1">
            <option value="">—</option>
            {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">Best Player
          <select value={form.actualBestPlayerId}
            onChange={(e) => setForm((f) => ({ ...f, actualBestPlayerId: e.target.value }))}
            className="rp-pill px-2 py-1">
            <option value="">—</option>
            {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">Surprise team
          <select value={form.actualSurpriseTeamId}
            onChange={(e) => setForm((f) => ({ ...f, actualSurpriseTeamId: e.target.value }))}
            className="rp-pill px-2 py-1">
            <option value="">—</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-2 border-[3px] border-pitch rounded-lg p-3">
        <legend className="font-bold px-1">Scoring constants</legend>
        {SCORING_FIELDS.map(([k, label]) => (
          <label key={k} className="flex flex-col gap-1 text-sm">{label}
            <input type="number" value={form.scoring[k]}
              onChange={(e) => setScore(k, e.target.value)} className="rp-pill px-2 py-1" />
          </label>
        ))}
      </fieldset>

      <div className="flex items-center gap-3">
        <button onClick={onSubmit} disabled={pending} className="rp-cta px-6 py-3">
          {pending ? 'Saving…' : 'Save settings'}
        </button>
        {msg && <span>{msg}</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Link from the admin home**

In `src/app/admin/page.tsx`, add a second link after the Matches link:

```tsx
      <Link
        href="/admin/settings"
        className="rp-card p-4 font-bold text-pitch hover:bg-gold/20"
      >
        ⚙️ Awards & Settings →
      </Link>
```

And update the trailing note (remove "Ads and settings management arrive in later phases" → "Ads management arrives in Phase 6.").

- [ ] **Step 5: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/settings/ src/app/admin/page.tsx
git commit -m "feat(admin): /admin/settings — award actuals, lock date, prize, scoring constants"
```

---

## Task 15: Wire homepage teaser + nav to `/bracket`

**Files:**
- Modify: `src/components/home/bracket-teaser.tsx`

- [ ] **Step 1: Point the teaser CTA at `/bracket`**

In `src/components/home/bracket-teaser.tsx`, change the `Link href`:

```tsx
        <Link href="/bracket" className="rp-cta inline-block px-5 py-3">Build your bracket</Link>
```

(The nav link in `src/components/nav.tsx` already targets `/bracket`; no change needed — it now resolves.)

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/home/bracket-teaser.tsx
git commit -m "feat(home): wire bracket teaser CTA to /bracket"
```

---

## Task 16: Final verification + phase push

**Files:** none (verification only)

- [ ] **Step 1: Full test + type + lint + build**

Run: `npx vitest run && npx tsc --noEmit && npm run lint && npm run build`
Expected: all PASS. Fix any failures before continuing.

- [ ] **Step 2: Manual smoke checklist (note the sandbox-DB caveat)**

DB-backed pages may 500 in the sandbox (known env limitation). Verify on Vercel after push:
- `/bracket` signed-out → "Sign in to build…"; signed-in → groups render, ordering works, thirds unlock after 12 groups, bracket unlocks after 8 thirds, champion selectable from 2 finalists, Save persists and reloads with saved state.
- Enter a knockout result + an award actual in `/admin` → `/leaderboard` Overall total increases for correct predictors; H2H/by-match unchanged.
- After setting a past `predictionsLockAt` → `/bracket` is read-only.

- [ ] **Step 3: Update CLAUDE.md status + push the phase**

Add a Phase 5 COMPLETE bullet to `CLAUDE.md` (mirroring the Phase 4 entry style) summarizing the bracket simulator, scoring, admin settings, and the new `groupPredictions` table + constants. Commit:

```bash
git add CLAUDE.md
git commit -m "docs: mark Phase 5 (bracket + awards) complete in CLAUDE.md"
git push origin main
```

Expected: push succeeds; Vercel auto-deploys one build for the phase.

---

## Self-review notes (addressed)

- **Spec coverage:** simulator flow (T12–13), group order + thirds (T12–13), auto-seed via real top-2 wiring + simplified thirds (T4), tap-winners tree (T13), reaches-round scoring (T7), group scoring (T6), awards (T7), actuals auto-derive (T10), `groupPredictions` + `app_settings` columns (T1), constants (T2–3), leaderboard fold-in (T11), `/admin/settings` full editor (T14), teaser/nav wiring (T15) — all mapped.
- **Lock enforcement:** server-side in `saveBracket` (T9) and read-only UI (T12–13).
- **Type consistency:** `PredictedStandings`, `ReachedSets`, `BracketTie`, `GroupPick`, `AwardPicks`, `BracketData`/`BracketTeam`/`BracketPlayer`, `ScoringConfig` (+2 new fields) used consistently across tasks. `reached` is carried as ordered string[] arrays end-to-end (UI ↔ action ↔ validation), matching `validateBracket`'s tie-order requirement.
- **No placeholders:** every code step contains complete code. Task 12 intentionally defers its build/commit to Task 13 (documented) to avoid a placeholder-module commit.
