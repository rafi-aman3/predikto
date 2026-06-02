import { groupByDate, type FixtureMatch } from '@/lib/fixtures';
import { MatchCard } from './match-card';

/**
 * Calendar Grid: shows each match day as a labeled block (a lightweight, mobile-first
 * take on a month calendar — full grid cells get refined later). Days are derived from
 * the matches themselves so empty days don't clutter the view.
 */
export function CalendarGrid({ matches, signedIn }: { matches: FixtureMatch[]; signedIn: boolean }) {
  const groups = groupByDate(matches);
  if (!groups.length) return <p className="rp-card p-4 text-center">No matches scheduled yet.</p>;
  return (
    <div className="grid gap-3">
      {groups.map((g) => (
        <div key={g.date} className="rp-card p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold">
              {new Date(g.date + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}
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
