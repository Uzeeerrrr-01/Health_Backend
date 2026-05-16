import mongoose from 'mongoose';
import User from './models/User.js';
import Doctor from './models/Doctor.js';
import dotenv from 'dotenv';

dotenv.config();

const resolveConflicts = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const doctors = await Doctor.find({});
        const doctorEmails = doctors.map(d => d.email.toLowerCase());

        console.log(`Found ${doctorEmails.length} doctors.`);

        const conflictingUsers = await User.find({ 
            email: { $in: doctorEmails } 
        });

        if (conflictingUsers.length === 0) {
            console.log('No conflicts found! All doctors have unique emails.');
            process.exit(0);
        }

        console.log(`Found ${conflictingUsers.length} conflicting users in User collection.`);

        for (const user of conflictingUsers) {
            console.log(`\nConflict found: ${user.email}`);
            console.log(`- In User collection: Name=${user.fullName}, Role=${user.role}`);
            
            if (user.role === 'patient') {
                console.log(`- Action: Removing patient entry from User collection (Doctor entry will remain)`);
                await User.findByIdAndDelete(user._id);
                console.log(`✓ Removed.`);
            } else if (user.role === 'admin') {
                console.log(`⚠ WARNING: ${user.email} is an ADMIN and a DOCTOR. Manual resolution required.`);
            }
        }

        console.log('\n✅ Conflict resolution complete!');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

resolveConflicts();
