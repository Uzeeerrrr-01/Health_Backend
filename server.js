import dotenv from 'dotenv';
// Load env vars FIRST before any other imports
dotenv.config();

import express from 'express';
import cors from 'cors';
import connectDB from './config/db.js';
import { errorHandler } from './middleware/error.middleware.js';

// Route files
import authRoutes from './routes/auth.routes.js';
import doctorRoutes from './routes/doctor.routes.js';
import adminRoutes from './routes/admin.routes.js';
import appointmentRoutes from './routes/appointment.routes.js';
import reportRoutes from './routes/report.routes.js';
import medicineRoutes from './routes/medicine.routes.js';
import emergencyRoutes from './routes/emergency.routes.js';
import aiRoutes from './routes/ai.routes.js';
import chatRoutes from './routes/chat.routes.js';
import notificationRoutes from './routes/notification.routes.js';

// Connect to database
connectDB();

const app = express();

// Body parser
app.use(express.json());

// Enable CORS
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001'], // Frontend URL
    credentials: true,
}));

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/notifications', notificationRoutes);

// Error middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
