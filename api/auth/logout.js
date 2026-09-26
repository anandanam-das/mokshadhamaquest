const COOKIE_NAME = 'moksha_session';

// Bypasses @vercel/node's res.json() freshness/ETag short-circuit — see the
// comment on the equivalent helper in api/access.js.
function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.removeHeader('ETag');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(payload);
}

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  sendJson(res, 200, { ok: true });
};
