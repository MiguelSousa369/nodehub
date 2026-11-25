import { Router } from 'express';

import * as auth from '../controllers/auth.controller';
import { authGuard } from '../middlewares/auth.middleware';

const router = Router();

router.post('/login', auth.login);
router.get('/me', authGuard, auth.me);
router.post('/password', authGuard, auth.changePassword);

export default router;
