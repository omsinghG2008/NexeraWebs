/* ==========================================================================
   NEXERA · js/counters.js
   --------------------------------------------------------------------------
   Counts numbers up from 0 when they scroll into view.
   Usage:  <dd data-count="11">11</dd>      (optional: data-suffix="+")
   The real number is already in the HTML, so search engines, screen readers
   and visitors without JavaScript all see the right value.
   ========================================================================== */
(function () {
  'use strict';
  const { $$, tween, ease } = NX;

  NX.onReady(() => {
    const counters = $$('[data-count]');
    if (!counters.length || NX.prefersReducedMotion() || !('IntersectionObserver' in window)) return;

    counters.forEach((el) => { el.textContent = '0' + (el.dataset.suffix || ''); });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = Number(el.dataset.count);
        const suffix = el.dataset.suffix || '';
        tween({
          from: 0, to: target, duration: 1200, ease: ease.outQuart,
          onUpdate: (value) => { el.textContent = Math.round(value) + suffix; },
        });
        observer.unobserve(el);                                    // count once only
      });
    }, { threshold: 0.4 });

    counters.forEach((el) => observer.observe(el));
  });
})();
