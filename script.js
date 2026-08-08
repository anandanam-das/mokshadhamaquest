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
  const previewTelegramName = document.getElementById('previewTelegramName');
  const authGuest = document.getElementById('authGuest');
  const charSelect = document.getElementById('charSelect');
  const charSelectNext = document.getElementById('charSelectNext');
  const authUser = document.getElementById('authUser');
  const telegramLoginBtn = document.getElementById('telegramLoginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const navRegister = document.getElementById('navRegister');
  const heroMapLink = document.getElementById('heroMapLink');
  const heroContinueLink = document.getElementById('heroContinueLink');
  const heroLead = document.getElementById('heroLead');
  const mapSection = document.getElementById('map');
  const natalSection = document.getElementById('natal');
  const questsSection = document.getElementById('quests');
  const questPanelSection = document.getElementById('questPanel');

  const MOCK_TELEGRAM_USER = {
    name: 'Алекс Иванов',
    birthDate: '1998-05-12',
    birthTime: '14:30',
    birthPlace: 'Москва',
  };

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

  const renderAuthState = (user) => {
    if (!authGuest || !authUser) return;
    if (user) {
      authGuest.classList.add('hidden');
      if (charSelect) charSelect.classList.add('hidden');
      authUser.classList.remove('hidden');
      previewTelegramName.textContent = `Имя: ${user.name}`;
      previewBirth.textContent = `Рождён: ${user.birthDate} ${user.birthTime}, ${user.birthPlace}`;
    } else {
      authGuest.classList.remove('hidden');
      if (charSelect) charSelect.classList.add('hidden');
      authUser.classList.add('hidden');
    }

    if (navRegister) navRegister.classList.toggle('hidden', Boolean(user));
    if (logoutBtn) logoutBtn.classList.toggle('hidden', !user);
    if (heroMapLink) heroMapLink.classList.toggle('hidden', !user);
    if (heroContinueLink) heroContinueLink.classList.toggle('hidden', !user);
    if (heroLead) heroLead.classList.toggle('hidden', Boolean(user));
    if (mapSection) mapSection.classList.toggle('hidden', !user);
    if (natalSection) natalSection.classList.toggle('hidden', !user);
    if (questsSection) questsSection.classList.toggle('hidden', !user);
    if (questPanelSection) questPanelSection.classList.toggle('hidden', !user);
  };

  if (telegramLoginBtn) {
    telegramLoginBtn.addEventListener('click', () => {
      telegramLoginBtn.disabled = true;
      telegramLoginBtn.textContent = 'Входим...';
      setTimeout(() => {
        authGuest.classList.add('hidden');
        if (charSelect) charSelect.classList.remove('hidden');
        telegramLoginBtn.disabled = false;
        telegramLoginBtn.textContent = 'Войти';
      }, 600);
    });
  }

  if (charSelectNext) {
    charSelectNext.addEventListener('click', () => {
      localStorage.setItem('mokshaTelegramUser', JSON.stringify(MOCK_TELEGRAM_USER));
      renderAuthState(MOCK_TELEGRAM_USER);
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('mokshaTelegramUser');
      renderAuthState(null);
    });
  }

  const savedUser = localStorage.getItem('mokshaTelegramUser');
  renderAuthState(savedUser ? JSON.parse(savedUser) : null);

  updateXp();
});
