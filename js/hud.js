// Экран телефона: чёрная резная рамка-окно, в которой идёт игра,
// и плашки сверху — жизни, глаз (он же кнопка паузы), счётчик денег.

import { W, H, SCREEN_W, PLAYER, FRAME_WINDOW } from './config.js?v=6a4a0cb';
import { recolor } from './pixels.js?v=6a4a0cb';
import { BY_ID, drawArtifactIcon } from './artifacts.js?v=6a4a0cb';
import { EXITS } from './rooms.js?v=6a4a0cb';
import { makeRng, inkLine, inkShape, inkEllipse, hatch, INK } from './art.js?v=6a4a0cb';

// Раскладка экрана под высоту телефона (в логических пикселях ширины 720).
// framed = есть нарисованная рамка frame.png: окно во всю ширину экрана.
export function computeLayout(screenH, framed = false) {
  const SW = SCREEN_W;
  const SH = Math.round(Math.max(1100, Math.min(1700, screenH)));
  const pad = framed ? 0 : 14;
  const winW = SW - pad * 2;
  const s = winW / W;
  const winH = Math.round(H * s);
  const winY = Math.round(SH * 0.4 - winH / 2);
  const hudH = 104;
  const hudY = winY - hudH - 34;
  // где рисовать картинку рамки, чтобы её прозрачное окно совпало с окном мира
  const fk = SW / FRAME_WINDOW.imgW;
  const frame = { k: fk, top: winY + winH / 2 - (FRAME_WINDOW.top + FRAME_WINDOW.bottom) / 2 * fk };
  return {
    SW, SH, framed, frame,
    win: { x: pad, y: winY, w: winW, h: winH, s },
    hud: { y: hudY, h: hudH },
    eye: { x: SW / 2, y: hudY + hudH / 2 + 6, rx: 78, ry: 44 },
  };
}

// Контур окна: прямоугольник со скруглёнными, чуть выпуклыми краями.
export function windowPath(ctx, r, grow = 0) {
  const x = r.x - grow, y = r.y - grow, w = r.w + grow * 2, h = r.h + grow * 2;
  const c = 46, b = 9;
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.quadraticCurveTo(x + w / 2, y - b, x + w - c, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + c);
  ctx.quadraticCurveTo(x + w + b, y + h / 2, x + w, y + h - c);
  ctx.quadraticCurveTo(x + w, y + h, x + w - c, y + h);
  ctx.quadraticCurveTo(x + w / 2, y + h + b, x + c, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - c);
  ctx.quadraticCurveTo(x - b, y + h / 2, x, y + c);
  ctx.quadraticCurveTo(x, y, x + c, y);
  ctx.closePath();
}

function curl(ctx, x, y, dir, size, rng, color = INK, width = 3) {
  // маленькая завитушка-спираль
  const pts = [];
  for (let i = 0; i <= 22; i++) {
    const a = i * 0.42;
    const r = size * (1 - i / 26);
    pts.push([x + Math.cos(a) * r * dir, y + Math.sin(a) * r]);
  }
  inkLine(ctx, pts, rng, 0.6, width, color);
}

