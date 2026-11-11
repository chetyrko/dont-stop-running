// Процедурная «рисованная» графика: мятая бумага, чернильные дрожащие линии,
// штриховка, акварельные пятна. Всё это — временный арт, пока нет настоящих
// рисунков. Любой объект можно заменить картинкой через CUSTOM_ART в config.js.

import { W, H, FLOOR_TOP } from './config.js?v=df30514';

export const INK = '#16120f';
export const PAPER = '#e8dcc4';
export const PAPER_DARK = '#d6c6a8';

// ---------- случайные числа с зерном ----------
export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// ---------- базовые чернильные приёмы ----------

// Дрожащая линия по точкам. rng — чтобы линия «кипела» (line boil).
export function inkLine(ctx, pts, rng, jitter = 1.6, width = 3, color = INK) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    const jx = (rng() - 0.5) * jitter, jy = (rng() - 0.5) * jitter;
    if (i === 0) ctx.moveTo(x + jx, y + jy); else ctx.lineTo(x + jx, y + jy);
  }
  ctx.stroke();
}

// Замкнутая дрожащая фигура с заливкой.
export function inkShape(ctx, pts, rng, fill, jitter = 1.6, width = 3) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const jx = (rng() - 0.5) * jitter, jy = (rng() - 0.5) * jitter;
    if (i === 0) ctx.moveTo(x + jx, y + jy); else ctx.lineTo(x + jx, y + jy);
  });
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (width > 0) {
    ctx.strokeStyle = INK; ctx.lineWidth = width; ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

export function inkEllipse(ctx, cx, cy, rx, ry, rng, fill, width = 3, rot = 0) {
  const pts = [];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 1 + (rng() - 0.5) * 0.08;
    const x = Math.cos(a) * rx * r, y = Math.sin(a) * ry * r;
    pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  ctx.beginPath();
  // сглаживаем через квадратичные кривые
  for (let i = 0; i <= n; i++) {
    const p = pts[i % n], q = pts[(i + 1) % n];
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    if (i === 0) ctx.moveTo(mx, my); else ctx.quadraticCurveTo(p[0], p[1], mx, my);
  }
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (width > 0) { ctx.strokeStyle = INK; ctx.lineWidth = width; ctx.stroke(); }
}

// Вертикальная штриховка внутри прямоугольника (или текущего clip).
export function hatch(ctx, x, y, w, h, rng, step = 6, color = INK, alpha = 0.55, width = 1.3, slant = 0) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  for (let i = x; i < x + w; i += step) {
    const top = y + rng() * h * 0.15;
    const bot = y + h - rng() * h * 0.15;
    ctx.moveTo(i + (rng() - 0.5) * 2, top);
    ctx.lineTo(i + slant + (rng() - 0.5) * 2, bot);
  }
  ctx.stroke();
  ctx.restore();
}

// Акварельное пятно: несколько полупрозрачных неровных клякс.
export function watercolor(ctx, cx, cy, r, color, rng, alpha = 0.18) {
  ctx.save();
  ctx.fillStyle = color;
  for (let k = 0; k < 5; k++) {
    ctx.globalAlpha = alpha * (0.5 + rng() * 0.6);
    ctx.beginPath();
    const n = 18;
    const ox = (rng() - 0.5) * r * 0.5, oy = (rng() - 0.5) * r * 0.4;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = r * (0.6 + rng() * 0.45);
      const x = cx + ox + Math.cos(a) * rr, y = cy + oy + Math.sin(a) * rr * 0.75;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ---------- бумага ----------

// Основа: бежевая бумага с волокнами и акварельными разводами.
export function createPaper(palette, seed = 7) {
  const c = canvas(W, H), ctx = c.getContext('2d');
  const rng = makeRng(seed);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  // мелкое зерно
  const img = ctx.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rng() - 0.5) * 18;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  // акварель
  const wash = palette?.wash || ['#c9a9a6', '#a9b8a0'];
  for (let i = 0; i < 7; i++) {
    watercolor(ctx, rng() * W, rng() * H * 0.7, 120 + rng() * 220, wash[i % wash.length], rng, 0.16);
  }
  // небо темнее к верху
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(40,30,25,0.28)');
  g.addColorStop(0.55, 'rgba(40,30,25,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  return c;
}

// Наложение поверх всего кадра (режим multiply): складки мятой бумаги + виньетка.
export function createPaperOverlay(seed = 3) {
  const c = canvas(W, H), ctx = c.getContext('2d');
  const rng = makeRng(seed);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  // складки: полигоны чуть темнее/светлее
  for (let i = 0; i < 26; i++) {
    const x = rng() * W, y = rng() * H;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 3; k++) ctx.lineTo(x + (rng() - 0.5) * 520, y + (rng() - 0.5) * 380);
    ctx.closePath();
    ctx.fillStyle = `rgba(120,100,80,${0.03 + rng() * 0.06})`;
    ctx.fill();
  }
  // линии заломов
  for (let i = 0; i < 22; i++) {
    let x = rng() * W, y = rng() * H;
    const a = rng() * Math.PI * 2;
    ctx.strokeStyle = `rgba(90,70,55,${0.1 + rng() * 0.12})`;
    ctx.lineWidth = 0.8 + rng();
    ctx.beginPath();
    ctx.moveTo(x, y);
    const len = 80 + rng() * 260;
    for (let s = 0; s < 6; s++) {
      x += Math.cos(a) * len / 6 + (rng() - 0.5) * 14;
      y += Math.sin(a) * len / 6 + (rng() - 0.5) * 14;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // виньетка
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(40,25,15,0.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  return c;
}

// ---------- фоновые слои (бесшовные полосы) ----------

export const LAYER_W = 2400; // кратно периоду полос, шире кадра

// Стена: полосатые обои с разводами + портреты и картины в рамах.
export function createWallLayer(palette, seed = 11) {
  const c = canvas(LAYER_W, FLOOR_TOP + 10), ctx = c.getContext('2d');
  const rng = makeRng(seed);
  const [light, dark] = palette?.stripes || ['#e4d8c0', '#cbbd9f'];
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, LAYER_W, c.height);
  // полосы: широкая тёмная, узкая светлая, с неровными краями
  const period = 48;
  for (let x = 0; x < LAYER_W; x += period) {
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(x + 6, 0);
    for (let y = 0; y <= c.height; y += 40) ctx.lineTo(x + 6 + (rng() - 0.5) * 2.5, y);
    for (let y = c.height; y >= 0; y -= 40) ctx.lineTo(x + 30 + (rng() - 0.5) * 2.5, y);
    ctx.closePath();
    ctx.fill();
    // тонкая тень у края полосы
    ctx.fillStyle = 'rgba(80,60,40,0.10)';
    ctx.fillRect(x + 28, 0, 4, c.height);
  }
  // разводы и пятна (рисуем с переносом через край — чтобы полоса была бесшовной)
  const stain = (x, y, r, col, a) => {
    for (const ox of [0, -LAYER_W, LAYER_W]) watercolor(ctx, x + ox, y, r, col, makeRng((x * 3 + y) | 0), a);
  };
  for (let i = 0; i < 16; i++) stain(rng() * LAYER_W, rng() * c.height, 80 + rng() * 160, '#8a7458', 0.06);
  for (let i = 0; i < 40; i++) stain(rng() * LAYER_W, rng() * c.height, 10 + rng() * 30, '#7a6448', 0.07);
  // темнее к потолку и к полу
  const g = ctx.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, 'rgba(30,22,15,0.45)');
  g.addColorStop(0.25, 'rgba(30,22,15,0)');
  g.addColorStop(0.85, 'rgba(30,22,15,0)');
  g.addColorStop(1, 'rgba(30,22,15,0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LAYER_W, c.height);

  // картины и портреты
  const frameCol = palette?.frame || '#a69b8c';
  let x = 140;
  while (x < LAYER_W - 260) {
    const r = makeRng((x * 17 + seed) | 0);
    const k = r();
    if (k < 0.35) {
      drawPortrait(ctx, x, 150 + r() * 90, 70 + r() * 20, r, frameCol);
      x += 120 + r() * 60;
    } else if (k < 0.75) {
      const w = 100 + r() * 120, h = 80 + r() * 80;
      drawPicture(ctx, x, 110 + r() * 150, w, h, r, frameCol);
      x += w + 60 + r() * 140;
    } else {
      drawSconce(ctx, x, 230 + r() * 30, r);
      x += 140 + r() * 120;
    }
  }
  return c;
}

// Овальный портрет: силуэт с горящими глазами.
function drawPortrait(ctx, cx, cy, r, rng, col) {
  inkEllipse(ctx, cx, cy, r * 0.78, r, rng, shade(col, -18), 4);
  inkEllipse(ctx, cx, cy, r * 0.62, r * 0.84, rng, shade(col, 12), 2.5);
  ctx.save();
  ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.6, r * 0.82, 0, 0, 7); ctx.clip();
  // плечи и голова
  ctx.fillStyle = shade(col, -45);
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.85, r * 0.6, r * 0.45, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.05, r * 0.26, r * 0.32, 0, 0, 7); ctx.fill();
  if (rng() < 0.5) { // причёска
    ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.15, r * 0.34, r * 0.24, 0, 0, 7); ctx.fill();
  }
  ctx.fillStyle = '#f4ecd6';
  ctx.beginPath(); ctx.arc(cx - r * 0.1, cy + r * 0.02, 3, 0, 7); ctx.arc(cx + r * 0.1, cy + r * 0.02, 3, 0, 7); ctx.fill();
  hatch(ctx, cx - r, cy - r, r * 2, r * 2, rng, 6, '#000', 0.18, 1);
  ctx.restore();
}

