import { createClient } from '@/lib/supabase/server';
import { getLeaderboardData } from '@/lib/get-leaderboard';
import { H2HView } from '@/components/h2h/h2h-view';

export default async function H2HPage({
  searchParams,
}: {
  searchParams: Promise<{ vs?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { players, predictions, matches } = await getLeaderboardData();

  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold text-cream">Head-to-Head</h1>
      <H2HView players={players} predictions={predictions} matches={matches} meId={user?.id ?? null} initialVs={sp.vs} />
    </div>
  );
}
