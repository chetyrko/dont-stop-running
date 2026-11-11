// «Перекладка» героя из нарисованных частей (PNG в assets/hero/).
//
// Позы взяты с рисунков автора: на каждом из 10 рисунков бега размечены суставы
// (таблица KEYS ниже, координаты в пикселях рисунка 1280 × 1280). Между позами
// движение идёт плавно: углы и длины костей интерполируются сплайном, поэтому
// анимация гладкая при любой частоте кадров. Длина кости берётся с рисунка,
// так что кости сами растягиваются и сжимаются, как нарисовал автор.

import { HERO_REST } from './rig-data.js?v=91ab564';
import { drawHeadwear } from './art.js?v=91ab564';
import { recolor } from './pixels.js?v=91ab564';

const SRC = {
  head: 'assets/hero/head.png',
  torso: 'assets/hero/torso.png',
  pelvis: 'assets/hero/pelvis.png',
  thigh: 'assets/hero/thigh.png',
  shin: 'assets/hero/shin.png',
  foot: 'assets/hero/foot.png',
  sleeve: 'assets/hero/sleeve.png',
  forearm: 'assets/hero/forearm.png',
  gun: 'assets/hero/gun.png',
  fist: 'assets/hero/fist.png',
};

const S = 0.16;        // пиксели рисунка → единицы героя (рост ≈ 150)
const GROUND = 1195;   // линия пола на рисунках автора
const CX = 600;        // вертикальная ось героя на рисунках
export const RUN_CYCLE = 0.72;
export const RIG = { S: 0.16, GROUND: 1195, CX: 600 }; // секунд на полный цикл бега (два шага)

// Части в позе покоя (со сборки автора): картинка, сустав, конец кости.
const INST = {};
HERO_REST.forEach(b => {
  INST[b.name] = {
    ...b,
    ang: Math.atan2(b.tip[1] - b.pivot[1], b.tip[0] - b.pivot[0]),
    len: Math.hypot(b.tip[0] - b.pivot[0], b.tip[1] - b.pivot[1]),
  };
});
// пистолет: кость от кисти к дулу; голова: крепится за кончик чёлки
INST.gun.ang = Math.atan2(60 - 200, 525 - 683);
const HEAD_TIP = [470, 112];
const FIST = { pivot: [25, 57], ang: INST.bForearm.ang };

let images = null;

export async function loadHeroRig() {
  const out = {};
  await Promise.all(Object.entries(SRC).map(([k, src]) => new Promise((res) => {
    const img = new Image();
    img.onload = () => { out[k] = img; res(); };
    img.onerror = () => { console.warn('Нет части героя', src); res(); };
    img.src = src;
  })));
  if (Object.keys(out).length === Object.keys(SRC).length) images = out;
  return images;
}

export function rigReady() { return !!images; }

// перекрашенные детали для скинов (рубашка и рукава), считаются один раз
const tintCache = new Map();
function tinted(img, tint) {
  const key = img + JSON.stringify(tint);
  if (!tintCache.has(key)) tintCache.set(key, recolor(images[img], tint));
  return tintCache.get(key);
}

const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => t * t * (3 - 2 * t);
const DEG = Math.PI / 180;

// ---------- позы: суставы на рисунках автора ----------
// ht — кончик чёлки, W — пояс, C — верх рубашки, H — таз (откуда растут ноги),
// g — рука с пистолетом (S плечо, E локоть, Wr кисть, ga — угол пистолета в градусах),
// f — рука с кулаком, lead/trail — ноги (K колено, A щиколотка, T носок),
// zg/zf — рука перед туловищем (1) или за ним (0).
const UP10 = { ht: [600, 245], W: [571, 686], C: [532, 537], H: [658, 777] };
const LEG10 = { lead: { K: [908, 617], A: [916, 871], T: [996, 769] }, trail: { K: [605, 1061], A: [438, 891], T: [432, 1021] } };
const UP5 = { ht: [600, 243], W: [597, 718], C: [554, 556], H: [635, 772] };
const LEG5 = { lead: { K: [846, 1000], A: [949, 1194], T: [986, 1075] }, trail: { K: [543, 1010], A: [446, 751], T: [419, 859] } };
const UP6 = { ht: [600, 243], W: [558, 703], C: [526, 545], H: [616, 766] };
const LEG6 = { lead: { K: [621, 1040], A: [421, 1129], T: [526, 1193] }, trail: { K: [779, 640], A: [768, 887], T: [853, 766] } };
const UP7 = { ht: [600, 206], W: [565, 662], C: [533, 499], H: [603, 727] };
const LEG7 = { lead: { K: [527, 1032], A: [304, 1108], T: [375, 1178] }, trail: { K: [783, 559], A: [810, 820], T: [891, 760] } };
const UP2 = { ht: [597, 284], W: [575, 750], C: [540, 580], H: [630, 790] };
const LEG2 = { lead: { K: [785, 1050], A: [575, 1190], T: [710, 1190] }, trail: { K: [740, 795], A: [755, 930], T: [645, 1015] } };

