import { describe, it, expect } from 'vitest';
import { DEFAULT_SCORING } from './scoring-config';
import { scoreGroupPredictions, pickActualAdvancingThirds, scoreBracket, scoreAwards } from './bracket-scoring';
import type { GroupStandings, StandingRow } from './standings';

const cfg = DEFAULT_SCORING;

const row = (teamId: string, points: number, gd = 0, gf = 0): StandingRow => ({
  teamId, code: teamId, name: teamId, flag: null,
  played: 3, won: 0, drawn: 0, lost: 0, gf, ga: 0, gd, points,
});

const actualStandings: GroupStandings[] = [
  { groupName: 'A', rows: [row('A1', 9), row('A2', 6), row('A3', 3), row('A4', 0)] },
  { groupName: 'B', rows: [row('B1', 9), row('B2', 6), row('B3', 4, 2), row('B4', 0)] },
];

describe('scoreGroupPredictions', () => {
  it('awards exact-position points and third-qualifier points', () => {
    const predicted = [
      { teamId: 'A1', groupName: 'A', position: 1, advancesAsThird: false },
      { teamId: 'A2', groupName: 'A', position: 3, advancesAsThird: false },
      { teamId: 'A3', groupName: 'A', position: 3, advancesAsThird: true },
      { teamId: 'A4', groupName: 'A', position: 4, advancesAsThird: false },
    ];
    const actualThirds = new Set(['A3']);
    const out = scoreGroupPredictions(predicted, actualStandings, actualThirds, cfg);
    const by = Object.fromEntries(out.map((o) => [o.teamId, o.pointsAwarded]));
    expect(by.A1).toBe(2);
    expect(by.A2).toBe(0);
    expect(by.A3).toBe(3);
    expect(by.A4).toBe(2);
  });

  it('gives no third bonus when the chosen third did not actually advance', () => {
    const predicted = [{ teamId: 'B3', groupName: 'B', position: 3, advancesAsThird: true }];
    const out = scoreGroupPredictions(predicted, actualStandings, new Set<string>(), cfg);
    expect(out[0].pointsAwarded).toBe(2);
  });
});

describe('pickActualAdvancingThirds', () => {
  it('returns the best N third-placed teams across groups by points/gd/gf', () => {
    const thirds = pickActualAdvancingThirds(actualStandings, 1);
    expect(thirds).toEqual(new Set(['B3']));
  });
});

describe('scoreBracket', () => {
  const actualReached = {
    r16: new Set(['X', 'Y', 'Z']),
    qf: new Set(['X', 'Y']),
    sf: new Set(['X']),
    final: new Set(['X']),
  };
  it('awards per-stage points when the predicted team actually reached that stage', () => {
    const preds = [
      { stage: 'r16' as const, teamId: 'X' },
      { stage: 'qf' as const, teamId: 'X' },
      { stage: 'sf' as const, teamId: 'X' },
      { stage: 'final' as const, teamId: 'X' },
      { stage: 'r16' as const, teamId: 'Q' },
    ];
    const out = scoreBracket(preds, actualReached, cfg);
    expect(out.map((o) => o.pointsAwarded)).toEqual([1, 2, 3, 5, 0]);
  });
});

describe('scoreAwards', () => {
  it('sums champion/runner-up/golden-boot/best-player/surprise for correct picks', () => {
    const predicted = {
      championTeamId: 'C', runnerUpTeamId: 'R',
      goldenBootPlayerId: 'g', bestPlayerId: 'b', surpriseTeamId: 's',
    };
    const actual = {
      championTeamId: 'C', runnerUpTeamId: 'X',
      goldenBootPlayerId: 'g', bestPlayerId: 'z',
      surpriseTeamId: 's',
    };
    expect(scoreAwards(predicted, actual, cfg)).toBe(20);
  });

  it('is zero when nothing matches or actuals are null', () => {
    const predicted = { championTeamId: 'C', runnerUpTeamId: 'R', goldenBootPlayerId: 'g', bestPlayerId: 'b', surpriseTeamId: 's' };
    const actual = { championTeamId: null, runnerUpTeamId: null, goldenBootPlayerId: null, bestPlayerId: null, surpriseTeamId: null };
    expect(scoreAwards(predicted, actual, cfg)).toBe(0);
  });
});
