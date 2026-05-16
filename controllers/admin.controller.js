import User from '../models/User.js';
import Doctor from '../models/Doctor.js';
import Appointment from '../models/Appointment.js';
import Report from '../models/Report.js';
import EmergencyCase from '../models/EmergencyCase.js';
import sendEmail from '../utils/sendEmail.js';
import Notification from '../models/Notification.js';

// --- Users Management ---
export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({ role: 'patient' }).select('-password');
        res.status(200).json({ success: true, data: users });
    } catch (error) {
        console.error('getAllUsers error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const addUser = async (req, res) => {
    try {
        const user = await User.create({ ...req.body, role: 'patient' });
        res.status(201).json({ success: true, data: user });
    } catch (error) {
        console.error('addUser error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const editUser = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: false }).select('-password');
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        console.error('editUser error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteUser = async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        console.error('deleteUser error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const toggleUserStatus = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            { $set: { isActive: !user.isActive } },
            { new: true, runValidators: false }
        );

        res.status(200).json({ success: true, data: updatedUser });
    } catch (error) {
        console.error('toggleUserStatus error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- Doctors Management ---
export const getAllDoctors = async (req, res) => {
    try {
        const doctors = await Doctor.find().select('-password');
        res.status(200).json({ success: true, data: doctors });
    } catch (error) {
        console.error('getAllDoctors error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getPendingDoctors = async (req, res) => {
    try {
        const doctors = await Doctor.find({ verificationStatus: 'pending' }).select('-password');
        res.status(200).json({ success: true, data: doctors });
    } catch (error) {
        console.error('getPendingDoctors error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const verifyDoctor = async (req, res) => {
    try {
        console.log('verifyDoctor called with ID:', req.params.id);
        console.log('Request body:', req.body);

        const { status, rejectionReason } = req.body;

        if (!status || !['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status. Must be "approved" or "rejected".' });
        }

        const updateData = { verificationStatus: status };
        if (status === 'approved') {
            updateData.accountStatus = 'active';
        } else if (status === 'rejected') {
            updateData.rejectionReason = rejectionReason;
        }

        const doctor = await Doctor.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true, runValidators: false }
        );

        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor not found' });
        }

        console.log('Doctor verification status updated to:', status);

        // Send email notification (non-blocking)
        try {
            if (status === 'approved') {
                const approvalMessage = `Dear Dr. ${doctor.fullName},\n\nCongratulations! Your account has been approved.\n\nLogin at: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/login?role=doctor\n\nBest regards,\nMediAI Team`;
                await sendEmail({ email: doctor.email, subject: 'MediAI - Account Approved! 🎉', message: approvalMessage });
            } else {
                const rejectionMessage = `Dear Dr. ${doctor.fullName},\n\nYour account verification was rejected.\n\nReason: ${rejectionReason || 'Not specified'}\n\nBest regards,\nMediAI Team`;
                await sendEmail({ email: doctor.email, subject: 'MediAI - Account Verification Update', message: rejectionMessage });
            }
        } catch (emailError) {
            console.error('Failed to send email:', emailError.message);
        }

        // Create in-app notification (non-blocking)
        try {
            const notifData = status === 'approved'
                ? { title: 'Account Approved', message: 'Your doctor account has been approved. You can now start accepting appointments.', type: 'account_approved' }
                : { title: 'Account Verification Rejected', message: `Your account verification was rejected. Reason: ${rejectionReason || 'Not specified'}`, type: 'account_rejected' };

            await Notification.create({ recipient: doctor._id, recipientModel: 'Doctor', ...notifData });
        } catch (notifError) {
            console.error('Failed to create notification:', notifError.message);
        }

        res.status(200).json({ success: true, data: doctor });
    } catch (error) {
        console.error('verifyDoctor error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const editDoctor = async (req, res) => {
    try {
        const doctor = await Doctor.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: false }).select('-password');
        res.status(200).json({ success: true, data: doctor });
    } catch (error) {
        console.error('editDoctor error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteDoctor = async (req, res) => {
    try {
        await Doctor.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        console.error('deleteDoctor error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- Appointments Management ---
export const getAllAppointments = async (req, res) => {
    try {
        const appointments = await Appointment.find()
            .populate('patient', 'fullName email')
            .populate('doctor', 'fullName specialization');
        res.status(200).json({ success: true, data: appointments });
    } catch (error) {
        console.error('getAllAppointments error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- Reports Management ---
export const getAllReports = async (req, res) => {
    try {
        const reports = await Report.find()
            .populate('patient', 'fullName email')
            .populate('doctor', 'fullName');
        res.status(200).json({ success: true, data: reports });
    } catch (error) {
        console.error('getAllReports error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- Emergency Monitoring ---
export const getAllEmergencies = async (req, res) => {
    try {
        const emergencies = await EmergencyCase.find().populate('patient', 'fullName email phone');
        res.status(200).json({ success: true, data: emergencies });
    } catch (error) {
        console.error('getAllEmergencies error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- Dashboard Stats ---
export const getDashboardStats = async (req, res) => {
    try {
        const [userCount, doctorCount, appointmentCount, reportCount, emergencyCount] = await Promise.all([
            User.countDocuments({ role: 'patient' }),
            Doctor.countDocuments({ verificationStatus: 'approved' }),
            Appointment.countDocuments(),
            Report.countDocuments(),
            EmergencyCase.countDocuments()
        ]);

        res.status(200).json({
            success: true,
            data: {
                users: userCount,
                doctors: doctorCount,
                appointments: appointmentCount,
                reports: reportCount,
                emergencies: emergencyCount,
                revenue: 0, // Placeholder or calculate from transactions if available
                uptime: '99.9%'
            }
        });
    } catch (error) {
        console.error('getDashboardStats error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- Mock Routes ---
export const getMockTransactions = (req, res) => res.status(200).json({ success: true, data: [{ id: 1, amount: 100, status: 'completed' }] });
export const getMockSupportTickets = (req, res) => res.status(200).json({ success: true, data: [{ id: 1, subject: 'Login issue', status: 'open' }] });
export const getMockAuditLogs = (req, res) => res.status(200).json({ success: true, data: [{ id: 1, action: 'User created', user: 'admin', date: new Date() }] });
