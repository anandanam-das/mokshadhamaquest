document.addEventListener('DOMContentLoaded', async () => {
  const result = document.getElementById('verifyResult');
  const token = new URLSearchParams(window.location.search).get('token');

  if (!token) {
    result.innerHTML = '<p class="login-gate-hint">Ссылка неполная — не найден токен подтверждения.</p>';
    return;
  }

  try {
    const response = await fetch(`${MOKSHA_CONFIG.questApiBaseUrl}/api/email/verify?token=${encodeURIComponent(token)}`);

    if (response.status === 410) {
      result.innerHTML =
        '<p class="login-gate-hint">Ссылка устарела (действует 24 часа). Запроси подтверждение ещё раз в личном кабинете.</p>';
      return;
    }
    if (!response.ok) {
      result.innerHTML = '<p class="login-gate-hint">Ссылка недействительна. Запроси подтверждение ещё раз в личном кабинете.</p>';
      return;
    }

    result.innerHTML = `
      <p class="task-content-done" style="font-size: 1.1rem;">✓ Почта подтверждена</p>
      <p class="login-gate-hint">Теперь в личном кабинете можно получать диплом на эту почту.</p>
      <a class="btn btn-primary" href="profile.html">В личный кабинет</a>
    `;
  } catch (error) {
    result.innerHTML = '<p class="login-gate-hint">Не удалось подтвердить почту. Попробуйте позже.</p>';
  }
});
