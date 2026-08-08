document.addEventListener('DOMContentLoaded', () => {
  const year = document.getElementById('year');
  if (year) {
    year.textContent = new Date().getFullYear();
  }

  const previewName = document.getElementById('previewName');
  const previewBio = document.getElementById('previewBio');
  const previewAvatar = document.getElementById('previewAvatar');
  const xpBar = document.getElementById('xpBar');
  const questTitle = document.getElementById('questTitle');
  const completeQuestBtn = document.getElementById('completeQuest');
  const previewBirth = document.getElementById('previewBirth');
  const playerNameInput = document.getElementById('playerName');
  const birthDateInput = document.getElementById('birthDate');
  const birthTimeInput = document.getElementById('birthTime');
  const birthPlaceInput = document.getElementById('birthPlace');
  const startAdventureBtn = document.getElementById('startAdventure');

  let level = 1;
  let xp = 0;
  let nextLevelXp = 200;

  const updateXp = () => {
    const levelValue = document.getElementById('levelValue');
    const xpValue = document.getElementById('xpValue');
    if (levelValue) levelValue.textContent = level;
    if (xpValue) xpValue.textContent = `${xp} / ${nextLevelXp}`;
    const percent = Math.min(100, Math.round((xp / nextLevelXp) * 100));
    xpBar.style.width = `${percent}%`;
  };

  document.querySelectorAll('.character-card').forEach((card) => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.character-card').forEach((item) => item.classList.remove('active'));
      card.classList.add('active');
      const { name, bio, avatar } = card.dataset;
      previewName.textContent = name;
      previewBio.textContent = bio;
      previewAvatar.textContent = avatar;
    });
  });

  document.querySelectorAll('.quest-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      questTitle.textContent = btn.dataset.title;
    });
  });

  if (completeQuestBtn) {
    completeQuestBtn.addEventListener('click', () => {
      const reward = 120;
      xp += reward;
      if (xp >= nextLevelXp) {
        xp -= nextLevelXp;
        level += 1;
        nextLevelXp += 120;
      }
      updateXp();
    });
  }

  const natalText = document.getElementById('natalText');
  const natalDetails = document.getElementById('natalDetails');

  if (natalDetails) {
    natalDetails.addEventListener('click', () => {
      if (natalText) localStorage.setItem('mokshaNatalText', natalText.value);
    });
  }

  if (natalText) {
    const savedText = localStorage.getItem('mokshaNatalText');
    if (savedText) natalText.value = savedText;
  }

  if (startAdventureBtn) {
    startAdventureBtn.addEventListener('click', () => {
      const playerName = playerNameInput.value.trim() || 'Новичок';
      const birthDate = birthDateInput.value || '2000-01-01';
      const birthTime = birthTimeInput.value || '12:00';
      const birthPlace = birthPlaceInput.value.trim() || 'Земля';
      previewName.textContent = playerName;
      previewBirth.textContent = `Рождён: ${birthDate} ${birthTime}, ${birthPlace}`;
      previewBio.textContent = `Путешественник света и тайн.`;
      document.querySelector('#map').scrollIntoView({ behavior: 'smooth' });
    });
  }

  updateXp();
});
