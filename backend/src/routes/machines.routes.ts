import { Router } from 'express';

import * as machines from '../controllers/machines.controller';
import * as sessions from '../controllers/sessions.controller';
import { sessionOnly } from '../middlewares/auth.middleware';

const router = Router();

// What the CLI (PC tokens, used by Claude) needs: read machines and history, record sessions, update profiles
router.get('/', machines.list);
router.get('/:host', sessions.detail);
router.put('/:host/profile', sessions.updateProfile);
router.get('/:host/sessions', sessions.listForMachine);
router.post('/:host/sessions', sessions.create);

// Changing the machine list is for people in the dashboard (least privilege for PC tokens)
router.put('/:host', sessionOnly, machines.save);
router.delete('/:host', sessionOnly, machines.remove);
router.post('/:host/ssh-test', sessionOnly, machines.sshTest);

export default router;
