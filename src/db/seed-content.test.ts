import { describe, it, expect } from 'vitest';
import { parseSeed } from './seed-data';
import raw from '../../data/seed.json';

const seed = parseSeed(raw);

describe('data/seed.json — full WC2026 dataset', () => {
  it('has 48 teams with unique codes', () => {
    expect(seed.teams).toHaveLength(48);
    expect(new Set(seed.teams.map((t) => t.code)).size).toBe(48);
  });
  it('has 16 venues', () => {
    expect(seed.venues).toHaveLength(16);
  });
  it('has 104 matches with unique externalIds', () => {
    expect(seed.matches).toHaveLength(104);
    expect(new Set(seed.matches.map((m) => m.externalId)).size).toBe(104);
  });
  it('has 72 group matches, each with both team codes set', () => {
    const group = seed.matches.filter((m) => m.stage === 'group');
    expect(group).toHaveLength(72);
    for (const m of group) {
      expect(m.homeTeamCode).not.toBeNull();
      expect(m.awayTeamCode).not.toBeNull();
    }
  });
  it('has 32 knockout matches across r32/r16/qf/sf/third/final', () => {
    const ko = seed.matches.filter((m) => m.stage !== 'group');
    expect(ko).toHaveLength(32);
    const counts = ko.reduce<Record<string, number>>((a, m) => ((a[m.stage] = (a[m.stage] ?? 0) + 1), a), {});
    expect(counts).toEqual({ r32: 16, r16: 8, qf: 4, sf: 2, third: 1, final: 1 });
  });
  it('every match has a valid kickoff date and known stage', () => {
    const stages = new Set(['group', 'r32', 'r16', 'qf', 'sf', 'third', 'final']);
    for (const m of seed.matches) {
      expect(stages.has(m.stage)).toBe(true);
      expect(Number.isNaN(new Date(m.kickoffAt).getTime())).toBe(false);
    }
  });
  it('assigns every non-placeholder group A–L', () => {
    const groups = new Set(seed.teams.map((t) => t.groupName).filter(Boolean));
    expect([...groups].sort().join('')).toBe('ABCDEFGHIJKL');
  });
});
