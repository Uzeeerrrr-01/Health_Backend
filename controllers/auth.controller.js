import User from '../models/User.js';
import Doctor from '../models/Doctor.js';
import Chat from '../models/Chat.js';
import { computeDoctorStatus } from '../utils/statusHelper.js';
import generateToken from '../utils/generateToken.js';
import crypto from 'crypto';

// Helper to send token response
const sendTokenResponse = (user, statusCode, res, isDoctor = false) => {
    const token = generateToken(user._id, user.role);

    const responseData = {
        success: true,
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword || false,
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
        let { fullName, email, password, age, sex, bloodGroup, allergies, currentMedications, previousDiseaseHistory, familyDiseaseHistory, emergencyContact, location } = req.body;
        if (email) email = email.toLowerCase();

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
        let { fullName, email, password, specialization, licenseNumber, yearsOfExperience, hospitalName, clinicAddress, phone, location } = req.body;
        if (email) email = email.toLowerCase();

        // Check if user exists in either collection
        const userExists = await User.findOne({ email });
        const doctorExists = await Doctor.findOne({ email });
        
        if (userExists || doctorExists) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }

        // Handle file uploads via req.files
        let degreeCertificate = req.files?.['degreeCertificate']?.[0]?.filename || '';
        let governmentId = req.files?.['governmentId']?.[0]?.filename || '';
        let medicalLicenseProof = req.files?.['medicalLicenseProof']?.[0]?.filename || '';
        let avatar = req.files?.['profilePhoto']?.[0]?.filename || '';

        const doctor = await Doctor.create({
            fullName, email, password, role: 'doctor', specialization, licenseNumber, yearsOfExperience, hospitalName, clinicAddress, phone, location,
            degreeCertificate, governmentId, medicalLicenseProof, avatar, verificationStatus: 'pending'
        });

        sendTokenResponse(doctor, 201, res, true);
    } catch (error) {
        next(error);
    }
};

// @desc    Re-submit doctor verification
// @route   PUT /api/auth/doctor/reverify
// @access  Private (Doctor)
export const reverifyDoctor = async (req, res, next) => {
    try {
        const doctor = await Doctor.findById(req.user._id);
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor not found' });
        }

        const { fullName, specialization, licenseNumber, yearsOfExperience, hospitalName, clinicAddress, phone, location } = req.body;

        // Update basic info
        if (fullName) doctor.fullName = fullName;
        if (specialization) doctor.specialization = specialization;
        if (licenseNumber) doctor.licenseNumber = licenseNumber;
        if (yearsOfExperience) doctor.yearsOfExperience = yearsOfExperience;
        if (hospitalName) doctor.hospitalName = hospitalName;
        if (clinicAddress) doctor.clinicAddress = clinicAddress;
        if (phone) doctor.phone = phone;
        if (location) doctor.location = location;

        // Update files if provided
        if (req.files) {
            if (req.files['degreeCertificate']) doctor.degreeCertificate = req.files['degreeCertificate'][0].filename;
            if (req.files['governmentId']) doctor.governmentId = req.files['governmentId'][0].filename;
            if (req.files['medicalLicenseProof']) doctor.medicalLicenseProof = req.files['medicalLicenseProof'][0].filename;
            if (req.files['profilePhoto']) doctor.avatar = req.files['profilePhoto'][0].filename;
        }

        // Reset status to pending
        doctor.verificationStatus = 'pending';
        doctor.rejectionReason = '';

        await doctor.save();

        res.status(200).json({
            success: true,
            message: 'Verification request re-submitted successfully',
            verificationStatus: 'pending'
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
        let { email, password, adminAccessCode, role: requestedRole } = req.body;
        
        if (email) email = email.toLowerCase();

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

// @desc    Forgot Password
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;

        let user = await User.findOne({ email });
        let isDoctor = false;

        if (!user) {
            user = await Doctor.findOne({ email });
            isDoctor = true;
        }

        if (!user) {
            return res.status(404).json({ success: false, message: 'There is no user with that email' });
        }

        // Get reset token
        const resetToken = crypto.randomBytes(20).toString('hex');

        // Hash token and set to resetPasswordToken field
        user.resetPasswordToken = crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');

        // Set expire
        user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 mins

        await user.save({ validateBeforeSave: false });

        // Mock email sending
        console.log(`[FORGOT PASSWORD] Token for ${email}: ${resetToken}`);

        res.status(200).json({ 
            success: true, 
            message: 'Password reset token generated. Check console for token (Mock).',
            token: resetToken // In production, don't send this back. Send via email.
        });

    } catch (error) {
        next(error);
    }
};

// @desc    Reset Password
// @route   POST /api/auth/reset-password/:token
// @access  Public
export const resetPassword = async (req, res, next) => {
    try {
        // Get hashed token
        const resetPasswordToken = crypto
            .createHash('sha256')
            .update(req.params.token)
            .digest('hex');

        let user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            user = await Doctor.findOne({
                resetPasswordToken,
                resetPasswordExpire: { $gt: Date.now() }
            });
        }

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired token' });
        }

        // Set new password
        user.password = req.body.password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        user.mustChangePassword = false;
        await user.save();

        res.status(200).json({ success: true, message: 'Password reset successful' });

    } catch (error) {
        next(error);
    }
};

