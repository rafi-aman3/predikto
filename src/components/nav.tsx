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
