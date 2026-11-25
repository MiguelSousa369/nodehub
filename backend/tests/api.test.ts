import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Setup: test database (see vitest.config.ts), fake Tailscale peers, temp public keys
// ---------------------------------------------------------------------------

const keysDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodehub-keys-'));
fs.writeFileSync(path.join(keysDir, 'tech.pub'), 'ssh-ed25519 AAAATEST tech\n');
process.env.PUBLIC_KEYS_DIR = keysDir;

vi.mock('../src/lib/tailscale', () => ({
  CLIENT_TAG: 'tag:cliente',
  getPeers: vi.fn(async () => [
    { host: 'srv-a',     ip: '100.64.0.1', os: 'windows', online: true, lastSeen: null, tags: ['tag:cliente'] },
    { host: 'new-pc',    ip: '100.64.0.2', os: 'windows', online: true, lastSeen: null, tags: ['tag:cliente'] },
    { host: 'my-laptop', ip: '100.64.0.3', os: 'windows', online: true, lastSeen: null, tags: [] },
  ]),
}));

import prisma from '../src/lib/prisma';
import app from '../src/server';
import { hashPassword } from '../src/utils/password';

const HOST = { Host: '127.0.0.1' };
const ADMIN_PW = 'admin-password-123';
const TECH_PW = 'tech-password-123';
let adminToken = '';
let techToken = '';
let adminId = 0;

async function signIn(username: string, password: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').set(HOST).send({ username, password });
  return res.body.token;
}

const as = (token: string) => ({ ...HOST, Authorization: `Bearer ${token}` });

beforeAll(async () => {
  await prisma.$connect();
});

beforeEach(async () => {
  await prisma.machine.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: { username: 'admin', name: 'Admin', role: 'ADMIN', passwordHash: await hashPassword(ADMIN_PW) },
  });
  adminId = admin.id;
  await prisma.user.create({
    data: { username: 'tech', name: 'Tech', role: 'TECHNICIAN', passwordHash: await hashPassword(TECH_PW) },
  });
  const client = await prisma.client.create({ data: { name: 'Client A' } });
  await prisma.machine.create({ data: { host: 'srv-a', clientId: client.id } });

  adminToken = await signIn('admin', ADMIN_PW);
  techToken = await signIn('tech', TECH_PW);
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

