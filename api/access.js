const jwt = require('jsonwebtoken');
const { getChatMemberStatus, isActiveMember } = require('./_lib/telegram');

const COOKIE_NAME = 'moksha_session';
const ACCESS_COOKIE_NAME = 'moksha_access';
const ACCESS_COOKIE_MAX_AGE_SECONDS = 15 * 60;

function readSession(req) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    const session = jwt.verify(token, process.env.SESSION_SECRET, { algorithms: ['HS256'] });
    return typeof session.first_name === 'string' && !session.exp ? session : null;
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


  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID, TELEGRAM_SIGNS_CHANNEL_ID, SESSION_SECRET } = process.env;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHANNEL_ID || !SESSION_SECRET) {
    return sendJson(res, 500, { error: 'server_misconfigured' });
  }

  const session = readSession(req);
  if (!session?.id) return sendJson(res, 401, { error: 'not_authenticated' });

  const chats = Object.entries({ planets: TELEGRAM_CHANNEL_ID, signs: TELEGRAM_SIGNS_CHANNEL_ID })
    .filter(([, chatId]) => chatId);
  const checks = await Promise.allSettled(chats.map(async ([block, chatId]) => {
    const member = await getChatMemberStatus(TELEGRAM_BOT_TOKEN, chatId, session.id);
    return isActiveMember(member) ? block : null;
  }));
  const blocks = checks.flatMap((check) => check.status === 'fulfilled' && check.value ? [check.value] : []);
  const unavailableBlocks = chats.flatMap(([block], index) => checks[index].status === 'rejected' ? [block] : []);
  const accessToken = blocks.length ? jwt.sign({ id: session.id, blocks }, SESSION_SECRET, { expiresIn: '15m' }) : '';
  res.setHeader('Set-Cookie',
    `${ACCESS_COOKIE_NAME}=${accessToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${blocks.length ? ACCESS_COOKIE_MAX_AGE_SECONDS : 0}`);
  if (!blocks.length && unavailableBlocks.length) {
    return sendJson(res, 502, { error: 'telegram_api_error' });
  }

  return sendJson(res, 200, {
    telegramId: session.id,
    hasPlanetsAccess: blocks.includes('planets'),
    hasSignsAccess: blocks.includes('signs'),
    hasNakshatrasAccess: false,
    unavailableBlocks,
  });
};
