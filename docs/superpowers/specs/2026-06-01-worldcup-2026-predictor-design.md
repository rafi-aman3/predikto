# World Cup 2026 Predictor — Design

**Date:** 2026-06-01
**Status:** Approved (design phase complete)
**Author:** rafi@sdsmanager.com

## Summary

A monolithic web app where a friend circle predicts World Cup 2026 results — match
by match and a full knockout bracket plus tournament awards — earns points, and
competes on leaderboards. The top of the overall leaderboard wins a real prize from
the owner. Includes self-managed ad slots for football/World Cup advertising, plus
team and player profile pages.

The tournament kicks off **June 11, 2026**, so the build is scoped lean and fast.

## Goals

- Let friends sign in and predict every match (scoreline) and the bracket + awards.
- Score predictions automatically once the owner (admin) enters real results.
- Rank everyone on leaderboards (overall, current round, and per-match).
- Let a user compare their picks head-to-head against any friend.
- Give the owner an admin panel to enter results, manage ads, and edit data.
- Provide team and player profile pages backed by seed data.

## Non-Goals (v1)

- No live/auto result fetching from a football API (admin enters results manually).
- No real-money betting, payments, or payouts (single prize handled offline).
- No native mobile apps (mobile-first responsive web only).
- No public/global scale concerns — sized for a friend group (tens of users).
- No ad network / ad tracking — banners are self-managed and static.

## Tech Stack

- **Framework:** Next.js (App Router), monolithic, deployed on **Vercel**.
- **Database:** Supabase Postgres.
- **Auth:** Supabase Auth — email (password + magic link) **and** Google OAuth, via
  `@supabase/ssr`.
- **Storage:** Supabase Storage — ad banner images and optional player photos.
- **ORM:** Drizzle ORM (schema, migrations, seed script) over the Supabase Postgres
  connection.
- **Styling:** Tailwind CSS, mobile-first, with the **Retro Pitch** theme.
- **Server logic:** React Server Components for reads; Server Actions for writes
  (predictions, admin edits, scoring recompute).

### Visual Theme — "Retro Pitch"

Playful, nostalgic, tournament-spirited.

- Grass-green pitch stripes background, deep green `#0a3d26`, gold `#ffcb05`,
  cream `#fff7e6`, accent red `#d7263d`.
- Serif headings (Georgia family), system sans for controls/numbers.
- Cards: cream fill, 2px deep-green border, gold highlights for selected/winning
  states.

## Data Model (Drizzle / Postgres)

User identity lives in Supabase `auth.users`; app data references it via `profiles`.

- **teams** — `id, name, code, flag, groupName, fifaRank, wcTitles, coach`
- **players** — `id, teamId, name, position, shirtNumber, club, age, caps,
  photoUrl?, goldenBootEligible, bestPlayerEligible`
- **venues** — `id, name, city, country`
- **matches** — `id, stage (group|r32|r16|qf|sf|final), groupName?, homeTeamId?,
  awayTeamId?, venueId, kickoffAt, homeScore?, awayScore?,
  status (scheduled|live|finished)`
  - Knockout matches can have null team IDs until group results are known ("TBD").
- **profiles** — `id (= auth.users.id), displayName, avatarSeed, isAdmin`
- **matchPredictions** — `id, userId, matchId, homeScore, awayScore, pointsAwarded?`,
  unique `(userId, matchId)`. Locked once `now >= match.kickoffAt`.
- **bracketPredictions** — `id, userId` plus the predicted advancing team for each
  knockout slot (stored per-slot rows or a structured column). Locked at the global
  prediction deadline.
- **awardPredictions** — `id, userId, championTeamId, runnerUpTeamId,
  goldenBootPlayerId, bestPlayerId, surpriseTeamId`. Locked at the global deadline.
- **ads** — `id, imageUrl, linkUrl, slot (sidebar|inline|footer), active, sortOrder`
- **appSettings** — singleton: `predictionsLockAt` (bracket + awards deadline),
  scoring constants (see below), `prizeText`.

## Scoring Rules

Scoring constants are stored in `appSettings` so the admin can tweak them without a
redeploy. Defaults:

