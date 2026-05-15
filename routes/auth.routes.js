import express from 'express';
import { registerPatient, registerDoctor, login } from '../controllers/auth.controller.js';
import upload from '../middleware/upload.middleware.js';

const router = express.Router();

router.post('/register', registerPatient);

// Doctor registration might include file uploads
router.post('/doctor/register', upload.fields([
    { name: 'degreeCertificate', maxCount: 1 },
    { name: 'governmentId', maxCount: 1 },
    { name: 'medicalLicenseProof', maxCount: 1 },
    { name: 'profilePhoto', maxCount: 1 }
]), registerDoctor);

router.post('/login', login);

export default router;
