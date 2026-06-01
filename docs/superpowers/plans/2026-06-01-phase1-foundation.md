# Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the World Cup 2026 Predictor skeleton — Next.js app on Supabase + Drizzle, with auth, the full database schema, seed-data loading, and the Retro Pitch theme/shell — so later feature phases have a working foundation.

**Architecture:** Monolithic Next.js (App Router). Supabase provides Postgres, Auth (email + Google), and Storage. Drizzle owns the schema/migrations and a `seed.json` loader. A typed scoring/lock config module and helpers are introduced here because later phases depend on them. Server-side Supabase clients via `@supabase/ssr`; profile rows mirror `auth.users` and carry the `isAdmin` flag.

**Tech Stack:** Next.js (TypeScript, App Router), Tailwind CSS, Drizzle ORM + drizzle-kit, postgres-js driver, `@supabase/ssr` + `@supabase/supabase-js`, Vitest for unit tests.

---

## Prerequisites (human-performed, needed before Task 5)

These require credentials only the owner has. Do them in the session with the `!` prefix or in a browser, then continue.

- **Supabase project:** create one at https://supabase.com (region close to friends). From Project Settings → API, copy the Project URL, `anon` key, and `service_role` key. From Project Settings → Database, copy the connection string (use the **Session pooler** URI, port 5432, with your DB password).
- **Google OAuth:** in Google Cloud Console create an OAuth 2.0 Client (Web). Add the Supabase callback `https://<project-ref>.supabase.co/auth/v1/callback` as an authorized redirect URI. In Supabase → Authentication → Providers → Google, paste the client ID/secret and enable it. Also enable Email provider.

These values populate `.env.local` in Task 3. Until they exist, Tasks 1–4 and the seed-parser tests (Task 7) can proceed; Tasks 5, 6b, 9 need them.

---

## File Structure

- `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs` — scaffolding (Task 1)
- `.env.local`, `.env.example` — secrets + template (Task 3)
- `drizzle.config.ts` — drizzle-kit config (Task 4)
- `src/db/schema.ts` — all tables, single source of truth (Task 4)
- `src/db/index.ts` — Drizzle client (Task 4)
- `src/lib/scoring-config.ts` — default scoring constants + types (Task 4b)
- `src/lib/locks.ts` — `isMatchLocked()` / `arePredictionsLocked()` helpers (Task 4b)
- `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/middleware.ts` — Supabase SSR auth (Task 6)
- `src/db/seed-data.ts` — typed seed shape + parser/validator (Task 7)
- `data/seed.json` — teams, venues, fixtures source data (Task 7)
- `src/db/seed.ts` — runnable seed loader (Task 7)
- `tailwind.config.ts` + `src/app/globals.css` — Retro Pitch theme (Task 8)
- `src/app/layout.tsx`, `src/components/app-shell.tsx`, `src/components/nav.tsx` — shell/nav (Task 8)
- `src/app/auth/**`, `src/app/onboarding/**`, `src/lib/profile.ts` — auth pages + profile/display-name (Task 9)
- `vitest.config.ts`, `src/**/*.test.ts` — test setup (Task 2b)

---

## Task 1: Scaffold the Next.js project

**Files:** Creates the project skeleton in the repo root (already a git repo with docs/).

- [ ] **Step 1: Scaffold into the current directory**

The directory already contains `docs/`, `CLAUDE.md`, `.gitignore`, `.git`. Scaffold in place with a temp dir to avoid the "non-empty" refusal.

Run:
```bash
npx --yes create-next-app@latest predictor-tmp \
  --typescript --tailwind --app --src-dir --eslint \
  --import-alias "@/*" --use-npm --no-turbopack
# Move generated files into the repo root, then remove the temp dir
rsync -a --exclude=.git predictor-tmp/ ./
rm -rf predictor-tmp
```
Expected: `src/app/`, `package.json`, `tailwind.config.ts` (or `.js`), `next.config.ts` now exist in the repo root.

- [ ] **Step 2: Verify the build works**

