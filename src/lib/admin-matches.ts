import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { matches, teams, venues } from '@/db/schema';
import type { Stage } from './fixtures';

export type MatchStatus = 'scheduled' | 'live' | 'finished';

export type AdminMatch = {
  id: string;
  externalId: string | null;
  stage: Stage;
  groupName: string | null;
  kickoffAt: Date;
  status: MatchStatus;
  homeTeamId: string | null;
  awayTeamId: string | null;
  venueId: string | null;
  homeScore: number | null;
  awayScore: number | null;
};

export type TeamOption = { id: string; code: string; name: string };
export type VenueOption = { id: string; name: string };

/** All matches as raw editable rows, sorted by kickoff. */
export async function getAdminMatches(): Promise<AdminMatch[]> {
  const rows = await db.select().from(matches);
  return rows
    .map((m): AdminMatch => ({
      id: m.id, externalId: m.externalId, stage: m.stage as Stage,
      groupName: m.groupName, kickoffAt: m.kickoffAt, status: m.status as MatchStatus,
      homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId, venueId: m.venueId,
      homeScore: m.homeScore, awayScore: m.awayScore,
    }))
    .sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime());
}

export async function getTeamOptions(): Promise<TeamOption[]> {
  const rows = await db.select({ id: teams.id, code: teams.code, name: teams.name }).from(teams);
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getVenueOptions(): Promise<VenueOption[]> {
  const rows = await db.select({ id: venues.id, name: venues.name }).from(venues);
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

/** Writes scores + status for a match. Scores may be null (cleared). */
export async function setMatchResult(
  matchId: string, homeScore: number | null, awayScore: number | null, status: MatchStatus,
): Promise<void> {
  await db.update(matches).set({ homeScore, awayScore, status }).where(eq(matches.id, matchId));
}

export type MatchMeta = {
  homeTeamId: string | null;
  awayTeamId: string | null;
  venueId: string | null;
  kickoffAt: Date;
  groupName: string | null;
};

/** Writes match metadata (teams — incl. TBD nulls — venue, kickoff, group). */
export async function updateMatchMeta(matchId: string, meta: MatchMeta): Promise<void> {
  await db.update(matches).set({
    homeTeamId: meta.homeTeamId, awayTeamId: meta.awayTeamId,
    venueId: meta.venueId, kickoffAt: meta.kickoffAt, groupName: meta.groupName,
  }).where(eq(matches.id, matchId));
}