// Прямоугольная картина: домик / дерево / пейзаж набросками.
function drawPicture(ctx, x, y, w, h, rng, col) {
  inkShape(ctx, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], rng, shade(col, -15), 1.5, 4);
  inkShape(ctx, [[x + 10, y + 10], [x + w - 10, y + 10], [x + w - 10, y + h - 10], [x + 10, y + h - 10]], rng, shade(col, 15), 1.2, 2.5);
  ctx.save();
  ctx.beginPath(); ctx.rect(x + 12, y + 12, w - 24, h - 24); ctx.clip();
  const ink = 'rgba(40,32,26,0.55)';
  const kind = rng();
  const cx = x + w / 2, by = y + h - 18;
  if (kind < 0.33) { // домик
    inkLine(ctx, [[cx - 22, by], [cx - 22, by - 30], [cx, by - 50], [cx + 22, by - 30], [cx + 22, by], [cx - 22, by]], rng, 2, 2.5, ink);
    inkLine(ctx, [[cx - 6, by], [cx - 6, by - 14], [cx + 6, by - 14], [cx + 6, by]], rng, 1, 2, ink);
  } else if (kind < 0.66) { // кривое дерево
    inkLine(ctx, [[cx, by], [cx + 3, by - h * 0.4], [cx - 10, by - h * 0.6]], rng, 2, 3, ink);
    inkLine(ctx, [[cx + 3, by - h * 0.35], [cx + 18, by - h * 0.55]], rng, 2, 2, ink);
  } else { // холмы и луна
    inkLine(ctx, [[x + 12, by - 6], [cx - 20, by - 26], [cx + 10, by - 12], [x + w - 12, by - 30]], rng, 2, 2.5, ink);
    inkEllipse(ctx, x + w - 34, y + 30, 9, 9, rng, null, 2);
  }
  for (let i = 0; i < 8; i++) inkLine(ctx, [[x + 14 + rng() * (w - 28), y + 14 + rng() * (h - 28)], [x + 14 + rng() * (w - 28), y + 14 + rng() * (h - 28)]], rng, 1, 1, 'rgba(40,32,26,0.25)');
  ctx.restore();
}

function drawSconce(ctx, x, y, rng) {
  inkShape(ctx, [[x - 10, y + 30], [x + 10, y + 30], [x + 6, y + 50], [x - 6, y + 50]], rng, '#5a4a3a', 1, 2.5);
  inkLine(ctx, [[x, y + 30], [x, y + 8]], rng, 1, 3);
  inkShape(ctx, [[x - 5, y + 8], [x + 5, y + 8], [x + 5, y - 14], [x - 5, y - 14]], rng, '#efe4cc', 0.8, 2);
  inkShape(ctx, [[x, y - 30], [x + 5, y - 18], [x, y - 14], [x - 5, y - 18]], rng, '#e8b94a', 0.8, 1.5);
  watercolor(ctx, x, y - 22, 46, '#f3d58a', rng, 0.1);
}

function shade(hex, d) {
  const n = parseInt(hex.slice(1), 16);
  const cl = (v) => Math.max(0, Math.min(255, v + d));
  return `rgb(${cl(n >> 16)},${cl((n >> 8) & 255)},${cl(n & 255)})`;
}

// Пол: деревянные доски. Бесшовная полоса LAYER_W.
export function createFloorLayer(palette, seed = 5) {
  const hgt = H - FLOOR_TOP + 10;
  const c = canvas(LAYER_W, hgt), ctx = c.getContext('2d');
  const rng = makeRng(seed);
  const base = palette?.floor || '#776a5b';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, LAYER_W, hgt);
  // ряды досок
  const rows = [0, 22, 50, 86, 130];
  for (let r = 0; r < rows.length - 1; r++) {
    const y0 = rows[r] + 4, y1 = rows[r + 1] + 4;
    ctx.fillStyle = shade(base, r % 2 ? -8 : 6);
    ctx.fillRect(0, y0, LAYER_W, y1 - y0);
    inkLine(ctx, [[0, y1], [LAYER_W, y1]], rng, 0, 2, 'rgba(30,22,16,0.55)');
    // стыки досок
    let x = rng() * 200;
    const plank = 260 + r * 40;
    while (x < LAYER_W) {
      inkLine(ctx, [[x, y0], [x, y1]], rng, 0.5, 2, 'rgba(30,22,16,0.55)');
      x += plank;
    }
    hatch(ctx, 0, y0, LAYER_W, y1 - y0, rng, 9, '#20170f', 0.22, 1, 0);
  }
  // тень от стены
  const g = ctx.createLinearGradient(0, 0, 0, 40);
  g.addColorStop(0, 'rgba(20,14,10,0.55)'); g.addColorStop(1, 'rgba(20,14,10,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, LAYER_W, 40);
  // плинтус
  ctx.fillStyle = '#4a3d31'; ctx.fillRect(0, 0, LAYER_W, 6);
  inkLine(ctx, [[0, 1], [LAYER_W, 1]], rng, 0, 3);
  return c;
}

// ---------- персонажи ----------

// Конечность из двух сегментов. Углы — от вертикали вниз, + = вперёд (вправо).
function limb(ctx, x, y, l1, a1, l2, a2, w, rng, color = INK) {
  const kx = x + Math.sin(a1) * l1, ky = y + Math.cos(a1) * l1;
  const ex = kx + Math.sin(a2) * l2, ey = ky + Math.cos(a2) * l2;
  inkLine(ctx, [[x, y], [kx, ky], [ex, ey]], rng, 1, w, color);
  return [ex, ey, kx, ky];
}

