import mongoose from 'mongoose';
import Appointment from './models/Appointment.js';
import User from './models/User.js';
import Doctor from './models/Doctor.js';
import dotenv from 'dotenv';

dotenv.config();

const checkDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const apptCount = await Appointment.countDocuments();
        const userCount = await User.countDocuments();
        const doctorCount = await Doctor.countDocuments();
        console.log(`Appointments: ${apptCount}`);
        console.log(`Users: ${userCount}`);
        console.log(`Doctors: ${doctorCount}`);
        
        const appts = await Appointment.find().limit(5);
        console.log("Sample Appointments:", JSON.stringify(appts, null, 2));
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkDB();
