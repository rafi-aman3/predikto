# Phase 4 — Leaderboard + Head-to-Head Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/leaderboard` page (podium + Overall/By-stage/By-match tabs + prize marker), the `/h2h` friend-comparison page, and wire the homepage rank-strip to a real overall rank.

**Architecture:** Pure, unit-tested selectors in `src/lib/leaderboard.ts` (no DB import — client-safe) compute rankings, per-match boards, and head-to-head from plain rows. A thin server reader `src/lib/get-leaderboard.ts` loads players + all predictions + match metadata (reusing `getFixtures`) and precomputes per-prediction exactness from the live scoring config. Client view components hold tab/stage/opponent state in the URL via `history.replaceState` (same pattern as the fixtures rework), computing each view in-memory — the circle is tiny so no refetch is needed.

**Tech Stack:** Next.js 16 App Router (server + client components), Drizzle, Vitest, Tailwind v4 (`rp-*` + retro tokens), lucide-react. Retro primitives: `PixelAvatar`, `StickerCard`.

---

## File structure

**Create:**
- `src/lib/leaderboard.ts` — pure selectors + types (`LeaderPlayer`, `ScoredPrediction`, `MatchMeta`, `LeaderRow`, `MatchLeaderRow`, `H2HRow`, `HeadToHead`; `buildLeaderboard`, `buildMatchLeaderboard`, `buildHeadToHead`).
- `src/lib/leaderboard.test.ts` — tests for all three selectors.
- `src/lib/get-leaderboard.ts` — server DB reader (`getLeaderboardData`).
- `src/components/leaderboard/podium.tsx` — top-3 podium.
- `src/components/leaderboard/leaderboard-view.tsx` — client orchestrator (tabs/stage/match).
- `src/app/leaderboard/page.tsx` — server page.
- `src/components/h2h/h2h-view.tsx` — client H2H view.
- `src/app/h2h/page.tsx` — server page.

**Modify:**
- `src/lib/app-settings.ts` — add `getPrizeText()`.
- `src/components/home/rank-strip.tsx` — accept + render real rank.
- `src/app/page.tsx` — compute the signed-in user's overall rank, pass to `RankStrip`.

No schema changes, no migrations.

---

## Task 1: `buildLeaderboard` selector (TDD)

**Files:**
- Create: `src/lib/leaderboard.ts`
- Test: `src/lib/leaderboard.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/leaderboard.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildLeaderboard, type LeaderPlayer, type ScoredPrediction } from './leaderboard';

const players: LeaderPlayer[] = [
  { id: 'a', displayName: 'Ana', avatarSeed: null },
  { id: 'b', displayName: 'Bo', avatarSeed: null },
  { id: 'c', displayName: 'Cy', avatarSeed: null },
];
const p = (userId: string, matchId: string, pointsAwarded: number | null, exact = false): ScoredPrediction =>
  ({ userId, matchId, homeScore: 1, awayScore: 0, pointsAwarded, exact });

describe('buildLeaderboard', () => {
  it('sums points and counts predictions per player', () => {
    const rows = buildLeaderboard(players, [p('a', 'm1', 3, true), p('a', 'm2', 1), p('b', 'm1', 1)]);
    const ana = rows.find((r) => r.userId === 'a')!;
    expect(ana.points).toBe(4);
    expect(ana.exactCount).toBe(1);
    expect(ana.predictedCount).toBe(2);
    expect(ana.rank).toBe(1);
  });

  it('breaks equal points by exact-scoreline count', () => {
    // Ana 3pts/1exact, Bo 3pts/0exact -> Ana ranks above Bo
    const rows = buildLeaderboard(players, [p('a', 'm1', 3, true), p('b', 'm1', 3, false)]);
    expect(rows[0].userId).toBe('a');
    expect(rows[1].userId).toBe('b');
    expect(rows[0].rank).toBe(1);
    expect(rows[1].rank).toBe(2);
  });

  it('gives equal (points, exact) the same shared rank, next distinct group skips', () => {
    // a and b both 3pts/1exact -> both rank 1; c 0 -> rank 3
    const rows = buildLeaderboard(players, [p('a', 'm1', 3, true), p('b', 'm1', 3, true)]);
    expect(rows.find((r) => r.userId === 'a')!.rank).toBe(1);
    expect(rows.find((r) => r.userId === 'b')!.rank).toBe(1);
    expect(rows.find((r) => r.userId === 'c')!.rank).toBe(3);
  });

  it('orders equal (points, exact) by display name', () => {
    const rows = buildLeaderboard(players, [p('b', 'm1', 3, true), p('a', 'm1', 3, true)]);
    expect(rows[0].userId).toBe('a'); // Ana before Bo
    expect(rows[1].userId).toBe('b');
  });

  it('scopes points to matchIdsInScope when given (This round)', () => {
    const rows = buildLeaderboard(
      players,
      [p('a', 'm1', 3, true), p('a', 'm2', 5, false)],
      { matchIdsInScope: new Set(['m1']) },
    );
    const ana = rows.find((r) => r.userId === 'a')!;
    expect(ana.points).toBe(3);
    expect(ana.predictedCount).toBe(1);
  });

  it('handles all-zero (pre-tournament): everyone shares rank 1, name-ordered', () => {
    const rows = buildLeaderboard(players, []);
    expect(rows.map((r) => r.userId)).toEqual(['a', 'b', 'c']);
    expect(rows.every((r) => r.rank === 1 && r.points === 0)).toBe(true);
  });

  it('returns empty for no players', () => {
    expect(buildLeaderboard([], [p('a', 'm1', 3)])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/leaderboard.test.ts`
