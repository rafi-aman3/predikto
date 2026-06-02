/** Parses ADMIN_EMAILS (comma-separated) into a normalized lowercase list. */
export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

/**
 * Server-only. Returns the signed-in Supabase user iff its email is allowlisted,
 * else null. Dynamically imports the server client so the pure helpers above stay
 * importable from Vitest (which can't load `next/headers` at module top-level).
 */
export async function getAdminUser() {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}
