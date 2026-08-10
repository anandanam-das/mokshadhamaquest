document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('telegramLoginBtn');
  const statusEl = document.getElementById('loginStatus');

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
