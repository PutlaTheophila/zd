// ===== Zero Drive — procedural 3D truck + road for the scroll hero =====
// Built from code in real-world metres (6x4 cab-over tractor + 40ft high-cube
// container on a 3-axle skeletal trailer), lit with a generated sky environment
// so paint, glass and alloy pick up reflections.
// Scroll time comes from js/scroll-hero.js via window.zdDrive.t (0..8.5); it
// drives the distance travelled along a curved road (wheels roll to match) and
// the camera, which goes front three-quarter -> side-on -> top-down.
// If WebGL or three.js is unavailable the hero shows its copy without a truck.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

// The loading screen (index.html) stays up until every part below has reported in: logo texture, India map data,
// neighbouring countries, and the first drawn frame. window.zdAssetsReady is what it watches.
const assets = { left: 4, done() { if (--this.left <= 0) window.zdAssetsReady = true; } };
const canvas = document.getElementById('driveCanvas');
const sceneEl = canvas && canvas.closest('.drive__scene');
if (canvas && sceneEl) {
  try { init(); } catch (err) { console.warn('[truck3d] 3D scene unavailable:', err); window.zdAssetsReady = true; }
} else window.zdAssetsReady = true;

function init() {
  const R = 0.52;              // wheel radius
  const SPEED = 60;            // metres driven per unit of timeline time
  const ROAD_PERIOD = 12;      // metres per lane-dash repeat
  const ROAD_W = 11.4;
  // Route (x/z plane): straight along +x, a 90-degree bend, then straight along -z
  const S1 = 280, RR = ROAD_W * 1.75, S2 = S1 + (Math.PI / 2) * RR;   // bend radius is 1.75 road widths, as in the reference junction
  function route(s) {
    if (s <= S1) return { x: s, z: 0, h: 0 };
    if (s <= S2) { const a = (s - S1) / RR; return { x: S1 + RR * Math.sin(a), z: -RR + RR * Math.cos(a), h: a }; }
    return { x: S1 + RR, z: -RR - (s - S2), h: Math.PI / 2 };
  }
  const PI = Math.PI;

  // Phones and low-power devices get a lighter scene: fewer pixels, smaller textures and shadow map,
  // fewer trees, simpler truck copies on the map, and a still image (not a second 3D view) in the contact panel.
  const LITE = window.matchMedia('(max-width: 860px), (pointer: coarse)').matches || (navigator.hardwareConcurrency || 8) <= 4;
  // Phones save effort on scenery (fewer trees, smaller shadow map), not on sharpness: a phone screen has few CSS pixels,
  // so smooth edges and 2x resolution cost no more there than on a laptop, and the truck is what people look at.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x5c9a3e, 70, 240);                 // distance haze in meadow green, matching the page behind the canvas
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 4000);

  // ---------- texture helper ----------
  function canvasTex(w, h, draw, color = true) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }

  // ---------- environment (generated sky: gives reflections on paint/glass) ----------
  {
    const env = new THREE.Scene();
    const skyTex = canvasTex(16, 512, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#9cc6ee'); gr.addColorStop(0.38, '#e6f0fa'); gr.addColorStop(0.495, '#ffffff');
      gr.addColorStop(0.515, '#2a3b5c'); gr.addColorStop(1, '#0a1424');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    env.add(new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide })));
    const panel = (x, y, z, s, k) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.5, 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k) }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
    };
    panel(10, 34, -30, 26, 9); panel(-30, 18, 20, 18, 3);
    panel(34, 16, -26, 16, 6); panel(-18, 30, -34, 22, 5); panel(4, 52, 6, 30, 4);   // extra soft boxes: front, rear quarter, overhead
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(env, 0.03).texture;
    scene.environmentIntensity = 0.85;
    pmrem.dispose();
  }

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1b2a4a, 0.35));
  const sun = new THREE.DirectionalLight(0xfff6e8, 2.6);
  sun.position.set(13, 22, -17);
  sun.castShadow = true;
  sun.shadow.mapSize.set(LITE ? 1024 : 2048, LITE ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 12, bottom: -12, near: 1, far: 80 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02; sun.shadow.radius = 5;
  scene.add(sun); scene.add(sun.target);
  const kick = new THREE.DirectionalLight(0x2ec0d7, 0.8);   // cyan rim from behind
  kick.position.set(-14, 6, 14);
  scene.add(kick);

  // ---------- materials ----------
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, ...o });
  const M = {
    paint: new THREE.MeshPhysicalMaterial({ color: 0x009bd6, roughness: 0.4, metalness: 0.28, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.0 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x0b1826, roughness: 0.04, metalness: 1, envMapIntensity: 1.5 }),
    black: std(0x0b0d10, { roughness: 0.5 }),
    gloss: std(0x08090b, { roughness: 0.15, metalness: 0.4 }),
    plastic: std(0x14171b, { roughness: 0.75 }),
    chassis: std(0x1a1d22, { roughness: 0.6, metalness: 0.4 }),
    steel: std(0x9aa3ad, { roughness: 0.35, metalness: 0.9 }),
    frame: std(0x1d3fb0, { roughness: 0.45, metalness: 0.25 }),
    contTrim: std(0x12227a, { roughness: 0.5, metalness: 0.3 }),
    tire: std(0x0d0d0f, { roughness: 0.92, metalness: 0, side: THREE.DoubleSide }),
    lamp: std(0xffffff, { emissive: 0xe8f7ff, emissiveIntensity: 2.2 }),
    red: std(0xd5252b, { emissive: 0xff2020, emissiveIntensity: 1.3 }),
    amber: std(0xffa51f, { emissive: 0xff9a1a, emissiveIntensity: 1.6 }),
  };

  // ---------- geometry helpers ----------
  const truck = new THREE.Group(); scene.add(truck);
  function add(geo, mat, x = 0, y = 0, z = 0, parent = truck, shadow = true) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = shadow;
    parent.add(m); return m;
  }
  const box = (w, h, d, mat, x, y, z, parent, shadow) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent, shadow);
  // extrude a side profile (x/y) across the vehicle width, centred on z
  function extrude(shape, width, bevel = 0.03, seg = 3) {
    const g = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: seg, curveSegments: 20 });
    g.translate(0, 0, -(width - bevel * 2) / 2);
    return g;
  }
  function rrect(w, h, r) {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  const rbox = (w, h, d, r, mat, x, y, z, parent) => add(extrude(rrect(w, h, r), d, Math.min(r, 0.03)), mat, x, y, z, parent);
  function arcBand(ri, ro, a0, a1) {
    const s = new THREE.Shape();
    s.absarc(0, 0, ro, a0, a1, false); s.absarc(0, 0, ri, a1, a0, true); s.closePath();
    return s;
  }
  // flat decal facing ±z (side) or +x (front)
  function decal(tex, w, h, x, y, z, rotY, parent = truck) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.position.set(x, y, z); m.rotation.y = rotY; parent.add(m); return m;
  }

  // ---------- road ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), std(0x0e1c33, { roughness: 1, metalness: 0, transparent: true }));
  ground.rotation.x = -PI / 2; ground.receiveShadow = true; scene.add(ground);

  // road surface texture; either edge line can be left off where two carriageways merge
  const roadMat = (top, bottom, dashes = true) => {
    const tex = canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#17181b'; g.fillRect(0, 0, w, h);          // black asphalt
      for (let i = 0; i < 9000; i++) {                           // aggregate: light and dark flecks in the tarmac
        g.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${Math.random() * 0.07})` : `rgba(0,0,0,${Math.random() * 0.25})`;
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      g.fillStyle = 'rgba(255,255,255,.8)';
      if (top) g.fillRect(0, 10, w, 6);                           // +z side (outside of the bend)
      if (bottom) g.fillRect(0, h - 16, w, 6);
      g.fillStyle = 'rgba(255,255,255,.72)';
      if (dashes) [h / 3, (2 * h) / 3].forEach((y) => g.fillRect(0, y - 3, w * 0.42, 6));
    });
    tex.wrapS = THREE.RepeatWrapping;
    return std(0xffffff, { map: tex, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
  };
  // flat strip of the given width following a path function between two distances
  function ribbon(path, from, to, width, y, mat, parent = scene) {
    const pos = [], uv = [], idx = [], n = Math.max(1, Math.ceil((to - from) / 1.5));
    for (let i = 0; i <= n; i++) {
      const sv = from + (to - from) * (i / n), r = path(sv);
      const nx = Math.sin(r.h), nz = Math.cos(r.h);               // across-road direction
      pos.push(r.x + nx * width / 2, y, r.z + nz * width / 2, r.x - nx * width / 2, y, r.z - nz * width / 2);
      uv.push(sv / ROAD_PERIOD, 1, sv / ROAD_PERIOD, 0);
      if (i < n) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; parent.add(m); return m;
  }
  // Junction at the bend, laid out to the proportions of the reference (all in road widths):
  //  - the truck's road turns through 90 degrees on a tight radius into the exit road,
  //  - the road it arrived on carries on, but steps sideways by one road width through an S-bend
  //    that starts on the same arc as the truck's curve,
  //  - a small-radius corner joins that road to the far side of the exit road,
  //  - a hatched island fills the outer lane of the bend, bounded by three lane lines.
  const HW = ROAD_W / 2, LANE = ROAD_W / 3;
  const EXIT_X = S1 + RR, PHI = Math.acos(1 - ROAD_W / (2 * RR)), S_BEND = 2 * RR * PHI;   // S-bend: two equal arcs, total drop = one road width
  const sroad = (sv) => {
    if (sv <= RR * PHI) { const a = sv / RR; return { x: S1 + RR * Math.sin(a), z: -RR + RR * Math.cos(a), h: a }; }
    if (sv <= S_BEND) { const b = PHI - (sv - RR * PHI) / RR; return { x: S1 + 2 * RR * Math.sin(PHI) - RR * Math.sin(b), z: -RR + 2 * RR * Math.cos(PHI) - RR * Math.cos(b), h: b }; }
    return { x: S1 + 2 * RR * Math.sin(PHI) + (sv - S_BEND), z: -ROAD_W, h: 0 };
  };
  const R2 = HW + 1.85, SLIP = { x: EXIT_X + R2, z: -ROAD_W - R2 }, SLIP_ARC = R2 * PI / 2, SLIP_LEN = SLIP_ARC + 14;   // tight corner, then down the exit road
  const slip = (sv) => {
    if (sv > SLIP_ARC) return { x: EXIT_X, z: SLIP.z - (sv - SLIP_ARC), h: PI / 2 };
    const a = sv / R2; return { x: SLIP.x - R2 * Math.sin(a), z: SLIP.z + R2 * Math.cos(a), h: PI - a };
  };
  const S_OPEN = S_BEND + (SLIP.x - (S1 + 2 * RR * Math.sin(PHI))) + 2, S_END = 640;    // S-road's near edge stays open across the junction mouth
  const roadFull = roadMat(true, true);
  ribbon(route, -300, S1, ROAD_W, 0.012, roadFull);
  ribbon(route, S1, S2, ROAD_W, 0.012, roadMat(false, true));               // outer edge line open right through the bend
  ribbon(route, S2, S2 + 520, ROAD_W, 0.012, roadFull);
  ribbon(sroad, 0, S_OPEN, ROAD_W, -0.07, roadMat(true, false, false));      // no lane dashes through the junction mouth; layers sit centimetres apart
  ribbon(sroad, S_OPEN, S_END, ROAD_W, -0.07, roadFull);
  ribbon(slip, 0, SLIP_LEN, ROAD_W, -0.055, roadMat(false, false, false));   // plain surface: no lines, so nothing crosses in the junction
  {
    // island: far road's lane line, then the corner's lane-line arc, then back up the bend's outer lane line
    const RO = RR + HW - LANE, RS = R2 - HW + LANE, ZT = -ROAD_W - HW + LANE, C = { x: S1, z: -RR };
    const onMain = (a) => [C.x + RO * Math.sin(a), C.z + RO * Math.cos(a)];
    const onSlip = (b) => [SLIP.x - RS * Math.sin(b), SLIP.z + RS * Math.cos(b)];
    const a0 = Math.acos((ZT - C.z) / RO), b0 = Math.acos(Math.min(1, (ZT - SLIP.z) / RS));
    let a1 = a0, b1 = b0;                                                     // walk both arcs down to where they meet
    // The two lane lines only just touch, so stop at the first near-contact and never go past the corner's centre
    // line: running on round the corner circle is what drew the stray tall outline.
    for (let z = ZT - 0.02; z > SLIP.z; z -= 0.02) {
      a1 = Math.acos((z - C.z) / RO); b1 = Math.acos((z - SLIP.z) / RS);
      if (onMain(a1)[0] >= onSlip(b1)[0] - 0.25) break;
    }
    const outer = [];
    for (let k = 0; k <= 16; k++) outer.push(onSlip(b0 + (b1 - b0) * (k / 16)));
    for (let k = 16; k >= 0; k--) outer.push(onMain(a0 + (a1 - a0) * (k / 16)));
    const xs = outer.map((q) => q[0]), zs = outer.map((q) => q[1]);
    const X0 = Math.min(...xs) - 0.5, X1 = Math.max(...xs) + 0.5, Z0 = Math.min(...zs) - 0.5, Z1 = Math.max(...zs) + 0.5;
    const U = (x) => (x - X0) / (X1 - X0), V = (z) => (z - Z0) / (Z1 - Z0);
    const pos = [X0, 0.03, Z0, X1, 0.03, Z0, X1, 0.03, Z1, X0, 0.03, Z1], uv = [0, 0, 1, 0, 1, 1, 0, 1];   // a quad; the texture carries the shape
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex([0, 1, 2, 0, 2, 3]); geo.computeVertexNormals();
    const tex = canvasTex(768, 768, (g, w, h) => {
      const px = (q) => [U(q[0]) * w, h - V(q[1]) * h];
      const trace = () => { g.beginPath(); outer.forEach((q, k) => { const [x, y] = px(q); k ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); };
      trace(); g.save(); g.clip();
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 20;
      const pitch = (1.25 / (X1 - X0)) * w;                                    // hatch bars about 1.15 m apart
      for (let k = -h; k < w + h; k += pitch) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h * 0.75, h); g.stroke(); }
      g.restore();
      trace(); g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 24; g.lineJoin = 'round'; g.stroke();   // outline (path re-traced: the hatch loop replaced it)
    });
    const island = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.8, metalness: 0, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    island.receiveShadow = true; scene.add(island);
  }

  // ---------- grassy landscape for the top-down stage ----------
  // Sits under the dark hero ground and is revealed as that fades while the camera lifts:
  // a detailed tiling grass texture, a large-scale tint layer to break up the tiling,
  // a gravel shoulder along the road, and groves of trees with soft ground shadows.
  // Copy painted on the grass beside the straight after the bend (wide screens only; phones keep the HTML cards).
  // From above, screen-left is +x and the truck drives towards -z, so later blocks sit at more negative z.
  const GT = { rx: S1 + RR, w: 24, near: 9, head: { z: -64, h: 22 }, items: [-104, -138, -172, -206], itemH: 10 };
  const textClear = (x, z, m) => {                                                   // keeps trees and bushes off the lettering
    const dx = x - GT.rx;
    if (dx > GT.near - m && dx < GT.near + GT.w + m && Math.abs(z - GT.head.z) < GT.head.h / 2 + m) return false;
    if (-dx > GT.near - m && -dx < GT.near + GT.w + m) for (const iz of GT.items) if (Math.abs(z - iz) < GT.itemH / 2 + m) return false;
    return true;
  };
  const land = new THREE.Group(); land.visible = false; scene.add(land);
  const trees = new THREE.Group(); trees.visible = false; land.add(trees);   // only shown from above (see frame())
  {
    let seed = 91; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const GT = LITE ? 1024 : 2048, TILE = 56;                                        // texture px, metres per repeat
    const grassTex = canvasTex(GT, GT, (g, w) => {
      g.fillStyle = '#4c8733'; g.fillRect(0, 0, w, w);
      const wrap = (x, y, r, draw) => { for (const ox of [-w, 0, w]) for (const oy of [-w, 0, w]) if (x + ox > -r && x + ox < w + r && y + oy > -r && y + oy < w + r) draw(x + ox, y + oy); };
      const tones = ['#6fae45', '#3a6f27', '#5d9a3b', '#2f5f22', '#86b84f', '#456f2c'];
      for (let i = 0; i < 420; i++) {                                  // soft light/dark patches
        const x = rnd() * w, y = rnd() * w, r = 40 + rnd() * 150, c = tones[(rnd() * tones.length) | 0];
        wrap(x, y, r, (px, py) => {
          const gr = g.createRadialGradient(px, py, 0, px, py, r);
          gr.addColorStop(0, c + '66'); gr.addColorStop(1, c + '00');
          g.fillStyle = gr; g.fillRect(px - r, py - r, r * 2, r * 2);
        });
      }
      g.lineCap = 'round';
      const blades = ['#7cc04a', '#2e5d20', '#93c95a', '#4f8f35', '#3b7528', '#a6cf63', '#25501b'];
      for (let i = 0; i < (LITE ? 34000 : 120000); i++) {                               // individual blades / tufts
        const x = rnd() * w, y = rnd() * w, a = rnd() * PI * 2, l = 4 + rnd() * 11;
        g.strokeStyle = blades[(rnd() * blades.length) | 0]; g.globalAlpha = 0.35 + rnd() * 0.5; g.lineWidth = 0.8 + rnd() * 1.4;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
      }
      g.globalAlpha = 1;
      for (let i = 0; i < 2600; i++) {                                 // clover, wildflowers, bare specks
        const k = rnd(); g.fillStyle = k < 0.45 ? '#f4f1c8' : k < 0.7 ? '#f2d24a' : k < 0.85 ? '#e9eef2' : '#7a6a48';
        g.globalAlpha = 0.75; g.beginPath(); g.arc(rnd() * w, rnd() * w, 0.9 + rnd() * 1.6, 0, PI * 2); g.fill();
      }
      g.globalAlpha = 1;
    });
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set(3000 / TILE, 3000 / TILE);
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), std(0xffffff, { map: grassTex, roughness: 1, metalness: 0, envMapIntensity: 0.3 }));
    grass.rotation.x = -PI / 2; grass.position.y = -0.3; grass.receiveShadow = true; land.add(grass);

    const tintTex = canvasTex(512, 512, (g, w) => {                    // broad meadow variation
      for (let i = 0; i < 70; i++) {
        const x = rnd() * w, y = rnd() * w, r = 30 + rnd() * 110, k = rnd();
        const c = k < 0.4 ? '20,60,20' : k < 0.75 ? '170,190,70' : '90,150,60';
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, `rgba(${c},.34)`); gr.addColorStop(1, `rgba(${c},0)`);
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
    });
    tintTex.wrapS = tintTex.wrapT = THREE.MirroredRepeatWrapping; tintTex.repeat.set(3000 / 230, 3000 / 230);
    const tint = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshBasicMaterial({ map: tintTex, transparent: true, depthWrite: false, toneMapped: false }));
    tint.rotation.x = -PI / 2; tint.position.y = -0.27; land.add(tint);

    // gravel shoulder: a slightly wider ribbon under the road
    const sp = [], si = [], SW = ROAD_W + 3.2, a0 = 150, a1 = S2 + 700, n = Math.ceil((a1 - a0) / 1.5);
    for (let i = 0; i <= n; i++) {
      const r = route(a0 + i * 1.5), nx = Math.sin(r.h), nz = Math.cos(r.h);
      sp.push(r.x + nx * SW / 2, -0.12, r.z + nz * SW / 2, r.x - nx * SW / 2, -0.12, r.z - nz * SW / 2);
      if (i < n) { const k = i * 2; si.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setIndex(si); sg.computeVertexNormals();
    const shoulder = new THREE.Mesh(sg, std(0xb7ad94, { roughness: 1, metalness: 0, side: THREE.DoubleSide })); shoulder.receiveShadow = true; land.add(shoulder);
    ribbon(sroad, 0, S_END, SW, -0.16, shoulder.material, land);
    ribbon(slip, 0, SLIP_LEN, SW, -0.14, shoulder.material, land);

    // trees: canopies in groves, kept clear of the road
    const hash = (x, y) => { const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return v - Math.floor(v); };
    const vnoise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
    const pts = []; for (let sv = 120; sv < S2 + 700; sv += 4) pts.push(route(sv));
    for (let sv = 0; sv < S_END; sv += 4) pts.push(sroad(sv));            // keep the onward road clear too
    for (let sv = 0; sv < SLIP_LEN; sv += 4) pts.push(slip(sv));          // ...and the slip road
    const offRoad = (x, z, m) => { for (const q of pts) { const dx = q.x - x, dz = q.z - z; if (dx * dx + dz * dz < m * m) return false; } return true; };
    const spots = [];
    for (let i = 0; i < 9000 && spots.length < (LITE ? 170 : 560); i++) {
      const x = 90 + rnd() * 380, z = -760 + rnd() * 850;
      if (vnoise(x / 46, z / 46) < 0.47) continue;                     // groves, with open meadow between
      if (!offRoad(x, z, 13) || !textClear(x, z, 5)) continue;
      spots.push({ x, z, r: 1.7 + rnd() * 3.1 });
    }

    // Foliage: lumpy displaced crowns (three shapes), a leaf-cluster texture that is also the bump map,
    // crevices darkened per vertex, and every tree built from several overlapping lobes plus undergrowth.
    const leafTex = canvasTex(512, 512, (g, w) => {
      g.fillStyle = '#93a67f'; g.fillRect(0, 0, w, w);
      const tones = ['#5f7d4b', '#cfe0ae', '#7f9c63', '#eef6d3', '#a9c487', '#4a6239', '#dbe9bd', '#88a56b'];
      for (let i = 0; i < 5200; i++) {                                 // overlapping leaves
        const x = rnd() * w, y = rnd() * w, a = rnd() * PI, rx = 4 + rnd() * 8, ry = rx * (0.35 + rnd() * 0.3);
        g.fillStyle = tones[(rnd() * tones.length) | 0]; g.globalAlpha = 0.75 + rnd() * 0.25;
        g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, PI * 2); g.fill();
        g.strokeStyle = 'rgba(40,60,30,.35)'; g.lineWidth = 0.7; g.beginPath();        // midrib
        g.moveTo(x - Math.cos(a) * rx, y - Math.sin(a) * rx); g.lineTo(x + Math.cos(a) * rx, y + Math.sin(a) * rx); g.stroke();
      }
      g.globalAlpha = 0.7; g.fillStyle = '#2c3d22';
      for (let i = 0; i < 900; i++) { g.beginPath(); g.ellipse(rnd() * w, rnd() * w, 2 + rnd() * 5, 1.5 + rnd() * 3, rnd() * PI, 0, PI * 2); g.fill(); }   // gaps between leaves
      g.globalAlpha = 1;
    });
    leafTex.wrapS = leafTex.wrapT = THREE.RepeatWrapping; leafTex.repeat.set(2, 2);
    const crownGeo = (o) => {
      const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position, c = new Float32Array(p.count * 3), d = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        d.fromBufferAttribute(p, i).normalize();
        const f = vnoise(d.x * 2.2 + o, d.y * 2.2 + d.z * 1.7) * 0.55 + vnoise(d.x * 5.5 + o, d.z * 5.5 + d.y * 3.1) * 0.45;
        const r = 0.74 + 0.56 * f; p.setXYZ(i, d.x * r, d.y * r, d.z * r);
        const k = (0.42 + 0.85 * f) * (0.7 + 0.3 * (d.y * 0.5 + 0.5)); c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k;     // dark crevices, lit tops
      }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      const nr = new Float32Array(p.count * 3);                        // smooth, rounded shading instead of flat facets
      for (let i = 0; i < p.count; i++) { d.fromBufferAttribute(p, i).normalize(); nr[i * 3] = d.x; nr[i * 3 + 1] = d.y; nr[i * 3 + 2] = d.z; }
      g.setAttribute('normal', new THREE.BufferAttribute(nr, 3)); return g;
    };
    const LOBES = LITE ? 4 : 6, BUSHES = LITE ? 220 : 900, total = spots.length * LOBES + BUSHES;
    const leafMat = std(0xffffff, { map: leafTex, bumpMap: leafTex, bumpScale: 3, vertexColors: true, roughness: 0.95, metalness: 0, envMapIntensity: 0.3 });
    const crowns = [3.3, 11.7, 27.1].map((o) => new THREE.InstancedMesh(crownGeo(o), leafMat, Math.ceil(total / 3) + 1));
    const used = [0, 0, 0];
    const shadowTex = canvasTex(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(8,24,10,.5)'); gr.addColorStop(0.6, 'rgba(8,24,10,.28)'); gr.addColorStop(1, 'rgba(8,24,10,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
    const blobGeo = new THREE.CircleGeometry(1, 20); blobGeo.rotateX(-PI / 2);
    const blobs = new THREE.InstancedMesh(blobGeo, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false }), total);
    const mtx = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v3 = new THREE.Vector3(), sc = new THREE.Vector3(), colr = new THREE.Color(), eul = new THREE.Euler();
    const leaf = [0x3f8a2c, 0x56a238, 0x2f7028, 0x6bb040, 0x3c8040, 0x7fae3e, 0x2a6430, 0x8fb84a];
    let nb = 0;
    const lobe = (x, y, z, lr, hex, squash) => {
      const m = nb % 3, mesh = crowns[m], at = used[m]++;
      q4.setFromEuler(eul.set(rnd() * PI, rnd() * PI, rnd() * PI));
      mtx.compose(v3.set(x, y, z), q4, sc.set(lr, lr * squash, lr)); mesh.setMatrixAt(at, mtx);
      mesh.setColorAt(at, colr.setHex(hex).multiplyScalar(0.78 + rnd() * 0.5));
      q4.identity(); mtx.compose(v3.set(x - y * 0.6, -0.2, z + y * 0.75), q4, sc.set(lr * 1.45, 1, lr * 1.3));   // soft shadow, cast away from the sun
      blobs.setMatrixAt(nb++, mtx);
    };
    spots.forEach((t) => {
      const base = leaf[(rnd() * leaf.length) | 0];
      for (let l = 0; l < LOBES; l++) {
        const a = rnd() * PI * 2, off = l ? t.r * (0.3 + rnd() * 0.5) : 0, lr = t.r * (l ? 0.42 + rnd() * 0.28 : 0.74);
        lobe(t.x + Math.cos(a) * off, t.r * 0.85 + (l ? rnd() * t.r * 0.45 : t.r * 0.3), t.z + Math.sin(a) * off, lr, base, 0.82);
      }
    });
    for (let i = 0, made = 0; i < BUSHES * 6 && made < BUSHES; i++) {                 // undergrowth around the groves
      const t = spots[(rnd() * spots.length) | 0], a = rnd() * PI * 2, d = t.r * (1.1 + rnd() * 2.4), r = 0.45 + rnd() * 0.75;
      const x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
      if (!offRoad(x, z, 9) || !textClear(x, z, 1.5)) continue;
      lobe(x, r * 0.6, z, r, leaf[(rnd() * leaf.length) | 0], 0.7); made++;
    }
    blobs.count = nb; trees.add(blobs);
    crowns.forEach((m, i) => { m.count = used[i]; m.instanceColor.needsUpdate = true; trees.add(m); });

  }

  // ---------- low drifting mist for the top-down stage ----------
  // Soft cloud wisps hang between the ground and the camera along the route, so the
  // camera climbs through them as it zooms out and they slide past as the truck drives.
  const mist = new THREE.Group(); mist.visible = false; scene.add(mist);
  const mistMats = [];
  {
    let seed = 313; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const wisp = () => canvasTex(256, 256, (g, w) => {
      for (let i = 0; i < 38; i++) {
        const a = rnd() * PI * 2, d = Math.pow(rnd(), 1.4) * w * 0.3, r = 22 + rnd() * 46;
        const x = w / 2 + Math.cos(a) * d * 1.25, y = w / 2 + Math.sin(a) * d * 0.8;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(255,255,255,.3)'); gr.addColorStop(0.5, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
    });
    for (let i = 0; i < 4; i++) mistMats.push(new THREE.MeshBasicMaterial({ map: wisp(), transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false }));
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-PI / 2);
    for (let sv = 215, i = 0; sv < S2 + 560; sv += 13 + rnd() * 12, i++) {
      const r = route(sv), side = (rnd() - 0.5) * 150, w = 34 + rnd() * 46;
      const m = new THREE.Mesh(geo, mistMats[i % 4]);
      m.position.set(r.x + Math.sin(r.h) * side, 20 + rnd() * 38, r.z + Math.cos(r.h) * side);
      m.scale.set(w, 1, w * (0.55 + rnd() * 0.4)); m.rotation.y = rnd() * PI;
      m.renderOrder = 5; mist.add(m);
    }
  }

  // ---------- clouds: soft cumulus billboards on the far horizon ----------
  const clouds = new THREE.Group(); scene.add(clouds);
  {
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const cloudTex = () => canvasTex(512, 256, (g, w, h) => {
      const base = h * 0.7;
      for (let i = 0; i < 46; i++) {
        const r = 26 + rnd() * 58, spread = (rnd() + rnd() + rnd()) / 3;         // clustered toward the middle
        const x = w * 0.12 + spread * w * 0.76, y = base - r * 0.55 - rnd() * (h * 0.36) * (1 - Math.abs(spread - 0.5) * 1.8);
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(0.55, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      g.globalCompositeOperation = 'source-atop';                                // grey-blue undersides
      const sh = g.createLinearGradient(0, h * 0.3, 0, h * 0.82);
      sh.addColorStop(0, 'rgba(140,165,198,0)'); sh.addColorStop(1, 'rgba(140,165,198,.55)');
      g.fillStyle = sh; g.fillRect(0, 0, w, h);
    });
    const tex = [cloudTex(), cloudTex(), cloudTex(), cloudTex()];
    const DEG = PI / 180;
    for (let i = 0; i < 16; i++) {
      const z = 1100 + rnd() * 700, w = 260 + rnd() * 420, elev = (5.5 + rnd() * 9.5) * DEG;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.46),
        new THREE.MeshBasicMaterial({ map: tex[i % 4], transparent: true, opacity: 0.82 + rnd() * 0.16, depthWrite: false, fog: false, toneMapped: false }));
      m.position.set(-1900 + (i + rnd()) * 215, z * Math.tan(elev), z);
      m.rotation.y = PI;                                                         // face the camera side (-z)
      if (rnd() > 0.5) m.scale.x = -1;
      clouds.add(m);
    }
  }

  // ---------- wheels ----------
  const lathe = (pts, seg = 48) => {
    const g = new THREE.LatheGeometry(pts.map(([r, a]) => new THREE.Vector2(r, a)), seg);
    g.rotateX(PI / 2);            // lathe axis -> z (outer face toward +z)
    return g;
  };
  // tyre cross-section: rounded shoulders + two tread grooves
  const tireGeo = (w) => {
    const h = w / 2;
    return lathe([[0.3, -h + 0.03], [0.4, -h + 0.005], [0.47, -h + 0.015], [0.505, -h + 0.045], [R, -h + 0.075],
      [R, -0.04], [0.505, -0.035], [0.505, -0.02], [R, -0.015], [R, 0.015], [0.505, 0.02], [0.505, 0.035], [R, 0.04],
      [R, h - 0.075], [0.505, h - 0.045], [0.47, h - 0.015], [0.4, h - 0.005], [0.3, h - 0.03]]);
  };
  // alloy rim texture, mapped around (u) and along the profile (v)
  const rimTex = canvasTex(512, 256, (g, w, h) => {
    const vy = (i) => h - (i / 8) * h;                 // profile point index -> canvas y
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#aeb5bf'); gr.addColorStop(0.3, '#d9dde3'); gr.addColorStop(1, '#c2c8d0');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c4161c'; g.fillRect(0, vy(1.6), w, h);            // red hub cap
    g.fillStyle = '#2a2f36'; g.fillRect(0, vy(2.1), w, 5);
    g.fillStyle = '#4a525c';                                           // lug nuts
    for (let i = 0; i < 10; i++) { g.beginPath(); g.arc((i + 0.5) * (w / 10), vy(3.5), 9, 0, PI * 2); g.fill(); }
    g.fillStyle = '#0e1013';                                           // hand holes
    for (let i = 0; i < 8; i++) { g.beginPath(); g.ellipse((i + 0.5) * (w / 8), vy(5.5), 17, 11, 0, 0, PI * 2); g.fill(); }
  });
  const rimMat = std(0xffffff, { map: rimTex, roughness: 0.28, metalness: 0.85, side: THREE.DoubleSide });
  const rimSteer = lathe([[0, 0.07], [0.07, 0.07], [0.085, 0.03], [0.12, 0.02], [0.19, 0.01], [0.2, -0.01], [0.275, -0.05], [0.3, -0.005], [0.318, -0.03]]);
  const rimDrive = lathe([[0, 0.03], [0.075, 0.03], [0.09, -0.01], [0.12, -0.1], [0.19, -0.11], [0.2, -0.115], [0.275, -0.04], [0.3, -0.005], [0.318, -0.03]]);
  const tireN = tireGeo(0.3), tireW = tireGeo(0.34);
  const spinners = [];
  function wheel(x, side, dual, parent = truck) {
    const g = new THREE.Group();
    g.position.set(x, R, 0); if (side < 0) g.rotation.y = PI;      // local +z is always "outboard"
    const spin = new THREE.Group(); g.add(spin);
    const face = dual ? 1.22 : 1.2, w = dual ? 0.3 : 0.34;
    add(dual ? tireN : tireW, M.tire, 0, 0, face - w / 2, spin);
    if (dual) add(tireN, M.tire, 0, 0, face - w * 1.5 - 0.05, spin);
    add(dual ? rimDrive : rimSteer, rimMat, 0, 0, face - 0.02, spin);
    parent.add(g); spinners.push({ spin, side });
  }
  function axle(x, dual, fender = true) {
    [1, -1].forEach((s) => {
      wheel(x, s, dual);
      if (fender) add(extrude(arcBand(0.6, 0.635, 0.2, PI - 0.2), 0.68, 0), M.plastic, x, R, s * 0.9);
    });
    const tube = add(new THREE.CylinderGeometry(0.085, 0.085, 1.9, 16), M.chassis, x, R, 0);
    tube.rotation.x = PI / 2;
  }

  // ---------- tractor chassis ----------
  [1, -1].forEach((s) => {
    box(7.0, 0.26, 0.09, M.chassis, 4.25, 0.93, s * 0.42);                       // frame rails
    rbox(1.75, 0.62, 0.56, 0.06, M.plastic, 4.72, 0.8, s * 0.94);                // side boxes
    box(1.75, 0.03, 0.57, M.steel, 4.72, 1.115, s * 0.94);                       // tread plate tops
    box(0.02, 0.5, 0.62, M.plastic, 0.92, 0.62, s * 0.9);                        // mud flaps
    box(0.05, 0.12, 0.32, M.red, 0.78, 0.98, s * 0.7);                           // tail lamps
  });
  [0.9, 2.3, 3.6, 5.2].forEach((x) => box(0.1, 0.2, 0.84, M.chassis, x, 0.93, 0));
  add(new THREE.CylinderGeometry(0.5, 0.5, 0.07, 32), M.chassis, 2.28, 1.31, 0); // fifth wheel
  box(0.9, 0.2, 1.0, M.chassis, 2.28, 1.17, 0);
  axle(6.73, false, false); axle(2.95, true); axle(1.6, true);

  // ---------- cab (local origin = rear of cab on the ground) ----------
  // Styled after the SANY electric tractor: integrated high roof, black tiered
  // grille with chrome bars, body-colour bumper carrying the headlights.
  const cab = new THREE.Group(); cab.position.set(5.7, 0, 0); truck.add(cab);
  const AX = 1.03;                                         // front axle, cab-local x
  const BV = 0.1, BT = 0.15, CABW = 2.48;                  // edge rounding: outline offset / depth, overall width
  const side2 = (shape, width, bv, bt, seg = 6) => {       // extrude with separately tuned rounding
    const g = new THREE.ExtrudeGeometry(shape, { depth: width - bt * 2, bevelEnabled: true, bevelSize: bv, bevelThickness: bt, bevelSegments: seg, curveSegments: 28 });
    g.translate(0, 0, -(width - bt * 2) / 2);
    return g;
  };
  const prof = new THREE.Shape();
  prof.moveTo(0, 0.95); prof.lineTo(0.403, 0.95);
  prof.absarc(AX, R, 0.76, 2.54, -0.0263, true);           // wheel arch
  prof.lineTo(2.3, 0.5); prof.lineTo(2.38, 0.62); prof.lineTo(2.4, 1.95); prof.lineTo(2.33, 2.08);
  prof.lineTo(2.14, 3.2);                                  // windscreen
  prof.lineTo(1.97, 3.8); prof.quadraticCurveTo(1.92, 3.97, 1.6, 3.98);   // high-roof front
  prof.lineTo(0, 3.98); prof.closePath();
  add(side2(prof, CABW, BV, BT), M.paint, 0, 0, 0, cab);
  const SIDE = CABW / 2 + 0.004;                           // cab side face (z)
  const FLAT = CABW - BT * 2;                              // flat width of the front face

  // glass with a sky-gradient tint and a soft diagonal reflection
  // glass: a dark cab interior (seats, wheel, dash) seen through sky reflections
  const glassCanvas = (inner) => (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#1b2836'); bg.addColorStop(0.5, '#0d1620'); bg.addColorStop(1, '#070c13');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    inner(g, w, h);
    const sky = g.createLinearGradient(0, 0, 0, h);                               // reflected sky, strongest at the top
    sky.addColorStop(0, 'rgba(170,208,240,.62)'); sky.addColorStop(0.45, 'rgba(120,165,205,.2)'); sky.addColorStop(1, 'rgba(90,130,170,.04)');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    const st = g.createLinearGradient(0, h, w, 0);                                // diagonal glints
    st.addColorStop(0.28, 'rgba(255,255,255,0)'); st.addColorStop(0.44, 'rgba(255,255,255,.26)');
    st.addColorStop(0.5, 'rgba(255,255,255,.05)'); st.addColorStop(0.58, 'rgba(255,255,255,.16)'); st.addColorStop(0.7, 'rgba(255,255,255,0)');
    g.fillStyle = st; g.fillRect(0, 0, w, h);
  };
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); g.fill(); };
  const cabinFront = (g, w, h) => {
    g.fillStyle = '#2a3440'; g.fillRect(0, 0, w, h * 0.1);                        // headliner
    [0.2, 0.62].forEach((k) => {                                                   // two seats with headrests
      g.fillStyle = '#232c37'; rr(g, w * k, h * 0.42, w * 0.18, h * 0.6, 14);
      g.fillStyle = '#2c3643'; rr(g, w * (k + 0.045), h * 0.24, w * 0.09, h * 0.17, 9);
    });
    g.strokeStyle = '#05080c'; g.lineWidth = 9; g.beginPath(); g.ellipse(w * 0.71, h * 0.7, w * 0.085, h * 0.2, 0, 0, PI * 2); g.stroke();   // steering wheel
    g.fillStyle = '#05080c'; g.fillRect(w * 0.7, h * 0.7, w * 0.02, h * 0.3);
    const dash = g.createLinearGradient(0, h * 0.82, 0, h); dash.addColorStop(0, '#141b24'); dash.addColorStop(1, '#04070a');
    g.fillStyle = dash; g.fillRect(0, h * 0.82, w, h * 0.18);
  };
  const cabinSide = (g, w, h) => {
    g.fillStyle = '#232c37'; g.save(); g.translate(w * 0.42, h * 0.3); g.rotate(-0.1); rr(g, 0, 0, w * 0.2, h * 0.8, 16); g.restore();   // seat back
    g.fillStyle = '#2c3643'; rr(g, w * 0.4, h * 0.1, w * 0.17, h * 0.2, 10);                                                             // headrest
    g.fillStyle = '#0b1118'; g.fillRect(0, h * 0.84, w, h * 0.16);
  };
  const glassMat = (tex) => new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.04, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.1 });
  const screenGlass = glassMat(canvasTex(1024, 512, glassCanvas(cabinFront)));
  const doorTexG = canvasTex(512, 512, glassCanvas(cabinSide));
  doorTexG.repeat.set(1 / 1.0, 1 / 0.92); doorTexG.offset.set(-1.24 / 1.0, -2.2 / 0.92);   // ShapeGeometry UVs are in metres
  const rearTexG = canvasTex(256, 256, glassCanvas(() => {}));
  rearTexG.repeat.set(1 / 0.66, 1 / 0.7); rearTexG.offset.set(0.5, 0.5);
  const doorGlass = glassMat(doorTexG), rearGlass = glassMat(rearTexG);
  const drl = std(0xffffff, { emissive: 0xc8f2ff, emissiveIntensity: 2.8 });
  const chrome = std(0xe6ebf0, { roughness: 0.12, metalness: 1 });

  // cab-to-trailer side extenders
  [1, -1].forEach((s) => box(0.36, 2.9, 0.04, M.paint, -0.2, 2.6, s * 1.2, cab));

  // finishes used on the cab front
  const piano = new THREE.MeshPhysicalMaterial({ color: 0x050608, roughness: 0.16, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.3 });   // gloss black
  const satin = std(0x16191d, { roughness: 0.6, metalness: 0.45 });                                                    // textured black plastic
  const chromeHi = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.045, metalness: 1, envMapIntensity: 1.7 });
  const champagne = new THREE.MeshStandardMaterial({ color: 0xe9d7a8, roughness: 0.12, metalness: 1, envMapIntensity: 1.5 });
  const alu = new THREE.MeshStandardMaterial({ color: 0xd3d9df, roughness: 0.3, metalness: 1, envMapIntensity: 1.3 });   // brushed aluminium
  const lensClear = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, roughness: 0.02, metalness: 0, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 1.8, depthWrite: false });
  const lensLit = new THREE.MeshPhysicalMaterial({ color: 0xe6f6ff, roughness: 0.03, metalness: 0.1, clearcoat: 1, emissive: 0xd4efff, emissiveIntensity: 1.1 });
  const rod = (r, len, mat, x, y, z, parent = cab) => { const m = add(new THREE.CylinderGeometry(r, r, len, 14), mat, x, y, z, parent); m.rotation.x = PI / 2; return m; };   // bar across the cab

  // windscreen (raked): gloss surround and pillar trims, wiper arms and blades on pivots
  const RAKE = 0.168, NX = Math.cos(RAKE), NY = Math.sin(RAKE);
  const gasket = box(0.02, 1.16, FLAT - 0.01, piano, 2.235 + NX * (BV + 0.002), 2.64 + NY * (BV + 0.002), 0, cab, false); gasket.rotation.z = RAKE;
  const screen = box(0.02, 1.0, FLAT - 0.16, screenGlass, 2.235 + NX * (BV + 0.01), 2.64 + NY * (BV + 0.01), 0, cab, false); screen.rotation.z = RAKE;
  [1, -1].forEach((s) => box(0.03, 1.06, 0.07, piano, 0.012, 0, s * (FLAT / 2 - 0.03), screen));        // A-pillar trims
  box(0.03, 0.05, FLAT - 0.06, satin, 0.012, -0.535, 0, screen);                                          // scuttle
  [0.5, -0.5].forEach((z) => {
    const pivot = add(new THREE.CylinderGeometry(0.028, 0.028, 0.05, 12), satin, 0.035, -0.53, z + 0.4, screen); pivot.rotation.z = PI / 2;
    const arm = box(0.016, 0.02, 0.5, satin, 0.04, -0.455, z + 0.17, screen, false); arm.rotation.x = 0.3;
    const blade = box(0.02, 0.034, 0.92, M.black, 0.045, -0.385, z - 0.04, screen, false); blade.rotation.x = 0.13;
    const spine = box(0.012, 0.012, 0.9, satin, 0.058, -0.372, z - 0.04, screen, false); spine.rotation.x = 0.13;
  });

  // sun visor: a sculpted gloss-black wedge with rounded ends, chrome strip and LED markers
  const vis = new THREE.Shape();
  vis.moveTo(2.16, 3.43); vis.lineTo(2.63, 3.31); vis.lineTo(2.645, 3.25); vis.quadraticCurveTo(2.42, 3.26, 2.24, 3.215); vis.closePath();
  add(side2(vis, CABW + 0.16, 0.022, 0.11, 8), piano, 0, 0, 0, cab);
  const strip = box(0.05, 0.014, CABW - 0.12, chromeHi, 2.3, 3.412, 0, cab); strip.rotation.z = -0.25;
  [1, -1].forEach((s) => {
    box(0.016, 0.03, 0.34, drl, 2.652, 3.282, s * 0.82, cab, false);                                      // LED marker strips in the lip
    box(0.07, 0.34, 0.07, piano, 2.4, 3.1, s * (CABW / 2 + 0.03), cab);                                   // visor ends wrap down the pillars
  });
  // roof front face (slanted): carries the logo above the windscreen
  const RSL = 0.276, RNX = Math.cos(RSL), RNY = Math.sin(RSL);
  const onRoof = (k, h, wdt, mat) => { const m = box(0.02, h, wdt, mat, lerp2(2.14, 1.97, k) + RNX * (BV + 0.006), lerp2(3.2, 3.8, k) + RNY * (BV + 0.006), 0, cab, false); m.rotation.z = RSL; return m; };
  function lerp2(a, b, k) { return a + (b - a) * k; }
  const logoBoard = onRoof(0.62, 0.46, 1.56, M.paint);   // logo sits straight on the cab paint above the windscreen

  // ---- front fascia ("shield"): framed gloss panel, two louvred tiers over mesh, chrome bars ----
  const FX = 2.4 + BV;
  const grilleTex = canvasTex(256, 128, (g, w, h) => {                                    // honeycomb mesh
    g.fillStyle = '#030405'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 9; r++) for (let c = 0; c < 15; c++) {
      const x = c * 18 + (r % 2 ? 9 : 0), y = r * 15 + 4;
      g.strokeStyle = '#48515c'; g.lineWidth = 2.2;
      g.beginPath(); for (let q = 0; q < 6; q++) { const a = PI / 6 + (q * PI) / 3; g.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9); } g.closePath(); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, 8, PI * 1.1, PI * 1.6); g.stroke();   // glint on each cell
    }
  });
  grilleTex.wrapS = grilleTex.wrapT = THREE.RepeatWrapping; grilleTex.repeat.set(3, 1);
  const meshMat = std(0xffffff, { map: grilleTex, roughness: 0.3, metalness: 0.75, envMapIntensity: 1.2 });
  box(0.03, 0.96, 1.78, piano, FX, 1.57, 0, cab);                                          // back panel
  [2.045, 1.1].forEach((y) => box(0.07, 0.05, 1.84, piano, FX + 0.02, y, 0, cab));         // frame
  [1, -1].forEach((s) => box(0.07, 0.99, 0.05, piano, FX + 0.02, 1.57, s * 0.9, cab));
  box(0.07, 0.11, 1.74, satin, FX + 0.02, 1.965, 0, cab);                                  // cowl under the screen
  [1.66, 1.3].forEach((yc) => {
    box(0.012, 0.3, 1.66, meshMat, FX + 0.018, yc, 0, cab, false);                         // mesh behind
    for (let n = 0; n < 5; n++) { const sl = box(0.06, 0.02, 1.66, piano, FX + 0.045, yc - 0.12 + n * 0.06, 0, cab); sl.rotation.z = 0.42; }   // louvres
  });
  [1.85, 1.48].forEach((y) => rod(0.019, 1.72, chromeHi, FX + 0.07, y, 0));                // chrome bars
  box(0.03, 0.2, 0.78, piano, FX + 0.07, 1.665, 0, cab);                                   // badge plinth
  const logoTex = canvasTex(1024, 256, (g, w, h) => {                                      // raised chrome lettering
    g.font = '900 208px "Arial Black", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,.75)'; g.fillText('SANY', w / 2 + 5, h / 2 + 13);
    const gr = g.createLinearGradient(0, 36, 0, h - 36);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.42, '#dfe5ec'); gr.addColorStop(0.5, '#8f9aa6'); gr.addColorStop(0.58, '#cfd6de'); gr.addColorStop(1, '#f7f9fb');
    g.fillStyle = gr; g.fillText('SANY', w / 2, h / 2 + 6);
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.strokeText('SANY', w / 2, h / 2 + 6);
  });
  const badge = decal(logoTex, 0.7, 0.175, FX + 0.088, 1.668, 0, PI / 2, cab); badge.material.metalness = 0.9; badge.material.roughness = 0.2;
  [1, -1].forEach((s) => {                                                              // sculpted corner deflectors with stepped vents
    const cheek = rbox(0.22, 0.92, 0.3, 0.09, M.paint, FX - 0.07, 1.56, s * 1.02, cab); cheek.rotation.y = s * -0.32;
    [1.28, 1.5, 1.72].forEach((y, n) => {
      const st = rbox(0.1 + n * 0.02, 0.12, 0.26, 0.03, M.paint, FX + 0.02 - n * 0.012, y + 0.05, s * 1.0, cab); st.rotation.y = s * -0.32;
      box(0.05, 0.05, 0.2, piano, FX + 0.02, y - 0.03, s * 0.975, cab, false);
    });
  });

  // body-colour wrap-around bumper carrying the lights
  const bump = new THREE.Shape();
  bump.moveTo(1.86, 0.46); bump.lineTo(2.36, 0.46); bump.lineTo(2.46, 0.58); bump.lineTo(2.46, 1.08); bump.lineTo(1.86, 1.08); bump.closePath();
  add(side2(bump, CABW + 0.06, 0.08, 0.14), M.paint, 0, 0, 0, cab);
  const BX = 2.545, BSIDE = (CABW + 0.06) / 2 + 0.004;
  box(0.03, 0.34, 1.22, piano, BX - 0.006, 0.86, 0, cab);                                  // lower intake: recess, mesh, louvres
  box(0.012, 0.3, 1.16, meshMat, BX + 0.012, 0.86, 0, cab, false);
  for (let n = 0; n < 4; n++) { const sl = box(0.05, 0.018, 1.16, piano, BX + 0.03, 0.76 + n * 0.066, 0, cab); sl.rotation.z = 0.42; }
  rod(0.016, 1.24, champagne, BX + 0.03, 1.04, 0);
  box(0.06, 0.11, 1.34, alu, BX - 0.012, 0.49, 0, cab);                                    // aluminium skid plate with slots
  [-0.45, -0.15, 0.15, 0.45].forEach((z) => box(0.064, 0.04, 0.2, satin, BX - 0.011, 0.495, z, cab, false));
  box(0.02, 0.11, 0.42, std(0xf5f5f0, { roughness: 0.5 }), BX + 0.05, 0.64, 0, cab, false);    // number plate
  [1, -1].forEach((s) => {
    const z0 = s * 0.88;                                                                   // headlamp cluster under a clear cover
    box(0.03, 0.3, 0.5, piano, BX - 0.004, 0.875, z0, cab);
    [0.8, 0.955].forEach((zz, n) => {
      const bowl = add(new THREE.CylinderGeometry(0.03, 0.078 - n * 0.012, 0.05, 28, 1, true), chromeHi, BX + 0.02, 0.905, s * zz, cab, false); bowl.rotation.z = PI / 2; bowl.material.side = THREE.DoubleSide;
      const ringT = add(new THREE.TorusGeometry(0.078 - n * 0.012, 0.007, 8, 28), chromeHi, BX + 0.046, 0.905, s * zz, cab, false); ringT.rotation.y = PI / 2;
      const proj = add(new THREE.SphereGeometry(0.044 - n * 0.008, 22, 14), lensLit, BX + 0.03, 0.905, s * zz, cab, false); proj.scale.x = 0.55;
    });
    box(0.03, 0.024, 0.44, drl, BX + 0.03, 0.762, z0, cab, false);                         // L-shaped running light
    box(0.03, 0.2, 0.024, drl, BX + 0.03, 0.85, s * 1.095, cab, false);
    box(0.03, 0.026, 0.3, M.amber, BX + 0.03, 1.0, s * 0.93, cab, false);                  // indicator
    box(0.012, 0.3, 0.5, lensClear, BX + 0.058, 0.875, z0, cab, false);                    // clear cover
    box(0.03, 0.12, 0.22, piano, BX - 0.004, 0.6, z0, cab);                                // fog lamp
    const fr = add(new THREE.TorusGeometry(0.052, 0.008, 8, 24), chromeHi, BX + 0.02, 0.6, z0, cab, false); fr.rotation.y = PI / 2;
    const fl = add(new THREE.SphereGeometry(0.044, 18, 12), lensLit, BX + 0.012, 0.6, z0, cab, false); fl.scale.x = 0.5;
  });

  // ---- sides: door + rear quarter glass, loop mirror, steps, branding ----
  const win = new THREE.Shape();
  win.moveTo(1.29, 2.22); win.lineTo(2.2, 2.22); win.lineTo(2.06, 3.06); win.quadraticCurveTo(2.04, 3.1, 1.98, 3.1);
  win.lineTo(1.33, 3.1); win.quadraticCurveTo(1.27, 3.1, 1.27, 3.04); win.lineTo(1.27, 2.24); win.closePath();
  const winGeo = new THREE.ShapeGeometry(win);
  const gask = new THREE.Shape();
  gask.moveTo(1.22, 2.17); gask.lineTo(2.26, 2.17); gask.lineTo(2.1, 3.15); gask.lineTo(1.22, 3.15); gask.closePath();
  const gaskGeo = new THREE.ShapeGeometry(gask);
  const rearWinGeo = new THREE.ShapeGeometry(rrect(0.66, 0.7, 0.07)), rearGaskGeo = new THREE.ShapeGeometry(rrect(0.76, 0.8, 0.1));
  const sanyTex = canvasTex(640, 220, (g, w, h) => {
    g.fillStyle = '#0b1830'; g.beginPath(); g.moveTo(0, 150); g.lineTo(w * 0.7, 132); g.lineTo(w, 96); g.lineTo(w * 0.72, 160); g.lineTo(40, 178); g.closePath(); g.fill();   // swoosh
    g.fillStyle = '#1d5fd6'; g.beginPath(); g.moveTo(60, 182); g.lineTo(w * 0.5, 166); g.lineTo(w * 0.42, 190); g.closePath(); g.fill();
    g.font = 'italic 900 128px "Arial Black", Arial, sans-serif'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = 16; g.strokeStyle = '#0b1830'; g.strokeText('SANY', 70, 84);
    g.fillStyle = '#fff'; g.fillText('SANY', 70, 84);
    g.font = '700 24px Arial, sans-serif'; g.fillStyle = '#fff'; g.fillText('ELECTRIC VEHICLE', 300, 156);
  });
  const loop = new THREE.CatmullRomCurve3([new THREE.Vector3(2.28, 3.14, 1.24), new THREE.Vector3(2.46, 3.2, 1.42), new THREE.Vector3(2.52, 3.0, 1.56),
    new THREE.Vector3(2.52, 2.2, 1.56), new THREE.Vector3(2.46, 2.0, 1.42), new THREE.Vector3(2.28, 2.02, 1.24)]);
  const loopGeo = new THREE.TubeGeometry(loop, 40, 0.038, 10);
  [1, -1].forEach((s) => {
    const side = new THREE.Group(); if (s < 0) side.scale.z = -1; cab.add(side);          // mirrored for the far side
    add(gaskGeo, M.black, 0, 0, SIDE - 0.002, side, false);
    add(winGeo, doorGlass, 0, 0, SIDE + 0.001, side, false);
    add(rearGaskGeo, M.black, 0.65, 2.67, SIDE - 0.002, side, false);                     // rear quarter window
    add(rearWinGeo, rearGlass, 0.65, 2.67, SIDE + 0.001, side, false);
    box(2.2, 0.06, 0.01, M.black, 1.02, 3.3, SIDE, side, false);                          // black band under the high roof
    box(0.012, 1.85, 0.008, M.black, 1.15, 2.22, SIDE, side, false);                      // door shut-lines
    box(0.012, 0.86, 0.008, M.black, 2.27, 1.72, SIDE, side, false);
    box(1.12, 0.012, 0.008, M.black, 1.71, 1.3, SIDE, side, false);
    box(0.012, 0.9, 0.008, M.black, 0.42, 1.75, SIDE, side, false);                       // rear lower panel
    box(0.6, 0.012, 0.008, M.black, 0.72, 2.2, SIDE, side, false); box(0.6, 0.012, 0.008, M.black, 0.72, 1.3, SIDE, side, false);
    box(0.09, 0.2, 0.03, M.gloss, 1.3, 1.95, SIDE + 0.012, side);                         // door handle
    const grab = add(new THREE.CylinderGeometry(0.018, 0.018, 1.1, 10), M.gloss, 1.04, 2.1, SIDE + 0.045, side);   // grab rail
    [1.6, 2.6].forEach((y) => box(0.03, 0.03, 0.05, M.gloss, 1.04, y, SIDE + 0.02, side));
    add(loopGeo, M.gloss, 0, 0, 0, side);                                                 // loop mirror arm
    box(0.11, 0.56, 0.2, M.gloss, 2.5, 2.78, 1.66, side);                                 // main mirror
    box(0.012, 0.48, 0.15, std(0xbfd3e6, { roughness: 0.05, metalness: 1 }), 2.44, 2.78, 1.66, side, false);
    box(0.1, 0.24, 0.2, M.gloss, 2.5, 2.3, 1.66, side);                                   // wide-angle mirror
    add(side2(arcBand(0.655, 0.75, -0.03, 2.54), 0.14, 0.01, 0.02, 2), M.plastic, AX, R, 1.2, side);   // arch flare
    box(0.4, 0.26, 0.012, M.black, 2.1, 0.68, BSIDE, side, false);                        // step well in the bumper
    box(0.4, 0.03, 0.1, M.steel, 2.1, 0.56, BSIDE + 0.03, side);
    box(0.44, 0.03, 0.2, M.steel, 0.2, 0.93, 1.14, side);                                 // rear step
    box(0.12, 0.06, 0.02, M.amber, 2.3, 1.42, SIDE + 0.006, side, false);                 // side repeater
    box(0.1, 0.05, 0.02, M.amber, 1.9, 1.02, BSIDE + 0.004, side, false);
  });
  [1, -1].forEach((s) => decal(sanyTex, 1.06, 0.365, 1.7, 1.72, s * (SIDE + 0.004), s > 0 ? 0 : PI, cab));

  // lamp glow (additive halos) so the lights read as lit rather than as flat white shapes
  const glowTex = canvasTex(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(210,240,255,.55)'); gr.addColorStop(1, 'rgba(180,225,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
  const glow = (x, y, z, size, color, parent, opacity = 0.6) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity, fog: false }));
    sp.position.set(x, y, z); sp.scale.setScalar(size); parent.add(sp);
  };
  [1, -1].forEach((s) => {
    glow(BX + 0.06, 0.9, s * 0.8, 0.75, 0xffffff, cab); glow(BX + 0.06, 0.8, s * 1.06, 0.5, 0xbfeeff, cab, 0.5);
    glow(BX + 0.05, 0.6, s * 0.88, 0.32, 0xffffff, cab, 0.45);
    glow(-8.56, 1.08, s * 0.85, 0.55, 0xff2a2a, truck, 0.5);
  });

  // soft contact shadow under the whole rig, on top of the real cast shadow
  const underTex = canvasTex(512, 128, (g, w, h) => {
    g.filter = 'blur(14px)'; g.fillStyle = 'rgba(0,6,16,.75)';
    g.beginPath(); g.roundRect(34, 34, w - 68, h - 68, 22); g.fill(); g.filter = 'none';
  });
  const under = new THREE.Mesh(new THREE.PlaneGeometry(19.4, 4.4), new THREE.MeshBasicMaterial({ map: underTex, transparent: true, depthWrite: false, toneMapped: false }));
  under.rotation.x = -PI / 2; under.position.set(-0.2, 0.03, 0); truck.add(under);

  // ---------- battery pack behind the cab (stacked modules) ----------
  rbox(1.05, 1.86, 2.3, 0.07, M.paint, 5.0, 2.1, 0);
  box(1.12, 0.14, 2.34, M.chassis, 5.0, 1.1, 0);
  const battTex = canvasTex(256, 384, (g, w, h) => {
    g.fillStyle = '#fff'; g.beginPath();
    g.moveTo(150, 60); g.lineTo(92, 180); g.lineTo(128, 180); g.lineTo(108, 270); g.lineTo(176, 142); g.lineTo(138, 142); g.closePath(); g.fill();
    g.font = '700 26px Arial, sans-serif'; g.textAlign = 'center'; g.fillText('100% ELECTRIC', w / 2, 330);
  });
  [1, -1].forEach((s) => {
    decal(battTex, 0.62, 0.93, 5.0, 1.72, s * 1.153, s > 0 ? 0 : PI);
    [1.82, 2.42].forEach((y) => box(1.0, 0.014, 0.01, M.black, 5.0, y + 0.3, s * 1.152, truck, false));   // module seams
    box(0.12, 0.08, 0.01, std(0xf4c20d, { roughness: 0.5 }), 5.3, 2.86, s * 1.153, truck, false);         // HV label
    box(0.1, 0.1, 0.01, M.black, 5.28, 1.4, s * 1.153, truck, false);
    const cable = new THREE.CatmullRomCurve3([new THREE.Vector3(4.47, 1.5, s * 0.5), new THREE.Vector3(4.2, 1.25, s * 0.55), new THREE.Vector3(3.95, 1.45, s * 0.5), new THREE.Vector3(3.76, 1.75, s * 0.45)]);
    add(new THREE.TubeGeometry(cable, 16, 0.03, 8), s > 0 ? M.plastic : M.red, 0, 0, 0);
  });
  [2.12, 2.72].forEach((y) => box(0.01, 0.014, 2.2, M.black, 4.474, y, 0, truck, false));

  // ---------- trailer (skeletal, gooseneck) ----------
  box(4.2, 0.14, 2.3, M.frame, 1.65, 1.45, 0);                                    // gooseneck deck
  [1, -1].forEach((s) => {
    box(9.0, 0.42, 0.12, M.frame, -3.95, 1.17, s * 0.5);                          // main beams
    box(12.2, 0.12, 0.08, M.frame, -2.35, 1.46, s * 1.18);                        // outer rails
    box(0.12, 1.02, 0.12, M.chassis, 0.55, 0.88, s * 0.62);                       // landing legs
    box(0.32, 0.04, 0.32, M.chassis, 0.55, 0.36, s * 0.62);
    [0.6, 0.92].forEach((y) => box(3.3, 0.08, 0.04, M.steel, -1.75, y, s * 1.2)); // side guards
    [-0.2, -1.75, -3.3].forEach((x) => box(0.05, 0.75, 0.05, M.frame, x, 1.03, s * 1.17));
    box(0.02, 0.5, 0.62, M.plastic, -8.3, 0.62, s * 0.9);                         // mud flaps
    box(0.04, 0.12, 0.42, M.red, -8.5, 1.08, s * 0.85, truck, false);             // tail lamps
    box(0.04, 0.12, 0.16, M.amber, -8.5, 1.08, s * 0.5, truck, false);
    for (let i = 0; i < 5; i++) box(0.12, 0.05, 0.02, M.amber, 3.0 - i * 2.75, 1.46, s * 1.225, truck, false);
  });
  for (let i = 0; i < 9; i++) box(0.08, 0.1, 2.3, M.frame, 3.4 - i * 1.45, 1.44, 0);
  box(0.1, 0.36, 1.2, M.chassis, 0.55, 1.0, 0);
  box(0.08, 0.2, 2.34, M.chassis, -8.47, 1.08, 0);                                // light bar
  box(0.1, 0.12, 2.4, M.steel, -8.42, 0.6, 0);                                    // underrun bar
  [0.7, -0.7].forEach((z) => box(0.08, 0.4, 0.08, M.chassis, -8.42, 0.82, z));
  axle(-4.75, true); axle(-6.1, true); axle(-7.45, true);

  // ---------- 40ft high-cube container (12.19 x 2.9 x 2.44 m) ----------
  const CX = -2.35, CY0 = 1.52, CL = 12.19, CH = 2.9, CW = 2.44;
  const BODY = '#1a2f9f';              // navy container; the logo's dark lettering is drawn in white on it
  const sideTex = canvasTex(2048, 512, (g, w, h) => {
    g.fillStyle = BODY; g.fillRect(0, 0, w, h);
    const pitch = w / 44;
    for (let x = 0; x < w; x += pitch) {                                          // corrugation shading
      const gr = g.createLinearGradient(x, 0, x + pitch, 0);
      gr.addColorStop(0, 'rgba(0,0,0,.30)'); gr.addColorStop(0.22, 'rgba(255,255,255,.06)');
      gr.addColorStop(0.5, 'rgba(255,255,255,.10)'); gr.addColorStop(0.78, 'rgba(255,255,255,.04)'); gr.addColorStop(1, 'rgba(0,0,0,.30)');
      g.fillStyle = gr; g.fillRect(x, 0, pitch, h);
    }
    g.fillStyle = '#fff'; g.font = '600 24px Arial, sans-serif'; g.fillText('45G1', 1890, 96);                 // size/type code
    g.fillStyle = '#f4c20d'; g.fillRect(1900, 360, 64, 64); g.fillStyle = '#111'; g.font = '700 15px Arial'; g.fillText("9'6\"", 1915, 390); g.fillText('HIGH', 1912, 410);
  });
  const corrBump = canvasTex(64, 4, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, '#000'); gr.addColorStop(0.25, '#fff'); gr.addColorStop(0.75, '#fff'); gr.addColorStop(1, '#000');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, false);
  corrBump.wrapS = corrBump.wrapT = THREE.RepeatWrapping; corrBump.repeat.set(44, 1);
  const endBump = corrBump.clone(); endBump.repeat.set(9, 1); endBump.needsUpdate = true;
  const doorTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = BODY; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 6; g.strokeRect(10, 10, w / 2 - 13, h - 20); g.strokeRect(w / 2 + 3, 10, w / 2 - 13, h - 20);
    for (let y = 60; y < h - 40; y += 90) { g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(16, y, w - 32, 10); g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(16, y + 10, w - 32, 6); }
    g.fillStyle = '#b9c0c9'; [96, 190, 322, 416].forEach((x) => g.fillRect(x - 5, 14, 10, h - 28));           // lock rods
    g.fillStyle = '#8f98a3'; [96, 190, 322, 416].forEach((x) => g.fillRect(x - 26, h * 0.56, 52, 12));
  });
  const cm = (o) => std(0xffffff, { roughness: 0.48, metalness: 0.3, ...o });
  const sideMat = cm({ map: sideTex, bumpMap: corrBump, bumpScale: 2.5 });
  const frontMat = cm({ color: 0x1a2f9f, bumpMap: endBump, bumpScale: 2.5 });
  const roofMat = cm({ color: 0x182b92, bumpMap: corrBump, bumpScale: 2.5 });
  add(new THREE.BoxGeometry(CL, CH, CW), [frontMat, cm({ map: doorTex }), roofMat, roofMat, sideMat, sideMat], CX, CY0 + CH / 2, 0);
  [1, -1].forEach((sx) => [1, -1].forEach((sz) => {
    box(0.15, CH, 0.15, M.contTrim, CX + sx * (CL / 2 - 0.063), CY0 + CH / 2, sz * (CW / 2 - 0.063));          // corner posts
    [0.07, CH - 0.07].forEach((y) => box(0.19, 0.14, 0.19, M.contTrim, CX + sx * (CL / 2 - 0.08), CY0 + y, sz * (CW / 2 - 0.08)));   // castings
  }));
  [1, -1].forEach((sz) => [0.075, CH - 0.075].forEach((y) => box(CL, 0.15, 0.03, M.contTrim, CX, CY0 + y, sz * (CW / 2 + 0.004))));  // side rails
  [1, -1].forEach((sx) => [0.075, CH - 0.075].forEach((y) => box(0.03, 0.15, CW, M.contTrim, CX + sx * (CL / 2 + 0.004), CY0 + y, 0)));

  // ---------- Zero Drive logo (site asset) on the container sides and the cab roof board ----------
  const logoImg = new Image();
  logoImg.onload = () => {
    // light version for the navy container: dark navy lettering -> white, green/blue bolt kept
    const lc = document.createElement('canvas'); lc.width = logoImg.width; lc.height = logoImg.height;
    const lg = lc.getContext('2d'); lg.drawImage(logoImg, 0, 0);
    const px = lg.getImageData(0, 0, lc.width, lc.height), d8 = px.data;
    for (let i = 0; i < d8.length; i += 4) {
      if (d8[i + 3] && d8[i] < 90 && d8[i + 1] < 90 && d8[i + 2] < 130) { d8[i] = d8[i + 1] = d8[i + 2] = 255; }
    }
    lg.putImageData(px, 0, 0);
    const g = sideTex.image.getContext('2d'), lw = 1180, lh = lw * logoImg.height / logoImg.width;
    g.drawImage(lc, (2048 - lw) / 2, (512 - lh) / 2, lw, lh);
    sideTex.needsUpdate = true;
    // same light logo on the container roof, so it reads in the top-down stage
    const rt = new THREE.CanvasTexture(lc); rt.colorSpace = THREE.SRGBColorSpace; rt.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const rg = new THREE.PlaneGeometry(6.9, 6.9 * logoImg.height / logoImg.width); rg.rotateX(-PI / 2); rg.rotateY(PI);
    const roofLogo = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ map: rt, transparent: true, roughness: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    roofLogo.position.set(CX, CY0 + CH + 0.012, 0); truck.add(roofLogo);
    const t = new THREE.Texture(logoImg); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.needsUpdate = true;
    const d = decal(t, 1.44, 1.44 * logoImg.height / logoImg.width, 0.013, 0, 0, PI / 2, logoBoard);
    d.material.polygonOffset = false;
    redraw = true;
    mapWorld.userData.fleet();                                     // now the truck is complete, copy it for the map
  };
  logoImg.onerror = () => mapWorld.userData.fleet();
  logoImg.addEventListener('load', () => assets.done()); logoImg.addEventListener('error', () => assets.done());
  logoImg.src = 'assets/logos/zero-drive-logo.png';

  // ---------- drive world vs map world ----------
  // Everything built so far except the truck and lights is the "drive world". After the drive the
  // camera climbs into cloud, and behind that white-out the drive world is swapped for a low-poly
  // map of India built around the truck, which is left standing at Mumbai as the camera pulls out.
  const driveWorld = new THREE.Group();
  scene.children.filter((o) => o !== truck && !o.isLight && o !== sun.target).forEach((o) => driveWorld.add(o));
  scene.add(driveWorld);

  const T_DRIVE = 8.5, T_SWAP = 9.05, T_MAP = 10.3, ROUTE_GAP = 0.34;
  const HUB = route(T_DRIVE * SPEED);                           // where the truck finishes its drive
  const U = 12, ANCHOR = [73.35, 19.25];                        // metres per degree; lon/lat under the parked truck (just inland of Mumbai)
  const geo = ([lon, lat]) => [HUB.x - (lon - ANCHOR[0]) * U * 0.94, HUB.z + (lat - ANCHOR[1]) * U];   // north is +z (up-screen), east is -x
  const mapWorld = new THREE.Group(); mapWorld.visible = false; scene.add(mapWorld);
  const mapRoutes = [], mapRigs = [], mapPuffs = [], mapLabels = [];
  const PLACE = {
    Mumbai: [72.88, 19.08], Pune: [73.86, 18.52], Ahmedabad: [72.57, 23.03], Mundra: [69.72, 22.84], Nimbahera: [74.68, 24.62],
    Chennai: [80.27, 13.08], Krishnapatnam: [80.12, 14.25], Morbi: [70.83, 22.82], Pithampur: [75.68, 22.61],
  };
  const SURAT = [72.83, 21.17], VADODARA = [73.18, 22.31], NASHIK = [73.79, 20.0], DHULE = [74.78, 20.9];
  // corridors, in the order the page lists them; through-points only shape the line (indicative, not surveyed)
  const CORRIDORS = [
    { via: [PLACE.Mumbai, [73.4, 18.75], PLACE.Pune] },                                                                       // shuttle
    { via: [PLACE.Mumbai, SURAT, VADODARA, PLACE.Ahmedabad] },                                                                // completed
    { via: [PLACE.Pune, NASHIK, DHULE, [75.86, 22.72], [75.04, 23.33], PLACE.Nimbahera] },
    { via: [PLACE.Mumbai, SURAT, VADODARA, PLACE.Ahmedabad, PLACE.Morbi, [70.5, 23.3], PLACE.Mundra] },
    { dash: true, via: [PLACE.Mumbai, PLACE.Pune, [74.24, 16.7], [75.12, 15.36], [77.59, 12.97], [79.13, 12.92], PLACE.Chennai] },        // underway
    { dash: true, via: [PLACE.Mumbai, PLACE.Pune, [75.9, 17.67], [78.48, 17.38], [80.62, 16.51], [80.05, 15.5], PLACE.Krishnapatnam] },
    { dash: true, via: [PLACE.Mumbai, NASHIK, DHULE, [75.1, 21.68], PLACE.Pithampur] },                                       // charging corridor
  ];
  const SANGURLI = [74.94, 21.29];                              // exact site not published: shown part-way along its corridor
  {
    const rnd = (() => { let s = 4711; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
    const hash = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
    const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
    const lowpoly = (color, o = {}) => std(color, { roughness: 0.85, metalness: 0, flatShading: true, envMapIntensity: 0.35, ...o });

    // open ocean, lit like an aerial photograph: a wave height field gives a surface normal, and the colour comes from
    // deep-water absorption, sky reflection at grazing angles, sun glitter on the facets and sparse foam on the highest crests
    const seaMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uC: { value: new THREE.Vector2(HUB.x - 70, HUB.z + 40) } }, fog: false,
      vertexShader: 'varying vec2 vP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `
        uniform float uTime; uniform vec2 uC; varying vec2 vP;
        float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
        float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * vn(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + vec2(17.3, 9.1); a *= 0.5; } return s; }
        // three wave trains: a long swell, a shorter sea crossing it, and fine wind ripples; each is noise stretched along its crests
        float height(vec2 p, float t){
          vec2 w1 = vec2(p.x * 0.8 + p.y * 0.6, (p.y * 0.8 - p.x * 0.6) * 2.6);
          float a = fbm(w1 * 0.075 + vec2(t * 0.07, t * 0.24));
          vec2 w2 = vec2(p.x * 0.95 - p.y * 0.3, (p.y * 0.95 + p.x * 0.3) * 2.2);
          float b = fbm(w2 * 0.19 + vec2(-t * 0.13, t * 0.42) + a * 0.9);
          float c = fbm(p * 0.55 + vec2(t * 0.45, -t * 0.38) + b * 0.7);
          return a + b * 0.5 + c * 0.24;
        }
        void main(){
          float t = uTime; vec2 p = vP; const float e = 0.45;
          float h0 = height(p, t), hx = height(p + vec2(e, 0.0), t), hz = height(p + vec2(0.0, e), t);
          vec3 N = normalize(vec3(-(hx - h0) / e * 2.7, 1.0, -(hz - h0) / e * 2.7));
          vec3 L = normalize(vec3(-0.35, 0.8, 0.45)), V = normalize(vec3(0.0, 0.85, -0.53)), H = normalize(L + V);
          float big = fbm(p * 0.0055 + vec2(t * 0.004, 0.0));                                // broad lighter and darker masses of water
          vec3 deep = vec3(0.004, 0.028, 0.12), body = vec3(0.01, 0.1, 0.4), bright = vec3(0.04, 0.27, 0.7);
          vec3 col = mix(deep, body, smoothstep(0.3, 0.62, big));
          col = mix(col, bright, smoothstep(0.62, 1.0, dot(N, L)) * (0.25 + 0.5 * big));     // faces turned to the sun
          col *= 0.62 + 0.62 * smoothstep(0.55, 1.15, h0);                                   // troughs sit darker than crests
          float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
          col = mix(col, vec3(0.2, 0.46, 0.86), fres * 0.4);                               // sky reflected at grazing angles
          float nh = clamp(dot(N, H), 0.0, 1.0);
          col += vec3(0.72, 0.86, 1.0) * (pow(nh, 70.0) * 0.07 + pow(nh, 1400.0) * 0.55);       // soft sheen plus pin-point sun glitter
          float crest = smoothstep(1.0, 1.13, h0), fleck = smoothstep(0.55, 0.78, fbm(p * 1.9 + vec2(t * 0.3, 0.0)));
          col = mix(col, vec3(0.88, 0.94, 1.0), crest * fleck * 0.9);                        // foam only on the highest crests
          col *= mix(1.0, 0.5, smoothstep(240.0, 900.0, length(vP - uC)));                   // the frame falls off into darker water
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), seaMat); sea.rotation.x = -PI / 2;
    sea.position.set(HUB.x - 70, -5.4, HUB.z + 40); mapWorld.add(sea);
    mapWorld.userData.sea = seaMat;

    // container ships: shaped hull, deck, bridge and funnel aft, bays of stacked containers, and a foaming wake
    const BOXES = [0xd8342f, 0x1f5fd0, 0xf2f4f6, 0xe98a1f, 0x2aa34a, 0xd94a8c, 0x12a5e0, 0x7a8894];
    const hullShape = new THREE.Shape(); hullShape.moveTo(-11, -1.9); hullShape.lineTo(6.5, -1.9); hullShape.quadraticCurveTo(10, -1.5, 12, 0); hullShape.quadraticCurveTo(10, 1.5, 6.5, 1.9); hullShape.lineTo(-11, 1.9); hullShape.quadraticCurveTo(-12, 0, -11, -1.9);
    const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 2.4, bevelEnabled: false, curveSegments: 10 }); hullGeo.rotateX(PI / 2);
    const wakeTex = canvasTex(256, 128, (g, w, h) => {
      for (let i = 0; i < 900; i++) {                                                    // foam streaks fanning out behind the stern
        const u = Math.pow(rnd(), 0.7), spread = (rnd() - 0.5) * (0.12 + u * 0.8), x = w * (1 - u), y = h / 2 + spread * h;
        g.fillStyle = `rgba(255,255,255,${(1 - u) * 0.55 * rnd()})`; g.beginPath(); g.ellipse(x, y, 2 + rnd() * 7, 0.8 + rnd() * 1.6, 0, 0, PI * 2); g.fill();
      }
    });
    const ship = (from, to, dur, phase) => {
      const g = new THREE.Group(), part = (geo2, col, x, y, z = 0, o = {}) => { const m = new THREE.Mesh(geo2, std(col, { roughness: 0.6, metalness: 0.1, ...o })); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
      part(hullGeo, 0x103a6b, 0, 1.5);                                                   // hull
      part(new THREE.BoxGeometry(22.4, 0.12, 3.9), 0x8e1f1f, -0.2, -0.6);                // boot-topping at the waterline
      part(new THREE.BoxGeometry(17.5, 0.1, 3.5), 0x2b6aa8, -1.6, 1.56);                 // deck
      part(new THREE.BoxGeometry(2.2, 3.2, 3.5), 0xf3f5f7, -9.2, 3.1);                   // bridge block
      part(new THREE.BoxGeometry(2.4, 0.5, 4.4), 0xf3f5f7, -9.2, 4.9);                   // bridge wings
      part(new THREE.BoxGeometry(0.9, 1.4, 1.1), 0x103a6b, -10.4, 4.3);                  // funnel
      for (let bay = 0; bay < 7; bay++) for (let row = 0; row < 4; row++) {              // container bays
        const tiers = 1 + ((rnd() * 3) | 0);
        for (let t = 0; t < tiers; t++) part(new THREE.BoxGeometry(2.05, 0.78, 0.78), BOXES[(rnd() * BOXES.length) | 0], -6.6 + bay * 2.3, 2.0 + t * 0.8, -1.26 + row * 0.84);
      }
      const wake = new THREE.Mesh(new THREE.PlaneGeometry(34, 11), new THREE.MeshBasicMaterial({ map: wakeTex, transparent: true, opacity: 0.9, depthWrite: false, fog: false, toneMapped: false }));
      wake.rotation.x = -PI / 2; wake.position.set(-27, -0.25, 0); g.add(wake);
      const bow = new THREE.Mesh(new THREE.PlaneGeometry(9, 7), wake.material); bow.rotation.x = -PI / 2; bow.rotation.z = PI; bow.position.set(9.5, -0.25, 0); bow.scale.set(0.7, 0.8, 1); g.add(bow);   // bow wave
      const a = geo(from), b = geo(to); g.userData = { a, b, dur, phase };
      mapWorld.add(g); return g;
    };
    mapWorld.userData.ships = [ship([65.5, 22.9], [71.4, 18.0], 70, 0.1), ship([70.4, 16.4], [74.0, 9.4], 78, 0.6), ship([84.2, 16.4], [81.4, 11.2], 66, 0.3),
      ship([87.0, 19.4], [92.0, 13.0], 90, 0.8), ship([63.5, 17.0], [69.2, 11.6], 86, 0.45)];

    // neighbouring countries: flat, lower and muted, so India stands out and covers them wherever outlines overlap
    fetch('assets/geo/neighbours.json').then((r) => r.json()).then((nb) => {
      const top = lowpoly(0xa9c2a6, { roughness: 1 }), side = lowpoly(0x7d977c, { roughness: 1 });
      // plus one plain slab for everything north of the data (lat 51+), so a tall phone frame never shows sea above Asia
      [...nb.lands, [[10, 51], [140, 51], [140, 88], [10, 88]]].forEach((ring) => {
        const shape = new THREE.Shape(ring.map((q) => { const [x, z] = geo(q); return new THREE.Vector2(x, z); }));
        const g = new THREE.ExtrudeGeometry(shape, { depth: 3.2, bevelEnabled: false }); g.rotateX(PI / 2);
        const m = new THREE.Mesh(g, [top, side]); m.position.y = -2.2; m.receiveShadow = true; mapWorld.add(m);
      });
      redraw = true;
    }).catch((err) => console.warn('[truck3d] neighbouring countries failed to load:', err)).finally(() => assets.done());

    // clouds: soft, photographic-looking billboards built from hundreds of faint overlapping puffs
    const cloudTex = () => canvasTex(512, 512, (g, w) => {
      const blob = (x, y, r, c, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };
      const lobes = []; for (let n = 0; n < 9; n++) lobes.push([w * (0.24 + rnd() * 0.52), w * (0.34 + rnd() * 0.32), 40 + rnd() * 70]);
      lobes.forEach(([lx, ly, lr]) => { for (let k = 0; k < 26; k++) { const a = rnd() * PI * 2, d = Math.pow(rnd(), 0.7) * lr; blob(lx + Math.cos(a) * d * 1.25, ly + Math.sin(a) * d * 0.7 + 14, 26 + rnd() * 46, '168,182,205', 0.035 + rnd() * 0.04); } });   // cool underside
      lobes.forEach(([lx, ly, lr]) => { for (let k = 0; k < 44; k++) { const a = rnd() * PI * 2, d = Math.pow(rnd(), 0.7) * lr; blob(lx + Math.cos(a) * d * 1.25, ly + Math.sin(a) * d * 0.7 - 6, 20 + rnd() * 52, '255,255,255', 0.04 + rnd() * 0.07); } });      // sunlit body
    });
    const CLOUD_TEX = [cloudTex(), cloudTex(), cloudTex(), cloudTex()];
    const cloud = (x, y, z, size, n, parent) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: CLOUD_TEX[n % 4], transparent: true, opacity: 0, depthWrite: false, fog: false }));
      sp.position.set(x, y, z); sp.scale.set(size, size * 0.72, 1); sp.material.rotation = (rnd() - 0.5) * 0.5; sp.renderOrder = 6; parent.add(sp); return sp;
    };
    // (a) a few banks far out over the sea, at the edges of the frame, clear of India, the pins and the card
    const BANKS = [[-262, 168], [-285, -70], [-205, -205], [178, -215], [250, 30], [228, 205], [30, 285], [-110, -265]];   // offsets from the centre of India
    BANKS.forEach(([ox, oz], n) => {
      const sp = cloud(HUB.x - 76 + ox, 30 + rnd() * 14, HUB.z + 38 + oz, 120 + rnd() * 70, n, mapWorld);
      sp.material.opacity = 0.9; sp.userData = { x: sp.position.x, speed: 0.6 + rnd() * 0.9, span: 10 + rnd() * 14, phase: rnd() * 6 };
      mapPuffs.push(sp);
    });
    // (b) cloud the camera climbs through on the way out to the map; faded away before any map data appears
    const passClouds = [];
    for (let n = 0; n < 15; n++) {
      const k = n / 14, hgt = 110 + k * 400, spread = 40 + hgt * 0.5, a = rnd() * PI * 2;
      const off = 0.62 + rnd() * 0.6;                           // kept off the line of sight, so the middle of the view stays open
      const sp = cloud(HUB.x + k * -40 + Math.cos(a) * spread * off, hgt - 30, HUB.z + k * -170 + Math.sin(a) * spread * off, 110 + hgt * 0.4, n, scene);
      sp.userData = { x: sp.position.x, drift: (rnd() - 0.5) * 16, phase: rnd() * 6 };
      sp.visible = false; passClouds.push(sp);
    }
    mapWorld.userData.passClouds = passClouds;

    // corridors: navy tubes just above the terrain (solid = running, dashed = underway), drawn as you scroll.
    // Each has a small trailer that leads the line while it draws, then shuttles; the hero truck takes the first.
    const LINE = 0x0e1c33;
    const dashTex = () => { const t = canvasTex(64, 4, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.fillRect(0, 0, w * 0.58, h); }, false); t.wrapS = THREE.RepeatWrapping; return t; };
    CORRIDORS.forEach((c, n) => {
      const curve = new THREE.CatmullRomCurve3(c.via.map((q) => { const [x, z] = geo(q); return new THREE.Vector3(x, 4.7, z); }), false, 'centripetal');
      const mat = std(LINE, { emissive: LINE, emissiveIntensity: 0.25, roughness: 0.45 });
      if (c.dash) { mat.alphaMap = dashTex(); mat.alphaMap.repeat.set(curve.getLength() / 4.2, 1); mat.alphaTest = 0.5; }
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 200, 0.95, 6), mat);
      tube.geometry.setDrawRange(0, 0); mapWorld.add(tube);
      const rig = null;                                          // corridor 0 is driven by the hero truck; the rest get copies of it (see fleet())
      mapRoutes.push({ tube, curve, count: tube.geometry.index.count, t0: T_MAP + n * ROUTE_GAP });
      mapRigs.push({ rig, curve, dur: Math.max(7, curve.getLength() / 13), t1: undefined });
    });

    // the other corridors run copies of the real, detailed truck. They are made once the logo has loaded,
    // so the copies carry it too; parts too small to see at map scale are left off to keep them light.
    const MAP_SCALE = 0.72;
    mapWorld.userData.fleet = () => {
      mapRigs.forEach((g, n) => {
        if (!n || g.rig) return;
        const c = truck.clone(true), drop = [];
        c.traverse((o) => {
          if (!o.isMesh) return;
          if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
          if (o.geometry.boundingSphere.radius < (LITE ? 0.55 : 0.22) || o.isSprite) drop.push(o); else o.castShadow = false;
        });
        drop.forEach((o) => o.parent && o.parent.remove(o));
        c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.setScalar(MAP_SCALE); c.visible = false;
        mapWorld.add(c); g.rig = c;
      });
      redraw = true;
    };

    // green wash that carries the grass of the drive world into the land of the map (see frame())
    const wash = new THREE.Mesh(new THREE.PlaneGeometry(7000, 7000), new THREE.MeshStandardMaterial({ color: 0x5a9a3a, roughness: 0.85, metalness: 0, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    wash.rotation.x = -PI / 2; wash.position.set(HUB.x, 0.09, HUB.z); wash.visible = false; wash.renderOrder = 3; scene.add(wash);
    mapWorld.userData.wash = wash;

    // pins; their text labels are HTML, projected onto the scene each frame so they stay crisp
    const labelBox = document.createElement('div'); labelBox.className = 'drive__labels'; sceneEl.appendChild(labelBox);
    // glossy teardrop location markers with a real hole through the head, leaning back to face the camera
    const pinShape = new THREE.Shape();
    { const r = 2.2, cy = 5.2, a = Math.asin(r / cy);
      pinShape.moveTo(0, 0); pinShape.lineTo(-r * Math.cos(a), cy - r * Math.sin(a));
      pinShape.absarc(0, cy, r, PI + a, -a, true); pinShape.lineTo(0, 0);
      const hole = new THREE.Path(); hole.absarc(0, cy, 0.86, 0, PI * 2, false); pinShape.holes.push(hole); }
    const pinGeo = new THREE.ExtrudeGeometry(pinShape, { depth: 0.7, bevelEnabled: true, bevelSize: 0.42, bevelThickness: 0.5, bevelSegments: 6, curveSegments: 28 });
    pinGeo.translate(0, 0, -0.35);
    const gloss = (color) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.16, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.3, transparent: true, opacity: 0.94 });
    const PIN_MAT = { hub: gloss(0x0e1c33), city: gloss(0x18b6d6), charge: gloss(0xe5383b) };
    // which corridors (by index in CORRIDORS) each name belongs to: a name shows only while one of its corridors is the
    // one being traced, so the map carries two or three names at a time instead of ten. Mumbai, the hub, always shows.
    const LABEL_ON = { Mumbai: null, Pune: [0, 2], Ahmedabad: [1], Nimbahera: [2], Mundra: [3], Morbi: [3], Chennai: [4], Krishnapatnam: [5], Pithampur: [6], Sangurli: [6] };
    const pin = (name, lonlat, kind, side, text) => {
      const [x, z] = geo(lonlat), k = kind === 'hub' ? 1.5 : 1.15;
      const m = new THREE.Mesh(pinGeo, PIN_MAT[kind]); m.position.set(x, 3.4, z); m.scale.setScalar(k); m.rotation.x = 0.5; m.castShadow = true; mapWorld.add(m);
      const el = document.createElement('span'); el.className = `drive__label drive__label--${kind} drive__label--${side}`; el.textContent = text || name; labelBox.appendChild(el);
      mapLabels.push({ el, o: 0, on: LABEL_ON[name], v: new THREE.Vector3(x, 3.4 + 5.2 * k * Math.cos(0.5), z + 5.2 * k * Math.sin(0.5)) });   // label hangs off the pin's head
    };
    pin('Mumbai', PLACE.Mumbai, 'hub', 'l'); pin('Pune', PLACE.Pune, 'city', 'r'); pin('Ahmedabad', PLACE.Ahmedabad, 'city', 'r');
    pin('Mundra', PLACE.Mundra, 'city', 'l', LITE ? 'Mundra' : 'Mundra · Adani Ports'); pin('Nimbahera', PLACE.Nimbahera, 'city', 't'); pin('Pithampur', PLACE.Pithampur, 'city', 'r');
    pin('Chennai', PLACE.Chennai, 'city', 'r'); pin('Krishnapatnam', PLACE.Krishnapatnam, 'city', 'r');
    pin('Morbi', PLACE.Morbi, 'charge', 't', 'Morbi · charging'); pin('Sangurli', SANGURLI, 'charge', 'b', 'Sangurli · charging');

    // the land itself, from the simplified official outline (assets/geo/india-outline.json)
    Promise.all(['assets/geo/india-outline.json', 'assets/geo/india-states.json'].map((u) => fetch(u).then((r) => r.json()))).then(([data, states]) => {
      const topMat = lowpoly(0x9fd356), sideMat = lowpoly(0x5f9a33);
      const slab = (ring) => {
        const shape = new THREE.Shape(ring.map((q) => { const [x, z] = geo(q); return new THREE.Vector2(x, z); }));
        const g = new THREE.ExtrudeGeometry(shape, { depth: 5, bevelEnabled: false }); g.rotateX(PI / 2);      // top face at y = 0, body below
        const m = new THREE.Mesh(g, [topMat, sideMat]); m.receiveShadow = true; mapWorld.add(m);
      };
      slab(data.mainland); data.islands.forEach(slab);

      // faceted terrain on top: a jittered triangle lattice clipped to the outline, kept low so nothing overhangs the coast
      const ring = data.mainland.map(geo);
      const inside = (x, z) => { let c = false; for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) { const [xa, za] = ring[a], [xb, zb] = ring[b]; if ((za > z) !== (zb > z) && x < ((xb - xa) * (z - za)) / (zb - za) + xa) c = !c; } return c; };
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; ring.forEach(([x, z]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); });
      const G = 6.2, GH = G * 0.866, nx = Math.ceil((x1 - x0) / G) + 2, nz = Math.ceil((z1 - z0) / GH) + 2, V = [];
      for (let j = 0; j < nz; j++) { V.push([]); for (let n = 0; n < nx; n++) {
        const x = x0 + (n + (j % 2) * 0.5) * G + (rnd() - 0.5) * G * 0.42, z = z0 + j * GH + (rnd() - 0.5) * GH * 0.42;
        const lat = ANCHOR[1] + (z - HUB.z) / U, lon = ANCHOR[0] - (x - HUB.x) / (U * 0.94);
        const range = Math.min(1.6, Math.max(0, lat - 29.5) * 0.4) + Math.max(0, 1 - Math.abs(lon - 74.2 - (15.5 - lat) * 0.32) / 0.9) * (lat < 20.5 ? 1.4 : 0);   // gentle rise in the far north; Western Ghats
        const flat = step(6, 30, Math.hypot(x - HUB.x, z - HUB.z));                                            // keep it level under the parked truck
        V[j].push({ x, z, y: 0.25 + (vn(x / 26, z / 26) * 2.3 + vn(x / 9, z / 9) * 0.9 + range) * flat, in: inside(x, z) });
      } }
      const pos = [], col = [], c = new THREE.Color(), tri = (a, b, d) => {
        if (!(a.in && b.in && d.in)) return;
        pos.push(a.x, a.y, a.z, b.x, b.y, b.z, d.x, d.y, d.z);
        const h = (a.y + b.y + d.y) / 3, k = rnd();
        c.setHex(k < 0.33 ? 0xa6d85c : k < 0.66 ? 0x93cc4a : 0xb4e06a).multiplyScalar(0.93 + rnd() * 0.12);   // one family of greens everywhere: no snow caps
        for (let q = 0; q < 3; q++) col.push(c.r, c.g, c.b);
      };
      for (let j = 0; j < nz - 1; j++) for (let n = 0; n < nx - 1; n++) {
        const a = V[j][n], b = V[j][n + 1], d = V[j + 1][n], e = V[j + 1][n + 1];
        if (j % 2) { tri(a, d, b); tri(b, d, e); } else { tri(a, d, e); tri(a, e, b); }
      }
      const tg = new THREE.BufferGeometry();
      tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); tg.computeVertexNormals();
      const terrain = new THREE.Mesh(tg, lowpoly(0xffffff, { vertexColors: true, side: THREE.DoubleSide })); terrain.receiveShadow = true; mapWorld.add(terrain);

      // state boundaries: thin ribbons draped just above the faceted terrain (assets/geo/india-states.json)
      const heightAt = (x, z) => {
        const j = Math.round((z - z0) / GH); let top = 0;
        for (let dj = -1; dj <= 1; dj++) { const row = V[j + dj]; if (!row) continue; const n = Math.round((x - x0) / G - ((j + dj) % 2) * 0.5);
          for (let dn = -1; dn <= 1; dn++) { const v = row[n + dn]; if (v) top = Math.max(top, v.y); } }
        return top + 0.3;
      };
      const bp = [], HWID = 0.34;
      states.borders.forEach((line) => {
        const pts = line.map((q) => { const [x, z] = geo(q); return [x, heightAt(x, z), z]; });
        for (let n = 0; n < pts.length - 1; n++) {
          const a = pts[n], b = pts[n + 1], dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1, ox = (-dz / L) * HWID, oz = (dx / L) * HWID;
          bp.push(a[0] + ox, a[1], a[2] + oz, a[0] - ox, a[1], a[2] - oz, b[0] + ox, b[1], b[2] + oz, b[0] + ox, b[1], b[2] + oz, a[0] - ox, a[1], a[2] - oz, b[0] - ox, b[1], b[2] - oz);
        }
      });
      const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
      mapWorld.add(new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: 0x3f7a26, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, fog: false, toneMapped: false })));
      redraw = true;
    }).catch((err) => console.warn('[truck3d] India map data failed to load:', err)).finally(() => assets.done());
  }

  // ---------- ground lettering: the stage-4 copy, read from the page and painted flat on the grass ----------
  const groundText = new THREE.Group(); groundText.visible = false; land.add(groundText);
  const gtMats = [];
  {
    const PX = 50, BODY = "'Suisse Intl', Arial, sans-serif", HEAD = "Oxanium, 'Suisse Intl', Arial, sans-serif";   // canvas pixels per metre
    const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
    // draws words left to right, wrapping at maxW; each word carries its own fill so a heading can change tone part-way
    const flow = (g, words, x, y, maxW, lh) => {
      let cx = x; const sp = g.measureText(' ').width;
      words.forEach(([word, fill]) => {
        const ww = g.measureText(word).width;
        if (cx > x && cx + ww > x + maxW) { cx = x; y += lh; }
        g.fillStyle = fill; g.fillText(word, cx, y); cx += ww + sp;
      });
      return y + lh;
    };
    const split = (str, fill) => str.split(' ').filter(Boolean).map((w) => [w, fill]);
    const WHITE = 'rgba(255,255,255,.97)', SOFT = 'rgba(255,255,255,.72)', PALE = 'rgba(214,246,255,.95)';
    const paint = (hM, draw) => {
      const tex = canvasTex(GT.w * PX, hM * PX, (g, w, h) => {
        g.clearRect(0, 0, w, h); g.textBaseline = 'top';
        g.shadowColor = 'rgba(8,36,10,.6)'; g.shadowBlur = 16; g.shadowOffsetX = 3; g.shadowOffsetY = 5;      // sits into the grass, stays legible
        draw(g, w, h);
        // worn into the turf: thousands of blade-sized nicks are cut out of the paint, so the grass shows through the letters
        g.shadowColor = 'transparent'; g.globalCompositeOperation = 'destination-out'; g.lineCap = 'round';
        for (let n = 0, many = Math.floor(w * h / 55); n < many; n++) {
          const x = Math.random() * w, y = Math.random() * h, a = Math.random() * PI, len = 5 + Math.random() * 13;
          g.globalAlpha = 0.3 + Math.random() * 0.6; g.lineWidth = 0.8 + Math.random() * 1.8;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
        }
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      });
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, fog: false, opacity: 0 }); gtMats.push(mat);
      const geo = new THREE.PlaneGeometry(GT.w, hM); geo.rotateX(-PI / 2); geo.rotateY(PI);              // flat on the ground, reading upright from the camera
      const m = new THREE.Mesh(geo, mat); m.renderOrder = 2; groundText.add(m); return m;
    };
    const build = () => {
      const left = sceneEl.querySelector('.drive__split-left'), title = left && left.querySelector('.drive__split-title');
      if (!left || !title) return;
      const strong = txt(title.querySelector('span')), first = txt(title).replace(strong, '').trim();
      const head = paint(GT.head.h, (g, w) => {
        g.font = `600 ${0.72 * PX}px ${BODY}`; g.fillStyle = PALE; g.fillRect(0, 0.62 * PX, 2.2 * PX, 0.1 * PX);
        g.letterSpacing = '6px'; g.fillText(txt(left.querySelector('.drive__eyebrow')).toUpperCase(), 3.1 * PX, 0.3 * PX); g.letterSpacing = '0px';
        g.font = `800 ${2.5 * PX}px ${HEAD}`;
        let y = flow(g, [...split(first.toUpperCase(), SOFT), ...split(strong.toUpperCase(), WHITE)], 0, 2.2 * PX, w, 2.55 * PX);
        g.font = `400 ${1.02 * PX}px ${BODY}`;
        flow(g, split(txt(left.querySelector('.drive__split-lead')), WHITE), 0, y + 0.7 * PX, w * 0.94, 1.55 * PX);
      });
      head.userData = { side: 1, z: GT.head.z };
      sceneEl.querySelectorAll('.drive__item').forEach((it, n) => {
        if (n >= GT.items.length) return;
        const m = paint(GT.itemH, (g, w) => {
          g.font = `600 ${0.8 * PX}px ${BODY}`; g.fillStyle = PALE; g.fillText(txt(it.querySelector('.role__tag')), 0, 0.2 * PX);
          g.font = `800 ${2.1 * PX}px ${HEAD}`; g.fillStyle = WHITE; g.fillText(txt(it.querySelector('h4')).toUpperCase(), 0, 1.7 * PX);
          g.font = `400 ${1.02 * PX}px ${BODY}`;
          flow(g, split(txt(it.querySelector('p')), WHITE), 0, 4.6 * PX, w * 0.9, 1.55 * PX);
        });
        m.userData = { side: -1, z: GT.items[n] };
      });
      groundText.userData.ready = true; redraw = true;
    };
    const fontsIn = document.fonts ? Promise.all([document.fonts.load(`800 100px Oxanium`), document.fonts.load(`400 50px 'Suisse Intl'`), document.fonts.load(`600 50px 'Suisse Intl'`)]) : Promise.resolve();
    fontsIn.catch(() => {}).then(build);                                             // lettering is drawn once its typefaces are in
  }

  // ---------- birds: two flocks crossing under the camera during the top-down drive ----------
  const birds = new THREE.Group(); driveWorld.add(birds);
  // Egrets, modelled for a view from above: tapered body with neck, head and beak, a fanned tail, legs trailing behind,
  // and wings in two jointed parts (arm and hand) with dark, fingered primaries.
  const birdMats = [];
  const FLOCKS = [];
  {
    const mat = (color, o = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, side: THREE.DoubleSide, transparent: true, envMapIntensity: 0.5, ...o }); birdMats.push(m); return m; };
    const plume = mat(0xffffff, { vertexColors: true }), white = mat(0xf8f8f4), beakMat = mat(0xe9a11c, { roughness: 0.5 }), legMat = mat(0x24272c);
    // flat feathered surface from an outline; tone(x, span) gives each outline point its shade, so tips can run to black
    const feather = (pts, tone) => {
      const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z)))), p = g.attributes.position, c = new Float32Array(p.count * 3);
      for (let n = 0; n < p.count; n++) { const k = tone(p.getX(n), p.getY(n)); c[n * 3] = k; c[n * 3 + 1] = k; c[n * 3 + 2] = k * 0.98; }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.rotateX(PI / 2); return g;      // span along +z, chord along x (x is forward)
    };
    const ARM = 0.62;                                                                 // shoulder to wrist
    const armGeo = feather([[0.27, 0], [0.33, ARM * 0.5], [0.35, ARM], [-0.2, ARM], [-0.27, ARM * 0.82], [-0.25, ARM * 0.66], [-0.32, ARM * 0.5], [-0.3, ARM * 0.34], [-0.36, ARM * 0.18], [-0.34, 0]],
      (x) => 0.96 - Math.max(0, -x - 0.1) * 0.5);                                     // trailing edge a touch greyer
    const handGeo = feather([[0.35, 0], [0.31, 0.3], [0.2, 0.62], [0.07, 0.92], [0.0, 0.84], [-0.03, 0.9], [-0.08, 0.79], [-0.12, 0.85], [-0.16, 0.71], [-0.2, 0.76], [-0.22, 0.58], [-0.24, 0.3], [-0.2, 0]],
      (x, z) => 0.96 - Math.min(1, Math.max(0, (z - 0.34) / 0.3)) * 0.84);            // primaries darken to near-black tips
    const tailGeo = feather([[-0.42, -0.07], [-0.42, 0.07], [-0.86, 0.25], [-0.93, 0.14], [-0.9, 0.05], [-0.95, 0], [-0.9, -0.05], [-0.93, -0.14], [-0.86, -0.25]], (x) => 0.97 - Math.max(0, -x - 0.6) * 0.5);
    tailGeo.translate(0, 0.02, 0);
    const prof = [[0.0, -0.6], [0.07, -0.5], [0.15, -0.28], [0.19, 0.0], [0.17, 0.26], [0.1, 0.46], [0.065, 0.62], [0.06, 0.74], [0.095, 0.83], [0.085, 0.92], [0.03, 0.98], [0.0, 1.0]];
    const bodyGeo = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 14); bodyGeo.rotateZ(-PI / 2); bodyGeo.scale(1, 0.85, 1);   // lies along +x, nose forward
    const beakGeo = new THREE.ConeGeometry(0.035, 0.26, 8); beakGeo.rotateZ(-PI / 2); beakGeo.translate(1.11, 0, 0);
    const legGeo = new THREE.CylinderGeometry(0.016, 0.02, 0.95, 5); legGeo.rotateZ(PI / 2); legGeo.translate(-0.86, -0.05, 0);
    const bird = () => {
      const g = new THREE.Group(), rig = new THREE.Group(); g.add(rig);              // g holds the heading, rig the bank and the bob
      rig.add(new THREE.Mesh(bodyGeo, white), new THREE.Mesh(beakGeo, beakMat), new THREE.Mesh(tailGeo, plume));
      [-0.045, 0.045].forEach((z) => { const leg = new THREE.Mesh(legGeo, legMat); leg.position.z = z; rig.add(leg); });
      const wing = (sgn) => {
        const root = new THREE.Group(), wrist = new THREE.Group(); root.position.set(0.12, 0.06, 0); root.scale.z = sgn;      // the right wing is the left one mirrored
        root.add(new THREE.Mesh(armGeo, plume)); wrist.position.z = ARM; wrist.add(new THREE.Mesh(handGeo, plume)); root.add(wrist); rig.add(root);
        return { root, wrist, sgn };
      };
      g.userData = { rig, wings: [wing(1), wing(-1)], phase: Math.random() * 6.28, rate: 6.4 + Math.random() * 1.6, mood: Math.random() * 6.28 };
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      birds.add(g); return g;
    };
    // dir is the heading in the x/z plane (from above, screen-left is +x and screen-up is +z); each flock flies a loose V behind its leader
    [{ dir: [1, 0.42], y: 30, n: LITE ? 5 : 7, speed: 15, phase: 0, size: 1.25 }, { dir: [-1, 0.22], y: 23, n: LITE ? 3 : 4, speed: 12, phase: 95, size: 1.05 }].forEach((f) => {
      const len = Math.hypot(f.dir[0], f.dir[1]); f.dx = f.dir[0] / len; f.dz = f.dir[1] / len;
      f.birds = []; for (let i = 0; i < f.n; i++) { const b = bird(); b.scale.setScalar(f.size * (0.92 + Math.random() * 0.16)); b.rotation.y = Math.atan2(-f.dz, f.dx);
        const row = Math.ceil(i / 2), sgn = i % 2 ? 1 : -1; b.userData.back = row * 3.1 + Math.random() * 1.2; b.userData.lat = sgn * (row * 2.5 + Math.random() * 0.6); f.birds.push(b); }
      FLOCKS.push(f);
    });
  }
  // ---------- camera: front three-quarter -> side-on -> top-down -> out to the map, keyed to timeline time ----------
  // pos/look are offsets from the truck in world axes. From above, screen-up is +z and screen-left is +x.
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = (k) => k * k * (3 - 2 * k);
  const step = (a, b, v) => ease(Math.min(1, Math.max(0, (v - a) / (b - a))));
  const MC = [-(79.7 - ANCHOR[0]) * U * 0.94, (22.4 - ANCHOR[1]) * U];      // centre of India, as an offset from the truck
  const KEY = [
    { t: 0,    pos: [20, 3.4, -31],   look: [5.5, 4.5, 0], slim: { pos: [37, 4.4, -18], look: [6.5, 7.0, 0] } },    // hero headline (truck sits right/low; on phones, below the copy)
    { t: 1.5,  pos: [6, 3.0, -37],    look: [0, 0.4, 0], slim: { pos: [33, 3.6, -21], look: [6, -4.3, 0] } },       // how we operate (side-on, truck sits high; phones keep a front-quarter view up top)
    { t: 3,    pos: [-3, 3.6, -39],   look: [-0.5, 0.2, 0], slim: { pos: [27, 3.8, -27], look: [4.5, -3.4, 0] } },  // numbers
    { t: 4,    pos: [0, 46, -0.5],    look: [0, 0, 0] },       // lifted to top-down, still close
    { t: 4.7,  pos: [0, 80, -0.8],    look: [0, 0, 0] },       // pulled back; framing is taken over by the junction hold
    { t: 6,    pos: [0, 80, 3.2],     look: [0, 0, 4] },       // heading down the centre of the screen
    { t: 8.5,  pos: [0, 80, 3.2],     look: [0, 0, 4] },       // end of the drive
    { t: 9.05, pos: [0, 290, -34],    look: [0, 0, 10] },      // climbing into cloud; the worlds swap here
    { t: 10.3, pos: [MC[0], 600, MC[1] - 372], look: [MC[0], 0, MC[1]] },                 // the whole of India, seen at an angle
    { t: 13,   pos: [MC[0] + 10, 560, MC[1] - 352], look: [MC[0] + 5, 0, MC[1] - 4] },    // slow push-in while the corridors draw
  ];
  const T_END = KEY[KEY.length - 1].t;
  const JUNCTION = { x: S1 + RR, z: -ROAD_W * 0.9 };                      // middle of the split
  function placeCamera(t, aspect, at) {
    let i = 0; while (i < KEY.length - 2 && t > KEY[i + 1].t) i++;
    const a = KEY[i], b = KEY[i + 1], k = step(a.t, b.t, t);
    const slim = Math.min(1, Math.max(0, (1.55 - aspect) / 0.9));             // 0 on desktop, 1 on a tall phone
    const out = step(T_SWAP, T_MAP, t);                                       // 0 while driving, 1 on the map
    // phones get their own framing for the first three stages (the `slim` keys): a closer front-quarter view
    // placed clear of the copy, where a wide side-on shot would leave the truck tiny and behind the text
    const forPhone = (key) => (key.slim && slim > 0 ? { pos: key.pos.map((v, n) => lerp(v, key.slim.pos[n], slim)), look: key.look.map((v, n) => lerp(v, key.slim.look[n], slim)) } : key);
    const ka = forPhone(a), kb = forPhone(b);
    let far = lerp(lerp(Math.max(1, 1.55 / aspect), 1, slim), 1, step(3, 4, t));   // desktop side views pull back when the window is narrow
    far = lerp(far, Math.max(1, (1.25 - 0.27 * slim) / aspect), out);              // the map pulls back so India always fits
    const L = [0, 1, 2].map((n) => lerp(ka.look[n], kb.look[n], k));
    const P = [0, 1, 2].map((n) => lerp(ka.pos[n], kb.pos[n], k));
    const shift = -6 * slim * step(5, 6, t) * (1 - step(8.6, 9.2, t))         // phones: road moves left, leaving room for the feed
      + 98 * (1 - slim) * out;                                                // desktop: India sits right of the corridor card
    L[0] += shift; P[0] += shift;
    const south = -38 * slim * out;                                            // phones: India sits above the card at the bottom of the screen
    L[2] += south; P[2] += south;
    // through the bend the camera stops following the truck and holds the junction centre-screen
    const hold = step(4.05, 4.6, t) * (1 - step(4.85, 5.4, t));     // released as the truck leaves the bend, so it never runs off-screen
    const tx = lerp(at.x + L[0], JUNCTION.x, hold), tz = lerp(at.z + L[2], JUNCTION.z, hold);
    camera.position.set(tx + (P[0] - L[0]) * far, L[1] + (P[1] - L[1]) * far, tz + (P[2] - L[2]) * far);
    camera.lookAt(tx, L[1], tz);
  }

  // ---------- contact panel: the same 3D truck, driving in place, on its own canvas ----------
  // The truck is one object; for each contact frame it is borrowed into this small scene, posed, drawn,
  // and the hero puts it back (and re-poses it) before its own next render.
  let contact = null;
  const cEl = document.getElementById('contactCanvas');
  if (cEl && !LITE) {                                            // on phones the panel keeps its still image: one 3D view is enough
    try {
      const r2 = new THREE.WebGLRenderer({ canvas: cEl, antialias: true, alpha: true });
      r2.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      r2.shadowMap.enabled = true; r2.shadowMap.type = THREE.PCFSoftShadowMap; r2.toneMapping = THREE.NeutralToneMapping; r2.toneMappingExposure = 1.15;
      const s2 = new THREE.Scene(); s2.fog = new THREE.Fog(0x0b1930, 46, 170);
      { const env = new THREE.Scene(), c = document.createElement('canvas'); c.width = 16; c.height = 256; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
        gr.addColorStop(0, '#9cc6ee'); gr.addColorStop(0.495, '#ffffff'); gr.addColorStop(0.515, '#2a3b5c'); gr.addColorStop(1, '#0a1424'); g.fillStyle = gr; g.fillRect(0, 0, 16, 256);
        const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
        env.add(new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), new THREE.MeshBasicMaterial({ map: tx, side: THREE.BackSide })));
        [[10, 34, -30, 26, 9], [34, 16, -26, 16, 6], [-18, 30, -34, 22, 5]].forEach(([x, y, z, sz, k]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sz, sz * 0.5, 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k) })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); });
        const pm = new THREE.PMREMGenerator(r2); s2.environment = pm.fromScene(env, 0.03).texture; s2.environmentIntensity = 0.85; pm.dispose(); }
      s2.add(new THREE.HemisphereLight(0xffffff, 0x1b2a4a, 0.4));
      const sun2 = new THREE.DirectionalLight(0xfff6e8, 2.6); sun2.position.set(13, 22, -17); sun2.castShadow = true; sun2.shadow.mapSize.set(2048, 2048);
      Object.assign(sun2.shadow.camera, { left: -15, right: 15, top: 12, bottom: -12, near: 1, far: 80 }); sun2.shadow.bias = -0.0005; sun2.shadow.normalBias = 0.02;
      s2.add(sun2); s2.add(sun2.target);
      const g2 = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), std(0x0e1c33, { roughness: 1, metalness: 0 })); g2.rotation.x = -PI / 2; g2.receiveShadow = true; s2.add(g2);
      const rm = roadMat(true, true); rm.map.repeat.set(420 / ROAD_PERIOD, 1);
      const road2 = new THREE.Mesh(new THREE.PlaneGeometry(420, ROAD_W), rm); road2.rotation.x = -PI / 2; road2.position.y = 0.012; road2.receiveShadow = true; s2.add(road2);
      const cam2 = new THREE.PerspectiveCamera(30, 1, 0.5, 400);
      contact = { r2, s2, cam2, road2, w: 0, h: 0, on: false, box: cEl.parentElement };
      new IntersectionObserver((es) => { contact.on = es[0].isIntersecting; }).observe(cEl);
      contact.box.classList.add('is-live');
    } catch (err) { console.warn('[truck3d] contact scene unavailable:', err); }
  }
  function renderContact(now) {
    const c = contact, w = c.box.clientWidth, h = c.box.clientHeight;
    if (!w || !h) return;
    if (w !== c.w || h !== c.h) { c.r2.setSize(w, h, false); c.cam2.aspect = w / h; c.cam2.updateProjectionMatrix(); c.w = w; c.h = h; }
    const d = now * 9;                                                          // metres travelled: wheels and road dashes keep in step
    c.s2.add(truck); truck.position.set(0, Math.sin(now * 5.2) * 0.012, 0); truck.rotation.y = 0; truck.scale.setScalar(1);
    spinners.forEach(({ spin, side }) => { spin.rotation.z = -side * d / R; });
    c.road2.material.map.offset.x = (d / ROAD_PERIOD) % 1;
    const a = 0.82 + Math.sin(now * 0.22) * 0.3, tall = Math.max(1, 0.62 / (w / h));       // slow drift around the front quarter; pull back when narrow
    c.cam2.position.set(4.5 + Math.cos(a) * 21 * tall, 3.3 + Math.sin(now * 0.31) * 0.5, -Math.sin(a) * 21 * tall);
    c.cam2.lookAt(4.5, 2.5, 0);
    c.r2.render(c.s2, c.cam2);
  }

  // ---------- render: on demand while driving, continuously once the map is up ----------
  let lastT = -1, lastW = 0, lastH = 0, shown = false, redraw = false, onScreen = true;
  new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; }).observe(sceneEl);
  const proj = new THREE.Vector3(), tan = new THREE.Vector3(), washTo = new THREE.Color(0x9fd356);
  function frame() {
    requestAnimationFrame(frame);
    if (contact && contact.on) renderContact(performance.now() / 1000);
    const w = sceneEl.clientWidth, h = sceneEl.clientHeight;
    const t = Math.min(T_END, Math.max(0, (window.zdDrive && window.zdDrive.t) || 0));
    const onMap = t >= T_SWAP, flying = t > 3.7 && t < 8.75, live = (onMap || flying) && onScreen;   // the map and the birds animate by the clock
    if (!w || !h || (!live && !redraw && t === lastT && w === lastW && h === lastH)) return;
    redraw = false;
    if (w !== lastW || h !== lastH) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    lastT = t; lastW = w; lastH = h;

    if (truck.parent !== scene) scene.add(truck);                                    // back from the contact panel, if it was borrowed
    const dist = Math.min(t, T_DRIVE) * SPEED, at = route(dist);                     // the road drive ends at T_DRIVE
    const now = performance.now() / 1000;
    // where a corridor's vehicle is: at the head of the line while it draws (scroll-driven), then shuttling by the clock
    const runner = (n) => {
      const r = mapRoutes[n], g = mapRigs[n], k = step(r.t0, r.t0 + ROUTE_GAP, t);
      if (k <= 0) { g.t1 = undefined; return null; }
      if (k < 1) { g.t1 = undefined; return { u: k, back: false }; }
      if (g.t1 === undefined) g.t1 = now;
      const cyc = (1 + (now - g.t1) / g.dur) % 2;
      return cyc >= 1 ? { u: 2 - cyc, back: true } : { u: cyc, back: false };
    };
    // the hero truck: on the road, then gliding to Mumbai and shrinking to map scale, then driving corridor 1
    let hx = at.x, hy = Math.sin(dist * 0.9) * 0.01, hz = at.z, hh = at.h, hs = 1;
    if (t > T_DRIVE) {
      const c0 = mapRigs[0].curve, k0 = step(T_DRIVE, T_MAP, t), run = runner(0);
      c0.getPointAt(run ? run.u : 0, proj); c0.getTangentAt(run ? run.u : 0, tan);
      const head = Math.atan2(-tan.z, tan.x) + (run && run.back ? PI : 0);
      hx = lerp(at.x, proj.x, k0); hz = lerp(at.z, proj.z, k0); hy = lerp(0, 4.7, k0); hs = lerp(1, 0.72, k0); hh = lerp(at.h, head, k0);
    }
    truck.position.set(hx, hy, hz); truck.rotation.y = hh; truck.scale.setScalar(hs);
    const roll = dist + Math.max(0, t - T_DRIVE) * 40;
    spinners.forEach(({ spin, side }) => { spin.rotation.z = -side * roll / R; });   // roll without slipping
    sun.position.set(hx + 13, 22 + hy, hz - 17); sun.target.position.set(hx, hy, hz);

    driveWorld.visible = !onMap; mapWorld.visible = onMap;
    // lifting to top-down: the dark ground gives way to the light page, leaving the road as a ribbon
    const lift = step(3.05, 3.8, t);
    ground.visible = false;                                                          // the road runs through grass from the first frame
    clouds.visible = t < 3.45;
    const leave = step(T_DRIVE + 0.05, T_DRIVE + 0.4, t);                            // road-side detail sinks away as the camera climbs out
    const haze = step(3.55, 4.3, t) * (1 - leave);                                   // mist arrives as the camera climbs
    mist.visible = haze > 0; mistMats.forEach((m) => { m.opacity = 0.85 * haze; });
    const grow = step(3.45, 3.95, t) * (1 - leave);                                  // trees rise only once the camera is looking down
    trees.visible = grow > 0; trees.scale.y = Math.max(0.001, grow);
    land.visible = true;                                                             // grass and shoulder always; trees only from above (see grow)
    scene.fog.near = onMap ? 4000 : lerp(70, 500, lift); scene.fog.far = onMap ? 12000 : lerp(240, 1400, lift);

    // landscape -> map: a green wash rises over the grass and road, shifts to the map's green, the worlds swap
    // underneath it, then it thins out so the coastline and sea appear from under it. No cut, no white-out.
    const wash = mapWorld.userData.wash, wo = onMap ? 1 - step(T_SWAP + 0.05, T_SWAP + 0.75, t) : step(T_DRIVE + 0.1, T_SWAP - 0.2, t);
    wash.visible = wo > 0.001; wash.material.opacity = wo;
    wash.material.color.setHex(0x5a9a3a).lerp(washTo, step(T_SWAP - 0.3, T_SWAP, t));

    // cloud on the climb: thickens after the drive, is densest around the swap, and is gone before the map's labels and corridors come in
    const veil = step(T_DRIVE + 0.15, T_DRIVE + 0.6, t) * (1 - step(T_SWAP + 0.2, T_MAP - 0.45, t));
    mapWorld.userData.passClouds.forEach((sp) => {
      sp.visible = veil > 0.002; sp.material.opacity = veil * 0.74;        // cloud drifting past the edges of the view, never a white-out
      sp.position.x = sp.userData.x + Math.sin(now * 0.12 + sp.userData.phase) * sp.userData.drift;
    });

    // ground lettering replaces the HTML cards on wide screens; it is sized to the strip of grass the window leaves beside the road
    const wide = w / h >= 1.25 && w >= 861 && groundText.userData.ready === true;
    if (wide !== groundText.userData.on) { groundText.userData.on = wide; document.body.classList.toggle('drive-ground', wide); }
    groundText.visible = wide && t > 3.5 && t < T_DRIVE + 0.5;
    if (groundText.visible) {
      const room = Math.min(GT.w, Math.max(14, Math.tan(PI / 12) * 80 * (w / h) - GT.near - 1.5)), k = room / GT.w, ink = step(3.7, 4.4, t) * (1 - leave);
      gtMats.forEach((m) => { m.opacity = ink * 0.86; });           // slightly sheer, so the turf's light and shade carry through
      groundText.children.forEach((m) => { m.scale.setScalar(k); m.position.set(GT.rx + m.userData.side * (GT.near + room / 2), -0.16, m.userData.z); });
    }
    const fly = step(3.7, 4.2, t) * (1 - step(8.45, 8.75, t));                       // birds are about only while the camera looks straight down
    birds.visible = fly > 0.01; birdMats.forEach((m) => { m.opacity = fly; });
    if (birds.visible) FLOCKS.forEach((f) => {
      const s = ((now * f.speed + f.phase) % 190) - 95;                             // one pass across the view, then round again
      f.birds.forEach((b) => {
        const u = b.userData, ph = now * u.rate + u.phase;
        // each bird flaps for a while, then holds its wings out and glides; the hand trails the arm by a fraction of a beat
        const glide = step(0.35, 0.65, Math.sin(now * 0.42 + u.mood)), beat = 1 - glide;
        const arm = lerp(0.1 + 0.62 * Math.sin(ph), 0.16, glide), hand = lerp(-0.12 + 0.55 * Math.sin(ph - 1.05), -0.06, glide);
        u.wings.forEach((wg) => { wg.root.rotation.x = -wg.sgn * arm; wg.wrist.rotation.x = -hand; });
        const along = s - u.back + Math.sin(now * 0.31 + u.mood * 2) * 0.7, lat = u.lat + Math.sin(now * 0.37 + u.mood) * 0.55;   // drifting in formation
        b.position.set(hx + f.dx * along - f.dz * lat, f.y + Math.sin(now * 0.9 + u.mood) * 0.5, hz + f.dz * along + f.dx * lat);
        u.rig.position.y = -Math.sin(ph) * 0.11 * beat;                               // the body dips as the wings come up
        u.rig.rotation.x = Math.cos(now * 0.37 + u.mood) * 0.16;                      // banks into its sideways drift
      });
    });

    placeCamera(t, w / h, at);

    if (onMap) {
      mapRoutes.forEach((r) => { r.tube.geometry.setDrawRange(0, Math.floor((r.count * step(r.t0, r.t0 + ROUTE_GAP, t)) / 3) * 3); });
      mapRigs.forEach((g, n) => {
        if (!g.rig) return;
        const run = runner(n); g.rig.visible = !!run;
        if (!run) return;
        g.curve.getPointAt(run.u, g.rig.position); g.curve.getTangentAt(run.u, tan);
        g.rig.rotation.y = Math.atan2(-tan.z, tan.x) + (run.back ? PI : 0);
      });
      mapPuffs.forEach((p) => { p.position.x = p.userData.x + Math.sin(now * 0.05 * p.userData.speed + p.userData.phase) * p.userData.span; });
      mapWorld.userData.sea.uniforms.uTime.value = now;                                  // the ocean shader runs on the clock
      mapWorld.userData.ships.forEach((g) => {                                           // ships cross their lane, turn and come back
        const d = g.userData, cyc = (now / d.dur + d.phase) % 2, back = cyc > 1, u = back ? 2 - cyc : cyc;
        g.position.set(lerp(d.a[0], d.b[0], u), -4.75 + Math.sin(now * 0.9 + d.phase * 9) * 0.12, lerp(d.a[1], d.b[1], u));
        g.rotation.y = Math.atan2(-(d.b[1] - d.a[1]), d.b[0] - d.a[0]) + (back ? PI : 0); g.rotation.x = Math.sin(now * 0.8 + d.phase * 7) * 0.025;
      });
    }
    renderer.render(scene, camera);

    const show = step(9.75, 10.25, t);                                               // project the pin labels onto the page
    const tracing = Math.min(CORRIDORS.length - 1, Math.max(0, Math.floor((t - T_MAP) / ROUTE_GAP)));   // corridor being traced
    mapLabels.forEach((l) => {
      if (!show) { l.o = 0; l.el.style.opacity = 0; return; }
      l.o += ((!l.on || l.on.includes(tracing) ? 1 : 0) - l.o) * 0.14;                 // names cross-fade as the story moves to the next corridor
      proj.copy(l.v).project(camera);
      l.el.style.opacity = (show * l.o).toFixed(3); l.el.style.transform = `translate(${((proj.x + 1) / 2 * w).toFixed(1)}px, ${((1 - proj.y) / 2 * h).toFixed(1)}px)`;
    });
    if (!shown) { shown = true; document.body.classList.add('drive-3d'); assets.done(); }
  }
  frame();
}
