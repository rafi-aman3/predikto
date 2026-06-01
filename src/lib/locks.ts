/** A match prediction is locked once now >= kickoff. */
export function isMatchLocked(kickoffAt: Date, now: Date = new Date()): boolean {
  return now.getTime() >= kickoffAt.getTime();
}

/** Bracket + award predictions lock at the global deadline. No deadline => open. */
export function arePredictionsLocked(deadline: Date | null, now: Date = new Date()): boolean {
  if (!deadline) return false;
  return now.getTime() >= deadline.getTime();
}
