import Link from 'next/link';

const VIEWS = [
  { key: 'calendar', label: '📅 Calendar' },
  { key: 'timeline', label: '📜 Timeline' },
  { key: 'stage', label: '🏆 Stages' },
];

export function ViewToggle({ active, query }: { active: string; query: Record<string, string | undefined> }) {
  const build = (view: string) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v && k !== 'view') params.set(k, v);
    params.set('view', view);
    return `/fixtures?${params.toString()}`;
  };
  return (
    <div className="flex gap-2 mb-3">
      {VIEWS.map((v) => (
        <Link
          key={v.key}
          href={build(v.key)}
          className={`border-2 border-pitch rounded-lg px-3 py-1 text-sm font-bold ${active === v.key ? 'bg-gold text-pitch' : 'bg-cream text-pitch'}`}
        >
          {v.label}
        </Link>
      ))}
    </div>
  );
}