Run: `npm run build`
Expected: build completes with "Compiled successfully" (a default home page).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app (TS, Tailwind, App Router)"
```

---

## Task 2: Install runtime dependencies

**Files:** `package.json`

- [ ] **Step 1: Install DB + Supabase packages**

Run:
```bash
npm install drizzle-orm postgres @supabase/supabase-js @supabase/ssr
npm install -D drizzle-kit dotenv tsx
```
Expected: packages added to `package.json`, no peer-dependency errors that block install.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add drizzle, postgres-js, supabase deps"
```

---

## Task 2b: Set up Vitest

**Files:** Create `vitest.config.ts`; Modify `package.json`

- [ ] **Step 1: Install Vitest**

Run: `npm install -D vitest`
Expected: `vitest` in devDependencies.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Add the test script to `package.json`**

In the `"scripts"` block add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify the runner works (no tests yet)**

Run: `npm test`
Expected: exits 0 with "No test files found" — confirms Vitest is wired up.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: configure vitest"
```

---

## Task 3: Environment configuration

**Files:** Create `.env.local` (gitignored), `.env.example`

- [ ] **Step 1: Create `.env.example` (committed template)**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Postgres connection for Drizzle (Supabase Session pooler URI, port 5432)
DATABASE_URL=postgresql://postgres.YOUR-REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
```

- [ ] **Step 2: Create `.env.local` with the real values from the Supabase prerequisite**

Copy `.env.example` to `.env.local` and fill in the real Project URL, anon key, service role key, and DATABASE_URL. (`.env.local` is already gitignored.)

- [ ] **Step 3: Commit only the template**

```bash
git add .env.example
git commit -m "chore: add env template"
```

---

## Task 4: Drizzle config + schema

**Files:** Create `drizzle.config.ts`, `src/db/schema.ts`, `src/db/index.ts`

- [ ] **Step 1: Create `drizzle.config.ts`**

```ts
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

- [ ] **Step 2: Create `src/db/schema.ts` with all tables**

```ts
import {
  pgTable, uuid, text, integer, boolean, timestamp,
  pgEnum, unique,
} from 'drizzle-orm/pg-core';

export const stageEnum = pgEnum('stage', ['group', 'r32', 'r16', 'qf', 'sf', 'final']);
export const matchStatusEnum = pgEnum('match_status', ['scheduled', 'live', 'finished']);
export const adSlotEnum = pgEnum('ad_slot', ['sidebar', 'inline', 'footer']);

export const teams = pgTable('teams', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull(),          // e.g. BRA
  flag: text('flag'),                    // emoji or asset key
  groupName: text('group_name'),         // e.g. "A" (null for placeholders)
  fifaRank: integer('fifa_rank'),
  wcTitles: integer('wc_titles').default(0).notNull(),
  coach: text('coach'),
});

export const players = pgTable('players', {
  id: uuid('id').defaultRandom().primaryKey(),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  position: text('position'),            // GK/DF/MF/FW
  shirtNumber: integer('shirt_number'),
  club: text('club'),
  age: integer('age'),
  caps: integer('caps'),
  photoUrl: text('photo_url'),
  goldenBootEligible: boolean('golden_boot_eligible').default(true).notNull(),
  bestPlayerEligible: boolean('best_player_eligible').default(true).notNull(),
});

export const venues = pgTable('venues', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  city: text('city'),
  country: text('country'),
});