**Match predictions** (predict the 90-minute scoreline):
- Exact score correct: **+3**
- Correct result only (win/draw/loss): **+1**
- Otherwise: **0**

Knockout advancement is *not* scored on the match card — you predict the scoreline
for match points; who advances is scored via the bracket prediction.

**Bracket** — each correctly predicted team reaching a round:
- Reaches Round of 16: **+1** each
- Reaches Quarter-final: **+2** each
- Reaches Semi-final: **+3** each
- Reaches Final (finalist): **+5** each

**Awards:**
- Champion: **+10**
- Runner-up: **+5**
- Golden Boot: **+5**
- Best Player: **+5**
- Surprise team: **+5**

**Recompute:** when the admin enters or edits a match result, the scoring engine
recomputes `pointsAwarded` for all affected match predictions; bracket/award points
recompute as knockout outcomes and final standings are recorded. Leaderboards are the
sum of `pointsAwarded` across the relevant scope.

## Screens & Flows

- **Auth** — sign in with email (password or magic link) or Google. First login
  prompts for a display name.
- **Fixtures** — default **Calendar Grid** (month view, match dots per day, tap a
  day to expand its matches); toggle to **Timeline** (day-grouped scrolling list) and
  **Stage Navigator** (tabs Groups → R32 → R16 → QF → SF → Final). Filters by team,
  group, and stage layer on top of any view.
- **Match prediction card** — combined input: **steppers** (+/- per team) and
  **quick scoreline** one-tap buttons (1-0, 2-1, 1-1, …) with tap-to-type fallback.
  Auto-locks at kickoff; after full-time flips to a scored state
  (+3 / +1 / 0 badge).
- **Bracket** — **round-by-round wizard** (progress bar, pick winners one round at a
  time) to make picks; **read-only bracket tree** to view and share the finished
  bracket. **Awards panel** (dropdown picks) alongside. All lock at
  `predictionsLockAt`.
- **Leaderboard** — podium for top 3 + ranked list; tabs **Overall** (whole
  tournament), **This round** (current matchday), **By match** (who nailed a specific
  match). Prize marker on #1 with editable prize text.
- **Head-to-Head** — pick any friend; compare every pick side-by-side with points and
  a running "who leads this matchup" indicator.
- **Team profile** — flag, name, group, coach, FIFA rank, WC titles, squad list
  (position · name · club), and how many in the circle picked them champion.
- **Player profile** — name, position, shirt #, club, age, caps, optional photo, and
  award-pick context (e.g. "picked by 4 of 8 for Golden Boot").
- **Admin** (`isAdmin` only) — enter/edit match results (triggers recompute), manage
  ad banners (upload image, link, slot, active, order), edit teams/players/venues, set
  `predictionsLockAt`, edit scoring constants and prize text.

## Seeding

A one-time `seed.json` containing 48 teams (with squads), 16 venues, and the 104
fixtures (with stadiums and kickoff times) is loaded via a Drizzle seed script.
Knockout-stage matches whose participants depend on group results are seeded as "TBD"
and filled in by the admin as the tournament progresses. All seeded data is editable
afterward from the admin panel.

## Build Phases

1. **Foundation** — Next.js project, Supabase project + env wiring, Drizzle schema +
   migrations, auth (email + Google) with display-name onboarding, seed data load,
   Retro Pitch theme and app shell/navigation.
2. **Fixtures + Match Predictions** — three fixture views with toggle and filters,
   match prediction card (steppers + quick scorelines), kickoff locking.
3. **Admin + Scoring** — admin result entry, scoring engine and recompute, scored
   match-card states.
4. **Leaderboard + Head-to-Head** — overall/round/by-match leaderboards, podium,
   prize marker, friend comparison view.
5. **Bracket + Awards** — wizard picker, read-only tree, awards panel, deadline
   locking, bracket/award scoring.
6. **Profiles + Ads + Polish** — team/player profile pages, ad slot rendering + admin
   management, responsive polish and final theming.

## Open Questions / Future

- Group-stage standings auto-calculation (could help auto-fill knockout participants
  instead of manual admin entry) — deferred; admin sets TBD slots in v1.
- Optional: group/private mini-leagues if the circle grows — out of scope for v1.
