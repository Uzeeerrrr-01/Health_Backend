import mongoose from 'mongoose';
import User from './models/User.js';
import Doctor from './models/Doctor.js';
import dotenv from 'dotenv';

dotenv.config();

const checkUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        const users = await User.find({}, 'fullName email role');
        console.log("--- Users ---");
        users.forEach(u => console.log(`${u.fullName} (${u.email}): ${u.role}`));
        
        const doctors = await Doctor.find({}, 'fullName email role verificationStatus');
        console.log("\n--- Doctors ---");
        doctors.forEach(d => console.log(`${d.fullName} (${d.email}): ${d.role} [${d.verificationStatus}]`));
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkUsers();