// Герой в красной рубашке. (x, y) — точка между ступнями, рост ≈ 150 (базовый).
// pose: run|jump|slide|kick|idle. extra: { kickT, recoil, flash, hurt, aim }
export function drawHero(ctx, x, y, pose, t, skin, rng, extra = {}) {
  const phase = t * 12;
  const s = Math.sin(phase);
  let hipY = y - 70, lean = 0.22;
  let legs, backArm = [-0.6 - s * 0.7, 0.4];
  const aim = extra.aim || extra.recoil > 0;

  if (pose === 'run') {
    // широкий мультяшный шаг, как на рисунке
    legs = [[s * 0.95, s * 0.95 - 0.5 - Math.max(0, -s) * 1.2], [-s * 0.95, -s * 0.95 - 0.5 - Math.max(0, s) * 1.2]];
    hipY -= Math.abs(Math.cos(phase)) * 6;
  } else if (pose === 'idle') {
    legs = [[0.12, 0.02], [-0.12, -0.02]]; lean = 0.04; backArm = [-0.15, 0.1];
  } else if (pose === 'jump') {
    legs = [[1.1, -0.2], [-0.5, -1.6]]; lean = 0.1; backArm = [-2.2, -1.6];
  } else if (pose === 'slide') {
    hipY = y - 20; lean = -1.2;
    legs = [[1.55, 1.6], [1.25, 1.95]]; backArm = [-2.4, -2.0];
  } else if (pose === 'kick') {
    const k = extra.kickT ?? 0.5;
    const ext = Math.sin(Math.min(1, k * 1.6) * Math.PI);
    legs = [[0.3 + ext * 1.4, 0.3 + ext * 1.5], [-0.3, -0.4]];
    lean = -0.3 * ext; backArm = [-2.0, -1.2];
  } else {
    legs = [[0.2, -0.2], [-0.3, -0.6]];
  }

  const torso = 50;
  const sx = x + Math.sin(lean) * torso, sy = hipY - Math.cos(lean) * torso;
  const nx = sx + Math.sin(lean) * 8, ny = sy - Math.cos(lean) * 8;   // шея
  const hx = nx + Math.sin(lean) * 22, hy = ny - Math.cos(lean) * 22; // центр головы
  const pants = skin.pants || '#191615';

  // дальняя рука (чёрная, машет)
  limb(ctx, sx - 4, sy + 6, 26, backArm[0], 24, backArm[1], 8, rng, '#0f0c0b');
  // дальняя нога
  const f2 = limb(ctx, x - 2, hipY, 38, legs[1][0], 38, legs[1][1], 12, rng, '#0f0c0b');
  inkLine(ctx, [[f2[0], f2[1]], [f2[0] + 14, f2[1] + 2]], rng, 0.5, 8, '#0f0c0b');

  // торс — рубашка
  const px = Math.cos(lean), py = Math.sin(lean);
  const shirt = [
    [sx - px * 17, sy - py * 17 + 2],
    [sx + px * 15, sy + py * 15 - 2],
    [x + px * 12, hipY + py * 12],
    [x - px * 12, hipY - py * 12],
  ];
  inkShape(ctx, shirt, rng, skin.shirt, 1.4, 3.5);
  ctx.save();
  ctx.beginPath(); shirt.forEach(([a, b], i) => i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)); ctx.clip();
  // складки и тень рубашки
  hatch(ctx, x - 60, sy - 30, 34, 130, rng, 4, '#3b0d0b', 0.45, 1.3, 3);
  inkLine(ctx, [[sx + px * 2, sy + 10], [x + px * 4 + 3, hipY - 14]], rng, 1, 1.6, 'rgba(40,8,6,0.6)');
  inkLine(ctx, [[sx - px * 6, sy + 22], [x - px * 4, hipY - 6]], rng, 1, 1.4, 'rgba(40,8,6,0.5)');
  ctx.restore();
  // ремень
  inkLine(ctx, [[x - px * 13, hipY - py * 13 - 2], [x + px * 13, hipY + py * 13 - 2]], rng, 0.5, 6, '#0f0c0b');

  // ближняя нога (штаны в тонкую полоску)
  const f1 = limb(ctx, x + 2, hipY, 38, legs[0][0], 38, legs[0][1], 13, rng, pants);
  inkLine(ctx, [[x + 2, hipY], [f1[2], f1[3]], [f1[0], f1[1]]], rng, 0.4, 1.3, 'rgba(120,110,100,0.5)');
  inkLine(ctx, [[f1[0], f1[1]], [f1[0] + 16, f1[1] + 2]], rng, 0.5, 9, '#0f0c0b');

  // шея и голова: квадратная челюсть, бледная кожа
  inkLine(ctx, [[nx, ny + 4], [hx, hy + 14]], rng, 0.5, 9, '#e9dfcc');
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(lean * 0.6);
  const face = [[-13, -16], [12, -18], [16, -4], [17, 12], [10, 20], [-6, 20], [-14, 10]];
  inkShape(ctx, face, rng, '#efe6d4', 1, 3);
  ctx.save();
  ctx.beginPath(); face.forEach(([a, b], i) => i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)); ctx.clip();
  hatch(ctx, -16, -18, 10, 40, rng, 3.5, '#6b5a48', 0.5, 1); // тень на затылке
  ctx.restore();
  // ухо
  inkEllipse(ctx, -9, 2, 4, 6, rng, '#e4d6bf', 2);
  // глаз и бровь
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(8, -3, 2.6, 0, 7); ctx.fill();
  inkLine(ctx, [[1, -10], [14, -7]], rng, 0.8, 3);
  // нос
  inkLine(ctx, [[14, -2], [20, 6], [14, 7]], rng, 0.6, 2.2);
  // рот
  if (extra.hurt) inkShape(ctx, [[5, 12], [14, 11], [13, 17], [6, 17]], rng, '#fff', 0.5, 2);
  else inkLine(ctx, [[6, 13], [13, 12]], rng, 0.6, 2.2);
  // волосы: зализанные назад с коком
  if (skin.hat === 'none') {
    inkShape(ctx, [[-16, 0], [-17, -14], [-10, -24], [4, -27], [18, -24], [14, -18], [2, -16], [-8, -14], [-11, -4]], rng, INK, 1, 2);
  }
  drawHeadwear(ctx, skin.hat, rng);
  ctx.restore();

  // ближняя рука с пистолетом: в беге поднят вверх, при выстреле — вперёд
  const sh = [sx + px * 6, sy + 4];
  let hand;
  if (pose === 'slide') hand = limb(ctx, sh[0], sh[1], 22, 1.9, 22, 1.6, 9, rng, '#0f0c0b');
  else if (aim) hand = limb(ctx, sh[0], sh[1], 24, 1.45, 22, 1.55, 9, rng, '#0f0c0b');
  else hand = limb(ctx, sh[0], sh[1], 22, 0.9, 22, 3.0, 9, rng, '#0f0c0b');
  // рукав рубашки поверх плеча
  inkEllipse(ctx, sh[0], sh[1] + 4, 11, 9, rng, skin.shirt, 2.5);
  drawPistol(ctx, hand[0], hand[1], aim || pose === 'slide' ? 0 : -Math.PI / 2 + 0.25, extra.recoil || 0, rng);
  if (extra.flash > 0) {
    const mx = hand[0] + 34, my = hand[1] - 4;
    ctx.save();
    ctx.globalAlpha = Math.min(1, extra.flash * 8);
    inkShape(ctx, [[mx, my - 4], [mx + 18, my - 14], [mx + 12, my - 2], [mx + 30, my], [mx + 12, my + 4], [mx + 18, my + 14], [mx, my + 4]], rng, '#f2c14e', 2, 2);
    ctx.restore();
  }
}

