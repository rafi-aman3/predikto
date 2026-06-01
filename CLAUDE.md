# CLAUDE.md

Guidance for working in this repository.

## What this is

**World Cup 2026 Predictor** — a monolithic web app for a friend circle to predict
World Cup 2026 results (match by match + knockout bracket + tournament awards), earn
points, and compete on leaderboards. Top of the overall leaderboard wins a real prize
from the owner. Includes self-managed ad slots and team/player profile pages.

It's a fun, time-boxed project — the tournament starts **June 11, 2026**. Favor
shipping a working, lean app over completeness.

## Design source of truth

The approved design lives at:
`docs/superpowers/specs/2026-06-01-worldcup-2026-predictor-design.md`

Read it before making architectural decisions. Update it if the design changes.

## Stack

- **Next.js** (App Router), monolithic, deployed on **Vercel**.
- **Supabase** — Postgres, Auth (email password + magic link, and Google OAuth via
  `@supabase/ssr`), Storage (ad banners, optional player photos).
- **Drizzle ORM** — schema, migrations, and the one-time `seed.json` loader.
- **Tailwind CSS**, mobile-first, **Retro Pitch** theme.
- Server Components for reads; Server Actions for writes (predictions, admin, scoring).

## Theme — "Retro Pitch"

Playful/nostalgic. Deep green `#0a3d26`, gold `#ffcb05`, cream `#fff7e6`, accent red
`#d7263d`, grass-stripe backgrounds. Serif headings (Georgia), system sans for
controls and numbers. Cards: cream fill, 2px deep-green border, gold for
selected/winning states.

## Key conventions

- **Scoring constants live in the `appSettings` table**, not hardcoded — the admin
  tweaks point values without a redeploy. Defaults: match exact **+3** / result **+1**;
  bracket R16 **+1**, QF **+2**, SF **+3**, finalist **+5**; awards champion **+10**,
  others **+5**.
- **Match predictions lock at kickoff** (`match.kickoffAt`); bracket + award
  predictions lock at the global `appSettings.predictionsLockAt`. Always enforce locks
  server-side in Server Actions, never trust the client.
- **Results are admin-entered.** Entering/editing a match result triggers a scoring
  recompute for affected predictions. No external football API in v1.
- **Knockout fixtures** may have null team IDs ("TBD") until group results are known;
  the admin fills them in.
- Reference the user via Supabase `auth.users`; app rows join through `profiles`.
- `isAdmin` flag on `profiles` gates the admin panel — check it server-side.

## Build phases (see spec for detail)

1. Foundation (project, Supabase, schema, auth, seed, theme/shell)
2. Fixtures + match predictions
3. Admin + scoring engine
4. Leaderboard + head-to-head
5. Bracket + awards
6. Team/player profiles + ads + polish

## Workflow notes

- This project uses the brainstorming → writing-plans → executing-plans flow.
  Implementation plans live under `docs/superpowers/`.
- Do not commit `.env*` or `.superpowers/` (local brainstorm mockups).
