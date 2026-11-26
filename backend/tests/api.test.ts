import fs from 'fs';
import jwt from 'jsonwebtoken';
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
    { host: 'srv-a',     ip: '100.64.0.1', os: 'windows', online: true, lastSeen: null, tags: ['tag:client'], created: '2026-01-01T00:00:00Z' },
    { host: 'new-pc',    ip: '100.64.0.2', os: 'windows', online: true, lastSeen: null, tags: ['tag:client'], created: '2026-11-20T10:00:00Z' },
    { host: 'my-laptop', ip: '100.64.0.3', os: 'windows', online: true, lastSeen: null, tags: [], created: null },
  ]),
}));

import prisma from '../src/lib/prisma';
import app from '../src/server';
import { MAX_FAILURES, MAX_FAILURES_PER_IP, resetLoginThrottle } from '../src/utils/login-throttle';
import logger from '../src/utils/logger';
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
  resetLoginThrottle();
  await prisma.setting.deleteMany();
  await prisma.cliLoginRequest.deleteMany();
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

  it('audits sign-ins without ever logging the password', async () => {
    const log = vi.spyOn(logger, 'log');
    await request(app).post('/api/auth/login').set(HOST).send({ username: 'admin', password: 'wrong-secret-guess' });
    await request(app).post('/api/auth/login').set(HOST).send({ username: 'admin', password: ADMIN_PW });

    const events = log.mock.calls.map(([, message]) => message);
    expect(events).toContain('audit login.failure');
    expect(events).toContain('audit login.success');
    expect(JSON.stringify(log.mock.calls)).not.toContain('wrong-secret-guess');
    expect(JSON.stringify(log.mock.calls)).not.toContain(ADMIN_PW);
    log.mockRestore();
  });

  it('locks a username for a while after too many wrong passwords', async () => {
    for (let i = 0; i < MAX_FAILURES; i++) {
      await request(app).post('/api/auth/login').set(HOST).send({ username: 'tech', password: 'wrong-guess' });
    }
    const locked = await request(app).post('/api/auth/login').set(HOST).send({ username: 'tech', password: TECH_PW });
    expect(locked.status).toBe(429);
    expect(locked.body.code).toBe('TOO_MANY_ATTEMPTS');

    // Other users are not affected
    expect((await request(app).post('/api/auth/login').set(HOST).send({ username: 'admin', password: ADMIN_PW })).status).toBe(200);
  });

  it('locks an address that guesses passwords across many usernames', async () => {
    for (let i = 0; i < MAX_FAILURES_PER_IP; i++) {
      await request(app).post('/api/auth/login').set(HOST).send({ username: `nobody${i}`, password: 'guess' });
    }
    const res = await request(app).post('/api/auth/login').set(HOST).send({ username: 'admin', password: ADMIN_PW });
    expect(res.body.code).toBe('TOO_MANY_ATTEMPTS');
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

  it('answers on the server address listed in ALLOWED_HOSTS, and only there', async () => {
    const server = { Host: '192.168.1.50:8737' };
    expect((await request(app).get('/api/health').set(server)).body.code).toBe('FORBIDDEN_HOST');

    process.env.ALLOWED_HOSTS = '192.168.1.50, nodehub-srv';
    try {
      expect((await request(app).get('/api/health').set(server)).status).toBe(200);
      expect((await request(app).get('/api/health').set({ Host: 'NODEHUB-SRV' })).status).toBe(200);
      // The dashboard opened at the server address is a valid origin; other sites still aren't
      expect((await request(app).post('/api/auth/login').set({ ...server, Origin: 'http://192.168.1.50:8737' })
        .send({ username: 'admin', password: ADMIN_PW })).status).toBe(200);
      expect((await request(app).get('/api/health').set({ ...server, Origin: 'http://192.168.1.99' })).body.code).toBe('FORBIDDEN_ORIGIN');
      expect((await request(app).get('/api/health').set({ Host: 'evil.example' })).body.code).toBe('FORBIDDEN_HOST');
    } finally {
      delete process.env.ALLOWED_HOSTS;
    }
  });

  it('refuses requests sent by pages from other sites', async () => {
    const fromSite = await request(app).post('/api/auth/login').set({ ...HOST, Origin: 'https://evil.example' })
      .send({ username: 'admin', password: ADMIN_PW });
    expect(fromSite.status).toBe(403);
    expect(fromSite.body.code).toBe('FORBIDDEN_ORIGIN');
    expect((await request(app).get('/api/health').set({ ...HOST, Origin: 'null' })).status).toBe(403);

    // The dashboard itself (and the Vite dev server) are local origins; the CLI sends no Origin
    expect((await request(app).get('/api/health').set({ ...HOST, Origin: 'http://127.0.0.1:8737' })).status).toBe(200);
    expect((await request(app).get('/api/health').set({ ...HOST, Origin: 'http://localhost:5173' })).status).toBe(200);
    expect((await request(app).get('/api/health').set(HOST)).status).toBe(200);
  });

  /** A dashboard token for `username` signed `secondsAgo` in the past (another browser, earlier). */
  async function oldToken(username: string, secondsAgo = 60): Promise<string> {
    const iat = Math.floor(Date.now() / 1000) - secondsAgo;
    // The test users were just created; pretend the account is older than the token
    const user = await prisma.user.update({ where: { username }, data: { sessionsValidFrom: new Date((iat - 3600) * 1000) } });
    return jwt.sign({ sub: String(user.id), iat }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '12h' });
  }

  it('changes your own password, keeping this session and signing out the others', async () => {
    const elsewhere = await oldToken('tech');
    expect((await request(app).get('/api/auth/me').set(as(elsewhere))).status).toBe(200);

    const res = await request(app).post('/api/auth/password').set(as(techToken))
      .send({ currentPassword: TECH_PW, newPassword: 'a-new-password-1' });
    expect(res.status).toBe(200);
    expect((await request(app).get('/api/auth/me').set(as(res.body.token))).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set(as(elsewhere))).status).toBe(401);
    expect(await signIn('tech', 'a-new-password-1')).toBeTruthy();
  });

  it('signs a user out everywhere when an admin resets their password', async () => {
    const session = await oldToken('tech');
    const tech = await prisma.user.findUniqueOrThrow({ where: { username: 'tech' } });
    await request(app).patch(`/api/users/${tech.id}`).set(as(adminToken)).send({ password: 'reset-by-admin-1' });
    expect((await request(app).get('/api/auth/me').set(as(session))).status).toBe(401);
  });

  it('only accepts HS256 tokens signed with the secret', async () => {
    const none = jwt.sign({ sub: String(adminId) }, '', { algorithm: 'none' });
    const otherSecret = jwt.sign({ sub: String(adminId) }, 'another-secret-another-secret-123', { algorithm: 'HS256' });
    const hs512 = jwt.sign({ sub: String(adminId) }, process.env.JWT_SECRET!, { algorithm: 'HS512' });
    for (const token of [none, otherSecret, hs512]) {
      expect((await request(app).get('/api/auth/me').set(as(token))).status).toBe(401);
    }
  });
});

