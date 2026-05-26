// vault-crypto.js — Client-side AES-256-GCM encryption for vault items.
// Key derivation: PBKDF2-SHA256 (310,000 iterations). Key never leaves the browser.

const PBKDF2_ITERATIONS = 310_000;
const VERIFIER_PLAINTEXT = 'orbit-vault-v1';

const enc = new TextEncoder();
const dec = new TextDecoder();

const hexToBytes = (hex) => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return bytes;
};

const bytesToHex = (bytes) =>
  Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

const toBase64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromBase64 = (b64) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

export const generateSalt = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToHex(bytes);
};

export const deriveKey = async (password, saltHex) => {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
};

export const encryptValue = async (plaintext, key) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );
  return `${toBase64(iv)}:${toBase64(cipherBuf)}`;
};

export const decryptValue = async (ciphertext, key) => {
  const [ivB64, dataB64] = ciphertext.split(':');
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(ivB64) },
    key,
    fromBase64(dataB64)
  );
  return dec.decode(plainBuf);
};

export const createVerifier = (key) => encryptValue(VERIFIER_PLAINTEXT, key);

export const verifyKey = async (verifier, key) => {
  try {
    const result = await decryptValue(verifier, key);
    return result === VERIFIER_PLAINTEXT;
  } catch {
    return false;
  }
};

// Derive a short fingerprint from the raw key bytes for display
export const keyFingerprint = async (key) => {
  const raw = await crypto.subtle.exportKey('raw', key);
  const hash = await crypto.subtle.digest('SHA-256', raw);
  const bytes = new Uint8Array(hash).slice(0, 8);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(':');
};

// Session key: stored in memory only, never in localStorage/sessionStorage
let _sessionKey = null;
let _sessionFingerprint = null;

export const setSessionKey = async (key) => {
  _sessionKey = key;
  _sessionFingerprint = await keyFingerprint(key);
};

export const getSessionKey = () => _sessionKey;
export const getSessionFingerprint = () => _sessionFingerprint;
export const clearSessionKey = () => { _sessionKey = null; _sessionFingerprint = null; };
export const isVaultUnlocked = () => _sessionKey !== null;
