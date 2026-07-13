import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the API with the key from env variables
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || 'dummy_key_if_missing');

export async function generateProfileReview(profile, repoCount) {
  if (!import.meta.env.VITE_GEMINI_API_KEY) {
    throw new Error("Missing VITE_GEMINI_API_KEY in .env file");
  }

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
You are an expert developer relations (DevRel) AI analyzing a developer's profile.
Analyze the following developer profile and provide a short, encouraging review.

Profile Details:
- Username: ${profile.username}
- Bio: ${profile.bio || 'Not provided'}
- Tech Stack: ${profile.tech_stack || 'Not specified'}
- Public Repositories: ${repoCount || 0}
- Location: ${profile.location || 'Not provided'}

Instructions for the response:
1. Use markdown formatting.
2. Structure the review with these headers:
   - 🌟 **Profile Snapshot**
   - 💡 **Strengths**
   - 📈 **Growth Areas**
   - 🚀 **Verdict**
3. Be specific based on the provided Tech Stack and Bio.
4. Keep the review concise, engaging, and highly professional yet friendly.
5. Limit the response to about 100-150 words total.
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error generating AI review:", error);
    throw error;
  }
}
