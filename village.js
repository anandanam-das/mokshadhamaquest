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

  const lessonTypeIcons = {
    video: '🎥',
    audio: '🎧',
    phrase: '🗣️',
    quiz: '🧩',
    image: '🖼️',
    map: '🗺️',
    match: '🧭',
  };

  const genitiveCase = {
    Сурья: 'Сурьи',
    Чандра: 'Чандры',
    Мангала: 'Мангалы',
    Буддха: 'Буддхи',
    Гуру: 'Гуру',
    Шукра: 'Шукры',
    Шани: 'Шани',
    Раху: 'Раху',
    Кету: 'Кету',
  };

  const getTasksForBuilding = (title) => {
    const genitive = genitiveCase[title] || title;
    return [
      { type: 'video', title: `Три лица ${genitive}` },
      { type: 'phrase', title: 'Фраза-гуна' },
      { type: 'audio', title: 'Письмо трёх голосов' },
      { type: 'quiz', title: 'Найди ошибку' },
      { type: 'image', title: 'Кто есть кто' },
      { type: 'match', title: 'Карта планеты' },
    ].map((task, index) => ({ ...task, status: index === 0 ? 'Active' : 'Locked' }));
  };

  const introTasks = [
    { type: 'video', title: 'Знакомство с деревней', status: 'Active' },
    { type: 'phrase', title: 'Приветствие Васту Пуруше', status: 'Locked' },
    { type: 'quiz', title: 'Пройти тест по структуре', status: 'Locked' },
  ];

  const stage = document.getElementById('villageStage');
  const detailRoot = document.getElementById('villageDetail');

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

  let selectedId = null;

  const renderDetail = (title, tasks) => {
    detailRoot.innerHTML = '';

    const heading = document.createElement('h3');
    heading.textContent = title;

    const tasksRoot = document.createElement('div');
    tasksRoot.className = 'task-list';

    tasks.forEach((task, idx) => {
      const item = document.createElement('div');
      item.className = 'task-item';
      if (task.status === 'Completed') item.classList.add('completed');
      if (task.status === 'Locked') item.classList.add('locked');

      const icon = document.createElement('div');
      icon.className = 'task-icon';
      icon.textContent = task.status === 'Completed' ? '✓' : lessonTypeIcons[task.type] || idx + 1;

      const meta = document.createElement('div');
      meta.innerHTML = `
        <div class="task-title">${task.title}</div>
        <div class="task-status">${task.status === 'Completed' ? 'Выполнено' : task.status === 'Active' ? 'В процессе' : 'Закрыто'}</div>
      `;

      item.append(icon, meta);
      tasksRoot.appendChild(item);
    });

    detailRoot.append(heading, tasksRoot);
  };

  const updateSelection = () => {
    stage.querySelectorAll('.village-building').forEach((el) => {
      el.classList.toggle('selected', el.dataset.buildingId === selectedId);
    });
  };

  // Ровно 9 зданий — по одному на каждую планету. Здание и планета — одна
  // и та же сущность, поэтому здесь нет отдельного 10-го узла для Ратуши:
  // Ратуша — это здание Сурьи (planetBuildings.surya), в центре мандалы,
  // с тем же кликом и теми же заданиями, что и у любого другого здания.
  const placeBuilding = (character, x, y, size) => {
    const isUnlocked = state.unlockedLocations.includes(character.id);
    const building = planetBuildings[character.id];

    const el = document.createElement('button');
    el.type = 'button';
    el.dataset.buildingId = character.id;
    el.dataset.buildingName = building.name;
    el.className = `village-building${isUnlocked ? ' unlocked' : ' locked'}`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.left = `${x - size / 2}px`;
    el.style.top = `${y - size / 2}px`;
    el.innerHTML = `
      <img src="${character.file}" alt="${building.name}" class="village-building-image" />
      <span class="village-building-label">${building.name}</span>
      ${isUnlocked ? '' : '<span class="village-building-lock">🔒</span>'}
    `;

    if (isUnlocked) {
      el.addEventListener('click', () => {
        selectedId = character.id;
        updateSelection();
        renderDetail(getLocationHeading(character.subtitle), getTasksForBuilding(character.title));
      });
    }

    stage.appendChild(el);
  };

  const buildMandala = () => {
    MOKSHA_CHARACTERS.forEach((character) => {
      const pos = villageLayout[character.id];
      const x = (pos.col + 0.5) * CELL;
      const y = (pos.row + 0.5) * CELL;
      const size = character.id === 'surya' ? RATUSHA_SIZE : BUILDING_SIZE;
      placeBuilding(character, x, y, size);
    });
  };

  buildMandala();
  // "Введение" не привязано ни к одному зданию — это стартовая точка,
  // видна по умолчанию, без собственного узла на карте.
  renderDetail(getLocationHeading('Введение'), introTasks);

  runOnboarding();
});

function runOnboarding() {
  if (getUserState().hasCompletedOnboarding) return;

  const overlay = document.getElementById('onboardingOverlay');
  const tooltip = document.getElementById('onboardingTooltip');
  const textEl = document.getElementById('onboardingText');
  const nextBtn = document.getElementById('onboardingNextBtn');

  const unlockedEl = document.querySelector('.village-building.unlocked');
  const lockedEl = document.querySelector('.village-building.locked');

  const steps = [
    unlockedEl && {
      target: unlockedEl,
      text: `Это ${unlockedEl.dataset.buildingName} — нажми на него, чтобы увидеть задания.`,
    },
    lockedEl && {
      target: lockedEl,
      text: 'Серые здания ещё не открыты — пройди уроки, чтобы построить их.',
    },
    {
      target: null,
      text: 'Проходи уроки, чтобы открыть все 9 зданий и достроить деревню знания.',
    },
  ].filter(Boolean);

  let index = 0;
  let highlighted = null;

  const clearHighlight = () => {
    if (highlighted) {
      highlighted.classList.remove('onboarding-highlight');
      highlighted = null;
    }
  };

  const placeTooltip = (target) => {
    if (!target) {
      tooltip.style.top = '50%';
      tooltip.style.left = '50%';
      tooltip.style.transform = 'translate(-50%, -50%)';
      return;
    }

    tooltip.style.transform = 'none';
    const rect = target.getBoundingClientRect();
    const top = Math.min(window.innerHeight - 160, rect.bottom + 16);
    const left = Math.min(Math.max(16, rect.left + rect.width / 2 - 140), window.innerWidth - 296);
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
  };

  const render = () => {
    clearHighlight();
    const step = steps[index];

    if (step.target) {
      step.target.classList.add('onboarding-highlight');
      highlighted = step.target;
    }

    textEl.textContent = step.text;
    nextBtn.textContent = index === steps.length - 1 ? 'Понятно' : 'Далее';
    placeTooltip(step.target);
  };

  const finish = () => {
    clearHighlight();
    overlay.hidden = true;
    setUserState({ hasCompletedOnboarding: true });
  };

  nextBtn.addEventListener('click', () => {
    if (index < steps.length - 1) {
      index += 1;
      render();
    } else {
      finish();
    }
  });

  overlay.hidden = false;
  render();
}
