// Lantern Sky: a night flight for phones. Your crew member rides a paper glider through a glowing lantern festival.
// Drag to steer; collect fireflies and stars; dodge rocks, lantern ropes and owls. Every few seconds three lantern rings
// come up with a word each: fly through the one that fills the gap in the sentence. Three nights, each ending in fireworks.
// Everything is 3D, built in code (three.js); the crew are smooth cartoon versions of the original characters.
import * as THREE from './lib/three.module.min.js';

const $ = (id) => document.getElementById(id);
const R = Math.random, rand = (a, b) => a + R() * (b - a), pick = (a) => a[(R() * a.length) | 0];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = Math.PI * 2;
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = R() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- save ---------- */
const SAVE = 'fugio-lantern-sky';
const save = { hero: 'foxino', night: 0, stars: [0, 0, 0], best: [0, 0, 0], packs: [], calm: false };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE) || '{}')); } catch (e) {}
const store = () => { try { localStorage.setItem(SAVE, JSON.stringify(save)); } catch (e) {} };

/* ---------- sound: soft chimes in a pentatonic scale ---------- */
let AC = null, master = null;
const ac = () => { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = .55; master.connect(AC.destination); } catch (e) {} } return AC; };
function tone(f, d = .3, type = 'sine', vol = .08, slide = 0, delay = 0) {
  const a = ac(); if (!a) return;
  const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .015); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g).connect(master); o.start(t); o.stop(t + d + .05);
}
function noise(d = .3, vol = .1, freq = 1200, delay = 0) {
  const a = ac(); if (!a) return;
  const t = a.currentTime + delay, b = a.createBuffer(1, a.sampleRate * d, a.sampleRate), c = b.getChannelData(0);
  for (let i = 0; i < c.length; i++) c[i] = (R() * 2 - 1) * (1 - i / c.length);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); s.buffer = b; f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = vol;
  s.connect(f).connect(g).connect(master); s.start(t);
}
const PENTA = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568];
let chimeI = 0;
const sfx = {
  firefly: () => { tone(PENTA[chimeI = (chimeI + 1) % PENTA.length], .35, 'sine', .05); tone(PENTA[chimeI] * 2, .2, 'sine', .015); },
  star: () => [0, 2, 4, 7].forEach((k, i) => tone(PENTA[k], .4, 'triangle', .06, 0, i * .06)),
  right: () => [0, 2, 4, 5, 7].forEach((k, i) => tone(PENTA[k] * 1.0, .45, 'triangle', .06, 0, i * .07)),
  wrong: () => { tone(330, .35, 'triangle', .07, .7); tone(247, .45, 'triangle', .06, .8, .12); },
  hit: () => { noise(.25, .25, 400); tone(140, .3, 'sine', .12, .5); },
  boost: () => { noise(.6, .12, 2400); tone(440, .5, 'sine', .05, 2); },
  pop: () => { noise(.12, .18, 900); [0, 4].forEach((k, i) => tone(PENTA[k + 2], .5, 'sine', .04, 0, .05 + i * .05)); noise(.5, .05, 5000, .08); },
  click: () => tone(880, .08, 'sine', .05),
  heart: () => [0, 4, 7].forEach((k, i) => tone(PENTA[k], .3, 'sine', .06, 0, i * .07)),
  crash: () => { noise(.8, .3, 300); tone(200, .8, 'sine', .1, .3); },
  // (v2) a firefly chain climbs the pentatonic ladder one note at a time, so any chain sounds like a little tune going up
  chain: (n) => { const f = LADDER[Math.min(n - 1, LADDER.length - 1)] * (1 + (R() - .5) * .012); tone(f, .35, 'sine', .05); tone(f * 2, .2, 'sine', .014); },
  milestone: () => { [0, 2, 4, 5, 7, 9].forEach((k, i) => tone(LADDER[k + 3], .3, 'triangle', .045, 0, i * .045)); noise(.4, .04, 6000, .1); },
  whoosh: () => { noise(.32, .16, 1900); tone(260, .28, 'sine', .035, 2.4); },
  puff: () => { noise(.35, .11, 650); tone(196, .3, 'sine', .07, .75); }, // a soft "puff" for a wrong ring, never a buzzer
  bigChord: () => { [0, 2, 4].forEach((k) => tone(PENTA[k], 1.1, 'triangle', .045)); [0, 2, 4, 5, 7].forEach((k, i) => tone(PENTA[k] * 2, .5, 'sine', .035, 0, .08 + i * .07)); noise(.6, .05, 5000, .05); },
  starPop: (i) => { tone(PENTA[2 + i * 2], .55, 'triangle', .08); tone(PENTA[2 + i * 2] * 2, .4, 'sine', .03, 0, .03); noise(.15, .06, 4000); },
  heartLost: () => { tone(523, .18, 'triangle', .05, .8); tone(392, .3, 'triangle', .05, .8, .09); },
};
const LADDER = [...PENTA, 1760, 2093, 2349, 2637];
// (v2) haptics: short buzzes on Android (iOS Safari has none); off in calm mode
const buzz = (p) => { if (save.calm) return; try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

/* ---------- English: the A0–A2 gap-fill packages (same as the other Fugio games) ---------- */
const PACKS = window.FugioPacks ? FugioPacks.sort(window.GUMMY_PACKAGES || []) : (window.GUMMY_PACKAGES || []);
save.packs = (save.packs || []).filter((id) => PACKS.some((p) => p.id === id));
if (!save.packs.length && PACKS.length) save.packs = [PACKS[0].id];
const packNow = () => (window.FugioPacks ? FugioPacks.merge(PACKS, save.packs) : PACKS[0]) || PACKS[0];
const SLOT = new Set(['do', 'does', "don't", "doesn't", 'did', "didn't", 'was', 'were', "wasn't", "weren't", 'is', 'are', 'am',
  "isn't", "aren't", 'a', 'an', 'the', 'more', 'most', 'less', 'least', 'because', 'so', 'and', 'but', 'or', 'have', 'has', 'not']);
const slotKey = (t) => t.toLowerCase().replace(/[^a-z' ]/g, '').split(/\s+/).filter(Boolean).map((w) => SLOT.has(w) ? w : '_').join(' ');
function mixComparisons(q) {
  const m = q.match(/^(.*)\[([^|\]]+)\|(the [^|\]]+)\]( \([^)]*\)) than [^.?!]*([.?!])$/);
  return m && R() < .5 ? `${m[1]}[${m[3]}|${m[2]}]${m[4]} of all${m[5]}` : q;
}
function fillChoices(q) {
  const m = q.match(/\[([^\]]+)\]/);
  const [right, ...wrong] = m[1].split('|');
  const words = [{ text: right, ok: true }, ...shuffle(wrong).slice(0, 2).map((t) => ({ text: t, ok: false }))];
  words.sort((x, y) => slotKey(x.text).localeCompare(slotKey(y.text)) || x.text.localeCompare(y.text));
  words.before = q.slice(0, m.index); words.after = q.slice(m.index + m[0].length); words.right = right;
  return words;
}
const usedQ = new Set();
// night 1 asks the package's easy third, night 2 the middle third, night 3 the hardest
function pickSentence(night) {
  const pk = packNow(); if (!pk) return null;
  const r = clamp(night, 0, 2), mine = pk.rounds[r] || [], rest = pk.rounds.filter((_, i) => i !== r).flat();
  const free = (l) => l.filter((q) => !usedQ.has(q));
  let pool = free(mine); if (!pool.length) pool = free(rest);
  if (!pool.length) { usedQ.clear(); pool = mine.length ? mine : rest; }
  const q = pick(pool); usedQ.add(q); return mixComparisons(q);
}
const hints = (t) => esc(t).replace(/\(([^)]*)\)/g, '<i>($1)</i>');

/* ---------- renderer, camera, the glow pass ---------- */
const stage = $('stage'), cv = $('cv');
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
cv.addEventListener('webglcontextlost', (e) => e.preventDefault()); cv.addEventListener('webglcontextrestored', () => location.reload());
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(64, 1, .1, 600);
const U = { time: { value: 0 }, pr: { value: 1 } };
let VW = 1, VH = 1;
const post = (() => {
  const gl2 = renderer.capabilities.isWebGL2;
  const hdr = gl2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
  const type = hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
  let main = new THREE.WebGLRenderTarget(4, 4, { type, samples: gl2 ? 4 : 0 });
  const mk = () => { const t = new THREE.WebGLRenderTarget(4, 4, { type }); t.depthBuffer = false; return t; };
  const a = mk(), b = mk(), c = mk(), d = mk();
  const cam2 = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), sc = new THREE.Scene(), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); sc.add(quad);
  const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
  const sm = (u, fs) => new THREE.ShaderMaterial({ uniforms: u, vertexShader: VS, fragmentShader: fs, depthTest: false, depthWrite: false });
  const bright = sm({ t: { value: null }, th: { value: hdr ? .85 : .7 } }, `uniform sampler2D t; uniform float th; varying vec2 vUv;
    void main(){ vec3 c = texture2D(t, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(th, th + .6, l), 1.); }`);
  const blur = sm({ t: { value: null }, dir: { value: new THREE.Vector2() } }, `uniform sampler2D t; uniform vec2 dir; varying vec2 vUv;
    void main(){ vec3 c = texture2D(t, vUv).rgb * .227;
      c += (texture2D(t, vUv + dir * 1.385).rgb + texture2D(t, vUv - dir * 1.385).rgb) * .316;
      c += (texture2D(t, vUv + dir * 3.231).rgb + texture2D(t, vUv - dir * 3.231).rgb) * .070;
      gl_FragColor = vec4(c, 1.); }`);
  const final = sm({ t: { value: null }, b1: { value: null }, b2: { value: null }, glow: { value: 1.15 }, expo: { value: 1.05 } }, `
    uniform sampler2D t, b1, b2; uniform float glow, expo; varying vec2 vUv;
    vec3 aces(vec3 x){ return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
    vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
    void main(){
      vec3 c = texture2D(t, vUv).rgb + (texture2D(b1, vUv).rgb * .9 + texture2D(b2, vUv).rgb * 1.1) * glow;
      c = aces(c * expo);
      float l = dot(c, vec3(.299, .587, .114)); c = mix(vec3(l), c, 1.15);
      vec2 q = vUv - .5; c *= 1. - dot(q, q) * .7;
      c = toSRGB(clamp(c, 0., 1.));
      c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - .5) / 255.;
      gl_FragColor = vec4(c, 1.); }`);
  let on = true;
  function size(w, h) {
    main.setSize(w, h);
    const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1), qw = Math.max(1, w >> 2), qh = Math.max(1, h >> 2);
    a.setSize(hw, hh); b.setSize(hw, hh); c.setSize(qw, qh); d.setSize(qw, qh);
  }
  const pass = (m, target) => { quad.material = m; renderer.setRenderTarget(target); renderer.render(sc, cam2); };
  function render(s, camera) {
    if (!on) { renderer.setRenderTarget(null); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.render(s, camera); return; }
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setRenderTarget(main); renderer.render(s, camera); stats.calls = renderer.info.render.calls; stats.tris = renderer.info.render.triangles;
    bright.uniforms.t.value = main.texture; pass(bright, a);
    blur.uniforms.t.value = a.texture; blur.uniforms.dir.value.set(1 / a.width, 0); pass(blur, b);
    blur.uniforms.t.value = b.texture; blur.uniforms.dir.value.set(0, 1 / a.height); pass(blur, a);
    blur.uniforms.t.value = a.texture; blur.uniforms.dir.value.set(1 / c.width, 0); pass(blur, c);
    blur.uniforms.t.value = c.texture; blur.uniforms.dir.value.set(0, 1 / c.height); pass(blur, d);
    final.uniforms.t.value = main.texture; final.uniforms.b1.value = a.texture; final.uniforms.b2.value = d.texture;
    pass(final, null);
  }
  function lower(level) {
    if (level === 1) renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.4));
    if (level === 2) { main.dispose(); main = new THREE.WebGLRenderTarget(4, 4, { type, samples: 0 }); renderer.setPixelRatio(1.15); }
    if (level === 3) { on = false; renderer.setPixelRatio(1); }
    fit();
  }
  return { size, render, lower };
})();
const stats = { calls: 0, tris: 0 };
let quality = 0, slowT = 0;
function watchSpeed(raw) {
  if (quality >= 3) return;
  slowT = raw > 1 / 38 ? slowT + raw : Math.max(0, slowT - raw * .5);
  if (slowT > 2.5) { quality++; slowT = 0; post.lower(quality); applyQuality(); }
}
// (v2) on slow phones the extra glow layers go first: water sparkles and lantern halos at level 2, reflections at level 3
function applyQuality() { if (!W) return; W.sparkle.visible = W.lanHalo.visible = quality < 2; W.refl.visible = quality < 3; }
function fit() {
  VH = window.innerHeight;
  // The play area used to be capped at 0.62 x the height — a phone shape — so on a laptop or a classroom
  // screen the game sat in a narrow strip with empty bars either side, using about 40% of the width.
  // It now fills the window up to 1.6 x the height, which is the whole screen on anything up to 16:10 and
  // still keeps an ultra-wide monitor from stretching the view.
  VW = Math.min(window.innerWidth, Math.round(VH * 1.6));
  stage.style.width = VW + 'px';
  renderer.setSize(VW, VH);
  const pr = renderer.getPixelRatio(); post.size(Math.round(VW * pr), Math.round(VH * pr)); U.pr.value = pr;
  cam.aspect = VW / VH; cam.updateProjectionMatrix();
}
addEventListener('resize', fit);

