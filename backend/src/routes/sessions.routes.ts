import { Router } from 'express';

import * as sessions from '../controllers/sessions.controller';

const router = Router();

router.get('/', sessions.list);
router.get('/technicians', sessions.technicians);
router.patch('/:id', sessions.update);   // PC tokens too: Claude corrects the session it recorded

export default router;
