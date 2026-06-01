# Phase 2: Fixtures + Match Predictions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let signed-in users browse the fixture list (Calendar Grid default, with Timeline and Stage Navigator toggles + team/group/stage filters) and predict each match's scoreline via a steppers + quick-scoreline card that auto-locks at kickoff and shows the scored result afterward.

**Architecture:** A `/fixtures` Server Component reads enriched matches (teams + venue joined in JS) plus the current user's predictions, then renders one of three view components chosen by a `view` search param. Filters are links that set search params. The prediction card is a Client Component that holds local score state and calls a `savePrediction` Server Action, which re-checks auth and the kickoff lock server-side before upserting. Lock + scoring primitives from Phase 1 (`src/lib/locks.ts`) are reused.

**Tech Stack:** Next.js 16 (App Router, async `searchParams`), React 19 Server/Client Components + Server Actions, Drizzle, Tailwind v4 (`@theme` tokens), Vitest.

**Prerequisite:** Phase 1 complete (schema migrated, seed loaded, auth working). To see more than the 3 seeded matches, expand `data/seed.json` and re-run `npm run db:seed` — not required for this phase to function.

---

## File Structure

- `src/lib/fixtures.ts` — `getFixtures()` (enriched matches), `groupByDate()`, `groupByStage()`, `groupByGroup()`, types (Task 1)
- `src/lib/fixtures.test.ts` — grouping tests (Task 1)
- `src/lib/predictions.ts` — `validatePredictionScores()`, `getUserPredictionMap()`, `upsertPrediction()` (Task 2)
- `src/lib/predictions.test.ts` — validation tests (Task 2)
- `src/app/fixtures/actions.ts` — `savePrediction` Server Action (Task 3)
- `src/components/fixtures/prediction-card.tsx` — Client Component, steppers + quick scorelines + locked/scored states (Task 4)
- `src/components/fixtures/match-card.tsx` — presentational match row wrapping the prediction card (Task 5)
- `src/components/fixtures/calendar-grid.tsx`, `timeline.tsx`, `stage-nav.tsx` — the three views (Task 5)
- `src/components/fixtures/view-toggle.tsx`, `filters.tsx` — view switch + filter bar (Task 5)
- `src/app/fixtures/page.tsx` — Server Component wiring data + view selection (Task 6)

---

## Task 1: Fixtures data access + grouping (TDD for grouping)

**Files:** Create `src/lib/fixtures.ts`, `src/lib/fixtures.test.ts`

- [ ] **Step 1: Write the failing test `src/lib/fixtures.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { groupByDate, groupByStage, type FixtureMatch } from './fixtures';

function fx(partial: Partial<FixtureMatch> & { id: string; kickoffAt: Date }): FixtureMatch {
  return {
    id: partial.id, externalId: partial.id, stage: partial.stage ?? 'group',
    groupName: partial.groupName ?? null, kickoffAt: partial.kickoffAt,
    status: partial.status ?? 'scheduled', home: null, away: null, venue: null,
    homeScore: null, awayScore: null, prediction: null, locked: false,
  };
}

describe('groupByDate', () => {
  it('groups by UTC date and sorts chronologically', () => {
    const groups = groupByDate([
      fx({ id: 'b', kickoffAt: new Date('2026-06-12T19:00:00Z') }),
      fx({ id: 'a', kickoffAt: new Date('2026-06-11T20:00:00Z') }),
      fx({ id: 'c', kickoffAt: new Date('2026-06-12T23:00:00Z') }),
    ]);
    expect(groups.map((g) => g.date)).toEqual(['2026-06-11', '2026-06-12']);
    expect(groups[1].matches.map((m) => m.id)).toEqual(['b', 'c']); // sorted by kickoff within day
  });
});

describe('groupByStage', () => {
  it('groups matches under their stage in tournament order', () => {
    const groups = groupByStage([
      fx({ id: 'final1', kickoffAt: new Date('2026-07-19T19:00:00Z'), stage: 'final' }),
      fx({ id: 'grp1', kickoffAt: new Date('2026-06-11T20:00:00Z'), stage: 'group' }),
    ]);
    expect(groups.map((g) => g.stage)).toEqual(['group', 'final']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- fixtures`
