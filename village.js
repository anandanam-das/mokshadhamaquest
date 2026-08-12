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
    drag_to_container: '🍲',
    layered_map: '🎯',
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

  // --- Задание 1 "Собери пять слоёв": тап-сопоставление термина (слева)
  // с образом (справа). Обе колонки перемешиваются заново при каждом
  // заходе на задание. Неверная пара — секундная красная вспышка и
  // возврат в несоединённое состояние, повторная попытка не блокируется.

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderMatchingTask = (lessonKey, task) => {
    const pairs = task1Pairs;
    const byId = {};
    pairs.forEach((pair) => { byId[pair.id] = pair; });
    const ids = pairs.map((pair) => pair.id);

    // Тасуем обе колонки независимо, но гарантируем, что ни одна пара не
    // осталась на совпадающей позиции — иначе при случайном перемешивании
    // правильный ответ иногда оказывается прямо напротив термина.
    const termOrder = shuffle(ids);
    let imageOrder = shuffle(ids);
    let guard = 0;
    while (imageOrder.some((id, i) => id === termOrder[i]) && guard < 50) {
      imageOrder = shuffle(ids);
      guard += 1;
    }

    const matched = new Set();
    let selected = null; // { id, el, side: 'term' | 'image' } — клик может начаться с любой стороны

    const wrap = document.createElement('div');
    wrap.className = 'matching-task';

    const stageEl = document.createElement('div');
    stageEl.className = 'matching-stage';

    // Река посередине поля: полоса воды в центре плюс песок и трава по
    // обе стороны от неё, каждый материал — свой бесшовный тайл, никакого
    // "сшивания" разных текстур внутри одной картинки.
    const riverEl = document.createElement('div');
    riverEl.className = 'matching-waterway';
    ['grass', 'transition', 'sand', 'water', 'sand', 'transition', 'grass'].forEach((kind, i) => {
      const strip = document.createElement('div');
      strip.className = `matching-strip matching-strip-${kind}`;
      // Вторая (правая) полоса перехода — зеркалим, тайл нарисован с
      // травой слева и песком справа, а справа от реки нужно наоборот.
      if (kind === 'transition' && i > 3) strip.classList.add('matching-strip-transition-flip');
      riverEl.appendChild(strip);
    });

    const bridgesLayer = document.createElement('div');
    bridgesLayer.className = 'matching-bridges';

    const termCol = document.createElement('div');
    termCol.className = 'matching-column matching-column-term';
    const imageCol = document.createElement('div');
    imageCol.className = 'matching-column matching-column-image';

    const clearWrongFlash = (a, b) => {
      a.classList.remove('matching-item-wrong');
      b.classList.remove('matching-item-wrong');
    };

    const popCorrect = (el) => {
      if (prefersReducedMotion) return;
      el.classList.add('matching-item-correct-pop');
      el.addEventListener('animationend', () => el.classList.remove('matching-item-correct-pop'), { once: true });
    };

    // Мостик через реку между угаданной парой — тянется от термина к
    // образу под тем углом, под которым они реально стоят друг напротив
    // друга (шафл почти никогда не даёт им оказаться на одной высоте).
    const buildBridge = (termEl, imageEl) => {
      const stageRect = stageEl.getBoundingClientRect();
      const a = termEl.getBoundingClientRect();
      const b = imageEl.getBoundingClientRect();
      const x1 = a.right - stageRect.left;
      const y1 = a.top + a.height / 2 - stageRect.top;
      const x2 = b.left - stageRect.left;
      const y2 = b.top + b.height / 2 - stageRect.top;
      const length = Math.hypot(x2 - x1, y2 - y1);
      const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);

      const BRIDGE_HEIGHT = 22;
      const bridge = document.createElement('div');
      bridge.className = 'matching-bridge';
      bridge.style.left = `${x1}px`;
      bridge.style.top = `${y1 - BRIDGE_HEIGHT / 2}px`;
      bridge.style.width = `${length}px`;
      bridge.style.setProperty('--bridge-angle', `${angle}deg`);
      bridgesLayer.appendChild(bridge);

      if (prefersReducedMotion) {
        bridge.classList.add('matching-bridge-build', 'matching-bridge-no-transition');
        return;
      }

      // eslint-disable-next-line no-void
      void bridge.offsetWidth;
      bridge.classList.add('matching-bridge-build');
    };

    // Финальная вспышка на всё поле, когда собраны все пять пар — свет
    // пробегает по реке, путь открыт.
    const playMagicCompletionEffect = (onDone) => {
      if (prefersReducedMotion) {
        onDone();
        return;
      }

      const overlay = document.createElement('div');
      overlay.className = 'matching-magic-overlay';

      const glow = document.createElement('div');
      glow.className = 'matching-magic-glow';
      overlay.appendChild(glow);

      const sparkCount = 14;
      for (let i = 0; i < sparkCount; i += 1) {
        const spark = document.createElement('span');
        spark.className = 'matching-magic-spark';
        spark.style.setProperty('--angle', `${(360 / sparkCount) * i}deg`);
        spark.style.animationDelay = `${i * 0.02}s`;
        overlay.appendChild(spark);
      }

      stageEl.appendChild(overlay);
      setTimeout(onDone, 750);
    };

    // Клик может начаться с любой стороны — термина или образа. Первый
    // клик просто выделяет карточку; второй клик по ПРОТИВОПОЛОЖНОЙ
    // стороне пытается собрать пару. Повторный клик по той же стороне
    // просто переключает выделение на новую карточку.
    const trySelect = (side, id, el) => {
      if (!selected) {
        selected = { id, el, side };
        el.classList.add('matching-item-selected');
        return;
      }

      if (selected.side === side) {
        selected.el.classList.remove('matching-item-selected');
        selected = { id, el, side };
        el.classList.add('matching-item-selected');
        return;
      }

      const termSel = side === 'term' ? { id, el } : selected;
      const imageSel = side === 'image' ? { id, el } : selected;
      selected.el.classList.remove('matching-item-selected');
      selected = null;

      if (termSel.id === imageSel.id) {
        matched.add(termSel.id);
        termSel.el.classList.add('matching-item-correct');
        imageSel.el.classList.add('matching-item-correct');
        popCorrect(termSel.el);
        popCorrect(imageSel.el);
        buildBridge(termSel.el, imageSel.el);

        if (matched.size === pairs.length) {
          completeTask(lessonKey, task.id);
          reactToTaskComplete();
          playMagicCompletionEffect(rerenderCurrentLesson);
        }
      } else {
        termSel.el.classList.add('matching-item-wrong');
        imageSel.el.classList.add('matching-item-wrong');
        setTimeout(() => clearWrongFlash(termSel.el, imageSel.el), 600);
      }
    };

    termOrder.forEach((id) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'matching-item matching-item-term';
      el.textContent = byId[id].term;
      el.addEventListener('click', () => {
        if (matched.has(id)) return;
        trySelect('term', id, el);
      });
      termCol.appendChild(el);
    });

    imageOrder.forEach((id) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'matching-item matching-item-image';
      el.textContent = byId[id].image;
      el.addEventListener('click', () => {
        if (matched.has(id)) return;
        trySelect('image', id, el);
      });
      imageCol.appendChild(el);
    });

    stageEl.append(termCol, riverEl, imageCol, bridgesLayer);

    const gameEl = document.createElement('div');
    gameEl.className = 'matching-game';
    gameEl.appendChild(stageEl);

    const sidebar = document.createElement('div');
    sidebar.className = 'matching-sidebar';
    sidebar.innerHTML = `
      ${TASK1_INTRO_TEXT.split('\n\n').map((p) => `<p class="matching-sidebar-text">${p}</p>`).join('')}
      <p class="matching-sidebar-instruction">${TASK1_INSTRUCTION_TEXT}</p>
    `;

    wrap.append(gameEl, sidebar);
    taskContentPanel.appendChild(wrap);
  };

  // --- "Цветок трёх истин" (task_2): на каждом из 3 цветков 4 лепестка,
  // один лжёт (isError: true). Верный тап — лепесток срывается и улетает,
  // оставшиеся три расцветают; неверный — лепесток просто трясётся,
  // повторный тап не заблокирован. После срыва — пауза на анимацию, потом
  // либо следующий цветок, либо (после третьего) финальная сцена.
  const FLOWER_BLOOM_DELAY_MS = 1500;

  const renderFlowerTask = (lessonKey, task, data) => {
    let flowerIndex = 0;

    const wrap = document.createElement('div');
    wrap.className = 'flower-task';

    const introEl = document.createElement('p');
    introEl.className = 'quiz-intro';
    // Текст задан в taskContent.js, не пользователем — безопасно вставлять
    // как HTML, просто выделяем "Но берегись" жирным.
    introEl.innerHTML = (data.intro || '').replace('Но берегись', '<strong>Но берегись</strong>');

    const instructionEl = document.createElement('p');
    instructionEl.className = 'flower-instruction';
    instructionEl.textContent = TASK2_INSTRUCTION_TEXT;

    const progressEl = document.createElement('p');
    progressEl.className = 'quiz-progress';

    const flowerStage = document.createElement('div');
    flowerStage.className = 'flower-stage';

    const flowerContainer = document.createElement('div');
    flowerContainer.className = 'flower-container';

    // Круг-центр — постоянный, не пересоздаётся на каждый цветок (только
    // сами лепестки меняются между loadFlower()).
    const center = document.createElement('div');
    center.className = 'flower-center';
    flowerContainer.appendChild(center);

    flowerStage.appendChild(flowerContainer);

    const feedbackEl = document.createElement('div');
    feedbackEl.className = 'flower-feedback';
    feedbackEl.hidden = true;

    // Шесть позиций по кругу, через 60°: N, ЮВ-ССВ и т.д. — метки условные,
    // важен только равный шаг между ними в CSS.
    const PETAL_SLOTS = ['n', 'ne', 'se', 's', 'sw', 'nw'];
    const ERRORS_NEEDED = 2;
    // Берём из данных (task2Data.maxWrongPlucks), а не хардкодим — на
    // случай, если для другого набора вопросов лимит окажется другим.
    const MAX_WRONG_PLUCKS = data.maxWrongPlucks || 2;
    const FLOWER_WILT_DELAY_MS = 1200;

    const showFlowerFeedback = (text, isWarning) => {
      feedbackEl.hidden = false;
      feedbackEl.textContent = text;
      feedbackEl.classList.toggle('flower-feedback-warning', !!isWarning);
    };

    const loadFlower = () => {
      const flower = data.flowers[flowerIndex];
      let wrongPlucks = 0;

      progressEl.textContent =
        data.flowers.length > 1 ? `Цветок ${flowerIndex + 1} из ${data.flowers.length}` : '';
      feedbackEl.hidden = true;
      feedbackEl.classList.remove('flower-feedback-warning');
      feedbackEl.textContent = '';

      // Пересобирает сами лепестки (перетасовывая заново) — вызывается и
      // при первом заходе на цветок, и при реролле после второй ошибки.
      const renderPetals = () => {
        flowerContainer.querySelectorAll('.flower-petal-orbit').forEach((el) => el.remove());
        const options = shuffle(flower.options);
        const plucked = new Set();
        let settled = false;
        const petalEls = {};

        options.forEach((opt, i) => {
          // orbit — невидимый поворотный слой, закреплён точно в центре
          // цветка и просто крутится на свой угол. petal — сам видимый
          // лепесток, сдвинут от центра на фиксированный отступ (радиус
          // круга) в локальных, ещё не повёрнутых координатах orbit'а —
          // поэтому после поворота лепесток всегда начинается ровно от
          // края круга, а не перекрывает его.
          const orbit = document.createElement('div');
          orbit.className = `flower-petal-orbit flower-petal-orbit-${PETAL_SLOTS[i]}`;

          const petal = document.createElement('button');
          petal.type = 'button';
          petal.className = 'flower-petal';
          // Обёртка в два слоя: внешний (.flower-petal-text) — просто
          // flex-центрирование внутри лепестка; внутренний (-inner) несёт
          // сам текст и его поворот. North/south дают -inner ещё и фикс.
          // ширину — иначе перенос строк считался бы по ширине лепестка
          // (220px, широкий), а не по видимой узкой стороне.
          const textEl = document.createElement('span');
          textEl.className = 'flower-petal-text';
          const textInner = document.createElement('span');
          textInner.className = 'flower-petal-text-inner';
          textInner.textContent = opt.text;
          textEl.appendChild(textInner);
          petal.appendChild(textEl);
          orbit.appendChild(petal);
          petalEls[opt.id] = petal;

          petal.addEventListener('click', () => {
            if (settled || plucked.has(opt.id)) return;

            if (opt.isError) {
              // Найденная ложь увядает сразу же, не дожидаясь второй —
              // ощущение прогресса на полпути.
              plucked.add(opt.id);
              if (prefersReducedMotion) {
                orbit.style.display = 'none';
              } else {
                petal.classList.add('flower-petal-plucked');
              }

              if (plucked.size < ERRORS_NEEDED) return;

              // Обе лжи найдены — расцветают все оставшиеся, ядро вспыхивает.
              settled = true;
              if (!prefersReducedMotion) {
                options.forEach((other) => {
                  if (!plucked.has(other.id)) petalEls[other.id].classList.add('flower-petal-bloomed');
                });
                center.classList.remove('flower-center-pulse');
                // eslint-disable-next-line no-void
                void center.offsetWidth;
                center.classList.add('flower-center-pulse');
              }

              showFlowerFeedback(flower.feedback, false);

              const isLast = flowerIndex === data.flowers.length - 1;
              setTimeout(() => {
                if (isLast) {
                  completeTask(lessonKey, task.id);
                  reactToTaskComplete();
                  rerenderCurrentLesson();
                } else {
                  flowerIndex += 1;
                  loadFlower();
                }
              }, FLOWER_BLOOM_DELAY_MS);
            } else {
              // Сорван верный (не ложный) лепесток — штраф. Первый раз —
              // только предупреждение, второй — цветок увядает целиком и
              // пересобирается заново (реролл).
              wrongPlucks += 1;

              if (wrongPlucks >= MAX_WRONG_PLUCKS) {
                settled = true;
                showFlowerFeedback(TASK2_REROLL_TEXT, true);
                if (prefersReducedMotion) {
                  setTimeout(() => {
                    wrongPlucks = 0;
                    renderPetals();
                  }, 50);
                } else {
                  flowerContainer.querySelectorAll('.flower-petal').forEach((el) => {
                    el.classList.add('flower-petal-wilt');
                  });
                  setTimeout(() => {
                    wrongPlucks = 0;
                    renderPetals();
                  }, FLOWER_WILT_DELAY_MS);
                }
              } else {
                showFlowerFeedback(TASK2_WARNING_TEXT, true);
                if (prefersReducedMotion) {
                  orbit.style.display = 'none';
                } else {
                  petal.classList.add('flower-petal-wrong-plucked');
                }
              }
            }
          });
          flowerContainer.appendChild(orbit);
        });
      };

      renderPetals();
    };

    loadFlower();

    // Цветок слева: номер цветка — прямо над ним, по центру.
    const gameEl = document.createElement('div');
    gameEl.className = 'flower-game';
    gameEl.append(progressEl, flowerStage);

    // Описание задания справа.
    const sidebar = document.createElement('div');
    sidebar.className = 'flower-sidebar';
    sidebar.append(introEl, instructionEl, feedbackEl);

    wrap.append(gameEl, sidebar);
    taskContentPanel.appendChild(wrap);
  };

  // --- "Гений кулинарии" (task_3): лоток с карточками-образами сверху,
  // подписанные ёмкости снизу. Перетащи (или тапни карточку, затем
  // ёмкость — для устройств без drag) образ в верную ёмкость. Поддержаны
  // и настоящий HTML5 drag-and-drop, и тап-фолбэк одним и тем же кодом.
  const renderDragTask = (lessonKey, task, data) => {
    const pairs = data.pairs;
    const byId = {};
    pairs.forEach((pair) => { byId[pair.id] = pair; });
    const ids = pairs.map((pair) => pair.id);

    const imageOrder = shuffle(ids);
    let termOrder = shuffle(ids);
    let guard = 0;
    while (imageOrder.some((id, i) => id === termOrder[i]) && guard < 50) {
      termOrder = shuffle(ids);
      guard += 1;
    }

    const filled = new Set();
    let selectedId = null;
    const cardEls = {};
    const containerEls = {};
    const vesselEls = {};
    const vesselIconEls = {};
    const vesselImgEls = {};
    const containerFillEls = {};

    const wrap = document.createElement('div');
    wrap.className = 'cook-task';

    const introEls = TASK3_INTRO_TEXT.split('\n\n').map((paragraph) => {
      const p = document.createElement('p');
      p.className = 'quiz-intro';
      p.textContent = paragraph;
      return p;
    });

    const instructionEl = document.createElement('p');
    instructionEl.className = 'flower-instruction';
    instructionEl.textContent = TASK3_INSTRUCTION_TEXT;

    const tray = document.createElement('div');
    tray.className = 'cook-tray';

    const containersGrid = document.createElement('div');
    containersGrid.className = 'cook-containers';

    const clearSelection = () => {
      selectedId = null;
      Object.values(cardEls).forEach((el) => el.classList.remove('cook-card-selected'));
    };

    const attemptPlace = (cardId, containerId) => {
      if (!cardId || filled.has(containerId) || !cardEls[cardId]) return;

      if (cardId === containerId) {
        filled.add(containerId);
        vesselEls[containerId].classList.add('cook-vessel-filled');
        vesselIconEls[containerId].hidden = true;
        vesselImgEls[containerId].src = TASK3_ICONS[cardId];
        vesselImgEls[containerId].hidden = false;
        containerFillEls[containerId].textContent = byId[cardId].image;
        containerFillEls[containerId].hidden = false;
        containerEls[containerId].classList.add('cook-container-filled');
        cardEls[cardId].remove();
        delete cardEls[cardId];
        clearSelection();

        if (filled.size === pairs.length) {
          completeTask(lessonKey, task.id);
          reactToTaskComplete();
          rerenderCurrentLesson();
        }
      } else {
        const containerEl = containerEls[containerId];
        containerEl.classList.remove('cook-container-shake');
        // eslint-disable-next-line no-void
        void containerEl.offsetWidth;
        containerEl.classList.add('cook-container-shake');
        clearSelection();
      }
    };

    imageOrder.forEach((id) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'cook-card';
      const cardIcon = document.createElement('img');
      cardIcon.className = 'cook-card-icon';
      cardIcon.src = TASK3_ICONS[id];
      cardIcon.alt = '';
      const cardLabel = document.createElement('span');
      cardLabel.className = 'cook-card-label';
      cardLabel.textContent = byId[id].image;
      card.append(cardIcon, cardLabel);
      card.draggable = true;
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('click', () => {
        if (selectedId === id) {
          clearSelection();
          return;
        }
        clearSelection();
        selectedId = id;
        card.classList.add('cook-card-selected');
      });
      cardEls[id] = card;
      tray.appendChild(card);
    });

    termOrder.forEach((id) => {
      const containerEl = document.createElement('div');
      containerEl.className = 'cook-container';

      const vessel = document.createElement('div');
      vessel.className = 'cook-vessel';
      const vesselIcon = document.createElement('img');
      vesselIcon.className = 'cook-vessel-icon';
      vesselIcon.src = 'assets/icons/task3-vessel-empty.png';
      vesselIcon.alt = '';
      const vesselImg = document.createElement('img');
      vesselImg.className = 'cook-vessel-img';
      vesselImg.alt = '';
      vesselImg.hidden = true;
      const fillText = document.createElement('span');
      fillText.className = 'cook-vessel-fill';
      fillText.hidden = true;
      vessel.append(vesselIcon, vesselImg, fillText);

      const label = document.createElement('div');
      label.className = 'cook-container-label';
      label.textContent = byId[id].term;

      containerEl.append(vessel, label);

      containerEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!filled.has(id)) containerEl.classList.add('cook-container-hover');
      });
      containerEl.addEventListener('dragleave', () => {
        containerEl.classList.remove('cook-container-hover');
      });
      containerEl.addEventListener('drop', (e) => {
        e.preventDefault();
        containerEl.classList.remove('cook-container-hover');
        attemptPlace(e.dataTransfer.getData('text/plain'), id);
      });
      containerEl.addEventListener('click', () => {
        if (filled.has(id) || !selectedId) return;
        attemptPlace(selectedId, id);
      });

      containerEls[id] = containerEl;
      vesselEls[id] = vessel;
      vesselIconEls[id] = vesselIcon;
      vesselImgEls[id] = vesselImg;
      containerFillEls[id] = fillText;
      containersGrid.appendChild(containerEl);
    });

    const gameEl = document.createElement('div');
    gameEl.className = 'cook-game';
    gameEl.append(tray, containersGrid);

    const sidebar = document.createElement('div');
    sidebar.className = 'flower-sidebar';
    sidebar.append(...introEls, instructionEl);

    wrap.append(gameEl, sidebar);
    taskContentPanel.appendChild(wrap);
  };

  // --- "Взгляд астролога" (task_4): пять полупрозрачных концентрических
  // слоёв (Планета в центре, вокруг — Накшатра/Знак/Дом/Навамша), на
  // каждый из трёх вопросов свой верный слой. Ошибка — слой трясётся и
  // тускнеет, но остаётся; две ошибки подряд (по всей карте, не по
  // вопросу) — вся карта схлопывается и разворачивается заново с первого
  // (перемешанного) вопроса.
  const MAP_ADVANCE_DELAY_MS = 1200;
  const MAP_COLLAPSE_DELAY_MS = 1100;

  const renderLayeredMapTask = (lessonKey, task, data) => {
    // Слои рисуются от внешнего к внутреннему — так меньшие кольца лежат
    // поверх больших и открывают их "бублик" под собой, кликабельным.
    const layerNames = [...data.layers].reverse();
    const MAX_WRONG_TAPS = data.maxWrongTaps || 2;

    const wrap = document.createElement('div');
    wrap.className = 'map-task';

    const introEl = document.createElement('p');
    introEl.className = 'quiz-intro';
    introEl.textContent = data.intro;

    const caseEl = document.createElement('p');
    caseEl.className = 'map-case-text';
    caseEl.textContent = data.caseText;

    const feedbackEl = document.createElement('div');
    feedbackEl.className = 'flower-feedback';
    feedbackEl.hidden = true;

    const showMapFeedback = (text, isWarning) => {
      feedbackEl.hidden = false;
      feedbackEl.textContent = text;
      feedbackEl.classList.toggle('flower-feedback-warning', !!isWarning);
    };

    const progressEl = document.createElement('p');
    progressEl.className = 'quiz-progress';

    const questionEl = document.createElement('p');
    questionEl.className = 'map-question';

    const diagram = document.createElement('div');
    diagram.className = 'map-diagram';

    const mapStage = document.createElement('div');
    mapStage.className = 'map-stage';
    mapStage.appendChild(diagram);

    let questionOrder = shuffle(data.questions);
    let questionIndex = 0;
    let wrongTaps = 0;
    let settled = false;

    const showQuestion = () => {
      const q = questionOrder[questionIndex];
      progressEl.textContent = `Вопрос ${questionIndex + 1} из ${questionOrder.length}`;
      questionEl.textContent = q.question;
      feedbackEl.hidden = true;
      feedbackEl.classList.remove('flower-feedback-warning');
    };

    // eslint-disable-next-line no-use-before-define
    const buildLayers = (isReroll) => {
      diagram.innerHTML = '';
      settled = false;

      layerNames.forEach((term, i) => {
        const layer = document.createElement('button');
        layer.type = 'button';
        layer.className = `map-layer map-layer-${i}`;
        if (isReroll && !prefersReducedMotion) layer.classList.add('map-layer-unfold');

        const label = document.createElement('span');
        label.className = 'map-layer-label';
        label.textContent = term;
        layer.appendChild(label);

        // eslint-disable-next-line no-use-before-define
        layer.addEventListener('click', () => handleLayerTap(term, layer));
        diagram.appendChild(layer);
      });
    };

    const resetMap = () => {
      showMapFeedback(TASK4_REROLL_TEXT, true);
      settled = true;

      const rebuild = () => {
        questionOrder = shuffle(data.questions);
        questionIndex = 0;
        wrongTaps = 0;
        buildLayers(true);
        showQuestion();
      };

      if (prefersReducedMotion) {
        setTimeout(rebuild, 50);
      } else {
        Array.from(diagram.querySelectorAll('.map-layer')).forEach((el) => {
          el.classList.add('map-layer-collapse');
        });
        setTimeout(rebuild, MAP_COLLAPSE_DELAY_MS);
      }
    };

    const handleLayerTap = (term, layerEl) => {
      if (settled) return;
      const q = questionOrder[questionIndex];

      if (term === q.correctAnswer) {
        settled = true;
        feedbackEl.hidden = true;
        layerEl.classList.add(prefersReducedMotion ? 'map-layer-correct-static' : 'map-layer-correct');

        const isLast = questionIndex === questionOrder.length - 1;
        setTimeout(() => {
          if (isLast) {
            completeTask(lessonKey, task.id);
            reactToTaskComplete();
            rerenderCurrentLesson();
          } else {
            questionIndex += 1;
            buildLayers(false);
            showQuestion();
          }
        }, MAP_ADVANCE_DELAY_MS);
      } else {
        wrongTaps += 1;
        if (!prefersReducedMotion) {
          layerEl.classList.remove('map-layer-wrong');
          // eslint-disable-next-line no-void
          void layerEl.offsetWidth;
          layerEl.classList.add('map-layer-wrong');
        }

        if (wrongTaps >= MAX_WRONG_TAPS) {
          resetMap();
        } else {
          showMapFeedback(TASK4_WARNING_TEXT, true);
        }
      }
    };

    buildLayers(false);
    showQuestion();

    const gameEl = document.createElement('div');
    gameEl.className = 'map-game';
    gameEl.append(progressEl, questionEl, mapStage);

    const sidebar = document.createElement('div');
    sidebar.className = 'flower-sidebar';
    sidebar.append(introEl, caseEl, feedbackEl);

    wrap.append(gameEl, sidebar);
    taskContentPanel.appendChild(wrap);
  };

  // Финальная сцена после третьего цветка: три расцветших цветка рядом
  // (лепесток-ложь у каждого уже "улетел", показаны только 3 правдивых)
  // плюс общая вспышка света.
  const renderFlowerCompletionScene = (task) => {
    const wrap = document.createElement('div');
    wrap.className = 'flower-garden';

    const flash = document.createElement('div');
    flash.className = 'flower-garden-flash';
    wrap.appendChild(flash);

    const row = document.createElement('div');
    row.className = 'flower-garden-row';

    task2Data.flowers.forEach((flower) => {
      const mini = document.createElement('div');
      mini.className = 'flower-mini';
      const center = document.createElement('div');
      center.className = 'flower-mini-center';
      mini.appendChild(center);
      flower.options
        .filter((opt) => !opt.isError)
        .forEach((opt, i) => {
          const petal = document.createElement('div');
          petal.className = `flower-mini-petal flower-mini-petal-${i}`;
          mini.appendChild(petal);
        });
      row.appendChild(mini);
    });
    wrap.appendChild(row);

    const text = document.createElement('p');
    text.className = 'task-content-done';
    text.textContent = `✓ «${task.title}» выполнено`;
    wrap.appendChild(text);

    const finalText = document.createElement('p');
    finalText.className = 'task-content-feedback';
    finalText.textContent = TASK2_FINAL_TEXT;
    wrap.appendChild(finalText);

    taskContentPanel.appendChild(wrap);
  };

  // Финальная сцена после задания 3: все пять образов блюда — уже в виде
  // готовых "тарелок" — выстраиваются в ряд с плавным появлением по очереди,
  // плюс общая вспышка света (переиспользуем .flower-garden-flash).
  const renderCookCompletionScene = (task) => {
    const wrap = document.createElement('div');
    wrap.className = 'flower-garden';

    const flash = document.createElement('div');
    flash.className = 'flower-garden-flash';
    wrap.appendChild(flash);

    const row = document.createElement('div');
    row.className = 'flower-garden-row';

    task3Data.pairs.forEach((pair, i) => {
      const dish = document.createElement('div');
      dish.className = 'cook-garden-dish';
      dish.style.animationDelay = `${i * 0.12}s`;
      const img = document.createElement('img');
      img.src = TASK3_ICONS[pair.id];
      img.alt = '';
      dish.appendChild(img);
      row.appendChild(dish);
    });
    wrap.appendChild(row);

    const text = document.createElement('p');
    text.className = 'task-content-done';
    text.textContent = `✓ «${task.title}» выполнено`;
    wrap.appendChild(text);

    const finalText = document.createElement('p');
    finalText.className = 'task-content-feedback';
    finalText.textContent = TASK3_FINAL_TEXT;
    wrap.appendChild(finalText);

    taskContentPanel.appendChild(wrap);
  };

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

    if (task.status === 'completed' && task.id === 'task_2') {
      renderFlowerCompletionScene(task);
    } else if (task.status === 'completed' && task.id === 'task_3') {
      renderCookCompletionScene(task);
    } else if (task.status === 'completed') {
      const feedback = TASK_COMPLETED_FEEDBACK[task.id];
      taskContentPanel.innerHTML = `
        <p class="task-content-done">✓ «${task.title}» выполнено</p>
        ${feedback ? `<p class="task-content-feedback">${feedback}</p>` : ''}
      `;
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
    } else if (task.id === 'task_1' && task.type === 'matching') {
      renderMatchingTask(lessonKey, task);
    } else if (task.id === 'task_2' && task.type === 'find_error') {
      renderFlowerTask(lessonKey, task, task2Data);
    } else if (task.id === 'task_3' && task.type === 'drag_to_container') {
      renderDragTask(lessonKey, task, task3Data);
    } else if (task.id === 'task_4' && task.type === 'layered_map') {
      renderLayeredMapTask(lessonKey, task, task4Data);
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
