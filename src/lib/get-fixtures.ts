import { db } from '@/db';
import { matches, teams, venues } from '@/db/schema';
import { isMatchLocked } from './locks';
import type { FixtureMatch, Stage, TeamLite } from './fixtures';

/** Loads all matches enriched with team/venue data and (optionally) the user's predictions. */
export async function getFixtures(
  predictionMap?: Map<string, { homeScore: number; awayScore: number; pointsAwarded: number | null }>,
  now: Date = new Date(),
): Promise<FixtureMatch[]> {
  const [matchRows, teamRows, venueRows] = await Promise.all([
    db.select().from(matches),
    db.select().from(teams),
    db.select().from(venues),
  ]);
  const teamById = new Map(teamRows.map((t) => [t.id, t]));
  const venueById = new Map(venueRows.map((v) => [v.id, v]));

  const toLite = (id: string | null): TeamLite | null => {
    if (!id) return null;
    const t = teamById.get(id);
    return t ? { id: t.id, code: t.code, name: t.name, flag: t.flag } : null;
  };

  return matchRows
    .map((m): FixtureMatch => {
      const v = m.venueId ? venueById.get(m.venueId) : undefined;
      return {
        id: m.id, externalId: m.externalId, stage: m.stage as Stage,
        groupName: m.groupName, kickoffAt: m.kickoffAt, status: m.status,
        home: toLite(m.homeTeamId), away: toLite(m.awayTeamId),
        venue: v ? { name: v.name, city: v.city } : null,
        homeScore: m.homeScore, awayScore: m.awayScore,
        prediction: predictionMap?.get(m.id) ?? null,
        locked: isMatchLocked(m.kickoffAt, now),
      };
    })
    .sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime());
}
