import type { FixtureMatch } from '@/lib/fixtures';
import { PredictionCard } from './prediction-card';
import { LocalTime } from '@/components/local-time';

const TBD = 'TBD';

export function MatchCard({ match, signedIn }: { match: FixtureMatch; signedIn: boolean }) {
  return (
    <div className="rp-card p-3 mb-2">
      <div className="text-[10px] uppercase tracking-wide text-pitch/60 font-bold text-center">
        <LocalTime date={match.kickoffAt} format="datetime" /> · {match.venue?.name ?? TBD}
        {match.groupName ? ` · Group ${match.groupName}` : ''}
      </div>
      <div className="flex items-center justify-between my-2 font-bold">
        <span>{match.home ? `${match.home.flag ?? ''} ${match.home.code}` : TBD}</span>
        <span className="text-pitch/50">vs</span>
        <span>{match.away ? `${match.away.code} ${match.away.flag ?? ''}` : TBD}</span>
      </div>
      <PredictionCard match={match} signedIn={signedIn} />
    </div>
  );
}
