import { jwtVerify } from 'jose';

const SESSION_COOKIE = 'moksha_session';
const ACCESS_COOKIE = 'moksha_access';

function getCookie(request, name) {
  const header = request.headers.get('cookie');
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function verify(token, secret) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    return payload;
  } catch (error) {
    return null;
  }
}

// Каждый ответ здесь зависит от кук конкретного пользователя — если
// редирект закэшируется (edge/CDN/браузер), следующий заход другого
// пользователя (или того же после успешной проверки) получит чужой или
// устаревший ответ. На проде это выглядело как бесконечный цикл
// village.html → checking.html → village.html, потому что /api/access
// точно так же не был помечен no-store (см. его комментарий).
const withNoStore = (response) => {
  response.headers.set('Cache-Control', 'private, no-store, must-revalidate');
  return response;
};

export default async function middleware(request) {
  const url = new URL(request.url);
  const secret = new TextEncoder().encode(process.env.SESSION_SECRET);

  const session = await verify(getCookie(request, SESSION_COOKIE), secret);
  if (!session) {
    return withNoStore(Response.redirect(new URL('/quest/login.html', url), 302));
  }

  const access = await verify(getCookie(request, ACCESS_COOKIE), secret);
  if (!access || String(access.id) !== String(session.id)) {
    return withNoStore(Response.redirect(new URL('/quest/checking.html', url), 302));
  }
}

export const config = {
  matcher: ['/quest/village.html', '/quest/prologue.html', '/quest/create-character.html'],
};
