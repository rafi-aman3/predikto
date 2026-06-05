import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { teams, players } from '@/db/schema';

export async function getTeamWithSquad(code: string) {
  const [team] = await db.select().from(teams).where(eq(teams.code, code));
  if (!team) return null;
  const squad = await db.select().from(players).where(eq(players.teamId, team.id)).orderBy(asc(players.shirtNumber));
  return { team, squad };
}

export async function getPlayer(id: string) {
  const [player] = await db.select().from(players).where(eq(players.id, id));
  if (!player) return null;
  const [team] = await db.select().from(teams).where(eq(teams.id, player.teamId));
  return { player, team: team ?? null };
}
