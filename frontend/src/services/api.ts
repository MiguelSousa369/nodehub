import type {
  AccessToken, AuthUser, InstallerStatus, LoginResponse, MachineConfigInput, MachineDetail, MachineList,
  SessionFilters, SessionList, SshTestResult, User, UserInput,
} from '../types'

const BASE = '/api'

/** Error carrying the backend's machine-readable `code`. */
export class ApiError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number) {
    super(message)
  }
}

function headers(extra: Record<string, string> = {}): HeadersInit {
  const token = localStorage.getItem('token')
  return { ...extra, ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new ApiError(body.error ?? `HTTP ${res.status}`, body.code ?? 'UNKNOWN', res.status)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

const json = { 'Content-Type': 'application/json' }
const machinePath = (host: string) => `${BASE}/machines/${encodeURIComponent(host)}`

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function login(username: string, password: string): Promise<LoginResponse> {
  return handleResponse(await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: json, body: JSON.stringify({ username, password }),
  }))
}

export async function getMe(): Promise<AuthUser> {
  return handleResponse(await fetch(`${BASE}/auth/me`, { headers: headers() }))
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return handleResponse(await fetch(`${BASE}/auth/password`, {
    method: 'POST', headers: headers(json), body: JSON.stringify({ currentPassword, newPassword }),
  }))
}

// ---------------------------------------------------------------------------
// Users (admins only)
// ---------------------------------------------------------------------------

export async function listUsers(): Promise<User[]> {
  return handleResponse(await fetch(`${BASE}/users`, { headers: headers() }))
}

export async function createUser(input: UserInput): Promise<User> {
  return handleResponse(await fetch(`${BASE}/users`, {
    method: 'POST', headers: headers(json), body: JSON.stringify(input),
  }))
}

export async function updateUser(id: number, input: UserInput): Promise<User> {
  return handleResponse(await fetch(`${BASE}/users/${id}`, {
    method: 'PATCH', headers: headers(json), body: JSON.stringify(input),
  }))
}

export async function deleteUser(id: number): Promise<void> {
  return handleResponse(await fetch(`${BASE}/users/${id}`, { method: 'DELETE', headers: headers() }))
}

// ---------------------------------------------------------------------------
// Machines
// ---------------------------------------------------------------------------

export async function listMachines(): Promise<MachineList> {
  return handleResponse(await fetch(`${BASE}/machines`, { headers: headers() }))
}

export async function saveMachine(host: string, config: MachineConfigInput): Promise<void> {
  await handleResponse(await fetch(machinePath(host), {
    method: 'PUT', headers: headers(json), body: JSON.stringify(config),
  }))
}

export async function deleteMachine(host: string): Promise<void> {
  return handleResponse(await fetch(machinePath(host), { method: 'DELETE', headers: headers() }))
}

export async function testSsh(host: string, sshUser: string): Promise<SshTestResult> {
  return handleResponse(await fetch(`${machinePath(host)}/ssh-test`, {
    method: 'POST', headers: headers(json), body: JSON.stringify({ sshUser }),
  }))
}

export async function getMachine(host: string): Promise<MachineDetail> {
  return handleResponse(await fetch(machinePath(host), { headers: headers() }))
}

export async function updateProfile(host: string, profile: string): Promise<void> {
  await handleResponse(await fetch(`${machinePath(host)}/profile`, {
    method: 'PUT', headers: headers(json), body: JSON.stringify({ profile }),
  }))
}

// ---------------------------------------------------------------------------
// Sessions (helpdesk history)
// ---------------------------------------------------------------------------

export async function listSessions(filters: SessionFilters = {}): Promise<SessionList> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  return handleResponse(await fetch(`${BASE}/sessions?${params}`, { headers: headers() }))
}

// ---------------------------------------------------------------------------
// Personal access tokens (for the nodehub CLI / Claude Code)
// ---------------------------------------------------------------------------

export async function listTokens(): Promise<AccessToken[]> {
  return handleResponse(await fetch(`${BASE}/tokens`, { headers: headers() }))
}

export async function createToken(name: string): Promise<AccessToken & { token: string }> {
  return handleResponse(await fetch(`${BASE}/tokens`, {
    method: 'POST', headers: headers(json), body: JSON.stringify({ name }),
  }))
}

export async function revokeToken(id: number): Promise<void> {
  return handleResponse(await fetch(`${BASE}/tokens/${id}`, { method: 'DELETE', headers: headers() }))
}

// ---------------------------------------------------------------------------
// Installer
// ---------------------------------------------------------------------------

export async function getInstallerStatus(): Promise<InstallerStatus> {
  return handleResponse(await fetch(`${BASE}/installer/status`, { headers: headers() }))
}

/** Downloads the installer (needs the auth header, so a plain link won't do). */
export async function downloadInstaller(): Promise<void> {
  const res = await fetch(`${BASE}/installer`, { headers: headers() })
  if (!res.ok) await handleResponse(res)
  const url = URL.createObjectURL(await res.blob())
  const a = Object.assign(document.createElement('a'), { href: url, download: 'nodehub-install.ps1' })
  a.click()
  URL.revokeObjectURL(url)
}
