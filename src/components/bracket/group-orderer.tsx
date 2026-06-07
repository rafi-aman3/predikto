'use client';
import type { PredictedStandings } from '@/lib/bracket';
import type { BracketTeam } from '@/lib/get-bracket';

export function GroupOrderer({
  groupNames, standings, teamById, locked, onChange,
}: {
  groupNames: string[];
  standings: PredictedStandings;
  teamById: Map<string, BracketTeam>;
  locked: boolean;
  onChange: (next: PredictedStandings) => void;
}) {
  function move(group: string, idx: number, dir: -1 | 1) {
    const order = [...(standings[group] ?? [])];
    const j = idx + dir;
    if (j < 0 || j >= order.length) return;
    [order[idx], order[j]] = [order[j], order[idx]];
    onChange({ ...standings, [group]: order });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {groupNames.map((g) => (
        <div key={g} className="rp-card p-3">
          <div className="font-display text-pitch mb-2">Group {g}</div>
          <ol className="flex flex-col gap-1">
            {(standings[g] ?? []).map((id, i) => {
              const t = teamById.get(id);
              return (
                <li key={id} className="flex items-center gap-2 text-pitch">
                  <span className="font-pixel w-5 text-center">{i + 1}</span>
                  <span className="flex-1 truncate">{t?.flag} {t?.code ?? id}</span>
                  {!locked && (
                    <span className="flex gap-1">
                      <button aria-label="up" onClick={() => move(g, i, -1)} disabled={i === 0}
                        className="rp-pill px-2 disabled:opacity-30">▲</button>
                      <button aria-label="down" onClick={() => move(g, i, 1)} disabled={i === 3}
                        className="rp-pill px-2 disabled:opacity-30">▼</button>
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}
