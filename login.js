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

  loginBtn.addEventListener('click', () => {
    if (typeof Telegram === 'undefined' || !Telegram.Login) {
      statusEl.textContent = 'Не удалось загрузить Telegram. Обновите страницу.';
      return;
    }

    loginBtn.disabled = true;
    statusEl.textContent = 'Входим через Telegram…';

    Telegram.Login.auth(
      { bot_id: MOKSHA_CONFIG.telegramBotId, request_access: 'write' },
      async (telegramData) => {
        if (!telegramData) {
          loginBtn.disabled = false;
          statusEl.textContent = 'Вход отменён.';
          return;
        }

        try {
          const telegramUser = await telegramLogin(telegramData);
          setUserState({ telegramId: telegramUser.telegramId });
          window.location.href = 'checking.html';
        } catch (error) {
          loginBtn.disabled = false;
          statusEl.textContent = 'Не удалось войти. Попробуйте ещё раз.';
        }
      }
    );
  });
});
