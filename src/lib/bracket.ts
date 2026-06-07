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

export type ReachedSets = {
  r16: Set<string>; qf: Set<string>; sf: Set<string>; final: Set<string>;
};

export type BracketTie = { tie: number; home: string | null; away: string | null; winner: string | null };
export type BracketTree = {
  r32: BracketTie[]; r16: BracketTie[]; qf: BracketTie[]; sf: BracketTie[]; final: BracketTie[];
};

/** The team in [home, away] that belongs to `advanced`, or null if neither/both. */
function winnerOf(home: string | null, away: string | null, advanced: Set<string>): string | null {
  const h = home != null && advanced.has(home);
  const a = away != null && advanced.has(away);
  if (h && !a) return home;
  if (a && !h) return away;
  return null;
}

/** Folds winners of the previous round into the next round's ties (pairs by index). */
function foldRound(prev: BracketTie[], advanced: Set<string>): BracketTie[] {
  const ties: BracketTie[] = [];
  for (let k = 0; k < prev.length / 2; k++) {
    const home = prev[2 * k].winner;
    const away = prev[2 * k + 1].winner;
    ties.push({ tie: k, home, away, winner: winnerOf(home, away, advanced) });
  }
  return ties;
}

/**
 * Reconstructs the full knockout tree from the predicted standings + chosen thirds +
 * per-round reached sets. Each round's winner is the participant present in the NEXT
 * round's reached set; the final's winner is left null (champion is an award pick).
 */
export function reconstructBracket(
  standings: PredictedStandings, chosenThirds: string[], reached: ReachedSets,
): BracketTree {
  const r32: BracketTie[] = buildR32Field(standings, chosenThirds).map((t) => ({
    ...t, winner: winnerOf(t.home, t.away, reached.r16),
  }));
  const r16 = foldRound(r32, reached.qf);
  const qf = foldRound(r16, reached.sf);
  const sf = foldRound(qf, reached.final);
  const final = foldRound(sf, new Set<string>());  // champion overlaid by the UI
  return { r32, r16, qf, sf, final };
}

export type ValidateInput = {
  groupTeams: Record<string, string[]>;   // the actual teams in each group (any order)
  standings: PredictedStandings;          // predicted order
  chosenThirds: string[];
  reached: { r16: string[]; qf: string[]; sf: string[]; final: string[] };
};

/** Server-side structural validation for a submitted bracket. */
export function validateBracket(input: ValidateInput): { ok: boolean; error?: string } {
  const { groupTeams, standings, chosenThirds, reached } = input;

  for (const [g, members] of Object.entries(groupTeams)) {
    const order = standings[g];
    if (!order || order.length !== members.length) return { ok: false, error: `Group ${g} order incomplete.` };
    if (new Set(order).size !== order.length) return { ok: false, error: `Group ${g} has a duplicate team.` };
    const memberSet = new Set(members);
    if (!order.every((id) => memberSet.has(id))) return { ok: false, error: `Group ${g} has an unknown team.` };
  }

  if (chosenThirds.length !== 8) return { ok: false, error: 'Pick exactly 8 third-placed teams.' };
  const thirdEligible = new Set(Object.values(standings).map((o) => o[2]));
  if (!chosenThirds.every((id) => thirdEligible.has(id))) {
    return { ok: false, error: 'A chosen third is not a 3rd-placed team.' };
  }

  // Structural check (order-independent): reconstruct the tree from the reached SETS and
  // require every tie up to the final to resolve to exactly one winner, with the right
  // count of teams per round. Reusing reconstructBracket keeps this identical to render.
  const reachedSets: ReachedSets = {
    r16: new Set(reached.r16), qf: new Set(reached.qf), sf: new Set(reached.sf), final: new Set(reached.final),
  };
  const tree = reconstructBracket(standings, chosenThirds, reachedSets);
  const rounds: Array<[keyof ReachedSets, BracketTie[], number]> = [
    ['r16', tree.r32, 16],
    ['qf', tree.r16, 8],
    ['sf', tree.qf, 4],
    ['final', tree.sf, 2],
  ];
  for (const [key, prevTies, expected] of rounds) {
    if (reachedSets[key].size !== expected) {
      return { ok: false, error: `${key.toUpperCase()} must have exactly ${expected} teams.` };
    }
    if (!prevTies.every((t) => t.winner != null)) {
      return { ok: false, error: `${key.toUpperCase()} picks must be one team per tie.` };
    }
  }

  return { ok: true };
}
