import { groupByDate, type FixtureMatch } from '@/lib/fixtures';
import { MatchCard } from './match-card';

const fmtDate = (iso: string) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

export function Timeline({ matches, signedIn }: { matches: FixtureMatch[]; signedIn: boolean }) {
  const groups = groupByDate(matches);
  if (!groups.length) return <p className="rp-card p-4 text-center">No matches.</p>;
  return (
    <div>
      {groups.map((g) => (
        <section key={g.date} className="mb-4">
          <h2 className="font-bold border-b-2 border-pitch pb-1 mb-2 text-cream">{fmtDate(g.date)}</h2>
          {g.matches.map((m) => <MatchCard key={m.id} match={m} signedIn={signedIn} />)}
        </section>
      ))}
    </div>
  );
}
