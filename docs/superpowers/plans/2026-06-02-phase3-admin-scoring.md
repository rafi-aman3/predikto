# Phase 3 — Admin + Scoring Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-only match-management surface and a scoring engine that computes match-prediction points whenever the owner records a result.

**Architecture:** An `ADMIN_EMAILS` env allowlist gates all `/admin/*` routes (enforced in an admin layout and re-checked in every server action). A pure scoring core (`scoreMatch`, `computePredictionPoints`) is wrapped by a thin DB recompute (`recomputeMatch`) triggered after each result save. Admin result/metadata edits flow through guarded server actions; players see finished scorelines and points on the existing fixtures card.

**Tech Stack:** Next.js 16 (App Router, Server Components + Server Actions), Drizzle ORM over Supabase Postgres, Supabase Auth via `@supabase/ssr`, Vitest, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-06-02-phase3-admin-scoring-design.md`

**Implementation notes / deviations from spec:**
- The spec mentions syncing `profiles.isAdmin` from the allowlist. To avoid a DB write on every request, Phase 3 makes the **env allowlist the sole mechanism** and does **not** write `profiles.isAdmin`. A future phase can sync it at onboarding if needed.
- `getAdminUser()` dynamically imports the Supabase server client so the pure allowlist helpers in the same module stay importable from Vitest (which can't load `next/headers` at module top-level).
- `recomputeMatch` runs only after `saveResult` (scoring depends solely on scores). Metadata edits (`saveMatchMeta`) do **not** recompute — they cannot change points.

---

## File structure

| File | Responsibility |
|------|----------------|
| `src/lib/admin.ts` (create) | `getAdminEmails`, `isAdminEmail` (pure), `getAdminUser` (server) |
| `src/lib/admin.test.ts` (create) | Unit tests for the pure allowlist helpers |
| `src/lib/scoring.ts` (create) | `scoreMatch`, `computePredictionPoints` (pure), `recomputeMatch` (DB) |
| `src/lib/scoring.test.ts` (create) | Unit tests for the pure scoring core |
| `src/lib/app-settings.ts` (create) | `getScoringConfig` — reads the `app_settings` singleton |
| `src/lib/admin-matches.ts` (create) | Admin match data layer (read shaping + writes + option lists) |
| `src/app/admin/matches/actions.ts` (create) | `saveResult`, `saveMatchMeta` guarded server actions |
| `src/app/admin/layout.tsx` (create) | Admin route guard (redirects non-admins) |
| `src/app/admin/page.tsx` (create) | Admin dashboard |
| `src/app/admin/matches/page.tsx` (create) | Admin matches table (server component) |
| `src/components/admin/match-row.tsx` (create) | Editable per-match row (client component) |
| `src/components/app-shell.tsx` (modify) | Resolve admin status, pass to Nav |
| `src/components/nav.tsx` (modify) | Conditional Admin link |
| `CLAUDE.md` (modify) | Document `ADMIN_EMAILS`; mark Phase 3 complete |

---

## Task 1: Admin allowlist helpers

**Files:**
- Create: `src/lib/admin.ts`
- Test: `src/lib/admin.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/admin.test.ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { getAdminEmails, isAdminEmail } from './admin';

afterEach(() => vi.unstubAllEnvs());

describe('getAdminEmails', () => {
  it('returns [] when unset', () => {
    vi.stubEnv('ADMIN_EMAILS', '');
    expect(getAdminEmails()).toEqual([]);
  });
  it('parses, trims, lowercases, and drops empties', () => {
    vi.stubEnv('ADMIN_EMAILS', ' Rafi@SDS.com , ,owner@x.io ');
    expect(getAdminEmails()).toEqual(['rafi@sds.com', 'owner@x.io']);
  });
});

