import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPlayer } from '@/lib/teams';
import { StickerCard } from '@/components/retro/sticker-card';
import { PixelAvatar } from '@/components/retro/pixel-avatar';

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getPlayer(id);
  if (!data) notFound();
  const { player, team } = data;

  return (
    <div className="max-w-md mx-auto flex flex-col gap-4">
      <StickerCard>
        <div className="flex items-center gap-4">
          <PixelAvatar name={player.name} photoUrl={player.photoUrl} position={player.position} shirtNumber={player.shirtNumber} size="lg" />
          <div>
            <h1 className="text-xl">{player.name}</h1>
            <p className="font-pixel text-lg text-pitch/70 leading-tight">
              {player.position ?? '—'} · #{player.shirtNumber ?? '—'}{player.club ? ` · ${player.club}` : ''}<br />
              {player.age ? `Age ${player.age}` : ''}{player.caps != null ? ` · ${player.caps} caps` : ''}
            </p>
          </div>
        </div>
        {player.goldenBootEligible && (
          <button className="rp-tag mt-4 inline-block cursor-pointer">★ Pick for Golden Boot</button>
        )}
      </StickerCard>
      {team && <Link href={`/team/${team.code}`} className="text-center font-pixel text-lg text-cream underline">← {team.name}</Link>}
    </div>
  );
}
