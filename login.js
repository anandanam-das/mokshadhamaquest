document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('telegramLoginBtn');
  const statusEl = document.getElementById('loginStatus');
  const devBypassBtn = document.getElementById('devBypassBtn');

  // Локальная разработка: Telegram Login Widget не работает на localhost
  // (нужен HTTPS-домен, см. server/README.md), поэтому на localhost
  // показываем обходную кнопку, которая не требует бота вообще. На
  // проде (не localhost) эта кнопка остаётся скрытой, реальный флоу
  // авторизации не меняется.
  const isLocalDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (isLocalDev) {
    devBypassBtn.hidden = false;
    devBypassBtn.addEventListener('click', () => {
      setUserState({ telegramId: 'dev-local-user' });
      window.location.href = 'checking.html';
    });
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get('error') === 'expired') {
    statusEl.textContent = 'Ссылка входа устарела. Попробуйте войти ещё раз.';
  } else if (params.get('error') === 'missing_token') {
    statusEl.textContent = 'Не удалось войти. Попробуйте ещё раз.';
  }

  loginBtn.addEventListener('click', () => {
    statusEl.textContent =
      'Открываем Telegram… Нажмите Start в чате с ботом, затем перейдите по ссылке, которую он пришлёт.';
    window.location.href = `https://t.me/${MOKSHA_CONFIG.telegramBotUsername}?start=auth`;
  });
});
