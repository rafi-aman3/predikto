# Standings Table + Country Links — Implementation Plan (follow-up)

> Follow-up to `2026-06-05-retro-arcade-design-system.md`. Adds a group standings page
> (`/table`, in the topbar) and makes country names/flags link to `/team/[code]` across the app.

**Goal:** A `/table` page showing all 12 groups' standings (Pos, P, W, D, L, GF, GA, GD, Pts),
plus clickable country names/flags everywhere that route to the team page.

**Decisions:** route `/table` labelled "Table"; ranking Pts → GD → GF → name (alphabetical).
No schema changes. Standings computed from finished group matches only.

## Tasks

### Task S1: `computeGroupStandings` pure logic (TDD)
- Create `src/lib/standings.ts` + `src/lib/standings.test.ts`.
- `StandingRow = { teamId, code, name, flag, played, won, drawn, lost, gf, ga, gd, points }`.
- `GroupStandings = { groupName: string; rows: StandingRow[] }`.
- `computeGroupStandings(teams: BoardTeam[], fixtures: FixtureMatch[]): GroupStandings[]`:
  - Seed a zeroed row for every team with a non-null `groupName`, keyed by team id.
  - For each fixture with `stage==='group'`, `status==='finished'`, non-null home/away and
    homeScore/awayScore, and both teams present in the same group: increment played, add
    gf/ga to both, award 3/1/0 points, increment won/drawn/lost. gd = gf - ga.
  - Sort each group's rows: points desc, gd desc, gf desc, then `name` asc. Groups sorted by name.
- Tests: zero-state (all zeros, alphabetical), W/D/L/points/gd from results + correct order,
  ignores non-finished and non-group matches.

### Task S2: `TeamLink` component
- Create `src/components/retro/team-link.tsx`.
- `TeamLink({ code, children, className })`: if `code` is truthy and not `'TBD'`, wrap in
  `<Link href={`/team/${code}`}>`; otherwise render a plain `<span>`. Never place inside another `<Link>`.

### Task S3: `/table` page + nav link
- Create `src/app/table/page.tsx`: server component; fetch teams + `getFixtures()`; compute
  standings; render each group as a `StickerCard` containing a retro standings table (header row
  Pos/Team/P/W/D/L/GD/Pts; team cell uses `BadgeFlag` + `TeamLink` to the team page).
- Add `{ href: '/table', label: 'Table' }` to the `links` array in `src/components/nav.tsx`
  (after Fixtures).

### Task S4: wire country links into existing surfaces (avoid nested `<Link>`)
- `src/components/home/group-board.tsx`: remove the card-level `<Link>` to fixtures; instead make
  each team row a `TeamLink` to `/team/[code]`. Keep the `GroupTag` as a `Link` to `/table` so the
  card still navigates somewhere sensible.
- `src/app/match/[id]/page.tsx`: wrap each team's BadgeFlag + name in the VS hero with `TeamLink`.
- `src/components/fixtures/match-card.tsx`: restructure so the teams are `TeamLink`s (not nested in
  the match `<Link>`). Keep a distinct "Match details →" link to `/match/[id]` (the meta/time row),
  with `PredictionCard` below as today. No nested anchors.

## Verify
`npm test && npx tsc --noEmit && npm run build && npm run lint` — all green. Commit per task; no push.
