// Настоящий 3D-забег на three.js (лежит локально в vendor/, работает без интернета).
// Мир: коридор поместья с обоями автора, герой из объёмных деталей с чернильной обводкой,
// враги — объёмные модели. Логика забега та же, что в game3d.js (Run3D наследует Game3D),
// здесь — только то, как это выглядит.
//
// Режимы сцены: title — герой во весь экран, опёрся на меню; lobby — разминается слева,
// «СТАРТ» по центру; run — забег, камера сзади.

import * as THREE from '../vendor/three.module.min.js?v=101040f';
import { cutoutMesh, liveCutout } from './cutout3d.js?v=101040f';
import { Hero3D } from './hero3d.js?v=101040f';
import { Game3D, Z_HERO, LANE, KIND, FLAT, HINT, FLOOR2 } from './game3d.js?v=101040f';
import { ENEMY } from './enemies.js?v=101040f';
import * as art from './art.js?v=101040f';
import { drawRigHero, rigReady } from './rig.js?v=101040f';
import { recolor } from './pixels.js?v=101040f';
import { GROUND_Y, FLOOR_TOP, HERO_SCALE } from './config.js?v=101040f';
import { EXITS } from './rooms.js?v=101040f';
import { sfx } from './audio.js?v=101040f';

const WALL = 2.6, CEIL = 8.0, LEN = 120;
const PAPER = 3.8;   // высота обоев (рисунок автора); выше — тёмная верхняя часть стены до высокого потолка
const INK = 0x16120f;
const OUTLINE = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const lerp = (a, b, k) => a + (b - a) * k;

// ---------- кирпичики моделей: деталь + чернильная обводка ----------
function mat(color, o = {}) {
  if (o.basic) return new THREE.MeshBasicMaterial({ color, transparent: o.opacity !== undefined, opacity: o.opacity ?? 1, depthWrite: o.opacity === undefined });
  return new THREE.MeshLambertMaterial({ color, emissive: o.emissive ?? 0x000000, transparent: o.opacity !== undefined, opacity: o.opacity ?? 1 });
}
function piece(geom, color, pos = [0, 0, 0], o = {}) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(geom, o.material || mat(color, o));
  g.add(m);
  if (!o.noOutline) {
    const out = new THREE.Mesh(geom, OUTLINE);
    const k = o.outline ?? 0.035;
    geom.computeBoundingBox();
    const s = geom.boundingBox.getSize(new THREE.Vector3());
    out.scale.set(1 + k * 2 / Math.max(0.05, s.x), 1 + k * 2 / Math.max(0.05, s.y), 1 + k * 2 / Math.max(0.05, s.z));
    g.add(out);
  }
  g.position.set(...pos);
  g.userData.mesh = m;
  return g;
}
const box = (w, h, d, c, p, o) => piece(new THREE.BoxGeometry(w, h, d), c, p, o);
const cyl = (r1, r2, h, c, p, o) => piece(new THREE.CylinderGeometry(r1, r2, h, 10), c, p, o);
const ball = (r, c, p, o) => piece(new THREE.SphereGeometry(r, 14, 10), c, p, o);
const cone = (r, h, c, p, o) => piece(new THREE.ConeGeometry(r, h, 10), c, p, o);

function canvasTex(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  t.anisotropy = 4;
  return t;
}
function makeCanvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }

// ---------- герой ----------
// look: shirt (цвет), hat, sx/sy, noGun; weapon: pistol | rifle | shotgun | fists
export function makeHero(look = {}, weapon = 'pistol', opacity) {
  const o = opacity !== undefined ? { opacity } : {};
  const shirt = new THREE.Color(look.shirt || '#b3302c');
  const skin = 0xefe6d4, pants = 0x1d1917, dark = 0x0f0c0b, hair = 0x0d0a08;
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const hips = new THREE.Group(); hips.position.y = 0.92; body.add(hips);
  hips.add(box(0.36, 0.2, 0.24, pants, [0, 0, 0], o));
  const legs = [-1, 1].map(side => {
    const thigh = new THREE.Group(); thigh.position.set(side * 0.1, -0.06, 0); hips.add(thigh);
    thigh.add(cyl(0.085, 0.075, 0.46, pants, [0, -0.23, 0], o));
    const knee = new THREE.Group(); knee.position.y = -0.46; thigh.add(knee);
    knee.add(cyl(0.072, 0.06, 0.42, pants, [0, -0.21, 0], o));
    knee.add(box(0.12, 0.09, 0.28, dark, [0, -0.44, -0.06], o));
    return { thigh, knee };
  });
  const spine = new THREE.Group(); spine.position.y = 0.08; hips.add(spine);
  spine.add(box(0.44, 0.56, 0.26, shirt, [0, 0.3, 0], o));
  spine.add(box(0.46, 0.07, 0.28, dark, [0, 0.04, 0], o));
  // складки рубашки на спине
  for (const x of [-0.1, 0.1]) spine.add(box(0.015, 0.4, 0.01, 0x5a1412, [x, 0.32, 0.135], { noOutline: true, ...o }));
  const neck = new THREE.Group(); neck.position.y = 0.6; spine.add(neck);
  neck.add(cyl(0.06, 0.065, 0.12, skin, [0, 0.03, 0], o));
  const head = new THREE.Group(); head.position.y = 0.1; neck.add(head);
  head.add(box(0.24, 0.32, 0.27, skin, [0, 0.16, -0.01], o));
  head.add(box(0.27, 0.13, 0.31, hair, [0, 0.32, 0.01], o));             // волосы сверху
  head.add(box(0.27, 0.24, 0.07, hair, [0, 0.22, 0.14], o));              // затылок
  head.add(box(0.03, 0.08, 0.06, skin, [-0.135, 0.15, 0.02], o));         // уши
  head.add(box(0.03, 0.08, 0.06, skin, [0.135, 0.15, 0.02], o));
  const nose = cone(0.035, 0.12, skin, [0, 0.14, -0.18], o); nose.rotation.x = -Math.PI / 2; head.add(nose);
  head.add(box(0.06, 0.02, 0.01, INK, [0.06, 0.2, -0.145], { noOutline: true }));   // брови
  head.add(box(0.06, 0.02, 0.01, INK, [-0.06, 0.2, -0.145], { noOutline: true }));
  addHat(head, look.hat, o);
  const arms = [-1, 1].map(side => {
    const sh = new THREE.Group(); sh.position.set(side * 0.29, 0.52, 0); spine.add(sh);
    sh.add(cyl(0.075, 0.065, 0.32, shirt, [0, -0.16, 0], o));
    const el = new THREE.Group(); el.position.y = -0.32; sh.add(el);
    el.add(cyl(0.055, 0.05, 0.28, dark, [0, -0.14, 0], o));
    const hand = ball(weapon === 'fists' ? 0.1 : 0.06, skin, [0, -0.31, 0], o); el.add(hand);
    return { sh, el };
  });
  // оружие в правой руке
  if (weapon !== 'fists' && !look.noGun) {
    const gun = new THREE.Group(); gun.position.set(0, -0.33, -0.04); arms[1].el.add(gun);
    if (weapon === 'rifle') { gun.add(box(0.05, 0.07, 1.0, 0x3a3633, [0, 0, -0.35], o)); gun.add(box(0.06, 0.11, 0.32, 0x5a3d27, [0, -0.02, 0.1], o)); }
    else if (weapon === 'shotgun') { gun.add(box(0.07, 0.07, 0.55, 0x3a3633, [0, 0, -0.2], o)); gun.add(box(0.07, 0.12, 0.2, 0x5a3d27, [0, -0.03, 0.12], o)); }
    else { gun.add(box(0.05, 0.08, 0.24, 0x4a4440, [0, 0, -0.08], o)); gun.add(box(0.05, 0.12, 0.06, 0x6b4a2e, [0, -0.07, 0.02], o)); }
  }
  root.scale.set(look.sx || 1, look.sy || 1, look.sx || 1);
  return { root, body, hips, spine, neck, head, legs, arms };
}

function addHat(head, hat, o) {
  if (!hat || hat === 'none') return;
  const g = new THREE.Group(); g.position.y = 0.36; head.add(g);
  if (hat === 'tophat') {
    g.add(cyl(0.22, 0.22, 0.03, 0x16121a, [0, 0.02, 0], o));
    g.add(cyl(0.14, 0.14, 0.32, 0x1d1a20, [0, 0.18, 0], o));
    g.add(cyl(0.145, 0.145, 0.05, 0x7a2f35, [0, 0.07, 0], { noOutline: true, ...o }));
  } else if (hat === 'tricorn') {
    const c = cone(0.26, 0.16, 0x2c2118, [0, 0.08, 0], o); c.scale.set(1, 1, 1); g.add(c);
  } else if (hat === 'plague') {
    g.add(cyl(0.24, 0.24, 0.03, INK, [0, 0.02, 0], o));
    g.add(cyl(0.13, 0.15, 0.18, 0x2a2622, [0, 0.12, 0], o));
    const beak = cone(0.06, 0.32, 0xcdbf9f, [0, -0.24, -0.3], o); beak.rotation.x = -Math.PI / 2 - 0.3; g.add(beak);
  }
}

// Позы героя. s — состояние: { mode, t, run, y, slide, kickT }
function poseHero(h, s) {
  const { legs, arms } = h;
  for (const part of [h.body, h.hips, h.spine, h.neck, h.head, ...legs.flatMap(l => [l.thigh, l.knee]), ...arms.flatMap(a => [a.sh, a.el])]) part.rotation.set(0, 0, 0);
  h.hips.position.y = 0.92; h.body.position.set(0, 0, 0);
  const t = s.t;
  if (s.mode === 'run') {
    const ph = s.run * 2.5, sn = Math.sin(ph);
    legs[0].thigh.rotation.x = sn * 0.9; legs[1].thigh.rotation.x = -sn * 0.9;
    legs[0].knee.rotation.x = -0.25 - Math.max(0, -sn) * 1.3; legs[1].knee.rotation.x = -0.25 - Math.max(0, sn) * 1.3;
    arms[0].sh.rotation.x = -sn * 0.8; arms[0].el.rotation.x = 0.9;
    arms[1].sh.rotation.x = 0.55 + sn * 0.25; arms[1].el.rotation.x = 0.7;
    h.spine.rotation.x = -0.18;
    h.hips.position.y = 0.92 + Math.abs(Math.cos(ph)) * 0.06;
  } else if (s.mode === 'jump') {
    legs[0].thigh.rotation.x = 1.1; legs[0].knee.rotation.x = -1.5;
    legs[1].thigh.rotation.x = -0.3; legs[1].knee.rotation.x = -0.9;
    arms[0].sh.rotation.x = 2.5; arms[0].sh.rotation.z = -0.3; arms[1].sh.rotation.x = 1.6; arms[1].el.rotation.x = 0.3;
    h.spine.rotation.x = -0.1;
  } else if (s.mode === 'slide') {
    // настоящий подкат: откидывается назад, ноги вперёд
    h.body.rotation.x = 1.15; h.body.position.z = -0.25;
    h.hips.position.y = 0.38;
    legs[0].thigh.rotation.x = 0.55; legs[0].knee.rotation.x = -0.15;
    legs[1].thigh.rotation.x = 0.35; legs[1].knee.rotation.x = -0.5;
    arms[0].sh.rotation.z = -0.9; arms[0].sh.rotation.x = -0.4;
    arms[1].sh.rotation.x = 2.0; arms[1].el.rotation.x = 0.4;
    h.neck.rotation.x = -0.7;
  } else if (s.mode === 'warmup') {
    // разминка: потягивания с наклонами и подъём коленей
    const c = (t % 6) / 6;
    if (c < 0.5) {
      const k = Math.sin(c * 2 * Math.PI);
      arms[0].sh.rotation.z = -2.8 * Math.abs(k) - 0.1; arms[1].sh.rotation.z = 2.8 * Math.abs(k) + 0.1;
      h.spine.rotation.z = Math.sin(t * 2.2) * 0.22 * Math.abs(k);
    } else {
      const k = Math.sin(t * 5);
      legs[0].thigh.rotation.x = Math.max(0, k) * 1.4; legs[0].knee.rotation.x = -Math.max(0, k) * 1.6;
      legs[1].thigh.rotation.x = Math.max(0, -k) * 1.4; legs[1].knee.rotation.x = -Math.max(0, -k) * 1.6;
      arms[0].sh.rotation.x = Math.max(0, -k) * 1.2; arms[1].sh.rotation.x = Math.max(0, k) * 1.2;
      arms[0].el.rotation.x = 1.4; arms[1].el.rotation.x = 1.4;
      h.hips.position.y = 0.92 + Math.abs(k) * 0.05;
    }
  } else if (s.mode === 'lean') {
    // опёрся на меню: правая рука лежит на нём, корпус наклонён, нога за ногу
    h.body.rotation.z = -0.1;
    arms[1].sh.rotation.z = 1.25; arms[1].el.rotation.z = 0.35; arms[1].el.rotation.x = 0.2;
    arms[0].sh.rotation.x = 0.1; arms[0].sh.rotation.z = -0.15; arms[0].el.rotation.x = 0.9;
    legs[0].thigh.rotation.z = 0.2; legs[0].thigh.rotation.x = 0.05;
    legs[1].thigh.rotation.z = -0.05;
    h.spine.rotation.z = 0.12 + Math.sin(t * 1.4) * 0.015;
    h.neck.rotation.y = -0.25 + Math.sin(t * 0.5) * 0.12; h.neck.rotation.z = 0.08;
  } else if (s.mode === 'frozen') {
    arms[1].sh.rotation.x = 0.6; arms[0].sh.rotation.z = -0.2;
  } else {
    arms[0].sh.rotation.z = -0.1; arms[1].sh.rotation.z = 0.1;
    h.spine.rotation.x = Math.sin(t * 1.5) * 0.02;
  }
}

