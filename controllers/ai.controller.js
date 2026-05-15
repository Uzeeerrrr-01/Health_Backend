import aiClient from '../utils/aiClient.js';

// @desc    AI Symptom Checker
// @route   POST /api/ai/symptom-check
// @access  Private (Patient)
export const symptomCheck = async (req, res, next) => {
    try {
        const { symptoms, previousMessages = [] } = req.body;

        if (!symptoms) {
            return res.status(400).json({ success: false, message: 'Please provide symptoms' });
        }

        const { fullName, age, sex, bloodGroup, allergies, currentMedications, previousDiseaseHistory } = req.user;

        const messages = [
            {
                role: 'system',
                content: `You are MediAI, a healthcare assistant. 
                Patient Profile:
                - Name: ${fullName}
                - Age: ${age || 'Unknown'}
                - Sex: ${sex || 'Unknown'}
                - Blood Group: ${bloodGroup || 'Unknown'}
                - Allergies: ${allergies?.join(', ') || 'None'}
                - Medications: ${currentMedications?.join(', ') || 'None'}
                - History: ${previousDiseaseHistory?.join(', ') || 'None'}

                Analyze the patient's symptoms and previous context. 
                Ask relevant follow-up questions based on chat history. Do not repeat questions already answered. 
                Give safe healthcare guidance, recommend doctor consultation when needed, and never claim final diagnosis.

                You must return a JSON response strictly with the following fields:
                - followUpQuestion (string, if you need more info. If you have enough info to give an assessment, leave this empty)
                - possibleCondition (string, only if you have enough info)
                - riskLevel (string: Low, Medium, High, Critical)
                - recommendedSpecialization (string)
                - preventionAdvice (string)
                - emergencyWarning (string, optional, only if high risk)`
            },
            ...previousMessages,
            { role: 'user', content: symptoms }
        ];

        const response = await aiClient.chat.completions.create({
            model: process.env.AI_MODEL || 'llama-3.3-70b-versatile',
            messages,
            response_format: { type: 'json_object' }
        });

        const aiResponse = JSON.parse(response.choices[0].message.content);

        res.status(200).json({ success: true, data: aiResponse });
    } catch (error) {
        console.error('AI Symptom Check Error:', error.message || error);
        res.status(error.status || 500).json({ 
            success: false, 
            message: error.message || 'Failed to process AI symptom check',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
};
