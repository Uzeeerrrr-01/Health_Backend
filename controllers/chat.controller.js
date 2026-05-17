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

        // Auto-generate summary and clinical report using AI
        let aiSummary = "Consultation completed. No significant chat history to summarize.";
        let aiPrescription = "";

        if (chat.messages.length > 0) {
            const conversationText = chat.messages.map(m => `${m.senderModel}: ${m.content}`).join('\n');

            const aiPrompt = `Analyze this medical consultation between a doctor and a patient.
            You must return strictly JSON format containing a standard consultation summary, recommended treatments/prescriptions, and a detailed AI clinical report structured exactly as:
            {
              "summary": "...",
              "prescription": "...",
              "aiReport": {
                "complaint": "patient's main complaint",
                "symptoms": "symptoms mentioned during chat",
                "duration": "duration of symptoms if available, else 'Not specified'",
                "severity": "severity of symptoms if available, else 'Not specified'",
                "condition": "possible condition or diagnostic suggestions",
                "nextSteps": "recommended clinical next steps",
                "followUp": "follow-up advice",
                "doctorNote": "short doctor note summary to help the doctor"
              }
            }
            
            Conversation:
            ${conversationText}`;

            try {
                const response = await aiClient.chat.completions.create({
                    model: process.env.AI_MODEL || 'grok-beta',
                    messages: [{ role: 'user', content: aiPrompt }],
                    response_format: { type: 'json_object' }
                });

                const parsed = JSON.parse(response.choices[0].message.content);
                aiSummary = parsed.summary || aiSummary;
                aiPrescription = parsed.prescription || aiPrescription;
                if (parsed.aiReport) {
                    chat.aiReport = parsed.aiReport;
                }
            } catch (err) {
                console.error("Failed to generate AI summary and clinical report:", err.message || err);
            }
        }

        await chat.save();

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
        console.log(`[Chat Request] Patient clicked Start Chat: Patient ${req.user._id} with Doctor ${doctorId}`);

        // 1. Check if a pending 'requested' chat was created in the last 5 seconds to prevent React 18 Strict Mode double-write
        const fiveSecondsAgo = new Date(Date.now() - 5000);
        let existingPendingChat = await Chat.findOne({
            patient: req.user._id,
            doctor: doctorId,
            status: 'requested',
            createdAt: { $gte: fiveSecondsAgo }
        });

        if (existingPendingChat) {
            console.log(`[Chat Request] Prevented duplicate pending chat creation due to rapid double-write. Reusing: ${existingPendingChat._id}`);
            return res.status(200).json({ success: true, data: existingPendingChat });
        }
        
        // 2. Archive any existing requested or active chats as 'ended' so they go to history and do not block new requests
        await Chat.updateMany(
            {
                patient: req.user._id,
                doctor: doctorId,
                status: { $in: ['requested', 'active'] }
            },
            {
                $set: { status: 'ended' }
            }
        );

        // 3. Always create a completely fresh 'requested' pending chat request
        console.log(`[Chat Request] Creating a fresh pending/active chat request.`);
        const chat = await Chat.create({
            patient: req.user._id,
            doctor: doctorId,
            status: 'requested',
            messages: []
        });

        console.log(`[Chat Request] Chat request created with chatId: ${chat._id}`);

        // 4. Immediately emit newChatRequest to the doctor room
        const populatedChat = await Chat.findById(chat._id).populate('patient', 'fullName');
        const io = req.app.get('io');
        if (io) {
            console.log(`[Chat Request] Emitting newChatRequest to doctor room: doctor_${doctorId}`);
            io.to(`doctor_${doctorId}`).emit("newChatRequest", populatedChat);
        } else {
            console.warn(`[Chat Request Warning] Socket.io server not found on app instance.`);
        }

        res.status(200).json({ success: true, data: chat });
    } catch (error) {
        console.error(`[Chat Request Error]`, error);
        next(error);
    }
};

// @desc    Respond to consultation request (Doctor side)
// @route   PUT /api/chats/:id/respond
// @access  Private (Doctor)
export const respondToConsultation = async (req, res, next) => {
    try {
        const { status, scheduledTime } = req.body; // status: 'active' or 'rescheduled'
        console.log(`[Chat Respond] Doctor ${req.user._id} responding to Chat ${req.params.id} with status: ${status}`);
        
        const chat = await Chat.findById(req.params.id);
        if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });

        if (chat.doctor.toString() !== req.user._id.toString()) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        chat.status = status;
        if (scheduledTime) chat.scheduledTime = scheduledTime;
        await chat.save();

        // If the doctor accepts the chat, automatically transition any other orphaned 'requested' chats for this patient-doctor pair to 'ended'
        if (status === 'active') {
            console.log(`[Chat Respond] Chat accepted. Cleaning up other pending requested chats for patient ${chat.patient} and doctor ${chat.doctor}`);
            await Chat.updateMany(
                {
                    patient: chat.patient,
                    doctor: chat.doctor,
                    _id: { $ne: chat._id },
                    status: 'requested'
                },
                {
                    $set: { status: 'ended' }
                }
            );
        }

        // If rescheduled, create a notification for the patient
        if (status === 'rescheduled') {
            console.log(`[Chat Respond] Chat was rescheduled. Creating patient notification...`);
            const Notification = (await import('../models/Notification.js')).default;
            
            await Notification.create({
                recipient: chat.patient,
                recipientModel: 'User',
                type: 'appointment_update',
                title: 'Consultation Rescheduled',
                message: `Dr. ${req.user.fullName} is busy and has rescheduled your consultation for ${scheduledTime}.`,
                route: '/patient/appointments',
                relatedId: chat.appointment || undefined
            });
            console.log(`[Chat Respond] Notification created successfully.`);
        }

        res.status(200).json({ success: true, data: chat });
    } catch (error) {
        console.error(`[Chat Respond Error]`, error);
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

// @desc    Get all chats for a doctor (active, requested, ended, rescheduled)
// @route   GET /api/chats/doctor/all
// @access  Private (Doctor)
export const getDoctorChats = async (req, res, next) => {
    try {
        const chats = await Chat.find({ doctor: req.user._id })
            .populate('patient', 'fullName')
            .sort({ updatedAt: -1 });
        res.status(200).json({ success: true, data: chats });
    } catch (error) {
        next(error);
    }
};
