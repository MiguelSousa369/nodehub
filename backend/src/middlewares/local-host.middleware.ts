import { NextFunction, Request, Response } from 'express';

const ALLOWED_HOSTS = new Set(['127.0.0.1', 'localhost']);

/** DNS rebinding protection: only accept requests addressed to localhost. */
export function localHostOnly(req: Request, res: Response, next: NextFunction) {
  const host = (req.get('Host') ?? '').replace(/:\d+$/, '');
  if (!ALLOWED_HOSTS.has(host)) {
    res.status(403).json({ error: 'Forbidden host.', code: 'FORBIDDEN_HOST' });
    return;
  }
  next();
}
