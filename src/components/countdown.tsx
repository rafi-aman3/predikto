'use client';
import { useEffect, useState } from 'react';
import { timeRemaining, type Remaining } from '@/lib/local-time';

function Segment({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-serif text-3xl sm:text-4xl font-bold text-gold tabular-nums">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-cream/70 font-bold">{label}</span>
    </div>
  );
}

/** Live-ticking countdown to a target kickoff. Mount-guard keeps SSR/CSR HTML identical. */
export function Countdown({ target }: { target: Date | string }) {
  const ms = typeof target === 'string' ? new Date(target).getTime() : target.getTime();
  const [r, setR] = useState<Remaining | null>(null);

  useEffect(() => {
    const tick = () => setR(timeRemaining(new Date(ms), new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [ms]);

  if (!r) {
    return <div className="text-center text-cream/70" suppressHydrationWarning>—</div>;
  }
  if (r.done) {
    return <div className="text-center font-serif text-2xl font-bold text-gold">🏆 The tournament is live!</div>;
  }
  return (
    <div className="bg-pitch rounded-xl py-4 grid grid-cols-4 gap-2 max-w-md mx-auto" suppressHydrationWarning>
      <Segment value={r.days} label="Days" />
      <Segment value={r.hours} label="Hrs" />
      <Segment value={r.minutes} label="Min" />
      <Segment value={r.seconds} label="Sec" />
    </div>
  );
}
