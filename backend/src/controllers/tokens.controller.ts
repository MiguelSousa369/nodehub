import { NextFunction, Request, Response } from 'express';

import * as tokenService from '../services/token.service';

// GET /api/token  (your token, without the secret; null if you have none)
export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await tokenService.getToken(req.user!.id));
  } catch (err) {
    next(err);
  }
}

// POST /api/token  (generate, replacing the previous one)
export async function generate(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await tokenService.generateToken(req.user!.id));
  } catch (err) {
    next(err);
  }
}

// DELETE /api/token
export async function revoke(req: Request, res: Response, next: NextFunction) {
  try {
    if (!(await tokenService.revokeToken(req.user!.id))) {
      res.status(404).json({ error: 'You have no access token.', code: 'NOT_FOUND' });
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
