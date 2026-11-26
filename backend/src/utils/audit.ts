import path from 'path';
import winston from 'winston';

import logger from './logger';

// ---------------------------------------------------------------------------
// Security audit log: who signed in (or failed to), who changed users, connected or disconnected
// PCs, downloaded the installer or changed the machine list, and requests refused as cross-site.
//
// One JSON line per event in backend/logs/audit.log (also mirrored to the normal log).
// Never pass passwords, tokens, device codes or auth keys here: only names and ids.
// ---------------------------------------------------------------------------

export type AuditEvent =
  | 'login.success' | 'login.failure' | 'login.locked'
  | 'password.changed'
  | 'user.created' | 'user.updated' | 'user.deleted'
  | 'pc.approved' | 'pc.denied' | 'pc.connected' | 'pc.disconnected'
  | 'installer.downloaded'
  | 'machine.saved' | 'machine.removed'
  | 'session.updated'
  | 'settings.updated'
  | 'key.added' | 'key.removed'
  | 'request.forbidden';

const auditLog = winston.createLogger({
  format    : winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.File({
    filename: path.resolve(__dirname, '../../logs/audit.log'),
    maxsize : 10 * 1024 * 1024,
    maxFiles: 10,
    tailable: true,
  })],
  silent: process.env.NODE_ENV === 'test',
});

/** Who did it: a signed-in user, or a name when there is no account (failed sign-in). */
type Actor = { id: number; username: string } | { username: string } | null;

export function audit(event: AuditEvent, actor: Actor, details: Record<string, unknown> = {}): void {
  const entry = { event, actor: actor ?? undefined, ...details };
  auditLog.info('audit', entry);
  const level = event === 'login.failure' || event === 'login.locked' || event === 'request.forbidden' ? 'warn' : 'info';
  logger.log(level, `audit ${event}`, entry);
}
