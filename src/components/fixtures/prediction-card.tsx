'use client';
import { useState, useTransition } from 'react';
import { savePrediction } from '@/app/fixtures/actions';
import type { FixtureMatch } from '@/lib/fixtures';
import { ScoreStepper, QuickScorelineChips } from '@/components/retro/score-stepper';
import { PredictCTA } from '@/components/retro/predict-cta';
import { Lock } from 'lucide-react';

export function PredictionCard({ match, signedIn }: { match: FixtureMatch; signedIn: boolean }) {
  const initial = match.prediction;
  const [home, setHome] = useState(initial?.homeScore ?? 0);
  const [away, setAway] = useState(initial?.awayScore ?? 0);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  if (match.locked) {
    return (
      <div className="font-pixel text-lg">
        {match.status === 'finished' && (
          <div className="font-display text-sm">Full time: {match.homeScore}–{match.awayScore}</div>
        )}
        {initial ? (
          <div className="flex items-center gap-2">
            <span><Lock size={14} className="inline -mt-1" /> Your pick: {initial.homeScore}–{initial.awayScore}</span>
            {initial.pointsAwarded != null && (
              <span className="bg-pitch text-gold rounded px-2 py-0.5">+{initial.pointsAwarded}</span>
            )}
          </div>
        ) : (
          <span className="text-pitch/60"><Lock size={14} className="inline -mt-1" /> Locked — no pick made</span>
        )}
      </div>
    );
  }

  if (!signedIn) return <a href="/auth/login" className="font-pixel text-lg underline">Sign in to predict</a>;

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
        <ScoreStepper value={home} onChange={setHome} label={match.home?.code ?? 'Home'} />
        <span className="font-pixel text-3xl">:</span>
        <ScoreStepper value={away} onChange={setAway} label={match.away?.code ?? 'Away'} />
      </div>
      <QuickScorelineChips home={home} away={away} onPick={(h, a) => { setHome(h); setAway(a); }} />
      <PredictCTA onClick={save} disabled={pending} className="w-full text-sm py-2">
        {pending ? 'Saving…' : 'Save pick'}
      </PredictCTA>
      {msg && <p className="text-center font-pixel text-base">{msg}</p>}
    </div>
  );
}
