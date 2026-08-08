document.addEventListener('DOMContentLoaded', () => {
  if (!getUserState().telegramId) {
    window.location.href = 'login.html';
    return;
  }

  const slides = [
    { icon: '⚔️', text: 'Когда-то Шива сражался с демоном Андхакасурой…' },
    { icon: '💧', text: 'Из его пота родилось существо, полное неутолимого голода…' },
    { icon: '🙏', text: 'Боги испугались этого голода и придавили существо к земле…' },
    { icon: '🌍', text: 'Так родился Васту Пуруша — дух земли, вечно голодный, придавленный собственной пустотой…' },
    { icon: '📖', text: 'Только знание может наполнить эту пустоту смыслом…' },
    { icon: '🏘️', text: 'Помоги ему — построй деревню знания на его теле, и голод утихнет.' },
  ];

  let index = 0;

  const illustration = document.getElementById('prologueIllustration');
  const textEl = document.getElementById('prologueText');
  const dotsEl = document.getElementById('prologueDots');
  const nextBtn = document.getElementById('prologueNextBtn');

  slides.forEach((_, i) => {
    const dot = document.createElement('span');
    dot.className = 'prologue-dot';
    dot.dataset.index = String(i);
    dotsEl.appendChild(dot);
  });

  const render = () => {
    const slide = slides[index];
    illustration.textContent = slide.icon;
    textEl.textContent = slide.text;
    dotsEl.querySelectorAll('.prologue-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });
    nextBtn.textContent = index === slides.length - 1 ? 'Начать путь' : 'Далее';
  };

  nextBtn.addEventListener('click', () => {
    if (index < slides.length - 1) {
      index += 1;
      render();
      return;
    }

    setUserState({ hasSeenPrologue: true });
    window.location.href = 'village.html';
  });

  render();
});
