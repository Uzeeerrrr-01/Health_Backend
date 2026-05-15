import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Doctor from './models/Doctor.js';

dotenv.config();

const fixDoctorRoles = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Find all doctors
        const doctors = await Doctor.find({});
        console.log(`Found ${doctors.length} doctors`);

        // Check and fix role for each doctor
        for (const doctor of doctors) {
            console.log(`\nDoctor: ${doctor.fullName} (${doctor.email})`);
            console.log(`Current role: "${doctor.role}"`);
            
            if (!doctor.role || doctor.role !== 'doctor') {
                doctor.role = 'doctor';
                await doctor.save();
                console.log(`✓ Fixed role to "doctor"`);
            } else {
                console.log(`✓ Role is already correct`);
            }
        }

        console.log('\n✅ All doctor roles have been checked and fixed!');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

fixDoctorRoles();
