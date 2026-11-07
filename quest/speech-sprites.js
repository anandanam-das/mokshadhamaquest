'use strict';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const speechFrames = new Map();
const sidewaysSpeechSprites = new Map([
  ["assets/characters/mangala-pixel-512.webp", "-talk-open.webp"],
  ["assets/characters/budha-indra-style-512.webp", "-talk-open.webp"],
  ["assets/characters/guru-indra-style-512.webp", "-talk-open.webp"],
  ["assets/prologue/shiva.webp", "-talk-open.webp"],
]);

const animateSpeech = (image, message, { layered = false } = {}) => {
  const idle = image.getAttribute('src');
  if (!idle?.endsWith('.webp') || reducedMotion.matches) return () => {};
  const suffix = sidewaysSpeechSprites.get(idle) || '-talk.webp';
  const talking = idle.replace(/\.webp$/, suffix);
  let timer;
  let endTimer;
  let active = true;
  let speaking = false;
  const overlay = layered ? new Image() : null;
  const showFrame = (showTalking) => {
    speaking = showTalking;
    if (overlay) {
      image.classList.toggle('speech-frame-hidden', showTalking);
      overlay.classList.toggle('speech-frame-visible', showTalking);
    } else {
      image.src = showTalking ? talking : idle;
    }
  };
  const stop = () => {
    if (!active) return;
    active = false;
    clearTimeout(timer);
    clearTimeout(endTimer);
    image.classList.remove('sprite-speaking', 'speech-frame-hidden');
    overlay?.remove();
    if (image.getAttribute('src') === talking) image.src = idle;
  };

  if (overlay) {
    overlay.alt = '';
    overlay.className = 'speech-frame-overlay';
    overlay.src = talking;
  } else if (!speechFrames.has(talking)) {
    const frame = new Image();
    frame.src = talking;
    speechFrames.set(talking, frame.decode().then(() => true, () => {
      speechFrames.delete(talking);
      return false;
    }));
  }
  const ready = overlay ? overlay.decode().then(() => true, () => false) : speechFrames.get(talking);
  ready.then((loaded) => {
    if (!loaded || !active || !image.isConnected || image.getAttribute('src') !== idle) return;
    image.classList.add('sprite-speaking');
    if (overlay) {
      image.after(overlay);

    }
    showFrame(true);
    const advanceFrame = () => {
      const current = image.getAttribute('src');
      if (!image.isConnected || (current !== idle && current !== talking)) {
        stop();
        return;
      }
      showFrame(!speaking);
      timer = setTimeout(advanceFrame, speaking ? 620 : 420);
    };
    timer = setTimeout(advanceFrame, 620);
    endTimer = setTimeout(stop, Math.max(1200, Math.min(5200, message.length * 28)));
  });
  return stop;
};
