import { NextFunction, Request, Response } from 'express';

import { HostParamsSchema, MachineConfigSchema, SshTestSchema } from '../schemas/machine.schema';
import * as machineService from '../services/machine.service';
import { testSsh } from '../services/ssh.service';

// ---------------------------------------------------------------------------
// GET /api/machines
// ---------------------------------------------------------------------------

export async function list(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await machineService.listMachines());
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PUT /api/machines/:host
// ---------------------------------------------------------------------------

export async function save(req: Request, res: Response, next: NextFunction) {
  try {
    const { host } = HostParamsSchema.parse(req.params);
    const config = MachineConfigSchema.parse(req.body ?? {});
    res.json(await machineService.saveMachine(host, config));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/machines/:host
// ---------------------------------------------------------------------------

export function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const { host } = HostParamsSchema.parse(req.params);
    if (!machineService.removeMachine(host)) {
      res.status(404).json({ error: `Machine '${host}' is not configured.`, code: 'NOT_FOUND' });
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/machines/:host/ssh-test
// ---------------------------------------------------------------------------

export async function sshTest(req: Request, res: Response, next: NextFunction) {
  try {
    const { host } = HostParamsSchema.parse(req.params);
    const { sshUser } = SshTestSchema.parse(req.body ?? {});
    res.json(await testSsh(host, sshUser));
  } catch (err) {
    next(err);
  }
}
