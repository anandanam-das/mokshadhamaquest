// Real backend calls, replacing the src/api/mockAuth.js stubs.

async function checkSubscription(telegramId) {
  const query = telegramId ? `?telegramId=${encodeURIComponent(telegramId)}` : '';
  const response = await fetch(`${MOKSHA_CONFIG.apiBaseUrl}/api/access${query}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = new Error('Access check failed');
    error.status = response.status;
    throw error;
  }

  return response.json();
}
