import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import * as keys from '../services/keys.service';
import { audit } from '../utils/audit';

const AddKeySchema = z.object({
  name     : z.string().trim().min(1).max(40),
  publicKey: z.string().trim().min(1).max(10_000),
}).strict();

const KeyIdParamsSchema = z.object({ id: z.string().regex(/^[0-9a-f]{64}$/) });

// ---------------------------------------------------------------------------
// GET /api/keys  (any signed-in user or PC: "nodehub keys sync" reads it)
// ---------------------------------------------------------------------------

export function list(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(keys.listKeys());
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/keys  (admins, dashboard session)
// ---------------------------------------------------------------------------

export function add(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, publicKey } = AddKeySchema.parse(req.body ?? {});
    const key = keys.addKey(name, publicKey);
    audit('key.added', req.user!, { name: key.name, fingerprint: key.fingerprint, comment: key.comment });
    res.status(201).json(key);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/keys/:id  (admins, dashboard session)
// ---------------------------------------------------------------------------

export function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = KeyIdParamsSchema.parse(req.params);
    const key = keys.removeKey(id);
    audit('key.removed', req.user!, { name: key.name, fingerprint: key.fingerprint, comment: key.comment });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