describe('isAdminEmail', () => {
  it('matches case-insensitively', () => {
    vi.stubEnv('ADMIN_EMAILS', 'rafi@sds.com');
    expect(isAdminEmail('RAFI@sds.com')).toBe(true);
  });
  it('is false for non-listed or missing emails', () => {
    vi.stubEnv('ADMIN_EMAILS', 'rafi@sds.com');
    expect(isAdminEmail('other@x.io')).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/admin.test.ts`
Expected: FAIL — cannot resolve `./admin` / functions not defined.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/admin.ts

/** Parses ADMIN_EMAILS (comma-separated) into a normalized lowercase list. */
export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

/**
 * Server-only. Returns the signed-in Supabase user iff its email is allowlisted,
 * else null. Dynamically imports the server client so the pure helpers above stay
 * importable from Vitest (which can't load `next/headers` at module top-level).
 */
export async function getAdminUser() {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/admin.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin.ts src/lib/admin.test.ts
git commit -m "feat: admin email allowlist + getAdminUser guard"
```

---

## Task 2: Scoring core (pure)

**Files:**
- Create: `src/lib/scoring.ts`
- Test: `src/lib/scoring.test.ts`
- Reference: `src/lib/scoring-config.ts` (`ScoringConfig`, `DEFAULT_SCORING`)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/scoring.test.ts
import { describe, it, expect } from 'vitest';
import { scoreMatch, computePredictionPoints } from './scoring';
import { DEFAULT_SCORING } from './scoring-config';

const cfg = DEFAULT_SCORING;

describe('scoreMatch', () => {
  it('awards exact-score points for a perfect prediction', () => {
    expect(scoreMatch(2, 1, 2, 1, cfg)).toBe(cfg.ptsExact);
  });
  it('awards result points for the right outcome but wrong score', () => {
    expect(scoreMatch(3, 0, 1, 0, cfg)).toBe(cfg.ptsResult); // home win
    expect(scoreMatch(0, 0, 2, 2, cfg)).toBe(cfg.ptsResult); // draw
    expect(scoreMatch(0, 1, 1, 3, cfg)).toBe(cfg.ptsResult); // away win
  });
  it('awards nothing for the wrong outcome', () => {
    expect(scoreMatch(2, 1, 0, 1, cfg)).toBe(0);
    expect(scoreMatch(1, 1, 2, 0, cfg)).toBe(0);
  });
  it('honors custom config values', () => {
    const custom = { ...cfg, ptsExact: 5, ptsResult: 2 };
    expect(scoreMatch(1, 0, 1, 0, custom)).toBe(5);
    expect(scoreMatch(2, 0, 1, 0, custom)).toBe(2);
  });
});

describe('computePredictionPoints', () => {
  const preds = [
    { id: 'a', homeScore: 2, awayScore: 1 },
    { id: 'b', homeScore: 0, awayScore: 0 },
  ];
  it('scores all predictions for a finished match with scores', () => {
    const out = computePredictionPoints({ status: 'finished', homeScore: 2, awayScore: 1 }, preds, cfg);
    expect(out).toEqual([
      { id: 'a', pointsAwarded: cfg.ptsExact },
      { id: 'b', pointsAwarded: 0 },
    ]);
  });
  it('nulls points for a non-finished match', () => {
    const out = computePredictionPoints({ status: 'live', homeScore: 2, awayScore: 1 }, preds, cfg);
    expect(out).toEqual([
      { id: 'a', pointsAwarded: null },
      { id: 'b', pointsAwarded: null },
    ]);
  });
  it('nulls points when a finished match is missing a score', () => {
    const out = computePredictionPoints({ status: 'finished', homeScore: 2, awayScore: null }, preds, cfg);
    expect(out.every((p) => p.pointsAwarded === null)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/scoring.test.ts`
Expected: FAIL — cannot resolve `./scoring`.

- [ ] **Step 3: Write the pure functions**

```ts
// src/lib/scoring.ts
import type { ScoringConfig } from './scoring-config';

/** Points for a single match prediction against the actual scoreline. */
export function scoreMatch(
  predH: number, predA: number, actualH: number, actualA: number, cfg: ScoringConfig,
): number {
  if (predH === actualH && predA === actualA) return cfg.ptsExact;
  if (Math.sign(predH - predA) === Math.sign(actualH - actualA)) return cfg.ptsResult;
  return 0;
}

type MatchResult = { status: string; homeScore: number | null; awayScore: number | null };

/**
 * Maps each prediction to its awarded points. Returns null points unless the match
 * is finished with both scores set (covers revert/clear → un-score).
 */
export function computePredictionPoints(
  result: MatchResult,
  predictions: Array<{ id: string; homeScore: number; awayScore: number }>,
  cfg: ScoringConfig,
): Array<{ id: string; pointsAwarded: number | null }> {
  const scored = result.status === 'finished' && result.homeScore != null && result.awayScore != null;
  return predictions.map((p) => ({
    id: p.id,
    pointsAwarded: scored ? scoreMatch(p.homeScore, p.awayScore, result.homeScore!, result.awayScore!, cfg) : null,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/scoring.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring.ts src/lib/scoring.test.ts
git commit -m "feat: pure match scoring core (scoreMatch + computePredictionPoints)"
```

---

## Task 3: Scoring config reader

**Files:**
- Create: `src/lib/app-settings.ts`
- Reference: `src/db/schema.ts` (`appSettings`), `src/lib/scoring-config.ts`

> DB-backed glue — no unit test (matches the untested-IO pattern of `src/lib/fixtures.ts`). Verified by build + the manual run in Task 10.

- [ ] **Step 1: Write the implementation**

```ts
// src/lib/app-settings.ts
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
  };
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/app-settings.ts
git commit -m "feat: getScoringConfig reads app_settings singleton"
```

---

## Task 4: recomputeMatch (DB)

**Files:**
- Modify: `src/lib/scoring.ts` (append)
- Reference: `src/db/schema.ts` (`matches`, `matchPredictions`)

> Thin glue over the pure `computePredictionPoints` from Task 2.

- [ ] **Step 1: Append the implementation**

```ts
// src/lib/scoring.ts  (add imports at top of file + function at bottom)
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { matches, matchPredictions } from '@/db/schema';
import { getScoringConfig } from './app-settings';

/**
 * Recomputes pointsAwarded for every prediction of a match. Scores when the match
 * is finished with both scores set; otherwise clears points to null. Per-match only:
 * a match prediction's points depend solely on that match's result.
 */
export async function recomputeMatch(matchId: string): Promise<void> {
  const [m] = await db.select().from(matches).where(eq(matches.id, matchId));
  if (!m) return;
  const preds = await db.select().from(matchPredictions).where(eq(matchPredictions.matchId, matchId));
  if (preds.length === 0) return;
  const cfg = await getScoringConfig();
  const updates = computePredictionPoints(
    { status: m.status, homeScore: m.homeScore, awayScore: m.awayScore },
    preds.map((p) => ({ id: p.id, homeScore: p.homeScore, awayScore: p.awayScore })),
    cfg,
  );
  for (const u of updates) {
    await db.update(matchPredictions)
      .set({ pointsAwarded: u.pointsAwarded })
      .where(eq(matchPredictions.id, u.id));
  }
}
```

> Note: place the `import` lines with the other imports at the top of `src/lib/scoring.ts`, not mid-file. `computePredictionPoints` is already defined in this module (Task 2).

- [ ] **Step 2: Verify type-check and that prior tests still pass**

Run: `npx tsc --noEmit && npx vitest run src/lib/scoring.test.ts`
Expected: no type errors; scoring tests still PASS (recomputeMatch is untested glue).

- [ ] **Step 3: Commit**

```bash
git add src/lib/scoring.ts
git commit -m "feat: recomputeMatch persists per-match prediction points"
```

---

## Task 5: Admin match data layer

**Files:**
- Create: `src/lib/admin-matches.ts`
- Reference: `src/db/schema.ts` (`matches`, `teams`, `venues`), `src/lib/fixtures.ts` (shaping pattern)

> DB glue — no unit test; verified by build + Task 10.

- [ ] **Step 1: Write the implementation**

```ts
// src/lib/admin-matches.ts
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { matches, teams, venues } from '@/db/schema';
import type { Stage } from './fixtures';

export type MatchStatus = 'scheduled' | 'live' | 'finished';

export type AdminMatch = {
  id: string;
  externalId: string | null;
  stage: Stage;
  groupName: string | null;
  kickoffAt: Date;
  status: MatchStatus;
  homeTeamId: string | null;
  awayTeamId: string | null;
  venueId: string | null;
  homeScore: number | null;
  awayScore: number | null;
};

export type TeamOption = { id: string; code: string; name: string };
export type VenueOption = { id: string; name: string };

/** All matches as raw editable rows, sorted by kickoff. */
export async function getAdminMatches(): Promise<AdminMatch[]> {
  const rows = await db.select().from(matches);
  return rows
    .map((m): AdminMatch => ({
      id: m.id, externalId: m.externalId, stage: m.stage as Stage,
      groupName: m.groupName, kickoffAt: m.kickoffAt, status: m.status as MatchStatus,
      homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId, venueId: m.venueId,
      homeScore: m.homeScore, awayScore: m.awayScore,
    }))
    .sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime());
}

export async function getTeamOptions(): Promise<TeamOption[]> {
  const rows = await db.select({ id: teams.id, code: teams.code, name: teams.name }).from(teams);
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getVenueOptions(): Promise<VenueOption[]> {
  const rows = await db.select({ id: venues.id, name: venues.name }).from(venues);
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

/** Writes scores + status for a match. Scores may be null (cleared). */
export async function setMatchResult(
  matchId: string, homeScore: number | null, awayScore: number | null, status: MatchStatus,
): Promise<void> {
  await db.update(matches).set({ homeScore, awayScore, status }).where(eq(matches.id, matchId));
}

export type MatchMeta = {
  homeTeamId: string | null;
  awayTeamId: string | null;
  venueId: string | null;
  kickoffAt: Date;
  groupName: string | null;
};

/** Writes match metadata (teams — incl. TBD nulls — venue, kickoff, group). */
export async function updateMatchMeta(matchId: string, meta: MatchMeta): Promise<void> {
  await db.update(matches).set({
    homeTeamId: meta.homeTeamId, awayTeamId: meta.awayTeamId,
    venueId: meta.venueId, kickoffAt: meta.kickoffAt, groupName: meta.groupName,
  }).where(eq(matches.id, matchId));
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin-matches.ts
git commit -m "feat: admin match data layer (read shaping, options, writes)"
```

---

## Task 6: Admin server actions

**Files:**
- Create: `src/app/admin/matches/actions.ts`
- Reference: `src/app/fixtures/actions.ts` (guard + revalidate pattern), `src/lib/predictions.ts` (`validatePredictionScores`)

- [ ] **Step 1: Write the implementation**

```ts
// src/app/admin/matches/actions.ts
'use server';
import { revalidatePath } from 'next/cache';
import { getAdminUser } from '@/lib/admin';
import { validatePredictionScores } from '@/lib/predictions';
import {
  setMatchResult, updateMatchMeta, type MatchStatus, type MatchMeta,
} from '@/lib/admin-matches';
import { recomputeMatch } from '@/lib/scoring';

export type AdminResult = { ok: boolean; error?: string };

const VALID_STATUS: MatchStatus[] = ['scheduled', 'live', 'finished'];

export async function saveResult(
  matchId: string, home: number | null, away: number | null, status: MatchStatus,
): Promise<AdminResult> {
  if (!(await getAdminUser())) return { ok: false, error: 'Not authorized.' };
  if (!VALID_STATUS.includes(status)) return { ok: false, error: 'Invalid status.' };

  if (status === 'finished') {
    if (home == null || away == null) {
      return { ok: false, error: 'A finished match needs both scores.' };
    }
  }
  // Validate bounds whenever scores are present (finished or not).
  if (home != null && away != null) {
    const v = validatePredictionScores(home, away);
    if (!v.ok) return { ok: false, error: v.error };
  }

  await setMatchResult(matchId, home, away, status);
  await recomputeMatch(matchId);
  revalidatePath('/fixtures');
  revalidatePath('/admin/matches');
  return { ok: true };
}

export async function saveMatchMeta(matchId: string, meta: MatchMeta): Promise<AdminResult> {
  if (!(await getAdminUser())) return { ok: false, error: 'Not authorized.' };
  if (Number.isNaN(meta.kickoffAt.getTime())) return { ok: false, error: 'Invalid kickoff time.' };

  await updateMatchMeta(matchId, meta);
  // Metadata edits do not affect scoring, so no recompute.
  revalidatePath('/fixtures');
  revalidatePath('/admin/matches');
  return { ok: true };
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/matches/actions.ts
git commit -m "feat: guarded admin actions saveResult + saveMatchMeta"
```

---

## Task 7: Admin route guard + dashboard

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/page.tsx`
- Reference: `src/lib/admin.ts` (`getAdminUser`)

- [ ] **Step 1: Write the layout guard**

```tsx
// src/app/admin/layout.tsx
import { redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/admin';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser();
  if (!admin) redirect('/');
  return <section>{children}</section>;
}
```

- [ ] **Step 2: Write the dashboard page**

```tsx
// src/app/admin/page.tsx
import Link from 'next/link';

export default function AdminHome() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-serif text-2xl font-bold text-pitch">Admin</h1>
      <Link
        href="/admin/matches"
        className="rp-card p-4 font-bold text-pitch hover:bg-gold/20"
      >
        ⚽ Matches & Results →
      </Link>
      <p className="text-sm text-pitch/60">Ads and settings management arrive in later phases.</p>
    </div>
  );
}
```

- [ ] **Step 3: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/layout.tsx src/app/admin/page.tsx
git commit -m "feat: admin route guard + dashboard"
```

---

## Task 8: Admin matches table + editable row

**Files:**
- Create: `src/app/admin/matches/page.tsx`
- Create: `src/components/admin/match-row.tsx`
- Reference: `src/lib/admin-matches.ts`, `src/app/admin/matches/actions.ts`

- [ ] **Step 1: Write the matches page (server component)**

```tsx
// src/app/admin/matches/page.tsx
import { getAdminMatches, getTeamOptions, getVenueOptions } from '@/lib/admin-matches';
import { MatchRow } from '@/components/admin/match-row';

export default async function AdminMatchesPage() {
  const [matches, teamOptions, venueOptions] = await Promise.all([
    getAdminMatches(), getTeamOptions(), getVenueOptions(),
  ]);

  return (
    <div className="flex flex-col gap-3">
      <h1 className="font-serif text-2xl font-bold text-pitch">Matches & Results</h1>
      <p className="text-sm text-pitch/60">
        Enter a final score and set status to <strong>finished</strong> to score predictions.
      </p>
      <div className="flex flex-col gap-2">
        {matches.map((m) => (
          <MatchRow key={m.id} match={m} teamOptions={teamOptions} venueOptions={venueOptions} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the editable row (client component)**

```tsx
// src/components/admin/match-row.tsx
'use client';
import { useState, useTransition } from 'react';
import { saveResult, saveMatchMeta } from '@/app/admin/matches/actions';
import type { AdminMatch, TeamOption, VenueOption, MatchStatus } from '@/lib/admin-matches';

const STATUSES: MatchStatus[] = ['scheduled', 'live', 'finished'];
// Format a Date as a UTC `YYYY-MM-DDTHH:mm` string for datetime-local inputs.
const toLocalInput = (d: Date) => d.toISOString().slice(0, 16);
const teamName = (id: string | null, opts: TeamOption[]) =>
  id ? (opts.find((t) => t.id === id)?.code ?? '??') : 'TBD';

export function MatchRow({
  match, teamOptions, venueOptions,
}: { match: AdminMatch; teamOptions: TeamOption[]; venueOptions: VenueOption[] }) {
  const [home, setHome] = useState<string>(match.homeScore?.toString() ?? '');
  const [away, setAway] = useState<string>(match.awayScore?.toString() ?? '');
  const [status, setStatus] = useState<MatchStatus>(match.status);
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Metadata edit state
  const [homeTeamId, setHomeTeamId] = useState(match.homeTeamId ?? '');
  const [awayTeamId, setAwayTeamId] = useState(match.awayTeamId ?? '');
  const [venueId, setVenueId] = useState(match.venueId ?? '');
  const [kickoff, setKickoff] = useState(toLocalInput(match.kickoffAt));
  const [groupName, setGroupName] = useState(match.groupName ?? '');

  const parseScore = (s: string) => (s.trim() === '' ? null : Number(s));

  function submitResult() {
    setMsg(null);
    start(async () => {
      const res = await saveResult(match.id, parseScore(home), parseScore(away), status);
      setMsg(res.ok ? 'Saved ✓' : res.error ?? 'Error');
    });
  }

  function submitMeta() {
    setMsg(null);
    start(async () => {
      const res = await saveMatchMeta(match.id, {
        homeTeamId: homeTeamId || null,
        awayTeamId: awayTeamId || null,
        venueId: venueId || null,
        kickoffAt: new Date(`${kickoff}:00Z`), // interpret input as UTC
        groupName: groupName.trim() || null,
      });
      setMsg(res.ok ? 'Details saved ✓' : res.error ?? 'Error');
      if (res.ok) setEditing(false);
    });
  }

  return (
    <div className="rp-card p-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-[10px] uppercase font-bold text-pitch/50 w-12">{match.stage}</span>
        <span className="font-bold w-28 text-right">{teamName(match.homeTeamId, teamOptions)}</span>
        <input
          aria-label="home score" inputMode="numeric" value={home}
          onChange={(e) => setHome(e.target.value)}
          className="w-10 border-2 border-pitch rounded text-center"
        />
        <span>:</span>
        <input
          aria-label="away score" inputMode="numeric" value={away}
          onChange={(e) => setAway(e.target.value)}
          className="w-10 border-2 border-pitch rounded text-center"
        />
        <span className="font-bold w-28">{teamName(match.awayTeamId, teamOptions)}</span>
        <select
          aria-label="status" value={status}
          onChange={(e) => setStatus(e.target.value as MatchStatus)}
          className="border-2 border-pitch rounded text-xs ml-auto"
        >
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button
          onClick={submitResult} disabled={pending}
          className="bg-pitch text-cream rounded px-3 py-1 text-xs font-bold disabled:opacity-60"
        >Save</button>
        <button
          onClick={() => setEditing((v) => !v)}
          className="text-xs underline text-pitch/70"
        >{editing ? 'Close' : 'Edit details'}</button>
      </div>

      {editing && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t-2 border-pitch/20 pt-3">
          <label className="flex flex-col gap-1">Home team
            <select value={homeTeamId} onChange={(e) => setHomeTeamId(e.target.value)} className="border-2 border-pitch rounded p-1">
              <option value="">TBD</option>
              {teamOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">Away team
            <select value={awayTeamId} onChange={(e) => setAwayTeamId(e.target.value)} className="border-2 border-pitch rounded p-1">
              <option value="">TBD</option>
              {teamOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">Venue
            <select value={venueId} onChange={(e) => setVenueId(e.target.value)} className="border-2 border-pitch rounded p-1">
              <option value="">None</option>
              {venueOptions.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">Group
            <input value={groupName} onChange={(e) => setGroupName(e.target.value)} className="border-2 border-pitch rounded p-1" />
          </label>
          <label className="flex flex-col gap-1 col-span-2">Kickoff (UTC)
            <input type="datetime-local" value={kickoff} onChange={(e) => setKickoff(e.target.value)} className="border-2 border-pitch rounded p-1" />
          </label>
          <button
            onClick={submitMeta} disabled={pending}
            className="col-span-2 bg-pitch text-cream rounded py-1 font-bold disabled:opacity-60"
          >Save details</button>
        </div>
      )}

      {msg && <p className="text-xs mt-1">{msg}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Verify type-check and build**

Run: `npx tsc --noEmit`
Expected: no errors. (Full `next build` runs in Task 10.)

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/matches/page.tsx src/components/admin/match-row.tsx
git commit -m "feat: admin matches table with result entry + metadata editing"
```

---

## Task 9: Conditional Admin nav link

**Files:**
- Modify: `src/components/app-shell.tsx`
- Modify: `src/components/nav.tsx`
- Reference: `src/lib/admin.ts` (`getAdminUser`)

- [ ] **Step 1: Make AppShell resolve admin status**

Replace the contents of `src/components/app-shell.tsx` with:

```tsx
// src/components/app-shell.tsx
import { Nav } from './nav';
import { getAdminUser } from '@/lib/admin';

export async function AppShell({ children }: { children: React.ReactNode }) {
  const isAdmin = !!(await getAdminUser());
  return (
    <div className="min-h-dvh">
      <Nav isAdmin={isAdmin} />
      <main className="mx-auto max-w-3xl p-4">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Add the conditional link in Nav**

Replace the contents of `src/components/nav.tsx` with:

```tsx
// src/components/nav.tsx
import Link from 'next/link';

const links = [
  { href: '/fixtures', label: 'Fixtures' },
  { href: '/bracket', label: 'Bracket' },
  { href: '/leaderboard', label: 'Leaderboard' },
];

export function Nav({ isAdmin = false }: { isAdmin?: boolean }) {
  return (
    <nav className="flex items-center gap-4 bg-pitch text-cream px-4 py-3">
      <Link href="/" className="font-serif font-bold text-gold">
        ⚽ WC26 Predictor
      </Link>
      <div className="ml-auto flex gap-4">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="hover:text-gold">
            {l.label}
          </Link>
        ))}
        {isAdmin && (
          <Link href="/admin" className="hover:text-gold font-bold">
            Admin
          </Link>
        )}
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/app-shell.tsx src/components/nav.tsx
git commit -m "feat: show Admin nav link to allowlisted users"
```

---

## Task 10: Full verification + scored-card check

**Files:**
- Reference (no change expected): `src/components/fixtures/prediction-card.tsx`

> The scored match-card state already exists: `prediction-card.tsx:16-34` renders "Full time: H–A" plus a `+points` badge when a match is locked and finished. This task confirms it and runs the full suite. Per the verification-before-completion discipline, do not claim Phase 3 done until every command below shows the expected output.

- [ ] **Step 1: Confirm the scored state renders the result**

Read `src/components/fixtures/prediction-card.tsx`. Confirm the `match.locked` branch shows `Full time: {homeScore}–{awayScore}` when `status === 'finished'` and a `+{pointsAwarded}` badge when `pointsAwarded != null`. No change needed if present (it is).

- [ ] **Step 2: Set the admin env var locally**

Ensure `.env.local` contains your owner email (used by `getAdminUser`):

```bash
# Append to .env.local (gitignored). Replace with your real login email.
echo 'ADMIN_EMAILS=rafi@sdsmanager.com' >> .env.local
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — all suites including `admin.test.ts` and `scoring.test.ts` green.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Production build**

Run: `npm run build`
Expected: build succeeds; `/admin` and `/admin/matches` appear in the route output.

- [ ] **Step 6: Manual smoke test**

Run `npm run dev`. Signed in as the allowlisted email:
- The **Admin** link appears in the nav; `/admin` → dashboard → **Matches & Results**.
- Enter a score for a past/group match, set status **finished**, Save → "Saved ✓".
- Open `/fixtures`: that match shows **Full time: H–A**; if you had a prediction, the `+points` badge matches the scoring rules (exact +3 / result +1 / else 0).
- Revert the match to **scheduled** and Save → on `/fixtures` the points badge disappears.
- "Edit details" → change venue/kickoff/teams → "Details saved ✓"; `/fixtures` reflects it.
- Sign in as a **non**-allowlisted account (or sign out): the Admin link is gone and visiting `/admin` redirects to `/`.

- [ ] **Step 7: Commit any fixes** (only if the smoke test surfaced issues)

```bash
git add -A
git commit -m "fix: phase 3 verification follow-ups"
```

---

## Task 11: Docs + phase push

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Document the admin env var and mark the phase complete**

In `CLAUDE.md`:
- Under **Auth** / conventions, add a line:
  `**Admin:** gated by the \`ADMIN_EMAILS\` env allowlist (comma-separated owner emails), checked server-side via \`getAdminUser\` in \`src/lib/admin.ts\`. Set it in \`.env.local\` and Vercel project env.`
- In **Status**, update Phase 3 to COMPLETE with a one-line summary (admin match management at `/admin/matches`, scoring engine `src/lib/scoring.ts` + `recomputeMatch`, scored fixtures cards) and set Next to Phase 4 (Leaderboard + Head-to-Head).

- [ ] **Step 2: Add ADMIN_EMAILS to Vercel** (owner action, outside the repo)

Add `ADMIN_EMAILS` to the Vercel project (`predikto`) Production + Preview env vars so the deployed admin gate works. (If `vercel` CLI is installed: `vercel env add ADMIN_EMAILS`.)

- [ ] **Step 3: Commit docs**

```bash
git add CLAUDE.md
git commit -m "docs: document ADMIN_EMAILS, mark Phase 3 complete"
```

- [ ] **Step 4: Push the completed phase** (one deploy per phase, per project cadence)

```bash
git push origin main
```

Expected: push succeeds; Vercel auto-deploys. Verify the deployment goes green in the dashboard and the admin gate works in production (after Step 2's env var is set).

---

## Self-review notes

- **Spec coverage:** admin allowlist + `getAdminUser` (T1) · layout/action guards (T6/T7) · `scoreMatch`/`computePredictionPoints` (T2) · `getScoringConfig` (T3) · `recomputeMatch` incl. revert/clear → null (T4) · admin match management with full metadata editing + TBD slots + `live` status (T5/T6/T8) · scored match-card state (T10, already implemented) · nav link (T9) · `ADMIN_EMAILS` env documented (T11). All spec sections map to a task.
- **Deviations** (documented above): no `profiles.isAdmin` sync; metadata edits skip recompute; `getAdminUser` uses a dynamic import for Vitest compatibility.
- **Type consistency:** `MatchStatus`, `AdminMatch`, `TeamOption`, `VenueOption`, `MatchMeta`, `AdminResult`, `ScoringConfig` are defined once and reused by name across tasks; `computePredictionPoints`/`scoreMatch`/`recomputeMatch`/`getScoringConfig`/`saveResult`/`saveMatchMeta` names are stable throughout.
