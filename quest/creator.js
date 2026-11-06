document.addEventListener('DOMContentLoaded', () => {
  const ketuPreview = isLocalDevHost() && new URLSearchParams(location.search).get('preview') === 'ketu';
  if (!ketuPreview && !getUserState().telegramId) {
    window.location.href = 'checking.html';
    return;
  }

  const creatorState = {
    characterIndex: ketuPreview ? MOKSHA_CHARACTERS.findIndex(character => character.id === 'ketu') : 0,
  };

  const previewImg = document.getElementById('creatorPreviewImg');
  const previewName = document.getElementById('creatorPreviewName');
  const dossier = document.getElementById('characterDossier');
  const prevBtn = document.getElementById('charPrevBtn');
  const nextBtn = document.getElementById('charNextBtn');

  const getCharacter = () => MOKSHA_CHARACTERS[creatorState.characterIndex];

  const render = () => {
    const character = getCharacter();

    previewImg.src = ketuPreview ? 'assets/characters/ketu-pixel-512.webp' : character.file;
    previewImg.alt = character.title;
    previewName.textContent = character.title.toUpperCase();

    dossier.innerHTML = `
      <h3 class="dossier-title">${character.title} — ${character.epithet}</h3>
      <div class="dossier-archetype">Архетип: ${character.archetype}</div>
      <p class="dossier-text">${character.description}</p>
      <p class="dossier-text dossier-downside">${character.downside}</p>
      <p class="dossier-fit">${character.fit}</p>
    `;
  };

  const goTo = (index) => {
    const total = MOKSHA_CHARACTERS.length;
    creatorState.characterIndex = (index + total) % total;
    render();
  };

  prevBtn.addEventListener('click', () => goTo(creatorState.characterIndex - 1));
  nextBtn.addEventListener('click', () => goTo(creatorState.characterIndex + 1));

  render();

  const createHeroBtn = document.getElementById('createHeroBtn');
  if (ketuPreview) {
    createHeroBtn.hidden = true;
    prevBtn.hidden = true;
    nextBtn.hidden = true;
    document.querySelector('.section-subheading').textContent = 'Предпросмотр нового Кету';
    return;
  }
  createHeroBtn.addEventListener('click', () => {
    const character = getCharacter();
    const state = setUserState({ character: { patronPlanet: character.id } });
    // Best-effort — if quest-api is unreachable, the choice still works
    // locally for this session; it just won't survive a logout until the
    // next successful sync.
    if (typeof saveQuestProfile === 'function') {
      saveQuestProfile({ patronPlanet: character.id }).catch((error) => {
        console.warn('failed to sync patron choice (non-fatal):', error);
      });
    }
    window.location.href = state.hasSeenPrologue ? 'village.html' : 'prologue.html';
  });
});
