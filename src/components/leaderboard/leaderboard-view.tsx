'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { LeaderPlayer, ScoredPrediction, MatchMeta } from '@/lib/leaderboard';
import { buildLeaderboard, buildMatchLeaderboard } from '@/lib/leaderboard';
import { PixelAvatar } from '@/components/retro/pixel-avatar';
import { Podium } from './podium';

type Tab = 'overall' | 'round' | 'match';

const STAGES: { key: string; label: string }[] = [
  { key: 'group', label: 'Groups' }, { key: 'r32', label: 'R32' }, { key: 'r16', label: 'R16' },
  { key: 'qf', label: 'QF' }, { key: 'sf', label: 'SF' }, { key: 'third', label: '3rd' }, { key: 'final', label: 'Final' },
];

export function LeaderboardView({
  players, predictions, matches, bonusByUser, prizeText, meId, initialTab, initialStage, initialMatch,
}: {
  players: LeaderPlayer[];
  predictions: ScoredPrediction[];
  matches: MatchMeta[];
  bonusByUser: Record<string, number>;
  prizeText: string | null;
  meId: string | null;
  initialTab?: string;
  initialStage?: string;
  initialMatch?: string;
}) {
  const stagesAvailable = useMemo(() => STAGES.filter((s) => matches.some((m) => m.stage === s.key)), [matches]);
  const lockedMatches = useMemo(
    () => matches.filter((m) => m.locked).sort((a, b) => a.kickoffMs - b.kickoffMs),
    [matches],
  );

  const [tab, setTab] = useState<Tab>(initialTab === 'round' || initialTab === 'match' ? initialTab : 'overall');
  const [stage, setStage] = useState<string>(
    initialStage && stagesAvailable.some((s) => s.key === initialStage) ? initialStage : (stagesAvailable[0]?.key ?? 'group'),
  );
  const [match, setMatch] = useState<string>(
    initialMatch && lockedMatches.some((m) => m.id === initialMatch) ? initialMatch : (lockedMatches[0]?.id ?? ''),
  );

  const sync = (patch: Record<string, string>) => {
    const params = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    window.history.replaceState(null, '', `?${params.toString()}`);
  };

  const overall = useMemo(() => buildLeaderboard(players, predictions, { bonusByUser }), [players, predictions, bonusByUser]);
  const scopeIds = useMemo(() => new Set(matches.filter((m) => m.stage === stage).map((m) => m.id)), [matches, stage]);
  const round = useMemo(() => buildLeaderboard(players, predictions, { matchIdsInScope: scopeIds }), [players, predictions, scopeIds]);
  const matchBoard = useMemo(() => (match ? buildMatchLeaderboard(match, players, predictions) : []), [match, players, predictions]);

  const rankRows = tab === 'round' ? round : overall;

  return (
    <div className="flex flex-col gap-3">
      <Podium top={overall.slice(0, 3)} prizeText={prizeText} />

      <div className="flex gap-2">
        {(['overall', 'round', 'match'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); sync({ tab: t }); }}
            className={`rounded-lg border-[3px] border-ink px-3 py-1 text-sm rp-shadow-sm font-display ${tab === t ? 'bg-gold text-pitch' : 'bg-cream text-pitch'}`}
          >
            {t === 'overall' ? 'Overall' : t === 'round' ? 'This round' : 'By match'}
          </button>
        ))}
      </div>

      {tab === 'round' && (
        <select
          value={stage}
          onChange={(e) => { setStage(e.target.value); sync({ tab: 'round', stage: e.target.value }); }}
          className="self-start rounded border-2 border-ink bg-cream px-2 py-1 text-sm text-pitch font-display"
        >
          {stagesAvailable.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      )}

      {tab === 'match' ? (
        lockedMatches.length === 0 ? (
          <p className="rp-card p-4 text-center">No matches have kicked off yet.</p>
        ) : (
          <>
            <select
              value={match}
              onChange={(e) => { setMatch(e.target.value); sync({ tab: 'match', match: e.target.value }); }}
              className="self-start rounded border-2 border-ink bg-cream px-2 py-1 text-sm text-pitch font-display"
            >
              {lockedMatches.map((m) => <option key={m.id} value={m.id}>{m.homeCode} v {m.awayCode}</option>)}
            </select>
            <div className="flex flex-col gap-1.5">
              {matchBoard.map((r) => (
                <div key={r.userId} className="rp-card flex items-center gap-2 p-2">
                  <PixelAvatar name={r.displayName ?? 'Player'} photoUrl={null} position={null} shirtNumber={null} size="sm" />
                  <span className="flex-1 truncate font-display text-xs text-pitch">{r.displayName ?? 'Player'}</span>
                  <span className="font-pixel text-base text-pitch">{r.pick ? `${r.pick.home}–${r.pick.away}` : '—'}</span>
                  {r.points != null && <span className="rp-pill text-xs">+{r.points}</span>}
                </div>
              ))}
            </div>
          </>
        )
      ) : (
        <div className="flex flex-col gap-1.5">
          {rankRows.map((r) => {
            const isMe = r.userId === meId;
            const inner = (
              <>
                <span className="w-8 text-center font-pixel text-lg text-pitch">#{r.rank}</span>
                <PixelAvatar name={r.displayName ?? 'Player'} photoUrl={null} position={null} shirtNumber={null} size="sm" />
                <span className="flex-1 truncate font-display text-xs text-pitch">{r.displayName ?? 'Player'}{isMe ? ' (you)' : ''}</span>
                <span className="font-pixel text-xs text-pitch/60">{r.predictedCount} picks</span>
                <span className="rp-pill text-sm">{r.points}</span>
              </>
            );
            return meId && !isMe ? (
              <Link key={r.userId} href={`/h2h?vs=${r.userId}`} className="rp-card rp-hover-lift flex items-center gap-2 p-2 no-underline">{inner}</Link>
            ) : (
              <div key={r.userId} className="rp-card flex items-center gap-2 p-2">{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
