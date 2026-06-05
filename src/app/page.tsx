import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getFixtures } from '@/lib/fixtures';
import { getUserPredictionMap } from '@/lib/predictions';
import { buildGroupBoard, buildRankStrip } from '@/lib/board';
import { db } from '@/db';
import { teams as teamsTable, venues as venuesTable } from '@/db/schema';
import { Countdown } from '@/components/countdown';
import { StickerCard } from '@/components/retro/sticker-card';
import { GroupBoard } from '@/components/home/group-board';
import { StadiumRow } from '@/components/home/stadium-row';
import { RankStrip } from '@/components/home/rank-strip';
import { BracketTeaser } from '@/components/home/bracket-teaser';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const predictionMap = user ? await getUserPredictionMap(user.id) : undefined;

  const [fixtures, teamRows, venueRows] = await Promise.all([
    getFixtures(predictionMap),
    db.select().from(teamsTable),
    db.select().from(venuesTable),
  ]);

  const first = fixtures[0];
  const groups = buildGroupBoard(
    teamRows.map((t) => ({ id: t.id, code: t.code, name: t.name, flag: t.flag, groupName: t.groupName })),
    fixtures,
  );
  const stadiums = venueRows.map((v) => ({ name: v.name, city: v.city }));

  return (
    <div className="flex flex-col gap-6">
      <StickerCard className="text-center rp-scanlines">
        <h1 className="text-3xl text-pitch">World Cup 2026</h1>
        <p className="font-pixel text-xl text-pitch/70 mt-1 mb-4">predict every match · build your bracket · win the prize</p>
        {first ? <Countdown target={first.kickoffAt} /> : null}
        <div className="mt-4">
          <Link href="/fixtures" className="rp-cta inline-block px-6 py-3">Start predicting</Link>
        </div>
      </StickerCard>

      {user && predictionMap ? <RankStrip data={buildRankStrip(fixtures)} /> : null}

      <GroupBoard groups={groups} />
      <StadiumRow stadiums={stadiums} />
      <BracketTeaser />
    </div>
  );
}
