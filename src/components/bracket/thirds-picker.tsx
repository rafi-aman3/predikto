'use client';
import type { PredictedStandings } from '@/lib/bracket';
import type { BracketTeam } from '@/lib/get-bracket';

export function ThirdsPicker({
  standings, teamById, chosen, locked, onChange,
}: {
  standings: PredictedStandings;
  teamById: Map<string, BracketTeam>;
  chosen: string[];
  locked: boolean;
  onChange: (next: string[]) => void;
}) {
  const thirdTeams = Object.values(standings).map((o) => o[2]).filter(Boolean) as string[];
  const chosenSet = new Set(chosen);

  function toggle(id: string) {
    if (locked) return;
    if (chosenSet.has(id)) onChange(chosen.filter((x) => x !== id));
    else if (chosen.length < 8) onChange([...chosen, id]);
  }

  return (
    <div className="rp-card p-3">
      <div className="font-display text-pitch mb-2">Best 8 third-placed teams ({chosen.length}/8)</div>
      <div className="flex flex-wrap gap-2">
        {thirdTeams.map((id) => {
          const t = teamById.get(id);
          const on = chosenSet.has(id);
          return (
            <button key={id} onClick={() => toggle(id)} disabled={locked || (!on && chosen.length >= 8)}
              className={`rp-pill px-3 py-1 ${on ? 'bg-gold' : ''} disabled:opacity-40`}>
              {t?.flag} {t?.code ?? id}
            </button>
          );
        })}
      </div>
    </div>
  );
}
