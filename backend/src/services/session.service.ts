import { Prisma } from '../generated/prisma/client';
import prisma from '../lib/prisma';
import { CreateSessionInput, SessionQuery, SessionView } from '../schemas/session.schema';
import { HttpError } from '../utils/http-error';

type SessionRow = Prisma.SessionGetPayload<{ include: { technician: { select: { id: true; name: true } } } }>;

/** Adds the machine's current client name to each session. */
async function toViews(rows: SessionRow[]): Promise<SessionView[]> {
  const hosts = [...new Set(rows.map((r) => r.host))];
  const machines = await prisma.machine.findMany({ where: { host: { in: hosts } }, include: { client: true } });
  const clientByHost = new Map(machines.map((m) => [m.host, m.client.name]));

  return rows.map(({ technicianId: _t, ...r }) => ({ ...r, client: clientByHost.get(r.host) ?? null }));
}

async function canonicalHost(host: string): Promise<string> {
  const machine = await prisma.machine.findFirst({ where: { host: { equals: host, mode: 'insensitive' } } });
  if (!machine) throw new HttpError(404, 'MACHINE_NOT_CONFIGURED', `Machine '${host}' is not configured in the dashboard.`);
  return machine.host;
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export async function listSessions(query: SessionQuery): Promise<{ sessions: SessionView[]; total: number }> {
  const text = query.q ? { contains: query.q, mode: 'insensitive' as const } : undefined;
  const where: Prisma.SessionWhereInput = {
    host        : query.host ? { equals: query.host, mode: 'insensitive' } : undefined,
    technicianId: query.technicianId,
    result      : query.result,
    OR          : text && [
      { host: text }, { summary: text }, { problem: text }, { diagnosis: text }, { actions: text }, { pending: text },
    ],
  };

  const [rows, total] = await Promise.all([
    prisma.session.findMany({
      where,
      include: { technician: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take   : query.limit,
      skip   : query.offset,
    }),
    prisma.session.count({ where }),
  ]);

  return { sessions: await toViews(rows), total };
}

/** Users who recorded at least one session (for the history's technician filter). */
export async function listTechnicians(): Promise<{ id: number; name: string }[]> {
  return prisma.user.findMany({
    where  : { sessions: { some: {} } },
    select : { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

export async function createSession(host: string, input: CreateSessionInput, technicianId: number): Promise<SessionView> {
  const row = await prisma.session.create({
    data   : { host: await canonicalHost(host), technicianId, ...input },
    include: { technician: { select: { id: true, name: true } } },
  });
  return (await toViews([row]))[0];
}

// ---------------------------------------------------------------------------
// Machine detail and profile
// ---------------------------------------------------------------------------

export async function getMachineDetail(host: string) {
  const machine = await prisma.machine.findFirst({
    where  : { host: { equals: host, mode: 'insensitive' } },
    include: { client: true },
  });
  if (!machine) return null;

  const { sessions, total } = await listSessions({ host: machine.host, limit: 10, offset: 0 });
  return {
    host          : machine.host,
    client        : machine.client.name,
    sshUser       : machine.sshUser,
    notes         : machine.notes,
    profile       : machine.profile,
    updatedAt     : machine.updatedAt,
    recentSessions: sessions,
    totalSessions : total,
  };
}

export async function updateProfile(host: string, profile: string): Promise<{ host: string; profile: string }> {
  const name = await canonicalHost(host);
  await prisma.machine.update({ where: { host: name }, data: { profile } });
  return { host: name, profile };
}