export const matches = pgTable('matches', {
  id: uuid('id').defaultRandom().primaryKey(),
  externalId: text('external_id').unique(),  // stable key from seed for idempotent upserts
  stage: stageEnum('stage').notNull(),
  groupName: text('group_name'),
  homeTeamId: uuid('home_team_id').references(() => teams.id),  // null = TBD
  awayTeamId: uuid('away_team_id').references(() => teams.id),
  venueId: uuid('venue_id').references(() => venues.id),
  kickoffAt: timestamp('kickoff_at', { withTimezone: true }).notNull(),
  homeScore: integer('home_score'),
  awayScore: integer('away_score'),
  status: matchStatusEnum('status').default('scheduled').notNull(),
});

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),           // == auth.users.id
  displayName: text('display_name'),
  avatarSeed: text('avatar_seed'),
  isAdmin: boolean('is_admin').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const matchPredictions = pgTable('match_predictions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  matchId: uuid('match_id').references(() => matches.id, { onDelete: 'cascade' }).notNull(),
  homeScore: integer('home_score').notNull(),
  awayScore: integer('away_score').notNull(),
  pointsAwarded: integer('points_awarded'),  // null until scored
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ uniqUserMatch: unique().on(t.userId, t.matchId) }));

// One row per predicted advancing team per knockout round.
export const bracketPredictions = pgTable('bracket_predictions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  stage: stageEnum('stage').notNull(),       // r16 | qf | sf | final
  teamId: uuid('team_id').references(() => teams.id).notNull(),
  pointsAwarded: integer('points_awarded'),
}, (t) => ({ uniqUserStageTeam: unique().on(t.userId, t.stage, t.teamId) }));

export const awardPredictions = pgTable('award_predictions', {
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).primaryKey(),
  championTeamId: uuid('champion_team_id').references(() => teams.id),
  runnerUpTeamId: uuid('runner_up_team_id').references(() => teams.id),
  goldenBootPlayerId: uuid('golden_boot_player_id').references(() => players.id),
  bestPlayerId: uuid('best_player_id').references(() => players.id),
  surpriseTeamId: uuid('surprise_team_id').references(() => teams.id),
  pointsAwarded: integer('points_awarded'),
});

