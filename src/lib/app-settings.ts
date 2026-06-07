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
  };
}

/** Reads the editable prize text shown on the leaderboard #1. Null when unset. */
export async function getPrizeText(): Promise<string | null> {
  const [r] = await db.select().from(appSettings).where(eq(appSettings.id, 1));
  return r?.prizeText ?? null;
}
