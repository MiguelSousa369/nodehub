// ---------------------------------------------------------------------------
// Slows down password guessing: after MAX_FAILURES wrong passwords for a username within WINDOW_MS,
// that username can't sign in until the window has passed. A correct password resets the count.
//
// Kept in memory: nodehub is a single process on one PC, and a restart clearing the counters is fine.
// Counted per username (not per IP: every request comes from 127.0.0.1).
// ---------------------------------------------------------------------------

export const MAX_FAILURES = 5;
export const WINDOW_MS    = 15 * 60_000;

interface Entry {
  failures: number;
  since   : number;   // time of the first failure in the current window
}

const failures = new Map<string, Entry>();

function current(username: string, now: number): Entry | undefined {
  const entry = failures.get(username);
  if (entry && now - entry.since > WINDOW_MS) {
    failures.delete(username);
    return undefined;
  }
  return entry;
}

/** Seconds until this username may try again, or 0 if it isn't locked. */
export function lockedFor(username: string, now = Date.now()): number {
  const entry = current(username, now);
  if (!entry || entry.failures < MAX_FAILURES) return 0;
  return Math.ceil((entry.since + WINDOW_MS - now) / 1000);
}

export function recordFailure(username: string, now = Date.now()): void {
  const entry = current(username, now);
  if (entry) entry.failures += 1;
  else failures.set(username, { failures: 1, since: now });
}

export function recordSuccess(username: string): void {
  failures.delete(username);
}

/** Tests only. */
export function resetLoginThrottle(): void {
  failures.clear();
}
