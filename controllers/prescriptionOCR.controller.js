import aiClient from '../utils/aiClient.js';
import fs from 'fs';
import path from 'path';

// @desc    Prescription OCR - Extract medications from uploaded image using AI Vision
// @route   POST /api/ai/prescription-ocr
// @access  Private (Patient)
export const prescriptionOCR = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No prescription image uploaded' });
        }

        // Read the uploaded file and convert to base64
        const filePath = path.join(process.cwd(), 'uploads', req.file.filename);
        const fileBuffer = fs.readFileSync(filePath);
        const base64Image = fileBuffer.toString('base64');
        const mimeType = req.file.mimetype; // e.g. image/jpeg, image/png

        const response = await aiClient.chat.completions.create({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct', // Groq vision model
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: `You are a medical OCR assistant. Analyze this prescription image carefully and extract ALL medications listed.

Return ONLY a valid JSON object with this exact structure:
{
  "doctorName": "string or null",
  "patientName": "string or null", 
  "date": "string or null",
  "diagnosis": "string or null",
  "medications": [
    {
      "name": "medication name with strength",
      "dosage": "e.g. 1 tablet / 5ml",
      "frequency": "e.g. twice daily / TDS",
      "duration": "e.g. 7 days",
      "instructions": "e.g. after meals, with water"
    }
  ],
  "notes": "any additional instructions or null"
}

If a field cannot be read or determined, use null. Extract ALL medications visible. Be precise.`
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:${mimeType};base64,${base64Image}`
                            }
                        }
                    ]
                }
            ],
            response_format: { type: 'json_object' },
            max_tokens: 1024
        });

        const extracted = JSON.parse(response.choices[0].message.content);

        // Clean up uploaded file after processing
        fs.unlink(filePath, (err) => {
            if (err) console.error('Failed to delete temp OCR file:', err.message);
        });

        res.status(200).json({
            success: true,
            data: extracted
        });

    } catch (error) {
        console.error('Prescription OCR Error:', error.message || error);

        // Clean up file on error too
        if (req.file) {
            const filePath = path.join(process.cwd(), 'uploads', req.file.filename);
            fs.unlink(filePath, () => {});
        }

        res.status(error.status || 500).json({
            success: false,
            message: error.message || 'Failed to process prescription image'
        });
    }
};