// ---------- враги ----------
function makeDemon(skull = 0xe6dcc8, scale = 1) {
  const g = new THREE.Group();
  const black = 0x0e0b0b;
  const bodyG = new THREE.Group(); g.add(bodyG);
  const b = ball(0.5, black, [0, 1.05, 0]); b.scale.set(1, 1.3, 0.85); bodyG.add(b);
  const sk = ball(0.2, skull, [-0.05, 1.3, 0.34]); sk.scale.set(1, 1.15, 0.9); bodyG.add(sk);
  for (const x of [-0.08, 0.06]) bodyG.add(ball(0.05, INK, [x - 0.05, 1.34, 0.5], { noOutline: true }));
  for (let i = 0; i < 3; i++) bodyG.add(box(0.025, 0.08, 0.02, skull, [-0.1 + i * 0.05, 1.1, 0.48], { noOutline: true }));
  const armsG = [-1, 1].map(side => {
    const a = new THREE.Group(); a.position.set(side * 0.42, 1.45, 0); bodyG.add(a);
    a.add(cyl(0.09, 0.07, 0.75, black, [0, 0.37, 0]));
    for (let k = -1; k <= 1; k++) { const c = cone(0.03, 0.2, black, [k * 0.07, 0.82, 0.04]); c.rotation.z = -k * 0.4; a.add(c); }
    a.rotation.z = -side * 0.35;
    return a;
  });
  const legsG = [-1, 1].map(side => {
    const l = new THREE.Group(); l.position.set(side * 0.2, 0.5, 0); g.add(l);
    l.add(cyl(0.08, 0.07, 0.5, black, [0, -0.25, 0]));
    return l;
  });
  g.scale.setScalar(scale);
  return { g, anim: (o, t) => {
    bodyG.position.y = Math.abs(Math.sin(t * 6 + o.id)) * 0.06;
    armsG.forEach((a, i) => { a.rotation.x = Math.sin(t * 5 + i * 1.7) * 0.35; });
    legsG.forEach((l, i) => { l.rotation.x = Math.sin(t * 6 + i * Math.PI) * 0.4; });
    if (o.flash > 0) bodyG.scale.setScalar(1.08); else bodyG.scale.setScalar(1);
  } };
}

function makeCrow() {
  const g = new THREE.Group();
  const b = ball(0.18, 0x1d1719, [0, 0, 0]); b.scale.set(1, 0.8, 1.6); g.add(b);
  g.add(ball(0.12, 0x1d1719, [0, 0.06, 0.28]));
  const beak = cone(0.05, 0.2, 0xc9a24a, [0, 0.04, 0.45]); beak.rotation.x = Math.PI / 2; g.add(beak);
  g.add(ball(0.03, 0xf4ead2, [0.07, 0.1, 0.36], { noOutline: true }));
  const wings = [-1, 1].map(side => { const w = new THREE.Group(); w.position.x = side * 0.12; g.add(w); w.add(box(0.55, 0.02, 0.3, 0x2a2225, [side * 0.28, 0, 0])); return w; });
  const tail = box(0.18, 0.02, 0.22, 0x1d1719, [0, 0.02, -0.32]); g.add(tail);
  return { g, wings };
}

// Плоский рисунок из enemies.js — в текстуру (для мебели, доспехов, портретов).
function enemyCanvas(type, extra = {}) {
  const d = ENEMY[type], w = d.w || 150, h = d.h || 200;
  return makeCanvas(w + 20, h + 30, (x) => {
    const o = { id: 3, type, x: 0, w, h, dead: 0, hp: d.hp || 0, flash: 0, rise: 1, fall: 1, open: 1, hop: 0, y: GROUND_Y - 150, ...extra };
    x.translate(10, -(GROUND_Y - h - 20));
    try { d.draw?.(x, o, 0, { t: 1, drawPips() {}, puff() {} }, 1, () => art.makeRng(3)); } catch (e) { /* не страшно */ }
  });
}

// обрезать прозрачные поля холста
function trimCanvas(c) {
  const x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data;
  let l = c.width, r = 0, t = c.height, b = 0;
  for (let y = 0; y < c.height; y++) for (let i = 0; i < c.width; i++) if (d[(y * c.width + i) * 4 + 3] > 20) { if (i < l) l = i; if (i > r) r = i; if (y < t) t = y; if (y > b) b = y; }
  if (r <= l || b <= t) return c;
  return makeCanvas(r - l + 1, b - t + 1, (o) => o.drawImage(c, -l, -t));
}

function texturedBox(canvas, w, h, d, side = 0x3a2a1e) {
  const t = canvasTex(canvas);
  const sideM = mat(side), front = new THREE.MeshLambertMaterial({ map: t, transparent: true, alphaTest: 0.3 });
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, h * 0.94, d), [sideM, sideM, sideM, sideM, front, sideM]);
  m.position.y = h / 2; g.add(m);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), front);
  plane.position.set(0, h / 2, d / 2 + 0.005); g.add(plane);
  return g;
}

function billboard(canvas, w, h) {
  const t = canvasTex(canvas);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: t, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide }));
  m.position.y = h / 2;
  const g = new THREE.Group(); g.add(m);
  return g;
}

// Живой рисунок врага: тот же рисунок, что во 2D-режиме (рисунки автора и enemies.js),
// перерисовывается до 30 раз в секунду на холст и стоит в коридоре объёмной «картонкой».
const PX = 1 / 125;            // метров в пикселе 2D-сцены (пол — 490, потолок — 0)
const DRAWN = new Set(['monster', 'hopper', 'brute', 'puppet', 'shielded', 'ghost', 'flyer', 'lowcrow', 'swoop', 'flock', 'spider',
  'portrait', 'rats', 'hands', 'chandelier', 'skullroll', 'spikes', 'candelabrum']);
function makeDrawn(type) {
  const d = ENEMY[type], w = d.w || 150;
  const pad = 70, top = type === 'spider' || type === 'portrait' || type === 'swoop' ? 0 : Math.max(0, GROUND_Y - (d.h || 200) - 200);
  const c = document.createElement('canvas'); c.width = w + pad * 2; c.height = GROUND_Y + 16 - top;
  const x = c.getContext('2d');
  const g = liveCutout(c, PX);
  g.children.forEach(m => { m.position.y += (top === 0 ? 0 : 0) - 16 * PX; });
  const fake = { t: 0, shake: 0, drawPips() {}, puff() {}, hx: 0 };
  let last = -1;
  const draw = (o, t) => {
    const f = Math.floor(t * (o.z - Z_HERO < 24 ? 30 : 8));   // вблизи — 30 кадров в секунду, вдали реже
    if (f === last) return;
    last = f;
    x.clearRect(0, 0, c.width, c.height);
    x.save(); x.translate(pad, -top);
    fake.t = t;
    const oo = { ...o, x: 0, dead: 0, rise: type === 'hands' ? clamp((Z_HERO + 9 - o.z) / 4, 0.05, 1) : o.rise,
      y: type === 'swoop' ? lerp(GROUND_Y - 170, 90, clamp((o.z - Z_HERO - 3) / 14, 0, 1)) : o.y };
    try { d.draw?.(x, oo, 0, fake, t, (s) => art.makeRng(s)); } catch (e) { /* рисунок не удался — пропустим кадр */ }
    x.restore();
    g.userData.tex.needsUpdate = true;
  };
  return { g, anim: (o, t) => draw(o, t), face: true };
}

