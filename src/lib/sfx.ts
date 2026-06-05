export type SfxState = { enabled: boolean; reducedMotion: boolean };

/** Pure gate: SFX play only when the user opted in AND has not asked for reduced motion. */
export function shouldPlaySfx({ enabled, reducedMotion }: SfxState): boolean {
  return enabled && !reducedMotion;
}

export type SfxName = 'lock' | 'award' | 'points';

/** Frequencies (Hz) for the tiny 8-bit blips, by event. */
export const SFX_TONES: Record<SfxName, number[]> = {
  lock: [660, 880],
  award: [523, 659, 784],
  points: [784, 988, 1175],
};
