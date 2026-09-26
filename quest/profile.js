// Mirrors UNLOCK_ORDER / PLANET_TASK_IDS in village.js — this page reads
// progress that village.js writes, so the definition of "planet complete"
// has to match exactly.
const CABINET_UNLOCK_ORDER = ['surya', 'chandra', 'mangala', 'budha', 'guru', 'shukra', 'shani', 'rahu', 'ketu'];
const CABINET_PLANET_TASK_IDS = [
  'watch_lecture',
  'engine_video',
  'engine_phrase',
  'engine_audio',
  'engine_error',
  'engine_image',
  'engine_map',
];
const CABINET_INTRO_TASK_IDS = ['watch_lecture', 'task_gunas', 'task_1', 'task_2', 'task_3', 'task_4', 'village_intro'];
// Mirrors REL_ROUNDS ids in village.js — "Экзамен Шивы", 6 раундов
// задания №11. Ачивка Граха-таттва-джня требует 9 планет И весь экзамен.
const CABINET_EXAM_ROUND_IDS = ['round_direction', 'round_reason', 'round_impact', 'round_union', 'round_neutral', 'round_nodes'];
// Блок Граха-таттва — 11 уроков: Введение + 9 планет + Экзамен Шивы
// (11-й, задание №11). Все уже построены и считаются в doneLessons ниже.
const GRAHA_TATTVA_LESSON_COUNT = 11;

function getCharacterById(id) {
  return MOKSHA_CHARACTERS.find((item) => item.id === id) || null;
}

// Учебные блоки платформы — каждый следующий назван через санскритский
// термин "-таттва" (см. заметку в памяти проекта). Пока построен только
// первый; следующие два показываем как "скоро", ещё не начатые.
const TATTVA_BLOCKS = [
  {
    id: 'graha',
    sanskrit: 'ग्रह तत्त्व',
    title: 'Граха-таттва',
    subtitle: 'Природа и взаимоотношения девяти грах',
    achievementTitle: 'Граха-таттва-джня',
    achievementSubtitle: 'Познавший природу грах',
    locked: false,
  },
  {
    id: 'rashi',
    sanskrit: 'राशि तत्त्व',
    title: 'Раши-таттва',
    subtitle: 'Природа знаков зодиака',
    locked: true,
  },
  {
    id: 'bhava',
    sanskrit: 'भाव तत्त्व',
    title: 'Бхава-таттва',
    subtitle: 'Природа домов',
    locked: true,
  },
];

function renderTattvaPath(percent, courseComplete) {
  const container = document.getElementById('tattvaPath');
  container.innerHTML = TATTVA_BLOCKS.map((block) => {
    if (block.locked) {
      return `
        <div class="tattva-block is-locked">
          <span class="tattva-block-lock">🔒</span>
          <span class="tattva-block-sanskrit">${block.sanskrit}</span>
          <strong class="tattva-block-title">${block.title}</strong>
          <span class="tattva-block-subtitle">${block.subtitle}</span>
          <span class="tattva-block-status">Откроется позже</span>
        </div>
      `;
    }
    const achievement = courseComplete
      ? `<span class="tattva-block-achievement">🏅 ${block.achievementTitle}<br /><small>${block.achievementSubtitle}</small></span>`
      : `
        <div class="tattva-block-progress"><div class="tattva-block-progress-fill" style="width:${percent}%"></div></div>
        <span class="tattva-block-status">${percent}%</span>
      `;
    return `
      <div class="tattva-block is-active${courseComplete ? ' is-complete' : ''}">
        <span class="tattva-block-sanskrit">${block.sanskrit}</span>
        <strong class="tattva-block-title">${block.title}</strong>
        <span class="tattva-block-subtitle">${block.subtitle}</span>
        ${achievement}
      </div>
    `;
  }).join('');
}

