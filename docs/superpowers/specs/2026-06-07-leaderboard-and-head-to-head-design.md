# Phase 4 — Leaderboard + Head-to-Head — Design

**Date:** 2026-06-07
**Status:** Approved (brainstorming)
**Phase:** 4 of 6 (per `docs/superpowers/specs/2026-06-01-worldcup-2026-predictor-design.md`)

## Problem / goal

Players make match predictions and earn points, but there is nowhere to see **who is
winning**. The `/leaderboard` nav link 404s and the homepage rank-strip shows rank "soon".
Phase 4 delivers the competitive core: a leaderboard (overall, by stage, by match) with a
top-3 podium and prize marker, a head-to-head friend comparison, and the real overall rank
on the homepage.

## Scope

In scope:
- `/leaderboard` page: top-3 podium + ranked list; tabs **Overall**, **This round** (by
  stage, with a stage selector), **By match** (per-match pick breakdown).
- `/h2h` page: you vs a friend you pick; per-match comparison + running who-leads indicator.
- Homepage `RankStrip`: replace "soon" with the signed-in user's real overall rank.
- Prize marker on leaderboard #1, read from `app_settings.prizeText`.

Out of scope (deferred):
- **Bracket + award points** — Phase 5. Phase-4 leaderboards sum match-prediction points
  only. Because totals are just `SUM(pointsAwarded)`, bracket/award points fold in
  automatically once Phase 5 records them — no leaderboard rewrite needed.
- **Admin prize-text editor** — Phase 6 polish. Phase 4 only *reads* `prizeText` (shows
  nothing if null).
- Private mini-leagues — out of scope for v1 (per design spec).

## Key decisions (from brainstorming)

1. **"This round" = by stage.** Scope points to a tournament stage (group / r32 / r16 / qf /
   sf / third / final) via a stage selector; no calendar-matchday concept is introduced.
2. **Tie-breaking:** equal **points** share a rank (e.g. two players both rank 2). Display
   order within equal points breaks by **exact-scoreline count** desc, then **display name**.
   Two players with identical (points, exactCount) share the same rank number. The #1 prize
   marker shows on every player tied at rank 1.
3. **Head-to-Head:** **you vs a friend** chosen from a dropdown of the circle.
4. **H2H placement:** its own **`/h2h`** route; leaderboard rows link to `/h2h?vs=<userId>`.
5. **H2H hides a friend's pick until that match locks** (kickoff). Before lock, the
   opponent's pick column shows a locked placeholder — you can't copy their pick. Your own
   pick always shows. Reuses the existing `isMatchLocked` rule.

## Architecture

Follows the established **pure-selector + thin DB-reader** pattern (`board.ts` /
`standings.ts` for pure logic; `get-fixtures.ts` for DB reads). No schema changes, no
migrations.

### Data layer

