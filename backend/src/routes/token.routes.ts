import { Router } from 'express';

import * as token from '../controllers/token.controller';
import { authGuard, sessionOnly } from '../middlewares/auth.middleware';

const router = Router();

router.use(authGuard, sessionOnly);

router.get('/', token.get);
router.post('/', token.generate);
router.delete('/', token.revoke);

export default router;
