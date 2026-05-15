import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// Groq provides an OpenAI-compatible API
const aiClient = new OpenAI({
    apiKey: process.env.GROQ_API_KEY || 'missing_key',
    baseURL: 'https://api.groq.com/openai/v1',
});

export default aiClient;
