import type { InstallerStatus, MachineConfigInput, MachineList, SshTestResult } from '../types'

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