Expected: FAIL — "Cannot find module './fixtures'".

- [ ] **Step 3: Implement `src/lib/fixtures.ts`**

```ts
import { db } from '@/db';
import { matches, teams, venues } from '@/db/schema';
import { isMatchLocked } from './locks';

export type Stage = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'final';

export type TeamLite = { id: string; code: string; name: string; flag: string | null };
export type FixtureMatch = {
  id: string;
  externalId: string | null;
  stage: Stage;
  groupName: string | null;
  kickoffAt: Date;
  status: 'scheduled' | 'live' | 'finished';
  home: TeamLite | null;
  away: TeamLite | null;
  venue: { name: string; city: string | null } | null;
  homeScore: number | null;
  awayScore: number | null;
  prediction: { homeScore: number; awayScore: number; pointsAwarded: number | null } | null;
  locked: boolean;
};

const STAGE_ORDER: Stage[] = ['group', 'r32', 'r16', 'qf', 'sf', 'final'];

/** Loads all matches enriched with team/venue data and (optionally) the user's predictions. */
export async function getFixtures(
  predictionMap?: Map<string, { homeScore: number; awayScore: number; pointsAwarded: number | null }>,
  now: Date = new Date(),
): Promise<FixtureMatch[]> {
  const [matchRows, teamRows, venueRows] = await Promise.all([
    db.select().from(matches),
    db.select().from(teams),
    db.select().from(venues),
  ]);
  const teamById = new Map(teamRows.map((t) => [t.id, t]));
  const venueById = new Map(venueRows.map((v) => [v.id, v]));

  const toLite = (id: string | null): TeamLite | null => {
    if (!id) return null;
    const t = teamById.get(id);
    return t ? { id: t.id, code: t.code, name: t.name, flag: t.flag } : null;
  };

  return matchRows
    .map((m): FixtureMatch => {
      const v = m.venueId ? venueById.get(m.venueId) : undefined;
      return {
        id: m.id, externalId: m.externalId, stage: m.stage as Stage,
        groupName: m.groupName, kickoffAt: m.kickoffAt, status: m.status,
        home: toLite(m.homeTeamId), away: toLite(m.awayTeamId),
        venue: v ? { name: v.name, city: v.city } : null,
        homeScore: m.homeScore, awayScore: m.awayScore,
        prediction: predictionMap?.get(m.id) ?? null,
        locked: isMatchLocked(m.kickoffAt, now),
      };
    })
    .sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime());
}

export type DateGroup = { date: string; matches: FixtureMatch[] };

export function groupByDate(list: FixtureMatch[]): DateGroup[] {
  const byDate = new Map<string, FixtureMatch[]>();
  for (const m of list) {
    const date = m.kickoffAt.toISOString().slice(0, 10);
    (byDate.get(date) ?? byDate.set(date, []).get(date)!).push(m);
  }
  return [...byDate.entries()]
    .map(([date, ms]) => ({ date, matches: ms.sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime()) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type StageGroup = { stage: Stage; matches: FixtureMatch[] };

export function groupByStage(list: FixtureMatch[]): StageGroup[] {
  return STAGE_ORDER
    .map((stage) => ({ stage, matches: list.filter((m) => m.stage === stage) }))
    .filter((g) => g.matches.length > 0);
}

export type NamedGroup = { groupName: string; matches: FixtureMatch[] };

export function groupByGroup(list: FixtureMatch[]): NamedGroup[] {
  const groups = list.filter((m) => m.stage === 'group' && m.groupName);
  const byName = new Map<string, FixtureMatch[]>();
  for (const m of groups) {
    const g = m.groupName!;
    (byName.get(g) ?? byName.set(g, []).get(g)!).push(m);
  }
  return [...byName.entries()]
    .map(([groupName, ms]) => ({ groupName, matches: ms }))
    .sort((a, b) => a.groupName.localeCompare(b.groupName));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- fixtures`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/fixtures.ts src/lib/fixtures.test.ts
