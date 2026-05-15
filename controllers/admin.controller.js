import User from '../models/User.js';
import Doctor from '../models/Doctor.js';
import Appointment from '../models/Appointment.js';
import Report from '../models/Report.js';
import EmergencyCase from '../models/EmergencyCase.js';
import sendEmail from '../utils/sendEmail.js';
import Notification from '../models/Notification.js';

// --- Users Management ---
export const getAllUsers = async (req, res, next) => {
    try {
        const users = await User.find({ role: 'patient' }).select('-password');
        res.status(200).json({ success: true, data: users });
    } catch (error) {
        next(error);
    }
};

export const addUser = async (req, res, next) => {
    try {
        const user = await User.create({ ...req.body, role: 'patient' });
        res.status(201).json({ success: true, data: user });
    } catch (error) {
        next(error);
    }
};

export const editUser = async (req, res, next) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).select('-password');
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        next(error);
    }
};

export const deleteUser = async (req, res, next) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        next(error);
    }
};

export const toggleUserStatus = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        
        user.isActive = !user.isActive;
        await user.save();
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        next(error);
    }
};

// --- Doctors Management ---
export const getAllDoctors = async (req, res, next) => {
    try {
        const doctors = await Doctor.find().select('-password');
        res.status(200).json({ success: true, data: doctors });
    } catch (error) {
        next(error);
    }
};

export const getPendingDoctors = async (req, res, next) => {
    try {
        const doctors = await Doctor.find({ verificationStatus: 'pending' }).select('-password');
        res.status(200).json({ success: true, data: doctors });
    } catch (error) {
        next(error);
    }
};

export const verifyDoctor = async (req, res, next) => {
    try {
        console.log('verifyDoctor called with ID:', req.params.id);
        console.log('Request body:', req.body);
        
        const { status, rejectionReason } = req.body; // status: 'approved' or 'rejected'
        
        // Get doctor details before update
        const doctor = await Doctor.findById(req.params.id);
        if (!doctor) {
            console.log('Doctor not found with ID:', req.params.id);
            return res.status(404).json({ success: false, message: 'Doctor not found' });
        }

        console.log('Found doctor:', doctor.fullName, doctor.email);

        // Update verification status
        doctor.verificationStatus = status;
        if (status === 'rejected') {
            doctor.rejectionReason = rejectionReason;
        }
        await doctor.save();
        
        console.log('Doctor verification status updated to:', status);

        // Send email notification
        try {
            if (status === 'approved') {
                const approvalMessage = `Dear Dr. ${doctor.fullName},\n\nCongratulations! Your account has been approved by the MediAI admin team.\n\nYou can now log in to your account and start providing consultations to patients.\n\nLogin at: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/login?role=doctor\n\nThank you for joining MediAI!\n\nBest regards,\nMediAI Team`;
                
                await sendEmail({
                    email: doctor.email,
                    subject: 'MediAI - Account Approved! 🎉',
                    message: approvalMessage
                });
                
                console.log('Approval email sent to:', doctor.email);

                // Create in-app notification
                await Notification.create({
                    recipient: doctor._id,
                    recipientModel: 'Doctor',
                    title: 'Account Approved',
                    message: 'Your doctor account has been approved. You can now start accepting appointments.',
                    type: 'account_approved'
                });
                
                console.log('In-app notification created for doctor');
            } else if (status === 'rejected') {
                const rejectionMessage = `Dear Dr. ${doctor.fullName},\n\nWe regret to inform you that your account verification has been rejected.\n\nReason: ${rejectionReason || 'Not specified'}\n\nIf you believe this is an error or would like to reapply, please contact our support team.\n\nBest regards,\nMediAI Team`;
                
                await sendEmail({
                    email: doctor.email,
                    subject: 'MediAI - Account Verification Update',
                    message: rejectionMessage
                });
                
                console.log('Rejection email sent to:', doctor.email);

                // Create in-app notification
                await Notification.create({
                    recipient: doctor._id,
                    recipientModel: 'Doctor',
                    title: 'Account Verification Rejected',
                    message: `Your account verification was rejected. Reason: ${rejectionReason || 'Not specified'}`,
                    type: 'account_rejected'
                });
                
                console.log('In-app notification created for doctor');
            }
        } catch (emailError) {
            console.error('Failed to send email notification:', emailError);
            // Don't fail the request if email fails, just log it
        }

        console.log('Sending success response');
        res.status(200).json({ success: true, data: doctor });
    } catch (error) {
        console.error('Error in verifyDoctor:', error);
        next(error);
    }
};

export const editDoctor = async (req, res, next) => {
    try {
        const doctor = await Doctor.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).select('-password');
        res.status(200).json({ success: true, data: doctor });
    } catch (error) {
        next(error);
    }
};

export const deleteDoctor = async (req, res, next) => {
    try {
        await Doctor.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        next(error);
    }
};

// --- Appointments Management ---
export const getAllAppointments = async (req, res, next) => {
    try {
        const appointments = await Appointment.find().populate('patient', 'fullName email').populate('doctor', 'fullName specialization');
        res.status(200).json({ success: true, data: appointments });
    } catch (error) {
        next(error);
    }
};

// --- Reports Management ---
export const getAllReports = async (req, res, next) => {
    try {
        const reports = await Report.find().populate('patient', 'fullName email').populate('doctor', 'fullName');
        res.status(200).json({ success: true, data: reports });
    } catch (error) {
        next(error);
    }
};

// --- Emergency Monitoring ---
export const getAllEmergencies = async (req, res, next) => {
    try {
        const emergencies = await EmergencyCase.find().populate('patient', 'fullName email phone');
        res.status(200).json({ success: true, data: emergencies });
    } catch (error) {
        next(error);
    }
};

// --- Mock Routes ---
export const getMockTransactions = (req, res) => res.status(200).json({ success: true, data: [{ id: 1, amount: 100, status: 'completed' }] });
export const getMockSupportTickets = (req, res) => res.status(200).json({ success: true, data: [{ id: 1, subject: 'Login issue', status: 'open' }] });
export const getMockAuditLogs = (req, res) => res.status(200).json({ success: true, data: [{ id: 1, action: 'User created', user: 'admin', date: new Date() }] });
