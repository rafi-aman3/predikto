'use client';
import { useState, useTransition } from 'react';
import { saveResult, saveMatchMeta } from '@/app/admin/matches/actions';
import type { AdminMatch, TeamOption, VenueOption, MatchStatus } from '@/lib/admin-matches';

const STATUSES: MatchStatus[] = ['scheduled', 'live', 'finished'];
// Format a Date as a UTC `YYYY-MM-DDTHH:mm` string for datetime-local inputs.
const toLocalInput = (d: Date) => d.toISOString().slice(0, 16);
const teamName = (id: string | null, opts: TeamOption[]) =>
  id ? (opts.find((t) => t.id === id)?.code ?? '??') : 'TBD';

export function MatchRow({
  match, teamOptions, venueOptions,
}: { match: AdminMatch; teamOptions: TeamOption[]; venueOptions: VenueOption[] }) {
  const [home, setHome] = useState<string>(match.homeScore?.toString() ?? '');
  const [away, setAway] = useState<string>(match.awayScore?.toString() ?? '');
  const [status, setStatus] = useState<MatchStatus>(match.status);
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Metadata edit state
  const [homeTeamId, setHomeTeamId] = useState(match.homeTeamId ?? '');
  const [awayTeamId, setAwayTeamId] = useState(match.awayTeamId ?? '');
  const [venueId, setVenueId] = useState(match.venueId ?? '');
  const [kickoff, setKickoff] = useState(toLocalInput(match.kickoffAt));
  const [groupName, setGroupName] = useState(match.groupName ?? '');

  const parseScore = (s: string) => (s.trim() === '' ? null : Number(s));

  function submitResult() {
    setMsg(null);
    start(async () => {
      const res = await saveResult(match.id, parseScore(home), parseScore(away), status);
      setMsg(res.ok ? 'Saved ✓' : res.error ?? 'Error');
    });
  }

  function submitMeta() {
    setMsg(null);
    start(async () => {
      const res = await saveMatchMeta(match.id, {
        homeTeamId: homeTeamId || null,
        awayTeamId: awayTeamId || null,
        venueId: venueId || null,
        kickoffAt: new Date(`${kickoff}:00Z`), // interpret input as UTC
        groupName: groupName.trim() || null,
      });
      setMsg(res.ok ? 'Details saved ✓' : res.error ?? 'Error');
      if (res.ok) setEditing(false);
    });
  }

  return (
    <div className="rp-card p-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-[10px] uppercase font-bold text-pitch/50 w-12">{match.stage}</span>
        <span className="font-bold w-28 text-right">{teamName(match.homeTeamId, teamOptions)}</span>
        <input
          aria-label="home score" inputMode="numeric" value={home}
          onChange={(e) => setHome(e.target.value)}
          className="w-10 border-2 border-pitch rounded text-center"
        />
        <span>:</span>
        <input
          aria-label="away score" inputMode="numeric" value={away}
          onChange={(e) => setAway(e.target.value)}
          className="w-10 border-2 border-pitch rounded text-center"
        />
        <span className="font-bold w-28">{teamName(match.awayTeamId, teamOptions)}</span>
        <select
          aria-label="status" value={status}
          onChange={(e) => setStatus(e.target.value as MatchStatus)}
          className="border-2 border-pitch rounded text-xs ml-auto"
        >
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button
          onClick={submitResult} disabled={pending}
          className="rp-cta px-3 py-1 text-xs disabled:opacity-60"
        >Save</button>
        <button
          onClick={() => setEditing((v) => !v)}
          className="text-xs underline text-pitch/70"
        >{editing ? 'Close' : 'Edit details'}</button>
      </div>

      {editing && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t-2 border-pitch/20 pt-3">
          <label className="flex flex-col gap-1">Home team
            <select value={homeTeamId} onChange={(e) => setHomeTeamId(e.target.value)} className="border-2 border-pitch rounded p-1">
              <option value="">TBD</option>
              {teamOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">Away team
            <select value={awayTeamId} onChange={(e) => setAwayTeamId(e.target.value)} className="border-2 border-pitch rounded p-1">
              <option value="">TBD</option>
              {teamOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">Venue
            <select value={venueId} onChange={(e) => setVenueId(e.target.value)} className="border-2 border-pitch rounded p-1">
              <option value="">None</option>
              {venueOptions.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">Group
            <input value={groupName} onChange={(e) => setGroupName(e.target.value)} className="border-2 border-pitch rounded p-1" />
          </label>
          <label className="flex flex-col gap-1 col-span-2">Kickoff (UTC)
            <input type="datetime-local" value={kickoff} onChange={(e) => setKickoff(e.target.value)} className="border-2 border-pitch rounded p-1" />
          </label>
          <button
            onClick={submitMeta} disabled={pending}
            className="col-span-2 rp-cta py-1 disabled:opacity-60"
          >Save details</button>
        </div>
      )}

      {msg && <p className="text-xs mt-1">{msg}</p>}
    </div>
  );
}
