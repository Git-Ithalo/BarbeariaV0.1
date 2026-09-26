const crypto = require('crypto');
const { db } = require('./db');

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  db.prepare('INSERT INTO sessions (token,user_id,created_at,expires_at) VALUES (?,?,?,?)')
    .run(token, userId, now, now + SESSION_TTL_MS);
  return token;
}

function destroySession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function getUserByToken(token) {
  if (!token) return null;
  const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!session) return null;
  if (session.expires_at < Date.now()) {
    destroySession(token);
    return null;
  }
  return db.prepare('SELECT id,name,email,phone,role,created_at FROM users WHERE id = ?').get(session.user_id);
}

// Middleware: exige login (qualquer papel)
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const user = getUserByToken(token);
  if (!user) return res.status(401).json({ error: 'Não autenticado. Faça login novamente.' });
  req.user = user;
  req.token = token;
  next();
}

// Middleware: exige papel admin
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
    next();
  });
}

module.exports = { createSession, destroySession, getUserByToken, requireAuth, requireAdmin };
