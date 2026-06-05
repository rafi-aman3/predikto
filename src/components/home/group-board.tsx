import Link from 'next/link';
import { StickerCard } from '@/components/retro/sticker-card';
import { BadgeFlag } from '@/components/retro/badge-flag';
import { GroupTag } from '@/components/retro/group-tag';
import { StatusPill } from '@/components/retro/status-pill';
import { TeamLink } from '@/components/retro/team-link';
import type { GroupBoardEntry } from '@/lib/board';

export function GroupBoard({ groups }: { groups: GroupBoardEntry[] }) {
  return (
    <section>
      <h2 className="text-cream text-lg mb-3" style={{ textShadow: '2px 2px 0 #06231a' }}>Group Stage</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {groups.map((g) => (
          <StickerCard key={g.groupName} className="p-3">
            <div className="flex items-center justify-between mb-2">
              <Link href="/table"><GroupTag>Group {g.groupName}</GroupTag></Link>
              <span className="font-pixel text-sm text-pitch/50">{g.teams.length} teams</span>
            </div>
            <ul className="space-y-1">
              {g.teams.map((t) => (
                <li key={t.id}>
                  <TeamLink code={t.code} className="flex items-center gap-2 font-pixel text-lg">
                    <BadgeFlag flag={t.flag} code={t.code} size="sm" /> {t.code}
                  </TeamLink>
                </li>
              ))}
            </ul>
            <Link href={`/fixtures?stage=group&group=${g.groupName}`} className="block mt-2">
              <StatusPill predicted={g.predicted} total={g.total} />
            </Link>
          </StickerCard>
        ))}
      </div>
    </section>
  );
}
