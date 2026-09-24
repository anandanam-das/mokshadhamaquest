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

  // Profile registration (email/имя/фамилия) gates the rest of the flow,
  // same as the Telegram access check above — but it must never be a hard
  // blocker: quest-api is separate infrastructure from the payment/access
  // backend, and an outage there must not lock real users out of a course
  // they already have access to. Admin ids skip it outright. Local dev
  // skips it too — there's no Vercel function running locally to mint a
  // quest-api token against.
  if (!isLocalDevHost() && !isAdminTelegramId(updated.telegramId)) {
    try {
      const profile = await fetchQuestProfile();
      if (!profile) {
        window.location.href = 'profile-setup.html';
        return;
      }
    } catch (error) {
      console.warn('quest-api profile check failed (non-fatal, continuing):', error);
    }
  }

  // Admins skip the whole player onboarding (character, prologue, village)
  // entirely — they have no game progress of their own, they go straight
  // to the participants dashboard.
  if (isAdminTelegramId(updated.telegramId)) {
    window.location.href = 'admin.html';
    return;
  }

  if (!updated.character) {
    window.location.href = 'create-character.html';
  } else if (!updated.hasSeenPrologue) {
    window.location.href = 'prologue.html';
  } else {
    window.location.href = 'village.html';
  }
});
