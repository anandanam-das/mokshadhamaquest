const jwt = require('jsonwebtoken');

// Trust boundary is intentionally separate from the main moksha payment
// backend's SESSION_SECRET: this token only ever grants access to quest
// progress/profile data, never to payment or subscription endpoints.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'missing_token' });
  }
  try {
    const payload = jwt.verify(token, process.env.QUEST_API_SECRET);
    req.telegramId = String(payload.id);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

// Must run after requireAuth (needs req.telegramId already set). The
// frontend's own admin check is only for routing (which page to show) —
// this is the actual gate on admin data, checked against the server's own
// env var so it can't be spoofed by editing client-side config.
function requireAdmin(req, res, next) {
  const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);
  if (!adminIds.includes(req.telegramId)) {
    return res.status(403).json({ error: 'not_admin' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
