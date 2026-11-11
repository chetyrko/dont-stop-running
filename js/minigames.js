// Особые комнаты вместо бега:
//  • поиск предметов (середина каждого акта) — три стены комнаты, переключаются стрелками, список внизу;
//  • «три в ряд» — редкая комната, собрать нужные предметы за ограниченное число ходов;
//  • «пятнашки» — редкая комната, собрать картину из 8 кусочков.
// У каждой игры: drawWorld (в окне рамки, если useFrame), drawUI (поверх), tap(x, y), swipe(x, y, dir).

import { W, H, GROUND_Y, FLOOR_TOP, HERO_SCALE } from './config.js?v=b289d5d';
import { drawArtifactIcon } from './artifacts.js?v=b289d5d';
import { drawFinish, drawChandelier } from './art.js?v=b289d5d';
import { drawRigHero, rigReady } from './rig.js?v=b289d5d';
import { drawDemon, demonReady } from './demon.js?v=b289d5d';
import { sfx } from './audio.js?v=b289d5d';

function seeded(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const glyph = (icon) => ({ icon, cursed: false, rarity: { color: '#999' } });
const font = (px) => `bold ${px}px "Amatic SC", serif`;

function header(ctx, L, title, sub) {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = font(64); ctx.fillStyle = '#e8dcc4';
  ctx.fillText(title, L.SW / 2, 120);
  if (sub) { ctx.font = font(34); ctx.fillStyle = '#8e8b87'; ctx.fillText(sub, L.SW / 2, 175); }
  // «выйти» в углу
  ctx.textAlign = 'left'; ctx.font = font(38); ctx.fillStyle = '#8e8b87';
  ctx.fillText('‹ выйти', 26, 50);
}
const hitQuit = (x, y) => x < 170 && y < 90;

// «Пропустить»: головоломка решается сама, цена — все оболы игрока. Нажать два раза.
function drawSkip(ctx, L, g) {
  if (g.endT > 0 || g.done) return;
  const gold = g.gold || 0;
  const text = g.skipArmed ? `точно? −${gold} обол.` : 'пропустить ›';
  ctx.save();
  ctx.font = font(38); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillStyle = g.skipArmed ? '#b3302c' : '#8e8b87';
  ctx.fillText(text, L.SW - 26, 50);
  ctx.font = font(26); ctx.fillStyle = '#6b6864';
  ctx.fillText(g.skipArmed ? 'нажми ещё раз' : `цена — все оболы (${gold})`, L.SW - 26, 86);
  ctx.restore();
}
// true — нажатие ушло в кнопку; при втором нажатии вызывает g.autoSolve()
function tapSkip(g, x, y) {
  const L = g.L;
  if (!L || g.endT > 0 || g.done || x < L.SW - 300 || y > 110) {
    if (g.skipArmed) g.skipArmed = false;
    return false;
  }
  if (!g.skipArmed) { g.skipArmed = true; clearTimeout(g.skipTimer); g.skipTimer = setTimeout(() => { g.skipArmed = false; }, 3000); sfx.click(); return true; }
  g.skipArmed = false; g.skipped = true;
  g.autoSolve();
  return true;
}

function drawWallScene(ctx, images, offset) {
  if (images.wall) {
    const wh = FLOOR_TOP + 24, ww = images.wall.width * wh / images.wall.height;
    let x = -((offset % ww) + ww) % ww;
    while (x < W) { ctx.drawImage(images.wall, x, 0, ww, wh); x += ww; }
  } else { ctx.fillStyle = '#d9cdb4'; ctx.fillRect(0, 0, W, H); }
  if (images.floor) ctx.drawImage(images.floor, 0, FLOOR_TOP - 8, W + 100, H - FLOOR_TOP + 12);
  else { ctx.fillStyle = '#776a5b'; ctx.fillRect(0, FLOOR_TOP, W, H); }
}

// ======================= поиск предметов =======================
const SEARCH_ITEMS = [
  ['Ключ', 'key'], ['Свеча', 'candle'], ['Перо', 'feather'], ['Песочные часы', 'hourglass'],
  ['Колокольчик', 'bell'], ['Монокль', 'eye'], ['Фонарь', 'lantern'], ['Шестерня', 'gear'],
  ['Пузырёк', 'potion'], ['Подкова', 'magnet'], ['Зеркальце', 'mirror'], ['Клык', 'fang'],
  ['Сердце', 'heart'], ['Перчатка', 'glove'], ['Пуля', 'bullet'], ['Монета', 'coin'],
];
const INKS = ['#3a2f22', '#4a3d31', '#2a2622', '#5a4a3a', '#3d3631', '#4f4038'];

export class SearchGame {
  constructor(level, images, skin, onDone) {
    this.level = level; this.images = images; this.onDone = onDone;
    this.useFrame = true;
    this.view = 0; this.views = 3;
    this.t = 0; this.done = false; this.endT = 0; this.hintT = 0; this.hintCd = 0; this.shake = 0;
    const rng = seeded(level.room * 97 + 13);
    const pool = SEARCH_ITEMS.slice().sort(() => rng() - 0.5);
    const wanted = pool.slice(0, 8), decoys = pool.slice(8, 16);
    this.items = [];
    const place = (it, want) => {
      for (let tries = 0; tries < 200; tries++) {
        const view = Math.floor(rng() * 3);
        const x = 90 + rng() * 820, y = 110 + rng() * 440, size = 46 + rng() * 16;
        if (this.items.some(o => o.view === view && Math.hypot(o.x - x, o.y - y) < 95)) continue;
        this.items.push({ name: it[0], icon: it[1], view, x, y, size, rot: (rng() - 0.5) * 1.6, color: INKS[Math.floor(rng() * INKS.length)], want, found: false });
        return;
      }
    };
    wanted.forEach(it => place(it, true));
    decoys.forEach(it => place(it, false));
    this.sparks = [];
  }

  get left() { return this.items.filter(i => i.want && !i.found).length; }

  autoSolve() {
    for (const it of this.items) if (it.want) it.found = true;
    this.endT = 1.4; sfx.win();
  }

  tap(x, y) {
    if (this.done) return;
    if (hitQuit(x, y)) { this.done = true; this.onDone({ won: false, quit: true }); return; }
    if (tapSkip(this, x, y)) return;
    const L = this.L;
    // кнопка подсказки
    if (this.hintBtn && x > this.hintBtn.x && x < this.hintBtn.x + this.hintBtn.w && y > this.hintBtn.y && y < this.hintBtn.y + this.hintBtn.h) {
      if (this.hintCd <= 0) { this.hintT = 2.5; this.hintCd = 20; sfx.click(); }
      return;
    }
    if (!L || y < L.win.y || y > L.win.y + L.win.h) return;
    const wx = (x - L.win.x) / L.win.s, wy = (y - L.win.y) / L.win.s;
    if (wx < 80 && wy > 220 && wy < 380) { this.view = (this.view + this.views - 1) % this.views; sfx.click(); return; }
    if (wx > W - 80 && wy > 220 && wy < 380) { this.view = (this.view + 1) % this.views; sfx.click(); return; }
    for (const it of this.items) {
      if (it.view !== this.view || it.found) continue;
      if (Math.hypot(it.x - wx, it.y - wy) < it.size * 0.8) {
        if (it.want) {
          it.found = true; sfx.coin();
          for (let i = 0; i < 10; i++) this.sparks.push({ x: it.x, y: it.y, vx: (Math.random() - 0.5) * 400, vy: (Math.random() - 0.5) * 400, life: 0.6 });
          if (!this.left) { this.endT = 1.4; sfx.win(); }
        } else { this.shake = 0.3; sfx.hit(); }
        return;
      }
    }
  }

  swipe(x, y, dir) {
    if (dir === 'kick') this.view = (this.view + 1) % this.views;      // свайп влево — следующая стена
    if (dir === 'right') this.view = (this.view + this.views - 1) % this.views;
  }

  update(dt) {
    this.t += dt;
    this.hintT = Math.max(0, this.hintT - dt); this.hintCd = Math.max(0, this.hintCd - dt); this.shake = Math.max(0, this.shake - dt);
    for (const s of this.sparks) { s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; }
    this.sparks = this.sparks.filter(s => s.life > 0);
    if (this.endT > 0 && !this.done) { this.endT -= dt; if (this.endT <= 0) { this.done = true; this.onDone({ won: true, skipped: this.skipped }); } }
  }

  drawWorld(ctx) {
    const v = this.view, t = this.t;
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * 10, 0);
    drawWallScene(ctx, this.images, v * 620 + 200);
    // мебель у каждой стены своя
    const bc = this.images.furniture;
    if (v === 0) { if (bc) ctx.drawImage(bc, 640, GROUND_Y - 330, 185, 330); drawChandelier(ctx, 300, GROUND_Y, 0, t); }
    if (v === 1) drawFinish(ctx, 500, 0, 'ВЫХОД');
    if (v === 2) { if (bc) { ctx.drawImage(bc, 90, GROUND_Y - 300, 170, 300); ctx.drawImage(bc, 760, GROUND_Y - 300, 170, 300); } }
    // предметы: немного прозрачные, чтобы сливались с обоями
    for (const it of this.items) {
      if (it.view !== v || it.found) continue;
      ctx.save();
      ctx.globalAlpha = 0.86;
      ctx.translate(it.x, it.y); ctx.rotate(it.rot);
      drawArtifactIcon(ctx, glyph(it.icon), 0, 0, it.size, { plain: true, color: it.color });
      ctx.restore();
      if (this.hintT > 0 && it.want && it === this.items.find(o => o.want && !o.found && o.view === v)) {
        ctx.save(); ctx.strokeStyle = `rgba(242,210,122,${0.5 + Math.sin(t * 10) * 0.4})`; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(it.x, it.y, it.size * 0.9, 0, 7); ctx.stroke(); ctx.restore();
      }
    }
    for (const s of this.sparks) { ctx.fillStyle = `rgba(242,210,122,${s.life})`; ctx.fillRect(s.x - 4, s.y - 4, 8, 8); }
    // стрелки
    ctx.fillStyle = 'rgba(22,18,15,0.7)'; ctx.strokeStyle = '#e8dcc4'; ctx.lineWidth = 4;
    for (const [x, d] of [[40, -1], [W - 40, 1]]) {
      ctx.beginPath(); ctx.arc(x, 300, 34, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - d * 8, 284); ctx.lineTo(x + d * 10, 300); ctx.lineTo(x - d * 8, 316); ctx.stroke();
    }
    // какая стена
    for (let i = 0; i < 3; i++) { ctx.fillStyle = i === v ? '#f2d27a' : 'rgba(22,18,15,0.6)'; ctx.beginPath(); ctx.arc(W / 2 + (i - 1) * 28, 40, 9, 0, 7); ctx.fill(); }
    ctx.restore();
  }

  drawUI(ctx, L) {
    this.L = L;
    header(ctx, L, `Комната ${this.level.room}`, 'найди предметы из списка · стрелки — другая стена');
    drawSkip(ctx, L, this);
    const y0 = L.win.y + L.win.h + 40;
    const wants = this.items.filter(i => i.want);
    ctx.font = font(44); ctx.textBaseline = 'middle';
    wants.forEach((it, i) => {
      const cx = i % 2 ? L.SW * 0.56 : L.SW * 0.1, cy = y0 + 30 + Math.floor(i / 2) * 64;
      ctx.textAlign = 'left';
      ctx.fillStyle = it.found ? '#6b6864' : '#e8dcc4';
      ctx.fillText(it.name, cx + 50, cy);
      drawArtifactIcon(ctx, glyph(it.icon), cx + 18, cy, 36, { plain: true, color: it.found ? '#4a4744' : '#c9a24a' });
      if (it.found) { ctx.strokeStyle = '#b3302c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx + 44, cy + 2); ctx.lineTo(cx + 60 + ctx.measureText(it.name).width, cy - 4); ctx.stroke(); }
    });
    const by = y0 + 30 + 4 * 64 + 30;
    this.hintBtn = { x: L.SW / 2 - 150, y: by, w: 300, h: 70 };
    ctx.fillStyle = this.hintCd > 0 ? '#4a4744' : '#c9c2b4'; ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(this.hintBtn.x, by, 300, 70, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#16120f'; ctx.textAlign = 'center'; ctx.font = font(42);
    ctx.fillText(this.hintCd > 0 ? `подсказка · ${Math.ceil(this.hintCd)}` : 'подсказка', L.SW / 2, by + 37);
    if (!this.left) { ctx.font = font(64); ctx.fillStyle = '#f2d27a'; ctx.fillText('Всё найдено!', L.SW / 2, L.win.y - 50); }
  }
}

// ======================= три в ряд =======================
const M3 = [['heart', '#b3302c', 'сердца'], ['coin', '#c9a24a', 'оболы'], ['key', '#6f8fa8', 'ключи'], ['candle', '#e8dcc4', 'свечи'], ['eye', '#7d9a6a', 'глаза'], ['fang', '#9a7ab8', 'клыки']];
const N = 7;

export class Match3Game {
  constructor(level, images, skin, onDone) {
    this.level = level; this.onDone = onDone; this.useFrame = false;
    this.rng = seeded(level.room * 31 + 7);
    this.moves = 24;
    const g = [0, 1, 2, 3, 4, 5].sort(() => this.rng() - 0.5).slice(0, 3);
    this.goals = g.map(k => ({ k, need: 12, got: 0 }));
    this.grid = [];
    for (let r = 0; r < N; r++) { this.grid.push([]); for (let c = 0; c < N; c++) this.grid[r].push(this.newTile(r, c, true)); }
    this.sel = null; this.busy = 0; this.t = 0; this.done = false; this.endT = 0; this.pops = [];
  }

  newTile(r, c, noMatch) {
    let k;
    for (let i = 0; i < 20; i++) {
      k = Math.floor(this.rng() * 6);
      if (!noMatch) break;
      const g = this.grid;
      const h = c >= 2 && g[r][c - 1]?.k === k && g[r][c - 2]?.k === k;
      const v = r >= 2 && g[r - 1]?.[c]?.k === k && g[r - 2]?.[c]?.k === k;
      if (!h && !v) break;
    }
    return { k, dy: 0, sx: 0, sy: 0 };
  }

  cellAt(x, y) {
    const { gx, gy, cs } = this.geo;
    const c = Math.floor((x - gx) / cs), r = Math.floor((y - gy) / cs);
    return r >= 0 && r < N && c >= 0 && c < N ? [r, c] : null;
  }

  autoSolve() {
    for (const q of this.goals) q.got = Math.max(q.got, q.need);
    this.endT = 1.4; this.result = true; sfx.win();
  }

  tap(x, y) {
    if (this.done) return;
    if (hitQuit(x, y)) { this.done = true; this.onDone({ won: false, quit: true }); return; }
    if (tapSkip(this, x, y)) return;
    if (this.busy > 0 || this.endT > 0 || !this.geo) return;
    const cell = this.cellAt(x, y);
    if (!cell) { this.sel = null; return; }
    if (this.sel && Math.abs(this.sel[0] - cell[0]) + Math.abs(this.sel[1] - cell[1]) === 1) { this.trySwap(this.sel, cell); this.sel = null; }
    else { this.sel = cell; sfx.click(); }
  }

  swipe(x, y, dir) {
    if (this.busy > 0 || this.endT > 0 || !this.geo || this.done) return;
    const cell = this.cellAt(x, y);
    if (!cell) return;
    const d = { jump: [-1, 0], slide: [1, 0], kick: [0, -1], right: [0, 1] }[dir];
    if (!d) return;
    const to = [cell[0] + d[0], cell[1] + d[1]];
    if (to[0] < 0 || to[0] >= N || to[1] < 0 || to[1] >= N) return;
    this.sel = null;
    this.trySwap(cell, to);
  }

  trySwap(a, b) {
    const g = this.grid;
    const A = g[a[0]][a[1]], B = g[b[0]][b[1]];
    g[a[0]][a[1]] = B; g[b[0]][b[1]] = A;
    if (!this.findMatches().length) {
      g[a[0]][a[1]] = A; g[b[0]][b[1]] = B;   // хода нет — возвращаем
      A.sx = (b[1] - a[1]) * 0.3; A.sy = (b[0] - a[0]) * 0.3;
      sfx.hit();
      return;
    }
    // анимация обмена
    A.sx = a[1] - b[1]; A.sy = a[0] - b[0]; B.sx = b[1] - a[1]; B.sy = b[0] - a[0];
    this.moves--; sfx.kick();
    this.busy = 0.18;
  }

  findMatches() {
    const g = this.grid, out = new Set();
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const k = g[r][c]?.k; if (k === undefined || k < 0) continue;
      if (c <= N - 3 && g[r][c + 1].k === k && g[r][c + 2].k === k) { let e = c; while (e < N && g[r][e].k === k) { out.add(r * N + e); e++; } }
      if (r <= N - 3 && g[r + 1][c].k === k && g[r + 2][c].k === k) { let e = r; while (e < N && g[e][c].k === k) { out.add(e * N + c); e++; } }
    }
    return [...out];
  }

  resolve() {
    const m = this.findMatches();
    if (!m.length) {
      if (this.goals.every(q => q.got >= q.need)) { this.endT = 1.4; this.result = true; sfx.win(); }
      else if (this.moves <= 0) { this.endT = 1.4; this.result = false; sfx.lose(); }
      else if (!this.hasMoves()) this.shuffle();
      return;
    }
    for (const i of m) {
      const r = Math.floor(i / N), c = i % N, k = this.grid[r][c].k;
      const goal = this.goals.find(q => q.k === k); if (goal) goal.got++;
      this.pops.push({ r, c, k, life: 0.35 });
      this.grid[r][c] = null;
    }
    sfx.coin();
    // падение вниз и новые сверху
    for (let c = 0; c < N; c++) {
      let w = N - 1;
      for (let r = N - 1; r >= 0; r--) if (this.grid[r][c]) { const t = this.grid[r][c]; this.grid[r][c] = null; t.dy += w - r; this.grid[w][c] = t; w--; }
      for (let r = w; r >= 0; r--) { const t = this.newTile(r, c, false); t.dy = w + 1; this.grid[r][c] = t; }
    }
    this.busy = 0.3;
  }

  hasMoves() {
    const g = this.grid;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of [[0, 1], [1, 0]]) {
      const r2 = r + dr, c2 = c + dc; if (r2 >= N || c2 >= N) continue;
      [g[r][c], g[r2][c2]] = [g[r2][c2], g[r][c]];
      const ok = this.findMatches().length > 0;
      [g[r][c], g[r2][c2]] = [g[r2][c2], g[r][c]];
      if (ok) return true;
    }
    return false;
  }

  shuffle() {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) this.grid[r][c] = this.newTile(r, c, true);
  }

  update(dt) {
    this.t += dt;
    for (const row of this.grid) for (const tl of row) if (tl) {
      tl.dy = Math.max(0, tl.dy - dt * 9);
      tl.sx *= Math.pow(0.0005, dt); tl.sy *= Math.pow(0.0005, dt);
    }
    for (const p of this.pops) p.life -= dt;
    this.pops = this.pops.filter(p => p.life > 0);
    if (this.busy > 0) { this.busy -= dt; if (this.busy <= 0) { this.busy = 0; this.resolve(); } }
    if (this.endT > 0 && !this.done) { this.endT -= dt; if (this.endT <= 0) { this.done = true; this.onDone({ won: this.result, skipped: this.skipped }); } }
  }

  drawUI(ctx, L) {
    this.L = L;
    header(ctx, L, `Комната ${this.level.room}`, 'странная комната: три в ряд');
    drawSkip(ctx, L, this);
    const cs = Math.floor((L.SW - 60) / N), gx = (L.SW - cs * N) / 2, gy = 420;
    this.geo = { gx, gy, cs };
    // цели и ходы
    ctx.textBaseline = 'middle';
    this.goals.forEach((q, i) => {
      const x = L.SW / 2 + (i - 1) * 190, y = 280;
      drawArtifactIcon(ctx, glyph(M3[q.k][0]), x - 40, y, 64, { plain: true, color: M3[q.k][1] });
      ctx.font = font(48); ctx.textAlign = 'left'; ctx.fillStyle = q.got >= q.need ? '#7d9a6a' : '#e8dcc4';
      ctx.fillText(q.got >= q.need ? '✓' : `${q.need - q.got}`, x + 4, y + 2);
    });
    ctx.textAlign = 'center'; ctx.font = font(44); ctx.fillStyle = this.moves <= 5 ? '#b3302c' : '#b9b5ae';
    ctx.fillText(`ходов: ${this.moves}`, L.SW / 2, 360);
    // поле
    ctx.fillStyle = '#1b1918'; ctx.strokeStyle = '#000'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.roundRect(gx - 10, gy - 10, cs * N + 20, cs * N + 20, 16); ctx.fill(); ctx.stroke();
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      ctx.fillStyle = (r + c) % 2 ? '#2a2826' : '#24221f';
      ctx.fillRect(gx + c * cs, gy + r * cs, cs, cs);
    }
    ctx.save(); ctx.beginPath(); ctx.rect(gx, gy, cs * N, cs * N); ctx.clip();
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const tl = this.grid[r][c]; if (!tl) continue;
      const x = gx + (c + tl.sx + 0.5) * cs, y = gy + (r + tl.sy - tl.dy + 0.5) * cs;
      if (this.sel && this.sel[0] === r && this.sel[1] === c) {
        ctx.strokeStyle = '#f2d27a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(gx + c * cs + 4, gy + r * cs + 4, cs - 8, cs - 8, 10); ctx.stroke();
      }
      drawArtifactIcon(ctx, glyph(M3[tl.k][0]), x, y, cs * 0.62, { plain: true, color: M3[tl.k][1] });
    }
    for (const p of this.pops) {
      ctx.globalAlpha = p.life / 0.35;
      drawArtifactIcon(ctx, glyph(M3[p.k][0]), gx + (p.c + 0.5) * cs, gy + (p.r + 0.5) * cs, cs * 0.62 * (1 + (0.35 - p.life) * 2), { plain: true, color: '#f2d27a' });
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    ctx.font = font(34); ctx.fillStyle = '#8e8b87';
    ctx.fillText('нажми на предмет и на соседний — или смахни его в сторону', L.SW / 2, gy + cs * N + 50);
    if (this.endT > 0) {
      ctx.font = font(80); ctx.fillStyle = this.result ? '#f2d27a' : '#b3302c';
      ctx.fillText(this.result ? 'Собрано!' : 'Ходы кончились', L.SW / 2, gy + cs * N / 2);
    }
  }
}

