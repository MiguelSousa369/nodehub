import fs from 'fs';
import path from 'path';

import { clientTag } from '../lib/tailscale';
import { Language } from '../schemas/settings.schema';
import { HttpError } from '../utils/http-error';
import { effectiveKeys } from './keys.service';

// ---------------------------------------------------------------------------
// Client installer: the template in installer/ with the Tailscale auth key and
// the technicians' SSH public keys filled in.
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '../../..');

const AUTHKEY_RE    = /^tskey-auth-[A-Za-z0-9-]+$/;

/** What still has to be configured; the dashboard shows each code in the team language. */
export type MissingSetting = 'TAILSCALE_AUTHKEY' | 'PUBLIC_KEYS' | 'INSTALLER_TEMPLATE' | 'CLIENT_TAG';

const MISSING_TEXT: Record<MissingSetting, string> = {
  TAILSCALE_AUTHKEY : 'TAILSCALE_AUTHKEY in backend/.env.',
  PUBLIC_KEYS       : 'At least one SSH key (Users → SSH keys, or My SSH keys in the account menu).',
  INSTALLER_TEMPLATE: 'Installer template (installer/install-client.ps1).',
  CLIENT_TAG        : 'A valid CLIENT_TAG in backend/.env (e.g. tag:client).',
};

export interface InstallerStatus {
  ready  : boolean;
  missing: MissingSetting[];
}

function templatePath(): string {
  return path.resolve(process.env.INSTALLER_TEMPLATE ?? path.join(REPO_ROOT, 'installer', 'install-client.ps1'));
}

function authKey(): string | null {
  const key = (process.env.TAILSCALE_AUTHKEY ?? '').trim();
  return AUTHKEY_RE.test(key) ? key : null;
}

/** The keys client PCs should accept (owners active, plus service keys), as written into the installer. */
export async function publicKeys(): Promise<string[]> {
  return (await effectiveKeys()).map((k) => k.key);
}

export async function getInstallerStatus(): Promise<InstallerStatus> {
  const missing: MissingSetting[] = [];
  if (!authKey()) missing.push('TAILSCALE_AUTHKEY');
  if ((await publicKeys()).length === 0) missing.push('PUBLIC_KEYS');
  if (!fs.existsSync(templatePath())) missing.push('INSTALLER_TEMPLATE');
  if (!/^tag:[A-Za-z0-9-]+$/.test(clientTag())) missing.push('CLIENT_TAG');
  return { ready: missing.length === 0, missing };
}

/**
 * Returns the installer as UTF-8 with BOM and CRLF (Windows PowerShell 5.1 needs the BOM, also for
 * the accents in the Portuguese messages). `language` is the team language its messages are shown in.
 */
export async function buildInstaller(language: Language = 'en'): Promise<Buffer> {
  const status = await getInstallerStatus();
  if (!status.ready) {
    throw new HttpError(409, 'INSTALLER_NOT_CONFIGURED', `Installer not configured: ${status.missing.map((m) => MISSING_TEXT[m]).join(' ')}`);
  }

  const keys = (await publicKeys()).map((k) => `'${k.replace(/'/g, "''")}'`).join(',');
  const script = fs.readFileSync(templatePath(), 'utf-8')
    .replace(/^﻿/, '')
    .replace("'__NODEHUB_AUTHKEY__'", `'${authKey()}'`)
    .replace("'__NODEHUB_PUBKEYS__'", keys)
    .replace("'__NODEHUB_CLIENT_TAG__'", `'${clientTag()}'`)
    .replace("'__NODEHUB_LANGUAGE__'", `'${language}'`)
    .replace(/\r?\n/g, '\r\n');

  return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(script, 'utf-8')]);
}