const furnitureCache = {};
function makeEnemy(type, images, look) {
  const d = ENEMY[type];
  let g = new THREE.Group(), anim = null;
  const add = (x) => (g.add(x), x);
  if (DRAWN.has(type) && d.draw) return makeDrawn(type);
  switch (type) {
    case 'monster': return makeDemon();
    case 'hopper': { const m = makeDemon(0xa8c890, 0.65); return { g: m.g, anim: (o, t) => { m.anim(o, t); m.g.position.y += o.hop / 120; } }; }
    case 'brute': return makeDemon(0xd07060, 1.35);
    case 'puppet': {
      const m = makeDemon(0xd9c0a0, 0.75);
      for (const x of [-0.3, 0, 0.3]) m.g.add(cyl(0.004, 0.004, 4, 0xd9cfbd, [x / 0.75, 3.5, 0], { noOutline: true }));
      return { g: m.g, anim: (o, t) => { m.anim(o, t); m.g.position.y += Math.abs(Math.sin(t * 3.2 + o.id)) * 0.5; } };
    }
    case 'shielded': {
      const m = makeDemon();
      const sh = add(box(0.75, 1.2, 0.1, 0x5a3e2a, [0, 0.9, 0.6]));
      sh.add(box(0.08, 1.0, 0.02, 0xc9a24a, [0, 0, 0.06], { noOutline: true })); sh.add(box(0.6, 0.08, 0.02, 0xc9a24a, [0, 0.15, 0.06], { noOutline: true }));
      m.g.add(sh);
      return m;
    }
    case 'mirror': {
      const cut = new Hero3D({ shirt: '#7d8794' }, 'pistol');
      if (cut) {
        cut.root.rotation.y = Math.PI;   // бежит навстречу
        const st = {};
        const gg = new THREE.Group(); gg.add(cut.root);
        return { g: gg, anim: (o, t) => cut.pose('run', t + o.id * 0.1, { state: st, tau: 0.09 }) };
      }
      const h = makeHero({ shirt: '#9aa2aa' }, 'pistol', 0.75);
      h.root.rotation.y = Math.PI;
      return { g: h.root, anim: (o, t) => poseHero(h, { mode: 'run', t, run: t * 3.5 }) };
    }
    case 'ghost': {
      const c = add(piece(new THREE.CapsuleGeometry(0.42, 1.1, 6, 12), 0xe6e6f0, [0, 1.3, 0], { opacity: 0.5, noOutline: true }));
      for (const x of [-0.14, 0.14]) add(ball(0.07, INK, [x, 1.7, 0.36], { noOutline: true }));
      add(ball(0.1, INK, [0, 1.42, 0.38], { noOutline: true }));
      anim = (o, t) => { g.position.y += Math.sin(t * 3 + o.id) * 0.1; c.rotation.y = Math.sin(t) * 0.2; };
      break;
    }
    case 'flyer': case 'lowcrow': case 'swoop': {
      const c = makeCrow(); g.add(c.g); c.g.rotation.y = Math.PI;
      c.g.position.y = type === 'lowcrow' ? 0.3 : 1.2;
      anim = (o, t) => {
        c.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(t * 18 + o.id) * 0.7; });
        if (type === 'swoop') c.g.position.y = lerp(1.2, 3.0, clamp((o.z - Z_HERO - 3) / 14, 0, 1));
      };
      break;
    }
    case 'flock': {
      const cs = [0, 1, 2].map(i => { const c = makeCrow(); c.g.rotation.y = Math.PI; c.g.position.set((i - 1) * 0.42, 1.2 + (i % 2) * 0.15, i * 0.3); g.add(c.g); return c; });
      anim = (o, t) => cs.forEach((c, i) => c.wings.forEach((w, j) => { w.rotation.z = (j ? -1 : 1) * Math.sin(t * 18 + i) * 0.7; }));
      break;
    }
    case 'spider': {
      add(cyl(0.005, 0.005, CEIL - 1.3, 0xbbbbbb, [0, 1.3 + (CEIL - 1.3) / 2, 0], { noOutline: true }));
      const b = add(ball(0.2, 0x141110, [0, 1.25, 0])); add(ball(0.14, 0x141110, [0, 1.05, 0]));
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const l = add(cyl(0.015, 0.015, 0.45, 0x000000, [s * 0.25, 1.2 - i * 0.04, -0.15 + i * 0.1])); l.rotation.z = s * (0.9 + i * 0.1); }
      for (let i = 0; i < 4; i++) add(ball(0.025, 0xc2242a, [-0.06 + i * 0.04, 1.3, 0.18], { noOutline: true }));
      anim = (o, t) => { g.position.y += Math.sin(t * 4 + o.id) * 0.05; b.rotation.y = t; };
      break;
    }
    case 'portrait': {
      const c = makeCanvas(160, 130, (x) => {
        x.fillStyle = '#6a4a32'; x.fillRect(0, 0, 160, 130); x.fillStyle = '#8f8a82'; x.fillRect(12, 12, 136, 106);
        x.fillStyle = '#2a2622'; x.beginPath(); x.ellipse(80, 58, 22, 26, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(80, 112, 44, 26, 0, 0, 7); x.fill();
        x.fillStyle = '#f4ecd6'; x.beginPath(); x.arc(72, 56, 3, 0, 7); x.arc(88, 56, 3, 0, 7); x.fill();
      });
      const pv = new THREE.Group(); pv.position.y = CEIL; g.add(pv);
      const p = texturedBox(c, 1.0, 0.8, 0.08, 0x4a3424); p.position.y = -CEIL + 0.95; pv.add(p);
      for (const x of [-0.4, 0.4]) pv.add(cyl(0.01, 0.01, CEIL - 1.75, 0x2a2622, [x, -(CEIL - 1.75) / 2, 0], { noOutline: true }));
      anim = (o, t) => { pv.rotation.z = Math.sin(t * 2.5 + o.id) * 0.18; };
      break;
    }
    case 'beam': {
      const r = add(piece(new THREE.CylinderGeometry(0.07, 0.07, LANE * 1.05, 12), 0xff5544, [0, 1.25, 0], { basic: true, noOutline: true }));
      r.rotation.z = Math.PI / 2;
      const glow = add(piece(new THREE.CylinderGeometry(0.2, 0.2, LANE * 1.05, 12), 0xff3322, [0, 1.25, 0], { basic: true, opacity: 0.3, noOutline: true }));
      glow.rotation.z = Math.PI / 2;
      add(ball(0.16, 0xe9e4da, [LANE * 0.55, 1.25, 0])); add(ball(0.08, 0xb3302c, [LANE * 0.55 - 0.1, 1.25, 0.06], { noOutline: true }));
      anim = (o, t) => { glow.userData.mesh.material.opacity = 0.25 + Math.sin(t * 20) * 0.1; };
      break;
    }
    case 'tentacle': {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(LANE * 0.6, 0, 0.2), new THREE.Vector3(LANE * 0.5, 0.9, 0), new THREE.Vector3(0, 1.3, 0.1), new THREE.Vector3(-LANE * 0.55, 1.15, 0)]);
      const tb = add(piece(new THREE.TubeGeometry(curve, 24, 0.12, 8), 0x2a1f2a, [0, 0, 0]));
      anim = (o, t) => { tb.rotation.z = Math.sin(t * 3 + o.id) * 0.08; tb.position.y = Math.sin(t * 2.4) * 0.06; };
      break;
    }
    case 'pit': case 'trapdoor': {
      const len = 1.8, w = LANE * 0.96;
      const hole = new THREE.Mesh(new THREE.PlaneGeometry(w, len), new THREE.MeshBasicMaterial({ color: 0x030202 }));
      hole.rotation.x = -Math.PI / 2; hole.position.set(0, 0.012, -len / 2); g.add(hole);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) add(cone(0.07, 0.28, 0x6d655e, [-w / 3 + i * w / 3, 0.14, -0.35 - j * 0.55], { noOutline: true }));
      add(box(w, 0.04, 0.06, 0x5d5047, [0, 0.02, 0]));
      add(box(w, 0.04, 0.06, 0x5d5047, [0, 0.02, -len]));
      if (type === 'trapdoor') {
        const lid = new THREE.Group(); lid.position.set(-w / 2, 0.02, -len / 2); g.add(lid);
        lid.add(box(0.06, w * 0.95, len * 0.95, 0x5a4434, [0, w * 0.47, 0]));
        anim = (o) => { lid.rotation.z = -Math.PI / 2 + (o.z - Z_HERO < 9 ? 0 : 1) * (Math.PI / 2); };
      }
      break;
    }
    case 'ink': {
      const p = new THREE.Mesh(new THREE.CircleGeometry(0.62, 24), new THREE.MeshBasicMaterial({ color: 0x120c1a }));
      p.rotation.x = -Math.PI / 2; p.position.set(0, 0.013, -0.6); p.scale.y = 1.4; g.add(p);
      for (let i = 0; i < 3; i++) add(ball(0.06, 0x120c1a, [(i - 1) * 0.3, 0.1, -0.6], { noOutline: true }));
      break;
    }
    case 'rats': {
      const rats = [0, 1, 2, 3].map(i => { const r = ball(0.12, 0x1a1614, [(i - 1.5) * 0.28, 0.1, (i % 2) * 0.2]); r.scale.set(0.8, 0.7, 1.5); g.add(r); return r; });
      anim = (o, t) => rats.forEach((r, i) => { r.position.y = 0.1 + Math.abs(Math.sin(t * 14 + i)) * 0.05; });
      break;
    }
    case 'hands': {
      const hs = [-1, 0, 1].map(i => { const a = new THREE.Group(); a.position.x = i * 0.32; g.add(a); a.add(cyl(0.06, 0.07, 0.55, 0x000000, [0, 0.27, 0])); for (let k = -1; k <= 1; k++) { const c = cone(0.025, 0.14, 0x000000, [k * 0.05, 0.6, 0]); c.rotation.z = -k * 0.4; a.add(c); } return a; });
      anim = (o, t) => hs.forEach((a, i) => { a.scale.y = clamp((Z_HERO + 9 - o.z) / 4, 0.05, 1); a.rotation.z = Math.sin(t * 6 + i * 2) * 0.15; });
      break;
    }
    case 'chandelier': {
      const r = add(piece(new THREE.TorusGeometry(0.5, 0.06, 6, 20), 0x6b5a32, [0, 0.08, 0])); r.rotation.x = Math.PI / 2 - 0.2;
      for (let i = 0; i < 3; i++) { const c = add(cyl(0.035, 0.035, 0.22, 0xefe4cc, [Math.cos(i * 2) * 0.4, 0.14, Math.sin(i * 2) * 0.4])); c.rotation.z = 1.2 + i; }
      add(ball(0.06, 0xf2c14e, [0.2, 0.12, 0.1], { emissive: 0x996600, noOutline: true }));
      break;
    }
    case 'skullroll': {
      const s = add(ball(0.3, 0xe6dcc8, [0, 0.3, 0]));
      for (const x of [-0.1, 0.1]) s.add(ball(0.07, INK, [x, 0.04, 0.25], { noOutline: true }));
      anim = (o, t) => { s.rotation.x = -t * 9; };
      break;
    }
    case 'spikes': {
      const sp = [];
      for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) sp.push(add(cone(0.07, 0.45, 0x8a8d92, [(i - 2) * 0.24, 0.22, -j * 0.3])));
      anim = (o) => { const k = clamp((Z_HERO + 8 - o.z) / 3, 0.15, 1); sp.forEach(s => { s.scale.y = k; s.position.y = 0.22 * k; }); };
      break;
    }
    case 'candelabrum': {
      add(cyl(0.03, 0.05, 0.45, 0x3a2f22, [0, 0.22, 0])); add(box(0.6, 0.04, 0.04, 0x3a2f22, [0, 0.42, 0]));
      const flames = [-0.28, 0, 0.28].map(x => { add(cyl(0.03, 0.03, 0.12, 0xefe4cc, [x, 0.5, 0], { noOutline: true })); return add(cone(0.05, 0.16, 0xf2a33a, [x, 0.64, 0], { basic: true, noOutline: true })); });
      anim = (o, t) => flames.forEach((f, i) => { f.scale.y = 1 + Math.sin(t * 13 + i) * 0.25; });
      break;
    }
    case 'gate': {
      for (let i = 0; i < 4; i++) add(piece(new THREE.CylinderGeometry(0.04, 0.04, CEIL, 8), 0x2a2238, [(i - 1.5) * LANE * 0.3, CEIL / 2, 0], { opacity: 0.75, noOutline: true }));
      for (const y of [1, 2.4]) add(piece(new THREE.BoxGeometry(LANE, 0.06, 0.06), 0x2a2238, [0, y, 0], { opacity: 0.75, noOutline: true }));
      add(piece(new THREE.PlaneGeometry(LANE, CEIL), 0x8f80d0, [0, CEIL / 2, 0], { basic: true, opacity: 0.15, noOutline: true }));
      break;
    }
    case 'fogwall': {
      const f = add(piece(new THREE.BoxGeometry(LANE, CEIL, 0.8), 0xd8d8e4, [0, CEIL / 2, 0], { basic: true, opacity: 0.55, noOutline: true }));
      anim = (o, t) => { f.userData.mesh.material.opacity = 0.5 + Math.sin(t * 2 + o.id) * 0.1; };
      break;
    }
    case 'furniture': case 'wardrobe': case 'clock': {
      const key = type;
      const c = furnitureCache[key] ||= (type === 'furniture' && images.furniture ? images.furniture : trimCanvas(enemyCanvas(type)));
      const h = type === 'clock' ? 2.6 : 2.4;
      g.add(cutoutMesh(c, h / c.height, type === 'clock' ? 0.5 : 0.6));
      break;
    }
    case 'armor': {
      const c = furnitureCache.armor ||= trimCanvas(enemyCanvas('armor'));
      g.add(cutoutMesh(c, 2.4 / c.height, 0.45));
      break;
    }
    default: {
      const m = makeDemon(); return m;
    }
  }
  return { g, anim };
}

