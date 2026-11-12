// 30 видов врагов и препятствий. Открываются постепенно: unlock — номер комнаты,
// с которой вид начинает попадаться. В первые комнаты после открытия новичок
// попадается чаще (см. rooms.js), чтобы игрок его точно встретил.
//
// act — чем проходится: jump ↑, slide ↓, kick ←, dash →, shoot (тап).
// hp — сколько выстрелов (0 — пуля не берёт); block — пуля упирается и гаснет.
// box(o, g) — опасная зона в мире (null — пока не опасно); draw(ctx, o, x, g, t, R) — рисунок.

import { GROUND_Y, FLOOR_TOP, W, HERO_SCALE } from './config.js?v=4b26dca';
import * as art from './art.js?v=4b26dca';
import { demonReady, drawDemon } from './demon.js?v=4b26dca';
import { rigReady, drawRigHero } from './rig.js?v=4b26dca';

const head = (o, pad = 10, lift = 100, h = 70) => ({ l: o.x + pad, r: o.x + o.w - pad, t: GROUND_Y - lift - h, b: GROUND_Y - lift });
const floor = (o, h, pad = 8) => ({ l: o.x + pad, r: o.x + o.w - pad, t: GROUND_Y - h, b: GROUND_Y });
const foe = (o, inset = 14, top = 20) => ({ l: o.x + inset, r: o.x + o.w - inset, t: GROUND_Y - o.h + top, b: GROUND_Y });

function demon(ctx, o, x, g, t, variant = '', lift = 0, speedK = 1) {
  if (demonReady()) drawDemon(ctx, x + o.w / 2, GROUND_Y + 4 - lift, o.h, t * speedK, o.dead, o.id, variant, o.flash);
  else art.drawMonster(ctx, x, GROUND_Y - lift, o.w, o.h, t, art.makeRng(o.id), o.dead);
}

