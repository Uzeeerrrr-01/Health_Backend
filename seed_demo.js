import mongoose from 'mongoose';
import User from './models/User.js';
import Doctor from './models/Doctor.js';
import dotenv from 'dotenv';

dotenv.config();

const seedDemoAccounts = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        // Demo Patient
        const patientEmail = 'patient@example.com';
        let patient = await User.findOne({ email: patientEmail });
        if (!patient) {
            patient = await User.create({
                fullName: 'Demo Patient',
                email: patientEmail,
                password: 'password123',
                role: 'patient',
                age: 30,
                sex: 'male'
            });
            console.log('Demo Patient created');
        }

        // Demo Doctor
        const doctorEmail = 'doctor@example.com';
        let doctor = await Doctor.findOne({ email: doctorEmail });
        if (!doctor) {
            doctor = await Doctor.create({
                fullName: 'Demo Doctor',
                email: doctorEmail,
                password: 'password123',
                role: 'doctor',
                specialization: 'General Medicine',
                licenseNumber: 'DOC123456',
                yearsOfExperience: 10,
                hospitalName: 'MediAI General Hospital',
                clinicAddress: '123 Health St, Medical District',
                phone: '1234567890',
                verificationStatus: 'approved'
            });
            console.log('Demo Doctor created');
        }

        // Demo Admin
        const adminEmail = 'admin@example.com';
        let admin = await User.findOne({ email: adminEmail });
        if (!admin) {
            admin = await User.create({
                fullName: 'Demo Admin',
                email: adminEmail,
                password: 'password123',
                role: 'admin',
                adminAccessCode: 'super'
            });
            console.log('Demo Admin created');
        }

        console.log('Seed completed successfully');
        process.exit(0);
    } catch (err) {
        console.error('Seed failed:', err);
        process.exit(1);
    }
}

seedDemoAccounts();
