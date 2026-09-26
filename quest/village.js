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

  // Выбор покровителя (creator.js) сохраняется в quest-api "best-effort" —
  // если в тот момент запрос не прошёл, локально всё работает (персонаж
  // лежит в localStorage), но в БД patron_planet так и остаётся пустым
  // навсегда — в админке это выглядит как "—" у игрока, который явно уже
  // играет. Подстраховка: на каждом заходе в деревню тихо повторяем
  // синхронизацию, пока она не пройдёт.
  if (typeof saveQuestProfile === 'function' && state.character.patronPlanet) {
    saveQuestProfile({ patronPlanet: state.character.patronPlanet }).catch(() => {});
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
  const stageWrap = document.getElementById('villageStageWrap');
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

  const INTRO_TASK_IDS = ['watch_lecture', 'task_gunas', 'task_1', 'task_2', 'task_3', 'task_4', 'village_intro'];
  const isIntroFullyDone = () => {
    const progress = getTaskProgress('intro');
    return INTRO_TASK_IDS.every((id) => progress[id]);
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
    rahu: { dx: -3, dy: -8 },
    ketu: { dx: -17, dy: -9 },
    chandra: { dx: 7, dy: 1.5 },
    // Шани (запад, x:12) и Гуру (восток, x:89) стоят достаточно близко к
    // краю сцены, чтобы даже подпись в две строки задевала его — сдвигаем
    // каждую немного к центру карты. Мангала (юг, y:86) — то же самое по
    // вертикали: без сдвига подпись оказывалась почти у самого нижнего края.
    shani: { dx: 7, dy: 1.5 },
    guru: { dx: -6, dy: 1.5 },
    mangala: { dx: 0, dy: -3 },
  };

  stageWrap.style.width = '100%';
  stageWrap.style.maxWidth = `${STAGE_SIZE}px`;
  stageWrap.style.aspectRatio = '1 / 1';
  stageWrap.style.margin = '0 auto';

  let selectedBuildingId = null;
  let activeTaskId = null;
  let currentLessonKey = null;
  let currentLessonHeading = null;
  let currentLessonTasks = null;
  // Индекс открытого сейчас раунда экзамена (null — сам экзамен не открыт).
  let relActiveRoundIndex = null;

  // --- Персонаж-покровитель: зафиксирован на экране (не на странице),
  // всегда в углу снизу, можно скрыть и показать снова. Раньше при новой
  // реплике виджет автоматически разворачивался, даже если пользователь
  // его только что скрыл, — сейчас скрытие уважается: пока пользователь
  // сам не нажмёт "показать", реплики просто не всплывают.

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

  // Переход между зданиями (конец Введения → Сурья, конец планеты →
  // следующая) — единственный случай, когда реплика обязана появиться,
  // даже если пользователь свернул виджет: это не рядовая болтовня, а
  // отметка о продвижении по сюжету. Разворачиваем виджет и гасим экран
  // на время реплики, а если он был свёрнут — сворачиваем обратно, когда
  // реплика уйдёт, чтобы не отменять выбор пользователя навсегда.
  let transitionOverlay = null;
  let transitionWasHidden = false;
  // Два РАЗНЫХ состояния делят портрет Шивы, поэтому нужны два отдельных
  // флага (раньше был один общий shivaActive, и это была баг: закрытие
  // случайно ещё показанной старой реплики во время экзамена откатывало
  // портрет на покровителя игрока прямо посреди экзамена).
  // shivaActive — вход в сам экзамен Шивы (см. openRelationshipsExam),
  // держится весь ход экзамена, снимается только exitRelationshipsTask.
  let shivaActive = false;
  // shivaCutsceneActive — отдельный кратковременный момент (showShivaMoment):
  // портрет подменяется на Шиву только на время ЭТОЙ конкретной реплики и
  // откатывается сам, когда реплика закрывается — независимо от того,
  // активен ли сейчас экзамен.
  let shivaCutsceneActive = false;
  // Заполняется showShivaMoment, когда после кат-сцены нужно что-то
  // сделать (например, перерисовать карту деревни) — иначе просто null.
  let afterOverlayCallback = null;

  const clearTransitionOverlay = () => {
    if (!transitionOverlay) return;
    const overlay = transitionOverlay;
    transitionOverlay = null;
    overlay.classList.remove('transition-overlay-visible');
    setTimeout(() => overlay.remove(), 600);
    if (shivaCutsceneActive) {
      shivaCutsceneActive = false;
      // Экзамен Шивы (если он сейчас активен) держит свой портрет сам —
      // не откатываем его тут, иначе закрытие кат-сцены посреди экзамена
      // сбросило бы портрет на покровителя игрока прямо во время экзамена.
      if (!shivaActive) setupPatronWidget();
    }
    if (transitionWasHidden) hidePatronWidget();
    if (afterOverlayCallback) {
      const cb = afterOverlayCallback;
      afterOverlayCallback = null;
      cb();
    }
  };

  const hidePatronSpeech = () => {
    clearTimeout(speechHideTimer);
    patronSpeechBubble.classList.remove('speech-bubble-visible');
    patronSpeechBubble.hidden = true;
    clearTransitionOverlay();
  };

  const bumpPatronImage = () => {
    const img = document.getElementById('patronWidgetImage');
    img.classList.remove('patron-react');
    // eslint-disable-next-line no-void
    void img.offsetWidth;
    img.classList.add('patron-react');
    img.addEventListener('animationend', () => img.classList.remove('patron-react'), { once: true });
  };

  const showPatronSpeech = (message) => {
    // Пользователь сам скрыл виджет — не разворачиваем его обратно без
    // спроса, реплика просто не показывается, пока он не нажмёт "показать".
    if (patronWidget.classList.contains('patron-widget-hidden')) return;
    patronSpeechBubble.textContent = message;
    patronSpeechBubble.hidden = false;
    patronSpeechBubble.classList.add('speech-bubble-visible');

    clearTimeout(speechHideTimer);
    speechHideTimer = setTimeout(hidePatronSpeech, SPEECH_AUTO_HIDE_MS);
    bumpPatronImage();
  };

  const TRANSITION_HOLD_MS = 5000;

  const showTransitionMoment = (message) => {
    transitionWasHidden = patronWidget.classList.contains('patron-widget-hidden');
    if (transitionWasHidden) showPatronWidget();

    const overlay = document.createElement('div');
    overlay.className = 'transition-overlay';
    document.body.appendChild(overlay);
    transitionOverlay = overlay;
    // eslint-disable-next-line no-void
    void overlay.offsetWidth;
    overlay.classList.add('transition-overlay-visible');

    patronSpeechBubble.textContent = message;
    patronSpeechBubble.hidden = false;
    patronSpeechBubble.classList.add('speech-bubble-visible');

    clearTimeout(speechHideTimer);
    speechHideTimer = setTimeout(hidePatronSpeech, TRANSITION_HOLD_MS);
    bumpPatronImage();
  };

  // Завершение всей Граха-таттвы (девятая планета) — не рядовой переход
  // между зданиями, а отдельная кат-сцена: вместо покровителя в виджете
  // на время реплики появляется сам Шива (assets/prologue/shiva.png, уже
  // использован в прологе). Держим дольше обычного перехода — момент
  // значимый, читать чуть дольше.
  const SHIVA_HOLD_MS = 8000;

  const showShivaMoment = (message, onDone) => {
    transitionWasHidden = patronWidget.classList.contains('patron-widget-hidden');
    if (transitionWasHidden) showPatronWidget();

    afterOverlayCallback = onDone || null;
    shivaCutsceneActive = true;
    const img = document.getElementById('patronWidgetImage');
    img.src = 'assets/prologue/shiva.png';
    img.alt = 'Шива';
    const reopenImg = document.getElementById('patronReopenImage');
    reopenImg.src = 'assets/prologue/shiva.png';
    reopenImg.alt = 'Шива';

    const overlay = document.createElement('div');
    overlay.className = 'transition-overlay';
    document.body.appendChild(overlay);
    transitionOverlay = overlay;
    // eslint-disable-next-line no-void
    void overlay.offsetWidth;
    overlay.classList.add('transition-overlay-visible');

    patronSpeechBubble.textContent = message;
    patronSpeechBubble.hidden = false;
    patronSpeechBubble.classList.add('speech-bubble-visible');

    clearTimeout(speechHideTimer);
    speechHideTimer = setTimeout(hidePatronSpeech, SHIVA_HOLD_MS);
    bumpPatronImage();
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

  // Обычный shuffle() иногда сваливает все "correct" пункты подряд —
  // тогда задание превращается в "тапай всё по порядку, не читая". Но
  // раскладывать по видам и собирать строго по кругу (первая версия этой
  // функции) — другая крайность: когда видов всего два поровну (4
  // correct + 4 trap, как почти везде), круговой сбор даёт железную
  // шахматку "верно-неверно-верно-неверно" КАЖДЫЙ раз — тоже угадываемый
  // порядок, просто другой. Вместо этого берём честный shuffle() и чиним
  // ТОЛЬКО серии длиной 3+ подряд одного вида — меняем местами с
  // произвольной позицией другого вида и проверяем заново, пока таких
  // серий не останется. Редкие пары одного вида подряд — это нормальная
  // случайность и остаются как есть; длинных серий или шахматки не будет.
  const MAX_SAME_KIND_RUN = 2;
  const shuffleInterleaved = (array) => {
    const result = shuffle(array);

    const findBadRunIndex = () => {
      for (let i = MAX_SAME_KIND_RUN; i < result.length; i += 1) {
        if (result.slice(i - MAX_SAME_KIND_RUN, i + 1).every((item) => item.kind === result[i].kind)) {
          return i;
        }
      }
      return -1;
    };

    let guard = 0;
    let badIndex = findBadRunIndex();
    while (badIndex !== -1 && guard < 50) {
      const candidates = [];
      result.forEach((item, idx) => {
        if (item.kind !== result[badIndex].kind) candidates.push(idx);
      });
      if (!candidates.length) break;
      const swapIndex = candidates[Math.floor(Math.random() * candidates.length)];
      [result[badIndex], result[swapIndex]] = [result[swapIndex], result[badIndex]];
      guard += 1;
      badIndex = findBadRunIndex();
    }
    return result;
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

  // Портрет на время экзамена — Шива, а не выбранный игроком покровитель
  // (см. shivaActive), поэтому тап по нему должен звучать голосом Шивы,
  // а не переигрывать пул реакций patronId — иначе картинка одна, а
  // реплика будто от другого персонажа.
  const SHIVA_IDLE_REACTIONS = [
    'Не спеши — каждая граха раскрывается только тому, кто вглядывается внимательно.',
    'Отношения между грахами меняются в зависимости от направления — как и у людей.',
    'Дружба, вражда, нейтральность — это не ярлык навсегда, а то, что одна граха даёт другой прямо сейчас.',
    'Я видел тысячи учеников — торопливые путают дружбу с союзом, а союз с дружбой.',
    'Проверь себя внимательно — здесь нет случайных ответов, только то, что ты действительно понял.',
    'Каждый раунд можно пройти заново, если собьёшься — не бойся ошибиться, бойся не понять.',
  ];

  document.getElementById('patronWidgetImage').addEventListener('click', () => {
    if (shivaActive) {
      showPatronSpeech(pickNoRepeat('shiva:idleTap', SHIVA_IDLE_REACTIONS));
      return;
    }
    if (Math.random() < LORE_DROP_CHANCE) {
      showPatronSpeech(pickExpandedOnly('loreDrop'));
    } else {
      showPatronSpeech(pickPooledReaction('idleTap'));
    }
  });

  // Разовая реплика на переход между планетами — звучит вместо обычной
  // taskComplete ровно один раз за игру, в момент, когда последнее из 7
  // заданий планеты закрывает её здание. Фиксированный текст (не пул),
  // потому что переход всегда один и тот же (порядок открытия жёстко
  // задан UNLOCK_ORDER) — упоминает и то, что только что открыто, и
  // куда идти дальше. Не завязано на голос конкретного покровителя
  // (говорит тот, кого выбрал игрок) — общие фразы для любого перехода.
  const PLANET_COMPLETE_MESSAGES = {
    surya: 'Отлично! Мы открыли Ратушу — сердце нашей обители. Теперь идём дальше, познакомиться с Чандрой.',
    chandra: 'Дом Божественной Матери пробудился. Дальше нас ждёт Воинский зал — время встретить Мангалу.',
    mangala: 'Воинский зал взят! Теперь путь лежит в Торговую гильдию — там нас ждёт Буддха.',
    budha: 'Торговая гильдия открыта. Следующая остановка — Храм мудрости, где живёт Гуру.',
    guru: 'Храм мудрости больше не спит. Теперь заглянем в Чертоги Шукры.',
    shukra: 'Чертоги Шукры раскрыты! Дальше — Ремесленный двор, там ждёт Шани.',
    shani: 'Ремесленный двор ожил. Теперь путь лежит к Побережью — там кроется Раху.',
    rahu: 'Побережье открыто. Остался последний шаг — Гималаи, обитель Кету.',
    // ketu намеренно не здесь — это не рядовой переход, а конец всей
    // Граха-таттвы, отдельная кат-сцена с Шивой (см. SHIVA_COMPLETE_MESSAGE).
  };

  const INTRO_COMPLETE_MESSAGE =
    'Обитель богов пробудилась! Теперь пора познакомиться с Сурьей — загляни в Ратушу.';

  const SHIVA_COMPLETE_MESSAGE =
    'Я смотрю, ты открыл весь потенциал знаний и дал возможность дышать Васту Пуруше. Теперь проверим, как хорошо ты понял планеты — на примерах их взаимоотношений. Мой знак появился на карте — приходи, когда будешь готов.';

  const reactToTaskComplete = (lessonKey) => {
    if (lessonKey === 'intro' && isIntroFullyDone()) {
      showTransitionMoment(INTRO_COMPLETE_MESSAGE);
      return;
    }
    // Кету — последняя планета: этим шагом закрывается вся Граха-таттва,
    // и это не рядовой переход, а отдельная кат-сцена с самим Шивой
    // (вместо обычной реплики покровителя из PLANET_COMPLETE_MESSAGES).
    if (lessonKey === 'ketu' && isPlanetFullyDone('ketu')) {
      showShivaMoment(SHIVA_COMPLETE_MESSAGE, buildVillageStage);
      return;
    }
    if (lessonKey && UNLOCK_ORDER.includes(lessonKey) && isPlanetFullyDone(lessonKey)) {
      const message = PLANET_COMPLETE_MESSAGES[lessonKey];
      if (message) {
        showTransitionMoment(message);
        return;
      }
    }
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
          reactToTaskComplete(lessonKey);
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
  // оставшиеся три остаются на месте; неверный — лепесток просто
  // трясётся, повторный тап не заблокирован. После второй найденной лжи —
  // сразу feedback и кнопка "Далее"/"Завершить"; сам цветок гаснет и
  // происходит переход только по клику на неё (см. bloomPetalsThenRun).
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

    // Заменяет собой intro+instruction, пока не нажата "Далее"/"Завершить" —
    // вступительный текст задания нужен только пока ищешь лепестки, после
    // того как обе лжи найдены, он только занимает место над фидбеком.
    const correctLabel = document.createElement('p');
    correctLabel.className = 'flower-correct-label';
    correctLabel.textContent = 'Верно!';
    correctLabel.hidden = true;

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
    const FLOWER_BLOOM_DELAY_MS = 800;

    // Лепестки, ещё реально видимые на экране у текущего цветка (без уже
    // сорванных ошибок) — renderPetals держит её в актуальном состоянии.
    // Нужна отдельно от querySelectorAll('.flower-petal'), потому что уже
    // сорванные лепестки остаются в DOM (просто невидимы через forwards-
    // анимацию .flower-petal-plucked), и добавление им ещё и .flower-
    // petal-bloomed поверх заново запускало бы анимацию с её from{opacity:1}
    // — то есть на миг возвращало бы уже убранный лепесток на экран.
    let visiblePetalEls = [];

    // Весь цветок разом гаснет той же .flower-petal-bloomed, что и
    // раньше — но теперь снова само по себе, без клика по кнопке: даём
    // секунду-две дочитать feedback (FLOWER_READ_DELAY_MS), потом бутоны
    // опадают (FLOWER_BLOOM_DELAY_MS) и сам собой подгружается следующий
    // цветок или завершается задание.
    const FLOWER_READ_DELAY_MS = 1800;

    const bloomPetalsThenRun = (afterFn) => {
      if (prefersReducedMotion) {
        afterFn();
      } else {
        visiblePetalEls.forEach((el) => {
          el.classList.add('flower-petal-bloomed');
        });
        setTimeout(afterFn, FLOWER_BLOOM_DELAY_MS);
      }
    };

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
      introEl.hidden = false;
      instructionEl.hidden = false;
      correctLabel.hidden = true;

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
              visiblePetalEls = visiblePetalEls.filter((el) => el !== petal);
              if (prefersReducedMotion) {
                orbit.style.display = 'none';
              } else {
                petal.classList.add('flower-petal-plucked');
              }

              if (plucked.size < ERRORS_NEEDED) return;

              // Обе лжи найдены — ядро вспыхивает, но оставшиеся лепестки
              // остаются на месте: пусть пользователь видит цветок целиком,
              // пока не дочитает feedback и сам не нажмёт "Далее"/"Завершить"
              // (там весь цветок опадёт разом — см. wiltPetalsAndProceed).
              settled = true;
              introEl.hidden = true;
              instructionEl.hidden = true;
              correctLabel.hidden = false;
              if (!prefersReducedMotion) {
                center.classList.remove('flower-center-pulse');
                // eslint-disable-next-line no-void
                void center.offsetWidth;
                center.classList.add('flower-center-pulse');
              }

              showFlowerFeedback(flower.feedback, false);

              const isLast = flowerIndex === data.flowers.length - 1;
              setTimeout(() => {
                bloomPetalsThenRun(() => {
                  if (isLast) {
                    completeTask(lessonKey, task.id);
                    reactToTaskComplete(lessonKey);
                    rerenderCurrentLesson();
                  } else {
                    flowerIndex += 1;
                    loadFlower();
                  }
                });
              }, FLOWER_READ_DELAY_MS);
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
                // Ошибочно сорванный (но верный) лепесток тоже пропадает с
                // экрана насовсем — исключаем его из visiblePetalEls по той
                // же причине, что и найденные ложные: иначе bloom при
                // завершении цветка на миг вернул бы и его тоже.
                visiblePetalEls = visiblePetalEls.filter((el) => el !== petal);
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

        visiblePetalEls = Object.values(petalEls);
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
    sidebar.append(introEl, instructionEl, correctLabel, feedbackEl);

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
    // Как и в "Карте звёздного покровителя": можно выбрать сначала
    // карточку, потом ёмкость — или наоборот, сначала ёмкость, потом
    // карточку. Раньше клик по ёмкости без выбранной карточки просто
    // ничего не делал, без всякой подсветки — казалось, что клик не
    // сработал вообще.
    let selectedId = null;
    let selectedContainerId = null;
    const cardEls = {};
    const containerEls = {};
    const vesselEls = {};
    const vesselIconEls = {};
    const vesselImgEls = {};

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
      selectedContainerId = null;
      Object.values(cardEls).forEach((el) => el.classList.remove('cook-card-selected'));
      Object.values(containerEls).forEach((el) => el.classList.remove('cook-container-selected'));
    };

    const attemptPlace = (cardId, containerId) => {
      if (!cardId || filled.has(containerId) || !cardEls[cardId]) return;

      if (cardId === containerId) {
        filled.add(containerId);
        vesselEls[containerId].classList.add('cook-vessel-filled');
        vesselIconEls[containerId].hidden = true;
        vesselImgEls[containerId].src = TASK3_ICONS[cardId];
        vesselImgEls[containerId].hidden = false;
        containerEls[containerId].classList.add('cook-container-filled');
        cardEls[cardId].remove();
        delete cardEls[cardId];
        clearSelection();

        if (filled.size === pairs.length) {
          completeTask(lessonKey, task.id);
          reactToTaskComplete(lessonKey);
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
        if (selectedContainerId) {
          // Ёмкость уже выбрана сверху — тап по карточке завершает пару.
          attemptPlace(id, selectedContainerId);
          return;
        }
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
      vessel.append(vesselIcon, vesselImg);

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
        if (filled.has(id)) return;
        if (selectedId) {
          // Карточка уже выбрана в лотке — тап по ёмкости завершает пару.
          attemptPlace(selectedId, id);
          return;
        }
        if (selectedContainerId === id) {
          clearSelection();
          return;
        }
        // Ничего не выбрано — запоминаем эту ёмкость первой, следующий
        // тап по карточке в лотке завершит пару.
        clearSelection();
        selectedContainerId = id;
        containerEl.classList.add('cook-container-selected');
      });

      containerEls[id] = containerEl;
      vesselEls[id] = vessel;
      vesselIconEls[id] = vesselIcon;
      vesselImgEls[id] = vesselImg;
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
            reactToTaskComplete(lessonKey);
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
  // Позволяет пройти уже выполненное задание ещё раз, в чисто тренировочном
  // режиме: рендерит тот же интерактив, что и для незавершённого задания
  // (completeTask при повторном прохождении — идемпотентная операция, ничего
  // не сбрасывает и не ломает).
  const appendPracticeButton = (container, lessonKey, task) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary task-practice-btn';
    btn.textContent = '↺ Потренироваться ещё раз';
    btn.addEventListener('click', () => {
      renderTaskContentPanel(lessonKey, task, true);
    });
    container.appendChild(btn);
  };

  const renderFlowerCompletionScene = (lessonKey, task) => {
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
    appendPracticeButton(taskContentPanel, lessonKey, task);
  };

  // Финальная сцена после задания 3: все пять образов блюда — уже в виде
  // готовых "тарелок" — выстраиваются в ряд с плавным появлением по очереди,
  // плюс общая вспышка света (переиспользуем .flower-garden-flash).
  const renderCookCompletionScene = (lessonKey, task) => {
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
    appendPracticeButton(taskContentPanel, lessonKey, task);
  };

  // --- 6 движков планетного урока (Солнце и далее — та же структура,
  // меняются только данные в PLANET_TASK_CONTENT). Общие кусочки:
  // renderChoiceButtons (один вопрос, N кнопок-вариантов, повтор при
  // ошибке) и renderDetailsReveal (тап открывает пункт: ✓/✗ + пояснение,
  // без набора очков — это чтение с подсказками, а не тест).

  const renderChoiceButtons = (container, question, options, onCorrect, vertical, onWrong) => {
    if (question) {
      const q = document.createElement('p');
      q.className = 'engine-step-question';
      q.textContent = question;
      container.appendChild(q);
    }

    const list = document.createElement('div');
    list.className = vertical ? 'engine-choice-list engine-choice-list-vertical' : 'engine-choice-list';
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
          if (onWrong) onWrong();
        }
      });
      list.appendChild(btn);
    });
  };

  // Раньше можно было просто протапать все пункты подряд без всякого
  // риска — ни один неверный тап ничего не стоил. Теперь неверные тапы
  // считаются, и когда их остаётся допустить не больше одного до конца
  // всего "неверного" пула — задание пересобирается заново с нуля.
  // Лимит считаем от РЕАЛЬНОГО числа неверных пунктов в конкретном
  // наборе (allow all-but-one), а не фиксированным числом: у видео/картинок
  // обычно 4 неверных (лимит 3), у аудио — 3 (лимит 2). Фиксированное "3"
  // для аудио-наборов означало бы, что штраф срабатывает только тогда,
  // когда пользователь уже протыкал вообще ВСЕ неверные варианты — то
  // есть штрафа по факту не было бы вовсе.
  // onWrongLimit ведёт назад к началу клипа (пересмотреть/переслушать
  // отрывок или картинку), а не просто тасует те же пункты на месте:
  // штраф должен возвращать к источнику, а не превращаться в ещё одну
  // попытку угадать.
  const ENGINE_DETAILS_WARNING_TEXT = 'Это не признак — присмотрись внимательнее.';
  const ENGINE_DETAILS_RESET_TEXT = 'Слишком много ошибок — пересмотри отрывок ещё раз.';
  const ENGINE_DETAILS_RESET_DELAY_MS = 1400;

  const renderDetailsReveal = (container, details, onDone, onWrongLimit) => {
    const list = document.createElement('div');
    list.className = 'engine-details-list';
    container.appendChild(list);

    const shuffled = shuffleInterleaved(details);
    const correctTotal = shuffled.filter((d) => d.kind === 'correct').length;
    const wrongTotal = shuffled.length - correctTotal;
    const maxWrongTaps = Math.max(1, wrongTotal - 1);

    const hint = document.createElement('p');
    hint.className = 'engine-details-hint';

    const warning = document.createElement('p');
    warning.className = 'engine-details-warning';
    warning.hidden = true;

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'btn btn-primary engine-details-next';
    nextBtn.textContent = 'Дальше';
    nextBtn.disabled = true;

    let revealedCorrectCount = 0;
    let wrongTaps = 0;
    let settled = false;
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
        if (settled || item.classList.contains('revealed')) return;
        item.classList.add('revealed', `kind-${detail.kind}`);
        // Галочка/крестик стоит прямо перед своим пояснением (не отдельно
        // у текста вопроса) — иначе на карточке с несколькими пунктами
        // непонятно, к чему именно относится отметка. У нейтральных
        // пунктов нет "верно"/"неверно" — галочка или крестик там был бы
        // обманчив, поэтому mark вообще не рисуем.
        if (detail.kind !== 'neutral' || detail.note) {
          const note = document.createElement('span');
          note.className = 'engine-detail-note';
          if (detail.kind !== 'neutral') {
            const mark = document.createElement('span');
            mark.className = 'engine-detail-mark';
            mark.textContent = detail.kind === 'correct' ? '✓' : '✗';
            note.appendChild(mark);
          }
          if (detail.note) {
            const noteText = document.createElement('span');
            noteText.className = 'engine-detail-note-text';
            noteText.textContent = detail.note;
            note.appendChild(noteText);
          }
          item.appendChild(note);
        }

        if (detail.kind === 'correct') {
          revealedCorrectCount += 1;
          warning.hidden = true;
        } else {
          wrongTaps += 1;
          if (wrongTaps >= maxWrongTaps) {
            settled = true;
            warning.hidden = false;
            warning.textContent = ENGINE_DETAILS_RESET_TEXT;
            warning.classList.add('engine-details-warning-reset');
            nextBtn.disabled = true;
            setTimeout(() => onWrongLimit && onWrongLimit(), ENGINE_DETAILS_RESET_DELAY_MS);
            return;
          }
          warning.hidden = false;
          warning.textContent = ENGINE_DETAILS_WARNING_TEXT;
          warning.classList.remove('engine-details-warning-reset');
        }
        updateHint();
        if (revealedCorrectCount === correctTotal) nextBtn.disabled = false;
      });
      list.appendChild(item);
    });

    container.append(hint, warning, nextBtn);
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
  // та же 3-шаговая механика (медиа → Гуна → Детали), три клипа подряд в
  // перемешанном порядке. mediaKind различает только сам плеер.
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

    const allClips = data.clips || data.recordings;
    const saved = getTaskStepState(lessonKey, task.id);
    const savedClips =
      saved && Array.isArray(saved.order)
        ? saved.order.map((id) => allClips.find((c) => c.id === id)).filter(Boolean)
        : null;
    const clips = savedClips && savedClips.length === allClips.length ? savedClips : shuffle(allClips);
    let index = savedClips && savedClips.length === allClips.length ? Math.min(saved.index || 0, clips.length) : 0;
    setTaskStepState(lessonKey, task.id, { order: clips.map((c) => c.id), index });

    const showClip = () => {
      stage.innerHTML = '';
      progress.textContent = `${index + 1} из ${clips.length}`;
      const clip = clips[index];

      // Название фильма — только у видео-клипов (у аудио-монологов clip.title нет).
      if (clip.title) {
        const mediaTitle = document.createElement('p');
        mediaTitle.className = 'engine-media-title';
        mediaTitle.textContent = clip.title;
        stage.appendChild(mediaTitle);
      }

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

    // На шагах "Гуна"/"Причина"/"Детали" отрывок больше не виден — а
    // свериться с ним снова иногда правда нужно, не дожидаясь штрафа за
    // ошибки в деталях. Кнопка просто возвращает к тому же клипу
    // (index не меняется), без каких-либо потерь прогресса по заданию.
    const appendRewatchButton = (container) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'engine-rewatch-btn';
      btn.textContent = mediaKind === 'video' ? '↺ Пересмотреть отрывок' : '↺ Переслушать отрывок';
      btn.addEventListener('click', () => showClip());
      container.appendChild(btn);
    };

    // Клипы идут подряд с разными гунами — легко не заметить, что новый
    // клип уже про другую гуну, и потом не понимать, почему верный на
    // вид ответ на "Причина"/"Детали" на самом деле неверный. "Назад"
    // возвращает на один шаг — перечитать сам вопрос, а не весь отрывок
    // заново (для этого рядом есть отдельная "Пересмотреть отрывок").
    const appendBackButton = (container, onClick) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'engine-rewatch-btn';
      btn.textContent = '← Назад';
      btn.addEventListener('click', onClick);
      container.appendChild(btn);
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
        () => showStepC(clip)
      );
      appendRewatchButton(step);
    };

    const showStepC = (clip) => {
      stage.innerHTML = '';
      const label = document.createElement('p');
      label.className = 'engine-step-question';
      label.textContent = `Разбери детали — что подтверждает гуну «${clip.guna}»:`;
      stage.appendChild(label);

      const refText = clip.transcript ? `«${clip.transcript}»` : clip.source;
      if (refText) {
        const ref = document.createElement('p');
        ref.className = 'engine-transcript';
        ref.textContent = refText;
        stage.appendChild(ref);
      }

      appendBackButton(stage, () => showStepA(clip));
      appendRewatchButton(stage);

      renderDetailsReveal(
        stage,
        clip.details,
        () => {
          index += 1;
          if (index < clips.length) {
            setTaskStepState(lessonKey, task.id, { order: clips.map((c) => c.id), index });
            showClip();
          } else {
            clearTaskStepState(lessonKey, task.id);
            completeTask(lessonKey, task.id);
            reactToTaskComplete(lessonKey);
            rerenderCurrentLesson();
          }
        },
        // Штраф за слишком много ошибок — не пересобрать те же карточки на
        // месте, а вернуть к началу клипа, чтобы пересмотреть/переслушать
        // отрывок заново перед новой попыткой.
        () => showClip()
      );
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

    // Общая для всех планет подсказка (не дублируется в каждом introText):
    // детали на картинке мелкие, без внимательного разглядывания и
    // увеличения их легко пропустить.
    const zoomHint = document.createElement('p');
    zoomHint.className = 'quiz-intro';
    zoomHint.innerHTML = '<strong>Внимательно рассмотри картинку — нажми на неё, чтобы увеличить.</strong>';

    const progress = document.createElement('p');
    progress.className = 'quiz-progress';

    const stage = document.createElement('div');
    stage.className = 'engine-stage';

    wrap.append(intro, zoomHint, progress, stage);
    taskContentPanel.appendChild(wrap);

    const allCards = data.cards;
    const savedImg = getTaskStepState(lessonKey, task.id);
    const savedCards =
      savedImg && Array.isArray(savedImg.order)
        ? savedImg.order.map((id) => allCards.find((c) => c.id === id)).filter(Boolean)
        : null;
    const cards = savedCards && savedCards.length === allCards.length ? savedCards : shuffle(allCards);
    let index =
      savedCards && savedCards.length === allCards.length ? Math.min(savedImg.index || 0, cards.length) : 0;
    setTaskStepState(lessonKey, task.id, { order: cards.map((c) => c.id), index });

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
      label.textContent = `Разбери детали изображения — что подтверждает гуну «${card.guna}»:`;
      stage.appendChild(label);

      // Картинка на этом шаге больше не видна — можно вернуться и
      // посмотреть на неё снова, не дожидаясь штрафа за ошибки.
      const rewatchBtn = document.createElement('button');
      rewatchBtn.type = 'button';
      rewatchBtn.className = 'engine-rewatch-btn';
      rewatchBtn.textContent = '↺ Посмотреть картинку ещё раз';
      rewatchBtn.addEventListener('click', () => showCard());
      stage.appendChild(rewatchBtn);

      renderDetailsReveal(
        stage,
        card.details,
        () => {
          index += 1;
          if (index < cards.length) {
            setTaskStepState(lessonKey, task.id, { order: cards.map((c) => c.id), index });
            showCard();
          } else {
            clearTaskStepState(lessonKey, task.id);
            completeTask(lessonKey, task.id);
            reactToTaskComplete(lessonKey);
            rerenderCurrentLesson();
          }
        },
        // Штраф — вернуться к самой картинке, пересмотреть её заново.
        () => showCard()
      );
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

    // 1 ошибка — и заново: для зубрёжки наизусть даже одна ошибка должна
    // перезапускать весь набор фраз (не одну карточку — заданий тут мало,
    // отдельной карточки для повтора не выделить).
    const MAX_WRONG_PHRASES = 1;
    const PHRASE_RESET_TEXT = 'Ошибка — начинаем заново.';
    const PHRASE_RESET_DELAY_MS = 1400;

    let phrases = shuffle(data.phrases);
    let index = 0;
    let wrongCount = 0;
    let secondsLeft = data.timerSeconds;
    let finished = false;
    let timerId = null;

    const finish = () => {
      if (finished) return;
      finished = true;
      clearInterval(timerId);
      completeTask(lessonKey, task.id);
      reactToTaskComplete(lessonKey);
      rerenderCurrentLesson();
    };

    const startTimer = () => {
      clearInterval(timerId);
      secondsLeft = data.timerSeconds;
      timerEl.textContent = `Осталось: ${secondsLeft} сек`;
      timerId = setInterval(() => {
        secondsLeft -= 1;
        timerEl.textContent = `Осталось: ${Math.max(secondsLeft, 0)} сек`;
        if (secondsLeft <= 0) finish();
      }, 1000);
    };

    const restart = () => {
      phrases = shuffle(data.phrases);
      index = 0;
      wrongCount = 0;
      startTimer();
      showPhrase();
    };

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
            wrongCount += 1;
            buttons.querySelectorAll('.engine-choice-btn').forEach((b) => {
              if (b.textContent === phrases[index].guna) b.classList.add('engine-choice-correct');
            });
          }
          setTimeout(() => {
            if (wrongCount >= MAX_WRONG_PHRASES) {
              stage.innerHTML = `<p class="engine-details-warning engine-details-warning-reset">${PHRASE_RESET_TEXT}</p>`;
              setTimeout(restart, PHRASE_RESET_DELAY_MS);
              return;
            }
            index += 1;
            if (index < phrases.length) showPhrase();
            else finish();
          }, 650);
        });
        buttons.appendChild(btn);
      });
    };

    startTimer();
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

    const allQuestions = data.questions;

    // 1 ошибка — и весь набор вопросов заново (зазубрить наизусть, а не
    // угадать с подсказкой): та же логика перезапуска, что и в "Слово
    // гуны", просто здесь один вопрос из N, а не таймер на всё задание.
    const RESET_TEXT = 'Ошибка — начинаем заново.';
    const RESET_DELAY_MS = 1400;

    const start = () => {
      const questions = shuffle(allQuestions);
      let index = 0;
      setTaskStepState(lessonKey, task.id, { order: questions.map((q) => q.id), index });

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

            if (!opt.correct) {
              const warning = document.createElement('p');
              warning.className = 'engine-details-warning engine-details-warning-reset';
              warning.textContent = RESET_TEXT;
              stage.appendChild(warning);
              setTimeout(start, RESET_DELAY_MS);
              return;
            }

            const nextBtn = document.createElement('button');
            nextBtn.type = 'button';
            nextBtn.className = 'btn btn-primary engine-details-next';
            nextBtn.textContent = index === questions.length - 1 ? 'Завершить' : 'Дальше';
            nextBtn.addEventListener('click', () => {
              index += 1;
              if (index < questions.length) {
                setTaskStepState(lessonKey, task.id, { order: questions.map((q) => q.id), index });
                showQuestion();
              } else {
                clearTaskStepState(lessonKey, task.id);
                completeTask(lessonKey, task.id);
                reactToTaskComplete(lessonKey);
                rerenderCurrentLesson();
              }
            });
            stage.appendChild(nextBtn);
          });
        });
      };

      showQuestion();
    };

    start();
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
      'Собери карту звёздного покровителя: перетащи верную карточку на её место (или тапни карточку и категорию — в любом порядке). Среди карточек есть и чужие — ответы других планет.';

    const categoriesEl = document.createElement('div');
    categoriesEl.className = 'map-match-categories';

    const poolEl = document.createElement('div');
    poolEl.className = 'map-match-pool';

    // Плашка с текстом текущего выбора — чтобы не терять его из виду,
    // пока ищешь нужную категорию среди восьми.
    const selectedIndicator = document.createElement('div');
    selectedIndicator.className = 'map-match-selected-indicator';
    selectedIndicator.hidden = true;

    // Сначала все 8 категорий (что нужно заполнить), потом пул карточек
    // (откуда выбирать) — обзор задачи целиком перед тем, как нырять в
    // сам пул.
    wrap.append(intro, categoriesEl, selectedIndicator, poolEl);
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
    // Можно выбрать сначала карточку, потом категорию — или наоборот,
    // сначала категорию, потом карточку. selectedUid и selectedCategoryId
    // взаимоисключающие: как только выбрано и то, и другое, пара тут же
    // проверяется через attemptPlace, а не ждёт отдельного действия.
    let selectedUid = null;
    let selectedCategoryId = null;
    const cardEls = {};
    const slotEls = {};

    const clearSelection = () => {
      selectedUid = null;
      selectedCategoryId = null;
      Object.values(cardEls).forEach((el) => el.classList.remove('map-match-card-selected'));
      Object.values(slotEls).forEach((el) => el.classList.remove('map-match-slot-selected'));
      selectedIndicator.hidden = true;
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
          reactToTaskComplete(lessonKey);
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
        if (filled.has(cat.id)) return;
        if (selectedUid) {
          // Карточка уже выбрана снизу — тап по категории завершает пару.
          attemptPlace(selectedUid, cat.id);
          return;
        }
        if (selectedCategoryId === cat.id) {
          clearSelection();
          return;
        }
        // Ничего ещё не выбрано — тап по категории запоминает её первой,
        // следующий тап по карточке в пуле завершит пару.
        clearSelection();
        selectedCategoryId = cat.id;
        slot.classList.add('map-match-slot-selected');
        selectedIndicator.textContent = `Выбрана категория: ${cat.label}`;
        selectedIndicator.hidden = false;
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
        if (selectedCategoryId) {
          // Категория уже выбрана сверху — тап по карточке завершает пару.
          attemptPlace(card.uid, selectedCategoryId);
          return;
        }
        if (selectedUid === card.uid) {
          clearSelection();
          return;
        }
        clearSelection();
        selectedUid = card.uid;
        el.classList.add('map-match-card-selected');
        selectedIndicator.textContent = `Выбрано: ${card.text}`;
        selectedIndicator.hidden = false;
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

    // Раунд завершает задание сразу по факту прохождения последнего шага —
    // без отдельного экрана-подтверждения со своей кнопкой: итоговое
    // сообщение (data.finalMessage) и так показывается следом, уже через
    // общий блок "✓ выполнено" (TASK_COMPLETED_FEEDBACK.task_gunas в
    // taskContent.js), и повторно дублировать его здесь же, с лишним
    // кликом между двумя одинаковыми текстами, было ни к чему — так же,
    // как ведут себя остальные однораундовые задания ("Пять мостов" и т.п.).
    const finishTask = () => {
      completeTask(lessonKey, task.id);
      reactToTaskComplete(lessonKey);
      rerenderCurrentLesson();
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

      // Сначала сами реакции (что сортируем), потом зоны-гуны (куда) — на
      // мобильном, где зоны идут одна под другой на всю ширину, обратный
      // порядок (сперва три высокие пустые зоны, а сами карточки только
      // после долгого скролла) сбивал с толку.
      stage.append(poolEl, zonesEl);

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
            setTimeout(index < rounds.length ? showRound : finishTask, 700);
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

  // --- "Экзамен Шивы" (Граха-таттва-джня): не входит в список заданий
  // планеты. После Кету идёт только кат-сцена (см.
  // reactToTaskComplete/showShivaMoment), которая ничего не открывает —
  // она лишь обновляет статус кнопки входа (см. updateShivaExamBadge, ниже
  // по файлу, и #shivaExamBadge в village.html — фиксированный элемент
  // вне карты, не зависит от тумана/облаков). Вход в сам экзамен —
  // openRelationshipsExam, свой список из 6 раундов в обход
  // openLesson/computeTaskStatuses. Контент — relationshipsTaskContent.js,
  // единственный источник которого презентация "Соединения.pptx" (слайды
  // 1–19).

  const renderRelPairHeader = (container, fromId, toId) => {
    const wrap = document.createElement('div');
    wrap.className = 'rel-pair-header';
    const fromChar = MOKSHA_CHARACTERS.find((c) => c.id === fromId);
    const toChar = MOKSHA_CHARACTERS.find((c) => c.id === toId);
    const makePortrait = (ch) => {
      const box = document.createElement('div');
      box.className = 'rel-pair-portrait';
      const img = document.createElement('img');
      img.src = ch.file;
      img.alt = ch.title;
      const name = document.createElement('div');
      name.className = 'rel-pair-name';
      name.textContent = ch.title;
      box.append(img, name);
      return box;
    };
    const arrow = document.createElement('div');
    arrow.className = 'rel-pair-arrow';
    arrow.textContent = '→';
    wrap.append(makePortrait(fromChar), arrow, makePortrait(toChar));
    container.appendChild(wrap);
  };

  // Штраф — тот же принцип, что и везде в игре (task_2, task_gunas,
  // engine_details): слишком много ошибок подряд в одном заходе на
  // раунд — раунд пересобирается заново (новая выборка/тасовка), а не
  // засчитывается как провал навсегда.
  const REL_ROUND_MAX_WRONG = 3;
  const REL_ROUND_RESET_TEXT = 'Слишком много ошибок в этом раунде — начнём его заново.';
  const REL_ROUND_RESET_DELAY_MS = 1400;

  // feedbackEl показывает сообщение о пересборке, restartFn пересобирает
  // раунд с нуля (новая выборка пар/раундов). Возвращает onWrong —
  // подключается к renderChoiceButtons или дёргается вручную. maxWrong —
  // необязательный лимит ошибок для конкретного раунда (по умолчанию
  // REL_ROUND_MAX_WRONG=3, как у остальных раундов экзамена).
  const createRoundPenalty = (feedbackEl, restartFn, warningClass, maxWrong = REL_ROUND_MAX_WRONG) => {
    let wrongCount = 0;
    return () => {
      wrongCount += 1;
      if (wrongCount >= maxWrong) {
        wrongCount = 0;
        if (feedbackEl) {
          feedbackEl.hidden = false;
          feedbackEl.textContent = REL_ROUND_RESET_TEXT;
          if (warningClass) feedbackEl.classList.add(warningClass);
        }
        setTimeout(restartFn, REL_ROUND_RESET_DELAY_MS);
      }
    };
  };

  // Раунд 1 "Кто кому друг?" — по каждой сэмплированной паре спрашиваем
  // оба направления отдельно, обратное не подставляется автоматически
  // (слайды 8, 11, 13–14: отношения не всегда взаимны).
  const REL_ROUND1_SIZE = 5;

  const renderRelDirectionRound = (stage, goNext) => {
    const intro = document.createElement('p');
    intro.className = 'quiz-intro';
    intro.textContent =
      'Для каждой пары планет определи отношение — сначала в одну сторону, потом отдельно в обратную. Отношения не всегда взаимны.';
    stage.appendChild(intro);

    const feedback = document.createElement('p');
    feedback.className = 'flower-feedback';
    feedback.hidden = true;
    stage.appendChild(feedback);

    const body = document.createElement('div');
    body.className = 'rel-round-body';
    stage.appendChild(body);

    const start = () => {
      feedback.hidden = true;
      const pairs = shuffle(REL_UNORDERED_PAIRS).slice(0, REL_ROUND1_SIZE);
      const steps = [];
      pairs.forEach(([a, b]) => {
        const [first, second] = Math.random() < 0.5 ? [a, b] : [b, a];
        steps.push({ fromId: first, toId: second });
        steps.push({ fromId: second, toId: first });
      });

      const onWrong = createRoundPenalty(feedback, start, 'flower-feedback-warning');
      let idx = 0;
      const showStep = () => {
        body.innerHTML = '';
        if (idx >= steps.length) {
          goNext();
          return;
        }
        const { fromId, toId } = steps[idx];
        const header = document.createElement('div');
        renderRelPairHeader(header, fromId, toId);
        body.appendChild(header);

        const correct = relOf(fromId, toId);
        const options = shuffle(['friend', 'enemy', 'neutral']).map((rel) => ({
          text: REL_LABELS[rel],
          correct: rel === correct,
        }));

        const qWrap = document.createElement('div');
        qWrap.className = 'rel-question-wrap';
        body.appendChild(qWrap);
        renderChoiceButtons(
          qWrap,
          'Как первая граха (слева) относится ко второй (справа)?',
          options,
          () => {
            idx += 1;
            showStep();
          },
          false,
          onWrong,
        );
      };

      showStep();
    };

    start();
  };

  // Раунд 2 "Почему такое отношение?" — объяснение должно соответствовать
  // именно указанному направлению (слайды 4, 12–19).
  const REL_ROUND2_SIZE = 5;

  // Раунд 2: один вопрос, три варианта — правильный текст плюс два
  // отвлекающих, которые называют только одну из двух показанных планет
  // (без упоминания третьей по имени, регистронезависимо), чтобы вариант
  // всегда реально относился к спрошенной паре.
  const REL_ALL_REASON_ENTRIES = [];
  REL_PLANETS.forEach((p) => {
    REL_PLANETS.forEach((q) => {
      if (p !== q) REL_ALL_REASON_ENTRIES.push({ fromId: p, toId: q, ...REL_REASON[p][q] });
    });
  });

  // Третий вариант — не текст про другую пару (в презентации для точно
  // этих двух планет и без того есть только сам текст + обратное
  // направление), а содержательная ошибка другого типа: неверно назван
  // сам характер отношения (перепутаны дружба/вражда/нейтральность).
  // Называет только те же две планеты, что в вопросе, ничего не
  // придумывает сверх уже известного из таблицы (REL_TABLE).
  const REL_WRONG_MECHANISM_TEXT = {
    friend: (fromSub, toSub) => `${toSub} и ${fromSub} здесь не поддерживают друг друга — скорее мешают, как враги.`,
    enemy: (fromSub, toSub) => `${toSub} и ${fromSub} здесь ладят и поддерживают друг друга, как близкие друзья.`,
    neutral: (fromSub, toSub) =>
      `${toSub} и ${fromSub} здесь либо крепко дружат, либо открыто враждуют — нейтральности тут нет.`,
  };

  const renderRelReasonRound = (stage, goNext) => {
    const intro = document.createElement('p');
    intro.className = 'quiz-intro';
    intro.textContent = 'Отношение уже известно. Выбери объяснение, которое подходит именно этому направлению.';
    stage.appendChild(intro);

    const feedback = document.createElement('p');
    feedback.className = 'flower-feedback';
    feedback.hidden = true;
    stage.appendChild(feedback);

    const body = document.createElement('div');
    body.className = 'rel-round-body';
    stage.appendChild(body);

    // Полные предложения почти всегда называют по имени обе стороны своей
    // СОБСТВЕННОЙ пары — "упоминает хотя бы одну из двух спрошенных планет"
    // пропускало фразы вроде "Юпитер и Меркурий..." для пары Юпитер/Луна:
    // Юпитер там есть, но по факту это ответ про другую пару целиком.
    // Единственный вариант, который гарантированно и только про ЭТИ две
    // планеты — обратное направление той же пары. Второй вариант берём,
    // только если он ТОЖЕ называет исключительно эти две планеты (ни одной
    // третьей); если такого нет — вопрос честно остаётся с двумя
    // вариантами вместо трёх (то же "менять форму проверки", когда третий
    // однозначный вариант физически неоткуда взять).
    const pickTextDistractors = (fromId, toId, correctText, count) => {
      const fromRoot = REL_NAME_ROOTS[fromId].toLowerCase();
      const toRoot = REL_NAME_ROOTS[toId].toLowerCase();
      const otherRoots = REL_PLANETS.filter((p) => p !== fromId && p !== toId).map((p) => REL_NAME_ROOTS[p].toLowerCase());
      const mentionsOnlyThisPair = (v) => {
        const low = v.toLowerCase();
        return (low.includes(fromRoot) || low.includes(toRoot)) && !otherRoots.some((root) => low.includes(root));
      };

      const candidates = [
        ...new Set(
          REL_ALL_REASON_ENTRIES.filter((e) => e.text !== correctText && mentionsOnlyThisPair(e.text)).map((e) => e.text),
        ),
      ];
      return shuffle(candidates).slice(0, count);
    };

    const start = () => {
      feedback.hidden = true;
      const pool = shuffle(REL_DIRECTED_PAIRS).slice(0, REL_ROUND2_SIZE);
      const onWrong = createRoundPenalty(feedback, start, 'flower-feedback-warning');
      let idx = 0;
      const showStep = () => {
        body.innerHTML = '';
        if (idx >= pool.length) {
          goNext();
          return;
        }
        const { fromId, toId, relation } = pool[idx];
        const fromChar = MOKSHA_CHARACTERS.find((c) => c.id === fromId);

        const header = document.createElement('div');
        renderRelPairHeader(header, fromId, toId);
        body.appendChild(header);

        const question = document.createElement('p');
        question.className = 'rel-round-title';
        question.textContent = `Почему ${fromChar.title} считает ${REL_ACCUSATIVE[toId]} ${REL_RELATION_WORD(relation, toId)}?`;
        body.appendChild(question);

        const toChar = MOKSHA_CHARACTERS.find((c) => c.id === toId);
        const entry = REL_REASON[fromId][toId];
        const isMythPair = (fromId === 'chandra' && toId === 'budha') || (fromId === 'budha' && toId === 'chandra');

        const wrongMechanismText = REL_WRONG_MECHANISM_TEXT[relation](fromChar.title, toChar.title);
        const options = shuffle([
          { text: entry.text, correct: true },
          ...pickTextDistractors(fromId, toId, entry.text, 1).map((t) => ({ text: t, correct: false })),
          { text: wrongMechanismText, correct: false },
        ]);

        const qWrap = document.createElement('div');
        qWrap.className = 'rel-question-wrap';
        body.appendChild(qWrap);
        renderChoiceButtons(
          qWrap,
          '',
          options,
          () => {
            if (isMythPair) {
              const note = document.createElement('p');
              note.className = 'rel-myth-note';
              note.textContent = REL_MYTH_KEY.budha;
              body.appendChild(note);
              setTimeout(() => {
                idx += 1;
                showStep();
              }, 2600);
            } else {
              idx += 1;
              showStep();
            }
          },
          true,
          onWrong,
        );
      };

      showStep();
    };

    start();
  };

  // Раунд 3 "Что меняется?" — единственная пара с явно подтверждённым
  // множественным воздействием (слайд 5, повтор на слайде 9): Сатурн ↔
  // Юпитер, в обе стороны по-разному влияют на разные качества.
  const renderRelImpactRound = (stage, goNext) => {
    const intro = document.createElement('p');
    intro.className = 'quiz-intro';
    intro.textContent = 'Одна граха может по-разному воздействовать на качества партнёра. Разнеси качества по типам воздействия.';
    stage.appendChild(intro);

    const feedback = document.createElement('p');
    feedback.className = 'engine-details-warning';
    feedback.hidden = true;
    stage.appendChild(feedback);

    const body = document.createElement('div');
    body.className = 'rel-round-body';
    stage.appendChild(body);

    const start = () => {
      feedback.hidden = true;
      const cases = REL_IMPACT_CASES;
      const onWrong = createRoundPenalty(feedback, start);
      let caseIdx = 0;

      const showCase = () => {
      body.innerHTML = '';
      feedback.hidden = true;
      if (caseIdx >= cases.length) {
        goNext();
        return;
      }
      const c = cases[caseIdx];

      const header = document.createElement('div');
      renderRelPairHeader(header, c.fromId, c.toId);
      body.appendChild(header);

      const caseIntro = document.createElement('p');
      caseIntro.className = 'engine-step-question';
      caseIntro.textContent = c.intro;
      body.appendChild(caseIntro);

      const zonesEl = document.createElement('div');
      zonesEl.className = 'rel-impact-zones';
      const poolEl = document.createElement('div');
      poolEl.className = 'map-match-pool';
      body.append(poolEl, zonesEl);

      const filled = new Set();
      let selectedUid = null;
      const cardEls = {};
      const slotEls = {};
      const cards = c.cards.map((card, i) => ({ uid: `c${i}`, text: card.text, impact: card.impact }));

      const clearSelection = () => {
        selectedUid = null;
        Object.values(cardEls).forEach((el) => el.classList.remove('map-match-card-selected'));
      };

      const attemptPlace = (uid, zoneId) => {
        if (!uid || !cardEls[uid]) return;
        const card = cards.find((cc) => cc.uid === uid);
        if (card.impact === zoneId) {
          filled.add(zoneId);
          const slot = slotEls[zoneId];
          slot.classList.add('map-match-slot-filled');
          // Зона может принять несколько верных карточек подряд — каждая
          // добавляет свою строку, а не перезаписывает предыдущую.
          const valueEl = document.createElement('div');
          valueEl.className = 'map-match-slot-value';
          slot.querySelector('.map-match-slot-values').appendChild(valueEl);
          valueEl.textContent = card.text;
          cardEls[uid].remove();
          delete cardEls[uid];
          clearSelection();
          feedback.hidden = true;
          if (Object.keys(cardEls).length === 0) {
            setTimeout(() => {
              caseIdx += 1;
              showCase();
            }, 700);
          }
        } else {
          const slot = slotEls[zoneId];
          slot.classList.remove('map-match-slot-shake');
          // eslint-disable-next-line no-void
          void slot.offsetWidth;
          slot.classList.add('map-match-slot-shake');
          clearSelection();
          feedback.hidden = false;
          feedback.textContent = 'Не тот тип воздействия — вспомни определение и попробуй снова.';
          onWrong();
        }
      };

      REL_IMPACT_TYPES.forEach((zone) => {
        const slot = document.createElement('div');
        slot.className = 'map-match-slot';
        const label = document.createElement('div');
        label.className = 'map-match-slot-label';
        label.textContent = zone.label;
        const hint = document.createElement('div');
        hint.className = 'rel-impact-zone-desc';
        hint.textContent = zone.desc;
        const values = document.createElement('div');
        values.className = 'map-match-slot-values';
        slot.append(label, hint, values);

        slot.addEventListener('dragover', (e) => {
          e.preventDefault();
          slot.classList.add('map-match-slot-hover');
        });
        slot.addEventListener('dragleave', () => slot.classList.remove('map-match-slot-hover'));
        slot.addEventListener('drop', (e) => {
          e.preventDefault();
          slot.classList.remove('map-match-slot-hover');
          attemptPlace(e.dataTransfer.getData('text/plain'), zone.id);
        });
        slot.addEventListener('click', () => {
          if (!selectedUid) return;
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

      showCase();
    };

    start();
  };

  // Раунд 4 "Как проявляется союз?" — конфликт рождает новую способность
  // (слайды 4, 7, 12–19), два экрана по три пары — сопоставление клик-клик,
  // с автопереходом на следующий экран после верных трёх пар.
  const renderRelUnionRound = (stage, goNext) => {
    const intro = document.createElement('p');
    intro.className = 'quiz-intro';
    intro.textContent =
      'В соединении качества грах взаимодействуют и создают общий способ проявления. Соедини пару грах с тем, что рождается из их взаимодействия.';
    stage.appendChild(intro);

    const feedback = document.createElement('p');
    feedback.className = 'flower-feedback';
    feedback.hidden = true;
    stage.appendChild(feedback);

    const body = document.createElement('div');
    body.className = 'rel-round-body';
    stage.appendChild(body);

    const start = () => {
      feedback.hidden = true;
      const screens = REL_UNION_SCREENS;
      const onWrong = createRoundPenalty(feedback, start, 'flower-feedback-warning');
      let screenIdx = 0;

      const showScreen = () => {
        body.innerHTML = '';
        feedback.hidden = true;
        if (screenIdx >= screens.length) {
          goNext();
          return;
        }
        const screen = screens[screenIdx];
        const cases = Array.isArray(screen) ? screen : screen.cases;
        const screenIntro = Array.isArray(screen) ? null : screen.intro;

        if (screenIntro) {
          const screenIntroEl = document.createElement('p');
          screenIntroEl.className = 'quiz-intro';
          screenIntroEl.textContent = screenIntro;
          body.appendChild(screenIntroEl);
        }

        const columns = document.createElement('div');
        columns.className = 'rel-match-columns';

        const leftGroup = document.createElement('div');
        leftGroup.className = 'rel-match-group';
        const leftHeading = document.createElement('div');
        leftHeading.className = 'rel-match-group-heading';
        leftHeading.textContent = 'Пара грах';
        const leftCol = document.createElement('div');
        leftCol.className = 'rel-match-col rel-match-col-pair';
        leftGroup.append(leftHeading, leftCol);

        const rightGroup = document.createElement('div');
        rightGroup.className = 'rel-match-group';
        const rightHeading = document.createElement('div');
        rightHeading.className = 'rel-match-group-heading';
        rightHeading.textContent = 'Что рождается';
        const rightCol = document.createElement('div');
        rightCol.className = 'rel-match-col rel-match-col-result';
        rightGroup.append(rightHeading, rightCol);

        columns.append(leftGroup, rightGroup);
        body.appendChild(columns);

        const leftOrder = shuffle(cases.map((c, i) => i));
        const rightOrder = shuffle(cases.map((c, i) => i));

        const matched = new Set();
        let selected = null;

        const trySelect = (side, i, el) => {
          if (!selected) {
            selected = { i, el, side };
            el.classList.add('rel-match-item-selected');
            return;
          }
          if (selected.side === side) {
            selected.el.classList.remove('rel-match-item-selected');
            selected = { i, el, side };
            el.classList.add('rel-match-item-selected');
            return;
          }
          const leftSel = side === 'left' ? { i, el } : selected;
          const rightSel = side === 'right' ? { i, el } : selected;
          selected.el.classList.remove('rel-match-item-selected');
          selected = null;

          if (leftSel.i === rightSel.i) {
            matched.add(leftSel.i);
            leftSel.el.classList.add('rel-match-item-correct');
            rightSel.el.classList.add('rel-match-item-correct');
            if (matched.size === cases.length) {
              setTimeout(() => {
                screenIdx += 1;
                showScreen();
              }, 700);
            }
          } else {
            [leftSel.el, rightSel.el].forEach((el2) => {
              el2.classList.remove('rel-match-item-wrong');
              // eslint-disable-next-line no-void
              void el2.offsetWidth;
              el2.classList.add('rel-match-item-wrong');
            });
            onWrong();
          }
        };

        leftOrder.forEach((i) => {
          const c = cases[i];
          const el = document.createElement('button');
          el.type = 'button';
          el.className = 'rel-match-item';
          el.textContent = c.label;
          el.addEventListener('click', () => {
            if (matched.has(i)) return;
            trySelect('left', i, el);
          });
          leftCol.appendChild(el);
        });

        rightOrder.forEach((i) => {
          const c = cases[i];
          const el = document.createElement('button');
          el.type = 'button';
          el.className = 'rel-match-item';
          el.textContent = c.manifestation;
          el.addEventListener('click', () => {
            if (matched.has(i)) return;
            trySelect('right', i, el);
          });
          rightCol.appendChild(el);
        });
      };

      showScreen();
    };

    start();
  };

  // Раунд 5 "Нейтральность и влияние" — нейтральное отношение не значит
  // "ничего не происходит" (слайды 8, 15, 17–19).
  const renderRelNeutralRound = (stage, goNext) => {
    const intro = document.createElement('p');
    intro.className = 'quiz-intro';
    intro.textContent = 'Нейтральность — не отсутствие влияния. Определи, кто здесь влияет на кого.';
    stage.appendChild(intro);

    const feedback = document.createElement('p');
    feedback.className = 'flower-feedback';
    feedback.hidden = true;
    stage.appendChild(feedback);

    const body = document.createElement('div');
    body.className = 'rel-round-body';
    stage.appendChild(body);

    const start = () => {
      feedback.hidden = true;
      const items = shuffle(REL_NEUTRAL_CASES);
      // По просьбе — тут лимит строже, чем у остальных раундов: 2 ошибки
      // вместо стандартных 3.
      const onWrong = createRoundPenalty(feedback, start, 'flower-feedback-warning', 2);
      let idx = 0;

      const showStep = () => {
        body.innerHTML = '';
        if (idx >= items.length) {
          goNext();
          return;
        }
        const item = items[idx];
        const fromChar = MOKSHA_CHARACTERS.find((c) => c.id === item.fromId);
        const toChar = MOKSHA_CHARACTERS.find((c) => c.id === item.toId);

        const label = document.createElement('p');
        label.className = 'engine-step-question';
        label.textContent = item.pairLabel;
        body.appendChild(label);

        const card = document.createElement('p');
        card.className = 'engine-transcript';
        card.textContent = `«${item.text}»`;
        body.appendChild(card);

        const options = shuffle([
          { text: `${fromChar.title} → ${toChar.title}`, correct: true },
          { text: `${toChar.title} → ${fromChar.title}`, correct: false },
        ]);

        const qWrap = document.createElement('div');
        qWrap.className = 'rel-question-wrap';
        body.appendChild(qWrap);
        renderChoiceButtons(
          qWrap,
          'Кто здесь влияет на кого?',
          options,
          () => {
            idx += 1;
            showStep();
          },
          false,
          onWrong,
        );
      };

      showStep();
    };

    start();
  };

  // Раунд 6 "Раху и Кету" — общий характер воздействия узлов при
  // соединении (без таблицы друг/враг и без конкретных планет, слайд 19).
  // 4 экрана (по 2 на узел): портрет узла, вопрос, три варианта — выбор
  // без цветовой подсказки, затем "Проверить" вскрывает верный (и
  // неверный, если выбран не он) вариант и показывает объяснение,
  // "Далее"/"Завершить" ведёт к следующему экрану. Ни ограничения на
  // ошибки, ни пересборки раунда здесь нет — по ТЗ это разбор, а не
  // экзамен на попытки.
  const renderRelNodesRound = (stage, goNext) => {
    const showIntro = () => {
      stage.innerHTML = '';
      const intro = document.createElement('p');
      intro.className = 'quiz-intro';
      intro.textContent = REL_NODES_INTRO;
      stage.appendChild(intro);

      const startBtn = document.createElement('button');
      startBtn.type = 'button';
      startBtn.className = 'btn btn-primary';
      startBtn.textContent = 'Начать';
      startBtn.addEventListener('click', () => showRound(0));
      stage.appendChild(startBtn);
    };

    const showRound = (roundIdx) => {
      stage.innerHTML = '';
      if (roundIdx >= REL_NODES_ROUNDS.length) {
        goNext();
        return;
      }
      const round = REL_NODES_ROUNDS[roundIdx];
      const char = MOKSHA_CHARACTERS.find((c) => c.id === round.node);
      const indexInNode = (roundIdx % 2) + 1;

      const progress = document.createElement('p');
      progress.className = 'quiz-progress';
      progress.textContent = `${char.title} · ${indexInNode} из 2`;
      stage.appendChild(progress);

      const portrait = document.createElement('div');
      portrait.className = 'rel-pair-portrait';
      const img = document.createElement('img');
      img.src = char.file;
      img.alt = char.title;
      const name = document.createElement('div');
      name.className = 'rel-pair-name';
      name.textContent = char.title;
      portrait.append(img, name);
      stage.appendChild(portrait);

      if (round.situation) {
        const situationEl = document.createElement('p');
        situationEl.className = 'engine-transcript';
        situationEl.textContent = round.situation;
        stage.appendChild(situationEl);
      }

      const questionEl = document.createElement('p');
      questionEl.className = 'engine-step-question';
      questionEl.textContent = round.question;
      stage.appendChild(questionEl);

      const listEl = document.createElement('div');
      listEl.className = 'engine-choice-list engine-choice-list-vertical';
      stage.appendChild(listEl);

      const options = shuffle(round.options);
      const optionEls = {};
      let selectedId = null;
      let checked = false;

      const checkBtn = document.createElement('button');
      checkBtn.type = 'button';
      checkBtn.className = 'btn btn-primary';
      checkBtn.textContent = 'Проверить';
      checkBtn.disabled = true;

      const explanationEl = document.createElement('p');
      explanationEl.className = 'rel-myth-note';
      explanationEl.hidden = true;
      explanationEl.textContent = round.explanation;

      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'btn btn-primary engine-details-next';
      nextBtn.hidden = true;
      nextBtn.textContent = roundIdx === REL_NODES_ROUNDS.length - 1 ? 'Завершить' : 'Далее';
      nextBtn.addEventListener('click', () => showRound(roundIdx + 1));

      options.forEach((opt) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'engine-choice-btn';
        btn.textContent = opt.text;
        btn.addEventListener('click', () => {
          if (checked) return;
          selectedId = opt.id;
          Object.values(optionEls).forEach((el) => el.classList.remove('engine-choice-selected'));
          btn.classList.add('engine-choice-selected');
          checkBtn.disabled = false;
        });
        optionEls[opt.id] = btn;
        listEl.appendChild(btn);
      });

      checkBtn.addEventListener('click', () => {
        if (checked || !selectedId) return;
        checked = true;
        checkBtn.hidden = true;
        options.forEach((opt) => {
          const el = optionEls[opt.id];
          el.classList.remove('engine-choice-selected');
          if (opt.correct) el.classList.add('engine-choice-correct');
          else if (opt.id === selectedId) el.classList.add('engine-choice-wrong');
        });
        explanationEl.hidden = false;
        nextBtn.hidden = false;
      });

      stage.append(checkBtn, explanationEl, nextBtn);
    };

    showIntro();
  };

  // Экзамен Шивы: 6 раундов — теперь 6 независимых, отдельно завершаемых
  // и переигрываемых подзаданий (как обычные задания планеты), а не один
  // сплошной проход. Каждый пройденный раунд остаётся доступным для
  // повтора; следующий раунд открывается после предыдущего (первый
  // проход — по порядку, как и задумано ТЗ), но повторное прохождение уже
  // открытых раундов ничего не блокирует и не переупорядочивает.
  const REL_ROUNDS = [
    { key: 'direction', id: 'round_direction', title: '1. Кто кому друг?' },
    { key: 'reason', id: 'round_reason', title: '2. Почему такое отношение?' },
    { key: 'impact', id: 'round_impact', title: '3. Что меняется?' },
    { key: 'union', id: 'round_union', title: '4. Как проявляется союз?' },
    { key: 'neutral', id: 'round_neutral', title: '5. Нейтральность и влияние' },
    { key: 'nodes', id: 'round_nodes', title: '6. Раху и Кету' },
  ];

  const REL_ROUND_RENDERERS = {
    direction: renderRelDirectionRound,
    reason: renderRelReasonRound,
    impact: renderRelImpactRound,
    union: renderRelUnionRound,
    neutral: renderRelNeutralRound,
    nodes: renderRelNodesRound,
  };

  const getRelRoundStatus = (i, progress) => {
    if (progress[REL_ROUNDS[i].id]) return 'completed';
    if (i === 0) return 'unlocked';
    return progress[REL_ROUNDS[i - 1].id] ? 'unlocked' : 'locked';
  };

  // Церемония после последнего раунда экзамена: тапаемая последовательность
  // из 3 экранов на затемнённой подложке — поздравление (с фейерверком),
  // артефакт, новый статус. Артефакта своей картинки в проекте нет — вместо
  // неё крупный эмодзи-символ печати (.graduation-artifact-icon).
  const GRADUATION_STEPS = [
    {
      heading: 'Экзамен пройден!',
      text: 'Ты постиг связи между планетами — дружбу, вражду и то, что скрыто за нейтральностью. Настало время признать твоё знание.',
    },
    {
      heading: 'Наваграха-янтра',
      icon: '🔯',
      text: 'Шива вручает тебе Наваграха-янтру — печать с девятью гранями. В ней Сурья, Чандра, Мангала, Буддха, Гуру, Шукра, Шани, Раху и Кету — не по одиночке, а в движении друг к другу, как ты теперь умеешь их видеть.',
    },
    {
      heading: 'Новый статус получен',
      badgeText: 'Граха-таттва-гья',
      text: 'Отныне твой статус — Граха-таттва-гья, познавший природу планет. Обитель Богов открыта тебе полностью.',
    },
  ];

  const spawnGraduationFireworks = (container) => {
    const colors = ['#ffce54', '#ff7043', '#7ee787', '#64b5f6', '#f48fb1', '#ba68c8'];
    const burstCenters = [
      { x: 25, y: 30 },
      { x: 70, y: 22 },
      { x: 50, y: 42 },
      { x: 82, y: 55 },
      { x: 15, y: 58 },
    ];
    burstCenters.forEach((center, burstIdx) => {
      for (let i = 0; i < 10; i += 1) {
        const angle = (Math.PI * 2 * i) / 10;
        const distance = 60 + Math.random() * 40;
        const spark = document.createElement('div');
        spark.className = 'graduation-spark';
        spark.style.setProperty('--gx', `${center.x}vw`);
        spark.style.setProperty('--gy', `${center.y}vh`);
        spark.style.setProperty('--gdx', `${Math.cos(angle) * distance}px`);
        spark.style.setProperty('--gdy', `${Math.sin(angle) * distance}px`);
        spark.style.setProperty('--gcolor', colors[(burstIdx + i) % colors.length]);
        spark.style.setProperty('--gdelay', `${burstIdx * 0.25}s`);
        container.appendChild(spark);
      }
    });
  };

  const showGraduationCeremony = (onDone) => {
    const overlay = document.createElement('div');
    overlay.className = 'transition-overlay';
    document.body.appendChild(overlay);
    // eslint-disable-next-line no-void
    void overlay.offsetWidth;
    overlay.classList.add('transition-overlay-visible');

    const fireworks = document.createElement('div');
    fireworks.className = 'graduation-fireworks';
    document.body.appendChild(fireworks);
    spawnGraduationFireworks(fireworks);

    const card = document.createElement('div');
    card.className = 'graduation-card';
    document.body.appendChild(card);

    const cleanup = () => {
      overlay.classList.remove('transition-overlay-visible');
      setTimeout(() => overlay.remove(), 600);
      fireworks.remove();
      card.remove();
      onDone();
    };

    let stepIdx = 0;
    const showStep = () => {
      card.innerHTML = '';
      const step = GRADUATION_STEPS[stepIdx];

      if (step.icon) {
        const iconEl = document.createElement('div');
        iconEl.className = 'graduation-artifact-icon';
        iconEl.textContent = step.icon;
        card.appendChild(iconEl);
      } else {
        const img = document.createElement('img');
        img.src = 'assets/prologue/shiva.png';
        img.alt = 'Шива';
        card.appendChild(img);
      }

      const heading = document.createElement('h3');
      heading.textContent = step.heading;
      card.appendChild(heading);

      if (step.badgeText) {
        const badge = document.createElement('div');
        badge.className = 'graduation-status-badge';
        badge.textContent = step.badgeText;
        card.appendChild(badge);
      }

      const text = document.createElement('p');
      text.textContent = step.text;
      card.appendChild(text);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-primary';
      const isLast = stepIdx === GRADUATION_STEPS.length - 1;
      btn.textContent = isLast ? 'Вернуться в деревню' : 'Далее';
      btn.addEventListener('click', () => {
        if (isLast) {
          cleanup();
        } else {
          stepIdx += 1;
          showStep();
        }
      });
      card.appendChild(btn);
    };

    showStep();
  };

  const renderRelExamList = () => {
    const progress = getTaskProgress('relationships');
    detailRoot.innerHTML = '';

    const headingEl = document.createElement('h3');
    headingEl.textContent = 'Обитель Богов · Экзамен Шивы';

    const list = document.createElement('div');
    list.className = 'task-list';

    REL_ROUNDS.forEach((round, i) => {
      const status = getRelRoundStatus(i, progress);
      const item = document.createElement('div');
      item.className = `task-item status-${status}`;
      if (status === 'locked') item.classList.add('locked');
      if (status === 'completed') item.classList.add('completed');
      if (relActiveRoundIndex === i) item.classList.add('active');

      const icon = document.createElement('div');
      icon.className = 'task-icon';
      icon.textContent = status === 'completed' ? '✓' : '⚡';

      const meta = document.createElement('div');
      const statusText = status === 'completed' ? 'Выполнено' : status === 'unlocked' ? 'Доступно' : 'Закрыто';
      meta.innerHTML = `<div class="task-title">${round.title}</div><div class="task-status">${statusText}</div>`;

      item.append(icon, meta);

      if (status !== 'locked') {
        item.addEventListener('click', () => {
          relActiveRoundIndex = i;
          renderRelExamList();
          renderRelRoundContent(i);
          taskContentPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }

      list.appendChild(item);
    });

    detailRoot.append(headingEl, list);
  };

  // forcePlay=true всегда реально запускает раунд заново (кнопка "Пройти
  // ещё раз"); без него, если раунд уже отмечен выполненным, сразу
  // показываем экран "✓ выполнено" вместо того, чтобы молча пересобирать
  // раунд — раньше клик по уже пройденному раунду из списка выглядел так,
  // будто прогресс не сохранился (см. planet/intro-задания: там то же самое
  // "✓ выполнено" + отдельная кнопка на повтор, а не мгновенный рестарт).
  const renderRelRoundContent = (i, forcePlay) => {
    const round = REL_ROUNDS[i];

    const showDone = () => {
      taskContentPanel.innerHTML = '';
      const doneWrap = document.createElement('div');
      doneWrap.className = 'engine-task';
      const doneText = document.createElement('p');
      doneText.className = 'task-content-done';
      doneText.textContent = `✓ «${round.title}» выполнено`;
      doneWrap.appendChild(doneText);

      // "Закончить экзамен" — только на последнем раунде (и только когда
      // все остальные тоже пройдены, что при последовательной разблокировке
      // и так всегда верно на этом раунде). "Пройти ещё раз" доступна
      // всегда, в том числе на последнем раунде — раньше allDone подменяла
      // её на "Закончить экзамен" на КАЖДОМ раунде, если весь экзамен уже
      // пройден целиком, а не только на действительно последнем.
      const isLastRound = i === REL_ROUNDS.length - 1;
      const allDone = REL_ROUNDS.every((r) => getTaskProgress('relationships')[r.id]);

      if (isLastRound && allDone) {
        const feedbackText = document.createElement('p');
        feedbackText.className = 'task-content-feedback';
        feedbackText.textContent = REL_FINAL_MESSAGE;
        doneWrap.appendChild(feedbackText);
      }

      const retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'btn btn-secondary';
      retryBtn.textContent = 'Пройти ещё раз';
      retryBtn.addEventListener('click', () => renderRelRoundContent(i, true));
      doneWrap.appendChild(retryBtn);

      if (isLastRound && allDone) {
        const backBtn = document.createElement('button');
        backBtn.type = 'button';
        backBtn.className = 'btn btn-primary';
        backBtn.textContent = 'Закончить экзамен';
        backBtn.addEventListener('click', () => {
          showGraduationCeremony(() => {
            exitRelationshipsTask();
            currentLessonKey = null;
            relActiveRoundIndex = null;
            detailRoot.innerHTML = '<div class="course-empty">Выбери здание на карте, чтобы увидеть задания.</div>';
            renderTaskContentPanel(null, null);
            buildVillageStage();
          });
        });
        doneWrap.appendChild(backBtn);
      }

      taskContentPanel.appendChild(doneWrap);
      renderRelExamList();
    };

    if (!forcePlay && getTaskProgress('relationships')[round.id]) {
      showDone();
      return;
    }

    taskContentPanel.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'engine-task';
    const title = document.createElement('p');
    title.className = 'rel-round-title';
    title.textContent = round.title;
    const stage = document.createElement('div');
    stage.className = 'engine-stage';
    wrap.append(title, stage);
    taskContentPanel.appendChild(wrap);

    REL_ROUND_RENDERERS[round.key](stage, () => {
      completeTask('relationships', round.id);
      showDone();
    });
  };

  // Портрет в виджете переключается на Шиву на весь ход экзамена (список
  // раундов и сами раунды) и возвращается на покровителя игрока, только
  // когда экзамен реально закрыт — см. exitRelationshipsTask.
  const exitRelationshipsTask = () => {
    shivaActive = false;
    setupPatronWidget();
  };

  const openRelationshipsExam = () => {
    currentLessonKey = null;
    currentLessonHeading = null;
    currentLessonTasks = null;
    activeTaskId = null;
    relActiveRoundIndex = null;

    shivaActive = true;
    const img = document.getElementById('patronWidgetImage');
    img.src = 'assets/prologue/shiva.png';
    img.alt = 'Шива';
    const reopenImg = document.getElementById('patronReopenImage');
    reopenImg.src = 'assets/prologue/shiva.png';
    reopenImg.alt = 'Шива';
    // Если оставался пузырь с репликой прежнего покровителя — прячем его:
    // иначе портрет уже Шива, а текст ещё звучит чужим голосом.
    hidePatronSpeech();

    renderRelExamList();
    taskContentPanel.innerHTML = '<p class="task-content-placeholder">Выбери раунд из списка выше, чтобы начать.</p>';
    taskContentPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // --- Правая колонка: только список заданий. Содержимое выбранного —
  // отдельное окно внизу, по ширине совпадающее с картой + списком сверху.

  const renderTaskContentPanel = (lessonKey, task, practice) => {
    taskContentPanel.classList.remove('task-content-panel-enter');

    if (!task) {
      taskContentPanel.innerHTML = '<p class="task-content-placeholder">Выбери задание из списка выше, чтобы начать.</p>';
      // eslint-disable-next-line no-void
      void taskContentPanel.offsetWidth;
      taskContentPanel.classList.add('task-content-panel-enter');
      return;
    }

    taskContentPanel.innerHTML = '';

    if (task.status === 'completed' && !practice && task.id === 'task_2') {
      renderFlowerCompletionScene(lessonKey, task);
    } else if (task.status === 'completed' && !practice && task.id === 'task_3') {
      renderCookCompletionScene(lessonKey, task);
    } else if (task.status === 'completed' && !practice) {
      const feedback = TASK_COMPLETED_FEEDBACK[task.id];
      taskContentPanel.innerHTML = `
        <p class="task-content-done">✓ «${task.title}» выполнено</p>
        ${feedback ? `<p class="task-content-feedback">${feedback}</p>` : ''}
      `;
      // Гейт лекции и финальный тур деревни повторно проходить незачем —
      // остальные типы заданий можно потренировать ещё раз.
      if (task.type !== 'lecture_checkbox' && task.type !== 'guided_tour') {
        appendPracticeButton(taskContentPanel, lessonKey, task);
      }
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
        reactToTaskComplete(lessonKey);
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
        reactToTaskComplete(lessonKey);
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
          // На мобильном список заданий длинный — после выбора самого
          // задания панель с открывшимся контентом может быть ниже экрана,
          // и незаметно, что вообще что-то произошло. Слегка подскролливаем
          // к ней, чтобы сразу было видно открывшееся задание.
          taskContentPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    // Если игрок ушёл со здания посреди задания №11 (не долистав до
    // конца) — портрет Шивы иначе так и остался бы в виджете навсегда.
    if (shivaActive) exitRelationshipsTask();
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
      reactToTaskComplete(lessonKey);
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
          // Пока не отпозиционировали — не показываем на старом (центрированном)
          // месте, чтобы не было прыжка.
          tooltip.style.visibility = 'hidden';

          const positionTooltip = () => {
            const rect = highlightedEl.getBoundingClientRect();
            const margin = 12;
            const tooltipWidth = tooltip.offsetWidth || 272;
            const tooltipHeight = tooltip.offsetHeight || 160;

            let top = rect.bottom + 18;
            top = Math.min(top, window.innerHeight - tooltipHeight - margin);
            top = Math.max(top, margin);

            let left = rect.left + rect.width / 2;
            left = Math.min(left, window.innerWidth - tooltipWidth / 2 - margin);
            left = Math.max(left, tooltipWidth / 2 + margin);

            tooltip.style.top = `${top}px`;
            tooltip.style.left = `${left}px`;
            tooltip.style.transform = 'translateX(-50%)';
            tooltip.style.visibility = 'visible';
          };

          // На мобильном к этому шагу страница часто уже проскроллена вниз
          // (к списку заданий) — без прокрутки подсвеченное здание оказывается
          // выше видимой области, rect уходит в минус, и подсказку уносит за
          // пределы экрана. scrollIntoView применяется не мгновенно, поэтому
          // считаем координаты только на следующем кадре, после прокрутки.
          highlightedEl.scrollIntoView({ block: 'center', behavior: 'auto' });
          setTimeout(positionTooltip, 50);
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
        if (building.glow) img.style.setProperty('--building-glow', building.glow);
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

  // Кнопка "Экзамен Шивы" — появляется, как только все 9 планет пройдены
  // (тот же момент, когда раньше сразу открывался сам экзамен). Не
  // привязана к карте вообще: фиксированный элемент на экране (как и
  // patronWidget), заданный статически в village.html, а не создаваемый
  // заново в buildVillageStage — так что туман/облака на карте (см.
  // renderClouds) никак на неё не влияют, при любом их состоянии.
  const shivaExamBadge = document.getElementById('shivaExamBadge');
  shivaExamBadge.addEventListener('click', () => {
    selectBuilding(null);
    openRelationshipsExam();
  });

  const updateShivaExamBadge = () => {
    shivaExamBadge.hidden = !UNLOCK_ORDER.every((id) => isPlanetFullyDone(id));
  };

  const buildVillageStage = () => {
    stage.innerHTML = '';
    stage.classList.remove('village-stage-empty');
    updateShivaExamBadge();

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

  // Карта (и клики по зданиям) открывается сразу после "Взгляд астролога",
  // раньше, чем гайд-тур "Знакомство с обителью" отмечается пройденным
  // (см. isVillageMapUnlocked выше) — то есть можно успеть уйти вглубь
  // игры, ни разу не досмотрев тур до конца, и тогда introCompleted так и
  // останется false навсегда. Поэтому здесь решение принимается по тому
  // же условию, что и видимость самой карты, а не по этому флагу — иначе
  // при перезагрузке страницы прогресс не терялся бы, но человека всё
  // равно откидывало бы обратно на "Введение".
  if (!isVillageMapUnlocked()) {
    openLesson('intro', getLocationHeading('Введение'), INTRO_TASKS);
  } else {
    if (!state.introCompleted) setUserState({ introCompleted: true });
    // Список "Введения" открывается автоматически при каждом заходе (уже
    // пройденного, но доступного для повторного прохождения) — как только
    // игрок кликает по зданию или по значку экзамена Шивы,
    // openBuildingLesson/openRelationshipsExam сами перезапишут detailRoot
    // своим содержимым, как и раньше.
    openLesson('intro', getLocationHeading('Введение'), INTRO_TASKS);
    // Деревня уже открыта — это не первый заход, а возвращение.
    // welcomeBack есть только в расширенном пуле, базового аналога нет.
    showPatronSpeech(pickExpandedOnly('welcomeBack'));
  }

  // --- Dev-заглушка (только на локальном сервере): ?dev=task11 в адресной
  // строке сразу показывает кат-сцену с Шивой, затем перерисовывает карту
  // (открывая иконку экзамена) и сама открывает список раундов — без
  // прохождения всех десяти предыдущих уроков заново и без ручного клика
  // по иконке.
  if (isLocalDevHost() && new URLSearchParams(window.location.search).get('dev') === 'task11') {
    setTimeout(
      () =>
        showShivaMoment(SHIVA_COMPLETE_MESSAGE, () => {
          buildVillageStage();
          // Заглушка сделана специально чтобы не проходить 9 планет заново,
          // поэтому и кнопку показываем принудительно — настоящая проверка
          // прогресса (updateShivaExamBadge) её иначе скрыла бы.
          shivaExamBadge.hidden = false;
          openRelationshipsExam();
        }),
      300,
    );
  }
});
