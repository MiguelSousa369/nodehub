// ---------------------------------------------------------------------------
// Machines
// ---------------------------------------------------------------------------

export interface Machine {
  host      : string
  client    : string | null   // null = not assigned to a client yet
  sshUser   : string | null
  notes     : string
  configured: boolean
  inTailnet : boolean
  online    : boolean
  ip        : string | null
  os        : string | null
  lastSeen  : string | null
}

export interface MachineList {
  machines      : Machine[]
  clients       : string[]
  tailscaleError: string | null
}

export interface MachineConfigInput {
  client : string
  sshUser: string
  notes  : string
}

export interface SshTestResult {
  ok     : boolean
  message: string
}

export interface InstallerStatus {
  ready  : boolean
  missing: string[]
}

// ---------------------------------------------------------------------------
// Users and auth
// ---------------------------------------------------------------------------

export type Role = 'ADMIN' | 'TECHNICIAN'

export interface AuthUser {
  id      : number
  username: string
  name    : string
  role    : Role
}

export interface User extends AuthUser {
  active   : boolean
  createdAt: string
}

export interface LoginResponse {
  token: string
  user : AuthUser
}

export interface UserInput {
  username?: string
  name?    : string
  password?: string
  role?    : Role
  active?  : boolean
}

// ---------------------------------------------------------------------------
// Navigation (manual router in App.tsx)
// ---------------------------------------------------------------------------

export type Page = 'login' | 'dashboard' | 'history' | 'users'

// ---------------------------------------------------------------------------
// Sessions, machine detail and access tokens
// ---------------------------------------------------------------------------

export type SessionResult = 'FIXED' | 'PARTIAL' | 'UNRESOLVED'

export interface Session {
  id        : number
  host      : string
  client    : string | null
  technician: { id: number; name: string } | null
  summary   : string
  problem   : string
  diagnosis : string
  actions   : string
  result    : SessionResult
  pending   : string
  createdAt : string
}

export interface SessionList {
  sessions: Session[]
  total   : number
}

export interface SessionFilters {
  q?           : string
  result?      : SessionResult | ''
  technicianId?: number
  host?        : string
  limit?       : number
  offset?      : number
}

export interface MachineDetail {
  host          : string
  client        : string
  sshUser       : string
  notes         : string
  profile       : string
  updatedAt     : string
  recentSessions: Session[]
  totalSessions : number
}

export interface AccessToken {
  id        : number
  name      : string
  prefix    : string
  createdAt : string
  lastUsedAt: string | null
}
