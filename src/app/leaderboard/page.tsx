import { createClient } from '@/lib/supabase/server';
import { getLeaderboardData } from '@/lib/get-leaderboard';
import { getPrizeText } from '@/lib/app-settings';
import { LeaderboardView } from '@/components/leaderboard/leaderboard-view';

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; stage?: string; match?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ players, predictions, matches, bonusByUser }, prizeText] = await Promise.all([
    getLeaderboardData(),
    getPrizeText(),
  ]);

  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold text-cream">Leaderboard</h1>
      <LeaderboardView
        players={players}
        predictions={predictions}
        matches={matches}
        bonusByUser={bonusByUser}
        prizeText={prizeText}
        meId={user?.id ?? null}
        initialTab={sp.tab}
        initialStage={sp.stage}
        initialMatch={sp.match}
      />
    </div>
  );
}
