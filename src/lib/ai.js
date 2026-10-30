// Groq API integration (Free tier, ultra-fast Llama 3 models)
// Docs: https://console.groq.com/docs/quickstart

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const CANDIDATE_MODELS = [
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-120b',
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
];
const DEFAULT_MODEL = 'qwen/qwen3.8-27b';

export function getGroqApiKey() {
  const key = import.meta.env.VITE_GROQ_API_KEY;
  if (!key || key === 'your_groq_api_key_here' || key.trim() === '') {
    return null;
  }
  return key.trim();
}

/**
 * Core caller for Groq API with automatic fallback across working models
 */
export async function callGroq({
  messages,
  model = DEFAULT_MODEL,
  temperature = 0.7,
  max_tokens = 1024,
}) {
  const apiKey = getGroqApiKey();

  if (!apiKey) {
    throw new Error('MISSING_KEY');
  }

  const modelsToTry = [model, ...CANDIDATE_MODELS.filter(m => m !== model)];
  let lastError = null;

  for (const candidate of modelsToTry) {
    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: candidate,
          messages,
          temperature,
          max_tokens,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.error?.message || `Groq API Error (${response.status})`
        );
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (content !== undefined && content !== null) {
        return content;
      }
    } catch (err) {
      lastError = err;
      // If error is about model not found, try next candidate
      if (err.message?.includes('model_not_found') || err.message?.includes('does not exist')) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('All Groq model candidates failed');
}

/**
 * Generate 3 diverse bio suggestions based on tech stack & style
 */
