# Fixtures Page Rework — Design

**Date:** 2026-06-07
**Status:** Approved (brainstorming)
**Topic:** Rework `/fixtures` into a sports-app-style browser in the Retro Pitch Arcade look.

## Problem

The current `/fixtures` page is confusing:

- **Redundant views.** A three-way toggle offers Calendar / Timeline / Stages, but Calendar
  and Timeline both group matches by local date — they are nearly the same screen with
  different styling. Only "Stages" is genuinely distinct.
- **Heavy, tall rows.** Every match is a full `MatchCard` with the inline `PredictionCard`
  embedded (score steppers + quick-scoreline chips + Save button). Scrolling 104 matches
  means scrolling 104 prediction widgets, even though a dedicated `/match/[id]` predict page
  already does this better (lock countdown, circle-% reveal, next-unpredicted loop).

Real sports apps (FotMob, ESPN, OneFootball, the FIFA app) instead use a horizontal **date
strip**, **compact match rows**, and tap-to-open detail. We adopt that model, adapted for a
prediction game and rendered in the existing retro design system.

## Goals

- One coherent navigation model, no overlapping views.
- Compact, scannable match rows that surface **prediction state** at a glance (this is a
  prediction game, not just a scores app).
- Reuse the dedicated `/match/[id]` page for actual predicting — no inline prediction widgets
  in the list.
- No schema or data-layer changes; pure presentational rework plus small tested selectors.

## Non-goals

- No changes to `getFixtures()` queries, the DB schema, or the `/match/[id]` predict flow.
- No bracket visualisation (that is Phase 4 `/bracket`).
- No standings here — `/table` already owns group standings.

## Design

### Navigation model — hybrid (approved option C)

The `/fixtures` page keeps its server-component shell (auth + `getFixtures`/prediction-map
fetch). The body becomes a client view with two modes selected by a segmented control:

- **By Day** (default): a horizontal, scrollable **date strip** of match days; selecting a
  day shows that day's matches as compact rows.
- **By Stage**: stage sub-tabs (Groups / R32 / R16 / QF / SF / 3rd / Final). "Groups" lists
  each group A–L with its rows; knockout stages list their rows directly.

Mode and selected day/stage are held in the URL search params so state is shareable and
back-button friendly, matching the existing pattern:

- `?view=day&day=YYYY-MM-DD`
- `?view=stage&stage=group|r32|r16|qf|sf|third|final`

`day` is a local-date key (visitor timezone) produced by the existing `groupByLocalDate`
helper.

### Match row — pick-forward (approved option B)

A new compact `MatchRow` replaces `MatchCard` in all lists. The entire row is a `Link` to
`/match/[id]`. Layout:

- **Left:** kickoff time in local tz, or `FT` (finished) / `LIVE` (in progress).
- **Middle:** home flag + code · score-or-`vs` · away code + flag.
- **Right:** a single prediction-state chip, then a chevron.

Chip / center states (see `predictionRowState` below):

| Match state                | Center            | Chip(s)                          |
|----------------------------|-------------------|----------------------------------|
| Open, not predicted        | `vs`              | red `PREDICT`                    |
| Open or locked, predicted  | `vs`              | gold `YOU h–a`                   |
| Locked, not predicted      | `vs`              | ink `🔒 LOCKED`                  |
| Finished                   | real score `2–1` | gold `YOU h–a` + `+pts` (if any) |
| Finished, no pick          | real score `2–1` | ink `no pick`                    |
| Live                       | current score     | red `LIVE` pill                  |

No steppers, no Save button in the list — predicting happens on `/match/[id]`. Real result
(`FT`) and the user's pick are distinct and both shown when finished. Styled with retro
tokens (`rp-*`, Bungee/VT323/Nunito, ink offset-shadow); reuse `BadgeFlag`, `StatusPill`,
`TeamLink`. The `LIVE` pulse and any motion are gated by `prefers-reduced-motion`.

> Note: `TeamLink` currently wraps the country in an anchor. Because the whole row is also a
> `Link`, the row must avoid nested anchors — render team flag+code as plain (non-link)
> content inside the row, since the row itself navigates to the match. Per-team navigation to
> `/team/[code]` remains available from the match/group/team pages that already use
> `TeamLink`.

### Date strip & defaults

A `DateStrip` client component built on `groupByLocalDate`. Each day is a sticker tab showing
month + day number and a match count. Selected day = gold fill; today = outlined. Default
selected day, computed by a pure `pickDefaultDay(days, now)` selector:

- Before the tournament (now is earlier than the first match day): **first match day**.
- During: **today** if it has matches, else the **next** day that has matches.
- After the last match day: the **last** match day.
- Empty input: `null` (caller shows the empty state).

A "Today / Next" jump control returns the user to the default day after scrolling.

By-Day mode needs no extra filters (a single day is already a small set). By-Stage mode uses
its stage sub-tabs as the filter. The old `Filters` group-chip row is retired.

## Components & file changes

New (in `src/components/fixtures/`):

- `fixtures-view.tsx` — client orchestrator; reads/writes the `view`/`day`/`stage` params,
  renders the segmented mode switch, and the By-Day or By-Stage panel.
- `date-strip.tsx` — horizontal day picker + "Today / Next" jump.
- `match-row.tsx` — the compact pick-forward row.

Reworked:

- `src/app/fixtures/page.tsx` — fetch as today, render `FixturesView`.
- `stage-nav.tsx` — becomes the By-Stage panel (groups A–L + knockout rounds) using
  `MatchRow`.

Deleted (redundant under the new model):

- `calendar-grid.tsx`, `timeline.tsx`, `view-toggle.tsx`, `filters.tsx`.

Verify & adjust:

- `match-card.tsx` / `prediction-card.tsx` — confirm whether `/match/[id]` still depends on
  them. Keep whatever the match page needs; remove their use from the fixtures list either
  way. (`actions.ts` `savePrediction` stays — still used by the match page.)

## Data layer

Unchanged. `getFixtures(predictionMap)` already returns `prediction`, `pointsAwarded`,
`locked`, `status`, `homeScore`/`awayScore`, teams, and venue. `groupByStage` / `groupByGroup`
are reused by the By-Stage panel.

## Pure selectors (TDD)

Two small, pure, unit-tested helpers (project convention is TDD for `src/lib` selectors):

- `pickDefaultDay(days, now)` — chooses the default date-strip day per the rules above.
  Tests: before / during-with-today / during-no-today / after / empty.
- `predictionRowState(match)` — maps a `FixtureMatch` to a row presentation state
  (`predict | picked | locked-nopick | finished | finished-nopick | live`) plus the chip
  text/score to render. Tests: each state, including points present/absent and finished
  with/without a pick.

Location: extend `src/lib/fixtures.ts` (or `src/lib/local-time.ts` for the date helper —
whichever keeps imports cleanest). No new tables, no migrations.

## Testing

- Unit tests for both pure selectors (Vitest), written before implementation.
- Existing fixtures/predictions/local-time tests must continue to pass.
- Manual check: By Day default lands on the right day pre-launch (first match day) and the
  row chips reflect predicted / locked / finished / live correctly.

## Out of scope / deferred

- `/bracket` knockout visualisation (Phase 4).
- Any live-score automation — `status`/scores remain admin-entered.
