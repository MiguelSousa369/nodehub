import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { HttpError } from '../utils/http-error';

// ---------------------------------------------------------------------------
// The team's SSH public keys: one or more per file in public-keys/*.pub.
//
// This list is the source of truth for who can reach client PCs: the installer writes it to new
// PCs, and "nodehub keys sync" (run on a technician PC that already has access) makes every online
// client PC accept exactly these keys. Only public keys ever live here.
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '../../..');

/** type, base64 key, optional comment (no quotes or line breaks: it ends up in a PowerShell string). */
export const PUBLIC_KEY_RE = /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-\S+|sk-\S+) ([A-Za-z0-9+/=]+)( [^'\r\n]*)?$/;
const NAME_RE = /^[A-Za-z0-9._-]{1,40}$/;

export interface PublicKeyInfo {
  /** Hex SHA-256 of the key blob: stable id for URLs. */
  id         : string;
  /** As ssh-keygen -l shows it: SHA256:base64 */
  fingerprint: string;
  type       : string;
  comment    : string;
  /** File it comes from, without .pub (e.g. "miguel") */
  name       : string;
  key        : string;   // the full line
}

export function publicKeysDir(): string {
  return path.resolve(process.env.PUBLIC_KEYS_DIR ?? path.join(REPO_ROOT, 'public-keys'));
}

function describe(line: string, name: string): PublicKeyInfo | null {
  const match = line.match(PUBLIC_KEY_RE);
  if (!match) return null;
  const digest = crypto.createHash('sha256').update(Buffer.from(match[2], 'base64')).digest();
  return {
    id         : digest.toString('hex'),
    fingerprint: `SHA256:${digest.toString('base64').replace(/=+$/, '')}`,
    type       : match[1],
    comment    : (match[3] ?? '').trim(),
    name,
    key        : line,
  };
}

/** Every valid key, in file order; the same key in two files counts once. */
export function listKeys(): PublicKeyInfo[] {
  const dir = publicKeysDir();
  if (!fs.existsSync(dir)) return [];
  const seen = new Set<string>();
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.pub'))
    .sort()
    .flatMap((file) => fs.readFileSync(path.join(dir, file), 'utf-8').split(/\r?\n/)
      .map((l) => describe(l.trim(), file.slice(0, -4))))
    .filter((k): k is PublicKeyInfo => k !== null && !seen.has(k.id) && Boolean(seen.add(k.id)));
}

/** Adds a technician's key as public-keys/<name>.pub. */
export function addKey(name: string, publicKey: string): PublicKeyInfo {
  const line = publicKey.trim().replace(/\s+/g, ' ');
  if (/PRIVATE KEY/.test(publicKey)) {
    throw new HttpError(400, 'PRIVATE_KEY', 'That is a private key. Paste the contents of the .pub file instead, and keep the private key secret.');
  }
  const key = describe(line, name);
  if (!key || !NAME_RE.test(name)) {
    throw new HttpError(400, 'INVALID_KEY', 'Not a valid SSH public key (e.g. "ssh-ed25519 AAAA... name"), or invalid name.');
  }
  if (listKeys().some((k) => k.id === key.id)) throw new HttpError(409, 'KEY_EXISTS', 'That key is already in the list.');

  const file = path.join(publicKeysDir(), `${name}.pub`);
  if (fs.existsSync(file)) throw new HttpError(409, 'KEY_NAME_TAKEN', `There is already a key named "${name}".`);
  fs.mkdirSync(publicKeysDir(), { recursive: true });
  fs.writeFileSync(file, `${line}\n`, 'utf-8');
  return key;
}

/** Removes a key (by id) from whichever file holds it; deletes the file if nothing is left. */
export function removeKey(id: string): PublicKeyInfo {
  const key = listKeys().find((k) => k.id === id);
  if (!key) throw new HttpError(404, 'KEY_NOT_FOUND', 'That key is not in the list.');

  const dir = publicKeysDir();
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.pub'))) {
    const full = path.join(dir, file);
    const lines = fs.readFileSync(full, 'utf-8').split(/\r?\n/);
    const kept = lines.filter((l) => describe(l.trim(), '')?.id !== id);
    if (kept.length === lines.length) continue;
    if (kept.some((l) => l.trim())) fs.writeFileSync(full, kept.join('\n'), 'utf-8');
    else fs.rmSync(full);
  }
  return key;
}