/* ---------- shapes and materials ---------- */
const mats = {};
const S = (c, o) => { const k = c + (o ? JSON.stringify(o) : ''); return mats[k] || (mats[k] = new THREE.MeshLambertMaterial({ color: c, ...o })); };
const GLOW = (c, k = 1.6) => S(c, { emissive: c, emissiveIntensity: k });
const SPH = new THREE.SphereGeometry(1, 24, 16), SPH_LO = new THREE.SphereGeometry(1, 10, 8), ICO = new THREE.IcosahedronGeometry(1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 18), CONE = new THREE.ConeGeometry(1, 1, 18), BUSH = new THREE.IcosahedronGeometry(1, 2);
function part(p, geo, mat, sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); p.add(m); return m;
}
const sph = (p, mat, r, x, y, z, sx = 1, sy = 1, sz = 1) => part(p, SPH, mat, r * sx, r * sy, r * sz, x, y, z);
function cap(p, mat, r, len, x, y, z, rx = 0, ry = 0, rz = 0) { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); p.add(m); return m; }
function tex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const DOT = tex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
// soft rim light so the crew and creatures glow at the edges against the night
const rimCache = new Map();
function rimify(m) {
  if (Array.isArray(m)) return m.map(rimify);
  if (!m || !m.isMeshLambertMaterial) return m;
  if (rimCache.has(m)) return rimCache.get(m);
  const r = m.clone();
  r.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
      float rimF = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.6);
      outgoingLight += vec3(.75, .8, 1.3) * rimF * .55;
      #include <opaque_fragment>`); };
  r.customProgramCacheKey = () => 'rim'; rimCache.set(m, r); return r;
}
const rimModel = (g) => { g.traverse((o) => { if (o.isMesh && !o.userData.noRim) o.material = rimify(o.material); }); return g; };
// cartoon eyes: white, a coloured iris, a pupil and a shine; facing +z
function eyes(p, y, z, s, gap, iris = 0x3a2a60, lid) {
  const out = [];
  for (const k of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(k * gap, y, z); p.add(e); out.push(e);
    sph(e, S(0xffffff), s, 0, 0, 0, .95, 1.1, .55);
    sph(e, S(iris), s * .62, 0, -s * .08, s * .3, 1, 1.05, .5);
    sph(e, S(0x120a20), s * .34, 0, -s * .1, s * .45, 1, 1.05, .4);
    sph(e, S(0xffffff, { emissive: 0xffffff }), s * .16, s * .2, s * .18, s * .55, 1, 1, .5);
    if (lid) sph(e, S(lid), s * 1.04, 0, s * .32, s * .05, 1, .62, .6);
  }
  return out;
}

/* ---------- the crew: smooth cartoon versions of the original characters, sitting on the glider (facing +z) ---------- */
const CREW = {
  foxino: { name: 'Foxino', accent: 0xffd23f, trail: 0xffb347 },
  stella: { name: 'Stella', accent: 0x3c6fd8, trail: 0x7ab4ff },
  pix: { name: 'Pix', accent: 0x8e4ad8, trail: 0xc8ff5a },
  rob: { name: 'Rob', accent: 0x36c3ea, trail: 0x7ff3ff },
  gummy: { name: 'Gummy', accent: 0xff5db1, trail: 0xff9ad8 },
  charlie: { name: 'Charlie', accent: 0x9a7ae0, trail: 0xd8c8ff },
};
// body parts shared by everyone: seated legs, a torso, arms holding the wing, a head group
function body(o) {
  const g = new THREE.Group(), p = { g };
  const up = new THREE.Group(); up.position.y = .08; g.add(up); p.up = up;
  if (!o.noLegs) p.legs = [-1, 1].map((s) => {
    const l = new THREE.Group(); l.position.set(s * o.hipW, .08, .02); g.add(l);
    cap(l, o.thigh, o.legR, .14, 0, 0, .12, Math.PI / 2);
    cap(l, o.shin || o.thigh, o.legR * .92, o.shinL || .14, 0, -.12, .26);
    sph(l, o.shoe, o.legR * 1.15, 0, -.25 - (o.shinL || .14) / 2 + .07, .3, 1, .75, 1.35);
    return l;
  });
  cap(up, o.torso, o.bodyR, o.bodyL, 0, o.bodyR + o.bodyL / 2, 0);
  const sh = o.bodyR * 2 + o.bodyL - .06;
  p.arms = [-1, 1].map((s) => {
    const a = new THREE.Group(); a.position.set(s * (o.bodyR + .03), sh, 0); up.add(a);
    cap(a, o.arm, o.armR || .055, o.armL || .17, 0, -(o.armL || .17) / 2 - .04, 0);
    sph(a, o.hand, (o.armR || .055) * 1.25, 0, -(o.armL || .17) - .1, 0);
    a.rotation.set(-.75, 0, s * .32); return a;
  });
  const head = new THREE.Group(); head.position.y = sh + o.headR * .82; up.add(head); p.head = head;
  sph(head, o.skin, o.headR, 0, 0, 0, 1, .96, .95);
  p.top = .08 + sh + o.headR * 1.8;
  return p;
}
function foxTail(p, cols, y = .2) {
  const t = new THREE.Group(); t.position.set(0, y, -.16); p.g.add(t); p.tail = t;
  sph(t, S(cols[0]), .12, 0, .02, -.1, .9, .9, 1.2); sph(t, S(cols[1]), .14, 0, .1, -.28, .9, .95, 1.2); sph(t, S(cols[2]), .1, 0, .17, -.44, .85, .9, 1.1);
}
const foxEars = (h, c, inner, tip) => { for (const s of [-1, 1]) { const e = part(h, CONE, S(c), .11, .26, .08, s * .18, .29, -.02, 0, 0, -s * .38); part(h, CONE, S(inner), .06, .16, .03, s * .175, .26, .03, 0, 0, -s * .38); if (tip) part(h, CONE, S(tip), .05, .08, .05, s * .23, .4, -.02, 0, 0, -s * .38); } };
function mChar(id) {
  let p;
  if (id === 'foxino') {
    const fur = S(0x8e55d6), org = S(0xff8c2e), cream = S(0xfaecd6);
    p = body({ hipW: .1, legR: .07, thigh: org, shin: fur, shoe: cream, torso: S(0xffd23f), bodyR: .17, bodyL: .16, arm: fur, hand: cream, skin: fur, headR: .3 });
    const h = p.head;
    sph(h, cream, .16, 0, -.08, .2, 1.15, .8, .9); sph(h, S(0x1a1020), .045, 0, -.02, .34);
    for (const s of [-1, 1]) sph(h, org, .1, s * .19, -.07, .15, 1, .75, .6);
    sph(h, org, .12, 0, .26, .06, 1.2, .55, .9);
    eyes(h, .05, .22, .075, .115, 0x2fae5f);
    sph(h, S(0x5a2a3a), .04, 0, -.15, .29, 1.2, .35, .4);
    foxEars(h, 0x8e55d6, 0xff8c2e);
    for (const a of p.arms) sph(a, S(0xffd23f), .075, 0, -.04, 0);
    foxTail(p, [0x8e55d6, 0xff8c2e, 0xffffff]);
  } else if (id === 'stella') {
    const fur = S(0xf07b23), blue = S(0x3c6fd8), white = S(0xffffff), purple = S(0x8e44c9);
    p = body({ hipW: .1, legR: .07, thigh: blue, shoe: white, torso: blue, bodyR: .17, bodyL: .15, arm: fur, hand: S(0xfff6ea), skin: fur, headR: .3 });
    sph(p.up, white, .14, 0, .42, .06, 1.2, .55, 1);
    for (const s of [-1, 1]) part(p.up, CYL, blue, .025, .2, .025, s * .1, .43, .14, .3);
    const star = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU - Math.PI / 2, r = i % 2 ? .03 : .07; i ? star.lineTo(Math.cos(a) * r, -Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, -Math.sin(a) * r); }
    const sm = new THREE.Mesh(new THREE.ExtrudeGeometry(star, { depth: .02, bevelEnabled: false }), GLOW(0xffd23a, .4)); sm.position.set(0, .3, .17); p.up.add(sm);
    const h = p.head;
    sph(h, S(0xfff6ea), .16, 0, -.09, .2, 1.15, .78, .9); sph(h, S(0x3a1a10), .04, 0, -.03, .34);
    eyes(h, .05, .22, .085, .12, 0x1fb5b0);
    sph(h, S(0x8a2a2a), .05, 0, -.16, .28, 1.1, .4, .4);
    sph(h, purple, .12, -.13, .22, .08, 1, .7, 1.4);
    for (let k = 0; k < 5; k++) sph(h, k % 2 ? purple : fur, .065, -.26 - k * .01, -.05 - k * .1, -.06 + k * .02);
    foxEars(h, 0xf07b23, 0x3a2010, 0x3a2010);
    for (const a of p.arms) sph(a, white, .075, 0, -.04, 0);
    foxTail(p, [0xf07b23, 0xf07b23, 0xffffff]);
  } else if (id === 'pix') {
    // Pix's eyes are always hidden under her bangs: her face has no eyes, the bangs cover where they would be
    const skin = S(0x7cc85a), hair = S(0xb8e33a), purple = S(0x7b3fc4), grey = S(0x7d7f86);
    p = body({ hipW: .1, legR: .075, thigh: grey, shoe: S(0x4a3a6a), torso: purple, bodyR: .16, bodyL: .15, arm: purple, hand: skin, skin, headR: .28 });
    sph(p.up, S(0xf4f4f4), .13, 0, .4, .07, 1.15, .55, 1);
    const belt = new THREE.Mesh(new THREE.TorusGeometry(.165, .025, 8, 24), S(0x8a5a2b)); belt.rotation.x = Math.PI / 2; belt.position.y = .2; p.up.add(belt);
    part(p.up, ICO, S(0xbbbbbb), .03, .08, .02, .15, .17, .1);
    for (const l of p.legs) sph(l, S(0x6a3fa8), .06, 0, -.03, .22, 1, .8, .6);
    const h = p.head;
    const capTop = new THREE.Mesh(new THREE.SphereGeometry(.3, 24, 12, 0, TAU, 0, Math.PI * .5), hair); capTop.position.y = .02; h.add(capTop);
    sph(h, hair, .27, 0, .02, .1, 1, .5, .92);           // bangs over the eye area
    sph(h, hair, .13, 0, .03, .27, 1.9, .55, .4);         // bangs front edge
    cap(h, hair, .17, .3, 0, -.22, -.14);                  // long hair down the back
    for (const s of [-1, 1]) { sph(h, hair, .09, s * .24, -.08, .05, .8, 2, .8); part(h, CONE, skin, .05, .2, .04, s * .32, .0, 0, 0, 0, -s * Math.PI / 2.3); }
    const capM = new THREE.Mesh(new THREE.SphereGeometry(.31, 24, 10, 0, TAU, 0, Math.PI * .32), purple); capM.position.y = .06; h.add(capM);
    part(h, CYL, S(0xff8c2e), .18, .025, .2, 0, .21, .25, .25);
    sph(h, S(0x5ea844), .025, 0, -.08, .27); sph(h, S(0x3d6b2c), .045, 0, -.16, .25, 1.2, .35, .4);
  } else if (id === 'rob') {
    const cy = S(0x36c3ea), dark = S(0x0e1726), glowC = GLOW(0x7ff3ff, 1.6);
    p = body({ hipW: .12, legR: .08, thigh: cy, shinL: .06, shoe: S(0x1d2a44), torso: cy, bodyR: .24, bodyL: .04, arm: cy, armR: .07, armL: .14, hand: S(0x5a3fae), skin: cy, headR: .27 });
    part(p.up, ICO, GLOW(0xff8a1e, 1.2), .1, .11, .03, 0, .27, .24).userData.noRim = true;
    part(p.up, ICO, GLOW(0xffd04a, 2.2), .05, .06, .02, 0, .27, .26).userData.noRim = true;
    const h = p.head;
    sph(h, dark, .21, 0, -.02, .12, 1, .75, .75);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.TorusGeometry(.045, .013, 6, 14, Math.PI), glowC); e.position.set(s * .08, .02, .27); h.add(e); }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(.05, .012, 6, 14, Math.PI), glowC); mouth.rotation.z = Math.PI; mouth.position.set(0, -.07, .27); h.add(mouth);
    for (const s of [-1, 1]) part(h, CYL, S(0xff8c2e), .07, .05, .07, s * .27, 0, 0, 0, 0, Math.PI / 2);
    part(h, CYL, S(0x334455), .012, .16, .012, 0, .33, 0);
    const heart = GLOW(0xff3355, 1.4); sph(h, heart, .035, -.025, .43, 0); sph(h, heart, .035, .025, .43, 0); part(h, CONE, heart, .05, .06, .035, 0, .395, 0, Math.PI);
  } else if (id === 'gummy') {
    const pink = S(0xff5db1), blue = S(0x5aa8ff);
    p = body({ hipW: .07, legR: .045, thigh: pink, shinL: .24, shoe: blue, torso: pink, bodyR: .11, bodyL: .26, arm: pink, armR: .04, armL: .22, hand: blue, skin: pink, headR: .27 });
    for (const y of [.2, .34]) { const r = new THREE.Mesh(new THREE.TorusGeometry(.115, .025, 8, 22), blue); r.rotation.x = Math.PI / 2; r.position.y = y; p.up.add(r); }
    const h = p.head;
    eyes(h, .06, .19, .1, .11, 0x7a3cc8);
    sph(h, S(0x7a1440), .07, 0, -.12, .24, 1.3, .45, .4);
    for (const s of [-1, 1]) part(h, SPH, S(0xffffff), .03, .045, .02, s * .032, -.16, .27);
    sph(h, blue, .08, .17, -.1, .17, 1, .5, .4);
    for (const s of [-1, 1]) {
      part(h, CYL, pink, .015, .26, .015, s * .1, .36, 0, 0, 0, -s * .3);
      const c = new THREE.Mesh(new THREE.TorusGeometry(.045, .014, 6, 16, Math.PI * 1.5), blue); c.position.set(s * .15, .5, 0); c.rotation.z = s * .5; h.add(c);
    }
  } else {
    const lav = S(0xcdbdf0), hood = S(0x1f1f26), hairM = S(0x5b3a9a);
    p = body({ noLegs: true, torso: hood, bodyR: .18, bodyL: .14, arm: hood, hand: lav, skin: lav, headR: .28 });
    sph(p.up, S(0xeeeeee), .055, 0, .3, .17, 1, 1, .5); for (const s of [-1, 1]) sph(p.up, hood, .014, s * .02, .31, .2);
    const wisp = new THREE.Group(); wisp.position.set(0, .1, -.02); p.g.add(wisp); p.tail = wisp;
    part(wisp, CONE, lav, .17, .34, .17, 0, -.05, -.08, Math.PI + .5); sph(wisp, lav, .07, 0, -.16, -.28);
    const h = p.head;
    const hoodBack = new THREE.Mesh(new THREE.SphereGeometry(.32, 20, 12, Math.PI * .6, Math.PI * .8), hood); hoodBack.rotation.y = Math.PI; hoodBack.position.set(0, -.04, -.02); h.add(hoodBack);
    eyes(h, .02, .21, .07, .11, 0x2a2340, 0xa896d6);
    sph(h, S(0x6a5a90), .04, 0, -.14, .26, 1.2, .3, .4);
    for (const [x, y, z, r] of [[0, .24, .05, .15], [-.13, .2, .1, .1], [.14, .22, .08, .11], [.05, .3, -.05, .12], [-.08, .28, -.1, .11]]) sph(h, hairM, r, x, y, z, 1, .8, 1);
    for (const [x, rz] of [[-.1, .5], [.12, -.4]]) part(h, CONE, hairM, .05, .15, .05, x, .14, .26, .9, 0, rz);
    const band = new THREE.Mesh(new THREE.TorusGeometry(.3, .025, 8, 24, Math.PI), S(0x111111)); band.position.y = .02; h.add(band);
    for (const s of [-1, 1]) {
      part(h, CYL, S(0x111111), .1, .07, .1, s * .3, .0, 0, 0, 0, Math.PI / 2);
      const x = GLOW(0xff8c2e, 1.2); for (const r of [.7, -.7]) part(h, CYL, x, .012, .1, .012, s * .34, 0, 0, r, 0, 0).userData.noRim = true;
    }
  }
  rimModel(p.g);
  return p;
}
// the paper glider: a folded white paper wing with a coloured stripe and a little lantern at the nose
function mGlider(id) {
  const g = new THREE.Group(), acc = CREW[id].accent;
  const sh = new THREE.Shape(); sh.moveTo(0, -1.05); sh.lineTo(1.25, .55); sh.lineTo(.35, .35); sh.lineTo(0, .5); sh.lineTo(-.35, .35); sh.lineTo(-1.25, .55); sh.lineTo(0, -1.05);
  const wing = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: .035, bevelEnabled: true, bevelThickness: .01, bevelSize: .02, bevelSegments: 1 }).rotateX(-Math.PI / 2), S(0xfff6e8));
  wing.position.y = -.02; g.add(wing);
  const st = new THREE.Shape(); st.moveTo(0, -.75); st.lineTo(1.05, .48); st.lineTo(.95, .5); st.lineTo(0, -.62); st.lineTo(-.95, .5); st.lineTo(-1.05, .48); st.lineTo(0, -.75);
  const stripe = new THREE.Mesh(new THREE.ShapeGeometry(st).rotateX(-Math.PI / 2), S(acc, { side: THREE.DoubleSide })); stripe.position.y = .05; g.add(stripe);
  part(g, CYL, S(0xe8dcc8), .03, 1.4, .03, 0, .03, -.1, Math.PI / 2);
  for (const s of [-1, 1]) part(g, CONE, S(acc), .05, .25, .02, s * 1.18, .1, -.55, 0, 0, s * .15);
  const lan = new THREE.Group(); lan.position.set(0, -.22, .95); g.add(lan);
  part(lan, CYL, S(0x6e4320), .006, .16, .006, 0, .12, 0);
  part(lan, SPH, GLOW(0xffb347, 2.4), .09, .11, .09, 0, 0, 0).userData.noRim = true;
  part(lan, CYL, S(0xb03a2a), .06, .03, .06, 0, .11, 0); part(lan, CYL, S(0xb03a2a), .05, .03, .05, 0, -.11, 0);
  { const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: DOT, color: new THREE.Color(0xffb347).multiplyScalar(.7), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); h.scale.setScalar(.75); lan.add(h); } // (v2) a soft glow round the nose lantern
  g.lantern = lan;
  g.tips = [new THREE.Object3D(), new THREE.Object3D()]; g.tips[0].position.set(-1.2, .05, -.52); g.tips[1].position.set(1.2, .05, -.52); g.add(...g.tips);
  return g;
}
// glider + rider; the root faces +z (turned round to fly away from the camera)
function mFlyer(id) {
  const root = new THREE.Group(), tilt = new THREE.Group(); root.add(tilt);
  const gl = mGlider(id); tilt.add(gl);
  const ch = mChar(id); ch.g.position.set(0, .03, .05); ch.g.scale.setScalar(1.1); tilt.add(ch.g);
  const light = new THREE.PointLight(0xffb060, 3.2, 4.5, 1.6); light.position.set(0, .2, 1.1); tilt.add(light);
  return { root, tilt, gl, ch, light };
}
function animChar(p, t, st) {
  const w = Math.sin(t * 3);
  p.up.rotation.z = -(st.bank || 0) * .35; p.up.position.y = .08 + Math.sin(t * 2.2) * .008;
  p.head.rotation.set(Math.sin(t * 1.7) * .05 - (st.pitch || 0) * .2, (st.look || 0) + Math.sin(t * .8) * .1, -(st.bank || 0) * .2);
  const cheer = st.cheer > 0;
  p.arms.forEach((a, i) => { const s = i ? 1 : -1; a.rotation.set(cheer ? -2.9 + Math.sin(t * 14) * .2 : -.75 + w * .04, 0, s * (cheer ? .5 : .32)); });
  if (p.tail) p.tail.rotation.set(Math.sin(t * 6) * .12 + .1, Math.sin(t * 4.3) * .35, 0);
  if (p.legs) p.legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 2 + i) * .06; });
}

