import { execFile } from 'child_process';

export interface SshTestResult {
  ok     : boolean;
  message: string;
}

/** Runs `hostname` on the machine over SSH (key only, no prompts). */
export function testSsh(host: string, sshUser: string): Promise<SshTestResult> {
  const args = [
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=8',
    '-o', 'StrictHostKeyChecking=accept-new',
    `${sshUser}@${host}`,
    'hostname',
  ];

  return new Promise((resolve) => {
    execFile('ssh', args, { timeout: 20_000, encoding: 'utf-8' }, (err, stdout, stderr) => {
      if (!err) return resolve({ ok: true, message: `Connection OK (${stdout.trim()}).` });
      if ((err as NodeJS.ErrnoException & { killed?: boolean }).killed) {
        return resolve({ ok: false, message: 'No response (timeout).' });
      }
      // Skip OpenSSH warning banners (lines starting with **)
      const lines = stderr.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('**'));
      resolve({ ok: false, message: lines[lines.length - 1] ?? `Failed (${err.message}).` });
    });
  });
}
