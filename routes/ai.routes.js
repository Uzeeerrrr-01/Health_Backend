import express from 'express';
import { symptomCheck } from '../controllers/ai.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.post('/symptom-check', symptomCheck);

export default router;