/* ---------- the three nights ---------- */
const NIGHTS = [
  { name: 'Lantern Lake', sub: 'Cherry islands and a sky full of lanterns', len: 1300, gates: 6, speed: 11,
    sky: ['#140f48', '#43287a', '#ff8fa0'], fog: 0x4a2c72, water: 0x1a2668, grass: 0x3a8a5a, leaves: [0xff9ccb, 0xffb0d8, 0xff7ab0, 0xffc8e0], rock: 0x4a3a62,
    lan: [0xffb347, 0xff7a5a, 0xffd27a, 0xff9ab0], fly: 0xfff27a, mount: [0x2a1c5a, 0x3a2670, 0x5a347e], owls: .1 },
  { name: 'Firefly Forest', sub: 'Green glow, tall trees and sleepy owls', len: 1700, gates: 7, speed: 12.5,
    sky: ['#06142e', '#0f3448', '#36b49a'], fog: 0x14404a, water: 0x0c2a3a, grass: 0x2f8a4a, leaves: [0x3aa860, 0x4fc070, 0x2f9a6a, 0x6ad88a], rock: 0x2f3a4a,
    lan: [0xffe08a, 0xb8ff7a, 0xffb347, 0x9affd0], fly: 0xc8ff6a, mount: [0x0a2030, 0x12303e, 0x1a4450], owls: .2 },
  { name: 'Aurora Peaks', sub: 'Snowy spires under dancing northern lights', len: 2100, gates: 8, speed: 14,
    sky: ['#040c26', '#0a2456', '#3a6ac8'], fog: 0x1a3060, water: 0x0a1a44, grass: 0xe8f0ff, leaves: [0x2f7a5a, 0x3a8a68], rock: 0x6a7aa0,
    lan: [0x9fe8ff, 0xffd27a, 0xc8a8ff, 0x7affc8], fly: 0x9fe8ff, mount: [0x14244a, 0x1e3260, 0x2a4278], owls: .12, aurora: true, snow: true },
];
const unlockedN = (i) => i === 0 || save.stars[i - 1] > 0;

