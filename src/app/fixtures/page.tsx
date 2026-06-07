import { createClient } from '@/lib/supabase/server';
import { getFixtures } from '@/lib/fixtures';
import { getUserPredictionMap } from '@/lib/predictions';
import { FixturesView } from '@/components/fixtures/fixtures-view';

export default async function FixturesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; day?: string; stage?: string }>;
}) {
  const sp = await searchParams;
  const view = sp.view === 'stage' ? 'stage' : 'day';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const predictionMap = user ? await getUserPredictionMap(user.id) : undefined;
  const matches = await getFixtures(predictionMap);

  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold text-cream">Fixtures</h1>
      <FixturesView matches={matches} initialView={view} initialDay={sp.day} initialStage={sp.stage} />
    </div>
  );
}
