/* ==========================================================================
   NEXERA · js/motion.js
   --------------------------------------------------------------------------
   The "alive" feel of the site. Everything here is optional polish: the page
   is complete without it. All visuals are in css/components.css §13.

   1. Reveal      sections, cards and tiles fade up as they scroll into view
   2. Glow        a soft light follows the pointer across cards and tiles
   3. Tilt        tiles and steps lean toward the pointer in 3D
   4. Magnet      buttons are gently pulled toward the pointer

   How it talks to the CSS: it only sets custom properties (--mx --my --rx
   --ry --tx --ty) and the classes .reveal / .is-visible. Change the look in
   the CSS, change the behaviour in SELECTORS and SETTINGS below.
   Touch screens and "reduce motion" visitors skip 2 to 4 (and the reveal).
   ========================================================================== */
(function () {
  'use strict';
  const { $$ } = NX;

  /* ---------- Settings you may want to change ---------- */
  const SELECTORS = {
    reveal:    '.section-head, .card, .tile, .steps__item, .tests__item, .statement, .team__item, .case, .service, .skill-group, .accordion__item, .engagement',
    glow:      '.tile, .steps__item, .skill-group, .card',
    tilt:      '.tile, .steps__item',
    magnet:    '.btn',
  };
  const SETTINGS = {
    tiltDegrees: 5,        // largest lean, in degrees
    magnetPull: 0.18,      // 0 = none, higher = buttons follow the pointer further
    magnetMax: 8,          // never move a button more than this many pixels
    revealStagger: 110,    // milliseconds between items revealed together
  };

  /* ---------- 1. Reveal ---------- */
  function initReveal() {
    if (NX.prefersReducedMotion() || !('IntersectionObserver' in window)) return;

    const items = $$(SELECTORS.reveal).filter((el) =>
      !el.closest('.hero') && !(el.parentElement && el.parentElement.closest('.reveal')));   // skip the hero and nested items
    items.forEach((el) => el.classList.add('reveal'));

    const observer = new IntersectionObserver((entries) => {
      entries.filter((entry) => entry.isIntersecting).forEach((entry, index) => {
        entry.target.style.setProperty('--reveal-delay', Math.min(index, 6) * SETTINGS.revealStagger + 'ms');
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });

    items.forEach((el) => observer.observe(el));
  }

  /* ---------- 2 to 4. Pointer effects (one shared listener, one update per frame) ---------- */
  function initPointerEffects() {
    if (NX.prefersReducedMotion() || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    let queued = false;
    let last = null;

    function update() {
      queued = false;
      const { clientX, clientY, target } = last;
      if (!(target instanceof Element)) return;

      const glow = target.closest(SELECTORS.glow);
      if (glow) {
        const box = glow.getBoundingClientRect();
        glow.style.setProperty('--mx', (clientX - box.left).toFixed(0) + 'px');
        glow.style.setProperty('--my', (clientY - box.top).toFixed(0) + 'px');
      }

      const tilt = target.closest(SELECTORS.tilt);
      if (tilt) {
        const box = tilt.getBoundingClientRect();
        const offsetX = (clientX - box.left) / box.width - 0.5;      // -0.5 .. 0.5
        const offsetY = (clientY - box.top) / box.height - 0.5;
        tilt.style.setProperty('--ry', (offsetX * SETTINGS.tiltDegrees * 2).toFixed(2) + 'deg');
        tilt.style.setProperty('--rx', (-offsetY * SETTINGS.tiltDegrees * 2).toFixed(2) + 'deg');
      }

      const magnet = target.closest(SELECTORS.magnet);
      if (magnet && !magnet.disabled) {
        const box = magnet.getBoundingClientRect();
        const pull = (distance) => Math.max(-SETTINGS.magnetMax, Math.min(SETTINGS.magnetMax, distance * SETTINGS.magnetPull));
        magnet.style.setProperty('--tx', pull(clientX - (box.left + box.width / 2)).toFixed(1) + 'px');
        magnet.style.setProperty('--ty', pull(clientY - (box.top + box.height / 2)).toFixed(1) + 'px');
      }
    }

    document.addEventListener('pointermove', (event) => {
      last = event;
      if (!queued) { queued = true; requestAnimationFrame(update); }
    }, { passive: true });

    /* When the pointer leaves an element, let it settle back to rest. */
    document.addEventListener('pointerout', (event) => {
      if (!(event.target instanceof Element)) return;
      [[SELECTORS.tilt, ['--rx', '--ry']], [SELECTORS.magnet, ['--tx', '--ty']]].forEach(([selector, names]) => {
        const element = event.target.closest(selector);
        if (element && !element.contains(event.relatedTarget)) names.forEach((name) => element.style.removeProperty(name));
      });
    }, { passive: true });
  }

  NX.onReady(() => { initReveal(); initPointerEffects(); });
})();
