document.addEventListener('DOMContentLoaded', () => {
  const defaultHero = {
    name: 'Герой',
    characterId: MOKSHA_CHARACTERS[0].id,
  };

  let hero = defaultHero;
  const stored = localStorage.getItem('mokshaHero');
  if (stored) {
    try {
      hero = { ...defaultHero, ...JSON.parse(stored) };
    } catch (error) {
      hero = defaultHero;
    }
  }

  const character = MOKSHA_CHARACTERS.find((item) => item.id === hero.characterId) || MOKSHA_CHARACTERS[0];

  document.getElementById('profileName').textContent = hero.name || character.title;
  document.getElementById('profileSubtitle').textContent = `${character.epithet} · ${character.subtitle}`;

  const img = document.getElementById('profileCharacterImg');
  img.src = character.file;
  img.alt = character.title;
});
