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

  /* ---- Character-choice scene: Chandra walks the road, callouts pop in ---- */
  const chooseScene = document.getElementById('choose-scene');
  if (chooseScene) {
    const BASE = '/assets/illustrations/choose person/';
    const chandra = document.getElementById('choose-chandra');
    const meet = document.getElementById('choose-meet');
    const surya = chooseScene.querySelector('.choose-surya');
    const bubbles = [
      document.getElementById('choose-bubble-1'),
      document.getElementById('choose-bubble-2'),
      document.getElementById('choose-bubble-3'),
    ];

    const walkFrames = [1, 2, 3, 4].map((n) => `${BASE}chandra-step${n}.png`);
    const meetFrames = [1, 2, 3, 4, 5, 6].map((n) => `${BASE}chandra-surya${n}.png`);
    [...walkFrames, ...meetFrames].forEach((src) => {
      const img = new Image();
      img.src = src;
    });

    // Timeline constants (seconds) — tweak these to retime the scene.
    const T = {
      reachCastle: 3.5, // reaches the castle and vanishes into it
      emergeAt: 4.3, // reappears already down the road, past the castle
      reachSurya: 8.8, // arrives on the clearing next to Surya
      end: 13,
      // when each callout pops in:
      //  [0] as Chandra nears the castle
      //  [1] as she walks out of the castle toward Surya
      //  [2] when she reaches Surya
      bubble: [3.0, 6.2, 9.2],
    };
    // Vertical waypoints along the road, as % of the road height.
    //  castleEnter — top edge of the castle, where she slips inside and vanishes
    //  emerge      — the castle doorway, where she reappears walking out
    //  surya       — where she stops, just short of Surya (must NOT overlap her)
    const TOP = { start: 2, castleEnter: 26, emerge: 56, surya: 76 };
    // Horizontal position (% — matches CSS `left`). She walks down the centre,
    // then drifts to Chandra's spot in the meeting art so she ends up beside
    // Surya (who stands left of centre) rather than on top of her.
    const LEFT = { path: 50, surya: 64 };
    const FRAME_MS = 170; // walk-cycle frame duration

    const lerp = (a, b, p) => a + (b - a) * Math.max(0, Math.min(1, p));

    let started = false;
    function startScene() {
      if (started) return;
      started = true;
      const t0 = performance.now();

      let walkTimer = setInterval(() => {
        const i = Math.floor((performance.now() - t0) / FRAME_MS) % walkFrames.length;
        chandra.src = walkFrames[i];
      }, 40);

      T.bubble.forEach((sec, i) => {
        setTimeout(() => bubbles[i] && bubbles[i].classList.add('is-shown'), sec * 1000);
      });

      let meetSwapped = false;
      function frame(now) {
        const t = (now - t0) / 1000;

        if (t < T.reachCastle) {
          // walking down toward the castle
          chandra.style.opacity = '1';
          chandra.style.top = lerp(TOP.start, TOP.castleEnter, t / T.reachCastle) + '%';
        } else if (t < T.emergeAt) {
          // stepped inside — gone
          chandra.style.opacity = '0';
        } else if (t < T.reachSurya) {
          // walking out of the doorway — now drawn in front of the castle,
          // curving toward her spot beside Surya
          const p = (t - T.emergeAt) / (T.reachSurya - T.emergeAt);
          chandra.style.opacity = '1';
          chandra.style.zIndex = '7';
          chandra.style.top = lerp(TOP.emerge, TOP.surya, p) + '%';
          chandra.style.left = lerp(LEFT.path, LEFT.surya, p) + '%';
        }

        if (t >= T.reachSurya) {
          if (!meetSwapped) {
            meetSwapped = true;
            if (walkTimer) {
              clearInterval(walkTimer);
              walkTimer = null;
            }
            // crossfade the two standalone sprites into the meeting frame so
            // nothing pops or jumps
            meet.style.opacity = '1';
            chandra.style.opacity = '0';
            if (surya) surya.style.opacity = '0';
            setTimeout(() => {
              chandra.style.display = 'none';
              if (surya) surya.style.display = 'none';
            }, 450);
          }
          const mi = Math.min(meetFrames.length - 1, Math.floor((t - T.reachSurya) / 0.6));
          meet.src = meetFrames[mi];
        }

        if (t < T.end) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              startScene();
              io.disconnect();
            }
          });
        },
        { threshold: 0.3 }
      );
      io.observe(chooseScene);
    } else {
      startScene();
    }
  }
})();
