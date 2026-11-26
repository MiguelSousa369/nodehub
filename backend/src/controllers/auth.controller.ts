import { NextFunction, Request, Response } from 'express';

import { ChangePasswordSchema, LoginSchema } from '../schemas/user.schema';
import * as authService from '../services/auth.service';

// POST /api/auth/login
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await authService.login(LoginSchema.parse(req.body ?? {})));
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me
export function me(req: Request, res: Response) {
  res.json(req.user);
}

// POST /api/auth/password
export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await authService.changePassword(req.user!.id, ChangePasswordSchema.parse(req.body ?? {})));
  } catch (err) {
    next(err);
  }
}
