# Countdown + Full Fixtures + Local Timezone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a live homepage countdown, render all fixture times + day grouping in the visitor's local timezone, and load the full real WC2026 schedule (48 teams, 104 matches incl. third-place).

**Architecture:** Pure helpers (`timeRemaining`, `groupByLocalDate`) are unit-tested; thin client components (`<LocalTime>`, `<Countdown>`) wrap them with a mount-guard to avoid SSR/TZ hydration mismatches. The fixtures day-grouped views become client components so grouping happens in the browser timezone. A new `third` stage enum carries the third-place match. The seed is replaced with researched real data and loaded via a reset-then-seed script.

**Tech Stack:** Next.js 16 (App Router, RSC + client components), Drizzle ORM + drizzle-kit (Postgres enum migration), Vitest, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-06-03-countdown-fixtures-localtime-design.md`

**Notes:**
- `FixtureMatch.kickoffAt` is a `Date` and survives the RSC server→client boundary (the existing `PredictionCard` client component already receives it), so client components take `Date` directly — no manual ISO conversion needed.
- Making `calendar-grid`/`timeline` client components pulls `MatchCard` into the client bundle; that's fine — `MatchCard` has no server-only dependencies.
- The fixture data (Task 7) is researched real-world data, not code; its guardrail is a shape test (counts + integrity), written first.

---

## File structure

| File | Responsibility |
|------|----------------|
| `src/db/schema.ts` (modify) | Add `third` to `stageEnum` |
| `drizzle/*` (generated) | Migration for the enum change |
| `src/lib/fixtures.ts` (modify) | `Stage` type + `STAGE_ORDER` include `third` |
| `src/db/seed-data.ts` (modify) | `SeedMatch.stage` union includes `third` |
| `src/components/fixtures/stage-nav.tsx` (modify) | `third` → "3rd Place" label |
| `src/lib/local-time.ts` (create) | Pure `timeRemaining` + `groupByLocalDate` + default local key |
| `src/lib/local-time.test.ts` (create) | Unit tests for the two pure helpers |
| `src/components/local-time.tsx` (create) | `<LocalTime>` client component |
| `src/components/countdown.tsx` (create) | `<Countdown>` client component |
| `src/components/fixtures/match-card.tsx` (modify) | Use `<LocalTime>` (drop UTC suffix) |
| `src/components/fixtures/calendar-grid.tsx` (modify) | Client; local-day grouping + `<LocalTime>` header |
| `src/components/fixtures/timeline.tsx` (modify) | Client; local-day grouping + `<LocalTime>` header |
| `src/app/page.tsx` (modify) | Countdown + upcoming teaser + CTA |
| `src/db/reset.ts` (create) + `package.json` | `db:reset` truncate-then-seed |
| `src/db/seed-content.test.ts` (create) | Shape test for the real `data/seed.json` |
| `data/seed.json` (replace) | Full 48-team / 104-match dataset |
| `CLAUDE.md` (modify) | Document `db:reset`; note local time + countdown |

---

## Task 1: Add `third` stage (schema + migration + types + label)

**Files:**
- Modify: `src/db/schema.ts:6`
- Modify: `src/lib/fixtures.ts:5` and `:24`
- Modify: `src/db/seed-data.ts:12`
- Modify: `src/components/fixtures/stage-nav.tsx:4-6`

- [ ] **Step 1: Add `third` to the enum in `src/db/schema.ts`**

Change line 6 from:
```ts
export const stageEnum = pgEnum('stage', ['group', 'r32', 'r16', 'qf', 'sf', 'final']);
```
to:
```ts
export const stageEnum = pgEnum('stage', ['group', 'r32', 'r16', 'qf', 'sf', 'third', 'final']);
```

- [ ] **Step 2: Update the `Stage` type and `STAGE_ORDER` in `src/lib/fixtures.ts`**

Change line 5:
```ts
export type Stage = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final';
```
Change line 24:
```ts
const STAGE_ORDER: Stage[] = ['group', 'r32', 'r16', 'qf', 'sf', 'third', 'final'];
```

- [ ] **Step 3: Update `SeedMatch.stage` in `src/db/seed-data.ts`**

Change line 12:
```ts
  stage: 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final';
```

- [ ] **Step 4: Add the label in `src/components/fixtures/stage-nav.tsx`**

Change the `STAGE_LABEL` (lines 4-6) to include `third`:
```ts
const STAGE_LABEL: Record<string, string> = {
  group: 'Group Stage', r32: 'Round of 32', r16: 'Round of 16', qf: 'Quarter-finals', sf: 'Semi-finals', third: '3rd Place', final: 'Final',
};
```

- [ ] **Step 5: Generate the migration**

Run: `npx drizzle-kit generate`
Expected: a new SQL file under `drizzle/` that alters the `stage` enum to add `'third'` (e.g. `ALTER TYPE "stage" ADD VALUE 'third'`). Note: Postgres adds enum values in order; if drizzle-kit emits a recreate-type migration instead, that's also acceptable.

- [ ] **Step 6: Apply the migration**

Run: `npx drizzle-kit migrate`
Expected: migration applies cleanly against the DB (DATABASE_URL from `.env.local`).

- [ ] **Step 7: Verify types + existing tests**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all existing tests pass (22 tests).

- [ ] **Step 8: Commit**

```bash
git add src/db/schema.ts src/lib/fixtures.ts src/db/seed-data.ts src/components/fixtures/stage-nav.tsx drizzle
git commit -m "feat: add third-place stage to schema, types, and stage nav"
```

---

## Task 2: Pure helpers — `timeRemaining` + `groupByLocalDate` (TDD)

**Files:**
- Create: `src/lib/local-time.ts`
- Test: `src/lib/local-time.test.ts`
- Reference: `src/lib/fixtures.ts` (`FixtureMatch` type)

- [ ] **Step 1: Write the failing test at `src/lib/local-time.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { timeRemaining, groupByLocalDate } from './local-time';
import type { FixtureMatch } from './fixtures';

const mk = (id: string, iso: string): FixtureMatch => ({
  id, externalId: id, stage: 'group', groupName: 'A',
  kickoffAt: new Date(iso), status: 'scheduled',
  home: null, away: null, venue: null,
  homeScore: null, awayScore: null, prediction: null, locked: false,
});

describe('timeRemaining', () => {
  it('breaks a future gap into d/h/m/s', () => {
    const now = new Date('2026-06-10T20:00:00Z');
    const target = new Date('2026-06-11T20:00:00Z'); // exactly 1 day
    expect(timeRemaining(target, now)).toEqual({ days: 1, hours: 0, minutes: 0, seconds: 0, done: false });
  });
  it('handles mixed remainder', () => {
    const now = new Date('2026-06-10T18:30:15Z');
    const target = new Date('2026-06-12T20:45:20Z');
    expect(timeRemaining(target, now)).toEqual({ days: 2, hours: 2, minutes: 15, seconds: 5, done: false });
  });
  it('is done at or after the target', () => {
    const t = new Date('2026-06-11T20:00:00Z');
    expect(timeRemaining(t, t)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, done: true });
    expect(timeRemaining(t, new Date('2026-06-11T20:00:01Z')).done).toBe(true);
  });
});

describe('groupByLocalDate', () => {
  // Inject a UTC+6 day key so the test is deterministic regardless of the runner's TZ.
  const plus6Key = (d: Date) => new Date(d.getTime() + 6 * 3600 * 1000).toISOString().slice(0, 10);

  it('buckets matches by the injected local day and sorts chronologically', () => {
    const early = mk('a', '2026-06-11T10:00:00Z'); // +6 → 16:00 same day → 2026-06-11
    const late = mk('b', '2026-06-11T20:00:00Z');  // +6 → 02:00 next day → 2026-06-12
    const groups = groupByLocalDate([late, early], plus6Key);
    expect(groups.map((g) => g.dateKey)).toEqual(['2026-06-11', '2026-06-12']);
    expect(groups[0].matches.map((m) => m.id)).toEqual(['a']);
    expect(groups[1].matches.map((m) => m.id)).toEqual(['b']);
  });

  it('keeps same-day matches together, time-sorted', () => {
    const m1 = mk('x', '2026-06-11T15:00:00Z');
    const m2 = mk('y', '2026-06-11T12:00:00Z');
    const groups = groupByLocalDate([m1, m2], plus6Key);
    expect(groups).toHaveLength(1);
    expect(groups[0].matches.map((m) => m.id)).toEqual(['y', 'x']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/local-time.test.ts`
Expected: FAIL — cannot resolve `./local-time`.

- [ ] **Step 3: Implement `src/lib/local-time.ts`**

```ts
import type { FixtureMatch } from './fixtures';

export type Remaining = { days: number; hours: number; minutes: number; seconds: number; done: boolean };

/** Splits the gap between now and target into d/h/m/s. `done` once now >= target. */
export function timeRemaining(target: Date, now: Date): Remaining {
  let ms = target.getTime() - now.getTime();
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  const sec = Math.floor(ms / 1000);
  return {
    days: Math.floor(sec / 86400),
    hours: Math.floor((sec % 86400) / 3600),
    minutes: Math.floor((sec % 3600) / 60),
    seconds: sec % 60,
    done: false,
  };
}

