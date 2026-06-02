# Homepage Countdown + Full Fixtures + Local Timezone — Design

**Date:** 2026-06-03
**Status:** Approved (design phase)
**Author:** rafi@sdsmanager.com
**Parent spec:** `2026-06-01-worldcup-2026-predictor-design.md`

## Summary

Three related front-of-house improvements, prioritized ahead of Phase 4:

1. **Full WC2026 fixture data** — replace the 3-match placeholder seed with the complete
   real tournament: 48 teams in 12 groups, 16 venues, and all 104 matches (group + knockout
   incl. the third-place play-off).
2. **Local timezone display** — show every kickoff time *and* day grouping in the visitor's
   own timezone (auto-detected from the browser; a BD visitor sees UTC+6), replacing the
   current hard-coded UTC formatting.
3. **Live homepage countdown** — a ticking days/hrs/min/sec countdown to the first match,
   plus a small upcoming-matches teaser.

## Goals

- A real, complete fixture list so `/fixtures` is usable for actual predictions.
- All match times correct for whoever is viewing, wherever they are.
- A homepage that conveys "the World Cup is coming" with a live countdown.

## Non-Goals

- Squad/roster data (final squads aren't announced until ~June 2026; not needed here — a
  Phase 6 / profiles concern). Teams seed with empty squads.
- A user-selectable timezone picker — auto-detect from the browser only.
- Auto-resolving knockout participants — knockout matches keep TBD teams; the admin fills
  them via `/admin/matches` as results come in.
- Group-stage standings calculation — out of scope (deferred per parent spec).

## Decisions (from brainstorming)

- **Fixtures scope:** full real schedule (48 teams, 12 groups, 104 matches).
- **Data source:** web-research the official FIFA WC2026 schedule (draw groups, venues,
  dates, kickoff times). Best-effort accuracy; admin corrects errors.
- **Local time:** both kickoff times and day grouping follow the browser timezone.
- **Countdown:** live-ticking days/hrs/min/sec.
- **Third-place match:** included — add a `third` stage to the enum (104 matches total).
- **Data reset:** truncate teams/players/venues/matches and seed fresh (current data is
  throwaway; this also clears any predictions — acceptable pre-launch).

## Part A — Full fixture data

### Schema change
Add `third` to `stageEnum` in `src/db/schema.ts`:
`['group', 'r32', 'r16', 'qf', 'sf', 'third', 'final']`. Generate + run a Drizzle migration
(`npx drizzle-kit generate` → `migrate`). Update `STAGE_ORDER` in `src/lib/fixtures.ts` and
the `Stage` type to include `'third'` (ordered before `'final'`). The stage navigator
(`stage-nav.tsx`) and any stage labels pick up the new value; add a human label "3rd Place".

### Seed data (`data/seed.json`)
Replace entirely with researched real data:

- **teams** (48): `{ code, name, flag (emoji), groupName (A–L), fifaRank, coach, wcTitles, squad: [] }`.
  Unresolved playoff entrants are placeholder teams (e.g. `code: "POA"`, `name: "UEFA Play-off A"`,
  with the group they were drawn into). `code` must be unique (seed keys teams by code).
- **venues** (16): `{ name, city, country }` — verify against the real stadiums.
- **matches** (104): `{ externalId, stage, groupName?, homeTeamCode?, awayTeamCode?, venueName, kickoffAt (ISO UTC) }`.
  - 72 group matches: real matchups (`homeTeamCode`/`awayTeamCode` set), real venue + UTC kickoff.
  - 32 knockout matches (r32 ×16, r16 ×8, qf ×4, sf ×2, third ×1, final ×1): real
    `kickoffAt`/`venueName`, **null** team codes (TBD). Stable `externalId` like `r32-1`, `final`.
  - `kickoffAt` stored in **UTC** (ISO `Z`). Local display is a presentation concern (Part B).

`src/db/seed-data.ts` (the `parseSeed` validator) must accept the larger dataset unchanged
(it already supports nullable team codes and empty squads — confirm, adjust types only if
needed).

### Reset + seed
Add an `npm run db:reset` script that truncates `match_predictions`, `bracket_predictions`,
`award_predictions`, `matches`, `players`, `teams`, `venues`, `app_settings` (respecting FK
order / `CASCADE`) and then runs the seed. Implement as `src/db/reset.ts` invoked before the
existing seed, or a `TRUNCATE ... RESTART IDENTITY CASCADE`. The `app_settings` singleton is
re-created by the existing seed step. Document the command in `CLAUDE.md`.

## Part B — Local timezone display

The server cannot know the visitor's timezone, so time/date formatting moves to the client.
Hard-coded `timeZone: 'UTC'` exists in three places today: `match-card.tsx`,
`calendar-grid.tsx`, `timeline.tsx`. Date grouping is computed server-side in UTC
(`groupByDate` in `src/lib/fixtures.ts`).

### `<LocalTime>` client component — `src/components/local-time.tsx`
- Props: `iso: string` (UTC ISO kickoff) and a `format: 'time' | 'datetime' | 'dayHeader'`.
- Renders the formatted string using the browser's timezone (Intl with no `timeZone`
  option → local). To avoid a hydration mismatch (server has no local TZ), it renders an
  empty/stable placeholder on first paint and the localized string after mount
  (`useEffect` + `useState`). A brief blank flash is acceptable.
