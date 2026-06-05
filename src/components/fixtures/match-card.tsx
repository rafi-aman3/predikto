import Link from 'next/link';
import type { FixtureMatch } from '@/lib/fixtures';
import { PredictionCard } from './prediction-card';
import { LocalTime } from '@/components/local-time';
import { StickerCard } from '@/components/retro/sticker-card';
import { BadgeFlag } from '@/components/retro/badge-flag';

const TBD = 'TBD';

export function MatchCard({ match, signedIn }: { match: FixtureMatch; signedIn: boolean }) {
  return (
    <StickerCard className="p-3 mb-2" hover>
      <Link href={`/match/${match.id}`} className="block">
        <div className="font-pixel text-base text-pitch/60 text-center">
          <LocalTime date={match.kickoffAt} format="datetime" /> · {match.venue?.name ?? TBD}
          {match.groupName ? ` · Group ${match.groupName}` : ''}
        </div>
        <div className="flex items-center justify-between my-2">
          <span className="flex items-center gap-2 font-display text-sm">
            {match.home ? <><BadgeFlag flag={match.home.flag} code={match.home.code} size="sm" />{match.home.code}</> : TBD}
          </span>
          <span className="font-pixel text-pitch/50">vs</span>
          <span className="flex items-center gap-2 font-display text-sm">
            {match.away ? <>{match.away.code}<BadgeFlag flag={match.away.flag} code={match.away.code} size="sm" /></> : TBD}
          </span>
        </div>
      </Link>
      <PredictionCard match={match} signedIn={signedIn} />
    </StickerCard>
  );
}
