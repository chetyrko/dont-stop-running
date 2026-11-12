// Полноценная 3D-модель персонажа (Флит и остальные 13 — перекраской, шляпами и пропорциями).
// Модель собрана из объёмных деталей по рисункам автора: высокая голова с чёлкой-коком,
// красная рубашка с короткими рукавами, песочный ремень, брюки в тонкую полоску, тонкие
// чёрные руки и ноги, вытянутые ботинки, кремнёвый пистолет. Свет ступенчатый, как заливка
// тушью, по силуэту — чернильный контур.
// Движение — по тем же 10 рисункам бега, что и во 2D: из rig.js берутся углы и длины костей
// (rigPose), и каждая кость 3D-модели поворачивается так же, как на рисунке.

import * as THREE from '../vendor/three.module.min.js?v=d54e0c7';
import { rigPose, RIG, RUN_CYCLE } from './rig.js?v=d54e0c7';

const M = RIG.S * 0.0115;                  // пиксель рисунка 1280×1280 → метры (рост ≈ 1.9 м)
const INK = 0x0d0a09;

// ---------- материалы ----------
let ramp;
function toonRamp() {
  if (ramp) return ramp;
  ramp = new THREE.DataTexture(new Uint8Array([105, 105, 105, 255, 185, 185, 185, 255, 255, 255, 255, 255]), 3, 1);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
  return ramp;
}
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
// штрихи «от руки» поверх цвета
function strokes(x, w, h, color, n, len, alpha) {
  x.strokeStyle = color; x.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    x.globalAlpha = alpha * (0.4 + Math.random() * 0.6); x.lineWidth = 1 + Math.random() * 2.5;
    const sx = Math.random() * w, sy = Math.random() * h, a = -0.9 + Math.random() * 0.5;
    x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + Math.cos(a) * len, sy + Math.sin(a) * len); x.stroke();
  }
  x.globalAlpha = 1;
}
const texCache = new Map();
function shirtTex(color) {
  const key = 'shirt' + color;
  if (!texCache.has(key)) texCache.set(key, canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = color; x.fillRect(0, 0, w, h);
    strokes(x, w, h, 'rgba(40,5,8,1)', 40, 26, 0.35);
    strokes(x, w, h, 'rgba(255,220,210,1)', 14, 18, 0.12);
  }));
  return texCache.get(key);
}
function pantsTex() {
  if (!texCache.has('pants')) texCache.set('pants', canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#131111'; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(150,145,140,0.55)'; x.lineWidth = 1.6;
    for (let i = 4; i < w; i += 11) { x.beginPath(); x.moveTo(i + Math.random() * 2, 0); x.lineTo(i + Math.random() * 2, h); x.stroke(); }
  }, [3, 1]));
  return texCache.get('pants');
}
function skinTex() {
  if (!texCache.has('skin')) texCache.set('skin', canvasTex(64, 64, (x, w, h) => {
    x.fillStyle = '#f1eadf'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(120,100,80,${Math.random() * 0.08})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  }));
  return texCache.get('skin');
}
export const toon = (o) => new THREE.MeshToonMaterial({ gradientMap: toonRamp(), ...o });

// чернильный контур: деталь, раздутая вдоль нормалей, рисуется изнанкой
let inkMat;
function ink() {
  return inkMat ||= new THREE.ShaderMaterial({
    uniforms: { uW: { value: 0.016 }, uC: { value: new THREE.Color(INK) } },
    vertexShader: 'uniform float uW; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vec3 n = normalize(normalMatrix * normal); mv.xyz += n * uW; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uC; void main(){ gl_FragColor = vec4(uC, 1.0); }',
    side: THREE.BackSide,
  });
}

// ---------- геометрия ----------
// скруглённый ящик: вершины коробки притягиваются к скруглённым рёбрам
export function roundedBox(w, h, d, r, seg = 4) {
  const g = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2);
  const p = g.attributes.position, v = new THREE.Vector3(), inner = new THREE.Vector3(w / 2 - r, h / 2 - r, d / 2 - r);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const c = new THREE.Vector3(Math.max(-inner.x, Math.min(inner.x, v.x)), Math.max(-inner.y, Math.min(inner.y, v.y)), Math.max(-inner.z, Math.min(inner.z, v.z)));
    const n = v.clone().sub(c);
    if (n.lengthSq() > 0) v.copy(c.add(n.normalize().multiplyScalar(r)));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
