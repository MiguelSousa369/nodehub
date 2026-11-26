import crypto from 'crypto';

import prisma from '../lib/prisma';
import { StartCliLoginInput, USER_CODE_ALPHABET } from '../schemas/token.schema';
import { HttpError } from '../utils/http-error';
import { hashSecret, issueToken } from './token.service';

// ---------------------------------------------------------------------------
// Browser authorisation of a PC (device authorisation flow, like `gh auth login`)
//
//   1. CLI:       start()          → device code (secret, kept by the CLI) + user code
//   2. Browser:   /connect?code=…  → signed-in user approves or denies the user code
//   3. CLI:       poll(deviceCode) → pending … then the access token for this PC
// ---------------------------------------------------------------------------

export const LOGIN_TTL_MS   = 10 * 60_000;
export const POLL_INTERVAL  = 2;      // seconds the CLI waits between polls
const MAX_PENDING           = 50;     // open requests at any time (protects the unauthenticated endpoint)

function newUserCode(): string {
  const bytes = crypto.randomBytes(8);
  const chars = [...bytes].map((b) => USER_CODE_ALPHABET[b % USER_CODE_ALPHABET.length]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}

async function findOpen(userCode: string) {
  const request = await prisma.cliLoginRequest.findUnique({ where: { userCode } });
  if (!request || request.expiresAt < new Date()) {
    throw new HttpError(404, 'LOGIN_NOT_FOUND', 'This connection request does not exist or has expired. Run "nodehub login" again.');
  }
  return request;
}

// ---------------------------------------------------------------------------
// 1. Start (CLI, no auth)
// ---------------------------------------------------------------------------

export async function startLogin({ deviceName }: StartCliLoginInput) {
  await prisma.cliLoginRequest.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  if ((await prisma.cliLoginRequest.count({ where: { status: 'PENDING' } })) >= MAX_PENDING) {
    throw new HttpError(429, 'TOO_MANY_REQUESTS', 'Too many pending connection requests. Try again in a few minutes.');
  }

  const deviceCode = crypto.randomBytes(32).toString('base64url');
  let userCode = newUserCode();
  while (await prisma.cliLoginRequest.findUnique({ where: { userCode } })) userCode = newUserCode();

  await prisma.cliLoginRequest.create({
    data: { deviceCodeHash: hashSecret(deviceCode), userCode, deviceName, expiresAt: new Date(Date.now() + LOGIN_TTL_MS) },
  });
  return { deviceCode, userCode, expiresIn: LOGIN_TTL_MS / 1000, interval: POLL_INTERVAL };
}

// ---------------------------------------------------------------------------
// 2. Approve / deny (dashboard, signed in)
// ---------------------------------------------------------------------------

export async function getLogin(userCode: string) {
  const r = await findOpen(userCode);
  return { userCode: r.userCode, deviceName: r.deviceName, status: r.status, createdAt: r.createdAt, expiresAt: r.expiresAt };
}

export async function decideLogin(userCode: string, userId: number, approve: boolean): Promise<{ deviceName: string }> {
  const r = await findOpen(userCode);
  if (r.status !== 'PENDING') throw new HttpError(409, 'LOGIN_ALREADY_DECIDED', 'This connection request was already answered.');
  await prisma.cliLoginRequest.update({
    where: { id: r.id },
    data : { status: approve ? 'APPROVED' : 'DENIED', userId },
  });
  return { deviceName: r.deviceName };
}

// ---------------------------------------------------------------------------
// 3. Poll (CLI, no auth: the device code is the secret)
// ---------------------------------------------------------------------------

type PollResult =
  | { status: 'pending' }
  | { status: 'approved'; token: string; deviceName: string; user: { name: string; username: string } };

export async function pollLogin(deviceCode: string): Promise<PollResult> {
  const r = await prisma.cliLoginRequest.findUnique({
    where  : { deviceCodeHash: hashSecret(deviceCode) },
    include: { user: true },
  });
  if (!r || r.status === 'CONSUMED' || r.expiresAt < new Date()) {
    throw new HttpError(410, 'LOGIN_EXPIRED', 'The connection request expired. Run "nodehub login" again.');
  }
  if (r.status === 'DENIED') throw new HttpError(403, 'LOGIN_DENIED', 'The connection request was denied in the dashboard.');
  if (r.status === 'PENDING' || !r.user) return { status: 'pending' };

  // Hand the token out exactly once, even if two polls race
  const { count } = await prisma.cliLoginRequest.updateMany({
    where: { id: r.id, status: 'APPROVED' },
    data : { status: 'CONSUMED' },
  });
  if (count === 0) throw new HttpError(410, 'LOGIN_EXPIRED', 'The connection request expired. Run "nodehub login" again.');
  if (!r.user.active) throw new HttpError(403, 'LOGIN_DENIED', 'The user who approved this request is deactivated.');

  const { token } = await issueToken(r.user.id, r.deviceName);
  return { status: 'approved', token, deviceName: r.deviceName, user: { name: r.user.name, username: r.user.username } };
}
