import { Router } from 'express';

import * as sessions from '../controllers/sessions.controller';

const router = Router();

router.get('/', sessions.list);

export default router;
