import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

// ---------------------------------------------------------------------------
// "nodehub keys sync": make client PCs accept exactly the team's SSH keys.
//
// Runs on a technician PC that already has access (the server never connects to client PCs).
// For each machine it connects with this PC's SSH key and rewrites
// C:\ProgramData\ssh\administrators_authorized_keys with the team list, so added keys start working
// and removed keys stop working. Keys added by hand on a machine are removed too: the list in the
// dashboard is the only source of truth.
// ---------------------------------------------------------------------------

export interface SyncTarget {
  host   : string;
  label  : string;   // friendly name or host, for output
  sshUser: string;
}

export interface SyncResult {
  target : SyncTarget;
  status : 'updated' | 'unchanged' | 'failed';
  added  : number;
  removed: number;
  error? : string;
}

/** "ssh-ed25519 AAAA... comment" → "ssh-ed25519 AAAA..." (what identifies a key). */
export const keyBody = (line: string): string => line.trim().split(/\s+/).slice(0, 2).join(' ');

/** Public keys of this PC (~/.ssh/*.pub): the sync must not remove the key it connects with. */
export function ownPublicKeys(): string[] {
  const dir = path.join(os.homedir(), '.ssh');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.pub'))
    .map((f) => keyBody(fs.readFileSync(path.join(dir, f), 'utf-8')))
    .filter((k) => k.includes(' '));
}

/** PowerShell run on the client PC. Keys can't contain single quotes (validated by the server). */
function remoteScript(keys: string[], dryRun: boolean): string {
  const list = keys.map((k) => `'${k.replace(/'/g, "''")}'`).join(',');
  return `
$ErrorActionPreference = 'Stop'
$keys = @(${list})
$ak = Join-Path $env:ProgramData 'ssh\\administrators_authorized_keys'
$old = if (Test-Path $ak) { @(Get-Content $ak | Where-Object { $_.Trim() }) } else { @() }
function Body($l) { (($l.Trim() -split '\\s+')[0..1]) -join ' ' }
$oldB = @($old | ForEach-Object { Body $_ })
$newB = @($keys | ForEach-Object { Body $_ })
$added = @($newB | Where-Object { $oldB -notcontains $_ }).Count
$removed = @($oldB | Where-Object { $newB -notcontains $_ }).Count
if ($added -eq 0 -and $removed -eq 0) { 'NODEHUB unchanged 0 0'; exit 0 }
if (-not $${dryRun ? 'true' : 'false'}) {
  Set-Content -Path $ak -Value $keys -Encoding ascii
  icacls $ak /inheritance:r /grant '*S-1-5-32-544:F' /grant '*S-1-5-18:F' | Out-Null
}
"NODEHUB updated $added $removed"
`;
}

function syncOne(target: SyncTarget, keys: string[], dryRun: boolean): Promise<SyncResult> {
  const encoded = Buffer.from(remoteScript(keys, dryRun), 'utf16le').toString('base64');
  const args = [
    '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'StrictHostKeyChecking=accept-new',
    `${target.sshUser}@${target.host}`,
    `powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`,
  ];
  return new Promise((resolve) => {
    const child = spawn('ssh', args, { windowsHide: true });
    let out = '';
    let err = '';
    const timer = setTimeout(() => child.kill(), 60_000);
    child.stdout.on('data', (d: Buffer) => { out += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { err += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); resolve({ target, status: 'failed', added: 0, removed: 0, error: e.message }); });
    child.on('close', (code) => {
      clearTimeout(timer);
      const match = out.match(/NODEHUB (updated|unchanged) (\d+) (\d+)/);
      if (code === 0 && match) {
        return resolve({ target, status: match[1] as 'updated' | 'unchanged', added: Number(match[2]), removed: Number(match[3]) });
      }
      const lastLine = err.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('**')).pop();
      resolve({ target, status: 'failed', added: 0, removed: 0, error: lastLine ?? `exit code ${code}` });
    });
  });
}

/** Syncs every target, a few at a time; calls onResult as each one finishes. */
export async function syncKeys(
  targets: SyncTarget[], keys: string[], dryRun: boolean, onResult: (r: SyncResult) => void, parallel = 4,
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  const queue = [...targets];
  await Promise.all(Array.from({ length: Math.min(parallel, queue.length) }, async () => {
    for (let t = queue.shift(); t; t = queue.shift()) {
      const r = await syncOne(t, keys, dryRun);
      results.push(r);
      onResult(r);
    }
  }));
  return results;
}