- `'time'` → `7:30 PM`; `'datetime'` → `Jun 11, 7:30 PM`; `'dayHeader'` → `Thursday, June 11`.
- This replaces the three UTC-formatting helpers; match-card shows the local kickoff (drop
  the literal " UTC" suffix).

### Local day grouping (calendar + timeline)
Date grouping must use the *local* calendar day. The `FixtureMatch` list is passed to the
client; grouping by local date happens in the browser.

- Add a client grouping helper `groupByLocalDate(matches)` (e.g. in `src/lib/local-time.ts`,
  a client-safe module) that buckets matches by their **local** `YYYY-MM-DD` (derived from
  the kickoff Date via local getters), returning `{ dateKey, label, matches }[]` sorted
  chronologically. The label is produced by the same local formatter.
- `calendar-grid.tsx` and `timeline.tsx` become (or gain) client components that take the
  flat match list and group locally, instead of receiving server-pre-grouped UTC buckets.
- `groupByStage` / `groupByGroup` are timezone-independent and stay server-side unchanged.
- `FixtureMatch.kickoffAt` is serialized to the client as an ISO string (it already crosses
  the server→client boundary via `prediction-card`; ensure the date survives serialization —
  pass ISO strings and parse on the client).

### Hydration / SSR note
Any element whose text depends on local TZ must not differ between server and client HTML.
The mount-guard pattern in `<LocalTime>` (and client-side grouping that only renders after
mount, or with `suppressHydrationWarning` on the time nodes) prevents React hydration
warnings. Document the chosen guard in the component.

## Part C — Homepage countdown

### `<Countdown>` client component — `src/components/countdown.tsx`
- Prop: `targetIso: string` (first kickoff, UTC ISO).
- `setInterval` 1s; computes remaining `days/hours/minutes/seconds`; renders four labeled
  segments in the Retro Pitch style (gold numerals on pitch, serif). Cleans up the interval
  on unmount. Mount-guard so SSR/CSR match (renders static "—" until mounted).
- When `now >= target`: render a "🏆 The tournament is live!" state instead of the timer.

### Homepage (`src/app/page.tsx`)
- Server component: query the first match kickoff (`min(matches.kickoffAt)`) and the next 3
  upcoming matches (kickoff ≥ now, ordered, enriched with team/venue) via a small helper
  (reuse `getFixtures` and filter, or a focused query).
- Renders: title → `<Countdown targetIso={firstKickoff}>` → "Next matches" teaser (3 cards
  using `<LocalTime>`) → CTA button to `/fixtures`.
- If no matches exist (empty DB), show the existing static hero copy as a fallback.

## Components / files

| File | Change |
|------|--------|
| `data/seed.json` | Replace with full 48-team / 104-match dataset |
| `src/db/schema.ts` | Add `third` to `stageEnum` |
| `drizzle/` migration | Generated for the enum change |
| `src/db/reset.ts` + `package.json` | New `db:reset` (truncate + seed) |
| `src/lib/fixtures.ts` | `Stage` + `STAGE_ORDER` include `third`; date grouping moves client-side |
| `src/lib/local-time.ts` | Client-safe `groupByLocalDate` + local formatters |
| `src/components/local-time.tsx` | New `<LocalTime>` client component |
| `src/components/countdown.tsx` | New `<Countdown>` client component |
| `src/components/fixtures/match-card.tsx` | Use `<LocalTime>` (drop UTC suffix) |
| `src/components/fixtures/calendar-grid.tsx` | Client; local-date grouping + `<LocalTime>` headers |
| `src/components/fixtures/timeline.tsx` | Client; local-date grouping + `<LocalTime>` headers |
| `src/components/fixtures/stage-nav.tsx` | Handle `third` label |
| `src/app/page.tsx` | Countdown + upcoming teaser + CTA |
| `CLAUDE.md` | Document `db:reset`; note local-time/countdown |

## Error handling

- Empty/missing fixtures → homepage shows static fallback; `/fixtures` shows "No fixtures yet".
- `<Countdown>` past target → "tournament is live" state (no negative numbers).
- `<LocalTime>` before mount → placeholder; never throws on a bad ISO (guard parse).
- Seed reset wrapped so a failure leaves a clear error (don't half-truncate then crash
  silently — run truncate + seed in one script with a try/catch that logs and exits non-zero).

## Testing

- **`src/lib/local-time.test.ts`** — `groupByLocalDate`: matches bucket by local day; a
  match near midnight UTC lands in the expected local-day bucket given a fixed TZ offset
  (inject a formatter/offset so the test is deterministic, not dependent on the runner's TZ);
  ordering is chronological.
- **Countdown math** — extract a pure `timeRemaining(target, now)` → `{days,hours,minutes,seconds,done}`
  helper and unit-test it (exact boundary, past target → done, multi-day).
- **`data/seed.json` shape** — extend `src/db/seed-data.test.ts`: 48 teams, 16 venues, 104
  matches; every match has a valid stage; group matches have both team codes; knockout
  matches may omit them; all `kickoffAt` parse as valid dates; team `code`s are unique.
- Existing fixtures/scoring/admin tests continue to pass.
- Manual: load `db:reset`, view `/fixtures` from a non-UTC TZ (or override the browser TZ in
  devtools) and confirm times + day headers shift correctly; homepage countdown ticks.

## Out of scope / later

- Squad data + player profiles (Phase 6).
- Timezone picker / per-user TZ preference.
- Auto-filling knockout participants from results.
