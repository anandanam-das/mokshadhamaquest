document.addEventListener('DOMContentLoaded', () => {
  const year = document.getElementById('year');
  if (year) {
    year.textContent = new Date().getFullYear();
  }

  const heroName = document.getElementById('heroName');
  const heroBio = document.getElementById('heroBio');
  const heroAvatar = document.getElementById('heroAvatar');
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
    if (previewName) previewName.textContent = heroName.textContent;
    if (previewBio) previewBio.textContent = heroBio.textContent;
    if (previewAvatar) previewAvatar.textContent = heroAvatar.textContent;
    const percent = Math.min(100, Math.round((xp / nextLevelXp) * 100));
    xpBar.style.width = `${percent}%`;
  };

  document.querySelectorAll('.character-card').forEach((card) => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.character-card').forEach((item) => item.classList.remove('active'));
      card.classList.add('active');
      const { name, bio, avatar } = card.dataset;
      heroName.textContent = name;
      heroBio.textContent = bio;
      heroAvatar.textContent = avatar;
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

  const natalImageInput = document.getElementById('natalImageInput');
  const natalImagePreview = document.getElementById('natalImagePreview');
  const removeNatalImage = document.getElementById('removeNatalImage');
  const natalText = document.getElementById('natalText');
  const saveNatalText = document.getElementById('saveNatalText');
  const clearNatalText = document.getElementById('clearNatalText');

  const showNatalImage = (src) => {
    if (!natalImagePreview) return;
    natalImagePreview.style.backgroundImage = `url('${src}')`;
    natalImagePreview.style.backgroundSize = 'cover';
    natalImagePreview.style.backgroundPosition = 'center';
    natalImagePreview.textContent = '';
  };

  const resetNatalImage = () => {
    if (!natalImagePreview) return;
    natalImagePreview.style.backgroundImage = 'none';
    natalImagePreview.textContent = 'Загрузите изображение';
  };

  if (natalImageInput) {
    natalImageInput.addEventListener('change', () => {
      const file = natalImageInput.files && natalImageInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        showNatalImage(event.target.result);
      };
      reader.readAsDataURL(file);
    });
  }

  if (removeNatalImage) {
    removeNatalImage.addEventListener('click', () => {
      if (natalImageInput) natalImageInput.value = '';
      resetNatalImage();
    });
  }

  if (saveNatalText) {
    saveNatalText.addEventListener('click', () => {
      if (!natalText) return;
      localStorage.setItem('mokshaNatalText', natalText.value);
      alert('Астрологические данные сохранены локально.');
    });
  }

  if (clearNatalText) {
    clearNatalText.addEventListener('click', () => {
      if (!natalText) return;
      natalText.value = '';
      localStorage.removeItem('mokshaNatalText');
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
      heroName.textContent = playerName;
      previewName.textContent = playerName;
      previewBirth.textContent = `Рождён: ${birthDate} ${birthTime}, ${birthPlace}`;
      heroBio.textContent = `Путешественник света и тайн.`;
      previewBio.textContent = heroBio.textContent;
      document.querySelector('#map').scrollIntoView({ behavior: 'smooth' });
    });
  }

  updateXp();
});
