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
