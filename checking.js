document.addEventListener('DOMContentLoaded', async () => {
  const state = getUserState();

  if (!state.telegramId) {
    window.location.href = 'login.html';
    return;
  }

  const checkingView = document.getElementById('checkingView');
  const noAccessView = document.getElementById('noAccessView');

  const access = await fakeCheckSubscription(state.telegramId);

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
