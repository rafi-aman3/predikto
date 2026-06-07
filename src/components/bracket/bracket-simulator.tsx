'use client';
import { useMemo, useState, useTransition } from 'react';
import type { BracketData } from '@/lib/get-bracket';
import { GroupOrderer } from './group-orderer';
import { ThirdsPicker } from './thirds-picker';
import { KnockoutTree } from './knockout-tree';
import { AwardsPanel } from './awards-panel';
import { saveBracket } from '@/app/bracket/actions';
import type { PredictedStandings } from '@/lib/bracket';

const GROUP_NAMES = 'ABCDEFGHIJKL'.split('');

export function BracketSimulator({ data, signedIn }: { data: BracketData; signedIn: boolean }) {
  const [standings, setStandings] = useState<PredictedStandings>(() => buildInitialStandings(data));
  const [thirds, setThirds] = useState<string[]>(() =>
    data.groupPicks.filter((g) => g.advancesAsThird).map((g) => g.teamId));
  const [reached, setReached] = useState(() => ({ ...data.reached }));
  const [champion, setChampion] = useState<string | null>(data.awards?.championTeamId ?? null);
  const [awards, setAwards] = useState({
    goldenBootPlayerId: data.awards?.goldenBootPlayerId ?? null,
    bestPlayerId: data.awards?.bestPlayerId ?? null,
    surpriseTeamId: data.awards?.surpriseTeamId ?? null,
  });
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const groupsDone = GROUP_NAMES.every((g) => (standings[g]?.length ?? 0) === 4);
  const thirdsDone = thirds.length === 8;
  const teamById = useMemo(() => new Map(data.teams.map((t) => [t.id, t])), [data.teams]);

  function onGroupReorder(next: PredictedStandings) {
    setStandings(next);
    setThirds((prev) => prev.filter((id) => Object.values(next).some((o) => o[2] === id)));
    setReached({ r16: [], qf: [], sf: [], final: [] });
    setChampion(null);
  }

  function onSave() {
    setMsg(null);
    start(async () => {
      const res = await saveBracket({
        standings, chosenThirds: thirds, reached, awards, championTeamId: champion,
      });
      setMsg(res.ok ? 'Saved! ✅' : (res.error ?? 'Save failed.'));
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <nav className="sticky top-0 z-10 flex gap-2 flex-wrap rp-card p-2 text-sm">
        <a href="#groups" className="rp-pill px-2 py-1">Groups {GROUP_NAMES.filter((g) => standings[g]?.length === 4).length}/12</a>
        <a href="#thirds" className="rp-pill px-2 py-1">Thirds {thirds.length}/8</a>
        <a href="#bracket" className="rp-pill px-2 py-1">Bracket</a>
        <a href="#awards" className="rp-pill px-2 py-1">Awards</a>
      </nav>

      <section id="groups">
        <GroupOrderer
          groupNames={GROUP_NAMES} standings={standings} teamById={teamById}
          locked={data.locked} onChange={onGroupReorder}
        />
      </section>

      <section id="thirds" className={!groupsDone ? 'opacity-40 pointer-events-none' : ''}>
        <ThirdsPicker
          standings={standings} teamById={teamById} chosen={thirds}
          locked={data.locked} onChange={setThirds}
        />
        {!groupsDone && <p className="text-cream text-sm mt-2">Finish ordering all 12 groups first.</p>}
      </section>

      <section id="bracket" className={!(groupsDone && thirdsDone) ? 'opacity-40 pointer-events-none' : ''}>
        <KnockoutTree
          standings={standings} thirds={thirds} reached={reached} champion={champion}
          teamById={teamById} locked={data.locked}
          onReachedChange={setReached} onChampionChange={setChampion}
        />
        {!(groupsDone && thirdsDone) && <p className="text-cream text-sm mt-2">Set groups and pick 8 thirds to unlock the bracket.</p>}
      </section>

      <section id="awards">
        <AwardsPanel
          players={data.players} teams={data.teams}
          finalists={reached.final} champion={champion}
          value={awards} locked={data.locked} onChange={setAwards}
        />
      </section>

      {!data.locked && signedIn && (
        <div className="flex items-center gap-3">
          <button onClick={onSave} disabled={pending} className="rp-cta px-6 py-3">
            {pending ? 'Saving…' : 'Save bracket'}
          </button>
          {msg && <span className="text-cream">{msg}</span>}
        </div>
      )}
      {data.locked && <p className="rp-card p-3 text-pitch">🔒 Predictions are locked — this is your final bracket.</p>}
    </div>
  );
}

function buildInitialStandings(data: BracketData): PredictedStandings {
  const byGroup: Record<string, string[]> = {};
  for (const t of data.teams) {
    if (!t.groupName) continue;
    (byGroup[t.groupName] ??= []).push(t.id);
  }
  if (data.groupPicks.length) {
    const saved: Record<string, { teamId: string; position: number }[]> = {};
    for (const p of data.groupPicks) {
      (saved[p.groupName] ??= []).push({ teamId: p.teamId, position: p.position });
    }
    for (const g of Object.keys(saved)) {
      byGroup[g] = saved[g].sort((a, b) => a.position - b.position).map((x) => x.teamId);
    }
  }
  return byGroup;
}
