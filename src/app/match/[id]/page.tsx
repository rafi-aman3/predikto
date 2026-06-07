import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getFixtures } from '@/lib/get-fixtures';
import { getUserPredictionMap } from '@/lib/predictions';
import { getScoringConfig } from '@/lib/app-settings';
import { StickerCard } from '@/components/retro/sticker-card';
import { BadgeFlag } from '@/components/retro/badge-flag';
import { GroupTag } from '@/components/retro/group-tag';
import { LocalTime } from '@/components/local-time';
import { PredictPanel } from '@/components/match/predict-panel';
import { TeamLink } from '@/components/retro/team-link';

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const predictionMap = user ? await getUserPredictionMap(user.id) : undefined;

  const fixtures = await getFixtures(predictionMap);
  const match = fixtures.find((m) => m.id === id);
  if (!match) notFound();

  const cfg = await getScoringConfig();

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-4">
      <StickerCard>
        <div className="font-pixel text-base text-pitch/70 text-center flex items-center justify-center gap-2 flex-wrap">
          {match.groupName && <GroupTag>Group {match.groupName}</GroupTag>}
          {match.venue?.name && <span>{match.venue.name}</span>}
          <span className="text-alert"><LocalTime date={match.kickoffAt} format="datetime" /></span>
        </div>

        <div className="flex items-center justify-around my-4">
          <TeamLink code={match.home?.code} className="text-center block">
            <BadgeFlag flag={match.home?.flag ?? null} code={match.home?.code ?? 'TBD'} size="lg" />
            <div className="font-display text-base mt-2">{match.home?.name ?? 'TBD'}</div>
          </TeamLink>
          <span className="font-pixel text-2xl text-alert">VS</span>
          <TeamLink code={match.away?.code} className="text-center block">
            <BadgeFlag flag={match.away?.flag ?? null} code={match.away?.code ?? 'TBD'} size="lg" />
            <div className="font-display text-base mt-2">{match.away?.name ?? 'TBD'}</div>
          </TeamLink>
        </div>

        <PredictPanel match={match} signedIn={!!user} />
        <p className="text-center font-pixel text-base text-pitch/60 mt-3">
          exact score +{cfg.ptsExact} · correct result +{cfg.ptsResult}
        </p>
      </StickerCard>

      <Link href="/fixtures" className="text-center font-pixel text-lg text-cream underline">← all fixtures</Link>
    </div>
  );
}
