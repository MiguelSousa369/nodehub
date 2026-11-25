/**
 * Seed: first admin + import of the old JSON store (data/machines/<host>/entity.json).
 *
 *   npm run seed
 *
 * The admin is only created when there are no users yet. Username from ADMIN_USERNAME
 * (default "admin"); password from ADMIN_PASSWORD, or a random one printed once.
 */
import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import prisma from '../src/lib/prisma';
import { HostnameSchema, MachineConfigSchema } from '../src/schemas/machine.schema';
import { hashPassword } from '../src/utils/password';

// ---------------------------------------------------------------------------
// First admin
// ---------------------------------------------------------------------------

async function seedAdmin() {
  if ((await prisma.user.count()) > 0) {
    console.log('Users already exist: no admin created.');
    return;
  }
  const username = (process.env.ADMIN_USERNAME ?? 'admin').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url');

  await prisma.user.create({
    data: { username, name: 'Administrator', role: 'ADMIN', passwordHash: await hashPassword(password) },
  });

  console.log(`Admin created: ${username}`);
  if (!process.env.ADMIN_PASSWORD) console.log(`Password (shown only now, change it after signing in): ${password}`);
}

// ---------------------------------------------------------------------------
// Old JSON store
// ---------------------------------------------------------------------------

async function importJsonStore() {
  const dir = path.resolve(process.env.DATA_DIR ?? path.join(__dirname, '../data'), 'machines');
  if (!fs.existsSync(dir)) return;

  for (const host of fs.readdirSync(dir)) {
    const file = path.join(dir, host, 'entity.json');
    if (!HostnameSchema.safeParse(host).success || !fs.existsSync(file)) continue;
    const parsed = MachineConfigSchema.safeParse(JSON.parse(fs.readFileSync(file, 'utf-8')));
    if (!parsed.success || (await prisma.machine.findUnique({ where: { host } }))) continue;

    const { client: clientName, sshUser, notes } = parsed.data;
    const client = await prisma.client.upsert({ where: { name: clientName }, create: { name: clientName }, update: {} });
    await prisma.machine.create({ data: { host, clientId: client.id, sshUser, notes } });
    console.log(`Imported machine ${host} (${clientName})`);
  }
}

async function main() {
  await seedAdmin();
  await importJsonStore();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
