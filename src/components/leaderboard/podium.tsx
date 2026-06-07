import { PixelAvatar } from '@/components/retro/pixel-avatar';
import { StickerCard } from '@/components/retro/sticker-card';
import type { LeaderRow } from '@/lib/leaderboard';

/** Top-3 podium. `top` is the rank-sorted leaderboard; we display #2 · #1 · #3. */
export function Podium({ top, prizeText }: { top: LeaderRow[]; prizeText: string | null }) {
  const slots: (LeaderRow | undefined)[] = [top[1], top[0], top[2]];
  return (
    <div className="mb-4 grid grid-cols-3 items-end gap-2">
      {slots.map((r, i) => {
        const center = i === 1;
        if (!r) return <div key={i} />;
        return (
          <StickerCard key={r.userId} className={`p-2 text-center ${center ? 'bg-gold' : ''}`}>
            <div className="mb-1 flex justify-center">
              <PixelAvatar name={r.displayName ?? 'Player'} photoUrl={null} position={null} shirtNumber={null} size={center ? 'lg' : 'md'} />
            </div>
            <div className="font-pixel text-2xl leading-none text-pitch">{center ? '👑 ' : ''}#{r.rank}</div>
            <div className="truncate font-display text-xs text-pitch">{r.displayName ?? 'Player'}</div>
            <div className="font-pixel text-lg text-pitch">{r.points} pts</div>
            {center && prizeText && <div className="mt-1 font-pixel text-xs text-pitch/70">🏆 {prizeText}</div>}
          </StickerCard>
        );
      })}
    </div>
  );
}
