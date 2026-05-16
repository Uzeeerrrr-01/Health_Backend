import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const doctorSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'doctor' },
    specialization: { type: String, required: true },
    licenseNumber: { type: String, required: true },
    yearsOfExperience: { type: Number, required: true },
    hospitalName: { type: String, required: true },
    clinicAddress: { type: String, required: true },
    phone: {
        type: String,
        default: "",
    },
    location: {
        latitude: { type: Number },
        longitude: { type: Number }
    },
    verificationStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    rejectionReason: { type: String },
    accountStatus: { type: String, enum: ['active', 'suspended'], default: 'active' },

    // Files (Cloudinary URLs)
    degreeCertificate: { type: String },
    governmentId: { type: String },
    medicalLicenseProof: { type: String },
    avatar: { type: String }
}, { timestamps: true });

// Hash password before saving
doctorSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare entered password with hashed password
doctorSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const Doctor = mongoose.model('Doctor', doctorSchema);
export default Doctor;
