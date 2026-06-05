import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Wraps a team name/flag so it navigates to the team page — but only when there's a real
 * team code. Renders a plain span for TBD/placeholder slots. Never place inside another <Link>.
 */
export function TeamLink({
  code, children, className = '',
}: { code: string | null | undefined; children: ReactNode; className?: string }) {
  if (!code || code === 'TBD') {
    return <span className={className}>{children}</span>;
  }
  return (
    <Link href={`/team/${code}`} className={`cursor-pointer ${className}`}>
      {children}
    </Link>
  );
}
