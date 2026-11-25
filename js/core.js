/* ==========================================================================
   NEXERA · js/core.js
   --------------------------------------------------------------------------
   Shared helpers. Loaded FIRST on every page; every other file uses `NX`.

   How the JavaScript is organised
     core.js         helpers (this file)
     nav.js          mobile menu, reading-progress line, header shadow, in-page scroll-spy
     bg-webgl.js     live 3D background map    (every page)
     motion.js       scroll reveal, hover glow, tilt, magnetic buttons (every page)
     counters.js     count-up numbers          (home)
     charts.js       sample analytics chart    (home)
     calculator.js   profit calculator         (services)
     skills-filter.js skill-group filter       (company)
     forms.js        enquiry + career forms    (contact)

   Each feature file is independent: it looks for its own element and quietly
   does nothing if that element is not on the page. Remove a <script> tag
   from a page to switch that feature off.
   ========================================================================== */
(function () {
  'use strict';

  const NX = (window.NX = window.NX || {});

  /* Select one element / many elements (returns a real Array). */
  NX.$  = (selector, root = document) => root.querySelector(selector);
  NX.$$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  /* True when the visitor asked their system for less motion. Read live. */
  NX.prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Run a function once the HTML is ready (scripts are deferred, so this is immediate). */
  NX.onReady = (fn) => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  };

  /* Easing curves for hand-made animations (input and output are 0..1). */
  NX.ease = {
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    outQuart: (t) => 1 - Math.pow(1 - t, 4),
  };

  /* Animate a number from `from` to `to`. Calls onUpdate(value) every frame.
     Returns a function that stops the animation (call it before starting a new one on the same element). */
  NX.tween = ({ from, to, duration = 600, ease = NX.ease.outCubic, onUpdate }) => {
    if (NX.prefersReducedMotion()) { onUpdate(to); return () => {}; }
    const start = performance.now();
    let frameId = 0;
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      onUpdate(from + (to - from) * ease(progress));
      if (progress < 1) frameId = requestAnimationFrame(step);
    };
    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  };
})();
