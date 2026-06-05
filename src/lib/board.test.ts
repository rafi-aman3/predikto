import { describe, it, expect } from 'vitest';
import { buildGroupBoard, buildRankStrip, pickNextUnpredicted, aggregatePredictions } from './board';
import type { FixtureMatch } from './fixtures';

type TeamLite = { id: string; code: string; name: string; flag: string | null; groupName: string | null };

const team = (id: string, group: string | null): TeamLite =>
  ({ id, code: id.toUpperCase(), name: id, flag: '\u{1F3F3}', groupName: group });

const mk = (id: string, group: string | null, home: string | null, away: string | null,
  predicted: boolean): FixtureMatch => ({
  id, externalId: id, stage: 'group', groupName: group,
  kickoffAt: new Date('2026-06-11T20:00:00Z'), status: 'scheduled',
  home: home ? { id: home, code: home, name: home, flag: null } : null,
  away: away ? { id: away, code: away, name: away, flag: null } : null,
  venue: null, homeScore: null, awayScore: null,
  prediction: predicted ? { homeScore: 1, awayScore: 0, pointsAwarded: null } : null,
  locked: false,
});

describe('buildGroupBoard', () => {
  it('groups teams by name and counts predicted matches per group', () => {
    const teams = [team('a1', 'A'), team('a2', 'A'), team('b1', 'B'), team('x', null)];
    const fixtures = [mk('m1', 'A', 'a1', 'a2', true), mk('m2', 'A', 'a1', 'a2', false), mk('m3', 'B', 'b1', 'b1', false)];
    const board = buildGroupBoard(teams, fixtures);
    expect(board.map((g) => g.groupName)).toEqual(['A', 'B']);
    expect(board[0].teams).toHaveLength(2);
    expect(board[0]).toMatchObject({ predicted: 1, total: 2 });
    expect(board[1]).toMatchObject({ predicted: 0, total: 1 });
  });
});

describe('buildRankStrip', () => {
  it('sums awarded points and counts unpredicted matches', () => {
    const fixtures = [
      { ...mk('m1', 'A', 'a', 'b', true), prediction: { homeScore: 1, awayScore: 0, pointsAwarded: 3 } },
      mk('m2', 'A', 'a', 'b', false),
      mk('m3', 'A', 'a', 'b', false),
    ];
    expect(buildRankStrip(fixtures)).toEqual({ points: 3, predicted: 1, matchesLeft: 2, total: 3 });
  });
});

describe('pickNextUnpredicted', () => {
  it('returns the first unpredicted match after the given id', () => {
    const fixtures = [mk('m1', 'A', 'a', 'b', true), mk('m2', 'A', 'a', 'b', false), mk('m3', 'A', 'a', 'b', false)];
    expect(pickNextUnpredicted(fixtures, 'm1')?.id).toBe('m2');
  });
  it('wraps around to the earliest unpredicted match', () => {
    const fixtures = [mk('m1', 'A', 'a', 'b', false), mk('m2', 'A', 'a', 'b', true)];
    expect(pickNextUnpredicted(fixtures, 'm2')?.id).toBe('m1');
  });
  it('returns null when everything is predicted', () => {
    const fixtures = [mk('m1', 'A', 'a', 'b', true), mk('m2', 'A', 'a', 'b', true)];
    expect(pickNextUnpredicted(fixtures, 'm1')).toBeNull();
  });
});

describe('aggregatePredictions', () => {
  it('computes home/draw/away percentages and rounds', () => {
    const rows = [
      { homeScore: 2, awayScore: 1 }, { homeScore: 1, awayScore: 0 },
      { homeScore: 1, awayScore: 1 }, { homeScore: 0, awayScore: 2 },
    ];
    expect(aggregatePredictions(rows)).toEqual({ total: 4, homeWin: 50, draw: 25, awayWin: 25 });
  });
  it('is all-zero for no rows', () => {
    expect(aggregatePredictions([])).toEqual({ total: 0, homeWin: 0, draw: 0, awayWin: 0 });
  });
});
