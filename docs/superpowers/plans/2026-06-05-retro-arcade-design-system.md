# Retro Pitch Arcade — Design System & Core Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the whole app in a 16-bit "sticker-album arcade" design system and add a game-board homepage plus new `/match/[id]`, `/team/[code]`, `/player/[id]` prediction surfaces.

**Architecture:** A small set of shared presentational primitives in `src/components/retro/` built on Tailwind v4 `@theme` tokens; pages compose them. All data uses the existing `fixtures`/`predictions`/`scoring`/`locks` libs plus a few new **pure selector functions** (TDD'd) wrapped by thin DB readers. No schema/migration changes.

**Tech Stack:** Next.js 16 (App Router, `src/proxy.ts`), Tailwind v4 (`@theme` in `globals.css`), Drizzle + Supabase, Vitest (pure-function tests only — no React test runner in repo), `lucide-react` for SVG icons, Google fonts via `next/font/google`.

**Spec:** `docs/superpowers/specs/2026-06-05-retro-arcade-design-system-design.md`

**Conventions in this repo:**
- Tests are Vitest unit tests on **pure functions** (`src/lib/*.test.ts`). There is no React Testing Library — so visual components are verified with `npm run build` + `npx tsc --noEmit`, and logic is extracted into pure functions that ARE unit-tested (TDD).
- Server components fetch via `createClient()` (`src/lib/supabase/server.ts`) and the `@/lib/*` data layer.
- Commit per task. Do NOT push (project pushes once per completed phase). Single Supabase DB = local migrate/reset hits prod, so **no `db:reset`** in this plan except the clearly-marked optional seed task.

---

## File Structure

**Create:**
- `src/components/retro/sticker-card.tsx` — base panel (`StickerCard`)
- `src/components/retro/badge-flag.tsx` — circular flag/crest badge (`BadgeFlag`)
- `src/components/retro/status-pill.tsx` — predict/progress pill (`StatusPill`)
- `src/components/retro/group-tag.tsx` — gold tag chip (`GroupTag`)
- `src/components/retro/predict-cta.tsx` — red commit button (`PredictCTA`)
- `src/components/retro/pixel-countdown.tsx` — countdown digit boxes (`PixelCountdown`)
- `src/components/retro/score-stepper.tsx` — `ScoreStepper` + `QuickScorelineChips`
- `src/components/retro/pixel-avatar.tsx` — `PixelAvatar` (photo→pixelate, sprite fallback)
- `src/components/retro/sprite.ts` — pure `spriteSeed()` / `spriteColors()`
- `src/components/retro/sound-toggle.tsx` — `SoundToggle` + `useSfx`
- `src/lib/sfx.ts` — pure `shouldPlaySfx()`
- `src/lib/board.ts` — pure `buildGroupBoard()`, `buildRankStrip()`, `pickNextUnpredicted()`, `aggregatePredictions()`
- `src/lib/board.test.ts` — tests for the above
- `src/components/retro/sprite.test.ts` — tests for sprite seeding
- `src/lib/sfx.test.ts` — tests for `shouldPlaySfx`
- `src/lib/teams.ts` — `getTeamWithSquad()`, `getPlayer()`
- `src/lib/match-social.ts` — `getMatchPredictionAggregate()`, `getNextUnpredictedMatch()`
- `src/app/match/[id]/page.tsx`, `src/app/match/[id]/actions.ts`
- `src/app/team/[code]/page.tsx`
- `src/app/player/[id]/page.tsx`

**Modify:**
- `src/app/globals.css` — new tokens + utilities + reduced-motion
- `src/app/layout.tsx` — register 3 fonts, drop Geist/Georgia
- `src/components/countdown.tsx` — re-skin via `PixelCountdown` (or replace usage)
- `src/components/nav.tsx` — arcade bar + `SoundToggle`
- `src/app/page.tsx` — game-board homepage
- `src/components/fixtures/match-card.tsx`, `prediction-card.tsx` — adopt primitives
- `src/app/auth/login/*`, `src/app/onboarding/*`, `src/app/admin/*` — adopt tokens
- `package.json` — add `lucide-react`

---

## Task 1: Dependencies, fonts & color tokens

**Files:**
- Modify: `package.json` (add `lucide-react`)
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css:1-20`

- [ ] **Step 1: Install lucide-react**

Run: `npm install lucide-react`
Expected: adds `lucide-react` to dependencies, exit 0.

- [ ] **Step 2: Add color tokens to globals.css**

Replace the `@theme` block in `src/app/globals.css` so it reads:

```css
@import "tailwindcss";

@theme {
  /* Retro Pitch Arcade palette */
  --color-pitch: #0a3d26;
  --color-pitch-light: #11663f;
  --color-ink: #06231a;
  --color-gold: #ffcb05;
  --color-cream: #fff7e6;
  --color-chalk: #f8fff4;
  --color-alert: #d7263d;

  --font-display: var(--font-bungee);
  --font-pixel: var(--font-vt323);
  --font-sans: var(--font-nunito);
}
```

- [ ] **Step 3: Register fonts in layout.tsx**

Replace the font imports/usage in `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Bungee, VT323, Nunito } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

const bungee = Bungee({ weight: "400", subsets: ["latin"], variable: "--font-bungee" });
const vt323 = VT323({ weight: "400", subsets: ["latin"], variable: "--font-vt323" });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito" });