describe('auth', () => {
  it('signs in and returns the user without the password hash', async () => {
    const res = await request(app).post('/api/auth/login').set(HOST).send({ username: 'ADMIN', password: ADMIN_PW });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).toEqual({ id: adminId, username: 'admin', name: 'Admin', role: 'ADMIN' });
  });

  it('rejects wrong passwords and deactivated users with the same error', async () => {
    const wrong = await request(app).post('/api/auth/login').set(HOST).send({ username: 'admin', password: 'nope' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.code).toBe('INVALID_CREDENTIALS');

    await prisma.user.update({ where: { username: 'tech' }, data: { active: false } });
    const inactive = await request(app).post('/api/auth/login').set(HOST).send({ username: 'tech', password: TECH_PW });
    expect(inactive.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('cuts access immediately when a user is deactivated', async () => {
    await prisma.user.update({ where: { username: 'tech' }, data: { active: false } });
    const res = await request(app).get('/api/machines').set(as(techToken));
    expect(res.status).toBe(401);
  });

  it('requires a token and rejects requests addressed to another host', async () => {
    expect((await request(app).get('/api/machines').set(HOST)).status).toBe(401);
    expect((await request(app).get('/api/health').set('Host', 'evil.example')).status).toBe(403);
  });

  it('changes your own password', async () => {
    const res = await request(app).post('/api/auth/password').set(as(techToken))
      .send({ currentPassword: TECH_PW, newPassword: 'a-new-password-1' });
    expect(res.status).toBe(204);
    expect(await signIn('tech', 'a-new-password-1')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Users (admins only)
// ---------------------------------------------------------------------------

describe('users', () => {
  it('is admin-only', async () => {
    const res = await request(app).get('/api/users').set(as(techToken));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('creates users and rejects duplicate usernames', async () => {
    const body = { username: 'Colleague', name: 'Colleague', password: 'colleague-pw-1' };
    const res = await request(app).post('/api/users').set(as(adminToken)).send(body);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ username: 'colleague', role: 'TECHNICIAN', active: true });
    expect(res.body.passwordHash).toBeUndefined();

    const again = await request(app).post('/api/users').set(as(adminToken)).send(body);
    expect(again.body.code).toBe('USERNAME_TAKEN');
  });

  it('never leaves the system without an active admin', async () => {
    const self = await request(app).patch(`/api/users/${adminId}`).set(as(adminToken)).send({ role: 'TECHNICIAN' });
    expect(self.body.code).toBe('CANNOT_DEMOTE_SELF');

    const del = await request(app).delete(`/api/users/${adminId}`).set(as(adminToken));
    expect(del.body.code).toBe('CANNOT_DELETE_SELF');
  });
});

// ---------------------------------------------------------------------------
// Machines
// ---------------------------------------------------------------------------

describe('machines', () => {
  it('lists configured and unassigned client machines, hiding our own devices', async () => {
    const res = await request(app).get('/api/machines').set(as(techToken));
    expect(res.status).toBe(200);
    expect(res.body.machines.map((m: { host: string }) => m.host)).toEqual(['srv-a', 'new-pc']);
    expect(res.body.machines[1]).toMatchObject({ configured: false, client: null });
    expect(res.body.clients).toEqual(['Client A']);
  });

  it('configures a new machine, reusing clients regardless of case', async () => {
    const res = await request(app).put('/api/machines/new-pc').set(as(techToken)).send({ client: 'client a' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ host: 'new-pc', client: 'Client A', sshUser: 'nodehub' });
    expect(await prisma.client.count()).toBe(1);
  });

  it('refuses machines that are not in the tailnet with the client tag', async () => {
    for (const host of ['does-not-exist', 'my-laptop']) {
      const res = await request(app).put(`/api/machines/${host}`).set(as(techToken)).send({ client: 'X' });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('MACHINE_NOT_IN_TAILNET');
    }
  });

  it('validates input', async () => {
    const bad = [
      ['srv-a', { client: 'a;b' }],
      ['srv-a', { client: 'ok', sshUser: 'bad user' }],
      ['bad_host', { client: 'ok' }],
    ] as const;
    for (const [host, body] of bad) {
      const res = await request(app).put(`/api/machines/${host}`).set(as(techToken)).send(body);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    }
  });

  it('removes a machine, which then shows up as unassigned', async () => {
    expect((await request(app).delete('/api/machines/srv-a').set(as(techToken))).status).toBe(204);
    const res = await request(app).get('/api/machines').set(as(techToken));
    expect(res.body.machines.find((m: { host: string }) => m.host === 'srv-a')).toMatchObject({ configured: false });
    expect((await request(app).delete('/api/machines/srv-a').set(as(techToken))).status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Installer
// ---------------------------------------------------------------------------

describe('installer', () => {
  it('fills in the auth key and public keys', async () => {
    const status = await request(app).get('/api/installer/status').set(as(techToken));
    expect(status.body).toEqual({ ready: true, missing: [] });

    const res = await request(app).get('/api/installer').set(as(techToken))
      .buffer(true).parse((r, cb) => { const c: Buffer[] = []; r.on('data', (d: Buffer) => c.push(d)); r.on('end', () => cb(null, Buffer.concat(c))); });
    const body = res.body as Buffer;
    expect([...body.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = body.toString('utf-8');
    expect(text).toContain("'tskey-auth-kTEST123-abcDEF'");
    expect(text).toContain("'ssh-ed25519 AAAATEST tech'");
    expect(text).not.toContain('__NODEHUB_');
  });
});