Expected: FAIL — cannot import `buildLeaderboard` (module/exports don't exist).

- [ ] **Step 3: Create the module with types + `buildLeaderboard`**

Create `src/lib/leaderboard.ts`:

```typescript
import type { Stage } from './fixtures';

export type LeaderPlayer = { id: string; displayName: string | null; avatarSeed: string | null };

export type ScoredPrediction = {
  userId: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
  pointsAwarded: number | null;
  exact: boolean;
};

/** Serializable match metadata for the client views (no Date — kickoff as epoch ms). */
export type MatchMeta = {
  id: string;
  stage: Stage;
  status: 'scheduled' | 'live' | 'finished';
  locked: boolean;
  homeCode: string;
  awayCode: string;
  homeFlag: string | null;
  awayFlag: string | null;
  kickoffMs: number;
};

export type LeaderRow = {
  userId: string;
  displayName: string | null;
  avatarSeed: string | null;
  points: number;
  exactCount: number;
  predictedCount: number;
  rank: number;
};

const name = (s: string | null) => s ?? '';

/**
 * Ranks players by total points desc, then exact-scoreline count desc, then display name.
 * Players equal on (points, exactCount) share a rank ("1224" competition ranking).
 * `opts.matchIdsInScope` restricts which predictions count (used for the "This round" tab).
 */
export function buildLeaderboard(
  players: LeaderPlayer[],
  predictions: ScoredPrediction[],
  opts?: { matchIdsInScope?: Set<string> },
): LeaderRow[] {
  const scope = opts?.matchIdsInScope;
  const agg = new Map<string, { points: number; exactCount: number; predictedCount: number }>();
  for (const pl of players) agg.set(pl.id, { points: 0, exactCount: 0, predictedCount: 0 });

  for (const pred of predictions) {
    if (scope && !scope.has(pred.matchId)) continue;
    const a = agg.get(pred.userId);
    if (!a) continue; // prediction by a non-listed player — ignore
    a.predictedCount += 1;
    a.points += pred.pointsAwarded ?? 0;
    if (pred.exact) a.exactCount += 1;
  }

  const rows: LeaderRow[] = players.map((pl) => {
    const a = agg.get(pl.id)!;
    return {
      userId: pl.id, displayName: pl.displayName, avatarSeed: pl.avatarSeed,
      points: a.points, exactCount: a.exactCount, predictedCount: a.predictedCount, rank: 0,
    };
  });

  rows.sort((x, y) =>
    y.points - x.points ||
    y.exactCount - x.exactCount ||
    name(x.displayName).localeCompare(name(y.displayName)),
  );

  let rank = 0;
  let prevKey: string | null = null;
  rows.forEach((r, i) => {
    const key = `${r.points}:${r.exactCount}`;
    if (key !== prevKey) { rank = i + 1; prevKey = key; }
    r.rank = rank;
  });

  return rows;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/leaderboard.test.ts`
Expected: PASS (7 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/leaderboard.ts src/lib/leaderboard.test.ts
git commit -m "feat(leaderboard): buildLeaderboard ranking selector (points, exact tiebreak, shared ranks)"
```

---

## Task 2: `buildMatchLeaderboard` selector (TDD)

**Files:**
- Modify: `src/lib/leaderboard.ts`
- Test: `src/lib/leaderboard.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/leaderboard.test.ts` (merge `buildMatchLeaderboard` into the existing `from './leaderboard'` import at the top):

```typescript
describe('buildMatchLeaderboard', () => {
  it('lists each player pick + points for one match, null pick when not predicted', () => {
    const rows = buildMatchLeaderboard('m1', players, [
      { userId: 'a', matchId: 'm1', homeScore: 2, awayScore: 1, pointsAwarded: 3, exact: true },
      { userId: 'b', matchId: 'm1', homeScore: 0, awayScore: 0, pointsAwarded: null, exact: false },
    ]);
    const ana = rows.find((r) => r.userId === 'a')!;
    const cy = rows.find((r) => r.userId === 'c')!;
    expect(ana.pick).toEqual({ home: 2, away: 1 });
    expect(ana.points).toBe(3);
    expect(cy.pick).toBeNull();
    expect(cy.points).toBeNull();
  });

  it('sorts by points desc (null/unscored last), then predictors, then name', () => {
    const rows = buildMatchLeaderboard('m1', players, [
      { userId: 'b', matchId: 'm1', homeScore: 1, awayScore: 1, pointsAwarded: 1, exact: false },
      { userId: 'a', matchId: 'm1', homeScore: 2, awayScore: 1, pointsAwarded: 3, exact: true },
    ]);
    expect(rows[0].userId).toBe('a'); // 3 pts
    expect(rows[1].userId).toBe('b'); // 1 pt
    expect(rows[2].userId).toBe('c'); // no pick
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/leaderboard.test.ts`
Expected: FAIL — `buildMatchLeaderboard` not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/leaderboard.ts`:

```typescript
export type MatchLeaderRow = {
  userId: string;
  displayName: string | null;
  avatarSeed: string | null;
  pick: { home: number; away: number } | null;
  points: number | null;
};

/** Per-player pick + points for a single match. For the leaderboard "By match" tab. */
export function buildMatchLeaderboard(
  matchId: string,
  players: LeaderPlayer[],
  predictions: ScoredPrediction[],
): MatchLeaderRow[] {
  const byUser = new Map<string, ScoredPrediction>();
  for (const pred of predictions) if (pred.matchId === matchId) byUser.set(pred.userId, pred);

  const rows: MatchLeaderRow[] = players.map((pl) => {
    const pred = byUser.get(pl.id);
    return {
      userId: pl.id, displayName: pl.displayName, avatarSeed: pl.avatarSeed,
      pick: pred ? { home: pred.homeScore, away: pred.awayScore } : null,
      points: pred ? pred.pointsAwarded : null,
    };
  });

  rows.sort((x, y) =>
    (y.points ?? -1) - (x.points ?? -1) ||
    (Number(!!y.pick) - Number(!!x.pick)) ||
    name(x.displayName).localeCompare(name(y.displayName)),
  );

  return rows;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/leaderboard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/leaderboard.ts src/lib/leaderboard.test.ts
git commit -m "feat(leaderboard): buildMatchLeaderboard per-match pick breakdown"
```

---

## Task 3: `buildHeadToHead` selector (TDD)

**Files:**
- Modify: `src/lib/leaderboard.ts`
- Test: `src/lib/leaderboard.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/leaderboard.test.ts` (merge `buildHeadToHead` into the import):

```typescript
describe('buildHeadToHead', () => {
  const preds: ScoredPrediction[] = [
    { userId: 'a', matchId: 'm1', homeScore: 2, awayScore: 1, pointsAwarded: 3, exact: true },
    { userId: 'b', matchId: 'm1', homeScore: 1, awayScore: 1, pointsAwarded: 0, exact: false },
    { userId: 'a', matchId: 'm2', homeScore: 0, awayScore: 0, pointsAwarded: null, exact: false },
    { userId: 'b', matchId: 'm2', homeScore: 3, awayScore: 0, pointsAwarded: null, exact: false },
  ];
  const allLocked = () => true;

  it('totals each side and names the leader; per-row winner on scored matches', () => {
    const h = buildHeadToHead('a', 'b', ['m1', 'm2'], preds, allLocked);
    expect(h.myTotal).toBe(3);
    expect(h.theirTotal).toBe(0);
    expect(h.leader).toBe('me');
    const m1 = h.rows.find((r) => r.matchId === 'm1')!;
    expect(m1.winner).toBe('me');
    const m2 = h.rows.find((r) => r.matchId === 'm2')!;
    expect(m2.winner).toBeNull(); // neither scored yet
  });

  it('hides the opponent pick (and points) until the match is locked; own pick always shows', () => {
    const lockedOnly = (id: string) => id === 'm1'; // m2 not locked
    const h = buildHeadToHead('a', 'b', ['m1', 'm2'], preds, lockedOnly);
    const m2 = h.rows.find((r) => r.matchId === 'm2')!;
    expect(m2.myPick).toEqual({ home: 0, away: 0 }); // my pick visible
    expect(m2.theirPick).toBeNull();                 // their pick hidden pre-lock
    expect(m2.theirPoints).toBeNull();
  });

  it('reports a tie when totals are equal', () => {
    const h = buildHeadToHead('a', 'b', ['m1'], [
      { userId: 'a', matchId: 'm1', homeScore: 1, awayScore: 0, pointsAwarded: 1, exact: false },
      { userId: 'b', matchId: 'm1', homeScore: 0, awayScore: 1, pointsAwarded: 1, exact: false },
    ], allLocked);
    expect(h.leader).toBe('tie');
    expect(h.rows[0].winner).toBe('tie');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/leaderboard.test.ts`
Expected: FAIL — `buildHeadToHead` not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/leaderboard.ts`:

```typescript
export type Side = 'me' | 'them' | 'tie';

export type H2HRow = {
  matchId: string;
  locked: boolean;
  myPick: { home: number; away: number } | null;
  myPoints: number | null;
  theirPick: { home: number; away: number } | null;
  theirPoints: number | null;
  winner: Side | null;
};

export type HeadToHead = { rows: H2HRow[]; myTotal: number; theirTotal: number; leader: Side };

/**
 * Compares two players match-by-match. The opponent's pick and points are hidden until the
 * match locks (kickoff) so picks can't be copied; the viewer's own pick always shows.
 * `matchIdsInOrder` controls row order (chronological); `isLocked` gates opponent visibility.
 */
export function buildHeadToHead(
  meId: string,
  themId: string,
  matchIdsInOrder: string[],
  predictions: ScoredPrediction[],
  isLocked: (matchId: string) => boolean,
): HeadToHead {
  const key = (u: string, m: string) => `${u}:${m}`;
  const idx = new Map<string, ScoredPrediction>();
  for (const pred of predictions) idx.set(key(pred.userId, pred.matchId), pred);

  let myTotal = 0;
  let theirTotal = 0;
  const rows: H2HRow[] = matchIdsInOrder.map((matchId) => {
    const locked = isLocked(matchId);
    const mine = idx.get(key(meId, matchId));
    const theirs = idx.get(key(themId, matchId));
    const myPoints = mine?.pointsAwarded ?? null;
    const theirPoints = locked ? (theirs?.pointsAwarded ?? null) : null;
    myTotal += myPoints ?? 0;
    theirTotal += theirPoints ?? 0;
    let winner: Side | null = null;
    if (myPoints != null && theirPoints != null) {
      winner = myPoints > theirPoints ? 'me' : myPoints < theirPoints ? 'them' : 'tie';
    }
    return {
      matchId, locked,
      myPick: mine ? { home: mine.homeScore, away: mine.awayScore } : null,
      myPoints,
      theirPick: locked && theirs ? { home: theirs.homeScore, away: theirs.awayScore } : null,
      theirPoints,
      winner,
    };
  });

  const leader: Side = myTotal > theirTotal ? 'me' : myTotal < theirTotal ? 'them' : 'tie';
  return { rows, myTotal, theirTotal, leader };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/leaderboard.test.ts`
Expected: PASS (all leaderboard cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/leaderboard.ts src/lib/leaderboard.test.ts
git commit -m "feat(leaderboard): buildHeadToHead comparison with pre-lock pick hiding"
```

---

## Task 4: Server reader `get-leaderboard.ts` + `getPrizeText()`

**Files:**
- Create: `src/lib/get-leaderboard.ts`
- Modify: `src/lib/app-settings.ts`

UI/data wiring — verified by `tsc`/build later; no unit test (DB-bound).

- [ ] **Step 1: Add `getPrizeText` to `app-settings.ts`**

Append to `src/lib/app-settings.ts` (the file already imports `eq`, `db`, `appSettings`):

```typescript
/** Reads the editable prize text shown on the leaderboard #1. Null when unset. */
export async function getPrizeText(): Promise<string | null> {
  const [r] = await db.select().from(appSettings).where(eq(appSettings.id, 1));
  return r?.prizeText ?? null;
}
```

- [ ] **Step 2: Create the leaderboard reader**

Create `src/lib/get-leaderboard.ts`:

```typescript
import { db } from '@/db';
import { profiles, matchPredictions } from '@/db/schema';
import { getFixtures } from './get-fixtures';
import { getScoringConfig } from './app-settings';
import type { LeaderPlayer, ScoredPrediction, MatchMeta } from './leaderboard';

export type LeaderboardData = {
  players: LeaderPlayer[];
  predictions: ScoredPrediction[];
  matches: MatchMeta[];
};

/**
 * Loads everything the leaderboard + head-to-head views need: every player, every match
 * prediction (with exactness precomputed from the live scoring config so the pure selectors
 * stay config-free), and serializable per-match metadata (reusing getFixtures for team/lock).
 */
export async function getLeaderboardData(): Promise<LeaderboardData> {
  const [fixtures, profileRows, predRows, cfg] = await Promise.all([
    getFixtures(),
    db.select().from(profiles),
    db.select().from(matchPredictions),
    getScoringConfig(),
  ]);

  const players: LeaderPlayer[] = profileRows.map((p) => ({
    id: p.id, displayName: p.displayName, avatarSeed: p.avatarSeed,
  }));

  const predictions: ScoredPrediction[] = predRows.map((r) => ({
    userId: r.userId, matchId: r.matchId,
    homeScore: r.homeScore, awayScore: r.awayScore,
    pointsAwarded: r.pointsAwarded,
    exact: r.pointsAwarded === cfg.ptsExact,
  }));

  const matches: MatchMeta[] = fixtures.map((f) => ({
    id: f.id, stage: f.stage, status: f.status, locked: f.locked,
    homeCode: f.home?.code ?? 'TBD', awayCode: f.away?.code ?? 'TBD',
    homeFlag: f.home?.flag ?? null, awayFlag: f.away?.flag ?? null,
    kickoffMs: f.kickoffAt.getTime(),
  }));

  return { players, predictions, matches };
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing these files. (`getScoringConfig` returns a `ScoringConfig` with `ptsExact`; `getFixtures()` with no args returns all matches with no user predictions merged — we only use its match metadata here.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/get-leaderboard.ts src/lib/app-settings.ts
git commit -m "feat(leaderboard): getLeaderboardData reader + getPrizeText"
```

---

## Task 5: `Podium` component

**Files:**
- Create: `src/components/leaderboard/podium.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/leaderboard/podium.tsx`:

```tsx
import { PixelAvatar } from '@/components/retro/pixel-avatar';
import { StickerCard } from '@/components/retro/sticker-card';
import type { LeaderRow } from '@/lib/leaderboard';

/** Top-3 podium. `top` is the rank-sorted leaderboard; we display #2 · #1 · #3. */
export function Podium({ top, prizeText }: { top: LeaderRow[]; prizeText: string | null }) {
  const slots: (LeaderRow | undefined)[] = [top[1], top[0], top[2]];
  return (
    <div className="mb-4 grid grid-cols-3 items-end gap-2">
      {slots.map((r, i) => {
        const center = i === 1;
        if (!r) return <div key={i} />;
        return (
          <StickerCard key={r.userId} className={`p-2 text-center ${center ? 'bg-gold' : ''}`}>
            <div className="mb-1 flex justify-center">
              <PixelAvatar name={r.displayName ?? 'Player'} photoUrl={null} position={null} shirtNumber={null} size={center ? 'lg' : 'md'} />
            </div>
            <div className="font-pixel text-2xl leading-none text-pitch">{center ? '👑 ' : ''}#{r.rank}</div>
            <div className="truncate font-display text-xs text-pitch">{r.displayName ?? 'Player'}</div>
            <div className="font-pixel text-lg text-pitch">{r.points} pts</div>
            {center && prizeText && <div className="mt-1 font-pixel text-xs text-pitch/70">🏆 {prizeText}</div>}
          </StickerCard>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing this file. (`PixelAvatar` props: `{ name; photoUrl; position; shirtNumber; size? }`. Gold bg with dark `text-pitch` is allowed — the contrast rule only forbids gold *text on cream*.)

- [ ] **Step 3: Commit**

```bash
git add src/components/leaderboard/podium.tsx
git commit -m "feat(leaderboard): Podium top-3 with crown + prize marker"
```

---

## Task 6: `LeaderboardView` + `/leaderboard` page

**Files:**
- Create: `src/components/leaderboard/leaderboard-view.tsx`
- Create: `src/app/leaderboard/page.tsx`

- [ ] **Step 1: Create the client view**

Create `src/components/leaderboard/leaderboard-view.tsx`:

```tsx
'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { LeaderPlayer, ScoredPrediction, MatchMeta } from '@/lib/leaderboard';
import { buildLeaderboard, buildMatchLeaderboard } from '@/lib/leaderboard';
import { PixelAvatar } from '@/components/retro/pixel-avatar';
import { Podium } from './podium';

type Tab = 'overall' | 'round' | 'match';

const STAGES: { key: string; label: string }[] = [
  { key: 'group', label: 'Groups' }, { key: 'r32', label: 'R32' }, { key: 'r16', label: 'R16' },
  { key: 'qf', label: 'QF' }, { key: 'sf', label: 'SF' }, { key: 'third', label: '3rd' }, { key: 'final', label: 'Final' },
];

export function LeaderboardView({
  players, predictions, matches, prizeText, meId, initialTab, initialStage, initialMatch,
}: {
  players: LeaderPlayer[];
  predictions: ScoredPrediction[];
  matches: MatchMeta[];
  prizeText: string | null;
  meId: string | null;
  initialTab?: string;
  initialStage?: string;
  initialMatch?: string;
}) {
  const stagesAvailable = useMemo(() => STAGES.filter((s) => matches.some((m) => m.stage === s.key)), [matches]);
  const lockedMatches = useMemo(
    () => matches.filter((m) => m.locked).sort((a, b) => a.kickoffMs - b.kickoffMs),
    [matches],
  );

  const [tab, setTab] = useState<Tab>(initialTab === 'round' || initialTab === 'match' ? initialTab : 'overall');
  const [stage, setStage] = useState<string>(
    initialStage && stagesAvailable.some((s) => s.key === initialStage) ? initialStage : (stagesAvailable[0]?.key ?? 'group'),
  );
  const [match, setMatch] = useState<string>(
    initialMatch && lockedMatches.some((m) => m.id === initialMatch) ? initialMatch : (lockedMatches[0]?.id ?? ''),
  );

  const sync = (patch: Record<string, string>) => {
    const params = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    window.history.replaceState(null, '', `?${params.toString()}`);
  };

  const overall = useMemo(() => buildLeaderboard(players, predictions), [players, predictions]);
  const scopeIds = useMemo(() => new Set(matches.filter((m) => m.stage === stage).map((m) => m.id)), [matches, stage]);
  const round = useMemo(() => buildLeaderboard(players, predictions, { matchIdsInScope: scopeIds }), [players, predictions, scopeIds]);
  const matchBoard = useMemo(() => (match ? buildMatchLeaderboard(match, players, predictions) : []), [match, players, predictions]);

  const rankRows = tab === 'round' ? round : overall;

  return (
    <div className="flex flex-col gap-3">
      <Podium top={overall.slice(0, 3)} prizeText={prizeText} />

      <div className="flex gap-2">
        {(['overall', 'round', 'match'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); sync({ tab: t }); }}
            className={`rounded-lg border-[3px] border-ink px-3 py-1 text-sm rp-shadow-sm font-display ${tab === t ? 'bg-gold text-pitch' : 'bg-cream text-pitch'}`}
          >
            {t === 'overall' ? 'Overall' : t === 'round' ? 'This round' : 'By match'}
          </button>
        ))}
      </div>

      {tab === 'round' && (
        <select
          value={stage}
          onChange={(e) => { setStage(e.target.value); sync({ tab: 'round', stage: e.target.value }); }}
          className="self-start rounded border-2 border-ink bg-cream px-2 py-1 text-sm text-pitch font-display"
        >
          {stagesAvailable.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      )}

      {tab === 'match' ? (
        lockedMatches.length === 0 ? (
          <p className="rp-card p-4 text-center">No matches have kicked off yet.</p>
        ) : (
          <>
            <select
              value={match}
              onChange={(e) => { setMatch(e.target.value); sync({ tab: 'match', match: e.target.value }); }}
              className="self-start rounded border-2 border-ink bg-cream px-2 py-1 text-sm text-pitch font-display"
            >
              {lockedMatches.map((m) => <option key={m.id} value={m.id}>{m.homeCode} v {m.awayCode}</option>)}
            </select>
            <div className="flex flex-col gap-1.5">
              {matchBoard.map((r) => (
                <div key={r.userId} className="rp-card flex items-center gap-2 p-2">
                  <PixelAvatar name={r.displayName ?? 'Player'} photoUrl={null} position={null} shirtNumber={null} size="sm" />
                  <span className="flex-1 truncate font-display text-xs text-pitch">{r.displayName ?? 'Player'}</span>
                  <span className="font-pixel text-base text-pitch">{r.pick ? `${r.pick.home}–${r.pick.away}` : '—'}</span>
                  {r.points != null && <span className="rp-pill text-xs">+{r.points}</span>}
                </div>
              ))}
            </div>
          </>
        )
      ) : (
        <div className="flex flex-col gap-1.5">
          {rankRows.map((r) => {
            const isMe = r.userId === meId;
            const inner = (
              <>
                <span className="w-8 text-center font-pixel text-lg text-pitch">#{r.rank}</span>
                <PixelAvatar name={r.displayName ?? 'Player'} photoUrl={null} position={null} shirtNumber={null} size="sm" />
                <span className="flex-1 truncate font-display text-xs text-pitch">{r.displayName ?? 'Player'}{isMe ? ' (you)' : ''}</span>
                <span className="font-pixel text-xs text-pitch/60">{r.predictedCount} picks</span>
                <span className="rp-pill text-sm">{r.points}</span>
              </>
            );
            return meId && !isMe ? (
              <Link key={r.userId} href={`/h2h?vs=${r.userId}`} className="rp-card rp-hover-lift flex items-center gap-2 p-2 no-underline">{inner}</Link>
            ) : (
              <div key={r.userId} className="rp-card flex items-center gap-2 p-2">{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the page**

Create `src/app/leaderboard/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server';
import { getLeaderboardData } from '@/lib/get-leaderboard';
import { getPrizeText } from '@/lib/app-settings';
import { LeaderboardView } from '@/components/leaderboard/leaderboard-view';

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; stage?: string; match?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ players, predictions, matches }, prizeText] = await Promise.all([
    getLeaderboardData(),
    getPrizeText(),
  ]);

  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold text-cream">Leaderboard</h1>
      <LeaderboardView
        players={players}
        predictions={predictions}
        matches={matches}
        prizeText={prizeText}
        meId={user?.id ?? null}
        initialTab={sp.tab}
        initialStage={sp.stage}
        initialMatch={sp.match}
      />
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. The `/leaderboard` 404 is now a real page.

- [ ] **Step 4: Commit**

```bash
git add src/components/leaderboard/leaderboard-view.tsx src/app/leaderboard/page.tsx
git commit -m "feat(leaderboard): /leaderboard page with podium + Overall/round/by-match tabs"
```

---

## Task 7: `H2HView` + `/h2h` page

**Files:**
- Create: `src/components/h2h/h2h-view.tsx`
- Create: `src/app/h2h/page.tsx`

NOTE: all hooks are called unconditionally before any early `return` (Rules of Hooks).

- [ ] **Step 1: Create the client view**

Create `src/components/h2h/h2h-view.tsx`:

```tsx
'use client';
import { useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import type { LeaderPlayer, ScoredPrediction, MatchMeta } from '@/lib/leaderboard';
import { buildHeadToHead } from '@/lib/leaderboard';
import { PixelAvatar } from '@/components/retro/pixel-avatar';
import { StickerCard } from '@/components/retro/sticker-card';

export function H2HView({
  players, predictions, matches, meId, initialVs,
}: {
  players: LeaderPlayer[];
  predictions: ScoredPrediction[];
  matches: MatchMeta[];
  meId: string | null;
  initialVs?: string;
}) {
  const me = useMemo(() => players.find((p) => p.id === meId) ?? null, [players, meId]);
  const others = useMemo(() => players.filter((p) => p.id !== meId), [players, meId]);

  const defaultVs = initialVs && others.some((p) => p.id === initialVs) ? initialVs : (others[0]?.id ?? '');
  const [vs, setVs] = useState<string>(defaultVs);
  const them = useMemo(() => players.find((p) => p.id === vs) ?? null, [players, vs]);

  const orderedIds = useMemo(() => [...matches].sort((a, b) => a.kickoffMs - b.kickoffMs).map((m) => m.id), [matches]);
  const lockedSet = useMemo(() => new Set(matches.filter((m) => m.locked).map((m) => m.id)), [matches]);
  const metaById = useMemo(() => new Map(matches.map((m) => [m.id, m])), [matches]);

  const h2h = useMemo(
    () => (me && them
      ? buildHeadToHead(me.id, them.id, orderedIds, predictions, (id) => lockedSet.has(id))
      : { rows: [], myTotal: 0, theirTotal: 0, leader: 'tie' as const }),
    [me, them, orderedIds, predictions, lockedSet],
  );

  const selectVs = (id: string) => {
    setVs(id);
    const params = new URLSearchParams(window.location.search);
    params.set('vs', id);
    window.history.replaceState(null, '', `?${params.toString()}`);
  };

  if (!me) return <p className="rp-card p-4 text-center">Sign in to compare your picks.</p>;
  if (others.length === 0 || !them) return <p className="rp-card p-4 text-center">No one else to compare with yet.</p>;

  const visibleRows = h2h.rows.filter((r) => r.myPick || r.theirPick);

  return (
    <div className="flex flex-col gap-3">
      <StickerCard className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 text-center">
            <PixelAvatar name={me.displayName ?? 'You'} photoUrl={null} position={null} shirtNumber={null} size="md" />
            <div className="mt-1 font-display text-xs text-pitch">{me.displayName ?? 'You'}</div>
            <div className="font-pixel text-2xl text-pitch">{h2h.myTotal}</div>
          </div>
          <div className="font-pixel text-base text-pitch/70">
            {h2h.leader === 'me' ? '◀ you lead' : h2h.leader === 'them' ? 'they lead ▶' : 'level'}
          </div>
          <div className="flex-1 text-center">
            <PixelAvatar name={them.displayName ?? 'Player'} photoUrl={null} position={null} shirtNumber={null} size="md" />
            <select
              value={vs}
              onChange={(e) => selectVs(e.target.value)}
              className="mt-1 max-w-full rounded border-2 border-ink bg-cream px-1 py-0.5 text-xs text-pitch font-display"
            >
              {others.map((p) => <option key={p.id} value={p.id}>{p.displayName ?? 'Player'}</option>)}
            </select>
            <div className="font-pixel text-2xl text-pitch">{h2h.theirTotal}</div>
          </div>
        </div>
      </StickerCard>

      {visibleRows.length === 0 ? (
        <p className="rp-card p-4 text-center">No comparable picks yet.</p>
      ) : (
        visibleRows.map((r) => {
          const m = metaById.get(r.matchId)!;
          return (
            <div key={r.matchId} className="rp-card flex items-center gap-2 p-2 font-display text-xs text-pitch">
              <span className={`flex-1 text-center font-pixel text-base ${r.winner === 'me' ? 'text-pitch' : 'text-pitch/50'}`}>
                {r.myPick ? `${r.myPick.home}–${r.myPick.away}` : '—'}{' '}
                {r.myPoints != null && <span className="rp-pill text-xs">+{r.myPoints}</span>}
              </span>
              <span className="shrink-0 text-center leading-tight">{m.homeCode}<br />v<br />{m.awayCode}</span>
              <span className={`flex-1 text-center font-pixel text-base ${r.winner === 'them' ? 'text-pitch' : 'text-pitch/50'}`}>
                {r.locked ? (r.theirPick ? `${r.theirPick.home}–${r.theirPick.away}` : '—') : <Lock size={12} className="inline" />}{' '}
                {r.theirPoints != null && <span className="rp-pill text-xs">+{r.theirPoints}</span>}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the page**

Create `src/app/h2h/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server';
import { getLeaderboardData } from '@/lib/get-leaderboard';
import { H2HView } from '@/components/h2h/h2h-view';

export default async function H2HPage({
  searchParams,
}: {
  searchParams: Promise<{ vs?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { players, predictions, matches } = await getLeaderboardData();

  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold text-cream">Head-to-Head</h1>
      <H2HView players={players} predictions={predictions} matches={matches} meId={user?.id ?? null} initialVs={sp.vs} />
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/h2h/h2h-view.tsx src/app/h2h/page.tsx
git commit -m "feat(h2h): /h2h friend comparison with who-leads + pre-lock pick hiding"
```

---

## Task 8: Homepage real rank wiring

**Files:**
- Modify: `src/components/home/rank-strip.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Extend `RankStrip` to accept a rank**

Replace the contents of `src/components/home/rank-strip.tsx` with:

```tsx
import { StickerCard } from '@/components/retro/sticker-card';
import type { RankStrip as RankData } from '@/lib/board';

export function RankStrip({ data, rank, players }: { data: RankData; rank?: number | null; players?: number }) {
  const cells = [
    { label: players ? `of ${players}` : 'Rank', value: rank != null ? `#${rank}` : '—' },
    { label: 'Points', value: data.points },
    { label: 'Predicted', value: `${data.predicted}/${data.total}` },
    { label: 'To Predict', value: data.matchesLeft },
  ];
  return (
    <StickerCard className="p-3">
      <div className="grid grid-cols-4 gap-2 text-center">
        {cells.map((c) => (
          <div key={c.label}>
            <div className="font-pixel text-2xl text-pitch leading-none">{c.value}</div>
            <div className="font-pixel text-xs text-pitch/60 uppercase">{c.label}</div>
          </div>
        ))}
      </div>
    </StickerCard>
  );
}
```

- [ ] **Step 2: Compute the rank in the homepage**

In `src/app/page.tsx`, add imports near the existing ones:

```tsx
import { getLeaderboardData } from '@/lib/get-leaderboard';
import { buildLeaderboard } from '@/lib/leaderboard';
```

Then, after the existing `const predictionMap = ...` line and the existing `Promise.all` block, compute the rank for the signed-in user. Add this block right before the `return (`:

```tsx
  let myRank: number | null = null;
  let playerCount = 0;
  if (user) {
    const { players, predictions } = await getLeaderboardData();
    const board = buildLeaderboard(players, predictions);
    playerCount = board.length;
    myRank = board.find((r) => r.userId === user.id)?.rank ?? null;
  }
```

Then change the RankStrip render line:

```tsx
      {user && predictionMap ? <RankStrip data={buildRankStrip(fixtures)} rank={myRank} players={playerCount} /> : null}
```

- [ ] **Step 3: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean build; `/`, `/leaderboard`, `/h2h` all compile.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/rank-strip.tsx src/app/page.tsx
git commit -m "feat(home): wire RankStrip to real overall rank (#n of m)"
```

---

## Task 9: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Tests**

Run: `npm test`
Expected: PASS — existing suites + the new `leaderboard.test.ts` cases.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors. (Watch for unused imports; `StickerCard` is used in H2H header and podium.)

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds; routes include `/leaderboard` and `/h2h`.

- [ ] **Step 4: Manual smoke (if DB reachable)**

`npm run dev`, then:
- `/leaderboard` → podium renders (all tied at 0 pre-tournament), Overall list shows every player by name, rows (other than you) link to `/h2h?vs=…`. "This round" shows a stage selector; "By match" shows "No matches have kicked off yet." pre-tournament.
- `/h2h?vs=<id>` → header with both avatars + "level", opponent dropdown switches `?vs=`, comparison rows hide the opponent's pick (🔒) for matches that haven't kicked off.
- `/` → rank-strip shows `#n` instead of "soon".

(If the sandbox can't resolve the Supabase host, DB-backed pages 500 locally — that's an environment limitation, not a code defect; the production build is the compile gate.)

---

## Self-review notes

- **Spec coverage:** podium + prize marker (Task 5); Overall/This-round-by-stage/By-match tabs (Task 6); H2H you-vs-friend dropdown + who-leads + pre-lock hiding (Tasks 3, 7); leaderboard rows link to `/h2h` (Task 6); homepage real rank (Task 8); reads `prizeText`, no editor (Task 4); match-points-only totals that fold in bracket/awards later automatically (sum of `pointsAwarded`, Task 1); by-match restricted to locked matches so picks don't leak (Task 6); no schema change. ✓
- **Type consistency:** `LeaderPlayer`/`ScoredPrediction`/`MatchMeta`/`LeaderRow`/`MatchLeaderRow`/`H2HRow`/`HeadToHead`/`Side` defined once in `leaderboard.ts` and imported everywhere; `buildLeaderboard`/`buildMatchLeaderboard`/`buildHeadToHead` signatures match their call sites in views and the homepage; `getLeaderboardData` returns exactly `{ players, predictions, matches }` consumed by both pages. `exact` is precomputed in the reader (config-coupled) so the pure selectors and client payload stay serializable (no function props crossing the server/client boundary). ✓
- **Hooks safety:** `H2HView` calls all hooks before any conditional `return`. ✓
- **Placeholders:** none — every code step is complete.
```
