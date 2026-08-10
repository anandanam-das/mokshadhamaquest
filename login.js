document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('telegramLoginBtn');
  const statusEl = document.getElementById('loginStatus');

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
