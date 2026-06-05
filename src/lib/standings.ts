import type { FixtureMatch } from './fixtures';

export type BoardTeam = { id: string; code: string; name: string; flag: string | null; groupName: string | null };

export type StandingRow = {
  teamId: string; code: string; name: string; flag: string | null;
  played: number; won: number; drawn: number; lost: number;
  gf: number; ga: number; gd: number; points: number;
};

export type GroupStandings = { groupName: string; rows: StandingRow[] };

/** Group tables computed from FINISHED group matches only. Sort: points, gd, gf, then name. */
export function computeGroupStandings(teams: BoardTeam[], fixtures: FixtureMatch[]): GroupStandings[] {
  const groups = new Map<string, Map<string, StandingRow>>();
  for (const t of teams) {
    if (!t.groupName) continue;
    if (!groups.has(t.groupName)) groups.set(t.groupName, new Map());
    groups.get(t.groupName)!.set(t.id, {
      teamId: t.id, code: t.code, name: t.name, flag: t.flag,
      played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0,
    });
  }

  for (const m of fixtures) {
    if (m.stage !== 'group' || m.status !== 'finished' || !m.groupName) continue;
    if (!m.home || !m.away || m.homeScore == null || m.awayScore == null) continue;
    const table = groups.get(m.groupName);
    if (!table) continue;
    const h = table.get(m.home.id);
    const a = table.get(m.away.id);
    if (!h || !a) continue;

    h.played++; a.played++;
    h.gf += m.homeScore; h.ga += m.awayScore;
    a.gf += m.awayScore; a.ga += m.homeScore;
    if (m.homeScore > m.awayScore) { h.won++; h.points += 3; a.lost++; }
    else if (m.homeScore < m.awayScore) { a.won++; a.points += 3; h.lost++; }
    else { h.drawn++; a.drawn++; h.points++; a.points++; }
  }

  const result: GroupStandings[] = [];
  for (const [groupName, table] of groups) {
    const rows = [...table.values()];
    for (const r of rows) r.gd = r.gf - r.ga;
    rows.sort((x, y) =>
      y.points - x.points || y.gd - x.gd || y.gf - x.gf || x.name.localeCompare(y.name));
    result.push({ groupName, rows });
  }
  return result.sort((a, b) => a.groupName.localeCompare(b.groupName));
}
