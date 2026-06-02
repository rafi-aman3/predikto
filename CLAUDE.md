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
- **Deployed on Vercel via GitHub integration — every push to `main` auto-deploys.**
  Production URL is in the Vercel dashboard (project `predikto`; GitHub
  `rafi-aman3/predikto`).
- Next: **Phase 3 (Admin + Scoring engine)**, then phases 4–6.

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
  mirror `auth.users` via the `profiles` table; `isAdmin` flag gates admin (check
  server-side).
- **Scoring constants live in the `app_settings` table** (tweakable without redeploy).
  Defaults: match exact +3 / result +1; bracket R16 +1, QF +2, SF +3, finalist +5;
  awards champion +10, others +5. Helpers in `src/lib/scoring-config.ts`.
- **Locks enforced server-side** (`src/lib/locks.ts`): matches lock at kickoff; bracket +
  awards lock at `app_settings.predictions_lock_at`. Never trust the client.
- **Results are admin-entered** (no football API in v1); entering a result recomputes
  affected predictions.
- **Seed:** `npm run db:seed` (idempotent) from `data/seed.json`.

## Commands

- `npm run dev` · `npm run build` · `npm test` (Vitest) · `npm run lint` · `npm run db:seed`
- DB migrations: `npx drizzle-kit generate` then `npx drizzle-kit migrate`.

## Workflow

- brainstorm → writing-plans → subagent/inline execution; **commit per task locally, push
  once per completed phase** (each push to `main` auto-deploys on Vercel — one deploy per
  phase). Do not commit `.env*` or `.superpowers/`.
