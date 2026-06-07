'use client';
import { useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import type { LeaderPlayer, ScoredPrediction, MatchMeta } from '@/lib/leaderboard';
import { buildHeadToHead } from '@/lib/leaderboard';
import { PixelAvatar } from '@/components/retro/pixel-avatar';
import { StickerCard } from '@/components/retro/sticker-card';

export function H2HView({
  players, predictions, matches, meId, initialVs,
}: {
  players: LeaderPlayer[];
  predictions: ScoredPrediction[];
  matches: MatchMeta[];
  meId: string | null;
  initialVs?: string;
}) {
  const me = useMemo(() => players.find((p) => p.id === meId) ?? null, [players, meId]);
  const others = useMemo(() => players.filter((p) => p.id !== meId), [players, meId]);

  const defaultVs = initialVs && others.some((p) => p.id === initialVs) ? initialVs : (others[0]?.id ?? '');
  const [vs, setVs] = useState<string>(defaultVs);
  const them = useMemo(() => players.find((p) => p.id === vs) ?? null, [players, vs]);

  const orderedIds = useMemo(() => [...matches].sort((a, b) => a.kickoffMs - b.kickoffMs).map((m) => m.id), [matches]);
  const lockedSet = useMemo(() => new Set(matches.filter((m) => m.locked).map((m) => m.id)), [matches]);
  const metaById = useMemo(() => new Map(matches.map((m) => [m.id, m])), [matches]);

  const h2h = useMemo(
    () => (me && them
      ? buildHeadToHead(me.id, them.id, orderedIds, predictions, (id) => lockedSet.has(id))
      : { rows: [], myTotal: 0, theirTotal: 0, leader: 'tie' as const }),
    [me, them, orderedIds, predictions, lockedSet],
  );

  const selectVs = (id: string) => {
    setVs(id);
    const params = new URLSearchParams(window.location.search);
    params.set('vs', id);
    window.history.replaceState(null, '', `?${params.toString()}`);
  };

  if (!me) return <p className="rp-card p-4 text-center">Sign in to compare your picks.</p>;
  if (others.length === 0 || !them) return <p className="rp-card p-4 text-center">No one else to compare with yet.</p>;

  const visibleRows = h2h.rows.filter((r) => r.myPick || r.theirPick);

  return (
    <div className="flex flex-col gap-3">
      <StickerCard className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 text-center">
            <PixelAvatar name={me.displayName ?? 'You'} photoUrl={null} position={null} shirtNumber={null} size="md" />
            <div className="mt-1 font-display text-xs text-pitch">{me.displayName ?? 'You'}</div>
            <div className="font-pixel text-2xl text-pitch">{h2h.myTotal}</div>
          </div>
          <div className="font-pixel text-base text-pitch/70">
            {h2h.leader === 'me' ? '◀ you lead' : h2h.leader === 'them' ? 'they lead ▶' : 'level'}
          </div>
          <div className="flex-1 text-center">
            <PixelAvatar name={them.displayName ?? 'Player'} photoUrl={null} position={null} shirtNumber={null} size="md" />
            <select
              value={vs}
              onChange={(e) => selectVs(e.target.value)}
              className="mt-1 max-w-full rounded border-2 border-ink bg-cream px-1 py-0.5 text-xs text-pitch font-display"
            >
              {others.map((p) => <option key={p.id} value={p.id}>{p.displayName ?? 'Player'}</option>)}
            </select>
            <div className="font-pixel text-2xl text-pitch">{h2h.theirTotal}</div>
          </div>
        </div>
      </StickerCard>

      {visibleRows.length === 0 ? (
        <p className="rp-card p-4 text-center">No comparable picks yet.</p>
      ) : (
        visibleRows.map((r) => {
          const m = metaById.get(r.matchId)!;
          return (
            <div key={r.matchId} className="rp-card flex items-center gap-2 p-2 font-display text-xs text-pitch">
              <span className={`flex-1 text-center font-pixel text-base ${r.winner === 'me' ? 'text-pitch' : 'text-pitch/50'}`}>
                {r.myPick ? `${r.myPick.home}–${r.myPick.away}` : '—'}{' '}
                {r.myPoints != null && <span className="rp-pill text-xs">+{r.myPoints}</span>}
              </span>
              <span className="shrink-0 text-center leading-tight">{m.homeCode}<br />v<br />{m.awayCode}</span>
              <span className={`flex-1 text-center font-pixel text-base ${r.winner === 'them' ? 'text-pitch' : 'text-pitch/50'}`}>
                {r.locked ? (r.theirPick ? `${r.theirPick.home}–${r.theirPick.away}` : '—') : <Lock size={12} className="inline" />}{' '}
                {r.theirPoints != null && <span className="rp-pill text-xs">+{r.theirPoints}</span>}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
