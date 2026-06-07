import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { appSettings } from '@/db/schema';
import { DEFAULT_SCORING, type ScoringConfig } from './scoring-config';

/** Reads the singleton app_settings row (id=1); falls back to DEFAULT_SCORING. */
export async function getScoringConfig(): Promise<ScoringConfig> {
  const [r] = await db.select().from(appSettings).where(eq(appSettings.id, 1));
  if (!r) return DEFAULT_SCORING;
  return {
    ptsExact: r.ptsExact, ptsResult: r.ptsResult,
    ptsReachR16: r.ptsReachR16, ptsReachQf: r.ptsReachQf,
    ptsReachSf: r.ptsReachSf, ptsReachFinal: r.ptsReachFinal,
    ptsChampion: r.ptsChampion, ptsRunnerUp: r.ptsRunnerUp,
    ptsGoldenBoot: r.ptsGoldenBoot, ptsBestPlayer: r.ptsBestPlayer,
    ptsSurprise: r.ptsSurprise,
    ptsGroupPosition: r.ptsGroupPosition, ptsThirdQualifier: r.ptsThirdQualifier,
  };
}

/** Reads the editable prize text shown on the leaderboard #1. Null when unset. */
export async function getPrizeText(): Promise<string | null> {
  const [r] = await db.select().from(appSettings).where(eq(appSettings.id, 1));
  return r?.prizeText ?? null;
}

/** Global deadline for group/bracket/award predictions. Null => open. */
export async function getPredictionsLockAt(): Promise<Date | null> {
  const [r] = await db.select().from(appSettings).where(eq(appSettings.id, 1));
  return r?.predictionsLockAt ?? null;
}

export type ActualAwards = {
  goldenBootPlayerId: string | null;
  bestPlayerId: string | null;
  surpriseTeamId: string | null;
};

/** Admin-entered actual award winners (Golden Boot / Best Player / Surprise team). */
export async function getActualAwards(): Promise<ActualAwards> {
  const [r] = await db.select().from(appSettings).where(eq(appSettings.id, 1));
  return {
    goldenBootPlayerId: r?.actualGoldenBootPlayerId ?? null,
    bestPlayerId: r?.actualBestPlayerId ?? null,
    surpriseTeamId: r?.actualSurpriseTeamId ?? null,
  };
}

/** Upserts the singleton settings row. Only provided fields are written. */
export async function updateAppSettings(patch: Partial<{
  predictionsLockAt: Date | null;
  prizeText: string | null;
  actualGoldenBootPlayerId: string | null;
  actualBestPlayerId: string | null;
  actualSurpriseTeamId: string | null;
  scoring: Partial<ScoringConfig>;
}>): Promise<void> {
  const { scoring, ...rest } = patch;
  const values: Record<string, unknown> = { ...rest };
  if (scoring) {
    const map: Record<keyof ScoringConfig, string> = {
      ptsExact: 'ptsExact', ptsResult: 'ptsResult',
      ptsReachR16: 'ptsReachR16', ptsReachQf: 'ptsReachQf',
      ptsReachSf: 'ptsReachSf', ptsReachFinal: 'ptsReachFinal',
      ptsChampion: 'ptsChampion', ptsRunnerUp: 'ptsRunnerUp',
      ptsGoldenBoot: 'ptsGoldenBoot', ptsBestPlayer: 'ptsBestPlayer',
      ptsSurprise: 'ptsSurprise',
      ptsGroupPosition: 'ptsGroupPosition', ptsThirdQualifier: 'ptsThirdQualifier',
    };
    for (const k of Object.keys(scoring) as (keyof ScoringConfig)[]) {
      if (scoring[k] != null) values[map[k]] = scoring[k];
    }
  }
  // An empty `set` would emit invalid SQL (`... do update set `), so no-op when there's
  // nothing to write.
  if (Object.keys(values).length === 0) return;
  await db.insert(appSettings).values({ id: 1, ...values })
    .onConflictDoUpdate({ target: appSettings.id, set: values });
}