// Портрет Флита в раме (для смерти и для стен).
export function portraitCanvas(look, label = 'Ф. ВЕЙН') {
  return makeCanvas(256, 340, (x) => {
    const cx = 128, cy = 150, rx = 100, ry = 130;
    x.save(); x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, 7); x.clip();
    const g = x.createRadialGradient(cx, cy - 20, 10, cx, cy, ry); g.addColorStop(0, '#6a5a48'); g.addColorStop(1, '#2a2119');
    x.fillStyle = g; x.fillRect(0, 0, 256, 340);
    if (rigReady()) {
      const c = makeCanvas(256, 340, (y) => { y.translate(130, 400); y.scale(2.3, 2.3); drawRigHero(y, 0, 0, 'idle', 0, look); });
      x.drawImage(recolor(c, { gray: 1, mul: [1.05, 0.9, 0.7] }), 0, 0);
    }
    const v = x.createRadialGradient(cx, cy, ry * 0.4, cx, cy, ry); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(20,14,10,0.65)');
    x.fillStyle = v; x.fillRect(0, 0, 256, 340);
    x.restore();
    x.lineWidth = 22; x.strokeStyle = '#16120f'; x.beginPath(); x.ellipse(cx, cy, rx + 6, ry + 6, 0, 0, 7); x.stroke();
    x.lineWidth = 14; x.strokeStyle = '#7a5a36'; x.stroke();
    x.lineWidth = 3; x.strokeStyle = '#c9a24a'; x.beginPath(); x.ellipse(cx, cy, rx + 1, ry + 1, 0, 0, 7); x.stroke();
    x.fillStyle = '#c9a24a'; x.strokeStyle = '#16120f'; x.lineWidth = 3;
    x.beginPath(); x.roundRect(48, 296, 160, 36, 6); x.fill(); x.stroke();
    x.fillStyle = '#16120f'; x.font = 'bold 30px "Amatic SC", serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(label, cx, 315);
  });
}

const RUN_YAW = 0;   // бежит спиной к игроку
const RUN_SCALE = 0.62;  // Флит в забеге — небольшой, как в конце смерти
// камера в забеге высоко: фигуры откидываются к ней (как в Don't Starve), чтобы рисунок не сплющивался
const lean = (cam, x, y, z) => -Math.atan2(cam.y - y, Math.max(0.5, cam.z - z)) * 0.85;   // верх фигуры откинут от камеры: её плоскость смотрит вверх, на камеру
const h0 = (w) => (w.hero?.root.scale.y || 1);   // Флит-вырезка повёрнут к камере боком, чтобы был виден рисунок

// текстура знака на полу: зелёные стрелки вверх (прыжок) или голубые вниз (подкат)
const signCache = {};
function signTex(kind) {
  // одна крупная стрелка и черта: прыжок — стрелка над чертой (перепрыгнуть), подкат — стрелка под чертой (пролезть снизу)
  return signCache[kind] ||= canvasTex(makeCanvas(160, 256, (x) => {
    const up = kind === 'low', col = up ? '#9cf07a' : '#6fd0ff';
    x.lineJoin = 'round'; x.lineWidth = 14; x.strokeStyle = '#0d0907'; x.fillStyle = col;
    const bar = (y) => { x.beginPath(); x.roundRect(14, y, 132, 26, 10); x.stroke(); x.fill(); };
    x.beginPath();
    if (up) { bar(206); x.moveTo(80, 14); x.lineTo(150, 100); x.lineTo(108, 100); x.lineTo(108, 180); x.lineTo(52, 180); x.lineTo(52, 100); x.lineTo(10, 100); }
    else { bar(18); x.moveTo(80, 242); x.lineTo(150, 156); x.lineTo(108, 156); x.lineTo(108, 70); x.lineTo(52, 70); x.lineTo(52, 156); x.lineTo(10, 156); }
    x.closePath(); x.stroke(); x.fill();
  }));
}

// Высокое препятствие читается по форме: две стойки и латунная перекладина с бахромой над дорожкой —
// под ней проскальзывают подкатом. Низкие лежат на полу — их перепрыгивают.
const HIGH_BAR = new Set(['flyer', 'spider', 'portrait', 'flock']);
function makeHighBar() {
  const g = new THREE.Group(), w = LANE * 0.92, h = 0.78;   // чуть ниже летучих, но выше подката
  for (const s of [-1, 1]) g.add(cyl(0.045, 0.06, h + 0.55, 0x3a2a1e, [s * w / 2, (h + 0.55) / 2, 0]));
  const bar = cyl(0.05, 0.05, w, 0xc9a24a, [0, h, 0], { outline: 0.02 }); bar.rotation.z = Math.PI / 2; g.add(bar);
  // бахрома снизу — чтобы перекладину было видно издалека
  for (let i = 0; i < 9; i++) g.add(box(0.07, 0.12, 0.03, i % 2 ? 0x8a2a2a : 0xd8c8a0, [-w / 2 + 0.1 + i * (w - 0.2) / 8, h - 0.1, 0], { noOutline: true }));
  return { g };
}

// бонусы, кроме магнита: перья, пара оболов, саван
function makePickup(kind) {
  if (kind === 'magnet') return makeMagnetHand();
  const g = new THREE.Group(), r = new THREE.Group(); g.add(r);
  const glowC = { wings: 0x9fb7ff, double: 0xffd27a, cloak: 0xd8e0ff }[kind];
  if (kind === 'wings') {
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      const f = piece(new THREE.ConeGeometry(0.06, 0.55 - i * 0.08, 6), 0x15121a, [s * (0.1 + i * 0.07), 0.05 + i * 0.04, 0]);
      f.rotation.z = s * (0.9 + i * 0.25); r.add(f);
    }
  } else if (kind === 'double') {
    for (const x of [-0.13, 0.13]) { const c = piece(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 20), 0xd6a93c, [x, 0, x * 0.3], { emissive: 0x3a2400 }); c.rotation.x = Math.PI / 2; r.add(c); }
  } else if (kind === 'cloak') {
    const c = piece(new THREE.ConeGeometry(0.32, 0.8, 14, 1, true), 0xeef0ff, [0, 0, 0], { opacity: 0.75 }); r.add(c);
    r.add(ball(0.16, 0xeef0ff, [0, 0.4, 0], { opacity: 0.8 }));
    for (const x of [-0.06, 0.06]) r.add(ball(0.025, 0x111111, [x, 0.42, 0.14], { noOutline: true }));
  }
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), new THREE.MeshBasicMaterial({ color: glowC, transparent: true, opacity: 0.22, depthWrite: false }));
  r.add(glow);
  return { g };
}

// рука из пола держит подкову-магнит
function makeMagnetHand() {
  const g = new THREE.Group(), r = new THREE.Group(); g.add(r);
  const red = 0xc0282c, steel = 0xd8d8de, skin = 0xefe6d4;
  const arc = piece(new THREE.TorusGeometry(0.2, 0.065, 10, 20, Math.PI), red, [0, 0.12, 0]); arc.rotation.z = Math.PI; r.add(arc);
  for (const x of [-0.2, 0.2]) { r.add(cyl(0.066, 0.066, 0.16, red, [x, 0.2, 0])); r.add(cyl(0.067, 0.067, 0.07, steel, [x, 0.31, 0])); }
  r.add(ball(0.11, skin, [0, -0.12, 0]));
  for (let i = 0; i < 4; i++) { const f = cyl(0.026, 0.024, 0.13, skin, [-0.075 + i * 0.05, -0.04, 0.07]); f.rotation.x = -0.6; r.add(f); }
  r.add(cyl(0.06, 0.07, 0.6, skin, [0, -0.45, 0]));
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), new THREE.MeshBasicMaterial({ color: 0xff6a5a, transparent: true, opacity: 0.2, depthWrite: false }));
  r.add(glow);
  return { g };
}

// лестница (в дорожке S.lane) и галерея на высоте второго этажа; z = 0 — начало лестницы
function makeGallery(S) {
  const g = new THREE.Group(); g.userData.fade = [];
  const ramp = S.b - S.a, deck = S.c - S.b, H = FLOOR2, x = S.lane * LANE;
  const wood = 0x5a3f2a, dark = 0x2e2018;
  // ступени
  const n = 14;
  for (let i = 0; i < n; i++) {
    const y = H * (i + 1) / n, z = -ramp * (i + 0.5) / n;
    g.add(box(LANE * 0.92, y, ramp / n + 0.02, i % 2 ? wood : 0x654631, [x, y / 2, z], { outline: 0.01 }));
  }
  for (const s of [-1, 1]) {
    const rail = box(0.06, 0.06, Math.hypot(ramp, H), dark, [x + s * LANE * 0.47, H / 2 + 0.9, -ramp / 2], { noOutline: true });
    rail.rotation.x = Math.atan2(H, ramp); g.add(rail);
  }
  // пол галереи во всю ширину коридора, полупрозрачный, пока Флит внизу
  const planks = canvasTex(makeCanvas(128, 256, (c) => {
    c.fillStyle = '#6a4a33'; c.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? '#5e412c' : '#714f37'; c.fillRect(i * 32, 0, 32, 256); c.fillStyle = 'rgba(20,12,8,0.7)'; c.fillRect(i * 32, 0, 2, 256); }
  }), [1, deck / 3]);
  const top = new THREE.Mesh(new THREE.BoxGeometry(WALL * 2 - 0.1, 0.22, deck), new THREE.MeshLambertMaterial({ map: planks, transparent: true, opacity: 1 }));
  top.position.set(0, H - 0.11, -ramp - deck / 2); g.add(top); g.userData.fade.push(top);
  // край в конце галереи и балки-опоры у стен
  g.add(box(WALL * 2 - 0.1, 0.3, 0.12, dark, [0, H - 0.15, -ramp - deck], { noOutline: true }));
  for (let z = 0; z <= deck; z += 8) for (const s of [-1, 1]) g.add(box(0.18, H, 0.18, dark, [s * (WALL - 0.2), H / 2, -ramp - z], { noOutline: true }));
  // перила вдоль стен
  for (const s of [-1, 1]) g.add(box(0.05, 0.05, deck, dark, [s * (WALL - 0.15), H + 0.85, -ramp - deck / 2], { noOutline: true }));
  return g;
}

