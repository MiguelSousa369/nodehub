import { Router } from 'express';

import * as machines from '../controllers/machines.controller';

const router = Router();

router.get('/', machines.list);
router.put('/:host', machines.save);
router.delete('/:host', machines.remove);
router.post('/:host/ssh-test', machines.sshTest);

export default router;