const KEYS = {
  // рисунок 10 — полёт, пистолет вверху
  k10: { ...UP10, ...LEG10, zg: 1, zf: 0,
    g: { S: [572, 516], E: [795, 505], Wr: [813, 333], ga: -138 }, f: { S: [492, 559], E: [300, 675], Wr: [368, 821] } },
  // рисунок 1 — полёт, кулак вверху, пистолет сзади
  k1: { ...UP10, ...LEG10, zg: 0, zf: 1,
    g: { S: [474, 528], E: [345, 671], Wr: [443, 822], ga: 15 }, f: { S: [585, 505], E: [775, 530], Wr: [706, 358] } },
  // рисунок 5 — вынос ноги вперёд, пистолет перед собой
  k5: { ...UP5, ...LEG5, zg: 1, zf: 0,
    g: { S: [597, 524], E: [651, 675], Wr: [732, 567], ga: -87 }, f: { S: [455, 560], E: [376, 675], Wr: [505, 727] } },
  // рисунок 9 — вынос ноги, кулак впереди
  k9: { ...UP5, ...LEG5, zg: 0, zf: 1,
    g: { S: [455, 560], E: [376, 675], Wr: [543, 691], ga: -36 }, f: { S: [597, 524], E: [651, 675], Wr: [754, 518] } },
  // рисунок 4 — касание пола
  k4: { ht: [597, 288], W: [555, 755], C: [525, 580], H: [610, 790], zg: 1, zf: 0,
    g: { S: [490, 580], E: [545, 730], Wr: [635, 675], ga: -85 }, f: { S: [520, 580], E: [550, 740], Wr: [690, 705] },
    lead: { K: [775, 1020], A: [660, 1185], T: [790, 1175] }, trail: { K: [590, 960], A: [460, 885], T: [505, 1010] } },
  // рисунки 2 и 3 — присед на опорной ноге, вторая проходит вперёд
  k2: { ...UP2, ...LEG2, zg: 1, zf: 0,
    g: { S: [520, 580], E: [590, 720], Wr: [685, 695], ga: -76 }, f: { S: [520, 585], E: [540, 740], Wr: [620, 760] } },
  // рисунок 6 — выпад, пистолет у бедра, кулак впереди
  k6: { ...UP6, ...LEG6, zg: 0, zf: 0,
    g: { S: [479, 545], E: [379, 651], Wr: [555, 712], ga: -24 }, f: { S: [540, 540], E: [595, 619], Wr: [653, 540] } },
  // рисунок 8 — выпад, пистолет вверху
  k8: { ...UP6, ...LEG6, zg: 1, zf: 0,
    g: { S: [509, 545], E: [625, 640], Wr: [704, 514], ga: -108 }, f: { S: [530, 545], E: [560, 690], Wr: [610, 720] } },
  // рисунок 7 — толчок, кулак вверху
  k7: { ...UP7, ...LEG7, zg: 0, zf: 1,
    g: { S: [473, 510], E: [348, 602], Wr: [467, 727], ga: -20 }, f: { S: [582, 477], E: [690, 532], Wr: [658, 385] } },
  // толчок с другой ноги: ноги с рисунка 7, руки — между рисунками 8 и 10
  k7b: { ...UP7, ...LEG7, zg: 1, zf: 0,
    g: { S: [570, 490], E: [750, 520], Wr: [790, 365], ga: -125 }, f: { S: [473, 510], E: [350, 600], Wr: [410, 740] } },

  // ---- позы вне бега (собраны по тем же правилам) ----
  idle: { ht: [597, 147], W: [575, 613], C: [540, 443], H: [630, 653], zg: 1, zf: 0,
    g: { S: [520, 443], E: [590, 583], Wr: [685, 558], ga: -76 }, f: { S: [520, 448], E: [540, 603], Wr: [620, 623] },
    lead: { K: [640, 950], A: [632, 1183], T: [760, 1188] }, trail: { K: [618, 950], A: [598, 1185], T: [725, 1190] } },
  slide: { ht: [215, 770], ha: -1.2, W: [545, 1075], C: [410, 1000], H: [620, 1105], zg: 1, zf: 0,
    g: { S: [440, 990], E: [640, 935], Wr: [790, 905], ga: -25 }, f: { S: [400, 1030], E: [235, 1120], Wr: [120, 1175] },
    lead: { K: [880, 1085], A: [1090, 1150], T: [1150, 1045] }, trail: { K: [820, 1010], A: [1020, 1120], T: [1085, 1020] } },
  kick: { ht: [560, 232], ha: -0.12, W: [530, 695], C: [478, 545], H: [600, 765], zg: 0, zf: 1,
    g: { S: [430, 555], E: [310, 660], Wr: [430, 780], ga: -20 }, f: { S: [530, 520], E: [650, 590], Wr: [630, 445] },
    lead: { K: [900, 740], A: [1150, 715], T: [1185, 600] }, trail: { K: [605, 1000], A: [585, 1185], T: [712, 1190] } },
};

