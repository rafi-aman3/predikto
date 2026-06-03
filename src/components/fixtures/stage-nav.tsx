import { groupByStage, groupByGroup, type FixtureMatch } from '@/lib/fixtures';
import { MatchCard } from './match-card';

const STAGE_LABEL: Record<string, string> = {
  group: 'Group Stage', r32: 'Round of 32', r16: 'Round of 16', qf: 'Quarter-finals', sf: 'Semi-finals', third: '3rd Place', final: 'Final',
};

export function StageNav({ matches, signedIn }: { matches: FixtureMatch[]; signedIn: boolean }) {
  const stages = groupByStage(matches);
  if (!stages.length) return <p className="rp-card p-4 text-center">No matches.</p>;
  return (
    <div>
      {stages.map((s) => (
        <section key={s.stage} className="mb-5">
          <h2 className="font-bold text-cream text-lg mb-2">{STAGE_LABEL[s.stage] ?? s.stage}</h2>
          {s.stage === 'group'
            ? groupByGroup(s.matches).map((g) => (
                <div key={g.groupName} className="mb-3">
                  <h3 className="font-bold text-cream/90 text-sm mb-1">Group {g.groupName}</h3>
                  {g.matches.map((m) => <MatchCard key={m.id} match={m} signedIn={signedIn} />)}
                </div>
              ))
            : s.matches.map((m) => <MatchCard key={m.id} match={m} signedIn={signedIn} />)}
        </section>
      ))}
    </div>
  );
}
