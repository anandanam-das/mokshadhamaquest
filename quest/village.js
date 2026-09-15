document.addEventListener('DOMContentLoaded', () => {
  const state = getUserState();

  if (!state.telegramId) {
    window.location.href = 'checking.html';
    return;
  }

  if (!state.character) {
    window.location.href = 'create-character.html';
    return;
  }

  const taskTypeIcons = {
    guna_video: '🎥',
    guna_phrase: '🗣️',
    guna_audio: '🎧',
    guna_image: '🖼️',
    planet_map_matching: '🧭',
    lecture_checkbox: '📺',
    matching: '🔗',
    find_error: '🔍',
    matching_transfer: '🔁',
    drag_to_container: '🍲',
    layered_map: '🎯',
    guided_tour: '🗺️',
    guna_sort_rounds: '⚡',
  };

  const stage = document.getElementById('villageStage');
  const detailRoot = document.getElementById('villageDetail');
  const taskContentPanel = document.getElementById('taskContentPanel');

  // Координаты — % от квадратного landscape.png (assets/village/landscape.png,
  // 1256×1256), не пиксели: так здания масштабируются вместе с картой на
  // любом экране и остаются привязанными к своей точке на рисунке.
  // Направления — по мандале, которую задал пользователь. У Раху и Кету
  // своего здания нет (planetBuildings[...].file === null) — они просто
  // побережье и гора на самом ландшафте, координаты — где эти детали на
  // картинке. Первый черновик, точки уточняем по месту.
  const villageLayout = {
    surya:   { x: 50, y: 50 }, // центр (Брахмастхана)
    chandra: { x: 12, y: 25 }, // северо-запад
    mangala: { x: 50, y: 86 }, // юг
    budha:   { x: 50, y: 14 }, // север
    guru:    { x: 89, y: 25 }, // северо-восток
    shukra:  { x: 79, y: 75 }, // юго-восток
    shani:   { x: 12, y: 50 }, // запад
    rahu:    { x: 19, y: 78 }, // юго-запад — побережье, без здания
    ketu:    { x: 104, y: 47 }, // восток, по центру правого края — Гималаи, без здания
  };

  // Порядок разблокировки зданий деревни: Ратуша первая, дальше по цепочке.
  const UNLOCK_ORDER = ['surya', 'chandra', 'mangala', 'budha', 'guru', 'shukra', 'shani', 'rahu', 'ketu'];
  const PLANET_TASK_IDS = [
    'watch_lecture',
    'engine_video',
    'engine_phrase',
    'engine_audio',
    'engine_error',
    'engine_image',
    'engine_map',
  ];

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
  // % от ширины сцены — не px, чтобы здание масштабировалось вместе с
  // landscape.png на любом экране.
  const BUILDING_SIZE_PCT = 24;
  const RATUSHA_SIZE_PCT = 30;
  // У Кету завал — не типовая иконка, а кольцо камней вокруг Гималаев,
  // ему нужен размер побольше, чем у обычного здания.
  const SIZE_OVERRIDES_PCT = { ketu: 74, rahu: 48 };
  // Когда визуальный размер (выше) намного больше нормального клик-таргета,
  // сама картинка становится некликабельной (pointer-events: none через
  // класс .visual-only), а наведение/клик обрабатывает отдельная кнопка
  // такого же размера, как у обычного здания — иначе гигантский
  // прямоугольник кнопки перехватывает наведение у соседей даже там, где
  // на самой картинке всё прозрачно.
  const HIT_SIZE_OVERRIDES_PCT = { ketu: 32 };
  // Точка самого здания (villageLayout.ketu) прижата к правому краю
  // (x:104) и наполовину обрезана сценой (overflow: hidden) — картинка
  // от этого только выигрывает (видна её левая часть), а вот отдельная
  // кнопка-хитбокс того же размера, что у обычного здания, там почти
  // целиком уезжала бы за пределы экрана. Поэтому у неё своя, полностью
  // видимая точка — там, где кольцо реально видно на экране.
  const HIT_POS_OVERRIDES_PCT = { ketu: { x: 86, y: 50 } };
  // Точечный сдвиг подписи (в % от сцены) относительно её обычного места
  // "под картинкой" — когда для конкретного здания этого недостаточно.
  const LABEL_OFFSET_PCT = {
    rahu: { dx: -6, dy: -8 },
    ketu: { dx: -11, dy: -9 },
    chandra: { dx: 1, dy: 1.5 },
  };

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

  // --- 6 движков планетного урока (Солнце и далее — та же структура,
  // меняются только данные в PLANET_TASK_CONTENT). Общие кусочки:
  // renderChoiceButtons (один вопрос, N кнопок-вариантов, повтор при
  // ошибке) и renderDetailsReveal (тап открывает пункт: ✓/✗ + пояснение,
  // без набора очков — это чтение с подсказками, а не тест).

  const renderChoiceButtons = (container, question, options, onCorrect) => {
    const q = document.createElement('p');
    q.className = 'engine-step-question';
    q.textContent = question;
    container.appendChild(q);

    const list = document.createElement('div');
    list.className = 'engine-choice-list';
    container.appendChild(list);

    let settled = false;
    options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'engine-choice-btn';
      btn.textContent = opt.text;
      btn.addEventListener('click', () => {
        if (settled) return;
        if (opt.correct) {
          settled = true;
          btn.classList.add('engine-choice-correct');
          setTimeout(onCorrect, 700);
        } else {
          btn.classList.remove('engine-choice-shake');
          // eslint-disable-next-line no-void
          void btn.offsetWidth;
          btn.classList.add('engine-choice-wrong', 'engine-choice-shake');
        }
      });
      list.appendChild(btn);
    });
  };

  const renderDetailsReveal = (container, details, onDone) => {
    const list = document.createElement('div');
    list.className = 'engine-details-list';
    container.appendChild(list);

    const shuffled = shuffle(details);
    const correctTotal = shuffled.filter((d) => d.kind === 'correct').length;

    const hint = document.createElement('p');
    hint.className = 'engine-details-hint';

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'btn btn-primary engine-details-next';
    nextBtn.textContent = 'Дальше';
    nextBtn.disabled = true;

    let revealedCorrectCount = 0;
    const updateHint = () => {
      hint.textContent =
        revealedCorrectCount === correctTotal
          ? ''
          : `Найди верные признаки среди пунктов (${revealedCorrectCount} из ${correctTotal})`;
    };
    updateHint();

    shuffled.forEach((detail) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'engine-detail-item';
      const text = document.createElement('span');
      text.className = 'engine-detail-text';
      text.textContent = detail.text;
      item.appendChild(text);

      item.addEventListener('click', () => {
        if (item.classList.contains('revealed')) return;
        item.classList.add('revealed', `kind-${detail.kind}`);
        const mark = document.createElement('span');
        mark.className = 'engine-detail-mark';
        mark.textContent = detail.kind === 'correct' ? '✓' : '✗';
        item.prepend(mark);
        if (detail.note) {
          const note = document.createElement('span');
          note.className = 'engine-detail-note';
          note.textContent = detail.note;
          item.appendChild(note);
        }
        if (detail.kind === 'correct') revealedCorrectCount += 1;
        updateHint();
        if (revealedCorrectCount === correctTotal) nextBtn.disabled = false;
      });
      list.appendChild(item);
    });

    container.append(hint, nextBtn);
    nextBtn.addEventListener('click', onDone);
  };

  // Плеер: video — iframe для youtube/vimeo, иначе обычный <video>; audio —
  // минимальный кастомный плеер (play/pause + прогресс-бар), потому что
  // голый браузерный <audio controls> визуально чужероден интерфейсу.
  const renderMediaPlayer = (container, clip, mediaKind) => {
    if (mediaKind === 'video') {
      const isEmbed = /youtube\.com|vimeo\.com|mediadelivery\.net/.test(clip.videoUrl);
      if (isEmbed) {
        const iframe = document.createElement('iframe');
        iframe.className = 'engine-video-frame';
        iframe.src = clip.videoUrl;
        iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
        iframe.allowFullscreen = true;
        container.appendChild(iframe);
      } else {
        const video = document.createElement('video');
        video.className = 'engine-video-frame';
        video.src = clip.videoUrl;
        video.controls = true;
        container.appendChild(video);
      }
      return;
    }

    const player = document.createElement('div');
    player.className = 'audio-player';

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'audio-player-toggle';
    toggleBtn.textContent = '▶';

    const bar = document.createElement('div');
    bar.className = 'audio-player-bar';
    const fill = document.createElement('div');
    fill.className = 'audio-player-fill';
    bar.appendChild(fill);

    const time = document.createElement('span');
    time.className = 'audio-player-time';
    time.textContent = '0:00';

    player.append(toggleBtn, bar, time);
    container.appendChild(player);

    const audio = new Audio(clip.audioUrl);
    const formatTime = (seconds) => {
      if (!isFinite(seconds) || seconds < 0) return '0:00';
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    };

    toggleBtn.addEventListener('click', () => {
      if (audio.paused) {
        audio.play();
        toggleBtn.textContent = '❚❚';
      } else {
        audio.pause();
        toggleBtn.textContent = '▶';
      }
    });
    audio.addEventListener('timeupdate', () => {
      const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
      fill.style.width = `${pct}%`;
      time.textContent = formatTime(audio.duration - audio.currentTime);
    });
    audio.addEventListener('ended', () => {
      toggleBtn.textContent = '▶';
      fill.style.width = '0%';
    });
    bar.addEventListener('click', (e) => {
      if (!audio.duration) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
      audio.currentTime = ratio * audio.duration;
    });
  };

  // "Три лика ..." (guna_video) и "Голос трёх начал" (guna_audio) — одна и
  // та же 4-шаговая механика (медиа → Гуна → Причина → Детали), три клипа
  // подряд в перемешанном порядке. mediaKind различает только сам плеер.
  const renderGunaMediaTask = (lessonKey, task, data, mediaKind) => {
    const wrap = document.createElement('div');
    wrap.className = 'engine-task';

    const intro = document.createElement('p');
    intro.className = 'quiz-intro';
    intro.textContent = data.introText;

    const progress = document.createElement('p');
    progress.className = 'quiz-progress';

    const stage = document.createElement('div');
    stage.className = 'engine-stage';

    wrap.append(intro, progress, stage);
    taskContentPanel.appendChild(wrap);

    const clips = shuffle(data.clips || data.recordings);
    let index = 0;

    const showClip = () => {
      stage.innerHTML = '';
      progress.textContent = `${index + 1} из ${clips.length}`;
      const clip = clips[index];

      const media = document.createElement('div');
      media.className = 'engine-media';
      renderMediaPlayer(media, clip, mediaKind);
      stage.appendChild(media);

      const continueBtn = document.createElement('button');
      continueBtn.type = 'button';
      continueBtn.className = 'btn btn-primary';
      continueBtn.textContent = mediaKind === 'video' ? 'Я посмотрел, дальше' : 'Я послушал, дальше';
      continueBtn.addEventListener('click', () => showStepA(clip));
      stage.appendChild(continueBtn);
    };

    const showStepA = (clip) => {
      stage.innerHTML = '';
      const step = document.createElement('div');
      step.className = 'engine-step';
      stage.appendChild(step);
      const noun = mediaKind === 'video' ? 'видео' : 'рассказе';
      renderChoiceButtons(
        step,
        `Какая гуна проявлена в этом ${noun}?`,
        shuffle(GUNA_ORDER.map((g) => ({ text: g, correct: g === clip.guna }))),
        () => showStepB(clip)
      );
    };

    const showStepB = (clip) => {
      stage.innerHTML = '';
      const step = document.createElement('div');
      step.className = 'engine-step';
      stage.appendChild(step);
      // По умолчанию — общие формулировки причины (одни на все планеты),
      // но задание может переопределить их через data.reasonOptions, если
      // нужны варианты, завязанные на сюжет конкретных клипов.
      const reasonOptions = data.reasonOptions || GUNA_REASON_OPTIONS;
      renderChoiceButtons(
        step,
        'Почему именно эта гуна?',
        shuffle(reasonOptions.map((o) => ({ text: o.text, correct: o.guna === clip.guna }))),
        () => showStepC(clip)
      );
    };

    const showStepC = (clip) => {
      stage.innerHTML = '';
      const label = document.createElement('p');
      label.className = 'engine-step-question';
      label.textContent = 'Разбери детали — что подтверждает эту гуну, а что нет:';
      stage.appendChild(label);

      const refText = clip.transcript ? `«${clip.transcript}»` : clip.source;
      if (refText) {
        const ref = document.createElement('p');
        ref.className = 'engine-transcript';
        ref.textContent = refText;
        stage.appendChild(ref);
      }

      renderDetailsReveal(stage, clip.details, () => {
        index += 1;
        if (index < clips.length) {
          showClip();
        } else {
          completeTask(lessonKey, task.id);
          reactToTaskComplete();
          rerenderCurrentLesson();
        }
      });
    };

    showClip();
  };

  // Лайтбокс: клик по картинке в "Окне в иной век" открывает её крупно
  // поверх всего, чтобы можно было рассмотреть детали кадра перед разбором.
  const openImageLightbox = (src, alt) => {
    const overlay = document.createElement('div');
    overlay.className = 'image-lightbox-overlay';

    const img = document.createElement('img');
    img.className = 'image-lightbox-image';
    img.src = src;
    img.alt = alt || '';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'image-lightbox-close';
    closeBtn.setAttribute('aria-label', 'Закрыть');
    closeBtn.textContent = '×';

    const onKeydown = (e) => {
      if (e.key === 'Escape') close();
    };
    const close = () => {
      overlay.remove();
      document.removeEventListener('keydown', onKeydown);
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', onKeydown);

    overlay.append(img, closeBtn);
    document.body.appendChild(overlay);
  };

  // "Окно в иной век" (guna_image) — та же механика, но короче: медиа →
  // Гуна → Детали, без шага "Причина".
  const renderGunaImageTask = (lessonKey, task, data) => {
    const wrap = document.createElement('div');
    wrap.className = 'engine-task';

    const intro = document.createElement('p');
    intro.className = 'quiz-intro';
    intro.textContent = data.introText;

    const progress = document.createElement('p');
    progress.className = 'quiz-progress';

    const stage = document.createElement('div');
    stage.className = 'engine-stage';

    wrap.append(intro, progress, stage);
    taskContentPanel.appendChild(wrap);

    const cards = shuffle(data.cards);
    let index = 0;

    const showCard = () => {
      stage.innerHTML = '';
      progress.textContent = `${index + 1} из ${cards.length}`;
      const card = cards[index];

      const media = document.createElement('div');
      media.className = 'engine-media';
      const img = document.createElement('img');
      img.className = 'engine-image-frame';
      img.src = card.imageUrl;
      img.alt = card.setting || '';
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', 'Увеличить изображение');
      img.addEventListener('click', () => openImageLightbox(card.imageUrl, card.setting));
      img.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openImageLightbox(card.imageUrl, card.setting);
        }
      });
      media.appendChild(img);
      if (card.setting) {
        const caption = document.createElement('p');
        caption.className = 'engine-image-caption';
        caption.textContent = card.setting;
        media.appendChild(caption);
      }
      stage.appendChild(media);

      const step = document.createElement('div');
      step.className = 'engine-step';
      stage.appendChild(step);
      renderChoiceButtons(
        step,
        'Какая гуна проявлена на этой картинке?',
        shuffle(GUNA_ORDER.map((g) => ({ text: g, correct: g === card.guna }))),
        () => showDetails(card)
      );
    };

    const showDetails = (card) => {
      stage.innerHTML = '';
      const label = document.createElement('p');
      label.className = 'engine-step-question';
      label.textContent = 'Разбери детали изображения:';
      stage.appendChild(label);

      renderDetailsReveal(stage, card.details, () => {
        index += 1;
        if (index < cards.length) {
          showCard();
        } else {
          completeTask(lessonKey, task.id);
          reactToTaskComplete();
          rerenderCurrentLesson();
        }
      });
    };

    showCard();
  };

  // "Слово гуны" (guna_phrase) — фраза на экране, тап по одной из трёх
  // кнопок-гун, общий таймер на всё задание (без штрафов за ошибку —
  // просто показывается верная гуна и задание идёт дальше).
  const renderGunaPhraseTask = (lessonKey, task, data) => {
    const wrap = document.createElement('div');
    wrap.className = 'engine-task';

    const intro = document.createElement('p');
    intro.className = 'quiz-intro';
    intro.textContent = 'Тапни по гуне, которая проявлена во фразе. Время ограничено.';

    const timerEl = document.createElement('p');
    timerEl.className = 'quiz-progress';

    const stage = document.createElement('div');
    stage.className = 'engine-stage';

    wrap.append(intro, timerEl, stage);
    taskContentPanel.appendChild(wrap);

    const phrases = shuffle(data.phrases);
    let index = 0;
    let secondsLeft = data.timerSeconds;
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      clearInterval(timerId);
      completeTask(lessonKey, task.id);
      reactToTaskComplete();
      rerenderCurrentLesson();
    };

    timerEl.textContent = `Осталось: ${secondsLeft} сек`;
    const timerId = setInterval(() => {
      secondsLeft -= 1;
      timerEl.textContent = `Осталось: ${Math.max(secondsLeft, 0)} сек`;
      if (secondsLeft <= 0) finish();
    }, 1000);

    const showPhrase = () => {
      if (finished) return;
      stage.innerHTML = '';
      const phraseEl = document.createElement('p');
      phraseEl.className = 'engine-phrase-text';
      phraseEl.textContent = `«${phrases[index].text}»`;
      stage.appendChild(phraseEl);

      const buttons = document.createElement('div');
      buttons.className = 'engine-choice-list';
      stage.appendChild(buttons);

      let answered = false;
      GUNA_ORDER.forEach((guna) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'engine-choice-btn';
        btn.textContent = guna;
        btn.addEventListener('click', () => {
          if (answered || finished) return;
          answered = true;
          const correct = guna === phrases[index].guna;
          btn.classList.add(correct ? 'engine-choice-correct' : 'engine-choice-wrong');
          if (!correct) {
            buttons.querySelectorAll('.engine-choice-btn').forEach((b) => {
              if (b.textContent === phrases[index].guna) b.classList.add('engine-choice-correct');
            });
          }
          setTimeout(() => {
            index += 1;
            if (index < phrases.length) showPhrase();
            else finish();
          }, 650);
        });
        buttons.appendChild(btn);
      });
    };

    showPhrase();
  };

  // "Изъян в писании" (find_error у движков — обычный тест "выбери 1 из 4",
  // не цветок с лепестками: та механика была специфична для task_2).
  const renderFindErrorEngineTask = (lessonKey, task, data) => {
    const wrap = document.createElement('div');
    wrap.className = 'engine-task';

    const progress = document.createElement('p');
    progress.className = 'quiz-progress';

    const stage = document.createElement('div');
    stage.className = 'engine-stage';

    wrap.append(progress, stage);
    taskContentPanel.appendChild(wrap);

    const questions = shuffle(data.questions);
    let index = 0;

    const showQuestion = () => {
      stage.innerHTML = '';
      progress.textContent = `Вопрос ${index + 1} из ${questions.length}`;
      const q = questions[index];

      const statement = document.createElement('p');
      statement.className = 'engine-step-question';
      statement.textContent = `«${q.statement}»`;
      stage.appendChild(statement);

      const list = document.createElement('div');
      list.className = 'engine-choice-list engine-choice-list-vertical';
      stage.appendChild(list);

      let settled = false;
      let correctBtn = null;
      const entries = shuffle(q.options).map((opt) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'engine-choice-btn';
        btn.textContent = opt.text;
        if (opt.correct) correctBtn = btn;
        list.appendChild(btn);
        return { btn, opt };
      });

      entries.forEach(({ btn, opt }) => {
        btn.addEventListener('click', () => {
          if (settled) return;
          settled = true;
          btn.classList.add(opt.correct ? 'engine-choice-correct' : 'engine-choice-wrong');
          if (!opt.correct) correctBtn.classList.add('engine-choice-correct');

          const nextBtn = document.createElement('button');
          nextBtn.type = 'button';
          nextBtn.className = 'btn btn-primary engine-details-next';
          nextBtn.textContent = index === questions.length - 1 ? 'Завершить' : 'Дальше';
          nextBtn.addEventListener('click', () => {
            index += 1;
            if (index < questions.length) {
              showQuestion();
            } else {
              completeTask(lessonKey, task.id);
              reactToTaskComplete();
              rerenderCurrentLesson();
            }
          });
          stage.appendChild(nextBtn);
        });
      });
    };

    showQuestion();
  };

  // "Карта звёздного покровителя" (planet_map_matching) — 8 подписанных
  // категорий-слотов и вперемешку карточки: по одной верной на категорию
  // + дистракторы (верные ответы для ДРУГИХ планет), чтобы нельзя было
  // пройти на угадывании "куда влезет" без знания сути. Драг-н-дроп + тап,
  // как в "Гении кулинарии".
  const renderPlanetMapTask = (lessonKey, task, data) => {
    const wrap = document.createElement('div');
    wrap.className = 'engine-task map-match-task';

    const intro = document.createElement('p');
    intro.className = 'quiz-intro';
    intro.textContent =
      'Собери карту звёздного покровителя: перетащи (или тапни, затем тапни категорию) верную карточку на её место. Среди карточек есть и чужие — ответы других планет.';

    const categoriesEl = document.createElement('div');
    categoriesEl.className = 'map-match-categories';

    const poolEl = document.createElement('div');
    poolEl.className = 'map-match-pool';

    wrap.append(intro, categoriesEl, poolEl);
    taskContentPanel.appendChild(wrap);

    let cardSeq = 0;
    const cards = [];
    data.categories.forEach((cat) => {
      cards.push({ uid: `c${cardSeq += 1}`, text: cat.correct, categoryId: cat.id, correct: true });
      cat.distractors.forEach((text) => {
        cards.push({ uid: `c${cardSeq += 1}`, text, categoryId: cat.id, correct: false });
      });
    });

    const filled = new Set();
    let selectedUid = null;
    const cardEls = {};
    const slotEls = {};

    const clearSelection = () => {
      selectedUid = null;
      Object.values(cardEls).forEach((el) => el.classList.remove('map-match-card-selected'));
    };

    const attemptPlace = (uid, categoryId) => {
      if (!uid || filled.has(categoryId) || !cardEls[uid]) return;
      const card = cards.find((c) => c.uid === uid);

      if (card.correct && card.categoryId === categoryId) {
        filled.add(categoryId);
        const slot = slotEls[categoryId];
        slot.classList.add('map-match-slot-filled');
        const valueEl = slot.querySelector('.map-match-slot-value');
        valueEl.textContent = card.text;
        valueEl.hidden = false;
        cardEls[uid].remove();
        delete cardEls[uid];
        clearSelection();

        if (filled.size === data.categories.length) {
          completeTask(lessonKey, task.id);
          reactToTaskComplete();
          rerenderCurrentLesson();
        }
      } else {
        const slot = slotEls[categoryId];
        slot.classList.remove('map-match-slot-shake');
        // eslint-disable-next-line no-void
        void slot.offsetWidth;
        slot.classList.add('map-match-slot-shake');
        clearSelection();
      }
    };

    data.categories.forEach((cat) => {
      const slot = document.createElement('div');
      slot.className = 'map-match-slot';

      const label = document.createElement('div');
      label.className = 'map-match-slot-label';
      label.textContent = cat.label;

      const value = document.createElement('div');
      value.className = 'map-match-slot-value';
      value.hidden = true;

      slot.append(label, value);

      slot.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!filled.has(cat.id)) slot.classList.add('map-match-slot-hover');
      });
      slot.addEventListener('dragleave', () => slot.classList.remove('map-match-slot-hover'));
      slot.addEventListener('drop', (e) => {
        e.preventDefault();
        slot.classList.remove('map-match-slot-hover');
        attemptPlace(e.dataTransfer.getData('text/plain'), cat.id);
      });
      slot.addEventListener('click', () => {
        if (filled.has(cat.id) || !selectedUid) return;
        attemptPlace(selectedUid, cat.id);
      });

      slotEls[cat.id] = slot;
      categoriesEl.appendChild(slot);
    });

    shuffle(cards).forEach((card) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'map-match-card';
      el.textContent = card.text;
      el.draggable = true;
      el.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', card.uid);
        e.dataTransfer.effectAllowed = 'move';
      });
      el.addEventListener('click', () => {
        if (selectedUid === card.uid) {
          clearSelection();
          return;
        }
        clearSelection();
        selectedUid = card.uid;
        el.classList.add('map-match-card-selected');
      });
      cardEls[card.uid] = el;
      poolEl.appendChild(el);
    });
  };

  // "Одна энергия — три пути" (guna_sort_rounds) — 5 раундов: одна ситуация,
  // три реакции без подписи гуны, перетащить (или тап+тап) каждую в одну
  // из трёх фиксированных зон. Та же drag/tap-механика и вёрстка (map-match-*),
  // что у "Карты звёздного покровителя", но зоны фиксированы на весь урок,
  // а не собираются из data.categories — и пул из 3 карточек на раунд,
  // а не общий пул на всё задание.
  const GUNA_SORT_ZONES = [
    { id: 'tamas', label: 'ТАМАС — НЕВЕЖЕСТВО', guna: 'Тамас' },
    { id: 'rajas', label: 'РАДЖАС — СТРАСТЬ', guna: 'Раджас' },
    { id: 'sattva', label: 'САТТВА — БЛАГОСТЬ', guna: 'Саттва' },
  ];

  const renderGunaSortTask = (lessonKey, task, data) => {
    const wrap = document.createElement('div');
    wrap.className = 'engine-task';

    const intro = document.createElement('p');
    intro.className = 'quiz-intro';
    intro.textContent = data.introText;

    const progress = document.createElement('p');
    progress.className = 'quiz-progress';

    // Живёт вне stage (не пересоздаётся на каждый раунд/реролл), как в
    // "Саде двух миров" и "Взгляде астролога" — та же .flower-feedback.
    const feedbackEl = document.createElement('div');
    feedbackEl.className = 'flower-feedback';
    feedbackEl.hidden = true;

    const showFeedback = (text, isWarning) => {
      feedbackEl.hidden = false;
      feedbackEl.textContent = text;
      feedbackEl.classList.toggle('flower-feedback-warning', !!isWarning);
    };

    const hideFeedback = () => {
      feedbackEl.hidden = true;
      feedbackEl.classList.remove('flower-feedback-warning');
    };

    const stage = document.createElement('div');
    stage.className = 'engine-stage';

    wrap.append(intro, progress, feedbackEl, stage);
    taskContentPanel.appendChild(wrap);

    const rounds = shuffle(data.rounds);
    // 3 ошибки на раунд ещё можно, 4-я пересобирает раунд заново (те же
    // 3 карточки, новая перетасовка) — как maxWrongPlucks у task_2.
    const MAX_WRONG_ATTEMPTS = data.maxWrongAttempts || 4;
    let index = 0;

    const showFinal = () => {
      hideFeedback();
      stage.innerHTML = '';
      progress.textContent = '';
      const final = document.createElement('p');
      final.className = 'task-content-feedback';
      final.textContent = data.finalMessage;
      stage.appendChild(final);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-primary';
      btn.textContent = 'Дальше';
      btn.addEventListener('click', () => {
        completeTask(lessonKey, task.id);
        reactToTaskComplete();
        rerenderCurrentLesson();
      });
      stage.appendChild(btn);
    };

    const showRound = () => {
      hideFeedback();
      stage.innerHTML = '';
      progress.textContent = `${index + 1} из ${rounds.length}`;
      const round = rounds[index];
      let wrongAttempts = 0;
      let settled = false;

      const situation = document.createElement('p');
      situation.className = 'engine-step-question';
      situation.textContent = round.prompt;
      stage.appendChild(situation);

      const zonesEl = document.createElement('div');
      zonesEl.className = 'guna-sort-zones';

      const poolEl = document.createElement('div');
      poolEl.className = 'map-match-pool';

      stage.append(zonesEl, poolEl);

      const filled = new Set();
      let selectedUid = null;
      const cardEls = {};
      const slotEls = {};

      const clearSelection = () => {
        selectedUid = null;
        Object.values(cardEls).forEach((el) => el.classList.remove('map-match-card-selected'));
      };

      const cards = round.reactions.map((r, i) => ({ uid: `r${i}`, text: r.text, guna: r.guna }));

      const attemptPlace = (uid, zoneId) => {
        if (settled || !uid || filled.has(zoneId) || !cardEls[uid]) return;
        const card = cards.find((c) => c.uid === uid);
        const zone = GUNA_SORT_ZONES.find((z) => z.id === zoneId);

        if (card.guna === zone.guna) {
          filled.add(zoneId);
          const slot = slotEls[zoneId];
          slot.classList.add('map-match-slot-filled');
          const valueEl = slot.querySelector('.map-match-slot-value');
          valueEl.textContent = card.text;
          valueEl.hidden = false;
          cardEls[uid].remove();
          delete cardEls[uid];
          clearSelection();
          hideFeedback();

          if (filled.size === GUNA_SORT_ZONES.length) {
            settled = true;
            index += 1;
            setTimeout(index < rounds.length ? showRound : showFinal, 700);
          }
        } else {
          const slot = slotEls[zoneId];
          slot.classList.remove('map-match-slot-shake');
          // eslint-disable-next-line no-void
          void slot.offsetWidth;
          slot.classList.add('map-match-slot-shake');
          clearSelection();

          wrongAttempts += 1;
          if (wrongAttempts >= MAX_WRONG_ATTEMPTS) {
            settled = true;
            showFeedback(GUNA_SORT_RESET_TEXT, true);
            setTimeout(showRound, 1200);
          } else {
            showFeedback(GUNA_SORT_WARNING_TEXT, true);
          }
        }
      };

      GUNA_SORT_ZONES.forEach((zone) => {
        const slot = document.createElement('div');
        slot.className = 'map-match-slot';

        const label = document.createElement('div');
        label.className = 'map-match-slot-label';
        label.textContent = zone.label;

        const value = document.createElement('div');
        value.className = 'map-match-slot-value';
        value.hidden = true;

        slot.append(label, value);

        slot.addEventListener('dragover', (e) => {
          e.preventDefault();
          if (!filled.has(zone.id)) slot.classList.add('map-match-slot-hover');
        });
        slot.addEventListener('dragleave', () => slot.classList.remove('map-match-slot-hover'));
        slot.addEventListener('drop', (e) => {
          e.preventDefault();
          slot.classList.remove('map-match-slot-hover');
          attemptPlace(e.dataTransfer.getData('text/plain'), zone.id);
        });
        slot.addEventListener('click', () => {
          if (filled.has(zone.id) || !selectedUid) return;
          attemptPlace(selectedUid, zone.id);
        });

        slotEls[zone.id] = slot;
        zonesEl.appendChild(slot);
      });

      shuffle(cards).forEach((card) => {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'map-match-card';
        el.textContent = card.text;
        el.draggable = true;
        el.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', card.uid);
          e.dataTransfer.effectAllowed = 'move';
        });
        el.addEventListener('click', () => {
          if (selectedUid === card.uid) {
            clearSelection();
            return;
          }
          clearSelection();
          selectedUid = card.uid;
          el.classList.add('map-match-card-selected');
        });
        cardEls[card.uid] = el;
        poolEl.appendChild(el);
      });
    };

    showRound();
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
    } else if (task.id === 'task_gunas' && task.type === 'guna_sort_rounds') {
      renderGunaSortTask(lessonKey, task, taskGunaSortData);
    } else if (task.id === 'task_1' && task.type === 'matching') {
      renderMatchingTask(lessonKey, task);
    } else if (task.id === 'task_2' && task.type === 'find_error') {
      renderFlowerTask(lessonKey, task, task2Data);
    } else if (task.id === 'task_3' && task.type === 'drag_to_container') {
      renderDragTask(lessonKey, task, task3Data);
    } else if (task.id === 'task_4' && task.type === 'layered_map') {
      renderLayeredMapTask(lessonKey, task, task4Data);
    } else if (task.id === 'engine_video' && task.type === 'guna_video') {
      renderGunaMediaTask(lessonKey, task, PLANET_TASK_CONTENT[lessonKey].videoTask, 'video');
    } else if (task.id === 'engine_phrase' && task.type === 'guna_phrase') {
      renderGunaPhraseTask(lessonKey, task, PLANET_TASK_CONTENT[lessonKey].phraseTask);
    } else if (task.id === 'engine_audio' && task.type === 'guna_audio') {
      renderGunaMediaTask(lessonKey, task, PLANET_TASK_CONTENT[lessonKey].audioTask, 'audio');
    } else if (task.id === 'engine_error' && task.type === 'find_error') {
      renderFindErrorEngineTask(lessonKey, task, PLANET_TASK_CONTENT[lessonKey].findErrorTask);
    } else if (task.id === 'engine_image' && task.type === 'guna_image') {
      renderGunaImageTask(lessonKey, task, PLANET_TASK_CONTENT[lessonKey].imageTask);
    } else if (task.id === 'engine_map' && task.type === 'planet_map_matching') {
      renderPlanetMapTask(lessonKey, task, PLANET_TASK_CONTENT[lessonKey].mapTask);
    } else if (task.type === 'guided_tour') {
      taskContentPanel.innerHTML = `<p class="task-content-text">Обзор обители идёт прямо на карте слева.</p>`;
      startVillageTour(lessonKey, task);
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

  const REVEAL_MS = 900;

  // Пока планета не пройдена — на её точке лежит завал (у всех 9,
  // включая Раху/Кету). Здание под завалом не рисуется вообще — оно
  // появляется только когда завал убран, и то лишь если оно вообще
  // существует (у Раху/Кету building.file === null: там просто
  // открывается сам ландшафт — побережье/Гималаи, без отдельной картинки).
  // justUnlocked — true ровно на том рендере, где статус впервые стал
  // "unlocked": тогда завал убирается анимацией, а не просто исчезает.
  const selectBuilding = (characterId) => {
    selectedBuildingId = characterId;
    stage.querySelectorAll('.village-building').forEach((node) => {
      node.classList.toggle('selected', node.dataset.buildingId === selectedBuildingId);
    });
  };

  const openBuildingLesson = (character) => {
    selectBuilding(character.id);
    showPatronSpeech(getReaction(patronId, character.id));
    openLesson(character.id, getLocationHeading(character.subtitle), getEngineTasksForPlanet(character.title));
  };

  // "Знакомство с обителью" — гайд-тур по карте: тёмная подложка на весь
  // экран (.onboarding-overlay), в ней прорезано светящееся кольцо вокруг
  // одного здания за раз (.onboarding-highlight — сам поднимается выше
  // подложки через z-index) и рядом плавающая карточка с текстом. Два
  // шага: сначала общий смысл ("обитель Богов", наполнить знанием —
  // помочь Васту Пуруше), потом прицельно Ратуша — тыкай сюда, дальше
  // просто прохождение заданий. Ратуша к этому моменту уже сама
  // пульсирует (status: active_pulse, она первая в UNLOCK_ORDER).
  const TOUR_STEPS = [
    {
      text: 'Это обитель Богов. Твоя задача — наполнить её знанием и тем самым помочь Васту Пуруше: каждый освоенный храм — часть его тела, возвращённая к жизни.',
      highlightId: null,
    },
    {
      text: 'Начнём с Ратуши — она уже ждёт тебя. Дальше всё просто: открываешь здание, проходишь задание за заданием, и храм оживает.',
      highlightId: 'surya',
    },
  ];

  let tourActive = false;

  const startVillageTour = (lessonKey, task) => {
    if (tourActive) return;
    tourActive = true;

    let stepIndex = 0;
    let highlightedEl = null;

    const overlay = document.createElement('div');
    overlay.className = 'onboarding-overlay';

    const tooltip = document.createElement('div');
    tooltip.className = 'onboarding-tooltip';

    const clearHighlight = () => {
      if (highlightedEl) {
        highlightedEl.classList.remove('onboarding-highlight');
        highlightedEl = null;
      }
    };

    const finish = () => {
      clearHighlight();
      overlay.remove();
      tooltip.remove();
      tourActive = false;
      completeTask(lessonKey, task.id);
      reactToTaskComplete();
      rerenderCurrentLesson();
    };

    const renderStep = () => {
      clearHighlight();
      const step = TOUR_STEPS[stepIndex];
      const isLast = stepIndex === TOUR_STEPS.length - 1;

      tooltip.innerHTML = `
        <p class="onboarding-text">${step.text}</p>
        <button type="button" class="btn btn-primary onboarding-next">${isLast ? 'Понятно' : 'Далее'}</button>
      `;
      tooltip.style.left = '50%';
      tooltip.style.top = '50%';
      tooltip.style.transform = 'translate(-50%, -50%)';

      if (step.highlightId) {
        highlightedEl = stage.querySelector(`.village-building[data-building-id="${step.highlightId}"]`);
        if (highlightedEl) {
          highlightedEl.classList.add('onboarding-highlight');
          const rect = highlightedEl.getBoundingClientRect();
          tooltip.style.top = `${rect.bottom + 18}px`;
          tooltip.style.left = `${rect.left + rect.width / 2}px`;
          tooltip.style.transform = 'translateX(-50%)';
        }
      }

      tooltip.querySelector('.onboarding-next').addEventListener('click', () => {
        if (isLast) {
          finish();
        } else {
          stepIndex += 1;
          renderStep();
        }
      });
    };

    document.body.append(overlay, tooltip);
    renderStep();
  };

  // Только рисунок (завал/здание) — сама карточка-кнопка. Подпись
  // рисуется отдельным элементом, вторым проходом (см. placeBuildingLabel),
  // чтобы гарантированно лежать поверх ЛЮБОГО завала на карте, а не
  // только своего собственного — соседний завал может быть крупнее и
  // визуально перекрывать чужую подпись, если она нарисована в тот же
  // проход, что и картинки.
  const placeBuildingArt = (character, pos, sizePct, justUnlocked) => {
    const status = getBuildingStatus(character.id);
    const building = planetBuildings[character.id];

    const el = document.createElement('button');
    el.type = 'button';
    el.dataset.buildingId = character.id;
    el.dataset.buildingName = building.name;
    el.className = `village-building status-${status}`;
    el.style.width = `${sizePct}%`;
    el.style.left = `${pos.x}%`;
    el.style.top = `${pos.y}%`;

    const art = document.createElement('span');
    art.className = 'village-building-art';

    if (status === 'unlocked') {
      if (building.file) {
        const img = document.createElement('img');
        img.src = `assets/village/buildings/${building.file}.png`;
        img.alt = building.name;
        img.className = 'village-building-image';
        if (justUnlocked && !prefersReducedMotion) img.classList.add('village-building-reveal');
        art.appendChild(img);
      }
      if (justUnlocked) {
        const rubble = document.createElement('img');
        rubble.src = `assets/village/rubble/${character.id}-zaval.png`;
        rubble.alt = '';
        rubble.className = 'village-building-rubble';
        if (prefersReducedMotion) {
          // не рендерим совсем — эквивалент мгновенного снятия завала
        } else {
          rubble.classList.add('village-building-rubble-clear');
          art.appendChild(rubble);
          setTimeout(() => rubble.remove(), REVEAL_MS);
        }
      }
    } else {
      const rubble = document.createElement('img');
      rubble.src = `assets/village/rubble/${character.id}-zaval.png`;
      rubble.alt = '';
      rubble.className = 'village-building-rubble';
      art.appendChild(rubble);
    }

    el.appendChild(art);

    const hitSizePct = HIT_SIZE_OVERRIDES_PCT[character.id];
    const interactive = hitSizePct ? document.createElement('button') : el;

    if (hitSizePct) {
      // Картинка большая, но кликабельная/наводимая зона — отдельная
      // кнопка нормального размера, обычно поверх той же точки (но может
      // быть сдвинута через HIT_POS_OVERRIDES_PCT, если сама точка здания
      // уезжает за край экрана); сама картинка становится чисто визуальной
      // (см. .visual-only в CSS).
      const hitPos = HIT_POS_OVERRIDES_PCT[character.id] || pos;
      el.classList.add('visual-only');
      interactive.type = 'button';
      interactive.dataset.buildingId = character.id;
      interactive.className = `village-building-hit status-${status}`;
      interactive.style.width = `${hitSizePct}%`;
      interactive.style.left = `${hitPos.x}%`;
      interactive.style.top = `${hitPos.y}%`;
    }

    if (status !== 'pending') {
      interactive.addEventListener('click', () => openBuildingLesson(character));
    }

    // Подпись по умолчанию скрыта (см. placeBuildingLabel) и появляется
    // только при наведении/тапе на само здание — или на саму подпись,
    // чтобы не пропадала, пока курсор ещё над ней.
    interactive.addEventListener('mouseenter', () => showBuildingLabel(character.id));
    interactive.addEventListener('mouseleave', () => hideBuildingLabel(character.id));
    interactive.addEventListener('touchstart', () => showBuildingLabel(character.id), { passive: true });
    interactive.addEventListener('focus', () => showBuildingLabel(character.id));
    interactive.addEventListener('blur', () => hideBuildingLabel(character.id));

    stage.appendChild(el);
    if (hitSizePct) stage.appendChild(interactive);
  };

  const findLabelEl = (characterId) =>
    stage.querySelector(`.village-building-label-layer[data-building-id="${characterId}"]`);

  const showBuildingLabel = (characterId) => {
    const label = findLabelEl(characterId);
    if (label) label.classList.add('label-visible');
  };

  const hideBuildingLabel = (characterId) => {
    const label = findLabelEl(characterId);
    if (label) label.classList.remove('label-visible');
  };

  // Подпись (плашка с именем + замочек) — отдельная кнопка поверх той же
  // точки, добавляется в DOM позже всех village-building, поэтому всегда
  // рисуется выше любого завала на карте. Видна только при наведении/тапе
  // (см. showBuildingLabel/hideBuildingLabel, вешаются на само здание).
  const placeBuildingLabel = (character, pos, sizePct, status) => {
    const building = planetBuildings[character.id];

    const el = document.createElement('button');
    el.type = 'button';
    el.dataset.buildingId = character.id;
    el.className = `village-building-label-layer status-${status}`;
    const offset = LABEL_OFFSET_PCT[character.id] || { dx: 0, dy: 1.5 };
    el.style.left = `${pos.x + offset.dx}%`;
    // Подпись цепляется к низу картинки здания/завала с небольшим
    // нахлёстом (12% от её размера), а не к жёстко заданной точке.
    el.style.top = `${pos.y + sizePct / 2 - sizePct * 0.12 + offset.dy}%`;
    el.innerHTML = `
      <span class="village-building-label">${building.name}</span>
      ${status === 'pending' ? '<span class="village-building-lock">🔒</span>' : ''}
    `;

    if (status !== 'pending') {
      el.addEventListener('click', () => openBuildingLesson(character));
    }

    el.addEventListener('mouseenter', () => showBuildingLabel(character.id));
    el.addEventListener('mouseleave', () => hideBuildingLabel(character.id));

    stage.appendChild(el);
  };

  const GROUND_TRANSITION_MS = 1800;

  // Ландшафт — один квадратный слой на всю сцену (Васту Пуруша уже
  // вклеен под ландшафтом в самой картинке). Рисуется всегда, даже до
  // открытия деревни. Пока карта не открыта, показываем не сам landscape,
  // а его туманную версию (cloud-cover.png), поверх которой плывут тучки.
  //
  // В момент самого открытия (justUnlocked) — не резкая подмена картинки,
  // а кроссфейд через белый свет: старая (в тучах) высветляется и тает,
  // новая (чистый landscape) одновременно проявляется из белого — задник
  // для того, как тучи на внешнем слое (см. renderClouds) в это же время
  // разлетаются в стороны.
  const renderGroundLayers = (unlocked, justUnlocked) => {
    if (!justUnlocked || prefersReducedMotion) {
      const ground = document.createElement('img');
      ground.className = 'village-ground';
      ground.src = unlocked ? 'assets/village/landscape.png' : 'assets/village/clouds/cloud-cover.png';
      ground.alt = '';
      stage.appendChild(ground);
      return;
    }

    const oldGround = document.createElement('img');
    oldGround.className = 'village-ground village-ground-whiteout';
    oldGround.src = 'assets/village/clouds/cloud-cover.png';
    oldGround.alt = '';
    stage.appendChild(oldGround);

    const newGround = document.createElement('img');
    newGround.className = 'village-ground village-ground-reveal';
    newGround.src = 'assets/village/landscape.png';
    newGround.alt = '';
    stage.appendChild(newGround);

    setTimeout(() => oldGround.remove(), GROUND_TRANSITION_MS);
  };

  // Карта открывается не по флагу "весь урок Введение завершён", а как
  // только становится доступным сам гайд-тур "Знакомство с обителью" —
  // то есть сразу после последнего реального задания (Взгляд астролога).
  // Так тучи рассеиваются и карта открыта уже во время самого тура, а не
  // только после того, как его отметят пройденным.
  const isVillageMapUnlocked = () => {
    const progress = getTaskProgress('intro');
    const others = INTRO_TASKS.filter((t) => t.id !== 'watch_lecture' && t.id !== 'village_intro');
    return others.every((t) => progress[t.id]);
  };

  const CLOUDS_DISPERSE_MS = 1600;
  let cloudsDispersed = false;

  // Пять клочков тучи (assets/village/clouds/cloud-puff-N.png), раскиданных
  // по сцене поверх cloud-cover.png — у каждого свой размер/точка/скорость
  // дрейфа (village-cloud-drift-N в CSS), чтобы облачность казалась живой,
  // а не статичной картинкой.
  const CLOUD_PUFFS = [
    { n: 1, x: 22, y: 24, size: 55 },
    { n: 2, x: 74, y: 20, size: 48 },
    { n: 3, x: 50, y: 50, size: 62 },
    { n: 4, x: 20, y: 76, size: 50 },
    { n: 5, x: 78, y: 74, size: 46 },
  ];

  // Пока карта не открыта — облака дрейфуют на месте (см. CLOUD_PUFFS).
  // В момент открытия — разовая анимация: каждый клочок разъезжается в
  // свою сторону и тает, дальше тучи больше не рисуются.
  const renderClouds = (unlocked) => {
    if (unlocked && cloudsDispersed) return;

    const layer = document.createElement('div');
    layer.className = 'village-clouds';

    CLOUD_PUFFS.forEach(({ n, x, y, size }) => {
      const puff = document.createElement('img');
      puff.src = `assets/village/clouds/cloud-puff-${n}.png`;
      puff.alt = '';
      puff.className = `village-cloud-puff village-cloud-puff-${n}`;
      puff.style.left = `${x}%`;
      puff.style.top = `${y}%`;
      puff.style.width = `${size}%`;
      layer.appendChild(puff);
    });

    stage.appendChild(layer);

    if (!unlocked) return;

    cloudsDispersed = true;
    if (prefersReducedMotion) {
      layer.remove();
      return;
    }
    // eslint-disable-next-line no-void
    void layer.offsetWidth;
    layer.classList.add('village-clouds-disperse');
    setTimeout(() => layer.remove(), CLOUDS_DISPERSE_MS);
  };

  // null до первого рендера — на нём baseline снимается молча (без
  // анимации завала), даже если что-то уже было пройдено в прошлой
  // сессии. Дальше justUnlocked истинно только на том рендере, где
  // статус конкретной планеты впервые стал 'unlocked'.
  let lastBuildingStatus = null;

  const buildVillageStage = () => {
    stage.innerHTML = '';
    stage.classList.remove('village-stage-empty');

    const mapUnlocked = isVillageMapUnlocked();
    // Читаем cloudsDispersed ДО renderClouds — тот сам его выставит в
    // true при первом же unlocked-рендере, а нам нужно узнать, что это
    // именно тот, первый.
    renderGroundLayers(mapUnlocked, mapUnlocked && !cloudsDispersed);

    if (!mapUnlocked) {
      stage.classList.add('village-stage-empty');
      const emptyText = document.createElement('p');
      emptyText.className = 'village-stage-empty-text';
      emptyText.textContent = 'Обитель появится здесь после «Введения»';
      stage.appendChild(emptyText);
      renderClouds(false);
      return;
    }

    const isInitialRender = lastBuildingStatus === null;
    const newStatus = {};

    // Два прохода: сначала все картинки (завалы/здания), потом все
    // подписи — так подпись любого здания гарантированно ложится поверх
    // завала любого другого, а не только своего собственного.
    const layout = MOKSHA_CHARACTERS.map((character) => {
      const pos = villageLayout[character.id];
      const sizePct =
        SIZE_OVERRIDES_PCT[character.id] ??
        (character.id === 'surya' ? RATUSHA_SIZE_PCT : BUILDING_SIZE_PCT);
      const status = getBuildingStatus(character.id);
      newStatus[character.id] = status;
      const justUnlocked =
        !isInitialRender && status === 'unlocked' && lastBuildingStatus[character.id] !== 'unlocked';
      return { character, pos, sizePct, status, justUnlocked };
    });

    layout.forEach(({ character, pos, sizePct, justUnlocked }) => {
      placeBuildingArt(character, pos, sizePct, justUnlocked);
    });
    layout.forEach(({ character, pos, sizePct, status }) => {
      placeBuildingLabel(character, pos, sizePct, status);
    });

    lastBuildingStatus = newStatus;

    renderClouds(true);
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
