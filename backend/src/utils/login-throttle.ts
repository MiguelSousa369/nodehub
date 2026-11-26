// ---------------------------------------------------------------------------
// Slows down password guessing. Wrong passwords are counted within a WINDOW_MS window:
//
//   - per username: after MAX_FAILURES, that username can't sign in until the window has passed;
//   - per IP:       after MAX_FAILURES_PER_IP, that address can't sign in at all (guessing across
//                   many usernames from one PC, when nodehub runs on a server).
//
// A correct password resets the username's count (not the IP's). Kept in memory: nodehub is a single
// process, and a restart clearing the counters is fine.
// ---------------------------------------------------------------------------

export const MAX_FAILURES        = 5;
export const MAX_FAILURES_PER_IP = 20;
export const WINDOW_MS           = 15 * 60_000;

interface Entry {
  failures: number;
  since   : number;   // time of the first failure in the current window
}

const failures = new Map<string, Entry>();

const userKey = (username: string) => `user:${username}`;
const ipKey   = (ip: string) => `ip:${ip}`;

function current(key: string, now: number): Entry | undefined {
  const entry = failures.get(key);
  if (entry && now - entry.since > WINDOW_MS) {
    failures.delete(key);
    return undefined;
  }
  return entry;
}

function secondsLeft(key: string, limit: number, now: number): number {
  const entry = current(key, now);
  if (!entry || entry.failures < limit) return 0;
  return Math.ceil((entry.since + WINDOW_MS - now) / 1000);
}

function bump(key: string, now: number): void {
  const entry = current(key, now);
  if (entry) entry.failures += 1;
  else failures.set(key, { failures: 1, since: now });
}

/** Seconds until this username (from this IP) may try again, or 0 if neither is locked. */
export function lockedFor(username: string, ip = '', now = Date.now()): number {
  return Math.max(secondsLeft(userKey(username), MAX_FAILURES, now), ip ? secondsLeft(ipKey(ip), MAX_FAILURES_PER_IP, now) : 0);
}

export function recordFailure(username: string, ip = '', now = Date.now()): void {
  bump(userKey(username), now);
  if (ip) bump(ipKey(ip), now);
}

export function recordSuccess(username: string): void {
  failures.delete(userKey(username));
}

/** Tests only. */
export function resetLoginThrottle(): void {
  failures.clear();
}
