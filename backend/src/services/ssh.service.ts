import { execFile } from 'child_process';

export interface SshTestResult {
  ok     : boolean;
  /** ok | timeout | error: lets the dashboard word the result in the team language */
  kind   : 'ok' | 'timeout' | 'error';
  /** The machine's hostname when ok; OpenSSH's own error line otherwise */
  detail : string;
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
      if (!err) {
        const hostname = stdout.trim();
        return resolve({ ok: true, kind: 'ok', detail: hostname, message: `Connection OK (${hostname}).` });
      }
      if ((err as NodeJS.ErrnoException & { killed?: boolean }).killed) {
        return resolve({ ok: false, kind: 'timeout', detail: '', message: 'No response (timeout).' });
      }
      // Skip OpenSSH warning banners (lines starting with **)
      const lines = stderr.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('**'));
      const detail = lines[lines.length - 1] ?? `Failed (${err.message}).`;
      resolve({ ok: false, kind: 'error', detail, message: detail });
    });
  });
}
