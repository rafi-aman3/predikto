import { getFixtures } from '@/lib/fixtures';
import { db } from '@/db';
import { teams as teamsTable } from '@/db/schema';
import { computeGroupStandings } from '@/lib/standings';
import { StickerCard } from '@/components/retro/sticker-card';
import { BadgeFlag } from '@/components/retro/badge-flag';
import { GroupTag } from '@/components/retro/group-tag';
import { TeamLink } from '@/components/retro/team-link';

export default async function TablePage() {
  const [fixtures, teamRows] = await Promise.all([
    getFixtures(),
    db.select().from(teamsTable),
  ]);
  const standings = computeGroupStandings(
    teamRows.map((t) => ({ id: t.id, code: t.code, name: t.name, flag: t.flag, groupName: t.groupName })),
    fixtures,
  );

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl text-cream" style={{ textShadow: '2px 2px 0 #06231a' }}>Group Tables</h1>
      <div className="grid md:grid-cols-2 gap-4">
        {standings.map((g) => (
          <StickerCard key={g.groupName} className="p-3">
            <div className="mb-2"><GroupTag>Group {g.groupName}</GroupTag></div>
            <table className="w-full font-pixel text-base">
              <thead>
                <tr className="text-pitch/60 text-sm">
                  <th className="text-left w-6">#</th>
                  <th className="text-left">Team</th>
                  <th className="w-6 text-center">P</th>
                  <th className="w-6 text-center">W</th>
                  <th className="w-6 text-center">D</th>
                  <th className="w-6 text-center">L</th>
                  <th className="w-8 text-center">GD</th>
                  <th className="w-8 text-center">Pts</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r, i) => (
                  <tr key={r.teamId} className="border-t-2 border-pitch/20">
                    <td className="text-pitch/60">{i + 1}</td>
                    <td className="py-1">
                      <TeamLink code={r.code} className="flex items-center gap-2">
                        <BadgeFlag flag={r.flag} code={r.code} size="sm" /> {r.code}
                      </TeamLink>
                    </td>
                    <td className="text-center">{r.played}</td>
                    <td className="text-center">{r.won}</td>
                    <td className="text-center">{r.drawn}</td>
                    <td className="text-center">{r.lost}</td>
                    <td className="text-center">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                    <td className="text-center font-display text-pitch">{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </StickerCard>
        ))}
      </div>
    </div>
  );
}
