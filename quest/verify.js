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
    const name = [cert.first_name, cert.last_name].filter(Boolean).join(' ') || 'Участник курса';
    const escaped = document.createElement('span');
    escaped.textContent = name;
    const fullName = escaped.innerHTML;
    const dateStr = new Date(cert.completed_at || cert.issued_at).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Tbilisi',
    });

    result.innerHTML = `
      <p class="task-content-done" style="font-size: 1.1rem;">✓ Сертификат подлинный</p>
      <p class="login-gate-hint"><strong>${fullName}</strong> успешно завершил(а) первый блок «Граха-таттва — природа планет» на платформе MOKSHA EDUCATION и получил(а) статус «Граха-таттва-гья».</p>
      <p class="login-gate-hint">Дата завершения: ${dateStr}</p>
    `;
  } catch (error) {
    result.innerHTML = '<p class="login-gate-hint">Не удалось проверить сертификат. Попробуйте позже.</p>';
  }
});
