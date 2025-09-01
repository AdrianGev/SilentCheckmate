// Authentication utilities
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Token configuration
const ACCESS_TTL = '15m';
const REFRESH_TTL = '30d';

/**
 * Sign an access token for a user
 * @param {Object} user - User object with id and username
 * @returns {string} JWT access token
 */
function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TTL }
  );
}

/**
 * Sign a refresh token for a user
 * @param {Object} user - User object with id
 * @returns {string} JWT refresh token
 */
function signRefreshToken(user) {
  return jwt.sign(
    { sub: user.id },
    process.env.REFRESH_SECRET,
    { expiresIn: REFRESH_TTL }
  );
}

/**
 * Hash a string using SHA-256
 * @param {string} str - String to hash
 * @returns {string} Hashed string
 */
function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Set authentication cookies in the response
 * @param {Object} res - Express response object
 * @param {string} accessToken - JWT access token
 * @param {string} refreshToken - JWT refresh token
 */
function setAuthCookies(res, accessToken, refreshToken) {
  const isProd = process.env.NODE_ENV === 'production';
  
  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: 15 * 60 * 1000 // 15 minutes
  });
  
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/auth',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });
}

/**
 * Authentication middleware to protect routes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function requireAuth(req, res, next) {
  const token = req.cookies?.access_token || 
    (req.headers.authorization?.startsWith('Bearer ') ? 
      req.headers.authorization.slice(7) : null);
  
  if (!token) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

export {
  argon2,
  jwt,
  signAccessToken,
  signRefreshToken,
  sha256,
  setAuthCookies,
  requireAuth
};
