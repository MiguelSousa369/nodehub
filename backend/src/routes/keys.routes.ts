import { Router } from 'express';

import * as keys from '../controllers/keys.controller';
import { sessionOnly } from '../middlewares/auth.middleware';

const router = Router();

// Mounted behind authGuard (server.ts). Who may add or remove which key is checked in keys.service.
router.get('/', keys.list);                       // PC tokens too: "nodehub keys sync" needs the list
router.post('/', sessionOnly, keys.add);          // never with a PC token: a leaked token can't add a key
router.delete('/:id', sessionOnly, keys.remove);

export default router;
