import { NextFunction, Request, Response } from 'express';

import { CreateUserSchema, UpdateUserSchema, UserIdParamsSchema } from '../schemas/user.schema';
import * as userService from '../services/user.service';

// ---------------------------------------------------------------------------
// GET /api/users
// ---------------------------------------------------------------------------

export async function list(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await userService.listUsers());
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/users
// ---------------------------------------------------------------------------

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await userService.createUser(CreateUserSchema.parse(req.body ?? {})));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/users/:id
// ---------------------------------------------------------------------------

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = UserIdParamsSchema.parse(req.params);
    const user = await userService.updateUser(id, UpdateUserSchema.parse(req.body ?? {}), req.user!.id);
    if (!user) {
      res.status(404).json({ error: 'User not found.', code: 'NOT_FOUND' });
      return;
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/users/:id
// ---------------------------------------------------------------------------

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = UserIdParamsSchema.parse(req.params);
    if (!(await userService.deleteUser(id, req.user!.id))) {
      res.status(404).json({ error: 'User not found.', code: 'NOT_FOUND' });
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
