import { spriteSeed, spriteColors } from './sprite';

const SIZES = { sm: 48, md: 64, lg: 90 } as const;

/**
 * Player avatar. If `photoUrl` exists, render it through a pixelate/posterize look;
 * otherwise draw a deterministic CSS sprite (face + hair + jersey block) seeded by name.
 */
export function PixelAvatar({
  name, photoUrl, position, shirtNumber, size = 'md',
}: {
  name: string; photoUrl: string | null; position: string | null;
  shirtNumber: number | null; size?: keyof typeof SIZES;
}) {
  const px = SIZES[size];
  const numEl = shirtNumber != null && (
    <span className="absolute bottom-0 inset-x-0 text-center font-pixel text-white"
      style={{ fontSize: px * 0.32 }}>{shirtNumber}</span>
  );

  if (photoUrl) {
    return (
      <span className="relative inline-block rounded-lg border-[3px] border-ink rp-shadow-sm overflow-hidden"
        style={{ width: px, height: px }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl} alt={name} width={px} height={px}
          className="pixelated w-full h-full object-cover"
          style={{ filter: 'saturate(1.2) contrast(1.15)', imageRendering: 'pixelated' }} />
        {numEl}
      </span>
    );
  }

  const c = spriteColors(spriteSeed(name, shirtNumber), position);
  return (
    <span aria-label={name} role="img"
      className="relative inline-block rounded-lg border-[3px] border-ink rp-shadow-sm overflow-hidden"
      style={{
        width: px, height: px, backgroundColor: c.jersey,
        backgroundImage:
          `radial-gradient(circle at 50% 34%, ${c.skin} 0 26%, transparent 27%),` +
          `radial-gradient(circle at 50% 22%, ${c.hair} 0 18%, transparent 19%)`,
      }}>
      {numEl}
    </span>
  );
}