// Статичная рамка (рисуется один раз): чёрное поле с вырезом-окном и щетинистыми мазками.
export function createFrame(L, img) {
  const c = document.createElement('canvas');
  c.width = L.SW; c.height = L.SH;
  const ctx = c.getContext('2d');
  if (img) {
    // нарисованная рамка автора; выше и ниже неё — просто чёрное поле
    const h = img.height * L.frame.k;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, L.SW, Math.ceil(L.frame.top) + 2);
    ctx.fillRect(0, Math.floor(L.frame.top + h) - 2, L.SW, L.SH);
    ctx.drawImage(img, 0, L.frame.top, L.SW, h);
    return c;
  }
  const rng = makeRng(42);
  ctx.fillStyle = '#050404';
  ctx.fillRect(0, 0, L.SW, L.SH);
  // вырез окна
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  windowPath(ctx, L.win);
  ctx.fill();
  ctx.restore();

  const w = L.win;
  // серые «щетинистые» мазки вокруг окна
  const per = 2 * (w.w + w.h);
  for (let i = 0; i < 420; i++) {
    let d = rng() * per, px, py, nx, ny;
    if (d < w.w) { px = w.x + d; py = w.y; nx = 0; ny = -1; }
    else if ((d -= w.w) < w.h) { px = w.x + w.w; py = w.y + d; nx = 1; ny = 0; }
    else if ((d -= w.h) < w.w) { px = w.x + w.w - d; py = w.y + w.h; nx = 0; ny = 1; }
    else { d -= w.w; px = w.x; py = w.y + w.h - d; nx = -1; ny = 0; }
    const off = 6 + rng() * 10, len = 8 + rng() * 26;
    const tx = -ny, ty = nx; // касательная
    const sx = px + nx * off, sy = py + ny * off;
    ctx.strokeStyle = `rgba(${90 + rng() * 40 | 0},${90 + rng() * 40 | 0},${90 + rng() * 40 | 0},${0.25 + rng() * 0.4})`;
    ctx.lineWidth = 1 + rng() * 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + tx * len * 0.5 + nx * 4, sy + ty * len * 0.5 + ny * 4, sx + tx * len + nx * (rng() * 10), sy + ty * len + ny * (rng() * 10));
    ctx.stroke();
  }
  // внутренний край: тёмно-серая и чёрная обводки
  ctx.save();
  windowPath(ctx, w, 7);
  ctx.strokeStyle = '#3a3836'; ctx.lineWidth = 6; ctx.stroke();
  windowPath(ctx, w, 1);
  ctx.strokeStyle = '#000'; ctx.lineWidth = 7; ctx.stroke();
  ctx.restore();
  // украшения: нижний центр и углы
  const bx = L.SW / 2, by = w.y + w.h + 14;
  ctx.save();
  inkShape(ctx, [[bx - 9, by + 2], [bx, by - 16], [bx + 9, by + 2], [bx, by + 12]], rng, '#2a2826', 1, 2);
  curl(ctx, bx - 14, by + 2, -1, 14, rng, '#4a4744', 2.5);
  curl(ctx, bx + 14, by + 2, 1, 14, rng, '#4a4744', 2.5);
  for (const [cx, cy, dx] of [[w.x + 20, w.y - 14, 1], [w.x + w.w - 20, w.y - 14, -1], [w.x + 20, w.y + w.h + 14, 1], [w.x + w.w - 20, w.y + w.h + 14, -1]]) {
    curl(ctx, cx, cy, dx, 11, rng, '#4a4744', 2.5);
  }
  ctx.restore();
  return c;
}

// Серая табличка с чернильной рамкой и завитушками по углам.
export function createPlaque(w, h, seed) {
  const m = 22;
  const c = document.createElement('canvas');
  c.width = w + m * 2; c.height = h + m * 2;
  const ctx = c.getContext('2d');
  const rng = makeRng(seed);
  const pts = [[m, m + 4], [m + w * 0.5, m - 2], [m + w, m + 4], [m + w - 3, m + h * 0.5], [m + w, m + h - 2], [m + w * 0.5, m + h + 2], [m, m + h - 3], [m + 3, m + h * 0.5]];
  inkShape(ctx, pts, rng, '#9c9a97', 1.5, 0);
  ctx.save();
  ctx.beginPath(); pts.forEach(([a, b], i) => i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)); ctx.closePath(); ctx.clip();
  // пятнистая текстура
  for (let i = 0; i < 140; i++) {
    ctx.fillStyle = `rgba(${rng() < 0.5 ? '255,255,255' : '40,40,40'},${0.04 + rng() * 0.06})`;
    ctx.beginPath(); ctx.arc(m + rng() * w, m + rng() * h, 3 + rng() * 14, 0, 7); ctx.fill();
  }
  // затемнение к краям
  const g = ctx.createRadialGradient(m + w / 2, m + h / 2, h * 0.3, m + w / 2, m + h / 2, w * 0.65);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
  hatch(ctx, m, m, w, 10, rng, 5, '#000', 0.25);
  ctx.restore();
  ctx.beginPath(); pts.forEach(([a, b], i) => i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)); ctx.closePath();
  ctx.strokeStyle = '#141211'; ctx.lineWidth = 5; ctx.stroke();
  // завитушки по углам (серые, как на эскизе)
  for (const [x, y, d] of [[m - 6, m + 2, -1], [m + w + 6, m + 2, 1], [m - 6, m + h - 2, -1], [m + w + 6, m + h - 2, 1]]) {
    curl(ctx, x, y, d, 12, rng, '#8e8b87', 3);
    inkLine(ctx, [[x - d * 4, y], [x + d * 14, y + (rng() - 0.5) * 6]], rng, 1, 2.5, '#8e8b87');
  }
  return c;
}

