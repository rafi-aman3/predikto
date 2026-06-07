import { describe, it, expect } from 'vitest';
import { R32_TIES, buildR32Field, type PredictedStandings } from './bracket';
import { reconstructBracket, validateBracket, type ReachedSets } from './bracket';

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

describe('reconstructBracket', () => {
  // Build a full deterministic run: at each round the HOME team always advances.
  const r32 = buildR32Field(standings, thirds);
  const r16Winners = r32.map((t) => t.home!);            // 16 home teams
  const reached: ReachedSets = {
    r16: new Set(r16Winners),
    qf: new Set([0, 2, 4, 6, 8, 10, 12, 14].map((i) => r16Winners[i])), // homes of r16 ties
    sf: new Set([0, 4, 8, 12].map((i) => r16Winners[i])),
    final: new Set([0, 8].map((i) => r16Winners[i])),
  };

  it('builds 16/8/4/2/1 ties with winners drawn from the next round\'s reached set', () => {
    const tree = reconstructBracket(standings, thirds, reached);
    expect(tree.r32).toHaveLength(16);
    expect(tree.r16).toHaveLength(8);
    expect(tree.qf).toHaveLength(4);
    expect(tree.sf).toHaveLength(2);
    expect(tree.final).toHaveLength(1);
    expect(tree.r32[0].winner).toBe('A1');
    expect(tree.r16[0].home).toBe(r32[0].home);
    expect(tree.r16[0].away).toBe(r32[1].home);
    expect(tree.final[0].home).not.toBeNull();
    expect(tree.final[0].away).not.toBeNull();
  });
});

describe('validateBracket', () => {
  const groupTeams = Object.fromEntries(
    Object.entries(standings).map(([g, o]) => [g, [...o]]),
  );
  const fullReached = (() => {
    const r32 = buildR32Field(standings, thirds);
    const homes = r32.map((t) => t.home!);
    return {
      r16: homes,
      qf: [0, 2, 4, 6, 8, 10, 12, 14].map((i) => homes[i]),
      sf: [0, 4, 8, 12].map((i) => homes[i]),
      final: [0, 8].map((i) => homes[i]),
    };
  })();

  it('accepts a complete, consistent bracket', () => {
    const res = validateBracket({ groupTeams, standings, chosenThirds: thirds, reached: fullReached });
    expect(res.ok).toBe(true);
  });

  it('rejects when a group order is not a full permutation', () => {
    const bad = { ...standings, A: ['A1', 'A1', 'A3', 'A4'] };
    const res = validateBracket({ groupTeams, standings: bad, chosenThirds: thirds, reached: fullReached });
    expect(res.ok).toBe(false);
  });

  it('rejects when not exactly 8 thirds are chosen', () => {
    const res = validateBracket({ groupTeams, standings, chosenThirds: thirds.slice(0, 7), reached: fullReached });
    expect(res.ok).toBe(false);
  });

  it('rejects an r16 set that is not one team per R32 tie', () => {
    const r32 = buildR32Field(standings, thirds);
    const homes = r32.map((t) => t.home!);
    const broken = [...homes]; broken[1] = homes[0]; // two from tie 0, none from tie 1
    const res = validateBracket({
      groupTeams, standings, chosenThirds: thirds,
      reached: { ...fullReached, r16: broken },
    });
    expect(res.ok).toBe(false);
  });

  // Backstop isolation: count stays exactly 16 but tie 0 holds BOTH participants while
  // tie 1 is orphaned — the size check passes, so the winner!=null check must reject it.
  it('rejects when the count is right but a tie has both/neither participant', () => {
    const r32 = buildR32Field(standings, thirds);
    const homes = r32.map((t) => t.home!);
    const orphan = [...homes]; orphan[1] = r32[0].away!; // 16 distinct, but tie0 both / tie1 none
    expect(new Set(orphan).size).toBe(16);
    const res = validateBracket({
      groupTeams, standings, chosenThirds: thirds,
      reached: { ...fullReached, r16: orphan },
    });
    expect(res.ok).toBe(false);
  });
});

describe('reconstructBracket order-independence', () => {
  it('produces an identical tree regardless of reached insertion order', () => {
    const r32 = buildR32Field(standings, thirds);
    const homes = r32.map((t) => t.home!);
    const base = {
      r16: homes,
      qf: [0, 2, 4, 6, 8, 10, 12, 14].map((i) => homes[i]),
      sf: [0, 4, 8, 12].map((i) => homes[i]),
      final: [0, 8].map((i) => homes[i]),
    };
    const toSets = (r: typeof base): ReachedSets =>
      ({ r16: new Set(r.r16), qf: new Set(r.qf), sf: new Set(r.sf), final: new Set(r.final) });
    const reversed = {
      r16: [...base.r16].reverse(), qf: [...base.qf].reverse(),
      sf: [...base.sf].reverse(), final: [...base.final].reverse(),
    };
    expect(reconstructBracket(standings, thirds, toSets(reversed)))
      .toEqual(reconstructBracket(standings, thirds, toSets(base)));
  });
});
