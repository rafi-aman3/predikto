'use client';
import { groupByLocalDate } from '@/lib/local-time';
import type { FixtureMatch } from '@/lib/fixtures';
import { LocalTime } from '@/components/local-time';
import { MatchCard } from './match-card';

/**
 * Calendar Grid: each local match day as a labeled block. Grouping happens in the browser
 * timezone so days reflect the visitor's local calendar.
 */
export function CalendarGrid({ matches, signedIn }: { matches: FixtureMatch[]; signedIn: boolean }) {
  const groups = groupByLocalDate(matches);
  if (!groups.length) return <p className="rp-card p-4 text-center">No matches scheduled yet.</p>;
  return (
    <div className="grid gap-3">
      {groups.map((g) => (
        <div key={g.dateKey} className="rp-card p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold">
              <LocalTime date={g.matches[0].kickoffAt} format="dayHeader" />
            </span>
            <span className="bg-pitch text-gold rounded-full px-2 py-0.5 text-xs font-bold">
              {g.matches.length} {g.matches.length === 1 ? 'match' : 'matches'}
            </span>
          </div>
          {g.matches.map((m) => <MatchCard key={m.id} match={m} signedIn={signedIn} />)}
        </div>
      ))}
    </div>
  );
}
