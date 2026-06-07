# Fixtures Page Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the confusing three-view `/fixtures` page with a sports-app-style hybrid — a default **By Day** date-strip plus a **By Stage** hub — using compact, pick-forward match rows that tap through to `/match/[id]`.

**Architecture:** The page stays a server component (auth + `getFixtures`). A new client `FixturesView` orchestrates a segmented By Day / By Stage switch, holding mode/day/stage in React state synced to the URL via the History API (all matches are already loaded client-side, so switching never refetches). Two new pure, unit-tested selectors drive defaults and row presentation. No schema or data-layer changes.

**Tech Stack:** Next.js 16 (App Router), React client components, Tailwind v4 (`@theme` tokens + `rp-*` utilities), Vitest, lucide-react icons. Retro Pitch Arcade design system (`src/components/retro/`).

---

## File structure

**Create:**
- `src/components/fixtures/match-row.tsx` — compact pick-forward row (whole row links to `/match/[id]`).
- `src/components/fixtures/date-strip.tsx` — horizontal scrollable day picker.
- `src/components/fixtures/fixtures-view.tsx` — client orchestrator (mode switch + By Day panel).

**Modify:**
- `src/lib/local-time.ts` — add `pickDefaultDay` selector.
- `src/lib/fixtures.ts` — add `RowState` type + `predictionRowState` selector.
- `src/components/fixtures/stage-nav.tsx` — rework into the `StageBoard` By-Stage panel (sub-tabs + `MatchRow`).
- `src/app/fixtures/page.tsx` — render `FixturesView` instead of the old toggle/views.

**Test:**
- `src/lib/local-time.test.ts` — add `pickDefaultDay` cases.
- `src/lib/fixtures.test.ts` — add `predictionRowState` cases.

**Delete (redundant under the new model):**
- `src/components/fixtures/calendar-grid.tsx`
- `src/components/fixtures/timeline.tsx`
- `src/components/fixtures/view-toggle.tsx`
- `src/components/fixtures/filters.tsx`
- `src/components/fixtures/match-card.tsx`
- `src/components/fixtures/prediction-card.tsx`

(`src/app/fixtures/actions.ts` `savePrediction` stays — used by `/match/[id]`.)

---

## Task 1: `pickDefaultDay` selector (TDD)

