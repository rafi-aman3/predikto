import { describe, it, expect } from 'vitest';
import { buildLeaderboard, buildMatchLeaderboard, type LeaderPlayer, type ScoredPrediction } from './leaderboard';

const players: LeaderPlayer[] = [
  { id: 'a', displayName: 'Ana', avatarSeed: null },
  { id: 'b', displayName: 'Bo', avatarSeed: null },
  { id: 'c', displayName: 'Cy', avatarSeed: null },
];
const p = (userId: string, matchId: string, pointsAwarded: number | null, exact = false): ScoredPrediction =>
  ({ userId, matchId, homeScore: 1, awayScore: 0, pointsAwarded, exact });

describe('buildLeaderboard', () => {
  it('sums points and counts predictions per player', () => {
    const rows = buildLeaderboard(players, [p('a', 'm1', 3, true), p('a', 'm2', 1), p('b', 'm1', 1)]);
    const ana = rows.find((r) => r.userId === 'a')!;
    expect(ana.points).toBe(4);
    expect(ana.exactCount).toBe(1);
    expect(ana.predictedCount).toBe(2);
    expect(ana.rank).toBe(1);
  });

  it('breaks equal points by exact-scoreline count', () => {
    const rows = buildLeaderboard(players, [p('a', 'm1', 3, true), p('b', 'm1', 3, false)]);
    expect(rows[0].userId).toBe('a');
    expect(rows[1].userId).toBe('b');
    expect(rows[0].rank).toBe(1);
    expect(rows[1].rank).toBe(2);
  });

  it('gives equal (points, exact) the same shared rank, next distinct group skips', () => {
    const rows = buildLeaderboard(players, [p('a', 'm1', 3, true), p('b', 'm1', 3, true)]);
    expect(rows.find((r) => r.userId === 'a')!.rank).toBe(1);
    expect(rows.find((r) => r.userId === 'b')!.rank).toBe(1);
    expect(rows.find((r) => r.userId === 'c')!.rank).toBe(3);
  });

  it('orders equal (points, exact) by display name', () => {
    const rows = buildLeaderboard(players, [p('b', 'm1', 3, true), p('a', 'm1', 3, true)]);
    expect(rows[0].userId).toBe('a');
    expect(rows[1].userId).toBe('b');
  });

  it('scopes points to matchIdsInScope when given (This round)', () => {
    const rows = buildLeaderboard(
      players,
      [p('a', 'm1', 3, true), p('a', 'm2', 5, false)],
      { matchIdsInScope: new Set(['m1']) },
    );
    const ana = rows.find((r) => r.userId === 'a')!;
    expect(ana.points).toBe(3);
    expect(ana.predictedCount).toBe(1);
  });

  it('handles all-zero (pre-tournament): everyone shares rank 1, name-ordered', () => {
    const rows = buildLeaderboard(players, []);
    expect(rows.map((r) => r.userId)).toEqual(['a', 'b', 'c']);
    expect(rows.every((r) => r.rank === 1 && r.points === 0)).toBe(true);
  });

  it('returns empty for no players', () => {
    expect(buildLeaderboard([], [p('a', 'm1', 3)])).toEqual([]);
  });
});

describe('buildMatchLeaderboard', () => {
  it('lists each player pick + points for one match, null pick when not predicted', () => {
    const rows = buildMatchLeaderboard('m1', players, [
      { userId: 'a', matchId: 'm1', homeScore: 2, awayScore: 1, pointsAwarded: 3, exact: true },
      { userId: 'b', matchId: 'm1', homeScore: 0, awayScore: 0, pointsAwarded: null, exact: false },
    ]);
    const ana = rows.find((r) => r.userId === 'a')!;
    const cy = rows.find((r) => r.userId === 'c')!;
    expect(ana.pick).toEqual({ home: 2, away: 1 });
    expect(ana.points).toBe(3);
    expect(cy.pick).toBeNull();
    expect(cy.points).toBeNull();
  });

  it('sorts by points desc (null/unscored last), then predictors, then name', () => {
    const rows = buildMatchLeaderboard('m1', players, [
      { userId: 'b', matchId: 'm1', homeScore: 1, awayScore: 1, pointsAwarded: 1, exact: false },
      { userId: 'a', matchId: 'm1', homeScore: 2, awayScore: 1, pointsAwarded: 3, exact: true },
    ]);
    expect(rows[0].userId).toBe('a');
    expect(rows[1].userId).toBe('b');
    expect(rows[2].userId).toBe('c');
  });
});
