import { describe, it, expect } from 'vitest';
import { shouldPlaySfx } from './sfx';

describe('shouldPlaySfx', () => {
  it('plays only when enabled and motion is allowed', () => {
    expect(shouldPlaySfx({ enabled: true, reducedMotion: false })).toBe(true);
  });
  it('is silent when disabled', () => {
    expect(shouldPlaySfx({ enabled: false, reducedMotion: false })).toBe(false);
  });
  it('is silent under reduced motion even if enabled', () => {
    expect(shouldPlaySfx({ enabled: true, reducedMotion: true })).toBe(false);
  });
});
