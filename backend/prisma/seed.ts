/**
 * Seed: creates the first admin.
 *
 *   npm run seed
 *
 * The admin is only created when there are no users yet, so it is safe to run on every start
 * (start.cmd does). Username from ADMIN_USERNAME (default "admin"); password from ADMIN_PASSWORD,
 * or a random one printed once.
 */
import 'dotenv/config';
import crypto from 'crypto';

import prisma from '../src/lib/prisma';
import { hashPassword } from '../src/utils/password';

async function main() {
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

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
