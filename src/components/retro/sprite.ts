export type SpriteColors = { skin: string; hair: string; jersey: string };

const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
const HAIR = ['#2a1a0a', '#3a2a1a', '#0a0a0a', '#6b4423', '#b5651d'];
const JERSEY = ['#1b3b6f', '#d7263d', '#0a3d26', '#ffcb05', '#5b2a86', '#0e7c7b'];
const GK_JERSEY = '#2dd36f';

/** Stable 32-bit hash of name + shirt number. */
export function spriteSeed(name: string, shirtNumber: number | null): number {
  const str = `${name}#${shirtNumber ?? 0}`;
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function spriteColors(seed: number, position: string | null): SpriteColors {
  const skin = SKIN[seed % SKIN.length];
  const hair = HAIR[(seed >> 3) % HAIR.length];
  const jersey = position === 'GK' ? GK_JERSEY : JERSEY[(seed >> 6) % JERSEY.length];
  return { skin, hair, jersey };
}
