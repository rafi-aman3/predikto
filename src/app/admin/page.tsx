import Link from 'next/link';

export default function AdminHome() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-serif text-2xl font-bold text-pitch">Admin</h1>
      <Link
        href="/admin/matches"
        className="rp-card p-4 font-bold text-pitch hover:bg-gold/20"
      >
        ⚽ Matches & Results →
      </Link>
      <p className="text-sm text-pitch/60">Ads and settings management arrive in later phases.</p>
    </div>
  );
}
