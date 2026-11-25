import { Router } from 'express';

import * as machines from '../controllers/machines.controller';
import * as sessions from '../controllers/sessions.controller';

const router = Router();

router.get('/', machines.list);
router.get('/:host', sessions.detail);
router.put('/:host', machines.save);
router.delete('/:host', machines.remove);
router.post('/:host/ssh-test', machines.sshTest);
router.put('/:host/profile', sessions.updateProfile);
router.get('/:host/sessions', sessions.listForMachine);
router.post('/:host/sessions', sessions.create);

export default router;
