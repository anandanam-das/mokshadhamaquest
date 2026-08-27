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
    // Centroids of the 12 houses in a classic North-Indian chart (a square with
    // both diagonals plus a diamond connecting the edge midpoints): 4 "kite"
    // houses at the top/right/bottom/left, and 8 corner triangles — each pair
    // split by the diagonal running through that corner. Computed analytically
    // as percentages of the chart's own square (0-100 on each axis).
    const houseCenters = [
      { x: 25, y: 8.33 }, // top-left corner, upper triangle
      { x: 8.33, y: 25 }, // top-left corner, lower triangle
      { x: 50, y: 25 }, // top kite
      { x: 75, y: 8.33 }, // top-right corner, upper triangle
      { x: 91.67, y: 25 }, // top-right corner, lower triangle
      { x: 75, y: 50 }, // right kite
      { x: 91.67, y: 75 }, // bottom-right corner, upper triangle
      { x: 75, y: 91.67 }, // bottom-right corner, lower triangle
      { x: 50, y: 75 }, // bottom kite
      { x: 25, y: 91.67 }, // bottom-left corner, lower triangle
      { x: 8.33, y: 75 }, // bottom-left corner, upper triangle
      { x: 25, y: 50 }, // left kite
    ];

    houseCenters.forEach((pos) => {
      const zone = document.createElement('div');
      zone.className = 'house-zone';
      zone.style.left = pos.x + '%';
      zone.style.top = pos.y + '%';
      zone.dataset.x = pos.x;
      zone.dataset.y = pos.y;
      chartZone.insertBefore(zone, chartZone.firstChild);
    });

    const houseZones = [...chartZone.querySelectorAll('.house-zone')];

    function nearestZone(xPct, yPct) {
      let best = null;
      let bestDist = Infinity;
      houseZones.forEach((zone) => {
        const zx = parseFloat(zone.dataset.x);
        const zy = parseFloat(zone.dataset.y);
        const d = (zx - xPct) ** 2 + (zy - yPct) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = zone;
        }
      });
      return best;
    }

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

        houseZones.forEach((z) => z.classList.remove('drag-over'));
        const near = nearestZone(xPct, yPct);
        if (near) near.classList.add('drag-over');
      });

      function endDrag(e) {
        if (!dragging) return;
        dragging = false;
        planet.classList.remove('is-dragging');
        houseZones.forEach((z) => z.classList.remove('drag-over'));

        const rect = chartZone.getBoundingClientRect();
        const xPct = ((e.clientX - rect.left) / rect.width) * 100;
        const yPct = ((e.clientY - rect.top) / rect.height) * 100;
        const near = nearestZone(xPct, yPct);
        if (near) {
          planet.style.transition = 'left 0.35s cubic-bezier(0.2, 0.8, 0.3, 1.1), top 0.35s cubic-bezier(0.2, 0.8, 0.3, 1.1)';
          planet.style.left = near.dataset.x + '%';
          planet.style.top = near.dataset.y + '%';
        }
      }

      planet.addEventListener('pointerup', endDrag);
      planet.addEventListener('pointercancel', endDrag);
    });
  }
})();
