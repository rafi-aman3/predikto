import { describe, it, expect } from 'vitest';
import { validatePredictionScores } from './predictions';

describe('validatePredictionScores', () => {
  it('accepts non-negative integers', () => {
    expect(validatePredictionScores(2, 1)).toEqual({ ok: true, home: 2, away: 1 });
    expect(validatePredictionScores(0, 0)).toEqual({ ok: true, home: 0, away: 0 });
  });
  it('rejects negatives, non-integers, and absurd values', () => {
    expect(validatePredictionScores(-1, 0).ok).toBe(false);
    expect(validatePredictionScores(1.5, 0).ok).toBe(false);
    expect(validatePredictionScores(0, 100).ok).toBe(false); // cap absurd scores
    expect(validatePredictionScores(NaN, 0).ok).toBe(false);
  });
});
