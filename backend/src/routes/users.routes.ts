import { Router } from 'express';

import * as users from '../controllers/users.controller';
import { authGuard, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.use(authGuard, requireRole(['ADMIN']));

router.get('/', users.list);
router.post('/', users.create);
router.patch('/:id', users.update);
router.delete('/:id', users.remove);

export default router;
