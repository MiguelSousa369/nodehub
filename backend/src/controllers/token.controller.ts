import { NextFunction, Request, Response } from 'express';

import { CreateTokenSchema, TokenIdParamsSchema } from '../schemas/token.schema';
import * as tokenService from '../services/token.service';

// GET /api/tokens  (your own tokens)
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await tokenService.listTokens(req.user!.id));
  } catch (err) {
    next(err);
  }
}

// POST /api/tokens
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await tokenService.createToken(req.user!.id, CreateTokenSchema.parse(req.body ?? {})));
  } catch (err) {
    next(err);
  }
}

// DELETE /api/tokens/:id
export async function revoke(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = TokenIdParamsSchema.parse(req.params);
    if (!(await tokenService.revokeToken(req.user!.id, id))) {
      res.status(404).json({ error: 'Token not found.', code: 'NOT_FOUND' });
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
