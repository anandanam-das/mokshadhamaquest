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
      window.location.href = 'checking.html' + window.location.search;
    } catch (error) {
      statusEl.textContent = 'Не удалось сохранить. Проверьте связь и попробуйте ещё раз.';
      submitBtn.disabled = false;
    }
  });
});