**`src/lib/leaderboard.ts`** (pure, TDD'd — no DB import, client-safe):

```
type LeaderPlayer = { id: string; displayName: string | null; avatarSeed: string | null };
type ScoredPrediction = { userId: string; matchId: string; homeScore: number; awayScore: number; pointsAwarded: number | null };
type LeaderRow = { userId; displayName; avatarSeed; points; exactCount; predictedCount; rank };

buildLeaderboard(
  players: LeaderPlayer[],
  predictions: ScoredPrediction[],
  exactByPrediction: (p) => boolean,   // exact when pointsAwarded === ptsExact OR home/away both match — see below
  opts?: { matchIdsInScope?: Set<string> }   // when present, only count predictions for these matches ("This round")
): LeaderRow[]
```

- **points** = sum of `pointsAwarded ?? 0` over the player's in-scope predictions.
- **exactCount** = count of in-scope predictions that scored an exact scoreline. Exactness is
  determined by the caller via a predicate so the pure fn stays free of scoring-config
  coupling; the DB reader supplies `(p) => p.pointsAwarded === cfg.ptsExact` using the live
  `ScoringConfig` (`getScoringConfig`). (Result-only and exact points differ, so equality
  with `ptsExact` distinguishes an exact hit. Edge: if an admin sets `ptsResult === ptsExact`
  the two collapse — acceptable; tiebreak just becomes "any scored prediction".)
- **predictedCount** = number of in-scope predictions the player made (whether scored yet or
  not).
- **rank**: sort by points desc, exactCount desc, displayName asc. Assign rank by
  (points, exactCount) groups — players equal on both share a rank; the next distinct group
  gets `rank = index + 1` (standard "1224" competition ranking).

**`buildMatchLeaderboard(matchId, players, predictions)`** → `{ userId, displayName,
avatarSeed, pick: {home,away} | null, points: number | null }[]`, sorted points desc then
displayName. ("By match" tab.)

**`buildHeadToHead(meId, themId, matchesInOrder, predictionsByUserMatch, isLocked)`** →
```
{
  rows: { matchId; locked; myPick|null; myPoints|null; theirPick|null; theirPoints|null; winner: 'me'|'them'|'tie'|null }[];
  myTotal: number; theirTotal: number; leader: 'me'|'them'|'tie';
}
```
- `theirPick` is **null when `!locked`** (hidden pre-kickoff); `myPick` always shown.
- per-row `winner` compares points only for matches both have scored (else null).
- `leader` compares `myTotal` vs `theirTotal`.

**`src/lib/get-leaderboard.ts`** (server, DB read): loads `profiles`, all `matchPredictions`,
and matches; returns the shapes above need (players, predictions, and a stage→matchIds map).
Exactness predicate built from `getScoringConfig()`.

### Pages & components

- **`src/app/leaderboard/page.tsx`** (server): loads leaderboard data + `prizeText` + current
  user; renders `LeaderboardView`.
- **`src/components/leaderboard/leaderboard-view.tsx`** (client): tab + stage state in URL
  (`?tab=overall|round|match`, `?stage=`, `?match=`), synced via `history.replaceState`
  (same approach as fixtures). Renders `Podium` + the active tab's list.
- **`src/components/leaderboard/podium.tsx`**: top-3 retro StickerCards (#1 centered/gold with
  👑 + prize marker), `PixelAvatar` via existing `sprite.ts`.
- **Ranked list rows**: rank · `PixelAvatar` · name · predicted count · points pill. Whole row
  links to `/h2h?vs=<userId>` (no nested anchors — plain content).
- **By match tab**: a match picker (reuse fixtures' stage/day affordance minimally — a simple
  `<select>` of scored/locked matches) → `buildMatchLeaderboard` list.
- **`src/app/h2h/page.tsx`** (server): `?vs=<userId>` (defaults to leaderboard leader, or the
  first other player, when absent or self). Loads data; renders `H2HView`.
- **`src/components/h2h/h2h-view.tsx`** (client): header (both avatars + who-leads badge +
  totals), opponent `<select>` dropdown (updates `?vs=`), and a compact per-match comparison
  list (MatchRow-like rows showing both picks + points; locked-placeholder for opponent's
  unlocked picks).
- **Homepage**: compute the signed-in user's overall rank from `buildLeaderboard` and pass it
  into `RankStrip`, replacing the "soon" text with `#<rank> of <n>`.

### Nav

`/leaderboard` already in nav. Add nothing new to nav for `/h2h` (reached from leaderboard
rows) unless trivially desired — keep nav lean.

## Error / empty states

- **No scored matches yet** (pre-tournament — the current state): everyone has 0 points.
  Leaderboard still renders, ordered by predictedCount-driven tiebreak → name; podium shows
  top 3 with 0 pts. Homepage rank shows the user's position among equals (all tied at rank 1
  → show `#1 of n` honestly, since ties share rank).
- **Fewer than 3 players:** podium renders only the players that exist (1 or 2 cards).
- **H2H against self / unknown `vs`:** fall back to the leader (or first other player); if the
  circle has only one player, show an empty-state message.
- **Signed-out:** leaderboard + h2h are viewable read-only; homepage rank-strip already gates
  on `user`.

## Testing (Vitest, TDD for `src/lib/leaderboard.ts`)

- `buildLeaderboard`: points sum; exactCount tiebreak; shared ranks for equal (points,
  exactCount); name as final order; `matchIdsInScope` stage filter; all-zero (pre-tournament)
  ordering; empty players.
- `buildMatchLeaderboard`: per-player pick/points; null pick for non-predictors; sort.
- `buildHeadToHead`: totals; `leader` me/them/tie; per-row winner; **opponent pick hidden when
  not locked**; own pick always present.
- Existing suites stay green.

## Files summary

Create:
- `src/lib/leaderboard.ts`, `src/lib/leaderboard.test.ts`
- `src/lib/get-leaderboard.ts`
- `src/app/leaderboard/page.tsx`, `src/components/leaderboard/leaderboard-view.tsx`,
  `src/components/leaderboard/podium.tsx`
- `src/app/h2h/page.tsx`, `src/components/h2h/h2h-view.tsx`

Modify:
- `src/app/page.tsx` + `src/components/home/rank-strip.tsx` — real overall rank.
- `src/lib/app-settings.ts` — add `getPrizeText()` reader (reads `appSettings.prizeText`).

No schema changes, no migrations.