// Головные уборы скинов (в системе координат головы).
export function drawHeadwear(ctx, hat, rng) {
  if (hat === 'tophat') {
    inkShape(ctx, [[-22, -16], [24, -18], [22, -24], [-20, -22]], rng, INK, 1, 2);
    inkShape(ctx, [[-12, -22], [14, -23], [16, -62], [-10, -60]], rng, '#1d1a20', 1, 3);
    inkLine(ctx, [[-12, -30], [15, -31]], rng, 0.5, 4, '#7a2f35');
  } else if (hat === 'plague') {
    inkShape(ctx, [[-24, -16], [28, -18], [18, -26], [-16, -24]], rng, INK, 1, 2);
    inkShape(ctx, [[-12, -24], [14, -25], [10, -44], [-8, -43]], rng, '#2a2622', 1, 3);
    inkShape(ctx, [[10, -4], [46, 16], [10, 12]], rng, '#cdbf9f', 1, 2.5);
    inkEllipse(ctx, 7, -3, 6, 6, rng, '#d3a54a', 2.5);
  } else if (hat === 'tricorn') {
    inkShape(ctx, [[-26, -14], [-8, -36], [6, -28], [22, -38], [30, -16]], rng, '#2c2118', 1.2, 3);
    inkLine(ctx, [[-18, -24], [-30, -44]], rng, 1, 2, '#b08a3e');
  }
}

function drawPistol(ctx, x, y, ang, recoil, rng) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang - recoil * 0.5);
  // рукоять
  inkShape(ctx, [[-4, -2], [4, -2], [2, 14], [-7, 12]], rng, '#6b4a2e', 0.8, 2.5);
  // ствол и барабан
  inkShape(ctx, [[-6, -8], [28, -8], [30, -2], [-6, -1]], rng, '#4a4440', 0.8, 2.5);
  inkEllipse(ctx, 3, -4, 6, 5, rng, '#5b5550', 2);
  ctx.restore();
}

