import crypto from 'crypto';

import prisma from '../lib/prisma';
import { PublicToken } from '../schemas/token.schema';
import { Role } from '../schemas/user.schema';

// ---------------------------------------------------------------------------
// Personal access token: one per user, "nhk_" + 32 random bytes.
// Only the SHA-256 hash is stored. Generating a new one replaces the old.
// ---------------------------------------------------------------------------

export const TOKEN_PREFIX = 'nhk_';

const publicFields = { prefix: true, createdAt: true, lastUsedAt: true } as const;

function hash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function getToken(userId: number): Promise<PublicToken | null> {
  return prisma.apiToken.findUnique({ where: { userId }, select: publicFields });
}

/** Creates the user's token, replacing any previous one. Returns it in clear text: the only time it is shown. */
export async function generateToken(userId: number): Promise<PublicToken & { token: string }> {
  const token = TOKEN_PREFIX + crypto.randomBytes(32).toString('base64url');
  const data = { prefix: token.slice(0, 12), tokenHash: hash(token), createdAt: new Date(), lastUsedAt: null };
  const saved = await prisma.apiToken.upsert({
    where : { userId },
    create: { userId, ...data },
    update: data,
    select: publicFields,
  });
  return { ...saved, token };
}

export async function revokeToken(userId: number): Promise<boolean> {
  const { count } = await prisma.apiToken.deleteMany({ where: { userId } });
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
