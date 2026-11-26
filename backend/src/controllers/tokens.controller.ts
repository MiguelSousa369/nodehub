import { NextFunction, Request, Response } from 'express';

import { TokenIdParamsSchema } from '../schemas/token.schema';
import * as tokenService from '../services/token.service';
import { audit } from '../utils/audit';

// GET /api/tokens  (your connected PCs)
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await tokenService.listTokens(req.user!.id));
  } catch (err) {
    next(err);
  }
}

// DELETE /api/tokens/:id  (disconnect one of your PCs)
export async function revoke(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = TokenIdParamsSchema.parse(req.params);
    if (!(await tokenService.revokeToken(req.user!.id, id))) {
      res.status(404).json({ error: 'Connected PC not found.', code: 'NOT_FOUND' });
      return;
    }
    audit('pc.disconnected', req.user!, { tokenId: id });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
