import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import * as keys from '../services/keys.service';
import { audit } from '../utils/audit';

const AddKeySchema = z.object({
  name     : z.string().trim().min(1).max(60).regex(/^[^"`;$\r\n]*$/, 'Name contains forbidden characters.'),
  publicKey: z.string().trim().min(1).max(10_000),
  /** Admins only: the owner's user id, or null for a service key. Ignored for technicians. */
  userId   : z.number().int().positive().nullable().optional(),
}).strict();

const KeyIdParamsSchema = z.object({ id: z.coerce.number().int().positive() });

// ---------------------------------------------------------------------------
// GET /api/keys  (anyone signed in, PC tokens too: "nodehub keys sync" reads it)
// ---------------------------------------------------------------------------

export async function list(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await keys.listKeys());
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/keys  (dashboard session: your own key; admins may add one for anyone, or a service key)
// ---------------------------------------------------------------------------

export async function add(req: Request, res: Response, next: NextFunction) {
  try {
    const key = await keys.addKey(AddKeySchema.parse(req.body ?? {}), req.user!);
    audit('key.added', req.user!, { keyId: key.id, name: key.name, fingerprint: key.fingerprint, owner: key.owner?.username ?? null });
    res.status(201).json(key);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/keys/:id  (dashboard session: your own keys; admins any)
// ---------------------------------------------------------------------------

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = KeyIdParamsSchema.parse(req.params);
    const key = await keys.removeKey(id, req.user!);
    audit('key.removed', req.user!, { keyId: key.id, name: key.name, fingerprint: key.fingerprint, owner: key.owner?.username ?? null });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
