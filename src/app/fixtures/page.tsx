import { createClient } from '@/lib/supabase/server';
import { getFixtures } from '@/lib/fixtures';
import { getUserPredictionMap } from '@/lib/predictions';
import { CalendarGrid } from '@/components/fixtures/calendar-grid';
import { Timeline } from '@/components/fixtures/timeline';
import { StageNav } from '@/components/fixtures/stage-nav';
import { ViewToggle } from '@/components/fixtures/view-toggle';
import { Filters } from '@/components/fixtures/filters';

export default async function FixturesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; stage?: string; group?: string }>;
}) {
  const sp = await searchParams;
  const view = sp.view ?? 'calendar';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const predictionMap = user ? await getUserPredictionMap(user.id) : undefined;

  const all = await getFixtures(predictionMap);
  const filtered = all.filter(
    (m) => (!sp.stage || m.stage === sp.stage) && (!sp.group || m.groupName === sp.group),
  );

  const query = { view, stage: sp.stage, group: sp.group };
  const signedIn = !!user;

  return (
    <div>
      <h1 className="text-2xl font-bold text-cream mb-3">Fixtures</h1>
      <ViewToggle active={view} query={query} />
      <Filters matches={all} query={query} />
      {view === 'timeline' && <Timeline matches={filtered} signedIn={signedIn} />}
      {view === 'stage' && <StageNav matches={filtered} signedIn={signedIn} />}
      {view !== 'timeline' && view !== 'stage' && <CalendarGrid matches={filtered} signedIn={signedIn} />}
    </div>
  );
}
