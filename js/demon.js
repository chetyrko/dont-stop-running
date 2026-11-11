// Демон из деталей автора (assets/demon/): тело, череп, две руки, две ноги.
// Детали стоят как на сборке автора и покачиваются вокруг суставов.

import { DEMON_PARTS } from './demon-data.js';
import { recolor } from './pixels.js';

// Варианты: цвет черепа и тела. brute — громила, hopper — прыгун, boss — хранитель акта.
const VARIANTS = {
  brute: { skull: { gray: 0.3, mul: [1.25, 0.62, 0.55] } },
  hopper: { skull: { gray: 0.4, mul: [0.8, 1.05, 0.7] } },
  boss: { skull: { gray: 0.2, mul: [1.3, 0.5, 0.45] } },
  hit: { skull: { gray: 1, mul: [1.6, 1.6, 1.6] }, body: { gray: 0, mul: [1, 1, 1] } },
};
const cache = {};
function imgFor(name, variant) {
  const v = VARIANTS[variant];
  if (!v || !v[name]) return images[name];
  const key = variant + name;
  return cache[key] ||= recolor(images[name], v[name]);
}

const SRC = { skull: 'assets/demon/skull.png', arm: 'assets/demon/arm.png', leg: 'assets/demon/leg.png', body: 'assets/demon/body.png' };
const FEET_Y = 968;   // низ ступней на сборке
const BODY_X = 540;   // середина тела на сборке
const HEIGHT = 955;   // рост на сборке

let images = null;

export async function loadDemon() {
  const out = {};
  await Promise.all(Object.entries(SRC).map(([k, src]) => new Promise((res) => {
    const img = new Image();
    img.onload = () => { out[k] = img; res(); };
    img.onerror = () => res();
    img.src = src;
  })));
  if (Object.keys(out).length === Object.keys(SRC).length) images = out;
  return images;
}

export function demonReady() { return !!images; }

// (cx, ground) — середина тела на полу, h — рост в игре, t — время, dead — 0..1 (умирает)
export function drawDemon(ctx, cx, ground, h, t, dead = 0, seed = 0, variant = '', flash = 0) {
  if (flash > 0) variant = 'hit';
  const k = h / HEIGHT;
  const ph = t * 6 + seed;
  const s = Math.sin(ph), c = Math.cos(ph);
  // повороты деталей вокруг суставов и общий «подпрыг» при ходьбе
  const rot = {
    armL: 0.1 * Math.sin(ph * 0.9), armR: 0.1 * Math.sin(ph * 0.9 + 1.4),
    legL: 0.14 * s, legR: -0.14 * s,
    body: 0.035 * c, skull: 0.07 * Math.sin(ph * 2) - 0.03,
  };
  const bob = Math.abs(c) * 14;
  ctx.save();
  ctx.translate(cx, ground);
  if (dead) {
    ctx.globalAlpha = 1 - dead;
    ctx.rotate(dead * 0.9);
    ctx.scale(1 - dead * 0.25, 1 - dead * 0.25);
  }
  ctx.scale(k, k);
  ctx.translate(-BODY_X, -FEET_Y);
  // низ туловища: соединяет тело с ногами (на рисунке автора тело клином уходит в правую ногу)
  ctx.save();
  ctx.translate(0, -bob * 0.7);
  ctx.strokeStyle = '#000'; ctx.lineCap = 'round';
  ctx.lineWidth = 64;
  ctx.beginPath(); ctx.moveTo(590, 600); ctx.lineTo(672, 760); ctx.stroke();
  ctx.lineWidth = 56;
  ctx.beginPath(); ctx.moveTo(560, 640); ctx.lineTo(566, 735); ctx.stroke();
  ctx.restore();
  for (const p of DEMON_PARTS) {
    const isLeg = p.img === 'leg';
    ctx.save();
    // ноги стоят на полу, всё остальное покачивается вверх-вниз
    ctx.translate(p.pivot[0], p.pivot[1] - (isLeg ? bob * 0.35 : bob));
    ctx.rotate(rot[p.name] || 0);
    if (p.name === 'body') ctx.scale(1 + 0.02 * s, 1 - 0.02 * s);
    ctx.translate(-p.pivot[0], -p.pivot[1]);
    const M = p.M;
    ctx.transform(M[0], M[3], M[1], M[4], M[2], M[5]);
    ctx.drawImage(imgFor(p.img, variant), 0, 0);
    ctx.restore();
  }
  ctx.restore();
}
