import User from '../models/User.js';
import Doctor from '../models/Doctor.js';
import Appointment from '../models/Appointment.js';
import Report from '../models/Report.js';
import EmergencyCase from '../models/EmergencyCase.js';
import sendEmail from '../utils/sendEmail.js';
import Notification from '../models/Notification.js';
import Transaction from '../models/Transaction.js';
import AuditLog from '../models/AuditLog.js';
import { createAuditLog } from '../utils/auditLogger.js';

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
        const { password, mustChangePassword, ...userData } = req.body;
        const user = await User.create({ 
            ...userData, 
            password: password || 'password123', 
            mustChangePassword: mustChangePassword === true || mustChangePassword === 'true',
            role: 'patient' 
        });

        await createAuditLog({
            action: 'USER_CREATED',
            req,
            target: 'User',
            targetId: user._id,
            details: { email: user.email, fullName: user.fullName }
        });

        res.status(201).json({ success: true, data: user });
    } catch (error) {
        console.error('addUser error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const editUser = async (req, res) => {
    try {
        const { password, ...updateData } = req.body;
        
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // Update fields
        Object.keys(updateData).forEach(key => {
            user[key] = updateData[key];
        });

        // Update password if provided
        if (password && password.trim() !== "") {
            user.password = password;
        }

        await user.save();

        await createAuditLog({
            action: 'USER_UPDATED',
            req,
            target: 'User',
            targetId: user._id,
            details: { email: user.email, updatedFields: Object.keys(updateData) }
        });

        res.status(200).json({ success: true, data: user });
    } catch (error) {
        console.error('editUser error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        
        if (user) {
            await createAuditLog({
                action: 'USER_DELETED',
                req,
                target: 'User',
                targetId: user._id,
                details: { email: user.email, fullName: user.fullName }
            });
        }

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

        await createAuditLog({
            action: 'USER_STATUS_TOGGLED',
            req,
            target: 'User',
            targetId: updatedUser._id,
            details: { email: updatedUser.email, isActive: updatedUser.isActive }
        });

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
            .populate('doctor', 'fullName specialization')
            .sort({ updatedAt: -1 });
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

// --- Transactions Management ---
export const getAllTransactions = async (req, res) => {
    try {
        const transactions = await Transaction.find()
            .populate('patient', 'fullName email')
            .populate('doctor', 'fullName specialization')
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: transactions });
    } catch (error) {
        console.error('getAllTransactions error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const addTransaction = async (req, res) => {
    try {
        const transaction = await Transaction.create(req.body);
        res.status(201).json({ success: true, data: transaction });
    } catch (error) {
        console.error('addTransaction error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateTransactionStatus = async (req, res) => {
    try {
        const transaction = await Transaction.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
        res.status(200).json({ success: true, data: transaction });
    } catch (error) {
        console.error('updateTransactionStatus error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- Audit Logs ---
export const getAllAuditLogs = async (req, res) => {
    try {
        const logs = await AuditLog.find()
            .populate('performedBy', 'fullName email')
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: logs });
    } catch (error) {
        console.error('getAllAuditLogs error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- Dashboard Stats (Updated) ---
export const getDashboardStats = async (req, res) => {
    try {
        const [userCount, doctorCount, appointmentCount, reportCount, emergencyCount, totalRevenue] = await Promise.all([
            User.countDocuments({ role: 'patient' }),
            Doctor.countDocuments({ verificationStatus: 'approved' }),
            Appointment.countDocuments(),
            Report.countDocuments(),
            EmergencyCase.countDocuments(),
            Transaction.aggregate([
                { $match: { status: 'completed' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
        ]);

        res.status(200).json({
            success: true,
            data: {
                users: userCount,
                doctors: doctorCount,
                appointments: appointmentCount,
                reports: reportCount,
                emergencies: emergencyCount,
                revenue: totalRevenue[0]?.total || 0,
                uptime: '99.9%'
            }
        });
    } catch (error) {
        console.error('getDashboardStats error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- Update Emergency Status with Auditing ---
export const updateEmergencyStatus = async (req, res) => {
    try {
        const emergency = await EmergencyCase.findByIdAndUpdate(
            req.params.id, 
            { status: req.body.status }, 
            { new: true }
        ).populate('patient', 'fullName email');

        if (!emergency) return res.status(404).json({ success: false, message: 'Emergency case not found' });

        await createAuditLog({
            action: 'EMERGENCY_STATUS_UPDATED',
            req,
            target: 'EmergencyCase',
            targetId: emergency._id,
            details: { status: emergency.status, patientName: emergency.patient?.fullName }
        });

        res.status(200).json({ success: true, data: emergency });
    } catch (error) {
        console.error('updateEmergencyStatus error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};
