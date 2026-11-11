// ===== Header scroll state (frost the bar after the hero) =====
const header = document.getElementById('header');
const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// Mobile menu toggle -> jump to contact (simple)
document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
});

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

// ===== Reveal on scroll =====
const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (en.isIntersecting) { en.target.style.opacity = 1; en.target.style.transform = 'none'; io.unobserve(en.target); }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.card, .role, .kf__grid > div, .backed__stat, .intro__grid > *').forEach((el) => {
  el.style.opacity = 0; el.style.transform = 'translateY(24px)';
  el.style.transition = 'opacity .7s ease, transform .7s ease';
  io.observe(el);
});