// Монстр-тень: чёрное тело, череп вместо лица, длинные руки с когтями вверх.
// (x — левый край хитбокса, y — пол). Смотрит влево, на героя.
export function drawMonster(ctx, x, y, w, h, t, rng, dead = 0) {
  const cx = x + w * 0.55;
  const ph = t * 7;
  const step = Math.sin(ph);
  ctx.save();
  if (dead) { ctx.globalAlpha = 1 - dead; ctx.translate(cx, y); ctx.rotate(dead * 1.1); ctx.scale(1 - dead * 0.3, 1 - dead * 0.3); ctx.translate(-cx, -y); }
  const bodyTop = y - h * 0.62, bodyBot = y - h * 0.2;
  // ноги — тонкие, волнистые
  inkLine(ctx, [[cx - 10, bodyBot], [cx - 26 + step * 12, y - h * 0.1], [cx - 34 + step * 22, y - 4], [cx - 52 + step * 22, y]], rng, 2, 11);
  inkLine(ctx, [[cx + 14, bodyBot], [cx + 30 - step * 10, y - h * 0.1], [cx + 22 - step * 18, y - 4], [cx + 36 - step * 18, y]], rng, 2, 11);
  // руки поднятые вверх
  const arm = (bx, by, dir, off) => {
    const wv = Math.sin(ph + off) * 10;
    const ex = bx + dir * 40 + wv, ey = y - h + 30 + Math.cos(ph + off) * 6;
    inkLine(ctx, [[bx, by], [bx + dir * 30 + wv * 0.5, by - h * 0.22], [ex, ey]], rng, 2, 14);
    // кисть с когтями
    for (let k = 0; k < 4; k++) {
      const a = -Math.PI / 2 + (k - 1.5) * 0.45 + dir * 0.2;
      const len = 26 + (k % 2) * 6;
      const tx = ex + Math.cos(a) * len, ty = ey + Math.sin(a) * len;
      inkLine(ctx, [[ex, ey], [ex + Math.cos(a) * len * 0.6, ey + Math.sin(a) * len * 0.6], [tx + dir * 6, ty + 6]], rng, 1, 4);
    }
  };
  arm(cx - 26, bodyTop + 20, -1, 0);
  arm(cx + 22, bodyTop + 14, 1, 1.7);
  // тело — чёрный сгорбленный мешок
  const body = [
    [cx - 36, bodyTop + 10], [cx - 10, bodyTop - 16], [cx + 30, bodyTop - 6], [cx + 46, bodyTop + 40],
    [cx + 40, bodyBot], [cx + 10, bodyBot + 18], [cx - 30, bodyBot + 6], [cx - 44, bodyTop + 60],
  ];
  inkShape(ctx, body, rng, '#0e0b0b', 2, 3);
  // череп (сбоку, к герою)
  const sxk = cx - 30, syk = bodyTop + 34;
  inkShape(ctx, [[sxk - 20, syk - 16], [sxk + 4, syk - 26], [sxk + 22, syk - 14], [sxk + 20, syk + 8], [sxk + 8, syk + 14], [sxk + 4, syk + 30], [sxk - 6, syk + 32], [sxk - 14, syk + 18], [sxk - 22, syk + 4]], rng, '#ece5d4', 1, 2.5);
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.ellipse(sxk - 9, syk - 6, 5.5, 6.5, 0, 0, 7); ctx.ellipse(sxk + 8, syk - 8, 5, 6, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#f4ead2';
  ctx.beginPath(); ctx.arc(sxk - 8, syk - 5, 1.6, 0, 7); ctx.arc(sxk + 9, syk - 7, 1.6, 0, 7); ctx.fill();
  // нос и зубы
  inkLine(ctx, [[sxk - 1, syk + 2], [sxk + 2, syk + 7]], rng, 0.3, 2);
  for (let k = 0; k < 3; k++) inkLine(ctx, [[sxk - 8 + k * 6, syk + 14], [sxk - 7 + k * 6, syk + 22]], rng, 0.3, 1.6);
  ctx.restore();
}

// Летающая хрень: колючая ворона-летучая мышь с клювом (смотрит влево).
export function drawFlyer(ctx, x, y, w, h, t, rng, dead = 0) {
  const cx = x + w / 2, cy = y - h / 2;
  const flap = Math.sin(t * 18);
  const k = w / 92;
  ctx.save();
  if (dead) ctx.globalAlpha = 1 - dead;
  ctx.translate(cx, cy); ctx.scale(k, k);
  const wy = flap * 26;
  inkShape(ctx, [[-4, -4], [18, -20 - wy], [30, -34 - wy * 1.4], [26, -18 - wy], [40, -24 - wy], [16, 2]], rng, '#1d1719', 1.5, 2.5);
  inkEllipse(ctx, 0, 0, 29, 17, rng, '#1d1719', 3);
  inkShape(ctx, [[26, -4], [50, -12], [44, 2], [53, 10], [24, 6]], rng, '#1d1719', 1.5, 2.5);
  inkShape(ctx, [[-24, -6], [-60, 2], [-24, 6]], rng, '#c9a24a', 1, 2.5);
  inkEllipse(ctx, -13, -6, 6, 6, rng, '#f4ead2', 2);
  ctx.fillStyle = '#b3242a';
  ctx.beginPath(); ctx.arc(-15, -6, 2.4, 0, 7); ctx.fill();
  inkShape(ctx, [[2, 0], [-6, -22 - wy * 1.2], [-22, -38 - wy * 1.6], [-12, -16 - wy], [-26, -14 - wy * 0.8], [-8, 6]], rng, '#2a2225', 1.5, 2.5);
  ctx.restore();
}

// Мебель: шкаф / часы / книжный шкаф. variant 0..2
export function drawFurniture(ctx, x, y, w, h, variant, rng) {
  const tilt = 0.03;
  ctx.save();
  ctx.translate(x + w / 2, y);
  ctx.rotate(tilt * (variant - 1));
  const l = -w / 2, r = w / 2, top = -h;
  if (variant === 1) {
    // напольные часы
    inkShape(ctx, [[l + 6, 0], [l + 6, top + 60], [l - 2, top + 50], [l + 4, top + 6], [0, top - 10], [r - 4, top + 6], [r + 2, top + 50], [r - 6, top + 60], [r - 6, 0]], rng, '#5b3f2c', 2, 3.5);
    inkEllipse(ctx, 0, top + 34, w * 0.36, w * 0.36, rng, '#efe4cf', 2.5);
    inkLine(ctx, [[0, top + 34], [6, top + 20]], rng, 0.5, 2.5);
    inkLine(ctx, [[0, top + 34], [-10, top + 38]], rng, 0.5, 2.5);
    inkShape(ctx, [[l + 14, top + 80], [r - 14, top + 80], [r - 14, -20], [l + 14, -20]], rng, '#2c1f17', 1, 2.5);
    inkLine(ctx, [[0, top + 84], [Math.sin(Date.now() / 300) * 8, top + 140]], rng, 0.5, 2, '#c9a24a');
    hatch(ctx, l + 6, top + 60, w * 0.3, h - 60, rng, 4, '#000', 0.5);
  } else if (variant === 2) {
    // книжный шкаф
    inkShape(ctx, [[l, 0], [l, top], [r, top - 4], [r, 0]], rng, '#4e3626', 2, 3.5);
    const shelves = 4;
    for (let i = 1; i <= shelves; i++) {
      const sy = top + (h / (shelves + 1)) * i;
      inkLine(ctx, [[l + 4, sy], [r - 4, sy]], rng, 1, 3);
      let bx = l + 8;
      while (bx < r - 14) {
        const bw = 6 + rng() * 9, bh = h / (shelves + 1) - 8 - rng() * 12;
        const colors = ['#7a2f35', '#3c4a3e', '#8a7550', '#2c2a35', '#a0846a'];
        inkShape(ctx, [[bx, sy], [bx, sy - bh], [bx + bw, sy - bh], [bx + bw, sy]], rng, colors[(rng() * colors.length) | 0], 0.6, 1.5);
        bx += bw + 1;
      }
    }
    hatch(ctx, l, top, w * 0.18, h, rng, 4, '#000', 0.5);
  } else {
    // гардероб
    inkShape(ctx, [[l, 0], [l + 2, top + 12], [l - 6, top + 4], [r + 6, top], [r - 2, top + 10], [r, 0]], rng, '#5e4330', 2, 3.5);
    inkLine(ctx, [[0, top + 14], [0, -12]], rng, 1, 3);
    inkShape(ctx, [[l + 10, top + 24], [-8, top + 24], [-8, -60], [l + 10, -60]], rng, null, 1, 2);
    inkShape(ctx, [[8, top + 24], [r - 10, top + 24], [r - 10, -60], [8, -60]], rng, null, 1, 2);
    ctx.fillStyle = '#c9a24a';
    ctx.beginPath(); ctx.arc(-6, top + h * 0.5, 3, 0, 7); ctx.arc(6, top + h * 0.5, 3, 0, 7); ctx.fill();
    inkLine(ctx, [[l + 6, -40], [r - 6, -40]], rng, 1, 2.5);
    hatch(ctx, l, top + 10, w, h - 10, rng, 6, '#000', 0.4, 1.2);
    // ножки
    inkLine(ctx, [[l + 6, 0], [l + 2, 8]], rng, 0.5, 4);
    inkLine(ctx, [[r - 6, 0], [r - 2, 8]], rng, 0.5, 4);
  }
  ctx.restore();
}

// Яма: провал в полу с обломанными досками и кольями на дне.
export function drawPit(ctx, x, w, rng) {
  const y = FLOOR_TOP + 14;
  const pts = [[x, y]];
  for (let i = 1; i < 6; i++) pts.push([x + (w * i) / 6 + (rng() - 0.5) * 6, y + 3 + rng() * 4]);
  pts.push([x + w, y], [x + w - 6, H + 10], [x + 6, H + 10]);
  inkShape(ctx, pts, rng, '#0b0807', 1, 3);
  // колья
  for (let sx = x + 16; sx < x + w - 14; sx += 24) {
    const hh = 34 + rng() * 22;
    inkShape(ctx, [[sx - 8, H], [sx, H - hh], [sx + 8, H]], rng, '#4d4540', 1, 2);
  }
  // обломки досок по краям
  const board = (bx, dir) => {
    for (let k = 0; k < 3; k++) {
      const by = y + 6 + k * 28;
      const len = 14 + rng() * 22;
      inkShape(ctx, [[bx, by], [bx + dir * len, by + 2], [bx + dir * (len - 6), by + 10], [bx + dir * (len - 2), by + 16], [bx, by + 18]], rng, '#6a5a4a', 1, 2.5);
    }
  };
  board(x, 1);
  board(x + w, -1);
}

export function drawCoin(ctx, x, y, t, rng) {
  const s = Math.abs(Math.cos(t * 4 + x * 0.01));
  const rx = 5 + 15 * s;
  inkEllipse(ctx, x, y, rx, 20, rng, '#d6a93c', 3);
  if (s > 0.4) {
    ctx.save();
    ctx.globalAlpha = 0.8;
    inkEllipse(ctx, x, y, rx * 0.55, 11, rng, '#e8c467', 2);
    ctx.restore();
  }
}

export function drawBullet(ctx, x, y, rng) {
  inkEllipse(ctx, x, y, 8, 5, rng, '#2a2522', 2);
  inkLine(ctx, [[x - 26, y], [x - 10, y]], rng, 1, 2, 'rgba(22,18,15,0.4)');
}

// Выход — ровная двустворчатая дверь в стене. open: 0 закрыта … 1 распахнута.
export function drawFinish(ctx, x, open = 0, label = 'ВЫХОД') {
  const y = FLOOR_TOP;
  const w = 190, h = 300;
  const l = x - w / 2, top = y - h;
  ctx.save();
  ctx.lineJoin = 'round';
  // наличник
  ctx.fillStyle = '#3a2a1e';
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.rect(l - 16, top - 16, w + 32, h + 16); ctx.fill(); ctx.stroke();
  // проём
  const g = ctx.createLinearGradient(0, top, 0, y);
  g.addColorStop(0, '#050404'); g.addColorStop(1, '#1b1410');
  ctx.fillStyle = g;
  ctx.fillRect(l, top, w, h);
  // створки: при открывании уходят к косякам
  const lw = (w / 2) * (1 - open * 0.82);
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? l : l + w - lw;
    ctx.fillStyle = '#6a4a32';
    ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.rect(x0, top, lw, h); ctx.fill(); ctx.stroke();
    if (lw > 26) {
      ctx.strokeStyle = 'rgba(22,18,15,0.75)'; ctx.lineWidth = 2.5;
      const m = Math.min(14, lw * 0.18);
      ctx.strokeRect(x0 + m, top + 18, lw - m * 2, h * 0.42);
      ctx.strokeRect(x0 + m, top + 18 + h * 0.42 + 16, lw - m * 2, h * 0.42 - 20);
      // ручка у середины
      ctx.fillStyle = '#c9a24a';
      ctx.beginPath(); ctx.arc(side < 0 ? x0 + lw - 10 : x0 + 10, top + h * 0.52, 5, 0, 7); ctx.fill();
    }
    // тень на створке
    ctx.fillStyle = 'rgba(0,0,0,' + (0.12 + open * 0.3) + ')';
    ctx.fillRect(x0, top, lw, h);
  }
  // табличка (у последней двери игры её нет)
  if (!label) { ctx.restore(); return; }
  ctx.fillStyle = '#e8dcc4'; ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.rect(x - 78, top - 70, 156, 46); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7a2f35';
  ctx.font = 'bold 44px "Amatic SC", serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x, top - 46);
  ctx.restore();
}