// ---------------------------------------------------------------------------
// SSH keys
// ---------------------------------------------------------------------------

describe('ssh keys', () => {
  const PEDRO = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPedroPedroPedroPedroPedroPedroPedroPedro pedro@PC-PEDRO';

  afterAll(() => fs.rmSync(path.join(keysDir, 'pedro.pub'), { force: true }));

  it('lists the team keys with fingerprints, for anyone signed in (PC tokens too)', async () => {
    const token = await createToken(techToken);
    const res = await request(app).get('/api/keys').set(as(token));
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ type: 'ssh-ed25519', name: 'tech', key: 'ssh-ed25519 AAAATEST tech' });
    expect(res.body[0].fingerprint).toMatch(/^SHA256:/);
  });

  it('lets admins add and remove keys, which the installer then includes or drops', async () => {
    expect((await request(app).post('/api/keys').set(as(techToken)).send({ name: 'pedro', publicKey: PEDRO })).status).toBe(403);

    const added = await request(app).post('/api/keys').set(as(adminToken)).send({ name: 'pedro', publicKey: PEDRO });
    expect(added.status).toBe(201);
    expect(fs.readFileSync(path.join(keysDir, 'pedro.pub'), 'utf-8').trim()).toBe(PEDRO);
    expect((await request(app).post('/api/keys').set(as(adminToken)).send({ name: 'other', publicKey: PEDRO })).body.code).toBe('KEY_EXISTS');

    const installer = (await request(app).get('/api/installer').set(as(adminToken))
      .buffer(true).parse((r, cb) => { const c: Buffer[] = []; r.on('data', (d: Buffer) => c.push(d)); r.on('end', () => cb(null, Buffer.concat(c))); })).body as Buffer;
    expect(installer.toString('utf-8')).toContain('pedro@PC-PEDRO');

    expect((await request(app).delete(`/api/keys/${added.body.id}`).set(as(adminToken))).status).toBe(204);
    expect(fs.existsSync(path.join(keysDir, 'pedro.pub'))).toBe(false);
    expect((await request(app).delete(`/api/keys/${added.body.id}`).set(as(adminToken))).body.code).toBe('KEY_NOT_FOUND');
  });

  it('refuses private keys and anything that is not a public key', async () => {
    const priv = await request(app).post('/api/keys').set(as(adminToken))
      .send({ name: 'oops', publicKey: '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaA==\n-----END OPENSSH PRIVATE KEY-----' });
    expect(priv.body.code).toBe('PRIVATE_KEY');
    expect((await request(app).post('/api/keys').set(as(adminToken)).send({ name: 'x', publicKey: 'hello' })).body.code).toBe('INVALID_KEY');
    expect((await request(app).post('/api/keys').set(as(adminToken)).send({ name: '../evil', publicKey: PEDRO })).body.code).toBe('INVALID_KEY');
    expect((await request(app).post('/api/keys').set(as(adminToken)).send({ name: 'q', publicKey: "ssh-ed25519 AAAA x'; rm" })).body.code).toBe('INVALID_KEY');
  });
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

