import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/db';
import { matchPredictions } from '@/db/schema';
import { aggregatePredictions, pickNextUnpredicted, type Aggregate } from './board';
import { getFixtures } from './fixtures';
import { getUserPredictionMap } from './predictions';

/** Outcome split across OTHER users' predictions for a match. Caller must gate on the viewer being locked in. */
export async function getMatchPredictionAggregate(matchId: string, excludeUserId: string): Promise<Aggregate> {
  const rows = await db
    .select({ homeScore: matchPredictions.homeScore, awayScore: matchPredictions.awayScore })
    .from(matchPredictions)
    .where(and(eq(matchPredictions.matchId, matchId), ne(matchPredictions.userId, excludeUserId)));
  return aggregatePredictions(rows);
}

/** The user's next unpredicted fixture after `afterId` (wraps). Null if none. */
export async function getNextUnpredictedMatch(userId: string, afterId: string): Promise<string | null> {
  const map = await getUserPredictionMap(userId);
  const fixtures = await getFixtures(map);
  return pickNextUnpredicted(fixtures, afterId)?.id ?? null;
}
