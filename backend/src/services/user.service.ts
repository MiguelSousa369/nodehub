import prisma from '../lib/prisma';
import { CreateUserInput, PublicUser, UpdateUserInput } from '../schemas/user.schema';
import { HttpError } from '../utils/http-error';
import { hashPassword } from '../utils/password';

const publicFields = { id: true, username: true, name: true, role: true, active: true, createdAt: true } as const;

export function listUsers(): Promise<PublicUser[]> {
  return prisma.user.findMany({ select: publicFields, orderBy: { username: 'asc' } });
}

export function getUser(id: number): Promise<PublicUser | null> {
  return prisma.user.findUnique({ where: { id }, select: publicFields });
}

export async function createUser(input: CreateUserInput): Promise<PublicUser> {
  if (await prisma.user.findUnique({ where: { username: input.username } })) {
    throw new HttpError(409, 'USERNAME_TAKEN', `Username '${input.username}' is already taken.`);
  }
  return prisma.user.create({
    data  : { username: input.username, name: input.name, role: input.role, passwordHash: await hashPassword(input.password) },
    select: publicFields,
  });
}

// ---------------------------------------------------------------------------
// Update: admins can't lock themselves out, and there is always one active admin
// ---------------------------------------------------------------------------

async function assertKeepsAnAdmin(targetId: number): Promise<void> {
  const others = await prisma.user.count({ where: { role: 'ADMIN', active: true, id: { not: targetId } } });
  if (others === 0) throw new HttpError(409, 'LAST_ADMIN', 'There must always be at least one active admin.');
}

export async function updateUser(id: number, input: UpdateUserInput, actorId: number): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return null;

  const losesAdmin = user.role === 'ADMIN' && user.active
    && ((input.role && input.role !== 'ADMIN') || input.active === false);
  if (losesAdmin) {
    if (id === actorId) throw new HttpError(409, 'CANNOT_DEMOTE_SELF', 'You cannot remove your own admin access.');
    await assertKeepsAnAdmin(id);
  }

  return prisma.user.update({
    where : { id },
    data  : {
      name        : input.name,
      role        : input.role,
      active      : input.active,
      passwordHash: input.password ? await hashPassword(input.password) : undefined,
    },
    select: publicFields,
  });
}

export async function deleteUser(id: number, actorId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return false;
  if (id === actorId) throw new HttpError(409, 'CANNOT_DELETE_SELF', 'You cannot delete your own account.');
  if (user.role === 'ADMIN' && user.active) await assertKeepsAnAdmin(id);
  await prisma.user.delete({ where: { id } });
  return true;
}
