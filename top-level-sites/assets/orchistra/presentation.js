(() => {
  const root = document.documentElement;
  const button = document.querySelector('.orchistra-motion-toggle');
  if (!button || !('IntersectionObserver' in window)) return;
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = false;
  const update = () => {
    root.dataset.orchistraMotion = paused || preference.matches || document.hidden ? 'paused' : 'running';
    button.hidden = preference.matches;
    button.textContent = paused ? 'Resume motion' : 'Pause motion';
    button.setAttribute('aria-pressed', String(paused));
  };
  button.addEventListener('click', () => { paused = !paused; update(); });
  preference.addEventListener('change', update);
  document.addEventListener('visibilitychange', update);
  const menu = document.querySelector('.sp-mobile-nav');
  menu?.addEventListener('click', event => {
    if (event.target.closest('a')) menu.open = false;
  });
  menu?.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      menu.open = false;
      menu.querySelector('summary').focus();
    }
  });
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      entry.target.dataset.inView = String(entry.isIntersecting);
      if (entry.isIntersecting && !entry.target.matches('.orchistra-hero') && root.dataset.orchistraMotion === 'running') {
        entry.target.classList.add('orchistra-enter');
      }
    }
  }, { threshold: 0.08 });
  update();
  document.querySelectorAll('.orchistra-hero, .orchistra-garden-scene, .orchistra-product-figure, .sp-section-inner').forEach(element => observer.observe(element));
})();