// ======================= пятнашки =======================
export class SlidePuzzle {
  constructor(level, images, skin, onDone) {
    this.level = level; this.onDone = onDone; this.useFrame = false;
    this.size = 3; this.t = 0; this.done = false; this.endT = 0; this.movesMade = 0;
    // картина: стена с героем и тенью
    const c = document.createElement('canvas'); c.width = c.height = 600;
    const x = c.getContext('2d');
    x.save(); x.scale(600 / 600, 1); x.translate(-200, 0);
    drawWallScene(x, images, 120);
    x.restore();
    x.save(); x.translate(230, 560); x.scale(HERO_SCALE * 1.5, HERO_SCALE * 1.5);
    if (rigReady()) drawRigHero(x, 0, 0, 'idle', 0, skin, {});
    x.restore();
    if (demonReady()) drawDemon(x, 440, 570, 360, 0.3, 0, 1);
    this.pic = c;
    // перемешиваем случайными ходами — так головоломка всегда решаема
    this.tiles = [...Array(9).keys()];   // 8 — пустая клетка
    const rng = seeded(level.room * 53 + 1);
    let last = -1;
    for (let i = 0; i < 160; i++) {
      const e = this.tiles.indexOf(8);
      const nb = this.neighbors(e).filter(n => n !== last);
      const pick = nb[Math.floor(rng() * nb.length)];
      [this.tiles[e], this.tiles[pick]] = [this.tiles[pick], this.tiles[e]];
      last = e;
    }
    if (this.solved()) { [this.tiles[0], this.tiles[1]] = [this.tiles[1], this.tiles[0]]; [this.tiles[3], this.tiles[4]] = [this.tiles[4], this.tiles[3]]; }
    this.anim = {};
  }