**Files:**
- Modify: `src/lib/local-time.ts`
- Test: `src/lib/local-time.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to the end of `src/lib/local-time.test.ts` (and add `pickDefaultDay` to the existing import from `./local-time` at the top of the file):

```typescript
describe('pickDefaultDay', () => {
  const groups = (...keys: string[]) =>
    keys.map((dateKey) => ({ dateKey, matches: [] }));
  const at = (key: string) => () => key; // deterministic dayKey for `now`

  it('returns null when there are no match days', () => {
    expect(pickDefaultDay([], new Date('2026-06-07T00:00:00Z'), at('2026-06-07'))).toBeNull();
  });

  it('before the tournament, defaults to the first match day', () => {
    const g = groups('2026-06-11', '2026-06-12', '2026-06-13');
    expect(pickDefaultDay(g, new Date('2026-06-07T00:00:00Z'), at('2026-06-07'))).toBe('2026-06-11');
  });

  it('during the tournament, defaults to today when today has matches', () => {
    const g = groups('2026-06-11', '2026-06-12', '2026-06-13');
    expect(pickDefaultDay(g, new Date('2026-06-12T09:00:00Z'), at('2026-06-12'))).toBe('2026-06-12');
  });

  it('during the tournament with no matches today, defaults to the next match day', () => {
    const g = groups('2026-06-11', '2026-06-13', '2026-06-15');
    expect(pickDefaultDay(g, new Date('2026-06-12T09:00:00Z'), at('2026-06-12'))).toBe('2026-06-13');
  });

  it('after the last match day, defaults to the last match day', () => {
    const g = groups('2026-06-11', '2026-06-12');
    expect(pickDefaultDay(g, new Date('2026-07-20T00:00:00Z'), at('2026-07-20'))).toBe('2026-06-12');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/local-time.test.ts`
Expected: FAIL — `pickDefaultDay is not a function` / not exported.

- [ ] **Step 3: Implement the selector**

Append to `src/lib/local-time.ts`:

```typescript
/**
 * Chooses which date-strip day to select by default. `now` is mapped to a day key via the
 * same `dayKey` used for grouping (injectable for deterministic tests). Rules: today if it
 * has matches; otherwise the next match day; otherwise (now is past the last day) the last
 * match day. Returns null when there are no match days.
 */
export function pickDefaultDay(
  groups: LocalDateGroup[],
  now: Date,
  dayKey: (d: Date) => string = localDayKey,
): string | null {
  if (groups.length === 0) return null;
  const todayKey = dayKey(now);
  const today = groups.find((g) => g.dateKey === todayKey);
  if (today) return today.dateKey;
  const next = groups.find((g) => g.dateKey > todayKey);
  if (next) return next.dateKey;
  return groups[groups.length - 1].dateKey;
}
```

(`groupByLocalDate` already returns groups sorted ascending by `dateKey`, so `.find` for the first `> todayKey` yields the earliest future day.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/local-time.test.ts`
Expected: PASS (all `pickDefaultDay` cases plus existing cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/local-time.ts src/lib/local-time.test.ts
git commit -m "feat(fixtures): pickDefaultDay selector for date-strip default day"
```

---

## Task 2: `predictionRowState` selector (TDD)

**Files:**
- Modify: `src/lib/fixtures.ts`
- Test: `src/lib/fixtures.test.ts`

- [ ] **Step 1: Write the failing tests**

Look at the top of `src/lib/fixtures.test.ts` for the existing `FixtureMatch` factory (a `mk`/`makeMatch`-style helper). Add a new `describe` block. If no factory exists, use this self-contained one:

```typescript
import { predictionRowState, type FixtureMatch } from './fixtures';

const base = (over: Partial<FixtureMatch> = {}): FixtureMatch => ({
  id: 'm1', externalId: 'm1', stage: 'group', groupName: 'A',
  kickoffAt: new Date('2026-06-11T18:00:00Z'), status: 'scheduled',
  home: null, away: null, venue: null,
  homeScore: null, awayScore: null, prediction: null, locked: false,
  ...over,
});

describe('predictionRowState', () => {
  it('open + no prediction → predict', () => {
    expect(predictionRowState(base())).toEqual({ kind: 'predict' });
  });

  it('open + prediction → picked with scoreline', () => {
    const m = base({ prediction: { homeScore: 2, awayScore: 1, pointsAwarded: null } });
    expect(predictionRowState(m)).toEqual({ kind: 'picked', pick: '2–1' });
  });

  it('locked + no prediction → locked', () => {
    expect(predictionRowState(base({ locked: true }))).toEqual({ kind: 'locked' });
  });

  it('locked + prediction → picked', () => {
    const m = base({ locked: true, prediction: { homeScore: 0, awayScore: 0, pointsAwarded: null } });
    expect(predictionRowState(m)).toEqual({ kind: 'picked', pick: '0–0' });
  });

  it('finished with pick + points → finished score/pick/points', () => {
    const m = base({
      status: 'finished', locked: true, homeScore: 2, awayScore: 1,
      prediction: { homeScore: 2, awayScore: 1, pointsAwarded: 3 },
    });
    expect(predictionRowState(m)).toEqual({ kind: 'finished', score: '2–1', pick: '2–1', points: 3 });
  });

  it('finished without a pick → finished, no pick, no points', () => {
    const m = base({ status: 'finished', locked: true, homeScore: 0, awayScore: 0 });
    expect(predictionRowState(m)).toEqual({ kind: 'finished', score: '0–0', pick: null, points: null });
  });

  it('live → live with current score and pick', () => {
    const m = base({
      status: 'live', homeScore: 1, awayScore: 0,
      prediction: { homeScore: 2, awayScore: 0, pointsAwarded: null },
    });
    expect(predictionRowState(m)).toEqual({ kind: 'live', score: '1–0', pick: '2–0' });
  });
});
```

(Use the file's existing import style — merge `predictionRowState` into the current `from './fixtures'` import rather than adding a duplicate line.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/fixtures.test.ts`
Expected: FAIL — `predictionRowState is not a function` / not exported.

- [ ] **Step 3: Implement the selector**

Append to `src/lib/fixtures.ts` (after the existing exports). Note the score separator is an en dash `–` (U+2013), matching the rest of the app:

```typescript
export type RowState =
  | { kind: 'predict' }
  | { kind: 'picked'; pick: string }
  | { kind: 'locked' }
  | { kind: 'live'; score: string; pick: string | null }
  | { kind: 'finished'; score: string; pick: string | null; points: number | null };

/** Maps a fixture to how its compact row should present the user's prediction state. */
export function predictionRowState(m: FixtureMatch): RowState {
  const pick = m.prediction ? `${m.prediction.homeScore}–${m.prediction.awayScore}` : null;
  if (m.status === 'finished') {
    return {
      kind: 'finished',
      score: `${m.homeScore ?? 0}–${m.awayScore ?? 0}`,
      pick,
      points: m.prediction?.pointsAwarded ?? null,
    };
  }
  if (m.status === 'live') {
    return { kind: 'live', score: `${m.homeScore ?? 0}–${m.awayScore ?? 0}`, pick };
  }
  if (pick) return { kind: 'picked', pick };
  if (m.locked) return { kind: 'locked' };
  return { kind: 'predict' };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/fixtures.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/fixtures.ts src/lib/fixtures.test.ts
git commit -m "feat(fixtures): predictionRowState selector for compact match rows"
```

---

## Task 3: `MatchRow` component

**Files:**
- Create: `src/components/fixtures/match-row.tsx`

UI component — no unit test; verified via `npm run build` + `npm run lint` in Task 7. The entire row is a single `Link`, so team flag/code render as **plain content** (no `TeamLink`) to avoid nested anchors.

- [ ] **Step 1: Write the component**

Create `src/components/fixtures/match-row.tsx`:

```tsx
import Link from 'next/link';
import { ChevronRight, Lock } from 'lucide-react';
import type { FixtureMatch, RowState } from '@/lib/fixtures';
import { predictionRowState } from '@/lib/fixtures';
import { BadgeFlag } from '@/components/retro/badge-flag';
import { LocalTime } from '@/components/local-time';

const TBD = 'TBD';

function Chip({ state }: { state: RowState }) {
  switch (state.kind) {
    case 'predict':
      return <span className="shrink-0 border-2 border-ink bg-alert text-cream rounded-full px-2 py-0.5 text-[10px] font-display">PREDICT</span>;
    case 'picked':
      return <span className="rp-tag shrink-0 text-[10px]">YOU {state.pick}</span>;
    case 'locked':
      return <span className="shrink-0 inline-flex items-center gap-1 bg-ink text-chalk rounded-full px-2 py-0.5 text-[10px] font-display"><Lock size={10} />LOCKED</span>;
    case 'live':
      return <span className="shrink-0 bg-alert text-cream rounded-full px-2 py-0.5 text-[10px] font-display">LIVE</span>;
    case 'finished':
      return (
        <span className="shrink-0 flex items-center gap-1">
          {state.pick
            ? <span className="rp-tag text-[10px]">YOU {state.pick}</span>
            : <span className="bg-ink text-chalk rounded-full px-2 py-0.5 text-[10px] font-display">no pick</span>}
          {state.points != null && (
            <span className="border-2 border-ink bg-chalk text-ink rounded px-1.5 text-[10px] font-display">+{state.points}</span>
          )}
        </span>
      );
  }
}

export function MatchRow({ match }: { match: FixtureMatch }) {
  const state = predictionRowState(match);
  const showScore = state.kind === 'finished' || state.kind === 'live';
  return (
    <Link
      href={`/match/${match.id}`}
      className="rp-card rp-hover-lift flex items-center gap-2 p-2 mb-1.5 no-underline"
    >
      <span className="shrink-0 w-12 text-center leading-none font-pixel text-base text-pitch/70">
        {match.status === 'finished'
          ? 'FT'
          : match.status === 'live'
            ? <span className="text-alert">LIVE</span>
            : <LocalTime date={match.kickoffAt} format="time" />}
      </span>

      <div className="flex-1 min-w-0 flex items-center justify-between gap-2 font-display text-xs text-pitch">
        <span className="flex items-center gap-1.5 min-w-0">
          {match.home
            ? <><BadgeFlag flag={match.home.flag} code={match.home.code} size="sm" />{match.home.code}</>
            : TBD}
        </span>
        {showScore
          ? <span className="font-pixel text-base bg-ink text-gold rounded px-2">{state.score}</span>
          : <span className="font-pixel text-pitch/50">vs</span>}
        <span className="flex items-center gap-1.5 min-w-0 justify-end">
          {match.away
            ? <>{match.away.code}<BadgeFlag flag={match.away.flag} code={match.away.code} size="sm" /></>
            : TBD}
        </span>
      </div>

      <Chip state={state} />
      <ChevronRight size={16} className="shrink-0 text-pitch/50" />
    </Link>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/fixtures/match-row.tsx
git commit -m "feat(fixtures): MatchRow — compact pick-forward row linking to /match/[id]"
```

---

## Task 4: `DateStrip` component

**Files:**
- Create: `src/components/fixtures/date-strip.tsx`

Presentational client component. Labels are parsed straight from the `dateKey` string (`YYYY-MM-DD`, already local) to avoid timezone re-derivation.

- [ ] **Step 1: Write the component**

Create `src/components/fixtures/date-strip.tsx`:

```tsx
'use client';
import type { LocalDateGroup } from '@/lib/local-time';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function label(dateKey: string) {
  const [, mm, dd] = dateKey.split('-');
  return { mon: MONTHS[Number(mm) - 1] ?? '', day: String(Number(dd)) };
}

export function DateStrip({
  groups, selected, onSelect,
}: {
  groups: LocalDateGroup[];
  selected: string | null;
  onSelect: (dateKey: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
      {groups.map((g) => {
        const { mon, day } = label(g.dateKey);
        const on = g.dateKey === selected;
        return (
          <button
            key={g.dateKey}
            type="button"
            onClick={() => onSelect(g.dateKey)}
            className={`shrink-0 rounded-lg border-[3px] border-ink px-3 py-1 text-center leading-tight rp-shadow-sm font-display ${on ? 'bg-gold text-pitch' : 'bg-cream text-pitch'}`}
          >
            <span className="block text-[10px]">{mon}</span>
            <span className="block font-pixel text-xl">{day}</span>
            <span className="block text-[10px] opacity-70">{g.matches.length}</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/fixtures/date-strip.tsx
git commit -m "feat(fixtures): DateStrip — horizontal scrollable match-day picker"
```

---

## Task 5: Rework `stage-nav.tsx` into `StageBoard`

**Files:**
- Modify (full rewrite): `src/components/fixtures/stage-nav.tsx`

Becomes a client component with its own stage sub-tabs, rendering `MatchRow`. Only tabs that actually have matches are shown.

- [ ] **Step 1: Rewrite the file**

Replace the entire contents of `src/components/fixtures/stage-nav.tsx` with:

```tsx
'use client';
import { useState } from 'react';
import { groupByStage, groupByGroup, type FixtureMatch } from '@/lib/fixtures';
import { MatchRow } from './match-row';

const STAGE_LABEL: Record<string, string> = {
  group: 'Group Stage', r32: 'Round of 32', r16: 'Round of 16',
  qf: 'Quarter-finals', sf: 'Semi-finals', third: '3rd Place', final: 'Final',
};

const TABS: { key: string; short: string }[] = [
  { key: 'group', short: 'Groups' }, { key: 'r32', short: 'R32' }, { key: 'r16', short: 'R16' },
  { key: 'qf', short: 'QF' }, { key: 'sf', short: 'SF' }, { key: 'third', short: '3rd' }, { key: 'final', short: 'Final' },
];

export function StageBoard({
  matches, initialStage,
}: { matches: FixtureMatch[]; initialStage?: string }) {
  const stages = groupByStage(matches);
  const available = TABS.filter((t) => stages.some((s) => s.stage === t.key));
  const [active, setActive] = useState<string>(
    initialStage && available.some((t) => t.key === initialStage)
      ? initialStage
      : (available[0]?.key ?? 'group'),
  );

  const select = (key: string) => {
    setActive(key);
    const params = new URLSearchParams(window.location.search);
    params.set('view', 'stage');
    params.set('stage', key);
    window.history.replaceState(null, '', `?${params.toString()}`);
  };

  const current = stages.find((s) => s.stage === active);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {available.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => select(t.key)}
            className={`rounded border-2 border-ink px-2.5 py-0.5 text-xs font-display ${active === t.key ? 'bg-gold text-pitch' : 'bg-cream text-pitch'}`}
          >
            {t.short}
          </button>
        ))}
      </div>

      {!current ? (
        <p className="rp-card p-4 text-center">No matches.</p>
      ) : current.stage === 'group' ? (
        groupByGroup(current.matches).map((g) => (
          <section key={g.groupName}>
            <h3 className="mb-1.5 font-display text-sm text-cream">Group {g.groupName}</h3>
            {g.matches.map((m) => <MatchRow key={m.id} match={m} />)}
          </section>
        ))
      ) : (
        <section>
          <h2 className="mb-2 font-display text-lg text-cream">{STAGE_LABEL[current.stage] ?? current.stage}</h2>
          {current.matches.map((m) => <MatchRow key={m.id} match={m} />)}
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/fixtures/stage-nav.tsx
git commit -m "refactor(fixtures): stage-nav → StageBoard panel (sub-tabs + MatchRow)"
```

---

## Task 6: `FixturesView` orchestrator

**Files:**
- Create: `src/components/fixtures/fixtures-view.tsx`

Client orchestrator. Holds mode + selected day in state (initialized from URL params), syncs to the URL with the History API so switching tabs never triggers a server refetch (all matches are already loaded).

- [ ] **Step 1: Write the component**

Create `src/components/fixtures/fixtures-view.tsx`:

```tsx
'use client';
import { useMemo, useState } from 'react';
import type { FixtureMatch } from '@/lib/fixtures';
import { groupByLocalDate, pickDefaultDay } from '@/lib/local-time';
import { LocalTime } from '@/components/local-time';
import { DateStrip } from './date-strip';
import { MatchRow } from './match-row';
import { StageBoard } from './stage-nav';

type Mode = 'day' | 'stage';

export function FixturesView({
  matches, initialView, initialDay, initialStage,
}: {
  matches: FixtureMatch[];
  initialView: Mode;
  initialDay?: string;
  initialStage?: string;
}) {
  const dayGroups = useMemo(() => groupByLocalDate(matches), [matches]);
  const defaultDay = useMemo(() => pickDefaultDay(dayGroups, new Date()), [dayGroups]);

  const [mode, setMode] = useState<Mode>(initialView);
  const [day, setDay] = useState<string | null>(initialDay ?? defaultDay);

  const syncUrl = (patch: Record<string, string>) => {
    const params = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    window.history.replaceState(null, '', `?${params.toString()}`);
  };

  const selectMode = (m: Mode) => { setMode(m); syncUrl({ view: m }); };
  const selectDay = (key: string) => { setDay(key); syncUrl({ view: 'day', day: key }); };

  const current = dayGroups.find((g) => g.dateKey === day)
    ?? dayGroups.find((g) => g.dateKey === defaultDay)
    ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {(['day', 'stage'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => selectMode(m)}
            className={`rounded-lg border-[3px] border-ink px-4 py-1 text-sm rp-shadow-sm font-display ${mode === m ? 'bg-gold text-pitch' : 'bg-cream text-pitch'}`}
          >
            {m === 'day' ? 'By Day' : 'By Stage'}
          </button>
        ))}
      </div>

      {mode === 'day' ? (
        dayGroups.length === 0 ? (
          <p className="rp-card p-4 text-center">No matches scheduled yet.</p>
        ) : (
          <>
            <DateStrip groups={dayGroups} selected={current?.dateKey ?? null} onSelect={selectDay} />
            {current && current.dateKey !== defaultDay && defaultDay && (
              <button
                type="button"
                onClick={() => selectDay(defaultDay)}
                className="self-start rp-tag text-xs"
              >
                ↩ Today / Next
              </button>
            )}
            <div>
              {current && (
                <h2 className="mb-2 font-display text-sm text-cream">
                  <LocalTime date={current.matches[0].kickoffAt} format="dayHeader" />
                </h2>
              )}
              {current?.matches.map((m) => <MatchRow key={m.id} match={m} />)}
            </div>
          </>
        )
      ) : (
        <StageBoard matches={matches} initialStage={initialStage} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/fixtures/fixtures-view.tsx
git commit -m "feat(fixtures): FixturesView orchestrator (By Day / By Stage hybrid)"
```

---

## Task 7: Rewrite `page.tsx` + delete redundant files

**Files:**
- Modify (rewrite): `src/app/fixtures/page.tsx`
- Delete: `calendar-grid.tsx`, `timeline.tsx`, `view-toggle.tsx`, `filters.tsx`, `match-card.tsx`, `prediction-card.tsx` (all under `src/components/fixtures/`)

- [ ] **Step 1: Rewrite the page**

Replace the entire contents of `src/app/fixtures/page.tsx` with:

```tsx
import { createClient } from '@/lib/supabase/server';
import { getFixtures } from '@/lib/fixtures';
import { getUserPredictionMap } from '@/lib/predictions';
import { FixturesView } from '@/components/fixtures/fixtures-view';

export default async function FixturesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; day?: string; stage?: string }>;
}) {
  const sp = await searchParams;
  const view = sp.view === 'stage' ? 'stage' : 'day';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const predictionMap = user ? await getUserPredictionMap(user.id) : undefined;
  const matches = await getFixtures(predictionMap);

  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold text-cream">Fixtures</h1>
      <FixturesView matches={matches} initialView={view} initialDay={sp.day} initialStage={sp.stage} />
    </div>
  );
}
```

- [ ] **Step 2: Delete the redundant components**

```bash
git rm src/components/fixtures/calendar-grid.tsx \
       src/components/fixtures/timeline.tsx \
       src/components/fixtures/view-toggle.tsx \
       src/components/fixtures/filters.tsx \
       src/components/fixtures/match-card.tsx \
       src/components/fixtures/prediction-card.tsx
```

- [ ] **Step 3: Verify nothing else imports the deleted files**

Run: `grep -rn "calendar-grid\|timeline\|view-toggle\|/filters\|match-card\|prediction-card\|CalendarGrid\|Timeline\|ViewToggle\|MatchCard\|PredictionCard" src`
Expected: NO results (the only references were inside the deleted files and the old `page.tsx`). If anything remains, fix that importer to use `MatchRow`/`FixturesView` before continuing.

- [ ] **Step 4: Commit**

```bash
git add src/app/fixtures/page.tsx
git commit -m "feat(fixtures): render FixturesView; remove redundant views + inline prediction card"
```

---

## Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS (existing suites + new `pickDefaultDay` / `predictionRowState` cases).

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors. (Watch for unused imports in the rewritten `page.tsx` — `signedIn`/`getUserPredictionMap` are still used; the old `Filters`/`StageNav`/`ViewToggle`/`Timeline`/`CalendarGrid` imports must be gone.)

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds; `/fixtures` and `/match/[id]` compile. No "module not found" for deleted files.

- [ ] **Step 4: Manual smoke check**

Run: `npm run dev`, then visit `/fixtures`:
- Defaults to **By Day** on the first match day (today is 2026-06-07, pre-tournament → Jun 11).
- The date strip scrolls; selecting a day swaps the rows and updates the URL `?view=day&day=…`.
- Rows are compact; open matches show a red `PREDICT` chip (signed in) and tap through to `/match/[id]`.
- Switch to **By Stage** → group sub-tabs appear; "Groups" lists Group A–L with rows; URL shows `?view=stage&stage=group`.
- Predicted/locked/finished matches (use admin or an existing pick) show `YOU h–a` / `LOCKED` / result + `+pts` chips.

- [ ] **Step 5: Final commit (if any cleanup was needed)**

```bash
git add -A
git commit -m "chore(fixtures): verification cleanup" || echo "nothing to commit"
```

---

## Self-review notes

- **Spec coverage:** hybrid By Day/By Stage (Tasks 6, 5) ✓; date strip + defaults (Tasks 1, 4, 6) ✓; pick-forward rows with all chip states (Tasks 2, 3) ✓; tap-to-open `/match/[id]` (Task 3) ✓; removal of Calendar/Timeline/inline prediction + retired Filters (Task 7) ✓; URL state (Tasks 5, 6) ✓; no schema/data-layer change ✓; nested-anchor avoidance — rows render plain team content, not `TeamLink` (Task 3) ✓; TDD selectors (Tasks 1, 2) ✓.
- **Type consistency:** `RowState` defined in `src/lib/fixtures.ts` (Task 2) and imported by `MatchRow` (Task 3); `pickDefaultDay`/`predictionRowState`/`StageBoard`/`DateStrip`/`FixturesView`/`MatchRow` names are used identically across tasks. `StageBoard` (new export) replaces the old `StageNav`; the old name is fully removed in Task 7's grep.
- **Placeholders:** none — every code step shows complete content.
```
