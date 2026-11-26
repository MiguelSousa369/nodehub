import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';

import prisma from '../lib/prisma';
import { ChangePasswordInput, LoginInput, PublicUser, Role } from '../schemas/user.schema';
import { audit } from '../utils/audit';
import { HttpError } from '../utils/http-error';
import { lockedFor, recordFailure, recordSuccess } from '../utils/login-throttle';
import { hashPassword, verifyPassword } from '../utils/password';

export interface AuthUser {
  id      : number;
  username: string;
  name    : string;
  role    : Role;
}

interface TokenPayload {
  sub: string;
  iat: number;   // issued at, seconds (added by jsonwebtoken)
}

/** Only HMAC-SHA256: tokens claiming any other algorithm (including "none") are rejected. */
const ALGORITHM = 'HS256';
export const MIN_SECRET_LENGTH = 32;

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < MIN_SECRET_LENGTH) throw new Error(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`);
  return s;
}

/** A real scrypt hash of a random password, computed once, to compare against for unknown users. */
let dummy: Promise<string> | null = null;
function dummyHash(): Promise<string> {
  dummy ??= hashPassword(crypto.randomBytes(16).toString('hex'));
  return dummy;
}

function signToken(userId: number): string {
  const options: SignOptions = {
    algorithm: ALGORITHM,
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '12h') as SignOptions['expiresIn'],
  };
  return jwt.sign({ sub: String(userId) }, secret(), options);
}

// ---------------------------------------------------------------------------
// Login and token verification
// ---------------------------------------------------------------------------

/** `ip` is the caller's address (per-IP lockout when nodehub runs on a server). */
export async function login({ username, password }: LoginInput, ip = ''): Promise<{ token: string; user: AuthUser }> {
  const wait = lockedFor(username, ip);
  if (wait > 0) {
    audit('login.locked', { username }, { ip });
    throw new HttpError(429, 'TOO_MANY_ATTEMPTS',
      `Too many failed sign-ins for this user. Try again in ${Math.ceil(wait / 60)} min.`);
  }

  const user = await prisma.user.findUnique({ where: { username } });
  // Always run the password hash, even for unknown users, so the response time doesn't reveal
  // which usernames exist. Same error for unknown user, wrong password or deactivated account.
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? await dummyHash());
  if (!user || !user.active || !passwordOk) {
    recordFailure(username, ip);
    audit('login.failure', { username }, { ip, reason: !user ? 'unknown user' : !user.active ? 'inactive' : 'wrong password' });
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid username or password.');
  }
  recordSuccess(username);
  audit('login.success', { id: user.id, username: user.username }, { ip });

  return { token: signToken(user.id), user: { id: user.id, username: user.username, name: user.name, role: user.role } };
}

/**
 * Verifies the token and reloads the user, so deactivated users lose access immediately, and
 * sign-ins from before the last password change stop working.
 */
export async function verifyToken(token: string): Promise<AuthUser | null> {
  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, secret(), { algorithms: [ALGORITHM] }) as TokenPayload;
  } catch {
    return null;
  }
  const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) } });
  if (!user || !user.active) return null;
  if (payload.iat < Math.floor(user.sessionsValidFrom.getTime() / 1000)) return null;
  return { id: user.id, username: user.username, name: user.name, role: user.role };
}

/**
 * Changes your own password and signs out your other dashboard sessions (another browser, a
 * forgotten tab). Returns a fresh token for the session that made the change.
 */
export async function changePassword(userId: number, input: ChangePasswordInput): Promise<{ token: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new HttpError(400, 'WRONG_PASSWORD', 'Current password is incorrect.');
  }
  await prisma.user.update({
    where: { id: userId },
    data : { passwordHash: await hashPassword(input.newPassword), sessionsValidFrom: wholeSecond(new Date()) },
  });
  audit('password.changed', { id: user.id, username: user.username });
  return { token: signToken(userId) };
}

/** JWT times have one-second resolution: round down so a token issued right after still counts. */
export function wholeSecond(date: Date): Date {
  return new Date(Math.floor(date.getTime() / 1000) * 1000);
}

export type { PublicUser };
