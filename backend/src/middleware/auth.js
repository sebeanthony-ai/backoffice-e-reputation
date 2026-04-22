const jwt = require('jsonwebtoken');
const { findById, sanitizeUser } = require('../models/users');

const COOKIE_NAME = 'bo_token';
const TOKEN_TTL = '7d';

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      'JWT_SECRET manquant ou trop court (définir une chaîne aléatoire ≥ 32 caractères dans .env)'
    );
  }
  return s;
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    getSecret(),
    { expiresIn: TOKEN_TTL }
  );
}

function cookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

function readToken(req) {
  if (req.cookies && req.cookies[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return null;
}

function requireAuth(req, res, next) {
  try {
    const token = readToken(req);
    if (!token) return res.status(401).json({ error: 'Non authentifié' });
    const payload = jwt.verify(token, getSecret());
    const user = findById(payload.sub);
    if (!user) return res.status(401).json({ error: 'Session invalide' });
    req.user = sanitizeUser(user);
    next();
  } catch (_err) {
    res.status(401).json({ error: 'Session expirée ou invalide' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }
    next();
  });
}

module.exports = {
  COOKIE_NAME,
  signToken,
  cookieOptions,
  requireAuth,
  requireAdmin,
  readToken,
};
