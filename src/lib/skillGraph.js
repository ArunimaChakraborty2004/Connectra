/**
 * Connectra Developer Skill Graph & Team Synergy Engine
 * Maps developer skills across a 4-dimensional engineering taxonomy:
 * 1. Frontend & Client Systems
 * 2. Backend & Distributed Systems
 * 3. DevOps, Cloud & Infrastructure
 * 4. Cybersecurity, Cryptography & Testing
 *
 * Implements a hybrid synergy formula:
 *   Synergy(Project, Candidate) = α * Overlap(P_req, C_skills) + β * DomainComplementarity(P_req, C_skills)
 */

export const SKILL_TAXONOMY = {
  frontend: [
    'react', 'react.js', 'vue', 'vue.js', 'angular', 'svelte', 'next.js', 'nuxt',
    'tailwind', 'tailwindcss', 'css', 'css3', 'html', 'html5', 'javascript', 'typescript',
    'webgl', 'three.js', 'redux', 'zustand', 'vite', 'webpack', 'ui/ux', 'frontend',
  ],
  backend: [
    'node', 'node.js', 'express', 'express.js', 'python', 'django', 'fastapi', 'flask',
    'go', 'golang', 'rust', 'java', 'spring', 'spring boot', 'c#', '.net', 'c++',
    'postgres', 'postgresql', 'supabase', 'mysql', 'mongodb', 'redis', 'graphql',
    'rest', 'rest api', 'sql', 'prisma', 'backend', 'microservices',
  ],
  devops: [
    'docker', 'kubernetes', 'k8s', 'aws', 'gcp', 'google cloud', 'azure', 'ci/cd',
    'github actions', 'terraform', 'ansible', 'linux', 'bash', 'nginx', 'devops',
    'serverless', 'prometheus', 'grafana', 'helm', 'cloud',
  ],
  cybersecurity: [
    'cybersecurity', 'security', 'appsec', 'owasp', 'penetration testing', 'pentesting',
    'cryptography', 'oauth', 'jwt', 'auth', 'zero-trust', 'network security', 'wireshark',
    'burp suite', 'jest', 'cypress', 'testing', 'unit testing', 'ethical hacking', 'audit',
  ],
};

/**
 * Normalizes a skill string (lowercase, trimmed, stripped of special characters)
 */
export function normalizeSkill(skill) {
  if (!skill) return '';
  return skill
    .toLowerCase()
    .trim()
    .replace(/[#+]/g, match => (match === '#' ? 'sharp' : match === '+' ? 'plus' : ''))
    .replace(/[^a-z0-9.\-_]/g, '');
}

/**
 * Parses raw skill strings or arrays into a clean list of normalized skills
 */
export function parseSkills(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map(normalizeSkill).filter(Boolean);
  }
  if (typeof input === 'string') {
    return input
      .split(/[,/|;\n]+/)
      .map(normalizeSkill)
      .filter(Boolean);
  }
  return [];
}

/**
 * Maps a list of skills into a normalized 4D domain vector:
 * [frontendWeight, backendWeight, devopsWeight, cybersecurityWeight]
 */
export function vectorizeSkills(skillsList) {
  const normalized = parseSkills(skillsList);
  const vector = {
    frontend: 0,
    backend: 0,
    devops: 0,
    cybersecurity: 0,
  };

  if (normalized.length === 0) return vector;

  for (const s of normalized) {
    let matchedDomain = false;
    for (const [domain, keywords] of Object.entries(SKILL_TAXONOMY)) {
      if (keywords.some(k => k === s || s.includes(k) || k.includes(s))) {
        vector[domain] += 1;
        matchedDomain = true;
      }
    }
    // Fallback: if general dev, give partial weight to frontend + backend
    if (!matchedDomain) {
      vector.frontend += 0.25;
      vector.backend += 0.25;
    }
  }

  // Normalize so highest component has weight 1.0 (if non-zero)
  const maxVal = Math.max(1, ...Object.values(vector));
  return {
    frontend: Number((vector.frontend / maxVal).toFixed(2)),
    backend: Number((vector.backend / maxVal).toFixed(2)),
    devops: Number((vector.devops / maxVal).toFixed(2)),
    cybersecurity: Number((vector.cybersecurity / maxVal).toFixed(2)),
  };
}

/**
 * Computes exact Jaccard Similarity between two sets of skills
 * Jaccard = |A ∩ B| / |A ∪ B|
 */
export function computeJaccardSimilarity(skillsA, skillsB) {
  const setA = new Set(parseSkills(skillsA));
  const setB = new Set(parseSkills(skillsB));

  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) {
      intersection++;
    } else {
      // Partial alias match
      for (const b of setB) {
        if (item.includes(b) || b.includes(item)) {
          intersection += 0.7;
          break;
        }
      }
    }
  }

  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Computes the Team Synergy Score between a project and a developer
 * Combines direct technical match (60%) with domain complementarity (40%)
 *
 * @param {object} params
 * @param {string|Array} params.requiredSkills - Skills needed by project or team
 * @param {string|Array} params.userSkills - Skills possessed by user
 * @param {Array} params.existingTeamSkills - (Optional) Current team skills to evaluate diversity
 * @returns {object} { score, matchLevel, breakdown, matchedSkills, complementarySkills }
 */
