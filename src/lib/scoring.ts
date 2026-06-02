import type { ScoringConfig } from './scoring-config';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { matches, matchPredictions } from '@/db/schema';
import { getScoringConfig } from './app-settings';

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

/**
 * Recomputes pointsAwarded for every prediction of a match. Scores when the match
 * is finished with both scores set; otherwise clears points to null. Per-match only:
 * a match prediction's points depend solely on that match's result.
 */
export async function recomputeMatch(matchId: string): Promise<void> {
  const [m] = await db.select().from(matches).where(eq(matches.id, matchId));
  if (!m) return;
  const preds = await db.select().from(matchPredictions).where(eq(matchPredictions.matchId, matchId));
  if (preds.length === 0) return;
  const cfg = await getScoringConfig();
  const updates = computePredictionPoints(
    { status: m.status, homeScore: m.homeScore, awayScore: m.awayScore },
    preds.map((p) => ({ id: p.id, homeScore: p.homeScore, awayScore: p.awayScore })),
    cfg,
  );
  for (const u of updates) {
    await db.update(matchPredictions)
      .set({ pointsAwarded: u.pointsAwarded })
      .where(eq(matchPredictions.id, u.id));
  }
}
