import type { Stage } from './fixtures';

/** Predicted final group order: group letter -> [1st, 2nd, 3rd, 4th] team ids. */
export type PredictedStandings = Record<string, string[]>;

/**
 * The 16 R32 ties as [homeCode, awayCode]. Top-2 codes ("1A".."2L") resolve from the
 * predicted standings; third placeholders ("3#1".."3#8") are filled by the 8 chosen
 * thirds. This is our canonical knockout wiring; round-to-round propagation folds by
 * index (R16 tie k = winners of R32 ties 2k,2k+1, and so on).
 *
 * ⚠️ Pairings are a tunable data constant — verify against the official FIFA WC2026
 * bracket before launch (like the best-effort kickoff times in data/seed.json).
 */
export const R32_TIES: Array<[string, string]> = [
  ['1A', '3#1'], ['1B', '2E'], ['1C', '3#2'], ['1D', '2F'],
  ['1E', '3#3'], ['1F', '2G'], ['1G', '3#4'], ['1H', '2H'],
  ['1I', '3#5'], ['1J', '2I'], ['1K', '3#6'], ['1L', '2J'],
  ['2A', '3#7'], ['2B', '2K'], ['2C', '3#8'], ['2D', '2L'],
];

/** Number of ties at each knockout round, by index propagation. */
export const ROUND_TIES: Record<Exclude<Stage, 'group' | 'third'>, number> = {
  r32: 16, r16: 8, qf: 4, sf: 2, final: 1,
};

export type R32Tie = { tie: number; home: string | null; away: string | null };

/** Maps the 8 chosen thirds to slots 3#1..3#8, sorted by the team's group letter. */
function thirdsBySlot(standings: PredictedStandings, chosenThirds: string[]): string[] {
  const groupOf = new Map<string, string>();
  for (const [g, order] of Object.entries(standings)) {
    if (order[2] != null) groupOf.set(order[2], g);
  }
  return [...chosenThirds].sort((a, b) =>
    (groupOf.get(a) ?? 'Z').localeCompare(groupOf.get(b) ?? 'Z'));
}

function resolveCode(code: string, standings: PredictedStandings, thirds: string[]): string | null {
  if (code.startsWith('3#')) {
    const slot = Number(code.slice(2)) - 1;        // 3#1 -> index 0
    return thirds[slot] ?? null;
  }
  const pos = Number(code[0]) - 1;                  // "1" -> index 0
  const group = code.slice(1);                      // "A"
  return standings[group]?.[pos] ?? null;
}

/** Resolves the 16 R32 ties to concrete team ids from the predicted standings + thirds. */
export function buildR32Field(standings: PredictedStandings, chosenThirds: string[]): R32Tie[] {
  const thirds = thirdsBySlot(standings, chosenThirds);
  return R32_TIES.map(([h, a], tie) => ({
    tie,
    home: resolveCode(h, standings, thirds),
    away: resolveCode(a, standings, thirds),
  }));
}
