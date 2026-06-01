import { db } from '@/db';
import { matchPredictions, matches } from '@/db/schema';
import { eq } from 'drizzle-orm';

const MAX_GOALS = 30;

export type ValidationResult =
  | { ok: true; home: number; away: number }
  | { ok: false; error: string };

export function validatePredictionScores(home: number, away: number): ValidationResult {
  for (const v of [home, away]) {
    if (!Number.isInteger(v) || v < 0 || v > MAX_GOALS) {
      return { ok: false, error: 'Scores must be whole numbers between 0 and 30.' };
    }
  }
  return { ok: true, home, away };
}

export async function getUserPredictionMap(userId: string) {
  const rows = await db.select().from(matchPredictions).where(eq(matchPredictions.userId, userId));
  return new Map(
    rows.map((r) => [r.matchId, { homeScore: r.homeScore, awayScore: r.awayScore, pointsAwarded: r.pointsAwarded }]),
  );
}

/** Upserts a user's prediction for a match. Lock + auth must be checked by the caller. */
export async function upsertPrediction(userId: string, matchId: string, home: number, away: number) {
  await db
    .insert(matchPredictions)
    .values({ userId, matchId, homeScore: home, awayScore: away })
    .onConflictDoUpdate({
      target: [matchPredictions.userId, matchPredictions.matchId],
      set: { homeScore: home, awayScore: away, updatedAt: new Date() },
    });
}

/** Reads a single match's kickoff time (for server-side lock enforcement). */
export async function getMatchKickoff(matchId: string): Promise<Date | null> {
  const rows = await db.select({ kickoffAt: matches.kickoffAt }).from(matches).where(eq(matches.id, matchId));
  return rows[0]?.kickoffAt ?? null;
}
