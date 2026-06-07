import { StickerCard } from '@/components/retro/sticker-card';
import type { RankStrip as RankData } from '@/lib/board';

export function RankStrip({ data, rank, players }: { data: RankData; rank?: number | null; players?: number }) {
  const cells = [
    { label: players ? `of ${players}` : 'Rank', value: rank != null ? `#${rank}` : '—' },
    { label: 'Points', value: data.points },
    { label: 'Predicted', value: `${data.predicted}/${data.total}` },
    { label: 'To Predict', value: data.matchesLeft },
  ];
  return (
    <StickerCard className="p-3">
      <div className="grid grid-cols-4 gap-2 text-center">
        {cells.map((c) => (
          <div key={c.label}>
            <div className="font-pixel text-2xl text-pitch leading-none">{c.value}</div>
            <div className="font-pixel text-xs text-pitch/60 uppercase">{c.label}</div>
          </div>
        ))}
      </div>
    </StickerCard>
  );
}
