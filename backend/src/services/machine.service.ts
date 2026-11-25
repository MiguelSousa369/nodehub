import * as store from '../lib/store';
import { CLIENT_TAG, getPeers, TailscalePeer } from '../lib/tailscale';
import { Machine, MachineConfig } from '../schemas/machine.schema';
import { HttpError } from '../utils/http-error';

export interface MachineList {
  machines      : Machine[];
  clients       : string[];
  tailscaleError: string | null;
}

// ---------------------------------------------------------------------------
// List: Tailscale peers (client machines only) + stored configuration
// ---------------------------------------------------------------------------

export async function listMachines(): Promise<MachineList> {
  let peers: TailscalePeer[] = [];
  let tailscaleError: string | null = null;
  try {
    peers = await getPeers();
  } catch (err) {
    tailscaleError = `Could not read Tailscale status: ${(err as Error).message}`;
  }

  const machines: Machine[] = [];
  const seen = new Set<string>();

  for (const peer of peers) {
    const stored = store.getConfig(peer.host);
    if (!stored && !peer.tags.includes(CLIENT_TAG)) continue; // our own devices, not clients
    seen.add(peer.host.toLowerCase());
    machines.push({
      host      : stored?.host ?? peer.host,
      client    : stored?.config.client ?? null,
      sshUser   : stored?.config.sshUser ?? null,
      notes     : stored?.config.notes ?? '',
      configured: Boolean(stored),
      inTailnet : true,
      online    : peer.online,
      ip        : peer.ip,
      os        : peer.os,
      lastSeen  : peer.lastSeen,
    });
  }

  for (const { host, config } of store.listConfigs()) {
    if (seen.has(host.toLowerCase())) continue;
    machines.push({
      host, client: config.client, sshUser: config.sshUser, notes: config.notes,
      configured: true, inTailnet: false, online: false, ip: null, os: null, lastSeen: null,
    });
  }

  // Configured machines by client, then unassigned ones at the end
  machines.sort((a, b) =>
    Number(!a.configured) - Number(!b.configured)
    || (a.client ?? '').localeCompare(b.client ?? '', undefined, { sensitivity: 'base' })
    || a.host.localeCompare(b.host, undefined, { sensitivity: 'base' }));

  const clients = [...new Set(machines.flatMap((m) => (m.client ? [m.client] : [])))]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  return { machines, clients, tailscaleError };
}

// ---------------------------------------------------------------------------
// Configure / edit / remove
// ---------------------------------------------------------------------------

export async function saveMachine(host: string, config: MachineConfig): Promise<{ host: string } & MachineConfig> {
  const existing = store.getConfig(host);
  let name = existing?.host;

  if (!name) {
    // New machines must be in the tailnet with the client tag
    let peers: TailscalePeer[];
    try {
      peers = await getPeers();
    } catch (err) {
      throw new HttpError(503, 'TAILSCALE_UNAVAILABLE', `Could not read Tailscale status: ${(err as Error).message}`);
    }
    const peer = peers.find((p) => p.host.toLowerCase() === host.toLowerCase());
    if (!peer || !peer.tags.includes(CLIENT_TAG)) {
      throw new HttpError(404, 'MACHINE_NOT_IN_TAILNET', `Machine '${host}' is not in the tailnet with ${CLIENT_TAG}.`);
    }
    name = peer.host;
  }

  store.saveConfig(name, config);
  return { host: name, ...config };
}

export function removeMachine(host: string): boolean {
  return store.deleteConfig(host);
}
