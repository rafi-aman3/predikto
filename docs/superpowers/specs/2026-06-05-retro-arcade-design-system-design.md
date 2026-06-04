# Retro Pitch Arcade — Design System & Core Pages

**Date:** 2026-06-05
**Status:** Approved (brainstorm) — ready for implementation plan
**Scope:** Full app design system + restyle/build of all pages. Sits *before* Phase 4
(Leaderboard + Head-to-Head); Phase 4–6 pages inherit this system as they're built.

## Goal

Give the whole app a cohesive **classic retro-game** feel — a "16-bit sticker album /
arcade" world — and turn the homepage into a playful **game-board** view of the whole
tournament. Push prediction everywhere: every group, match, stadium, team, and player
surface routes the user toward locking a pick.

This is a visual/system overhaul. **No database schema changes** — it builds on the
existing `teams`, `players`, `venues`, `matches`, `predictions`, `app_settings` tables and
the existing `fixtures` / `predictions` / `scoring` data layer.

## Chosen direction

**A · 16-bit Sticker Album** (chosen over 8-bit pixel, CRT neon, and handheld dot-matrix).
Panini sticker-book × SNES sports: chunky outlines, hard offset shadows, gold badges, cream
panels on the grass pitch. Keeps the existing light/warm identity and stays readable for a
data-heavy app (104 fixtures, tables), while reading as "retro game" instantly. Accents
(pixel numerals, a subtle hero scanline shimmer) are borrowed from the other directions
without going dark or monochrome.

## Design system — "Retro Pitch Arcade"

### Palette (Tailwind v4 `@theme` tokens in `src/app/globals.css`)

| Token | Hex | Role |
|-------|-----|------|
| `--color-pitch` | `#0a3d26` | primary dark green, borders, text on cream |
| `--color-pitch-light` | `#11663f` | grass stripe / panels-on-pitch |
| `--color-ink` *(new)* | `#06231a` | hard offset shadow + outline color (printed-sticker pop) |
| `--color-gold` | `#ffcb05` | fills, badges, highlights — **never text on cream** (contrast) |
| `--color-cream` | `#fff7e6` | card/panel surface |
| `--color-chalk` *(new)* | `#f8fff4` | pitch line markings, subtle highlights |
| `--color-alert` | `#d7263d` | primary CTA, urgency (locks, countdowns) |

**Contrast rules (WCAG AA, 4.5:1):** pitch/ink text on cream/chalk = pass. Cream text on
pitch = pass. Gold on pitch = pass (gold numerals on pitch boxes OK). **Gold as text on
cream = fail → gold only as fill/border/badge.** Color is never the sole signal (pair with
icon/label).

### Typography (3 roles, via `next/font/google` in `layout.tsx`)

| Role | Font | Usage |
|------|------|-------|
| Display | **Bungee** | headings, buttons, group/team names |
| Numerals/terminal | **VT323** | scores, countdown, stats, percentages, pills |
| Body/data | **Nunito** (400/700/800) | paragraphs + dense data (fixtures lists, tables) |

Georgia serif and Geist are dropped. Press Start 2P is **not** used (too wide for data);
reserved at most for tiny decorative accents.

### Core components — `src/components/retro/`

All share the visual contract: **3–4px `pitch` border · hard `ink` offset shadow (no blur)
· 8–14px radius**. UI icons use **Lucide SVG** (lock, star, play, chevrons); team flags use
the existing `teams.flag` data (emoji/asset key).

- `StickerCard` — base cream panel with border + hard shadow (replaces `.rp-card`).
- `BadgeFlag` — circular gold flag/crest badge (sizes: sm lineup, md fixture, lg hero).
- `PixelCountdown` — digit boxes (pitch bg, gold VT323 numerals); refactor of existing
  `countdown.tsx`. Ticks seconds; no infinite bounce.
- `ScoreStepper` — big VT323 numeral with ▲/▼ pitch buttons; extracted from the existing
  `prediction-card`. 44px+ touch targets.
