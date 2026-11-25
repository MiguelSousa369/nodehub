import { NextFunction, Request, Response } from 'express';

import { buildInstaller, getInstallerStatus } from '../services/installer.service';

// GET /api/installer/status
export function status(_req: Request, res: Response) {
  res.json(getInstallerStatus());
}

// GET /api/installer
export function download(_req: Request, res: Response, next: NextFunction) {
  try {
    const file = buildInstaller();
    res
      .type('application/octet-stream')
      .set('Content-Disposition', 'attachment; filename="nodehub-install.ps1"')
      .set('Cache-Control', 'no-store')
      .send(file);
  } catch (err) {
    next(err);
  }
}
