import crypto from 'crypto';

import prisma from '../lib/prisma';
import { PublicToken } from '../schemas/token.schema';
import { Role } from '../schemas/user.schema';

// ---------------------------------------------------------------------------
// Connected PCs: one access token per PC, "nhk_" + 32 random bytes.
// Only the SHA-256 hash is stored. Tokens are issued by the browser
// authorisation flow (cli-login.service), never typed by hand.
// ---------------------------------------------------------------------------

export const TOKEN_PREFIX = 'nhk_';

const publicFields = { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true } as const;

export function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

export function listTokens(userId: number): Promise<PublicToken[]> {
  return prisma.apiToken.findMany({ where: { userId }, select: publicFields, orderBy: { createdAt: 'desc' } });
}

/**
 * Issues a token for a PC. A PC that connects again replaces its own previous token
 * (same user + same PC name), so the list doesn't fill up with duplicates.
 */
export async function issueToken(userId: number, name: string): Promise<{ token: string } & PublicToken> {
  const token = TOKEN_PREFIX + crypto.randomBytes(32).toString('base64url');
  const created = await prisma.$transaction(async (tx) => {
    await tx.apiToken.deleteMany({ where: { userId, name } });
    return tx.apiToken.create({
      data  : { userId, name, prefix: token.slice(0, 12), tokenHash: hashSecret(token) },
      select: publicFields,
    });
  });
  return { ...created, token };
}

/** Disconnects one of the user's PCs. */
export async function revokeToken(userId: number, id: number): Promise<boolean> {
  const { count } = await prisma.apiToken.deleteMany({ where: { id, userId } });
  return count > 0;
}

/** Resolves a token to its (active) user and records when it was last used. */
export async function verifyApiToken(token: string): Promise<{ id: number; username: string; name: string; role: Role } | null> {
  const found = await prisma.apiToken.findUnique({ where: { tokenHash: hashSecret(token) }, include: { user: true } });
  if (!found || !found.user.active) return null;

  // Update at most once a minute to avoid a write on every request
  if (!found.lastUsedAt || Date.now() - found.lastUsedAt.getTime() > 60_000) {
    await prisma.apiToken.update({ where: { id: found.id }, data: { lastUsedAt: new Date() } });
  }
  const { id, username, name, role } = found.user;
  return { id, username, name, role };
}
