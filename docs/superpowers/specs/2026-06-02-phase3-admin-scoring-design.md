# Phase 3 — Admin + Scoring Engine — Design

**Date:** 2026-06-02
**Status:** Approved (design phase)
**Author:** rafi@sdsmanager.com
**Parent spec:** `2026-06-01-worldcup-2026-predictor-design.md`

## Summary

Phase 3 makes the predictor *scorable*. It adds an admin-only surface for the owner to
manage matches (enter/edit results and full match metadata) and a scoring engine that
computes match-prediction points whenever a result is recorded. Player-facing match cards
gain a finished/scored state.

Scope is deliberately limited to **match scoring + admin match management**. Leaderboards
are Phase 4; bracket/award scoring is Phase 5. The admin settings editor (scoring
constants, lock date, prize text) is **deferred to Phase 4/5** — match scoring runs on the
seeded `app_settings` defaults.

## Goals

- Gate an admin area to the owner via an email allowlist (`ADMIN_EMAILS`), enforced
  server-side at every entry point.
- Let the admin enter/edit a match scoreline, set match status, and edit full match
  metadata (teams — including filling TBD knockout slots — kickoff, venue, group).
- Score match predictions automatically when a match is recorded as finished, and
  recompute/clear them when a result is edited or reverted.
- Show players a finished match's real scoreline and their earned points on the match card.

## Non-Goals (this phase)

- No leaderboard or head-to-head (Phase 4).
- No bracket or award scoring (Phase 5).
- No admin settings editor, ad management, or team/player editing (later phases).
- No `live`-score recompute — only `finished` matches with both scores set are scored.

## Decisions (from brainstorming)

- **Scope:** full match metadata editing (teams/kickoff/venue/group/status), not just
  scores.
- **Admin access:** `ADMIN_EMAILS` env allowlist is the source of truth. `profiles.isAdmin`
  is synced from it for convenience but is not the gate.
- **Result UI:** a dedicated `/admin/matches` table, separate from player-facing
  `/fixtures`.
- **Status model:** `scheduled | live | finished`. A `live` match is **not** scored; only
  `finished` with both scores present is scored.
- **Settings editor:** deferred to Phase 4/5.

## Architecture

### 1. Admin access layer — `src/lib/admin.ts`

The env allowlist is authoritative; the DB flag is a synced convenience.

- `getAdminEmails(): string[]` — parses `ADMIN_EMAILS` (comma-separated), trims,
  lowercases, drops empties.
- `isAdminEmail(email: string | null | undefined): boolean`.
- `getAdminUser()` — server-only: resolves the Supabase user via the server client
  (`src/lib/supabase/server.ts`); returns the user **only if** its email is allowlisted,
  else `null`. When it returns a user, it syncs `profiles.isAdmin = true` for that id
  (best-effort; never blocks on it).

**Route protection (defense in depth):**

- `src/app/admin/layout.tsx` (server component) calls `getAdminUser()`; `redirect('/')`
  when `null`. All `/admin/*` pages live under this layout.
- **Every admin server action independently calls `getAdminUser()`** and returns an error
  result when `null` — the layout is never trusted as the sole guard. This mirrors how
  `savePrediction` re-checks auth.

Enforcement lives in server components/actions, **not** `proxy.ts` (the proxy runs on the
anon key purely to refresh the session cookie; authz belongs in the app layer).

### 2. Scoring engine

**`src/lib/scoring.ts`** — pure, unit-tested:

```
scoreMatch(predH, predA, actualH, actualA, cfg): number
```

- Exact scoreline (`predH === actualH && predA === actualA`) → `cfg.ptsExact`.
- Else same result (`sign(predH − predA) === sign(actualH − actualA)`) → `cfg.ptsResult`.
- Else `0`.

**`src/lib/app-settings.ts`** — `getScoringConfig(): Promise<ScoringConfig>` reads the
`app_settings` singleton (id = 1) and maps its `pts*` columns to a `ScoringConfig`; falls
back to `DEFAULT_SCORING` from `src/lib/scoring-config.ts` if the row is missing.

**`recomputeMatch(matchId)`** (in `src/lib/scoring.ts`):

- Load the match. If `status === 'finished'` and both `homeScore`/`awayScore` are non-null:
  load `getScoringConfig()` + all `matchPredictions` for the match, compute each
  `pointsAwarded` via `scoreMatch`, and persist.