// ---------- мир ----------
export class World3D {
  constructor(canvas, images) {
    this.canvas = canvas;
    this.images = images;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0807);
    this.scene.fog = new THREE.Fog(0x0b0807, 16, 52);
    this.camera = new THREE.PerspectiveCamera(68, 1, 0.1, 140);
    this.scene.add(new THREE.HemisphereLight(0xfff0d8, 0x30241a, 1.6));
    const sun = new THREE.DirectionalLight(0xffe2b8, 1.1); sun.position.set(1, 6, 4); this.scene.add(sun);
    this.lamp = new THREE.PointLight(0xffc880, 6, 9, 1.6); this.scene.add(this.lamp);
    this.mode = 'title'; this.modeT = 0; this.dist = 0; this.t = 0;
    this.meshes = new Map();
    this.buildCorridor();
    this.camPos = new THREE.Vector3(0, 1.3, 3); this.camLook = new THREE.Vector3(0, 1.1, 0);
    this.heroKey = '';
    this.resize();
  }

  // ---- коридор: пол, ковёр, стены с обоями автора, потолок, арки с бра ----
  buildCorridor() {
    const sc = this.scene;
    const planks = makeCanvas(256, 256, (x) => {
      x.fillStyle = '#6f6253'; x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#665a4c' : '#76695a'; x.fillRect(i * 64, 0, 64, 256); x.fillStyle = 'rgba(20,14,10,0.6)'; x.fillRect(i * 64, 0, 3, 256); x.fillRect(i * 64, (i * 97) % 256, 64, 3); }
      for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(30,20,12,${Math.random() * 0.12})`; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 14); }
    });
    this.floorTex = canvasTex(planks, [WALL * 2 / 1.3, LEN / 1.3]);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(WALL * 2, LEN), new THREE.MeshLambertMaterial({ map: this.floorTex }));
    floor.rotation.x = -Math.PI / 2; floor.position.z = -LEN / 2 + 16; sc.add(floor);
    const rug = makeCanvas(128, 256, (x) => {
      x.fillStyle = '#6a2a28'; x.fillRect(0, 0, 128, 256);
      x.fillStyle = '#c9a24a'; x.fillRect(6, 0, 4, 256); x.fillRect(118, 0, 4, 256);
      x.fillStyle = 'rgba(30,8,8,0.45)'; for (let y = 0; y < 256; y += 32) { x.beginPath(); x.moveTo(64, y); x.lineTo(84, y + 16); x.lineTo(64, y + 32); x.lineTo(44, y + 16); x.fill(); }
    });
    this.rugTex = canvasTex(rug, [1, LEN / 2.5]);
    const rugM = new THREE.Mesh(new THREE.PlaneGeometry(LANE * 3.15, LEN), new THREE.MeshLambertMaterial({ map: this.rugTex }));
    rugM.rotation.x = -Math.PI / 2; rugM.position.set(0, 0.006, -LEN / 2 + 16); sc.add(rugM);
    // стены: рисунок автора wall.png, повторяется вдоль коридора
    const wallImg = this.images.wall;
    const wtex = wallImg ? new THREE.Texture(wallImg) : canvasTex(makeCanvas(256, 128, (x) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#cbbd9f' : '#e4d8c0'; x.fillRect(i * 32, 0, 32, 128); } }));
    wtex.colorSpace = THREE.SRGBColorSpace; wtex.wrapS = THREE.MirroredRepeatWrapping; wtex.wrapT = THREE.ClampToEdgeWrapping;
    const tile = PAPER * (wallImg ? wallImg.width / wallImg.height : 2);
    this.wallTile = tile;
    this.walls = [];
    for (const side of [-1, 1]) {
      // нижняя часть — обои автора, верхняя — те же обои, но в тени (свет бра туда не достаёт)
      for (const [y0, h, tone] of [[0, PAPER, 1], [PAPER, CEIL - PAPER, 0.42]]) {
        const t = wtex.clone(); t.needsUpdate = true; t.repeat.set(LEN / tile, h / PAPER);
        if (y0) { t.wrapT = THREE.MirroredRepeatWrapping; }
        const m = new THREE.Mesh(new THREE.PlaneGeometry(LEN, h), new THREE.MeshLambertMaterial({ map: t }));
        m.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        m.position.set(side * WALL, y0 + h / 2, -LEN / 2 + 16);
        m.userData.tone = tone;
        m.material.color.setScalar(tone);
        sc.add(m);
        this.walls.push({ m, t, side, tone });
      }
      // карниз между обоями и верхом стены
      sc.add(box(0.12, 0.16, LEN, 0x3a2a1e, [side * (WALL - 0.06), PAPER, -LEN / 2 + 16], { noOutline: true }));
    }
    // потолок: тёмные доски с кессонами
    const ceilTex = canvasTex(makeCanvas(256, 256, (x) => {
      x.fillStyle = '#3a2a20'; x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#342519' : '#40301f'; x.fillRect(0, i * 32, 256, 32); x.fillStyle = 'rgba(10,6,4,0.6)'; x.fillRect(0, i * 32, 256, 2); }
      x.strokeStyle = '#1c130d'; x.lineWidth = 10; x.strokeRect(5, 5, 246, 246);
      for (let i = 0; i < 200; i++) { x.fillStyle = `rgba(15,8,4,${Math.random() * 0.15})`; x.fillRect(Math.random() * 256, Math.random() * 256, 18, 2); }
    }), [1, LEN / (WALL * 2)]);
    this.ceilTex = ceilTex;
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(WALL * 2, LEN), new THREE.MeshLambertMaterial({ map: ceilTex, emissive: 0x1a120b }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, CEIL, -LEN / 2 + 16); sc.add(ceil);
    // арки и бра каждые 8 м
    this.arches = [];
    for (let i = 0; i < 15; i++) {
      const a = new THREE.Group();
      a.add(box(0.28, CEIL, 0.32, 0x241a14, [-WALL + 0.14, CEIL / 2, 0]));
      a.add(box(0.28, CEIL, 0.32, 0x241a14, [WALL - 0.14, CEIL / 2, 0]));
      a.userData.beam = a.add(box(WALL * 2, 0.34, 0.34, 0x241a14, [0, CEIL - 0.17, 0])) && a.children[a.children.length - 1];
      for (const s of [-1, 1]) {
        a.add(box(0.08, 0.3, 0.08, 0x5a4a3a, [s * (WALL - 0.08), 2.05, -1.6], { noOutline: true }));
        a.add(ball(0.07, 0xffd27a, [s * (WALL - 0.12), 2.28, -1.6], { basic: true, noOutline: true }));
        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.18, depthWrite: false }));
        glow.position.set(s * (WALL - 0.12), 2.28, -1.6); a.add(glow);
      }
      // люстра на цепи под потолком (у самой камеры прячется, чтобы не лезть в экран)
      const ch = new THREE.Group(); a.add(ch); a.userData.ch = ch;
      ch.add(cyl(0.012, 0.012, 0.6, 0x1a1410, [0, CEIL - 0.3, -4], { noOutline: true }));
      const ring = piece(new THREE.TorusGeometry(0.42, 0.04, 6, 18), 0x5a4426, [0, CEIL - 0.65, -4]); ring.rotation.x = Math.PI / 2; ch.add(ring);
      for (let k = 0; k < 5; k++) {
        const an = k / 5 * Math.PI * 2, cx = Math.cos(an) * 0.42, cz = -4 + Math.sin(an) * 0.42;
        ch.add(cyl(0.025, 0.025, 0.12, 0xefe4cc, [cx, CEIL - 0.57, cz], { noOutline: true }));
        ch.add(ball(0.04, 0xffd27a, [cx, CEIL - 0.48, cz], { basic: true, noOutline: true }));
      }
      const cg = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.1, depthWrite: false }));
      cg.position.set(0, CEIL - 0.5, -4); ch.add(cg);
      sc.add(a);
      this.arches.push(a);
    }
    // стена с выходом в конце комнаты
    this.exitCanvas = makeCanvas(672, 490, () => {});
    this.exitTex = canvasTex(this.exitCanvas);
    this.exitWall = new THREE.Group();
    const door = new THREE.Mesh(new THREE.PlaneGeometry(WALL * 2, PAPER), new THREE.MeshLambertMaterial({ map: this.exitTex }));
    door.position.y = PAPER / 2; this.exitWall.add(door);
    const upper = new THREE.Mesh(new THREE.PlaneGeometry(WALL * 2, CEIL - PAPER), new THREE.MeshLambertMaterial({ color: 0x5a4c3c }));
    upper.position.y = PAPER + (CEIL - PAPER) / 2; this.exitWall.add(upper);
    this.exitWall.add(box(WALL * 2, 0.16, 0.12, 0x3a2a1e, [0, PAPER, 0.06], { noOutline: true }));
    this.exitWall.visible = false; sc.add(this.exitWall);
  }

  setTint(t) {
    const c = t?.mul ? new THREE.Color(t.mul[0], t.mul[1], t.mul[2]) : new THREE.Color(1, 1, 1);
    if (t?.gray) c.lerp(new THREE.Color(0.85, 0.85, 0.85), t.gray * 0.4);
    for (const w of this.walls) w.m.material.color = c.clone().multiplyScalar(w.tone);
  }

  drawExitCanvas(kind, open, label) {
    const x = this.exitCanvas.getContext('2d');
    x.clearRect(0, 0, 672, 490);
    for (let i = 0; i < 14; i++) { x.fillStyle = i % 2 ? '#cbbd9f' : '#e4d8c0'; x.fillRect(i * 48, 0, 48, 490); }
    x.fillStyle = 'rgba(30,22,15,0.35)'; x.fillRect(0, 0, 672, 490);
    art.drawExit(x, kind, 336, open, label, this.t, this.images.furniture);
    this.exitTex.needsUpdate = true;
  }

  setHero(look, weapon) {
    const key = JSON.stringify([look, weapon]);
    if (key === this.heroKey) return;
    this.heroKey = key;
    if (this.hero) this.scene.remove(this.hero.root);
    // Флит из деталей автора (объёмные вырезки), если рисунки загрузились; иначе — простая модель
    // полноценная 3D-модель; движение — по рисункам бега из rig.js
    let cut = null;
    try { cut = new Hero3D(look, weapon); } catch (e) { console.warn('3D-модель героя', e); }
    if (cut) {
      const root = new THREE.Group(); root.add(cut.root);
      this.hero = { root, cut, st: {} };
    } else this.hero = makeHero(look, weapon);
    this.look = look;
    this.scene.add(this.hero.root);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setMode(mode) {
    this.mode = mode; this.modeT = 0;
    if (mode !== 'run') { this.clearRun(); this.dist = 0; this.setTint(null); }
  }

  // герой уходит из меню в глубину коридора
  leaveTitle(done) { this.mode = 'leave'; this.modeT = 0; this.onLeft = done; }

  startRun(game) {
    this.clearRun();
    this.mode = 'run'; this.modeT = 0;
    this.game = game;
    this.setTint(game.level.palette?.wallTint);
    // старые портреты Флита на стенах (из прошлых смертей)
    this.portraits = [];
    const dr = game.opts.deathRooms || [];
    if (dr.length && Math.random() < 0.35) {
      const n = Math.random() < 0.3 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const m = this.portraitMesh(`Ф. ВЕЙН · к. ${dr[Math.floor(Math.random() * dr.length)]}`);
        const side = Math.random() < 0.5 ? -1 : 1;
        m.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        m.userData.at = 40 + Math.random() * Math.max(40, (Number.isFinite(game.finish) ? game.finish : 400) - 60);
        m.userData.side = side;
        this.scene.add(m); this.portraits.push(m);
      }
    }
    this.deathPortrait = null; this.deathZ = undefined;
    this.clearDeathFx();
  }

  portraitMesh(label) {
    const tex = canvasTex(portraitCanvas(this.look || {}, label));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.2), new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.2 }));
    return m;
  }

  clearRun() {
    for (const [, v] of this.meshes) this.scene.remove(v.g);
    this.meshes.clear();
    for (const p of this.portraits || []) this.scene.remove(p);
    this.portraits = [];
    if (this.deathPortrait) { this.scene.remove(this.deathPortrait); this.deathPortrait = null; }
    this.clearDeathFx();
    this.exitWall.visible = false;
    this.game = null;
  }

  // Проекция точки мира в координаты сцены 720×SH (для подсказок поверх 3D).
  toStage(x, y, z, L, rect) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    const sx = (v.x * 0.5 + 0.5) * window.innerWidth, sy = (-v.y * 0.5 + 0.5) * window.innerHeight;
    return { x: (sx - rect.left) * L.SW / rect.width, y: (sy - rect.top) * L.SH / rect.height, front: v.z < 1 };
  }

  frame(dt) {
    this.t += dt; this.modeT += dt;
    const h = this.hero; if (!h) return;
    const t = this.t;
    let camPos, camLook;
    if (this.mode === 'title' || this.mode === 'leave') {
      this.dist += dt * 0.3;
      const k = this.mode === 'leave' ? ease(this.modeT / 0.9) : 0;
      h.root.visible = true;
      h.root.position.set(lerp(0.38, 0, k), 0, lerp(0, -5, k));
      h.root.scale.set(this.look?.sx || 1, this.look?.sy || 1, this.look?.sx || 1);
      h.root.rotation.y = h.cut ? lerp(Math.PI / 2 + 0.55, -0.15, ease(this.modeT / 0.3) * (this.mode === 'leave' ? 1 : 0))
        : lerp(Math.PI - 0.35, 0, ease(this.modeT / 0.25) * (this.mode === 'leave' ? 1 : 0));
      if (this.mode === 'leave') { this.poseH(h, { mode: 'run', t, run: this.modeT * 4 }); if (this.modeT > 0.95 && this.onLeft) { const f = this.onLeft; this.onLeft = null; f(); } }
      else this.poseH(h, { mode: 'lean', t });
      camPos = [0, 1.15, 2.6]; camLook = [0.12, 1.05, 0];
    } else if (this.mode === 'lobby') {
      this.dist += dt * 0.3;
      h.root.position.set(-0.75, 0, 0);
      h.root.visible = true; h.root.scale.set(this.look?.sx || 1, this.look?.sy || 1, this.look?.sx || 1);
      h.root.rotation.y = h.cut ? -Math.PI / 2 - 0.55 : Math.PI - 0.55;
      this.poseH(h, { mode: 'warmup', t });
      camPos = [0.2, 1.5, 4.6]; camLook = [0.1, 1.05, -1.5];
    } else if (this.mode === 'run' && this.game) {
      const g = this.game;
      this.dist = g.dist;
      const hx = g.hx * LANE;
      const dying = g.status === 'dying' || (g.status === 'over' && g.deathT !== undefined);
      const intro = ease(this.modeT / 0.6);
      if (!dying) {
        h.root.visible = !(g.p.invuln > 0 && g.cloakT <= 0 && Math.floor(t * 16) % 2 === 0 && g.status === 'running') && !(g.cloakT > 0 && g.cloakT < 1.5 && Math.floor(t * 10) % 2 === 0);
        h.root.position.set(lerp(-0.75, hx, intro), g.base + g.y, 0);
        h.root.rotation.set(0, h.cut ? lerp(-Math.PI / 2 - 0.55, RUN_YAW, intro) : lerp(Math.PI - 0.55, 0, intro), h.cut ? 0 : (g.lane - g.hx) * 0.25);
        const rs = lerp(1, RUN_SCALE, intro);
        h.root.scale.set(rs * (this.look?.sx || 1), rs * (this.look?.sy || 1), rs * (this.look?.sx || 1));
        if (g.status === 'won') { h.root.position.z = -ease(g.enter) * 3; h.root.visible = g.enter < 0.85; }
        const mode = g.p.slideT > 0 ? 'slide' : g.y > 0.05 ? 'jump' : 'run';
        this.poseH(h, { mode, t, run: g.p.run, vy: g.vy, kick: g.p.kickT, land: (g.p.landT || 0) / 0.2, steer: g.lane - g.hx });
        // камера выше и дальше: враги видны поверх головы Флита
        camPos = [hx * 0.8, 2.35 + g.base * 0.95, 4.4]; camLook = [hx * 0.7, 1.0 + g.base, -12];   // камера низко за спиной: видно, что над полом, а что под потолком   // на галерее камера чуть выше, но под потолком   // Флит ≈ десятая часть высоты экрана, внизу   // Флит ≈ десятая часть высоты экрана
      } else {
        // «стал портретом»: поднимается к левой стене, вокруг возникает рама, портрет остаётся на стене
        // портрет вешается посередине между арками, чтобы колонна его не закрывала
        if (this.deathZ === undefined) { const base = this.dist % 8; let best = -3.5, bd = 99; for (let i = 0; i < 4; i++) { const m = 8 + base - (i + 1) * 8 - 4; if (Math.abs(m + 3.5) < bd) { bd = Math.abs(m + 3.5); best = m; } } this.deathZ = best; }
        const T = g.deathT || 0, P = new THREE.Vector3(-WALL + 0.04, 1.9, this.deathZ);
        // смерть: чёрные руки хватают Флита и тащат к стене → чёрный туман → «пшик» → «вшик» — портрет на стене
        const k = ease((T - 0.15) / 1.0);                 // камера поворачивает к стене
        const drag = ease((T - 0.55) / 0.85);              // руки тащат к стене
        this.poseH(h, { mode: 'frozen', t });
        const shake = T > 0.3 && T < 1.5 ? Math.sin(t * 40) * 0.03 : 0;
        h.root.position.set(lerp(hx, P.x + 0.45, drag) + shake, lerp(0, P.y - 0.95, drag), lerp(0, P.z, drag));
        h.root.rotation.set(lerp(0, -0.25, ease(T / 0.3)) * (1 - drag), h.cut ? lerp(RUN_YAW, 0, drag) : lerp(0, Math.PI / 2, drag), Math.sin(t * 9) * 0.06 * (T < 1.5 ? 1 : 0));
        const s = RUN_SCALE * (T > 1.45 ? Math.max(0.01, 1 - (T - 1.45) / 0.15) : 1);
        h.root.scale.set(s * (this.look?.sx || 1), s * (this.look?.sy || 1), s * (this.look?.sx || 1));
        h.root.visible = T < 1.6;
        this.deathFx(T, t, h.root.position, P, hx);
        if (!this.deathPortrait && T > 1.65) {
          this.deathPortrait = this.portraitMesh('Ф. ВЕЙН');
          this.deathPortrait.position.copy(P); this.deathPortrait.rotation.y = Math.PI / 2;
          this.scene.add(this.deathPortrait);
        }
        if (this.deathPortrait) {
          // «вшик»: портрет влетает с вращением и встаёт на место
          const q = ease((T - 1.65) / 0.4);
          this.deathPortrait.scale.set(q, q, 1);
          this.deathPortrait.rotation.set(0, Math.PI / 2, (1 - q) * Math.PI * 2.2);
          this.deathPortrait.position.set(P.x + (1 - q) * 0.6, P.y, P.z);
        }
        camPos = [lerp(hx * 0.8, 0.9, k), lerp(2.35, 1.95, k), lerp(4.4, P.z + 3.4, k)]; camLook = [lerp(hx * 0.7, P.x, k), lerp(1.0, P.y, k), lerp(-12, P.z, k)];
      }
      this.syncRun(g, t);
    } else {
      camPos = [0, 1.5, 4]; camLook = [0, 1, -2];
    }
    // камера плавно догоняет цель
    const sp = Math.min(1, dt * (this.mode === 'run' ? 6 : 3));
    this.camPos.lerp(new THREE.Vector3(...camPos), this.modeT < 0.05 && this.mode !== 'run' ? 1 : sp);
    this.camLook.lerp(new THREE.Vector3(...camLook), this.modeT < 0.05 && this.mode !== 'run' ? 1 : sp);
    this.camera.position.copy(this.camPos);
    // динамика: тряска, крен при смене дорожки, шире обзор на скорости
    const g = this.mode === 'run' ? this.game : null;
    let fov = 68, roll = 0;
    if (g && g.status === 'running') {
      const sh = (g.shake || 0) * 0.012;
      this.camera.position.x += (Math.random() - 0.5) * sh; this.camera.position.y += (Math.random() - 0.5) * sh;
      fov = 62 + clamp((g.speed - 9) * 1.0, 0, 12) + ((g.p.dashT || 0) > 0 ? 7 : 0);
      roll = (g.lane - g.hx) * 0.05;
      this.camera.position.y += Math.abs(Math.sin(g.p.run * 1.7)) * 0.03;
    }
    this.camFov = lerp(this.camFov || 68, fov, Math.min(1, dt * 4));
    if (Math.abs(this.camera.fov - this.camFov) > 0.05) { this.camera.fov = this.camFov; this.camera.updateProjectionMatrix(); }
    this.camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    this.camera.lookAt(this.camLook);
    this.speedLines(dt, g);
    this.lamp.position.set(this.camPos.x * 0.5, 2.6, -1.5);
    // коридор едет навстречу
    const d = this.dist;
    this.floorTex.offset.y = d / 1.3;
    this.rugTex.offset.y = d / 2.5;
    this.ceilTex.offset.y = -d / (WALL * 2);
    for (const w of this.walls) w.t.offset.x = (w.side < 0 ? 1 : -1) * d / this.wallTile;
    const base = d % 8;
    // в забеге камера выше потолка: верхние балки арок закрывали бы вид, их прячем
    this.arches.forEach((a, i) => { a.position.z = 16 + base - (i + 1) * 8; if (a.userData.beam) a.userData.beam.visible = this.camPos.y < CEIL - 0.5; if (a.userData.ch) a.userData.ch.visible = a.position.z - 4 < this.camPos.z - 4; });
    for (const p of this.portraits || []) {
      const z = -(p.userData.at - d);
      p.position.set(p.userData.side * (WALL - 0.03), 1.9, z);
      p.visible = z < 14 && z > -60;
    }
    this.renderer.render(this.scene, this.camera);
  }

  // знаки на ковре перед препятствием: ▲ — прыгай, ▼ — подкат; под летучими — тень на полу
  floorSign(o, t, put) {
    const k = o.kind;
    if (o.dead || (k !== 'low' && k !== 'high')) return;
    const z = -(o.z - Z_HERO);
    // стрелки на ковре — только если включены в настройках («Знаки»), тень под летучими — всегда
    if (this.game?.opts.floorSigns) put('s' + o.id, () => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(LANE * 0.78, 2.0), new THREE.MeshBasicMaterial({ map: signTex(k), transparent: true, depthWrite: false, opacity: 1 }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.02;
      const g = new THREE.Group(); g.add(m); return { g };
    }, o.lane * LANE, 0, z + 3.0, (v) => { v.g.children[0].material.opacity = 0.85 + Math.sin(t * 8) * 0.15; });
    if (k === 'high' && !FLAT.has(o.type)) put('h' + o.id, () => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.015; m.scale.y = 0.55;
      const g = new THREE.Group(); g.add(m); return { g };
    }, o.lane * LANE, 0, z);
  }

  // лестница в одной дорожке и галерея второго этажа во всю ширину коридора
  syncGallery(g, t) {
    const S = g.stairs;
    if (!S) { if (this.gallery) this.gallery.visible = false; return; }
    if (!this.gallery || this.galleryFor !== S) {
      if (this.gallery) this.scene.remove(this.gallery);
      this.gallery = makeGallery(S);
      this.galleryFor = S;
      this.scene.add(this.gallery);
    }
    this.gallery.visible = true;
    this.gallery.position.z = -(S.a - g.dist);
    // пока Флит внизу, пол галереи полупрозрачный — видно, что под ней
    const below = g.base < 0.3;
    for (const m of this.gallery.userData.fade) { m.material.opacity = lerp(m.material.opacity, below ? 0.32 : 1, 0.15); m.material.depthWrite = !below; }
  }

  // полосы скорости вдоль стен и потолка
  speedLines(dt, g) {
    if (!this.lines) {
      this.lines = [];
      const m = new THREE.MeshBasicMaterial({ color: 0xfff0d0, transparent: true, opacity: 0, depthWrite: false });
      for (let i = 0; i < 26; i++) {
        const l = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 2.2), m.clone());
        l.userData.reset = (far) => {
          const side = Math.random() < 0.5 ? -1 : 1, up = Math.random() < 0.3;
          l.position.set(up ? (Math.random() - 0.5) * WALL * 1.6 : side * (WALL - 0.3 - Math.random() * 0.6), up ? CEIL - 0.6 - Math.random() * 1.5 : 0.4 + Math.random() * 4, far ? -30 - Math.random() * 20 : -Math.random() * 50);
        };
        l.userData.reset(false);
        this.scene.add(l); this.lines.push(l);
      }
    }
    const on = g && g.status === 'running' ? clamp((g.speed - 10) / 5, 0, 1) * 0.55 + ((g.p.dashT || 0) > 0 ? 0.4 : 0) : 0;
    for (const l of this.lines) {
      l.material.opacity = lerp(l.material.opacity, on, Math.min(1, dt * 3));
      l.visible = l.material.opacity > 0.02;
      if (!l.visible) continue;
      l.position.z += (g.speed * 2.2) * dt;
      if (l.position.z > 8) l.userData.reset(true);
    }
  }

  // ---- эффекты смерти: руки, туман, пшик ----
  deathFx(T, t, hp, P, hx) {
    const fx = this.dfx ||= this.makeDeathFx();
    fx.g.visible = true;
    // звуки по моментам
    const at = (key, when, f) => { if (T >= when && !fx.done[key]) { fx.done[key] = 1; f(); } };
    at('grab', 0.3, () => sfx.grab?.());
    at('puff', 1.5, () => sfx.puff?.());
    at('whoosh', 1.65, () => sfx.whoosh?.());
    // чернильная лужа под ногами, из неё лезут руки
    fx.pool.position.set(hx, 0.015, 0);
    const pk = clamp(T / 0.3, 0, 1) * (T > 1.6 ? clamp(1 - (T - 1.6) / 0.4, 0, 1) : 1);
    fx.pool.scale.set(pk * 1.1, pk * 0.8, 1);
    const reach = ease((T - 0.15) / 0.35);
    const retract = T > 1.5 ? ease((T - 1.5) / 0.35) : 0;
    fx.hands.forEach((hd, i) => {
      // откуда растёт рука: пол у ног или стена; куда тянется: точка на теле Флита
      const from = hd.wall ? new THREE.Vector3(-WALL + 0.02, hd.a[1], P.z + hd.a[2]) : new THREE.Vector3(hx + hd.a[0], 0, hd.a[2]);
      const grab = new THREE.Vector3(hp.x + hd.b[0], hp.y + hd.b[1] * h0(this), hp.z + hd.b[2]);
      // руки из пола отпускают, когда Флита тащат к стене; дальше держат руки из стены
      const r = reach * (1 - (hd.wall ? retract : Math.max(retract, ease((T - 0.7) / 0.3))));
      const tip = from.clone().lerp(grab, r);
      const wob = Math.sin(t * 7 + i * 2) * 0.08;
      const mid1 = from.clone().lerp(tip, 0.35).add(new THREE.Vector3(hd.wall ? 0.35 : wob, hd.wall ? wob : 0.35, wob));
      const mid2 = from.clone().lerp(tip, 0.7).add(new THREE.Vector3(wob, 0.15, -wob));
      const curve = new THREE.CatmullRomCurve3([from, mid1, mid2, tip]);
      hd.arm.geometry.dispose();
      hd.arm.geometry = new THREE.TubeGeometry(curve, 14, hd.w * (0.6 + 0.4 * r), 6);
      hd.arm.visible = r > 0.02;
      hd.palm.position.copy(tip);
      hd.palm.lookAt(grab.clone().add(tip.clone().sub(from).normalize()));
      hd.palm.visible = r > 0.05;
      const close = clamp((T - 0.45) / 0.15, 0, 1) * (1 - retract);   // пальцы сжимаются
      hd.fingers.forEach((f, j) => { f.rotation.x = -0.3 - close * 1.1 + Math.sin(t * 12 + j) * 0.1; });
    });
    // чёрный туман закручивается вокруг и на «пшик» разлетается
    const fog = clamp((T - 0.95) / 0.5, 0, 1);
    const burst = T > 1.5 ? ease((T - 1.5) / 0.7) : 0;
    fx.smoke.forEach((m, i) => {
      const ang = i * 2.39 + t * (1.5 + (i % 3) * 0.4);
      const rad = (0.55 - fog * 0.25) + burst * (0.9 + (i % 4) * 0.35);
      const y = hp.y + 0.2 + (i % 5) * 0.32 * (hp.y > 0.5 ? 0.7 : 1) + burst * 0.5 * Math.sin(i);
      m.position.set(hp.x + Math.cos(ang) * rad * 0.5, y, hp.z + Math.sin(ang) * rad);
      const sc = 0.5 + fog * 0.5 + burst * 1.2;
      m.scale.set(sc, sc, 1);
      m.material.opacity = fog * 0.85 * (1 - burst);
      m.visible = m.material.opacity > 0.01;
    });
    // вспышка «пшик»
    const fl = T > 1.48 && T < 1.75 ? 1 - Math.abs(T - 1.56) / 0.2 : 0;
    fx.flash.position.set(hp.x, hp.y + 0.9, hp.z);
    fx.flash.material.opacity = clamp(fl, 0, 1) * 0.9;
    fx.flash.scale.setScalar(0.6 + (T - 1.48) * 6);
    fx.flash.visible = fl > 0;
  }

  makeDeathFx() {
    const g = new THREE.Group(); this.scene.add(g);
    const ink = new THREE.MeshBasicMaterial({ color: 0x070505 });
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshBasicMaterial({ color: 0x050303 }));
    pool.rotation.x = -Math.PI / 2; g.add(pool);
    // руки: [откуда (x/y, z), куда на теле (x, y, z), толщина]
    const spec = [
      { a: [-0.35, 0, 0.25], b: [0.05, 0.25, 0.08], w: 0.07 },
      { a: [0.4, 0, -0.2], b: [-0.05, 0.45, -0.08], w: 0.07 },
      { a: [0.15, 0, 0.45], b: [0.0, 0.95, 0.1], w: 0.08 },
      { wall: true, a: [0, 1.2, -0.7], b: [0.0, 1.05, -0.1], w: 0.09 },
      { wall: true, a: [0, 2.6, 0.6], b: [0.0, 1.4, 0.05], w: 0.09 },
      { wall: true, a: [0, 0.6, 0.9], b: [0.05, 0.6, 0.1], w: 0.08 },
    ];
    const hands = spec.map(sp => {
      const arm = new THREE.Mesh(new THREE.BufferGeometry(), ink); g.add(arm);
      const palm = new THREE.Group(); g.add(palm);
      const pm = new THREE.Mesh(new THREE.SphereGeometry(sp.w * 1.6, 8, 6), ink); pm.scale.set(1, 0.6, 1.2); palm.add(pm);
      const fingers = [-1.5, -0.5, 0.5, 1.5].map(k => {
        const f = new THREE.Group(); f.position.set(k * sp.w * 0.8, 0, sp.w * 1.2); palm.add(f);
        const c = new THREE.Mesh(new THREE.ConeGeometry(sp.w * 0.32, sp.w * 3.2, 5), ink);
        c.rotation.x = Math.PI / 2; c.position.z = sp.w * 1.5; f.add(c);
        return f;
      });
      return { ...sp, arm, palm, fingers };
    });
    // клубы чёрного тумана
    const tex = canvasTex(makeCanvas(128, 128, (x) => {
      const gr = x.createRadialGradient(64, 64, 4, 64, 64, 62);
      gr.addColorStop(0, 'rgba(8,5,6,1)'); gr.addColorStop(0.55, 'rgba(14,9,12,0.75)'); gr.addColorStop(1, 'rgba(14,9,12,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 9; i++) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.arc(30 + Math.random() * 68, 30 + Math.random() * 68, 10 + Math.random() * 18, 0, 7); x.fill(); }
    }));
    const smoke = [];
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
      g.add(m); smoke.push(m);
    }
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0x2a1a2a, transparent: true, depthWrite: false, opacity: 0 }));
    g.add(flash);
    return { g, pool, hands, smoke, flash, done: {} };
  }

  clearDeathFx() {
    if (!this.dfx) return;
    this.dfx.g.visible = false;
    this.dfx.done = {};
  }

  // Поза героя: вырезки из рисунков берут позу из 2D-анимации (rig.js), простая модель — свою.
  poseH(h, s) {
    if (!h.cut) return poseHero(h, s);
    // переходы между действиями сглаживаются (tau), разминка — плавное смешивание стойки и маха ногой
    const ex = { state: h.st, tau: 0.05 };   // позы меняются почти сразу за жестом
    let pose = 'run', tt = s.t;
    switch (s.mode) {
      case 'run': tt = s.run !== undefined ? s.run / 3.6 : s.t; if (s.kick > 0) { pose = 'kick'; ex.kickT = 1 - s.kick / 0.4; ex.tau = 0.04; } break;
      case 'jump': pose = 'jump'; ex.vy = -(s.vy || 0) * 140; ex.tau = 0.03; break;
      case 'slide': pose = 'slide'; ex.tau = 0.03; break;
      case 'warmup': pose = 'idle'; ex.blend = { pose: 'kick', k: 0.5 - 0.5 * Math.cos(s.t * 2.4) }; ex.tau = 0.15; break;
      case 'lean': case 'frozen': pose = 'idle'; ex.tau = 0.2; break;
    }
    // приземление — присед; смена дорожки — корпус наклоняется и поворачивается в сторону шага
    if (s.land) ex.land = s.land;
    if (s.steer) { ex.roll = -s.steer * 0.35; ex.turn = -s.steer * 0.45; }
    if (pose === 'jump') ex.lean = (s.vy || 0) > 0 ? 0.08 : -0.12;
    h.cut.pose(pose, tt, ex);
    // дыхание в стойке
    h.cut.root.position.y = pose === 'idle' ? Math.sin(s.t * 2.2) * 0.008 : 0;
  }

  // Модели препятствий, оболов, находок, пуль — по состоянию забега.
  syncRun(g, t) {
    const seen = new Set();
    const put = (key, make, x, y, z, upd) => {
      let v = this.meshes.get(key);
      if (!v) { v = make(); this.scene.add(v.g); this.meshes.set(key, v); }
      v.g.position.set(x, y, z);
      upd?.(v);
      seen.add(key);
    };
    for (const o of g.objs) {
      const gone = g.deathT !== undefined ? clamp(1 - g.deathT * 2, 0, 1) : 1;   // при смерти всё растворяется
      if (gone > 0.5) this.floorSign(o, t, put);
      if (HIGH_BAR.has(o.type) && !o.dead) put('f' + o.id, () => makeHighBar(), o.lane * LANE, 0, -(o.z - Z_HERO), (v) => v.g.scale.setScalar(Math.max(0.01, gone)));
      put('o' + o.id, () => makeEnemy(o.type, this.images, this.look), o.lane * LANE, 0, -(o.z - Z_HERO), (v) => {
        v.anim?.(o, t);
        if (v.face) v.g.rotation.set(lean(this.camPos, 0, 1, v.g.position.z) * (g.deathT !== undefined ? 0 : 1), Math.atan2(this.camPos.x - v.g.position.x, this.camPos.z - v.g.position.z) * 0.8, 0);
        const k = (o.dead ? 1 - o.dead : 1) * gone;
        v.g.scale.setScalar(Math.max(0.01, k));
        v.g.visible = k > 0.02;
      });
    }
    for (const c of g.coinsArr) {
      put('c' + c.id, () => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 20), new THREE.MeshLambertMaterial({ color: 0xd6a93c, emissive: 0x3a2400 }));
        m.rotation.x = Math.PI / 2;
        const gg = new THREE.Group(); gg.add(m);
        return { g: gg };
      }, (c.lx ?? c.lane) * LANE, c.y, -(c.z - Z_HERO), (v) => { v.g.rotation.y = t * 4 + c.id; });
    }
    for (const r of g.relics) {
      const key = 'r' + (r.key ||= Math.random());
      put(key, () => {
        const gg = new THREE.Group();
        gg.add(piece(new THREE.TorusGeometry(0.22, 0.06, 8, 20), 0xc9a24a, [0, 0, 0], { emissive: 0x553300 }));
        gg.add(ball(0.13, 0xe8dcc4, [0, 0, 0], { noOutline: true }));
        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.25, depthWrite: false }));
        gg.add(glow);
        return { g: gg };
      }, r.lane * LANE, 1.0 + Math.sin(t * 3) * 0.1, -(r.z - Z_HERO), (v) => { v.g.rotation.y = t * 2; });
    }
    for (const b of g.bullets) {
      const key = 'b' + (b.key ||= Math.random());
      put(key, () => ({ g: ball(b.rifle ? 0.08 : 0.06, 0x2a2522, [0, 0, 0], { noOutline: true }) }), b.lane * LANE, 1.25, -(b.z - Z_HERO));
    }
    for (const m of g.magnets) {
      put('m' + m.id, () => makePickup(m.kind || 'magnet'), m.lane * LANE, 0, -(m.z - Z_HERO), (v) => { v.g.children[0].rotation.y = t * 2.5; v.g.children[0].position.y = 1.0 + Math.sin(t * 3) * 0.1; });
    }
    this.syncGallery(g, t);
    // тень-преследователь: после удара бежит за спиной Флита
    if (g.chase > 0 && g.status === 'running') {
      const k = Math.min(1, (7 - g.chase) / 0.6) * Math.min(1, g.chase / 0.8);
      const side = g.hx > 0.3 ? -1 : 1;   // сбоку и сзади, чтобы не закрывать Флита
      put('chaser', () => makeDrawn('monster'), g.hx * LANE + side * 1.0 + Math.sin(t * 3) * 0.15, 0, lerp(6, 2.2, k), (v) => {
        v.anim({ id: 7, flash: 0, w: 160, h: 300, hp: 0, rise: 1, fall: 1, open: 1, hop: 0, y: GROUND_Y - 150, z: 99 }, t * 1.6);
        v.g.rotation.set(lean(this.camPos, 0, 1, v.g.position.z) * 0.5, Math.PI * 0, 0);
        v.g.scale.setScalar(0.85);
      });
    }
    // хранитель в глубине
    if (g.boss && g.boss.dead < 1) {
      const B = g.boss;
      put('boss', () => makeDrawn('brute'), Math.sin(t * 0.8) * 0.8, 0, -(19 + (1 - B.enter) * 25 - Z_HERO), (v) => {
        v.anim({ id: 1, flash: B.flash, w: ENEMY.brute.w, h: ENEMY.brute.h, hp: 0, rise: 1, fall: 1, open: 1, hop: 0, y: GROUND_Y - 150, z: 99 }, t * 0.6);
        v.g.rotation.y = Math.atan2(this.camPos.x - v.g.position.x, this.camPos.z - v.g.position.z) * 0.8;
        v.g.scale.setScalar(1.8 * (1 - B.dead));
      });
    }
    for (const [k, v] of this.meshes) if (!seen.has(k)) { this.scene.remove(v.g); this.meshes.delete(k); }
    // стена с выходом
    if (Number.isFinite(g.finish)) {
      const zd = g.finish - g.dist + 3;
      const z = -zd;
      this.exitWall.visible = zd < 56 && zd > -2;
      if (this.exitWall.visible) {
        this.exitWall.position.set(0, 0, Math.min(z, -0.5));
        const open = clamp(1 - (zd - 2) / 10, 0, 1);
        if (this._exitDrawn !== `${g.level.exit}${Math.round(open * 20)}${Math.floor(this.t * 6)}`) {
          this._exitDrawn = `${g.level.exit}${Math.round(open * 20)}${Math.floor(this.t * 6)}`;
          this.drawExitCanvas(g.level.exit || 'door', open, g.level.doorLabel ?? 'ВЫХОД');
        }
      }
    } else this.exitWall.visible = false;
  }
}

// ---------- забег: логика из Game3D + интерфейс поверх 3D ----------
export class Run3D extends Game3D {
  constructor(level, skin, opts) {
    super(level, skin, opts);
    this.world = opts.world;
    this.blinkT = 3; this.look = 0; this.pulse = 0; this.lastLives = this.lives;
    this.grayHeart = opts.images?.heart ? recolor(opts.images.heart, { gray: 1, mul: [0.6, 0.6, 0.6] }) : null;
  }

  hitEye(x, y) { return this.L && Math.abs(x - this.L.SW / 2) < 110 && y < 175; }

  // Всё, что рисуется поверх 3D: сердца, Око, оболы, прогресс, подсказки, надписи.
  drawOverlay(ctx, L, t, dt, rect) {
    this.L = L;
    const I = this.opts.images || {}, W = L.SW, T = this.t;
    const font = (n) => `bold ${n}px "Amatic SC", serif`;
    const outlined = (text, x, y, fill = '#e8dcc4', lw = 7) => { ctx.lineWidth = lw; ctx.strokeStyle = '#120d0b'; ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y); };
    ctx.save();
    ctx.lineJoin = 'round';
    // затемнение сверху, чтобы панель читалась
    const tg = ctx.createLinearGradient(0, 0, 0, 300); tg.addColorStop(0, 'rgba(8,6,5,0.8)'); tg.addColorStop(0.7, 'rgba(8,6,5,0.35)'); tg.addColorStop(1, 'rgba(8,6,5,0)');
    ctx.fillStyle = tg; ctx.fillRect(0, 0, W, 300);
    // сердца
    if (this.lives < this.lastLives) this.pulse = 1;
    this.lastLives = this.lives; this.pulse = Math.max(0, this.pulse - dt * 3);
    for (let i = 0; i < this.maxLives; i++) {
      const full = i < this.lives, s = 52 * (i === this.lives ? 1 + this.pulse * 0.3 : 1);
      if (I.heart) ctx.drawImage(full ? I.heart : this.grayHeart, 26 + i * 58, 52 - s / 2 + 18, s, s * I.heart.height / I.heart.width);
    }
    // Око — пауза
    this.blinkT -= dt;
    let blink = 0;
    if (this.blinkT < 0.15) blink = Math.sin(Math.max(0, this.blinkT) / 0.15 * Math.PI);
    if (this.blinkT <= 0) this.blinkT = 2.5 + Math.random() * 4;
    if (this.p.hurtT > 0) blink = 0.7;
    if (I.eye) { const ew = 170, eh = I.eye.height * ew / I.eye.width; ctx.save(); ctx.translate(W / 2, 76); ctx.scale(1, Math.max(0.12, 1 - blink * 0.9)); ctx.drawImage(I.eye, -ew / 2, -eh / 2, ew, eh); ctx.restore(); }
    // оболы
    ctx.font = font(64); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    outlined(String(Math.min(999, this.coins)).padStart(3, '0'), W - 70, 72, '#f0d27c');
    ctx.fillStyle = '#d6a93c'; ctx.strokeStyle = '#120d0b'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(W - 40, 72, 18, 0, 7); ctx.fill(); ctx.stroke();
    // магнит
    {
      const act = [['🧲', this.magnetT, '#f2a0a0'], ['🪶', this.wingsT, '#b8c8ff'], ['🪙', this.doubleT, '#f0d27c'], ['👻', this.cloakT, '#e8ecff']].filter(x => x[1] > 0);
      ctx.font = font(38); ctx.textAlign = 'left';
      act.forEach(([ic, tm, col], i) => outlined(`${ic} ${Math.ceil(tm)}`, 22 + i * 92, 118, col));
    }
    // подсказка над лестницей
    if (this.stairs && this.base < 0.3 && rect) {
      const S = this.stairs, ahead = S.a - this.dist;
      if (ahead > 2 && ahead < 40) {
        const q = this.world.toStage(S.lane * LANE, FLOOR2 + 0.6, -(ahead), L, rect);
        if (q.front) { ctx.font = font(44); ctx.textAlign = 'center'; const tx = '↑ наверх', w = ctx.measureText(tx).width + 30, x = clamp(q.x, w / 2 + 10, W - w / 2 - 10), y = clamp(q.y, 230, L.SH * 0.6);
          ctx.fillStyle = 'rgba(240,210,124,0.95)'; ctx.strokeStyle = '#16120f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 30, w, 60, 12); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#16120f'; ctx.fillText(tx, x, y + 2); }
      }
    }
    // множитель серии
    if (this.mult > 1) { ctx.font = font(46); ctx.textAlign = 'right'; outlined(`×${this.mult}`, W - 30, 118, ['', '', '#e8dcc4', '#f0d27c', '#f2a33a', '#e0573c'][this.mult]); }
    // прогресс до выхода
    const pr = this.progress;
    ctx.font = font(32);
    if (pr !== null) {
      const x0 = 60, x1 = W - 60, y = 148;
      ctx.strokeStyle = 'rgba(232,220,196,0.5)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.strokeStyle = '#b3302c'; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + (x1 - x0) * pr, y); ctx.stroke();
      ctx.fillStyle = '#b3302c'; ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * pr, y, 9, 0, 7); ctx.fill();
      ctx.textAlign = 'right'; outlined(EXITS[this.level.exit]?.hud || 'выход', x1, y + 30, '#b9b5ae', 5);
      ctx.textAlign = 'left'; if (this.level.room) outlined(`комната ${this.level.room}`, x0, y + 30, '#b9b5ae', 5);
    } else if (this.boss && !this.boss.dead) {
      const B = this.boss, x0 = 90, x1 = W - 90, y = 150;
      ctx.fillStyle = 'rgba(22,18,15,0.85)'; ctx.fillRect(x0, y - 10, x1 - x0, 20);
      ctx.fillStyle = B.flash > 0 ? '#e8dcc4' : '#b3302c'; ctx.fillRect(x0 + 3, y - 7, (x1 - x0 - 6) * B.hp / B.max, 14);
      ctx.textAlign = 'center'; ctx.font = font(40); outlined(B.name, W / 2, y + 36);
    } else {
      ctx.textAlign = 'center'; outlined(`${this.meters} м · счёт ${this.score}`, W / 2, 150, '#b9b5ae', 5);
    }
    // все надписи — полосой под Оком, чтобы не закрывать дорожки
    let yb = 232;
    const strip = (text, size, fill, bg, border) => {
      ctx.font = font(size); ctx.textAlign = 'center';
      while (size > 26 && ctx.measureText(text).width > W - 60) { size -= 2; ctx.font = font(size); }
      const w = Math.min(W - 20, ctx.measureText(text).width + 34);
      ctx.fillStyle = bg; ctx.strokeStyle = border; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(W / 2 - w / 2, yb - 25, w, 50, 12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = fill; ctx.fillText(text, W / 2, yb + 2);
      yb += 58;
    };
    // название комнаты
    const Lv = this.level;
    if (Lv.name && T < 2.6) {
      ctx.globalAlpha = Math.min(1, T * 3, (2.6 - T) * 2);
      ctx.textAlign = 'center';
      ctx.font = font(56); outlined(`${Lv.name} · ${Lv.place}`, W / 2, yb, '#e8dcc4', 8);
      yb += 50;
      if (Lv.fresh?.length) { ctx.font = font(36); outlined('Новый враг: ' + Lv.fresh.join(', '), W / 2, yb, '#f2d27a', 6); yb += 46; }
      ctx.globalAlpha = 1;
      yb += 8;
    }
    // подсказка о ближайшем новом враге (что делать — показывает и знак на ковре)
    if (this.status === 'running' && this.base < 0.3) {
      const o = this.objs.filter(o => !o.dead && !o.hit && o.z > Z_HERO + 3 && o.z < 26 && (this.level.hintAll || this.opts.showHint?.(o.type))).sort((a, b) => a.z - b.z)[0];
      if (o) {
        const act = ENEMY[o.type]?.act;
        const lane = ['слева', 'по центру', 'справа'][o.lane + 1];
        const what = act === 'kick' && o.kind === 'block' ? '👢 пинок или другая дорожка' : act === 'dash' ? '💨 рывок или другая дорожка' : HINT[o.kind];
        strip(`${ENEMY[o.type]?.name || ''} ${lane}: ${what}`, 38, '#7a2f35', 'rgba(232,220,196,0.92)', '#16120f');
      }
    }
    this.toasts.forEach((tt) => {
      ctx.globalAlpha = Math.min(1, tt.life * 3, (tt.max - tt.life) * 6);
      strip(tt.text, 40, '#f0d27c', 'rgba(22,18,15,0.85)', '#c9a24a');
      ctx.globalAlpha = 1;
    });
    if (this.flashRed > 0) { ctx.fillStyle = `rgba(150,20,20,${this.flashRed * 0.28})`; ctx.fillRect(0, 0, W, L.SH); }
    if (Lv.nightmare) {
      const a = 0.25 + Math.sin(t * 2.2) * 0.07;
      const g = ctx.createRadialGradient(W / 2, L.SH / 2, L.SH * 0.3, W / 2, L.SH / 2, L.SH * 0.75);
      g.addColorStop(0, 'rgba(90,0,0,0)'); g.addColorStop(1, `rgba(90,0,0,${a})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, L.SH);
    }
    if (this.mods.fog) { ctx.fillStyle = `rgba(20,16,16,${this.mods.fog * 0.6})`; ctx.fillRect(0, 0, W, L.SH * 0.45); }
    ctx.restore();
  }
}
