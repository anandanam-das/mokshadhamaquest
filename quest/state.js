const USER_STATE_KEY = 'mokshaUserState';

// Локальная разработка: localhost/127.0.0.1 — обычный случай (сервер и
// браузер на одной машине), плюс приватные IP-диапазоны (192.168.x.x,
// 10.x.x.x, 172.16-31.x.x) — открыть тот же dev-сервер с телефона по
// локальной Wi-Fi сети (см. `ipconfig`/`ifconfig`, обычно 192.168.x.x).
// На проде hostname всегда реальный домен, ни под один из этих паттернов
// не попадает.
function isLocalDevHost() {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return true;
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)\d+\.\d+$/.test(host);
}

function getDefaultUserState() {
  return {
    telegramId: null,
    character: null, // { patronPlanet }
    hasSeenPrologue: false,
    hasCompletedOnboarding: false,
    introCompleted: false,
    taskProgress: {}, // { [lessonKey]: { [taskId]: true } }
    stepProgress: {}, // { [lessonKey]: { [taskId]: { order: [clipId, ...], index: N } } }
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
  const next = setUserState({ taskProgress: { ...state.taskProgress, [lessonKey]: lessonProgress } });
  // Defined in questApi.js when it's loaded on the page; absent (e.g. on
  // pages that don't need the cabinet) it's simply a no-op.
  if (typeof window.syncProgressToQuestApi === 'function') window.syncProgressToQuestApi(next);
  return next;
}

// Промежуточный прогресс внутри многошаговых заданий (N из M клипов/карточек/
// вопросов подряд) — отдельно от completeTask, который отмечает только сам
// факт полного завершения задания. Без этого обновление страницы посреди
// задания откатывало к первому шагу, даже если предыдущие шаги уже пройдены.
function getTaskStepState(lessonKey, taskId) {
  const state = getUserState();
  return (state.stepProgress[lessonKey] && state.stepProgress[lessonKey][taskId]) || null;
}

function setTaskStepState(lessonKey, taskId, stepState) {
  const state = getUserState();
  const lessonSteps = { ...(state.stepProgress[lessonKey] || {}), [taskId]: stepState };
  return setUserState({ stepProgress: { ...state.stepProgress, [lessonKey]: lessonSteps } });
}

function clearTaskStepState(lessonKey, taskId) {
  const state = getUserState();
  if (!state.stepProgress[lessonKey] || !(taskId in state.stepProgress[lessonKey])) return state;
  const lessonSteps = { ...state.stepProgress[lessonKey] };
  delete lessonSteps[taskId];
  return setUserState({ stepProgress: { ...state.stepProgress, [lessonKey]: lessonSteps } });
}
