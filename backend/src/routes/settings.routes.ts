import { Router } from 'express';

import * as settings from '../controllers/settings.controller';
import { authGuard, requireRole, sessionOnly } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', settings.get);   // public: only the team language, needed before signing in
router.put('/', authGuard, sessionOnly, requireRole(['ADMIN']), settings.update);

export default router;
