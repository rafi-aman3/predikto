import { db } from '@/db';
import { players, teams, appSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { DEFAULT_SCORING } from '@/lib/scoring-config';
import { SettingsForm } from './settings-form';

export default async function AdminSettingsPage() {
  const [playerRows, teamRows, settingsRows] = await Promise.all([
    db.select().from(players),
    db.select().from(teams),
    db.select().from(appSettings).where(eq(appSettings.id, 1)),
  ]);
  const s = settingsRows[0];

  const current = {
    predictionsLockAt: s?.predictionsLockAt ? s.predictionsLockAt.toISOString().slice(0, 16) : '',
    prizeText: s?.prizeText ?? '',
    actualGoldenBootPlayerId: s?.actualGoldenBootPlayerId ?? '',
    actualBestPlayerId: s?.actualBestPlayerId ?? '',
    actualSurpriseTeamId: s?.actualSurpriseTeamId ?? '',
    scoring: {
      ptsExact: s?.ptsExact ?? DEFAULT_SCORING.ptsExact,
      ptsResult: s?.ptsResult ?? DEFAULT_SCORING.ptsResult,
      ptsReachR16: s?.ptsReachR16 ?? DEFAULT_SCORING.ptsReachR16,
      ptsReachQf: s?.ptsReachQf ?? DEFAULT_SCORING.ptsReachQf,
      ptsReachSf: s?.ptsReachSf ?? DEFAULT_SCORING.ptsReachSf,
      ptsReachFinal: s?.ptsReachFinal ?? DEFAULT_SCORING.ptsReachFinal,
      ptsChampion: s?.ptsChampion ?? DEFAULT_SCORING.ptsChampion,
      ptsRunnerUp: s?.ptsRunnerUp ?? DEFAULT_SCORING.ptsRunnerUp,
      ptsGoldenBoot: s?.ptsGoldenBoot ?? DEFAULT_SCORING.ptsGoldenBoot,
      ptsBestPlayer: s?.ptsBestPlayer ?? DEFAULT_SCORING.ptsBestPlayer,
      ptsSurprise: s?.ptsSurprise ?? DEFAULT_SCORING.ptsSurprise,
      ptsGroupPosition: s?.ptsGroupPosition ?? DEFAULT_SCORING.ptsGroupPosition,
      ptsThirdQualifier: s?.ptsThirdQualifier ?? DEFAULT_SCORING.ptsThirdQualifier,
    },
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-serif text-2xl font-bold text-pitch">Settings</h1>
      <SettingsForm
        current={current}
        players={playerRows.map((p) => ({ id: p.id, name: p.name }))}
        teams={teamRows.filter((t) => t.groupName).map((t) => ({ id: t.id, name: t.name }))}
      />
    </div>
  );
}
