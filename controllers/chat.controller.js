import Chat from '../models/Chat.js';
import Appointment from '../models/Appointment.js';
import Report from '../models/Report.js';
import aiClient from '../utils/aiClient.js';

// @desc    Create consultation chat
// @route   POST /api/chats
// @access  Private
export const createChat = async (req, res, next) => {
    try {
        const { appointmentId } = req.body;
        
        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });
        
        // Check if chat already exists
        let chat = await Chat.findOne({ appointment: appointmentId });
        if (chat) {
            return res.status(200).json({ success: true, data: chat });
        }
        
        chat = await Chat.create({
            appointment: appointmentId,
            patient: appointment.patient,
            doctor: appointment.doctor,
            messages: []
        });
        
        res.status(201).json({ success: true, data: chat });
    } catch (error) {
        next(error);
    }
};

// @desc    Send message
// @route   POST /api/chats/:id/messages
// @access  Private
export const sendMessage = async (req, res, next) => {
    try {
        const { content } = req.body;
        const senderModel = req.user.role === 'doctor' ? 'Doctor' : 'User';
        
        const chat = await Chat.findById(req.params.id);
        if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });
        
        if (chat.status === 'ended') {
            return res.status(400).json({ success: false, message: 'Chat has ended' });
        }
        
        const message = {
            senderModel,
            senderId: req.user._id,
            content
        };
        
        chat.messages.push(message);
        await chat.save();
        
        res.status(200).json({ success: true, data: chat });
    } catch (error) {
        next(error);
    }
};

// @desc    Get chat messages
// @route   GET /api/chats/:id
// @access  Private
export const getChat = async (req, res, next) => {
    try {
        const chat = await Chat.findById(req.params.id)
            .populate('patient', 'fullName')
            .populate('doctor', 'fullName specialization');
            
        if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });
        
        res.status(200).json({ success: true, data: chat });
    } catch (error) {
        next(error);
    }
};

// @desc    End consultation and auto-generate draft report
// @route   PUT /api/chats/:id/end
// @access  Private (Doctor)
export const endConsultation = async (req, res, next) => {
    try {
        const chat = await Chat.findById(req.params.id);
        if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });
        
        chat.status = 'ended';
        await chat.save();
        
        // Auto-generate summary using AI
        let aiSummary = "Consultation completed. No significant chat history to summarize.";
        let aiPrescription = "";
        
        if (chat.messages.length > 0) {
            const conversationText = chat.messages.map(m => `${m.senderModel}: ${m.content}`).join('\n');
            
            const aiPrompt = `Summarize this medical consultation between a doctor and a patient.
            Extract the main diagnosis/summary and any recommended treatments or prescriptions.
            Return strictly JSON format: { "summary": "...", "prescription": "..." }
            
            Conversation:
            ${conversationText}`;
            
            try {
                const response = await aiClient.chat.completions.create({
                    model: process.env.AI_MODEL || 'llama-3.3-70b-versatile',
                    messages: [{ role: 'user', content: aiPrompt }],
                    response_format: { type: 'json_object' }
                });
                
                const parsed = JSON.parse(response.choices[0].message.content);
                aiSummary = parsed.summary || aiSummary;
                aiPrescription = parsed.prescription || aiPrescription;
            } catch (err) {
                console.error("Failed to generate AI summary:", err.message || err);
            }
        }
        
        // Create draft report
        const report = await Report.create({
            patient: chat.patient,
            doctor: chat.doctor,
            appointment: chat.appointment,
            title: 'Consultation Report',
            summary: aiSummary,
            prescription: aiPrescription,
            status: 'Draft by AI'
        });
        
        // Update appointment status to completed
        await Appointment.findByIdAndUpdate(chat.appointment, { status: 'completed' });
        
        res.status(200).json({ success: true, data: { chat, draftReport: report } });
    } catch (error) {
        next(error);
    }
};
// @desc    Request a consultation (Patient side)
// @route   POST /api/chats/request
// @access  Private (Patient)
export const requestConsultation = async (req, res, next) => {
    try {
        const { doctorId } = req.body;
        
        // Find existing or create new atomically to prevent race conditions
        const chat = await Chat.findOneAndUpdate(
            { 
                patient: req.user._id, 
                doctor: doctorId, 
                status: { $in: ['requested', 'active', 'rescheduled'] } 
            },
            {
                $setOnInsert: {
                    patient: req.user._id,
                    doctor: doctorId,
                    status: 'requested'
                }
            },
            { new: true, upsert: true }
        );

        res.status(200).json({ success: true, data: chat });
    } catch (error) {
        next(error);
    }
};

// @desc    Respond to consultation request (Doctor side)
// @route   PUT /api/chats/:id/respond
// @access  Private (Doctor)
export const respondToConsultation = async (req, res, next) => {
    try {
        const { status, scheduledTime } = req.body; // status: 'active' or 'rescheduled'
        
        const chat = await Chat.findById(req.params.id);
        if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });

        if (chat.doctor.toString() !== req.user._id.toString()) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        chat.status = status;
        if (scheduledTime) chat.scheduledTime = scheduledTime;
        await chat.save();

        // If rescheduled, create a notification for the patient
        if (status === 'rescheduled') {
            const Notification = (await import('../models/Notification.js')).default;
            await Notification.create({
                user: chat.patient,
                type: 'appointment',
                title: 'Consultation Rescheduled',
                message: `Dr. ${req.user.fullName} is busy and has rescheduled your consultation for ${scheduledTime}.`,
                relatedId: chat._id
            });
        }

        res.status(200).json({ success: true, data: chat });
    } catch (error) {
        next(error);
    }
};

// @desc    Get pending requests for doctor
// @route   GET /api/chats/doctor/pending
// @access  Private (Doctor)
export const getPendingRequests = async (req, res, next) => {
    try {
        const requests = await Chat.find({ 
            doctor: req.user._id, 
            status: 'requested' 
        }).populate('patient', 'fullName');
        
        res.status(200).json({ success: true, data: requests });
    } catch (error) {
        next(error);
    }
};

// @desc    Get patient chat history with a specific doctor
// @route   GET /api/chats/patient/history/:doctorId
// @access  Private (Patient)
export const getPatientChatHistory = async (req, res, next) => {
    try {
        const history = await Chat.find({
            patient: req.user._id,
            doctor: req.params.doctorId,
            status: 'ended'
        }).sort({ updatedAt: -1 });

        res.status(200).json({ success: true, data: history });
    } catch (error) {
        next(error);
    }
};
