import { Router } from 'express';

import * as tokens from '../controllers/tokens.controller';
import { authGuard, sessionOnly } from '../middlewares/auth.middleware';

const router = Router();

router.use(authGuard, sessionOnly);

router.get('/', tokens.list);
router.delete('/:id', tokens.revoke);

export default router;
