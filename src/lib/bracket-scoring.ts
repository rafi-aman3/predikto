import type { ScoringConfig } from './scoring-config';
import type { GroupStandings } from './standings';

export type GroupPick = {
  teamId: string; groupName: string; position: number; advancesAsThird: boolean;
};

/** Per-team group points: exact-position + (chosen-third that actually advanced). */
export function scoreGroupPredictions(
  predicted: GroupPick[],
  actualStandings: GroupStandings[],
  actualAdvancingThirds: Set<string>,
  cfg: ScoringConfig,
): Array<{ teamId: string; pointsAwarded: number }> {
  const actualPos = new Map<string, number>();   // teamId -> 1..4
  for (const g of actualStandings) {
    g.rows.forEach((r, i) => actualPos.set(r.teamId, i + 1));
  }
  return predicted.map((p) => {
    let pts = 0;
    if (actualPos.get(p.teamId) === p.position) pts += cfg.ptsGroupPosition;
    if (p.advancesAsThird && actualAdvancingThirds.has(p.teamId)) pts += cfg.ptsThirdQualifier;
    return { teamId: p.teamId, pointsAwarded: pts };
  });
}

/**
 * The best `count` (default 8) third-placed teams across all groups, ranked by the same
 * tie-break as the group tables (points -> gd -> gf -> name). Used to derive who actually
 * advanced as a third for scoring.
 */
export function pickActualAdvancingThirds(
  actualStandings: GroupStandings[], count = 8,
): Set<string> {
  const thirds = actualStandings
    .map((g) => g.rows[2])
    .filter((r): r is NonNullable<typeof r> => r != null);
  thirds.sort((x, y) =>
    y.points - x.points || y.gd - x.gd || y.gf - x.gf || x.name.localeCompare(y.name));
  return new Set(thirds.slice(0, count).map((r) => r.teamId));
}