- Otherwise (reverted to `scheduled`/`live`, or scores cleared): set `pointsAwarded = null`
  for all of that match's predictions.

**Recompute scope is per-match only.** A match prediction's points depend solely on that
one match's result, so editing a result never cascades. `recomputeMatch` is the entire
recompute story for this phase.

### 3. Admin match management

**Data layer — `src/lib/admin-matches.ts`:**

- `setMatchResult(matchId, homeScore: number | null, awayScore: number | null, status)` —
  writes scores + status.
- `updateMatchMeta(matchId, { homeTeamId, awayTeamId, venueId, kickoffAt, groupName })` —
  writes metadata; team ids may be `null` (TBD).
- `getAdminMatches()` — returns all matches enriched with team/venue data for the table
  (reuses/parallels `getFixtures` shaping; no per-user prediction join needed).

**Server actions — `src/app/admin/matches/actions.ts`:**

- `saveResult(matchId, home, away, status)` and `saveMatchMeta(matchId, meta)`.
- Each: `getAdminUser()` guard → validate inputs (reuse `validatePredictionScores` for
  score bounds; allow clearing to null) → mutate → `recomputeMatch(matchId)` →
  `revalidatePath('/fixtures')` and the admin path. Return `{ ok, error? }`.

**Pages:**

- `src/app/admin/page.tsx` — admin dashboard; links to Matches (placeholders for future
  Ads/Settings).
- `src/app/admin/matches/page.tsx` — server component; loads `getAdminMatches()`, groups by
  stage (reusing fixtures grouping helpers), renders an editable row per match.
- `src/components/admin/match-row.tsx` — client component per match:
  - **Quick result entry** (common path): home/away number inputs + status `<select>` +
    Save → `saveResult`.
  - **"Edit details"** expander: home/away team `<select>` (includes a "TBD" / none option
    for knockout slots), kickoff datetime input, venue `<select>`, group input → `saveMatchMeta`.

### 4. Match-card scored state — `src/components/fixtures/match-card.tsx`

`FixtureMatch` already carries `status`, `homeScore`/`awayScore`, and
`prediction.pointsAwarded`. Add a final-score line shown when `status === 'finished'`;
`PredictionCard`'s existing scored badge renders the +3/+1/0 outcome. No data-layer change
needed.

### 5. Navigation

Show an **Admin** link in the nav only for admins. The nav/app-shell resolves admin status
server-side (`getAdminUser()` / synced `profiles.isAdmin`) and passes a boolean down.

## Data flow

1. Admin opens `/admin/matches` → layout guard passes → table renders all matches.
2. Admin enters a final score + sets status `finished` → `saveResult` action.
3. Action guards admin, validates, writes the result, calls `recomputeMatch`.
4. `recomputeMatch` scores every prediction for that match against the config.
5. `revalidatePath('/fixtures')` → players see the real score + their points badge.
6. If the admin later edits or reverts the result, `recomputeMatch` re-scores or clears
   `pointsAwarded` accordingly.

## Error handling

- Non-admin hitting `/admin/*` → redirect to `/`. Non-admin invoking an action →
  `{ ok: false, error }`, no mutation.
- Invalid scores (non-integer, out of 0–30 bound) → validation error, no mutation.
- Setting `status = finished` with a missing score → reject with an error (a finished match
  must have both scores) so scoring never runs on partial data.
- Missing `app_settings` row → `getScoringConfig` falls back to `DEFAULT_SCORING`.

## Testing

- **`src/lib/scoring.test.ts`** — `scoreMatch`: exact, result (win/draw/loss), wrong → 0;
  honors custom config values.
- **Recompute tests** — finished match scores all predictions; reverting to
  scheduled/live or clearing a score resets `pointsAwarded` to null; respects config.
- **`src/lib/admin.test.ts`** — `getAdminEmails` parsing (whitespace, case, empties);
  `isAdminEmail` true/false.
- Existing `locks`/`predictions`/`fixtures` tests continue to pass.

## Environment

- New env var `ADMIN_EMAILS` (comma-separated owner emails) in `.env.local` and Vercel
  project env. Document in `CLAUDE.md`.

## Out of scope / later

- Admin settings editor (scoring constants, `predictionsLockAt`, `prizeText`) — Phase 4/5.
- Ad management, team/player editing — Phase 6.
- Bracket/award scoring + their recompute — Phase 5.
