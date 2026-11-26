import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared rules
// ---------------------------------------------------------------------------

export const DEFAULT_SSH_USER = 'nodehub';

// These values end up on a command line (launcher, ssh), so quotes, ; and $ are not allowed.
const SAFE_TEXT = /^[^"`;$\r\n]*$/;

export const HostnameSchema = z
  .string()
  .regex(/^[A-Za-z0-9-]{1,63}$/, 'Invalid hostname (letters, digits and hyphens only).');

export const SshUserSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9._-]{1,64}$/, 'Invalid SSH user.');

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

export const HostParamsSchema = z.object({ host: HostnameSchema });

export const MachineConfigSchema = z.object({
  client : z.string().trim().min(1).max(100).regex(SAFE_TEXT, 'Client contains forbidden characters.'),
  sshUser: SshUserSchema.default(DEFAULT_SSH_USER),
  notes  : z.string().trim().max(500).regex(SAFE_TEXT, 'Notes contain forbidden characters.').default(''),
});

export const SshTestSchema = z.object({
  sshUser: SshUserSchema.default(DEFAULT_SSH_USER),
});

export type MachineConfig = z.infer<typeof MachineConfigSchema>;
export type SshTestInput  = z.infer<typeof SshTestSchema>;

// ---------------------------------------------------------------------------
// Response shape: Tailscale state + configuration
// ---------------------------------------------------------------------------

export interface Machine {
  host      : string;
  client    : string | null;   // null = not assigned to a client yet
  sshUser   : string | null;
  notes     : string;
  configured: boolean;
  inTailnet : boolean;
  online    : boolean;
  ip        : string | null;
  os        : string | null;
  lastSeen  : string | null;
  lastSessionAt: Date | null;   // newest helpdesk session on this host
}