const LIMBS = ['gS', 'gF', 'fS', 'fF', 'At', 'As', 'Af', 'Bt', 'Bs', 'Bf'];
const ANGLES = new Set(['ha', 'tA', 'pA', 'gun', ...LIMBS.map(n => n + 'a')]);
const P10 = Math.atan2(777 - 686, 658 - 571); // направление таза на сборке

// Разметка суставов → параметры позы (углы и длины костей). swap — ноги меняются ролями.
function toParams(k, swap = false) {
  const p = { x: k.W[0], y: k.W[1], hx: k.ht[0], hy: k.ht[1], ha: k.ha || 0, zg: k.zg, zf: k.zf };
  const seg = (name, a, b) => { p[name + 'a'] = Math.atan2(b[1] - a[1], b[0] - a[0]); p[name + 'l'] = Math.hypot(b[0] - a[0], b[1] - a[1]); };
  p.tA = Math.atan2(k.C[1] - k.W[1], k.C[0] - k.W[0]);
  p.tL = Math.hypot(k.C[0] - k.W[0], k.C[1] - k.W[1]);
  p.pA = Math.atan2(k.H[1] - k.W[1], k.H[0] - k.W[0]);
  p.hpx = k.H[0] - k.W[0]; p.hpy = k.H[1] - k.W[1];
  p.sgx = k.g.S[0] - k.W[0]; p.sgy = k.g.S[1] - k.W[1];
  p.sfx = k.f.S[0] - k.W[0]; p.sfy = k.f.S[1] - k.W[1];
  seg('gS', k.g.S, k.g.E); seg('gF', k.g.E, k.g.Wr); p.gun = k.g.ga * DEG;
  seg('fS', k.f.S, k.f.E); seg('fF', k.f.E, k.f.Wr);
  const [A, B] = swap ? [k.trail, k.lead] : [k.lead, k.trail];
  seg('At', k.H, A.K); seg('As', A.K, A.A); seg('Af', A.A, A.T);
  seg('Bt', k.H, B.K); seg('Bs', B.K, B.A); seg('Bf', B.A, B.T);
  return p;
}

function mixP(a, b, t) {
  const o = {};
  for (const n in a) {
    if (n === 'zg' || n === 'zf') o[n] = t < 0.5 ? a[n] : b[n];
    else if (ANGLES.has(n)) o[n] = a[n] + norm(b[n] - a[n]) * t;
    else o[n] = a[n] + (b[n] - a[n]) * t;
  }
  return o;
}

