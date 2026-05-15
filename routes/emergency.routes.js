import express from 'express';
import { createEmergencyCase, getPatientEmergencyCases, updateEmergencyStatus } from '../controllers/emergency.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.post('/', createEmergencyCase);
router.get('/patient', getPatientEmergencyCases);
router.put('/:id/status', updateEmergencyStatus);

export default router;
