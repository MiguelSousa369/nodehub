import { NextFunction, Request, Response } from 'express';

import { HostParamsSchema, MachineConfigSchema, SshTestSchema } from '../schemas/machine.schema';
import * as machineService from '../services/machine.service';
import { testSsh } from '../services/ssh.service';
import { audit } from '../utils/audit';

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
    const saved = await machineService.saveMachine(host, config);
    audit('machine.saved', req.user!, { host: saved.host, client: saved.client, sshUser: saved.sshUser });
    res.json(saved);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/machines/:host
// ---------------------------------------------------------------------------

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const { host } = HostParamsSchema.parse(req.params);
    if (!(await machineService.removeMachine(host))) {
      res.status(404).json({ error: `Machine '${host}' is not configured.`, code: 'NOT_FOUND' });
      return;
    }
    audit('machine.removed', req.user!, { host });
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
    const peer = await machineService.findClientPeer(host);   // only client machines in the tailnet
    res.json(await testSsh(peer.host, sshUser));
  } catch (err) {
    next(err);
  }
}
