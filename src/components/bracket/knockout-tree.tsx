'use client';
import { useMemo } from 'react';
import { reconstructBracket, type PredictedStandings, type BracketTie } from '@/lib/bracket';
import type { BracketTeam } from '@/lib/get-bracket';

type Reached = { r16: string[]; qf: string[]; sf: string[]; final: string[] };
const ROUNDS: Array<{ key: keyof Reached; from: 'r32' | 'r16' | 'qf' | 'sf'; label: string }> = [
  { key: 'r16', from: 'r32', label: 'Round of 16' },
  { key: 'qf', from: 'r16', label: 'Quarter-finals' },
  { key: 'sf', from: 'qf', label: 'Semi-finals' },
  { key: 'final', from: 'sf', label: 'Final' },
];

export function KnockoutTree({
  standings, thirds, reached, champion, teamById, locked, onReachedChange, onChampionChange,
}: {
  standings: PredictedStandings;
  thirds: string[];
  reached: Reached;
  champion: string | null;
  teamById: Map<string, BracketTeam>;
  locked: boolean;
  onReachedChange: (next: Reached) => void;
  onChampionChange: (id: string | null) => void;
}) {
  const tree = useMemo(
    () => reconstructBracket(standings, thirds, {
      r16: new Set(reached.r16), qf: new Set(reached.qf), sf: new Set(reached.sf), final: new Set(reached.final),
    }),
    [standings, thirds, reached],
  );

  const label = (id: string | null) => {
    if (!id) return 'TBD';
    const t = teamById.get(id);
    return `${t?.flag ?? ''} ${t?.code ?? id}`.trim();
  };

  // Advance a team into round `key` from its tie. Set-based (order-independent): add the
  // picked team, remove its sibling (the tie's other participant), clear deeper rounds.
  function advance(key: keyof Reached, tie: BracketTie, teamId: string) {
    if (locked) return;
    const sibling = tie.home === teamId ? tie.away : tie.home;
    const set = new Set(reached[key]);
    if (sibling) set.delete(sibling);
    set.add(teamId);
    const next: Reached = { ...reached, [key]: [...set] };
    const order: (keyof Reached)[] = ['r16', 'qf', 'sf', 'final'];
    for (let d = order.indexOf(key) + 1; d < order.length; d++) next[order[d]] = [];
    onReachedChange(next);
    onChampionChange(null);
  }

  return (
    <div className="rp-card p-3 overflow-x-auto">
      {ROUNDS.map(({ key, from, label: roundLabel }) => {
        const ties = tree[from];
        return (
          <div key={key} className="mb-4">
            <div className="font-display text-pitch mb-2">{roundLabel}</div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {ties.map((tie, i) => (
                <div key={i} className="border-[3px] border-pitch rounded-lg rp-shadow-sm p-2 flex flex-col gap-1">
                  {[tie.home, tie.away].map((id, side) => {
                    const picked = id != null && reached[key].includes(id);
                    return (
                      <button key={side} disabled={locked || id == null}
                        onClick={() => id && advance(key, tie, id)}
                        className={`text-left px-2 py-1 rounded ${picked ? 'bg-gold font-bold' : ''} disabled:opacity-50`}>
                        {label(id)}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="mt-4">
        <div className="font-display text-pitch mb-2">Champion 👑</div>
        <div className="flex gap-2">
          {reached.final.map((id) => (
            <button key={id} disabled={locked} onClick={() => onChampionChange(id)}
              className={`rp-pill px-4 py-2 ${champion === id ? 'bg-gold font-bold' : ''}`}>
              {label(id)}
            </button>
          ))}
          {reached.final.length < 2 && <span className="text-pitch/60">Pick your two finalists first.</span>}
        </div>
      </div>
    </div>
  );
}