// ---------- рисунки новых врагов ----------
function drawRats(ctx, x, w, t, dead) {
  ctx.save(); ctx.globalAlpha = 1 - dead;
  for (let i = 0; i < 5; i++) {
    const rx = x + 20 + i * (w - 40) / 4 + Math.sin(t * 14 + i) * 6, ry = GROUND_Y - 14 - (i % 2) * 8;
    ctx.fillStyle = '#1a1614'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(rx, ry, 22, 12, -0.1, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(rx - 20, ry - 2, 10, 8, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(rx + 20, ry); ctx.quadraticCurveTo(rx + 40, ry - 14 + Math.sin(t * 9 + i) * 6, rx + 52, ry - 2); ctx.stroke();
    ctx.fillStyle = '#c2242a'; ctx.beginPath(); ctx.arc(rx - 25, ry - 4, 2.5, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function drawSpider(ctx, o, x, t) {
  const cx = x + o.w / 2, cy = o.y;
  ctx.save(); ctx.globalAlpha = 1 - o.dead;
  ctx.strokeStyle = 'rgba(30,25,22,0.7)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, cy - 20); ctx.stroke();
  ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
  for (let s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const a = 0.3 + i * 0.35 + Math.sin(t * 8 + i) * 0.1;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(cx + s * Math.cos(a) * 40, cy - 30 + i * 8, cx + s * Math.cos(a) * 55, cy + 10 + i * 10); ctx.stroke();
  }
  ctx.fillStyle = o.flash > 0 ? '#e8dcc4' : '#141110';
  ctx.beginPath(); ctx.ellipse(cx, cy, 26, 22, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx, cy + 26, 18, 16, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#c2242a';
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(cx - 9 + i * 6, cy - 6 + (i % 2) * 3, 2.5, 0, 7); ctx.fill(); }
  ctx.restore();
}

function drawArmor(ctx, x, w, h, t) {
  const cx = x + w / 2, top = GROUND_Y - h;
  ctx.save();
  ctx.fillStyle = '#7a7d82'; ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
  // постамент
  ctx.fillStyle = '#3a2f22'; ctx.fillRect(cx - 50, GROUND_Y - 20, 100, 20); ctx.strokeRect(cx - 50, GROUND_Y - 20, 100, 20);
  ctx.fillStyle = '#7a7d82';
  ctx.beginPath(); ctx.rect(cx - 16, GROUND_Y - 110, 12, 90); ctx.rect(cx + 4, GROUND_Y - 110, 12, 90); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 38, top + 60); ctx.lineTo(cx + 38, top + 60); ctx.lineTo(cx + 30, GROUND_Y - 105); ctx.lineTo(cx - 30, GROUND_Y - 105); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx, top + 30, 24, 30, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#000'; ctx.fillRect(cx - 16, top + 24, 32, 6);
  ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(cx - 34 + i * 2, top + 80 + i * 22); ctx.lineTo(cx + 34 - i * 2, top + 80 + i * 22); ctx.stroke(); }
  // копьё
  ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx + 46, GROUND_Y - 20); ctx.lineTo(cx + 46, top - 20); ctx.stroke();
  ctx.fillStyle = '#9a9da2'; ctx.beginPath(); ctx.moveTo(cx + 36, top - 10); ctx.lineTo(cx + 46, top - 50); ctx.lineTo(cx + 56, top - 10); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawSkull(ctx, cx, cy, r, rot, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.fillStyle = '#e6dcc8'; ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, -4, r, Math.PI * 0.9, Math.PI * 2.1); ctx.lineTo(r * 0.55, r * 0.8); ctx.lineTo(-r * 0.55, r * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(-r * 0.38, -2, r * 0.22, r * 0.26, 0, 0, 7); ctx.ellipse(r * 0.38, -2, r * 0.22, r * 0.26, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, r * 0.2); ctx.lineTo(-r * 0.1, r * 0.42); ctx.lineTo(r * 0.1, r * 0.42); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawSpikes(ctx, x, w, rise) {
  ctx.save();
  ctx.fillStyle = '#2a2622'; ctx.fillRect(x, GROUND_Y - 6, w, 10);
  ctx.fillStyle = '#8a8d92'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
  for (let sx = x + 8; sx < x + w - 8; sx += 22) {
    const hh = 70 * rise;
    ctx.beginPath(); ctx.moveTo(sx - 9, GROUND_Y - 2); ctx.lineTo(sx, GROUND_Y - 2 - hh); ctx.lineTo(sx + 9, GROUND_Y - 2); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function drawInk(ctx, x, w, t) {
  ctx.save();
  ctx.fillStyle = '#0d0a10';
  ctx.beginPath(); ctx.ellipse(x + w / 2, GROUND_Y + 2, w / 2, 16, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(120,100,170,0.35)';
  ctx.beginPath(); ctx.ellipse(x + w * 0.4, GROUND_Y - 2, w * 0.22, 4, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#0d0a10';
  for (let i = 0; i < 3; i++) {
    const ph = (t * 1.5 + i * 0.33) % 1;
    ctx.globalAlpha = 1 - ph;
    ctx.beginPath(); ctx.arc(x + w * (0.25 + i * 0.25), GROUND_Y - 8 - ph * 40, 7 + ph * 5, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function drawCandelabrum(ctx, x, w, h, t) {
  const cx = x + w / 2;
  ctx.save();
  ctx.strokeStyle = '#000'; ctx.fillStyle = '#3a2f22'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(cx, GROUND_Y); ctx.lineTo(cx, GROUND_Y - h + 30); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 40, GROUND_Y - h + 40); ctx.quadraticCurveTo(cx, GROUND_Y - h + 70, cx + 40, GROUND_Y - h + 40); ctx.stroke();
  ctx.fillRect(cx - 24, GROUND_Y - 8, 48, 8);
  for (const dx of [-40, 0, 40]) {
    ctx.fillStyle = '#efe4cc'; ctx.fillRect(cx + dx - 5, GROUND_Y - h + 14, 10, 24);
    const f = 1 + Math.sin(t * 13 + dx) * 0.25;
    ctx.fillStyle = '#f2a33a'; ctx.beginPath(); ctx.ellipse(cx + dx, GROUND_Y - h + 2, 8 * f, 18 * f, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.ellipse(cx + dx, GROUND_Y - h + 6, 4, 9 * f, 0, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function drawPortrait(ctx, o, x, t) {
  const sw = Math.sin(t * 2.5 + o.id) * 0.25;
  const pivot = [x + o.w / 2, 0], cy = GROUND_Y - 135;
  ctx.save();
  ctx.translate(pivot[0], pivot[1]); ctx.rotate(sw); ctx.translate(-pivot[0], -pivot[1]);
  ctx.strokeStyle = '#2a2622'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(pivot[0] - 40, 0); ctx.lineTo(pivot[0] - 50, cy - 50); ctx.moveTo(pivot[0] + 40, 0); ctx.lineTo(pivot[0] + 50, cy - 50); ctx.stroke();
  ctx.fillStyle = '#6a4a32'; ctx.strokeStyle = '#000'; ctx.lineWidth = 5;
  ctx.fillRect(x, cy - 55, o.w, 110); ctx.strokeRect(x, cy - 55, o.w, 110);
  ctx.fillStyle = '#8f8a82'; ctx.fillRect(x + 14, cy - 42, o.w - 28, 84);
  ctx.fillStyle = '#2a2622';
  ctx.beginPath(); ctx.ellipse(x + o.w / 2, cy - 6, 22, 26, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + o.w / 2, cy + 40, 44, 22, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#f4ecd6'; ctx.beginPath(); ctx.arc(x + o.w / 2 - 8, cy - 8, 3, 0, 7); ctx.arc(x + o.w / 2 + 8, cy - 8, 3, 0, 7); ctx.fill();
  ctx.restore();
}

function drawBeam(ctx, o, x, t) {
  const yb = GROUND_Y - 135;
  ctx.save();
  // Око на стене над лучом
  ctx.fillStyle = '#e9e4da'; ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(x + o.w + 10, yb - 4, 34, 20, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#b3302c'; ctx.beginPath(); ctx.arc(x + o.w - 2, yb - 4, 11, 0, 7); ctx.fill();
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x + o.w - 4, yb - 4, 5, 0, 7); ctx.fill();
  const a = 0.55 + Math.sin(t * 20) * 0.15;
  const g = ctx.createLinearGradient(0, yb - 30, 0, yb + 30);
  g.addColorStop(0, 'rgba(179,48,44,0)'); g.addColorStop(0.5, `rgba(220,60,50,${a})`); g.addColorStop(1, 'rgba(179,48,44,0)');
  ctx.fillStyle = g; ctx.fillRect(x, yb - 34, o.w - 20, 68);
  ctx.fillStyle = `rgba(255,220,200,${a})`; ctx.fillRect(x, yb - 4, o.w - 20, 8);
  ctx.restore();
}

function drawTentacle(ctx, o, x, t) {
  ctx.save();
  ctx.strokeStyle = '#0e0b0b'; ctx.lineCap = 'round';
  const yb = GROUND_Y - 130 + Math.sin(t * 3 + o.id) * 10;
  for (let k = 0; k < 2; k++) {
    ctx.lineWidth = 26 - k * 12;
    ctx.strokeStyle = k ? '#2e2530' : '#0e0b0b';
    ctx.beginPath(); ctx.moveTo(x + o.w, GROUND_Y + 4);
    ctx.bezierCurveTo(x + o.w + 30, yb + 60, x + o.w * 0.6, yb - 30 + Math.sin(t * 5) * 14, x + 10, yb + Math.sin(t * 7) * 10);
    ctx.stroke();
  }
  ctx.fillStyle = '#d0c4b8';
  for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.arc(x + o.w * (0.2 + i * 0.15), yb + 8 + Math.sin(t * 5 + i) * 6, 4, 0, 7); ctx.fill(); }
  ctx.restore();
}

function drawGhost(ctx, o, x, t, alpha = 0.55) {
  const cx = x + o.w / 2, fy = GROUND_Y - 20 + Math.sin(t * 3 + o.id) * 10;
  ctx.save(); ctx.globalAlpha = alpha * (1 - o.dead);
  const g = ctx.createLinearGradient(0, fy - o.h, 0, fy);
  g.addColorStop(0, 'rgba(220,220,240,0.95)'); g.addColorStop(1, 'rgba(160,160,200,0.1)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(cx - 60, fy);
  ctx.quadraticCurveTo(cx - 70, fy - o.h * 0.9, cx, fy - o.h); ctx.quadraticCurveTo(cx + 70, fy - o.h * 0.9, cx + 60, fy);
  for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(cx + 45 - i * 30, fy - 25 + Math.sin(t * 6 + i) * 8, cx + 30 - i * 30, fy);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#16120f';
  ctx.beginPath(); ctx.ellipse(cx - 20, fy - o.h + 70, 10, 16, 0, 0, 7); ctx.ellipse(cx + 16, fy - o.h + 70, 10, 16, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx, fy - o.h + 120, 14, 20, 0, 0, 7); ctx.fill();
  ctx.restore();
}

function drawFog(ctx, o, x, t) {
  ctx.save();
  for (let i = 0; i < 9; i++) {
    const yy = 40 + i * 55, wob = Math.sin(t * 2 + i) * 18;
    const g = ctx.createRadialGradient(x + o.w / 2 + wob, yy, 5, x + o.w / 2 + wob, yy, 90);
    g.addColorStop(0, 'rgba(200,200,215,0.55)'); g.addColorStop(1, 'rgba(200,200,215,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 60, yy - 90, o.w + 120, 180);
  }
  ctx.fillStyle = 'rgba(30,25,35,0.6)';
  ctx.beginPath(); ctx.arc(x + o.w / 2 - 14, 250 + Math.sin(t) * 6, 6, 0, 7); ctx.arc(x + o.w / 2 + 14, 250 + Math.sin(t) * 6, 6, 0, 7); ctx.fill();
  ctx.restore();
}

function drawShield(ctx, o, x) {
  ctx.save();
  ctx.fillStyle = '#5a3e2a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 5;
  const sx = x - 10, sy = GROUND_Y - 230;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 70, sy); ctx.lineTo(sx + 70, sy + 150); ctx.lineTo(sx + 35, sy + 200); ctx.lineTo(sx, sy + 150); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(sx + 35, sy + 10); ctx.lineTo(sx + 35, sy + 180); ctx.moveTo(sx + 8, sy + 70); ctx.lineTo(sx + 62, sy + 70); ctx.stroke();
  ctx.restore();
}

export function drawTrapdoor(ctx, o, x, R) {
  if (o.open >= 0.05) { art.drawPit(ctx, x + o.w * (1 - o.open) / 2, o.w * o.open, R); }
  if (o.open < 1) {
    ctx.save();
    const w = o.w * (1 - o.open * 0.9);
    ctx.fillStyle = '#5a4434'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x + o.w / 2, FLOOR_TOP + 22, w / 2, 12, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + o.w / 2 - w / 2 + 10, FLOOR_TOP + 22); ctx.lineTo(x + o.w / 2 + w / 2 - 10, FLOOR_TOP + 22); ctx.stroke();
    ctx.restore();
  }
}

function drawPuppet(ctx, o, x, g, t) {
  const cx = x + o.w / 2, lift = o.hop || 0;
  ctx.save(); ctx.globalAlpha = 1 - o.dead;
  ctx.strokeStyle = 'rgba(200,190,170,0.6)'; ctx.lineWidth = 1.5;
  for (const dx of [-30, 0, 30]) { ctx.beginPath(); ctx.moveTo(cx + dx, 0); ctx.lineTo(cx + dx * 0.6, GROUND_Y - o.h - lift + 30); ctx.stroke(); }
  ctx.restore();
  demon(ctx, o, x, g, t * 2, 'hopper', lift);
}

function drawMirror(ctx, o, x, g, t) {
  ctx.save();
  ctx.globalAlpha = 0.85 * (1 - o.dead);
  ctx.translate(x + o.w / 2, GROUND_Y);
  ctx.scale(-HERO_SCALE, HERO_SCALE);
  if (rigReady()) drawRigHero(ctx, 0, 0, 'run', t * 1.1, MIRROR_SKIN, {});
  ctx.restore();
  // трещины «зеркала»
  ctx.save(); ctx.globalAlpha = 0.5 * (1 - o.dead); ctx.strokeStyle = o.flash > 0 ? '#fff' : '#cfd6dc'; ctx.lineWidth = 2;
  const cx = x + o.w / 2, cy = GROUND_Y - 120;
  for (let i = 0; i < 6; i++) { const a = i * 1.05; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * 70, cy + Math.sin(a) * 90); ctx.stroke(); }
  ctx.restore();
}
const MIRROR_SKIN = { hat: 'none', tint: { gray: 1, mul: [0.75, 0.8, 0.9] } };

// ---------- реестр ----------
export const ENEMY = {
  pit:        { name: 'Яма с кольями', act: 'jump', unlock: 1, weight: 3, pitLike: true, hint: '↑ свайп вверх — прыжок' },
  furniture:  { name: 'Книжный шкаф', act: 'kick', unlock: 1, weight: 2.5, w: 150, h: 300, block: true, img: 'furniture',
    box: (o) => floor(o, o.h - 20, 6), hint: '← свайп влево — пинок' },
  flyer:      { name: 'Ворона', act: 'slide', unlock: 3, weight: 3, w: 124, h: 70, speed: 140, shadow: [0.35, 0.16],
    box: (o, g) => { const b = GROUND_Y - 100 + Math.sin(g.t * 3 + o.id) * 4; return { l: o.x + 10, r: o.x + o.w - 10, t: b - o.h, b }; },
    draw: (ctx, o, x, g, t, R) => art.drawFlyer(ctx, x, ENEMY.flyer.box(o, g).b, o.w, o.h, t, R(o.id), o.dead), hint: '↓ свайп вниз — подкат' },
  monster:    { name: 'Тень', act: 'shoot', unlock: 5, weight: 3, w: 160, h: 300, speed: 70, hp: 1, pts: 40, box: (o) => foe(o),
    draw: (ctx, o, x, g, t) => demon(ctx, o, x, g, t), hint: '☝ тап — выстрел' },
  rats:       { name: 'Крысы', act: 'jump', unlock: 8, weight: 2.5, w: 210, h: 44, speed: 120, shadow: [0.5, 0.2],
    box: (o) => floor(o, 40, 14), draw: (ctx, o, x, g, t) => drawRats(ctx, x, o.w, t, o.dead), hint: '↑ перепрыгни крыс' },
  wardrobe:   { name: 'Гардероб', act: 'kick', unlock: 12, weight: 2, w: 150, h: 290, block: true,
    box: (o) => floor(o, o.h - 20, 6), draw: (ctx, o, x, g, t, R) => art.drawFurniture(ctx, x, GROUND_Y, o.w, o.h, 0, R(o.id)), hint: '← пинком гардероб' },
  lowcrow:    { name: 'Низкая ворона', act: 'jump', unlock: 16, weight: 2, w: 104, h: 58, speed: 210, shadow: [0.3, 0.25],
    box: (o, g) => { const b = GROUND_Y - 8 + Math.sin(g.t * 3 + o.id) * 2; return { l: o.x + 10, r: o.x + o.w - 10, t: b - o.h, b }; },
    draw: (ctx, o, x, g, t, R) => art.drawFlyer(ctx, x, ENEMY.lowcrow.box(o, g).b, o.w, o.h, t * 1.3, R(o.id), o.dead), hint: '↑ перепрыгни ворону' },
  spider:     { name: 'Паук на нити', act: 'slide', unlock: 21, weight: 2, w: 110, h: 80, hp: 1, pts: 30, shadow: [0.3, 0.12],
    update: (o, g, dt) => { const target = GROUND_Y - 150; o.y = (o.y ?? 60) + (target - (o.y ?? 60)) * Math.min(1, dt * 3) + Math.sin(g.t * 4 + o.id) * 0.5; },
    box: (o) => ({ l: o.x + 20, r: o.x + o.w - 20, t: (o.y ?? 60) - 30, b: (o.y ?? 60) + 45 }),
    draw: (ctx, o, x, g, t) => drawSpider(ctx, o, x, t), hint: '↓ подкат под паука (или тап)' },
  hands:      { name: 'Руки из пола', act: 'jump', unlock: 27, weight: 2, w: 130, h: 100,
    update: (o, g, dt, dist) => { if (dist < g.speed * 0.9) o.rise = Math.min(1, o.rise + dt * 4.5); },
    box: (o) => o.rise < 0.25 ? null : { l: o.x + 12, r: o.x + o.w - 12, t: GROUND_Y - o.h * o.rise, b: GROUND_Y },
    draw: (ctx, o, x, g, t) => art.drawHands(ctx, x, o.w, GROUND_Y, o.h, o.rise, t), hint: '↑ перепрыгни руки' },
  clock:      { name: 'Напольные часы', act: 'kick', unlock: 33, weight: 2, w: 120, h: 320, block: true,
    box: (o) => floor(o, o.h - 20, 8), draw: (ctx, o, x, g, t, R) => art.drawFurniture(ctx, x, GROUND_Y, o.w, o.h, 1, R(o.id)), hint: '← пинком часы' },
  hopper:     { name: 'Тень-прыгун', act: 'shoot', unlock: 40, weight: 2, w: 110, h: 190, speed: 175, hp: 1, pts: 50,
    update: (o, g) => { o.hop = Math.max(0, Math.sin(g.t * 5.5 + o.id)) * 95; },
    box: (o) => { const b = GROUND_Y - o.hop; return { l: o.x + 14, r: o.x + o.w - 14, t: b - o.h + 20, b }; },
    draw: (ctx, o, x, g, t) => demon(ctx, o, x, g, t, 'hopper', o.hop, 1.6), hint: '☝ тап — прыгуна' },
  chandelier: { name: 'Люстра', act: 'jump', unlock: 48, weight: 1.6, w: 150, h: 64,
    update: (o, g, dt, dist) => {
      if (!o.falling && dist < g.speed * 0.8) o.falling = true;
      if (o.falling && o.fall < 1) { o.fall = Math.min(1, o.fall + dt / 0.35); if (o.fall >= 1) { g.shake = Math.max(g.shake, 9); g.puff(o.x + o.w / 2, GROUND_Y, 10); } }
    },
    box: (o) => {
      if (o.fall <= 0) return null;
      if (o.fall < 1) { const y = 70 + (GROUND_Y - 100) * o.fall * o.fall; return { l: o.x, r: o.x + o.w, t: y - 20, b: y + 40 }; }
      return { l: o.x + 8, r: o.x + o.w - 8, t: GROUND_Y - 62, b: GROUND_Y };
    },
    draw: (ctx, o, x, g, t) => art.drawChandelier(ctx, x + o.w / 2, GROUND_Y, o.fall, t), hint: '↑ перепрыгни обломки' },
  trapdoor:   { name: 'Люк', act: 'jump', unlock: 56, weight: 2, pitLike: true, w: 190,
    update: (o, g, dt, dist) => { if (dist < g.speed * 0.75) o.open = Math.min(1, (o.open || 0) + dt * 5); },
    hint: '↑ люк откроется — прыгай' },
  portrait:   { name: 'Портрет на цепях', act: 'slide', unlock: 65, weight: 2, w: 150, h: 110,
    box: (o) => ({ l: o.x + 10, r: o.x + o.w - 10, t: GROUND_Y - 190, b: GROUND_Y - 95 }),
    draw: (ctx, o, x, g, t) => drawPortrait(ctx, o, x, t), hint: '↓ подкат под портрет' },
  gate:       { name: 'Призрачная решётка', act: 'dash', unlock: 75, weight: 1.4, w: 80, h: 0, block: true, shadow: [0, 0], noBoss: true,
    box: (o) => ({ l: o.x + 15, r: o.x + o.w - 15, t: 0, b: GROUND_Y }),
    draw: (ctx, o, x, g, t) => art.drawGate(ctx, x, o.w, GROUND_Y, t), hint: '→ свайп вправо — рывок' },
  skullroll:  { name: 'Катящийся череп', act: 'jump', unlock: 86, weight: 2, w: 76, h: 76, speed: 280, shadow: [0.5, 0.25],
    box: (o) => floor(o, 66, 8), draw: (ctx, o, x, g, t) => drawSkull(ctx, x + o.w / 2, GROUND_Y - 36, 34, -g.t * 9), hint: '↑ перепрыгни череп' },
  armor:      { name: 'Рыцарские доспехи', act: 'kick', unlock: 105, weight: 1.8, w: 120, h: 280, block: true,
    box: (o) => floor(o, o.h - 30, 14), draw: (ctx, o, x, g, t) => drawArmor(ctx, x, o.w, o.h, t), hint: '← пинком доспехи' },
  flock:      { name: 'Стая ворон', act: 'slide', unlock: 118, weight: 1.6, w: 300, h: 80, speed: 160, shadow: [0.45, 0.14],
    box: (o, g) => { const b = GROUND_Y - 100 + Math.sin(g.t * 3 + o.id) * 4; return { l: o.x + 10, r: o.x + o.w - 10, t: b - o.h, b }; },
    draw: (ctx, o, x, g, t, R) => { const b = GROUND_Y - 100; for (let i = 0; i < 3; i++) art.drawFlyer(ctx, x + i * 92, b + Math.sin(t * 4 + i) * 10 - (i % 2) * 14, 110, 62, t + i * 0.2, R(o.id + i), o.dead); },
    hint: '↓ длинный подкат под стаю' },
  brute:      { name: 'Тень-громила', act: 'shoot', unlock: 132, weight: 1.2, w: 210, h: 390, speed: 38, hp: 3, pts: 90,
    box: (o) => foe(o, 24, 30), draw: (ctx, o, x, g, t) => { demon(ctx, o, x, g, t, 'brute'); if (!o.dead) g.drawPips(ctx, x + o.w / 2, GROUND_Y - o.h - 18, o.hp, 3); },
    hint: '☝ три выстрела' },
  spikes:     { name: 'Шипы', act: 'jump', unlock: 148, weight: 2, w: 160, h: 72,
    update: (o, g, dt, dist) => { if (dist < g.speed * 0.85) o.rise = Math.min(1, o.rise + dt * 6); },
    box: (o) => o.rise < 0.3 ? null : floor(o, 70 * o.rise, 8),
    draw: (ctx, o, x) => drawSpikes(ctx, x, o.w, Math.max(0.12, o.rise)), hint: '↑ шипы — прыжок' },
  ghost:      { name: 'Призрак', act: 'dash', unlock: 165, weight: 1.6, w: 140, h: 270, speed: 60, shadow: [0.35, 0.1], noBoss: true,
    box: (o) => ({ l: o.x + 25, r: o.x + o.w - 25, t: GROUND_Y - o.h, b: GROUND_Y }),
    draw: (ctx, o, x, g, t) => drawGhost(ctx, o, x, t), hint: '→ рывок сквозь призрака (пули не берут)' },
  shielded:   { name: 'Тень со щитом', act: 'kick', unlock: 182, weight: 1.6, w: 170, h: 300, speed: 55, hp: 1, pts: 60, block: true, kickKills: true,
    box: (o) => foe(o), draw: (ctx, o, x, g, t) => { demon(ctx, o, x, g, t); if (!o.dead) drawShield(ctx, o, x); },
    hint: '← пинком — щит держит пули' },
  swoop:      { name: 'Пикирующая ворона', act: 'slide', unlock: 205, weight: 1.6, w: 124, h: 70, speed: 220,
    update: (o, g, dt, dist) => { const k = Math.max(0, Math.min(1, 1 - (dist - 120) / 700)); o.y = 90 + (GROUND_Y - 170 - 90) * k; },
    box: (o) => ({ l: o.x + 10, r: o.x + o.w - 10, t: (o.y ?? 90), b: (o.y ?? 90) + o.h }),
    draw: (ctx, o, x, g, t, R) => art.drawFlyer(ctx, x, (o.y ?? 90) + o.h, o.w, o.h, t * 1.5, R(o.id), o.dead), hint: '↓ ворона пикирует — подкат' },
  ink:        { name: 'Чернильная лужа', act: 'jump', unlock: 225, weight: 1.8, w: 210, h: 30, shadow: [0, 0],
    box: (o) => floor(o, 26, 22), draw: (ctx, o, x, g, t) => drawInk(ctx, x, o.w, t), hint: '↑ не наступай в чернила' },
  beam:       { name: 'Взгляд Ока', act: 'slide', unlock: 250, weight: 1.4, w: 380, h: 80, shadow: [0, 0], noBoss: true,
    box: (o) => ({ l: o.x, r: o.x + o.w - 20, t: GROUND_Y - 172, b: GROUND_Y - 98 }),
    draw: (ctx, o, x, g, t) => drawBeam(ctx, o, x, t), hint: '↓ подкат под взгляд Ока' },
  candelabrum:{ name: 'Канделябр', act: 'jump', unlock: 275, weight: 1.6, w: 110, h: 110,
    box: (o) => floor(o, o.h - 10, 24), draw: (ctx, o, x, g, t) => drawCandelabrum(ctx, x, o.w, o.h, t), hint: '↑ перепрыгни огонь' },
  puppet:     { name: 'Марионетка', act: 'shoot', unlock: 305, weight: 1.8, w: 120, h: 220, speed: 110, hp: 2, pts: 70,
    update: (o, g) => { o.hop = Math.abs(Math.sin(g.t * 3.2 + o.id)) * 60; },
    box: (o) => { const b = GROUND_Y - (o.hop || 0); return { l: o.x + 14, r: o.x + o.w - 14, t: b - o.h + 20, b }; },
    draw: (ctx, o, x, g, t) => { drawPuppet(ctx, o, x, g, t); if (!o.dead) g.drawPips(ctx, x + o.w / 2, GROUND_Y - o.h - (o.hop || 0) - 14, o.hp, 2); },
    hint: '☝ два выстрела в марионетку' },
  tentacle:   { name: 'Щупальце', act: 'slide', unlock: 340, weight: 1.6, w: 240, h: 80,
    box: (o, g) => { const yb = GROUND_Y - 130 + Math.sin(g.t * 3 + o.id) * 10; return { l: o.x + 10, r: o.x + o.w - 40, t: yb - 34, b: yb + 30 }; },
    draw: (ctx, o, x, g, t) => drawTentacle(ctx, o, x, t), hint: '↓ подкат под щупальце' },
  mirror:     { name: 'Зеркальный двойник', act: 'shoot', unlock: 405, weight: 1.6, w: 110, h: 260, speed: 150, hp: 2, pts: 80,
    box: (o) => foe(o, 20, 30), draw: (ctx, o, x, g, t) => { drawMirror(ctx, o, x, g, t); if (!o.dead) g.drawPips(ctx, x + o.w / 2, GROUND_Y - o.h - 10, o.hp, 2); },
    hint: '☝ двойник — два выстрела' },
  fogwall:    { name: 'Стена тумана', act: 'dash', unlock: 505, weight: 1.4, w: 120, h: 0, speed: 40, shadow: [0, 0], noBoss: true,
    box: (o) => ({ l: o.x + 20, r: o.x + o.w - 20, t: 0, b: GROUND_Y }),
    draw: (ctx, o, x, g, t) => drawFog(ctx, o, x, t), hint: '→ рывок сквозь туман' },
};

export const ENEMY_COUNT = Object.keys(ENEMY).length;
