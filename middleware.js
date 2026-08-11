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

export default async function middleware(request) {
  const url = new URL(request.url);
  const secret = new TextEncoder().encode(process.env.SESSION_SECRET);

  const session = await verify(getCookie(request, SESSION_COOKIE), secret);
  if (!session) {
    return Response.redirect(new URL('/login.html', url), 302);
  }

  const access = await verify(getCookie(request, ACCESS_COOKIE), secret);
  if (!access || String(access.id) !== String(session.id)) {
    return Response.redirect(new URL('/checking.html', url), 302);
  }
}

export const config = {
  matcher: ['/village.html', '/prologue.html', '/create-character.html'],
};
