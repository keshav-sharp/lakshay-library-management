/**
 * Cryptographically Secure Random Utilities for LibTrack v2.0.9
 * Replaces all security-sensitive Math.random() calls with window.crypto.getRandomValues().
 */

export const getSecureRandomHex = (length = 6): string => {
  const array = new Uint8Array(length);
  const cryptoObj = (typeof globalThis !== 'undefined' && globalThis.crypto) || (typeof window !== 'undefined' && window.crypto);
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    cryptoObj.getRandomValues(array);
  } else {
    throw new Error('Cryptographically secure random number generator (crypto.getRandomValues) is unavailable.');
  }
  return Array.from(array, b => b.toString(36)).join('').substring(0, length);
};
