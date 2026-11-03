/**
 * Connectra Pre-Publish Secret & Credential Leak Scanner
 * Combines standard signature regex patterns with Shannon entropy detection
 * to prevent accidental exposure of API keys, private keys, and tokens.
 */

// Well-known secret signature patterns
const SECRET_PATTERNS = [
  {
    type: 'AWS_ACCESS_KEY',
    label: 'AWS Access Key ID',
    regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
  },
  {
    type: 'GITHUB_PAT',
    label: 'GitHub Personal Access Token',
    regex: /ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82}/g,
  },
  {
    type: 'GROQ_API_KEY',
    label: 'Groq API Key',
    regex: /gsk_[a-zA-Z0-9]{48,}/g,
  },
  {
    type: 'OPENAI_API_KEY',
    label: 'OpenAI Secret Key',
    regex: /sk-[a-zA-Z0-9]{32,50}/g,
  },
  {
    type: 'STRIPE_SECRET_KEY',
    label: 'Stripe Live Secret Key',
    regex: /sk_live_[0-9a-zA-Z]{24,34}/g,
  },
  {
    type: 'PRIVATE_KEY',
    label: 'Private Cryptographic Key',
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
  },
  {
    type: 'SLACK_TOKEN',
    label: 'Slack Bot/User Token',
    regex: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*/g,
  },
  {
    type: 'GENERIC_SECRET_ASSIGNMENT',
    label: 'Hardcoded Secret Assignment',
    regex: /(?:api[_-]?key|secret|token|auth[_-]?token|password)\s*[:=]\s*["']([a-zA-Z0-9_.~+/=-]{20,})["']/gi,
  },
];

/**
 * Calculates Shannon Entropy of a string to detect random cryptographic keys
 * Higher entropy (typically > 4.2 for base64 / hex) indicates high randomness.
 */
export function calculateShannonEntropy(str) {
  if (!str || str.length === 0) return 0;
  const frequencies = {};
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    frequencies[char] = (frequencies[char] || 0) + 1;
  }
  let entropy = 0;
  const len = str.length;
  for (const char in frequencies) {
    const p = frequencies[char] / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Scans input text / code for known secrets and high-entropy tokens
 * @param {string} text - The content to inspect
 * @returns {object} { hasSecrets: boolean, detections: Array }
 */
export function scanForSecrets(text) {
  if (!text || typeof text !== 'string') {
    return { hasSecrets: false, detections: [] };
  }

  const detections = [];
  const seenMatches = new Set();

  // 1. Signature-based scanning
  for (const pattern of SECRET_PATTERNS) {
    pattern.regex.lastIndex = 0;
    let match;
    while ((match = pattern.regex.exec(text)) !== null) {
      const fullMatch = match[0];
      const sensitivePart = match[1] || fullMatch;

      if (!seenMatches.has(sensitivePart) && sensitivePart.length >= 16) {
        seenMatches.add(sensitivePart);
        detections.push({
          type: pattern.type,
          label: pattern.label,
          match: sensitivePart,
          redacted: `[REDACTED_${pattern.type}]`,
          entropy: Number(calculateShannonEntropy(sensitivePart).toFixed(2)),
        });
      }
    }
  }

  // 2. High-Entropy String Tokenizer (find unquoted high-entropy tokens > 24 chars)
  const tokens = text.split(/[\s,;(){}[\]'"`]+/);
  for (const token of tokens) {
    if (token.length >= 28 && !seenMatches.has(token) && !token.includes('http')) {
      const entropy = calculateShannonEntropy(token);
      // High randomness threshold (standard base64 or alphanumeric token)
      if (entropy >= 4.4 && /[A-Za-z]/.test(token) && /[0-9]/.test(token)) {
        seenMatches.add(token);
        detections.push({
          type: 'HIGH_ENTROPY_TOKEN',
          label: 'Potential Unlabeled Secret Token',
          match: token,
          redacted: '[REDACTED_SECRET_KEY]',
          entropy: Number(entropy.toFixed(2)),
        });
      }
    }
  }

  return {
    hasSecrets: detections.length > 0,
    detections,
  };
}

/**
 * Replaces all detected secrets in text with safe redaction masks
 * @param {string} text
 * @param {Array} detections
 * @returns {string} Safe redacted text
 */
export function redactSecrets(text, detections = null) {
  if (!text) return text;
  const items = detections || scanForSecrets(text).detections;
  let safeText = text;
  for (const item of items) {
    safeText = safeText.split(item.match).join(item.redacted);
  }
  return safeText;
}
