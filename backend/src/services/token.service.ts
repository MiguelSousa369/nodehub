import crypto from 'crypto';

import prisma from '../lib/prisma';
import { CreateTokenInput, PublicToken } from '../schemas/token.schema';
import { Role } from '../schemas/user.schema';

// ---------------------------------------------------------------------------
// Personal access tokens: "nhk_" + 32 random bytes. Only the SHA-256 hash is stored.
// ---------------------------------------------------------------------------

export const TOKEN_PREFIX = 'nhk_';

const publicFields = { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true } as const;

function hash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function listTokens(userId: number): Promise<PublicToken[]> {
  return prisma.apiToken.findMany({ where: { userId }, select: publicFields, orderBy: { createdAt: 'desc' } });
}

/** Returns the token in clear text: the only time it is ever shown. */
export async function createToken(userId: number, { name }: CreateTokenInput): Promise<PublicToken & { token: string }> {
  const token = TOKEN_PREFIX + crypto.randomBytes(32).toString('base64url');
  const created = await prisma.apiToken.create({
    data  : { userId, name, prefix: token.slice(0, 12), tokenHash: hash(token) },
    select: publicFields,
  });
  return { ...created, token };
}

export async function revokeToken(userId: number, id: number): Promise<boolean> {
  const { count } = await prisma.apiToken.deleteMany({ where: { id, userId } });
  return count > 0;
}

/** Resolves a token to its (active) user and records when it was last used. */
export async function verifyApiToken(token: string): Promise<{ id: number; username: string; name: string; role: Role } | null> {
  const found = await prisma.apiToken.findUnique({ where: { tokenHash: hash(token) }, include: { user: true } });
  if (!found || !found.user.active) return null;

  // Update at most once a minute to avoid a write on every request
  if (!found.lastUsedAt || Date.now() - found.lastUsedAt.getTime() > 60_000) {
    await prisma.apiToken.update({ where: { id: found.id }, data: { lastUsedAt: new Date() } });
  }
  const { id, username, name, role } = found.user;
  return { id, username, name, role };
}
