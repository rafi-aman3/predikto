'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { ScoreStepper, QuickScorelineChips } from '@/components/retro/score-stepper';
import { PredictCTA } from '@/components/retro/predict-cta';
import { useSfx } from '@/components/retro/sound-toggle';
import { lockPrediction, type LockResult } from '@/app/match/[id]/actions';
import type { Aggregate } from '@/lib/board';
import type { FixtureMatch } from '@/lib/fixtures';

export function PredictPanel({ match, signedIn }: { match: FixtureMatch; signedIn: boolean }) {
  const init = match.prediction;
  const [home, setHome] = useState(init?.homeScore ?? 0);
  const [away, setAway] = useState(init?.awayScore ?? 0);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Aggregate | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const { play } = useSfx();

  if (match.locked) {
    return (
      <p className="font-pixel text-lg text-center">
        <Lock size={16} className="inline -mt-1" /> Locked — {init ? `your pick ${init.homeScore}–${init.awayScore}` : 'no pick made'}
      </p>
    );
  }
  if (!signedIn) {
    return <Link href="/auth/login" className="rp-cta block text-center px-5 py-3">Sign in to predict</Link>;
  }

  function lock() {
    setErr(null);
    start(async () => {
      const res: LockResult = await lockPrediction(match.id, home, away);
      if (!res.ok) { setErr(res.error); return; }
      play('lock');
      setRevealed(res.aggregate);
      setNext(res.nextMatchId);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-center gap-4">
        <ScoreStepper value={home} onChange={setHome} label={match.home?.code ?? 'Home'} />
        <span className="font-pixel text-4xl">—</span>
        <ScoreStepper value={away} onChange={setAway} label={match.away?.code ?? 'Away'} />
      </div>
      <QuickScorelineChips home={home} away={away} onPick={(h, a) => { setHome(h); setAway(a); }} />
      <PredictCTA onClick={lock} disabled={pending} className="w-full">
        {pending ? 'Locking…' : revealed ? 'Update pick' : 'Lock in my pick'}
      </PredictCTA>
      {err && <p className="text-center font-pixel text-alert text-lg">{err}</p>}

      {revealed && (
        <div className="rp-stamp">
          <p className="font-pixel text-base text-pitch/70 mb-1">How the circle predicted ({revealed.total})</p>
          <Bar label={`${match.home?.code ?? 'Home'} win`} pct={revealed.homeWin} />
          <Bar label="Draw" pct={revealed.draw} />
          <Bar label={`${match.away?.code ?? 'Away'} win`} pct={revealed.awayWin} />
          {next && (
            <Link href={`/match/${next}`} className="rp-cta block text-center px-5 py-3 mt-3 bg-pitch">
              Next unpredicted match
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function Bar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="mb-1">
      <div className="flex justify-between font-pixel text-base"><span>{label}</span><span>{pct}%</span></div>
      <div className="h-3 bg-pitch-light border-2 border-pitch rounded-full overflow-hidden">
        <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
