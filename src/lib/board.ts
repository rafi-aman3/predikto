import type { FixtureMatch } from './fixtures';

export type BoardTeam = { id: string; code: string; name: string; flag: string | null; groupName: string | null };
export type GroupBoardEntry = { groupName: string; teams: BoardTeam[]; predicted: number; total: number };

/** Builds the homepage group board: 12 groups, each with its teams + predicted/total match counts. */
export function buildGroupBoard(teams: BoardTeam[], fixtures: FixtureMatch[]): GroupBoardEntry[] {
  const byGroup = new Map<string, GroupBoardEntry>();
  for (const t of teams) {
    if (!t.groupName) continue;
    if (!byGroup.has(t.groupName)) {
      byGroup.set(t.groupName, { groupName: t.groupName, teams: [], predicted: 0, total: 0 });
    }
    byGroup.get(t.groupName)!.teams.push(t);
  }
  for (const m of fixtures) {
    if (m.stage !== 'group' || !m.groupName) continue;
    const g = byGroup.get(m.groupName);
    if (!g) continue;
    g.total += 1;
    if (m.prediction) g.predicted += 1;
  }
  return [...byGroup.values()].sort((a, b) => a.groupName.localeCompare(b.groupName));
}

export type RankStrip = { points: number; predicted: number; matchesLeft: number; total: number };

/** Personal status from the user's fixtures (with predictions merged in). */
export function buildRankStrip(fixtures: FixtureMatch[]): RankStrip {
  let points = 0, predicted = 0;
  for (const m of fixtures) {
    if (m.prediction) {
      predicted += 1;
      points += m.prediction.pointsAwarded ?? 0;
    }
  }
  return { points, predicted, matchesLeft: fixtures.length - predicted, total: fixtures.length };
}

/** First unpredicted match strictly after `afterId`, wrapping to the start. Null if all predicted. */
export function pickNextUnpredicted(fixtures: FixtureMatch[], afterId: string): FixtureMatch | null {
  const idx = fixtures.findIndex((m) => m.id === afterId);
  // Wrap excludes afterId itself so a just-predicted match is never returned as "next".
  const ordered = idx >= 0 ? [...fixtures.slice(idx + 1), ...fixtures.slice(0, idx)] : fixtures;
  // Skip matches the user can no longer predict (locked at kickoff) to avoid dead-end links.
  return ordered.find((m) => !m.prediction && !m.locked) ?? null;
}

export type PredictionRow = { homeScore: number; awayScore: number };
export type Aggregate = { total: number; homeWin: number; draw: number; awayWin: number };

/** Outcome split (%) across everyone's predictions for one match. */
export function aggregatePredictions(rows: PredictionRow[]): Aggregate {
  const total = rows.length;
  if (total === 0) return { total: 0, homeWin: 0, draw: 0, awayWin: 0 };
  let h = 0, d = 0, a = 0;
  for (const r of rows) {
    if (r.homeScore > r.awayScore) h++;
    else if (r.homeScore < r.awayScore) a++;
    else d++;
  }
  const pct = (n: number) => Math.round((n / total) * 100);
  return { total, homeWin: pct(h), draw: pct(d), awayWin: pct(a) };
}
