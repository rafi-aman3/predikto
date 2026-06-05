import Link from 'next/link';
import { StickerCard } from '@/components/retro/sticker-card';
import { BadgeFlag } from '@/components/retro/badge-flag';
import { GroupTag } from '@/components/retro/group-tag';
import { StatusPill } from '@/components/retro/status-pill';
import type { GroupBoardEntry } from '@/lib/board';

export function GroupBoard({ groups }: { groups: GroupBoardEntry[] }) {
  return (
    <section>
      <h2 className="text-cream text-lg mb-3" style={{ textShadow: '2px 2px 0 #06231a' }}>Group Stage</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {groups.map((g) => (
          <Link key={g.groupName} href={`/fixtures?stage=group&group=${g.groupName}`}>
            <StickerCard hover className="p-3">
              <div className="flex items-center justify-between mb-2">
                <GroupTag>Group {g.groupName}</GroupTag>
                <span className="font-pixel text-sm text-pitch/50">{g.teams.length} teams</span>
              </div>
              <ul className="space-y-1">
                {g.teams.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 font-pixel text-lg">
                    <BadgeFlag flag={t.flag} code={t.code} size="sm" /> {t.code}
                  </li>
                ))}
              </ul>
              <div className="mt-2"><StatusPill predicted={g.predicted} total={g.total} /></div>
            </StickerCard>
          </Link>
        ))}
      </div>
    </section>
  );
}
