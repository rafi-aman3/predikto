import { describe, it, expect } from 'vitest';
import { groupByStage, type FixtureMatch } from './fixtures';

function fx(partial: Partial<FixtureMatch> & { id: string; kickoffAt: Date }): FixtureMatch {
  return {
    id: partial.id, externalId: partial.id, stage: partial.stage ?? 'group',
    groupName: partial.groupName ?? null, kickoffAt: partial.kickoffAt,
    status: partial.status ?? 'scheduled', home: null, away: null, venue: null,
    homeScore: null, awayScore: null, prediction: null, locked: false,
  };
}

describe('groupByStage', () => {
  it('groups matches under their stage in tournament order', () => {
    const groups = groupByStage([
      fx({ id: 'final1', kickoffAt: new Date('2026-07-19T19:00:00Z'), stage: 'final' }),
      fx({ id: 'grp1', kickoffAt: new Date('2026-06-11T20:00:00Z'), stage: 'group' }),
    ]);
    expect(groups.map((g) => g.stage)).toEqual(['group', 'final']);
  });
});
