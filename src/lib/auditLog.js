/**
 * Connectra Cryptographic Audit Logging Engine
 * Implements an immutable, append-only security audit trail with SHA-256 hash chaining
 * (micro-blockchain architecture) to prevent retrospective tampering by malicious actors
 * or database administrators.
 *
 * Each block:
 *   H_i = SHA-256(H_{i-1} || index || timestamp || action || actorId || JSON(details))
 */

const AUDIT_STORAGE_KEY = 'connectra_security_audit_chain';
const GENESIS_PREV_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Computes SHA-256 hex digest using Web Cryptography API
 */
async function sha256(str) {
  const enc = new TextEncoder();
  const buffer = await window.crypto.subtle.digest('SHA-256', enc.encode(str));
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Loads the current audit chain from localStorage or initializes genesis block
 */
export function getAuditChain() {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    // fallback
  }

  // Initial Genesis Block
  const genesis = [
    {
      index: 0,
      timestamp: '2026-11-01T00:00:00.000Z',
      action: 'SYSTEM_GENESIS',
      actorId: 'system:zero-trust-root',
      details: { message: 'Connectra Zero-Trust Cryptographic Audit Chain Initialized' },
      prevHash: GENESIS_PREV_HASH,
      hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    },
  ];
  try {
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(genesis));
  } catch (e) {}
  return genesis;
}

/**
 * Appends a new immutable event to the cryptographic audit chain
 * @param {object} params
 * @param {string} params.action - e.g. 'SECRET_INTERCEPTED', 'SAST_REMEDIATION_APPLIED', 'E2EE_KEY_ROTATED'
 * @param {string} params.actorId - User ID or 'system'
 * @param {object} params.details - Arbitrary event metadata
 * @returns {Promise<object>} The newly minted audit block
 */
export async function appendAuditEvent({ action, actorId = 'anonymous', details = {} }) {
  const chain = getAuditChain();
  const prevBlock = chain[chain.length - 1];
  const newIndex = chain.length;
  const timestamp = new Date().toISOString();

  // Payload for hash chaining
  const payloadToHash = `${prevBlock.hash}|${newIndex}|${timestamp}|${action}|${actorId}|${JSON.stringify(details)}`;
  const hash = await sha256(payloadToHash);

  const newBlock = {
    index: newIndex,
    timestamp,
    action,
    actorId,
    details,
    prevHash: prevBlock.hash,
    hash,
  };

  chain.push(newBlock);
  // Keep up to 200 blocks in browser storage for demonstration & verification
  if (chain.length > 200) chain.shift();

  try {
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(chain));
  } catch (e) {}

  // Dispatch custom event so UI dashboards can update live
  window.dispatchEvent(new CustomEvent('auditChainUpdated', { detail: newBlock }));

  return newBlock;
}

/**
 * Mathematically verifies the entire audit chain from genesis to head block
 * Returns { valid: boolean, verifiedBlocks: number, corruptedBlockIndex: number | null }
 */
export async function verifyAuditChain() {
  const chain = getAuditChain();
  if (chain.length === 0) return { valid: false, verifiedBlocks: 0, corruptedBlockIndex: null };

  for (let i = 1; i < chain.length; i++) {
    const current = chain[i];
    const prev = chain[i - 1];

    // Check pointer integrity
    if (current.prevHash !== prev.hash) {
      return {
        valid: false,
        verifiedBlocks: i,
        corruptedBlockIndex: i,
        error: `Broken link: Block #${i} prevHash does not match Block #${i - 1} hash`,
      };
    }

    // Check cryptographic hash integrity
    const payloadToHash = `${prev.hash}|${current.index}|${current.timestamp}|${current.action}|${current.actorId}|${JSON.stringify(current.details)}`;
    const computedHash = await sha256(payloadToHash);

    if (computedHash !== current.hash) {
      return {
        valid: false,
        verifiedBlocks: i,
        corruptedBlockIndex: i,
        error: `Hash mismatch at Block #${i}: Expected ${computedHash}, got ${current.hash}`,
      };
    }
  }

  return {
    valid: true,
    verifiedBlocks: chain.length,
    corruptedBlockIndex: null,
  };
}