// Подсказка-жест над препятствием (для обучения).
export function drawHint(ctx, x, y, kind, t) {
  const labels = {
    pit: '↑ свайп вверх', flyer: '↓ свайп вниз', furniture: '← свайп влево', monster: '☝ тап — выстрел',
    lowcrow: '↑ перепрыгни', hands: '↑ перепрыгни руки', chandelier: '↑ перепрыгни обломки',
    gate: '→ свайп вправо — рывок', hopper: '☝ тап — выстрел', brute: '☝ три выстрела',
  };
  const text = labels[kind] || kind;
  if (!text) return;
  ctx.save();
  ctx.font = 'bold 52px "Amatic SC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const yy = y + Math.sin(t * 6) * 5;
  const w = ctx.measureText(text).width + 30;
  x = Math.max(w / 2 + 10, Math.min(W - w / 2 - 10, x)); // табличка целиком в кадре
  ctx.fillStyle = 'rgba(232,220,196,0.92)';
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(x - w / 2, yy - 34, w, 68, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7a2f35';
  ctx.fillText(text, x, yy + 2); // текст по центру таблички
  ctx.restore();
}

// ---------- новые препятствия ----------

// Руки из пола: rise 0..1 — насколько вылезли. Перепрыгнуть.
export function drawHands(ctx, x, w, ground, h, rise, t) {
  // трещина в полу
  ctx.save();
  ctx.fillStyle = '#0b0807';
  ctx.beginPath(); ctx.ellipse(x + w / 2, ground + 2, w * 0.55, 9, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.rect(x - 10, ground - h - 40, w + 20, h + 42); ctx.clip();
  for (let i = 0; i < 3; i++) {
    const bx = x + 18 + i * (w - 36) / 2;
    const sway = Math.sin(t * 7 + i * 2) * 6;
    const top = ground - h * rise * (0.75 + 0.25 * ((i + 1) % 2));
    ctx.strokeStyle = '#000'; ctx.lineCap = 'round';
    ctx.lineWidth = 15;
    ctx.beginPath(); ctx.moveTo(bx, ground + 4); ctx.quadraticCurveTo(bx + sway, (ground + top) / 2, bx + sway * 1.5, top + 8); ctx.stroke();
    // пальцы-когти
    ctx.lineWidth = 4;
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath(); ctx.moveTo(bx + sway * 1.5, top + 10);
      ctx.quadraticCurveTo(bx + sway * 1.5 + k * 7, top - 6, bx + sway * 1.5 + k * 11, top - 2 + Math.abs(k) * 4);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// Люстра: висит, падает (fall 0..1), лежит обломками. Перепрыгнуть обломки.
export function drawChandelier(ctx, cx, ground, fall, t) {
  ctx.save();
  const hangY = 70, landY = ground - 30;
  const y = hangY + (landY - hangY) * fall * fall;
  if (fall < 1) {
    // цепь
    ctx.strokeStyle = '#222'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx, fall > 0 ? -10 + fall * 20 : -10); ctx.lineTo(cx, y - 40); ctx.stroke();
    const sw = fall > 0 ? 0 : Math.sin(t * 2) * 0.05;
    ctx.translate(cx, y); ctx.rotate(sw + fall * 0.4);
    ctx.fillStyle = '#3a2f22'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.ellipse(0, 0, 70, 16, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-8, -40); ctx.lineTo(8, -40); ctx.lineTo(4, -2); ctx.lineTo(-4, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
    for (let i = -2; i <= 2; i++) {
      ctx.fillStyle = '#efe4cc';
      ctx.fillRect(i * 28 - 4, -26, 8, 18); ctx.strokeRect(i * 28 - 4, -26, 8, 18);
      ctx.fillStyle = '#f2c14e';
      ctx.beginPath(); ctx.ellipse(i * 28, -32, 4, 7, 0, 0, 7); ctx.fill();
    }
    // хрустальные подвески
    ctx.strokeStyle = '#8a8f96'; ctx.lineWidth = 2;
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 20, 12); ctx.lineTo(i * 20, 30 + Math.abs(i) * -2); ctx.stroke(); }
  } else {
    // обломки: перекошенный обод, свечи, осколки
    ctx.translate(cx, ground);
    ctx.fillStyle = '#3a2f22'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(-75, 0); ctx.lineTo(-60, -40); ctx.lineTo(-10, -62); ctx.lineTo(40, -48); ctx.lineTo(72, -14); ctx.lineTo(70, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#efe4cc';
    for (const [px, py, r] of [[-40, -48, -0.6], [10, -66, 0.3], [48, -40, 1.1]]) {
      ctx.save(); ctx.translate(px, py); ctx.rotate(r); ctx.fillRect(-4, -18, 8, 18); ctx.strokeRect(-4, -18, 8, 18); ctx.restore();
    }
    ctx.fillStyle = '#b9c2c9';
    for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(-90 + i * 30, 2); ctx.lineTo(-84 + i * 30, -10); ctx.lineTo(-78 + i * 30, 2); ctx.closePath(); ctx.fill(); }
  }
  ctx.restore();
}

// Призрачная решётка во всю высоту: проходится только рывком (свайп вправо).
export function drawGate(ctx, x, w, ground, t) {
  ctx.save();
  const shimmer = 0.75 + Math.sin(t * 6) * 0.1;
  ctx.globalAlpha = shimmer;
  ctx.fillStyle = 'rgba(40,30,60,0.25)';
  ctx.fillRect(x, 0, w, ground);
  ctx.strokeStyle = '#1a1414'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  for (let i = 0; i <= 3; i++) {
    const bx = x + 6 + i * (w - 12) / 3;
    ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx + Math.sin(t * 3 + i) * 2, ground); ctx.stroke();
    // острия внизу
    ctx.beginPath(); ctx.moveTo(bx - 7, ground - 14); ctx.lineTo(bx, ground + 2); ctx.lineTo(bx + 7, ground - 14); ctx.stroke();
  }
  ctx.lineWidth = 6;
  for (const yy of [ground * 0.3, ground * 0.65]) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); }
  // призрачное свечение
  ctx.strokeStyle = 'rgba(150,140,220,0.5)'; ctx.lineWidth = 2;
  for (let i = 0; i <= 3; i++) { const bx = x + 6 + i * (w - 12) / 3 + 4; ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx, ground); ctx.stroke(); }
  ctx.restore();
}

// Найденный артефакт: светящийся медальон над полом.
export function drawRelic(ctx, x, y, t) {
  ctx.save();
  const bob = Math.sin(t * 3) * 8;
  const g = ctx.createRadialGradient(x, y + bob, 4, x, y + bob, 60);
  g.addColorStop(0, 'rgba(255,230,150,0.75)'); g.addColorStop(1, 'rgba(255,230,150,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y + bob, 60, 0, 7); ctx.fill();
  ctx.translate(x, y + bob); ctx.rotate(Math.sin(t * 2) * 0.2);
  ctx.fillStyle = '#c9a24a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, 22, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e8dcc4'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, 7); ctx.fill();
  ctx.fillStyle = '#16120f'; ctx.font = 'bold 26px "Amatic SC", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('?', 0, 2);
  ctx.restore();
}

