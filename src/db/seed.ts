import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { db } from './index';
import { parseSeed } from './seed-data';
import { teams, players, venues, matches, appSettings } from './schema';
import { DEFAULT_SCORING } from '../lib/scoring-config';

/**
 * Idempotent seed loader: looks up existing venues/teams and inserts only what's
 * missing, so it can be re-run as data is added. Matches upsert on externalId.
 */
async function main() {
  const seed = parseSeed(JSON.parse(readFileSync('data/seed.json', 'utf8')));

  // Venues — keyed by name.
  const existingVenues = await db.select().from(venues);
  const venueIdByName = new Map(existingVenues.map((v) => [v.name, v.id]));
  for (const v of seed.venues) {
    if (venueIdByName.has(v.name)) continue;
    const [row] = await db.insert(venues).values(v).returning({ id: venues.id });
    venueIdByName.set(v.name, row.id);
  }

  // Teams — keyed by code. Players inserted only for newly created teams.
  const existingTeams = await db.select().from(teams);
  const teamIdByCode = new Map(existingTeams.map((t) => [t.code, t.id]));
  for (const t of seed.teams) {
    if (teamIdByCode.has(t.code)) continue;
    const [row] = await db.insert(teams).values({
      code: t.code, name: t.name, flag: t.flag, groupName: t.groupName,
      fifaRank: t.fifaRank, wcTitles: t.wcTitles ?? 0, coach: t.coach,
    }).returning({ id: teams.id });
    teamIdByCode.set(t.code, row.id);
    if (t.squad.length) {
      await db.insert(players).values(t.squad.map((p) => ({ teamId: row.id, ...p })));
    }
  }

  // Matches — upsert on the stable externalId.
  for (const m of seed.matches) {
    await db.insert(matches).values({
      externalId: m.externalId, stage: m.stage, groupName: m.groupName,
      homeTeamId: m.homeTeamCode ? teamIdByCode.get(m.homeTeamCode) : null,
      awayTeamId: m.awayTeamCode ? teamIdByCode.get(m.awayTeamCode) : null,
      venueId: venueIdByName.get(m.venueName),
      kickoffAt: new Date(m.kickoffAt),
    }).onConflictDoNothing({ target: matches.externalId });
  }

  // Settings singleton with scoring defaults.
  const existing = await db.select().from(appSettings).where(eq(appSettings.id, 1));
  if (existing.length === 0) {
    await db.insert(appSettings).values({ id: 1, ...DEFAULT_SCORING });
  }

  console.log(`Seeded ${seed.venues.length} venues, ${seed.teams.length} teams, ${seed.matches.length} matches.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
