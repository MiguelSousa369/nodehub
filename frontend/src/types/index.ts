// ---------------------------------------------------------------------------
// Machines
// ---------------------------------------------------------------------------

export interface Machine {
  host      : string          // tailnet name: the key, used for SSH and history
  displayName: string         // friendly name for the team ('' = none)
  client    : string | null   // null = not assigned to a client yet
  sshUser   : string | null
  notes     : string
  configured: boolean
  inTailnet : boolean
  online    : boolean
  ip        : string | null
  os        : string | null
  lastSeen  : string | null
  lastSessionAt: string | null   // newest helpdesk session on this machine
  addedAt   : string | null   // configured in the dashboard (or joined the tailnet, if unassigned)
}

export interface MachineList {
  machines      : Machine[]
  clients       : string[]
  tailscaleError: string | null
}

export interface MachineConfigInput {
  client : string
  displayName: string
  sshUser: string
  notes  : string
}

export interface SshTestResult {
  ok     : boolean
  kind   : 'ok' | 'timeout' | 'error'
  detail : string   // hostname when ok, OpenSSH's error line otherwise
  message: string   // English summary
}

/** What still has to be configured before the installer can be generated. */
export type MissingSetting = 'TAILSCALE_AUTHKEY' | 'PUBLIC_KEYS' | 'INSTALLER_TEMPLATE' | 'CLIENT_TAG'

export interface InstallerStatus {
  ready  : boolean
  missing: MissingSetting[]
}

/** One of the team's SSH public keys. */
export interface PublicKey {
  id         : number
  name       : string   // label, e.g. "laptop"
  type       : string
  comment    : string
  fingerprint: string   // SHA256:... as ssh-keygen shows it
  key        : string
  owner      : { id: number; name: string; username: string; active: boolean } | null   // null = service key
  effective  : boolean  // applied to client PCs (owner active, or service key)
  createdAt  : string
}

/** Team-wide settings (admins change them). */
export interface Settings {
  language: 'en' | 'pt'
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
// Sessions, machine detail and access tokens
// ---------------------------------------------------------------------------

export type SessionResult = 'FIXED' | 'PARTIAL' | 'UNRESOLVED'

export interface Session {
  id        : number
  host      : string
  client    : string | null
  machineName: string        // friendly name of the machine ('' = none)
  technician: { id: number; name: string } | null
  summary   : string
  problem   : string
  diagnosis : string
  actions   : string
  result    : SessionResult
  pending   : string
  createdAt : string
  updatedAt : string | null   // last correction (nodehub update), null if never edited
}

/** A user who recorded sessions (history filter). */
export interface Technician {
  id  : number
  name: string
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
  displayName   : string
  client        : string
  sshUser       : string
  notes         : string
  profile       : string
  updatedAt     : string
  recentSessions: Session[]
  totalSessions : number
}

/** A PC connected with "nodehub login" (its access token, without the secret). */
export interface AccessToken {
  id        : number
  name      : string
  prefix    : string
  createdAt : string
  lastUsedAt: string | null
}

/** A pending "nodehub login" request, shown on the /connect page. */
export interface CliLoginRequest {
  userCode  : string
  deviceName: string
  status    : 'PENDING' | 'APPROVED' | 'DENIED' | 'CONSUMED'
  createdAt : string
  expiresAt : string
}
