// Логика забега: герой, препятствия, враги, босс, монеты, находки, отрисовка.

import { W, H, GROUND_Y, FLOOR_TOP, PLAYER_X, PLAYER, SCORE, PX_PER_METER, HERO_SCALE, DIFFICULTY, ECONOMY } from './config.js?v=7e3653f';
import { recolor } from './pixels.js?v=7e3653f';
import { demonReady, drawDemon } from './demon.js?v=7e3653f';
import * as art from './art.js?v=7e3653f';
import { sfx } from './audio.js?v=7e3653f';
import { rigReady, drawRigHero } from './rig.js?v=7e3653f';
import { computeMods } from './artifacts.js?v=7e3653f';
import { applyCharacter, applyUpgrades } from './characters.js?v=7e3653f';
import { ENEMY, drawTrapdoor } from './enemies.js?v=7e3653f';

// Все виды врагов и препятствий — в enemies.js.
const OBST = ENEMY;
const isPit = (o) => OBST[o.type].pitLike && (o.open ?? 1) > 0.6;

const rand = (a, b) => a + Math.random() * (b - a);
const smooth01 = (v) => { const x = Math.max(0, Math.min(1, v)); return x * x * (3 - 2 * x); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function pickWeighted(weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  if (!entries.length) return null;
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of entries) { if ((r -= w) <= 0) return k; }
  return entries[0][0];
}

