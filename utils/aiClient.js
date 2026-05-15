import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// Assuming Grok/xAI exposes an OpenAI-compatible API
const aiClient = new OpenAI({
    apiKey: process.env.XAI_API_KEY || 'missing_key_configure_in_env',
    baseURL: 'https://api.x.ai/v1', // Replace with correct xAI base URL if different
});

export default aiClient;
