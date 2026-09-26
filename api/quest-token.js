const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'moksha_session';

// Mints a short-lived token for the separate quest-api service (personal
// cabinet / progress / certificates). Deliberately signed with its own
// secret, not SESSION_SECRET — that secret also guards the payment/access
// cookies, and this token must never be valid there or vice versa.
module.exports = (req, res) => {
  // Mints a token unique per signed-in user — must never be cached/shared
  // across requests (same class of bug as /api/access, see its comment).
  res.setHeader('Cache-Control', 'private, no-store, must-revalidate');

  const { SESSION_SECRET, QUEST_API_SECRET } = process.env;
  if (!SESSION_SECRET || !QUEST_API_SECRET) {
    return res.status(500).json({ error: 'server_misconfigured' });
  }

  const cookieToken = req.cookies && req.cookies[COOKIE_NAME];
  if (!cookieToken) {
    return res.status(401).json({ error: 'not_authenticated' });
  }

  let session;
  try {
    session = jwt.verify(cookieToken, SESSION_SECRET);
  } catch (error) {
    return res.status(401).json({ error: 'not_authenticated' });
  }

  const questToken = jwt.sign({ id: session.id }, QUEST_API_SECRET, { expiresIn: '24h' });
  res.json({ token: questToken });
};
