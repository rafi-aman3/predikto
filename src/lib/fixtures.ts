export type Stage = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final';

export type TeamLite = { id: string; code: string; name: string; flag: string | null };
export type FixtureMatch = {
  id: string;
  externalId: string | null;
  stage: Stage;
  groupName: string | null;
  kickoffAt: Date;
  status: 'scheduled' | 'live' | 'finished';
  home: TeamLite | null;
  away: TeamLite | null;
  venue: { name: string; city: string | null } | null;
  homeScore: number | null;
  awayScore: number | null;
  prediction: { homeScore: number; awayScore: number; pointsAwarded: number | null } | null;
  locked: boolean;
};

const STAGE_ORDER: Stage[] = ['group', 'r32', 'r16', 'qf', 'sf', 'third', 'final'];

export type StageGroup = { stage: Stage; matches: FixtureMatch[] };

export function groupByStage(list: FixtureMatch[]): StageGroup[] {
  return STAGE_ORDER
    .map((stage) => ({ stage, matches: list.filter((m) => m.stage === stage) }))
    .filter((g) => g.matches.length > 0);
}

export type NamedGroup = { groupName: string; matches: FixtureMatch[] };

export function groupByGroup(list: FixtureMatch[]): NamedGroup[] {
  const groups = list.filter((m) => m.stage === 'group' && m.groupName);
  const byName = new Map<string, FixtureMatch[]>();
  for (const m of groups) {
    const g = m.groupName!;
    (byName.get(g) ?? byName.set(g, []).get(g)!).push(m);
  }
  return [...byName.entries()]
    .map(([groupName, ms]) => ({ groupName, matches: ms }))
    .sort((a, b) => a.groupName.localeCompare(b.groupName));
}

export type RowState =
  | { kind: 'predict' }
  | { kind: 'picked'; pick: string }
  | { kind: 'locked' }
  | { kind: 'live'; score: string; pick: string | null }
  | { kind: 'finished'; score: string; pick: string | null; points: number | null };

/** Maps a fixture to how its compact row should present the user's prediction state. */
export function predictionRowState(m: FixtureMatch): RowState {
  const pick = m.prediction ? `${m.prediction.homeScore}–${m.prediction.awayScore}` : null;
  if (m.status === 'finished') {
    return {
      kind: 'finished',
      score: `${m.homeScore ?? 0}–${m.awayScore ?? 0}`,
      pick,
      points: m.prediction?.pointsAwarded ?? null,
    };
  }
  if (m.status === 'live') {
    return { kind: 'live', score: `${m.homeScore ?? 0}–${m.awayScore ?? 0}`, pick };
  }
  if (pick) return { kind: 'picked', pick };
  if (m.locked) return { kind: 'locked' };
  return { kind: 'predict' };
}
