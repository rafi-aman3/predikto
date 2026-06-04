import Link from 'next/link';
import { getFixtures } from '@/lib/fixtures';
import { Countdown } from '@/components/countdown';
import { LocalTime } from '@/components/local-time';

export default async function Home() {
  const all = await getFixtures();
  const now = Date.now();
  const first = all[0];
  const upcoming = all.filter((m) => m.kickoffAt.getTime() >= now).slice(0, 3);

  if (!first) {
    return (
      <div className="rp-card p-6 text-center">
        <h1 className="text-2xl font-bold">⚽ World Cup 2026 Predictor</h1>
        <p className="mt-2">Predict every match, build your bracket, climb the leaderboard.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rp-card p-6 text-center">
        <h1 className="font-serif text-2xl font-bold text-pitch">⚽ World Cup 2026</h1>
        <p className="mt-1 mb-4 text-pitch/70 text-sm">Kicks off with the opening match — get your picks in.</p>
        <Countdown target={first.kickoffAt} />
      </div>

      <div>
        <h2 className="font-bold text-cream mb-2">Next matches</h2>
        <div className="grid gap-2">
          {upcoming.length === 0 ? (
            <p className="rp-card p-4 text-center text-sm">No upcoming matches.</p>
          ) : (
            upcoming.map((m) => (
              <div key={m.id} className="rp-card p-3 flex items-center justify-between text-sm">
                <span className="font-bold">
                  {m.home ? m.home.code : 'TBD'} <span className="text-pitch/50">vs</span> {m.away ? m.away.code : 'TBD'}
                </span>
                <span className="text-pitch/70 text-xs">
                  <LocalTime date={m.kickoffAt} format="datetime" />
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <Link
        href="/fixtures"
        className="bg-pitch text-cream rounded-lg py-3 text-center font-bold hover:bg-pitch/90"
      >
        See all fixtures & predict →
      </Link>
    </div>
  );
}