function renderProgress(state) {
  const progressText = document.getElementById('progressText');
  const progressFill = document.getElementById('progressFill');
  const planetList = document.getElementById('planetList');

  const totalTasks =
    CABINET_INTRO_TASK_IDS.length + CABINET_UNLOCK_ORDER.length * CABINET_PLANET_TASK_IDS.length + CABINET_EXAM_ROUND_IDS.length;

  planetList.innerHTML = '';

  const introProgress = (state.taskProgress && state.taskProgress.intro) || {};
  const introDone = CABINET_INTRO_TASK_IDS.filter((taskId) => introProgress[taskId]).length;
  let doneTasks = introDone;
  let donePlanets = 0;
  const introItem = document.createElement('li');
  introItem.className = `cabinet-planet-item${introDone === CABINET_INTRO_TASK_IDS.length ? ' is-done' : ''}`;
  introItem.innerHTML = `
    <span>Введение</span>
    <span class="cabinet-planet-mark">${introDone === CABINET_INTRO_TASK_IDS.length ? '✓' : `${introDone}/${CABINET_INTRO_TASK_IDS.length}`}</span>
  `;
  planetList.appendChild(introItem);

  CABINET_UNLOCK_ORDER.forEach((planetId) => {
    const progress = (state.taskProgress && state.taskProgress[planetId]) || {};
    const completedCount = CABINET_PLANET_TASK_IDS.filter((taskId) => progress[taskId]).length;
    doneTasks += completedCount;
    const isDone = completedCount === CABINET_PLANET_TASK_IDS.length;
    if (isDone) donePlanets += 1;

    const character = getCharacterById(planetId);
    const item = document.createElement('li');
    item.className = `cabinet-planet-item${isDone ? ' is-done' : ''}`;
    item.innerHTML = `
      <span>${character ? character.title : planetId} · ${character ? character.subtitle : ''}</span>
      <span class="cabinet-planet-mark">${isDone ? '✓' : `${completedCount}/${CABINET_PLANET_TASK_IDS.length}`}</span>
    `;
    planetList.appendChild(item);
  });

  const allPlanetsDone = donePlanets === CABINET_UNLOCK_ORDER.length;
  const examProgress = (state.taskProgress && state.taskProgress.relationships) || {};
  const examDone = CABINET_EXAM_ROUND_IDS.filter((taskId) => examProgress[taskId]).length;
  doneTasks += examDone;
  const examComplete = examDone === CABINET_EXAM_ROUND_IDS.length;
  // Раньше строка появлялась только после allPlanetsDone — но задания
  // экзамена уже считаются в totalTasks/doneTasks и прогресс-баре всегда,
  // так что строка должна быть видна всегда же, как "Введение" и планеты.
  const examItem = document.createElement('li');
  examItem.className = `cabinet-planet-item${examComplete ? ' is-done' : ''}`;
  examItem.innerHTML = `
    <span>Экзамен Шивы</span>
    <span class="cabinet-planet-mark">${examComplete ? '✓' : `${examDone}/${CABINET_EXAM_ROUND_IDS.length}`}</span>
  `;
  planetList.appendChild(examItem);

  const percent = Math.round((doneTasks / totalTasks) * 100);
  progressFill.style.width = `${percent}%`;
  // Экзамен Шивы — тоже урок (11-й: Введение + 9 планет + экзамен), и он
  // уже построен и проходится — раньше этот +1 не начислялся, из-за чего
  // "Пройдено уроков" застревало на 10 из 11 даже при 100% заданий.
  const doneLessons =
    donePlanets + (introDone === CABINET_INTRO_TASK_IDS.length ? 1 : 0) + (examComplete ? 1 : 0);
  progressText.textContent = `Пройдено уроков: ${doneLessons} из ${GRAHA_TATTVA_LESSON_COUNT} · заданий: ${doneTasks} из ${totalTasks} (${percent}%)`;

  return { courseComplete: allPlanetsDone && examComplete, percent };
}

