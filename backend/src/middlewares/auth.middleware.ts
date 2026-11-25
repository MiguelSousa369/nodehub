import { NextFunction, Request, Response } from 'express';

import { Role } from '../schemas/user.schema';
import { AuthUser, verifyToken } from '../services/auth.service';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/** JWT bearer token: populates req.user. */
export async function authGuard(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.get('Authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const user = token ? await verifyToken(token) : null;
    if (!user) {
      res.status(401).json({ error: 'Not signed in or session expired.', code: 'UNAUTHORIZED' });
      return;
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
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
