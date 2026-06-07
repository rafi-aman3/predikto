# Phase 5 — Bracket Simulator + Awards (design)

**Date:** 2026-06-07
**Status:** Approved (brainstorm)
**Depends on:** Phases 1–4 (schema, scoring engine, leaderboard) + the full WC2026
seed (12 groups A–L, r32/r16/qf/sf/third/final matches seeded TBD).

## Goal

Let each member predict the entire knockout path as an **interactive bracket
simulator** (Telegraph-style), not a question wizard:

1. Set the finishing order (1→4) of all **12 groups**.
2. Pick which **8 of the 12 third-placed** teams advance (WC2026: 24 group qualifiers
   + 8 best thirds = 32).
3. The **R32 bracket auto-seeds** from those positions; tap a winner in each tie to
   advance it up the tree → R16 → QF → SF → Final → **Champion**.
4. Pick the **awards** (Golden Boot, Best Player, Surprise team) alongside.

Everything locks together at the global `app_settings.predictionsLockAt` deadline and
is scored into the existing leaderboard.

## Decisions (locked)

- **Group predictions are scored.** New constants: `pts_group_position` (default **+2**
  per team in its exact final group position) and `pts_third_qualifier` (default **+1**
  per correctly-picked advancing 3rd-place team).
- **Bracket scoring = reaches-round** (per the original spec): each advanced team that
  actually reaches R16 **+1** / QF **+2** / SF **+3** / Final **+5** (cumulative as a
  team goes deeper). No per-tie scoring.
- **Seeding:** the **real WC2026 bracket wiring** is used for the 24 top-2 slots and all
  round-to-round propagation; only the **8 thirds → slot** assignment is **simplified**
  (deterministic ranked fill), not FIFA's combination lookup table.
- **Flow:** a **single reactive page** with a sticky section mini-nav (Groups → Thirds →
  Bracket → Awards), not a stepped wizard. Editing an upstream group resets only the
  affected downstream picks.
- **Admin:** full settings editor — actual award winners + global lock date + prize text
  + all scoring constants (incl. the two new group constants).
- **Actuals** are derived where possible: group standings + 8 real thirds from
  `computeGroupStandings` on real results; reached-round sets from real knockout match
  participants; champion/runner-up from the real final + third-place results. Only Golden
  Boot / Best Player / Surprise are admin-entered.

## Data model

### New table `groupPredictions`

```
groupPredictions (
  id            uuid pk
  userId        uuid → profiles.id (cascade)
  groupName     text                 -- "A".."L"
  teamId        uuid → teams.id
  position      integer              -- 1..4 (predicted final group position)
  advancesAsThird boolean default false  -- true only on position=3 rows the user picked to advance (exactly 8 across all groups)
  pointsAwarded integer null         -- null until scored
)
unique(userId, teamId)
```

A team belongs to exactly one group, so `(userId, teamId)` is the natural key. The 8
chosen thirds are the `position = 3` rows with `advancesAsThird = true`.

### Existing `bracketPredictions` (unchanged shape)

Stores the user's per-stage **advancing sets** for `r16 | qf | sf | final` — the scored
rows. The R32 field (32 teams) is **derived** from `groupPredictions` (top-2 of each
group + the 8 flagged thirds) and is **not** persisted.

### Existing `awardPredictions` (unchanged shape)

`championTeamId, runnerUpTeamId, goldenBootPlayerId, bestPlayerId, surpriseTeamId`.
Champion + runner-up are written from the user's bracket final; the three award picks
come from the awards panel.

### `app_settings` additions (one migration)

- `pts_group_position` integer default `2` not null
- `pts_third_qualifier` integer default `1` not null
- `actual_golden_boot_player_id` uuid → players.id (null)
- `actual_best_player_id` uuid → players.id (null)
- `actual_surprise_team_id` uuid → teams.id (null)

(Champion/runner-up actuals are derived from the final + third-place match results, so
no actual-champion column is needed.)

`ScoringConfig`, `DEFAULT_SCORING`, and `getScoringConfig` extend to carry the two new
group constants.

## Modules

All pure selectors are client-safe (no `db` import), TDD'd. DB readers/writers are thin
and live in `get-*.ts` / server actions, per the project's pure-selector convention.

### `src/lib/bracket.ts` (pure)

The static bracket structure + simulator math.

- **`KNOCKOUT_TEMPLATE`** — the fixed WC2026 wiring:
  - 16 R32 slots, each defined by two position-codes. Top-2 codes are real (e.g. `1A`,
    `2B`); third slots use a placeholder code (e.g. `3#1`..`3#8`).
  - For each round, how a slot's winner feeds the next round's slot (R32→R16→QF→SF→Final),
    matching the published WC2026 bracket layout (and the seeded `r32-1..r32-16` order).
- **`buildR32Field(groupStandings, chosenThirds)`** → assigns teams to the 16 R32 ties:
  top-2 codes resolve directly from the predicted standings; the 8 chosen thirds fill the
  8 third-slots by a deterministic ranked rule (documented in code — by group letter).
- **`reconstructBracket(groupStandings, chosenThirds, reachedSets)`** → the full tree for
  rendering and validation: every tie at every round with its two participants and which
  one the user advanced. Because R32 pairings are fixed by positions and each round's
  reached-set selects exactly one team per tie, the tree reconstructs unambiguously.
- **Validation helpers** — group order complete (each group has a 1..4 permutation),
  exactly 8 thirds chosen, each round's set is a valid one-per-tie selection from the
  previous round.

### `src/lib/bracket-scoring.ts` (pure)

