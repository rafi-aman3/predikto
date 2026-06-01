import { describe, it, expect } from 'vitest';
import { isMatchLocked, arePredictionsLocked } from './locks';

describe('isMatchLocked', () => {
  const kickoff = new Date('2026-06-11T20:00:00Z');
  it('is locked at or after kickoff', () => {
    expect(isMatchLocked(kickoff, new Date('2026-06-11T20:00:00Z'))).toBe(true);
    expect(isMatchLocked(kickoff, new Date('2026-06-11T20:00:01Z'))).toBe(true);
  });
  it('is open before kickoff', () => {
    expect(isMatchLocked(kickoff, new Date('2026-06-11T19:59:59Z'))).toBe(false);
  });
});

describe('arePredictionsLocked', () => {
  const deadline = new Date('2026-06-11T00:00:00Z');
  it('is open when no deadline is set', () => {
    expect(arePredictionsLocked(null, new Date())).toBe(false);
  });
  it('locks at or after the deadline', () => {
    expect(arePredictionsLocked(deadline, deadline)).toBe(true);
    expect(arePredictionsLocked(deadline, new Date('2026-06-10T23:59:59Z'))).toBe(false);
  });
});
