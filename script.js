// ===== Hero style switch (dark cinematic <-> light fleet) =====
const heroSwitch = document.getElementById('heroSwitch');
const heroSwitchLabel = document.getElementById('heroSwitchLabel');
const applyHeroMode = (mode) => {
  const light = mode === 'light';
  document.body.classList.toggle('hero-light-on', light);
  heroSwitch.setAttribute('aria-pressed', String(light));
  heroSwitchLabel.textContent = light ? 'Light hero' : 'Dark hero';
};
applyHeroMode(localStorage.getItem('zd-hero') || 'dark');
heroSwitch.addEventListener('click', () => {
  const light = !document.body.classList.contains('hero-light-on');
  localStorage.setItem('zd-hero', light ? 'light' : 'dark');
  applyHeroMode(light ? 'light' : 'dark');
});

// ===== Header scroll state =====
const header = document.getElementById('header');
// Flip to solid white only once the dark hero is mostly out of view
const onScroll = () => header.classList.toggle('scrolled', window.scrollY > window.innerHeight * 0.82);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// ===== Get Started dropdown (click for touch, hover via CSS) =====
const gsd = document.getElementById('gsd');
document.getElementById('gsdBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  gsd.classList.toggle('open');
});
document.addEventListener('click', () => gsd.classList.remove('open'));

// Mobile menu toggle -> jump to demo (simple)
document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('demo').scrollIntoView({ behavior: 'smooth' });
});

// ===== Leaders marquee (real SDG clientele) =====
const leaders = [
  { name: 'Castrol', logo: '/assets/logos/castrol.png' },
  { name: 'Reliance Industries', logo: '/assets/logos/reliance.png' },
  { name: 'Larsen & Toubro', logo: '/assets/logos/larsen-toubro.png' },
  { name: 'UltraTech Cement', logo: '/assets/logos/ultratech.png' },
  { name: 'Saint-Gobain', logo: '/assets/logos/saint-gobain.png' },
  { name: 'Asian Paints', logo: '/assets/logos/asian-paints.png' },
  { name: 'Hindalco', logo: '/assets/logos/hindalco.png' },
  { name: 'SANY', logo: '/assets/logos/sany.png' },
  { name: 'Lafarge', logo: '/assets/logos/lafarge.png' },
  { name: 'Gulf Oil', logo: '/assets/logos/gulf-oil.png' },
  { name: 'Vestas', logo: '/assets/logos/vestas.png' },
  { name: 'Hindustan Zinc', logo: '/assets/logos/hindustan-zinc.png' },
  { name: 'Indian Railways', logo: '/assets/logos/indian-railways.png' },
  { name: 'Essar', logo: '/assets/logos/essar.png' },
  { name: 'Afcons', logo: '/assets/logos/afcons.png' },
  { name: 'Henkel', logo: '/assets/logos/henkel.png' },
  { name: 'Amway', logo: '/assets/logos/amway.png' },
  { name: 'Valvoline', logo: '/assets/logos/valvoline.png' },
  { name: 'Cummins', logo: '/assets/logos/cummins.png' },
  { name: 'IG Petrochemicals', logo: '/assets/logos/ig-petrochemicals.png' }
];
const track = document.getElementById('leadersTrack');
const buildLeader = (item) => {
  if (typeof item === 'object' && item.logo) {
    return `
  <div class="leader leader--logo" title="${item.name}">
    <img src="${item.logo}" alt="${item.name}">
  </div>`;
  }
  return `
  <div class="leader leader--text">
    <span class="leader__name">${item}</span>
  </div>`;
};
// duplicate for seamless loop
track.innerHTML = [...leaders, ...leaders].map(buildLeader).join('');

// ===== Country codes for phone select =====
const countries = [
  ['IN','+91'],['AE','+971'],['SA','+966'],['US','+1'],['GB','+44'],
  ['SG','+65'],['QA','+974'],['BH','+973'],['OM','+968'],['KW','+965'],
  ['LK','+94'],['BD','+880'],['NP','+977'],['DE','+49'],['CN','+86'],['JP','+81']
];
const cs = document.getElementById('countrySelect');
cs.innerHTML = countries.map(([c,d],i) => `<option value="${d}" ${i===0?'selected':''}>${c} ${d}</option>`).join('');

// ===== Demo form =====
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

// ===== Cookie banner =====
const cookie = document.getElementById('cookie');
if (localStorage.getItem('madar-cookie')) cookie.classList.add('hide');
const closeCookie = (v) => { localStorage.setItem('madar-cookie', v); cookie.classList.add('hide'); };
document.getElementById('cookieAccept').addEventListener('click', () => closeCookie('accept'));
document.getElementById('cookieDeny').addEventListener('click', () => closeCookie('deny'));

// ===== Reveal on scroll =====
const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (en.isIntersecting) { en.target.style.opacity = 1; en.target.style.transform = 'none'; io.unobserve(en.target); }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.card, .cs__card, .kf__grid > div, .intro__grid > *').forEach((el) => {
  el.style.opacity = 0; el.style.transform = 'translateY(24px)';
  el.style.transition = 'opacity .7s ease, transform .7s ease';
  io.observe(el);
});
