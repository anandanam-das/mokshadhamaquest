const jwt = require('jsonwebtoken');
const { getChatMemberStatus, isActiveMember } = require('./_lib/telegram');

const COOKIE_NAME = 'moksha_session';
const ACCESS_COOKIE_NAME = 'moksha_access';
// Browsers cap cookie lifetime at ~400 days regardless of what we send;
// this is the practical maximum, not a deliberate expiry on our side.
const ACCESS_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

function readSession(req) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.SESSION_SECRET);
  } catch (error) {
    return null;
  }
}

// res.status().json() goes through @vercel/node's Express-like `send`, which
// auto-computes an ETag and short-circuits to 304 whenever the request's
// If-None-Match matches — REGARDLESS of Cache-Control: no-store. That 304
// carries no body and no Set-Cookie, so the moksha_access cookie silently
// never gets (re)set and the village.html redirect loops forever. Telegram's
// in-app browser hits this far more readily than Safari does. Writing the
// response manually via res.end() bypasses that freshness check entirely.
function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.removeHeader('ETag');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(payload);
}

module.exports = async (req, res) => {
  // Per-user, cookie-dependent response — any caching layer (CDN, browser)
  // serving a stale/shared copy here means the moksha_access cookie never
  // actually gets (re)set, and the village.html middleware redirect loops
  // back to checking.html forever (this is what was hanging on "Проверяем
  // доступ…" — logs showed /api/access repeatedly answering 304).
  res.setHeader('Cache-Control', 'private, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID, SESSION_SECRET } = process.env;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHANNEL_ID || !SESSION_SECRET) {
    return sendJson(res, 500, { error: 'server_misconfigured' });
  }

  const session = readSession(req);
  const telegramId = session ? session.id : req.query.telegramId;

  if (!telegramId) {
    return sendJson(res, 401, { error: 'not_authenticated' });
  }

  try {
    const status = await getChatMemberStatus(TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID, telegramId);
    const hasAccess = isActiveMember(status);

    if (hasAccess) {
      const accessToken = jwt.sign({ id: telegramId }, SESSION_SECRET);
      res.setHeader(
        'Set-Cookie',
        `${ACCESS_COOKIE_NAME}=${accessToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ACCESS_COOKIE_MAX_AGE_SECONDS}`
      );
    } else {
      res.setHeader('Set-Cookie', `${ACCESS_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
    }

    sendJson(res, 200, {
      telegramId,
      hasPlanetsAccess: hasAccess,
      hasSignsAccess: false,
      hasNakshatrasAccess: false,
    });
  } catch (error) {
    sendJson(res, 502, { error: 'telegram_api_error', message: error.message });
  }
};
