import type { FixtureMatch } from './fixtures';

export type Remaining = { days: number; hours: number; minutes: number; seconds: number; done: boolean };

/** Splits the gap between now and target into d/h/m/s. `done` once now >= target. */
export function timeRemaining(target: Date, now: Date): Remaining {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  const sec = Math.floor(ms / 1000);
  return {
    days: Math.floor(sec / 86400),
    hours: Math.floor((sec % 86400) / 3600),
    minutes: Math.floor((sec % 3600) / 60),
    seconds: sec % 60,
    done: false,
  };
}

/**
 * Local YYYY-MM-DD for a date, in the *runtime's* local timezone — the browser TZ on the
 * client, the server TZ during SSR. Inject a custom `dayKey` into `groupByLocalDate` for
 * deterministic (TZ-independent) use.
 */
export function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type LocalDateGroup = { dateKey: string; matches: FixtureMatch[] };

/**
 * Groups matches by their local calendar day (browser TZ via the default keyer),
 * sorted chronologically; matches within a day are time-sorted. `dayKey` is injectable
 * for deterministic testing.
 */
export function groupByLocalDate(
  matches: FixtureMatch[],
  dayKey: (d: Date) => string = localDayKey,
): LocalDateGroup[] {
  const byKey = new Map<string, FixtureMatch[]>();
  for (const m of matches) {
    const key = dayKey(m.kickoffAt);
    (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(m);
  }
  return [...byKey.entries()]
    .map(([dateKey, ms]) => ({
      dateKey,
      matches: ms.sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime()),
    }))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}