  neighbors(i) {
    const r = Math.floor(i / 3), c = i % 3, out = [];
    if (r > 0) out.push(i - 3); if (r < 2) out.push(i + 3); if (c > 0) out.push(i - 1); if (c < 2) out.push(i + 1);
    return out;
  }
  solved() { return this.tiles.every((v, i) => v === i); }

  move(i) {
    const e = this.tiles.indexOf(8);
    if (!this.neighbors(e).includes(i)) return false;
    this.anim[this.tiles[i]] = { from: i, t: 0 };
    [this.tiles[e], this.tiles[i]] = [this.tiles[i], this.tiles[e]];
    this.movesMade++; sfx.click();
    if (this.solved()) { this.endT = 1.8; sfx.win(); }
    return true;
  }

  autoSolve() {
    this.tiles.forEach((v, i) => { if (v !== i) this.anim[v] = { from: i, t: 0 }; });
    this.tiles = [...Array(9).keys()];
    this.endT = 1.8; sfx.win();
  }

  tap(x, y) {
    if (this.done) return;
    if (hitQuit(x, y)) { this.done = true; this.onDone({ won: false, quit: true }); return; }
    if (tapSkip(this, x, y)) return;
    if (!this.geo || this.endT > 0) return;
    const { gx, gy, cs } = this.geo;
    const c = Math.floor((x - gx) / cs), r = Math.floor((y - gy) / cs);
    if (r >= 0 && r < 3 && c >= 0 && c < 3) this.move(r * 3 + c);
  }