function renderCertificatePanel(courseComplete, profile) {
  const panel = document.getElementById('certificatePanel');
  if (!courseComplete) {
    panel.innerHTML = '';
    return;
  }

  const emailReady = !!(profile && profile.email && profile.email_verified);

  panel.innerHTML = `
    <h3>Сертификат</h3>
    <p class="cabinet-progress-text">Курс полностью пройден — можно получить сертификат с QR-кодом для проверки подлинности.</p>
    <div class="cabinet-certificate-actions">
      <button type="button" class="btn btn-primary" id="issueCertificateBtn">Получить сертификат</button>
    </div>
    <div class="cabinet-certificate-actions" id="certificateLinks" hidden></div>
  `;

  document.getElementById('issueCertificateBtn').addEventListener('click', async (event) => {
    event.target.disabled = true;
    event.target.textContent = 'Готовим…';
    const result = await issueQuestCertificate();
    if (!result.ok) {
      event.target.disabled = false;
      event.target.textContent = 'Получить сертификат';
      return;
    }
    const links = document.getElementById('certificateLinks');
    links.hidden = false;
    links.innerHTML = `
      <a class="btn btn-secondary" href="${MOKSHA_CONFIG.questApiBaseUrl}/api/certificate/${result.id}/pdf" target="_blank" rel="noopener">Скачать PDF</a>
      <a class="btn btn-secondary" href="verify.html?id=${result.id}" target="_blank" rel="noopener">Страница проверки</a>
      ${emailReady ? '<button type="button" class="btn btn-secondary" id="emailCertificateBtn">Отправить на почту</button>' : ''}
    `;
    event.target.hidden = true;

    if (emailReady) {
      document.getElementById('emailCertificateBtn').addEventListener('click', async (sendEvent) => {
        sendEvent.target.disabled = true;
        sendEvent.target.textContent = 'Отправляем…';
        const sendResult = await emailCertificate();
        sendEvent.target.textContent = sendResult.ok ? 'Отправлено ✓' : 'Не удалось отправить';
        if (!sendResult.ok) sendEvent.target.disabled = false;
      });
    }
  });
}

function renderEmailPanel(profile) {
  const panel = document.getElementById('emailPanel');
  const email = profile && profile.email;
  const verified = !!(profile && profile.email_verified);

  if (verified) {
    panel.innerHTML = `
      <h3>Почта</h3>
      <p class="cabinet-progress-text">${email} — <strong class="cabinet-email-verified">подтверждена ✓</strong></p>
    `;
    return;
  }

  panel.innerHTML = `
    <h3>Почта</h3>
    <p class="cabinet-progress-text">Подтверди почту, чтобы получать диплом и уведомления на неё.</p>
    <div class="registration-actions cabinet-email-form">
      <input type="email" id="emailInput" placeholder="you@example.com" value="${email || ''}" />
      <button type="button" class="btn btn-primary" id="confirmEmailBtn">Подтвердить почту</button>
    </div>
    <p class="cabinet-progress-text" id="emailStatus" hidden></p>
  `;

  document.getElementById('confirmEmailBtn').addEventListener('click', async (event) => {
    const input = document.getElementById('emailInput');
    const value = input.value.trim();
    const status = document.getElementById('emailStatus');
    if (!value) return;

    event.target.disabled = true;
    event.target.textContent = 'Отправляем…';
    try {
      if (value !== email) await saveQuestProfile({ email: value });
      const result = await sendEmailVerification();
      status.hidden = false;
      status.textContent = result.ok
        ? 'Письмо отправлено — перейди по ссылке из письма, чтобы подтвердить.'
        : 'Не удалось отправить письмо. Попробуй ещё раз чуть позже.';
    } finally {
      event.target.disabled = false;
      event.target.textContent = 'Подтвердить почту';
    }
  });
}

function renderCurrentCharacter(state) {
  const block = document.getElementById('currentCharacterBlock');
  const character = state.character ? getCharacterById(state.character.patronPlanet) : null;
  if (!character) {
    block.innerHTML = '<p>Покровитель ещё не выбран.</p>';
    return;
  }
  block.innerHTML = `
    <img src="${character.file}" alt="${character.title}" />
    <div>
      <strong>${character.title}</strong> — ${character.subtitle}<br />
      <span class="cabinet-progress-text">${character.epithet}</span>
    </div>
  `;
}

