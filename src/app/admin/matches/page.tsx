import { getAdminMatches, getTeamOptions, getVenueOptions } from '@/lib/admin-matches';
import { MatchRow } from '@/components/admin/match-row';

export default async function AdminMatchesPage() {
  const [matches, teamOptions, venueOptions] = await Promise.all([
    getAdminMatches(), getTeamOptions(), getVenueOptions(),
  ]);

  return (
    <div className="flex flex-col gap-3">
      <h1 className="font-serif text-2xl font-bold text-pitch">Matches & Results</h1>
      <p className="text-sm text-pitch/60">
        Enter a final score and set status to <strong>finished</strong> to score predictions.
      </p>
      <div className="flex flex-col gap-2">
        {matches.map((m) => (
          <MatchRow key={m.id} match={m} teamOptions={teamOptions} venueOptions={venueOptions} />
        ))}
      </div>
    </div>
  );
}
