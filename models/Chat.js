import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    senderModel: {
        type: String,
        required: true,
        enum: ['User', 'Doctor']
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'messages.senderModel'
    },
    content: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const chatSchema = new mongoose.Schema({
    appointment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment',
        required: true
    },
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor',
        required: true
    },
    messages: [messageSchema],
    status: {
        type: String,
        enum: ['active', 'ended'],
        default: 'active'
    }
}, { timestamps: true });

const Chat = mongoose.model('Chat', chatSchema);
export default Chat;
