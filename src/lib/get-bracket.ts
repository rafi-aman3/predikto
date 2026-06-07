import { eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  teams, players, groupPredictions, bracketPredictions, awardPredictions,
} from '@/db/schema';
import { getPredictionsLockAt } from './app-settings';
import { arePredictionsLocked } from './locks';

export type BracketTeam = { id: string; code: string; name: string; flag: string | null; groupName: string | null };
export type BracketPlayer = { id: string; name: string; teamId: string; goldenBootEligible: boolean; bestPlayerEligible: boolean };

export type SavedGroupPick = { groupName: string; teamId: string; position: number; advancesAsThird: boolean };
export type SavedAwards = {
  championTeamId: string | null; runnerUpTeamId: string | null;
  goldenBootPlayerId: string | null; bestPlayerId: string | null; surpriseTeamId: string | null;
};

export type BracketData = {
  teams: BracketTeam[];
  players: BracketPlayer[];
  locked: boolean;
  lockAt: number | null;                 // ms epoch, for the client countdown
  groupPicks: SavedGroupPick[];          // this user's saved order (empty if none)
  reached: { r16: string[]; qf: string[]; sf: string[]; final: string[] };
  awards: SavedAwards | null;
};

/** Loads everything the /bracket simulator needs for a given user. */
export async function getBracketData(userId: string | null, now: Date = new Date()): Promise<BracketData> {
  const lockAt = await getPredictionsLockAt();
  const [teamRows, playerRows] = await Promise.all([
    db.select().from(teams),
    db.select().from(players),
  ]);

  const teamsOut: BracketTeam[] = teamRows
    .filter((t) => t.groupName)                 // only real group teams (skip TBD placeholders)
    .map((t) => ({ id: t.id, code: t.code, name: t.name, flag: t.flag, groupName: t.groupName }));

  const playersOut: BracketPlayer[] = playerRows.map((p) => ({
    id: p.id, name: p.name, teamId: p.teamId,
    goldenBootEligible: p.goldenBootEligible, bestPlayerEligible: p.bestPlayerEligible,
  }));

  let groupPicks: SavedGroupPick[] = [];
  let reached = { r16: [] as string[], qf: [] as string[], sf: [] as string[], final: [] as string[] };
  let awards: SavedAwards | null = null;

  if (userId) {
    const [gRows, bRows, aRows] = await Promise.all([
      db.select().from(groupPredictions).where(eq(groupPredictions.userId, userId)),
      db.select().from(bracketPredictions).where(eq(bracketPredictions.userId, userId)),
      db.select().from(awardPredictions).where(eq(awardPredictions.userId, userId)),
    ]);
    groupPicks = gRows.map((g) => ({
      groupName: g.groupName, teamId: g.teamId, position: g.position, advancesAsThird: g.advancesAsThird,
    }));
    for (const b of bRows) {
      if (b.stage === 'r16' || b.stage === 'qf' || b.stage === 'sf' || b.stage === 'final') {
        reached[b.stage].push(b.teamId);
      }
    }
    const a = aRows[0];
    awards = a ? {
      championTeamId: a.championTeamId, runnerUpTeamId: a.runnerUpTeamId,
      goldenBootPlayerId: a.goldenBootPlayerId, bestPlayerId: a.bestPlayerId, surpriseTeamId: a.surpriseTeamId,
    } : null;
  }

  return {
    teams: teamsOut, players: playersOut,
    locked: arePredictionsLocked(lockAt, now),
    lockAt: lockAt ? lockAt.getTime() : null,
    groupPicks, reached, awards,
  };
}
