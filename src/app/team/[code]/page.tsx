import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTeamWithSquad } from '@/lib/teams';
import { StickerCard } from '@/components/retro/sticker-card';
import { BadgeFlag } from '@/components/retro/badge-flag';
import { GroupTag } from '@/components/retro/group-tag';
import { PixelAvatar } from '@/components/retro/pixel-avatar';

export default async function TeamPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const data = await getTeamWithSquad(code.toUpperCase());
  if (!data) notFound();
  const { team, squad } = data;

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <StickerCard>
        <div className="flex items-center gap-4">
          <BadgeFlag flag={team.flag} code={team.code} size="lg" />
          <div>
            <h1 className="text-2xl">{team.name}</h1>
            <p className="font-pixel text-lg text-pitch/70">
              {team.fifaRank ? `FIFA #${team.fifaRank} · ` : ''}{team.wcTitles}× champions{team.coach ? ` · ${team.coach}` : ''}
            </p>
            {team.groupName && <div className="mt-1"><GroupTag>Group {team.groupName}</GroupTag></div>}
          </div>
        </div>
      </StickerCard>

      <StickerCard>
        <h2 className="text-lg mb-3">Squad</h2>
        {squad.length === 0 ? (
          <p className="font-pixel text-lg text-pitch/60">Squad to be announced.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
            {squad.map((p) => (
              <Link key={p.id} href={`/player/${p.id}`} className="text-center cursor-pointer">
                <PixelAvatar name={p.name} photoUrl={p.photoUrl} position={p.position} shirtNumber={p.shirtNumber} />
                <div className="font-pixel text-base mt-1 leading-tight">{p.name}</div>
              </Link>
            ))}
          </div>
        )}
      </StickerCard>
    </div>
  );
}
