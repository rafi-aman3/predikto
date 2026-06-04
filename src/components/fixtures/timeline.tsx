'use client';
import { groupByLocalDate } from '@/lib/local-time';
import type { FixtureMatch } from '@/lib/fixtures';
import { LocalTime } from '@/components/local-time';
import { MatchCard } from './match-card';

export function Timeline({ matches, signedIn }: { matches: FixtureMatch[]; signedIn: boolean }) {
  const groups = groupByLocalDate(matches);
  if (!groups.length) return <p className="rp-card p-4 text-center">No matches.</p>;
  return (
    <div>
      {groups.map((g) => (
        <section key={g.dateKey} className="mb-4">
          <h2 className="font-bold border-b-2 border-pitch pb-1 mb-2 text-cream">
            <LocalTime date={g.matches[0].kickoffAt} format="dayHeader" />
          </h2>
          {g.matches.map((m) => <MatchCard key={m.id} match={m} signedIn={signedIn} />)}
        </section>
      ))}
    </div>
  );
}
