import { db } from '@/db';
import { profiles } from '@/db/schema';
import { eq } from 'drizzle-orm';

/** Returns the profile row for a user id, creating an empty one if missing. */
export async function getOrCreateProfile(userId: string) {
  const existing = await db.select().from(profiles).where(eq(profiles.id, userId));
  if (existing.length) return existing[0];
  const [created] = await db.insert(profiles).values({ id: userId }).returning();
  return created;
}

export async function setDisplayName(userId: string, displayName: string) {
  await db.update(profiles).set({ displayName }).where(eq(profiles.id, userId));
}
