import Appointment from '../models/Appointment.js';
import sendEmail from '../utils/sendEmail.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

// @desc    Create new appointment
// @route   POST /api/appointments
// @access  Private
export const createAppointment = async (req, res, next) => {
    try {
        const { doctor, date, time, consultationType, reason } = req.body;
        
        const appointment = await Appointment.create({
            patient: req.user._id,
            doctor,
            date,
            time,
            consultationType,
            reason
        });
        
        res.status(201).json({ success: true, data: appointment });
    } catch (error) {
        next(error);
    }
};

// @desc    Get patient appointments
// @route   GET /api/appointments/patient
// @access  Private (Patient)
export const getPatientAppointments = async (req, res, next) => {
    try {
        const appointments = await Appointment.find({ patient: req.user._id }).populate('doctor', 'fullName specialization');
        res.status(200).json({ success: true, data: appointments });
    } catch (error) {
        next(error);
    }
};

// @desc    Get doctor appointments
// @route   GET /api/appointments/doctor
// @access  Private (Doctor)
export const getDoctorAppointments = async (req, res, next) => {
    try {
        const appointments = await Appointment.find({ doctor: req.user._id }).populate('patient', 'fullName email age sex');
        res.status(200).json({ success: true, data: appointments });
    } catch (error) {
        next(error);
    }
};

// @desc    Update appointment
// @route   PUT /api/appointments/:id
// @access  Private
export const updateAppointment = async (req, res, next) => {
    try {
        let appointment = await Appointment.findById(req.params.id).populate('patient', 'fullName email');
        if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });
        
        const oldDate = appointment.date;
        const oldTime = appointment.time;
        const oldStatus = appointment.status;

        appointment = await Appointment.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });

        // If doctor or admin changed date/time/status, send email to patient
        if (req.user.role === 'doctor' || req.user.role === 'admin') {
            const hasChanged = 
                new Date(oldDate).getTime() !== new Date(appointment.date).getTime() || 
                oldTime !== appointment.time || 
                oldStatus !== appointment.status;

            if (hasChanged && appointment.patient && appointment.patient.email) {
                const message = `Hello ${appointment.patient.fullName},\n\nYour appointment status or timing has been updated by the doctor.\n\nNew Details:\nDate: ${new Date(appointment.date).toLocaleDateString()}\nTime: ${appointment.time}\nStatus: ${appointment.status}\n\nPlease check your dashboard for details.\n\nMediAI Healthcare`;
                
                await sendEmail({
                    email: appointment.patient.email,
                    subject: 'MediAI Appointment Update',
                    message
                });

                // Create in-app notification
                await Notification.create({
                    recipient: appointment.patient._id,
                    recipientModel: 'User',
                    title: 'Appointment Updated',
                    message: `Dr. ${req.user.fullName} has updated your appointment timings.`,
                    type: 'appointment_update',
                    relatedId: appointment._id
                });
            }
        }
        
        res.status(200).json({ success: true, data: appointment });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete/Cancel appointment
// @route   DELETE /api/appointments/:id
// @access  Private
export const deleteAppointment = async (req, res, next) => {
    try {
        const appointment = await Appointment.findById(req.params.id).populate('patient', 'fullName email');
        if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });
        
        // Notify patient before deleting
        if (appointment.patient && appointment.patient.email && (req.user.role === 'doctor' || req.user.role === 'admin')) {
            const message = `Hello ${appointment.patient.fullName},\n\nYour appointment on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.time} has been cancelled by the doctor/admin.\n\nMediAI Healthcare`;
            
            await sendEmail({
                email: appointment.patient.email,
                subject: 'MediAI Appointment Cancellation',
                message
            });

            // Create in-app notification
            await Notification.create({
                recipient: appointment.patient._id,
                recipientModel: 'User',
                title: 'Appointment Cancelled',
                message: `Your appointment with Dr. ${req.user.fullName} has been cancelled.`,
                type: 'appointment_cancel',
                relatedId: appointment._id
            });
        }

        await appointment.deleteOne();
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        next(error);
    }
};
