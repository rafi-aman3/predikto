@AGENTS.md

# World Cup 2026 Predictor

Monolithic **Next.js 16** (App Router) + **Supabase** (Postgres / Auth / Storage) +
**Drizzle ORM** app for a friend circle to predict World Cup 2026 (match scorelines +
knockout bracket + tournament awards), earn points, and compete on leaderboards. Top of
the overall leaderboard wins a real prize from the owner. Self-managed ad slots +
team/player profiles. Theme: **Retro Pitch**. Tournament starts **June 11, 2026** — build
lean and fast.

## Status

- **Phase 1 (Foundation): COMPLETE.**
- **Phase 2 (Fixtures + Match Predictions): COMPLETE.** `/fixtures` page (see the rework
  bullet below for the current shape); predictions save via the `savePrediction` server
  action (`src/app/fixtures/actions.ts`) with server-side kickoff lock. Data layer:
  `src/lib/fixtures.ts` (now pure selectors/types) + `src/lib/get-fixtures.ts` (the DB read)
  + `src/lib/predictions.ts`.
- **Phase 3 (Admin + Scoring): COMPLETE.** Admin match management at `/admin/matches`
  (result entry + full metadata editing incl. TBD knockout slots; `scheduled|live|finished`
  status), gated by the `ADMIN_EMAILS` allowlist. Scoring engine `src/lib/scoring.ts`
  (`scoreMatch`, `computePredictionPoints`, `recomputeMatch`) recomputes match-prediction
  points per result; reverting a result clears them. Scored fixtures cards. Data/config:
  `src/lib/admin-matches.ts`, `src/lib/app-settings.ts`, `src/lib/admin.ts`. Settings
  editor (scoring constants / lock / prize) deferred to Phase 4/5. A nav **Sign out**
  button (`src/components/sign-out-button.tsx`) was also added.
- **Deployed on Vercel via GitHub integration — every push to `main` auto-deploys.**
  Production URL is in the Vercel dashboard (project `predikto`; GitHub
  `rafi-aman3/predikto`).
- **Interleaved pre-Phase-4 work (countdown + local time + full fixtures): COMPLETE.**
  Homepage live `<Countdown>` to the first kickoff + "Next matches" teaser
  (`src/app/page.tsx`); all fixture times **and** day-grouping render in the visitor's local
  timezone via the `<LocalTime>` client component + the pure `groupByLocalDate`/`timeRemaining`
  helpers (`src/lib/local-time.ts`); calendar-grid/timeline are now client components that
  group locally. The **full real WC2026 schedule is loaded**: 48 teams (12 groups A–L),
  16 venues, 104 matches incl. the third-place play-off (new `third` stage enum +
  migration `drizzle/0001_strong_butterfly.sql`). Shipped to `main` + the migration applied
  and the 104-match seed loaded into the (single, = prod) DB. ⚠️ Kickoff *times* in
  `data/seed.json` are best-effort estimates — admin should verify exact times against the
  official FIFA schedule before launch (dates/venues/matchups are sourced).
