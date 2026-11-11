// ===== Header scroll state (frost the bar after the hero) =====
const header = document.getElementById('header');
const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// ===== Mobile menu: the button opens the nav as a sheet under the header =====
const menuBtn = document.getElementById('menuToggle');
const setMenu = (open) => {
  header.classList.toggle('menu-open', open);
  menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
};
setMenu(false);
menuBtn.addEventListener('click', (e) => { e.stopPropagation(); setMenu(!header.classList.contains('menu-open')); });
header.querySelectorAll('.header__nav a').forEach((a) => a.addEventListener('click', () => setMenu(false)));   // picking a section closes it
document.addEventListener('click', (e) => { if (!header.contains(e.target)) setMenu(false); });               // so does tapping elsewhere
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
window.addEventListener('resize', () => { if (window.innerWidth > 860) setMenu(false); });

// ===== Nav shows which section is on screen =====
if ('IntersectionObserver' in window) {
  const navLinks = [...header.querySelectorAll('.header__nav a')];
  const spy = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (!en.isIntersecting) return;
    navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });                       // a section counts once it crosses the middle of the screen
  navLinks.forEach((a) => { const sec = document.querySelector(a.getAttribute('href')); if (sec) spy.observe(sec); });
  const hero = document.getElementById('drive');
  if (hero) new IntersectionObserver((es) => { if (es[0].isIntersecting) navLinks.forEach((a) => a.classList.remove('is-active')); }, { rootMargin: '-45% 0px -50% 0px' }).observe(hero);
}

// ===== Leaders marquee (Shri Dinesh Group clientele) =====
const leaders = [
  { name: 'Castrol', logo: 'assets/logos/castrol.png' },
  { name: 'Reliance Industries', logo: 'assets/logos/reliance.png' },
  { name: 'Larsen & Toubro', logo: 'assets/logos/larsen-toubro.png' },
  { name: 'UltraTech Cement', logo: 'assets/logos/ultratech.png' },
  { name: 'Saint-Gobain', logo: 'assets/logos/saint-gobain.png' },
  { name: 'Asian Paints', logo: 'assets/logos/asian-paints.png' },
  { name: 'Hindalco', logo: 'assets/logos/hindalco.png' },
  { name: 'SANY', logo: 'assets/logos/sany.png' },
  { name: 'Lafarge', logo: 'assets/logos/lafarge.png' },
  { name: 'Gulf Oil', logo: 'assets/logos/gulf-oil.png' },
  { name: 'Vestas', logo: 'assets/logos/vestas.png' },
  { name: 'Hindustan Zinc', logo: 'assets/logos/hindustan-zinc.png' },
  { name: 'Indian Railways', logo: 'assets/logos/indian-railways.png' },
  { name: 'Essar', logo: 'assets/logos/essar.png' },
  { name: 'Afcons', logo: 'assets/logos/afcons.png' },
  { name: 'Henkel', logo: 'assets/logos/henkel.png' },
  { name: 'Amway', logo: 'assets/logos/amway.png' },
  { name: 'Valvoline', logo: 'assets/logos/valvoline.png' },
  { name: 'Cummins', logo: 'assets/logos/cummins.png' },
  { name: 'IG Petrochemicals', logo: 'assets/logos/ig-petrochemicals.png' }
];
const track = document.getElementById('leadersTrack');
const buildLeader = (item) => `
  <div class="leader" title="${item.name}">
    <img src="${item.logo}" alt="${item.name}">
  </div>`;
track.innerHTML = leaders.map(buildLeader).join('');

// ===== Country codes for phone select =====
const countries = [
  ['IN','+91'],['AE','+971'],['SA','+966'],['US','+1'],['GB','+44'],
  ['SG','+65'],['QA','+974'],['BH','+973'],['OM','+968'],['KW','+965'],
  ['LK','+94'],['BD','+880'],['NP','+977'],['DE','+49'],['CN','+86'],['JP','+81']
];
const cs = document.getElementById('countrySelect');
cs.innerHTML = countries.map(([c,d],i) => `<option value="${d}" ${i===0?'selected':''}>${c} ${d}</option>`).join('');

