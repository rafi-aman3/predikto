'use client';
import { useState, useTransition } from 'react';
import { saveSettings } from './actions';
import type { ScoringConfig } from '@/lib/scoring-config';

type Current = {
  predictionsLockAt: string; prizeText: string;
  actualGoldenBootPlayerId: string; actualBestPlayerId: string; actualSurpriseTeamId: string;
  scoring: ScoringConfig;
};

const SCORING_FIELDS: Array<[keyof ScoringConfig, string]> = [
  ['ptsExact', 'Exact score'], ['ptsResult', 'Correct result'],
  ['ptsReachR16', 'Reach R16'], ['ptsReachQf', 'Reach QF'], ['ptsReachSf', 'Reach SF'], ['ptsReachFinal', 'Reach Final'],
  ['ptsChampion', 'Champion'], ['ptsRunnerUp', 'Runner-up'],
  ['ptsGoldenBoot', 'Golden Boot'], ['ptsBestPlayer', 'Best Player'], ['ptsSurprise', 'Surprise team'],
  ['ptsGroupPosition', 'Group position (each)'], ['ptsThirdQualifier', 'Advancing 3rd (each)'],
];

export function SettingsForm({ current, players, teams }: {
  current: Current;
  players: { id: string; name: string }[];
  teams: { id: string; name: string }[];
}) {
  const [form, setForm] = useState(current);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const setScore = (k: keyof ScoringConfig, v: string) =>
    setForm((f) => ({ ...f, scoring: { ...f.scoring, [k]: Number(v) } }));

  function onSubmit() {
    setMsg(null);
    start(async () => {
      const res = await saveSettings({
        predictionsLockAt: form.predictionsLockAt || null,
        prizeText: form.prizeText || null,
        actualGoldenBootPlayerId: form.actualGoldenBootPlayerId || null,
        actualBestPlayerId: form.actualBestPlayerId || null,
        actualSurpriseTeamId: form.actualSurpriseTeamId || null,
        scoring: form.scoring,
      });
      setMsg(res.ok ? 'Saved ✅ (points recomputed)' : (res.error ?? 'Save failed.'));
    });
  }

  return (
    <div className="flex flex-col gap-4 max-w-xl">
      <label className="flex flex-col gap-1">Predictions lock at
        <input type="datetime-local" value={form.predictionsLockAt}
          onChange={(e) => setForm((f) => ({ ...f, predictionsLockAt: e.target.value }))}
          className="rp-pill px-2 py-1" />
      </label>
      <label className="flex flex-col gap-1">Prize text
        <input value={form.prizeText}
          onChange={(e) => setForm((f) => ({ ...f, prizeText: e.target.value }))}
          className="rp-pill px-2 py-1" />
      </label>

      <fieldset className="flex flex-col gap-2 border-[3px] border-pitch rounded-lg p-3">
        <legend className="font-bold px-1">Actual award winners</legend>
        <label className="flex flex-col gap-1">Golden Boot
          <select value={form.actualGoldenBootPlayerId}
            onChange={(e) => setForm((f) => ({ ...f, actualGoldenBootPlayerId: e.target.value }))}
            className="rp-pill px-2 py-1">
            <option value="">—</option>
            {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">Best Player
          <select value={form.actualBestPlayerId}
            onChange={(e) => setForm((f) => ({ ...f, actualBestPlayerId: e.target.value }))}
            className="rp-pill px-2 py-1">
            <option value="">—</option>
            {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">Surprise team
          <select value={form.actualSurpriseTeamId}
            onChange={(e) => setForm((f) => ({ ...f, actualSurpriseTeamId: e.target.value }))}
            className="rp-pill px-2 py-1">
            <option value="">—</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-2 border-[3px] border-pitch rounded-lg p-3">
        <legend className="font-bold px-1">Scoring constants</legend>
        {SCORING_FIELDS.map(([k, label]) => (
          <label key={k} className="flex flex-col gap-1 text-sm">{label}
            <input type="number" value={form.scoring[k]}
              onChange={(e) => setScore(k, e.target.value)} className="rp-pill px-2 py-1" />
          </label>
        ))}
      </fieldset>

      <div className="flex items-center gap-3">
        <button onClick={onSubmit} disabled={pending} className="rp-cta px-6 py-3">
          {pending ? 'Saving…' : 'Save settings'}
        </button>
        {msg && <span>{msg}</span>}
      </div>
    </div>
  );
}