// кость единичной длины вниз по −y (длину задаёт масштаб)
function limbGeom(r1, r2, seg = 12) {
  const g = new THREE.CylinderGeometry(r1, r2, 1, seg, 4);
  g.translate(0, -0.5, 0);
  // скругляем концы, чтобы суставы не торчали
  return g;
}

export function mesh(geom, material, outline = true) {
  const m = new THREE.Mesh(geom, material);
  if (outline) m.add(new THREE.Mesh(geom, ink()));
  return m;
}

// угол кости на рисунке (y вниз, x — вперёд) → поворот вокруг боковой оси:
// кость вдоль −y (рука, нога) и вдоль +y (торс, голова)
const downRot = (a) => Math.PI / 2 - a;
const upRot = (a) => -Math.PI / 2 - a;
// точка рисунка → координаты модели (бок, вверх, вперёд = −z)
const P3 = (x, y, lat = 0) => new THREE.Vector3(lat, (RIG.GROUND - y) * M, -(x - RIG.CX) * M);
const end = (x, y, a, l) => [x + Math.cos(a) * l, y + Math.sin(a) * l];
const lerpN = (a, b, k) => a + (b - a) * k;

export class Hero3D {
  constructor(look = {}, weapon = 'pistol') {
    this.root = new THREE.Group();
    this.body = new THREE.Group(); this.root.add(this.body);
    this.st = {};
    const shirtColor = look.shirt || '#b3302c';
    const shirt = toon({ map: shirtTex(shirtColor) });
    const shirtDark = toon({ color: new THREE.Color(shirtColor).multiplyScalar(0.65) });
    const pants = toon({ map: pantsTex() });
    const black = toon({ color: 0x151212 });
    const skin = toon({ map: skinTex() });
    const belt = toon({ color: 0xc49a5c });
    const hairM = toon({ color: 0x0c0a09 });
    const white = toon({ color: 0xfaf6ee });
    const inkM = new THREE.MeshBasicMaterial({ color: INK });
    const B = (name) => { const g = new THREE.Group(); this.body.add(g); this[name] = g; return g; };

    // таз (брюки) и ремень
    const hipsM = mesh(roundedBox(0.28, 0.17, 0.2, 0.06), pants); hipsM.position.set(0, -0.06, 0.01); B('pelvis').add(hipsM);
    // торс: рубашка сужается к поясу, широкая в груди
    const prof = [[0.0, 0], [0.125, 0], [0.13, 0.12], [0.15, 0.45], [0.163, 0.68], [0.15, 0.82], [0.12, 0.92], [0.075, 0.98], [0.0, 1.0]].map(([r, y]) => new THREE.Vector2(r, y));
    const torsoG = new THREE.LatheGeometry(prof, 20); torsoG.scale(1.18, 1, 0.85);
    const torso = B('torso');
    this.torsoMesh = mesh(torsoG, shirt); torso.add(this.torsoMesh);
    const beltG = new THREE.CylinderGeometry(0.131, 0.131, 0.055, 20, 1, true); beltG.scale(1.2, 1, 0.87);
    const beltM = mesh(beltG, belt); beltM.position.y = 0.035; torso.add(beltM);
    const buckle = mesh(roundedBox(0.05, 0.045, 0.02, 0.008), toon({ color: 0x8a6a3a })); buckle.position.set(0, 0.035, -0.118); torso.add(buckle);
    // складки рубашки
    for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.18, 0.006), inkM); f.position.set(s * 0.06, 0.35, -0.125); f.rotation.z = s * 0.15; this.torsoMesh.add(f); }

    // голова: шея, высокое лицо, кок, уши, глаза, брови, нос, рот
    const head = B('head');
    const neck = mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 12), skin); neck.position.y = 0.03; head.add(neck);
    const face = mesh(roundedBox(0.2, 0.34, 0.235, 0.06), skin); face.position.set(0, 0.24, -0.015); head.add(face);
    const jaw = mesh(roundedBox(0.19, 0.1, 0.2, 0.04), skin); jaw.position.set(0, 0.11, -0.04); head.add(jaw);
    const hairTop = mesh(roundedBox(0.215, 0.07, 0.245, 0.035), hairM); hairTop.position.set(0, 0.395, 0.0); head.add(hairTop);
    const quiff = mesh(roundedBox(0.19, 0.08, 0.17, 0.04), hairM); this.quiff = quiff; quiff.position.set(0, 0.425, -0.11); quiff.rotation.x = 0.35; head.add(quiff);
    const tip = mesh(new THREE.ConeGeometry(0.06, 0.16, 10), hairM); tip.position.set(0, 0.45, -0.2); tip.rotation.x = -1.4; tip.scale.set(1.5, 1, 0.6); head.add(tip);
    const back = mesh(roundedBox(0.212, 0.1, 0.045, 0.02), hairM); back.position.set(0, 0.37, 0.105); head.add(back);
    for (const s of [-1, 1]) {
      const burn = mesh(roundedBox(0.012, 0.09, 0.05, 0.005), hairM, false); burn.position.set(s * 0.101, 0.33, 0.06); head.add(burn);
      const ear = mesh(new THREE.SphereGeometry(0.045, 10, 8), skin); ear.scale.set(0.35, 1, 0.7); ear.position.set(s * 0.105, 0.25, 0.045); head.add(ear);
      const eye = mesh(new THREE.SphereGeometry(0.03, 12, 10), white); eye.scale.set(1, 1.3, 0.45); eye.position.set(s * 0.048, 0.285, -0.133); head.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), inkM); pupil.position.set(s * 0.05, 0.283, -0.146); head.add(pupil);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.016, 0.012), inkM); brow.position.set(s * 0.05, 0.33, -0.136); brow.rotation.z = -s * 0.28; head.add(brow);
    }
    const nose = mesh(roundedBox(0.035, 0.075, 0.05, 0.015), skin); nose.position.set(0, 0.245, -0.145); head.add(nose);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.01, 0.01), inkM); mouth.position.set(0.005, 0.17, -0.138); mouth.rotation.z = 0.06; head.add(mouth);
    addHat(head, look.hat);

    // ноги: бедро, голень, ботинок (A — ближняя, B — дальняя)
    this.legs = ['A', 'B'].map((k) => {
      const lat = k === 'A' ? 0.075 : -0.075;
      const thigh = B('t' + k), shin = B('s' + k), foot = B('f' + k);
      thigh.add(this.limb(limbGeom(0.062, 0.048), pants)); shin.add(this.limb(limbGeom(0.048, 0.036), pants));
      const shoe = mesh(roundedBox(0.09, 0.075, 1, 0.03), black); shoe.geometry.translate(0, 0, 0); foot.add(shoe); foot.userData.shoe = shoe;
      return { k, lat, thigh, shin, foot };
    });
    // руки: рукав рубашки, предплечье, кулак (g — с пистолетом, ближняя; f — с кулаком, дальняя)
    this.arms = ['g', 'f'].map((k) => {
      const lat = k === 'g' ? 0.2 : -0.2;
      const up = B('u' + k), fo = B('o' + k), hand = B('h' + k);
      up.add(this.limb(limbGeom(0.072, 0.062), shirt));
      fo.add(this.limb(limbGeom(0.034, 0.03), black));
      const fist = mesh(roundedBox(0.085, 0.09, 0.1, 0.035), black); hand.add(fist);
      return { k, lat, up, fo, hand };
    });
    if (weapon === 'fists' || look.noGun) this.arms.forEach(a => a.hand.scale.setScalar(1.35));
    // оружие в ближней руке
    this.gun = B('gun');
    if (weapon !== 'fists' && !look.noGun) {
      const wood = toon({ color: 0x6b4428 }), steel = toon({ color: 0x3b3735 }), brass = toon({ color: 0xc9a24a });
      const L = weapon === 'rifle' ? 0.75 : weapon === 'shotgun' ? 0.5 : 0.26;
      const barrel = mesh(new THREE.CylinderGeometry(0.018, 0.022, L, 10), steel); barrel.position.y = -L / 2 - 0.02; this.gun.add(barrel);
      if (weapon === 'shotgun') { const b2 = barrel.clone(); b2.position.x = 0.04; this.gun.add(b2); }
      const ring = mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.025, 10), brass); ring.position.y = -L - 0.01; this.gun.add(ring);
      const grip = mesh(roundedBox(0.04, 0.16, 0.06, 0.018), wood); grip.position.set(0, 0.03, 0.06); grip.rotation.x = -0.9; this.gun.add(grip);
      if (weapon === 'rifle') { const stock = mesh(roundedBox(0.05, 0.3, 0.09, 0.02), wood); stock.position.set(0, 0.17, 0.02); this.gun.add(stock); }
    }
    this.weapon = weapon;
    this.look = look;
    this.root.scale.set(look.sx || 1, look.sy || 1, look.sx || 1);
  }

  limb(geom, material) { return mesh(geom, material); }

  // pose: run | jump | slide | idle | kick; extra — как у drawRigHero (vy, kickT, blend, state, tau)
  pose(pose, t, extra = {}) {
    const { p, sq } = rigPose(pose, t, { state: this.st, ...extra });
    const W = [p.x, p.y], C = end(p.x, p.y, p.tA, p.tL), H = [p.x + p.hpx, p.y + p.hpy];
    // торс: от пояса к груди
    this.torso.position.copy(P3(W[0], W[1]));
    this.torso.rotation.set(upRot(p.tA), 0, 0);
    this.torsoMesh.scale.set(1, p.tL * M * 1.12, 1);
    // таз
    this.pelvis.position.copy(P3((W[0] + H[0]) / 2, (W[1] + H[1]) / 2 - 8));
    this.pelvis.rotation.set(upRot(p.tA), 0, 0);
    // голова: на шее, наклон — как у головы на рисунке
    const N = end(C[0], C[1], p.tA, 6);
    this.head.position.copy(P3(N[0], N[1]));
    const ha = Math.atan2(p.hy - C[1], p.hx - C[0]);
    this.head.rotation.set(REST_HEAD - ha, 0, 0);
    // ноги
    for (const L of this.legs) {
      const k = L.k;
      const K = end(H[0], H[1], p[k + 'ta'], p[k + 'tl']), A = end(K[0], K[1], p[k + 'sa'], p[k + 'sl']);
      this.bone(L.thigh, H, p[k + 'ta'], p[k + 'tl'], L.lat);
      this.bone(L.shin, K, p[k + 'sa'], p[k + 'sl'], L.lat);
      // ботинок: от пятки к носку, чуть приподнят
      L.foot.position.copy(P3(A[0], A[1], L.lat));
      const fa = p[k + 'fa'], fl = Math.max(110, p[k + 'fl']) * M * 1.15;
      L.foot.rotation.set(-fa, 0, 0);   // поворот вокруг бока: 0 — носок вперёд
      const shoe = L.foot.userData.shoe;
      shoe.scale.set(1, 1, fl); shoe.position.set(0, -0.02, -fl / 2 + 0.03);
    }
    // руки
    for (const a of this.arms) {
      const k = a.k, S = [p.x + (k === 'g' ? p.sgx : p.sfx), p.y + (k === 'g' ? p.sgy : p.sfy)];
      const E = end(S[0], S[1], p[k + 'Sa'], p[k + 'Sl']), Wr = end(E[0], E[1], p[k + 'Fa'], p[k + 'Fl']);
      this.bone(a.up, S, p[k + 'Sa'], p[k + 'Sl'], a.lat);
      this.bone(a.fo, E, p[k + 'Fa'], p[k + 'Fl'], a.lat * 1.05);
      a.hand.position.copy(P3(Wr[0], Wr[1], a.lat * 1.05));
      a.hand.rotation.set(downRot(p[k + 'Fa']), 0, 0);
      if (k === 'g') { this.gun.position.copy(a.hand.position); this.gun.rotation.set(downRot(p.gun), 0, 0); }
    }
    // присед при приземлении / вытягивание в прыжке
    this.body.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
    this.alive(pose, t, extra, P3(W[0], W[1]));
  }

  // Движения, которых нет на рисунках в профиль, но которые видно со спины:
  // плечи и бёдра поворачиваются навстречу друг другу на каждом шаге, тело покачивается
  // и подпрыгивает, руки и колени чуть разведены, голова гасит тряску, кок пружинит.
  alive(pose, t, extra, waist) {
    const k = this.dynK = lerpN(this.dynK ?? 0, pose === 'run' ? 1 : pose === 'jump' ? 0.35 : 0, 0.2);
    const ph = (t / RUN_CYCLE) * Math.PI * 2;          // полный цикл — два шага
    const twist = Math.sin(ph) * 0.32 * k;             // плечи вперёд вместе с рукой
    const upper = [this.torso, this.head, ...this.arms.flatMap(a => [a.up, a.fo, a.hand]), this.gun];
    const lower = [this.pelvis, ...this.legs.flatMap(l => [l.thigh, l.shin, l.foot])];
    const turn = (list, a) => {
      if (!a) return;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
      for (const g of list) { g.position.sub(waist).applyQuaternion(q).add(waist); g.quaternion.premultiply(q); }
    };
    turn(upper, twist);
    turn(lower, -twist * 0.55);
    // руки и колени немного наружу, чтобы со спины было видно их работу
    for (const a of this.arms) for (const g of [a.up, a.fo, a.hand]) g.rotateZ((a.lat > 0 ? -1 : 1) * 0.16 * Math.max(k, 0.4));
    for (const l of this.legs) l.thigh.rotateZ((l.lat > 0 ? -1 : 1) * 0.05 * k);
    // покачивание и подпрыгивание: два раза за цикл, в момент толчка
    const step = Math.abs(Math.sin(ph));
    this.body.position.set(Math.sin(ph) * 0.035 * k, step * 0.05 * k, 0);
    this.body.rotation.set(-0.12 * k + (extra.lean || 0),   // корпус чуть вперёд
      (extra.turn || 0), Math.sin(ph) * 0.07 * k + (extra.roll || 0));
    // голова держит горизонт, кок пружинит
    this.head.rotateZ(-Math.sin(ph) * 0.06 * k);
    if (this.quiff) this.quiff.rotation.x = 0.35 + Math.sin(ph * 2) * 0.12 * k;
  }

  bone(g, at, a, l, lat) {
    g.position.copy(P3(at[0], at[1], lat));
    g.rotation.set(downRot(a), 0, 0);
    g.children[0].scale.set(1, l * M, 1);
  }
}

