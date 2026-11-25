import { Router } from 'express';

import * as cliLogin from '../controllers/cli-login.controller';
import { authGuard, sessionOnly } from '../middlewares/auth.middleware';

const router = Router();

// Called by the CLI (no account yet: the device code is the secret)
router.post('/', cliLogin.start);
router.post('/poll', cliLogin.poll);

// Called by the dashboard, signed in
router.get('/:userCode', authGuard, sessionOnly, cliLogin.show);
router.post('/:userCode/approve', authGuard, sessionOnly, cliLogin.decide(true));
router.post('/:userCode/deny', authGuard, sessionOnly, cliLogin.decide(false));

export default router;