- **Retro Pitch Arcade design system + core pages (pre-Phase-4): COMPLETE & DEPLOYED.**
  App-wide 16-bit "sticker-album arcade" re-skin. New `@theme` tokens `ink #06231a` /
  `chalk #f8fff4`; fonts **Bungee** (display) / **VT323** (pixel numerals) / **Nunito** (body)
  via `next/font/google` (Geist + Georgia dropped); `rp-*` utilities + `prefers-reduced-motion`
  block in `globals.css`. Shared primitives in `src/components/retro/` (StickerCard, BadgeFlag,
  StatusPill, GroupTag, PredictCTA, PixelCountdown, ScoreStepper/QuickScorelineChips,
  PixelAvatar+`sprite.ts`, SoundToggle/SfxProvider/`useSfx`, TeamLink). Pure selectors
  `src/lib/board.ts` (buildGroupBoard/buildRankStrip/pickNextUnpredicted/aggregatePredictions)
  + `src/lib/standings.ts` (computeGroupStandings) + `src/lib/match-social.ts` + `src/lib/teams.ts`
  — all TDD'd; **no schema changes**. New pages: game-board homepage (`src/app/page.tsx`),
  **`/match/[id]`** predict page (steppers, lock countdown, circle-% revealed only *after* you
  lock, next-unpredicted-match loop), **`/team/[code]`** (NES pixel-avatar lineup), **`/player/[id]`**,
  **`/table`** group standings (in topbar; Pts→GD→GF→name). Country names/flags everywhere link to
  the team page via `TeamLink`. Opt-in 8-bit SFX (muted by default, reduced-motion gated). Fixtures/
  nav/auth/onboarding/admin restyled. **Remaining deferrals (intentional):** `/bracket` nav
  link 404s (Phase 5); Golden Boot / Best Player buttons are visual-only (Phase 5); admin Save
  buttons use alert-red `rp-cta`. (`/leaderboard` + homepage rank shipped in Phase 4 below.)
  Specs/plans:
  `docs/superpowers/specs/2026-06-05-retro-arcade-design-system-design.md`,
  `docs/superpowers/plans/2026-06-05-retro-arcade-design-system.md`,
  `docs/superpowers/plans/2026-06-06-standings-and-team-links.md`.
- **Fixtures page rework (pre-Phase-4): COMPLETE & DEPLOYED.** `/fixtures` re-done as a
  sports-app-style hybrid: a segmented **By Day** (horizontal `DateStrip` of match days,
  defaulting via `pickDefaultDay` — first match day pre-tournament, today/next during) and
  **By Stage** (`StageBoard` sub-tabs: Groups A–L / R32 / … / Final). Compact **pick-forward
  rows** (`MatchRow`): the whole row links to `/match/[id]` (no nested anchors — team
  flag/code render plain, not `TeamLink`) and shows prediction state as a chip
  (`PREDICT` / `YOU h–a` / `LOCKED` / `LIVE` / finished result + `+pts`) via the pure
  `predictionRowState` selector. View/day/stage held in the URL and synced with
  `history.replaceState` (no server refetch — all matches load once). **Removed:** the old
  Calendar/Timeline/Stage three-view toggle, the group/stage filter chips, and the inline
  `MatchCard`/`PredictionCard` (predicting now lives only on `/match/[id]`). New client-safe
  split: `getFixtures` moved out of `fixtures.ts` (which imported `db`) into
  `src/lib/get-fixtures.ts` so client components can import the pure selectors/types.
  New components in `src/components/fixtures/`: `fixtures-view`, `date-strip`, `match-row`
  (+ reworked `stage-nav`→`StageBoard`). `pickDefaultDay`/`predictionRowState` TDD'd; no
  schema changes. Specs/plan:
  `docs/superpowers/specs/2026-06-07-fixtures-rework-design.md`,
  `docs/superpowers/plans/2026-06-07-fixtures-rework.md`.