// ---------- выходы из комнат: дверь, лестницы, лифт, потайной шкаф ----------
function exitSign(ctx, x, y, text) {
  if (!text) return;
  ctx.save();
  ctx.font = 'bold 44px "Amatic SC", serif';
  const w = Math.max(156, ctx.measureText(text).width + 40);
  ctx.fillStyle = '#e8dcc4'; ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.rect(x - w / 2, y, w, 46); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7a2f35'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 24);
  ctx.restore();
}

function opening(ctx, l, top, w, h) {
  ctx.fillStyle = '#3a2a1e'; ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.rect(l - 16, top - 16, w + 32, h + 16); ctx.fill(); ctx.stroke();
  const g = ctx.createLinearGradient(0, top, 0, top + h);
  g.addColorStop(0, '#030202'); g.addColorStop(1, '#1b1410');
  ctx.fillStyle = g; ctx.fillRect(l, top, w, h);
}

// kind: door | stairsUp | stairsDown | lift | secret; open: 0..1; img — книжный шкаф автора (для secret)
function drawExitBase(ctx, kind, x, open = 0, label = 'ВЫХОД', t = 0, img = null) {
  if (kind === 'door' || !kind) { drawFinish(ctx, x, open, label); return; }
  const y = FLOOR_TOP, w = 210, h = 310, l = x - w / 2, top = y - h;
  ctx.save();
  ctx.lineJoin = 'round';
  if (kind === 'stairsUp') {
    opening(ctx, l, top, w, h);
    // ступени уходят вверх-вправо и тонут в темноте
    for (let i = 0; i < 9; i++) {
      const sy = y - i * 34, sx = l + i * 16;
      ctx.globalAlpha = Math.max(0.15, 1 - i * 0.1);
      ctx.fillStyle = i % 2 ? '#5a4434' : '#4a3a2c';
      ctx.fillRect(sx, sy - 34, l + w - sx, 34);
      ctx.strokeStyle = '#1b130e'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(sx, sy - 34); ctx.lineTo(l + w, sy - 34); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#2a1f17'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(l + 8, y - 70); ctx.lineTo(l + w - 8, top + 30); ctx.stroke();
    for (let i = 0; i < 6; i++) { const bx = l + 20 + i * 32; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bx, y - 70 - (bx - l - 8) * (h - 100) / (w - 16) * 0.95); ctx.lineTo(bx, y - 10 - i * 34); ctx.stroke(); }
    exitSign(ctx, x, top - 72, label + ' ↑');
  } else if (kind === 'stairsDown') {
    opening(ctx, l, top, w, h);
    // проём в полу и ступени вниз
    ctx.fillStyle = '#0a0706';
    ctx.beginPath(); ctx.moveTo(l, y); ctx.lineTo(l + w, y); ctx.lineTo(l + w + 20, y + 70); ctx.lineTo(l - 20, y + 70); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 7; i++) {
      const sy = top + 140 + i * 26, sx = l + 20 + i * 18;
      ctx.globalAlpha = Math.max(0.1, 0.9 - i * 0.13);
      ctx.fillStyle = '#4a3a2c'; ctx.fillRect(sx, sy, l + w - sx, 14);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#2a1f17'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(l + 10, top + 120); ctx.lineTo(l + w - 10, y + 20); ctx.stroke();
    exitSign(ctx, x, top - 72, label + ' ↓');
  } else if (kind === 'lift') {
    // латунная рама, шахта с тросами, кабина, раздвижная решётка
    ctx.fillStyle = '#6b5a32'; ctx.strokeStyle = INK; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.rect(l - 18, top - 18, w + 36, h + 18); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#120d0b'; ctx.fillRect(l, top, w, h);
    ctx.strokeStyle = '#3a3836'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 30, top); ctx.lineTo(x - 30, top + 60); ctx.moveTo(x + 30, top); ctx.lineTo(x + 30, top + 60); ctx.stroke();
    ctx.fillStyle = '#2a201a'; ctx.fillRect(l + 6, top + 60, w - 12, h - 60);
    const lamp = ctx.createRadialGradient(x, top + 80, 4, x, top + 80, 120);
    lamp.addColorStop(0, 'rgba(242,193,78,0.5)'); lamp.addColorStop(1, 'rgba(242,193,78,0)');
    ctx.fillStyle = lamp; ctx.fillRect(l, top + 60, w, h - 60);
    ctx.fillStyle = '#c9a24a'; ctx.beginPath(); ctx.arc(x, top + 74, 7, 0, 7); ctx.fill();
    drawLiftGrille(ctx, l, top, w, h, 1 - open);
    // циферблат этажей
    ctx.fillStyle = '#e8dcc4'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, top - 18, 34, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#b3302c'; ctx.lineWidth = 3;
    const a = Math.PI + 0.4 + Math.sin(t * 0.7) * 0.2 + open * 1.6;
    ctx.beginPath(); ctx.moveTo(x, top - 18); ctx.lineTo(x + Math.cos(a) * 28, top - 18 + Math.sin(a) * 28); ctx.stroke();
    exitSign(ctx, x, top - 112, label);
  } else if (kind === 'secret') {
    opening(ctx, l, top, w, h);
    // в глубине тайного хода дрожит свеча
    const c = ctx.createRadialGradient(x + 30, top + 150, 4, x + 30, top + 150, 90);
    c.addColorStop(0, `rgba(242,193,78,${0.35 + Math.sin(t * 9) * 0.05})`); c.addColorStop(1, 'rgba(242,193,78,0)');
    ctx.fillStyle = c; ctx.fillRect(l, top, w, h);
    // шкаф поворачивается на петлях у левого края
    ctx.save();
    ctx.translate(l, 0); ctx.scale(Math.max(0.12, 1 - open * 0.88), 1); ctx.translate(-l, 0);
    if (img) ctx.drawImage(img, l - 4, top - 16, w + 8, h + 16);
    else drawFurniture(ctx, l, y, w, h, 2, makeRng(5));
    ctx.fillStyle = `rgba(0,0,0,${open * 0.5})`; ctx.fillRect(l - 4, top - 16, w + 8, h + 16);
    ctx.restore();
  }
  ctx.restore();
}

function drawLiftGrille(ctx, l, top, w, h, closed) {
  if (closed <= 0.02) return;
  const gw = w * closed, gx = l + w - gw;
  ctx.save();
  ctx.beginPath(); ctx.rect(gx, top, gw, h); ctx.clip();
  ctx.strokeStyle = '#8a7a4a'; ctx.lineWidth = 3;
  const n = 8;
  for (let i = 0; i <= n; i++) { const xx = gx + gw * i / n; ctx.beginPath(); ctx.moveTo(xx, top); ctx.lineTo(xx, top + h); ctx.stroke(); }
  for (let i = 0; i < n; i++) {
    const x0 = gx + gw * i / n, x1 = gx + gw * (i + 1) / n;
    for (let yy = top; yy < top + h; yy += 44) {
      ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy + 22); ctx.lineTo(x0, yy + 44); ctx.stroke();
    }
  }
  ctx.restore();
}

// Решётка лифта поверх героя, когда он уже вошёл (close: 0..1).
export function drawExitFront(ctx, kind, x, close) {
  if (kind !== 'lift' || close <= 0) return;
  const w = 210, h = 310;
  drawLiftGrille(ctx, x - w / 2, FLOOR_TOP - h, w, h, close);
}

