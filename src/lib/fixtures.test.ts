import { describe, it, expect } from 'vitest';
import { groupByStage, predictionRowState, type FixtureMatch } from './fixtures';

function fx(partial: Partial<FixtureMatch> & { id: string; kickoffAt: Date }): FixtureMatch {
  return {
    id: partial.id, externalId: partial.id, stage: partial.stage ?? 'group',
    groupName: partial.groupName ?? null, kickoffAt: partial.kickoffAt,
    status: partial.status ?? 'scheduled', home: null, away: null, venue: null,
    homeScore: null, awayScore: null, prediction: null, locked: false,
  };
}

const base = (over: Partial<FixtureMatch> = {}): FixtureMatch => ({
  id: 'm1', externalId: 'm1', stage: 'group', groupName: 'A',
  kickoffAt: new Date('2026-06-11T18:00:00Z'), status: 'scheduled',
  home: null, away: null, venue: null,
  homeScore: null, awayScore: null, prediction: null, locked: false,
  ...over,
});

describe('predictionRowState', () => {
  it('open + no prediction → predict', () => {
    expect(predictionRowState(base())).toEqual({ kind: 'predict' });
  });

  it('open + prediction → picked with scoreline', () => {
    const m = base({ prediction: { homeScore: 2, awayScore: 1, pointsAwarded: null } });
    expect(predictionRowState(m)).toEqual({ kind: 'picked', pick: '2–1' });
  });

  it('locked + no prediction → locked', () => {
    expect(predictionRowState(base({ locked: true }))).toEqual({ kind: 'locked' });
  });

  it('locked + prediction → picked', () => {
    const m = base({ locked: true, prediction: { homeScore: 0, awayScore: 0, pointsAwarded: null } });
    expect(predictionRowState(m)).toEqual({ kind: 'picked', pick: '0–0' });
  });

  it('finished with pick + points → finished score/pick/points', () => {
    const m = base({
      status: 'finished', locked: true, homeScore: 2, awayScore: 1,
      prediction: { homeScore: 2, awayScore: 1, pointsAwarded: 3 },
    });
    expect(predictionRowState(m)).toEqual({ kind: 'finished', score: '2–1', pick: '2–1', points: 3 });
  });

  it('finished without a pick → finished, no pick, no points', () => {
    const m = base({ status: 'finished', locked: true, homeScore: 0, awayScore: 0 });
    expect(predictionRowState(m)).toEqual({ kind: 'finished', score: '0–0', pick: null, points: null });
  });

  it('live → live with current score and pick', () => {
    const m = base({
      status: 'live', homeScore: 1, awayScore: 0,
      prediction: { homeScore: 2, awayScore: 0, pointsAwarded: null },
    });
    expect(predictionRowState(m)).toEqual({ kind: 'live', score: '1–0', pick: '2–0' });
  });
});

describe('groupByStage', () => {
  it('groups matches under their stage in tournament order', () => {
    const groups = groupByStage([
      fx({ id: 'final1', kickoffAt: new Date('2026-07-19T19:00:00Z'), stage: 'final' }),
      fx({ id: 'grp1', kickoffAt: new Date('2026-06-11T20:00:00Z'), stage: 'group' }),
    ]);
    expect(groups.map((g) => g.stage)).toEqual(['group', 'final']);
  });
});
