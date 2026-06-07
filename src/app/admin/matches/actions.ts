'use server';
import { revalidatePath } from 'next/cache';
import { getAdminUser } from '@/lib/admin';
import { validatePredictionScores } from '@/lib/predictions';
import {
  setMatchResult, updateMatchMeta, type MatchStatus, type MatchMeta,
} from '@/lib/admin-matches';
import { recomputeMatch } from '@/lib/scoring';
import { recomputeBracketsAndGroups, recomputeAwards } from '@/lib/bracket-recompute';

export type AdminResult = { ok: boolean; error?: string };

const VALID_STATUS: MatchStatus[] = ['scheduled', 'live', 'finished'];

export async function saveResult(
  matchId: string, home: number | null, away: number | null, status: MatchStatus,
): Promise<AdminResult> {
  if (!(await getAdminUser())) return { ok: false, error: 'Not authorized.' };
  if (!VALID_STATUS.includes(status)) return { ok: false, error: 'Invalid status.' };

  if (status === 'finished') {
    if (home == null || away == null) {
      return { ok: false, error: 'A finished match needs both scores.' };
    }
  }
  // Validate bounds whenever scores are present (finished or not).
  if (home != null && away != null) {
    const v = validatePredictionScores(home, away);
    if (!v.ok) return { ok: false, error: v.error };
  }

  await setMatchResult(matchId, home, away, status);
  await recomputeMatch(matchId);
  await recomputeBracketsAndGroups();
  await recomputeAwards();
  revalidatePath('/fixtures');
  revalidatePath('/admin/matches');
  revalidatePath('/leaderboard');
  revalidatePath('/bracket');
  return { ok: true };
}

export async function saveMatchMeta(matchId: string, meta: MatchMeta): Promise<AdminResult> {
  if (!(await getAdminUser())) return { ok: false, error: 'Not authorized.' };
  if (Number.isNaN(meta.kickoffAt.getTime())) return { ok: false, error: 'Invalid kickoff time.' };

  await updateMatchMeta(matchId, meta);
  // Filling a TBD knockout slot changes reached-round actuals, so recompute brackets/groups.
  await recomputeBracketsAndGroups();
  revalidatePath('/fixtures');
  revalidatePath('/admin/matches');
  revalidatePath('/leaderboard');
  revalidatePath('/bracket');
  return { ok: true };
}
