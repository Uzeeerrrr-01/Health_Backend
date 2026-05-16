import express from 'express';
import { 
    getAllUsers, addUser, editUser, deleteUser, toggleUserStatus,
    getAllDoctors, getPendingDoctors, verifyDoctor, editDoctor, deleteDoctor,
    getAllAppointments, getAllReports, getAllEmergencies, getDashboardStats,
    getMockTransactions, getMockSupportTickets, getMockAuditLogs
} from '../controllers/admin.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/role.middleware.js';

const router = express.Router();

// All routes are protected and require admin role
router.use(protect);
router.use(authorize('admin'));

// User routes
router.route('/users')
    .get(getAllUsers)
    .post(addUser);
router.route('/users/:id')
    .put(editUser)
    .delete(deleteUser);
router.put('/users/:id/status', toggleUserStatus);

// Doctor routes
router.route('/doctors')
    .get(getAllDoctors);
router.route('/doctors/pending')
    .get(getPendingDoctors);
router.put('/doctors/:id/verify', verifyDoctor);
router.route('/doctors/:id')
    .put(editDoctor)
    .delete(deleteDoctor);

// General Management
router.get('/appointments', getAllAppointments);
router.get('/reports', getAllReports);
router.get('/emergencies', getAllEmergencies);

// Mock routes
router.get('/transactions', getMockTransactions);
router.get('/support', getMockSupportTickets);
router.get('/stats', getDashboardStats);

export default router;
