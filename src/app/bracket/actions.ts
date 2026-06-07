'use server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  teams, groupPredictions, bracketPredictions, awardPredictions,
} from '@/db/schema';
import { createClient } from '@/lib/supabase/server';
import { getPredictionsLockAt } from '@/lib/app-settings';
import { arePredictionsLocked } from '@/lib/locks';
import { validateBracket, type PredictedStandings } from '@/lib/bracket';

export type SaveBracketInput = {
  standings: PredictedStandings;          // group -> ordered team ids
  chosenThirds: string[];                 // 8 team ids
  reached: { r16: string[]; qf: string[]; sf: string[]; final: string[] };
  awards: {
    goldenBootPlayerId: string | null; bestPlayerId: string | null; surpriseTeamId: string | null;
  };
  // champion + runner-up are derived from reached.final (the two finalists) + the user's
  // tapped champion:
  championTeamId: string | null;
};

export type SaveResult = { ok: boolean; error?: string };

export async function saveBracket(input: SaveBracketInput): Promise<SaveResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sign in to save your bracket.' };

  const lockAt = await getPredictionsLockAt();
  if (arePredictionsLocked(lockAt)) return { ok: false, error: 'Predictions are locked.' };

  // Build the actual group membership from the DB (source of truth for validation).
  const teamRows = await db.select().from(teams);
  const groupTeams: Record<string, string[]> = {};
  for (const t of teamRows) {
    if (!t.groupName) continue;
    (groupTeams[t.groupName] ??= []).push(t.id);
  }

  const v = validateBracket({
    groupTeams, standings: input.standings, chosenThirds: input.chosenThirds, reached: input.reached,
  });
  if (!v.ok) return { ok: false, error: v.error };

  // Champion (if set) must be one of the two finalists; runner-up is the other.
  let runnerUpTeamId: string | null = null;
  if (input.championTeamId) {
    if (!input.reached.final.includes(input.championTeamId)) {
      return { ok: false, error: 'Champion must be one of your two finalists.' };
    }
    runnerUpTeamId = input.reached.final.find((id) => id !== input.championTeamId) ?? null;
  }

  const userId = user.id;
  const thirdSet = new Set(input.chosenThirds);

  // Flatten group picks: one row per team, position from the predicted order.
  const groupRows = Object.entries(input.standings).flatMap(([groupName, order]) =>
    order.map((teamId, i) => ({
      userId, groupName, teamId, position: i + 1,
      advancesAsThird: i === 2 && thirdSet.has(teamId),
      pointsAwarded: null as number | null,
    })),
  );

  const bracketRows = (['r16', 'qf', 'sf', 'final'] as const).flatMap((stage) =>
    input.reached[stage].map((teamId) => ({ userId, stage, teamId, pointsAwarded: null as number | null })),
  );

  // Award ids are the only inputs validateBracket doesn't cover — a bad team/player id
  // trips an FK constraint. Wrap so that surfaces as a friendly SaveResult, not a throw
  // (the whole mutation is atomic, so a failure rolls back the deletes too).
  try {
    await db.transaction(async (tx) => {
      await tx.delete(groupPredictions).where(eq(groupPredictions.userId, userId));
      if (groupRows.length) await tx.insert(groupPredictions).values(groupRows);

      await tx.delete(bracketPredictions).where(eq(bracketPredictions.userId, userId));
      if (bracketRows.length) await tx.insert(bracketPredictions).values(bracketRows);

      await tx.insert(awardPredictions).values({
        userId,
        championTeamId: input.championTeamId,
        runnerUpTeamId,
        goldenBootPlayerId: input.awards.goldenBootPlayerId,
        bestPlayerId: input.awards.bestPlayerId,
        surpriseTeamId: input.awards.surpriseTeamId,
        pointsAwarded: null,
      }).onConflictDoUpdate({
        target: awardPredictions.userId,
        set: {
          championTeamId: input.championTeamId,
          runnerUpTeamId,
          goldenBootPlayerId: input.awards.goldenBootPlayerId,
          bestPlayerId: input.awards.bestPlayerId,
          surpriseTeamId: input.awards.surpriseTeamId,
          pointsAwarded: null,
        },
      });
    });
  } catch {
    return { ok: false, error: 'Could not save your bracket. Please try again.' };
  }

  revalidatePath('/bracket');
  revalidatePath('/leaderboard');
  return { ok: true };
}
