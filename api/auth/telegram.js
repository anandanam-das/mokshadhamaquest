const jwt = require('jsonwebtoken');
const { verifyTelegramAuth } = require('../_lib/telegram');

const COOKIE_NAME = 'moksha_session';

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const { TELEGRAM_BOT_TOKEN, SESSION_SECRET } = process.env;
  if (!TELEGRAM_BOT_TOKEN || !SESSION_SECRET) {
    return res.status(500).json({ ok: false, error: 'server_misconfigured' });
  }

  const telegramData = req.body;

  if (!verifyTelegramAuth(telegramData, TELEGRAM_BOT_TOKEN)) {
    return res.status(401).json({ ok: false, error: 'invalid_signature' });
  }

  const token = jwt.sign(
    {
      id: telegramData.id,
      first_name: telegramData.first_name,
      username: telegramData.username,
    },
    SESSION_SECRET,
    { expiresIn: '30d' }
  );

  const maxAgeSeconds = 30 * 24 * 60 * 60;
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`
  );

  res.status(200).json({ ok: true, user: telegramData });
};
