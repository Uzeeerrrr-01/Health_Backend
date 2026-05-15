import User from '../models/User.js';
import Doctor from '../models/Doctor.js';
import generateToken from '../utils/generateToken.js';

// Helper to send token response
const sendTokenResponse = (user, statusCode, res, isDoctor = false) => {
    const token = generateToken(user._id, user.role);

    const responseData = {
        success: true,
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        token
    };

    if (isDoctor) {
        responseData.verificationStatus = user.verificationStatus;
    }

    res.status(statusCode).json(responseData);
};

// @desc    Register a new user (Patient)
// @route   POST /api/auth/register
// @access  Public
export const registerPatient = async (req, res, next) => {
    try {
        const { fullName, email, password, age, sex, bloodGroup, allergies, currentMedications, previousDiseaseHistory, familyDiseaseHistory, emergencyContact, location } = req.body;

        // Check if user exists in either collection
        const userExists = await User.findOne({ email });
        const doctorExists = await Doctor.findOne({ email });
        
        if (userExists || doctorExists) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }

        const user = await User.create({
            fullName, email, password, role: 'patient', age, sex, bloodGroup, allergies, currentMedications, previousDiseaseHistory, familyDiseaseHistory, emergencyContact, location
        });

        sendTokenResponse(user, 201, res);
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

        // Check if user exists in either collection
        const userExists = await User.findOne({ email });
        const doctorExists = await Doctor.findOne({ email });
        
        if (userExists || doctorExists) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
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

        sendTokenResponse(doctor, 201, res, true);
    } catch (error) {
        next(error);
    }
};

// @desc    Login User / Doctor / Admin
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res, next) => {
    try {
        const { email, password, adminAccessCode, role: requestedRole } = req.body;

        console.log(`[Login] Attempt for ${email} as ${requestedRole || 'unknown'}`);

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password' });
        }

        let user = null;
        let isDoctor = false;

        // Strict role-based collection selection
        if (requestedRole === 'doctor') {
            user = await Doctor.findOne({ email }).select('+password');
            isDoctor = true;
            if (user) user.role = 'doctor'; // Ensure role is set correctly
        } else if (requestedRole === 'admin' || requestedRole === 'patient') {
            user = await User.findOne({ email }).select('+password +adminAccessCode');
            // Ensure the found user actually has the requested role (e.g. don't log in as patient if admin was requested)
            if (user && user.role !== requestedRole) {
                console.log(`[Login] Role mismatch: Found ${user.role} but requested ${requestedRole}`);
                user = null; 
            }
        } else {
            // Fallback for cases where role is not provided
            console.log('[Login] No role provided, performing fallback search');
            user = await User.findOne({ email }).select('+password +adminAccessCode');
            if (!user) {
                user = await Doctor.findOne({ email }).select('+password');
                if (user) {
                    isDoctor = true;
                    user.role = 'doctor';
                }
            }
        }

        if (!user) {
            console.log('[Login] User not found or role mismatch');
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Validate password
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            console.log('[Login] Password mismatch');
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Check admin access code if role is admin
        if (user.role === 'admin') {
            if (adminAccessCode !== user.adminAccessCode) {
                console.log('[Login] Admin access code mismatch');
                return res.status(401).json({ success: false, message: 'Invalid admin access code' });
            }
        }

        // Account status check
        const accountStatus = isDoctor ? user.accountStatus : (user.isActive ? 'active' : 'suspended');
        if (accountStatus === 'suspended') {
            console.log('[Login] Account suspended');
            return res.status(403).json({ success: false, message: 'Account is suspended' });
        }

        console.log(`[Login] Success: ${user.email} logged in as ${user.role}`);
        sendTokenResponse(user, 200, res, isDoctor);

    } catch (error) {
        console.error('[Login] Error:', error);
        next(error);
    }
};

