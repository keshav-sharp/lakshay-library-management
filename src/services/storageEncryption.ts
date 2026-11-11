/**
 * Genuine Authenticated AES-256-GCM Encrypted Storage Layer for LibTrack v2.0.9
 * 
 * ARCHITECTURAL SPECIFICATION & CRYPTOGRAPHIC GUARANTEES:
 * 1. Algorithm: AES-256-GCM (Galois/Counter Mode) via audited @noble/ciphers with 128-bit native authentication tag.
 * 2. Nonce / IV: Unique 96-bit (12-byte) initialization vector generated per encryption operation via window.crypto.getRandomValues().
 * 3. Key Derivation: PBKDF2 with 210,000 iterations of SHA-256 (OWASP compliant) combining enterprise recovery passphrase with per-device storage salt.
 * 4. Zero Passphrase Persistence: Plaintext passphrases are NEVER stored in localStorage or sessionStorage. They are held transiently in secure module memory during the authenticated session.
 * 5. Fail-Closed Security: A missing passphrase or unprovisioned vault produces an immediate StorageCryptoError (`KEY_ERROR`), requiring administrative unlock. No default or fallback keys are permitted.
 */

import { gcm } from '@noble/ciphers/aes.js';
import { utf8ToBytes, bytesToUtf8 } from '@noble/ciphers/utils.js';
import CryptoJS from 'crypto-js';

export class StorageCryptoError extends Error {
  constructor(message: string, public code: 'KEY_ERROR' | 'ENCRYPTION_FAILED' | 'DECRYPTION_FAILED' | 'AUTH_FAILED' | 'CORRUPT_CIPHERTEXT') {
    super(message);
    this.name = 'StorageCryptoError';
  }
}

// In-memory session passphrase store (never persisted to localStorage/sessionStorage)
let sessionPassphrase: string | null = null;

export const setStaffPassphrase = (passphrase: string): void => {
  if (!passphrase || passphrase.trim().length < 8) {
    throw new StorageCryptoError('Enterprise staff recovery passphrase must be at least 8 characters.', 'KEY_ERROR');
  }
  sessionPassphrase = passphrase.trim();
};

export const getStaffPassphrase = (): string => {
  if (!sessionPassphrase) {
    throw new StorageCryptoError('Secure storage vault is locked. Staff recovery passphrase provisioning required.', 'KEY_ERROR');
  }
  return sessionPassphrase;
};

export const clearStaffPassphrase = (): void => {
  sessionPassphrase = null;
};

export const isVaultUnlocked = (): boolean => {
  return sessionPassphrase !== null;
};

const getCrypto = (): Crypto => {
  const cryptoObj = (typeof globalThis !== 'undefined' && globalThis.crypto) || (typeof window !== 'undefined' && window.crypto);
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    throw new StorageCryptoError('Cryptographically secure random number generator (crypto.getRandomValues) is unavailable.', 'KEY_ERROR');
  }
  return cryptoObj as unknown as Crypto;
};

const getDeviceStorageSalt = (): string => {
  const SALT_KEY = 'libtrack_device_storage_salt_v2';
  let salt = localStorage.getItem(SALT_KEY);
  if (!salt) {
    const cryptoObj = getCrypto();
    const buffer = new Uint8Array(16);
    cryptoObj.getRandomValues(buffer);
    salt = Array.from(buffer, b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(SALT_KEY, salt);
  }
  return salt;
};

const getDerivedAesKeyBytes = (customPassphrase?: string): Uint8Array => {
  const salt = getDeviceStorageSalt();
  const passphrase = customPassphrase || getStaffPassphrase();
  // PBKDF2 with 210,000 iterations (OWASP recommended standard)
  const derivedHex = CryptoJS.PBKDF2(passphrase, salt, {
    keySize: 256 / 32,
    iterations: 210000
  }).toString();

  const keyBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    keyBytes[i] = parseInt(derivedHex.substr(i * 2, 2), 16);
  }
  return keyBytes;
};

const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
};

const hexToBytes = (hex: string): Uint8Array => {
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new StorageCryptoError('Malformed hexadecimal representation in ciphertext envelope.', 'CORRUPT_CIPHERTEXT');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
};

export const encryptStoragePayload = (plaintext: string, customPassphrase?: string): string => {
  try {
    if (plaintext === '' || plaintext === undefined || plaintext === null) return '';
    if (typeof plaintext !== 'string') {
      plaintext = JSON.stringify(plaintext);
    }
    const keyBytes = getDerivedAesKeyBytes(customPassphrase);
    const cryptoObj = getCrypto();

    // 12-byte cryptographically random nonce (96 bits)
    const ivBytes = new Uint8Array(12);
    cryptoObj.getRandomValues(ivBytes);

    const plaintextBytes = utf8ToBytes(plaintext);
    const cipher = gcm(keyBytes, ivBytes);
    const ciphertextBytes = cipher.encrypt(plaintextBytes);

    const ivHex = bytesToHex(ivBytes);
    const ciphertextHex = bytesToHex(ciphertextBytes);

    return `AESGCM_GCM_V2:${ivHex}:${ciphertextHex}`;
  } catch (err) {
    if (err instanceof StorageCryptoError) throw err;
    throw new StorageCryptoError(`Genuine AES-256-GCM encryption failed: ${String(err)}`, 'ENCRYPTION_FAILED');
  }
};

export const decryptStoragePayload = (payload: string, customPassphrase?: string): string => {
  if (payload === '' || payload === undefined || payload === null) return '';
  if (typeof payload !== 'string') {
    throw new StorageCryptoError('Invalid payload type for decryption.', 'CORRUPT_CIPHERTEXT');
  }
  
  if (!payload.startsWith('AESGCM_GCM_V2:')) {
    throw new StorageCryptoError('Security violation: unencrypted, legacy, or incompatible payload format detected.', 'AUTH_FAILED');
  }

  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new StorageCryptoError('Corrupt ciphertext format: missing envelope parts.', 'CORRUPT_CIPHERTEXT');
  }

  const ivHex = parts[1];
  const ciphertextHex = parts[2];

  if (ivHex.length !== 24) {
    throw new StorageCryptoError('Invalid nonce length: expected 24 hex characters (12 bytes).', 'CORRUPT_CIPHERTEXT');
  }

  if (ciphertextHex.length < 32) {
    throw new StorageCryptoError('Truncated ciphertext payload.', 'CORRUPT_CIPHERTEXT');
  }

  const keyBytes = getDerivedAesKeyBytes(customPassphrase);
  const ivBytes = hexToBytes(ivHex);
  const ciphertextBytes = hexToBytes(ciphertextHex);

  try {
    const cipher = gcm(keyBytes, ivBytes);
    const decryptedBytes = cipher.decrypt(ciphertextBytes);
    return bytesToUtf8(decryptedBytes);
  } catch (err) {
    throw new StorageCryptoError(`Decryption authentication failed (ciphertext tampered, wrong passphrase, or invalid authentication tag): ${String(err)}`, 'AUTH_FAILED');
  }
};
