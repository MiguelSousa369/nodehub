import { Router } from 'express';

import * as keys from '../controllers/keys.controller';
import { requireRole, sessionOnly } from '../middlewares/auth.middleware';

const router = Router();

// Mounted behind authGuard (server.ts)
router.get('/', keys.list);   // PC tokens too: "nodehub keys sync" needs the list
router.post('/', sessionOnly, requireRole(['ADMIN']), keys.add);
router.delete('/:id', sessionOnly, requireRole(['ADMIN']), keys.remove);

export default router;