describe('settings', () => {
  it('has English by default, readable without signing in', async () => {
    const res = await request(app).get('/api/settings').set(HOST);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ language: 'en', clientTag: 'tag:client' });
  });

  it('lets admins (and only admins, in the dashboard) change the team language', async () => {
    expect((await request(app).put('/api/settings').set(as(techToken)).send({ language: 'pt' })).status).toBe(403);
    expect((await request(app).put('/api/settings').set(as(adminToken)).send({ language: 'fr' })).body.code).toBe('VALIDATION_ERROR');

    const res = await request(app).put('/api/settings').set(as(adminToken)).send({ language: 'pt' });
    expect(res.body).toEqual({ language: 'pt' });
    expect((await request(app).get('/api/settings').set(HOST)).body).toEqual({ language: 'pt', clientTag: 'tag:client' });
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

  it('keeps a friendly name for a machine, shown in the list, the detail and its sessions', async () => {
    const saved = await request(app).put('/api/machines/new-pc').set(as(techToken))
      .send({ client: 'Client A', displayName: 'PC-PEDRO' });
    expect(saved.body.displayName).toBe('PC-PEDRO');

    const list = await request(app).get('/api/machines').set(as(techToken));
    const machine = list.body.machines.find((m: { host: string }) => m.host === 'new-pc');
    expect(machine).toMatchObject({ host: 'new-pc', displayName: 'PC-PEDRO', configured: true });
    expect(machine.addedAt).toEqual(expect.any(String));   // configured now

    await request(app).post('/api/machines/new-pc/sessions').set(as(techToken)).send({ summary: 'Test', result: 'fixed' });
    const detail = await request(app).get('/api/machines/new-pc').set(as(techToken));
    expect(detail.body.displayName).toBe('PC-PEDRO');
    expect(detail.body.recentSessions[0].machineName).toBe('PC-PEDRO');

    const bad = await request(app).put('/api/machines/new-pc').set(as(techToken)).send({ client: 'Client A', displayName: 'PC "x"; rm' });
    expect(bad.body.code).toBe('VALIDATION_ERROR');
  });

  it('reports when unassigned machines joined the tailnet', async () => {
    const list = await request(app).get('/api/machines').set(as(techToken));
    expect(list.body.machines.find((m: { host: string }) => m.host === 'new-pc').addedAt).toBe('2026-11-20T10:00:00Z');
  });

  it('refuses machines that are not in the tailnet with the client tag', async () => {
    for (const host of ['does-not-exist', 'my-laptop']) {
      const res = await request(app).put(`/api/machines/${host}`).set(as(techToken)).send({ client: 'X' });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('MACHINE_NOT_IN_TAILNET');
    }
  });

  it('only tests SSH against client machines in the tailnet', async () => {
    for (const host of ['intranet-server', 'my-laptop']) {   // unknown, and one of our own (untagged) devices
      const res = await request(app).post(`/api/machines/${host}/ssh-test`).set(as(techToken)).send({});
      expect(res.status, host).toBe(404);
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

    const authKey = process.env.TAILSCALE_AUTHKEY;
    process.env.TAILSCALE_AUTHKEY = '';
    const notReady = await request(app).get('/api/installer/status').set(as(techToken));
    process.env.TAILSCALE_AUTHKEY = authKey;
    expect(notReady.body).toEqual({ ready: false, missing: ['TAILSCALE_AUTHKEY'] });

    const res = await request(app).get('/api/installer').set(as(techToken))
      .buffer(true).parse((r, cb) => { const c: Buffer[] = []; r.on('data', (d: Buffer) => c.push(d)); r.on('end', () => cb(null, Buffer.concat(c))); });
    const body = res.body as Buffer;
    expect([...body.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = body.toString('utf-8');
    expect(text).toContain("'tskey-auth-kTEST123-abcDEF'");
    expect(text).toContain("'ssh-ed25519 AAAATEST tech'");
    expect(text).toContain("$ClientTag  = 'tag:client'");
    expect(text).not.toContain('__NODEHUB_');
    expect(text).toContain("$Language   = 'en'");
  });

  it('shows the installer messages in the team language', async () => {
    await prisma.setting.create({ data: { key: 'language', value: 'pt' } });
    const res = await request(app).get('/api/installer').set(as(techToken))
      .buffer(true).parse((r, cb) => { const c: Buffer[] = []; r.on('data', (d: Buffer) => c.push(d)); r.on('end', () => cb(null, Buffer.concat(c))); });
    expect((res.body as Buffer).toString('utf-8')).toContain("$Language   = 'pt'");
  });
});

// ---------------------------------------------------------------------------
// Connected PCs: browser authorisation (nodehub login) and one token per PC
// ---------------------------------------------------------------------------

async function startLogin(deviceName = 'TECH-LAPTOP') {
  const res = await request(app).post('/api/cli-login').set(HOST).send({ deviceName });
  expect(res.status).toBe(201);
  return res.body as { deviceCode: string; userCode: string; interval: number };
}

const poll = (deviceCode: string) => request(app).post('/api/cli-login/poll').set(HOST).send({ deviceCode });

/** Runs the whole flow: the PC asks, the signed-in user approves, the PC collects its token. */
async function createToken(sessionToken: string, deviceName = 'TECH-LAPTOP'): Promise<string> {
  const { deviceCode, userCode } = await startLogin(deviceName);
  expect((await request(app).post(`/api/cli-login/${userCode}/approve`).set(as(sessionToken))).status).toBe(204);
  const res = await poll(deviceCode);
  expect(res.status).toBe(200);
  return res.body.token;
}

describe('connecting a PC (nodehub login)', () => {
  it('stays pending until approved, then hands the token out exactly once', async () => {
    const { deviceCode, userCode } = await startLogin();
    expect(userCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect((await poll(deviceCode)).status).toBe(202);

    const shown = await request(app).get(`/api/cli-login/${userCode.toLowerCase()}`).set(as(techToken));
    expect(shown.body).toMatchObject({ deviceName: 'TECH-LAPTOP', status: 'PENDING' });

    await request(app).post(`/api/cli-login/${userCode}/approve`).set(as(techToken));
    const approved = await poll(deviceCode);
    expect(approved.status).toBe(200);
    expect(approved.body).toMatchObject({ status: 'approved', deviceName: 'TECH-LAPTOP', user: { username: 'tech' } });
    expect(approved.body.token).toMatch(/^nhk_/);
    expect((await request(app).get('/api/auth/me').set(as(approved.body.token))).body.username).toBe('tech');

    const again = await poll(deviceCode);
    expect(again.body.code).toBe('LOGIN_EXPIRED');
  });

  it('reports denied and expired requests, and unknown codes', async () => {
    const denied = await startLogin();
    await request(app).post(`/api/cli-login/${denied.userCode}/deny`).set(as(techToken));
    expect((await poll(denied.deviceCode)).body.code).toBe('LOGIN_DENIED');

    const expired = await startLogin();
    await prisma.cliLoginRequest.updateMany({ where: { userCode: expired.userCode }, data: { expiresAt: new Date(0) } });
    expect((await poll(expired.deviceCode)).body.code).toBe('LOGIN_EXPIRED');
    expect((await request(app).get(`/api/cli-login/${expired.userCode}`).set(as(techToken))).body.code).toBe('LOGIN_NOT_FOUND');

    expect((await poll('x'.repeat(43))).body.code).toBe('LOGIN_EXPIRED');
  });

  it('can only be answered once, by a signed-in dashboard session', async () => {
    const { userCode } = await startLogin();
    expect((await request(app).post(`/api/cli-login/${userCode}/approve`).set(HOST)).status).toBe(401);

    const token = await createToken(techToken, 'OTHER-PC');
    const viaToken = await request(app).post(`/api/cli-login/${userCode}/approve`).set(as(token));
    expect(viaToken.body.code).toBe('SESSION_REQUIRED');

    await request(app).post(`/api/cli-login/${userCode}/approve`).set(as(techToken));
    const twice = await request(app).post(`/api/cli-login/${userCode}/deny`).set(as(techToken));
    expect(twice.body.code).toBe('LOGIN_ALREADY_DECIDED');
  });

  it('keeps one token per PC: connecting the same PC again replaces its token', async () => {
    const laptop1 = await createToken(techToken, 'LAPTOP');
    const desktop = await createToken(techToken, 'DESKTOP');
    const laptop2 = await createToken(techToken, 'LAPTOP');

    expect((await request(app).get('/api/machines').set(as(laptop1))).status).toBe(401);
    expect((await request(app).get('/api/machines').set(as(laptop2))).status).toBe(200);
    expect((await request(app).get('/api/machines').set(as(desktop))).status).toBe(200);

    const list = await request(app).get('/api/tokens').set(as(techToken));
    expect(list.body.map((t: { name: string }) => t.name).sort()).toEqual(['DESKTOP', 'LAPTOP']);
    expect(list.body[0].token).toBeUndefined();
  });

  it('disconnects one PC without affecting the others, and not someone else\'s', async () => {
    const laptop = await createToken(techToken, 'LAPTOP');
    const desktop = await createToken(techToken, 'DESKTOP');
    const { id } = (await request(app).get('/api/tokens').set(as(techToken))).body.find((t: { name: string }) => t.name === 'LAPTOP');

    expect((await request(app).delete(`/api/tokens/${id}`).set(as(adminToken))).status).toBe(404);
    expect((await request(app).delete(`/api/tokens/${id}`).set(as(techToken))).status).toBe(204);
    expect((await request(app).get('/api/machines').set(as(laptop))).status).toBe(401);
    expect((await request(app).get('/api/machines').set(as(desktop))).status).toBe(200);
  });

  it('PC tokens cannot change the machine list or download the installer (it holds the Tailscale key)', async () => {
    const token = await createToken(techToken);
    for (const [method, url] of [
      ['put', '/api/machines/new-pc'], ['delete', '/api/machines/srv-a'], ['post', '/api/machines/srv-a/ssh-test'],
      ['get', '/api/installer'], ['get', '/api/installer/status'],
    ] as const) {
      const res = await request(app)[method](url).set(as(token)).send({ client: 'X' });
      expect(res.body.code, `${method} ${url}`).toBe('SESSION_REQUIRED');
    }
    // What Claude needs still works
    expect((await request(app).get('/api/machines/srv-a').set(as(token))).status).toBe(200);
    expect((await request(app).put('/api/machines/srv-a/profile').set(as(token)).send({ profile: 'x' })).status).toBe(200);
  });

  it('PC tokens cannot manage PCs, users or passwords, and stop working when the user is deactivated', async () => {
    const token = await createToken(adminToken, 'ADMIN-PC');
    for (const [method, url] of [['get', '/api/tokens'], ['get', '/api/users'], ['post', '/api/auth/password']] as const) {
      const res = await request(app)[method](url).set(as(token)).send({});
      expect(res.body.code).toBe('SESSION_REQUIRED');
    }

    const techPc = await createToken(techToken);
    await prisma.user.update({ where: { username: 'tech' }, data: { active: false } });
    expect((await request(app).get('/api/machines').set(as(techPc))).status).toBe(401);
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

    const technicians = await request(app).get('/api/sessions/technicians').set(as(techToken));
    expect(technicians.body.map((t: { name: string }) => t.name)).toEqual(['Admin', 'Tech']);
  });

  it('shows the newest session date in the machine list', async () => {
    const before = await request(app).get('/api/machines').set(as(techToken));
    expect(before.body.machines.find((m: { host: string }) => m.host === 'srv-a').lastSessionAt).toBeNull();

    await request(app).post('/api/machines/srv-a/sessions').set(as(techToken)).send(session);
    const after = await request(app).get('/api/machines').set(as(techToken));
    expect(after.body.machines.find((m: { host: string }) => m.host === 'srv-a').lastSessionAt).toEqual(expect.any(String));
  });

  it('lets the technician who recorded a session correct it later', async () => {
    const token = await createToken(techToken);   // Claude on the technician's PC
    const created = await request(app).post('/api/machines/srv-a/sessions').set(as(token))
      .send({ ...session, result: 'partial', pending: 'Confirm whether the remote tool was installed by us' });
    expect(created.body.updatedAt).toBeNull();

    const res = await request(app).patch(`/api/sessions/${created.body.id}`).set(as(token))
      .send({ result: 'fixed', pending: '' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ result: 'FIXED', pending: '', summary: 'Disk full', problem: 'Slow PC' });
    expect(res.body.updatedAt).toEqual(expect.any(String));

    const detail = await request(app).get('/api/machines/srv-a').set(as(token));
    expect(detail.body.recentSessions[0]).toMatchObject({ result: 'FIXED', pending: '' });
  });

  it('only lets the author or an admin change a session, and validates the changes', async () => {
    const created = await request(app).post('/api/machines/srv-a/sessions').set(as(techToken)).send(session);
    const url = `/api/sessions/${created.body.id}`;

    // Another technician can't; an admin can
    await prisma.user.create({ data: { username: 'tech2', name: 'Tech 2', role: 'TECHNICIAN', passwordHash: await hashPassword(TECH_PW) } });
    const other = await request(app).patch(url).set(as(await signIn('tech2', TECH_PW))).send({ pending: '' });
    expect(other.status).toBe(403);
    expect((await request(app).patch(url).set(as(adminToken)).send({ pending: 'Check again next week' })).status).toBe(200);

    expect((await request(app).patch(url).set(as(techToken)).send({})).body.code).toBe('VALIDATION_ERROR');
    expect((await request(app).patch(url).set(as(techToken)).send({ result: 'maybe' })).body.code).toBe('VALIDATION_ERROR');
    expect((await request(app).patch(url).set(as(techToken)).send({ host: 'other-pc' })).body.code).toBe('VALIDATION_ERROR');
    expect((await request(app).patch('/api/sessions/999999').set(as(techToken)).send({ pending: '' })).body.code).toBe('SESSION_NOT_FOUND');
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