export const metadata: Metadata = {
  title: "World Cup 2026 Predictor",
  description: "Predict every match, build your bracket, climb the leaderboard.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${bungee.variable} ${vt323.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Verify build + typecheck**

Run: `npx tsc --noEmit && npm run build`
Expected: build succeeds (fonts download, no type errors).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/app/layout.tsx src/app/globals.css
git commit -m "feat(design): add ink/chalk tokens, Bungee/VT323/Nunito fonts, lucide-react"
```

---

## Task 2: Global utilities & reduced-motion

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace the body/heading/card rules**

Replace everything in `src/app/globals.css` AFTER the `@theme` block with:

```css
body {
  /* Grass-stripe pitch background */
  background: repeating-linear-gradient(90deg, #0f5e3a 0 56px, #11663f 56px 112px);
  color: var(--color-pitch);
  min-height: 100dvh;
}

h1, h2, h3 { font-family: var(--font-display); letter-spacing: 0.5px; }

/* --- Retro Pitch Arcade primitives --- */
.rp-shadow { box-shadow: 6px 6px 0 var(--color-ink); }
.rp-shadow-sm { box-shadow: 4px 4px 0 var(--color-ink); }

.rp-card {
  background: var(--color-cream);
  border: 4px solid var(--color-pitch);
  border-radius: 14px;
  box-shadow: 6px 6px 0 var(--color-ink);
}

.rp-cta {
  background: var(--color-alert);
  color: var(--color-cream);
  border: 3px solid var(--color-ink);
  border-radius: 10px;
  box-shadow: 4px 4px 0 var(--color-ink);
  font-family: var(--font-display);
  letter-spacing: 1px;
  transition: transform 150ms ease-out, box-shadow 150ms ease-out;
}
.rp-cta:hover { transform: translate(-1px, -1px); box-shadow: 5px 5px 0 var(--color-ink); }
.rp-cta:active { transform: translate(2px, 2px); box-shadow: 2px 2px 0 var(--color-ink); }

.rp-pill {
  background: var(--color-pitch);
  color: var(--color-gold);
  font-family: var(--font-pixel);
  border-radius: 6px;
  padding: 3px 12px;
}
.rp-tag {
  background: var(--color-gold);
  color: var(--color-pitch);
  border: 2px solid var(--color-ink);
  border-radius: 6px;
  box-shadow: 2px 2px 0 var(--color-ink);
  font-family: var(--font-display);
  font-size: 11px;
  padding: 1px 10px;
}

.rp-hover-lift { transition: transform 150ms ease-out, box-shadow 150ms ease-out; }
.rp-hover-lift:hover { transform: translate(-2px, -2px); box-shadow: 8px 8px 0 var(--color-ink); }

@keyframes rp-stamp {
  0% { transform: scale(0.4) rotate(-12deg); opacity: 0; }
  60% { transform: scale(1.15) rotate(-6deg); opacity: 1; }
  100% { transform: scale(1) rotate(-4deg); opacity: 1; }
}
.rp-stamp { animation: rp-stamp 320ms ease-out; }

.pixelated { image-rendering: pixelated; }

@media (prefers-reduced-motion: reduce) {
  .rp-cta, .rp-hover-lift { transition: none; }
  .rp-cta:hover, .rp-hover-lift:hover { transform: none; }
  .rp-stamp { animation: none; }
  .rp-scanlines::after { display: none !important; }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(design): retro arcade utilities (card/cta/pill/tag/lift/stamp) + reduced-motion"
```

---

## Task 3: Presentational primitives (StickerCard, BadgeFlag, StatusPill, GroupTag, PredictCTA)

**Files:**
- Create: `src/components/retro/sticker-card.tsx`, `badge-flag.tsx`, `status-pill.tsx`, `group-tag.tsx`, `predict-cta.tsx`

- [ ] **Step 1: StickerCard**

`src/components/retro/sticker-card.tsx`:

```tsx
import type { ReactNode } from 'react';

export function StickerCard({
  children, className = '', hover = false, as: Tag = 'div',
}: {
  children: ReactNode; className?: string; hover?: boolean;
  as?: 'div' | 'section' | 'article';
}) {
  return (
    <Tag className={`rp-card p-4 ${hover ? 'rp-hover-lift' : ''} ${className}`}>
      {children}
    </Tag>
  );
}
```

- [ ] **Step 2: BadgeFlag**

`src/components/retro/badge-flag.tsx`:

```tsx
const SIZES = { sm: 'w-8 h-8 text-sm', md: 'w-11 h-11 text-xl', lg: 'w-[74px] h-[74px] text-4xl' } as const;

export function BadgeFlag({
  flag, code, size = 'md',
}: { flag: string | null; code: string; size?: keyof typeof SIZES }) {
  return (
    <span
      role="img"
      aria-label={code}
      className={`${SIZES[size]} inline-flex items-center justify-center rounded-full border-[3px] border-ink bg-gold rp-shadow-sm`}
    >
      {flag ?? code}
    </span>
  );
}
```

- [ ] **Step 3: StatusPill**

`src/components/retro/status-pill.tsx`:

```tsx
export function StatusPill({
  predicted, total,
}: { predicted: number; total: number }) {
  const done = predicted >= total && total > 0;
  return (
    <div className={`rp-pill text-center text-base ${done ? 'bg-pitch-light' : ''}`}>
      {done ? `✓ ${predicted}/${total} predicted` : `▶ predict ${total - predicted}`}
    </div>
  );
}
```

- [ ] **Step 4: GroupTag**

`src/components/retro/group-tag.tsx`:

```tsx
export function GroupTag({ children }: { children: React.ReactNode }) {
  return <span className="rp-tag inline-block">{children}</span>;
}
```

- [ ] **Step 5: PredictCTA**

`src/components/retro/predict-cta.tsx`:

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function PredictCTA({
  children, className = '', ...rest
}: { children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`rp-cta px-5 py-3 disabled:opacity-60 cursor-pointer ${className}`} {...rest}>
      {children}
    </button>
  );
}
```

- [ ] **Step 6: Verify typecheck/build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/retro/sticker-card.tsx src/components/retro/badge-flag.tsx src/components/retro/status-pill.tsx src/components/retro/group-tag.tsx src/components/retro/predict-cta.tsx
git commit -m "feat(retro): StickerCard, BadgeFlag, StatusPill, GroupTag, PredictCTA primitives"
```

---

## Task 4: PixelCountdown (re-skin the existing countdown)

**Files:**
- Create: `src/components/retro/pixel-countdown.tsx`
- Modify: `src/components/countdown.tsx`

- [ ] **Step 1: PixelCountdown component**

`src/components/retro/pixel-countdown.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { timeRemaining, type Remaining } from '@/lib/local-time';

function Box({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-pitch rounded-lg px-3 py-2 rp-shadow-sm text-center min-w-[58px]">
      <span className="block font-pixel text-3xl leading-none text-gold tabular-nums">
        {String(value).padStart(2, '0')}
      </span>
      <span className="font-pixel text-xs text-cream/80 uppercase">{label}</span>
    </div>
  );
}

/** Live-ticking countdown. Mount-guard keeps SSR/CSR HTML identical. */
export function PixelCountdown({ target }: { target: Date | string }) {
  const ms = typeof target === 'string' ? new Date(target).getTime() : target.getTime();
  const [r, setR] = useState<Remaining | null>(null);

  useEffect(() => {
    const tick = () => setR(timeRemaining(new Date(ms), new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [ms]);

  if (!r) return <div className="text-center text-cream/70" suppressHydrationWarning>—</div>;
  if (r.done) {
    return <div className="text-center font-display text-2xl text-gold">The tournament is live!</div>;
  }
  return (
    <div className="flex gap-2 justify-center" suppressHydrationWarning>
      <Box value={r.days} label="Days" />
      <Box value={r.hours} label="Hrs" />
      <Box value={r.minutes} label="Min" />
      <Box value={r.seconds} label="Sec" />
    </div>
  );
}
```

- [ ] **Step 2: Re-point the old Countdown to the new one**

Replace the entire body of `src/components/countdown.tsx` with a re-export so existing imports keep working:

```tsx
export { PixelCountdown as Countdown } from '@/components/retro/pixel-countdown';
```

- [ ] **Step 3: Verify existing countdown tests still pass + build**

Run: `npm test -- src/lib/local-time.test.ts && npx tsc --noEmit`
Expected: PASS (timeRemaining logic unchanged), no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/retro/pixel-countdown.tsx src/components/countdown.tsx
git commit -m "feat(retro): PixelCountdown digit boxes; alias old Countdown to it"
```

---

## Task 5: ScoreStepper + QuickScorelineChips

**Files:**
- Create: `src/components/retro/score-stepper.tsx`

- [ ] **Step 1: Component**

`src/components/retro/score-stepper.tsx`:

```tsx
'use client';
import { ChevronUp, ChevronDown } from 'lucide-react';

export const QUICK_SCORELINES: Array<[number, number]> = [[1, 0], [2, 1], [0, 0], [1, 1], [3, 0]];

export function ScoreStepper({
  value, onChange, label,
}: { value: number; onChange: (v: number) => void; label: string }) {
  const clamp = (n: number) => Math.max(0, Math.min(30, n));
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="font-display text-xs uppercase text-pitch/70">{label}</span>
      <button
        aria-label={`Increase ${label} score`}
        onClick={() => onChange(clamp(value + 1))}
        className="w-11 h-9 bg-pitch text-gold rounded-lg rp-shadow-sm flex items-center justify-center cursor-pointer"
      >
        <ChevronUp size={20} />
      </button>
      <span className="w-16 h-16 rp-card flex items-center justify-center font-pixel text-5xl leading-none">
        {value}
      </span>
      <button
        aria-label={`Decrease ${label} score`}
        onClick={() => onChange(clamp(value - 1))}
        className="w-11 h-9 bg-pitch text-gold rounded-lg rp-shadow-sm flex items-center justify-center cursor-pointer"
      >
        <ChevronDown size={20} />
      </button>
    </div>
  );
}

export function QuickScorelineChips({
  home, away, onPick,
}: { home: number; away: number; onPick: (h: number, a: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {QUICK_SCORELINES.map(([h, a]) => {
        const sel = home === h && away === a;
        return (
          <button
            key={`${h}-${a}`}
            onClick={() => onPick(h, a)}
            className={`font-pixel text-lg border-[3px] border-pitch rounded-full px-3.5 py-0.5 rp-shadow-sm cursor-pointer ${sel ? 'bg-gold' : 'bg-cream'}`}
          >
            {h}-{a}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/retro/score-stepper.tsx
git commit -m "feat(retro): ScoreStepper + QuickScorelineChips"
```

---

## Task 6: PixelAvatar + deterministic sprite (TDD)

**Files:**
- Create: `src/components/retro/sprite.ts`, `src/components/retro/sprite.test.ts`, `src/components/retro/pixel-avatar.tsx`

- [ ] **Step 1: Write failing sprite test**

`src/components/retro/sprite.test.ts`:

```ts
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
```

- [ ] **Step 2: Run — verify fail**

Run: `npm test -- src/components/retro/sprite.test.ts`
Expected: FAIL ("Cannot find module './sprite'").

- [ ] **Step 3: Implement sprite.ts**

`src/components/retro/sprite.ts`:

```ts
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
```

- [ ] **Step 4: Run — verify pass**

Run: `npm test -- src/components/retro/sprite.test.ts`
Expected: PASS (all 5).

- [ ] **Step 5: Implement PixelAvatar component**

`src/components/retro/pixel-avatar.tsx`:

```tsx
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
```

> Note: real squad photos are not yet seeded (the `photoUrl` path is exercised once squads are imported). The sprite fallback is the default today.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npm test -- src/components/retro/sprite.test.ts`
Expected: no type errors, tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/retro/sprite.ts src/components/retro/sprite.test.ts src/components/retro/pixel-avatar.tsx
git commit -m "feat(retro): PixelAvatar with deterministic sprite fallback (TDD)"
```

---

## Task 7: Sound — shouldPlaySfx (TDD), useSfx, SoundToggle

**Files:**
- Create: `src/lib/sfx.ts`, `src/lib/sfx.test.ts`, `src/components/retro/sound-toggle.tsx`

- [ ] **Step 1: Write failing test**

`src/lib/sfx.test.ts`:

```ts
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
```

- [ ] **Step 2: Run — verify fail**

Run: `npm test -- src/lib/sfx.test.ts`
Expected: FAIL ("Cannot find module './sfx'").

- [ ] **Step 3: Implement sfx.ts**

`src/lib/sfx.ts`:

```ts
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
```

- [ ] **Step 4: Run — verify pass**

Run: `npm test -- src/lib/sfx.test.ts`
Expected: PASS (3).

- [ ] **Step 5: Implement SoundToggle + useSfx**

`src/components/retro/sound-toggle.tsx`:

```tsx
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
```

- [ ] **Step 6: Wrap the app in SfxProvider**

In `src/components/app-shell.tsx`, wrap the returned tree. Replace the `return (...)` with:

```tsx
  return (
    <SfxProvider>
      <div className="min-h-dvh">
        <Nav isAdmin={isAdminEmail(user?.email)} signedIn={!!user} />
        <main className="mx-auto max-w-3xl p-4">{children}</main>
      </div>
    </SfxProvider>
  );
```

Add the import at the top: `import { SfxProvider } from '@/components/retro/sound-toggle';`

- [ ] **Step 7: Verify**

Run: `npm test -- src/lib/sfx.test.ts && npx tsc --noEmit`
Expected: tests PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/sfx.ts src/lib/sfx.test.ts src/components/retro/sound-toggle.tsx src/components/app-shell.tsx
git commit -m "feat(retro): opt-in 8-bit SFX (shouldPlaySfx TDD) + SoundToggle/SfxProvider"
```

---

## Task 8: Pure board/social selectors (TDD)

**Files:**
- Create: `src/lib/board.ts`, `src/lib/board.test.ts`

These are the pure functions the homepage and match page rely on. DB wrappers come in Task 9–10.

- [ ] **Step 1: Write failing tests**

`src/lib/board.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildGroupBoard, buildRankStrip, pickNextUnpredicted, aggregatePredictions } from './board';
import type { FixtureMatch } from './fixtures';

type TeamLite = { id: string; code: string; name: string; flag: string | null; groupName: string | null };

const team = (id: string, group: string | null): TeamLite =>
  ({ id, code: id.toUpperCase(), name: id, flag: '\u{1F3F3}', groupName: group });

const mk = (id: string, group: string | null, home: string | null, away: string | null,
  predicted: boolean): FixtureMatch => ({
  id, externalId: id, stage: 'group', groupName: group,
  kickoffAt: new Date('2026-06-11T20:00:00Z'), status: 'scheduled',
  home: home ? { id: home, code: home, name: home, flag: null } : null,
  away: away ? { id: away, code: away, name: away, flag: null } : null,
  venue: null, homeScore: null, awayScore: null,
  prediction: predicted ? { homeScore: 1, awayScore: 0, pointsAwarded: null } : null,
  locked: false,
});

describe('buildGroupBoard', () => {
  it('groups teams by name and counts predicted matches per group', () => {
    const teams = [team('a1', 'A'), team('a2', 'A'), team('b1', 'B'), team('x', null)];
    const fixtures = [mk('m1', 'A', 'a1', 'a2', true), mk('m2', 'A', 'a1', 'a2', false), mk('m3', 'B', 'b1', 'b1', false)];
    const board = buildGroupBoard(teams, fixtures);
    expect(board.map((g) => g.groupName)).toEqual(['A', 'B']);
    expect(board[0].teams).toHaveLength(2);
    expect(board[0]).toMatchObject({ predicted: 1, total: 2 });
    expect(board[1]).toMatchObject({ predicted: 0, total: 1 });
  });
});

describe('buildRankStrip', () => {
  it('sums awarded points and counts unpredicted matches', () => {
    const fixtures = [
      { ...mk('m1', 'A', 'a', 'b', true), prediction: { homeScore: 1, awayScore: 0, pointsAwarded: 3 } },
      mk('m2', 'A', 'a', 'b', false),
      mk('m3', 'A', 'a', 'b', false),
    ];
    expect(buildRankStrip(fixtures)).toEqual({ points: 3, predicted: 1, matchesLeft: 2, total: 3 });
  });
});

describe('pickNextUnpredicted', () => {
  it('returns the first unpredicted match after the given id', () => {
    const fixtures = [mk('m1', 'A', 'a', 'b', true), mk('m2', 'A', 'a', 'b', false), mk('m3', 'A', 'a', 'b', false)];
    expect(pickNextUnpredicted(fixtures, 'm1')?.id).toBe('m2');
  });
  it('wraps around to the earliest unpredicted match', () => {
    const fixtures = [mk('m1', 'A', 'a', 'b', false), mk('m2', 'A', 'a', 'b', true)];
    expect(pickNextUnpredicted(fixtures, 'm2')?.id).toBe('m1');
  });
  it('returns null when everything is predicted', () => {
    const fixtures = [mk('m1', 'A', 'a', 'b', true), mk('m2', 'A', 'a', 'b', true)];
    expect(pickNextUnpredicted(fixtures, 'm1')).toBeNull();
  });
});

describe('aggregatePredictions', () => {
  it('computes home/draw/away percentages and rounds', () => {
    const rows = [
      { homeScore: 2, awayScore: 1 }, { homeScore: 1, awayScore: 0 },
      { homeScore: 1, awayScore: 1 }, { homeScore: 0, awayScore: 2 },
    ];
    expect(aggregatePredictions(rows)).toEqual({ total: 4, homeWin: 50, draw: 25, awayWin: 25 });
  });
  it('is all-zero for no rows', () => {
    expect(aggregatePredictions([])).toEqual({ total: 0, homeWin: 0, draw: 0, awayWin: 0 });
  });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `npm test -- src/lib/board.test.ts`
Expected: FAIL ("Cannot find module './board'").

- [ ] **Step 3: Implement board.ts**

`src/lib/board.ts`:

```ts
import type { FixtureMatch } from './fixtures';

export type BoardTeam = { id: string; code: string; name: string; flag: string | null; groupName: string | null };
export type GroupBoardEntry = { groupName: string; teams: BoardTeam[]; predicted: number; total: number };

/** Builds the homepage group board: 12 groups, each with its teams + predicted/total match counts. */
export function buildGroupBoard(teams: BoardTeam[], fixtures: FixtureMatch[]): GroupBoardEntry[] {
  const byGroup = new Map<string, GroupBoardEntry>();
  for (const t of teams) {
    if (!t.groupName) continue;
    if (!byGroup.has(t.groupName)) {
      byGroup.set(t.groupName, { groupName: t.groupName, teams: [], predicted: 0, total: 0 });
    }
    byGroup.get(t.groupName)!.teams.push(t);
  }
  for (const m of fixtures) {
    if (m.stage !== 'group' || !m.groupName) continue;
    const g = byGroup.get(m.groupName);
    if (!g) continue;
    g.total += 1;
    if (m.prediction) g.predicted += 1;
  }
  return [...byGroup.values()].sort((a, b) => a.groupName.localeCompare(b.groupName));
}

export type RankStrip = { points: number; predicted: number; matchesLeft: number; total: number };

/** Personal status from the user's fixtures (with predictions merged in). */
export function buildRankStrip(fixtures: FixtureMatch[]): RankStrip {
  let points = 0, predicted = 0;
  for (const m of fixtures) {
    if (m.prediction) {
      predicted += 1;
      points += m.prediction.pointsAwarded ?? 0;
    }
  }
  return { points, predicted, matchesLeft: fixtures.length - predicted, total: fixtures.length };
}

/** First unpredicted match strictly after `afterId`, wrapping to the start. Null if all predicted. */
export function pickNextUnpredicted(fixtures: FixtureMatch[], afterId: string): FixtureMatch | null {
  const idx = fixtures.findIndex((m) => m.id === afterId);
  const ordered = idx >= 0 ? [...fixtures.slice(idx + 1), ...fixtures.slice(0, idx + 1)] : fixtures;
  return ordered.find((m) => !m.prediction) ?? null;
}

export type PredictionRow = { homeScore: number; awayScore: number };
export type Aggregate = { total: number; homeWin: number; draw: number; awayWin: number };

/** Outcome split (%) across everyone's predictions for one match. */
export function aggregatePredictions(rows: PredictionRow[]): Aggregate {
  const total = rows.length;
  if (total === 0) return { total: 0, homeWin: 0, draw: 0, awayWin: 0 };
  let h = 0, d = 0, a = 0;
  for (const r of rows) {
    if (r.homeScore > r.awayScore) h++;
    else if (r.homeScore < r.awayScore) a++;
    else d++;
  }
  const pct = (n: number) => Math.round((n / total) * 100);
  return { total, homeWin: pct(h), draw: pct(d), awayWin: pct(a) };
}
```

- [ ] **Step 4: Run — verify pass**

Run: `npm test -- src/lib/board.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/lib/board.ts src/lib/board.test.ts
git commit -m "feat(lib): pure board/social selectors — group board, rank strip, next-unpredicted, aggregate (TDD)"
```

---

## Task 9: Game-board homepage

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/home/group-board.tsx`, `src/components/home/stadium-row.tsx`, `src/components/home/rank-strip.tsx`, `src/components/home/bracket-teaser.tsx`

- [ ] **Step 1: GroupBoard**

`src/components/home/group-board.tsx`:

```tsx
import Link from 'next/link';
import { StickerCard } from '@/components/retro/sticker-card';
import { BadgeFlag } from '@/components/retro/badge-flag';
import { GroupTag } from '@/components/retro/group-tag';
import { StatusPill } from '@/components/retro/status-pill';
import type { GroupBoardEntry } from '@/lib/board';

export function GroupBoard({ groups }: { groups: GroupBoardEntry[] }) {
  return (
    <section>
      <h2 className="text-cream text-lg mb-3" style={{ textShadow: '2px 2px 0 #06231a' }}>Group Stage</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {groups.map((g) => (
          <Link key={g.groupName} href={`/fixtures?stage=group&group=${g.groupName}`}>
            <StickerCard hover className="p-3">
              <div className="flex items-center justify-between mb-2">
                <GroupTag>Group {g.groupName}</GroupTag>
                <span className="font-pixel text-sm text-pitch/50">{g.teams.length} teams</span>
              </div>
              <ul className="space-y-1">
                {g.teams.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 font-pixel text-lg">
                    <BadgeFlag flag={t.flag} code={t.code} size="sm" /> {t.code}
                  </li>
                ))}
              </ul>
              <div className="mt-2"><StatusPill predicted={g.predicted} total={g.total} /></div>
            </StickerCard>
          </Link>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: StadiumRow**

`src/components/home/stadium-row.tsx`:

```tsx
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
```

- [ ] **Step 3: RankStrip**

`src/components/home/rank-strip.tsx`:

```tsx
import { StickerCard } from '@/components/retro/sticker-card';
import type { RankStrip as RankData } from '@/lib/board';

export function RankStrip({ data }: { data: RankData }) {
  const cells = [
    { label: 'Rank', value: 'soon' },
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
```

> "Rank" shows `soon` until Phase 4 leaderboard lands (per spec graceful-degradation note).

- [ ] **Step 4: BracketTeaser**

`src/components/home/bracket-teaser.tsx`:

```tsx
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
        <Link href="/fixtures?stage=r16" className="rp-cta inline-block px-5 py-3">Build your bracket</Link>
      </StickerCard>
    </section>
  );
}
```

> Bracket CTA links to the fixtures knockout view for now; it will point at `/bracket` when Phase 4 ships that route.

- [ ] **Step 5: Rebuild the homepage**

Replace `src/app/page.tsx` entirely:

```tsx
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getFixtures } from '@/lib/fixtures';
import { getUserPredictionMap } from '@/lib/predictions';
import { buildGroupBoard, buildRankStrip } from '@/lib/board';
import { db } from '@/db';
import { teams as teamsTable, venues as venuesTable } from '@/db/schema';
import { Countdown } from '@/components/countdown';
import { GroupBoard } from '@/components/home/group-board';
import { StadiumRow } from '@/components/home/stadium-row';
import { RankStrip } from '@/components/home/rank-strip';
import { BracketTeaser } from '@/components/home/bracket-teaser';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const predictionMap = user ? await getUserPredictionMap(user.id) : undefined;

  const [fixtures, teamRows, venueRows] = await Promise.all([
    getFixtures(predictionMap),
    db.select().from(teamsTable),
    db.select().from(venuesTable),
  ]);

  const first = fixtures[0];
  const groups = buildGroupBoard(
    teamRows.map((t) => ({ id: t.id, code: t.code, name: t.name, flag: t.flag, groupName: t.groupName })),
    fixtures,
  );
  const stadiums = venueRows.map((v) => ({ name: v.name, city: v.city }));

  return (
    <div className="flex flex-col gap-6">
      <StickerCard className="text-center rp-scanlines">
        <h1 className="text-3xl text-pitch">World Cup 2026</h1>
        <p className="font-pixel text-xl text-pitch/70 mt-1 mb-4">predict every match · build your bracket · win the prize</p>
        {first ? <Countdown target={first.kickoffAt} /> : null}
        <div className="mt-4">
          <Link href="/fixtures" className="rp-cta inline-block px-6 py-3">Start predicting</Link>
        </div>
      </StickerCard>

      {user && predictionMap ? <RankStrip data={buildRankStrip(fixtures)} /> : null}

      <GroupBoard groups={groups} />
      <StadiumRow stadiums={stadiums} />
      <BracketTeaser />
    </div>
  );
}
```

Add the missing import for `StickerCard` at the top: `import { StickerCard } from '@/components/retro/sticker-card';`

- [ ] **Step 6: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: succeeds; `/` renders.

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx src/components/home
git commit -m "feat(home): game-board homepage — hero, rank strip, groups, stadiums, bracket teaser"
```

---

## Task 10: `/match/[id]` predict page + reveal-after-lock + next-match

**Files:**
- Create: `src/lib/match-social.ts`
- Create: `src/app/match/[id]/actions.ts`
- Create: `src/app/match/[id]/page.tsx`
- Create: `src/components/match/predict-panel.tsx`

- [ ] **Step 1: DB readers (compose the pure selectors)**

`src/lib/match-social.ts`:

```ts
import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/db';
import { matchPredictions } from '@/db/schema';
import { aggregatePredictions, pickNextUnpredicted, type Aggregate } from './board';
import { getFixtures } from './fixtures';
import { getUserPredictionMap } from './predictions';

/** Outcome split across OTHER users' predictions for a match. Caller must gate on the viewer being locked in. */
export async function getMatchPredictionAggregate(matchId: string, excludeUserId: string): Promise<Aggregate> {
  const rows = await db
    .select({ homeScore: matchPredictions.homeScore, awayScore: matchPredictions.awayScore })
    .from(matchPredictions)
    .where(and(eq(matchPredictions.matchId, matchId), ne(matchPredictions.userId, excludeUserId)));
  return aggregatePredictions(rows);
}

/** The user's next unpredicted fixture after `afterId` (wraps). Null if none. */
export async function getNextUnpredictedMatch(userId: string, afterId: string): Promise<string | null> {
  const map = await getUserPredictionMap(userId);
  const fixtures = await getFixtures(map);
  return pickNextUnpredicted(fixtures, afterId)?.id ?? null;
}
```

- [ ] **Step 2: Reuse the existing save action**

The existing `savePrediction(matchId, home, away)` in `src/app/fixtures/actions.ts` already enforces auth + lock. Add a sibling action that also returns the aggregate (revealed only post-save) and the next match.

`src/app/match/[id]/actions.ts`:

```ts
'use server';
import { createClient } from '@/lib/supabase/server';
import { savePrediction } from '@/app/fixtures/actions';
import { getMatchPredictionAggregate, getNextUnpredictedMatch } from '@/lib/match-social';
import type { Aggregate } from '@/lib/board';

export type LockResult =
  | { ok: false; error: string }
  | { ok: true; aggregate: Aggregate; nextMatchId: string | null };

export async function lockPrediction(matchId: string, home: number, away: number): Promise<LockResult> {
  const res = await savePrediction(matchId, home, away);
  if (!res.ok) return { ok: false, error: res.error ?? 'Could not save.' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const [aggregate, nextMatchId] = await Promise.all([
    getMatchPredictionAggregate(matchId, user.id),
    getNextUnpredictedMatch(user.id, matchId),
  ]);
  return { ok: true, aggregate, nextMatchId };
}
```

- [ ] **Step 3: PredictPanel (client)**

`src/components/match/predict-panel.tsx`:

```tsx
'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { ScoreStepper, QuickScorelineChips } from '@/components/retro/score-stepper';
import { PredictCTA } from '@/components/retro/predict-cta';
import { useSfx } from '@/components/retro/sound-toggle';
import { lockPrediction, type LockResult } from '@/app/match/[id]/actions';
import type { Aggregate } from '@/lib/board';
import type { FixtureMatch } from '@/lib/fixtures';

export function PredictPanel({ match, signedIn }: { match: FixtureMatch; signedIn: boolean }) {
  const init = match.prediction;
  const [home, setHome] = useState(init?.homeScore ?? 0);
  const [away, setAway] = useState(init?.awayScore ?? 0);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  // Reveal aggregate only after the viewer has a locked pick (init present) or just saved.
  const [revealed, setRevealed] = useState<Aggregate | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const { play } = useSfx();

  if (match.locked) {
    return (
      <p className="font-pixel text-lg text-center">
        <Lock size={16} className="inline -mt-1" /> Locked — {init ? `your pick ${init.homeScore}–${init.awayScore}` : 'no pick made'}
      </p>
    );
  }
  if (!signedIn) {
    return <Link href="/auth/login" className="rp-cta block text-center px-5 py-3">Sign in to predict</Link>;
  }

  function lock() {
    setErr(null);
    start(async () => {
      const res: LockResult = await lockPrediction(match.id, home, away);
      if (!res.ok) { setErr(res.error); return; }
      play('lock');
      setRevealed(res.aggregate);
      setNext(res.nextMatchId);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-center gap-4">
        <ScoreStepper value={home} onChange={setHome} label={match.home?.code ?? 'Home'} />
        <span className="font-pixel text-4xl">—</span>
        <ScoreStepper value={away} onChange={setAway} label={match.away?.code ?? 'Away'} />
      </div>
      <QuickScorelineChips home={home} away={away} onPick={(h, a) => { setHome(h); setAway(a); }} />
      <PredictCTA onClick={lock} disabled={pending} className="w-full">
        {pending ? 'Locking…' : revealed ? 'Update pick' : 'Lock in my pick'}
      </PredictCTA>
      {err && <p className="text-center font-pixel text-alert text-lg">{err}</p>}

      {revealed && (
        <div className="rp-stamp">
          <p className="font-pixel text-base text-pitch/70 mb-1">How the circle predicted ({revealed.total})</p>
          <Bar label={`${match.home?.code ?? 'Home'} win`} pct={revealed.homeWin} />
          <Bar label="Draw" pct={revealed.draw} />
          <Bar label={`${match.away?.code ?? 'Away'} win`} pct={revealed.awayWin} />
          {next && (
            <Link href={`/match/${next}`} className="rp-cta block text-center px-5 py-3 mt-3 bg-pitch">
              Next unpredicted match
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function Bar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="mb-1">
      <div className="flex justify-between font-pixel text-base"><span>{label}</span><span>{pct}%</span></div>
      <div className="h-3 bg-pitch-light border-2 border-pitch rounded-full overflow-hidden">
        <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: The page (server)**

`src/app/match/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getFixtures } from '@/lib/fixtures';
import { getUserPredictionMap } from '@/lib/predictions';
import { getScoringConfig } from '@/lib/app-settings';
import { StickerCard } from '@/components/retro/sticker-card';
import { BadgeFlag } from '@/components/retro/badge-flag';
import { GroupTag } from '@/components/retro/group-tag';
import { LocalTime } from '@/components/local-time';
import { PredictPanel } from '@/components/match/predict-panel';

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const predictionMap = user ? await getUserPredictionMap(user.id) : undefined;

  const fixtures = await getFixtures(predictionMap);
  const match = fixtures.find((m) => m.id === id);
  if (!match) notFound();

  const cfg = await getScoringConfig();

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-4">
      <StickerCard>
        <div className="font-pixel text-base text-pitch/70 text-center flex items-center justify-center gap-2 flex-wrap">
          {match.groupName && <GroupTag>Group {match.groupName}</GroupTag>}
          {match.venue?.name && <span>{match.venue.name}</span>}
          <span className="text-alert"><LocalTime date={match.kickoffAt} format="datetime" /></span>
        </div>

        <div className="flex items-center justify-around my-4">
          <div className="text-center">
            <BadgeFlag flag={match.home?.flag ?? null} code={match.home?.code ?? 'TBD'} size="lg" />
            <div className="font-display text-base mt-2">{match.home?.name ?? 'TBD'}</div>
          </div>
          <span className="font-pixel text-2xl text-alert">VS</span>
          <div className="text-center">
            <BadgeFlag flag={match.away?.flag ?? null} code={match.away?.code ?? 'TBD'} size="lg" />
            <div className="font-display text-base mt-2">{match.away?.name ?? 'TBD'}</div>
          </div>
        </div>

        <PredictPanel match={match} signedIn={!!user} />
        <p className="text-center font-pixel text-base text-pitch/60 mt-3">
          exact score +{cfg.ptsExact} · correct result +{cfg.ptsResult}
        </p>
      </StickerCard>

      <Link href="/fixtures" className="text-center font-pixel text-lg text-cream underline">← all fixtures</Link>
    </div>
  );
}
```

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: succeeds; `/match/<id>` renders.

- [ ] **Step 6: Commit**

```bash
git add src/lib/match-social.ts src/app/match src/components/match
git commit -m "feat(match): /match/[id] predict page — steppers, reveal-circle-after-lock, next-match loop"
```

---

## Task 11: `/team/[code]` and `/player/[id]`

**Files:**
- Create: `src/lib/teams.ts`
- Create: `src/app/team/[code]/page.tsx`
- Create: `src/app/player/[id]/page.tsx`

- [ ] **Step 1: DB readers**

`src/lib/teams.ts`:

```ts
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { teams, players } from '@/db/schema';

export async function getTeamWithSquad(code: string) {
  const [team] = await db.select().from(teams).where(eq(teams.code, code));
  if (!team) return null;
  const squad = await db.select().from(players).where(eq(players.teamId, team.id)).orderBy(asc(players.shirtNumber));
  return { team, squad };
}

export async function getPlayer(id: string) {
  const [player] = await db.select().from(players).where(eq(players.id, id));
  if (!player) return null;
  const [team] = await db.select().from(teams).where(eq(teams.id, player.teamId));
  return { player, team: team ?? null };
}
```

- [ ] **Step 2: Team page**

`src/app/team/[code]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTeamWithSquad } from '@/lib/teams';
import { StickerCard } from '@/components/retro/sticker-card';
import { BadgeFlag } from '@/components/retro/badge-flag';
import { GroupTag } from '@/components/retro/group-tag';
import { PixelAvatar } from '@/components/retro/pixel-avatar';

export default async function TeamPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const data = await getTeamWithSquad(code.toUpperCase());
  if (!data) notFound();
  const { team, squad } = data;

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <StickerCard>
        <div className="flex items-center gap-4">
          <BadgeFlag flag={team.flag} code={team.code} size="lg" />
          <div>
            <h1 className="text-2xl">{team.name}</h1>
            <p className="font-pixel text-lg text-pitch/70">
              {team.fifaRank ? `FIFA #${team.fifaRank} · ` : ''}{team.wcTitles}× champions{team.coach ? ` · ${team.coach}` : ''}
            </p>
            {team.groupName && <div className="mt-1"><GroupTag>Group {team.groupName}</GroupTag></div>}
          </div>
        </div>
      </StickerCard>

      <StickerCard>
        <h2 className="text-lg mb-3">Squad</h2>
        {squad.length === 0 ? (
          <p className="font-pixel text-lg text-pitch/60">Squad to be announced.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
            {squad.map((p) => (
              <Link key={p.id} href={`/player/${p.id}`} className="text-center cursor-pointer">
                <PixelAvatar name={p.name} photoUrl={p.photoUrl} position={p.position} shirtNumber={p.shirtNumber} />
                <div className="font-pixel text-base mt-1 leading-tight">{p.name}</div>
              </Link>
            ))}
          </div>
        )}
      </StickerCard>
    </div>
  );
}
```

- [ ] **Step 3: Player page**

`src/app/player/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPlayer } from '@/lib/teams';
import { StickerCard } from '@/components/retro/sticker-card';
import { PixelAvatar } from '@/components/retro/pixel-avatar';

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getPlayer(id);
  if (!data) notFound();
  const { player, team } = data;

  return (
    <div className="max-w-md mx-auto flex flex-col gap-4">
      <StickerCard>
        <div className="flex items-center gap-4">
          <PixelAvatar name={player.name} photoUrl={player.photoUrl} position={player.position} shirtNumber={player.shirtNumber} size="lg" />
          <div>
            <h1 className="text-xl">{player.name}</h1>
            <p className="font-pixel text-lg text-pitch/70 leading-tight">
              {player.position ?? '—'} · #{player.shirtNumber ?? '—'}{player.club ? ` · ${player.club}` : ''}<br />
              {player.age ? `Age ${player.age}` : ''}{player.caps != null ? ` · ${player.caps} caps` : ''}
            </p>
          </div>
        </div>
        {player.goldenBootEligible && (
          <button className="rp-tag mt-4 inline-block cursor-pointer">★ Pick for Golden Boot</button>
        )}
      </StickerCard>
      {team && <Link href={`/team/${team.code}`} className="text-center font-pixel text-lg text-cream underline">← {team.name}</Link>}
    </div>
  );
}
```

> The Golden Boot / Best Player pick wiring to `award_predictions` is Phase-4/5 scope; here the button is the entry point (no-op until award actions exist). This matches the spec's "hook here" intent without duplicating award logic.

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/lib/teams.ts src/app/team src/app/player
git commit -m "feat(teams): /team/[code] lineup with pixel avatars + /player/[id] card"
```

---

## Task 12: Restyle fixtures, nav, auth, onboarding, admin

**Files:**
- Modify: `src/components/fixtures/match-card.tsx`, `src/components/fixtures/prediction-card.tsx`
- Modify: `src/components/nav.tsx`
- Modify: `src/app/auth/login/*`, `src/app/onboarding/*`, `src/app/admin/*` (token/class adoption)

- [ ] **Step 1: match-card → link to /match/[id] + BadgeFlag**

Replace `src/components/fixtures/match-card.tsx`:

```tsx
import Link from 'next/link';
import type { FixtureMatch } from '@/lib/fixtures';
import { PredictionCard } from './prediction-card';
import { LocalTime } from '@/components/local-time';
import { StickerCard } from '@/components/retro/sticker-card';
import { BadgeFlag } from '@/components/retro/badge-flag';

const TBD = 'TBD';

export function MatchCard({ match, signedIn }: { match: FixtureMatch; signedIn: boolean }) {
  return (
    <StickerCard className="p-3 mb-2" hover>
      <Link href={`/match/${match.id}`} className="block">
        <div className="font-pixel text-base text-pitch/60 text-center">
          <LocalTime date={match.kickoffAt} format="datetime" /> · {match.venue?.name ?? TBD}
          {match.groupName ? ` · Group ${match.groupName}` : ''}
        </div>
        <div className="flex items-center justify-between my-2">
          <span className="flex items-center gap-2 font-display text-sm">
            {match.home ? <><BadgeFlag flag={match.home.flag} code={match.home.code} size="sm" />{match.home.code}</> : TBD}
          </span>
          <span className="font-pixel text-pitch/50">vs</span>
          <span className="flex items-center gap-2 font-display text-sm">
            {match.away ? <>{match.away.code}<BadgeFlag flag={match.away.flag} code={match.away.code} size="sm" /></> : TBD}
          </span>
        </div>
      </Link>
      <PredictionCard match={match} signedIn={signedIn} />
    </StickerCard>
  );
}
```

- [ ] **Step 2: prediction-card → reuse ScoreStepper/QuickScorelineChips/PredictCTA**

Replace the unlocked-state render in `src/components/fixtures/prediction-card.tsx`. Keep the locked + signed-out branches, but swap the bespoke `Stepper`/quick buttons/save button for the shared primitives. Replace the file's `return (...)` (the final unlocked block) and delete the local `Stepper` function and `QUICK` const:

```tsx
'use client';
import { useState, useTransition } from 'react';
import { savePrediction } from '@/app/fixtures/actions';
import type { FixtureMatch } from '@/lib/fixtures';
import { ScoreStepper, QuickScorelineChips } from '@/components/retro/score-stepper';
import { PredictCTA } from '@/components/retro/predict-cta';
import { Lock } from 'lucide-react';

export function PredictionCard({ match, signedIn }: { match: FixtureMatch; signedIn: boolean }) {
  const initial = match.prediction;
  const [home, setHome] = useState(initial?.homeScore ?? 0);
  const [away, setAway] = useState(initial?.awayScore ?? 0);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  if (match.locked) {
    return (
      <div className="font-pixel text-lg">
        {match.status === 'finished' && (
          <div className="font-display text-sm">Full time: {match.homeScore}–{match.awayScore}</div>
        )}
        {initial ? (
          <div className="flex items-center gap-2">
            <span><Lock size={14} className="inline -mt-1" /> Your pick: {initial.homeScore}–{initial.awayScore}</span>
            {initial.pointsAwarded != null && (
              <span className="bg-pitch text-gold rounded px-2 py-0.5">+{initial.pointsAwarded}</span>
            )}
          </div>
        ) : (
          <span className="text-pitch/60"><Lock size={14} className="inline -mt-1" /> Locked — no pick made</span>
        )}
      </div>
    );
  }

  if (!signedIn) return <a href="/auth/login" className="font-pixel text-lg underline">Sign in to predict</a>;

  function save() {
    setMsg(null);
    start(async () => {
      const res = await savePrediction(match.id, home, away);
      setMsg(res.ok ? 'Saved ✓' : res.error ?? 'Error');
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-center gap-3">
        <ScoreStepper value={home} onChange={setHome} label={match.home?.code ?? 'Home'} />
        <span className="font-pixel text-3xl">:</span>
        <ScoreStepper value={away} onChange={setAway} label={match.away?.code ?? 'Away'} />
      </div>
      <QuickScorelineChips home={home} away={away} onPick={(h, a) => { setHome(h); setAway(a); }} />
      <PredictCTA onClick={save} disabled={pending} className="w-full text-sm py-2">
        {pending ? 'Saving…' : 'Save pick'}
      </PredictCTA>
      {msg && <p className="text-center font-pixel text-base">{msg}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Nav — arcade bar + SoundToggle**

Replace `src/components/nav.tsx`:

```tsx
import Link from 'next/link';
import { SignOutButton } from './sign-out-button';
import { SoundToggle } from './retro/sound-toggle';

const links = [
  { href: '/fixtures', label: 'Fixtures' },
  { href: '/bracket', label: 'Bracket' },
  { href: '/leaderboard', label: 'Leaderboard' },
];

export function Nav({ isAdmin = false, signedIn = false }: { isAdmin?: boolean; signedIn?: boolean }) {
  return (
    <nav className="flex items-center gap-4 bg-pitch text-cream px-4 py-3 border-b-4 border-ink">
      <Link href="/" className="font-display text-gold">WC26</Link>
      <div className="ml-auto flex items-center gap-4 font-display text-sm">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="hover:text-gold">{l.label}</Link>
        ))}
        {isAdmin && <Link href="/admin" className="hover:text-gold">Admin</Link>}
        <SoundToggle />
        {signedIn ? <SignOutButton /> : <Link href="/auth/login" className="hover:text-gold">Sign in</Link>}
      </div>
    </nav>
  );
}
```

- [ ] **Step 4: Adopt tokens in auth/onboarding/admin**

For each page under `src/app/auth/login`, `src/app/onboarding`, and `src/app/admin`, swap ad-hoc panel markup to the system: containers use `rp-card`, primary buttons use `rp-cta` (or `<PredictCTA>`), headings inherit `font-display` automatically. Do not change logic, server actions, or admin gating — class/token changes only. Verify each route still builds and the admin gate still redirects non-admins.

Run after edits: `npm run build`
Expected: all routes compile.

- [ ] **Step 5: Verify whole suite**

Run: `npm test && npx tsc --noEmit && npm run build && npm run lint`
Expected: tests PASS, no type errors, build OK, lint clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/fixtures src/components/nav.tsx src/app/auth src/app/onboarding src/app/admin
git commit -m "feat(design): restyle fixtures/nav/auth/onboarding/admin onto the retro system; fixtures link to /match"
```

---

## Task 13: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full check**

Run: `npm test && npx tsc --noEmit && npm run build && npm run lint`
Expected: all green.

- [ ] **Step 2: Manual smoke (dev server)**

Run: `npm run dev`, then verify in a browser:
- `/` — hero countdown ticks, group board renders 12 groups, stadium row scrolls, bracket teaser shows; signed-in shows the rank strip.
- `/match/<id>` — steppers/chips work; locking reveals the circle % + "next unpredicted match"; the % is hidden before locking.
- `/team/<code>` — header + squad (or "to be announced"); `/player/<id>` card renders.
- Toggle sound in nav → lock a pick → hear the blip; with OS "reduce motion" on, no blip and no hover lift.

- [ ] **Step 3: Accessibility spot-check**

- Tab through `/match/<id>`: stepper buttons reachable, focus visible, icon-only buttons have aria-labels (verify `Increase/Decrease … score`, sound toggle label).
- Confirm no gold-on-cream text exists (gold only as fills/badges).

- [ ] **Step 4: Commit any fixes, then stop**

```bash
git add -A && git commit -m "chore(design): final verification fixes for retro arcade system"
```

> Per repo workflow: push once, after the whole phase is verified (each push to `main` auto-deploys on Vercel).

---

## Optional Task 14: Demo squads (pre-launch only)

Only do this if you want `/team` and `/player` populated before real squads exist. Adds sample players for host nations to `data/seed.json`. **Requires `npm run db:reset`, which truncates predictions** — pre-launch only, never after launch.

- [ ] Add `squad` arrays (name/position/shirtNumber/club/age/caps) to MEX/USA/CAN in `data/seed.json`.
- [ ] Run `npm run db:reset` (truncate + reseed). Confirm `/team/MEX` shows the lineup.
- [ ] Commit `data/seed.json` only: `git commit -m "chore(seed): sample host-nation squads for team/player demo"`.

---

## Self-Review

**Spec coverage:**
- Palette (ink/chalk) → Task 1. Typography (3 fonts) → Task 1. Utilities + reduced-motion → Task 2.
- Primitives: StickerCard/BadgeFlag/StatusPill/GroupTag/PredictCTA → Task 3; PixelCountdown → Task 4; ScoreStepper/QuickScorelineChips → Task 5; PixelAvatar (pixelated photo + sprite fallback) → Task 6; SoundToggle/useSfx (opt-in, reduced-motion gated) → Task 7.
- Homepage game-board (hero, rank strip, groups, stadiums, bracket) → Task 9 (selectors Task 8).
- `/match/[id]` (steppers, chips, lock countdown via existing locks, reveal-%-after-lock, next-match loop) → Task 10.
- `/team/[code]` + `/player/[id]` with award hook → Task 11.
- Restyle fixtures/nav/auth/onboarding/admin → Task 12.
- A11y/contrast/motion bar → Task 13. No schema changes (confirmed; only reads). Sound opt-in muted-by-default → Task 7.

**Placeholder scan:** No "TBD/implement later" steps; every code step has complete code. The award-pick button and bracket CTA are intentionally entry-points to Phase-4 routes, documented as such (not placeholders in this plan's scope).

**Type consistency:** `Aggregate`, `RankStrip`, `GroupBoardEntry`, `BoardTeam`, `SfxName`, `SfxState` defined once (board.ts/sfx.ts) and imported everywhere. `lockPrediction`/`savePrediction`/`getMatchPredictionAggregate`/`getNextUnpredictedMatch`/`pickNextUnpredicted`/`aggregatePredictions`/`buildGroupBoard`/`buildRankStrip`/`spriteSeed`/`spriteColors`/`shouldPlaySfx` names match across definition and use. `FixtureMatch`/`getFixtures`/`getUserPredictionMap`/`getScoringConfig` match the existing code read during planning.
