import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';

/** Static API key: `Authorization: Bearer <API_KEY>`. */
export function apiKeyGuard(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.API_KEY ?? '';
  const header = req.get('Authorization') ?? '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';

  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (!expected || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    res.status(401).json({ error: 'Missing or invalid API key.', code: 'UNAUTHORIZED' });
    return;
  }
  next();
}
