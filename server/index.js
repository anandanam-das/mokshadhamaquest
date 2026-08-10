require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { verifyTelegramAuth, getChatMemberStatus, isActiveMember } = require('./telegram');

const {
  PORT = 3001,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHANNEL_ID,
  SESSION_SECRET,
  ALLOWED_ORIGIN = 'http://localhost:8765',
} = process.env;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHANNEL_ID || !SESSION_SECRET) {
  console.error(
    'Missing required env vars. Copy server/.env.example to server/.env and fill in TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID and SESSION_SECRET.'
  );
  process.exit(1);
}

const COOKIE_NAME = 'moksha_session';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));

function readSession(req) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, SESSION_SECRET);
  } catch (error) {
    return null;
  }
}

// Step 1: verify the signed payload from the Telegram Login Widget
// and open a session for that Telegram user.
app.post('/api/auth/telegram', (req, res) => {
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

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  res.json({ ok: true, user: telegramData });
});

// Step 2: check whether the logged-in user is subscribed to the
// closed channel/chat. Trusts the session cookie set above; falls
// back to a telegramId query param only if there's no session yet
// (e.g. page reload edge cases), so this never has to be re-signed.
app.get('/api/access', async (req, res) => {
  const session = readSession(req);
  const telegramId = session ? session.id : req.query.telegramId;

  if (!telegramId) {
    return res.status(401).json({ error: 'not_authenticated' });
  }

  try {
    const status = await getChatMemberStatus(TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID, telegramId);
    const hasAccess = isActiveMember(status);
    res.json({
      hasPlanetsAccess: hasAccess,
      hasSignsAccess: false,
      hasNakshatrasAccess: false,
    });
  } catch (error) {
    res.status(502).json({ error: 'telegram_api_error', message: error.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`MOKSHA auth server listening on http://localhost:${PORT}`);
});
