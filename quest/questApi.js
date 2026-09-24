// Talks to the separate quest-api service (personal cabinet: profile,
// progress sync, certificates). Auth token is minted server-side by
// /api/quest-token (Vercel, reads the existing httpOnly Telegram session
// cookie) and cached in sessionStorage — it's short-lived (24h) and
// scoped only to this service, never the payment backend.
const QUEST_TOKEN_KEY = 'mokshaQuestToken';

async function getQuestToken(forceRefresh) {
  if (!forceRefresh) {
    const cached = sessionStorage.getItem(QUEST_TOKEN_KEY);
    if (cached) {
      try {
        const { token, expiresAt } = JSON.parse(cached);
        if (Date.now() < expiresAt) return token;
      } catch (error) {
        // fall through and mint a fresh one
      }
    }
  }

  const response = await fetch(`${MOKSHA_CONFIG.apiBaseUrl}/api/quest-token`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('quest_token_failed');
  const { token } = await response.json();
  // Slightly under the server's 24h expiry so we never send a token that
  // expires mid-request.
  const expiresAt = Date.now() + 23 * 60 * 60 * 1000;
  sessionStorage.setItem(QUEST_TOKEN_KEY, JSON.stringify({ token, expiresAt }));
  return token;
}

async function questApiFetch(path, options = {}) {
  const token = await getQuestToken();
  const response = await fetch(`${MOKSHA_CONFIG.questApiBaseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  return response;
}

async function fetchQuestProfile() {
  const response = await questApiFetch('/api/profile');
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('fetch_profile_failed');
  return response.json();
}

async function saveQuestProfile(profile) {
  const response = await questApiFetch('/api/profile', {
    method: 'POST',
    body: JSON.stringify(profile),
  });
  if (!response.ok) throw new Error('save_profile_failed');
  return response.json();
}

async function syncQuestProgress(taskProgress, stepProgress) {
  const response = await questApiFetch('/api/progress', {
    method: 'POST',
    body: JSON.stringify({ taskProgress, stepProgress }),
  });
  if (!response.ok) throw new Error('sync_progress_failed');
  return response.json();
}

async function issueQuestCertificate() {
  const response = await questApiFetch('/api/certificate', { method: 'POST' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { ok: false, error: data.error || 'unknown_error' };
  return { ok: true, ...data };
}

async function fetchAdminOverview() {
  const response = await questApiFetch('/api/admin/overview');
  if (!response.ok) throw new Error('fetch_admin_overview_failed');
  return response.json();
}

async function updateAdminUser(telegramId, patch) {
  const response = await questApiFetch(`/api/admin/users/${encodeURIComponent(telegramId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error('update_admin_user_failed');
  return response.json();
}

async function deleteAdminUser(telegramId) {
  const response = await questApiFetch(`/api/admin/users/${encodeURIComponent(telegramId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('delete_admin_user_failed');
  return response.json();
}

function isAdminTelegramId(telegramId) {
  return MOKSHA_CONFIG.adminTelegramIds.map(String).includes(String(telegramId));
}

// Fire-and-forget hook consumed by state.js's completeTask — keeps the
// server copy of progress in sync without making every call site in
// village.js aware of the network layer. Failures are swallowed on
// purpose: local progress (localStorage) stays the source of truth for
// gameplay, the server copy is a mirror for the cabinet/certificate and
// must never block or break the game if the API has a hiccup.
window.syncProgressToQuestApi = function syncProgressToQuestApi(state) {
  syncQuestProgress(state.taskProgress, state.stepProgress).catch((error) => {
    console.warn('quest-api progress sync failed (non-fatal):', error);
  });
};
