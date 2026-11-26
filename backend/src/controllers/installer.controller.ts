import { NextFunction, Request, Response } from 'express';

import { buildInstaller, getInstallerStatus } from '../services/installer.service';
import { getSettings } from '../services/settings.service';
import { audit } from '../utils/audit';

// GET /api/installer/status
export function status(_req: Request, res: Response) {
  res.json(getInstallerStatus());
}

// GET /api/installer
export async function download(req: Request, res: Response, next: NextFunction) {
  try {
    const file = buildInstaller((await getSettings()).language);   // messages in the team language
    audit('installer.downloaded', req.user!);   // it contains the Tailscale auth key
    res
      .type('application/octet-stream')
      .set('Content-Disposition', 'attachment; filename="nodehub-install.ps1"')
      .set('Cache-Control', 'no-store')
      .send(file);
  } catch (err) {
    next(err);
  }
}
