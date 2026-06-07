import Link from 'next/link';
import { ChevronRight, Lock } from 'lucide-react';
import type { FixtureMatch, RowState } from '@/lib/fixtures';
import { predictionRowState } from '@/lib/fixtures';
import { BadgeFlag } from '@/components/retro/badge-flag';
import { LocalTime } from '@/components/local-time';

const TBD = 'TBD';

function Chip({ state }: { state: RowState }) {
  switch (state.kind) {
    case 'predict':
      return <span className="shrink-0 border-2 border-ink bg-alert text-cream rounded-full px-2 py-0.5 text-[10px] font-display">PREDICT</span>;
    case 'picked':
      return <span className="rp-tag shrink-0 text-[10px]">YOU {state.pick}</span>;
    case 'locked':
      return <span className="shrink-0 inline-flex items-center gap-1 bg-ink text-chalk rounded-full px-2 py-0.5 text-[10px] font-display"><Lock size={10} />LOCKED</span>;
    case 'live':
      return <span className="shrink-0 bg-alert text-cream rounded-full px-2 py-0.5 text-[10px] font-display">LIVE</span>;
    case 'finished':
      return (
        <span className="shrink-0 flex items-center gap-1">
          {state.pick
            ? <span className="rp-tag text-[10px]">YOU {state.pick}</span>
            : <span className="bg-ink text-chalk rounded-full px-2 py-0.5 text-[10px] font-display">no pick</span>}
          {state.points != null && (
            <span className="border-2 border-ink bg-chalk text-ink rounded px-1.5 text-[10px] font-display">+{state.points}</span>
          )}
        </span>
      );
  }
}

export function MatchRow({ match }: { match: FixtureMatch }) {
  const state = predictionRowState(match);
  const showScore = state.kind === 'finished' || state.kind === 'live';
  return (
    <Link
      href={`/match/${match.id}`}
      className="rp-card rp-hover-lift flex items-center gap-2 p-2 mb-1.5 no-underline"
    >
      <span className="shrink-0 w-12 text-center leading-none font-pixel text-base text-pitch/70">
        {match.status === 'finished'
          ? 'FT'
          : match.status === 'live'
            ? <span className="text-alert">LIVE</span>
            : <LocalTime date={match.kickoffAt} format="time" />}
      </span>

      <div className="flex-1 min-w-0 flex items-center justify-between gap-2 font-display text-xs text-pitch">
        <span className="flex items-center gap-1.5 min-w-0">
          {match.home
            ? <><BadgeFlag flag={match.home.flag} code={match.home.code} size="sm" />{match.home.code}</>
            : TBD}
        </span>
        {showScore
          ? <span className="font-pixel text-base bg-ink text-gold rounded px-2">{state.score}</span>
          : <span className="font-pixel text-pitch/50">vs</span>}
        <span className="flex items-center gap-1.5 min-w-0 justify-end">
          {match.away
            ? <>{match.away.code}<BadgeFlag flag={match.away.flag} code={match.away.code} size="sm" /></>
            : TBD}
        </span>
      </div>

      <Chip state={state} />
      <ChevronRight size={16} className="shrink-0 text-pitch/50" />
    </Link>
  );
}