// Загадочные выходы: луч света, зеркало, картина, камин.
export function drawExit(ctx, kind, x, open = 0, label = 'ВЫХОД', t = 0, img = null) {
  const y = FLOOR_TOP;
  if (kind === 'lightBeam') {
    ctx.save();
    // столб света с потолка, пылинки летят вверх
    const a = 0.35 + open * 0.35 + Math.sin(t * 3) * 0.05;
    const g = ctx.createLinearGradient(x - 90, 0, x + 90, 0);
    g.addColorStop(0, 'rgba(255,240,190,0)'); g.addColorStop(0.5, `rgba(255,240,190,${a})`); g.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x - 50, 0); ctx.lineTo(x + 50, 0); ctx.lineTo(x + 95, GROUND_Y_EXIT + 10); ctx.lineTo(x - 95, GROUND_Y_EXIT + 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = `rgba(255,245,210,${0.25 + open * 0.3})`;
    ctx.beginPath(); ctx.ellipse(x, GROUND_Y_EXIT + 4, 95, 18, 0, 0, 7); ctx.fill();
    for (let i = 0; i < 14; i++) {
      const ph = (t * 0.35 + i / 14) % 1, px = x + Math.sin(i * 7.3 + t) * 60 * (1 - ph * 0.4);
      ctx.fillStyle = `rgba(255,250,220,${0.8 * (1 - ph)})`;
      ctx.beginPath(); ctx.arc(px, GROUND_Y_EXIT - ph * GROUND_Y_EXIT, 2.5, 0, 7); ctx.fill();
    }
    ctx.restore();
    return;
  }
  if (kind === 'mirror') {
    const w = 170, h = 300, top = y - h;
    ctx.save();
    ctx.fillStyle = '#6b5a32'; ctx.strokeStyle = INK; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(x, top + h / 2, w / 2 + 16, h / 2 + 16, 0, 0, 7); ctx.fill(); ctx.stroke();
    // завитки рамы
    for (const [dx, dy] of [[0, -h / 2 - 22], [0, h / 2 + 18], [-w / 2 - 18, 0], [w / 2 + 18, 0]]) { ctx.beginPath(); ctx.arc(x + dx, top + h / 2 + dy, 10, 0, 7); ctx.fill(); ctx.stroke(); }
    ctx.save();
    ctx.beginPath(); ctx.ellipse(x, top + h / 2, w / 2, h / 2, 0, 0, 7); ctx.clip();
    const g = ctx.createLinearGradient(x - w / 2, top, x + w / 2, top + h);
    g.addColorStop(0, '#9aa6ae'); g.addColorStop(0.5, '#cfd8dc'); g.addColorStop(1, '#6f7c84');
    ctx.fillStyle = g; ctx.fillRect(x - w / 2, top, w, h);
    // в отражении — тёмный силуэт, который ждёт; при открытии гладь идёт рябью
    ctx.fillStyle = `rgba(30,25,30,${0.55 - open * 0.3})`;
    ctx.beginPath(); ctx.ellipse(x, top + 110, 22, 26, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 40, top + h); ctx.quadraticCurveTo(x - 36, top + 150, x, top + 140); ctx.quadraticCurveTo(x + 36, top + 150, x + 40, top + h); ctx.closePath(); ctx.fill();
    if (open > 0) {
      ctx.strokeStyle = `rgba(255,255,255,${0.5 * open})`; ctx.lineWidth = 3;
      for (let i = 1; i < 6; i++) { const r = ((t * 80 + i * 30) % 160); ctx.beginPath(); ctx.ellipse(x, top + h / 2, r * 0.6, r, 0, 0, 7); ctx.stroke(); }
    }
    ctx.restore();
    ctx.restore();
    return;
  }
  if (kind === 'painting') {
    const w = 230, h = 200, top = y - 330;
    ctx.save();
    ctx.fillStyle = '#5a3e2a'; ctx.strokeStyle = INK; ctx.lineWidth = 5;
    ctx.fillRect(x - w / 2 - 20, top - 20, w + 40, h + 40); ctx.strokeRect(x - w / 2 - 20, top - 20, w + 40, h + 40);
    // в картине — уходящий вдаль коридор с открытой дверью
    ctx.save(); ctx.beginPath(); ctx.rect(x - w / 2, top, w, h); ctx.clip();
    ctx.fillStyle = '#c9bd9f'; ctx.fillRect(x - w / 2, top, w, h);
    ctx.fillStyle = '#7d6e5a';
    ctx.beginPath(); ctx.moveTo(x - w / 2, top + h); ctx.lineTo(x - 30, top + 110); ctx.lineTo(x + 30, top + 110); ctx.lineTo(x + w / 2, top + h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a8997c';
    ctx.beginPath(); ctx.moveTo(x - w / 2, top); ctx.lineTo(x - 30, top + 50); ctx.lineTo(x - 30, top + 110); ctx.lineTo(x - w / 2, top + h); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + w / 2, top); ctx.lineTo(x + 30, top + 50); ctx.lineTo(x + 30, top + 110); ctx.lineTo(x + w / 2, top + h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = `rgba(255,220,140,${0.5 + open * 0.5})`; ctx.fillRect(x - 14, top + 66, 28, 44);
    ctx.fillStyle = `rgba(255,220,140,${0.15 + open * 0.3})`; ctx.fillRect(x - w / 2, top, w, h);
    ctx.restore();
    // табурет под картиной, чтобы до неё допрыгнуть
    ctx.fillStyle = '#4a3a2c'; ctx.fillRect(x - 40, y - 60, 80, 14); ctx.strokeRect(x - 40, y - 60, 80, 14);
    ctx.fillRect(x - 34, y - 46, 8, 46); ctx.fillRect(x + 26, y - 46, 8, 46);
    ctx.restore();
    return;
  }
  if (kind === 'fireplace') {
    const w = 240, h = 230, l = x - w / 2, top = y - h;
    ctx.save();
    ctx.fillStyle = '#6e655c'; ctx.strokeStyle = INK; ctx.lineWidth = 5;
    ctx.fillRect(l - 20, top - 30, w + 40, 34); ctx.strokeRect(l - 20, top - 30, w + 40, 34);
    ctx.fillRect(l, top, 40, h); ctx.strokeRect(l, top, 40, h);
    ctx.fillRect(l + w - 40, top, 40, h); ctx.strokeRect(l + w - 40, top, 40, h);
    ctx.fillStyle = '#0d0a08'; ctx.fillRect(l + 40, top + 20, w - 80, h - 20);
    // зелёное пламя
    for (let i = 0; i < 6; i++) {
      const fx = l + 60 + i * 24, fh = 60 + Math.sin(t * 9 + i * 1.7) * 18 + open * 50;
      const g = ctx.createLinearGradient(0, y - fh, 0, y);
      g.addColorStop(0, 'rgba(120,255,160,0)'); g.addColorStop(0.4, 'rgba(90,220,130,0.8)'); g.addColorStop(1, 'rgba(220,255,200,0.95)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(fx - 16, y); ctx.quadraticCurveTo(fx - 14, y - fh * 0.5, fx + Math.sin(t * 7 + i) * 6, y - fh); ctx.quadraticCurveTo(fx + 14, y - fh * 0.5, fx + 16, y); ctx.closePath(); ctx.fill();
    }
    const glow = ctx.createRadialGradient(x, y - 40, 10, x, y - 40, 200);
    glow.addColorStop(0, `rgba(120,255,160,${0.25 + open * 0.2})`); glow.addColorStop(1, 'rgba(120,255,160,0)');
    ctx.fillStyle = glow; ctx.fillRect(x - 220, top - 60, 440, h + 120);
    ctx.restore();
    return;
  }
  drawExitBase(ctx, kind, x, open, label, t, img);
}
const GROUND_Y_EXIT = 545;
