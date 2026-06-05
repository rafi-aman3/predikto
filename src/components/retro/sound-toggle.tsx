'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { shouldPlaySfx, SFX_TONES, type SfxName } from '@/lib/sfx';

const KEY = 'rp-sfx-enabled';
const Ctx = createContext<{ enabled: boolean; toggle: () => void; play: (n: SfxName) => void } | null>(null);

export function SfxProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => { setEnabled(localStorage.getItem(KEY) === '1'); }, []);

  const toggle = useCallback(() => {
    setEnabled((e) => { const next = !e; localStorage.setItem(KEY, next ? '1' : '0'); return next; });
  }, []);

  const play = useCallback((name: SfxName) => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (!shouldPlaySfx({ enabled, reducedMotion: reduced })) return;
    type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };
    const Actx = window.AudioContext ?? (window as WindowWithWebkit).webkitAudioContext;
    if (!Actx) return;
    const ctx = new Actx();
    SFX_TONES[name].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.value = 0.05;
      osc.connect(gain); gain.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.09;
      osc.start(t); osc.stop(t + 0.08);
    });
  }, [enabled]);

  return <Ctx.Provider value={{ enabled, toggle, play }}>{children}</Ctx.Provider>;
}

export function useSfx() {
  return useContext(Ctx) ?? { enabled: false, toggle: () => {}, play: () => {} };
}

export function SoundToggle() {
  const { enabled, toggle } = useSfx();
  return (
    <button onClick={toggle} aria-label={enabled ? 'Mute sound effects' : 'Enable sound effects'}
      className="text-cream hover:text-gold cursor-pointer">
      {enabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
    </button>
  );
}
