import Link from 'next/link';

const links = [
  { href: '/fixtures', label: 'Fixtures' },
  { href: '/bracket', label: 'Bracket' },
  { href: '/leaderboard', label: 'Leaderboard' },
];

export function Nav() {
  return (
    <nav className="flex items-center gap-4 bg-pitch text-cream px-4 py-3">
      <Link href="/" className="font-serif font-bold text-gold">
        ⚽ WC26 Predictor
      </Link>
      <div className="ml-auto flex gap-4">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="hover:text-gold">
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
