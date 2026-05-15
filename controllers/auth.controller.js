import User from '../models/User.js';
import Doctor from '../models/Doctor.js';
import generateToken from '../utils/generateToken.js';

// @desc    Register a new user (Patient)
// @route   POST /api/auth/register
// @access  Public
export const registerPatient = async (req, res, next) => {
    try {
        const { fullName, email, password, age, sex, bloodGroup, allergies, currentMedications, previousDiseaseHistory, familyDiseaseHistory, emergencyContact, location } = req.body;

        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        const user = await User.create({
            fullName, email, password, role: 'patient', age, sex, bloodGroup, allergies, currentMedications, previousDiseaseHistory, familyDiseaseHistory, emergencyContact, location
        });

        res.status(201).json({
            success: true,
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            token: generateToken(user._id, user.role)
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Register a new doctor
// @route   POST /api/auth/doctor/register
// @access  Public
export const registerDoctor = async (req, res, next) => {
    try {
        const { fullName, email, password, specialization, licenseNumber, yearsOfExperience, hospitalName, clinicAddress, phone, location } = req.body;

        const doctorExists = await Doctor.findOne({ email });
        if (doctorExists) {
            return res.status(400).json({ success: false, message: 'Doctor already exists' });
        }

        // Handle file uploads via req.files
        let degreeCertificate = req.files?.['degreeCertificate']?.[0]?.originalname || '';
        let governmentId = req.files?.['governmentId']?.[0]?.originalname || '';
        let medicalLicenseProof = req.files?.['medicalLicenseProof']?.[0]?.originalname || '';
        let avatar = req.files?.['profilePhoto']?.[0]?.originalname || '';

        const doctor = await Doctor.create({
            fullName, email, password, role: 'doctor', specialization, licenseNumber, yearsOfExperience, hospitalName, clinicAddress, phone, location,
            degreeCertificate, governmentId, medicalLicenseProof, avatar, verificationStatus: 'pending'
        });

        res.status(201).json({
            success: true,
            _id: doctor._id,
            fullName: doctor.fullName,
            email: doctor.email,
            role: doctor.role,
            verificationStatus: doctor.verificationStatus,
            token: generateToken(doctor._id, doctor.role)
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Login User / Doctor / Admin
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res, next) => {
    try {
        const { email, password, adminAccessCode } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password' });
        }

        // Check in User collection first (Patient & Admin)
        let user = await User.findOne({ email }).select('+password +adminAccessCode');
        let isDoctor = false;

        if (!user) {
            // Check in Doctor collection
            user = await Doctor.findOne({ email }).select('+password');
            isDoctor = true;
        }

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Validate password
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Check admin access code if role is admin
        if (user.role === 'admin') {
            if (adminAccessCode !== user.adminAccessCode) {
                return res.status(401).json({ success: false, message: 'Invalid admin access code' });
            }
        }

        // Account status check
        if (user.accountStatus === 'suspended' || user.isActive === false) {
            return res.status(403).json({ success: false, message: 'Account is suspended' });
        }

        res.status(200).json({
            success: true,
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            ...(isDoctor && { verificationStatus: user.verificationStatus }),
            token: generateToken(user._id, user.role)
        });

    } catch (error) {
        next(error);
    }
};