// Картинка-полоса, подогнанная по высоте: оригинал + зеркальная копия — для бесшовной прокрутки.
function tileStrip(img, h, tint) {
  if (tint) img = recolor(img, tint);
  const w = Math.round(img.width * h / img.height);
  const c = document.createElement('canvas');
  c.width = w * 2; c.height = h;
  const ctx = c.getContext('2d');
  // края картинки обрезаем на пару пикселей: там полупрозрачная кромка, она давала тонкую линию на стыке
  const e = 3, sw = img.width - e * 2;
  ctx.drawImage(img, e, 0, sw, img.height, 0, 0, w + 1, h);
  ctx.translate(w * 2, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(img, e, 0, sw, img.height, 0, 0, w + 1, h);
  return c;
}

const DOOR_AHEAD = 300; // дверь выхода стоит на столько дальше линии финиша
const BOSS_H = 430;

function shadow(ctx, x, y, rx, alpha) {
  ctx.save();
  ctx.fillStyle = `rgba(15,10,8,${alpha})`;
  ctx.beginPath(); ctx.ellipse(x, y, rx, rx * 0.2, 0, 0, 7); ctx.fill();
  ctx.restore();
}

export class Game {
  // opts: { images, vibration, paperFx, onEnd, equipped, seenHints, onSeen, onRelic, onBoss, demo }
  constructor(level, skin, opts) {
    this.level = level;
    this.skin = skin;
    this.opts = opts;
    this.mods = applyUpgrades(applyCharacter(computeMods(opts.equipped || []), opts.character), opts.upgrades);
    this.buildPaper();
    const imgs = opts.images || {};
    this.wall = imgs.wall ? tileStrip(imgs.wall, FLOOR_TOP + 24, level.palette?.wallTint) : art.createWallLayer(level.palette, 11 + (level.room || 7));
    this.floor = imgs.floor ? tileStrip(imgs.floor, H - FLOOR_TOP + 12) : art.createFloorLayer(level.palette, 5);
    this.seen = new Set(opts.seenHints || []);
    this.reset();
  }

  buildPaper() { this.overlay = art.createPaperOverlay(3); }

  reset() {
    const M = this.mods, L = this.level;
    const D = DIFFICULTY[L.diff] || DIFFICULTY.normal;
    this.t = 0;
    this.camX = 0;
    this.speed = L.speed * M.speedMul;
    this.maxLives = clamp(D.lives + M.lives, 1, 12);   // сердца с артефактов и прокачки — до 12
    this.lives = this.maxLives;
    this.shield = M.shield;
    this.revives = M.revive;
    this.coins = 0;
    this.bonus = 0;
    this.kills = 0;
    this.status = 'running'; // running | dying | won | over
    this.endTimer = 0;
    this.shake = 0;
    this.nextId = 1;
    this.obstacles = [];
    this.coinsArr = [];
    this.bullets = [];
    this.particles = [];
    this.toasts = [];
    this.found = [];          // артефакты, найденные в этом забеге
    this.spawnCount = 0;
    this.finishX = Number.isFinite(L.length) ? PLAYER_X + L.length * PX_PER_METER : Infinity;
    // старт с флажка (лёгкий режим): забег продолжается с сохранённого места
    this.startAt = this.opts.startAt || 0;
    this.camX = this.startAt * PX_PER_METER;
    this.lastCp = this.startAt;
    this.nextSpawnX = this.camX + W + 300;
    this.doorOpen = 0;
    this.enter = 0;
    this.lastHealM = 0;
    this.lastFindM = 0;
    // находка в комнате: решаем заранее, на каком по счёту препятствии она появится
    this.relicAt = (!this.opts.demo && L.kind === 'room' && !L.boss && Math.random() < L.findChance * M.luck)
      ? 2 + Math.floor(Math.random() * 4) : -1;
    this.relics = [];
    // прошлые смерти: изредка (не чаще 1–2 раз за забег) на стене висит портрет Флита
    this.portraits = [];
    const dr = this.opts.deathRooms || [];
    if (dr.length && !this.opts.demo) {
      const span = Number.isFinite(this.finishX) ? this.finishX - PLAYER_X : 40000;
      const n = Math.random() < 0.3 ? (Math.random() < 0.3 ? 2 : 1) : 0;
      for (let i = 0; i < n; i++) {
        const at = PLAYER_X + 900 + Math.random() * Math.max(600, span - 1500);
        this.portraits.push({ wx: at * 0.85, room: dr[Math.floor(Math.random() * dr.length)], tilt: (Math.random() - 0.5) * 0.12 });
      }
    }
    this.met = new Set();     // какие враги попались на глаза в этом забеге
    this.killsBy = {};        // сколько убито каждого вида
    this.boss = L.boss ? {
      name: L.boss.name, hp: L.boss.hp, max: L.boss.hp, enter: 0, attackT: 2.4, dead: 0, flash: 0, roar: 0,
    } : null;
    this.p = {
      y: GROUND_Y, vy: 0, onGround: true,
      slideT: 0, kickT: 0, shootCd: 0, flash: 0, recoil: 0,
      invuln: 0, hurtT: 0, jumpBuf: 0, slideBuf: 0, landT: 0, dashT: 0, dashCd: 0,
    };
  }

  get meters() { return Math.floor(this.camX / PX_PER_METER); }
  get score() { return Math.round((this.meters * SCORE.perMeter + this.coins * SCORE.coin + this.bonus) * this.mods.scoreMult); }
  get progress() {
    if (this.boss && !this.boss.dead) return null;
    return Number.isFinite(this.finishX) ? Math.min(1, this.camX / (this.finishX - PLAYER_X)) : null;
  }
  get enemySpeed() { return (this.level.enemy || 1) * this.mods.enemyMul; }

  // ---------- ввод ----------
  action(a) {
    if (this.status !== 'running') return;
    const p = this.p, M = this.mods;
    if (a === 'jump') {
      if (p.onGround) this.doJump();
      else if (M.doubleJump && !p.dj) { p.dj = true; this.doJump(); }   // двойной прыжок
      else p.jumpBuf = 0.15;
    } else if (a === 'slide') {
      if (p.onGround) { p.slideT = PLAYER.slideTime * M.slideMul; p.kickT = 0; sfx.slide(); }
      else { p.vy = Math.max(p.vy, 1500); p.slideBuf = 0.4; } // быстрое приземление
    } else if (a === 'kick') {
      if (p.kickT <= 0) { p.kickT = PLAYER.kickTime; p.slideT = 0; sfx.kick(); }
    } else if (a === 'shoot') {
      if (p.shootCd <= 0) this.doShoot();
    } else if (a === 'right') {
      // рывок: на миг становишься тенью и проходишь сквозь призрачные решётки
      if (p.dashCd <= 0) {
        p.dashT = 0.38 * (M.dashLen || 1); p.dashCd = 1.1 * M.dashMul; p.slideT = 0;
        sfx.slide();
        for (let i = 0; i < 8; i++) this.particles.push({ kind: 'dust', x: this.camX + PLAYER_X - 30, y: p.y - rand(20, 150), vx: rand(-500, -250), vy: 0, life: 0.3, max: 0.3, rot: 0, size: rand(4, 8), color: '#5a5170', g: 0 });
      }
    }
  }

  doJump() {
    const p = this.p;
    p.vy = -PLAYER.jumpVelocity * Math.sqrt(this.mods.jumpMul); p.onGround = false; p.slideT = 0; p.kickT = 0;
    sfx.jump();
    this.puff(this.camX + PLAYER_X - 10, GROUND_Y, 5);
  }

  doShoot() {
    const p = this.p;
    if (this.mods.weapon === 'fists') { this.punch(); return; }
    p.shootCd = PLAYER.shootCooldown * this.mods.reloadMul;
    p.flash = 0.12; p.recoil = 1;
    const y = p.slideT > 0 ? p.y - 55 : p.y - 125;
    const rifle = this.mods.weapon === 'rifle';
    this.bullets.push({ x: this.camX + PLAYER_X + 80, y, pierce: rifle ? 99 : this.mods.pierce, hitIds: [], rifle, dmg: rifle ? 3 : 1 });
    if (rifle) this.shake = Math.max(this.shake, 9);
    sfx.shoot();
    this.shake = Math.max(this.shake, 4);
  }

  // Удар кулаком (Сириус): всё, что рядом впереди — тени, мебель, щиты.
  punch() {
    const p = this.p, px = this.camX + PLAYER_X;
    p.shootCd = 0.32; p.kickT = PLAYER.kickTime * 0.7; p.recoil = 0;
    sfx.kick(); this.shake = Math.max(this.shake, 6);
    let hit = false;
    for (const o of this.obstacles) {
      if (o.dead) continue;
      const d = OBST[o.type];
      if (!(d.hp || d.block) || d.act === 'dash') continue;
      if (o.x > px + 280 || o.x + o.w < px - 20) continue;
      hit = true;
      if (d.hp && !d.kickKills) { o.hp -= 2; o.flash = 0.14; if (o.hp <= 0) this.kill(o); else o.x += 40; }
      else if (d.kickKills) this.kill(o);
      else this.smash(o);
    }
    this.floatText(px + 120, p.y - 190, hit ? 'БАМ!' : 'ух');
  }

  // ---------- спавн ----------
  weights() {
    const w = { ...this.level.obstacles };
    for (const k in w) if (OBST[k]?.hp) w[k] *= this.mods.hordeMul;
    return w;
  }

  // Тот же вид два раза подряд — редко: перебрасываем.
  pickType(w = this.weights()) {
    let t = null;
    for (let i = 0; i < 4; i++) {
      t = pickWeighted(w);
      if (t !== this.lastType && t !== this.lastType2) break;
    }
    this.lastType2 = this.lastType; this.lastType = t;
    return t;
  }

  makeObstacle(type, x) {
    const d = OBST[type];
    const o = { id: this.nextId++, type, x, dead: 0, hit: false, variant: (Math.random() * 3) | 0, hp: d.hp || 0, flash: 0, rise: 0, fall: 0, hop: 0 };
    if (type === 'pit') { o.w = Math.min(270, Math.max(150, this.speed * 0.34)); o.h = 0; }
    else { o.w = d.w; o.h = d.h || 0; }
    if (type === 'trapdoor') o.open = 0;
    this.obstacles.push(o);
    return o;
  }

  spawn() {
    const lvl = this.level;
    const type = this.pickType();
    if (!type) { this.nextSpawnX += 400; return; }
    const x = this.nextSpawnX;
    const o = this.makeObstacle(type, x);
    this.spawnCount++;
    let end = x + o.w;

    // сдвоенное препятствие: второе почти сразу за первым
    let combo = lvl.combo || 0;
    if (lvl.comboGrowth) combo = Math.min(0.75, combo + this.meters / 4000);
    if (Math.random() < combo) {
      const t2 = this.pickType();
      if (t2 && !(type === 'gate' && t2 === 'gate')) {
        const o2 = this.makeObstacle(t2, end + this.speed * rand(0.42, 0.55));
        end = o2.x + o2.w;
      }
    }

    // оболы — редкие
    const coinY = GROUND_Y - 80;
    if (type === 'pit' && Math.random() < 0.5) {
      for (let i = 0; i < 3; i++) this.addCoin(x - 20 + (i / 2) * (o.w + 40), coinY - 40 - Math.sin((i / 2) * Math.PI) * 170);
    }
    const gap = rand(lvl.gap[0], lvl.gap[1]) * this.speed;
    if (Math.random() < ECONOMY.coinRowChance) {
      const sx = end + gap * 0.35;
      const high = Math.random() < 0.3;
      for (let i = 0; i < 3; i++) this.addCoin(sx + i * 54, high ? GROUND_Y - 320 : coinY);
    }
    // находка
    if (this.spawnCount === this.relicAt) this.relics.push({ x: end + gap * 0.5, y: GROUND_Y - 120, taken: false });
    this.nextSpawnX = end + gap;
  }

  addCoin(x, y) { this.coinsArr.push({ x, y, id: this.nextId++, taken: false }); }

  // ---------- обновление ----------
  update(dt) {
    dt = Math.min(dt, 1 / 30);
    this.t += dt;
    const p = this.p, M = this.mods, L = this.level;

    if (this.status === 'running') {
      const maxSpeed = 1150;
      this.speed = Math.min(maxSpeed, (L.speed + L.speedGrowth * this.meters / 10) * M.speedMul);
    } else if (this.status === 'won') {
      // добегает до двери, дверь распахивается, герой уходит в проём
      const target = this.finishX + DOOR_AHEAD - PLAYER_X;
      this.speed = Math.max(300, this.speed * Math.pow(0.5, dt));
      if (this.camX + this.speed * dt >= target) { this.camX = target; this.speed = 0; }
      this.doorOpen = Math.min(1, Math.max(this.doorOpen, 1 - (target - this.camX) / 380));
      if (this.speed === 0) {
        this.enter = Math.min(1, this.enter + dt / 0.75);
        if (this.enter >= 1) this.endTimer -= dt;
      }
      if (this.endTimer <= 0) { this.status = 'over'; this.opts.onEnd?.(true); }
    } else {
      this.speed *= Math.pow(0.12, dt);
      this.endTimer -= dt;
      if (this.endTimer <= 0 && this.status !== 'over') {
        this.status = 'over';
        this.opts.onEnd?.(false);
      }
    }
    this.camX += this.speed * dt;
    if (p.dashT > 0 && this.status === 'running') this.camX += this.speed * 0.8 * dt; // рывок вперёд

    const spawning = !this.opts.demo && !this.boss && this.status === 'running';
    while (spawning && this.camX + W + 200 > this.nextSpawnX && this.nextSpawnX < this.finishX - 500) this.spawn();

    // таймеры
    for (const k of ['slideT', 'kickT', 'shootCd', 'flash', 'invuln', 'hurtT', 'landT', 'jumpBuf', 'slideBuf', 'dashT', 'dashCd']) p[k] = Math.max(0, p[k] - dt);
    p.recoil = Math.max(0, p.recoil - dt * 6);
    // подкат не кончается, пока над головой низкое препятствие (стая, луч, щупальце…)
    if (p.slideT > 0 && p.slideT < 0.12 && p.onGround) {
      const x = this.camX + PLAYER_X, stand = { l: x - PLAYER.width / 2, r: x + PLAYER.width / 2, t: p.y - PLAYER.height };
      for (const o of this.obstacles) {
        if (o.dead || OBST[o.type].act !== 'slide') continue;
        const b = this.obstBox(o);
        if (b && stand.r > b.l - 10 && stand.l < b.r + 10 && stand.t < b.b) { p.slideT = 0.12; break; }
      }
    }
    this.shake = Math.max(0, this.shake - dt * 30);

    // Ида: сама перепрыгивает ямы и люки
    if (M.autoJump && p.onGround && this.status === 'running') {
      const fx = this.camX + PLAYER_X + 30;
      if (this.obstacles.some(o => OBST[o.type].pitLike && o.x - fx < this.speed * 0.12 && o.x - fx > -10)) this.doJump();
    }
    // физика героя
    const px = this.camX + PLAYER_X;
    const overPit = this.obstacles.find(o => isPit(o) && px > o.x + 18 && px < o.x + o.w - 18);
    if (!p.onGround || overPit) {
      p.vy += PLAYER.gravity * dt;
      p.y += p.vy * dt;
    }
    if (p.y >= GROUND_Y && !overPit) {
      if (!p.onGround) {
        p.onGround = true;
        p.dj = false;
        p.landT = 0.14;
        this.puff(px, GROUND_Y, 4);
        if (p.jumpBuf > 0 && this.status === 'running') this.doJump();
        else if (p.slideBuf > 0 && this.status === 'running') { p.slideT = PLAYER.slideTime * M.slideMul; sfx.slide(); }
      }
      p.y = GROUND_Y; p.vy = 0;
    } else if (overPit && p.onGround) {
      p.onGround = false;
    }
    if (overPit && p.y > GROUND_Y + 30 && !overPit.hit) {
      overPit.hit = true;
      if (p.invuln <= 0) this.hurt();
      p.vy = -PLAYER.jumpVelocity * 1.05; // выкарабкивается
      p.y = GROUND_Y + 10;
    }
    if (p.y > H + 200) { p.y = GROUND_Y; p.vy = 0; }

    // препятствия и враги
    const es = this.enemySpeed;
    for (const o of this.obstacles) {
      const d = OBST[o.type];
      if (o.dead) { o.dead = Math.min(1, o.dead + dt * 2.5); continue; }
      if (d.speed) o.x -= d.speed * es * dt;
      o.flash = Math.max(0, o.flash - dt);
      const dist = o.x - px;
      d.update?.(o, this, dt, dist);
      if (o.x - this.camX < W - 40) this.met.add(o.type);
      // подсказка показана — тип запомнен
      if (!this.seen.has(o.type) && o.x + o.w < px) { this.seen.add(o.type); this.opts.onSeen?.(o.type); }
    }

    const hb = this.playerBox();

    // удар ногой
    if (p.kickT > PLAYER.kickTime * 0.25) {
      for (const o of this.obstacles) {
        if (OBST[o.type].act !== 'kick' || o.dead) continue;
        const d = o.x - hb.r;
        if (d > -60 && d < PLAYER.kickRange + M.kickAdd) OBST[o.type].kickKills ? this.kill(o) : this.smash(o);
      }
    }

    // пули
    for (const b of this.bullets) {
      b.x += PLAYER.bulletSpeed * dt;
      for (const o of this.obstacles) {
        if (o.dead || b.dead || b.hitIds.includes(o.id)) continue;
        const d = OBST[o.type];
        if (!d.hp && !d.block) continue; // птицы, руки, люстры, призраки — пуля пролетает
        const box = this.obstBox(o);
        if (!box) continue;
        if (b.x > box.l && b.x < box.r + 20 && b.y > box.t && b.y < box.b) {
          b.hitIds.push(o.id);
          if (b.rifle && !d.hp && d.act === 'kick') { this.smash(o); continue; }       // винтовка ломает мебель
          if (b.rifle && d.kickKills) { this.kill(o); continue; }                       // и пробивает щит
          if (d.hp && !d.kickKills) {
            o.hp -= b.dmg || 1; o.flash = 0.14;
            if (o.hp <= 0) this.kill(o);
            else { sfx.hit(); this.splat(b.x, b.y, 5); o.x += 18; }
            if (b.pierce > 0) { b.pierce--; continue; }
          } else this.puff(b.x, b.y, 6, d.act === 'dash' ? '#5a5170' : '#5e4330');
          b.dead = true;
        }
      }
      // босс
      const B = this.boss;
      if (!b.dead && B && !B.dead && B.enter >= 1) {
        const bx = this.camX + this.bossX();
        if (b.x > bx - 80 && b.y > GROUND_Y - BOSS_H && b.y < GROUND_Y) {
          b.dead = true; B.hp--; B.flash = 0.12; sfx.hit(); this.splat(b.x, b.y, 6);
          this.bonus += 10;
          if (B.hp <= 0) this.killBoss();
        }
      }
      if (b.x - this.camX > W + 60) b.dead = true;
    }
    this.bullets = this.bullets.filter(b => !b.dead);

    // босс
    if (this.boss) this.updateBoss(dt);

    // столкновения
    if (this.status === 'running') {
      for (const o of this.obstacles) {
        if (o.dead || o.hit || OBST[o.type].pitLike) continue;
        if (OBST[o.type].act === 'dash' && p.dashT > 0) continue; // тенью сквозь решётку и туман
        const box = this.obstBox(o);
        if (!box) continue;
        if (hb.r > box.l && hb.l < box.r && hb.b > box.t && hb.t < box.b) {
          o.hit = true;
          if (p.invuln > 0) continue;
          this.hurt();
          if (OBST[o.type].block && !OBST[o.type].hp) this.smash(o, true);
        }
      }
    }

    // оболы (с магнитом)
    for (const c of this.coinsArr) {
      if (c.taken) continue;
      if (M.magnet) {
        const dx = px - c.x, dy = (p.y - 90) - c.y, dd = Math.hypot(dx, dy);
        if (dd < M.magnet + 60) { c.x += dx / dd * 900 * dt; c.y += dy / dd * 900 * dt; }
      }
      if (c.x > hb.l - 18 && c.x < hb.r + 18 && c.y > hb.t - 18 && c.y < hb.b + 10) {
        c.taken = true;
        this.coins++;
        sfx.coin();
        this.sparkle(c.x, c.y);
      }
    }

    // находки
    for (const r of this.relics) {
      if (r.taken) continue;
      if (r.x > hb.l - 40 && r.x < hb.r + 40 && r.y > hb.t - 40 && r.y < hb.b + 20) this.takeRelic(r);
    }
    // бесконечный забег: шанс находки каждые 400 м
    if (this.level.kind === 'endless' && !this.opts.demo && this.meters - this.lastFindM >= 400) {
      this.lastFindM = this.meters;
      if (Math.random() < this.level.findChance * M.luck) this.relics.push({ x: this.camX + W + 200, y: GROUND_Y - 120, taken: false });
    }

    // флажки сохранения
    for (const cp of L.checkpoints || []) {
      if (cp > this.lastCp && this.meters >= cp && this.status === 'running') {
        this.lastCp = cp;
        this.toast('Флажок: место сохранено');
        sfx.coin();
        this.opts.onCheckpoint?.(cp);
      }
    }

    // лечение артефактом
    if (M.healEvery && this.status === 'running' && this.meters - this.lastHealM >= M.healEvery) {
      this.lastHealM = this.meters;
      if (this.lives < this.maxLives) { this.lives++; this.toast('+1 сердце'); }
    }

    // финиш
    if (this.status === 'running' && px >= this.finishX) {
      this.status = 'won';
      this.endTimer = 0.35;
      sfx.win();
    }

    // смерть: чернильные струйки поднимают героя к стене
    if (this.deathT !== undefined && this.lives <= 0) {
      this.deathT += dt;
      const k = Math.min(1, Math.max(0, (this.deathT - 0.5) / 1.0));
      if (this.deathT > 0.45 && this.deathT < 1.7 && Math.random() < 0.7) {
        const f = this.deathFoot();
        this.particles.push({ kind: 'dust', x: this.camX + f.x + rand(-50, 50), y: f.y - rand(0, 150 * (1 - k * 0.5)),
          vx: rand(-30, 30), vy: rand(-220, -120), life: rand(0.5, 0.9), max: 0.9, rot: 0, size: rand(4, 9), color: '#16120f', g: -60 });
      }
    }

    // частицы и надписи
    for (const q of this.particles) {
      q.life -= dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.vy += (q.g ?? 1400) * dt;
      q.rot += (q.vr || 0) * dt;
    }
    this.particles = this.particles.filter(q => q.life > 0);
    for (const tt of this.toasts) tt.life -= dt;
    this.toasts = this.toasts.filter(tt => tt.life > 0);

    // чистим то, что ушло за левый край
    const left = this.camX - 400;
    this.obstacles = this.obstacles.filter(o => o.x + o.w > left);
    this.coinsArr = this.coinsArr.filter(c => c.x > left && !c.taken);
    this.relics = this.relics.filter(r => r.x > left && !r.taken);
  }

  // ---------- босс ----------
  bossX() { return W - 170 + Math.sin(this.t * 0.9) * 30 + (1 - this.boss.enter) * 420; }

  updateBoss(dt) {
    const B = this.boss;
    B.flash = Math.max(0, B.flash - dt);
    if (B.dead) { B.dead = Math.min(1, B.dead + dt * 0.7); return; }
    if (B.enter < 1) { B.enter = Math.min(1, B.enter + dt / 1.6); if (B.enter >= 1) this.toast(B.name.toUpperCase() + '!'); return; }
    if (this.status !== 'running') return;
    B.attackT -= dt;
    // чем меньше здоровья, тем чаще швыряет препятствия
    if (B.attackT <= 0) {
      const w = this.weights(); delete w.brute;
      for (const k in w) if (OBST[k].noBoss || OBST[k].pitLike && k !== 'pit') delete w[k];
      const type = this.pickType(w) || 'pit';
      this.makeObstacle(type, this.camX + this.bossX() - 60);
      B.roar = 0.3;
      const rage = 1 - B.hp / B.max;
      B.attackT = rand(1.15, 1.6) * (this.level.gap[0] / 1.05) * (1 - rage * 0.35);
    }
    B.roar = Math.max(0, B.roar - dt);
  }

  killBoss() {
    const B = this.boss;
    B.dead = 0.01;
    this.kills++;
    this.bonus += 500;
    this.shake = 20;
    sfx.monsterDie();
    this.splat(this.camX + this.bossX(), GROUND_Y - 220, 40);
    this.toast('Хранитель повержен');
    // убираем то, что он успел накидать, и открываем дверь
    for (const o of this.obstacles) if (o.x > this.camX + PLAYER_X + 120) o.dead = 0.01;
    this.finishX = this.camX + PLAYER_X + 900;
    // босс всегда оставляет находку, и пощедрее
    this.relics.push({ x: this.camX + PLAYER_X + 500, y: GROUND_Y - 120, taken: false, bias: 2.5 });
    this.opts.onBoss?.();
  }

  takeRelic(r) {
    r.taken = true;
    sfx.win();
    const res = this.opts.onRelic?.(r.bias || 1);
    if (res) { this.found.push(res); this.toast(res.text, 2.6); }
    this.sparkle(r.x, r.y); this.sparkle(r.x, r.y);
  }

  toast(text, life = 1.8) { this.toasts.push({ text, life, max: life }); }

  playerBox() {
    const p = this.p;
    const h = p.slideT > 0 ? PLAYER.slideHeight : PLAYER.height;
    const x = this.camX + PLAYER_X;
    return { l: x - PLAYER.width / 2, r: x + PLAYER.width / 2, t: p.y - h, b: p.y };
  }

  obstBox(o) {
    const d = OBST[o.type];
    return d.box ? d.box(o, this) : null;
  }

  hurt() {
    if (this.god) return;   // бессмертие из админ-панели
    const p = this.p;
    if (this.shield > 0) {
      this.shield--;
      p.invuln = 1.0;
      this.toast('Щит принял удар');
      this.sparkle(this.camX + PLAYER_X, p.y - 100);
      sfx.kick();
      return;
    }
    this.lives--;
    p.invuln = PLAYER.invulnTime + this.mods.invulnAdd;
    p.hurtT = 0.4;
    this.shake = 14;
    sfx.hit();
    if (this.opts.vibration && navigator.vibrate) navigator.vibrate(120);
    this.splat(this.camX + PLAYER_X, p.y - 100, 12);
    if (this.lives <= 0 && this.revives > 0) {
      this.revives--;
      this.lives = 1;
      p.invuln = 2.5;
      this.toast('Свеча догорела — ты встал');
      return;
    }
    if (this.lives <= 0) {
      this.status = 'dying';
      this.endTimer = 2.5;
      this.deathT = 0;      // анимация «стал портретом»
      sfx.lose();
    }
  }

  smash(o, byCrash = false) {
    o.dead = 0.01;
    if (!byCrash) { this.bonus += 25; this.floatText(o.x + o.w / 2, GROUND_Y - o.h - 10, '+25'); }
    this.shake = Math.max(this.shake, 8);
    const colors = ['#5e4330', '#3b2a1e', '#8a6a4a', '#c9a24a'];
    for (let i = 0; i < 22; i++) {
      this.particles.push({
        kind: 'splinter', x: o.x + rand(0, o.w), y: GROUND_Y - rand(10, o.h),
        vx: rand(150, 650), vy: rand(-750, -150), life: rand(0.6, 1.1), max: 1,
        rot: rand(0, 6), vr: rand(-14, 14), size: rand(10, 30), color: colors[i % 4],
      });
    }
  }

  kill(o) {
    o.dead = 0.01;
    this.kills++;
    this.killsBy[o.type] = (this.killsBy[o.type] || 0) + 1;
    const pts = OBST[o.type].pts || 30;
    this.bonus += pts;
    if (this.mods.killCoin) { this.coins += this.mods.killCoin; this.floatText(o.x + o.w / 2, GROUND_Y - o.h - 60, '+' + this.mods.killCoin + ' обол'); }
    const box = this.obstBox(o) || { t: GROUND_Y - 200, b: GROUND_Y };
    this.floatText(o.x + o.w / 2, box.t - 10, '+' + pts);
    this.splat(o.x + o.w / 2, (box.t + box.b) / 2, 16);
    sfx.monsterDie();
  }

  splat(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        kind: 'ink', x, y, vx: rand(-350, 350), vy: rand(-550, 50), life: rand(0.4, 0.9), max: 0.9,
        rot: 0, size: rand(4, 13), color: '#16120f',
      });
    }
  }

  puff(x, y, n, color = '#7d6e60') {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        kind: 'dust', x, y: y - 4, vx: rand(-120, 40), vy: rand(-120, -20), life: rand(0.3, 0.5), max: 0.5,
        rot: 0, size: rand(5, 11), color, g: 100,
      });
    }
  }

  sparkle(x, y) {
    for (let i = 0; i < 5; i++) {
      this.particles.push({
        kind: 'spark', x, y, vx: rand(-160, 160), vy: rand(-260, -40), life: 0.4, max: 0.4,
        rot: rand(0, 3), vr: 8, size: rand(5, 9), color: '#e8c467', g: 500,
      });
    }
  }

  floatText(x, y, text) {
    this.particles.push({ kind: 'text', x, y, vx: 0, vy: -90, g: 0, life: 0.9, max: 0.9, rot: 0, text });
  }

  // ---------- отрисовка ----------
  draw(ctx) {
    const t = this.t;
    const boil = Math.floor(t * 8);
    const R = (id) => art.makeRng(boil * 7919 + id * 104729 + 1);
    const imgs = this.opts.images || {};
    const L = this.level;

    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);

    this.drawLayer(ctx, this.wall, 0.85, 0);
    // портреты Флита — едут вместе с обоями
    for (const pt of this.portraits) {
      const px = pt.wx - this.camX * 0.85;
      if (px > -120 && px < W + 120) this.drawOldPortrait(ctx, px, 210, pt);
    }
    const dying = this.deathT !== undefined && this.lives <= 0;
    if (dying && this.deathT >= 0.9) this.drawDeath(ctx, t);
    this.drawLayer(ctx, this.floor, 1, FLOOR_TOP - 8);

    const sx = (wx) => wx - this.camX;

    // ямы
    for (const o of this.obstacles) {
      if (!OBST[o.type].pitLike || sx(o.x) > W + 50 || sx(o.x + o.w) < -50) continue;
      if (o.type === 'trapdoor') drawTrapdoor(ctx, o, sx(o.x), art.makeRng(o.id * 31 + (boil % 2)));
      else art.drawPit(ctx, sx(o.x), o.w, art.makeRng(o.id * 31 + (boil % 2)));
    }
    // флажки сохранения (лёгкий режим)
    for (const cp of L.checkpoints || []) {
      const fx = sx(PLAYER_X + cp * PX_PER_METER);
      if (fx < -60 || fx > W + 60) continue;
      const got = this.lastCp >= cp;
      ctx.save();
      ctx.strokeStyle = '#16120f'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(fx, GROUND_Y + 4); ctx.lineTo(fx, GROUND_Y - 190); ctx.stroke();
      const wave = Math.sin(t * 5 + cp) * 6;
      ctx.fillStyle = got ? '#c9a24a' : '#b3302c'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(fx, GROUND_Y - 188); ctx.quadraticCurveTo(fx + 40, GROUND_Y - 180 + wave, fx + 78, GROUND_Y - 166);
      ctx.quadraticCurveTo(fx + 40, GROUND_Y - 148 + wave, fx, GROUND_Y - 142); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    // дверь выхода
    if (Number.isFinite(this.finishX) && sx(this.finishX) < W + 200) art.drawExit(ctx, L.exit || 'door', sx(this.finishX) + DOOR_AHEAD, this.doorOpen, L.doorLabel ?? 'ВЫХОД', t, imgs.furniture);

    // босс (позади всего, у правого края)
    if (this.boss && this.boss.dead < 1) {
      const B = this.boss, bx = this.bossX();
      shadow(ctx, bx, GROUND_Y + 2, 150, 0.35 * (1 - B.dead));
      ctx.save();
      if (B.roar > 0) { ctx.translate(bx, GROUND_Y); ctx.scale(1 + B.roar * 0.08, 1 - B.roar * 0.05); ctx.translate(-bx, -GROUND_Y); }
      if (demonReady()) drawDemon(ctx, bx, GROUND_Y + 4, BOSS_H, t * 0.6, B.dead, 3, 'boss', B.flash);
      else art.drawMonster(ctx, bx - 120, GROUND_Y, 240, BOSS_H, t, R(5), B.dead);
      ctx.restore();
    }

    // оболы
    for (const c of this.coinsArr) {
      const x = sx(c.x);
      if (x < -30 || x > W + 30) continue;
      if (imgs.coin) this.drawImg(ctx, imgs.coin, x - 15, c.y - 15, 30, 30);
      else art.drawCoin(ctx, x, c.y, t, R(c.id));
    }
    // находки
    for (const r of this.relics) if (!r.taken) art.drawRelic(ctx, sx(r.x), r.y, t);

    // препятствия
    for (const o of this.obstacles) {
      const d = OBST[o.type];
      if (d.pitLike) continue;
      const x = sx(o.x);
      if (x > W + 420 || x + o.w < -60) continue;
      if (d.block && !d.hp && o.dead) continue;           // разбитая мебель — только щепки
      const big = o.type === 'chandelier' ? [o.fall >= 1 ? 0.55 : 0.4 * o.fall, 0.3] : (d.shadow || [0.55, 0.3]);
      if (!o.dead && big[0]) shadow(ctx, x + o.w / 2, GROUND_Y + 2, o.w * big[0], big[1]);
      if (o.type === 'furniture') {
        const box = this.obstBox(o);
        if (imgs.furniture) {
          ctx.save(); if (o.dead) ctx.globalAlpha = 1 - o.dead;
          this.drawImg(ctx, imgs.furniture, x, box.b - o.h, o.w, o.h);
          ctx.restore();
        } else art.drawFurniture(ctx, x, GROUND_Y, o.w, o.h, 2, R(o.id));
      } else d.draw?.(ctx, o, x, this, t, R);
    }

    // пули
    for (const b of this.bullets) art.drawBullet(ctx, sx(b.x), b.y, R(7));

    // герой
    const p = this.p;
    const blink = p.invuln > 0 && Math.floor(t * 16) % 2 === 0;
    if (dying) { if (this.deathT < 0.9) this.drawDeath(ctx, t); }   // пока лежит и взлетает — впереди
    else if (!blink) {
      let pose = 'run';
      if (this.status === 'dying' || this.status === 'over' && this.lives <= 0) pose = 'slide';
      else if (p.slideT > 0) pose = 'slide';
      else if (p.kickT > 0) pose = 'kick';
      else if (!p.onGround) pose = 'jump';
      const animT = this.status === 'running' || this.status === 'won' ? t : t * Math.min(1, this.speed / 400);
      const air = Math.min(1, Math.max(0, (GROUND_Y - p.y) / 260));
      const e = this.enter * this.enter * (3 - 2 * this.enter);
      if (e < 0.3) shadow(ctx, PLAYER_X, GROUND_Y + 2, 62 * (1 - air * 0.5), 0.3 * (1 - air * 0.6));
      // рывок: полосы скорости позади
      if (p.dashT > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(40,30,60,0.5)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        for (let i = 0; i < 6; i++) { const yy = p.y - 30 - i * 26; ctx.beginPath(); ctx.moveTo(PLAYER_X - 40, yy); ctx.lineTo(PLAYER_X - 140 - (i % 2) * 40, yy); ctx.stroke(); }
        ctx.restore();
      }
      ctx.save();
      // уход в выход: в глубину к стене, а дальше — по лестнице вверх, вниз или в кабину лифта
      const kind = L.exit || 'door', deep = Math.min(1, e * 2), go = Math.max(0, e - 0.45) / 0.55;
      let dx = 0, dy = (FLOOR_TOP + 6 - GROUND_Y) * (kind === 'door' || kind === 'secret' ? e : deep), fade = Math.max(0, (e - 0.45) / 0.55);
      if (kind === 'stairsUp') { dx = go * 70; dy -= go * 190; fade = Math.max(0, (e - 0.6) / 0.4); }
      if (kind === 'stairsDown') { dx = go * 60; dy += go * 110; fade = Math.max(0, (e - 0.5) / 0.4); }
      if (kind === 'lift') fade = Math.max(0, (e - 0.8) / 0.2) * 0.6;
      // луч света поднимает героя; в зеркало и камин — уходит в глубину и тает; в картину — запрыгивает в раму
      if (kind === 'lightBeam') { dy = -go * 330 - deep * 10; fade = Math.max(0, (e - 0.55) / 0.45); }
      if (kind === 'mirror') { dy = (FLOOR_TOP + 6 - GROUND_Y) * deep; fade = Math.max(0, (e - 0.5) / 0.4); }
      if (kind === 'fireplace') { dy = (FLOOR_TOP + 6 - GROUND_Y) * deep; fade = Math.max(0, (e - 0.4) / 0.4); }
      if (kind === 'painting') { dy = (FLOOR_TOP + 6 - GROUND_Y) * deep - Math.sin(Math.min(1, go) * Math.PI / 2) * 150; fade = Math.max(0, (e - 0.7) / 0.3); }
      ctx.globalAlpha = (1 - Math.min(1, fade)) * (p.dashT > 0 ? 0.55 : 1);
      ctx.translate(PLAYER_X + dx, p.y + dy);
      const shrink = kind === 'painting' ? 0.2 * deep + 0.45 * go : kind === 'lightBeam' ? 0.1 * deep : 0.2 * deep;
      ctx.scale(HERO_SCALE * (1 - shrink) * (this.skin.sx || 1), HERO_SCALE * (1 - shrink) * (this.skin.sy || 1));
      const ex = {
        kickT: 1 - p.kickT / PLAYER.kickTime, recoil: p.recoil, flash: p.flash,
        aim: p.shootCd > 0.05, hurt: p.hurtT > 0 || this.lives <= 0,
        vy: p.vy, land: p.landT / 0.14, state: (this.rigState ||= {}),
      };
      if (rigReady()) drawRigHero(ctx, 0, 0, pose, animT, this.skin, ex);
      else art.drawHero(ctx, 0, 0, pose, animT, this.skin, R(1), ex);
      ctx.restore();
      // решётка лифта закрывается за героем
      if (L.exit === 'lift' && this.enter > 0.5) art.drawExitFront(ctx, 'lift', sx(this.finishX) + DOOR_AHEAD, Math.min(1, (this.enter - 0.5) / 0.35));
      // щит
      if (this.shield > 0 && this.status === 'running') {
        ctx.save();
        ctx.strokeStyle = 'rgba(200,190,140,0.45)'; ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 40;
        ctx.beginPath(); ctx.ellipse(PLAYER_X + 10, p.y - 115, 85, 140, 0, 0, 7); ctx.stroke();
        ctx.restore();
      }
    }

    // частицы
    for (const q of this.particles) {
      const a = Math.max(0, q.life / q.max);
      const x = sx(q.x);
      ctx.save();
      ctx.globalAlpha = Math.min(1, a * 1.5);
      if (q.kind === 'text') {
        ctx.font = 'bold 56px "Amatic SC", serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#7a2f35';
        ctx.strokeStyle = '#e8dcc4'; ctx.lineWidth = 5;
        ctx.strokeText(q.text, x, q.y); ctx.fillText(q.text, x, q.y);
      } else if (q.kind === 'splinter') {
        ctx.translate(x, q.y); ctx.rotate(q.rot);
        ctx.fillStyle = q.color; ctx.strokeStyle = art.INK; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.rect(-q.size / 2, -3, q.size, 6); ctx.fill(); ctx.stroke();
      } else if (q.kind === 'spark') {
        ctx.translate(x, q.y); ctx.rotate(q.rot);
        ctx.fillStyle = q.color;
        ctx.fillRect(-q.size / 2, -1.5, q.size, 3); ctx.fillRect(-1.5, -q.size / 2, 3, q.size);
      } else {
        ctx.fillStyle = q.color;
        ctx.beginPath(); ctx.arc(x, q.y, q.size * (q.kind === 'dust' ? 1.5 - a * 0.5 : a), 0, 7); ctx.fill();
      }
      ctx.restore();
    }

    // туман (проклятие)
    if (this.mods.fog) {
      const f = this.mods.fog;
      const g = ctx.createLinearGradient(W * (1 - f) - 80, 0, W * (1 - f) + 120, 0);
      g.addColorStop(0, 'rgba(20,16,16,0)'); g.addColorStop(1, 'rgba(20,16,16,0.93)');
      ctx.fillStyle = g; ctx.fillRect(W * (1 - f) - 80, 0, W, H);
    }

    // подсказки: при первой встрече с каждым видом (на лёгком — всегда)
    if (this.status === 'running' && !this.opts.demo) {
      for (const o of this.obstacles) {
        if (o.dead || o.hit) continue;
        if (!L.hintAll && !this.opts.showHint?.(o.type)) continue;
        const x = sx(o.x);
        if (x > PLAYER_X + 40 && x < W - 60) {
          const box = this.obstBox(o);
          const d = OBST[o.type];
          const top = d.pitLike || d.act === 'dash' ? GROUND_Y - 330 : o.type === 'chandelier' ? 200 : (box ? box.t : GROUND_Y - 120) - 60;
          art.drawHint(ctx, Math.min(W - 200, Math.max(200, x + o.w / 2)), Math.max(70, top), (window.__kickText || ((x) => x))(d.hint), t);
          break;
        }
      }
    }

    // полоса здоровья босса
    if (this.boss && !this.boss.dead && this.boss.enter > 0.5) this.drawBossBar(ctx);

    // название комнаты в начале
    if (L.name && !this.opts.demo && t < 2.4) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, t * 3, (2.4 - t) * 2);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 72px "Amatic SC", serif';
      ctx.fillStyle = '#16120f'; ctx.strokeStyle = '#e8dcc4'; ctx.lineWidth = 8;
      ctx.strokeText(L.name, W / 2, 90); ctx.fillText(L.name, W / 2, 90);
      ctx.font = 'bold 44px "Amatic SC", serif'; ctx.fillStyle = '#7a2f35';
      ctx.strokeText(L.place, W / 2, 150); ctx.fillText(L.place, W / 2, 150);
      if (L.fresh?.length) {
        const nt = 'Новый враг: ' + L.fresh.join(', ');
        ctx.font = 'bold 40px "Amatic SC", serif'; ctx.fillStyle = '#b3302c';
        ctx.strokeText(nt, W / 2, 200); ctx.fillText(nt, W / 2, 200);
      }
      ctx.restore();
    }

    // всплывающие сообщения (находки, щит, лечение)
    this.toasts.forEach((tt, i) => {
      ctx.save();
      ctx.globalAlpha = Math.min(1, tt.life * 3, (tt.max - tt.life) * 6);
      ctx.font = 'bold 46px "Amatic SC", serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const w = ctx.measureText(tt.text).width + 40, y = 230 + i * 70;
      ctx.fillStyle = 'rgba(22,18,15,0.85)'; ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(W / 2 - w / 2, y - 32, w, 64, 12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f0d27c'; ctx.fillText(tt.text, W / 2, y + 2);
      ctx.restore();
    });

    ctx.restore();

    // кошмар наяву: красная пульсирующая виньетка
    if (L.nightmare && !this.opts.demo) {
      const a = 0.22 + Math.sin(t * 2.2) * 0.06;
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.7);
      g.addColorStop(0, 'rgba(90,0,0,0)'); g.addColorStop(1, `rgba(90,0,0,${a})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }

    if (this.opts.paperFx) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(this.overlay, 0, 0);
      ctx.restore();
    }
  }

  // ---------- «Ты стал портретом» ----------
  // Где портрет висит на стене и где сейчас ступни героя (в координатах кадра).
  deathFrame() { return { x: PLAYER_X + 80, y: 245, rx: 74, ry: 98 }; }
  deathFoot() {
    const F = this.deathFrame();
    const k = smooth01((this.deathT - 0.5) / 1.0);
    return { x: PLAYER_X + (F.x - PLAYER_X) * k, y: GROUND_Y + (F.y + F.ry + 62 - GROUND_Y) * k, k };
  }

  drawDeath(ctx, t) {
    const T = this.deathT, F = this.deathFrame();
    const foot = this.deathFoot();
    const k2 = Math.min(1, Math.max(0, (T - 1.0) / 0.8));     // рама прорисовывается
    const k3 = Math.min(1, Math.max(0, (T - 1.7) / 0.6));     // краски выцветают
    const oval = () => { ctx.beginPath(); ctx.ellipse(F.x, F.y, F.rx, F.ry, 0, 0, Math.PI * 2); };
    // фон холста
    if (k2 > 0) {
      ctx.save(); oval(); ctx.globalAlpha = k2;
      const g = ctx.createRadialGradient(F.x, F.y - 20, 10, F.x, F.y, F.ry);
      g.addColorStop(0, '#6a5a48'); g.addColorStop(1, '#2a2119');
      ctx.fillStyle = g; ctx.fill(); ctx.restore();
    }
    // сам Флит: лежит → поднимается к стене → застывает в раме
    ctx.save();
    if (foot.k > 0.7) { oval(); ctx.clip(); }
    const sway = k3 >= 1 ? Math.sin(t * 1.2) * 0.012 : 0;
    ctx.translate(foot.x, foot.y);
    ctx.rotate(sway);
    const sc = HERO_SCALE * (1 - 0.22 * foot.k);
    ctx.scale(sc, sc);
    const pose = foot.k < 0.08 ? 'slide' : 'idle';
    if (rigReady()) drawRigHero(ctx, 0, 0, pose, foot.k > 0.95 ? 0 : t, this.skin, { hurt: true });
    else art.drawHero(ctx, 0, 0, pose, t, this.skin, art.makeRng(1), { hurt: true });
    ctx.restore();
    // выцветание в сепию
    if (k3 > 0) {
      ctx.save(); oval(); ctx.clip();
      ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = `rgba(128,128,128,${k3})`; ctx.fillRect(F.x - F.rx, F.y - F.ry, F.rx * 2, F.ry * 2);
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(214,184,140,${0.7 * k3})`; ctx.fillRect(F.x - F.rx, F.y - F.ry, F.rx * 2, F.ry * 2);
      ctx.globalCompositeOperation = 'source-over';
      const v = ctx.createRadialGradient(F.x, F.y, F.ry * 0.4, F.x, F.y, F.ry);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(20,14,10,${0.6 * k3})`);
      ctx.fillStyle = v; ctx.fillRect(F.x - F.rx, F.y - F.ry, F.rx * 2, F.ry * 2);
      ctx.restore();
    }
    // рама рисуется по кругу, как будто её выводит невидимое перо
    if (k2 > 0) {
      ctx.save();
      const a0 = -Math.PI / 2, a1 = a0 + Math.PI * 2 * k2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#16120f'; ctx.lineWidth = 24;
      ctx.beginPath(); ctx.ellipse(F.x, F.y, F.rx + 10, F.ry + 10, 0, a0, a1); ctx.stroke();
      ctx.strokeStyle = '#7a5a36'; ctx.lineWidth = 16;
      ctx.beginPath(); ctx.ellipse(F.x, F.y, F.rx + 10, F.ry + 10, 0, a0, a1); ctx.stroke();
      ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(F.x, F.y, F.rx + 4, F.ry + 4, 0, a0, a1); ctx.stroke();
      ctx.restore();
    }
    // латунная табличка с именем
    if (k3 > 0) {
      ctx.save(); ctx.globalAlpha = k3;
      ctx.fillStyle = '#c9a24a'; ctx.strokeStyle = '#16120f'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(F.x - 62, F.y + F.ry + 22, 124, 34, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#16120f'; ctx.font = 'bold 28px "Amatic SC", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Ф. ВЕЙН', F.x, F.y + F.ry + 40);
      ctx.restore();
    }
    // гвоздь и шнур
    if (k3 > 0) {
      ctx.save(); ctx.globalAlpha = k3; ctx.strokeStyle = '#2a2119'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(F.x - 40, F.y - F.ry - 4); ctx.lineTo(F.x, F.y - F.ry - 44); ctx.lineTo(F.x + 40, F.y - F.ry - 4); ctx.stroke();
      ctx.fillStyle = '#16120f'; ctx.beginPath(); ctx.arc(F.x, F.y - F.ry - 44, 4, 0, 7); ctx.fill();
      ctx.restore();
    }
  }

  // Портрет Флита из прошлой смерти. Картинка героя считается один раз и выцветает в сепию.
  oldPortraitImg() {
    if (this._oldPortrait !== undefined) return this._oldPortrait;
    if (!rigReady()) return (this._oldPortrait = null);
    const c = document.createElement('canvas'); c.width = 160; c.height = 210;
    const x = c.getContext('2d');
    x.fillStyle = '#4a3d30'; x.fillRect(0, 0, 160, 210);
    x.save(); x.translate(84, 300); x.scale(1.55, 1.55);
    drawRigHero(x, 0, 0, 'idle', 0, this.skin, {});
    x.restore();
    this._oldPortrait = recolor(c, { gray: 1, mul: [1.05, 0.9, 0.7] });
    return this._oldPortrait;
  }

  drawOldPortrait(ctx, x, y, pt) {
    const rx = 52, ry = 68, img = this.oldPortraitImg();
    ctx.save();
    ctx.translate(x, y); ctx.rotate(pt.tilt);
    ctx.strokeStyle = '#2a2119'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-28, -ry - 4); ctx.lineTo(0, -ry - 32); ctx.lineTo(28, -ry - 4); ctx.stroke();
    ctx.fillStyle = '#16120f'; ctx.beginPath(); ctx.arc(0, -ry - 32, 3, 0, 7); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
    if (img) ctx.drawImage(img, -rx - 4, -ry - 4, rx * 2 + 8, ry * 2 + 8);
    else { ctx.fillStyle = '#4a3d30'; ctx.fillRect(-rx, -ry, rx * 2, ry * 2); }
    const v = ctx.createRadialGradient(0, 0, ry * 0.4, 0, 0, ry);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(20,14,10,0.6)');
    ctx.fillStyle = v; ctx.fillRect(-rx, -ry, rx * 2, ry * 2);
    ctx.restore();
    ctx.lineWidth = 14; ctx.strokeStyle = '#16120f';
    ctx.beginPath(); ctx.ellipse(0, 0, rx + 6, ry + 6, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 9; ctx.strokeStyle = '#7a5a36'; ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = '#c9a24a';
    ctx.beginPath(); ctx.ellipse(0, 0, rx + 2, ry + 2, 0, 0, Math.PI * 2); ctx.stroke();
    // табличка: где это случилось
    ctx.fillStyle = '#c9a24a'; ctx.strokeStyle = '#16120f'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(-56, ry + 14, 112, 28, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#16120f'; ctx.font = 'bold 22px "Amatic SC", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`Ф. ВЕЙН · к. ${pt.room}`, 0, ry + 29);
    ctx.restore();
  }

  drawPips(ctx, x, y, hp, max) {
    ctx.save();
    for (let i = 0; i < max; i++) {
      ctx.fillStyle = i < hp ? '#b3302c' : '#4f4d4b'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x + (i - (max - 1) / 2) * 24, y, 8, 0, 7); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  drawBossBar(ctx) {
    const B = this.boss;
    const x0 = 160, x1 = W - 160, y = 88;
    ctx.save();
    ctx.fillStyle = 'rgba(22,18,15,0.85)'; ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(x0, y, x1 - x0, 26, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = B.flash > 0 ? '#e8dcc4' : '#b3302c';
    ctx.beginPath(); ctx.roundRect(x0 + 4, y + 4, (x1 - x0 - 8) * Math.max(0, B.hp / B.max), 18, 7); ctx.fill();
    ctx.font = 'bold 40px "Amatic SC", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#16120f'; ctx.strokeStyle = '#e8dcc4'; ctx.lineWidth = 6;
    ctx.strokeText(B.name, W / 2, y + 1); ctx.fillText(B.name, W / 2, y + 1);
    ctx.restore();
  }

  // Ближайшая угроза перед героем (0..1 по ширине кадра) — за ней следит глаз в HUD.
  threatX() {
    let best = null;
    for (const o of this.obstacles) {
      if (o.dead || o.hit) continue;
      const x = o.x - this.camX;
      if (x > PLAYER_X && x < W && (best === null || x < best)) best = x;
    }
    if (best === null && this.boss && !this.boss.dead) best = this.bossX();
    return best === null ? null : best / W;
  }

  drawLayer(ctx, img, factor, y) {
    const off = (this.camX * factor) % img.width;
    ctx.drawImage(img, -off, y);
    ctx.drawImage(img, -off + img.width, y);
  }

  drawImg(ctx, img, x, y, w, h) {
    const s = Math.min(w / img.width, h / img.height);
    const dw = img.width * s, dh = img.height * s;
    ctx.drawImage(img, x + (w - dw) / 2, y + h - dh, dw, dh);
  }
}