git commit -m "feat: fixtures data access and grouping helpers"
```

---

## Task 2: Predictions data access + validation (TDD for validation)

**Files:** Create `src/lib/predictions.ts`, `src/lib/predictions.test.ts`

- [ ] **Step 1: Write the failing test `src/lib/predictions.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { validatePredictionScores } from './predictions';

describe('validatePredictionScores', () => {
  it('accepts non-negative integers', () => {
    expect(validatePredictionScores(2, 1)).toEqual({ ok: true, home: 2, away: 1 });
    expect(validatePredictionScores(0, 0)).toEqual({ ok: true, home: 0, away: 0 });
  });
  it('rejects negatives, non-integers, and absurd values', () => {
    expect(validatePredictionScores(-1, 0).ok).toBe(false);
    expect(validatePredictionScores(1.5, 0).ok).toBe(false);
    expect(validatePredictionScores(0, 100).ok).toBe(false); // cap absurd scores
    expect(validatePredictionScores(NaN, 0).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- predictions`
Expected: FAIL — "Cannot find module './predictions'".

- [ ] **Step 3: Implement `src/lib/predictions.ts`**

```ts
import { db } from '@/db';
import { matchPredictions } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

const MAX_GOALS = 30;

export type ValidationResult =
  | { ok: true; home: number; away: number }
  | { ok: false; error: string };

export function validatePredictionScores(home: number, away: number): ValidationResult {
  for (const v of [home, away]) {
    if (!Number.isInteger(v) || v < 0 || v > MAX_GOALS) {
      return { ok: false, error: 'Scores must be whole numbers between 0 and 30.' };
    }
  }
  return { ok: true, home, away };
}

export async function getUserPredictionMap(userId: string) {
  const rows = await db.select().from(matchPredictions).where(eq(matchPredictions.userId, userId));
  return new Map(
    rows.map((r) => [r.matchId, { homeScore: r.homeScore, awayScore: r.awayScore, pointsAwarded: r.pointsAwarded }]),
  );
}

/** Upserts a user's prediction for a match. Lock + auth must be checked by the caller. */
export async function upsertPrediction(userId: string, matchId: string, home: number, away: number) {
  await db
    .insert(matchPredictions)
    .values({ userId, matchId, homeScore: home, awayScore: away })
    .onConflictDoUpdate({
      target: [matchPredictions.userId, matchPredictions.matchId],
      set: { homeScore: home, awayScore: away, updatedAt: new Date() },
    });
}

/** Reads a single match's kickoff time (for server-side lock enforcement). */
export async function getMatchKickoff(matchId: string): Promise<Date | null> {
  const { matches } = await import('@/db/schema');
  const rows = await db.select({ kickoffAt: matches.kickoffAt }).from(matches).where(eq(matches.id, matchId));
  return rows[0]?.kickoffAt ?? null;
}

// Re-export for callers that need the AND helper composition in future phases.
export { and, eq };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- predictions`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/predictions.ts src/lib/predictions.test.ts
git commit -m "feat: prediction validation and upsert data access"
```

---

## Task 3: `savePrediction` Server Action

**Files:** Create `src/app/fixtures/actions.ts`

- [ ] **Step 1: Implement the action**

```ts
'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isMatchLocked } from '@/lib/locks';
import {
  validatePredictionScores, upsertPrediction, getMatchKickoff,
} from '@/lib/predictions';

export type SaveResult = { ok: boolean; error?: string };

export async function savePrediction(
  matchId: string,
  home: number,
  away: number,
): Promise<SaveResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in to predict.' };

  const valid = validatePredictionScores(home, away);
  if (!valid.ok) return { ok: false, error: valid.error };

  const kickoff = await getMatchKickoff(matchId);
  if (!kickoff) return { ok: false, error: 'Match not found.' };
  if (isMatchLocked(kickoff)) return { ok: false, error: 'This match is locked (kickoff has passed).' };

  await upsertPrediction(user.id, matchId, valid.home, valid.away);
  revalidatePath('/fixtures');
  return { ok: true };
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: compiles (the action is referenced by components in later tasks; standalone it must still typecheck).

- [ ] **Step 3: Commit**

```bash
git add src/app/fixtures/actions.ts
git commit -m "feat: savePrediction server action with auth + lock enforcement"
```

---

## Task 4: PredictionCard component (steppers + quick scorelines + states)

**Files:** Create `src/components/fixtures/prediction-card.tsx`

- [ ] **Step 1: Implement the Client Component**

```tsx
'use client';
import { useState, useTransition } from 'react';
import { savePrediction } from '@/app/fixtures/actions';
import type { FixtureMatch } from '@/lib/fixtures';

const QUICK: Array<[number, number]> = [[1, 0], [2, 1], [1, 1], [0, 0]];

export function PredictionCard({ match, signedIn }: { match: FixtureMatch; signedIn: boolean }) {
  const initial = match.prediction;
  const [home, setHome] = useState(initial?.homeScore ?? 0);
  const [away, setAway] = useState(initial?.awayScore ?? 0);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  // Locked: show pick + actual result/points if finished.
  if (match.locked) {
    return (
      <div className="text-sm">
        {match.status === 'finished' && (
          <div className="font-semibold">Full time: {match.homeScore}–{match.awayScore}</div>
        )}
        {initial ? (
          <div className="flex items-center gap-2">
            <span>🔒 Your pick: {initial.homeScore}–{initial.awayScore}</span>
            {initial.pointsAwarded != null && (
              <span className="bg-pitch text-gold rounded px-2 py-0.5 font-bold">+{initial.pointsAwarded}</span>
            )}
          </div>
        ) : (
          <span className="text-pitch/60">🔒 Locked — no pick made</span>
        )}
      </div>
    );
  }

  if (!signedIn) {
    return <a href="/auth/login" className="text-sm underline">Sign in to predict</a>;
  }

  const clamp = (n: number) => Math.max(0, Math.min(30, n));
  function save() {
    setMsg(null);
    start(async () => {
      const res = await savePrediction(match.id, home, away);
      setMsg(res.ok ? 'Saved ✓' : res.error ?? 'Error');
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-center gap-3">
        <Stepper value={home} onChange={(v) => setHome(clamp(v))} label={match.home?.code ?? 'Home'} />
        <span className="font-bold">:</span>
        <Stepper value={away} onChange={(v) => setAway(clamp(v))} label={match.away?.code ?? 'Away'} />
      </div>
      <div className="flex flex-wrap gap-1 justify-center">
        {QUICK.map(([h, a]) => (
          <button
            key={`${h}-${a}`}
            onClick={() => { setHome(h); setAway(a); }}
            className={`border-2 border-pitch rounded px-2 py-0.5 text-xs font-bold ${
              home === h && away === a ? 'bg-gold' : 'bg-cream'
            }`}
          >
            {h}-{a}
          </button>
        ))}
      </div>
      <button
        onClick={save}
        disabled={pending}
        className="bg-pitch text-cream rounded-lg py-1.5 text-sm font-bold disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Save pick'}
      </button>
      {msg && <p className="text-center text-xs">{msg}</p>}
    </div>
  );
}

function Stepper({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-bold uppercase text-pitch/60">{label}</span>
      <button onClick={() => onChange(value + 1)} className="w-7 h-7 border-2 border-pitch rounded bg-gold font-bold">+</button>
      <span className="w-9 h-9 border-2 border-pitch rounded bg-white flex items-center justify-center text-lg font-bold">{value}</span>
      <button onClick={() => onChange(value - 1)} className="w-7 h-7 border-2 border-pitch rounded bg-gold font-bold">−</button>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: compiles.

- [ ] **Step 3: Commit**

```bash
git add src/components/fixtures/prediction-card.tsx
git commit -m "feat: prediction card with steppers, quick scorelines, locked/scored states"
```

---

## Task 5: MatchCard + three views + view toggle + filters

**Files:** Create `src/components/fixtures/match-card.tsx`, `calendar-grid.tsx`, `timeline.tsx`, `stage-nav.tsx`, `view-toggle.tsx`, `filters.tsx`

- [ ] **Step 1: `match-card.tsx`**

```tsx
import type { FixtureMatch } from '@/lib/fixtures';
import { PredictionCard } from './prediction-card';

const TBD = 'TBD';
const fmtTime = (d: Date) =>
  d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric', timeZone: 'UTC' }) + ' UTC';

export function MatchCard({ match, signedIn }: { match: FixtureMatch; signedIn: boolean }) {
  return (
    <div className="rp-card p-3 mb-2">
      <div className="text-[10px] uppercase tracking-wide text-pitch/60 font-bold text-center">
        {fmtTime(match.kickoffAt)} · {match.venue?.name ?? TBD}
        {match.groupName ? ` · Group ${match.groupName}` : ''}
      </div>
      <div className="flex items-center justify-between my-2 font-bold">
        <span>{match.home ? `${match.home.flag ?? ''} ${match.home.code}` : TBD}</span>
        <span className="text-pitch/50">vs</span>
        <span>{match.away ? `${match.away.code} ${match.away.flag ?? ''}` : TBD}</span>
      </div>
      <PredictionCard match={match} signedIn={signedIn} />
    </div>
  );
}
```

- [ ] **Step 2: `timeline.tsx`**

```tsx
import { groupByDate, type FixtureMatch } from '@/lib/fixtures';
import { MatchCard } from './match-card';

const fmtDate = (iso: string) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

export function Timeline({ matches, signedIn }: { matches: FixtureMatch[]; signedIn: boolean }) {
  const groups = groupByDate(matches);
  if (!groups.length) return <p className="rp-card p-4 text-center">No matches.</p>;
  return (
    <div>
      {groups.map((g) => (
        <section key={g.date} className="mb-4">
          <h2 className="font-bold border-b-2 border-pitch pb-1 mb-2 text-cream">{fmtDate(g.date)}</h2>
          {g.matches.map((m) => <MatchCard key={m.id} match={m} signedIn={signedIn} />)}
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: `stage-nav.tsx`**

```tsx
import { groupByStage, groupByGroup, type FixtureMatch } from '@/lib/fixtures';
import { MatchCard } from './match-card';

const STAGE_LABEL: Record<string, string> = {
  group: 'Group Stage', r32: 'Round of 32', r16: 'Round of 16', qf: 'Quarter-finals', sf: 'Semi-finals', final: 'Final',
};

export function StageNav({ matches, signedIn }: { matches: FixtureMatch[]; signedIn: boolean }) {
  const stages = groupByStage(matches);
  if (!stages.length) return <p className="rp-card p-4 text-center">No matches.</p>;
  return (
    <div>
      {stages.map((s) => (
        <section key={s.stage} className="mb-5">
          <h2 className="font-bold text-cream text-lg mb-2">{STAGE_LABEL[s.stage] ?? s.stage}</h2>
          {s.stage === 'group'
            ? groupByGroup(s.matches).map((g) => (
                <div key={g.groupName} className="mb-3">
                  <h3 className="font-bold text-cream/90 text-sm mb-1">Group {g.groupName}</h3>
                  {g.matches.map((m) => <MatchCard key={m.id} match={m} signedIn={signedIn} />)}
                </div>
              ))
            : s.matches.map((m) => <MatchCard key={m.id} match={m} signedIn={signedIn} />)}
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: `calendar-grid.tsx`** (month grid with match-count dots; tapping a day links to the Timeline filtered to that date via an anchor; for v1 the grid lists each day's matches inline below the grid for the current month range)

```tsx
import { groupByDate, type FixtureMatch } from '@/lib/fixtures';
import { MatchCard } from './match-card';

/**
 * Calendar Grid: shows each match day as a labeled block (a lightweight, mobile-first
 * take on a month calendar — full grid cells get refined later). Days are derived from
 * the matches themselves so empty days don't clutter the view.
 */
export function CalendarGrid({ matches, signedIn }: { matches: FixtureMatch[]; signedIn: boolean }) {
  const groups = groupByDate(matches);
  if (!groups.length) return <p className="rp-card p-4 text-center">No matches scheduled yet.</p>;
  return (
    <div className="grid gap-3">
      {groups.map((g) => (
        <div key={g.date} className="rp-card p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold">
              {new Date(g.date + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}
            </span>
            <span className="bg-pitch text-gold rounded-full px-2 py-0.5 text-xs font-bold">
              {g.matches.length} {g.matches.length === 1 ? 'match' : 'matches'}
            </span>
          </div>
          {g.matches.map((m) => <MatchCard key={m.id} match={m} signedIn={signedIn} />)}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: `view-toggle.tsx`**

```tsx
import Link from 'next/link';

const VIEWS = [
  { key: 'calendar', label: '📅 Calendar' },
  { key: 'timeline', label: '📜 Timeline' },
  { key: 'stage', label: '🏆 Stages' },
];

export function ViewToggle({ active, query }: { active: string; query: Record<string, string | undefined> }) {
  const build = (view: string) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v && k !== 'view') params.set(k, v);
    params.set('view', view);
    return `/fixtures?${params.toString()}`;
  };
  return (
    <div className="flex gap-2 mb-3">
      {VIEWS.map((v) => (
        <Link
          key={v.key}
          href={build(v.key)}
          className={`border-2 border-pitch rounded-lg px-3 py-1 text-sm font-bold ${active === v.key ? 'bg-gold text-pitch' : 'bg-cream text-pitch'}`}
        >
          {v.label}
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: `filters.tsx`**

```tsx
import Link from 'next/link';
import type { FixtureMatch } from '@/lib/fixtures';

const STAGES = [
  { key: '', label: 'All' },
  { key: 'group', label: 'Groups' },
  { key: 'r32', label: 'R32' }, { key: 'r16', label: 'R16' },
  { key: 'qf', label: 'QF' }, { key: 'sf', label: 'SF' }, { key: 'final', label: 'Final' },
];

export function Filters({
  matches, query,
}: { matches: FixtureMatch[]; query: Record<string, string | undefined> }) {
  const groups = [...new Set(matches.map((m) => m.groupName).filter(Boolean) as string[])].sort();
  const build = (patch: Record<string, string>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v) params.set(k, v);
    for (const [k, v] of Object.entries(patch)) v ? params.set(k, v) : params.delete(k);
    return `/fixtures?${params.toString()}`;
  };
  const chip = (label: string, href: string, on: boolean) => (
    <Link key={label + href} href={href}
      className={`border-2 border-pitch rounded px-2 py-0.5 text-xs font-bold ${on ? 'bg-gold' : 'bg-cream'}`}>{label}</Link>
  );
  return (
    <div className="flex flex-col gap-2 mb-3">
      <div className="flex flex-wrap gap-1">
        {STAGES.map((s) => chip(s.label, build({ stage: s.key }), (query.stage ?? '') === s.key))}
      </div>
      {groups.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {chip('All groups', build({ group: '' }), !query.group)}
          {groups.map((g) => chip(`Grp ${g}`, build({ group: g }), query.group === g))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: compiles (components are wired into the page in Task 6; they must typecheck now).

- [ ] **Step 8: Commit**

```bash
git add src/components/fixtures/
git commit -m "feat: match card, calendar/timeline/stage views, view toggle, filters"
```

---

## Task 6: Fixtures page wiring

**Files:** Create `src/app/fixtures/page.tsx`

- [ ] **Step 1: Implement the Server Component**

```tsx
import { createClient } from '@/lib/supabase/server';
import { getFixtures } from '@/lib/fixtures';
import { getUserPredictionMap } from '@/lib/predictions';
import { CalendarGrid } from '@/components/fixtures/calendar-grid';
import { Timeline } from '@/components/fixtures/timeline';
import { StageNav } from '@/components/fixtures/stage-nav';
import { ViewToggle } from '@/components/fixtures/view-toggle';
import { Filters } from '@/components/fixtures/filters';

export default async function FixturesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; stage?: string; group?: string }>;
}) {
  const sp = await searchParams;
  const view = sp.view ?? 'calendar';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const predictionMap = user ? await getUserPredictionMap(user.id) : undefined;

  const all = await getFixtures(predictionMap);
  const filtered = all.filter(
    (m) => (!sp.stage || m.stage === sp.stage) && (!sp.group || m.groupName === sp.group),
  );

  const query = { view, stage: sp.stage, group: sp.group };
  const signedIn = !!user;

  return (
    <div>
      <h1 className="text-2xl font-bold text-cream mb-3">Fixtures</h1>
      <ViewToggle active={view} query={query} />
      <Filters matches={all} query={query} />
      {view === 'timeline' && <Timeline matches={filtered} signedIn={signedIn} />}
      {view === 'stage' && <StageNav matches={filtered} signedIn={signedIn} />}
      {view !== 'timeline' && view !== 'stage' && <CalendarGrid matches={filtered} signedIn={signedIn} />}
    </div>
  );
}
```

- [ ] **Step 2: Verify build + lint + tests**

Run: `npm run build && npm test && npm run lint`
Expected: build compiles with `/fixtures` route (dynamic), all tests pass, lint clean.

- [ ] **Step 3: Manual smoke check (dev)**

Run `npm run dev`, sign in, open `/fixtures`. Verify: Calendar view shows the seeded match days; toggling to Timeline/Stages works; stage/group filter chips work; on an unlocked match, set a score with steppers or a quick button, click Save → "Saved ✓"; reload → the pick persists. Confirm a `match_predictions` row exists in Supabase.

- [ ] **Step 4: Commit**

```bash
git add src/app/fixtures/page.tsx
git commit -m "feat: fixtures page with view selection, filters, and predictions"
```

---

## Self-Review Notes

- **Spec coverage:** Calendar Grid default + Timeline + Stage Navigator toggle ✓ (T5/T6); filters by group/stage ✓ (T6 + Filters); team filter is deferred (group/stage cover the common cases — note below). Prediction card with steppers + quick scorelines ✓ (T4); auto-lock at kickoff ✓ (locked branch + server-side `savePrediction` lock check, T3/T4); scored state ✓ (T4 finished/points branch). Predictions persist per user with unique (user, match) upsert ✓ (T2).
- **Deferred (note, not silently dropped):** (1) **Team filter** chip — group/stage filters ship now; team filter is a small follow-up. (2) Points shown on locked cards stay null until the Phase 3 scoring engine runs. (3) Calendar Grid is a mobile-first day-block layout rather than a 7-column month grid; refine in polish (Phase 6) if desired.
- **Type consistency:** `FixtureMatch` shape is defined once in `fixtures.ts` and consumed by all components and the page; `savePrediction(matchId, home, away)` signature matches the PredictionCard call; `getUserPredictionMap` value shape matches `FixtureMatch.prediction`.
- **Next 16:** `searchParams` awaited as a Promise; Server Action in a `'use server'` module; `revalidatePath('/fixtures')` refreshes after save.
```