// @desc    Update Password (logged in)
// @route   PUT /api/auth/change-password
// @access  Private
export const changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        let user;
        if (req.user.role === 'doctor') {
            user = await Doctor.findById(req.user.id).select('+password');
        } else {
            user = await User.findById(req.user.id).select('+password');
        }

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check current password
        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Current password is incorrect' });
        }

        user.password = newPassword;
        user.mustChangePassword = false;
        await user.save();

        res.status(200).json({ success: true, message: 'Password updated successfully' });

    } catch (error) {
        next(error);
    }
};
export const getMe = async (req, res, next) => {
    try {
        if (req.user) {
            let userData = req.user.toObject ? req.user.toObject() : { ...req.user };
            
            if (req.user.role === 'doctor') {
                const doctor = await Doctor.findById(req.user._id);
                if (doctor) {
                    const computed = await computeDoctorStatus(doctor);
                    userData.onlineStatus = computed;
                    userData.breakExpiresAt = doctor.breakExpiresAt;
                    userData.dailyBreak = doctor.dailyBreak;
                }
            }
            
            return res.status(200).json({
                success: true,
                data: userData
            });
        }
        res.status(401).json({ success: false, message: 'Not authorized' });
    } catch (error) {
        next(error);
    }
};

// @desc    Update current user's profile
// @route   PATCH /api/auth/profile
// @access  Private
export const updateProfile = async (req, res, next) => {
    try {
        const { fullName, email, phone, sex, address, dob, bloodGroup, emergencyContact, bio, specialization, licenseNumber, yearsOfExperience, hospitalName, clinicAddress, weeklyAvailability, onlineStatus, breakDuration, dailyBreak } = req.body;

        let user;
        if (req.user.role === 'doctor') {
            user = await Doctor.findById(req.user._id);
        } else {
            user = await User.findById(req.user._id);
        }

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (fullName) user.fullName = fullName;
        if (phone !== undefined) user.phone = phone;
        if (sex !== undefined) user.sex = sex;
        if (address !== undefined) user.address = address;
        if (dob !== undefined) user.dob = dob;
        if (bloodGroup !== undefined) user.bloodGroup = bloodGroup;
        if (emergencyContact !== undefined) user.emergencyContact = emergencyContact;
        
        // Doctor specific fields
        if (bio !== undefined) user.bio = bio;
        if (specialization !== undefined) user.specialization = specialization;
        if (licenseNumber !== undefined) user.licenseNumber = licenseNumber;
        if (yearsOfExperience !== undefined) user.yearsOfExperience = yearsOfExperience;
        if (hospitalName !== undefined) user.hospitalName = hospitalName;
        if (clinicAddress !== undefined) user.clinicAddress = clinicAddress;
        if (weeklyAvailability !== undefined) user.weeklyAvailability = weeklyAvailability;
        if (dailyBreak !== undefined) user.dailyBreak = dailyBreak;
        
        if (onlineStatus !== undefined) {
            user.onlineStatus = onlineStatus;
            if (onlineStatus === 'break') {
                if (breakDuration && breakDuration !== 'indefinite') {
                    const durationMinutes = parseInt(breakDuration, 10);
                    user.breakExpiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
                } else {
                    user.breakExpiresAt = undefined; // Indefinite
                }
            } else {
                user.breakExpiresAt = undefined;
            }
        }

        // If email is changing, check it's not taken
        if (email && email !== user.email) {
            const emailLower = email.toLowerCase();
            const existingUser = await User.findOne({ email: emailLower });
            const existingDoctor = await Doctor.findOne({ email: emailLower });
            if (existingUser || existingDoctor) {
                return res.status(400).json({ success: false, message: 'Email already in use' });
            }
            user.email = emailLower;
        }

        await user.save({ validateBeforeSave: false });

        let calculatedStatus = user.onlineStatus;
        if (req.user.role === 'doctor') {
            calculatedStatus = await computeDoctorStatus(user);
        }

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                fullName: user.fullName,
                email: user.email,
                phone: user.phone,
                sex: user.sex,
                address: user.address,
                dob: user.dob,
                bloodGroup: user.bloodGroup,
                emergencyContact: user.emergencyContact,
                bio: user.bio,
                specialization: user.specialization,
                licenseNumber: user.licenseNumber,
                yearsOfExperience: user.yearsOfExperience,
                hospitalName: user.hospitalName,
                clinicAddress: user.clinicAddress,
                weeklyAvailability: user.weeklyAvailability,
                onlineStatus: calculatedStatus,
                breakExpiresAt: user.breakExpiresAt,
                dailyBreak: user.dailyBreak,
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update profile photo (avatar)
// @route   PATCH /api/auth/avatar
// @access  Private
export const updateAvatar = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        let user;
        if (req.user.role === 'doctor') {
            user = await Doctor.findById(req.user._id);
        } else {
            user = await User.findById(req.user._id);
        }

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        user.avatar = req.file.filename;
        await user.save({ validateBeforeSave: false });

        res.status(200).json({
            success: true,
            message: 'Avatar updated successfully',
            data: { avatar: req.file.filename }
        });
    } catch (error) {
        next(error);
    }
};
