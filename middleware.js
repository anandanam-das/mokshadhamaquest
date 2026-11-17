import { jwtVerify } from 'jose';
import telegram from './api/_lib/telegram.js';

const { getChatMemberStatus, isActiveMember } = telegram;

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
// Собираем Response вручную (не через Response.redirect()) — у объекта,
// который возвращает Response.redirect(), заголовки неизменяемые в этом
// рантайме, и .headers.set() на нём падает с MIDDLEWARE_INVOCATION_FAILED.
const redirectNoStore = (url) =>
  new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
      'Cache-Control': 'private, no-store, must-revalidate',
    },
  });

export default async function middleware(request) {
  const url = new URL(request.url);
  const secret = new TextEncoder().encode(process.env.SESSION_SECRET);

  const session = await verify(getCookie(request, SESSION_COOKIE), secret);
  if (!session?.id || typeof session.first_name !== 'string' || session.exp) {
    return redirectNoStore(new URL('/quest/login.html', url));
  }

  const access = await verify(getCookie(request, ACCESS_COOKIE), secret);
  const block = url.pathname.endsWith('/signs-preview.html') ? 'signs' : 'planets';
  const blocks = Array.isArray(access?.blocks) ? access.blocks : [];
  const signsPaused = block === 'signs' && process.env.MOKSHA_SIGNS_ENABLED !== 'true';
  const checking = new URL('/quest/checking.html', url);
  checking.searchParams.set('block', block);
  if (signsPaused || !access || String(access.id) !== String(session.id) || !blocks.includes(block)) {
    return redirectNoStore(checking);
  }

  if (block === 'planets') {
    try {
      const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID } = process.env;
      if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHANNEL_ID) throw new Error('Telegram is not configured');
      // The signed grant identifies the block, but chat membership can change before it expires.
      const member = await getChatMemberStatus(TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID, session.id);
      if (!isActiveMember(member)) return redirectNoStore(checking);
    } catch {
      return new Response('Не удалось проверить участие в Telegram-чате. Обнови страницу через несколько секунд.', {
        status: 503,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'private, no-store, must-revalidate',
          'Retry-After': '5',
        },
      });
    }
  }
}

export const config = {
  matcher: ['/quest/village.html', '/quest/prologue.html', '/quest/create-character.html', '/quest/signs-preview.html'],
};
