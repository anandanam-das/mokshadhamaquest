document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('profileForm');
  const statusEl = document.getElementById('profileStatus');
  const submitBtn = document.getElementById('profileSubmitBtn');

  const state = getUserState();
  if (!state.telegramId) {
    window.location.href = 'login.html';
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submitBtn.disabled = true;
    statusEl.textContent = '';

    const firstName = document.getElementById('firstNameInput').value.trim();
    const lastName = document.getElementById('lastNameInput').value.trim();
    const email = document.getElementById('emailInput').value.trim();

    try {
      await saveQuestProfile({ firstName, lastName, email, patronPlanet: state.character?.patronPlanet || null });
      const updated = getUserState();
      if (!updated.character) {
        window.location.href = 'create-character.html';
      } else if (!updated.hasSeenPrologue) {
        window.location.href = 'prologue.html';
      } else {
        window.location.href = 'village.html';
      }
    } catch (error) {
      statusEl.textContent = 'Не удалось сохранить. Проверьте связь и попробуйте ещё раз.';
      submitBtn.disabled = false;
    }
  });
});
