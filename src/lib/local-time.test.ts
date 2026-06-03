import { describe, it, expect } from 'vitest';
import { timeRemaining, groupByLocalDate } from './local-time';
import type { FixtureMatch } from './fixtures';

const mk = (id: string, iso: string): FixtureMatch => ({
  id, externalId: id, stage: 'group', groupName: 'A',
  kickoffAt: new Date(iso), status: 'scheduled',
  home: null, away: null, venue: null,
  homeScore: null, awayScore: null, prediction: null, locked: false,
});

describe('timeRemaining', () => {
  it('breaks a future gap into d/h/m/s', () => {
    const now = new Date('2026-06-10T20:00:00Z');
    const target = new Date('2026-06-11T20:00:00Z'); // exactly 1 day
    expect(timeRemaining(target, now)).toEqual({ days: 1, hours: 0, minutes: 0, seconds: 0, done: false });
  });
  it('handles mixed remainder', () => {
    const now = new Date('2026-06-10T18:30:15Z');
    const target = new Date('2026-06-12T20:45:20Z');
    expect(timeRemaining(target, now)).toEqual({ days: 2, hours: 2, minutes: 15, seconds: 5, done: false });
  });
  it('is done at or after the target', () => {
    const t = new Date('2026-06-11T20:00:00Z');
    expect(timeRemaining(t, t)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, done: true });
    expect(timeRemaining(t, new Date('2026-06-11T20:00:01Z')).done).toBe(true);
  });
});

describe('groupByLocalDate', () => {
  // Inject a UTC+6 day key so the test is deterministic regardless of the runner's TZ.
  const plus6Key = (d: Date) => new Date(d.getTime() + 6 * 3600 * 1000).toISOString().slice(0, 10);

  it('buckets matches by the injected local day and sorts chronologically', () => {
    const early = mk('a', '2026-06-11T10:00:00Z'); // +6 → 16:00 same day → 2026-06-11
    const late = mk('b', '2026-06-11T20:00:00Z');  // +6 → 02:00 next day → 2026-06-12
    const groups = groupByLocalDate([late, early], plus6Key);
    expect(groups.map((g) => g.dateKey)).toEqual(['2026-06-11', '2026-06-12']);
    expect(groups[0].matches.map((m) => m.id)).toEqual(['a']);
    expect(groups[1].matches.map((m) => m.id)).toEqual(['b']);
  });

  it('keeps same-day matches together, time-sorted', () => {
    const m1 = mk('x', '2026-06-11T15:00:00Z');
    const m2 = mk('y', '2026-06-11T12:00:00Z');
    const groups = groupByLocalDate([m1, m2], plus6Key);
    expect(groups).toHaveLength(1);
    expect(groups[0].matches.map((m) => m.id)).toEqual(['y', 'x']);
  });
});