function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + 18 * s);
  ctx.lineTo(x - 22 * s, y - 2 * s);
  ctx.lineTo(x - 24 * s, y - 13 * s);
  ctx.lineTo(x - 15 * s, y - 22 * s);
  ctx.lineTo(x - 5 * s, y - 20 * s);
  ctx.lineTo(x, y - 12 * s);
  ctx.lineTo(x + 5 * s, y - 20 * s);
  ctx.lineTo(x + 15 * s, y - 22 * s);
  ctx.lineTo(x + 24 * s, y - 13 * s);
  ctx.lineTo(x + 22 * s, y - 2 * s);
  ctx.closePath();
}

function drawHeart(ctx, x, y, s, full, rng, pulse) {
  ctx.save();
  if (pulse) { ctx.translate(x, y); ctx.scale(1 + pulse, 1 + pulse); ctx.translate(-x, -y); }
  heartPath(ctx, x, y, s);
  ctx.fillStyle = full ? '#b3302c' : '#4f4d4b';
  ctx.fill();
  ctx.save(); ctx.clip();
  hatch(ctx, x - 26 * s, y - 24 * s, 52 * s, 44 * s, rng, 4, full ? '#4a0d0b' : '#111', 0.35, 1.2, 4);
  if (full) {
    ctx.fillStyle = 'rgba(255,180,160,0.35)';
    ctx.beginPath(); ctx.ellipse(x - 12 * s, y - 12 * s, 6 * s, 4 * s, -0.6, 0, 7); ctx.fill();
  }
  ctx.restore();
  heartPath(ctx, x, y, s);
  ctx.strokeStyle = INK; ctx.lineWidth = 4.5; ctx.lineJoin = 'round'; ctx.stroke();
  if (!full) inkLine(ctx, [[x - 2, y - 12 * s], [x + 4, y - 2 * s], [x - 3, y + 6 * s], [x + 2, y + 16 * s]], rng, 1, 3);
  ctx.restore();
}

function drawBag(ctx, x, y, rng) {
  const pts = [[x - 8, y - 22], [x + 8, y - 22], [x + 4, y - 14], [x + 20, y - 2], [x + 24, y + 14], [x + 18, y + 24], [x - 18, y + 24], [x - 24, y + 12], [x - 18, y - 2], [x - 4, y - 14]];
  inkShape(ctx, pts, rng, '#d8d3c8', 1.2, 3.5);
  inkLine(ctx, [[x - 9, y - 14], [x + 9, y - 14]], rng, 0.5, 3.5);
  inkLine(ctx, [[x - 10, y - 26], [x - 4, y - 21]], rng, 0.5, 2.5);
  inkLine(ctx, [[x + 10, y - 26], [x + 4, y - 21]], rng, 0.5, 2.5);
  inkEllipse(ctx, x, y + 8, 10, 10, rng, null, 2.5);
  ctx.fillStyle = INK; ctx.font = 'bold 22px "Amatic SC", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('$', x, y + 9);
}

// Глаз в центре HUD. look: -1..1 (куда смотрит зрачок), blink: 0..1
function drawEye(ctx, E, look, blink, rng) {
  const { x, y, rx, ry } = E;
  const open = 1 - blink;
  const almond = (sx, sy, k) => {
    ctx.beginPath();
    ctx.moveTo(x - sx, y);
    ctx.quadraticCurveTo(x, y - sy * 2 * k, x + sx, y);
    ctx.quadraticCurveTo(x, y + sy * 2 * k, x - sx, y);
    ctx.closePath();
  };
  // лучи-ресницы
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const r1 = 1.12, r2 = 1.35 + (i % 2) * 0.15;
    inkLine(ctx, [[x + Math.cos(a) * rx * r1, y + Math.sin(a) * ry * r1], [x + Math.cos(a) * rx * r2, y + Math.sin(a) * ry * r2]], rng, 1, 2.5, '#1a1817');
  }
  // слоистые контуры
  for (const [k, col, lw] of [[1.28, '#1a1817', 10], [1.14, '#5a5754', 3]]) {
    almond(rx * k, ry * k * 0.62, 1); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke();
  }
  almond(rx, ry * 0.62, Math.max(0.05, open));
  ctx.fillStyle = '#e9e4da'; ctx.fill();
  ctx.save(); ctx.clip();
  const px = x + look * rx * 0.35;
  inkEllipse(ctx, px, y, ry * 0.62, ry * 0.62, rng, '#8d8a86', 3);
  inkEllipse(ctx, px, y, ry * 0.4, ry * 0.4, rng, '#c9c4bb', 2);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(px, y, ry * 0.25, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px - 5, y - 5, 3, 0, 7); ctx.fill();
  ctx.restore();
  almond(rx, ry * 0.62, Math.max(0.05, open));
  ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke();
}

