'use client';
import type { LocalDateGroup } from '@/lib/local-time';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function label(dateKey: string) {
  const [, mm, dd] = dateKey.split('-');
  return { mon: MONTHS[Number(mm) - 1] ?? '', day: String(Number(dd)) };
}

export function DateStrip({
  groups, selected, onSelect,
}: {
  groups: LocalDateGroup[];
  selected: string | null;
  onSelect: (dateKey: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
      {groups.map((g) => {
        const { mon, day } = label(g.dateKey);
        const on = g.dateKey === selected;
        return (
          <button
            key={g.dateKey}
            type="button"
            onClick={() => onSelect(g.dateKey)}
            className={`shrink-0 rounded-lg border-[3px] border-ink px-3 py-1 text-center leading-tight rp-shadow-sm font-display ${on ? 'bg-gold text-pitch' : 'bg-cream text-pitch'}`}
          >
            <span className="block text-[10px]">{mon}</span>
            <span className="block font-pixel text-xl">{day}</span>
            <span className="block text-[10px] opacity-70">{g.matches.length}</span>
          </button>
        );
      })}
    </div>
  );
}
