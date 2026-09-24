window.MOKSHA_CONFIG = {
  // Username of the bot (without @) — used to build the t.me deep link.
  telegramBotUsername: 'moksha_education_bot',
  // Empty string = same origin as the frontend (Vercel serves /api from
  // the same domain). Only set this if the API is hosted elsewhere.
  apiBaseUrl: '',
  // Separate personal-cabinet service (profile, progress sync,
  // certificates) — runs on its own VPS/DB, isolated from the payment
  // backend. See quest-api/ in the repo root.
  questApiBaseUrl: 'https://api.moksha-education.com',
  // Telegram numeric ids that skip profile registration entirely and get
  // admin access. Mirrored server-side in quest-api's ADMIN_TELEGRAM_IDS —
  // this array is only for frontend routing (which page to redirect to),
  // never trusted for actually protecting admin data.
  adminTelegramIds: ['8254725055'],
};
