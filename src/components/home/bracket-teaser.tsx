import Link from 'next/link';
import { StickerCard } from '@/components/retro/sticker-card';

const MINI = ['1A v 2B', '1C v 2D', '1E v 2F', '1G v 2H'];

export function BracketTeaser() {
  return (
    <section>
      <h2 className="text-cream text-lg mb-3" style={{ textShadow: '2px 2px 0 #06231a' }}>Knockout Bracket</h2>
      <StickerCard className="text-center">
        <div className="flex gap-3 justify-center flex-wrap mb-4">
          {MINI.map((m) => (
            <span key={m} className="font-pixel text-base border-[3px] border-pitch rounded-lg rp-shadow-sm px-3 py-1">{m}</span>
          ))}
          <span className="font-pixel text-base bg-gold border-[3px] border-pitch rounded-lg rp-shadow-sm px-3 py-1">Final ?</span>
        </div>
        <Link href="/bracket" className="rp-cta inline-block px-5 py-3">Build your bracket</Link>
      </StickerCard>
    </section>
  );
}