/* ---------- the world: sky, moon, stars, far mountains, the lake, lanterns and floating islands ---------- */
let W = null; // the current night's world
const SPEED_MENU = 3;
function buildWorld(n) {
  if (W) { scene.remove(W.g); W.trash.forEach((t) => t.dispose && t.dispose()); }
  const N = NIGHTS[n], g = new THREE.Group(), trash = [];
  const sky = tex(4, 256, (x) => { const gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, N.sky[0]); gr.addColorStop(.55, N.sky[1]); gr.addColorStop(1, N.sky[2]); x.fillStyle = gr; x.fillRect(0, 0, 4, 256); });
  trash.push(sky);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide, fog: false, depthWrite: false })); g.add(dome); trash.push(dome.geometry, dome.material);
  scene.fog = new THREE.Fog(N.fog, 70, 300);
  // stars
  // (v2) the stars twinkle: a tiny shader fades each one in and out at its own pace (no work for the CPU)
  const sp = [], sc = [], sph2 = [];
  for (let i = 0; i < 900; i++) { const a = R() * TAU, e = Math.acos(R() * .92), r = 360; sp.push(Math.cos(a) * Math.sin(e) * r, Math.cos(e) * r * .9 + 10, Math.sin(a) * Math.sin(e) * r); const k = rand(.35, .95); sc.push(k, k, k * rand(.95, 1.15)); sph2.push(R() * TAU, rand(.6, 2.4), R() < .08 ? 2.2 : rand(.9, 1.5)); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3)); sg.setAttribute('tw', new THREE.Float32BufferAttribute(sph2, 3));
  const stars = new THREE.Points(sg, new THREE.ShaderMaterial({ uniforms: { uTime: U.time, uPR: U.pr }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 tw; attribute vec3 color; uniform float uTime, uPR; varying vec3 vC;
      void main(){ float s = .55 + .45 * sin(uTime * tw.y + tw.x); vC = color * (.35 + .9 * s * s); gl_PointSize = (1.6 + tw.z * 1.5 * (.7 + .3 * s)) * uPR; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `varying vec3 vC; void main(){ vec2 q = gl_PointCoord - .5; float d = dot(q, q) * 4.; float a = max(0., 1. - d); gl_FragColor = vec4(vC * a * a * 1.4, 1.); }` }));
  g.add(stars); trash.push(sg, stars.material);
  // (v2) soft clouds drifting low in the far sky, lit from below by the festival
  const cloudT = tex(128, 64, (x) => { for (let k = 0; k < 14; k++) { const cx = rand(24, 104), cy = rand(26, 40), r = rand(10, 22), gr = x.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 64); } }); trash.push(cloudT);
  const cloudM = new THREE.MeshBasicMaterial({ map: cloudT, color: new THREE.Color(N.sky[2]).lerp(new THREE.Color(N.sky[1]), .55).multiplyScalar(.75), transparent: true, opacity: .55, depthWrite: false, fog: false }); trash.push(cloudM);
  const clouds = [];
  for (let k = 0; k < 7; k++) { const c = part(g, new THREE.PlaneGeometry(1, .5), cloudM, rand(90, 160), rand(70, 110), 1, rand(-220, 220), rand(28, 75), -250 + rand(0, 30)); c.lookAt(0, 10, 0); c.userData.v = rand(.4, 1.2); clouds.push(c); trash.push(c.geometry); }
  // the moon with a halo, and its path of light on the water. (v2) The moon now crosses the sky as the night goes on —
  // a soft timer like the sun in Tiny Wings — and has faint craters and a second, wider glow.
  const moonPos = new THREE.Vector3(-55, 70, -240);
  const moonT = tex(128, 128, (x) => { x.fillStyle = '#fff'; x.beginPath(); x.arc(64, 64, 63, 0, TAU); x.fill(); for (let k = 0; k < 9; k++) { const cx = rand(25, 103), cy = rand(25, 103), r = rand(5, 16), gr = x.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, 'rgba(200,190,215,.55)'); gr.addColorStop(1, 'rgba(200,190,215,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); } }); trash.push(moonT);
  const moonM = part(g, new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ map: moonT, color: new THREE.Color(0xfff6dc).multiplyScalar(1.8), fog: false }), 11, 11, 1, moonPos.x, moonPos.y, moonPos.z); moonM.lookAt(0, 0, 0);
  const halo = part(g, new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: DOT, color: 0xffe6c0, transparent: true, opacity: .35, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }), 70, 70, 1, moonPos.x, moonPos.y, moonPos.z + 1); halo.lookAt(0, 0, 0);
  const halo2 = part(g, new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: DOT, color: new THREE.Color(N.sky[2]).lerp(new THREE.Color(0xffe6c0), .5), transparent: true, opacity: .16, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }), 190, 190, 1, moonPos.x, moonPos.y, moonPos.z + 2); halo2.lookAt(0, 0, 0);
  trash.push(moonM.geometry, moonM.material, halo.geometry, halo.material, halo2.geometry, halo2.material);
  const path = part(g, new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex(16, 256, (x) => { const gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,240,210,0)'); gr.addColorStop(.35, 'rgba(255,240,210,.55)'); gr.addColorStop(1, 'rgba(255,240,210,0)'); x.fillStyle = gr; x.fillRect(0, 0, 16, 256); for (let k = 0; k < 90; k++) { x.clearRect(R() * 16, R() * 256, 16, 2); } }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 22, 1, 230, moonPos.x * .45, .02, -110);
  // far mountains in three layers
  N.mount.forEach((c, k) => {
    const s = new THREE.Shape(), z = -260 + k * 40, base = -5; s.moveTo(-500, base);
    for (let x = -500; x <= 500; x += 18) s.lineTo(x, base + 18 + k * -3 + Math.abs(Math.sin(x * .013 + k * 2)) * (40 - k * 9) + Math.sin(x * .07 + k) * 6);
    s.lineTo(500, base);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color: c })); m.position.z = z; g.add(m); trash.push(m.geometry, m.material);
    if (N.snow) { const caps = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color: 0x8aa0d8 })); caps.scale.y = .2; caps.position.set(0, base + (40 - k * 9) * .8, z + .5); }
  });
  // (v2) a far festival town on the shore: rooftops and pagodas in silhouette, with warm lit windows that flicker
  {
    const s = new THREE.Shape(), z = -165, base = -2, win = [], wc = [];
    s.moveTo(-320, base); let x = -320;
    while (x < 320) {
      const w = rand(4, 9), h = rand(5, 11) + (R() < .12 ? 9 : 0), pag = R() < .18;
      s.lineTo(x, base + h); if (pag) { s.lineTo(x + w * .3, base + h + 1.6); s.lineTo(x + w / 2, base + h + 6); s.lineTo(x + w * .7, base + h + 1.6); } else s.lineTo(x + w / 2, base + h + rand(1.5, 3.5)); s.lineTo(x + w, base + h);
      if (Math.abs(x) > 12) for (let k = 0; k < 3; k++) if (R() < .55) { win.push(x + rand(1, w - 1), base + rand(1.5, h - 1), z + .3); const c = new THREE.Color(pick([0xffc060, 0xffa050, 0xffe090, ...N.lan])).multiplyScalar(rand(1.2, 2.2)); wc.push(c.r, c.g, c.b); }
      x += w + rand(0, 3); s.lineTo(x, base + rand(2, 4));
    }
    s.lineTo(320, base);
    const town = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color: new THREE.Color(N.mount[2]).multiplyScalar(.55) })); town.position.z = z; g.add(town); trash.push(town.geometry, town.material);
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(win, 3)); wg.setAttribute('color', new THREE.Float32BufferAttribute(wc, 3));
    const wins = new THREE.Points(wg, new THREE.PointsMaterial({ size: 1.4, map: DOT, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); g.add(wins); trash.push(wg, wins.material);
  }
  // the aurora: soft curtains of green and violet light that ripple
  if (N.aurora) for (let k = 0; k < 3; k++) {
    const am = new THREE.ShaderMaterial({ uniforms: { uTime: U.time, k: { value: k } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; uniform float uTime, k; void main(){ vUv = uv; vec3 p = position; p.z += sin(p.x * .02 + uTime * .3 + k) * 25.; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }',
      fragmentShader: `varying vec2 vUv; uniform float uTime, k;
        void main(){ float b = sin(vUv.x * 40. + uTime * .8 + k * 3.) * .5 + .5; b *= sin(vUv.x * 13. - uTime * .5) * .4 + .6;
          float f = smoothstep(0., .35, vUv.y) * smoothstep(1., .5, vUv.y);
          vec3 c = mix(vec3(.2, 1., .6), vec3(.6, .35, 1.), vUv.y + k * .2);
          gl_FragColor = vec4(c * b * f * .9, b * f); }` });
    const a = new THREE.Mesh(new THREE.PlaneGeometry(500, 70, 80, 1), am); a.position.set(-40 + k * 50, 85 + k * 12, -200 + k * 25); a.rotation.x = .3; g.add(a); trash.push(a.geometry, am);
  }
  // the lake: dark water with gentle moving ripples that catch the moonlight
  const nrm = tex(256, 256, (x) => { const id = x.createImageData(256, 256); for (let i = 0; i < 256; i++) for (let j = 0; j < 256; j++) { const nx = Math.sin(i * .1 + Math.sin(j * .05) * 2) * .4 + Math.sin((i + j) * .07) * .3, ny = Math.cos(j * .12 + Math.sin(i * .04) * 2) * .4; const o = (j * 256 + i) * 4; id.data[o] = 128 + nx * 90; id.data[o + 1] = 128 + ny * 90; id.data[o + 2] = 255; id.data[o + 3] = 255; } x.putImageData(id, 0, 0); });
  nrm.colorSpace = THREE.NoColorSpace; nrm.wrapS = nrm.wrapT = THREE.RepeatWrapping; nrm.repeat.set(110, 110); trash.push(nrm);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), new THREE.MeshPhongMaterial({ color: N.water, specular: 0x5a64a0, shininess: 55, normalMap: nrm, normalScale: new THREE.Vector2(.3, .3), emissive: 0x05061a }));
  g.add(water); trash.push(water.geometry, water.material);
  // lanterns rising all over the sky
  const lg = new THREE.CylinderGeometry(.42, .32, .9, 10); trash.push(lg);
  const lans = new THREE.InstancedMesh(lg, new THREE.MeshBasicMaterial({ color: 0xffffff }), 140); g.add(lans); trash.push(lans);
  const lanData = []; const c = new THREE.Color();
  for (let i = 0; i < 140; i++) { lanData.push({ x: rand(-70, 70), y: rand(2, 45), z: rand(-260, 10), s: rand(.6, 1.4), v: rand(.3, .9), ph: R() * TAU }); lans.setColorAt(i, c.set(pick(N.lan)).multiplyScalar(rand(1.6, 2.6))); }
  if (Math.abs(lanData[0].x) < 6) lanData[0].x = 12;
  lanData.forEach((l) => { if (Math.abs(l.x) < 7 && l.y < 9) l.x += Math.sign(l.x || 1) * 8; });
  // (v2) every lantern gets a soft glow halo (a cheap "bloom" sprite) and a shimmering reflection streak on the lake
  const hp = new Float32Array(140 * 3), hc = new Float32Array(140 * 3);
  for (let i = 0; i < 140; i++) { lans.getColorAt(i, c); c.multiplyScalar(.12); hc.set([c.r, c.g, c.b], i * 3); }
  const hgeo = new THREE.BufferGeometry(); hgeo.setAttribute('position', new THREE.BufferAttribute(hp, 3)); hgeo.setAttribute('color', new THREE.BufferAttribute(hc, 3));
  const lanHalo = new THREE.Points(hgeo, new THREE.PointsMaterial({ size: 2.8, map: DOT, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); lanHalo.frustumCulled = false; g.add(lanHalo); trash.push(hgeo, lanHalo.material);
  const streak = tex(32, 128, (x) => { for (let y = 0; y < 128; y++) { const k = Math.sin(y / 127 * Math.PI) ** 1.5, w = 16 * (1 - Math.abs(y - 64) / 80); if (y % 6 < 4) { const gr = x.createLinearGradient(16 - w, 0, 16 + w, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, `rgba(255,255,255,${(k * rand(.5, 1)).toFixed(2)})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, y, 32, 1); } } }); trash.push(streak);
  const reflG = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2); trash.push(reflG);
  const refl = new THREE.InstancedMesh(reflG, new THREE.MeshBasicMaterial({ map: streak, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .55 }), 140); refl.frustumCulled = false; g.add(refl); trash.push(refl, refl.material);
  for (let i = 0; i < 140; i++) { lans.getColorAt(i, c); refl.setColorAt(i, c.multiplyScalar(.45)); }
  // (v2) moonlit sparkles dancing on the water, thickest along the moon's path; a shader scrolls and twinkles them
  const SPN = 420, spp = new Float32Array(SPN * 3), sph3 = new Float32Array(SPN);
  for (let i = 0; i < SPN; i++) { const near = R() < .6; spp.set([near ? rand(-1, 1) * rand(0, 1) * 14 : rand(-70, 70), .05, rand(-250, 10)], i * 3); sph3[i] = near ? 1 + R() : R(); }
  const spg = new THREE.BufferGeometry(); spg.setAttribute('position', new THREE.BufferAttribute(spp, 3)); spg.setAttribute('ph', new THREE.BufferAttribute(sph3, 1));
  const sparkle = new THREE.Points(spg, new THREE.ShaderMaterial({ uniforms: { uTime: U.time, uPR: U.pr, uOff: { value: 0 }, uPath: { value: 0 }, uCol: { value: new THREE.Color(0xfff0d8).lerp(new THREE.Color(N.sky[2]), .25).multiplyScalar(1.6) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float ph; uniform float uTime, uPR, uOff, uPath; varying float vA;
      void main(){ vec3 p = position; bool near = ph >= 1.; if (near) p.x += uPath; p.z = mod(p.z + uOff + 250., 260.) - 250.;
        float s = sin(uTime * (2. + fract(ph * 7.) * 3.) + ph * 40.); vA = pow(max(0., s), 6.) * smoothstep(-250., -120., p.z) * (near ? 1. : .45);
        vec4 mv = modelViewMatrix * vec4(p, 1.); gl_PointSize = (3. + 9. * vA) * uPR * clamp(30. / -mv.z, .25, 1.2); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uCol; varying float vA; void main(){ vec2 q = gl_PointCoord - .5; float a = max(0., 1. - abs(q.x) * 8.) * max(0., 1. - abs(q.y) * 2.) + max(0., 1. - abs(q.y) * 8.) * max(0., 1. - abs(q.x) * 2.); gl_FragColor = vec4(uCol * a * vA, 1.); }` }));
  sparkle.frustumCulled = false; g.add(sparkle); trash.push(spg, sparkle.material);
  // floating islands drift past on both sides
  const isles = [];
  for (let k = 0; k < 12; k++) { const i = mIsland(N); i.side = k % 2 ? 1 : -1; placeIsland(i, -20 - k * 22); g.add(i.g); isles.push(i); }
  // fireflies drifting near the water
  const FN = 220, fp = new Float32Array(FN * 3); for (let i = 0; i < FN; i++) fp.set([rand(-30, 30), rand(.3, 6), rand(-120, 10)], i * 3);
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
  const flies = new THREE.Points(fg, new THREE.PointsMaterial({ size: .32, map: DOT, color: new THREE.Color(N.fly).multiplyScalar(2.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); g.add(flies); trash.push(fg, flies.material);
  // light
  const hemi = new THREE.HemisphereLight(0x8a7ad8, 0x10183a, 1.15), moon = new THREE.DirectionalLight(0xc8d4ff, 1.5); moon.position.copy(moonPos).normalize().multiplyScalar(50);
  const fill = new THREE.DirectionalLight(0xffd8b0, 1.1); fill.position.set(2, 6, 12);
  g.add(hemi, moon, fill);
  scene.add(g);
  W = { g, n, N, trash, water, lans, lanData, isles, flies, path, lanHalo, refl, sparkle, clouds, moon: [moonM, halo, halo2], moonLight: moon, moonPos }; applyQuality();
}
// an island: a rocky cone with a grassy (snowy) top, trees, sometimes a little house with lit windows and a string of lanterns
function mIsland(N) {
  const g = new THREE.Group(), r = rand(1.6, 3);
  const rockG = new THREE.ConeGeometry(r, r * 1.6, 9, 3); rockG.rotateX(Math.PI); const rp = rockG.attributes.position;
  for (let i = 0; i < rp.count; i++) if (rp.getY(i) < r * .7) { rp.setX(i, rp.getX(i) * rand(.85, 1.15)); rp.setZ(i, rp.getZ(i) * rand(.85, 1.15)); }
  rockG.computeVertexNormals();
  part(g, rockG, S(N.rock, { flatShading: true, emissive: N.rock, emissiveIntensity: .25 }), 1, 1, 1, 0, -r * .8, 0);
  part(g, CYL, S(N.grass, { emissive: N.grass, emissiveIntensity: .2 }), r * 1.04, .35, r * 1.04, 0, .1, 0);
  const trees = 1 + (R() * 3 | 0);
  for (let k = 0; k < trees; k++) {
    const a = R() * TAU, d = rand(0, r * .55), x = Math.cos(a) * d, z = Math.sin(a) * d, h = rand(.8, 1.4);
    if (N.snow) { part(g, CYL, S(0x5a3a28), .1, h * .5, .1, x, h * .25 + .25, z); [[.7, 0], [.52, .45], [.32, .85]].forEach(([w, y]) => { part(g, CONE, S(pick(N.leaves)), w, .7, w, x, h * .5 + .5 + y, z); part(g, CONE, S(0xffffff), w * .6, .3, w * .6, x, h * .5 + .78 + y, z); }); }
    else { part(g, CYL, S(0x5a3a28), .1, h, .1, x, h / 2 + .25, z); for (let b = 0; b < 4; b++) part(g, BUSH, S(pick(N.leaves), { emissive: pick(N.leaves), emissiveIntensity: .12 }), rand(.45, .7), rand(.4, .6), rand(.45, .7), x + rand(-.35, .35), h + .45 + rand(-.1, .35), z + rand(-.35, .35)); }
  }
  if (R() < .45) { // a little house with warm windows
    const hx = rand(-.5, .5), hz = rand(-.5, .5);
    part(g, BOXR, S(N.snow ? 0xd8e0f0 : 0xe8d8c0), .9, .7, .8, hx, .62, hz);
    part(g, ROOF, S(N.snow ? 0xffffff : 0xc84a3a), .62, .4, .5, hx, 1.12, hz);
    for (const s of [-1, 1]) part(g, BOXR, GLOW(0xffc060, 2), .14, .16, .03, hx + s * .2, .66, hz + .41).userData.noRim = true;
  }
  if (R() < .6) for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI + .3; part(g, SPH_LO, new THREE.MeshBasicMaterial({ color: new THREE.Color(pick(N.lan)).multiplyScalar(2) }), .09, .12, .09, Math.cos(a) * r * .9, .55 + Math.sin(k * 1.3) * .1, Math.sin(a) * r * .9); }
  return { g, r };
}
const BOXR = new THREE.BoxGeometry(1, 1, 1), ROOF = new THREE.CylinderGeometry(1, 1, 1, 4).rotateY(Math.PI / 4).scale(1, 1, 1);
function placeIsland(i, z) { i.g.position.set(i.side * rand(9, 22), rand(1.5, 7), z); i.g.rotation.y = R() * TAU; i.bob = R() * TAU; }
const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), P3 = new THREE.Vector3(), S3 = new THREE.Vector3(), Q0 = new THREE.Quaternion();
function animWorld(dt, v) {
  const t = performance.now() / 1000;
  W.water.material.normalMap.offset.y -= v * dt / 8.2;
  W.water.material.normalMap.offset.x = Math.sin(t * .1) * .05;
  const hp = W.lanHalo.geometry.attributes.position;
  W.lanData.forEach((l, i) => {
    l.z += v * dt; l.y += l.v * dt;
    if (l.z > 15 || l.y > 60) { l.z -= 270; l.y = rand(1, 12); l.x = rand(-70, 70); l.v = rand(.3, .9); if (Math.abs(l.x) < 7) l.x += 9 * Math.sign(l.x || 1); }
    const lx = l.x + Math.sin(t * .5 + l.ph) * .4;
    P3.set(lx, l.y, l.z); S3.setScalar(l.s); q4.setFromEuler(e4.set(Math.sin(t + l.ph) * .08, 0, Math.cos(t * .8 + l.ph) * .08)); m4.compose(P3, q4, S3); W.lans.setMatrixAt(i, m4);
    hp.setXYZ(i, lx, l.y, l.z);
    // the reflection: a streak on the water under the lantern, longer and fainter the higher the lantern floats
    const k = clamp(1.2 - l.y / 38, 0, 1), fl = .85 + Math.sin(t * 3 + l.ph * 5) * .15;
    P3.set(lx, .04, l.z + 1.2 + l.y * .08); S3.set(l.s * 1.3 * k * fl, 1, l.s * (3.5 + l.y * .22) * k); m4.compose(P3, Q0, S3); W.refl.setMatrixAt(i, m4);
  });
  W.lans.instanceMatrix.needsUpdate = true; W.refl.instanceMatrix.needsUpdate = true; hp.needsUpdate = true;
  W.sparkle.material.uniforms.uOff.value = (W.sparkle.material.uniforms.uOff.value + v * dt) % 260;
  for (const c of W.clouds) { c.position.x += c.userData.v * dt; if (c.position.x > 260) c.position.x = -260; }
  for (const i of W.isles) { i.g.position.z += v * dt * .85; i.g.position.y += Math.sin(t + i.bob) * .002; if (i.g.position.z > 25) placeIsland(i, i.g.position.z - 264); }
  const a = W.flies.geometry.attributes.position;
  for (let i = 0; i < a.count; i++) { let z = a.getZ(i) + v * dt, x = a.getX(i) + Math.sin(t * 1.3 + i) * dt * .6, y = a.getY(i) + Math.cos(t * 1.1 + i * 1.7) * dt * .3; if (z > 10) { z -= 130; x = rand(-30, 30); } a.setXYZ(i, x, y, z); }
  a.needsUpdate = true;
}

/* ---------- sparkles and fireworks: one glowing points cloud ---------- */
const FXN = 1400, fxPos = new Float32Array(FXN * 3), fxCol = new Float32Array(FXN * 3), fxV = new Float32Array(FXN * 3), fxLife = new Float32Array(FXN), fxBase = new Float32Array(FXN * 3), fxG = new Float32Array(FXN);
let fxI = 0;
const fxGeo = new THREE.BufferGeometry(); fxGeo.setAttribute('position', new THREE.BufferAttribute(fxPos, 3)); fxGeo.setAttribute('color', new THREE.BufferAttribute(fxCol, 3));
const fx = new THREE.Points(fxGeo, new THREE.PointsMaterial({ size: .35, map: DOT, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
fx.frustumCulled = false; scene.add(fx);
for (let i = 0; i < FXN; i++) fxPos[i * 3 + 1] = -999;
function emit(x, y, z, col, n, speed, grav = 2, life = 1.2) {
  const c = new THREE.Color(col).multiplyScalar(2.4);
  for (let k = 0; k < n; k++) {
    const i = fxI = (fxI + 1) % FXN, a = R() * TAU, b = Math.acos(R() * 2 - 1), s = speed * rand(.5, 1);
    fxPos.set([x, y, z], i * 3); fxV.set([Math.sin(b) * Math.cos(a) * s, Math.cos(b) * s, Math.sin(b) * Math.sin(a) * s], i * 3);
    fxBase.set([c.r, c.g, c.b], i * 3); fxLife[i] = life * rand(.6, 1); fxG[i] = grav;
  }
}
function firework(x, y, z, col) { const c = col || pick([0xffd27a, 0xff7ab0, 0x7ab4ff, 0x9dffb0, 0xd8a8ff, 0xff9a4a]); emit(x, y, z, c, 90, 7, 3, 1.6); emit(x, y, z, 0xffffff, 20, 3, 1, .8); }
function updateFx(dt, v) {
  for (let i = 0; i < FXN; i++) {
    if (fxLife[i] <= 0) continue;
    fxLife[i] -= dt; const o = i * 3;
    fxV[o + 1] -= fxG[i] * dt; fxV[o] *= .985; fxV[o + 2] *= .985;
    fxPos[o] += fxV[o] * dt; fxPos[o + 1] += fxV[o + 1] * dt; fxPos[o + 2] += (fxV[o + 2] + v) * dt;
    const k = Math.max(0, fxLife[i]) ** .7; fxCol[o] = fxBase[o] * k; fxCol[o + 1] = fxBase[o + 1] * k; fxCol[o + 2] = fxBase[o + 2] * k;
    if (fxLife[i] <= 0) fxPos[o + 1] = -999;
  }
  fxGeo.attributes.position.needsUpdate = true; fxGeo.attributes.color.needsUpdate = true;
}
// glowing ribbons behind the wing tips
const TRL = 11;
function makeTrail(col) {
  const g = new THREE.BufferGeometry(), pos = new Float32Array(TRL * 2 * 3), cl = new Float32Array(TRL * 2 * 3), idx = [];
  for (let i = 0; i < TRL - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(cl, 3)); g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); m.frustumCulled = false;
  return { m, pts: [], col: new THREE.Color(col).multiplyScalar(1.6) };
}
const TV = new THREE.Vector3();
function updateTrail(tr, obj, dt, v) {
  for (const p of tr.pts) p.z += v * dt;
  obj.getWorldPosition(TV); tr.pts.unshift(TV.clone()); if (tr.pts.length > TRL) tr.pts.pop();
  const pos = tr.m.geometry.attributes.position, cl = tr.m.geometry.attributes.color;
  for (let i = 0; i < TRL; i++) {
    const p = tr.pts[Math.min(i, tr.pts.length - 1)], w = .09 * (1 - i / TRL), k = (1 - i / TRL) ** 1.5;
    pos.setXYZ(i * 2, p.x, p.y + w, p.z); pos.setXYZ(i * 2 + 1, p.x, p.y - w, p.z);
    cl.setXYZ(i * 2, tr.col.r * k, tr.col.g * k, tr.col.b * k); cl.setXYZ(i * 2 + 1, tr.col.r * k, tr.col.g * k, tr.col.b * k);
  }
  pos.needsUpdate = true; cl.needsUpdate = true;
}

/* ---------- (v2) game feel: hit-stop, slow motion, trauma shake, flashes, speed lines, paper bits, pop-up numbers ---------- */
// Values follow the research note "Mobile Game Feel and Lookalikes (2026-11-07)". Calm mode (pause screen) keeps
// the shake small and turns off flashes, slow motion, hit-stop and buzzing.
const FEEL = { hitStop: 0, slow: 0, slowK: 1, trauma: 0, wobble: 0, fovKick: 0, combo: 0, comboT: 0, nearCD: 0, lines: 0, streak: 0 };
const addTrauma = (k) => { FEEL.trauma = Math.min(1, FEEL.trauma + k * (save.calm ? .3 : 1)); };
const hitStop = (s) => { if (!save.calm) FEEL.hitStop = Math.max(FEEL.hitStop, s); };
const slowMo = (s, k) => { if (!save.calm) { FEEL.slow = s; FEEL.slowK = k; } };
function flash(col, a = .5) {
  if (save.calm) return; const el = $('flash'); el.style.transition = 'none'; el.style.background = col; el.style.opacity = a;
  void el.offsetWidth; el.style.transition = 'opacity .5s ease-out'; el.style.opacity = 0;
}
const nz = (a) => Math.sin(a) * .6 + Math.sin(a * 2.31 + 1.7) * .3 + Math.sin(a * 4.7 + .3) * .1; // smooth noise for the shake
// wind streaks that rush past in a boost
const SLN = 64, slPos = new Float32Array(SLN * 6), slCol = new Float32Array(SLN * 6), slD = [];
const slGeo = new THREE.BufferGeometry(); slGeo.setAttribute('position', new THREE.BufferAttribute(slPos, 3)); slGeo.setAttribute('color', new THREE.BufferAttribute(slCol, 3));
const speedLines = new THREE.LineSegments(slGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
speedLines.frustumCulled = false; speedLines.visible = false; scene.add(speedLines);
const slReset = (d, far) => { const a = R() * TAU, r = rand(1.6, 7); d.x = P.x + Math.cos(a) * r * 1.3; d.y = Math.max(.3, P.y + 1 + Math.sin(a) * r); d.z = far ? rand(-70, 0) : rand(-75, -55); d.b = rand(.5, 1.2); };
for (let i = 0; i < SLN; i++) { const d = {}; slD.push(d); }
function updateLines(dt, v) {
  const want = state === 'fly' && P.boost > 0 ? 1 : 0;
  if (!speedLines.visible && want) slD.forEach((d) => slReset(d, true));
  FEEL.lines += (want - FEEL.lines) * Math.min(1, dt * (want ? 8 : 3));
  speedLines.visible = FEEL.lines > .02; if (!speedLines.visible) return;
  const len = 1.2 + v * .16;
  slD.forEach((d, i) => {
    d.z += v * 2.2 * dt; if (d.z > 9) slReset(d, false);
    const k = FEEL.lines * d.b * clamp((d.z + 75) / 20, 0, 1), o = i * 6;
    slPos[o] = d.x; slPos[o + 1] = d.y; slPos[o + 2] = d.z; slPos[o + 3] = d.x; slPos[o + 4] = d.y; slPos[o + 5] = d.z - len;
    slCol[o] = .8 * k; slCol[o + 1] = .95 * k; slCol[o + 2] = 1.3 * k; slCol[o + 3] = slCol[o + 4] = slCol[o + 5] = 0;
  });
  slGeo.attributes.position.needsUpdate = true; slGeo.attributes.color.needsUpdate = true;
}
// torn paper bits that flutter off the glider when it is hit
const PBN = 18, paperD = [];
const triG = new THREE.BufferGeometry(); triG.setAttribute('position', new THREE.Float32BufferAttribute([-.1, -.07, 0, .12, -.05, 0, -.02, .1, 0], 3)); triG.computeVertexNormals();
const paper = new THREE.InstancedMesh(triG, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff2dc).multiplyScalar(1.05), side: THREE.DoubleSide }), PBN);
paper.frustumCulled = false; paper.count = 0; scene.add(paper);
for (let i = 0; i < PBN; i++) paperD.push({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), s: 1 });
function paperBurst(x, y, z, n = 8) {
  let k = 0;
  for (const d of paperD) { if (d.life > 0) continue; if (k++ >= n) break;
    d.life = rand(.7, 1.1); d.p.set(x + rand(-.5, .5), y + rand(-.1, .2), z + rand(-.3, .3)); d.v.set(rand(-4, 4), rand(1, 4.5), rand(-1, 3)); d.w.set(rand(-12, 12), rand(-12, 12), rand(-12, 12)); d.s = rand(.7, 1.5); }
}
function updatePaper(dt) {
  let n = 0;
  for (const d of paperD) {
    if (d.life <= 0) continue; d.life -= dt;
    d.v.y -= 5 * dt; d.v.multiplyScalar(1 - dt * 1.5); d.p.addScaledVector(d.v, dt); d.p.x += Math.sin(d.life * 9) * dt * .8;
    d.r.set(d.r.x + d.w.x * dt, d.r.y + d.w.y * dt, d.r.z + d.w.z * dt); q4.setFromEuler(d.r); S3.setScalar(d.s * Math.min(1, d.life * 3));
    m4.compose(d.p, q4, S3); paper.setMatrixAt(n++, m4);
  }
  paper.count = n; if (n) paper.instanceMatrix.needsUpdate = true;
}
// pop-up words and numbers (DOM, so they stay sharp), and sparks that fly into the score
const PV = new THREE.Vector3();
const toScreen = (x, y, z) => { PV.set(x, y, z).project(cam); return [(PV.x * .5 + .5) * VW, (-PV.y * .5 + .5) * VH]; };
function popText(html, x, y, z, cls = '') {
  const [sx, sy] = toScreen(x, y, z), el = document.createElement('div'); el.className = 'pop ' + cls; el.innerHTML = html;
  el.style.left = clamp(sx, 60, VW - 60) + 'px'; el.style.top = clamp(sy, 120, VH - 60) + 'px'; $('hud').appendChild(el);
  const a = el.animate([{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.4)', opacity: 1, offset: .12 },
    { transform: 'translate(-50%,-70%) scale(1)', opacity: 1, offset: .65 }, { transform: 'translate(-50%,-130%) scale(1)', opacity: 0 }], { duration: 850, easing: 'ease-out' });
  a.onfinish = () => el.remove();
}
let sparks = 0;
function flyToScore(x, y, z, col) {
  if (sparks > 12 || $('hud').hidden) return; sparks++;
  const [sx, sy] = toScreen(x, y, z), r = $('score').getBoundingClientRect(), sr = stage.getBoundingClientRect();
  const dx = r.left - sr.left + r.width / 2 - sx, dy = r.top - sr.top + r.height / 2 - sy;
  const el = document.createElement('i'); el.className = 'spk'; el.style.setProperty('--c', col); el.style.left = sx + 'px'; el.style.top = sy + 'px'; $('hud').appendChild(el);
  const a = el.animate([{ transform: 'translate(-50%,-50%) scale(.5)' }, { transform: `translate(calc(-50% + ${dx * .1 - 10}px),calc(-50% - 34px)) scale(1.5)`, offset: .25 },
    { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.55)` }], { duration: 560, easing: 'cubic-bezier(.45,0,.75,.55)' });
  a.onfinish = () => { el.remove(); sparks--; bumpScore(); };
}
const bumpScore = () => { try { $('score').animate([{ transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 160, easing: 'ease-out' }); } catch (e) {} };
// the firefly combo shown under the glider
function showCombo() {
  const el = $('combo'); el.innerHTML = `<b>x${FEEL.combo}</b> COMBO`; el.className = 'on' + (FEEL.combo >= 10 ? ' hot' : FEEL.combo >= 5 ? ' warm' : '');
  try { el.animate([{ transform: 'translateX(-50%) scale(1.35)' }, { transform: 'translateX(-50%) scale(1)' }], { duration: 180, easing: 'ease-out' }); } catch (e) {}
}
const endCombo = () => { FEEL.combo = 0; FEEL.comboT = 0; $('combo').className = ''; };

/* ---------- things in the air: fireflies, stars, hearts, boost rings, rocks, lantern ropes, owls, word gates ---------- */
const objs = [];
const LANE = { x: 3.6, y0: 1.1, y1: 6 };
function addObj(o) { o.g.position.set(o.x, o.y, o.z); scene.add(o.g); objs.push(o); return o; }
function mFirefly(col) { const g = new THREE.Group(); part(g, SPH_LO, new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(3) }), .11, .11, .11, 0, 0, 0); const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: DOT, color: new THREE.Color(col).multiplyScalar(1.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); h.scale.setScalar(.9); g.add(h); return g; }
const STAR_GEO = (() => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + Math.PI / 2, r = i % 2 ? .17 : .4; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } return new THREE.ExtrudeGeometry(s, { depth: .12, bevelEnabled: true, bevelThickness: .04, bevelSize: .04, bevelSegments: 2 }).center(); })();
function mStar() { const g = new THREE.Group(); g.add(new THREE.Mesh(STAR_GEO, GLOW(0xffcc33, 1.6))); const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: DOT, color: 0xffd27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); h.scale.setScalar(2); g.add(h); return g; }
function mHeart() { const g = new THREE.Group(), m = GLOW(0xff4a7a, 1.4); sph(g, m, .17, -.12, .06, 0); sph(g, m, .17, .12, .06, 0); part(g, CONE, m, .28, .34, .17, 0, -.16, 0, Math.PI); const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: DOT, color: 0xff7a9a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); h.scale.setScalar(1.6); g.add(h); return g; }
const RING_GEO = new THREE.TorusGeometry(.95, .08, 8, 32);
function mRing(col) { const g = new THREE.Group(); g.add(new THREE.Mesh(RING_GEO, new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(2.2), transparent: true })));
  const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: DOT, color: new THREE.Color(col).multiplyScalar(.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); h.scale.setScalar(3.2); g.add(h); return g; }
function mRock() {
  const g = new THREE.Group(), N = W.N;
  const geo = new THREE.IcosahedronGeometry(1, 1); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * rand(.85, 1.15), p.getY(i) * rand(.8, 1.1), p.getZ(i) * rand(.85, 1.15)); geo.computeVertexNormals();
  part(g, geo, S(N.rock, { flatShading: true }), .85, .7, .8, 0, 0, 0);
  if (N.snow) part(g, BUSH, S(0xffffff), .7, .25, .65, 0, .5, 0);
  else { part(g, BUSH, S(N.grass), .65, .2, .6, 0, .52, 0); for (let k = 0; k < 4; k++) part(g, SPH_LO, GLOW(pick([0x7affe0, 0x9fe8ff, 0xd8a8ff]), 2), .07, .09, .07, rand(-.4, .4), .55 + rand(0, .1), rand(-.4, .4)); }
  return rimModel(g);
}
function mOwl() {
  const g = new THREE.Group(), b = S(0x8a6a50), belly = S(0xe8d4b0);
  sph(g, b, .34, 0, 0, 0, 1, 1.1, .9); sph(g, belly, .24, 0, -.06, .14, 1, 1.1, .7);
  for (const s of [-1, 1]) { sph(g, S(0xfff0c8), .11, s * .12, .14, .26, 1, 1, .5); sph(g, GLOW(0xffb020, 1.8), .07, s * .12, .14, .3, 1, 1, .5); sph(g, S(0x120a10), .035, s * .12, .14, .34); part(g, CONE, b, .06, .16, .05, s * .2, .38, 0, 0, 0, -s * .3); }
  part(g, CONE, S(0xffa030), .04, .1, .04, 0, .04, .33, Math.PI / 2 + .3);
  const wings = [-1, 1].map((s) => { const w = new THREE.Group(); w.position.set(s * .3, .05, 0); g.add(w); sph(w, S(0x6e5440), .3, s * .25, 0, 0, 1, .2, .55); return w; });
  g.wings = wings; return rimModel(g);
}
// a rope of lanterns strung between two poles standing in the water
function mRope(y, x0, x1) {
  const g = new THREE.Group(), wood = S(0x5a3a28);
  for (const x of [x0, x1]) { part(g, CYL, wood, .08, y + .9, .08, x, (y + .9) / 2 - y, 0); part(g, SPH_LO, GLOW(0xffc060, 2), .12, .12, .12, x, .95, 0); }
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x0, .7, 0), new THREE.Vector3((x0 + x1) / 2, -.1, 0), new THREE.Vector3(x1, .7, 0));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, .03, 6), S(0xd8c8a8)));
  for (let k = 1; k < 8; k++) { const p = curve.getPoint(k / 8); part(g, CYL, wood, .008, .18, .008, p.x, p.y - .1, 0); part(g, SPH_LO, new THREE.MeshBasicMaterial({ color: new THREE.Color(pick(W.N.lan)).multiplyScalar(2.2) }), .14, .18, .14, p.x, p.y - .28, 0); }
  return g;
}
// a word gate: three glowing rings side by side, each with a word on a little sign above it
const GATE_X = [-2.85, 0, 2.85], GATE_Y = 3.6, GATE_R = 1.22; // (v2) bigger rings and labels so the words read early
function wordSign(word, col = '#ffe2a0') {
  const t = tex(512, 160, (x) => {
    x.fillStyle = 'rgba(20,12,60,.94)'; x.strokeStyle = col; x.lineWidth = 12;
    x.beginPath(); x.roundRect(8, 8, 496, 144, 50); x.fill(); x.stroke();
    let fs = 104; x.font = `800 ${fs}px "Baloo 2", system-ui, sans-serif`;
    while (x.measureText(word).width > 450 && fs > 40) { fs -= 6; x.font = `800 ${fs}px "Baloo 2", system-ui, sans-serif`; }
    x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = col; x.shadowBlur = 14; x.fillText(word, 256, 86); x.shadowBlur = 0; x.fillText(word, 256, 86);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.45, .77), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, color: new THREE.Color(1.15, 1.15, 1.15) })); m.renderOrder = 5; return m;
}
const GATE_COLS = [0xff7ab0, 0xffd27a, 0x7ad8ff], GATE_CSS = ['#ff7ab0', '#ffd27a', '#7ad8ff'];
function mGate(words) {
  const g = new THREE.Group(), rings = [], halos = [];
  words.forEach((w, i) => {
    const r = new THREE.Mesh(new THREE.TorusGeometry(GATE_R, .1, 10, 44), new THREE.MeshBasicMaterial({ color: new THREE.Color(GATE_COLS[i]).multiplyScalar(2), transparent: true }));
    r.position.set(GATE_X[i], 0, 0); g.add(r); rings.push(r);
    part(g, SPH_LO, new THREE.MeshBasicMaterial({ color: new THREE.Color(GATE_COLS[i]).multiplyScalar(2.6) }), .14, .18, .14, GATE_X[i], GATE_R + .12, 0);
    const s = wordSign(w.text, GATE_CSS[i]); s.position.set(GATE_X[i], 0, .02); g.add(s); r.sign = s; // the word sits in the middle of its ring
    // (v2) a glow behind each ring that grows brighter as the gate comes closer
    const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: DOT, color: new THREE.Color(GATE_COLS[i]), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    h.position.set(GATE_X[i], 0, -.1); h.scale.setScalar(4); g.add(h); halos.push(h);
  });
  g.rings = rings; g.halos = halos; return g;
}

/* ---------- a flight ---------- */
const P = { x: 0, y: 3, tx: 0, ty: 3, hearts: 3, inv: 0, score: 0, flies: 0, d: 0, v: 0, boost: 0, cheer: 0, look: 0, bank: 0, pitch: 0, bankS: 0, pitchS: 0, streak: 0, bestCombo: 0 };
let flyer = null, trails = [], state = 'menu', night = 0, gateAt = [], gateI = 0, nextAt = 0, answers = [], finaleT = 0, curGate = null;
function setFlyer(id) {
  if (flyer) { scene.remove(flyer.root); trails.forEach((t) => scene.remove(t.m)); }
  flyer = mFlyer(id); scene.add(flyer.root);
  trails = flyer.gl.tips.map(() => { const t = makeTrail(CREW[id].trail); scene.add(t.m); return t; });
}
function clearObjs() { for (const o of objs) scene.remove(o.g); objs.length = 0; }
function startNight(n) {
  night = n; save.night = n; store(); clearObjs(); buildWorld(n); setFlyer(save.hero);
  const N = NIGHTS[n];
  Object.assign(P, { x: 0, y: 3, tx: 0, ty: 3, hearts: 3, inv: 0, score: 0, flies: 0, d: 0, v: N.speed, boost: 0, cheer: 0, look: 0, bank: 0, pitch: 0, bankS: 0, pitchS: 0, streak: 0, bestCombo: 0 });
  Object.assign(FEEL, { hitStop: 0, slow: 0, trauma: 0, wobble: 0, fovKick: 0, nearCD: 0 }); endCombo(); lastHearts = -1; shownScore = 0; camSnap = true; lastWon = false; W.mk = 0;
  for (const el of document.querySelectorAll('#hud .pop, #hud .spk')) el.remove(); sparks = 0;
  gateAt = Array.from({ length: N.gates }, (_, k) => Math.round(N.len * (k + 1) / (N.gates + 1.2))); gateI = 0; nextAt = 40; answers = []; curGate = null;
  $('menu').hidden = true; $('hud').hidden = false; $('result').hidden = true; $('hint').style.opacity = 1; setTimeout(() => { $('hint').style.opacity = 0; }, 4500);
  $('qcard').classList.add('away'); hud(); state = 'fly'; sfx.click();
}
function spawn() {
  const N = NIGHTS[night], z = -110, prog = P.d / N.len;
  const nearGate = gateAt.some((a) => a > P.d + 110 - 32 && a < P.d + 110 + 14);
  const r = R(), x = rand(-LANE.x + .6, LANE.x - .6), y = rand(LANE.y0 + .4, LANE.y1 - .4);
  if (nearGate || r < .3) { // a curving line of fireflies
    const x0 = rand(-3, 3), y0 = rand(1.6, 5.2), dx = rand(-.25, .25), dy = rand(-.15, .15);
    for (let k = 0; k < 6; k++) addObj({ kind: 'fly', g: mFirefly(N.fly), x: clamp(x0 + dx * k * 2, -3.4, 3.4), y: clamp(y0 + dy * k * 2 + Math.sin(k) * .3, 1.2, 5.8), z: z - k * 2.2, r: .55 });
  } else if (r < .52) { addObj({ kind: 'rock', g: mRock(), x, y, z, r: .75, spin: rand(-.5, .5) }); if (prog > .3 && R() < .5) addObj({ kind: 'rock', g: mRock(), x: clamp(-x * rand(.6, 1), -3, 3), y: rand(1.5, 5.5), z: z - 6, r: .75, spin: rand(-.5, .5) }); }
  else if (r < .68) { const high = R() < .5, ry = high ? rand(3.9, 4.6) : rand(1.9, 2.5); addObj({ kind: 'rope', g: mRope(ry, -4.4, 4.4), x: 0, y: ry, z, r: 0, high }); }
  else if (r < .68 + N.owls * 1.4) { const s = R() < .5 ? -1 : 1; const o = addObj({ kind: 'owl', g: mOwl(), x: s * 6, y, z: z * .8, r: .5, vx: -s * rand(1.2, 2), ph: R() * TAU }); o.g.rotation.y = -s * Math.PI / 2; }
  else if (r < .88) addObj({ kind: 'ring', g: mRing(0x7ad8ff), x, y, z, r: .95 });
  else if (r < .96) addObj({ kind: 'star', g: mStar(), x, y, z, r: .6 });
  else if (P.hearts < 3) addObj({ kind: 'heart', g: mHeart(), x, y, z, r: .6 });
  nextAt = P.d + rand(13, 20) - prog * 4;
}
function spawnGate() {
  const q = pickSentence(night); if (!q) return;
  const words = fillChoices(q), g = mGate(words);
  curGate = addObj({ kind: 'gate', g, x: 0, y: GATE_Y, z: -(gateAt[gateI] - P.d), r: 0, words, q });
  gateI++;
  $('qKick').textContent = 'Fly through the right word!';
  $('qText').innerHTML = `${hints(words.before)}<span class="gap">&nbsp;</span>${hints(words.after)}`;
  $('qWords').innerHTML = words.map((w, i) => `<span class="c${i}">${esc(w.text)}</span>`).join('');
  $('qcard').classList.remove('away'); tone(660, .4, 'sine', .04); tone(990, .5, 'sine', .03, 0, .1);
}
function passGate(o) {
  let best = -1, bd = 9;
  GATE_X.forEach((x, i) => { const d = Math.hypot(P.x - x, P.y - GATE_Y); if (d < bd) { bd = d; best = i; } });
  const inside = bd < GATE_R + .25, w = o.words, chosen = inside ? w[best] : null, ok = !!(chosen && chosen.ok), rightI = w.findIndex((x) => x.ok);
  const sentence = (w.before + w.right + w.after).replace(/\s*\([^)]*\)/g, '').trim();
  answers.push({ ok, sentence, right: w.right, chose: chosen ? chosen.text : '(missed)', q: o.q });
  $('qText').innerHTML = `${hints(w.before)}<span class="gap ${ok ? 'ok' : 'no'}">${esc(w.right)}</span>${hints(w.after)}`;
  [...$('qWords').children].forEach((c, i) => c.classList.add(w[i].ok ? 'ok' : 'dim'));
  o.g.rings.forEach((r, i) => r.material.color.set(w[i].ok ? 0x5aff8a : 0x553366).multiplyScalar(w[i].ok ? 2.4 : 1));
  if (rightI >= 0) o.g.halos[rightI].material.color.set(0x5aff8a);
  if (ok) {
    // (v2) the big moment: slow motion, the ring bursts into a firework of its colour, a gold flash, a chord and a buzz
    P.streak++; P.score += 250; P.boost = 1.8; P.cheer = 1.1; sfx.bigChord(); sfx.boost();
    toast(pick(['Brilliant!', 'Right!', 'Lovely!', 'Well done!']) + (P.streak >= 3 ? `<small>${P.streak} in a row!</small>` : ''));
    o.burst = best; o.burstT = 0; slowMo(.45, .3); FEEL.fovKick += 9; addTrauma(.12); buzz([20, 30, 60]);
    flash('radial-gradient(circle at 50% 45%, rgba(255,240,190,0) 25%, rgba(255,214,120,.85))', .6);
    popText('+250', GATE_X[best], GATE_Y + 1.5, 0, 'gold');
    const col = GATE_COLS[best];
    emit(GATE_X[best], GATE_Y, -2, col, 50, 6.5, .6, 1); emit(GATE_X[best], GATE_Y, -2, 0x9dffb0, 22, 3.5, .3, .8); emit(GATE_X[best], GATE_Y, -2, 0xffffff, 10, 9, 0, .4);
    for (let k = 0; k < 4 + Math.min(4, P.streak); k++) setTimeout(() => { firework(rand(-7, 7), rand(7, 13), rand(-32, -15), k % 2 ? col : 0); if (k % 2) sfx.pop(); }, k * 160);
    for (let k = 0; k < 3; k++) setTimeout(() => flyToScore(GATE_X[best] + rand(-.5, .5), GATE_Y + rand(-.5, .5), -2, GATE_CSS[best]), 120 + k * 40);
  } else {
    // (v2) gentle: a soft puff, the chosen ring dims, the right word lights green on the card a little longer;
    // a wrong word never takes your last heart
    P.streak = 0; sfx.puff();
    if (inside) { emit(GATE_X[best], GATE_Y, 0, 0x8a7aa8, 30, 1.6, -.3, 1.2); o.dim = best; }
    toast(`${inside ? 'Not that one!' : 'Fly through a ring!'}<small>It's <b>${esc(w.right)}</b></small>`, 1700);
    if (P.hearts > 1) hurt(true); else addTrauma(.12);
  }
  setTimeout(() => $('qcard').classList.add('away'), ok ? 1300 : 2400);
}
function hurt(soft) {
  if (P.inv > 0 && !soft) return;
  P.hearts--; P.inv = soft ? 1 : 1.4; endCombo();
  if (soft) { addTrauma(.15); sfx.heartLost(); }
  else {
    // (v2) a hit: a short freeze, a shake, the glider wobbles and loses paper bits, a red pulse and a buzz
    sfx.hit(); hitStop(.08); addTrauma(.55); FEEL.wobble = .45; paperBurst(P.x, P.y, 0, 9); buzz([30, 40, 30]);
    const h = $('hurt'); h.style.transition = 'none'; h.style.opacity = save.calm ? .5 : 1; void h.offsetWidth; h.style.transition = 'opacity .6s ease-in'; h.style.opacity = 0;
  }
  hud();
  if (P.hearts <= 0) crash();
}
function crash() { state = 'crash'; finaleT = 0; sfx.crash(); emit(P.x, P.y, 0, 0xffffff, 60, 4, 4, 1); hitStop(.12); addTrauma(.9); FEEL.wobble = .8; paperBurst(P.x, P.y, 0, 16); buzz([60, 50, 120]); }
// (v2) passing close to a rock, an owl or a rope without touching it
function nearMiss(x, y, z) {
  if (FEEL.nearCD > 0 || state !== 'fly' || P.inv > 0) return; FEEL.nearCD = 2;
  P.score += 25; sfx.whoosh(); slowMo(.15, .6); buzz(12); FEEL.fovKick += 3; addTrauma(.06);
  popText('CLOSE! <small>+25</small>', P.x, P.y + 1.3, 0, 'close'); emit(x, y, z, 0xffffff, 12, 3, 0, .4);
}
// (v2) the festival: dozens of lanterns rise out of the lake around the glider while fireworks open overhead
function festival() {
  W.lanData.slice(0, 40).forEach((l) => { l.x = rand(3, 18) * (R() < .5 ? -1 : 1); l.y = rand(-1.5, 1); l.z = rand(-50, -6); l.v = rand(1.2, 2.6); });
  flash('radial-gradient(circle at 50% 40%, rgba(255,230,170,.0) 30%, rgba(255,190,120,.7))', .5); buzz([40, 60, 40]); $('qcard').classList.add('away');
  [0, 2, 4, 7, 9, 7].forEach((k, i) => tone(LADDER[k], .7, 'triangle', .05, 0, .15 + i * .14));
  for (let k = 0; k < 5; k++) setTimeout(() => { firework(rand(-12, 12), rand(10, 18), rand(-50, -25)); sfx.pop(); }, 250 + k * 220);
}
let lastHearts = -1, shownScore = 0, lastShown = -1;
function hud() {
  // (v2) the hearts are built once; a lost heart shakes and breaks, a won heart pops in
  const hs = Math.min(3, Math.max(0, P.hearts)), box = $('hearts');
  if (hs !== lastHearts) {
    if (box.children.length !== 3) box.innerHTML = '<span>♥</span><span>♥</span><span>♥</span>';
    [...box.children].forEach((sp, i) => {
      sp.className = i < hs ? '' : 'off';
      if (lastHearts >= 0 && i >= hs && i < lastHearts) { void sp.offsetWidth; sp.className = 'off lose'; }
      if (lastHearts >= 0 && i < hs && i >= lastHearts) { void sp.offsetWidth; sp.className = 'gain'; }
    });
    lastHearts = hs;
  }
  const k = clamp(P.d / NIGHTS[night].len, 0, 1); $('progFill').style.width = k * 100 + '%'; $('progDot').style.left = k * 100 + '%';
}
let toastT = 0;
function toast(t, ms = 1300) { const el = $('toast'); el.innerHTML = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), ms); }
function step(dt) {
  const N = NIGHTS[night];
  // steering
  if (keys.ArrowLeft || keys.KeyA) P.tx -= 6 * dt; if (keys.ArrowRight || keys.KeyD) P.tx += 6 * dt;
  if (keys.ArrowUp || keys.KeyW) P.ty += 5 * dt; if (keys.ArrowDown || keys.KeyS) P.ty -= 5 * dt;
  P.tx = clamp(P.tx, -LANE.x, LANE.x); P.ty = clamp(P.ty, LANE.y0, LANE.y1);
  const ox = P.x, oy = P.y; P.x += (P.tx - P.x) * Math.min(1, dt * 7); P.y += (P.ty - P.y) * Math.min(1, dt * 7);
  P.bank = clamp((P.x - ox) / dt * .12, -1, 1); P.pitch = clamp((P.y - oy) / dt * .1, -1, 1);
  P.bankS += (P.bank - P.bankS) * Math.min(1, dt * 7); P.pitchS += (P.pitch - P.pitchS) * Math.min(1, dt * 7);
  // speed. (v2) The glider eases off a little while a word gate comes up, so there is time to read the words.
  P.boost = Math.max(0, P.boost - dt);
  const gateNear = state === 'fly' && curGate && !curGate.done && curGate.z > -80;
  const want = (state === 'finale' ? 3 : (N.speed + Math.min(4, P.d / N.len * 4)) * (gateNear ? .8 : 1)) + (P.boost > 0 ? 9 : 0);
  P.v += (want - P.v) * Math.min(1, dt * (P.boost > 0 ? 4 : 1.5));
  $('boostFx').style.opacity = P.boost > 0 ? .9 : 0;
  P.d += P.v * dt; if (state === 'fly') P.score += Math.floor(P.d) - Math.floor(P.d - P.v * dt);
  P.inv = Math.max(0, P.inv - dt); P.cheer = Math.max(0, P.cheer - dt);
  FEEL.nearCD = Math.max(0, FEEL.nearCD - dt); if (FEEL.combo && (FEEL.comboT -= dt) <= 0) endCombo();
  // spawning
  if (state === 'fly') {
    if (gateI < gateAt.length && P.d + 110 >= gateAt[gateI]) spawnGate();
    if (P.d >= nextAt) spawn();
    if (P.d >= N.len) { state = 'finale'; finaleT = 0; endCombo(); toast('The Lantern Festival!', 2600); sfx.star(); festival(); }
  }
  // the things in the air
  const t = performance.now() / 1000;
  for (let i = objs.length - 1; i >= 0; i--) {
    const o = objs[i]; const z0 = o.z; o.z += P.v * dt;
    if (o.kind === 'owl') { o.x += o.vx * dt; o.g.wings.forEach((w, k) => { w.rotation.z = (k ? -1 : 1) * Math.sin(t * 12 + o.ph) * .6; }); o.y += Math.sin(t * 3 + o.ph) * dt * .5; }
    if (o.kind === 'fly' || o.kind === 'star' || o.kind === 'heart') o.g.rotation.y += dt * 2;
    if (o.kind === 'rock') o.g.rotation.y += o.spin * dt;
    if (o.kind === 'ring') { o.g.children[0].rotation.z += dt; if (o.popT !== undefined) { const e = o.popT += dt; o.g.scale.setScalar(1 + e * 5); o.g.children[0].material.opacity = Math.max(0, 1 - e * 3); o.g.children[1].material.opacity = Math.max(0, 1 - e * 3); } }
    if (o.kind === 'gate') {
      // (v2) the rings glow brighter as they come closer; the words are a little bigger while far away
      const k = clamp(1 + o.z / 75, 0, 1), pulse = .5 + .5 * Math.sin(t * 7);
      o.g.rings.forEach((r, j) => {
        r.sign.lookAt(cam.position); r.rotation.z += dt * .5; const h = o.g.halos[j];
        if (o.burst === undefined) { h.material.opacity = (o.done ? .35 : k * (.3 + .25 * pulse)); r.scale.setScalar(1 + k * .06 * pulse); r.sign.scale.setScalar(1 + (1 - k) * .12); }
        if (o.dim === j) { r.material.opacity = .35; h.material.opacity = 0; }
      });
      if (o.burst !== undefined) { // the right ring blooms outward and fades
        const e = o.burstT += dt, r = o.g.rings[o.burst], h = o.g.halos[o.burst];
        r.scale.setScalar(1 + e * 1.4); r.material.opacity = Math.max(0, 1 - e * 3.5); r.sign.material.opacity = Math.max(0, 1 - e * 4);
        h.scale.setScalar(4 + e * 4); h.material.opacity = Math.max(0, .8 - e * 2.5);
      }
    }
    o.g.position.set(o.x, o.y, o.z);
    if (o.done || state === 'crash') { if (o.z > 14) { scene.remove(o.g); objs.splice(i, 1); } continue; }
    if ((o.kind === 'rock' || o.kind === 'owl') && z0 < 0 && o.z >= 0) { const d = Math.hypot(P.x - o.x, P.y - o.y); if (d >= o.r + .45 && d < o.r + 1.5) nearMiss(o.x, o.y, o.z); }
    // meeting the glider (it sits at z = 0)
    if (o.kind === 'gate') { if (z0 < 0 && o.z >= 0) { o.done = true; passGate(o); } continue; }
    if (o.kind === 'rope') {
      if (z0 < 0 && o.z >= 0) { o.done = true; const hit = Math.abs(P.y - o.y) < .55 || Math.abs(P.x + 4.4) < .35 || Math.abs(P.x - 4.4) < .35; if (hit && P.inv <= 0) hurt(); else if (!hit) { if (Math.abs(P.y - o.y) < 1.3) nearMiss(P.x, o.y, 0); else P.score += 15; } }
      continue;
    }
    if (Math.abs(o.z) < o.r + .5) {
      const d = Math.hypot(P.x - o.x, P.y - o.y, o.z);
      if (d < o.r + .45) {
        if (o.kind === 'fly') { // (v2) a combo: each firefly in a chain is one note higher; every 10 in a row is a bonus
          o.done = true; scene.remove(o.g); P.flies++; P.score += 10; FEEL.combo++; FEEL.comboT = 2.2; P.bestCombo = Math.max(P.bestCombo, FEEL.combo);
          sfx.chain(FEEL.combo); emit(o.x, o.y, o.z, N.fly, 14, 2.4, .3, .5); flyToScore(o.x, o.y, o.z, '#' + new THREE.Color(N.fly).getHexString());
          if (FEEL.combo >= 3) showCombo();
          if (FEEL.combo % 10 === 0) { P.score += 50; sfx.milestone(); buzz(15); popText(`Firefly x${FEEL.combo}! <small>+50</small>`, o.x, o.y + 1, o.z, 'gold'); emit(o.x, o.y, o.z, N.fly, 40, 4, .3, .9); }
        }
        else if (o.kind === 'star') { o.done = true; scene.remove(o.g); P.score += 100; sfx.star(); buzz(15); emit(o.x, o.y, o.z, 0xffd27a, 40, 4, 1, 1); popText('+100', o.x, o.y + .6, o.z, 'gold'); flyToScore(o.x, o.y, o.z, '#ffd27a'); }
        else if (o.kind === 'heart') { o.done = true; scene.remove(o.g); P.hearts = Math.min(3, P.hearts + 1); sfx.heart(); buzz(15); emit(o.x, o.y, o.z, 0xff7a9a, 30, 3, .5, .9); popText('+♥', o.x, o.y + .6, o.z, 'heart'); }
        else if (o.kind === 'ring') { // (v2) boost: the ring flashes outward, a whoosh, wind streaks and a wider view
          o.done = true; o.popT = 0; P.boost = 1.6; P.score += 25; sfx.boost(); sfx.whoosh(); buzz(15); FEEL.fovKick += 7;
          flash('radial-gradient(circle, rgba(120,220,255,0) 35%, rgba(120,220,255,.7))', .45); emit(o.x, o.y, o.z, 0x7ad8ff, 40, 4, 0, .8);
        }
        else if (P.inv <= 0) { o.done = true; hurt(); emit(o.x, o.y, o.z, 0xffffff, 25, 3, 2, .7); }
        else continue;
        hud();
      }
    }
    if (o.z > 14 || Math.abs(o.x) > 9) { scene.remove(o.g); objs.splice(i, 1); }
  }
  // the festival at the end: fireworks over the lake
  if (state === 'finale') {
    finaleT += dt;
    if (R() < dt * (finaleT < 2 ? 9 : 6)) { firework(rand(-14, 14), rand(9, 20), rand(-60, -25)); sfx.pop(); }
    if (finaleT > 4.6) finish(true);
  }
  hud();
}
let finishing = false;
function finish(won) {
  if (finishing) return; finishing = true; state = 'result';
  const N = NIGHTS[night], right = answers.filter((a) => a.ok).length, total = answers.length;
  const stars = won ? (total && right === total ? 3 : right >= total * .6 ? 2 : 1) : 0;
  const firstClear = won && !save.stars[night];
  save.stars[night] = Math.max(save.stars[night], stars); save.best[night] = Math.max(save.best[night], P.score); store();
  $('resTitle').textContent = won ? 'Festival reached!' : 'Into the lake!';
  $('resSub').textContent = won ? `${CREW[save.hero].name} flew all the way across ${N.name}.` : `${CREW[save.hero].name} made it ${Math.round(P.d)} m of ${N.len} m.`;
  $('bigStars').innerHTML = [0, 1, 2].map(() => `<span class="star off">★</span>`).join('');
  $('rows').innerHTML = [
    `<div><span>Distance</span><span>${Math.round(Math.min(P.d, N.len))} m</span></div>`,
    `<div><span>Fireflies</span><span>${P.flies}</span></div>`,
    `<div><span>English words</span><span>${right}/${total} right</span></div>`,
    P.bestCombo >= 3 ? `<div><span>Best firefly combo</span><span>x${P.bestCombo}</span></div>` : '',
    `<div><span>Score</span><span><b id="resScore">0</b>${P.score >= save.best[night] && P.score > 0 ? ' · best!' : ''}</span></div>`,
    firstClear && night < 2 ? `<div><span>Unlocked</span><span>${NIGHTS[night + 1].name}</span></div>` : '',
    ...answers.filter((a) => !a.ok).slice(0, 8).map((a, k) => `<div class="rev">${k ? '' : 'Learn these:<br>'}✗ ${esc(a.chose)} → ${esc(a.sentence).replace(esc(a.right), '<b>' + esc(a.right) + '</b>')}</div>`),
  ].join('');
  lastWon = won;
  // (v2) the results: the panel springs in, the score counts up and the stars pop in one by one with rising notes
  setTimeout(() => {
    $('result').hidden = false; finishing = false; if (won) sfx.right();
    const t0 = performance.now(), el = $('resScore'), total = P.score;
    const count = () => { const k = clamp((performance.now() - t0) / 800, 0, 1); if (el) el.textContent = Math.round(total * (1 - (1 - k) ** 3)); if (k < 1 && !$('result').hidden) requestAnimationFrame(count); };
    requestAnimationFrame(count);
    [...$('bigStars').children].forEach((sp, i) => { if (i < stars) setTimeout(() => { if ($('result').hidden) return; sp.className = 'star popin'; sfx.starPop(i); buzz(20);
      if (i === 2) { setTimeout(() => sfx.milestone(), 200); for (let k = 0; k < 4; k++) setTimeout(() => firework(rand(-10, 10), rand(9, 16), rand(-40, -25)), 200 + k * 150); } }, 450 + i * 320); });
  }, won ? 250 : 900);
}
function toMenu() {
  state = 'menu'; clearObjs(); endCombo(); lastWon = false; $('hud').hidden = true; $('result').hidden = true; $('pause').hidden = true; $('menu').hidden = false;
  buildWorld(save.night); setFlyer(save.hero); Object.assign(P, { x: 0, y: 3, tx: 0, ty: 3, v: SPEED_MENU, cheer: 0 }); showMenu();
}

/* ---------- input: drag anywhere to steer ---------- */
const keys = {};
addEventListener('keydown', (e) => { keys[e.code] = 1; if (e.code === 'Escape' && state === 'fly') pauseGame();
  if ((e.code === 'Enter' || e.code === 'Space') && state === 'result' && !$('result').hidden) { e.preventDefault(); $('again').click(); } });
addEventListener('keyup', (e) => { keys[e.code] = 0; });
const drag = { id: null, sx: 0, sy: 0, bx: 0, by: 0 };
stage.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button') || (state !== 'fly' && state !== 'finale')) return;
  Object.assign(drag, { id: e.pointerId, sx: e.clientX, sy: e.clientY, bx: P.tx, by: P.ty }); try { stage.setPointerCapture(e.pointerId); } catch (_) {}
  $('hint').style.opacity = 0;
});
stage.addEventListener('pointermove', (e) => {
  if (e.pointerId !== drag.id) return;
  const k = 9 / VW; P.tx = clamp(drag.bx + (e.clientX - drag.sx) * k, -LANE.x, LANE.x); P.ty = clamp(drag.by - (e.clientY - drag.sy) * k, LANE.y0, LANE.y1);
});
const endDrag = (e) => { if (e.pointerId === drag.id) drag.id = null; };
stage.addEventListener('pointerup', endDrag); stage.addEventListener('pointercancel', endDrag);
function pauseGame() { if (state !== 'fly') return; state = 'pause'; $('pauseInfo').textContent = `${NIGHTS[night].name} · ${Math.round(P.d)} of ${NIGHTS[night].len} m`; calmLabel(); $('pause').hidden = false; }
const calmLabel = () => { $('calmBtn').textContent = `Calm mode: ${save.calm ? 'on' : 'off'}`; };
$('calmBtn').onclick = () => { save.calm = !save.calm; store(); sfx.click(); calmLabel(); };
$('pauseBtn').onclick = pauseGame;
$('resume').onclick = () => { $('pause').hidden = true; state = 'fly'; };
$('quit').onclick = () => { sfx.click(); toMenu(); };
$('again').onclick = () => { sfx.click(); startNight(night); };
$('toMenu').onclick = () => { sfx.click(); toMenu(); };
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

