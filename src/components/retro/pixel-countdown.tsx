'use client';
import { useEffect, useState } from 'react';
import { timeRemaining, type Remaining } from '@/lib/local-time';

function Box({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-pitch rounded-lg px-3 py-2 rp-shadow-sm text-center min-w-[58px]">
      <span className="block font-pixel text-3xl leading-none text-gold tabular-nums">
        {String(value).padStart(2, '0')}
      </span>
      <span className="font-pixel text-xs text-cream/80 uppercase">{label}</span>
    </div>
  );
}

/** Live-ticking countdown. Mount-guard keeps SSR/CSR HTML identical. */
export function PixelCountdown({ target }: { target: Date | string }) {
  const ms = typeof target === 'string' ? new Date(target).getTime() : target.getTime();
  const [r, setR] = useState<Remaining | null>(null);

  useEffect(() => {
    const tick = () => setR(timeRemaining(new Date(ms), new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [ms]);

  if (!r) return <div className="text-center text-cream/70" suppressHydrationWarning>—</div>;
  if (r.done) {
    return <div className="text-center font-display text-2xl text-gold">The tournament is live!</div>;
  }
  return (
    <div className="flex gap-2 justify-center" suppressHydrationWarning>
      <Box value={r.days} label="Days" />
      <Box value={r.hours} label="Hrs" />
      <Box value={r.minutes} label="Min" />
      <Box value={r.seconds} label="Sec" />
    </div>
  );
}
