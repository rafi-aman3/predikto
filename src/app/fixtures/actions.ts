'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isMatchLocked } from '@/lib/locks';
import {
  validatePredictionScores, upsertPrediction, getMatchKickoff,
} from '@/lib/predictions';

export type SaveResult = { ok: boolean; error?: string };

export async function savePrediction(
  matchId: string,
  home: number,
  away: number,
): Promise<SaveResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in to predict.' };

  const valid = validatePredictionScores(home, away);
  if (!valid.ok) return { ok: false, error: valid.error };

  const kickoff = await getMatchKickoff(matchId);
  if (!kickoff) return { ok: false, error: 'Match not found.' };
  if (isMatchLocked(kickoff)) return { ok: false, error: 'This match is locked (kickoff has passed).' };

  await upsertPrediction(user.id, matchId, valid.home, valid.away);
  revalidatePath('/fixtures');
  return { ok: true };
}
