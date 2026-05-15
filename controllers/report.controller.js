import Report from '../models/Report.js';

// @desc    Create a draft report (usually called by AI service at end of chat)
// @route   POST /api/reports/draft
// @access  Private (Doctor)
export const createDraftReport = async (req, res, next) => {
    try {
        const { patient, appointment, title, summary, prescription } = req.body;
        
        const report = await Report.create({
            patient,
            doctor: req.user._id,
            appointment,
            title,
            summary,
            prescription,
            status: 'Draft by AI'
        });
        
        res.status(201).json({ success: true, data: report });
    } catch (error) {
        next(error);
    }
};

// @desc    Get patient reports (only approved ones)
// @route   GET /api/reports/patient
// @access  Private (Patient)
export const getPatientReports = async (req, res, next) => {
    try {
        // Patient only sees reports that are "Sent to Patient" or "Approved"
        const reports = await Report.find({ 
            patient: req.user._id, 
            status: { $in: ['Approved', 'Sent to Patient'] } 
        }).populate('doctor', 'fullName specialization');
        
        res.status(200).json({ success: true, data: reports });
    } catch (error) {
        next(error);
    }
};

// @desc    Get doctor reports
// @route   GET /api/reports/doctor
// @access  Private (Doctor)
export const getDoctorReports = async (req, res, next) => {
    try {
        const reports = await Report.find({ doctor: req.user._id }).populate('patient', 'fullName');
        res.status(200).json({ success: true, data: reports });
    } catch (error) {
        next(error);
    }
};

// @desc    Edit report
// @route   PUT /api/reports/:id
// @access  Private (Doctor)
export const editReport = async (req, res, next) => {
    try {
        let report = await Report.findById(req.params.id);
        if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
        
        if (report.doctor.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to edit this report' });
        }
        
        report = await Report.findByIdAndUpdate(
            req.params.id, 
            { ...req.body, status: 'Edited' }, 
            { new: true, runValidators: true }
        );
        
        res.status(200).json({ success: true, data: report });
    } catch (error) {
        next(error);
    }
};

// @desc    Approve / Send report to patient
// @route   PUT /api/reports/:id/status
// @access  Private (Doctor)
export const updateReportStatus = async (req, res, next) => {
    try {
        const { status } = req.body; // 'Approved' or 'Sent to Patient'
        
        const report = await Report.findByIdAndUpdate(req.params.id, { status }, { new: true });
        if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
        
        res.status(200).json({ success: true, data: report });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete report
// @route   DELETE /api/reports/:id
// @access  Private (Doctor or Admin)
export const deleteReport = async (req, res, next) => {
    try {
        const report = await Report.findById(req.params.id);
        if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
        
        await report.deleteOne();
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        next(error);
    }
};
