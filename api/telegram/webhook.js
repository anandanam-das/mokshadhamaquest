const jwt = require('jsonwebtoken');
const { sendMessage } = require('../_lib/telegram');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const { TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, SESSION_SECRET, SITE_URL } = process.env;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_WEBHOOK_SECRET || !SESSION_SECRET || !SITE_URL) {
    return res.status(500).json({ error: 'server_misconfigured' });
  }

  if (req.headers['x-telegram-bot-api-secret-token'] !== TELEGRAM_WEBHOOK_SECRET) {
    return res.status(401).end();
  }

  const message = req.body && req.body.message;
  const text = message && message.text;

  if (message && typeof text === 'string' && text.startsWith('/start')) {
    const { id, first_name, username } = message.from;
    const token = jwt.sign({ id, first_name, username }, SESSION_SECRET, { expiresIn: '10m' });
    const loginUrl = `${SITE_URL}/api/auth/telegram-callback?token=${encodeURIComponent(token)}`;

    await sendMessage(TELEGRAM_BOT_TOKEN, message.chat.id, 'Нажмите кнопку ниже, чтобы войти на сайт MOKSHA Quest:', {
      inline_keyboard: [[{ text: 'Открыть сайт', url: loginUrl }]],
    });
  }

  res.status(200).end();
};
