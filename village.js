document.addEventListener('DOMContentLoaded', () => {
  const state = getUserState();

  if (!state.telegramId) {
    window.location.href = 'login.html';
    return;
  }

  if (!state.character) {
    window.location.href = 'create-character.html';
    return;
  }

  const taskTypeIcons = {
    video: '🎥',
    phrase: '🗣️',
    audio: '🎧',
    quiz: '🧩',
    image: '🖼️',
    match: '🧭',
    lecture_checkbox: '📺',
    matching: '🔗',
    find_error: '🔍',
    matching_transfer: '🔁',
    case_quiz: '📐',
    guided_tour: '🗺️',
  };

  const stage = document.getElementById('villageStage');
  const detailRoot = document.getElementById('villageDetail');
  const taskContentPanel = document.getElementById('taskContentPanel');

  const villageLayout = {
    surya:   { row: 1, col: 1 }, // центр
    chandra: { row: 0, col: 0 }, // северо-запад
    budha:   { row: 0, col: 1 }, // север
    guru:    { row: 0, col: 2 }, // северо-восток
    shani:   { row: 1, col: 0 }, // запад
    ketu:    { row: 1, col: 2 }, // восток
    rahu:    { row: 2, col: 0 }, // юго-запад
    mangala: { row: 2, col: 1 }, // юг
    shukra:  { row: 2, col: 2 }, // юго-восток
  };

  // Порядок разблокировки зданий деревни: Ратуша первая, дальше по цепочке.
  const UNLOCK_ORDER = ['surya', 'chandra', 'budha', 'guru', 'shani', 'ketu', 'rahu', 'mangala', 'shukra'];
  const PLANET_TASK_IDS = ['watch_lecture', 'engine_1', 'engine_2', 'engine_3', 'engine_4', 'engine_5', 'engine_6'];

  const isPlanetFullyDone = (planetId) => {
    const progress = getTaskProgress(planetId);
    return PLANET_TASK_IDS.every((id) => progress[id]);
  };

  // 'pending' — ещё не очередь (серое, статично, некликабельно)
  // 'active_pulse' — следующая цель (серое, пульсирует, кликабельно)
  // 'unlocked' — все 7 заданий пройдены (полный цвет, без пульсации)
  const getBuildingStatus = (characterId) => {
    const index = UNLOCK_ORDER.indexOf(characterId);
    for (let i = 0; i < index; i += 1) {
      if (!isPlanetFullyDone(UNLOCK_ORDER[i])) return 'pending';
    }
    return isPlanetFullyDone(characterId) ? 'unlocked' : 'active_pulse';
  };

  const STAGE_SIZE = 560;
  const GRID_SIZE = 3;
  const CELL = STAGE_SIZE / GRID_SIZE;
  const BUILDING_SIZE = 96;
  const RATUSHA_SIZE = 120;

  stage.style.width = '100%';
  stage.style.maxWidth = `${STAGE_SIZE}px`;
  stage.style.aspectRatio = '1 / 1';
  stage.style.position = 'relative';
  stage.style.margin = '0 auto';

  let selectedBuildingId = null;
  let activeTaskId = null;
  let currentLessonKey = null;
  let currentLessonHeading = null;
  let currentLessonTasks = null;

  // --- Персонаж-покровитель: зафиксирован на экране (не на странице),
  // всегда в углу снизу, можно скрыть и показать снова. Когда появляется
  // реплика — виджет автоматически разворачивается, даже если был скрыт.

  const patronWidget = document.getElementById('patronWidget');
  const patronSpeechBubble = document.getElementById('patronSpeechBubble');
  const patronHideBtn = document.getElementById('patronWidgetHideBtn');
  const patronReopenBtn = document.getElementById('patronWidgetReopenBtn');

  const hidePatronWidget = () => {
    patronWidget.classList.add('patron-widget-hidden');
    patronReopenBtn.hidden = false;
  };

  const showPatronWidget = () => {
    patronWidget.classList.remove('patron-widget-hidden');
    patronReopenBtn.hidden = true;
  };

  const SPEECH_AUTO_HIDE_MS = 6000;
  let speechHideTimer = null;

  const hidePatronSpeech = () => {
    clearTimeout(speechHideTimer);
    patronSpeechBubble.classList.remove('speech-bubble-visible');
    patronSpeechBubble.hidden = true;
  };

  const showPatronSpeech = (message) => {
    showPatronWidget();
    patronSpeechBubble.textContent = message;
    patronSpeechBubble.hidden = false;
    patronSpeechBubble.classList.add('speech-bubble-visible');

    clearTimeout(speechHideTimer);
    speechHideTimer = setTimeout(hidePatronSpeech, SPEECH_AUTO_HIDE_MS);

    const img = document.getElementById('patronWidgetImage');
    img.classList.remove('patron-react');
    // eslint-disable-next-line no-void
    void img.offsetWidth;
    img.classList.add('patron-react');
    img.addEventListener('animationend', () => img.classList.remove('patron-react'), { once: true });
  };

  patronSpeechBubble.addEventListener('click', hidePatronSpeech);

  patronHideBtn.addEventListener('click', () => {
    hidePatronSpeech();
    hidePatronWidget();
  });

  patronReopenBtn.addEventListener('click', showPatronWidget);

  const patronId = state.character.patronPlanet;

  // Строгий контроль повторов: "мешок без повторов" на каждую пару
  // покровитель+категория — тасуем весь пул, выдаём по одной, и только
  // когда мешок опустел, тасуем заново. Реплика не повторится, пока не
  // прозвучат все остальные варианты из пула (минимум 6-10 разных подряд).
  const reactionBags = {};
  const lastPicked = {};

  const shuffle = (array) => {
    const copy = array.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  };

  const pickNoRepeat = (bagKey, pool) => {
    if (!reactionBags[bagKey] || reactionBags[bagKey].length === 0) {
      const bag = shuffle(pool);
      // Не дать новому мешку начаться с той же реплики, что закончила
      // предыдущий — иначе на стыке двух мешков возможен повтор подряд.
      const nextUp = bag.length - 1;
      if (bag.length > 1 && bag[nextUp] === lastPicked[bagKey]) {
        const swapWith = Math.floor(Math.random() * nextUp);
        const tmp = bag[nextUp];
        bag[nextUp] = bag[swapWith];
        bag[swapWith] = tmp;
      }
      reactionBags[bagKey] = bag;
    }
    const picked = reactionBags[bagKey].pop();
    lastPicked[bagKey] = picked;
    return picked;
  };

  // taskComplete/idleTap объединяют базовый пул (patronExtraReactions,
  // 4 варианта) и расширенный (patronReactionsExpanded, 6 вариантов) —
  // итого 10 вариантов на категорию.
  const pickPooledReaction = (category) => {
    const pool = [
      ...patronExtraReactions[patronId][category],
      ...patronReactionsExpanded[patronId][category],
    ];
    return pickNoRepeat(`${patronId}:${category}`, pool);
  };

  const pickExpandedOnly = (category) => {
    return pickNoRepeat(`${patronId}:${category}`, patronReactionsExpanded[patronId][category]);
  };

  const LORE_DROP_CHANCE = 0.2;

  document.getElementById('patronWidgetImage').addEventListener('click', () => {
    if (Math.random() < LORE_DROP_CHANCE) {
      showPatronSpeech(pickExpandedOnly('loreDrop'));
    } else {
      showPatronSpeech(pickPooledReaction('idleTap'));
    }
  });

  const reactToTaskComplete = () => {
    showPatronSpeech(pickPooledReaction('taskComplete'));
  };

  const setupPatronWidget = () => {
    const character = MOKSHA_CHARACTERS.find((item) => item.id === state.character.patronPlanet);
    if (!character) return;
    document.getElementById('patronWidgetImage').src = character.file;
    document.getElementById('patronWidgetImage').alt = character.title;
    document.getElementById('patronReopenImage').src = character.file;
    document.getElementById('patronReopenImage').alt = character.title;
  };

  setupPatronWidget();

  // --- Правая колонка: только список заданий. Содержимое выбранного —
  // отдельное окно внизу, по ширине совпадающее с картой + списком сверху.

  const renderTaskContentPanel = (lessonKey, task) => {
    taskContentPanel.classList.remove('task-content-panel-enter');

    if (!task) {
      taskContentPanel.innerHTML = '<p class="task-content-placeholder">Выбери задание из списка выше, чтобы начать.</p>';
      // eslint-disable-next-line no-void
      void taskContentPanel.offsetWidth;
      taskContentPanel.classList.add('task-content-panel-enter');
      return;
    }

    taskContentPanel.innerHTML = '';

    if (task.status === 'completed') {
      taskContentPanel.innerHTML = `<p class="task-content-done">✓ «${task.title}» выполнено</p>`;
    } else if (task.type === 'lecture_checkbox') {
      taskContentPanel.innerHTML = `
        <p class="task-content-text">Лекция пока доступна в Telegram-канале курса, здесь появится позже.</p>
      `;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-primary';
      btn.textContent = 'Я посмотрел лекцию, готов приступать к практике';
      btn.addEventListener('click', () => {
        completeTask(lessonKey, task.id);
        reactToTaskComplete();
        rerenderCurrentLesson();
      });
      taskContentPanel.appendChild(btn);
    } else {
      taskContentPanel.innerHTML = `<p class="task-content-text">Материал скоро появится здесь.</p>`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-secondary';
      btn.textContent = 'Отметить выполненным';
      btn.addEventListener('click', () => {
        completeTask(lessonKey, task.id);
        reactToTaskComplete();
        rerenderCurrentLesson();
      });
      taskContentPanel.appendChild(btn);
    }

    // eslint-disable-next-line no-void
    void taskContentPanel.offsetWidth;
    taskContentPanel.classList.add('task-content-panel-enter');
  };

  const renderLessonPanel = (lessonKey, heading, rawTasks) => {
    const progress = getTaskProgress(lessonKey);
    const tasks = computeTaskStatuses(rawTasks, progress);

    detailRoot.innerHTML = '';

    const headingEl = document.createElement('h3');
    headingEl.textContent = heading;

    const list = document.createElement('div');
    list.className = 'task-list';

    tasks.forEach((task) => {
      const item = document.createElement('div');
      item.className = `task-item status-${task.status}`;
      if (task.status === 'locked') item.classList.add('locked');
      if (task.status === 'completed') item.classList.add('completed');
      if (task.id === activeTaskId) item.classList.add('active');

      const icon = document.createElement('div');
      icon.className = 'task-icon';
      icon.textContent = task.status === 'completed' ? '✓' : taskTypeIcons[task.type] || '•';

      const meta = document.createElement('div');
      meta.innerHTML = `
        <div class="task-title">${task.title}</div>
        <div class="task-status">${task.status === 'completed' ? 'Выполнено' : task.status === 'unlocked' ? 'Доступно' : 'Закрыто'}</div>
      `;

      item.append(icon, meta);

      if (task.status !== 'locked') {
        item.addEventListener('click', () => {
          activeTaskId = task.id;
          renderLessonPanel(lessonKey, heading, rawTasks);
          renderTaskContentPanel(lessonKey, tasks.find((t) => t.id === activeTaskId));
        });
      }

      list.appendChild(item);
    });

    detailRoot.append(headingEl, list);
  };

  const openLesson = (lessonKey, heading, tasks) => {
    currentLessonKey = lessonKey;
    currentLessonHeading = heading;
    currentLessonTasks = tasks;
    activeTaskId = null;
    renderLessonPanel(lessonKey, heading, tasks);
    renderTaskContentPanel(lessonKey, null);
  };

  const rerenderCurrentLesson = () => {
    if (!currentLessonKey) return;

    // Урок "Введение" целиком завершён гайд-туром — открываем деревню.
    if (currentLessonKey === 'intro' && activeTaskId === 'village_intro') {
      const progress = getTaskProgress('intro');
      if (progress.village_intro) {
        setUserState({ introCompleted: true });
        buildVillageStage();
        currentLessonKey = null;
        detailRoot.innerHTML = '<div class="course-empty">Выбери здание на карте, чтобы увидеть задания.</div>';
        renderTaskContentPanel(null, null);
        return;
      }
    }

    renderLessonPanel(currentLessonKey, currentLessonHeading, currentLessonTasks);
    const progress = getTaskProgress(currentLessonKey);
    const tasks = computeTaskStatuses(currentLessonTasks, progress);
    renderTaskContentPanel(currentLessonKey, tasks.find((t) => t.id === activeTaskId) || null);
    buildVillageStage();
  };

  // --- Карта деревни.

  const placeBuilding = (character, x, y, size) => {
    const status = getBuildingStatus(character.id);
    const building = planetBuildings[character.id];

    const el = document.createElement('button');
    el.type = 'button';
    el.dataset.buildingId = character.id;
    el.dataset.buildingName = building.name;
    el.className = `village-building status-${status}`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.left = `${x - size / 2}px`;
    el.style.top = `${y - size / 2}px`;
    el.innerHTML = `
      <img src="${character.file}" alt="${building.name}" class="village-building-image" />
      <span class="village-building-label">${building.name}</span>
      ${status === 'pending' ? '<span class="village-building-lock">🔒</span>' : ''}
    `;

    if (status !== 'pending') {
      el.addEventListener('click', () => {
        selectedBuildingId = character.id;
        stage.querySelectorAll('.village-building').forEach((node) => {
          node.classList.toggle('selected', node.dataset.buildingId === selectedBuildingId);
        });
        showPatronSpeech(getReaction(patronId, character.id));
        openLesson(character.id, getLocationHeading(character.subtitle), getEngineTasksForPlanet(character.title));
      });
    }

    stage.appendChild(el);
  };

  const buildVillageStage = () => {
    stage.innerHTML = '';
    stage.classList.remove('village-stage-empty');

    if (!getUserState().introCompleted) {
      stage.classList.add('village-stage-empty');
      stage.innerHTML = '<p class="village-stage-empty-text">Обитель появится здесь после «Введения»</p>';
      return;
    }

    MOKSHA_CHARACTERS.forEach((character) => {
      const pos = villageLayout[character.id];
      const x = (pos.col + 0.5) * CELL;
      const y = (pos.row + 0.5) * CELL;
      const size = character.id === 'surya' ? RATUSHA_SIZE : BUILDING_SIZE;
      placeBuilding(character, x, y, size);
    });
  };

  buildVillageStage();

  if (!state.introCompleted) {
    openLesson('intro', getLocationHeading('Введение'), INTRO_TASKS);
  } else {
    detailRoot.innerHTML = '<div class="course-empty">Выбери здание на карте, чтобы увидеть задания.</div>';
    renderTaskContentPanel(null, null);
    // Деревня уже открыта — это не первый заход, а возвращение.
    // welcomeBack есть только в расширенном пуле, базового аналога нет.
    showPatronSpeech(pickExpandedOnly('welcomeBack'));
  }
});
