'use client';
import { useState } from 'react';
import { groupByStage, groupByGroup, type FixtureMatch } from '@/lib/fixtures';
import { MatchRow } from './match-row';

const STAGE_LABEL: Record<string, string> = {
  group: 'Group Stage', r32: 'Round of 32', r16: 'Round of 16',
  qf: 'Quarter-finals', sf: 'Semi-finals', third: '3rd Place', final: 'Final',
};

const TABS: { key: string; short: string }[] = [
  { key: 'group', short: 'Groups' }, { key: 'r32', short: 'R32' }, { key: 'r16', short: 'R16' },
  { key: 'qf', short: 'QF' }, { key: 'sf', short: 'SF' }, { key: 'third', short: '3rd' }, { key: 'final', short: 'Final' },
];

export function StageBoard({
  matches, initialStage,
}: { matches: FixtureMatch[]; initialStage?: string }) {
  const stages = groupByStage(matches);
  const available = TABS.filter((t) => stages.some((s) => s.stage === t.key));
  const [active, setActive] = useState<string>(
    initialStage && available.some((t) => t.key === initialStage)
      ? initialStage
      : (available[0]?.key ?? 'group'),
  );

  const select = (key: string) => {
    setActive(key);
    const params = new URLSearchParams(window.location.search);
    params.set('view', 'stage');
    params.set('stage', key);
    window.history.replaceState(null, '', `?${params.toString()}`);
  };

  const current = stages.find((s) => s.stage === active);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {available.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => select(t.key)}
            className={`rounded border-2 border-ink px-2.5 py-0.5 text-xs font-display ${active === t.key ? 'bg-gold text-pitch' : 'bg-cream text-pitch'}`}
          >
            {t.short}
          </button>
        ))}
      </div>

      {!current ? (
        <p className="rp-card p-4 text-center">No matches.</p>
      ) : current.stage === 'group' ? (
        groupByGroup(current.matches).map((g) => (
          <section key={g.groupName}>
            <h3 className="mb-1.5 font-display text-sm text-cream">Group {g.groupName}</h3>
            {g.matches.map((m) => <MatchRow key={m.id} match={m} />)}
          </section>
        ))
      ) : (
        <section>
          <h2 className="mb-2 font-display text-lg text-cream">{STAGE_LABEL[current.stage] ?? current.stage}</h2>
          {current.matches.map((m) => <MatchRow key={m.id} match={m} />)}
        </section>
      )}
    </div>
  );
}
