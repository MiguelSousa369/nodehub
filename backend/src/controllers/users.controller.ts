import { NextFunction, Request, Response } from 'express';

import { CreateUserSchema, UpdateUserSchema, UserIdParamsSchema } from '../schemas/user.schema';
import * as userService from '../services/user.service';
import { audit } from '../utils/audit';

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
    const user = await userService.createUser(CreateUserSchema.parse(req.body ?? {}));
    audit('user.created', req.user!, { target: user.username, role: user.role });
    res.status(201).json(user);
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
    const input = UpdateUserSchema.parse(req.body ?? {});
    const user = await userService.updateUser(id, input, req.user!.id);
    if (!user) {
      res.status(404).json({ error: 'User not found.', code: 'NOT_FOUND' });
      return;
    }
    // Which fields changed, never their values for the password
    const changed = Object.keys(input).filter((k) => input[k as keyof typeof input] !== undefined);
    audit('user.updated', req.user!, { target: user.username, changed, role: input.role, active: input.active });
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
    audit('user.deleted', req.user!, { targetId: id });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
