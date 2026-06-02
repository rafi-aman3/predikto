import { describe, it, expect } from 'vitest';
import { scoreMatch, computePredictionPoints } from './scoring';
import { DEFAULT_SCORING } from './scoring-config';

const cfg = DEFAULT_SCORING;

describe('scoreMatch', () => {
  it('awards exact-score points for a perfect prediction', () => {
    expect(scoreMatch(2, 1, 2, 1, cfg)).toBe(cfg.ptsExact);
  });
  it('awards result points for the right outcome but wrong score', () => {
    expect(scoreMatch(3, 0, 1, 0, cfg)).toBe(cfg.ptsResult); // home win
    expect(scoreMatch(0, 0, 2, 2, cfg)).toBe(cfg.ptsResult); // draw
    expect(scoreMatch(0, 1, 1, 3, cfg)).toBe(cfg.ptsResult); // away win
  });
  it('awards nothing for the wrong outcome', () => {
    expect(scoreMatch(2, 1, 0, 1, cfg)).toBe(0);
    expect(scoreMatch(1, 1, 2, 0, cfg)).toBe(0);
  });
  it('honors custom config values', () => {
    const custom = { ...cfg, ptsExact: 5, ptsResult: 2 };
    expect(scoreMatch(1, 0, 1, 0, custom)).toBe(5);
    expect(scoreMatch(2, 0, 1, 0, custom)).toBe(2);
  });
});

describe('computePredictionPoints', () => {
  const preds = [
    { id: 'a', homeScore: 2, awayScore: 1 },
    { id: 'b', homeScore: 0, awayScore: 0 },
  ];
  it('scores all predictions for a finished match with scores', () => {
    const out = computePredictionPoints({ status: 'finished', homeScore: 2, awayScore: 1 }, preds, cfg);
    expect(out).toEqual([
      { id: 'a', pointsAwarded: cfg.ptsExact },
      { id: 'b', pointsAwarded: 0 },
    ]);
  });
  it('nulls points for a non-finished match', () => {
    const out = computePredictionPoints({ status: 'live', homeScore: 2, awayScore: 1 }, preds, cfg);
    expect(out).toEqual([
      { id: 'a', pointsAwarded: null },
      { id: 'b', pointsAwarded: null },
    ]);
  });
  it('nulls points when a finished match is missing a score', () => {
    const out = computePredictionPoints({ status: 'finished', homeScore: 2, awayScore: null }, preds, cfg);
    expect(out.every((p) => p.pointsAwarded === null)).toBe(true);
  });
});
