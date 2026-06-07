'use client';
import { useMemo, useState } from 'react';
import type { FixtureMatch } from '@/lib/fixtures';
import { groupByLocalDate, pickDefaultDay } from '@/lib/local-time';
import { LocalTime } from '@/components/local-time';
import { DateStrip } from './date-strip';
import { MatchRow } from './match-row';
import { StageBoard } from './stage-nav';

type Mode = 'day' | 'stage';

export function FixturesView({
  matches, initialView, initialDay, initialStage,
}: {
  matches: FixtureMatch[];
  initialView: Mode;
  initialDay?: string;
  initialStage?: string;
}) {
  const dayGroups = useMemo(() => groupByLocalDate(matches), [matches]);
  const defaultDay = useMemo(() => pickDefaultDay(dayGroups, new Date()), [dayGroups]);

  const [mode, setMode] = useState<Mode>(initialView);
  const [day, setDay] = useState<string | null>(initialDay ?? defaultDay);

  const syncUrl = (patch: Record<string, string>) => {
    const params = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    window.history.replaceState(null, '', `?${params.toString()}`);
  };

  const selectMode = (m: Mode) => { setMode(m); syncUrl({ view: m }); };
  const selectDay = (key: string) => { setDay(key); syncUrl({ view: 'day', day: key }); };

  const current = dayGroups.find((g) => g.dateKey === day)
    ?? dayGroups.find((g) => g.dateKey === defaultDay)
    ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {(['day', 'stage'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => selectMode(m)}
            className={`rounded-lg border-[3px] border-ink px-4 py-1 text-sm rp-shadow-sm font-display ${mode === m ? 'bg-gold text-pitch' : 'bg-cream text-pitch'}`}
          >
            {m === 'day' ? 'By Day' : 'By Stage'}
          </button>
        ))}
      </div>

      {mode === 'day' ? (
        dayGroups.length === 0 ? (
          <p className="rp-card p-4 text-center">No matches scheduled yet.</p>
        ) : (
          <>
            <DateStrip groups={dayGroups} selected={current?.dateKey ?? null} onSelect={selectDay} />
            {current && current.dateKey !== defaultDay && defaultDay && (
              <button
                type="button"
                onClick={() => selectDay(defaultDay)}
                className="self-start rp-tag text-xs"
              >
                ↩ Today / Next
              </button>
            )}
            <div>
              {current && (
                <h2 className="mb-2 font-display text-sm text-cream">
                  <LocalTime date={current.matches[0].kickoffAt} format="dayHeader" />
                </h2>
              )}
              {current?.matches.map((m) => <MatchRow key={m.id} match={m} />)}
            </div>
          </>
        )
      ) : (
        <StageBoard matches={matches} initialStage={initialStage} />
      )}
    </div>
  );
}
