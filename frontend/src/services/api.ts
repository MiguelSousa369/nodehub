import { getMessages } from '../i18n'
import type {
  AccessToken, AuthUser, CliLoginRequest, InstallerStatus, LoginResponse, MachineConfigInput, MachineDetail, MachineList,
  PublicKey, SessionFilters, SessionList, Settings, SshTestResult, Technician, User, UserInput,
} from '../types'

const BASE = '/api'

/** Error carrying the backend's machine-readable `code`; the message is in the active language when known. */
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
    const code = body.code ?? 'UNKNOWN'
    throw new ApiError(getMessages().errors[code] ?? body.error ?? `HTTP ${res.status}`, code, res.status)
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

/** Changes your password; returns a fresh token (your other sessions are signed out). */
export async function changePassword(currentPassword: string, newPassword: string): Promise<{ token: string }> {
  return handleResponse(await fetch(`${BASE}/auth/password`, {
    method: 'POST', headers: headers(json), body: JSON.stringify({ currentPassword, newPassword }),
  }))
}

// ---------------------------------------------------------------------------
// Team settings (read: anyone; change: admins)
// ---------------------------------------------------------------------------

export async function getSettings(): Promise<Settings> {
  return handleResponse(await fetch(`${BASE}/settings`))
}

export async function updateSettings(settings: Settings): Promise<Settings> {
  return handleResponse(await fetch(`${BASE}/settings`, {
    method: 'PUT', headers: headers(json), body: JSON.stringify(settings),
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

/** Users who recorded at least one session, for the history's technician filter. */
export async function listTechnicians(): Promise<Technician[]> {
  return handleResponse(await fetch(`${BASE}/sessions/technicians`, { headers: headers() }))
}

// ---------------------------------------------------------------------------
// Connected PCs (one access token per PC, created by "nodehub login")
// ---------------------------------------------------------------------------

export async function listTokens(): Promise<AccessToken[]> {
  return handleResponse(await fetch(`${BASE}/tokens`, { headers: headers() }))
}

export async function revokeToken(id: number): Promise<void> {
  return handleResponse(await fetch(`${BASE}/tokens/${id}`, { method: 'DELETE', headers: headers() }))
}

export async function getCliLogin(userCode: string): Promise<CliLoginRequest> {
  return handleResponse(await fetch(`${BASE}/cli-login/${encodeURIComponent(userCode)}`, { headers: headers() }))
}

export async function decideCliLogin(userCode: string, approve: boolean): Promise<void> {
  return handleResponse(await fetch(`${BASE}/cli-login/${encodeURIComponent(userCode)}/${approve ? 'approve' : 'deny'}`, {
    method: 'POST', headers: headers(),
  }))
}

// ---------------------------------------------------------------------------
// The team's SSH public keys (admins add and remove)
// ---------------------------------------------------------------------------

export async function listKeys(): Promise<PublicKey[]> {
  return handleResponse(await fetch(`${BASE}/keys`, { headers: headers() }))
}

export async function addKey(name: string, publicKey: string): Promise<PublicKey> {
  return handleResponse(await fetch(`${BASE}/keys`, {
    method: 'POST', headers: headers(json), body: JSON.stringify({ name, publicKey }),
  }))
}

export async function removeKey(id: string): Promise<void> {
  return handleResponse(await fetch(`${BASE}/keys/${id}`, { method: 'DELETE', headers: headers() }))
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
