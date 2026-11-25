import { execFile } from 'child_process';
import path from 'path';
import { promisify } from 'util';
import { z } from 'zod';

const execFileAsync = promisify(execFile);

/** Tailscale tag that marks client machines (CLIENT_TAG in .env, default tag:client). */
export function clientTag(): string {
  return process.env.CLIENT_TAG ?? 'tag:client';
}

function tailscaleBin(): string {
  return process.env.TAILSCALE_BIN
    ?? path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Tailscale', 'tailscale.exe');
}

// ---------------------------------------------------------------------------
// Subset of `tailscale status --json` used by nodehub
// ---------------------------------------------------------------------------

const PeerSchema = z.object({
  HostName    : z.string(),
  DNSName     : z.string().nullish(),
  TailscaleIPs: z.array(z.string()).nullish(),
  OS          : z.string().nullish(),
  Online      : z.boolean().nullish(),
  LastSeen    : z.string().nullish(),
  Tags        : z.array(z.string()).nullish(),
});

const StatusSchema = z.object({
  Peer: z.record(z.string(), PeerSchema).nullish(),
});

export interface TailscalePeer {
  host    : string;          // unique name in the tailnet (first label of DNSName)
  ip      : string | null;
  os      : string | null;
  online  : boolean;
  lastSeen: string | null;
  tags    : string[];
}

export async function getPeers(): Promise<TailscalePeer[]> {
  const { stdout } = await execFileAsync(tailscaleBin(), ['status', '--json'], { timeout: 15_000 });
  const status = StatusSchema.parse(JSON.parse(stdout));

  return Object.values(status.Peer ?? {}).map((p) => ({
    // Two clients can both have a PC called "SERVIDOR"; the tailnet name is unique.
    host    : p.DNSName?.split('.')[0] || p.HostName,
    ip      : p.TailscaleIPs?.[0] ?? null,
    os      : p.OS ?? null,
    online  : p.Online ?? false,
    // Tailscale reports 0001-01-01 for peers that are currently online
    lastSeen: p.LastSeen && !p.LastSeen.startsWith('0001') ? p.LastSeen : null,
    tags    : p.Tags ?? [],
  }));
}
