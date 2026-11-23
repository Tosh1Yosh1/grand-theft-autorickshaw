/**
 * Every piece of player-facing text that might contain gaali goes through here.
 * A Line is either plain text (always clean) or a dirty/clean pair.
 */
export type Line = string | { dirty: string; clean: string };

export function resolveLine(line: Line, profanity: boolean): string {
  if (typeof line === 'string') return line;
  return profanity ? line.dirty : line.clean;
}

/** Random pick from a pool, resolved against the profanity setting. */
export function pickLine(pool: readonly Line[], profanity: boolean, rng: () => number = Math.random): string {
  if (pool.length === 0) return '...';
  return resolveLine(pool[Math.floor(rng() * pool.length)]!, profanity);
}
