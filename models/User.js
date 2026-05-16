import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['patient', 'admin'], default: 'patient' },
    phone: { type: String, default: "" },

    // Patient specific fields
    age: { type: Number },
    sex: { type: String, enum: ['male', 'female', 'other'] },
    bloodGroup: { type: String },
    allergies: [{ type: String }],
    currentMedications: [{ type: String }],
    previousDiseaseHistory: [{ type: String }],
    familyDiseaseHistory: [{ type: String }],
    emergencyContact: {
        name: String,
        phone: String,
        relation: String
    },
    location: {
        latitude: { type: Number },
        longitude: { type: Number }
    },

    // Admin specific field
    adminAccessCode: { type: String, select: false },

    // Account status
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
