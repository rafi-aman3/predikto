'use client';
import type { BracketTeam, BracketPlayer } from '@/lib/get-bracket';

type AwardsValue = { goldenBootPlayerId: string | null; bestPlayerId: string | null; surpriseTeamId: string | null };

export function AwardsPanel({
  players, teams, finalists, champion, value, locked, onChange,
}: {
  players: BracketPlayer[];
  teams: BracketTeam[];
  finalists: string[];
  champion: string | null;
  value: AwardsValue;
  locked: boolean;
  onChange: (next: AwardsValue) => void;
}) {
  const teamName = (id: string | null) => teams.find((t) => t.id === id)?.name ?? 'TBD';
  const runnerUp = finalists.find((id) => id !== champion) ?? null;
  const gbPlayers = players.filter((p) => p.goldenBootEligible);
  const bpPlayers = players.filter((p) => p.bestPlayerEligible);

  const set = (patch: Partial<AwardsValue>) => onChange({ ...value, ...patch });

  return (
    <div className="rp-card p-3 flex flex-col gap-3">
      <div className="font-display text-pitch">Awards</div>
      <div className="grid gap-1 sm:grid-cols-2">
        <div className="text-pitch">🏆 Champion: <b>{teamName(champion)}</b></div>
        <div className="text-pitch">🥈 Runner-up: <b>{teamName(runnerUp)}</b></div>
      </div>

      <label className="flex flex-col gap-1 text-pitch">
        Golden Boot
        <select disabled={locked} value={value.goldenBootPlayerId ?? ''}
          onChange={(e) => set({ goldenBootPlayerId: e.target.value || null })}
          className="rp-pill px-2 py-1">
          <option value="">— pick a player —</option>
          {gbPlayers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-pitch">
        Best Player
        <select disabled={locked} value={value.bestPlayerId ?? ''}
          onChange={(e) => set({ bestPlayerId: e.target.value || null })}
          className="rp-pill px-2 py-1">
          <option value="">— pick a player —</option>
          {bpPlayers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-pitch">
        Surprise team
        <select disabled={locked} value={value.surpriseTeamId ?? ''}
          onChange={(e) => set({ surpriseTeamId: e.target.value || null })}
          className="rp-pill px-2 py-1">
          <option value="">— pick a team —</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
    </div>
  );
}
