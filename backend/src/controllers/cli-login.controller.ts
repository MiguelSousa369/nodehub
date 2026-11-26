import { NextFunction, Request, Response } from 'express';

import { PollCliLoginSchema, StartCliLoginSchema, UserCodeParamsSchema } from '../schemas/token.schema';
import * as cliLogin from '../services/cli-login.service';
import { audit } from '../utils/audit';

// ---------------------------------------------------------------------------
// POST /api/cli-login  (CLI: start a connection request)
// ---------------------------------------------------------------------------

export async function start(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await cliLogin.startLogin(StartCliLoginSchema.parse(req.body ?? {})));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/cli-login/poll  (CLI: 202 while pending, 200 with the token once approved)
// ---------------------------------------------------------------------------

export async function poll(req: Request, res: Response, next: NextFunction) {
  try {
    const { deviceCode } = PollCliLoginSchema.parse(req.body ?? {});
    const result = await cliLogin.pollLogin(deviceCode);
    if (result.status === 'approved') audit('pc.connected', { username: result.user.username }, { deviceName: result.deviceName });
    res.status(result.status === 'pending' ? 202 : 200).json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/cli-login/:userCode  (dashboard: show the request before approving)
// ---------------------------------------------------------------------------

export async function show(req: Request, res: Response, next: NextFunction) {
  try {
    const { userCode } = UserCodeParamsSchema.parse(req.params);
    res.json(await cliLogin.getLogin(userCode));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/cli-login/:userCode/approve | /deny  (dashboard)
// ---------------------------------------------------------------------------

export function decide(approve: boolean) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userCode } = UserCodeParamsSchema.parse(req.params);
      const { deviceName } = await cliLogin.decideLogin(userCode, req.user!.id, approve);
      audit(approve ? 'pc.approved' : 'pc.denied', req.user!, { deviceName, userCode });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };
}
