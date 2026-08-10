document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const telegramIdFromCallback = params.get('telegramId');
  if (telegramIdFromCallback) {
    setUserState({ telegramId: telegramIdFromCallback });
    window.history.replaceState({}, '', window.location.pathname);
  }

  const state = getUserState();

  if (!state.telegramId) {
    window.location.href = 'login.html';
    return;
  }

  const checkingView = document.getElementById('checkingView');
  const noAccessView = document.getElementById('noAccessView');

  let access;
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

  setUserState({
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