// ---------- цикл бега ----------
// Порядок поз: полёт → вынос → касание → присед → выпад → толчок, затем то же с другой ноги.
const RUN = [
  toParams(KEYS.k10), toParams(KEYS.k5), toParams(KEYS.k4), toParams(KEYS.k2), toParams(KEYS.k6), toParams(KEYS.k7),
  toParams(KEYS.k1, true), toParams(KEYS.k9, true), toParams(KEYS.k4, true), toParams(KEYS.k2, true), toParams(KEYS.k8, true), toParams(KEYS.k7b, true),
];
const N = RUN.length;
// развёртка углов, чтобы сплайн шёл по кратчайшему пути и без скачков на стыке цикла
const TRACK = {};
for (const n in RUN[0]) {
  if (n === 'zg' || n === 'zf') continue;
  const v = RUN.map(p => p[n]);
  let wind = 0;
  if (ANGLES.has(n)) {
    for (let i = 1; i < N; i++) v[i] = v[i - 1] + norm(v[i] - v[i - 1]);
    wind = v[N - 1] + norm(v[0] - v[N - 1]) - v[0];
  }
  TRACK[n] = { v, wind };
}

function runPose(t) {
  const u = (((t / RUN_CYCLE) % 1) + 1) % 1 * N;
  const i = Math.floor(u), f = u - i;
  const o = {};
  for (const n in TRACK) {
    const { v, wind } = TRACK[n];
    const at = (j) => v[((j % N) + N) % N] + Math.floor(j / N) * wind;
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    // сплайн Катмулла — Рома: проходит через все позы и не дёргается на них
    o[n] = 0.5 * (2 * p1 + (p2 - p0) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (3 * p1 - p0 - 3 * p2 + p3) * f * f * f);
  }
  const near = RUN[Math.round(u) % N];
  o.zg = near.zg; o.zf = near.zf;
  return o;
}

const POSE = {
  idle: toParams(KEYS.idle), slide: toParams(KEYS.slide), kick: toParams(KEYS.kick),
  fly: toParams(KEYS.k10), reach: toParams(KEYS.k5),
};

// ---------- отрисовка ----------
function part(ctx, name, img, px, py, ang, len, tint) {
  const b = INST[name];
  ctx.save();
  ctx.translate((px - CX) * S, (py - GROUND) * S);
  ctx.rotate(ang - b.ang);
  ctx.scale(S, S);
  if (len) {
    // кость тянется вдоль себя; при растяжении чуть худеет
    const st = clamp(len / b.len, 0.5, 1.5);
    ctx.rotate(b.ang); ctx.scale(st, st > 1 ? 1 / Math.sqrt(st) : 1); ctx.rotate(-b.ang);
  }
  ctx.translate(-b.pivot[0], -b.pivot[1]);
  const M = b.M;
  ctx.transform(M[0], M[3], M[1], M[4], M[2], M[5]);
  ctx.__tag = name;
  ctx.drawImage(tint ? tinted(img, tint) : images[img], 0, 0);
  ctx.restore();
}

const end = (x, y, a, l) => [x + Math.cos(a) * l, y + Math.sin(a) * l];

