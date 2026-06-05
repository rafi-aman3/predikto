'use server';
import { createClient } from '@/lib/supabase/server';
import { savePrediction } from '@/app/fixtures/actions';
import { getMatchPredictionAggregate, getNextUnpredictedMatch } from '@/lib/match-social';
import type { Aggregate } from '@/lib/board';

export type LockResult =
  | { ok: false; error: string }
  | { ok: true; aggregate: Aggregate; nextMatchId: string | null };

export async function lockPrediction(matchId: string, home: number, away: number): Promise<LockResult> {
  const res = await savePrediction(matchId, home, away);
  if (!res.ok) return { ok: false, error: res.error ?? 'Could not save.' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const [aggregate, nextMatchId] = await Promise.all([
    getMatchPredictionAggregate(matchId, user.id),
    getNextUnpredictedMatch(user.id, matchId),
  ]);
  return { ok: true, aggregate, nextMatchId };
}
