import { Router } from 'express';

import * as installer from '../controllers/installer.controller';
import { sessionOnly } from '../middlewares/auth.middleware';

const router = Router();

// The installer contains the Tailscale auth key: dashboard sessions only, never PC tokens
router.use(sessionOnly);

router.get('/status', installer.status);
router.get('/', installer.download);

export default router;