export class Hud {
  constructor(L, images = {}) {
    this.L = L;
    this.img = images;
    this.grayHeart = images.heart ? recolor(images.heart, { gray: 1, mul: [0.62, 0.62, 0.62] }) : null;
    const pw = 270, ph = L.hud.h;
    this.plaqueL = createPlaque(pw, ph, 5);
    this.plaqueR = createPlaque(pw, ph, 9);
    this.pw = pw;
    this.blinkT = 3;
    this.look = 0;
    this.lastLives = PLAYER.lives;
    this.heartPulse = 0;
  }

  // Попал ли тап по глазу (кнопка паузы)
  hitEye(x, y) {
    const E = this.L.eye;
    return Math.abs(x - E.x) < E.rx * 1.3 && Math.abs(y - E.y) < E.ry * 1.6;
  }

  draw(ctx, game, t, dt) {
    const L = this.L;
    const boil = Math.floor(t * 6);
    const R = (k) => makeRng(boil * 131 + k * 977 + 3);
    const m = 22;
    const y0 = L.hud.y;
    const I = this.img;
    const cyH = y0 + L.hud.h / 2;
    const PW = 322; // ширина нарисованной плашки
    if (I.plaque) {
      const ph = I.plaque.height * PW / I.plaque.width;
      ctx.drawImage(I.plaque, 4, cyH - ph / 2, PW, ph);
      ctx.drawImage(I.plaque, L.SW - 4 - PW, cyH - ph / 2, PW, ph);
    } else {
      ctx.drawImage(this.plaqueL, 18 - m, y0 - m);
      ctx.drawImage(this.plaqueR, L.SW - 18 - this.pw - m, y0 - m);
    }

    // сердца
    if (game.lives < this.lastLives) this.heartPulse = 1;
    this.lastLives = game.lives;
    this.heartPulse = Math.max(0, this.heartPulse - dt * 3);
    const nH = game.maxLives || PLAYER.lives;
    const hs = Math.min(1, 3.4 / nH);              // больше сердец — мельче
    for (let i = 0; i < nH; i++) {
      const full = i < game.lives;
      const pulse = i === game.lives ? this.heartPulse * 0.25 : 0;
      if (I.heart) {
        const hw = 72 * hs * (1 + pulse), hh = I.heart.height * hw / I.heart.width;
        const hx = 4 + PW * (nH === 1 ? 0.5 : 0.26 + i * Math.min(0.24, 0.5 / (nH - 1))), hy = cyH;
        ctx.save();
        // потерянное сердце — серое
        ctx.drawImage(full ? I.heart : this.grayHeart, hx - hw / 2, hy - hh / 2, hw, hh);
        ctx.restore();
      } else {
        drawHeart(ctx, 18 + 46 + i * 76, y0 + L.hud.h / 2 + 2, 1.38, full, R(i + 1), pulse);
      }
    }

    // счётчик денег
    const cx = I.plaque ? L.SW - 4 - PW / 2 - 4 : L.SW - 18 - this.pw / 2;
    ctx.fillStyle = INK;
    ctx.font = 'bold 76px "Amatic SC", serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(String(Math.min(999, game.coins)).padStart(3, '0'), cx + 34, y0 + L.hud.h / 2 + 4);
    ctx.font = 'bold 40px "Amatic SC", serif';
    ctx.fillText('×', cx + 64, y0 + L.hud.h / 2 + 6);
    drawBag(ctx, cx + 98, y0 + L.hud.h / 2, R(9));

    // глаз: следит за ближайшей угрозой, иногда моргает
    const tx = game.threatX?.();
    const target = tx === null || tx === undefined ? Math.sin(t * 0.7) * 0.3 : Math.min(1, -0.2 + tx * 1.4);
    this.look += (target - this.look) * Math.min(1, dt * 6);
    this.blinkT -= dt;
    let blink = 0;
    if (this.blinkT < 0.15) blink = Math.sin(Math.max(0, this.blinkT) / 0.15 * Math.PI);
    if (this.blinkT <= 0) this.blinkT = 2.5 + Math.random() * 4;
    if (game.p?.hurtT > 0) blink = 0.7;
    if (I.eye) {
      const ew = 210, eh = I.eye.height * ew / I.eye.width;
      ctx.save();
      ctx.translate(L.eye.x + this.look * 4, L.eye.y);
      ctx.scale(1, Math.max(0.12, 1 - blink * 0.9));
      ctx.drawImage(I.eye, -ew / 2, -eh / 2, ew, eh);
      ctx.restore();
    } else {
      drawEye(ctx, L.eye, this.look, blink, R(20));
    }

    // бледная подсказка жестов в нижней зоне — там удобно свайпать большим пальцем
    const w = L.win;
    const gy = w.y + w.h + (L.SH - w.y - w.h) * 0.66;
    ctx.save();
    ctx.globalAlpha = 0.62;
    ctx.fillStyle = '#ddd8d0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 64px "Amatic SC", serif';
    ctx.fillText('↑', L.SW / 2, gy - 96);
    ctx.fillText('↓', L.SW / 2, gy + 96);
    ctx.fillText('←', L.SW / 2 - 150, gy);
    ctx.fillText('→', L.SW / 2 + 150, gy - 40);
    ctx.font = 'bold 36px "Amatic SC", serif';
    ctx.fillText(game.is3d ? 'вправо' : 'рывок', L.SW / 2 + 150, gy + 6);
    ctx.fillText('прыжок', L.SW / 2, gy - 52);
    ctx.fillText('подкат', L.SW / 2, gy + 52);
    ctx.fillText(game.is3d ? 'влево' : 'пинок', L.SW / 2 - 150, gy + 46);
    ctx.fillText('тап — выстрел', L.SW / 2, gy + 150);
    ctx.restore();

    // артефакты, взятые в забег — под прогрессом
    const eq = (game.opts?.equipped || []).map(id => BY_ID[id]).filter(Boolean);
    if (eq.length && !game.opts?.demo) {
      const ay = w.y + w.h + 150, step = 92, ax0 = L.SW / 2 - (eq.length - 1) * step / 2;
      eq.forEach((a, i) => drawArtifactIcon(ctx, a, ax0 + i * step, ay, 76));
      ctx.save();
      ctx.font = 'bold 30px "Amatic SC", serif'; ctx.fillStyle = '#8e8b87'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const extra = [];
      if (game.shield > 0) extra.push(`щит ×${game.shield}`);
      if (game.revives > 0) extra.push(`воскрешение ×${game.revives}`);
      ctx.fillText(extra.length ? extra.join(' · ') : 'с собой', L.SW / 2, ay + 56);
      ctx.restore();
    }

    // прогресс до выхода — под окном
    const py = w.y + w.h + 52;
    const prog = game.progress;
    ctx.font = 'bold 34px "Amatic SC", serif';
    ctx.textBaseline = 'middle';
    if (prog !== null && prog !== undefined) {
      const x0 = 70, x1 = L.SW - 110;
      inkLine(ctx, [[x0, py], [x1, py]], R(30), 1, 3, '#4a4744');
      for (let i = 0; i <= 10; i++) inkLine(ctx, [[x0 + (x1 - x0) * i / 10, py - 6], [x0 + (x1 - x0) * i / 10, py + 6]], R(31 + i), 0.5, 2, '#4a4744');
      const mx = x0 + (x1 - x0) * prog;
      inkShape(ctx, [[mx, py - 12], [mx + 9, py], [mx, py + 12], [mx - 9, py]], R(50), '#b3302c', 0.8, 2.5);
      ctx.fillStyle = '#8e8b87'; ctx.textAlign = 'left';
      ctx.fillText(game.level?.doorLabel === 'ВХОД' ? 'вход' : (EXITS[game.level?.exit]?.hud || 'выход'), x1 + 14, py + 2);
      ctx.textAlign = 'center';
      if (game.level?.room) ctx.fillText(`комната ${game.level.room} · ${game.level.place}`, L.SW / 2, py + 44);
    } else if (game.boss && !game.boss.dead) {
      ctx.fillStyle = '#b3302c'; ctx.textAlign = 'center';
      ctx.fillText(`комната ${game.level.room} · хранитель акта`, L.SW / 2, py + 2);
    } else {
      ctx.fillStyle = '#8e8b87'; ctx.textAlign = 'center';
      ctx.fillText(`${game.meters} м   ·   счёт ${game.score}`, L.SW / 2, py + 2);
    }
  }
}
