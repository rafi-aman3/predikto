'use client';
import { useState, useTransition } from 'react';
import { savePrediction } from '@/app/fixtures/actions';
import type { FixtureMatch } from '@/lib/fixtures';

const QUICK: Array<[number, number]> = [[1, 0], [2, 1], [1, 1], [0, 0]];

export function PredictionCard({ match, signedIn }: { match: FixtureMatch; signedIn: boolean }) {
  const initial = match.prediction;
  const [home, setHome] = useState(initial?.homeScore ?? 0);
  const [away, setAway] = useState(initial?.awayScore ?? 0);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  // Locked: show pick + actual result/points if finished.
  if (match.locked) {
    return (
      <div className="text-sm">
        {match.status === 'finished' && (
          <div className="font-semibold">Full time: {match.homeScore}–{match.awayScore}</div>
        )}
        {initial ? (
          <div className="flex items-center gap-2">
            <span>🔒 Your pick: {initial.homeScore}–{initial.awayScore}</span>
            {initial.pointsAwarded != null && (
              <span className="bg-pitch text-gold rounded px-2 py-0.5 font-bold">+{initial.pointsAwarded}</span>
            )}
          </div>
        ) : (
          <span className="text-pitch/60">🔒 Locked — no pick made</span>
        )}
      </div>
    );
  }

  if (!signedIn) {
    return <a href="/auth/login" className="text-sm underline">Sign in to predict</a>;
  }

  const clamp = (n: number) => Math.max(0, Math.min(30, n));
  function save() {
    setMsg(null);
    start(async () => {
      const res = await savePrediction(match.id, home, away);
      setMsg(res.ok ? 'Saved ✓' : res.error ?? 'Error');
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-center gap-3">
        <Stepper value={home} onChange={(v) => setHome(clamp(v))} label={match.home?.code ?? 'Home'} />
        <span className="font-bold">:</span>
        <Stepper value={away} onChange={(v) => setAway(clamp(v))} label={match.away?.code ?? 'Away'} />
      </div>
      <div className="flex flex-wrap gap-1 justify-center">
        {QUICK.map(([h, a]) => (
          <button
            key={`${h}-${a}`}
            onClick={() => { setHome(h); setAway(a); }}
            className={`border-2 border-pitch rounded px-2 py-0.5 text-xs font-bold ${
              home === h && away === a ? 'bg-gold' : 'bg-cream'
            }`}
          >
            {h}-{a}
          </button>
        ))}
      </div>
      <button
        onClick={save}
        disabled={pending}
        className="bg-pitch text-cream rounded-lg py-1.5 text-sm font-bold disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Save pick'}
      </button>
      {msg && <p className="text-center text-xs">{msg}</p>}
    </div>
  );
}

function Stepper({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-bold uppercase text-pitch/60">{label}</span>
      <button onClick={() => onChange(value + 1)} className="w-7 h-7 border-2 border-pitch rounded bg-gold font-bold">+</button>
      <span className="w-9 h-9 border-2 border-pitch rounded bg-white flex items-center justify-center text-lg font-bold">{value}</span>
      <button onClick={() => onChange(value - 1)} className="w-7 h-7 border-2 border-pitch rounded bg-gold font-bold">−</button>
    </div>
  );
}
