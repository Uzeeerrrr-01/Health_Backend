import express from 'express';
import { symptomCheck } from '../controllers/ai.controller.js';
import { prescriptionOCR } from '../controllers/prescriptionOCR.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import upload from '../middleware/upload.middleware.js';

const router = express.Router();

router.use(protect);

router.post('/symptom-check', symptomCheck);
router.post('/prescription-ocr', upload.single('prescription'), prescriptionOCR);

export default router;
