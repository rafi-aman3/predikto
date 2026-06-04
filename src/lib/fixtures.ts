import { db } from '@/db';
import { matches, teams, venues } from '@/db/schema';
import { isMatchLocked } from './locks';

export type Stage = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final';

export type TeamLite = { id: string; code: string; name: string; flag: string | null };
export type FixtureMatch = {
  id: string;
  externalId: string | null;
  stage: Stage;
  groupName: string | null;
  kickoffAt: Date;
  status: 'scheduled' | 'live' | 'finished';
  home: TeamLite | null;
  away: TeamLite | null;
  venue: { name: string; city: string | null } | null;
  homeScore: number | null;
  awayScore: number | null;
  prediction: { homeScore: number; awayScore: number; pointsAwarded: number | null } | null;
  locked: boolean;
};

const STAGE_ORDER: Stage[] = ['group', 'r32', 'r16', 'qf', 'sf', 'third', 'final'];

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

export type StageGroup = { stage: Stage; matches: FixtureMatch[] };

export function groupByStage(list: FixtureMatch[]): StageGroup[] {
  return STAGE_ORDER
    .map((stage) => ({ stage, matches: list.filter((m) => m.stage === stage) }))
    .filter((g) => g.matches.length > 0);
}

export type NamedGroup = { groupName: string; matches: FixtureMatch[] };

export function groupByGroup(list: FixtureMatch[]): NamedGroup[] {
  const groups = list.filter((m) => m.stage === 'group' && m.groupName);
  const byName = new Map<string, FixtureMatch[]>();
  for (const m of groups) {
    const g = m.groupName!;
    (byName.get(g) ?? byName.set(g, []).get(g)!).push(m);
  }
  return [...byName.entries()]
    .map(([groupName, ms]) => ({ groupName, matches: ms }))
    .sort((a, b) => a.groupName.localeCompare(b.groupName));
}
