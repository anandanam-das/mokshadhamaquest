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

function getCharacterById(id) {
  return MOKSHA_CHARACTERS.find((item) => item.id === id) || null;
}

function renderProgress(state) {
  const progressText = document.getElementById('progressText');
  const progressFill = document.getElementById('progressFill');
  const planetList = document.getElementById('planetList');

  let doneTasks = 0;
  let donePlanets = 0;
  const totalTasks = CABINET_UNLOCK_ORDER.length * CABINET_PLANET_TASK_IDS.length;

  planetList.innerHTML = '';
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

  const percent = Math.round((doneTasks / totalTasks) * 100);
  progressFill.style.width = `${percent}%`;
  progressText.textContent = `Пройдено планет: ${donePlanets} из ${CABINET_UNLOCK_ORDER.length} · заданий: ${doneTasks} из ${totalTasks} (${percent}%)`;

  return donePlanets === CABINET_UNLOCK_ORDER.length;
}

function renderCertificatePanel(courseComplete) {
  const panel = document.getElementById('certificatePanel');
  if (!courseComplete) {
    panel.innerHTML = '';
    return;
  }

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
    `;
    event.target.hidden = true;
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
  const courseComplete = renderProgress(state);
  renderCurrentCharacter(state);
  renderCertificatePanel(courseComplete);

  fetchQuestProfile()
    .then((profile) => {
      if (profile && (profile.first_name || profile.last_name)) {
        greeting.textContent = `Привет, ${[profile.first_name, profile.last_name].filter(Boolean).join(' ')}!`;
      } else {
        greeting.textContent = 'Твой прогресс и покровитель';
      }
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