/* ---------- the menu ---------- */
function showMenu() {
  const box = $('nights'); box.innerHTML = '';
  NIGHTS.forEach((N, i) => {
    const b = document.createElement('button'), ok = unlockedN(i);
    b.className = 'night glass' + (i === save.night ? ' on' : '') + (ok ? '' : ' locked');
    b.innerHTML = `<b>${ok ? '' : '🔒 '}${N.name}</b><i>${[0, 1, 2].map((k) => `<span class="star ${k < save.stars[i] ? '' : 'off'}">★</span>`).join('')}</i>`;
    b.onclick = () => { if (!ok) { tone(180, .2, 'triangle', .05); return; } sfx.click(); save.night = i; store(); buildWorld(i); setFlyer(save.hero); showMenu(); };
    box.appendChild(b);
  });
  const N = NIGHTS[save.night];
  $('nightSub').textContent = `${N.sub} · ${N.len} m · ${N.gates} word gates${save.best[save.night] ? ` · best ${save.best[save.night]}` : ''}`;
  $('allStars').textContent = save.stars.reduce((a, b) => a + b, 0);
  for (const m of document.querySelectorAll('.mate')) m.classList.toggle('on', m.dataset.id === save.hero);
}
function showPack() {
  const sum = window.FugioPacks ? FugioPacks.summary(PACKS, save.packs) : { title: 'Questions', level: '–' };
  const LVC = { A0: '#7fe0a0', A1: '#8cc8ff', A2: '#c9a3ff' };
  $('qLv').textContent = sum.level; $('qLv').style.setProperty('--c', LVC[sum.level] || '#ffc76b'); $('qTitle').textContent = sum.title;
}
$('qbtn').onclick = async () => {
  if (!window.FugioPacks) return; sfx.click();
  const ids = await FugioPacks.open(PACKS, save.packs, { theme: 'gummy', kicker: 'CHOOSE THE WORDS' });
  if (ids && ids.length) { save.packs = ids; store(); usedQ.clear(); showPack(); }
};
$('play').onclick = () => { ac(); startNight(save.night); };
// little portraits of the crew for the buttons, drawn once from the 3D models
function portraits() {
  const Sz = 160, rt = new THREE.WebGLRenderTarget(Sz, Sz); rt.texture.colorSpace = THREE.SRGBColorSpace;
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x6a5aa8, 2.2)); const dl = new THREE.DirectionalLight(0xffe8c8, 1.8); dl.position.set(2, 3, 4); sc.add(dl);
  sc.background = new THREE.Color(0x3a2a7a);
  const c = new THREE.PerspectiveCamera(30, 1, .1, 20), px = new Uint8Array(Sz * Sz * 4), cnv = document.createElement('canvas'); cnv.width = cnv.height = Sz; const ctx = cnv.getContext('2d'), out = {};
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  for (const id of Object.keys(CREW)) {
    const ch = mChar(id); animChar(ch, 0, {}); ch.g.rotation.y = .3; sc.add(ch.g);
    c.position.set(.35, ch.top - .25, 1.9); c.lookAt(0, ch.top - .38, 0);
    renderer.setRenderTarget(rt); renderer.render(sc, c); renderer.readRenderTargetPixels(rt, 0, 0, Sz, Sz, px);
    const img = ctx.createImageData(Sz, Sz); for (let r = 0; r < Sz; r++) img.data.set(px.subarray((Sz - 1 - r) * Sz * 4, (Sz - r) * Sz * 4), r * Sz * 4);
    ctx.putImageData(img, 0, 0); out[id] = cnv.toDataURL(); sc.remove(ch.g);
  }
  renderer.setRenderTarget(null); renderer.toneMapping = THREE.NoToneMapping; rt.dispose(); return out;
}

