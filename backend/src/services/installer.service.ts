import fs from 'fs';
import path from 'path';

import { HttpError } from '../utils/http-error';

// ---------------------------------------------------------------------------
// Client installer: the template in installer/ with the Tailscale auth key and
// the technicians' SSH public keys filled in.
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '../../..');

const AUTHKEY_RE    = /^tskey-auth-[A-Za-z0-9-]+$/;
const PUBLIC_KEY_RE = /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-\S+|sk-\S+) [A-Za-z0-9+/=]+( [^'\r\n]*)?$/;

export interface InstallerStatus {
  ready  : boolean;
  missing: string[];
}

function templatePath(): string {
  return path.resolve(process.env.INSTALLER_TEMPLATE ?? path.join(REPO_ROOT, 'installer', 'install-client.ps1'));
}

function publicKeysDir(): string {
  return path.resolve(process.env.PUBLIC_KEYS_DIR ?? path.join(REPO_ROOT, 'public-keys'));
}

function authKey(): string | null {
  const key = (process.env.TAILSCALE_AUTHKEY ?? '').trim();
  return AUTHKEY_RE.test(key) ? key : null;
}

export function publicKeys(): string[] {
  const dir = publicKeysDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.pub'))
    .sort()
    .flatMap((f) => fs.readFileSync(path.join(dir, f), 'utf-8').split(/\r?\n/))
    .map((l) => l.trim())
    .filter((l) => PUBLIC_KEY_RE.test(l));
}

export function getInstallerStatus(): InstallerStatus {
  const missing: string[] = [];
  if (!authKey()) missing.push('TAILSCALE_AUTHKEY in backend/.env.');
  if (publicKeys().length === 0) missing.push('At least one SSH public key in public-keys/*.pub.');
  if (!fs.existsSync(templatePath())) missing.push('Installer template (installer/install-client.ps1).');
  return { ready: missing.length === 0, missing };
}

/** Returns the installer as UTF-8 with BOM and CRLF (Windows PowerShell 5.1 needs the BOM). */
export function buildInstaller(): Buffer {
  const status = getInstallerStatus();
  if (!status.ready) {
    throw new HttpError(409, 'INSTALLER_NOT_CONFIGURED', `Installer not configured: ${status.missing.join(' ')}`);
  }

  const keys = publicKeys().map((k) => `'${k.replace(/'/g, "''")}'`).join(',');
  const script = fs.readFileSync(templatePath(), 'utf-8')
    .replace(/^﻿/, '')
    .replace("'__NODEHUB_AUTHKEY__'", `'${authKey()}'`)
    .replace("'__NODEHUB_PUBKEYS__'", keys)
    .replace(/\r?\n/g, '\r\n');

  return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(script, 'utf-8')]);
}
