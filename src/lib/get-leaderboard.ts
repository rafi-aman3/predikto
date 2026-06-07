import { db } from '@/db';
import { profiles, matchPredictions } from '@/db/schema';
import { getFixtures } from './get-fixtures';
import { getScoringConfig } from './app-settings';
import type { LeaderPlayer, ScoredPrediction, MatchMeta } from './leaderboard';

export type LeaderboardData = {
  players: LeaderPlayer[];
  predictions: ScoredPrediction[];
  matches: MatchMeta[];
};

/**
 * Loads everything the leaderboard + head-to-head views need: every player, every match
 * prediction (with exactness precomputed from the live scoring config so the pure selectors
 * stay config-free), and serializable per-match metadata (reusing getFixtures for team/lock).
 */
export async function getLeaderboardData(): Promise<LeaderboardData> {
  const [fixtures, profileRows, predRows, cfg] = await Promise.all([
    getFixtures(),
    db.select().from(profiles),
    db.select().from(matchPredictions),
    getScoringConfig(),
  ]);

  const players: LeaderPlayer[] = profileRows.map((p) => ({
    id: p.id, displayName: p.displayName, avatarSeed: p.avatarSeed,
  }));

  const predictions: ScoredPrediction[] = predRows.map((r) => ({
    userId: r.userId, matchId: r.matchId,
    homeScore: r.homeScore, awayScore: r.awayScore,
    pointsAwarded: r.pointsAwarded,
    exact: r.pointsAwarded === cfg.ptsExact,
  }));

  const matches: MatchMeta[] = fixtures.map((f) => ({
    id: f.id, stage: f.stage, status: f.status, locked: f.locked,
    homeCode: f.home?.code ?? 'TBD', awayCode: f.away?.code ?? 'TBD',
    homeFlag: f.home?.flag ?? null, awayFlag: f.away?.flag ?? null,
    kickoffMs: f.kickoffAt.getTime(),
  }));

  return { players, predictions, matches };
}