function renderCharacterGrid(currentPlanetId, onPick) {
  const grid = document.getElementById('characterGrid');
  grid.innerHTML = '';
  MOKSHA_CHARACTERS.forEach((character) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = `cabinet-character-option${character.id === currentPlanetId ? ' is-current' : ''}`;
    option.innerHTML = `<img src="${character.file}" alt="${character.title}" /><span>${character.title}</span>`;
    option.addEventListener('click', () => {
      // Видимая подсветка того, что реально выбрано сейчас — иначе на
      // телефоне непонятно, среагировал ли тап вообще.
      grid.querySelectorAll('.cabinet-character-option').forEach((el) => el.classList.remove('is-selected'));
      option.classList.add('is-selected');
      onPick(character.id);
    });
    grid.appendChild(option);
  });
}

function renderCharacterPreview(candidateId, currentPlanetId, onConfirm) {
  const preview = document.getElementById('characterPreview');
  const character = getCharacterById(candidateId);
  if (!character) {
    preview.hidden = true;
    return;
  }

  const reactionPool = (typeof patronReactions !== 'undefined' && patronReactions[candidateId]) || null;
  const otherIds = CABINET_UNLOCK_ORDER.filter((id) => id !== candidateId).slice(0, 2);
  const reactionLines = reactionPool
    ? otherIds.map((id) => {
        const other = getCharacterById(id);
        return `«${reactionPool[id]}» — про ${other ? other.title : id}`;
      })
    : [];

  preview.hidden = false;
  preview.innerHTML = `
    <strong>${character.title}, ${character.epithet}</strong>
    <span>${character.description}</span>
    <div class="cabinet-character-preview-reactions">${reactionLines.map((line) => `<p>${line}</p>`).join('')}</div>
    <button type="button" class="btn btn-primary" id="confirmCharacterBtn">
      ${candidateId === currentPlanetId ? 'Уже твой покровитель' : 'Выбрать этого покровителя'}
    </button>
  `;

  if (candidateId !== currentPlanetId) {
    document.getElementById('confirmCharacterBtn').addEventListener('click', () => onConfirm(candidateId));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const state = getUserState();
  if (!state.telegramId) {
    window.location.href = 'login.html';
    return;
  }

  const greeting = document.getElementById('cabinetGreeting');
  const { courseComplete, percent } = renderProgress(state);
  renderTattvaPath(percent, courseComplete);
  renderCurrentCharacter(state);
  renderCertificatePanel(courseComplete);

  fetchQuestProfile()
    .then((profile) => {
      if (profile && (profile.first_name || profile.last_name)) {
        greeting.textContent = `Привет, ${[profile.first_name, profile.last_name].filter(Boolean).join(' ')}!`;
      } else {
        greeting.textContent = 'Твой прогресс и покровитель';
      }
      renderEmailPanel(profile);
      // Перерисовываем панель сертификата теперь, когда известен статус
      // почты — только так кнопка "Отправить на почту" появится вовремя.
      renderCertificatePanel(courseComplete, profile);
    })
    .catch(() => {
      greeting.textContent = 'Твой прогресс и покровитель';
    });

  const changeBtn = document.getElementById('changeCharacterBtn');
  const grid = document.getElementById('characterGrid');
  const preview = document.getElementById('characterPreview');

  changeBtn.addEventListener('click', () => {
    const opening = grid.hidden;
    grid.hidden = !opening;
    if (!opening) preview.hidden = true;
    if (opening) {
      const currentPlanetId = state.character ? state.character.patronPlanet : null;
      renderCharacterGrid(currentPlanetId, (candidateId) => {
        renderCharacterPreview(candidateId, currentPlanetId, (chosenId) => {
          const updated = setUserState({ character: { patronPlanet: chosenId } });
          saveQuestProfile({ patronPlanet: chosenId }).catch((error) => {
            console.warn('failed to sync patron switch (non-fatal):', error);
          });
          renderCurrentCharacter(updated);
          grid.hidden = true;
          preview.hidden = true;
        });
        // Превью с кнопкой подтверждения рисуется ниже сетки — на телефоне
        // после тапа оно часто оказывается вне видимой области, и кажется,
        // что тап ни на что не повлиял.
        preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  });
});
