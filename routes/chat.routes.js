import express from 'express';
import { createChat, sendMessage, getChat, endConsultation } from '../controllers/chat.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/role.middleware.js';

const router = express.Router();

router.use(protect);

router.post('/', createChat);
router.get('/:id', getChat);
router.post('/:id/messages', sendMessage);
router.put('/:id/end', authorize('doctor'), endConsultation);

export default router;
