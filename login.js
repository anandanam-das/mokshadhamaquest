document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('telegramLoginBtn');
  const statusEl = document.getElementById('loginStatus');

  loginBtn.addEventListener('click', async () => {
    loginBtn.disabled = true;
    statusEl.textContent = 'Входим через Telegram…';

    const telegramUser = await fakeTelegramLogin();

    setUserState({ telegramId: telegramUser.telegramId });
    window.location.href = 'checking.html';
  });
});
