import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { Prisma } from '../generated/prisma/client';
import prisma from '../lib/prisma';
import { Role } from '../schemas/user.schema';
import { HttpError } from '../utils/http-error';
import logger from '../utils/logger';

// ---------------------------------------------------------------------------
// The team's SSH public keys, in the database.
//
// Each key belongs to a user account (technicians add their own) or to nobody: a "service key"
// that only admins create (e.g. for the server's own SSH test). A key is *effective* while its
// owner's account is active: only effective keys go into new installers and are applied to client
// PCs by "nodehub keys sync". Deactivating an account therefore takes its keys off every client PC
// at the next sync.
//
// Keys that used to live in public-keys/*.pub are imported once at startup (importKeyFiles).
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '../../..');

/** type, base64 key, optional comment (no quotes or line breaks: it ends up in a PowerShell string). */
export const PUBLIC_KEY_RE = /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-\S+|sk-\S+) ([A-Za-z0-9+/=]+)( [^'\r\n]*)?$/;

export interface KeyOwner {
  id      : number;
  name    : string;
  username: string;
  active  : boolean;
}

export interface PublicKeyView {
  id         : number;
  name       : string;           // label
  type       : string;
  comment    : string;
  fingerprint: string;           // SHA256:... as ssh-keygen -l shows it
  key        : string;           // full line, as written to authorized_keys
  owner      : KeyOwner | null;  // null = service key
  effective  : boolean;          // applied to client PCs (owner active, or service key)
  createdAt  : Date;
}

interface ParsedKey { type: string; body: string; comment: string; fingerprint: string }

/** Validates and splits a public key line. */
export function parseKey(text: string): ParsedKey | null {
  const line = text.trim().replace(/\s+/g, ' ');
  const match = line.match(PUBLIC_KEY_RE);
  if (!match) return null;
  const digest = crypto.createHash('sha256').update(Buffer.from(match[2], 'base64')).digest();
  return {
    type       : match[1],
    body       : `${match[1]} ${match[2]}`,
    comment    : (match[3] ?? '').trim(),
    fingerprint: `SHA256:${digest.toString('base64').replace(/=+$/, '')}`,
  };
}

const withOwner = { user: { select: { id: true, name: true, username: true, active: true } } } as const;
type KeyRow = Prisma.SshKeyGetPayload<{ include: typeof withOwner }>;

function toView(row: KeyRow): PublicKeyView {
  return {
    id         : row.id,
    name       : row.name,
    type       : row.type,
    comment    : row.comment,
    fingerprint: row.fingerprint,
    key        : row.comment ? `${row.body} ${row.comment}` : row.body,
    owner      : row.user,
    effective  : !row.user || row.user.active,
    createdAt  : row.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** All keys, service keys first, then by owner and name. */
export async function listKeys(): Promise<PublicKeyView[]> {
  const rows = await prisma.sshKey.findMany({ include: withOwner, orderBy: [{ userId: 'asc' }, { name: 'asc' }] });
  return rows.map(toView).sort((a, b) => Number(Boolean(a.owner)) - Number(Boolean(b.owner))
    || (a.owner?.name ?? '').localeCompare(b.owner?.name ?? '') || a.name.localeCompare(b.name));
}

/** The keys client PCs should accept (installer, keys sync). */
export async function effectiveKeys(): Promise<PublicKeyView[]> {
  return (await listKeys()).filter((k) => k.effective);
}

// ---------------------------------------------------------------------------
// Adding and removing
// ---------------------------------------------------------------------------

interface Actor { id: number; role: Role }

/**
 * Adds a key. Technicians always add their own; admins choose the owner (a user id, or null for a
 * service key).
 */
export async function addKey(
  input: { name: string; publicKey: string; userId?: number | null }, actor: Actor,
): Promise<PublicKeyView> {
  if (/PRIVATE KEY/.test(input.publicKey)) {
    throw new HttpError(400, 'PRIVATE_KEY', 'That is a private key. Paste the contents of the .pub file instead, and keep the private key secret.');
  }
  const parsed = parseKey(input.publicKey);
  if (!parsed) throw new HttpError(400, 'INVALID_KEY', 'Not a valid SSH public key (e.g. "ssh-ed25519 AAAA... name").');

  const userId = actor.role === 'ADMIN' && input.userId !== undefined ? input.userId : actor.id;
  if (userId !== null && !(await prisma.user.findUnique({ where: { id: userId } }))) {
    throw new HttpError(404, 'NOT_FOUND', 'That user does not exist.');
  }
  if (await prisma.sshKey.findUnique({ where: { body: parsed.body } })) {
    throw new HttpError(409, 'KEY_EXISTS', 'That key is already in the list.');
  }

  const row = await prisma.sshKey.create({
    data   : { userId, name: input.name, type: parsed.type, body: parsed.body, comment: parsed.comment, fingerprint: parsed.fingerprint },
    include: withOwner,
  });
  return toView(row);
}

/** Removes a key: admins any, technicians only their own. */
export async function removeKey(id: number, actor: Actor): Promise<PublicKeyView> {
  const row = await prisma.sshKey.findUnique({ where: { id }, include: withOwner });
  if (!row) throw new HttpError(404, 'KEY_NOT_FOUND', 'That key is not in the list.');
  if (actor.role !== 'ADMIN' && row.userId !== actor.id) {
    throw new HttpError(403, 'FORBIDDEN', 'You can only remove your own keys.');
  }
  await prisma.sshKey.delete({ where: { id } });
  return toView(row);
}

// ---------------------------------------------------------------------------
// One-time import of public-keys/*.pub (how keys were kept before they moved to the database)
// ---------------------------------------------------------------------------

export function publicKeysDir(): string {
  return path.resolve(process.env.PUBLIC_KEYS_DIR ?? path.join(REPO_ROOT, 'public-keys'));
}

/**
 * Imports keys from public-keys/*.pub: a file named like a username (e.g. miguel.sousa.pub) belongs
 * to that user, anything else becomes a service key. Imported files are renamed to *.pub.imported
 * so a key removed in the dashboard doesn't come back on the next start.
 */
export async function importKeyFiles(): Promise<number> {
  const dir = publicKeysDir();
  if (!fs.existsSync(dir)) return 0;
  let imported = 0;

  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.pub'))) {
    const base = file.slice(0, -4);
    const owner = await prisma.user.findFirst({ where: { username: { equals: base, mode: 'insensitive' } } });
    for (const line of fs.readFileSync(path.join(dir, file), 'utf-8').split(/\r?\n/)) {
      const parsed = parseKey(line);
      if (!parsed || await prisma.sshKey.findUnique({ where: { body: parsed.body } })) continue;
      await prisma.sshKey.create({
        data: { userId: owner?.id ?? null, name: base, type: parsed.type, body: parsed.body, comment: parsed.comment, fingerprint: parsed.fingerprint },
      });
      imported++;
    }
    fs.renameSync(path.join(dir, file), path.join(dir, `${file}.imported`));
  }
  if (imported > 0) logger.info(`Imported ${imported} SSH key(s) from ${dir} into the database.`);
  return imported;
}