// голова на рисунке в стойке смотрит чуть вперёд: этот угол считаем «прямо»
const REST_HEAD = Math.atan2(147 - 443, 597 - 540);

function addHat(head, hat) {
  if (!hat || hat === 'none') return;
  const g = new THREE.Group(); g.position.y = 0.44; head.add(g);
  const m = (geo, c, pos) => { const x = mesh(geo, toon({ color: c })); x.position.set(...pos); g.add(x); return x; };
  if (hat === 'tophat') {
    m(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 24), 0x16121a, [0, 0.01, 0]);
    m(new THREE.CylinderGeometry(0.12, 0.13, 0.3, 20), 0x1d1a20, [0, 0.16, 0]);
    m(new THREE.CylinderGeometry(0.132, 0.132, 0.05, 20), 0x7a2f35, [0, 0.05, 0]);
  } else if (hat === 'tricorn') {
    const c = m(new THREE.ConeGeometry(0.24, 0.14, 3), 0x2c2118, [0, 0.07, 0]); c.rotation.y = Math.PI;
  } else if (hat === 'plague') {
    m(new THREE.CylinderGeometry(0.22, 0.22, 0.025, 24), 0x16120f, [0, 0.01, 0]);
    m(new THREE.CylinderGeometry(0.12, 0.14, 0.16, 20), 0x2a2622, [0, 0.1, 0]);
    const beak = m(new THREE.ConeGeometry(0.055, 0.3, 12), 0xcdbf9f, [0, -0.2, -0.26]); beak.rotation.x = -Math.PI / 2 - 0.3;
  }
}
