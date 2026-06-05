'use client';
import { useEffect, useState } from 'react';

type Fmt = 'time' | 'datetime' | 'dayHeader';

const OPTS: Record<Fmt, Intl.DateTimeFormatOptions> = {
  time: { hour: 'numeric', minute: '2-digit' },
  datetime: { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
  dayHeader: { weekday: 'long', month: 'long', day: 'numeric' },
};

/**
 * Renders a UTC date in the visitor's local timezone. Renders empty on the server / first
 * paint (no local TZ there) and fills in after mount, so hydration never mismatches.
 */
export function LocalTime({ date, format = 'time' }: { date: Date | string; format?: Fmt }) {
  const ms = typeof date === 'string' ? new Date(date).getTime() : date.getTime();
  const [text, setText] = useState('');
  useEffect(() => {
    // Intentional post-mount setState: browser-local time is unavailable during SSR,
    // so we fill it in after mount to avoid a hydration mismatch (no timeZone → browser local).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(Number.isNaN(ms) ? '' : new Date(ms).toLocaleString('en-US', OPTS[format]));
  }, [ms, format]);
  return <span suppressHydrationWarning>{text}</span>;
}
