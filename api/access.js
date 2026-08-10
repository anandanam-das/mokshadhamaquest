const jwt = require('jsonwebtoken');
const { getChatMemberStatus, isActiveMember } = require('./_lib/telegram');

const COOKIE_NAME = 'moksha_session';

function readSession(req) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.SESSION_SECRET);
  } catch (error) {
    return null;
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID, SESSION_SECRET } = process.env;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHANNEL_ID || !SESSION_SECRET) {
    return res.status(500).json({ error: 'server_misconfigured' });
  }

  const session = readSession(req);
  const telegramId = session ? session.id : req.query.telegramId;

  if (!telegramId) {
    return res.status(401).json({ error: 'not_authenticated' });
  }

  try {
    const status = await getChatMemberStatus(TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID, telegramId);
    const hasAccess = isActiveMember(status);
    res.status(200).json({
      hasPlanetsAccess: hasAccess,
      hasSignsAccess: false,
      hasNakshatrasAccess: false,
    });
  } catch (error) {
    res.status(502).json({ error: 'telegram_api_error', message: error.message });
  }
};