- **`scoreGroupPredictions(predicted, actualStandings, actualAdvancingThirds, cfg)`** →
  per-team points: `+pts_group_position` for each team in its exact actual position;
  `+pts_third_qualifier` for each predicted advancing third that actually advanced as a
  top-8 third.
- **`scoreBracket(predictedReached, actualReachedByStage, cfg)`** → per `bracketPredictions`
  row: points for the stage if that team is in the actual reached-set for that stage.
- **`scoreAwards(predicted, actual, cfg)`** → champion/runner-up/goldenBoot/bestPlayer/
  surprise points.
- **`pickActualAdvancingThirds(standings)`** → ranks the 12 actual third-placed teams and
  returns the 8 best (points → GD → GF → name), reusing the standings ordering.

### Thin DB layer

- **`src/lib/get-bracket.ts`** — loads a user's `groupPredictions` + `bracketPredictions`
  + `awardPredictions`, the teams/groups, the players list (for award dropdowns), the
  lock state (`predictionsLockAt`), and (post-results) the derived actuals for scored
  display. Reuses `getFixtures` for knockout match participants.
- **`saveBracket` server action** (`src/app/bracket/actions.ts`) — validates (server-side
  lock + structural validity via `bracket.ts`), upserts group/bracket/award rows in a
  transaction. Rejects writes once locked.
- **Recompute** (`src/lib/scoring.ts` or a new `bracket-recompute.ts`):
  - `recomputeBracketsAndGroups()` — recomputes group + bracket `pointsAwarded` for all
    users from current real results; called whenever the admin saves a group or knockout
    match result (alongside the existing per-match `recomputeMatch`).
  - `recomputeAwards()` — recomputes award `pointsAwarded` for all users; called when the
    admin saves award actuals (and when the final/third-place results change champion/
    runner-up actuals). Small friend circle → full recompute is fine.

### Leaderboard integration

`getLeaderboardData` additionally reads group/bracket/award `pointsAwarded`, sums them
per user into a `bonusByUser: Record<userId, number>`, and `buildLeaderboard` adds that
bonus to each player's **Overall** total. The **This round** (by stage) and **By match**
tabs remain match-scoped and unchanged; non-match points fold into Overall only.

## Screens

### `/bracket` — the simulator (single reactive page, Retro Arcade styled)

- **Sticky section mini-nav** with completion counts: `Groups n/12 · Thirds n/8 ·
  Bracket · Awards`, anchor-jumping to each section. View/section state in the URL via
  `history.replaceState` (project convention).
- **Groups section** — 12 group cards; within each, order the 4 teams 1→4 (up/down
  controls; no drag-drop dependency). Team names/flags link out via the existing pattern
  where it doesn't nest interactive controls.
- **Thirds section** — the 12 teams placed 3rd; pick exactly 8 to advance. Disabled until
  all 12 groups are ordered.
- **Bracket section** — the tree (R32→R16→QF→SF→Final); tap a team in a tie to advance
  it; downstream picks reset when an upstream pick changes. Dimmed with a hint until
  groups + 8 thirds are complete.
- **Awards section** — Champion + Runner-up shown read-only from the bracket final;
  Golden Boot / Best Player / Surprise picked from dropdowns (eligible players/teams).
- **Save** — one action saves everything; success toast/SFX.
- **Locked state** — after `predictionsLockAt`, the page is a **read-only / shareable
  bracket tree**; after real results land, each pick shows a scored chip (e.g. `+3`,
  reached/✗).

### Homepage + nav

- `BracketTeaser` CTA → `/bracket` (currently points at `/fixtures?stage=r16`).
- Nav `/bracket` link resolves to the real page (currently 404s).

### `/admin/settings` — full settings editor (admin-gated)

- Actual **Golden Boot** / **Best Player** / **Surprise team** pickers → on save,
  `recomputeAwards()`.
- Global **predictions lock date** (`predictionsLockAt`).
- **Prize text** (shown on the leaderboard #1).
- **All scoring constants**, incl. the two new group constants.
- Gated by `getAdminUser` like the existing admin pages; per-action server re-check.

## Scoring summary

| Prediction | Points | Actual source |
|---|---|---|
| Group position (each team, exact) | `pts_group_position` (+2) | `computeGroupStandings` on real group results |
| Advancing 3rd (each correct) | `pts_third_qualifier` (+1) | top-8 thirds from real standings |
| Reaches R16 / QF / SF / Final | +1 / +2 / +3 / +5 | distinct participants of real r16/qf/sf/final matches |
| Champion / Runner-up | +10 / +5 | winner / loser of the real final |
| Golden Boot / Best Player / Surprise | +5 each | admin-entered actuals |

All points live in `pointsAwarded` columns, so the existing `SUM(pointsAwarded)`
leaderboard absorbs them automatically.

## Testing

- `bracket.ts`: template integrity (each slot wired once, winners propagate to the right
  next slot), `buildR32Field` (correct top-2 resolution + deterministic thirds fill),
  `reconstructBracket` (unambiguous tree, validation of malformed inputs).
- `bracket-scoring.ts`: group exact-position scoring, third-qualifier scoring, reaches-
  round (incl. cumulative deeper rounds), awards, `pickActualAdvancingThirds` tie-breaks.
- `app-settings`/`scoring-config`: new constants flow through `getScoringConfig`.
- Lock enforcement: `saveBracket` rejects after `predictionsLockAt` (server-side).

## Out of scope (deferred)

- Auto-filling knockout match participants from group standings (admin still fills TBD
  slots in `/admin/matches`).
- FIFA's exact third-place combination lookup (simplified deterministic fill instead).
- Per-tie/matchup scoring (using reaches-round per spec).
- Profiles / ads / final polish (Phase 6).
```
