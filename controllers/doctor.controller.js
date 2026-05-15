import Doctor from '../models/Doctor.js';

// @desc    Get all approved doctors
// @route   GET /api/doctors
// @access  Public
export const getApprovedDoctors = async (req, res, next) => {
    try {
        const doctors = await Doctor.find({ verificationStatus: 'approved', accountStatus: 'active' }).select('-password');
        res.status(200).json({ success: true, data: doctors });
    } catch (error) {
        console.error('getApprovedDoctors error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get single doctor
// @route   GET /api/doctors/:id
// @access  Public
export const getDoctor = async (req, res, next) => {
    try {
        const doctor = await Doctor.findById(req.params.id).select('-password');
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor not found' });
        }
        res.status(200).json({ success: true, data: doctor });
    } catch (error) {
        console.error('getDoctor error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};
