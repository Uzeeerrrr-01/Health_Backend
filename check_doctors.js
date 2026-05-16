import mongoose from 'mongoose';
import Doctor from './models/Doctor.js';
import dotenv from 'dotenv';

dotenv.config();

const checkDoctors = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const doctors = await Doctor.find().select('fullName verificationStatus role email');
        console.log("Doctors in DB:", JSON.stringify(doctors, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkDoctors();
