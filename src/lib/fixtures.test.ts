import { describe, it, expect } from 'vitest';
import { groupByDate, groupByStage, type FixtureMatch } from './fixtures';

function fx(partial: Partial<FixtureMatch> & { id: string; kickoffAt: Date }): FixtureMatch {
  return {
    id: partial.id, externalId: partial.id, stage: partial.stage ?? 'group',
    groupName: partial.groupName ?? null, kickoffAt: partial.kickoffAt,
    status: partial.status ?? 'scheduled', home: null, away: null, venue: null,
    homeScore: null, awayScore: null, prediction: null, locked: false,
  };
}

describe('groupByDate', () => {
  it('groups by UTC date and sorts chronologically', () => {
    const groups = groupByDate([
      fx({ id: 'b', kickoffAt: new Date('2026-06-12T19:00:00Z') }),
      fx({ id: 'a', kickoffAt: new Date('2026-06-11T20:00:00Z') }),
      fx({ id: 'c', kickoffAt: new Date('2026-06-12T23:00:00Z') }),
    ]);
    expect(groups.map((g) => g.date)).toEqual(['2026-06-11', '2026-06-12']);
    expect(groups[1].matches.map((m) => m.id)).toEqual(['b', 'c']); // sorted by kickoff within day
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