function drawPose(ctx, p, skin, extra) {
  const tint = skin.tint || '';
  const leg = (pre, t, s, f) => {
    const k = end(p.x + p.hpx, p.y + p.hpy, p[pre + 'ta'], p[pre + 'tl']);
    const a = end(k[0], k[1], p[pre + 'sa'], p[pre + 'sl']);
    part(ctx, f, 'foot', a[0], a[1], p[pre + 'fa'], p[pre + 'fl']);
    part(ctx, s, 'shin', k[0], k[1], p[pre + 'sa'], p[pre + 'sl']);
    part(ctx, t, 'thigh', p.x + p.hpx, p.y + p.hpy, p[pre + 'ta'], p[pre + 'tl']);
  };
  let muzzle = null;
  const armG = () => {
    const sx = p.x + p.sgx, sy = p.y + p.sgy;
    const e = end(sx, sy, p.gSa, p.gSl), w = end(e[0], e[1], p.gFa, p.gFl);
    part(ctx, 'fForearm', 'forearm', e[0], e[1], p.gFa, p.gFl);
    if (!skin.noGun) part(ctx, 'gun', 'gun', w[0], w[1], p.gun, 0);   // у Сириуса пистолета нет
    part(ctx, 'fSleeve', 'sleeve', sx, sy, p.gSa, p.gSl, tint);
    muzzle = end(w[0], w[1], p.gun, 215);
  };
  const armF = () => {
    const sx = p.x + p.sfx, sy = p.y + p.sfy;
    const e = end(sx, sy, p.fSa, p.fSl), w = end(e[0], e[1], p.fFa, p.fFl);
    part(ctx, 'bForearm', 'forearm', e[0], e[1], p.fFa, p.fFl);
    // кулак на конце предплечья
    ctx.save();
    ctx.translate((w[0] - CX) * S, (w[1] - GROUND) * S);
    ctx.rotate(p.fFa - FIST.ang);
    ctx.scale(S, S);
    ctx.__tag = 'fist';
    ctx.drawImage(images.fist, -FIST.pivot[0], -FIST.pivot[1]);
    ctx.restore();
    part(ctx, 'bSleeve', 'sleeve', sx, sy, p.fSa, p.fSl, tint);
  };

  if (!p.zf) armF();
  if (!p.zg) armG();
  leg('B', 'bThigh', 'bShin', 'bFoot');
  leg('A', 'fThigh', 'fShin', 'fFoot');
  part(ctx, 'pelvis', 'pelvis', p.x, p.y, INST.pelvis.ang + norm(p.pA - P10), 0);
  // голова — за кончик чёлки
  ctx.save();
  ctx.translate((p.hx - CX) * S, (p.hy - GROUND) * S);
  ctx.rotate(p.ha);
  ctx.scale(S, S);
  ctx.translate(-HEAD_TIP[0], -HEAD_TIP[1]);
  const M = INST.head.M;
  ctx.transform(M[0], M[3], M[1], M[4], M[2], M[5]);
  ctx.__tag = 'head';
  ctx.drawImage(images.head, 0, 0);
  ctx.restore();
  part(ctx, 'torso', 'torso', p.x, p.y, p.tA, p.tL, tint);
  if (skin.hat && skin.hat !== 'none') {
    ctx.save();
    ctx.translate((p.hx - CX) * S, (p.hy - GROUND) * S);
    ctx.rotate(p.ha);
    ctx.translate(-85 * S, 140 * S);
    ctx.scale(0.8, 0.8);
    drawHeadwear(ctx, skin.hat, Math.random);
    ctx.restore();
  }
  if (p.zf) armF();
  if (p.zg) armG();

  if (extra.flash > 0 && muzzle) {
    const mx = (muzzle[0] - CX) * S, my = (muzzle[1] - GROUND) * S;
    ctx.save();
    ctx.globalAlpha = Math.min(1, extra.flash * 8);
    ctx.fillStyle = '#f2c14e'; ctx.strokeStyle = '#16120f'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 6 : 16, a = p.gun + (i / 10) * Math.PI * 2;
      ctx.lineTo(mx + Math.cos(a) * r, my + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}

// Герой из частей. (x, y) — точка на полу под героем.
// pose: run|jump|slide|kick|idle
// extra: { kickT, recoil, flash, aim, vy, land, state }
//   state — любой объект игры: в нём хранится прошлая поза, чтобы смена действий
//   (бег → прыжок → подкат…) тоже шла плавно, без скачка.
// Поза (углы и длины костей, точки суставов на рисунке 1280×1280) — для 2D-перекладки и для 3D-модели.
export function rigPose(pose, t, extra = {}) {
  let p, sq = 0;
  if (pose === 'run') p = runPose(t);
  else if (pose === 'kick') {
    const ext = Math.sin(Math.min(1, (extra.kickT ?? 0.5) * 1.5) * Math.PI);
    p = mixP(runPose(t), POSE.kick, smooth(clamp(ext * 1.3, 0, 1)));
  } else if (pose === 'jump') {
    // вверх — поза полёта, вниз — нога тянется к полу
    const vy = extra.vy || 0;
    p = mixP(POSE.fly, POSE.reach, smooth(clamp((vy + 200) / 900, 0, 1)));
    sq = -0.1 * clamp(Math.abs(vy) / 1500, 0, 1);
  } else p = { ...(POSE[pose] || POSE.fly) };
  // плавное смешивание с другой позой (для 3D: разминка, переходы)
  if (extra.blend) p = mixP(p, extra.blend.pose === 'run' ? runPose(extra.blend.t ?? t) : POSE[extra.blend.pose], smooth(clamp(extra.blend.k, 0, 1)));

  // выстрел: рука с пистолетом выбрасывается вперёд, отдача подбрасывает ствол
  if (extra.aim && pose !== 'slide') {
    const r = extra.recoil || 0;
    p = { ...p, zg: 1, gSa: 0.03, gSl: 215, gFa: -0.07 - r * 0.25, gFl: 165 - r * 25, gun: (-8 - r * 30) * DEG };
  } else if (extra.recoil) {
    p = { ...p, gun: p.gun - extra.recoil * 0.5 };
  }

  // плавный переход между действиями
  const st = extra.state;
  if (st) {
    const now = performance.now();
    const dt = clamp((now - (st.time || now)) / 1000, 0, 0.1);
    st.time = now;
    if (st.p && dt > 0) {
      const k = 1 - Math.exp(-dt / (extra.aim ? 0.02 : extra.tau || 0.045));
      const z = { zg: p.zg, zf: p.zf };
      p = { ...mixP(st.p, p, k), ...z };
    }
    st.p = p;
  }

  sq += 0.2 * (extra.land || 0);
  return { p, sq };
}

export function drawRigHero(ctx, x, y, pose, t, skin = {}, extra = {}) {
  const { p, sq } = rigPose(pose, t, extra);
  ctx.save();
  ctx.translate(x, y);
  if (sq) ctx.scale(1 + sq * 0.7, 1 - sq); // присед при приземлении, вытягивание в полёте
  drawPose(ctx, p, skin, extra);
  ctx.restore();
}

// для отладки и сравнения с рисунками: поза по номеру ключа бега
export function drawRunKey(ctx, x, y, i, skin = {}) {
  ctx.save(); ctx.translate(x, y); drawPose(ctx, RUN[i], skin, {}); ctx.restore();
}

// ---------- для 3D: где оказалась бы каждая деталь ----------
// Возвращает [{ tag, img, m: [a, b, c, d, e, f] }] — та же поза, что рисуется в 2D,
// в виде матриц «пиксели картинки детали → единицы героя (y вниз, ступни в 0)».
class CaptureCtx {
  constructor() { this.m = new DOMMatrix(); this.stack = []; this.out = []; this.__tag = ''; }
  save() { this.stack.push(this.m); }
  restore() { this.m = this.stack.pop() || new DOMMatrix(); }
  translate(x, y) { this.m = this.m.translate(x, y); }
  rotate(a) { this.m = this.m.rotate(a * 180 / Math.PI); }
  scale(x, y) { this.m = this.m.scale(x, y); }
  transform(a, b, c, d, e, f) { this.m = this.m.multiply(new DOMMatrix([a, b, c, d, e, f])); }
  drawImage(img, x = 0, y = 0) { const m = this.m.translate(x, y); this.out.push({ tag: this.__tag, m: [m.a, m.b, m.c, m.d, m.e, m.f] }); }
}
const NOOP = () => {};
export function captureRigPose(pose, t, skin = {}, extra = {}) {
  if (!images) return null;
  const c = new CaptureCtx();
  const proxy = new Proxy(c, { get: (o, k) => (k in o ? (typeof o[k] === 'function' ? o[k].bind(o) : o[k]) : NOOP), set: (o, k, v) => { o[k] = v; return true; } });
  drawRigHero(proxy, 0, 0, pose, t, { ...skin, tint: '', hat: 'none' }, { ...extra, flash: 0 });
  return c.out;
}
export const RIG_PARTS = HERO_REST.map(b => ({ name: b.name, img: b.img }));
export function rigImages() { return images; }
