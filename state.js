const USER_STATE_KEY = 'mokshaUserState';

function getDefaultUserState() {
  return {
    telegramId: null,
    character: null, // { patronPlanet }
    hasSeenPrologue: false,
    hasCompletedOnboarding: false,
    unlockedLocations: [],
  };
}

function getUserState() {
  const raw = localStorage.getItem(USER_STATE_KEY);
  if (!raw) return getDefaultUserState();
  try {
    return { ...getDefaultUserState(), ...JSON.parse(raw) };
  } catch (error) {
    return getDefaultUserState();
  }
}

function setUserState(patch) {
  const next = { ...getUserState(), ...patch };
  localStorage.setItem(USER_STATE_KEY, JSON.stringify(next));
  return next;
}

function clearUserState() {
  localStorage.removeItem(USER_STATE_KEY);
}
