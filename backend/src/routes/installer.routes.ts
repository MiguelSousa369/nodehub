import { Router } from 'express';

import * as installer from '../controllers/installer.controller';

const router = Router();

router.get('/status', installer.status);
router.get('/', installer.download);

export default router;
