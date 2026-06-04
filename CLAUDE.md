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
- **Phase 2 (Fixtures + Match Predictions): COMPLETE.** `/fixtures` page with
  Calendar/Timeline/Stage views + group/stage filters; prediction card (steppers + quick
  scorelines) saving via the `savePrediction` server action with server-side kickoff lock.
  Data layer: `src/lib/fixtures.ts`, `src/lib/predictions.ts`.
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
  migration `drizzle/0001_strong_butterfly.sql`). ⚠️ Kickoff *times* in `data/seed.json` are
  best-effort estimates — admin should verify exact times against the official FIFA schedule
  before launch (dates/venues/matchups are sourced).
- Then: **Phase 4 (Leaderboard + Head-to-Head)**, then phases 5–6.

## Source of truth

- Design spec: `docs/superpowers/specs/2026-06-01-worldcup-2026-predictor-design.md`
- Plans: `docs/superpowers/plans/` (Phase 1 done; later phases added as we go)
- Read the spec before architectural decisions; update it if the design changes.

## Stack & key conventions

- **Next.js 16 specifics:** middleware is `src/proxy.ts` (NOT `middleware.ts`); read
  `node_modules/next/dist/docs/` before relying on memorized Next APIs.
- **Tailwind v4:** theme via `@theme` tokens in `src/app/globals.css` (no
  `tailwind.config.ts`). Colors: `pitch #0a3d26`, `gold #ffcb05`, `cream #fff7e6`,
  `alert #d7263d`. Serif headings (Georgia).
- **Supabase:** `DATABASE_URL` uses the transaction pooler (port 6543) with
  `postgres({ prepare: false })`. Secrets in `.env.local` (gitignored); `drizzle.config.ts`
  and `src/db/index.ts` load it explicitly via dotenv. New API key format
  (`sb_publishable_…` → anon var, `sb_secret_…` → service-role var).
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
