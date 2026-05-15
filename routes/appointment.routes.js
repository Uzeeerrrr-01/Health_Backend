import express from 'express';
import { createAppointment, getPatientAppointments, getDoctorAppointments, updateAppointment, deleteAppointment } from '../controllers/appointment.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/role.middleware.js';

const router = express.Router();

router.use(protect);

router.post('/', createAppointment);
router.get('/patient', authorize('patient'), getPatientAppointments);
router.get('/doctor', authorize('doctor'), getDoctorAppointments);
router.route('/:id')
    .put(updateAppointment)
    .delete(deleteAppointment);

export default router;
