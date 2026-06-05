import { StickerCard } from '@/components/retro/sticker-card';

export type Stadium = { name: string; city: string | null };

export function StadiumRow({ stadiums }: { stadiums: Stadium[] }) {
  return (
    <section>
      <h2 className="text-cream text-lg mb-3" style={{ textShadow: '2px 2px 0 #06231a' }}>16 Stadiums</h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {stadiums.map((s) => (
          <StickerCard key={s.name} className="p-3 min-w-[150px] shrink-0">
            <div className="h-16 rounded-lg border-[3px] border-pitch bg-gradient-to-b from-pitch-light to-pitch" />
            <div className="font-pixel text-lg mt-2 leading-tight">{s.name}</div>
            <div className="font-pixel text-sm text-pitch/60">{s.city}</div>
          </StickerCard>
        ))}
      </div>
    </section>
  );
}