/* ---------- start ---------- */
fit();
try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]); } catch (e) {}
const pics = portraits();
for (const id of Object.keys(CREW)) {
  const b = document.createElement('button'); b.className = 'mate glass'; b.dataset.id = id;
  b.innerHTML = `<img src="${pics[id]}" alt="">${CREW[id].name}`;
  b.onclick = () => { sfx.click(); save.hero = id; store(); setFlyer(id); showMenu(); flyer.ch && (P.cheer = 1); };
  $('crew').appendChild(b);
}
buildWorld(save.night); setFlyer(save.hero); P.v = SPEED_MENU; showPack(); showMenu();
$('loading').remove();

let last = performance.now(), T = 0, RT = 0, lastWon = false, camSnap = true, TESTK = 1;
const frameMs = [];
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), CT = new THREE.Vector3(), LT = new THREE.Vector3();
function frame(now) {
  requestAnimationFrame(frame);
  const raw = (now - last) / 1000, dt = Math.min(.033, raw) * TESTK; last = now; RT += dt;
  if (raw > 0 && raw < 1) { frameMs.push(raw * 1000); if (frameMs.length > 900) frameMs.shift(); }
  if (raw < .5) watchSpeed(raw);
  // (v2) hit-stop freezes the world for a few frames; slow motion stretches a big moment, easing back at the end
  let sdt = dt;
  if (FEEL.hitStop > 0) { FEEL.hitStop -= dt; sdt = 0; }
  else if (FEEL.slow > 0) { FEEL.slow -= dt; const k = FEEL.slow < .1 ? FEEL.slowK + (1 - FEEL.slowK) * (1 - FEEL.slow / .1) : FEEL.slowK; sdt = dt * k; }
  T += sdt; U.time.value = T;
  const flying = state === 'fly' || state === 'finale', N = NIGHTS[W.n];
  if (flying && sdt > 0) step(sdt);
  if (state === 'crash' && sdt > 0) { finaleT += sdt; P.y -= sdt * (3 + finaleT * 6); P.v = Math.max(0, P.v - sdt * 10); if (P.y < -.4 && !finishing && state === 'crash') { emit(P.x, 0, 0, 0xbfe0ff, 70, 5, 6, 1); sfx.crash(); addTrauma(.5); finish(false); } }
  const v = state === 'menu' ? SPEED_MENU : state === 'pause' || state === 'result' ? 0 : P.v;
  animWorld(sdt, v); updateFx(sdt, v); updatePaper(sdt); updateLines(sdt, v);
  if (state === 'result' && lastWon && R() < dt * 1.3) firework(rand(-14, 14), rand(9, 20), rand(-60, -25)); // the festival goes on behind the results
  FEEL.trauma = Math.max(0, FEEL.trauma - dt * 1.5); FEEL.wobble = Math.max(0, FEEL.wobble - dt); FEEL.fovKick *= Math.exp(-dt * 4);
  // the glider
  const f = flyer;
  if (state === 'menu') {
    f.root.position.set(0, 2.7 + Math.sin(T * 1.4) * .12, 0); f.root.rotation.set(0, .45 + Math.sin(T * .4) * .25, 0);
    f.tilt.rotation.set(Math.sin(T * 1.1) * .05, 0, Math.sin(T * .9) * .08);
    if (cam.fov !== 64) { cam.fov = 64; cam.updateProjectionMatrix(); }
    cam.position.set(0, 3.2, 5.4); cam.lookAt(0, 1.85, 0); camSnap = true;
  } else {
    // (v2) the glider rolls into turns, turns its nose a little and wobbles when hit
    const bank = P.bankS || 0, wob = FEEL.wobble > 0 ? Math.sin(FEEL.wobble * 38) * FEEL.wobble * .6 : 0, cr = state === 'crash' ? finaleT : 0;
    f.root.position.set(P.x, P.y + Math.sin(T * 2) * .05, 0); f.root.rotation.set(0, Math.PI - bank * .22, 0);
    f.tilt.rotation.set(-(P.pitchS || 0) * .35 + wob * .4 - cr * 2, 0, bank * .62 + wob + cr * 3);
    f.root.visible = FEEL.hitStop > 0 || !(P.inv > 0 && Math.sin(RT * 30) > 0) || state !== 'fly';
    // (v2) the camera follows with a little lag, rolls a third of the bank, widens in a boost and shakes with smooth "trauma"
    const base = 64 + (cam.aspect < 1 ? (1 - cam.aspect) * 16 : 0), fovT = base + (P.boost > 0 && state === 'fly' ? 12 : 0) + FEEL.fovKick;
    cam.fov += (fovT - cam.fov) * Math.min(1, dt * 6); cam.updateProjectionMatrix();
    CT.set(P.x * .45, P.y * .6 + 3.3, 8.4 + (P.boost > 0 ? .5 : 0)); LT.set(P.x * .6, P.y * .8 + 1.7, -14);
    if (state === 'finale' || (state === 'result' && lastWon)) { const a = Math.min(1, finaleT / 2.5); CT.x += Math.sin(finaleT * .6) * 2.2 * a; CT.y += .6 * a; CT.z += 1.2 * a; LT.y += 3.2 * a; }
    if (camSnap) { camPos.copy(CT); camLook.copy(LT); camSnap = false; }
    camPos.lerp(CT, 1 - Math.exp(-dt * 7)); camLook.lerp(LT, 1 - Math.exp(-dt * 9));
    const sh = FEEL.trauma * FEEL.trauma;
    cam.position.set(camPos.x + sh * .3 * nz(RT * 23), camPos.y + sh * .3 * nz(RT * 27 + 5), camPos.z);
    cam.lookAt(camLook); cam.rotateZ(-bank * .12 + sh * .035 * nz(RT * 19 + 9));
  }
  f.light.intensity = 3 + Math.sin(T * 9) * .3;
  animChar(f.ch, T, { bank: state === 'menu' ? 0 : P.bankS, pitch: P.pitchS, cheer: P.cheer, look: P.cheer > 0 ? Math.PI * .75 : 0 });
  trails.forEach((tr, i) => updateTrail(tr, f.gl.tips[i], sdt, v));
  // (v2) the moon crosses the sky during the night: a soft timer
  const mk = state === 'menu' ? 0 : clamp(P.d / NIGHTS[night].len, 0, 1); W.mk = (W.mk || 0) + (mk - (W.mk || 0)) * Math.min(1, dt * 2);
  const mx = -60 + W.mk * 105, my = 52 + Math.sin(W.mk * Math.PI) * 22;
  for (const m of W.moon) { m.position.x = mx; m.position.y = my; }
  W.moonLight.position.set(mx, my, -240).normalize().multiplyScalar(50);
  W.path.position.x = mx * .45 + cam.position.x * .3; W.sparkle.material.uniforms.uPath.value = mx * .45;
  // the score rolls up to its new value
  if (state !== 'menu') { const d = P.score - shownScore; shownScore = d > 0 ? Math.min(P.score, shownScore + Math.max(1, d * Math.min(1, dt * 8))) : P.score; const sc = Math.floor(shownScore); if (sc !== lastShown) { $('score').textContent = sc; lastShown = sc; } }
  post.render(scene, cam);
}
requestAnimationFrame(frame);

