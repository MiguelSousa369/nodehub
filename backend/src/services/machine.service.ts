import prisma from '../lib/prisma';
import { CLIENT_TAG, getPeers, TailscalePeer } from '../lib/tailscale';
import { Machine, MachineConfig } from '../schemas/machine.schema';
import { HttpError } from '../utils/http-error';

export interface MachineList {
  machines      : Machine[];
  clients       : string[];
  tailscaleError: string | null;
}

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

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

  const [stored, clients] = await Promise.all([
    prisma.machine.findMany({ include: { client: true } }),
    prisma.client.findMany({ select: { name: true } }),
  ]);
  const storedByHost = new Map(stored.map((m) => [m.host.toLowerCase(), m]));

  const machines: Machine[] = [];
  const seen = new Set<string>();

  for (const peer of peers) {
    const config = storedByHost.get(peer.host.toLowerCase());
    if (!config && !peer.tags.includes(CLIENT_TAG)) continue; // our own devices, not clients
    seen.add(peer.host.toLowerCase());
    machines.push({
      host      : config?.host ?? peer.host,
      client    : config?.client.name ?? null,
      sshUser   : config?.sshUser ?? null,
      notes     : config?.notes ?? '',
      configured: Boolean(config),
      inTailnet : true,
      online    : peer.online,
      ip        : peer.ip,
      os        : peer.os,
      lastSeen  : peer.lastSeen,
    });
  }

  for (const m of stored) {
    if (seen.has(m.host.toLowerCase())) continue;
    machines.push({
      host: m.host, client: m.client.name, sshUser: m.sshUser, notes: m.notes,
      configured: true, inTailnet: false, online: false, ip: null, os: null, lastSeen: null,
    });
  }

  // Configured machines by client, then unassigned ones at the end
  machines.sort((a, b) =>
    Number(!a.configured) - Number(!b.configured)
    || byName(a.client ?? '', b.client ?? '')
    || byName(a.host, b.host));

  return { machines, clients: clients.map((c) => c.name).sort(byName), tailscaleError };
}

// ---------------------------------------------------------------------------
// Configure / edit / remove
// ---------------------------------------------------------------------------

export async function saveMachine(host: string, config: MachineConfig): Promise<{ host: string } & MachineConfig> {
  const existing = await prisma.machine.findFirst({ where: { host: { equals: host, mode: 'insensitive' } } });
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

  // Reuse an existing client regardless of letter case, or create it
  const client = await prisma.client.findFirst({ where: { name: { equals: config.client, mode: 'insensitive' } } })
    ?? await prisma.client.create({ data: { name: config.client } });

  const data = { clientId: client.id, sshUser: config.sshUser, notes: config.notes };
  await prisma.machine.upsert({ where: { host: name }, create: { host: name, ...data }, update: data });

  return { host: name, ...config, client: client.name };
}

export async function removeMachine(host: string): Promise<boolean> {
  const { count } = await prisma.machine.deleteMany({ where: { host: { equals: host, mode: 'insensitive' } } });
  return count > 0;
}
