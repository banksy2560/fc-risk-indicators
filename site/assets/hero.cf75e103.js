/* Home hero: artwork loop and a one-off entrance. Both are skipped under reduced motion. */
(() => {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const target = document.getElementById('linkage');
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const still = () => calm.matches || document.documentElement.dataset.motion === 'off';
  document.getElementById('explore').addEventListener('click', () => {
    target.scrollIntoView({ behavior: still() ? 'auto' : 'smooth' });
    document.getElementById('q').focus({ preventScroll: true });
  });
  /* a shared link to a typology or item opens on the tool, not the hero */
  const deep = document.documentElement.dataset.deep === '1';
  if (deep) {
    const view = document.getElementById('view');
    const jump = () => { if (view.querySelector('.loading')) return false; target.scrollIntoView(); return true; };
    if (!jump()) { const seen = new MutationObserver(() => { if (jump()) seen.disconnect(); }); seen.observe(view, { childList: true }); }
  }

  const video = hero.querySelector('video');
  const play = () => {
    if (still()) { video.pause(); video.classList.remove('on'); return; }
    if (!video.src) { video.src = video.dataset.src; video.addEventListener('playing', () => { if (!still()) video.classList.add('on'); }); }
    video.play().catch(() => {});
  };
  calm.addEventListener('change', play);
  play();

  if (still() || deep || !hero.animate) return;
  const rise = (els, delay, step, from = 'translateY(14px)') => els.forEach((el, i) =>
    el.animate([{ opacity: 0, transform: from }, { opacity: 1, transform: 'none' }],
      { duration: 620, delay: delay + i * step, easing: 'cubic-bezier(0.23,1,0.32,1)', fill: 'backwards' }));
  const all = s => [...hero.querySelectorAll(s)];
  rise([document.querySelector('.top .brand'), ...document.querySelectorAll('.top nav a')], 0, 70);
  rise(all('.ln1>span'), 150, 120, 'translateY(105%)');
  rise(all('[data-in="sub"]'), 560, 0);
  rise(all('[data-in="pri"]'), 680, 0, 'translateY(10px) scale(1.015)');
  rise(all('[data-in="btn"]'), 740, 0);
  rise(all('[data-in="stat"]'), 860, 100);
  rise(all('[data-in="card"]'), 1150, 140, 'translateY(24px)');
  rise(all('[data-in="logo"]'), 1450, 90, 'none');
})();
