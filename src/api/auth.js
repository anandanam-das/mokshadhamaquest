// Real backend calls, replacing the src/api/mockAuth.js stubs.
// See server/README.md for what needs to be configured for this to work.

async function telegramLogin(telegramData) {
  const response = await fetch(`${MOKSHA_CONFIG.apiBaseUrl}/api/auth/telegram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(telegramData),
  });

  if (!response.ok) {
    throw new Error('Telegram login failed');
  }

  const data = await response.json();
  return {
    telegramId: String(data.user.id),
    firstName: data.user.first_name,
    username: data.user.username,
  };
}

async function checkSubscription(telegramId) {
  const response = await fetch(
    `${MOKSHA_CONFIG.apiBaseUrl}/api/access?telegramId=${encodeURIComponent(telegramId)}`,
    { credentials: 'include' }
  );

  if (!response.ok) {
    throw new Error('Access check failed');
  }

  return response.json();
}