  swipe(x, y, dir) {
    if (this.endT > 0 || this.done) return;
    // смахнул в сторону — в пустую клетку въезжает соседняя плитка
    const e = this.tiles.indexOf(8), r = Math.floor(e / 3), c = e % 3;
    const from = { jump: [r + 1, c], slide: [r - 1, c], kick: [r, c + 1], right: [r, c - 1] }[dir];
    if (from && from[0] >= 0 && from[0] < 3 && from[1] >= 0 && from[1] < 3) this.move(from[0] * 3 + from[1]);
  }

  update(dt) {
    this.t += dt;
    for (const k in this.anim) { this.anim[k].t += dt * 7; if (this.anim[k].t >= 1) delete this.anim[k]; }
    if (this.endT > 0 && !this.done) { this.endT -= dt; if (this.endT <= 0) { this.done = true; this.onDone({ won: true, skipped: this.skipped }); } }
  }

  drawUI(ctx, L) {
    this.L = L;
    header(ctx, L, `Комната ${this.level.room}`, 'странная комната: собери картину');
    drawSkip(ctx, L, this);
    const cs = Math.floor((L.SW - 100) / 3), gx = (L.SW - cs * 3) / 2, gy = 300;
    this.geo = { gx, gy, cs };
    ctx.fillStyle = '#000'; ctx.fillRect(gx - 12, gy - 12, cs * 3 + 24, cs * 3 + 24);
    const pc = this.pic.width / 3;
    const solvedView = this.endT > 0;
    for (let i = 0; i < 9; i++) {
      const v = this.tiles[i];
      if (v === 8 && !solvedView) continue;
      let r = Math.floor(i / 3), c = i % 3;
      const a = this.anim[v];
      if (a) { const fr = Math.floor(a.from / 3), fc = a.from % 3, k = 1 - Math.pow(1 - a.t, 3); r = fr + (r - fr) * k; c = fc + (c - fc) * k; }
      const x = gx + c * cs, y = gy + r * cs, gap = solvedView ? 0 : 4;
      ctx.drawImage(this.pic, (v % 3) * pc, Math.floor(v / 3) * pc, pc, pc, x + gap, y + gap, cs - gap * 2, cs - gap * 2);
      if (!solvedView) { ctx.strokeStyle = '#16120f'; ctx.lineWidth = 3; ctx.strokeRect(x + gap, y + gap, cs - gap * 2, cs - gap * 2); }
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = font(40); ctx.fillStyle = '#b9b5ae';
    ctx.fillText(`ходов: ${this.movesMade}`, L.SW / 2, gy + cs * 3 + 60);
    ctx.font = font(34); ctx.fillStyle = '#8e8b87';
    ctx.fillText('нажми на кусочек рядом с пустым местом', L.SW / 2, gy + cs * 3 + 110);
    if (solvedView) { ctx.font = font(80); ctx.fillStyle = '#f2d27a'; ctx.fillText('Картина собрана!', L.SW / 2, gy - 60 + 0); }
  }
}

export const MINIGAMES = { search: SearchGame, match3: Match3Game, puzzle: SlidePuzzle };
