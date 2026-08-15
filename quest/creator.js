document.addEventListener('DOMContentLoaded', () => {
  if (!getUserState().telegramId) {
    window.location.href = 'checking.html';
    return;
  }

  const creatorState = {
    characterIndex: 0,
  };

  const previewImg = document.getElementById('creatorPreviewImg');
  const previewName = document.getElementById('creatorPreviewName');
  const dossier = document.getElementById('characterDossier');
  const prevBtn = document.getElementById('charPrevBtn');
  const nextBtn = document.getElementById('charNextBtn');

  const getCharacter = () => MOKSHA_CHARACTERS[creatorState.characterIndex];

  const render = () => {
    const character = getCharacter();

    previewImg.src = character.file;
    previewImg.alt = character.title;
    previewName.textContent = character.title.toUpperCase();

    dossier.innerHTML = `
      <h3 class="dossier-title">${character.title} — ${character.epithet}</h3>
      <div class="dossier-archetype">Архетип: ${character.archetype}</div>
      <p class="dossier-text">${character.description}</p>
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
  createHeroBtn.addEventListener('click', () => {
    const character = getCharacter();
    const state = setUserState({ character: { patronPlanet: character.id } });
    window.location.href = state.hasSeenPrologue ? 'village.html' : 'prologue.html';
  });
});
