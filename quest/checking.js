document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const telegramIdFromCallback = params.get('telegramId');
  if (telegramIdFromCallback) {
    setUserState({ telegramId: telegramIdFromCallback });
    window.history.replaceState({}, '', window.location.pathname);
  }

  const state = getUserState();

  const checkingView = document.getElementById('checkingView');
  const noAccessView = document.getElementById('noAccessView');

  const recheckBtn = document.getElementById('recheckBtn');
  if (recheckBtn) {
    recheckBtn.addEventListener('click', () => {
      window.location.href = `https://t.me/${MOKSHA_CONFIG.telegramBotUsername}?start=auth`;
    });
  }

  // Локальная разработка: бэкенд может быть не запущен (нужны реальные
  // Telegram credentials, см. server/README.md) — на localhost (и при
  // открытии dev-сервера с телефона по локальной сети, см. isLocalDevHost
  // в state.js) доступ считается всегда выданным, без обращения к
  // серверу. На проде этот блок не выполняется, реальная проверка не
  // меняется.
  let access;
  if (isLocalDevHost()) {
    access = {
      telegramId: state.telegramId || 'local-dev',
      hasPlanetsAccess: true,
      hasSignsAccess: true,
      hasNakshatrasAccess: true,
    };
  } else {
    try {
      access = await checkSubscription(state.telegramId);
    } catch (error) {
      if (error.status === 401) {
        clearUserState();
        window.location.href = 'login.html';
        return;
      }
      checkingView.querySelector('.checking-text').textContent =
        'Не удалось проверить доступ. Обновите страницу или попробуйте позже.';
      return;
    }
  }

  setUserState({
    telegramId: access.telegramId ? String(access.telegramId) : state.telegramId,
    hasPlanetsAccess: access.hasPlanetsAccess,
    hasSignsAccess: access.hasSignsAccess,
    hasNakshatrasAccess: access.hasNakshatrasAccess,
  });

  if (!access.hasPlanetsAccess) {
    checkingView.hidden = true;
    noAccessView.hidden = false;
    return;
  }

  const updated = getUserState();
  if (!updated.character) {
    window.location.href = 'create-character.html';
  } else if (!updated.hasSeenPrologue) {
    window.location.href = 'prologue.html';
  } else {
    window.location.href = 'village.html';
  }
});