/** Local YYYY-MM-DD for a date, in the runtime's local timezone. */
export function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type LocalDateGroup = { dateKey: string; matches: FixtureMatch[] };

/**
 * Groups matches by their local calendar day (browser TZ via the default keyer),
 * sorted chronologically; matches within a day are time-sorted. `dayKey` is injectable
 * for deterministic testing.
 */
export function groupByLocalDate(
  matches: FixtureMatch[],
  dayKey: (d: Date) => string = localDayKey,
): LocalDateGroup[] {
  const byKey = new Map<string, FixtureMatch[]>();
  for (const m of matches) {
    const key = dayKey(m.kickoffAt);
    (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(m);
  }
  return [...byKey.entries()]
    .map(([dateKey, ms]) => ({
      dateKey,
      matches: ms.sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime()),
    }))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/local-time.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/local-time.ts src/lib/local-time.test.ts
git commit -m "feat: pure timeRemaining + groupByLocalDate helpers"
```

---

## Task 3: `<LocalTime>` client component

**Files:**
- Create: `src/components/local-time.tsx`

> Client/DOM/TZ component — not unit-tested; verified by tsc + build. Mount-guard prevents SSR↔client hydration mismatch.

- [ ] **Step 1: Implement `src/components/local-time.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';

type Fmt = 'time' | 'datetime' | 'dayHeader';

const OPTS: Record<Fmt, Intl.DateTimeFormatOptions> = {
  time: { hour: 'numeric', minute: '2-digit' },
  datetime: { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
  dayHeader: { weekday: 'long', month: 'long', day: 'numeric' },
};

/**
 * Renders a UTC date in the visitor's local timezone. Renders empty on the server / first
 * paint (no local TZ there) and fills in after mount, so hydration never mismatches.
 */
export function LocalTime({ date, format = 'time' }: { date: Date | string; format?: Fmt }) {
  const ms = typeof date === 'string' ? new Date(date).getTime() : date.getTime();
  const [text, setText] = useState('');
  useEffect(() => {
    if (Number.isNaN(ms)) { setText(''); return; }
    setText(new Date(ms).toLocaleString('en-US', OPTS[format])); // no timeZone → browser local
  }, [ms, format]);
  return <span suppressHydrationWarning>{text}</span>;
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/local-time.tsx
git commit -m "feat: LocalTime client component (browser-timezone formatting)"
```

---

## Task 4: `<Countdown>` client component

**Files:**
- Create: `src/components/countdown.tsx`
- Reference: `src/lib/local-time.ts` (`timeRemaining`)

- [ ] **Step 1: Implement `src/components/countdown.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { timeRemaining, type Remaining } from '@/lib/local-time';

function Segment({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-serif text-3xl sm:text-4xl font-bold text-gold tabular-nums">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-cream/70 font-bold">{label}</span>
    </div>
  );
}

/** Live-ticking countdown to a target kickoff. Mount-guard keeps SSR/CSR HTML identical. */
export function Countdown({ target }: { target: Date | string }) {
  const ms = typeof target === 'string' ? new Date(target).getTime() : target.getTime();
  const [r, setR] = useState<Remaining | null>(null);

  useEffect(() => {
    const tick = () => setR(timeRemaining(new Date(ms), new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [ms]);

  if (!r) {
    return <div className="text-center text-cream/70" suppressHydrationWarning>—</div>;
  }
  if (r.done) {
    return <div className="text-center font-serif text-2xl font-bold text-gold">🏆 The tournament is live!</div>;
  }
  return (
    <div className="bg-pitch rounded-xl py-4 grid grid-cols-4 gap-2 max-w-md mx-auto" suppressHydrationWarning>
      <Segment value={r.days} label="Days" />
      <Segment value={r.hours} label="Hrs" />
      <Segment value={r.minutes} label="Min" />
      <Segment value={r.seconds} label="Sec" />
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/countdown.tsx
git commit -m "feat: Countdown client component"
```

---

## Task 5: Local time in fixtures views

**Files:**
- Modify: `src/components/fixtures/match-card.tsx`
- Modify: `src/components/fixtures/calendar-grid.tsx`
- Modify: `src/components/fixtures/timeline.tsx`

- [ ] **Step 1: Update `match-card.tsx` to use `<LocalTime>`**

Replace the entire contents of `src/components/fixtures/match-card.tsx` with:

```tsx
import type { FixtureMatch } from '@/lib/fixtures';
import { PredictionCard } from './prediction-card';
import { LocalTime } from '@/components/local-time';

const TBD = 'TBD';

export function MatchCard({ match, signedIn }: { match: FixtureMatch; signedIn: boolean }) {
  return (
    <div className="rp-card p-3 mb-2">
      <div className="text-[10px] uppercase tracking-wide text-pitch/60 font-bold text-center">
        <LocalTime date={match.kickoffAt} format="datetime" /> · {match.venue?.name ?? TBD}
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

- [ ] **Step 2: Update `calendar-grid.tsx` to a client component with local-day grouping**

Replace the entire contents of `src/components/fixtures/calendar-grid.tsx` with:

```tsx
'use client';
import { groupByLocalDate } from '@/lib/local-time';
import type { FixtureMatch } from '@/lib/fixtures';
import { LocalTime } from '@/components/local-time';
import { MatchCard } from './match-card';

/**
 * Calendar Grid: each local match day as a labeled block. Grouping happens in the browser
 * timezone so days reflect the visitor's local calendar.
 */
export function CalendarGrid({ matches, signedIn }: { matches: FixtureMatch[]; signedIn: boolean }) {
  const groups = groupByLocalDate(matches);
  if (!groups.length) return <p className="rp-card p-4 text-center">No matches scheduled yet.</p>;
  return (
    <div className="grid gap-3">
      {groups.map((g) => (
        <div key={g.dateKey} className="rp-card p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold">
              <LocalTime date={g.matches[0].kickoffAt} format="dayHeader" />
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

- [ ] **Step 3: Update `timeline.tsx` to a client component with local-day grouping**

Replace the entire contents of `src/components/fixtures/timeline.tsx` with:

```tsx
'use client';
import { groupByLocalDate } from '@/lib/local-time';
import type { FixtureMatch } from '@/lib/fixtures';
import { LocalTime } from '@/components/local-time';
import { MatchCard } from './match-card';

export function Timeline({ matches, signedIn }: { matches: FixtureMatch[]; signedIn: boolean }) {
  const groups = groupByLocalDate(matches);
  if (!groups.length) return <p className="rp-card p-4 text-center">No matches.</p>;
  return (
    <div>
      {groups.map((g) => (
        <section key={g.dateKey} className="mb-4">
          <h2 className="font-bold border-b-2 border-pitch pb-1 mb-2 text-cream">
            <LocalTime date={g.matches[0].kickoffAt} format="dayHeader" />
          </h2>
          {g.matches.map((m) => <MatchCard key={m.id} match={m} signedIn={signedIn} />)}
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Verify types, tests, and build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: tsc clean; tests pass; build succeeds (the fixtures route still builds with the now-client calendar/timeline views).

- [ ] **Step 5: Commit**

```bash
git add src/components/fixtures/match-card.tsx src/components/fixtures/calendar-grid.tsx src/components/fixtures/timeline.tsx
git commit -m "feat: render fixture times and day grouping in local timezone"
```

---

## Task 6: Homepage countdown + upcoming teaser

**Files:**
- Modify: `src/app/page.tsx`
- Reference: `src/lib/fixtures.ts` (`getFixtures`), `src/components/countdown.tsx`, `src/components/local-time.tsx`

- [ ] **Step 1: Replace `src/app/page.tsx`**

```tsx
import Link from 'next/link';
import { getFixtures } from '@/lib/fixtures';
import { Countdown } from '@/components/countdown';
import { LocalTime } from '@/components/local-time';

export default async function Home() {
  const all = await getFixtures();
  const now = Date.now();
  const first = all[0];
  const upcoming = all.filter((m) => m.kickoffAt.getTime() >= now).slice(0, 3);

  if (!first) {
    return (
      <div className="rp-card p-6 text-center">
        <h1 className="text-2xl font-bold">⚽ World Cup 2026 Predictor</h1>
        <p className="mt-2">Predict every match, build your bracket, climb the leaderboard.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rp-card p-6 text-center">
        <h1 className="font-serif text-2xl font-bold text-pitch">⚽ World Cup 2026</h1>
        <p className="mt-1 mb-4 text-pitch/70 text-sm">Kicks off with the opening match — get your picks in.</p>
        <Countdown target={first.kickoffAt} />
      </div>

      <div>
        <h2 className="font-bold text-cream mb-2">Next matches</h2>
        <div className="grid gap-2">
          {upcoming.length === 0 ? (
            <p className="rp-card p-4 text-center text-sm">No upcoming matches.</p>
          ) : (
            upcoming.map((m) => (
              <div key={m.id} className="rp-card p-3 flex items-center justify-between text-sm">
                <span className="font-bold">
                  {m.home ? m.home.code : 'TBD'} <span className="text-pitch/50">vs</span> {m.away ? m.away.code : 'TBD'}
                </span>
                <span className="text-pitch/70 text-xs">
                  <LocalTime date={m.kickoffAt} format="datetime" />
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <Link
        href="/fixtures"
        className="bg-pitch text-cream rounded-lg py-3 text-center font-bold hover:bg-pitch/90"
      >
        See all fixtures & predict →
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Verify types and build**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc clean; build succeeds; `/` builds (dynamic, since it reads the DB).

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: homepage countdown + upcoming matches teaser"
```

---

## Task 7: Real WC2026 fixture data + reset script + shape test

**Files:**
- Create: `src/db/reset.ts`
- Modify: `package.json` (add `db:reset`)
- Create: `src/db/seed-content.test.ts`
- Replace: `data/seed.json`
- Reference: `src/db/seed.ts`, `src/db/seed-data.ts`

> The data is researched real-world content, not code. Write the shape test FIRST (it fails against the 3-match stub), then populate `data/seed.json` until it passes. The test is the integrity guardrail; correctness of specific times/venues is best-effort and admin-correctable.

- [ ] **Step 1: Add the `db:reset` script to `package.json`**

Add to the `scripts` block (after `db:seed`):
```json
    "db:reset": "tsx src/db/reset.ts && tsx src/db/seed.ts"
```

- [ ] **Step 2: Create `src/db/reset.ts`**

```ts
import { sql } from 'drizzle-orm';
import { db } from './index';

/** Truncates all data tables (CASCADE) so the seed can load a clean slate. */
async function main() {
  await db.execute(sql`
    TRUNCATE TABLE
      match_predictions, bracket_predictions, award_predictions,
      matches, players, teams, venues, app_settings
    RESTART IDENTITY CASCADE
  `);
  console.log('Reset: truncated all data tables.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 3: Write the failing shape test at `src/db/seed-content.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { parseSeed } from './seed-data';
import raw from '../../data/seed.json';

const seed = parseSeed(raw);

describe('data/seed.json — full WC2026 dataset', () => {
  it('has 48 teams with unique codes', () => {
    expect(seed.teams).toHaveLength(48);
    expect(new Set(seed.teams.map((t) => t.code)).size).toBe(48);
  });
  it('has 16 venues', () => {
    expect(seed.venues).toHaveLength(16);
  });
  it('has 104 matches with unique externalIds', () => {
    expect(seed.matches).toHaveLength(104);
    expect(new Set(seed.matches.map((m) => m.externalId)).size).toBe(104);
  });
  it('has 72 group matches, each with both team codes set', () => {
    const group = seed.matches.filter((m) => m.stage === 'group');
    expect(group).toHaveLength(72);
    for (const m of group) {
      expect(m.homeTeamCode).not.toBeNull();
      expect(m.awayTeamCode).not.toBeNull();
    }
  });
  it('has 32 knockout matches across r32/r16/qf/sf/third/final', () => {
    const ko = seed.matches.filter((m) => m.stage !== 'group');
    expect(ko).toHaveLength(32);
    const counts = ko.reduce<Record<string, number>>((a, m) => ((a[m.stage] = (a[m.stage] ?? 0) + 1), a), {});
    expect(counts).toEqual({ r32: 16, r16: 8, qf: 4, sf: 2, third: 1, final: 1 });
  });
  it('every match has a valid kickoff date and known stage', () => {
    const stages = new Set(['group', 'r32', 'r16', 'qf', 'sf', 'third', 'final']);
    for (const m of seed.matches) {
      expect(stages.has(m.stage)).toBe(true);
      expect(Number.isNaN(new Date(m.kickoffAt).getTime())).toBe(false);
    }
  });
  it('assigns every non-placeholder group A–L', () => {
    const groups = new Set(seed.teams.map((t) => t.groupName).filter(Boolean));
    expect([...groups].sort().join('')).toBe('ABCDEFGHIJKL');
  });
});
```

Note: this requires JSON module imports. If `npx vitest run src/db/seed-content.test.ts` errors on the JSON import, add `"resolveJsonModule": true` to `tsconfig.json`'s `compilerOptions` (Next's tsconfig usually has it; add if missing).

- [ ] **Step 4: Run the test to confirm it fails against the stub**

Run: `npx vitest run src/db/seed-content.test.ts`
Expected: FAIL — the current stub has 3 teams / 3 matches, so the count assertions fail.

- [ ] **Step 5: Research and build the real dataset**

Use `WebSearch`/`WebFetch` to gather the official FIFA World Cup 2026 schedule from the December 2025 final draw. Collect:
- The **12 groups (A–L)** and their 48 entrants. Where a slot is an unresolved playoff path (UEFA play-off winners, intercontinental play-off winners), create a placeholder team with a unique `code` (e.g. `UPA`, `ICP1`), a descriptive `name` (e.g. "UEFA Play-off A"), and the `groupName` it was drawn into.
- The **16 host venues** (name, city, country).
- All **104 matches**: stage, group (for group matches), the two team codes (null for knockout TBD), venue name, and kickoff time converted to **UTC ISO** (`...Z`).

Cross-check the totals against the shape test (48 / 16 / 104; 72 group with both codes; 16/8/4/2/1/1 knockout). Use stable `externalId`s: `gNN` for group matches (`g01`…`g72`), `r32-1`…`r32-16`, `r16-1`…`r16-8`, `qf-1`…`qf-4`, `sf-1`/`sf-2`, `third`, `final`.

Write the assembled data to `data/seed.json` in the existing shape (keys: `venues`, `teams`, `matches`; teams include `squad: []`). Every `venueName` in matches must match a `venues[].name`; every non-null team code must match a `teams[].code` (parseSeed enforces this).

- [ ] **Step 6: Run the shape test until it passes**

Run: `npx vitest run src/db/seed-content.test.ts`
Expected: PASS (all assertions). Fix the data (not the test) until green.

- [ ] **Step 7: Load the data into the DB**

Run: `npm run db:reset`
Expected: "Reset: truncated all data tables." then the seed logs "Seeded 16 venues, 48 teams, 104 matches." (counts reflect the real data). Exits 0.

- [ ] **Step 8: Full verification**

Run: `npm test && npm run build`
Expected: all tests pass (incl. the new shape test); build succeeds.

- [ ] **Step 9: Commit**

```bash
git add package.json src/db/reset.ts src/db/seed-content.test.ts data/seed.json
git commit -m "feat: load full WC2026 schedule (48 teams, 104 matches) + db:reset"
```

---

## Task 8: Docs + manual verification + push

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Document in `CLAUDE.md`**

- In the **Seed** bullet (under Stack & key conventions), add: `Full WC2026 schedule (48 teams, 16 venues, 104 matches incl. third-place) lives in data/seed.json. \`npm run db:reset\` truncates all data tables then reseeds (clean slate; wipes predictions — pre-launch only).`
- In the **Commands** section, add `npm run db:reset` next to `npm run db:seed`.
- Add a one-line note: times render in the visitor's local timezone via the `<LocalTime>` client component; the homepage shows a live `<Countdown>` to the first kickoff.

- [ ] **Step 2: Manual smoke test**

Run `npm run dev`:
- **Homepage** shows the countdown ticking every second and a "Next matches" list with local times; CTA links to `/fixtures`.
- **`/fixtures`** (Calendar + Timeline): day headers and kickoff times reflect your local timezone. To confirm the TZ shift, open Chrome DevTools → ⋮ → More tools → **Sensors** → Location/!**Override timezone** to e.g. `Asia/Dhaka`, reload, and verify times shift by +6 and any near-midnight match moves to the expected local day.
- **Stage view** shows the new **3rd Place** section once knockout matches exist.

- [ ] **Step 3: Commit docs**

```bash
git add CLAUDE.md
git commit -m "docs: document db:reset, local time, and homepage countdown"
```

- [ ] **Step 4: Push**

```bash
git push origin main
```
Expected: push succeeds; Vercel auto-deploys. (Production already has the DB; run `npm run db:reset` against the prod DATABASE_URL once, or load the data via your preferred path, so prod shows the real fixtures.)

---

## Self-review notes

- **Spec coverage:** `third` stage + migration (T1) · `timeRemaining` & local-day grouping (T2) · `<LocalTime>` (T3) · `<Countdown>` (T4) · local time in match-card/calendar/timeline incl. local day grouping (T5) · homepage countdown + teaser + empty fallback (T6) · full 48/16/104 dataset + reset-then-seed + shape test (T7) · docs + manual TZ verification (T8). All spec parts (A/B/C) map to tasks.
- **Placeholder scan:** the only non-literal content is `data/seed.json`'s values in T7 — intentionally researched, with a concrete shape test as the guardrail and explicit structure/externalId/integrity rules. All code steps contain complete code.
- **Type consistency:** `Stage`/`STAGE_ORDER`/`SeedMatch.stage`/`stageEnum`/`STAGE_LABEL` all gain `'third'` (T1). `Remaining`, `timeRemaining`, `localDayKey`, `groupByLocalDate`, `LocalDateGroup` (T2) are referenced by name in T3/T4/T5/T6. `<LocalTime>` props (`date`, `format`) and `<Countdown>` prop (`target`) are used consistently across T5/T6.
