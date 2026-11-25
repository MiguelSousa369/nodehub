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
  clientTag: () => 'tag:client',
  getPeers: vi.fn(async () => [
    { host: 'srv-a',     ip: '100.64.0.1', os: 'windows', online: true, lastSeen: null, tags: ['tag:client'] },
    { host: 'new-pc',    ip: '100.64.0.2', os: 'windows', online: true, lastSeen: null, tags: ['tag:client'] },
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
  await prisma.session.deleteMany();
  await prisma.apiToken.deleteMany();
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
    expect(text).toContain("$ClientTag  = 'tag:client'");
    expect(text).not.toContain('__NODEHUB_');
  });
});

// ---------------------------------------------------------------------------
// Personal access token (one per user)
// ---------------------------------------------------------------------------

async function createToken(token: string): Promise<string> {
  const res = await request(app).post('/api/token').set(as(token));
  expect(res.status).toBe(201);
  return res.body.token;
}

describe('access token', () => {
  it('generates a token shown once, usable as a bearer token, and shows it without the secret', async () => {
    expect((await request(app).get('/api/token').set(as(techToken))).body).toBeNull();

    const token = await createToken(techToken);
    expect(token).toMatch(/^nhk_/);
    expect((await request(app).get('/api/auth/me').set(as(token))).body.username).toBe('tech');

    const info = await request(app).get('/api/token').set(as(techToken));
    expect(info.body.token).toBeUndefined();
    expect(info.body.prefix).toBe(token.slice(0, 12));
  });

  it('replaces the previous token when generating a new one', async () => {
    const first = await createToken(techToken);
    const second = await createToken(techToken);
    expect(second).not.toBe(first);
    expect((await request(app).get('/api/machines').set(as(first))).status).toBe(401);
    expect((await request(app).get('/api/machines').set(as(second))).status).toBe(200);
    expect(await prisma.apiToken.count()).toBe(1);
  });

  it('cannot manage the token, users or passwords (needs a dashboard session)', async () => {
    const token = await createToken(adminToken);
    for (const [method, url] of [['get', '/api/token'], ['post', '/api/token'], ['get', '/api/users'], ['post', '/api/auth/password']] as const) {
      const res = await request(app)[method](url).set(as(token)).send({});
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SESSION_REQUIRED');
    }
  });

  it('stops working when revoked or when the user is deactivated', async () => {
    const token = await createToken(techToken);
    expect((await request(app).delete('/api/token').set(as(techToken))).status).toBe(204);
    expect((await request(app).get('/api/machines').set(as(token))).status).toBe(401);
    expect((await request(app).delete('/api/token').set(as(techToken))).status).toBe(404);

    const other = await createToken(techToken);
    await prisma.user.update({ where: { username: 'tech' }, data: { active: false } });
    expect((await request(app).get('/api/machines').set(as(other))).status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Sessions and profile
// ---------------------------------------------------------------------------

describe('sessions', () => {
  const session = { summary: 'Disk full', problem: 'Slow PC', diagnosis: 'Temp files', actions: 'Cleaned temp', result: 'fixed' };

  it('records a session as the token owner and shows it in the machine detail', async () => {
    const token = await createToken(techToken);
    const res = await request(app).post('/api/machines/SRV-A/sessions').set(as(token)).send(session);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ host: 'srv-a', client: 'Client A', result: 'FIXED', technician: { name: 'Tech' } });

    const detail = await request(app).get('/api/machines/srv-a').set(as(token));
    expect(detail.body).toMatchObject({ client: 'Client A', totalSessions: 1 });
    expect(detail.body.recentSessions[0].summary).toBe('Disk full');
  });

  it('refuses sessions for machines that are not configured, and validates input', async () => {
    const missing = await request(app).post('/api/machines/new-pc/sessions').set(as(techToken)).send(session);
    expect(missing.body.code).toBe('MACHINE_NOT_CONFIGURED');

    const bad = await request(app).post('/api/machines/srv-a/sessions').set(as(techToken)).send({ ...session, result: 'maybe' });
    expect(bad.body.code).toBe('VALIDATION_ERROR');
  });

  it('filters the history by result, technician and text', async () => {
    await request(app).post('/api/machines/srv-a/sessions').set(as(techToken)).send(session);
    await request(app).post('/api/machines/srv-a/sessions').set(as(adminToken))
      .send({ summary: 'Printer offline', result: 'unresolved', pending: 'Order a new cable' });

    const all = await request(app).get('/api/sessions').set(as(techToken));
    expect(all.body.total).toBe(2);
    expect(all.body.sessions[0].summary).toBe('Printer offline'); // newest first

    const unresolved = await request(app).get('/api/sessions?result=unresolved').set(as(techToken));
    expect(unresolved.body.sessions.map((s: { summary: string }) => s.summary)).toEqual(['Printer offline']);

    const byText = await request(app).get('/api/sessions?q=cable').set(as(techToken));
    expect(byText.body.total).toBe(1);

    const byTech = await request(app).get(`/api/sessions?technicianId=${adminId}`).set(as(techToken));
    expect(byTech.body.sessions[0].technician.name).toBe('Admin');
  });

  it('keeps the history when the machine is removed and added back', async () => {
    await request(app).post('/api/machines/srv-a/sessions').set(as(techToken)).send(session);
    await request(app).delete('/api/machines/srv-a').set(as(techToken));
    await request(app).put('/api/machines/srv-a').set(as(techToken)).send({ client: 'Client A' });
    const res = await request(app).get('/api/machines/srv-a/sessions').set(as(techToken));
    expect(res.body.total).toBe(1);
  });

  it('updates the machine profile', async () => {
    const res = await request(app).put('/api/machines/srv-a/profile').set(as(techToken)).send({ profile: '- **Role:** server' });
    expect(res.status).toBe(200);
    const detail = await request(app).get('/api/machines/srv-a').set(as(techToken));
    expect(detail.body.profile).toBe('- **Role:** server');
  });
});
