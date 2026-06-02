import type { ScoringConfig } from './scoring-config';

/** Points for a single match prediction against the actual scoreline. */
export function scoreMatch(
  predH: number, predA: number, actualH: number, actualA: number, cfg: ScoringConfig,
): number {
  if (predH === actualH && predA === actualA) return cfg.ptsExact;
  if (Math.sign(predH - predA) === Math.sign(actualH - actualA)) return cfg.ptsResult;
  return 0;
}

type MatchResult = { status: string; homeScore: number | null; awayScore: number | null };

/**
 * Maps each prediction to its awarded points. Returns null points unless the match
 * is finished with both scores set (covers revert/clear → un-score).
 */
export function computePredictionPoints(
  result: MatchResult,
  predictions: Array<{ id: string; homeScore: number; awayScore: number }>,
  cfg: ScoringConfig,
): Array<{ id: string; pointsAwarded: number | null }> {
  const scored = result.status === 'finished' && result.homeScore != null && result.awayScore != null;
  return predictions.map((p) => ({
    id: p.id,
    pointsAwarded: scored ? scoreMatch(p.homeScore, p.awayScore, result.homeScore!, result.awayScore!, cfg) : null,
  }));
}
