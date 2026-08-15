const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'moksha_session';

module.exports = (req, res) => {
  const { SESSION_SECRET } = process.env;
  const { token } = req.query;

  if (!token || !SESSION_SECRET) {
    res.writeHead(302, { Location: '/quest/login.html?error=missing_token' });
    return res.end();
  }

  let payload;
  try {
    payload = jwt.verify(token, SESSION_SECRET);
  } catch (error) {
    res.writeHead(302, { Location: '/quest/login.html?error=expired' });
    return res.end();
  }

  const sessionToken = jwt.sign(
    { id: payload.id, first_name: payload.first_name, username: payload.username },
    SESSION_SECRET
  );

  // Browsers cap cookie lifetime at ~400 days regardless of what we send;
  // this is the practical maximum, not a deliberate expiry on our side.
  const maxAgeSeconds = 400 * 24 * 60 * 60;
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`
  );

  res.writeHead(302, { Location: `/quest/checking.html?telegramId=${encodeURIComponent(payload.id)}` });
  res.end();
};
