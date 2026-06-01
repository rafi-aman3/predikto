import { describe, it, expect } from 'vitest';
import { parseSeed } from './seed-data';

const sample = {
  venues: [{ name: 'Estadio Azteca', city: 'Mexico City', country: 'Mexico' }],
  teams: [{
    code: 'MEX', name: 'Mexico', flag: '🇲🇽', groupName: 'A', fifaRank: 14, wcTitles: 0,
    coach: 'Aguirre',
    squad: [{ name: 'Ochoa', position: 'GK', shirtNumber: 13, club: 'AVS', age: 40, caps: 150 }],
  }],
  matches: [{
    externalId: 'M1', stage: 'group', groupName: 'A',
    homeTeamCode: 'MEX', awayTeamCode: null,
    venueName: 'Estadio Azteca', kickoffAt: '2026-06-11T20:00:00Z',
  }],
};

describe('parseSeed', () => {
  it('parses a valid seed', () => {
    const s = parseSeed(sample);
    expect(s.teams[0].code).toBe('MEX');
    expect(s.teams[0].squad[0].name).toBe('Ochoa');
    expect(s.matches[0].externalId).toBe('M1');
  });
  it('rejects a match whose venue is missing from venues[]', () => {
    const bad = { ...sample, matches: [{ ...sample.matches[0], venueName: 'Nowhere' }] };
    expect(() => parseSeed(bad)).toThrow(/venue/i);
  });
  it('rejects a match referencing an unknown team code', () => {
    const bad = { ...sample, matches: [{ ...sample.matches[0], homeTeamCode: 'XXX' }] };
    expect(() => parseSeed(bad)).toThrow(/team/i);
  });
});
