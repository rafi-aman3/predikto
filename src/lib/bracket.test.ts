import { describe, it, expect } from 'vitest';
import { R32_TIES, buildR32Field, type PredictedStandings } from './bracket';

// Helper: 12 groups A..L, teams named "<group><pos>" e.g. "A1".."A4".
const standings: PredictedStandings = Object.fromEntries(
  'ABCDEFGHIJKL'.split('').map((g) => [g, [`${g}1`, `${g}2`, `${g}3`, `${g}4`]]),
);
// 8 chosen thirds (each is the position-3 team of its group):
const thirds = ['A3', 'B3', 'C3', 'D3', 'E3', 'F3', 'G3', 'H3'];

describe('R32_TIES template', () => {
  it('has 16 ties using each top-2 code once and 8 third placeholders', () => {
    expect(R32_TIES).toHaveLength(16);
    const codes = R32_TIES.flat();
    expect(codes).toHaveLength(32);
    for (const g of 'ABCDEFGHIJKL') {
      expect(codes.filter((c) => c === `1${g}`)).toHaveLength(1);
      expect(codes.filter((c) => c === `2${g}`)).toHaveLength(1);
    }
    const thirdSlots = codes.filter((c) => c.startsWith('3#'));
    expect(new Set(thirdSlots).size).toBe(8);
  });
});

describe('buildR32Field', () => {
  it('resolves top-2 codes from standings and fills thirds by group letter', () => {
    const field = buildR32Field(standings, thirds);
    expect(field).toHaveLength(16);
    // Tie 0 in the template is ["1A","3#1"] => A1 vs the first third by group order (A3).
    expect(field[0]).toEqual({ tie: 0, home: 'A1', away: 'A3' });
    const ids = field.flatMap((t) => [t.home, t.away]);
    expect(ids.every((x) => x !== null)).toBe(true);
    expect(new Set(ids).size).toBe(32);
  });

  it('assigns thirds deterministically by their group letter regardless of input order', () => {
    const shuffled = ['H3', 'A3', 'D3', 'C3', 'F3', 'B3', 'E3', 'G3'];
    expect(buildR32Field(standings, shuffled)).toEqual(buildR32Field(standings, thirds));
  });
});
