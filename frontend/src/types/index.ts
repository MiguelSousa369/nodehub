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

export type Page = 'login' | 'dashboard'
