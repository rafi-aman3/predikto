import { describe, it, expect } from 'vitest';
import { computeGroupStandings } from './standings';
import type { FixtureMatch } from './fixtures';

type BoardTeam = { id: string; code: string; name: string; flag: string | null; groupName: string | null };
const team = (id: string, name: string, group: string | null): BoardTeam =>
  ({ id, code: id.toUpperCase(), name, flag: null, groupName: group });

const fin = (id: string, group: string | null, homeId: string, awayId: string, hs: number, as_: number): FixtureMatch => ({
  id, externalId: id, stage: 'group', groupName: group,
  kickoffAt: new Date('2026-06-11T20:00:00Z'), status: 'finished',
  home: { id: homeId, code: homeId, name: homeId, flag: null },
  away: { id: awayId, code: awayId, name: awayId, flag: null },
  venue: null, homeScore: hs, awayScore: as_, prediction: null, locked: true,
});

describe('computeGroupStandings', () => {
  it('returns zeroed rows sorted alphabetically when no matches are finished', () => {
    const teams = [team('z', 'Zebra', 'A'), team('a', 'Alpha', 'A'), team('x', 'Xray', 'B')];
    const s = computeGroupStandings(teams, []);
    expect(s.map((g) => g.groupName)).toEqual(['A', 'B']);
    expect(s[0].rows.map((r) => r.name)).toEqual(['Alpha', 'Zebra']);
    expect(s[0].rows[0]).toMatchObject({ played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 });
  });

  it('computes W/D/L, goals, gd and points from finished group matches and orders by pts then gd then gf', () => {
    const teams = [team('a', 'Alpha', 'A'), team('b', 'Bravo', 'A'), team('c', 'Cup', 'A')];
    // Alpha 3-0 Bravo; Bravo 1-1 Cup; Alpha 2-1 Cup
    const fixtures = [
      fin('m1', 'A', 'a', 'b', 3, 0),
      fin('m2', 'A', 'b', 'c', 1, 1),
      fin('m3', 'A', 'a', 'c', 2, 1),
    ];
    const rows = computeGroupStandings(teams, fixtures)[0].rows;
    expect(rows.map((r) => r.name)).toEqual(['Alpha', 'Cup', 'Bravo']);
    expect(rows[0]).toMatchObject({ name: 'Alpha', played: 2, won: 2, drawn: 0, lost: 0, gf: 5, ga: 1, gd: 4, points: 6 });
    expect(rows[1]).toMatchObject({ name: 'Cup', played: 2, won: 0, drawn: 1, lost: 1, gf: 2, ga: 3, gd: -1, points: 1 });
    expect(rows[2]).toMatchObject({ name: 'Bravo', played: 2, won: 0, drawn: 1, lost: 1, gf: 1, ga: 4, gd: -3, points: 1 });
  });

  it('ignores non-finished and non-group matches', () => {
    const teams = [team('a', 'Alpha', 'A'), team('b', 'Bravo', 'A')];
    const scheduled: FixtureMatch = { ...fin('s1', 'A', 'a', 'b', 5, 0), status: 'scheduled', homeScore: null, awayScore: null };
    const knockout: FixtureMatch = { ...fin('k1', null, 'a', 'b', 9, 0), stage: 'r16' };
    const rows = computeGroupStandings(teams, [scheduled, knockout])[0].rows;
    expect(rows.every((r) => r.played === 0 && r.points === 0)).toBe(true);
  });
});
