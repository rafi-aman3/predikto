import Link from 'next/link';
import type { FixtureMatch } from '@/lib/fixtures';

const STAGES = [
  { key: '', label: 'All' },
  { key: 'group', label: 'Groups' },
  { key: 'r32', label: 'R32' }, { key: 'r16', label: 'R16' },
  { key: 'qf', label: 'QF' }, { key: 'sf', label: 'SF' },
  { key: 'third', label: '3rd' }, { key: 'final', label: 'Final' },
];

export function Filters({
  matches, query,
}: { matches: FixtureMatch[]; query: Record<string, string | undefined> }) {
  const groups = [...new Set(matches.map((m) => m.groupName).filter(Boolean) as string[])].sort();
  const build = (patch: Record<string, string>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v) params.set(k, v);
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    return `/fixtures?${params.toString()}`;
  };
  const chip = (label: string, href: string, on: boolean) => (
    <Link key={label + href} href={href}
      className={`border-2 border-pitch rounded px-2 py-0.5 text-xs font-bold ${on ? 'bg-gold' : 'bg-cream'}`}>{label}</Link>
  );
  return (
    <div className="flex flex-col gap-2 mb-3">
      <div className="flex flex-wrap gap-1">
        {STAGES.map((s) => chip(s.label, build({ stage: s.key }), (query.stage ?? '') === s.key))}
      </div>
      {groups.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {chip('All groups', build({ group: '' }), !query.group)}
          {groups.map((g) => chip(`Grp ${g}`, build({ group: g }), query.group === g))}
        </div>
      )}
    </div>
  );
}
