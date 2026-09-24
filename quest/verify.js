document.addEventListener('DOMContentLoaded', async () => {
  const result = document.getElementById('verifyResult');
  const id = new URLSearchParams(window.location.search).get('id');

  if (!id) {
    result.innerHTML = '<p class="login-gate-hint">Не указан идентификатор сертификата.</p>';
    return;
  }

  try {
    const response = await fetch(`${MOKSHA_CONFIG.questApiBaseUrl}/api/certificate/${encodeURIComponent(id)}`);
    if (response.status === 404) {
      result.innerHTML = '<p class="login-gate-hint">Сертификат с таким ID не найден.</p>';
      return;
    }
    if (!response.ok) throw new Error('request_failed');

    const cert = await response.json();
    const fullName = [cert.first_name, cert.last_name].filter(Boolean).join(' ') || 'Участник курса';
    const dateStr = new Date(cert.issued_at).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    result.innerHTML = `
      <p class="task-content-done" style="font-size: 1.1rem;">✓ Сертификат подлинный</p>
      <p class="login-gate-hint"><strong>${fullName}</strong> успешно завершил(а) курс MOKSHA Quest «Обитель богов».</p>
      <p class="login-gate-hint">Дата выдачи: ${dateStr}</p>
    `;
  } catch (error) {
    result.innerHTML = '<p class="login-gate-hint">Не удалось проверить сертификат. Попробуйте позже.</p>';
  }
});
