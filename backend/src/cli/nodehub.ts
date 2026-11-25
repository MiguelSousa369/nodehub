/**
 * nodehub CLI: read and record machine history from the terminal (used by Claude Code).
 *
 *   nodehub login                      save a personal access token (created in the dashboard)
 *   nodehub machine <host>             configuration, profile and recent sessions
 *   nodehub history <host>             full session history
 *   nodehub log <host> --file s.json   record a session
 *   nodehub profile <host> --file p.md replace the machine profile
 *
 * Run through nodehub.cmd at the repository root. See docs/cli.md.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';

// ---------------------------------------------------------------------------
// Config: %APPDATA%\nodehub\cli.json (or ~/.config/nodehub/cli.json)
// ---------------------------------------------------------------------------

interface CliConfig {
  url  : string;
  token: string;
}

const CONFIG_DIR = path.join(process.env.APPDATA ?? path.join(os.homedir(), '.config'), 'nodehub');
const CONFIG_FILE = path.join(CONFIG_DIR, 'cli.json');
const DEFAULT_URL = 'http://127.0.0.1:8737';

function loadConfig(): CliConfig | null {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function saveConfig(config: CliConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { encoding: 'utf-8', mode: 0o600 });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

class CliError extends Error {}

function parseArgs(argv: string[]): { positional: string[]; flags: Record<string, string | true> } {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) { flags[arg.slice(2)] = next; i++; }
      else flags[arg.slice(2)] = true;
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function flag(flags: Record<string, string | true>, name: string): string | undefined {
  const v = flags[name];
  return typeof v === 'string' ? v : undefined;
}

function requireHost(positional: string[]): string {
  const host = positional[1];
  if (!host || !/^[A-Za-z0-9-]{1,63}$/.test(host)) throw new CliError('Missing or invalid machine name.');
  return host;
}

async function api<T>(method: string, route: string, body?: unknown): Promise<T> {
  const config = loadConfig();
  if (!config) throw new CliError('Not signed in. Run: nodehub login');

  let res: Response;
  try {
    res = await fetch(`${config.url}${route}`, {
      method,
      headers: { Authorization: `Bearer ${config.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body   : body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new CliError(`Cannot reach nodehub at ${config.url}. Is the dashboard running (start.cmd)?`);
  }

  if (res.status === 401) throw new CliError('Token rejected (revoked or user deactivated). Run: nodehub login');
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const details = Array.isArray(err.details) ? ` ${err.details.map((d: { message: string; path: string[] }) => `${d.path.join('.')}: ${d.message}`).join('; ')}` : '';
    throw new CliError(`${err.error ?? `HTTP ${res.status}`}${details}`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); }));
}

const date = (iso: string) => new Date(iso).toISOString().slice(0, 16).replace('T', ' ');

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

interface Session {
  id: number; host: string; client: string | null; technician: { name: string } | null;
  summary: string; problem: string; diagnosis: string; actions: string; result: string; pending: string; createdAt: string;
}

function printSession(s: Session): void {
  console.log(`\n### ${date(s.createdAt)}: ${s.summary}`);
  console.log(`- Technician: ${s.technician?.name ?? '(deleted user)'}`);
  for (const [label, value] of [['Problem', s.problem], ['Diagnosis', s.diagnosis], ['Actions', s.actions]] as const) {
    if (value) console.log(`- ${label}: ${value}`);
  }
  console.log(`- Result: ${s.result.toLowerCase()}`);
  if (s.pending) console.log(`- Pending: ${s.pending}`);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdLogin(flags: Record<string, string | true>) {
  const url = (flag(flags, 'url') ?? loadConfig()?.url ?? DEFAULT_URL).replace(/\/+$/, '');
  const token = flag(flags, 'token') ?? await ask('Personal access token (dashboard → Access token): ');
  if (!token.startsWith('nhk_')) throw new CliError('That does not look like a nodehub access token (nhk_...).');

  saveConfig({ url, token });
  try {
    const me = await api<{ name: string; username: string }>('GET', '/api/auth/me');
    console.log(`Signed in as ${me.name} (${me.username}) on ${url}.`);
  } catch (err) {
    fs.rmSync(CONFIG_FILE, { force: true });
    throw err;
  }
}

async function cmdWhoami() {
  const me = await api<{ name: string; username: string; role: string }>('GET', '/api/auth/me');
  console.log(`${me.name} (${me.username}, ${me.role.toLowerCase()}) on ${loadConfig()!.url}`);
}

async function cmdMachine(host: string, json: boolean) {
  const m = await api<{
    host: string; client: string; sshUser: string; notes: string; profile: string;
    recentSessions: Session[]; totalSessions: number;
  }>('GET', `/api/machines/${encodeURIComponent(host)}`);
  if (json) return console.log(JSON.stringify(m, null, 2));

  console.log(`# ${m.host}\n`);
  console.log(`Client:   ${m.client}`);
  console.log(`SSH user: ${m.sshUser}`);
  if (m.notes) console.log(`Notes:    ${m.notes}`);
  console.log(`\n## Profile\n\n${m.profile || '(empty: fill it in with "nodehub profile")'}`);
  console.log(`\n## Recent sessions (${m.recentSessions.length} of ${m.totalSessions})`);
  if (m.recentSessions.length === 0) console.log('\n(none yet)');
  m.recentSessions.forEach(printSession);
}

async function cmdHistory(host: string, flags: Record<string, string | true>) {
  const limit = Number(flag(flags, 'limit') ?? 50);
  const { sessions, total } = await api<{ sessions: Session[]; total: number }>(
    'GET', `/api/machines/${encodeURIComponent(host)}/sessions?limit=${limit}`);
  if (flags.json) return console.log(JSON.stringify({ sessions, total }, null, 2));
  console.log(`# ${host}: ${sessions.length} of ${total} sessions`);
  sessions.forEach(printSession);
}

async function cmdLog(host: string, flags: Record<string, string | true>) {
  const file = flag(flags, 'file');
  const body = file
    ? JSON.parse(fs.readFileSync(file, 'utf-8').replace(/^﻿/, ''))
    : Object.fromEntries(['summary', 'problem', 'diagnosis', 'actions', 'result', 'pending']
      .flatMap((k) => (flag(flags, k) !== undefined ? [[k, flag(flags, k)]] : [])));
  const s = await api<Session>('POST', `/api/machines/${encodeURIComponent(host)}/sessions`, body);
  console.log(`Session #${s.id} recorded for ${s.host} (${s.result.toLowerCase()}).`);
}

async function cmdProfile(host: string, flags: Record<string, string | true>) {
  const file = flag(flags, 'file');
  const text = flag(flags, 'text');
  if (!file && text === undefined) throw new CliError('Use --file <profile.md> or --text "<profile>".');
  const profile = file ? fs.readFileSync(file, 'utf-8').replace(/^﻿/, '') : text!;
  await api('PUT', `/api/machines/${encodeURIComponent(host)}/profile`, { profile });
  console.log(`Profile of ${host} updated.`);
}

const HELP = `nodehub CLI

  nodehub login [--token nhk_...] [--url http://127.0.0.1:8737]
  nodehub logout
  nodehub whoami
  nodehub machine <host> [--json]          configuration, profile and recent sessions
  nodehub history <host> [--limit 50] [--json]
  nodehub log <host> --file session.json   record a session (JSON with summary, problem,
                                           diagnosis, actions, result, pending)
  nodehub log <host> --summary "..." --result fixed|partial|unresolved [--problem ...] ...
  nodehub profile <host> --file profile.md replace the machine profile (Markdown)

Docs: docs/cli.md`;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  switch (positional[0]) {
    case 'login'  : return cmdLogin(flags);
    case 'logout' : fs.rmSync(CONFIG_FILE, { force: true }); return console.log('Signed out.');
    case 'whoami' : return cmdWhoami();
    case 'machine': return cmdMachine(requireHost(positional), Boolean(flags.json));
    case 'history': return cmdHistory(requireHost(positional), flags);
    case 'log'    : return cmdLog(requireHost(positional), flags);
    case 'profile': return cmdProfile(requireHost(positional), flags);
    default       : return console.log(HELP);
  }
}

main().catch((err) => {
  console.error(`Error: ${err instanceof CliError ? err.message : (err as Error).stack}`);
  process.exit(1);
});
