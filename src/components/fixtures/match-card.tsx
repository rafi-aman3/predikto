import Link from 'next/link';
import type { FixtureMatch } from '@/lib/fixtures';
import { PredictionCard } from './prediction-card';
import { LocalTime } from '@/components/local-time';
import { StickerCard } from '@/components/retro/sticker-card';
import { BadgeFlag } from '@/components/retro/badge-flag';
import { TeamLink } from '@/components/retro/team-link';

const TBD = 'TBD';

export function MatchCard({ match, signedIn }: { match: FixtureMatch; signedIn: boolean }) {
  return (
    <StickerCard className="p-3 mb-2">
      <Link
        href={`/match/${match.id}`}
        className="block font-pixel text-base text-pitch/60 text-center hover:text-pitch"
      >
        <LocalTime date={match.kickoffAt} format="datetime" /> · {match.venue?.name ?? TBD}
        {match.groupName ? ` · Group ${match.groupName}` : ''} · details →
      </Link>
      <div className="flex items-center justify-between my-2">
        <TeamLink code={match.home?.code} className="flex items-center gap-2 font-display text-sm">
          {match.home ? <><BadgeFlag flag={match.home.flag} code={match.home.code} size="sm" />{match.home.code}</> : TBD}
        </TeamLink>
        <span className="font-pixel text-pitch/50">vs</span>
        <TeamLink code={match.away?.code} className="flex items-center gap-2 font-display text-sm">
          {match.away ? <>{match.away.code}<BadgeFlag flag={match.away.flag} code={match.away.code} size="sm" /></> : TBD}
        </TeamLink>
      </div>
      <PredictionCard match={match} signedIn={signedIn} />
    </StickerCard>
  );
}