// hooks for automatic tests
window.AI = {
  get state() { return state; }, P, objs, save, NIGHTS, info: () => ({ ...stats, quality }),
  start: (n = 0) => startNight(n), menu: toMenu, god: () => { P.hearts = 99; },
  // (v2) game-feel hooks: read the feel state, fire an effect for a screenshot, frame-time stats, calm mode
  feel: FEEL, calm: (on = true) => { save.calm = !!on; store(); },
  frames: (n = 600) => { const a = frameMs.slice(-n).sort((x, y) => x - y); if (!a.length) return null; const q = (k) => +a[Math.min(a.length - 1, Math.floor(a.length * k))].toFixed(1); return { n: a.length, avg: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1), p50: q(.5), p95: q(.95), max: q(1) }; },
  resetFrames: () => { frameMs.length = 0; }, timeScale: (k = 1) => { TESTK = k; }, // slow the whole game down for screenshots
  fx: (name) => {
    if (name === 'hit') { P.inv = 0; const h = P.hearts; hurt(); if (h > 3) P.hearts = h; }
    else if (name === 'boost') { P.boost = 1.6; FEEL.fovKick += 7; sfx.whoosh(); }
    else if (name === 'near') { FEEL.nearCD = 0; P.inv = 0; nearMiss(P.x + 1.2, P.y, 0); }
    else if (name === 'combo') { FEEL.combo = 9; FEEL.comboT = 2.2; showCombo(); }
    else if (name === 'festival') festival();
    return name;
  },
  autopilot: () => { // steer to the right ring of the next gate, else drift to fireflies
    const g = objs.find((o) => o.kind === 'gate' && !o.done);
    if (g && g.z > -60) { const i = g.words.findIndex((w) => w.ok); P.tx = GATE_X[i]; P.ty = GATE_Y; return 'gate'; }
    const f = objs.filter((o) => o.kind === 'fly' && !o.done && o.z < 0).sort((a, b) => b.z - a.z)[0]; if (f) { P.tx = f.x; P.ty = f.y; } return 'fly';
  },
};