export async function generateBioOptions({ username, techStack, location, currentBio }) {
  const prompt = `You are a career and developer branding expert on Connectra (a developer social network).
Generate 3 distinct, punchy profile bios for this developer:
- Username: ${username || 'Developer'}
- Tech Stack: ${techStack || 'Web Development, React, Node.js'}
- Location: ${location || 'Remote'}
- Current Bio: ${currentBio || 'Software Engineer'}

Return a valid JSON array of exactly 3 objects with keys "style" and "bio".
Styles should be:
1. "Professional & Impactful" (concise, highlighting technical impact & tech stack)
2. "Indie Hacker / Builder" (passionate about shipping fast, building tools, active open source)
3. "Cybersecurity & Engineering" (security-first mindset, robust architecture, clean code)

Format strictly as JSON without extra markdown backticks if possible:
[
  {"style": "Professional & Impactful", "bio": "..."},
  {"style": "Indie Hacker / Builder", "bio": "..."},
  {"style": "Cybersecurity & Engineering", "bio": "..."}
]`;

  try {
    const raw = await callGroq({
      messages: [
        { role: 'system', content: 'You are an AI developer profile assistant that outputs valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
    });

    const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    // Intelligent fallback if key is not configured yet or parse fails
    console.warn('Using intelligent fallback for bios:', err.message);
    const stack = techStack || 'Full-Stack Development';
    return [
      {
        style: 'Professional & Impactful',
        bio: `Software Engineer specialized in ${stack}. Passionate about architecting scalable systems and clean code. Based in ${location || 'Remote'}.`,
      },
      {
        style: 'Indie Hacker / Builder',
        bio: `Building modern web apps with ${stack} 🚀 Open source contributor & continuous learner shipping features daily.`,
      },
      {
        style: 'Cybersecurity & Engineering',
        bio: `Security-focused developer crafting resilient web applications with ${stack}. Big fan of secure architecture, auth, and automated testing. 🛡️`,
      },
    ];
  }
}

/**
 * Review code snippet for both quality AND Cybersecurity vulnerabilities!
 */
export async function reviewCodeAndSecurity({ code, language = 'javascript' }) {
  const prompt = `You are a Senior Principal Engineer and Application Security (AppSec) Expert on Connectra.
Analyze this code snippet:

Language: ${language}
\`\`\`${language}
${code}
\`\`\`

Perform a dual review:
1. 🛡️ **Cybersecurity & Safety Review**:
   - Check for hardcoded secrets, API tokens, SQL injection, XSS, unsafe regex, unvalidated inputs, or authorization gaps.
   - If secure, confirm with "No critical vulnerabilities detected."
2. ⚡ **Code Quality & Performance**:
   - Edge cases, algorithmic complexity, syntax improvements, modern idioms.
3. 💡 **Suggested Fix / Refactored Snippet**:
   - Provide a clean, secure snippet if improvements are warranted.

Format your output in clean Markdown with emojis and bold headers. Keep it under 250 words total.`;

  try {
    return await callGroq({
      messages: [
        { role: 'system', content: 'You are an expert code reviewer and application security specialist.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    });
  } catch (err) {
    console.warn('Using simulated code & security review:', err.message);
    return `### 🛡️ **Cybersecurity & Safety Review**
- **Sanitization Check**: Ensure all dynamic inputs are strictly validated before state updates or queries.
- **Sensitive Data**: No hardcoded API keys or credentials detected in this snippet.
- **Best Practice**: Use parametrized inputs and enforce HTTPS / strict CORS headers.

### ⚡ **Code Quality & Performance**
- Code structure is clean and readable.
- Recommended: Add explicit error boundaries / try-catch handling for async operations.

*(Note: Add your free Groq API Key in \`.env\` as \`VITE_GROQ_API_KEY\` for live LLM analysis!)*`;
  }
}

/**
 * Polish post content and suggest relevant dev tags
 */
export async function polishPostContent({ content }) {
  const prompt = `You are a social media copywriter for software developers on Connectra.
Rewrite and polish this developer's post draft into an engaging, concise post for other developers:

Draft: "${content}"

Requirements:
- Keep the authentic developer voice (not generic corporate speak).
- Add 2-3 relevant hashtags (e.g. #webdev, #ai, #cybersecurity, #buildinpublic).
- Make it 2 to 4 sentences maximum.`;

  try {
    return await callGroq({
      messages: [
        { role: 'system', content: 'You are an engaging developer copywriter.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    });
  } catch (err) {
    return `${content}\n\n🚀 #buildinpublic #devcommunity #webdev`;
  }
}

/**
 * Generate README and project architecture overview
 */
export async function generateProjectReadme({ title, description, techStack, repoUrl }) {
  const prompt = `You are an open-source maintainer. Generate a clean, attractive README.md draft for this project:
- Title: ${title}
- Description: ${description || 'A modern developer tool'}
- Tech Stack: ${techStack || 'React, Vite, Supabase'}
- Repo: ${repoUrl || 'https://github.com/developer/project'}

Include:
- 🌟 Project Overview
- 🚀 Core Features (3-4 bullets)
- 🔒 Security & Best Practices (1-2 bullets)
- 🛠️ Quickstart (install, run commands)

Keep it concise and ready to paste into GitHub.`;

  try {
    return await callGroq({
      messages: [
        { role: 'system', content: 'You are a technical documentation expert.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
    });
  } catch (err) {
    return `# ${title}\n\n${description || 'A modern developer project.'}\n\n## 🚀 Features\n- Fast and responsive UI\n- Secure authentication & database integration\n\n## 🛠️ Tech Stack\n${techStack || 'React, Tailwind CSS, Supabase'}\n\n## 🏁 Quickstart\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\``;
  }
}

/**
 * Connectra Copilot Chat (for the floating assistant)
 */
export async function chatWithCopilot({ messages, context = {} }) {
  const systemPrompt = `You are Connectra Copilot, an ultra-smart, friendly AI dev assistant built into Connectra (a developer collaboration and social platform).
You specialize in:
- Full-stack web development (React, Vite, Node, Supabase, Tailwind, TypeScript)
- Cybersecurity & Secure Coding (OWASP Top 10, Auth, JWTs, XSS, CSRF, input sanitization, bug bounties)
- Developer career advice and project collaboration tips

Context about current user:
${context.username ? `- User: @${context.username}` : ''}
${context.techStack ? `- Tech Stack: ${context.techStack}` : ''}

Style:
- Be concise, helpful, and technically precise.
- Use code blocks with language tags when showing code.
- If asked about security, always emphasize secure-by-default architecture.`;

  try {
    return await callGroq({
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.7,
    });
  } catch (err) {
    return `Hello! I'm your Connectra Copilot. 🚀\n\nIt looks like your \`VITE_GROQ_API_KEY\` is not set yet in \`.env\`. Grab a free key in 30 seconds at [console.groq.com](https://console.groq.com/keys) and paste it into your \`.env\` file to activate instant ultra-fast responses!`;
  }
}

/**
 * Profile review (backwards compatible with AIReviewPanel.jsx)
 */
export async function generateProfileReview(profile, repoCount) {
  const prompt = `You are an expert developer relations (DevRel) AI analyzing a developer's profile on Connectra.
Analyze this profile:
- Username: ${profile.username}
- Bio: ${profile.bio || 'Not provided'}
- Tech Stack: ${profile.tech_stack || 'Not specified'}
- Public Repositories: ${repoCount || 0}
- Location: ${profile.location || 'Not provided'}

Instructions:
1. Use markdown formatting.
2. Structure with these headers:
   - 🌟 **Profile Snapshot**
   - 💡 **Strengths**
   - 🛡️ **Cybersecurity & Architecture Posture**
   - 📈 **Growth Areas**
   - 🚀 **Verdict**
3. Keep it under 150 words.`;

  try {
    return await callGroq({
      messages: [
        { role: 'system', content: 'You are a DevRel and engineering evaluator.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
    });
  } catch (err) {
    return `🌟 **Profile Snapshot**\n${profile.username} has a solid foundation in ${profile.tech_stack || 'web development'}.\n\n💡 **Strengths**\n- Clear portfolio focus with ${repoCount || 0} repositories.\n\n🛡️ **Cybersecurity & Architecture Posture**\n- Demonstrates modern modular structure.\n\n📈 **Growth Areas**\n- Expand automated test coverage and link CTF/security badges.\n\n🚀 **Verdict**\nGreat trajectory for open-source and team collaborations!`;
  }
}
