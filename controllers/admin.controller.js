import User from '../models/User.js';
import Doctor from '../models/Doctor.js';
import Appointment from '../models/Appointment.js';
import Report from '../models/Report.js';
import EmergencyCase from '../models/EmergencyCase.js';

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
        const { status, rejectionReason } = req.body; // status: 'approved' or 'rejected'
        const doctor = await Doctor.findByIdAndUpdate(
            req.params.id, 
            { verificationStatus: status, rejectionReason: status === 'rejected' ? rejectionReason : '' }, 
            { new: true }
        ).select('-password');
        res.status(200).json({ success: true, data: doctor });
    } catch (error) {
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
