// ===== Zero Drive — scroll-driven "driving" hero =====
// GSAP ScrollTrigger pins the scene; scrolling drives the truck, ticks the
// speedometer, scrolls the road + ghost text, and reveals each stage of copy.
// If JS/GSAP is unavailable or the user prefers reduced motion, the CSS leaves
// a clean static hero (stage 1 only), and the full "How We Operate" / numbers
// content still lives in the sections further down the page.
(function () {
  const stage = document.getElementById('drive');
  if (!stage || typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  gsap.registerPlugin(ScrollTrigger);

  // Scrolling stays native (no smooth-scroll library): a JS-driven scroller runs on the main
  // thread and can stall while the 3D scene renders, leaving the page stuck part-way through.
  // The timeline's own `scrub` below is what smooths the motion.
  ScrollTrigger.config({ ignoreMobileResize: true });

  document.body.classList.add('drive-on');

  const ghost   = stage.querySelector('.drive__ghost span');
  const lanes   = stage.querySelector('.drive__lanes');
  const speedEl = document.getElementById('driveSpeed');
  const p1 = stage.querySelector('.drive__panel--1');
  const p2 = stage.querySelector('.drive__panel--2');
  const p3 = stage.querySelector('.drive__panel--3');

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: stage,
      start: 'top top',
      end: '+=1300%',
      scrub: 0.8,
      pin: '.drive__scene',
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });

  // Timeline time (0..13) for the 3D truck scene in js/truck3d.js
  window.zdDrive = { get t() { return tl.time(); } };

  // Continuous motion across the whole scroll (road + ghost text + slight truck drift)
  tl.to(lanes, { backgroundPositionX: '-1800px', duration: 3 }, 0);
  // Ghost headline travels its full length, so the last word ("HIGHWAYS") is
  // fully on screen before the pin releases.
  tl.to(ghost, { x: () => -Math.max(0, ghost.offsetWidth + window.innerWidth * 0.04 - window.innerWidth), duration: 2.7 }, 0);

  // Speedometer 0 -> 60 KM/H
  const spd = { v: 0 };
  tl.to(spd, { v: 60, duration: 3, onUpdate: () => { if (speedEl) speedEl.textContent = Math.round(spd.v); } }, 0);

  // Staged copy: headline -> how we operate -> numbers
  tl.to(p1, { autoAlpha: 0, y: -32, duration: 0.5, ease: 'power1.in' }, 0.55);
  tl.fromTo(p2, { autoAlpha: 0, y: 36 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power1.out' }, 0.95);
  tl.to(p2, { autoAlpha: 0, y: -32, duration: 0.5, ease: 'power1.in' }, 1.75);
  tl.fromTo(p3, { autoAlpha: 0, y: 36 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power1.out' }, 2.15);

  // ---- Stage 4: camera lifts to a top-down view (js/truck3d.js), the truck
  // follows the curve, then the heading pins on the left while the feature
  // feed scrolls past on the right as the truck keeps driving. ----
  const road  = stage.querySelector('.drive__road');
  const ghostWrap = stage.querySelector('.drive__ghost');
  const hint  = stage.querySelector('.drive__hint');
  const left  = stage.querySelector('.drive__split-left');
  const right = stage.querySelector('.drive__split-right');
  const feed  = stage.querySelector('.drive__feed');
  const lead  = stage.querySelector('.drive__split-lead');
  const vh = () => window.innerHeight;

  tl.to(p3, { autoAlpha: 0, y: -32, duration: 0.4, ease: 'power1.in' }, 3.0);
  tl.to([ghostWrap, hint], { autoAlpha: 0, duration: 0.4 }, 3.0);
  tl.to([road, stage.querySelector('.drive__sky')], { autoAlpha: 0, duration: 0.7 }, 3.1);          // dark half fades to the light page as the camera lifts

  const phone = () => window.innerWidth < 861;
  tl.fromTo(left, { autoAlpha: 0, y: () => (phone() ? 20 : vh() * 0.55) }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power2.out' }, 5.5);   // scrolls up, then holds (phones: fades in place, clear of the truck)
  tl.fromTo(lead, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, 6.2);
  tl.set(right, { autoAlpha: 1 }, 6.0);
  tl.fromTo(feed, { y: () => vh() }, { y: () => vh() * 0.34 - feed.offsetHeight, duration: 2.5 }, 6.0);                       // feed travels with the drive

  // ---- Stage 5: the drive ends, the landscape dissolves into a map of India (js/truck3d.js),
  // and the corridors draw in one by one; the card tracks which one your scroll is on. ----
  const mapcard = stage.querySelector('.drive__mapcard');
  const mapnote = stage.querySelector('.drive__mapnote');
  const routeList = stage.querySelector('.drive__routes');
  const routeItems = [...routeList.querySelectorAll('li')];
  const countEl = document.getElementById('driveCount');
  const T_MAP = 10.3, GAP = 0.34;                                  // must match js/truck3d.js
  tl.to([left, right], { autoAlpha: 0, duration: 0.35 }, 8.5);
  tl.fromTo(mapcard, { autoAlpha: 0, x: -40 }, { autoAlpha: 1, x: 0, duration: 0.55, ease: 'power2.out' }, 9.55);
  tl.fromTo(mapnote, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, 9.9);
  tl.to({}, { duration: 0.01 }, 12.99);                                                                                       // timeline runs to t = 13
  const nowLabel = document.getElementById('driveNowLabel'), nowName = document.getElementById('driveNowName'), nowNote = document.getElementById('driveNowNote');
  const bar = stage.querySelector('.drive__mapbar i');
  tl.eventCallback('onUpdate', () => {
    const t = tl.time(); let done = 0, active = -1;
    routeItems.forEach((li, i) => {
      const t0 = T_MAP + i * GAP, isDone = t >= t0 + GAP, isNow = t >= t0 && !isDone;
      li.classList.toggle('is-done', isDone); li.classList.toggle('is-now', isNow);
      if (isDone) done++; if (isNow) active = i;
    });
    const p = Math.min(1, Math.max(0, (t - T_MAP) / (routeItems.length * GAP)));
    routeList.style.setProperty('--p', p.toFixed(3));                           // rail and top bar fill with the scroll
    if (bar) bar.style.transform = `scaleX(${p.toFixed(3)})`;
    if (countEl) countEl.textContent = done;
    const all = done === routeItems.length, show = active >= 0 ? active : all ? routeItems.length - 1 : done;   // tracing / finished / up next
    const li = routeItems[show];
    if (nowName && li && nowName.dataset.i !== `${show}-${active}-${all}`) {
      nowName.dataset.i = `${show}-${active}-${all}`;
      nowLabel.textContent = active >= 0 ? 'Now tracing' : all ? 'All corridors traced' : 'Up next';
      nowName.textContent = all && active < 0 ? '7 corridors, 2 charging stations being set up' : li.querySelector('span').textContent;
      nowNote.textContent = all && active < 0 ? 'Trailers are now running every route on the map.' : active >= 0 || done ? li.dataset.note : 'Scroll to start tracing the corridors.';
    }
    mapcard.classList.toggle('is-complete', all);
  });
})();
