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

module.exports = { requireAuth };
