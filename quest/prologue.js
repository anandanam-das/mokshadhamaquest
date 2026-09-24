document.addEventListener('DOMContentLoaded', () => {
  if (!getUserState().telegramId) {
    window.location.href = 'checking.html';
    return;
  }

  // Пять фаз анимации: battle (Шива против Андхакасуры) → center-glow
  // (рождение из пота) → pinning (боги придавливают существо к земле) →
  // center-still (Васту Пуруша неподвижен на земле) → zoom-out-to-map
  // (переход к деревне). center-still встречается дважды подряд — это
  // ожидаемо, вторая карточка просто меняет текст без повторной анимации.
  const prologueScenes = [
    {
      phase: 'battle',
      characters: ['shiva', 'demon'],
      text: 'Когда-то Шива сражался с демоном Андхакасурой…',
    },
    {
      phase: 'center-glow',
      characters: ['shiva'],
      text: 'Из его пота родилось существо, полное неутолимого голода…',
    },
    {
      phase: 'pinning',
      characters: ['vastu-purusha'],
      text: 'Боги испугались этого голода и придавили существо к земле…',
    },
    {
      phase: 'center-still',
      characters: ['vastu-purusha'],
      text: 'Так родился Васту Пуруша — дух земли, вечно голодный, придавленный собственной пустотой…',
    },
    {
      phase: 'center-still',
      characters: ['vastu-purusha'],
      text: 'Только знание может наполнить эту пустоту смыслом…',
    },
    {
      phase: 'zoom-out-to-map',
      characters: ['vastu-purusha'],
      text: 'Помоги ему — построй обитель богов на его теле, и голод утихнет.',
    },
  ];

  const CHARACTER_FILES = {
    shiva: 'assets/prologue/shiva.png',
    demon: 'assets/prologue/demon-andhakasura.png',
    'vastu-purusha': 'assets/prologue/vastu-purusha.png',
  };

  const characterEls = {
    shiva: document.getElementById('prologueCharShiva'),
    demon: document.getElementById('prologueCharDemon'),
    'vastu-purusha': document.getElementById('prologueCharVastu'),
  };

  document.getElementById('prologueRuin1').src = 'assets/prologue/ruin-1.png';
  document.getElementById('prologueRuin2').src = 'assets/prologue/ruin-2.png';
  document.getElementById('prologueRuin3').src = 'assets/prologue/ruin-3.png';

  Object.entries(CHARACTER_FILES).forEach(([key, src]) => {
    characterEls[key].src = src;
  });

  let index = 0;

  const sceneEl = document.getElementById('prologueScene');
  const textEl = document.getElementById('prologueText');
  const dotsEl = document.getElementById('prologueDots');
  const nextBtn = document.getElementById('prologueNextBtn');

  prologueScenes.forEach((_, i) => {
    const dot = document.createElement('span');
    dot.className = 'prologue-dot';
    dot.dataset.index = String(i);
    dotsEl.appendChild(dot);
  });

  const render = () => {
    const scene = prologueScenes[index];
    const phaseChanged = sceneEl.dataset.phase !== scene.phase;

    sceneEl.dataset.phase = scene.phase;

    Object.entries(characterEls).forEach(([key, el]) => {
      el.classList.toggle('is-visible', scene.characters.includes(key));
    });

    // Перезапускаем анимацию входа в фазу, только если фаза правда новая —
    // иначе вторая center-still-карточка дёргала бы уже осевшего Васту
    // Пурушу заново.
    if (phaseChanged) {
      sceneEl.classList.remove('prologue-scene-enter');
      // eslint-disable-next-line no-void
      void sceneEl.offsetWidth;
      sceneEl.classList.add('prologue-scene-enter');
    }

    textEl.classList.remove('prologue-text-enter');
    // eslint-disable-next-line no-void
    void textEl.offsetWidth;
    textEl.textContent = scene.text;
    textEl.classList.add('prologue-text-enter');

    dotsEl.querySelectorAll('.prologue-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });
    nextBtn.textContent = index === prologueScenes.length - 1 ? 'Начать путь' : 'Далее';
  };

  nextBtn.addEventListener('click', () => {
    if (index < prologueScenes.length - 1) {
      index += 1;
      render();
      return;
    }

    setUserState({ hasSeenPrologue: true });
    if (typeof saveQuestProfile === 'function') {
      saveQuestProfile({ hasSeenPrologue: true }).catch((error) => {
        console.warn('failed to sync prologue-seen flag (non-fatal):', error);
      });
    }
    window.location.href = 'village.html';
  });

  render();
});