- **Phase 4 (Leaderboard + Head-to-Head): COMPLETE & DEPLOYED.** `/leaderboard` page —
  top-3 **podium** (👑 #1 + prize marker read from `app_settings.prizeText`) and tabs
  **Overall** / **This round** (by stage selector) / **By match** (per-player picks; only
  *locked* matches selectable so picks don't leak). `/h2h` **head-to-head** — you vs a friend
  picked from a dropdown, running who-leads + totals, per-match comparison; **a friend's pick
  is hidden (🔒) until that match locks**. Leaderboard rows link to `/h2h?vs=<userId>`; tab/
  stage/match/vs held in the URL via `history.replaceState`. Homepage `RankStrip` now shows
  the real overall rank (`#n of m`) instead of "soon". Pure TDD'd selectors
  `src/lib/leaderboard.ts` (`buildLeaderboard` — points→exact-count→name, shared "1224" ranks,
  optional stage scope; `buildMatchLeaderboard`; `buildHeadToHead`) + thin DB reader
  `src/lib/get-leaderboard.ts` (precomputes per-prediction `exact` from the live scoring
  config; reuses `getFixtures` for match metadata). Totals are `SUM(pointsAwarded)`, so
  Phase-5 bracket/award points fold in automatically. `getPrizeText()` added to
  `app-settings.ts`; admin prize editor deferred to Phase 6. No schema changes. Specs/plan:
  `docs/superpowers/specs/2026-06-07-leaderboard-and-head-to-head-design.md`,
  `docs/superpowers/plans/2026-06-07-leaderboard-and-head-to-head.md`.
- **Phase 5 (Bracket + Awards): COMPLETE.** `/bracket` is an interactive **bracket simulator**
  (Telegraph-style, single reactive page with a sticky section-nav — NOT a wizard): order all 12
  groups 1→4 → pick the best 8 of your 12 third-placed teams → R32 **auto-seeds** → tap winners up
  the tree (R32→R16→QF→SF→Final) → pick Champion (from your 2 finalists) → awards panel (Golden
  Boot / Best Player / Surprise; champion+runner-up derived from the final). Saves via the
  `saveBracket` server action (auth + server-side lock at `app_settings.predictions_lock_at` +
  structural `validateBracket` + transactional upsert). **Group predictions ARE scored** (exact
  position +2/team, advancing-3rd +1) alongside reaches-round bracket points (R16 +1 / QF +2 /
  SF +3 / Final +5) and awards (champion +10, others +5) — all auto-derived from real results
  (group standings via `computeGroupStandings`, reached-round from knockout match participants,
  champion/runner-up from the final) and recomputed for all users on admin result/settings save
  (`src/lib/bracket-recompute.ts`). All points live in `pointsAwarded`, folded into the
  leaderboard **Overall** total via a `bonusByUser` arg on `buildLeaderboard`. New
  `/admin/settings` = full editor (award actuals + predictions lock date + prize text + ALL
  scoring constants). **Schema change:** new `group_predictions` table + `app_settings` cols
  `pts_group_position`/`pts_third_qualifier`/`actual_{golden_boot_player,best_player,surprise_team}_id`
  (migration `drizzle/0002_hesitant_steve_rogers.sql`, applied to the single = prod DB). Pure
  TDD'd `src/lib/bracket.ts` (`R32_TIES` tunable template — ⚠️ **simplified deterministic**
  seeding: real top-2 wiring + ranked thirds fill, NOT FIFA's combination table; **verify
  pairings vs the official bracket before launch**; `buildR32Field`, `reconstructBracket` &
  `validateBracket` are order-independent/Set-based) + `src/lib/bracket-scoring.ts` + thin
  reader `src/lib/get-bracket.ts`. UI in `src/components/bracket/` (simulator, group-orderer,
  thirds-picker, knockout-tree, awards-panel). Nav `/bracket` link + homepage teaser now resolve.
  ⚠️ Penalty-shootout finals aren't modeled — a drawn final yields no champion, so admin enters a
  decisive score reflecting the shootout winner. Specs/plan:
  `docs/superpowers/specs/2026-06-07-bracket-and-awards-design.md`,
  `docs/superpowers/plans/2026-06-07-bracket-and-awards.md`.
- Then: **Phase 6 (Profiles + Ads + Polish)** — team/player profile pages, ad slot rendering +
  admin management, responsive polish. (Golden Boot / Best Player CTAs on `/match` are still
  visual-only; the real award picks live on `/bracket`.)

## Source of truth

- Design spec: `docs/superpowers/specs/2026-06-01-worldcup-2026-predictor-design.md`
- Plans: `docs/superpowers/plans/` (Phase 1 done; later phases added as we go)
- Read the spec before architectural decisions; update it if the design changes.

## Stack & key conventions

- **Next.js 16 specifics:** middleware is `src/proxy.ts` (NOT `middleware.ts`); read
  `node_modules/next/dist/docs/` before relying on memorized Next APIs.
- **Tailwind v4:** theme via `@theme` tokens in `src/app/globals.css` (no
  `tailwind.config.ts`). Colors: `pitch #0a3d26`, `pitch-light #11663f`, `ink #06231a`
  (hard offset-shadow/outline), `gold #ffcb05`, `cream #fff7e6`, `chalk #f8fff4`,
  `alert #d7263d`. ⚠️ Gold is fills/badges only — **never text on cream** (fails contrast).
  Fonts (`next/font/google`): `font-display` Bungee (headings/buttons), `font-pixel` VT323
  (scores/countdown/stats), `font-sans` Nunito (body/data). Reusable styles = `rp-*` utilities
  (`.rp-card`/`.rp-cta`/`.rp-pill`/`.rp-tag`/`.rp-shadow*`/`.rp-hover-lift`/`.rp-stamp`/
  `.rp-scanlines`), all decorative motion gated by `@media (prefers-reduced-motion: reduce)`.
- **Supabase:** `DATABASE_URL` uses the transaction pooler (port 6543) with
  `postgres({ prepare: false })`. Secrets in `.env.local` (gitignored); `drizzle.config.ts`
  and `src/db/index.ts` load it explicitly via dotenv. New API key format
  (`sb_publishable_…` → anon var, `sb_secret_…` → service-role var).
  ⚠️ **Single Supabase project** (`ecqvztcqsgvfwmxbpnna`) — there is no separate dev/prod
  database; `.env.local` and the Vercel prod env point at the **same** DB. So local
  `drizzle-kit migrate` / `npm run db:reset` run against **production**. `db:reset` truncates
  everything (incl. predictions) — treat as pre-launch only.
- **Auth:** email + password only for now; **Google OAuth deferred** to a final step.
  Login UI in `src/app/auth/login`, onboarding gate in `src/app/onboarding`. Profiles
  mirror `auth.users` via the `profiles` table.
- **Admin:** gated by the `ADMIN_EMAILS` env allowlist (comma-separated owner emails),
  the source of truth — checked server-side via `getAdminUser` in `src/lib/admin.ts`
  (admin layout guard + per-action re-check; never trusted from the client). Set it in
  `.env.local` and the Vercel project env. (`profiles.isAdmin` exists but is not the gate
  in v1.)
- **Scoring constants live in the `app_settings` table** (tweakable without redeploy).
  Defaults: match exact +3 / result +1; bracket R16 +1, QF +2, SF +3, finalist +5;
  awards champion +10, others +5. Helpers in `src/lib/scoring-config.ts`.
- **Locks enforced server-side** (`src/lib/locks.ts`): matches lock at kickoff; bracket +
  awards lock at `app_settings.predictions_lock_at`. Never trust the client.
- **Results are admin-entered** (no football API in v1); entering a result recomputes
  affected predictions.
- **Seed:** `npm run db:seed` (idempotent) from `data/seed.json`. The full WC2026 schedule
  (48 teams, 16 venues, 104 matches incl. third-place) lives in `data/seed.json`.
  `npm run db:reset` truncates all data tables (`RESTART IDENTITY CASCADE`) then reseeds — a
  clean slate that also **wipes predictions**, so it's pre-launch only. (Run once against the
  prod `DATABASE_URL` to load the real fixtures there.)
- **Local time + countdown:** all kickoff times and day-grouping render in the visitor's
  browser timezone via the `<LocalTime>` client component (mount-guarded to avoid hydration
  mismatch); the homepage shows a live `<Countdown>` to the first kickoff. Pure helpers
  (`timeRemaining`, `groupByLocalDate`) live in `src/lib/local-time.ts` and are unit-tested.

## Commands

- `npm run dev` · `npm run build` · `npm test` (Vitest) · `npm run lint` · `npm run db:seed`
  · `npm run db:reset` (truncate + reseed — pre-launch only)
- DB migrations: `npx drizzle-kit generate` then `npx drizzle-kit migrate`.

## Workflow

- brainstorm → writing-plans → subagent/inline execution; **commit per task locally, push
  once per completed phase** (each push to `main` auto-deploys on Vercel — one deploy per
  phase). Do not commit `.env*` or `.superpowers/`.
