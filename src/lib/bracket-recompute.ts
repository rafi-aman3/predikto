import { eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  teams, groupPredictions, bracketPredictions, awardPredictions,
} from '@/db/schema';
import { getScoringConfig, getActualAwards } from './app-settings';
import { computeGroupStandings, type BoardTeam } from './standings';
import { getFixtures } from './get-fixtures';
import {
  scoreGroupPredictions, pickActualAdvancingThirds, scoreBracket, scoreAwards,
  type GroupPick,
} from './bracket-scoring';

type ReachStage = 'r16' | 'qf' | 'sf' | 'final';

/** Recomputes group + bracket pointsAwarded for ALL users from current real results. */
export async function recomputeBracketsAndGroups(): Promise<void> {
  const cfg = await getScoringConfig();
  const fixtures = await getFixtures();
  const teamRows = await db.select().from(teams);

  const boardTeams: BoardTeam[] = teamRows
    .filter((t) => t.groupName)
    .map((t) => ({ id: t.id, code: t.code, name: t.name, flag: t.flag, groupName: t.groupName }));
  const actualStandings = computeGroupStandings(boardTeams, fixtures);
  const actualThirds = pickActualAdvancingThirds(actualStandings, 8);

  // Actual reached sets = distinct participants of knockout matches that have both teams
  // assigned (admin fills TBD slots as the tournament progresses; being IN a stage-S match
  // means the team reached stage S).
  const reached: Record<ReachStage, Set<string>> = {
    r16: new Set(), qf: new Set(), sf: new Set(), final: new Set(),
  };
  for (const f of fixtures) {
    const stage = f.stage as string;
    if (stage in reached && f.home && f.away) {
      reached[stage as ReachStage].add(f.home.id);
      reached[stage as ReachStage].add(f.away.id);
    }
  }

  // Group points (per row). scoreGroupPredictions preserves input order, so gScores[i]
  // corresponds to gRows[i].
  const gRows = await db.select().from(groupPredictions);
  const picks: GroupPick[] = gRows.map((g) => ({
    teamId: g.teamId, groupName: g.groupName, position: g.position, advancesAsThird: g.advancesAsThird,
  }));
  const gScores = scoreGroupPredictions(picks, actualStandings, actualThirds, cfg);
  for (let i = 0; i < gRows.length; i++) {
    await db.update(groupPredictions)
      .set({ pointsAwarded: gScores[i].pointsAwarded })
      .where(eq(groupPredictions.id, gRows[i].id));
  }

  // Bracket points (per row), scoring only the r16/qf/sf/final rows.
  const bRows = await db.select().from(bracketPredictions);
  const scorable = bRows.filter((b) => (['r16', 'qf', 'sf', 'final'] as string[]).includes(b.stage));
  const bScores = scoreBracket(
    scorable.map((b) => ({ stage: b.stage as ReachStage, teamId: b.teamId })),
    reached, cfg,
  );
  for (let i = 0; i < scorable.length; i++) {
    await db.update(bracketPredictions)
      .set({ pointsAwarded: bScores[i].pointsAwarded })
      .where(eq(bracketPredictions.id, scorable[i].id));
  }
}

/** Recomputes award pointsAwarded for ALL users. Champion/runner-up from the real final. */
export async function recomputeAwards(): Promise<void> {
  const cfg = await getScoringConfig();
  const fixtures = await getFixtures();
  const admin = await getActualAwards();

  // Derive actual champion/runner-up from the finished final.
  const final = fixtures.find((f) => f.stage === 'final');
  let championTeamId: string | null = null;
  let runnerUpTeamId: string | null = null;
  if (final && final.status === 'finished' && final.home && final.away
      && final.homeScore != null && final.awayScore != null && final.homeScore !== final.awayScore) {
    const homeWon = final.homeScore > final.awayScore;
    championTeamId = homeWon ? final.home.id : final.away.id;
    runnerUpTeamId = homeWon ? final.away.id : final.home.id;
  }

  const actual = {
    championTeamId, runnerUpTeamId,
    goldenBootPlayerId: admin.goldenBootPlayerId,
    bestPlayerId: admin.bestPlayerId,
    surpriseTeamId: admin.surpriseTeamId,
  };

  const aRows = await db.select().from(awardPredictions);
  for (const a of aRows) {
    const pts = scoreAwards({
      championTeamId: a.championTeamId, runnerUpTeamId: a.runnerUpTeamId,
      goldenBootPlayerId: a.goldenBootPlayerId, bestPlayerId: a.bestPlayerId, surpriseTeamId: a.surpriseTeamId,
    }, actual, cfg);
    await db.update(awardPredictions)
      .set({ pointsAwarded: pts })
      .where(eq(awardPredictions.userId, a.userId));
  }
}