export function computeTeamSynergy({ requiredSkills, userSkills, existingTeamSkills = [] }) {
  const reqList = parseSkills(requiredSkills);
  const userList = parseSkills(userSkills);

  if (reqList.length === 0 || userList.length === 0) {
    return {
      score: 50,
      matchLevel: 'Moderate Match',
      matchedSkills: [],
      complementarySkills: [],
      breakdown: { directOverlap: 50, domainComplementarity: 50 },
    };
  }

  // 1. Direct Technical Overlap (Jaccard similarity scaled 0-100)
  const rawJaccard = computeJaccardSimilarity(reqList, userList);
  const directOverlap = Math.min(100, Math.round(rawJaccard * 160)); // Scaled for realistic skill distributions

  // 2. Identify exact matched skills
  const matchedSkills = userList.filter(u =>
    reqList.some(r => r === u || u.includes(r) || r.includes(u))
  );

  // 3. Domain Complementarity
  // Evaluates if user brings crucial adjacent engineering pillars (e.g. Security or DevOps)
  const reqVec = vectorizeSkills(reqList);
  const userVec = vectorizeSkills(userList);

  let complementarityScore = 60; // baseline
  const complementaryDomains = [];

  for (const [domain, userWeight] of Object.entries(userVec)) {
    const reqWeight = reqVec[domain] || 0;
    // If project was weak in this domain (< 0.3) but candidate is strong (> 0.5)
    if (reqWeight < 0.3 && userWeight >= 0.5) {
      complementarityScore += 18;
      complementaryDomains.push(domain);
    }
  }
  complementarityScore = Math.min(100, Math.max(30, complementarityScore));

  // 4. Weighted Composite Synergy Score: 60% Overlap + 40% Complementarity
  const compositeScore = Math.min(99, Math.max(35, Math.round(0.6 * directOverlap + 0.4 * complementarityScore)));

  let matchLevel = 'Moderate Match';
  if (compositeScore >= 88) matchLevel = 'Exceptional Synergy';
  else if (compositeScore >= 75) matchLevel = 'Strong Synergy';
  else if (compositeScore >= 60) matchLevel = 'Good Fit';

  return {
    score: compositeScore,
    matchLevel,
    matchedSkills,
    complementaryDomains,
    breakdown: {
      directOverlap,
      domainComplementarity: complementarityScore,
      userVector: userVec,
      projectVector: reqVec,
    },
  };
}

/**
 * Generates an explainable 1-sentence synergy breakdown
 */
export function getSynergyRationale({ synergy, projectTitle = 'this project' }) {
  const { score, matchedSkills, complementaryDomains } = synergy;

  const matchedPart = matchedSkills.length > 0
    ? `Matches required ${matchedSkills.slice(0, 3).join(', ')}`
    : 'Brings solid foundational engineering expertise';

  const compPart = complementaryDomains.length > 0
    ? `and introduces high-value ${complementaryDomains.map(d => d.toUpperCase()).join(' & ')} domain strength.`
    : `aligning well with ${projectTitle}.`;

  return `${score}% Synergy: ${matchedPart} ${compPart}`;
}
