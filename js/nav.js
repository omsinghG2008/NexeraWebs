/* ==========================================================================
   NEXERA · js/nav.js
   --------------------------------------------------------------------------
   1. Mobile menu (open / close, Escape key, closes on link click)
   2. Reading-progress line + "is-scrolled" shadow on the header
   3. Scroll-spy: highlights the in-page link for the section in view
      (add data-scrollspy to a <nav> whose links are #anchors)
   4. Smooth anchor scrolling: in-page links glide with an eased curve
   5. Page-leave fade: only for browsers without cross-page transitions
   ========================================================================== */
(function () {
  'use strict';
  const { $, $$ } = NX;

  /* ---------- 1. Mobile menu ---------- */
  function initMenu() {
    const button = $('.nav-toggle');
    const nav = $('#primary-nav');
    if (!button || !nav) return;

    const label = $('.nav-toggle__label', button);
    const desktop = window.matchMedia('(min-width: 56.01rem)');   // same breakpoint as components.css

    const setOpen = (open) => {
      nav.classList.toggle('is-open', open);
      button.setAttribute('aria-expanded', String(open));
      label.textContent = open ? 'Close' : 'Menu';
      document.body.style.overflow = open ? 'hidden' : '';        // stop the page scrolling behind the panel
    };

    button.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
    nav.addEventListener('click', (event) => { if (event.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); button.focus(); }
    });
    desktop.addEventListener('change', () => setOpen(false));     // reset when resizing to desktop
  }

  /* ---------- 2. Progress line ---------- */
  function initProgress() {
    const header = $('.site-header');
    const line = $('.scroll-progress');
    if (!header || !line) return;

    let queued = false;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      line.style.setProperty('--progress', max > 0 ? (window.scrollY / max).toFixed(4) : 0);
      header.classList.toggle('is-scrolled', window.scrollY > 8);
      queued = false;
    };
    window.addEventListener('scroll', () => {
      if (!queued) { queued = true; requestAnimationFrame(update); }   // at most once per frame
    }, { passive: true });
    update();
  }

  /* ---------- 3. Scroll-spy ---------- */
  function initScrollSpy() {
    const nav = $('[data-scrollspy]');
    if (!nav || !('IntersectionObserver' in window)) return;

    const links = $$('a[href^="#"]', nav);
    const targets = links.map((a) => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((a) => {
          const active = a.getAttribute('href') === '#' + entry.target.id;
          if (active) a.setAttribute('aria-current', 'location');
          else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-35% 0px -60% 0px' });                      // the band just above the middle of the screen

    targets.forEach((section) => observer.observe(section));
  }

  /* ---------- 4. Smooth anchor scrolling ---------- */
  function initSmoothAnchors() {
    if (NX.prefersReducedMotion()) return;                       // those visitors get the normal instant jump
    const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    let stop = () => {};

    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.button) return;
      const id = decodeURIComponent(link.getAttribute('href').slice(1));
      const target = id ? document.getElementById(id) : document.body;
      if (!target) return;

      event.preventDefault();
      stop();
      const header = $('.site-header');
      const offset = (header ? header.offsetHeight : 0) + 16;
      const from = window.scrollY;
      const to = id ? Math.max(0, target.getBoundingClientRect().top + from - offset) : 0;
      const duration = Math.min(1500, 600 + Math.abs(to - from) * 0.3);   // longer trips take a little longer

      stop = NX.tween({
        from, to, duration, ease: easeInOut,
        onUpdate: (y) => window.scrollTo({ top: y, behavior: 'instant' }),   // "instant" so CSS smooth-scroll does not fight us
      });
      history.pushState(null, '', '#' + id);
      if (id) { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }   // keyboard users land there too
    });

    /* If the visitor grabs the page (wheel or touch), let go immediately. */
    ['wheel', 'touchstart', 'keydown'].forEach((name) => window.addEventListener(name, () => stop(), { passive: true }));
  }

  /* ---------- 5. Page-leave fade (fallback) ---------- */
  function initPageLeave() {
    if (CSS.supports('view-transition-name', 'none') || NX.prefersReducedMotion()) return;   // the browser already does this
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href]');
      if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.button) return;
      if (link.target === '_blank' || link.hasAttribute('download')) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.hash)) return;   // other sites and in-page links
      event.preventDefault();
      document.documentElement.classList.add('is-leaving');
      setTimeout(() => { location.href = url.href; }, 320);
    });
    window.addEventListener('pageshow', (event) => { if (event.persisted) document.documentElement.classList.remove('is-leaving'); });   // back button
  }

  NX.onReady(() => { initMenu(); initProgress(); initScrollSpy(); initSmoothAnchors(); initPageLeave(); });
})();