// ===== Quote form =====
const form = document.getElementById('demoForm');
const ok = document.getElementById('formOk');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!form.checkValidity()) { form.reportValidity(); return; }
  ok.classList.add('show');
  form.reset();
  cs.selectedIndex = 0;
  setTimeout(() => ok.classList.remove('show'), 6000);
});

// ===== Reveal on scroll (every section after the hero) =====
// Elements get a hidden starting state (.rv + a variant) and are released as they enter the viewport.
// Siblings in a grid are staggered. Once an element has settled the classes are removed again, so its
// own hover transitions behave exactly as before. Skipped entirely for reduced-motion users.
if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
  const order = new Map();
  const mark = (sel, kind, step = 0, base = 0, cap = 8) => document.querySelectorAll(sel).forEach((el) => {
    if (el.closest('.drive') || el.classList.contains('rv')) return;
    const n = order.get(el.parentElement) || 0; order.set(el.parentElement, n + 1);
    el.classList.add('rv', 'rv--' + kind);
    el.style.setProperty('--d', (base + Math.min(n, cap) * step).toFixed(2) + 's');
  });
  mark('main section .eyebrow', 'left');
  mark('main section h2', 'rise');
  mark('.features__head p, .leaders__sub, .net__lead, .kf__note, .careers__head p, .careers__cta, .backed__grid .btn, .backed__grid > div:first-child > p', 'up', 0, 0.15);
  mark('.intro__grid > *', 'up', 0.12);
  mark('.card, .role, .kf__grid > div, .backed__stat, .spec, .net__side, .net__steps li, .net__goals > div, .footer__top > *', 'up', 0.09);
  mark('.net__tr, .net__lists li', 'row', 0.07);
  mark('.leader', 'scale', 0.035, 0, 14);
  mark('.demo__card', 'scale');

  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (!en.isIntersecting && en.boundingClientRect.top > 0) return;   // still below the fold; anything on screen or already scrolled past is shown
    const el = en.target; io.unobserve(el);
    el.classList.add('is-in');
    setTimeout(() => { el.classList.remove('rv', 'is-in', ...[...el.classList].filter((c) => c.startsWith('rv--'))); el.style.removeProperty('--d'); },
      1300 + parseFloat(el.style.getPropertyValue('--d') || 0) * 1000);
  }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('.rv').forEach((el) => io.observe(el));

  // line icons draw themselves in; figures count up from zero
  const count = (el) => {
    const node = [...el.childNodes].find((c) => c.nodeType === 3 && /\d/.test(c.nodeValue));
    const m = node && node.nodeValue.match(/^(\D*)([\d,]+)(\D*)$/);
    if (!m) return;
    const to = parseInt(m[2].replace(/,/g, ''), 10), t0 = performance.now(), dur = 1400;
    const tick = (now) => {
      const k = Math.min(1, Math.max(0, (now - t0) / dur)),   // a frame's timestamp can predate t0
      v = Math.round(to * (1 - Math.pow(1 - k, 3)));
      node.nodeValue = m[1] + v.toLocaleString('en-IN') + m[3];
      if (k < 1) requestAnimationFrame(tick); else node.nodeValue = m[1] + m[2] + m[3];
    };
    node.nodeValue = m[1] + '0' + m[3]; requestAnimationFrame(tick);
  };
  const io2 = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (!en.isIntersecting && en.boundingClientRect.top > 0) return;
    io2.unobserve(en.target);
    if (en.target.tagName.toLowerCase() === 'svg') en.target.classList.add('is-in'); else count(en.target);
  }), { threshold: 0.6 });
  document.querySelectorAll('.net__ico, .net__i').forEach((svg) => {
    svg.querySelectorAll('*').forEach((part) => part.setAttribute('pathLength', '1'));
    svg.classList.add('ico-draw'); io2.observe(svg);
  });
  document.querySelectorAll('.kf__num, .net__num, .net__goals b, .backed__stat .n, .spec__num').forEach((el) => io2.observe(el));
}
