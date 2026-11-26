import { Router } from 'express';

import * as sessions from '../controllers/sessions.controller';

const router = Router();

router.get('/', sessions.list);
router.get('/technicians', sessions.technicians);

export default router;