export const ads = pgTable('ads', {
  id: uuid('id').defaultRandom().primaryKey(),
  imageUrl: text('image_url').notNull(),
  linkUrl: text('link_url'),
  slot: adSlotEnum('slot').notNull(),
  active: boolean('active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
});

// Singleton row (id = 1).
export const appSettings = pgTable('app_settings', {
  id: integer('id').primaryKey().default(1),
  predictionsLockAt: timestamp('predictions_lock_at', { withTimezone: true }),
  prizeText: text('prize_text'),
  // Scoring constants (defaults seeded from scoring-config.ts):
  ptsExact: integer('pts_exact').default(3).notNull(),
  ptsResult: integer('pts_result').default(1).notNull(),
  ptsReachR16: integer('pts_reach_r16').default(1).notNull(),
  ptsReachQf: integer('pts_reach_qf').default(2).notNull(),
  ptsReachSf: integer('pts_reach_sf').default(3).notNull(),
  ptsReachFinal: integer('pts_reach_final').default(5).notNull(),
  ptsChampion: integer('pts_champion').default(10).notNull(),
  ptsRunnerUp: integer('pts_runner_up').default(5).notNull(),
  ptsGoldenBoot: integer('pts_golden_boot').default(5).notNull(),
  ptsBestPlayer: integer('pts_best_player').default(5).notNull(),
  ptsSurprise: integer('pts_surprise').default(5).notNull(),
});
```

- [ ] **Step 3: Create `src/db/index.ts`**

```ts
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
export const db = drizzle(client, { schema });
```

- [ ] **Step 4: Verify schema typechecks**

Run: `npx tsc --noEmit`
Expected: no type errors from `src/db/`.

- [ ] **Step 5: Commit**

```bash
git add drizzle.config.ts src/db/schema.ts src/db/index.ts
git commit -m "feat: drizzle config and full database schema"
```

---

## Task 4b: Scoring config + lock helpers (pure, TDD)

**Files:** Create `src/lib/scoring-config.ts`, `src/lib/locks.ts`, `src/lib/locks.test.ts`

- [ ] **Step 1: Create `src/lib/scoring-config.ts`**

```ts
export type ScoringConfig = {
  ptsExact: number; ptsResult: number;
  ptsReachR16: number; ptsReachQf: number; ptsReachSf: number; ptsReachFinal: number;
  ptsChampion: number; ptsRunnerUp: number; ptsGoldenBoot: number;
  ptsBestPlayer: number; ptsSurprise: number;
};

export const DEFAULT_SCORING: ScoringConfig = {
  ptsExact: 3, ptsResult: 1,
  ptsReachR16: 1, ptsReachQf: 2, ptsReachSf: 3, ptsReachFinal: 5,
  ptsChampion: 10, ptsRunnerUp: 5, ptsGoldenBoot: 5,
  ptsBestPlayer: 5, ptsSurprise: 5,
};
```

- [ ] **Step 2: Write the failing test `src/lib/locks.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { isMatchLocked, arePredictionsLocked } from './locks';

describe('isMatchLocked', () => {
  const kickoff = new Date('2026-06-11T20:00:00Z');
  it('is locked at or after kickoff', () => {
    expect(isMatchLocked(kickoff, new Date('2026-06-11T20:00:00Z'))).toBe(true);
    expect(isMatchLocked(kickoff, new Date('2026-06-11T20:00:01Z'))).toBe(true);
  });
  it('is open before kickoff', () => {
    expect(isMatchLocked(kickoff, new Date('2026-06-11T19:59:59Z'))).toBe(false);
  });
});

describe('arePredictionsLocked', () => {
  const deadline = new Date('2026-06-11T00:00:00Z');
  it('is open when no deadline is set', () => {
    expect(arePredictionsLocked(null, new Date())).toBe(false);
  });
  it('locks at or after the deadline', () => {
    expect(arePredictionsLocked(deadline, deadline)).toBe(true);
    expect(arePredictionsLocked(deadline, new Date('2026-06-10T23:59:59Z'))).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- locks`
Expected: FAIL — "Cannot find module './locks'".

- [ ] **Step 4: Implement `src/lib/locks.ts`**

```ts
/** A match prediction is locked once now >= kickoff. */
export function isMatchLocked(kickoffAt: Date, now: Date = new Date()): boolean {
  return now.getTime() >= kickoffAt.getTime();
}

/** Bracket + award predictions lock at the global deadline. No deadline => open. */
export function arePredictionsLocked(deadline: Date | null, now: Date = new Date()): boolean {
  if (!deadline) return false;
  return now.getTime() >= deadline.getTime();
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- locks`
Expected: PASS (5 assertions).

- [ ] **Step 6: Commit**

```bash
git add src/lib/scoring-config.ts src/lib/locks.ts src/lib/locks.test.ts
git commit -m "feat: scoring config defaults and prediction lock helpers"
```

---

## Task 5: Generate and apply the migration

**Files:** Creates `drizzle/` migration files. **Requires `.env.local` (Task 3) populated.**

- [ ] **Step 1: Generate the migration SQL**

Run: `npx drizzle-kit generate`
Expected: a `drizzle/0000_*.sql` file containing CREATE TABLE statements for all tables.

- [ ] **Step 2: Push the schema to Supabase**

Run: `npx drizzle-kit migrate`
Expected: "migrations applied". (If `migrate` errors on the pooler, use `npx drizzle-kit push` instead.)

- [ ] **Step 3: Verify tables exist**

Run:
```bash
npx tsx -e "import {db} from './src/db'; import {teams} from './src/db/schema'; db.select().from(teams).then(r=>{console.log('teams rows:', r.length); process.exit(0)});"
```
Expected: prints `teams rows: 0` (table exists, empty).

- [ ] **Step 4: Commit**

```bash
git add drizzle/
git commit -m "feat: initial database migration"
```

---

## Task 6: Supabase SSR auth clients + middleware

**Files:** Create `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/middleware.ts`

- [ ] **Step 1: Create `src/lib/supabase/client.ts` (browser)**

```ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 2: Create `src/lib/supabase/server.ts` (server components / actions)**

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch { /* called from a Server Component; middleware refreshes instead */ }
        },
      },
    },
  );
}
```

- [ ] **Step 3: Create `src/middleware.ts` (session refresh)**

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: compiles successfully (middleware + clients have no type errors).

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase src/middleware.ts
git commit -m "feat: supabase ssr auth clients and session middleware"
```

---

## Task 7: Seed data shape, parser, and loader (TDD for the parser)

**Files:** Create `src/db/seed-data.ts`, `src/db/seed-data.test.ts`, `data/seed.json`, `src/db/seed.ts`

- [ ] **Step 1: Write the failing test `src/db/seed-data.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { parseSeed } from './seed-data';

const sample = {
  venues: [{ name: 'Estadio Azteca', city: 'Mexico City', country: 'Mexico' }],
  teams: [{
    code: 'MEX', name: 'Mexico', flag: '🇲🇽', groupName: 'A', fifaRank: 14, wcTitles: 0,
    coach: 'Aguirre',
    squad: [{ name: 'Ochoa', position: 'GK', shirtNumber: 13, club: 'AVS', age: 40, caps: 150 }],
  }],
  matches: [{
    externalId: 'M1', stage: 'group', groupName: 'A',
    homeTeamCode: 'MEX', awayTeamCode: null,
    venueName: 'Estadio Azteca', kickoffAt: '2026-06-11T20:00:00Z',
  }],
};

describe('parseSeed', () => {
  it('parses a valid seed', () => {
    const s = parseSeed(sample);
    expect(s.teams[0].code).toBe('MEX');
    expect(s.teams[0].squad[0].name).toBe('Ochoa');
    expect(s.matches[0].externalId).toBe('M1');
  });
  it('rejects a match whose venue is missing from venues[]', () => {
    const bad = { ...sample, matches: [{ ...sample.matches[0], venueName: 'Nowhere' }] };
    expect(() => parseSeed(bad)).toThrow(/venue/i);
  });
  it('rejects a match referencing an unknown team code', () => {
    const bad = { ...sample, matches: [{ ...sample.matches[0], homeTeamCode: 'XXX' }] };
    expect(() => parseSeed(bad)).toThrow(/team/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- seed-data`
Expected: FAIL — "Cannot find module './seed-data'".

- [ ] **Step 3: Implement `src/db/seed-data.ts`**

```ts
export type SeedPlayer = {
  name: string; position?: string; shirtNumber?: number;
  club?: string; age?: number; caps?: number; photoUrl?: string;
};
export type SeedTeam = {
  code: string; name: string; flag?: string; groupName?: string;
  fifaRank?: number; wcTitles?: number; coach?: string; squad: SeedPlayer[];
};
export type SeedVenue = { name: string; city?: string; country?: string };
export type SeedMatch = {
  externalId: string;
  stage: 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'final';
  groupName?: string;
  homeTeamCode: string | null;
  awayTeamCode: string | null;
  venueName: string;
  kickoffAt: string; // ISO
};
export type Seed = { venues: SeedVenue[]; teams: SeedTeam[]; matches: SeedMatch[] };

export function parseSeed(raw: unknown): Seed {
  const s = raw as Seed;
  if (!s || !Array.isArray(s.venues) || !Array.isArray(s.teams) || !Array.isArray(s.matches)) {
    throw new Error('Seed must have venues[], teams[], matches[]');
  }
  const venueNames = new Set(s.venues.map((v) => v.name));
  const teamCodes = new Set(s.teams.map((t) => t.code));
  for (const m of s.matches) {
    if (!m.externalId) throw new Error('Match missing externalId');
    if (!venueNames.has(m.venueName)) throw new Error(`Unknown venue: ${m.venueName}`);
    for (const code of [m.homeTeamCode, m.awayTeamCode]) {
      if (code !== null && !teamCodes.has(code)) throw new Error(`Unknown team code: ${code}`);
    }
  }
  return s;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- seed-data`
Expected: PASS (3 tests).

- [ ] **Step 5: Create `data/seed.json` (starter — venues + a few teams/matches)**

Create a real file with the 16 venues and at least Group A–B teams + their opening fixtures so the loader is exercised end-to-end. Full 48-team / 104-match data is filled in incrementally (and correctable later in admin). Minimum viable starter:

```json
{
  "venues": [
    { "name": "Estadio Azteca", "city": "Mexico City", "country": "Mexico" },
    { "name": "MetLife Stadium", "city": "East Rutherford", "country": "USA" },
    { "name": "SoFi Stadium", "city": "Inglewood", "country": "USA" }
  ],
  "teams": [
    { "code": "MEX", "name": "Mexico", "flag": "🇲🇽", "groupName": "A", "fifaRank": 14, "wcTitles": 0, "coach": "Javier Aguirre", "squad": [] },
    { "code": "USA", "name": "United States", "flag": "🇺🇸", "groupName": "B", "fifaRank": 16, "wcTitles": 0, "coach": "Mauricio Pochettino", "squad": [] }
  ],
  "matches": [
    { "externalId": "M01", "stage": "group", "groupName": "A", "homeTeamCode": "MEX", "awayTeamCode": null, "venueName": "Estadio Azteca", "kickoffAt": "2026-06-11T20:00:00Z" }
  ]
}
```

- [ ] **Step 6: Implement the runnable loader `src/db/seed.ts` (idempotent upserts)**

```ts
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { db } from './index';
import { parseSeed } from './seed-data';
import { teams, players, venues, matches, appSettings } from './schema';
import { DEFAULT_SCORING } from '../lib/scoring-config';
import { eq } from 'drizzle-orm';

async function main() {
  const seed = parseSeed(JSON.parse(readFileSync('data/seed.json', 'utf8')));

  const venueIdByName = new Map<string, string>();
  for (const v of seed.venues) {
    const [row] = await db.insert(venues).values(v).returning({ id: venues.id });
    venueIdByName.set(v.name, row.id);
  }

  const teamIdByCode = new Map<string, string>();
  for (const t of seed.teams) {
    const [row] = await db.insert(teams).values({
      code: t.code, name: t.name, flag: t.flag, groupName: t.groupName,
      fifaRank: t.fifaRank, wcTitles: t.wcTitles ?? 0, coach: t.coach,
    }).returning({ id: teams.id });
    teamIdByCode.set(t.code, row.id);
    if (t.squad.length) {
      await db.insert(players).values(t.squad.map((p) => ({ teamId: row.id, ...p })));
    }
  }

  for (const m of seed.matches) {
    await db.insert(matches).values({
      externalId: m.externalId, stage: m.stage, groupName: m.groupName,
      homeTeamId: m.homeTeamCode ? teamIdByCode.get(m.homeTeamCode) : null,
      awayTeamId: m.awayTeamCode ? teamIdByCode.get(m.awayTeamCode) : null,
      venueId: venueIdByName.get(m.venueName),
      kickoffAt: new Date(m.kickoffAt),
    }).onConflictDoNothing({ target: matches.externalId });
  }

  // Seed the singleton settings row with scoring defaults if absent.
  const existing = await db.select().from(appSettings).where(eq(appSettings.id, 1));
  if (existing.length === 0) {
    await db.insert(appSettings).values({ id: 1, ...DEFAULT_SCORING });
  }

  console.log(`Seeded ${seed.venues.length} venues, ${seed.teams.length} teams, ${seed.matches.length} matches.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 7: Add the seed script to `package.json`**

In `"scripts"` add:
```json
"db:seed": "tsx src/db/seed.ts"
```

- [ ] **Step 8: Run the seed against the DB (requires Task 5 done)**

Run: `npm run db:seed`
Expected: prints `Seeded 3 venues, 2 teams, 1 matches.`

- [ ] **Step 9: Commit**

```bash
git add src/db/seed-data.ts src/db/seed-data.test.ts data/seed.json src/db/seed.ts package.json
git commit -m "feat: seed data shape, validator, and idempotent loader"
```

---

## Task 8: Retro Pitch theme + app shell

**Files:** Modify `tailwind.config.ts`, `src/app/globals.css`, `src/app/layout.tsx`; Create `src/components/app-shell.tsx`, `src/components/nav.tsx`

- [ ] **Step 1: Add theme colors to `tailwind.config.ts`**

In `theme.extend.colors` add:
```ts
colors: {
  pitch: '#0a3d26',
  gold: '#ffcb05',
  cream: '#fff7e6',
  alert: '#d7263d',
},
```
Ensure `content` includes `'./src/**/*.{ts,tsx}'`.

- [ ] **Step 2: Add base theme styles to `src/app/globals.css`**

Append after the Tailwind directives:
```css
:root { --pitch:#0a3d26; --gold:#ffcb05; --cream:#fff7e6; }
body {
  background:
    repeating-linear-gradient(90deg, #0f5e3a 0 56px, #11663f 56px 112px);
  color: var(--pitch);
  min-height: 100dvh;
}
h1, h2, h3 { font-family: Georgia, 'Times New Roman', serif; }
.rp-card {
  background: var(--cream);
  border: 2px solid var(--pitch);
  border-radius: 12px;
}
```

- [ ] **Step 3: Create `src/components/nav.tsx`**

```tsx
import Link from 'next/link';

const links = [
  { href: '/fixtures', label: 'Fixtures' },
  { href: '/bracket', label: 'Bracket' },
  { href: '/leaderboard', label: 'Leaderboard' },
];

export function Nav() {
  return (
    <nav className="flex items-center gap-4 bg-pitch text-cream px-4 py-3">
      <Link href="/" className="font-serif font-bold text-gold">⚽ WC26 Predictor</Link>
      <div className="ml-auto flex gap-4">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="hover:text-gold">{l.label}</Link>
        ))}
      </div>
    </nav>
  );
}
```

- [ ] **Step 4: Create `src/components/app-shell.tsx`**

```tsx
import { Nav } from './nav';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <Nav />
      <main className="mx-auto max-w-3xl p-4">{children}</main>
    </div>
  );
}
```

- [ ] **Step 5: Wrap the app in `src/app/layout.tsx`**

Import and use `AppShell` around `{children}` inside `<body>`. Keep the existing metadata export; set the page title to `World Cup 2026 Predictor`.

- [ ] **Step 6: Replace `src/app/page.tsx` with a themed landing placeholder**

```tsx
export default function Home() {
  return (
    <div className="rp-card p-6 text-center">
      <h1 className="text-2xl font-bold">⚽ World Cup 2026 Predictor</h1>
      <p className="mt-2">Predict every match, build your bracket, climb the leaderboard.</p>
    </div>
  );
}
```

- [ ] **Step 7: Verify it renders**

Run: `npm run build`
Expected: compiles. (Optional manual check: `npm run dev`, open http://localhost:3000 — green stripes, cream card, nav bar.)

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: retro pitch theme, app shell, nav, landing page"
```

---

## Task 9: Auth flow + profile / display-name onboarding

**Files:** Create `src/lib/profile.ts`, `src/app/auth/login/page.tsx`, `src/app/auth/callback/route.ts`, `src/app/auth/actions.ts`, `src/app/onboarding/page.tsx`, `src/app/onboarding/actions.ts`. **Requires Supabase auth configured (prerequisite) + migration (Task 5).**

- [ ] **Step 1: Create `src/lib/profile.ts` (ensure-profile helper)**

```ts
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { eq } from 'drizzle-orm';

/** Returns the profile row for a user id, creating an empty one if missing. */
export async function getOrCreateProfile(userId: string) {
  const existing = await db.select().from(profiles).where(eq(profiles.id, userId));
  if (existing.length) return existing[0];
  const [created] = await db.insert(profiles).values({ id: userId }).returning();
  return created;
}

export async function setDisplayName(userId: string, displayName: string) {
  await db.update(profiles).set({ displayName }).where(eq(profiles.id, userId));
}
```

- [ ] **Step 2: Create the login page `src/app/auth/login/page.tsx`**

```tsx
'use client';
import { createClient } from '@/lib/supabase/client';
import { useState } from 'react';

export default function Login() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  async function google() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  }
  async function magic(e: React.FormEvent) {
    e.preventDefault();
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setSent(true);
  }

  return (
    <div className="rp-card p-6 max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4">Sign in</h1>
      <button onClick={google} className="w-full bg-pitch text-cream rounded-lg py-2 mb-4">
        Continue with Google
      </button>
      {sent ? (
        <p>Check your email for the magic link.</p>
      ) : (
        <form onSubmit={magic} className="flex flex-col gap-2">
          <input className="border-2 border-pitch rounded-lg p-2" type="email" required
            placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="bg-gold text-pitch font-bold rounded-lg py-2">Email me a link</button>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create the OAuth/OTP callback `src/app/auth/callback/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server';
import { getOrCreateProfile } from '@/lib/profile';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  if (code) {
    const supabase = await createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);
    if (data.user) {
      const profile = await getOrCreateProfile(data.user.id);
      if (!profile.displayName) return NextResponse.redirect(`${origin}/onboarding`);
    }
  }
  return NextResponse.redirect(`${origin}/`);
}
```

- [ ] **Step 4: Create the onboarding page `src/app/onboarding/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { saveDisplayName } from './actions';

export default async function Onboarding() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');
  return (
    <form action={saveDisplayName} className="rp-card p-6 max-w-sm mx-auto flex flex-col gap-3">
      <h1 className="text-xl font-bold">Pick your name</h1>
      <input name="displayName" required minLength={2} maxLength={24}
        className="border-2 border-pitch rounded-lg p-2" placeholder="Display name" />
      <button className="bg-gold text-pitch font-bold rounded-lg py-2">Save</button>
    </form>
  );
}
```

- [ ] **Step 5: Create `src/app/onboarding/actions.ts`**

```ts
'use server';
import { createClient } from '@/lib/supabase/server';
import { setDisplayName } from '@/lib/profile';
import { redirect } from 'next/navigation';

export async function saveDisplayName(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');
  const name = String(formData.get('displayName') ?? '').trim();
  if (name.length < 2) redirect('/onboarding');
  await setDisplayName(user.id, name);
  redirect('/');
}
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: compiles with no type errors.

- [ ] **Step 7: Manual end-to-end check (requires dev server + configured Supabase)**

Run: `npm run dev`, open http://localhost:3000/auth/login, sign in with Google or the email magic link, confirm redirect to `/onboarding`, set a name, land on `/`. Verify in Supabase Table editor that a `profiles` row exists with the display name.

- [ ] **Step 8: Manually mark yourself admin (one-time)**

In the Supabase SQL editor: `update profiles set is_admin = true where id = '<your-auth-user-id>';`
This unlocks the admin panel built in Phase 3.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: auth (google + magic link), profile, display-name onboarding"
```

---

## Self-Review Notes

- **Spec coverage (Phase 1 scope):** Next.js+Vercel-ready scaffold ✓ (T1), Supabase+Drizzle+env ✓ (T2–T5), auth email+Google with display-name onboarding ✓ (T9), full schema incl. all tables + scoring constants in `appSettings` ✓ (T4), seed loader for teams/venues/fixtures ✓ (T7), Retro Pitch theme + shell ✓ (T8). Scoring/lock primitives later phases need ✓ (T4b). Storage buckets for ads/photos are created on-demand in Phase 6 (not needed in Phase 1).
- **Type consistency:** `parseSeed` shape matches `seed.ts` field mapping (`homeTeamCode`/`awayTeamCode` → `homeTeamId`/`awayTeamId`); `DEFAULT_SCORING` keys match `appSettings` columns; `getOrCreateProfile`/`setDisplayName` signatures match their callers.
- **Deferred to later phases:** match-prediction UI/locking enforcement (Phase 2), scoring engine + admin (Phase 3), leaderboards/H2H (Phase 4), bracket/awards UI (Phase 5), profiles/ads (Phase 6).
