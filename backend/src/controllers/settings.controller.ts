import { NextFunction, Request, Response } from 'express';

import { clientTag } from '../lib/tailscale';
import { PublicSettings, UpdateSettingsSchema } from '../schemas/settings.schema';
import * as settingsService from '../services/settings.service';
import { audit } from '../utils/audit';

// ---------------------------------------------------------------------------
// GET /api/settings  (no sign-in needed: the login page uses the language)
// ---------------------------------------------------------------------------

export async function get(_req: Request, res: Response, next: NextFunction) {
  try {
    const settings: PublicSettings = { ...(await settingsService.getSettings()), clientTag: clientTag() };
    res.json(settings);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PUT /api/settings  (admins, dashboard session)
// ---------------------------------------------------------------------------

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const input = UpdateSettingsSchema.parse(req.body ?? {});
    const settings = await settingsService.updateSettings(input);
    audit('settings.updated', req.user!, { ...input });
    res.json(settings);
  } catch (err) {
    next(err);
  }
}
