'use client';
import { ChevronUp, ChevronDown } from 'lucide-react';

export const QUICK_SCORELINES: Array<[number, number]> = [[1, 0], [2, 1], [0, 0], [1, 1], [3, 0]];

export function ScoreStepper({
  value, onChange, label,
}: { value: number; onChange: (v: number) => void; label: string }) {
  const clamp = (n: number) => Math.max(0, Math.min(30, n));
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="font-display text-xs uppercase text-pitch/70">{label}</span>
      <button
        aria-label={`Increase ${label} score`}
        onClick={() => onChange(clamp(value + 1))}
        className="w-11 h-9 bg-pitch text-gold rounded-lg rp-shadow-sm flex items-center justify-center cursor-pointer"
      >
        <ChevronUp size={20} />
      </button>
      <span className="w-16 h-16 rp-card flex items-center justify-center font-pixel text-5xl leading-none">
        {value}
      </span>
      <button
        aria-label={`Decrease ${label} score`}
        onClick={() => onChange(clamp(value - 1))}
        className="w-11 h-9 bg-pitch text-gold rounded-lg rp-shadow-sm flex items-center justify-center cursor-pointer"
      >
        <ChevronDown size={20} />
      </button>
    </div>
  );
}

export function QuickScorelineChips({
  home, away, onPick,
}: { home: number; away: number; onPick: (h: number, a: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {QUICK_SCORELINES.map(([h, a]) => {
        const sel = home === h && away === a;
        return (
          <button
            key={`${h}-${a}`}
            onClick={() => onPick(h, a)}
            className={`font-pixel text-lg border-[3px] border-pitch rounded-full px-3.5 py-0.5 rp-shadow-sm cursor-pointer ${sel ? 'bg-gold' : 'bg-cream'}`}
          >
            {h}-{a}
          </button>
        );
      })}
    </div>
  );
}
