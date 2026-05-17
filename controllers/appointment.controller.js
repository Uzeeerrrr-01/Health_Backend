import Appointment from '../models/Appointment.js';
import sendEmail from '../utils/sendEmail.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import Doctor from '../models/Doctor.js';

// @desc    Create new appointment
// @route   POST /api/appointments
// @access  Private
export const createAppointment = async (req, res, next) => {
    try {
        const { doctor, date, time, consultationType, reason } = req.body;

        // Check doctor availability for the requested day
        const doc = await Doctor.findById(doctor);
        if (!doc) {
            return res.status(404).json({ success: false, message: 'Doctor not found' });
        }

        const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const appointmentDate = new Date(date);
        const requestedDayName = weekdays[appointmentDate.getDay()]; // e.g. "Wednesday"

        const dayAvailability = doc.weeklyAvailability?.find(d => d.day === requestedDayName);
        
        if (dayAvailability && !dayAvailability.available) {
            // Find all days where doctor is available
            const availableDays = doc.weeklyAvailability
                .filter(d => d.available)
                .map(d => d.day);

            const standardOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
            const activeDays = standardOrder.filter(d => availableDays.includes(d));

            let availabilityString = "";
            if (activeDays.length === 0) {
                availabilityString = "no days";
            } else if (activeDays.length === 1) {
                availabilityString = activeDays[0];
            } else {
                const indices = activeDays.map(d => standardOrder.indexOf(d));
                let isContinuous = true;
                for (let k = 1; k < indices.length; k++) {
                    if (indices[k] !== indices[k - 1] + 1) {
                        isContinuous = false;
                        break;
                    }
                }
                if (isContinuous && activeDays.length > 1) {
                    availabilityString = `${activeDays[0]} till ${activeDays[activeDays.length - 1]}`;
                } else {
                    availabilityString = `${activeDays.slice(0, -1).join(', ')} and ${activeDays[activeDays.length - 1]}`;
                }
            }

            return res.status(400).json({
                success: false,
                message: `doctor is not availabe at ${requestedDayName.toLowerCase()} doctor is available at ${availabilityString.toLowerCase()}`
            });
        }
        
        const appointment = await Appointment.create({
            patient: req.user._id,
            doctor,
            date,
            time,
            consultationType,
            reason
        });
        
        res.status(201).json({ success: true, data: appointment });

        // Notify Doctor
        await Notification.create({
            recipient: doctor,
            recipientModel: 'Doctor',
            title: 'New Appointment Booking',
            message: `You have a new appointment request from ${req.user.fullName} on ${new Date(date).toLocaleDateString()}.`,
            type: 'general',
            route: '/doctor/appointments'
        });
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
        const appointments = await Appointment.find({ 
            doctor: req.user._id,
            status: { $ne: 'cancelled' }
        }).populate('patient', 'fullName email age sex').sort({ updatedAt: -1 });
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

        appointment = await Appointment.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).populate('patient', 'fullName email');

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
                    title: appointment.status === 'cancelled' ? 'Appointment Cancelled' : 'Appointment Updated',
                    message: appointment.status === 'cancelled' 
                        ? `Your appointment with Dr. ${req.user.fullName} has been cancelled.` 
                        : `Your appointment with Dr. ${req.user.fullName} has been updated.`,
                    type: appointment.status === 'cancelled' ? 'appointment_cancel' : 'appointment_update',
                    route: '/patient/appointments'
                });

                // Emit real-time socket events and create admin notifications if cancelled
                if (appointment.status === 'cancelled') {
                    const io = req.app.get('io');
                    if (io) {
                        console.log(`[Socket] Emitting appointmentCancelled to patient_${appointment.patient._id}`);
                        io.to(`patient_${appointment.patient._id}`).emit("appointmentCancelled", {
                            appointmentId: appointment._id,
                            message: `Dr. ${req.user.fullName} has cancelled your appointment.`
                        });
                    }

                    // Notify admins
                    try {
                        const admins = await User.find({ role: 'admin' });
                        for (const admin of admins) {
                            await Notification.create({
                                recipient: admin._id,
                                recipientModel: 'User',
                                title: 'Appointment Cancelled by Doctor',
                                message: `Dr. ${req.user.fullName} has cancelled the appointment for ${appointment.patient.fullName || 'Patient'}.`,
                                type: 'appointment_cancel',
                                route: '/admin/appointments'
                            });
                        }

                        if (io) {
                            console.log(`[Socket] Emitting appointmentCancelledAdmin to admin_room`);
                            io.to('admin_room').emit("appointmentCancelledAdmin", {
                                appointmentId: appointment._id,
                                message: `Dr. ${req.user.fullName} has cancelled the appointment for ${appointment.patient.fullName || 'Patient'}.`
                            });
                        }
                    } catch (adminErr) {
                        console.error("Failed to notify admins of cancellation:", adminErr);
                    }
                }
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

            await Notification.create({
                recipient: appointment.patient._id,
                recipientModel: 'User',
                title: 'Appointment Cancelled',
                message: `Your appointment on ${new Date(appointment.date).toLocaleDateString()} has been cancelled.`,
                type: 'appointment_cancel',
                route: '/patient/appointments'
            });
        }

        await appointment.deleteOne();
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        next(error);
    }
};
