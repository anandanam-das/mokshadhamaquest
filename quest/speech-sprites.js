'use strict';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const speechFrames = new Map();
const sidewaysSpeechSprites = new Map([
  ["assets/characters/mangala-pixel-512.webp", "-talk-open.webp"],
  ["assets/characters/budha-indra-style-512.webp", "-talk-open.webp"],
  ["assets/characters/guru-indra-style-512.webp", "-talk-open.webp"],
  ["assets/prologue/shiva.webp", "-talk-open.webp"],
]);

const animateSpeech = (image, message) => {
  const idle = image.getAttribute('src');
  if (!idle?.endsWith('.webp') || reducedMotion.matches) return () => {};
  const suffix = sidewaysSpeechSprites.get(idle) || '-talk.webp';
  const talking = idle.replace(/\.webp$/, suffix);
  let timer;
  let endTimer;
  let active = true;
  const stop = () => {
    active = false;
    clearTimeout(timer);
    clearTimeout(endTimer);
    image.classList.remove('sprite-speaking');
    if (image.getAttribute('src') === talking) image.src = idle;
  };

  if (!speechFrames.has(talking)) {
    const frame = new Image();
    frame.src = talking;
    speechFrames.set(talking, frame.decode().then(() => true, () => {
      speechFrames.delete(talking);
      return false;
    }));
  }
  speechFrames.get(talking).then((loaded) => {
    if (!loaded || !active || !image.isConnected || image.getAttribute('src') !== idle) return;
    image.classList.add('sprite-speaking');
    image.src = talking;
    const advanceFrame = () => {
      const current = image.getAttribute('src');
      if (!image.isConnected || (current !== idle && current !== talking)) {
        stop();
        return;
      }
      const nextFrame = current === talking ? idle : talking;
      image.src = nextFrame;
      timer = setTimeout(advanceFrame, nextFrame === talking ? 620 : 420);
    };
    timer = setTimeout(advanceFrame, 620);
    endTimer = setTimeout(stop, Math.max(1200, Math.min(5200, message.length * 28)));
  });
  return stop;
};
