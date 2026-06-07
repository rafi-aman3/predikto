'use server';
import { revalidatePath } from 'next/cache';
import { getAdminUser } from '@/lib/admin';
import { updateAppSettings } from '@/lib/app-settings';
import { recomputeAwards, recomputeBracketsAndGroups } from '@/lib/bracket-recompute';
import type { ScoringConfig } from '@/lib/scoring-config';

export type AdminResult = { ok: boolean; error?: string };

export async function saveSettings(input: {
  predictionsLockAt: string | null;            // ISO string or null
  prizeText: string | null;
  actualGoldenBootPlayerId: string | null;
  actualBestPlayerId: string | null;
  actualSurpriseTeamId: string | null;
  scoring: Partial<ScoringConfig>;
}): Promise<AdminResult> {
  if (!(await getAdminUser())) return { ok: false, error: 'Not authorized.' };

  let lockAt: Date | null = null;
  if (input.predictionsLockAt) {
    lockAt = new Date(input.predictionsLockAt);
    if (Number.isNaN(lockAt.getTime())) return { ok: false, error: 'Invalid lock date.' };
  }

  await updateAppSettings({
    predictionsLockAt: lockAt,
    prizeText: input.prizeText,
    actualGoldenBootPlayerId: input.actualGoldenBootPlayerId,
    actualBestPlayerId: input.actualBestPlayerId,
    actualSurpriseTeamId: input.actualSurpriseTeamId,
    scoring: input.scoring,
  });

  // Changing scoring constants or award actuals affects awarded points.
  await recomputeBracketsAndGroups();
  await recomputeAwards();

  revalidatePath('/leaderboard');
  revalidatePath('/bracket');
  revalidatePath('/admin/settings');
  return { ok: true };
}