- `QuickScorelineChips` — `1-0 · 2-1 · 0-0 · 1-1 · 3-0`; selected fills gold.
- `PredictCTA` — fat alert-red commit button with ink shadow.
- `StatusPill` — predict/progress pill (`▶ predict 6` / `✓ 4/6 predicted`).
- `GroupTag` — gold tag chip (`GROUP A`).
- `PixelAvatar` — player avatar: render `players.photoUrl` through a CSS pixelate/posterize
  filter (`image-rendering` + reduced color steps); **fallback to a generated deterministic
  sprite** (seeded by name/shirt #, GK kit distinct) when no photo. Always shows shirt #.
- `SoundToggle` + `useSfx` hook — see Sound below.

Utilities added to `globals.css`: `.rp-card`, `.rp-shadow`, `.rp-cta`, `.rp-pill`,
`.rp-badge`, `.rp-tag`, plus a `@media (prefers-reduced-motion: reduce)` block.

### Motion (all gated by `prefers-reduced-motion`)

ease-out, ≤300ms, 1–2 animated elements per view:
- Sticker hover: lift 2px + shadow grows (transform/opacity only).
- Predict lock: quick gold "stamp" pop (+ optional 8-bit blip if sound on).
- Countdown: per-second tick.
- Section reveal: gentle fade-up.
- Hero only: subtle CRT scanline shimmer (disabled under reduced-motion).

### Sound (opt-in)

Subtle 8-bit SFX on key moments — **lock pick**, **award pick**, **points earned**.
**Muted by default**, toggled via `SoundToggle` in the nav, persisted to `localStorage`.
`useSfx` is a no-op when muted or under reduced-motion-implied quiet preference. Small WebAudio
or short audio assets; no autoplay, no sound without explicit user opt-in.

## Pages

### `/` — Game-board homepage (chosen: "game-board arcade map")

Vertical scroll = the whole tournament:
1. **Hero** — "WORLD CUP 2026", live `PixelCountdown` to first kickoff, `▶ START
   PREDICTING` CTA. (Subsumes the current homepage hero.)
2. **Rank strip (signed-in only)** — your rank, points, current streak, and "X matches left
   to predict". Hidden when signed out.
3. **Group Stage board** — all 12 groups (A–L) as `StickerCard`s in a responsive grid (3-up
   desktop / 2-up mobile), each showing its 4 team `BadgeFlag`s + a `StatusPill`
   (`▶ predict 6 matches` / `✓ n/6 predicted`). The pill is the per-group predict hook.
4. **Stadiums** — horizontal scroll row of 16 venue sticker cards (kept per decision).
5. **Knockout bracket teaser** — mini bracket tree with gold final, `▶ BUILD YOUR BRACKET`
   CTA.

### `/fixtures` — restyle existing

Re-skin the existing Calendar / Timeline / Stage views, `ViewToggle`, `Filters`,
`StageNav`, `match-card`, and `prediction-card` into the system (StickerCard, steppers,
pills). Local-time rendering and existing filter behavior unchanged. Each fixture links to
`/match/[id]`.

### `/match/[id]` — **new** match-details / predict page

The focused predict screen. Tapping any fixture/group/stadium routes here.
- Context bar: `GroupTag`, stadium, kickoff in local time.
- VS hero: both teams as large `BadgeFlag`s.
- `ScoreStepper` ×2 + `QuickScorelineChips`.
- Live lock countdown (`🔒 locks in …`, at kickoff — server-enforced via existing `locks`).
- `PredictCTA` "LOCK IN MY PICK" + points rule line (from `scoring-config`).
- **Circle prediction %** — aggregate of *other* users' predictions for this match, shown
  **only after the viewer's pick is locked** (no anchoring). Server-side guard: the
  aggregate is not returned until the viewer has a saved prediction (or kickoff passed).
- **Next-match loop**: `▶ NEXT UNPREDICTED MATCH` advances to the user's next unpredicted
  fixture.

### `/team/[code]` — **new** team details

- Header: crest `BadgeFlag`, FIFA rank, WC titles, coach, group.
- Lineup on a mini-pitch in formation, players as `PixelAvatar`s (tap → player page).
- Predict hook: award picks (Golden Boot / Best Player) where eligible.

### `/player/[id]` — **new** player details

- Large `PixelAvatar`, name, position, shirt #, club, age, caps.
- `⭐ PICK FOR GOLDEN BOOT` / Best Player CTA — shown per `goldenBootEligible` /
  `bestPlayerEligible`.

### Chrome — restyle

- `nav` — arcade top bar: pixel/Bungee logo, links, `SoundToggle`, sign-in/out.
- `auth/login`, `onboarding`, `admin/*` — re-skinned to the system (sticker panels, fonts,
  CTAs). Admin keeps its functional density; just adopts tokens/components.

## Data flow

- Reuses `src/lib/fixtures.ts`, `src/lib/predictions.ts`, `src/lib/scoring*.ts`,
  `src/lib/locks.ts`, `src/lib/app-settings.ts` — unchanged contracts.
- **New read helpers:**
  - `getTeamWithSquad(code)` → team row + ordered squad (`players`).
  - `getPlayer(id)` → player row (+ team for context).
  - `getMatchPredictionAggregate(matchId)` → `{ homeWin%, draw%, awayWin%, topScorelines }`
    over all users' predictions; **caller must pass/confirm the viewer's pick is locked**
    before exposing it (enforced in the page/server action, not the client).
  - `getNextUnpredictedMatch(userId, afterMatchId)` → next fixture without a saved
    prediction, for the loop.
- "Matches left to predict" / rank / streak for the rank strip derive from existing
  predictions + (Phase 4) leaderboard aggregates; until Phase 4 ships scoring leaderboards,
  the rank strip shows points + matches-left and a "rank — coming soon" placeholder rather
  than blocking on Phase 4.

## Accessibility & quality bar

- Contrast rules above; color never the sole signal.
- Touch targets ≥44px (steppers, chips, CTAs).
- Visible focus rings; keyboard nav; `aria-label`s on icon-only buttons; `alt` on avatars.
- `prefers-reduced-motion` disables decorative motion + scanlines.
- Body/data text ≥16px on mobile; no horizontal scroll except intentional stadium/bracket
  rows (which are keyboard/scroll accessible).
- Lucide SVG icons for UI (not emoji); flags via data.

## Build order

1. Tokens + fonts + `globals.css` utilities + reduced-motion block.
2. `src/components/retro/` primitives (incl. `PixelAvatar`, `SoundToggle`/`useSfx`).
3. Homepage game-board (hero, rank strip, groups, stadiums, bracket teaser).
4. `/match/[id]` (steppers, chips, lock, reveal-after-lock %, next-match loop).
5. `/team/[code]` + `/player/[id]` + read helpers.
6. Restyle `/fixtures`, `nav`, `auth`, `onboarding`, `admin`.
7. Sound polish pass.

## Out of scope / non-goals

- No schema/migration changes.
- No new prediction *rules* or scoring changes (visual/flow only).
- Leaderboard/Head-to-Head logic remains Phase 4 (this only adds the rank-strip surface,
  gracefully degraded until Phase 4).
- Google OAuth still deferred.

## Open follow-ups (not blocking)

- Final pixel-sprite fallback art style for `PixelAvatar` (generation approach detailed at
  implementation).
- Exact SFX assets and the WebAudio vs. asset-file decision.
