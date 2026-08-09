const USER_STATE_KEY = 'mokshaUserState';

function getDefaultUserState() {
  return {
    telegramId: null,
    character: null, // { patronPlanet }
    hasSeenPrologue: false,
    hasCompletedOnboarding: false,
    introCompleted: false,
    taskProgress: {}, // { [lessonKey]: { [taskId]: true } }
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

function getTaskProgress(lessonKey) {
  return getUserState().taskProgress[lessonKey] || {};
}

function completeTask(lessonKey, taskId) {
  const state = getUserState();
  const lessonProgress = { ...(state.taskProgress[lessonKey] || {}), [taskId]: true };
  return setUserState({ taskProgress: { ...state.taskProgress, [lessonKey]: lessonProgress } });
}
