import aiClient from '../utils/aiClient.js';
import Doctor from '../models/Doctor.js';
import { computeDoctorStatus } from '../utils/statusHelper.js';

// @desc    AI Symptom Checker
// @route   POST /api/ai/symptom-check
// @access  Private (Patient)
export const symptomCheck = async (req, res, next) => {
    try {
        const { symptoms, previousMessages = [], mode } = req.body;
        console.log("check", symptoms, "mode:", mode);
        if (!symptoms) {
            return res.status(400).json({ success: false, message: 'Please provide symptoms' });
        }

        const { fullName, age, sex, bloodGroup, allergies, currentMedications, previousDiseaseHistory } = req.user;

        // Build system prompt based on mode
        let systemPrompt;

        if (mode === 'continue_ai') {
            // Patient chose "Continue with AI" — provide safe general guidance
            systemPrompt = `You are MediAI, a calm, empathetic medical intake assistant continuing a conversation with a patient.
                Patient Profile:
                - Name: ${fullName}
                - Age: ${age || 'Unknown'}
                - Sex: ${sex || 'Unknown'}
                - Blood Group: ${bloodGroup || 'Unknown'}
                - Allergies: ${allergies?.join(', ') || 'None'}
                - Current Medications: ${currentMedications?.join(', ') || 'None'}
                - Medical History: ${previousDiseaseHistory?.join(', ') || 'None'}

                CRITICAL RULES FOR CONTINUE MODE:
                1. The patient has already received an initial assessment and chose to continue with AI guidance instead of consulting a doctor immediately.
                2. You must provide safe, general health guidance only. Focus on:
                   - Rest, hydration, diet, and lifestyle adjustments
                   - What symptoms to monitor and when to seek emergency help
                   - General wellness advice relevant to their symptoms
                   - Answering their follow-up health questions clearly and empathetically
                3. Do NOT prescribe strong medications or prescription-only drugs. You may mention common OTC options (like paracetamol for mild pain) only if safe given their allergies, with a disclaimer.
                4. Do NOT give false assurance. Never say "everything is fine" unless symptoms are clearly mild.
                5. SAFETY MONITORING: If the patient mentions new or worsening symptoms that indicate HIGH RISK or EMERGENCY (e.g., chest pain + breathing difficulty, sudden severe headache, signs of stroke, severe allergic reaction, high fever unresponsive to treatment), you MUST:
                   - Strongly urge immediate medical attention
                   - Set urgentDoctorNeeded to true
                   - Set emergencyWarning with a clear urgent message
                   - Example: "These symptoms could indicate a serious condition. I strongly recommend seeking urgent medical help immediately. Please do not delay."
                6. Remember previous answers from the conversation. Do NOT repeat questions already answered.
                7. Be a supportive, calm listener. Acknowledge their concerns before providing advice.
                8. You have access to doctors on this platform. If at any point the patient wants to consult a doctor, let them know they can do so.

                You must return a JSON response with these fields:
                - followUpQuestion (string - your conversational response, advice, or follow-up question)
                - urgentDoctorNeeded (boolean - set to true ONLY if you detect high-risk/emergency symptoms that require immediate medical attention)
                - emergencyWarning (string, optional - urgent warning message if urgentDoctorNeeded is true)
                - recommendedSpecialization (string, optional - if urgentDoctorNeeded is true, specify the specialist)`;
        } else {
            // Default assessment mode
            systemPrompt = `You are MediAI, a highly empathetic and supportive clinical medical intake assistant.
                Patient Profile:
                - Name: ${fullName}
                - Age: ${age || 'Unknown'}
                - Sex: ${sex || 'Unknown'}
                - Blood Group: ${bloodGroup || 'Unknown'}
                - Allergies: ${allergies?.join(', ') || 'None'}
                - Current Medications: ${currentMedications?.join(', ') || 'None'}
                - Medical History: ${previousDiseaseHistory?.join(', ') || 'None'}

                BEHAVIORAL RULES:
                1. Act as a calm, supportive medical intake assistant who listens carefully and asks useful follow-up questions.
                2. If the user input is casual conversation, feedback, or emotional expression (not active symptoms), respond empathetically in the "followUpQuestion" field and leave assessment fields empty.
                3. When analyzing actual symptoms, ask relevant follow-up questions ONE AT A TIME. Never repeat questions that were already answered in the chat history.
                4. Remember all previous answers from the conversation history.
                5. Once you have gathered enough symptom details (typically after 2-4 follow-up questions), provide a complete assessment.
                6. Never claim a definitive medical diagnosis. Always frame as "possible condition" and recommend professional consultation.
                7. Cross-check the patient's allergies before any medication suggestions.
                8. Do NOT give false assurance. Never say "everything is fine" unless symptoms are clearly mild and benign.
                9. Do NOT prescribe strong or prescription-only medications. Only suggest safe general advice: rest, hydration, monitoring symptoms, consulting a doctor.
                10. For OTC suggestions, only include truly safe ones (like paracetamol for mild fever/pain) and always add disclaimers.
                11. You have full access to doctors on this platform. When recommending a specialist, simply specify the recommendedSpecialization field — the system will automatically find matching doctors.
                12. Do NOT say you cannot access doctors on the platform. You can.

                SAFETY RULES:
                - If symptoms suggest HIGH RISK or CRITICAL conditions (chest pain + breathing difficulty, stroke signs, severe allergic reactions, etc.), set riskLevel to "High" or "Critical" and provide an emergencyWarning.
                - For high-risk cases, strongly recommend urgent medical care in your response.

                You must return a JSON response strictly with the following fields:
                - followUpQuestion (string - use for conversational responses, empathetic replies, or follow-up questions. Leave EMPTY when providing a full assessment.)
                - possibleCondition (string, only when providing full assessment)
                - riskLevel (string: Low, Medium, High, Critical — only when assessing)
                - recommendedSpecialization (string, only when assessing — e.g., "Cardiologist", "Dermatologist", "General Physician")
                - preventionAdvice (string, only when assessing — safe general advice: rest, hydration, monitoring, when to see a doctor)
                - emergencyWarning (string, optional — only for High/Critical risk situations)
                - suggestedPrescriptions (array of objects, ONLY safe OTC items, max 3 items. Each: name (string), type (string: must be "OTC" only), dosage (string), duration (string), notes (string with safety disclaimer). Always check patient allergies first. Never include prescription-only drugs.)`;
        }

        const messages = [
            { role: 'system', content: systemPrompt },
            ...previousMessages,
            { role: 'user', content: symptoms }
        ];

        const response = await aiClient.chat.completions.create({
            model: process.env.AI_MODEL || 'grok-beta',
            messages,
            response_format: { type: 'json_object' }
        });

        const aiResponse = JSON.parse(response.choices[0].message.content);

        // Fetch matching approved and active doctors from MongoDB based on AI recommendedSpecialization
        let recommendedDoctors = [];
        if (aiResponse.recommendedSpecialization) {
            const cleanSpec = aiResponse.recommendedSpecialization.trim();
            const docs = await Doctor.find({
                verificationStatus: 'approved',
                accountStatus: 'active',
                specialization: { $regex: new RegExp(cleanSpec, 'i') }
            }).select('-password');

            recommendedDoctors = await Promise.all(docs.map(async (doc) => {
                const computed = await computeDoctorStatus(doc);
                const docObj = doc.toObject();
                docObj.onlineStatus = computed;
                return docObj;
            }));
        }

        aiResponse.recommendedDoctors = recommendedDoctors;

        res.status(200).json({ success: true, data: aiResponse });
    } catch (error) {
        console.error('AI Symptom Check Error:', error.response?.data || error.message || error);
        res.status(500).json({ 
            success: false, 
            message: "AI request failed",
            error: error.response?.data || error.message
        });
    }
};
