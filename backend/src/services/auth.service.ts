import jwt, { SignOptions } from 'jsonwebtoken';

import prisma from '../lib/prisma';
import { ChangePasswordInput, LoginInput, PublicUser, Role } from '../schemas/user.schema';
import { HttpError } from '../utils/http-error';
import { hashPassword, verifyPassword } from '../utils/password';

export interface AuthUser {
  id      : number;
  username: string;
  name    : string;
  role    : Role;
}

interface TokenPayload {
  sub: string;
}

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set.');
  return s;
}

// ---------------------------------------------------------------------------
// Login and token verification
// ---------------------------------------------------------------------------

export async function login({ username, password }: LoginInput): Promise<{ token: string; user: AuthUser }> {
  const user = await prisma.user.findUnique({ where: { username } });
  // Same error for unknown user, wrong password or deactivated account
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid username or password.');
  }

  const options: SignOptions = { expiresIn: (process.env.JWT_EXPIRES_IN ?? '12h') as SignOptions['expiresIn'] };
  const token = jwt.sign({ sub: String(user.id) } satisfies TokenPayload, secret(), options);
  return { token, user: { id: user.id, username: user.username, name: user.name, role: user.role } };
}

/** Verifies the token and reloads the user, so deactivated users lose access immediately. */
export async function verifyToken(token: string): Promise<AuthUser | null> {
  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, secret()) as TokenPayload;
  } catch {
    return null;
  }
  const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) } });
  if (!user || !user.active) return null;
  return { id: user.id, username: user.username, name: user.name, role: user.role };
}

export async function changePassword(userId: number, input: ChangePasswordInput): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new HttpError(400, 'WRONG_PASSWORD', 'Current password is incorrect.');
  }
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(input.newPassword) } });
}

export type { PublicUser };
