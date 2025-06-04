// mayoristapro/backend/src/utils/jwtUtils.js
require('dotenv').config();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET is not defined. Please set it in your .env file.");
  process.exit(1); // Exit if secret is not set, critical for security
}

/**
 * Generates a JWT token.
 * @param {object} payload - The payload to include in the token (e.g., { id, role }).
 * @param {string} expiresIn - Token expiration time (e.g., '1h', '7d').
 * @returns {string} The generated JWT.
 */
const generateToken = (payload, expiresIn = '1h') => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload must be a non-empty object.');
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

/**
 * Verifies a JWT token.
 * @param {string} token - The JWT to verify.
 * @returns {object|null} The decoded payload if verification is successful, otherwise null.
 */
const verifyToken = (token) => {
  if (!token) {
    return null;
  }
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('Invalid token or error during verification:', error.message);
    return null;
  }
};

module.exports = {
  generateToken,
  verifyToken,
};
