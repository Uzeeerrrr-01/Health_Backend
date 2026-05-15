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

        const messages = [
            {
                role: 'system',
                content: `You are a helpful AI medical assistant for the MediAI platform. 
                Analyze the patient's symptoms and previous context. 
                You must return a JSON response strictly with the following fields:
                - followUpQuestion (string)
                - possibleCondition (string)
                - riskLevel (string: Low, Medium, High, Critical)
                - recommendedSpecialization (string)
                - preventionAdvice (string)
                - emergencyWarning (string, optional, only if high risk)`
            },
            ...previousMessages,
            { role: 'user', content: symptoms }
        ];

        const response = await aiClient.chat.completions.create({
            model: 'grok-beta', // Use appropriate Grok/xAI model name
            messages,
            response_format: { type: 'json_object' }
        });

        const aiResponse = JSON.parse(response.choices[0].message.content);

        res.status(200).json({ success: true, data: aiResponse });
    } catch (error) {
        console.error('AI Error:', error);
        res.status(500).json({ success: false, message: 'Failed to process AI symptom check' });
    }
};
