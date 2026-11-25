import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Setup: temp data dir, fake Tailscale peers, test API key
// ---------------------------------------------------------------------------

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nodehub-test-'));
process.env.NODE_ENV = 'test';
process.env.API_KEY = 'test-key';
process.env.DATA_DIR = path.join(tmp, 'data');
process.env.PUBLIC_KEYS_DIR = path.join(tmp, 'keys');
process.env.TAILSCALE_AUTHKEY = 'tskey-auth-kTEST123-abcDEF';

vi.mock('../src/lib/tailscale', () => ({
  CLIENT_TAG: 'tag:cliente',
  getPeers: vi.fn(async () => [
    { host: 'srv-a',    ip: '100.64.0.1', os: 'windows', online: true,  lastSeen: null, tags: ['tag:cliente'] },
    { host: 'new-pc',   ip: '100.64.0.2', os: 'windows', online: true,  lastSeen: null, tags: ['tag:cliente'] },
    { host: 'my-laptop', ip: '100.64.0.3', os: 'windows', online: true, lastSeen: null, tags: [] },
  ]),
}));

const auth = { Authorization: 'Bearer test-key' };
let app: import('express').Express;
let store: typeof import('../src/lib/store');

beforeAll(async () => {
  fs.mkdirSync(process.env.PUBLIC_KEYS_DIR!, { recursive: true });
  fs.writeFileSync(path.join(process.env.PUBLIC_KEYS_DIR!, 'tech.pub'), 'ssh-ed25519 AAAATEST tech\n');
  store = await import('../src/lib/store');
  app = (await import('../src/server')).default;
});

beforeEach(() => {
  fs.rmSync(process.env.DATA_DIR!, { recursive: true, force: true });
  store.initStore();
  store.saveConfig('srv-a', { client: 'Client A', sshUser: 'nodehub', notes: '' });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('security', () => {
  it('rejects requests without the API key', async () => {
    const res = await request(app).get('/api/machines');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('rejects requests addressed to another host (DNS rebinding)', async () => {
    const res = await request(app).get('/api/health').set('Host', 'evil.example');
    expect(res.status).toBe(403);
  });

  it('serves health without auth', async () => {
    const res = await request(app).get('/api/health').set('Host', '127.0.0.1');
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('machines', () => {
  it('lists configured and unassigned client machines, hiding our own devices', async () => {
    const res = await request(app).get('/api/machines').set('Host', '127.0.0.1').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.machines.map((m: { host: string }) => m.host)).toEqual(['srv-a', 'new-pc']);
    expect(res.body.machines[1]).toMatchObject({ configured: false, client: null });
    expect(res.body.clients).toEqual(['Client A']);
  });

  it('configures a new machine with nodehub as default SSH user', async () => {
    const res = await request(app).put('/api/machines/new-pc').set('Host', '127.0.0.1').set(auth)
      .send({ client: 'Client B' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ host: 'new-pc', client: 'Client B', sshUser: 'nodehub' });
    expect(store.getConfig('new-pc')?.config.client).toBe('Client B');
  });

  it('refuses machines that are not in the tailnet with the client tag', async () => {
    for (const host of ['does-not-exist', 'my-laptop']) {
      const res = await request(app).put(`/api/machines/${host}`).set('Host', '127.0.0.1').set(auth)
        .send({ client: 'X' });
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
      const res = await request(app).put(`/api/machines/${host}`).set('Host', '127.0.0.1').set(auth).send(body);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    }
  });

  it('removes a machine, which then shows up as unassigned', async () => {
    const del = await request(app).delete('/api/machines/srv-a').set('Host', '127.0.0.1').set(auth);
    expect(del.status).toBe(204);
    const res = await request(app).get('/api/machines').set('Host', '127.0.0.1').set(auth);
    expect(res.body.machines.find((m: { host: string }) => m.host === 'srv-a')).toMatchObject({ configured: false });
    const again = await request(app).delete('/api/machines/srv-a').set('Host', '127.0.0.1').set(auth);
    expect(again.status).toBe(404);
  });
});

describe('installer', () => {
  it('reports ready and fills in the auth key and public keys', async () => {
    const status = await request(app).get('/api/installer/status').set('Host', '127.0.0.1').set(auth);
    expect(status.body).toEqual({ ready: true, missing: [] });

    const res = await request(app).get('/api/installer').set('Host', '127.0.0.1').set(auth)
      .buffer(true).parse((r, cb) => { const c: Buffer[] = []; r.on('data', (d: Buffer) => c.push(d)); r.on('end', () => cb(null, Buffer.concat(c))); });
    const body = res.body as Buffer;
    expect(res.status).toBe(200);
    expect([...body.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = body.toString('utf-8');
    expect(text).toContain("'tskey-auth-kTEST123-abcDEF'");
    expect(text).toContain("'ssh-ed25519 AAAATEST tech'");
    expect(text).not.toContain('__NODEHUB_');
  });
});
