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
                    model: process.env.AI_MODEL || 'grok-beta',
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
