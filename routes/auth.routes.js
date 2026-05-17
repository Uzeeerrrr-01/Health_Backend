import express from 'express';
import { registerPatient, registerDoctor, login, getMe, forgotPassword, resetPassword, changePassword, reverifyDoctor, updateProfile, updateAvatar } from '../controllers/auth.controller.js';
import upload from '../middleware/upload.middleware.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/register', registerPatient);

// Doctor registration might include file uploads
router.post('/doctor/register', upload.fields([
    { name: 'degreeCertificate', maxCount: 1 },
    { name: 'governmentId', maxCount: 1 },
    { name: 'medicalLicenseProof', maxCount: 1 },
    { name: 'profilePhoto', maxCount: 1 }
]), registerDoctor);

router.put('/doctor/reverify', protect, upload.fields([
    { name: 'degreeCertificate', maxCount: 1 },
    { name: 'governmentId', maxCount: 1 },
    { name: 'medicalLicenseProof', maxCount: 1 },
    { name: 'profilePhoto', maxCount: 1 }
]), reverifyDoctor);

router.post('/login', login);
router.get('/me', protect, getMe);

// Password Management
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.put('/change-password', protect, changePassword);
router.patch('/profile', protect, updateProfile);
router.patch('/avatar', protect, upload.single('avatar'), updateAvatar);

export default router;
