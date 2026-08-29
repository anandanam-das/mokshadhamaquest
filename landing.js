(() => {
  'use strict';

  /* ---- Scroll reveal ---- */
  const revealTargets = document.querySelectorAll('.reveal, .fit-card');
  if ('IntersectionObserver' in window && revealTargets.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.25 }
    );

    document.querySelectorAll('.fit-grid').forEach((grid) => {
      [...grid.children].forEach((card, i) => {
        card.style.transitionDelay = `${i * 120}ms`;
      });
    });

    revealTargets.forEach((el) => io.observe(el));
  } else {
    revealTargets.forEach((el) => el.classList.add('is-visible'));
  }

  /* ---- Cat walk-cycle (real leg frames) ---- */
  const catImg = document.getElementById('cat-walk-img');
  if (catImg && catImg.dataset.frames) {
    const frames = catImg.dataset.frames.split(',');
    let frameIndex = 0;
    setInterval(() => {
      frameIndex = (frameIndex + 1) % frames.length;
      catImg.src = frames[frameIndex];
    }, 150);
  }

  /* ---- Carousel (generic: track + prev/next arrows + dots) ---- */
  function setupCarousel(trackId, prevId, nextId, dotsId) {
    const track = document.getElementById(trackId);
    if (!track) return;

    const slides = [...track.children];
    const dotsWrap = document.getElementById(dotsId);
    const prevBtn = document.getElementById(prevId);
    const nextBtn = document.getElementById(nextId);

    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'carousel-dot' + (i === 0 ? ' is-active' : '');
      dot.setAttribute('aria-label', `Слайд ${i + 1}`);
      dot.addEventListener('click', () => goTo(i));
      dotsWrap.appendChild(dot);
    });
    const dots = [...dotsWrap.children];

    function currentIndex() {
      const slideWidth = track.clientWidth;
      return Math.round(track.scrollLeft / slideWidth);
    }

    function goTo(i) {
      const clamped = Math.max(0, Math.min(slides.length - 1, i));
      track.scrollTo({ left: clamped * track.clientWidth, behavior: 'smooth' });
    }

    function updateDots() {
      const idx = currentIndex();
      dots.forEach((d, i) => d.classList.toggle('is-active', i === idx));
    }

    prevBtn.addEventListener('click', () => goTo(currentIndex() - 1));
    nextBtn.addEventListener('click', () => goTo(currentIndex() + 1));

    let scrollTimer;
    track.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(updateDots, 80);
    });
  }

  setupCarousel('carousel-track', 'carousel-prev', 'carousel-next', 'carousel-dots');
  // Same track element serves as a 3-column grid on desktop and a
  // one-at-a-time swipeable carousel on mobile (CSS switches the display mode).
  setupCarousel('fit-grid', 'fit-prev', 'fit-next', 'fit-dots');

  /* ---- Draggable planets on the console chart ---- */
  const chartZone = document.getElementById('chart-zone');
  if (chartZone) {
    // Free placement: planets can be dropped anywhere within the chart
    // (including several in the same house) — no snapping to house centers.
    chartZone.querySelectorAll('.draggable-planet').forEach((planet) => {
      let dragging = false;

      // Belt-and-suspenders: stop the browser's native image drag-and-drop
      // from hijacking the gesture (draggable="false" alone isn't honored
      // consistently everywhere).
      planet.addEventListener('dragstart', (e) => e.preventDefault());

      planet.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        dragging = true;
        planet.setPointerCapture(e.pointerId);
        planet.classList.add('is-dragging');
        planet.style.transition = 'none';
      });

      planet.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const rect = chartZone.getBoundingClientRect();
        let xPct = ((e.clientX - rect.left) / rect.width) * 100;
        let yPct = ((e.clientY - rect.top) / rect.height) * 100;
        xPct = Math.max(2, Math.min(98, xPct));
        yPct = Math.max(2, Math.min(98, yPct));
        planet.style.left = xPct + '%';
        planet.style.top = yPct + '%';
      });

      function endDrag() {
        if (!dragging) return;
        dragging = false;
        planet.classList.remove('is-dragging');
      }

      planet.addEventListener('pointerup', endDrag);
      planet.addEventListener('pointercancel', endDrag);
    });
  }
})();
