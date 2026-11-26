import { NextFunction, Request, Response } from 'express';

import { HostParamsSchema } from '../schemas/machine.schema';
import {
  CreateSessionSchema, ProfileSchema, SessionIdParamsSchema, SessionQuerySchema, UpdateSessionSchema,
} from '../schemas/session.schema';
import * as sessionService from '../services/session.service';
import { audit } from '../utils/audit';

// ---------------------------------------------------------------------------
// GET /api/sessions  (history across all machines, with filters)
// ---------------------------------------------------------------------------

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await sessionService.listSessions(SessionQuerySchema.parse(req.query)));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/sessions/technicians  (who has recorded sessions, for the history filter)
// ---------------------------------------------------------------------------

export async function technicians(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await sessionService.listTechnicians());
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/machines/:host/sessions
// ---------------------------------------------------------------------------

export async function listForMachine(req: Request, res: Response, next: NextFunction) {
  try {
    const { host } = HostParamsSchema.parse(req.params);
    res.json(await sessionService.listSessions(SessionQuerySchema.parse({ ...req.query, host })));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/machines/:host/sessions  (logged as the signed-in technician)
// ---------------------------------------------------------------------------

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { host } = HostParamsSchema.parse(req.params);
    const input = CreateSessionSchema.parse(req.body ?? {});
    res.status(201).json(await sessionService.createSession(host, input, req.user!.id));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/sessions/:id  (correct a recorded session: its author or an admin)
// ---------------------------------------------------------------------------

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = SessionIdParamsSchema.parse(req.params);
    const input = UpdateSessionSchema.parse(req.body ?? {});
    const session = await sessionService.updateSession(id, input, req.user!);
    audit('session.updated', req.user!, { sessionId: id, host: session.host, changed: Object.keys(input) });
    res.json(session);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/machines/:host  (configuration, profile and recent sessions)
// ---------------------------------------------------------------------------

export async function detail(req: Request, res: Response, next: NextFunction) {
  try {
    const { host } = HostParamsSchema.parse(req.params);
    const machine = await sessionService.getMachineDetail(host);
    if (!machine) {
      res.status(404).json({ error: `Machine '${host}' is not configured.`, code: 'NOT_FOUND' });
      return;
    }
    res.json(machine);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PUT /api/machines/:host/profile
// ---------------------------------------------------------------------------

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const { host } = HostParamsSchema.parse(req.params);
    const { profile } = ProfileSchema.parse(req.body ?? {});
    res.json(await sessionService.updateProfile(host, profile));
  } catch (err) {
    next(err);
  }
}
