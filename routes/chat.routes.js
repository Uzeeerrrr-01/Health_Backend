import express from 'express';
import { 
    createChat, 
    sendMessage, 
    getChat, 
    endConsultation, 
    requestConsultation, 
    respondToConsultation, 
    getPendingRequests,
    getPatientChatHistory
} from '../controllers/chat.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/role.middleware.js';

const router = express.Router();

router.use(protect);

router.post('/', createChat);
router.post('/request', requestConsultation);
router.get('/doctor/pending', authorize('doctor'), getPendingRequests);
router.get('/patient/history/:doctorId', getPatientChatHistory);
router.get('/:id', getChat);
router.post('/:id/messages', sendMessage);
router.put('/:id/respond', authorize('doctor'), respondToConsultation);
router.put('/:id/end', authorize('doctor'), endConsultation);

export default router;
