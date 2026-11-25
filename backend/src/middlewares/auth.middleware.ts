import { NextFunction, Request, Response } from 'express';

import { Role } from '../schemas/user.schema';
import { AuthUser, verifyToken } from '../services/auth.service';
import { TOKEN_PREFIX, verifyApiToken } from '../services/token.service';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?      : AuthUser;
      authMethod?: 'session' | 'token';
    }
  }
}

/**
 * Bearer token, either a dashboard session (JWT) or a personal access token (nhk_...).
 * Populates req.user and req.authMethod.
 */
export async function authGuard(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.get('Authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const isApiToken = token.startsWith(TOKEN_PREFIX);
    const user = !token ? null : isApiToken ? await verifyApiToken(token) : await verifyToken(token);
    if (!user) {
      res.status(401).json({ error: 'Not signed in or session expired.', code: 'UNAUTHORIZED' });
      return;
    }
    req.user = user;
    req.authMethod = isApiToken ? 'token' : 'session';
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Account-level actions (users, tokens, password) need a dashboard session:
 * a leaked access token must not be able to create more tokens or take over the account.
 */
export function sessionOnly(req: Request, res: Response, next: NextFunction) {
  if (req.authMethod !== 'session') {
    res.status(403).json({ error: 'This action requires signing in to the dashboard.', code: 'SESSION_REQUIRED' });
    return;
  }
  next();
}

/** Per-route RBAC; use after authGuard. */
export function requireRole(roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'You do not have permission for this action.', code: 'FORBIDDEN' });
      return;
    }
    next();
  };
}
