const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; // no 0/O/1/l/I

/**
 * Generate a URL-safe, unambiguous short code.
 * Uses crypto.randomBytes for unpredictability (no sequential IDs to enumerate).
 */
function generateCode(length = 7) {
  if (!Number.isInteger(length) || length < 4 || length > 32) {
    throw new RangeError('code length must be an integer between 4 and 32');
  }
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

/**
 * Validate that a string is a well-formed http(s) URL.
 * Rejects other protocols (javascript:, file:, ftp:) to prevent open-redirect abuse.
 */
function isValidUrl(input) {
  if (typeof input !== 'string' || input.length === 0 || input.length > 2048) {
    return false;
  }
  let url;
  try {
    url = new URL(input);
  } catch {
    return false;
  }
  return url.protocol === 'http:' || url.protocol === 'https:';
}

/** Codes must match what generateCode can produce. */
function isValidCode(code) {
  return typeof code === 'string' && /^[A-Za-z2-9]{4,32}$/.test(code);
}

module.exports = { generateCode, isValidUrl, isValidCode, ALPHABET };
