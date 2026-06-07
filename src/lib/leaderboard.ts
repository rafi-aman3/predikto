import type { Stage } from './fixtures';

export type LeaderPlayer = { id: string; displayName: string | null; avatarSeed: string | null };

export type ScoredPrediction = {
  userId: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
  pointsAwarded: number | null;
  exact: boolean;
};

/** Serializable match metadata for the client views (no Date — kickoff as epoch ms). */
export type MatchMeta = {
  id: string;
  stage: Stage;
  status: 'scheduled' | 'live' | 'finished';
  locked: boolean;
  homeCode: string;
  awayCode: string;
  homeFlag: string | null;
  awayFlag: string | null;
  kickoffMs: number;
};

export type LeaderRow = {
  userId: string;
  displayName: string | null;
  avatarSeed: string | null;
  points: number;
  exactCount: number;
  predictedCount: number;
  rank: number;
};

const name = (s: string | null) => s ?? '';

/**
 * Ranks players by total points desc, then exact-scoreline count desc, then display name.
 * Players equal on (points, exactCount) share a rank ("1224" competition ranking).
 * `opts.matchIdsInScope` restricts which predictions count (used for the "This round" tab).
 */
export function buildLeaderboard(
  players: LeaderPlayer[],
  predictions: ScoredPrediction[],
  opts?: { matchIdsInScope?: Set<string> },
): LeaderRow[] {
  const scope = opts?.matchIdsInScope;
  const agg = new Map<string, { points: number; exactCount: number; predictedCount: number }>();
  for (const pl of players) agg.set(pl.id, { points: 0, exactCount: 0, predictedCount: 0 });

  for (const pred of predictions) {
    if (scope && !scope.has(pred.matchId)) continue;
    const a = agg.get(pred.userId);
    if (!a) continue;
    a.predictedCount += 1;
    a.points += pred.pointsAwarded ?? 0;
    if (pred.exact) a.exactCount += 1;
  }

  const rows: LeaderRow[] = players.map((pl) => {
    const a = agg.get(pl.id)!;
    return {
      userId: pl.id, displayName: pl.displayName, avatarSeed: pl.avatarSeed,
      points: a.points, exactCount: a.exactCount, predictedCount: a.predictedCount, rank: 0,
    };
  });

  rows.sort((x, y) =>
    y.points - x.points ||
    y.exactCount - x.exactCount ||
    name(x.displayName).localeCompare(name(y.displayName)),
  );

  let rank = 0;
  let prevKey: string | null = null;
  rows.forEach((r, i) => {
    const key = `${r.points}:${r.exactCount}`;
    if (key !== prevKey) { rank = i + 1; prevKey = key; }
    r.rank = rank;
  });

  return rows;
}

export type MatchLeaderRow = {
  userId: string;
  displayName: string | null;
  avatarSeed: string | null;
  pick: { home: number; away: number } | null;
  points: number | null;
};

/** Per-player pick + points for a single match. For the leaderboard "By match" tab. */
export function buildMatchLeaderboard(
  matchId: string,
  players: LeaderPlayer[],
  predictions: ScoredPrediction[],
): MatchLeaderRow[] {
  const byUser = new Map<string, ScoredPrediction>();
  for (const pred of predictions) if (pred.matchId === matchId) byUser.set(pred.userId, pred);

  const rows: MatchLeaderRow[] = players.map((pl) => {
    const pred = byUser.get(pl.id);
    return {
      userId: pl.id, displayName: pl.displayName, avatarSeed: pl.avatarSeed,
      pick: pred ? { home: pred.homeScore, away: pred.awayScore } : null,
      points: pred ? pred.pointsAwarded : null,
    };
  });

  rows.sort((x, y) =>
    (y.points ?? -1) - (x.points ?? -1) ||
    (Number(!!y.pick) - Number(!!x.pick)) ||
    name(x.displayName).localeCompare(name(y.displayName)),
  );

  return rows;
}
