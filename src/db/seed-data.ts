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
