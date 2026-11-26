import { Prisma } from '../generated/prisma/client';
import prisma from '../lib/prisma';
import { CreateSessionInput, SessionQuery, SessionView, UpdateSessionInput } from '../schemas/session.schema';
import { Role } from '../schemas/user.schema';
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

/**
 * Corrects a recorded session (e.g. something "pending" was confirmed later in the conversation).
 * Only the technician who recorded it, or an admin, may change it; the edit time is kept.
 */
export async function updateSession(
  id: number, input: UpdateSessionInput, actor: { id: number; role: Role },
): Promise<SessionView> {
  const existing = await prisma.session.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'SESSION_NOT_FOUND', `Session #${id} does not exist.`);
  if (existing.technicianId !== actor.id && actor.role !== 'ADMIN') {
    throw new HttpError(403, 'FORBIDDEN', 'Only the technician who recorded this session, or an admin, can change it.');
  }

  const row = await prisma.session.update({
    where  : { id },
    data   : { ...input, updatedAt: new Date() },
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
