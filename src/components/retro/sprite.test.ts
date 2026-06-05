import { describe, it, expect } from 'vitest';
import { spriteSeed, spriteColors } from './sprite';

describe('spriteSeed', () => {
  it('is deterministic for the same inputs', () => {
    expect(spriteSeed('Raúl Jiménez', 9)).toBe(spriteSeed('Raúl Jiménez', 9));
  });
  it('differs for different players', () => {
    expect(spriteSeed('Ochoa', 13)).not.toBe(spriteSeed('Lozano', 11));
  });
  it('handles a null shirt number', () => {
    expect(typeof spriteSeed('No Number', null)).toBe('number');
  });
});

describe('spriteColors', () => {
  it('gives goalkeepers a distinct kit', () => {
    const gk = spriteColors(spriteSeed('Keeper', 1), 'GK');
    const fw = spriteColors(spriteSeed('Keeper', 1), 'FW');
    expect(gk.jersey).not.toBe(fw.jersey);
  });
  it('returns hex colors for skin/hair/jersey', () => {
    const c = spriteColors(spriteSeed('X', 7), 'MF');
    for (const v of [c.skin, c.hair, c.jersey]) expect(v).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});
