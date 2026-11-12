// 3D-забег: вид сзади, три дорожки, бесконечный коридор поместья в перспективе.
// Тот же интерфейс, что у Game (game.js): update, draw, action, status, onEnd, coins, score…
// Свайп ←/→ — сменить дорожку, ↑ — прыжок, ↓ — подкат, тап — выстрел по своей дорожке.

import { W, H, GROUND_Y, FLOOR_TOP, PLAYER, SCORE, DIFFICULTY, ECONOMY } from './config.js?v=ec03615';
import * as art from './art.js?v=ec03615';
import { sfx } from './audio.js?v=ec03615';
import { computeMods } from './artifacts.js?v=ec03615';
import { applyCharacter, applyUpgrades } from './characters.js?v=ec03615';
import { enemyWeights } from './rooms.js?v=ec03615';
import { ENEMY } from './enemies.js?v=ec03615';
import { demonReady, drawDemon } from './demon.js?v=ec03615';

// ---- камера ----
const HORIZON = 140, CAM_H = 2.8, F = 480;
export const Z_HERO = 3.6;            // где бежит герой (от камеры)
export const LANE = 1.3;              // ширина дорожки
const WALL = 2.4;              // стены коридора
const CEIL = 3.4;
const FAR = 60;                // дальше — туман
const NATIVE = 120;            // пикселей 2D-рисунка на единицу мира
const HERO_H = 1.6, SLIDE_H = 0.6;
const DYN = 1.3;
// шаги обучения: что сделать и на чём
export const TUTORIAL = [
  { need: 'lane', type: 'wardrobe', text: 'Свайп ← или → — смени дорожку', gesture: 'lr' },
  { need: 'jump', type: 'pit', text: 'Свайп ↑ — прыжок через яму', gesture: 'up' },
  { need: 'slide', type: 'flyer', text: 'Свайп ↓ — подкат под ворону', gesture: 'down' },
  { need: 'smash', type: 'furniture', text: 'Кнопка «Пинок» — сломай шкаф', gesture: 'kickBtn' },
  { need: 'dash', type: 'ghost', text: 'Кнопка «Рывок» — сквозь призрака', gesture: 'dashBtn' },
  { need: 'shoot', type: 'monster', text: 'Тап по экрану — выстрел в тень', gesture: 'tap' },
];
export const FLOOR2 = 3.8;      // высота второго этажа (галереи) — на уровне карниза над обоями               // во сколько раз 3D-забег быстрее классики

// Как проходится каждый вид в 3D.
//  low — прыгнуть, high — пригнуться, block — уйти на другую дорожку, foe — выстрел или уйти.
export const KIND = {
  pit: 'low', trapdoor: 'low', rats: 'low', lowcrow: 'low', hands: 'low', chandelier: 'low', skullroll: 'low',
  spikes: 'low', ink: 'low', candelabrum: 'low',
  flyer: 'high', spider: 'high', portrait: 'high', flock: 'high', swoop: 'high', beam: 'high', tentacle: 'high',
  furniture: 'block', wardrobe: 'block', clock: 'block', armor: 'block', gate: 'block', ghost: 'block', fogwall: 'block', shielded: 'block',
  monster: 'foe', hopper: 'foe', brute: 'foe', puppet: 'foe', mirror: 'foe',
};
export const FLAT = new Set(['pit', 'trapdoor', 'ink']);       // рисуются прямо на полу
export const HINT = {
  low: '↑ прыжок', high: '↓ подкат', block: '← → другая дорожка', foe: '☝ тап — выстрел или другая дорожка',
};

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function pickWeighted(weights) {
  const e = Object.entries(weights).filter(([, w]) => w > 0);
  if (!e.length) return null;
  let r = Math.random() * e.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of e) if ((r -= w) <= 0) return k;
  return e[0][0];
}
function tint(hex, t) {
  if (!t) return hex;
  const n = parseInt(hex.slice(1), 16);
  let c = [n >> 16, (n >> 8) & 255, n & 255];
  const l = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  c = c.map((v, i) => clamp(Math.round((v + (l - v) * (t.gray || 0)) * (t.mul?.[i] ?? 1)), 0, 255));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export class Game3D {
  constructor(level, skin, opts) {
    this.is3d = true;
    this.level = level;
    this.skin = skin;
    this.opts = opts;
    this.mods = applyUpgrades(applyCharacter(computeMods(opts.equipped || []), opts.character), opts.upgrades);
    const tt = level.palette?.wallTint;
    this.col = {
      light: tint('#e4d8c0', tt), dark: tint('#cbbd9f', tt), floor: tint('#776a5b', tt), floor2: tint('#6a5d4f', tt),
      rug: tint('#6a2a28', tt), ceil: '#1a1412',
    };
    this.overlay = art.createPaperOverlay(3);
    this.reset();
  }

  buildPaper() { this.overlay = art.createPaperOverlay(3); }

  reset() {
    const M = this.mods, L = this.level, D = DIFFICULTY[L.diff] || DIFFICULTY.normal;
    this.t = 0;
    this.dist = this.opts.startAt || 0;      // пробежано, метров
    this.lastCp = this.dist;
    this.speedPx = L.speed * M.speedMul;
    this.maxLives = clamp(D.lives + M.lives, 1, 12);   // сердца с артефактов и прокачки — до 12
    this.lives = this.maxLives;
    this.shield = M.shield;
    this.revives = M.revive;
    this.coins = 0; this.bonus = 0; this.kills = 0;
    this.status = 'running';
    this.endTimer = 0; this.shake = 0; this.flashRed = 0;
    this.objs = []; this.coinsArr = []; this.bullets = []; this.relics = []; this.toasts = []; this.found = [];
    this.met = new Set(); this.killsBy = {};
    this.nextId = 1;
    this.finish = Number.isFinite(L.length) ? L.length : Infinity;
    this.nextSpawn = this.dist + 55;   // первые ~3,5–5 секунд коридор пуст: игрок успевает освоиться
    this.lastHealM = this.dist; this.lastFindM = this.dist;
    this.relicAt = (!this.opts.demo && L.kind === 'room' && !L.boss && Math.random() < L.findChance * M.luck)
      ? this.dist + 60 + Math.random() * Math.max(20, (this.finish - this.dist) * 0.6) : -1;
    this.boss = L.boss ? { name: L.boss.name, hp: L.boss.hp, max: L.boss.hp, enter: 0, attackT: 2.4, dead: 0, flash: 0 } : null;
    this.lane = 0; this.hx = 0;          // целевая дорожка и текущее положение (−1..1)
    this.y = 0; this.vy = 0;             // высота прыжка
    this.p = { slideT: 0, shootCd: 0, invuln: 0, hurtT: 0, flash: 0, run: 0 };
    this.enter = 0; this.deathT = undefined;
    this.wingsT = 0; this.doubleT = 0; this.cloakT = 0; this.charms = this.opts.charms || 0;
    this.base = 0; this.magnetT = 0; this.magnets = []; this.stairs = null; this.nextMagnet = this.dist + 380 + Math.random() * 220;
    // обучение при первом запуске: по одному препятствию на каждое действие, мир замедляется, пока игрок не сделает нужное
    this.tut = this.opts.tutorial ? { i: 0, obj: null, done: false, ok: false, wait: 1.2, slow: 1 } : null;
    if (this.tut) { this.nextSpawn = 1e9; this.nextMagnet = 1e9; }
    this.runT = 0; this.streak = 0; this.mult = 1; this.chase = 0; this.tier = 0; this.coinChain = 0; this.coinChainT = 0;
  }

  // ---------- то, что читает HUD и меню ----------
  get meters() { return Math.floor(this.dist); }
  get score() { return Math.round((this.meters * SCORE.perMeter + this.coins * SCORE.coin + this.bonus) * this.mods.scoreMult); }
  get progress() {
    if (this.boss && !this.boss.dead) return null;
    return Number.isFinite(this.finish) ? clamp(this.dist / this.finish, 0, 1) : null;
  }
  get speed() {
    const growth = this.level.ramp ? 0 : this.level.speedGrowth;   // в бесконечном рост скорости — только плавный, ниже
    const base = Math.min(1150, (this.level.speed + growth * this.meters / 10) * this.mods.speedMul) / 40 * 0.8;
    if (this.opts.demo) return base;
    // динамика как в раннерах: старт уже быстрый, и каждые 20 секунд ещё быстрее (до +35%)
    const t = this.runT || 0;
    // разгон с места: первые 1,5 с скорость плавно растёт от 55% до полной
    const grow = this.level.ramp ? 0.82 + 0.6 * Math.min(1, this.meters / 4000) : 1 + Math.min(0.35, t / 120);
    return base * DYN * grow * Math.min(1, 0.55 + 0.45 * t / 1.5);
  }
  threatX() {
    const o = this.objs.filter(o => !o.dead && o.z > Z_HERO).sort((a, b) => a.z - b.z)[0];
    return o ? 0.5 + o.lane * 0.3 : null;
  }

  // ---------- ввод ----------
  action(a) {
    if (this.status !== 'running') return;
    const p = this.p, M = this.mods;
    if (this.tut && !this.tut.done) this.tutAction(a);
    if (a === 'kick') this.lane = Math.max(-1, this.lane - 1);
    else if (a === 'right') this.lane = Math.min(1, this.lane + 1);
    else if (a === 'jump') {
      if (this.y > 0.001 && !(M.doubleJump && !p.dj)) { p.jumpBuf = 0.18; return; }
      if (this.y <= 0.001) { this.vy = (this.wingsT > 0 ? 11.5 : 7.3) * Math.sqrt(M.jumpMul); p.slideT = 0; p.dj = false; sfx.jump(); }
      else if (M.doubleJump && !p.dj) { p.dj = true; this.vy = 6.8 * Math.sqrt(M.jumpMul); sfx.jump(); }
    }
    else if (a === 'dash') {
      // рывок: короткий бросок вперёд сквозь призраков, решётки и туман
      if ((p.dashCd || 0) > 0) return;
      p.dashT = 0.5 * (M.dashLen || 1); p.dashCd = 0.9 * (M.dashCdMul || 1) * (M.dashMul || 1);   // артефакт «рывок» — чаще sfx.slide(); this.shake = Math.max(this.shake, 3);
    }
    else if (a === 'smash') {
      // пинок: мебель, доспехи и щит в своей дорожке, если они близко
      if ((p.kickT || 0) > 0.25) return;
      p.kickT = 0.4; sfx.kick();
      this.kickHit();
    }
    else if (a === 'slide') {
      if (this.y > 0.05) this.vy = Math.min(this.vy, -12);   // быстро вниз
      p.slideT = 0.6 * M.slideMul; sfx.slide();
    } else if (a === 'shoot') {
      if (p.shootCd > 0) return;
      if (M.weapon === 'fists') {            // кулак: всё в своей дорожке вплотную
        p.shootCd = 0.32; sfx.kick(); this.shake = Math.max(this.shake, 6);
        for (const o of this.objs) {
          if (o.dead || o.lane !== Math.round(this.hx) || o.z > Z_HERO + 3 || o.z < Z_HERO - 0.3) continue;
          if (o.kind === 'foe') { o.hp -= 2; o.flash = 0.14; if (o.hp <= 0) this.kill(o); }
          else if (o.kind === 'block' && !['gate', 'ghost', 'fogwall'].includes(o.type)) { o.dead = 0.01; this.bonus += 25; }
        }
        return;
      }
      p.shootCd = PLAYER.shootCooldown * M.reloadMul; p.flash = 0.12;
      const rifle = M.weapon === 'rifle';
      this.bullets.push({ lane: Math.round(this.hx), z: Z_HERO + 0.5, pierce: rifle ? 99 : M.pierce, hit: [], rifle, dmg: (rifle ? 3 : 1) * (M.dmgMul || 1) });
      sfx.shoot(); this.shake = Math.max(this.shake, 3);
    }
  }

  // Пинок ломает всё «пинаемое» в своей дорожке впереди. Удар длится 0,4 с: если шкаф подъехал
  // уже после нажатия, он всё равно сломается — пинок не зависит от точного момента.
  kickHit() {
    const reach = Z_HERO + 2.4 + this.speed * 0.12 + (this.mods.kickAdd || 0) / 60;   // артефакт «пинок» бьёт дальше
    for (const o of this.objs) {
      if (o.dead || o.hit || o.z > reach || o.z < Z_HERO - 0.6) continue;
      if (o.lane !== this.lane && o.lane !== Math.round(this.hx)) continue;
      const d = ENEMY[o.type];
      if (d?.act !== 'kick') continue;
      if (d.hp && !d.kickKills) { o.hp -= 2; o.flash = 0.14; if (o.hp <= 0) this.kill(o); else o.z += 1.5; }
      else { d.hp ? this.kill(o) : (o.dead = 0.01); this.bonus += 25; this.shake = Math.max(this.shake, 7); }
    }
  }

  // ---------- появление препятствий ----------
  // бесконечный забег: «виртуальная комната» растёт с метрами — враги открываются по порядку, как в поместье
  get vroom() { return 1 + Math.floor(this.meters / 25); }
  get rampK() { return this.level.ramp ? Math.min(1, this.meters / 3000) : 1; }   // 0 в начале, 1 к трём километрам
  weights() {
    const w = this.level.ramp ? enemyWeights(this.vroom) : { ...this.level.obstacles };
    if (this.level.ramp) {
      this.knownTypes ||= new Set(Object.keys(w));
      for (const k of Object.keys(w)) if (!this.knownTypes.has(k)) { this.knownTypes.add(k); if (this.runT > 2) this.toast('Новый враг: ' + (ENEMY[k]?.name || k), 2); }
    }
    for (const k in w) if (ENEMY[k]?.hp) w[k] *= this.mods.hordeMul;
    return w;
  }

  add(type, lane, z) {
    const d = ENEMY[type];
    const o = { id: this.nextId++, type, kind: KIND[type] || 'block', lane, z, dead: 0, hit: false, hp: d.hp || 0,
      w: d.w || 200, h: d.h || 0, flash: 0, rise: 1, fall: 1, open: 1, hop: 0, y: GROUND_Y - 150 };
    if (type === 'chandelier') o.fall = 0;   // появляется висящей под потолком
    if (!this.reserved(lane, this.dist + z - Z_HERO)) this.objs.push(o);
    return o;
  }
  // место занято лестницей или зоной приземления с галереи: там препятствий не бывает
  reserved(lane, d) {
    const S = this.stairs;
    if (!S) return false;
    if (lane === S.lane && d > S.a - 14 && d < S.b + 3) return true;
    return d > S.c - 5 && d < S.c + 45;   // зона приземления длиннее: бегущие навстречу враги не успевают в неё забежать
  }

  // ---------- обучение ----------
  get tutStep() { return this.tut && !this.tut.done ? TUTORIAL[this.tut.i] : null; }
  tutUpdate(dt) {
    const T = this.tut, st = TUTORIAL[T.i];
    if (!st) return;
    if (T.wait > 0) { T.wait -= dt; T.slow = 1; return; }
    if (!T.obj) {
      // препятствие — в дорожке Флита, далеко впереди
      T.obj = this.add(st.type, this.lane, Z_HERO + 20); T.ok = false;
      if (st.need === 'shoot') T.obj.hp = 1;
    }
    const o = T.obj, tt = (o.z - Z_HERO) / Math.max(1, this.speed);
    // подбежали близко, а нужного действия ещё нет — почти стоп-кадр, пока игрок не сделает
    // момент стоп-кадра — тот, когда действие сработает наверняка (прыжок — у самого края ямы)
    const at = { lane: 0.6, jump: 0.22, slide: 0.3, smash: 0.45, dash: 0.3, shoot: 0.9 }[st.need] ?? 0.5;
    T.slow = !T.ok && tt < at && !o.dead ? 0.04 : 1;
    if (o.dead || o.z < Z_HERO - 1.5) {
      if (T.ok || o.dead) { T.i++; T.obj = null; T.wait = 0.9; if (T.i >= TUTORIAL.length) this.tutFinish(); else this.toast('Отлично!', 0.9); }
      else this.tutRetry();
    }
  }
  tutAction(a) {
    const T = this.tut, st = TUTORIAL[T.i];
    if (!st || !T.obj) return;
    const ok = st.need === 'lane' ? (a === 'kick' || a === 'right') : a === st.need;
    if (ok) { T.ok = true; T.slow = 1; }
  }
  tutRetry() {
    const T = this.tut;
    if (T.obj) { T.obj.dead = 1; this.objs = this.objs.filter(o => o !== T.obj); }
    T.obj = null; T.wait = 0.8; T.ok = false; this.p.slideT = 0;
    this.toast('Ещё раз!', 0.9);
  }
  tutFinish() {
    this.tut.done = true; this.tut.slow = 1;
    this.toast('Готово! Теперь беги — дальше сам', 2.4);
    this.nextSpawn = this.dist + 40; this.nextMagnet = this.dist + 400;
    this.opts.onTutorialDone?.();
  }

  // ---------- бонусы ----------
  // вороньи крылья — высокие прыжки над всем; пара оболов — каждый обол за два; саван — сквозь всё
  takePower(kind) {
    const up = this.opts.upgrades || {}, k = (l) => 1 + 0.25 * (l || 0);
    if (kind === 'wings') { this.wingsT = 10 * k(up.wings); this.toast('Вороньи крылья! Прыгай выше всех', 1.8); }
    if (kind === 'double') { this.doubleT = 12 * k(up.double); this.toast('Пара оболов: каждый за два', 1.8); }
    if (kind === 'cloak') { this.cloakT = 6 * k(up.cloak); this.toast('Саван: ты призрак, тебя не задеть', 1.8); }
    sfx.win();
  }

  // ---------- магнит, лестница и галерея ----------
  takeMagnet() {
    this.magnetT = 14 * (this.mods.magnetMul || 1);
    this.toast('Магнит! Ищи лестницу наверх', 2.2); sfx.win();
    const lane = [-1, 0, 1][Math.floor(Math.random() * 3)];
    const a = this.dist + 38, b = a + 13, c = b + 72;
    this.stairs = { lane, a, b, c };
    // убрать то, что уже стоит на лестнице и в зоне приземления
    this.objs = this.objs.filter(o => !this.reserved(o.lane, this.dist + o.z - Z_HERO));
    // оболы на галерее: три змейки по всей длине
    for (let i = 0; i < 38; i++) {
      const l = [-1, 0, 1, 0][Math.floor(i / 5) % 4];
      this.coinsArr.push({ lane: l, z: Z_HERO + (b + 5 + i * 1.75 - this.dist), y: FLOOR2 + 0.6, id: this.nextId++, up: 1 });
    }
  }

  // связки препятствий: змейка, «прыжок — подкат», коридор с оболами
  pickKind(kind) {
    const w = this.weights(), e = {};
    for (const k in w) if ((KIND[k] || 'block') === kind) e[k] = w[k];
    return pickWeighted(e);
  }
  spawnPattern(z) {
    const block = this.pickKind('block'), low = this.pickKind('low'), high = this.pickKind('high');
    const r = Math.random(), step = Math.max(6, this.speed * 0.7);
    const trail = (lanes, z0, n, dz, y = 0.6) => { for (let i = 0; i < n; i++) this.coinsArr.push({ lane: lanes(i), z: z0 + i * dz, y, id: this.nextId++ }); };
    if (block && r < 0.4) {
      // змейка: в каждом ряду открыта одна дорожка, и она сдвигается
      let free = [-1, 0, 1][Math.floor(Math.random() * 3)];
      const frees = [];
      for (let i = 0; i < 3; i++) {
        for (const l of [-1, 0, 1]) if (l !== free) this.add(block, l, z + i * step);
        frees.push(free);
        const nb = [free - 1, free + 1].filter(l => l >= -1 && l <= 1);
        free = nb[Math.floor(Math.random() * nb.length)];
      }
      trail((i) => frees[Math.min(2, Math.floor(i / 4))], z - 2, 12, step * 3 / 12);
      return step * 2;
    }
    if (low && high && r < 0.7) {
      // в одной дорожке: прыжок, подкат, прыжок; соседние перекрыты не везде
      const l = [-1, 0, 1][Math.floor(Math.random() * 3)];
      this.add(low, l, z); this.add(high, l, z + step); this.add(low, l, z + step * 2);
      if (block) { const o = [-1, 0, 1].filter(x => x !== l); this.add(block, o[0], z + step * 0.5); this.add(block, o[1], z + step * 1.5); }
      trail(() => l, z - 1.5, 3, 1.5, 1.6);
      trail(() => l, z + step - 1.5, 3, 1.5, 0.35);
      return step * 2;
    }
    if (block) {
      // длинный ряд мебели вдоль дорожки, рядом — полоса оболов
      const l = [-1, 0, 1][Math.floor(Math.random() * 3)];
      for (let i = 0; i < 3; i++) this.add(block, l, z + i * 3.2);
      const c = l === 0 ? (Math.random() < 0.5 ? -1 : 1) : 0;
      trail(() => c, z - 2, 10, 1.3);
      return 7;
    }
    return 0;
  }

  spawnRow(atDist) {
    const z = Z_HERO + (atDist - this.dist);
    if (!this.boss && this.runT > 3 && Math.random() < (this.level.ramp ? 0.08 + 0.4 * this.rampK : 0.4)) { const len = this.spawnPattern(z); if (len) return len; }
    const type = pickWeighted(this.weights());
    if (!type) return;
    const kind = KIND[type] || 'block';
    const lanes = [-1, 0, 1].sort(() => Math.random() - 0.5);
    let used = [];
    if (kind === 'block' || kind === 'foe') used = lanes.slice(0, Math.random() < (this.level.ramp ? 0.15 + 0.4 * this.rampK : 0.45) + (this.level.combo || 0) * 0.4 * this.rampK ? 2 : 1);
    else used = Math.random() < 0.35 ? [-1, 0, 1] : lanes.slice(0, Math.random() < 0.5 ? 2 : 1);
    for (const l of used) this.add(type, l, z);
    // сдвоенная волна: в свободной дорожке — что-то ещё
    if (used.length < 3 && Math.random() < (this.level.combo || 0) * this.rampK) {
      const t2 = pickWeighted(this.weights());
      const free = lanes.filter(l => !used.includes(l));
      if (t2 && free.length > 1 && (KIND[t2] === 'low' || KIND[t2] === 'high')) this.add(t2, free[0], z + rand(1.5, 3));
    }
    // оболы
    if (Math.random() < 0.6) {
      const free = [-1, 0, 1].filter(l => !used.includes(l));
      if (kind === 'low' && Math.random() < 0.5) {
        const l = used[0];
        for (let i = 0; i < 5; i++) this.coinsArr.push({ lane: l, z: z - 2 + i, y: 0.6 + Math.sin(i / 4 * Math.PI) * 1.3, id: this.nextId++ });
      } else if (free.length) {
        const l = free[Math.floor(Math.random() * free.length)];
        for (let i = 0; i < 8; i++) this.coinsArr.push({ lane: l, z: z - 6 + i * 1.4, y: 0.6, id: this.nextId++ });
      }
    }
  }

  // ---------- обновление ----------
  update(dt) {
    dt = Math.min(dt, 1 / 30);
    if (this.tut && !this.tut.done) { this.tutUpdate(dt); dt *= this.tut.slow; }
    this.t += dt;
    const p = this.p, M = this.mods, L = this.level;
    let v = this.speed;
    if (this.status === 'won') { v = 0;   // коридор встаёт: Флит сам заходит в дверь, стена остаётся на месте
      this.enter = Math.min(1, this.enter + dt / 0.9); if (this.enter >= 1) { this.endTimer -= dt; if (this.endTimer <= 0) { this.status = 'over'; this.opts.onEnd?.(true); } } }
    else if (this.status === 'dying') {
      v = 0; this.deathT += dt;
      if (this.deathT > 3.3) { this.status = 'over'; this.opts.onEnd?.(false); }
    } else if (this.status === 'over') v = 0;
    if (this.opts.demo) v = 7;
    if (p.dashT > 0 && this.status === 'running') v *= 1.6;   // рывок
    const step = v * dt;
    this.dist += step;
    p.run += step;

    // спавн
    if (!this.opts.demo && this.status === 'running' && !this.boss && !(this.tut && !this.tut.done)) {
      while (this.nextSpawn < this.dist + FAR - 8 && this.nextSpawn < this.finish - 25) {
        const extra = this.spawnRow(this.nextSpawn) || 0;
        // ряды идут плотнее: около секунды между ними
        const gk = this.level.ramp ? 1.7 - 0.85 * this.rampK : 1;   // сначала просторно, потом теснее
        this.nextSpawn += extra + rand(L.gap[0], L.gap[1]) * this.speed * 0.6 * gk + 4;
      }
    }
    if (!this.opts.demo && this.status === 'running' && !this.boss && !this.stairs && !this.magnets.length &&
      this.dist + FAR - 10 > this.nextMagnet && this.finish - this.nextMagnet > 200) {
      const zz = Z_HERO + this.nextMagnet - this.dist;
      const free = [-1, 0, 1].filter(l => !this.objs.some(o => o.lane === l && Math.abs(o.z - zz) < 4));
      const r = Math.random(), kind = r < 0.35 ? 'magnet' : r < 0.6 ? 'wings' : r < 0.8 ? 'double' : 'cloak';
      if (free.length) this.magnets.push({ lane: free[Math.floor(Math.random() * free.length)], z: zz, id: this.nextId++, kind });
      this.nextMagnet += 600 + Math.random() * 400;   // бонус — редкая удача
    }
    if (this.relicAt > 0 && this.dist + FAR - 10 > this.relicAt) {
      this.relics.push({ lane: [-1, 0, 1][Math.floor(Math.random() * 3)], z: Z_HERO + this.relicAt - this.dist, bias: 1 });
      this.relicAt = -1;
    }
    if (L.kind === 'endless' && !this.opts.demo && this.meters - this.lastFindM >= 400) {
      this.lastFindM = this.meters;
      if (Math.random() < L.findChance * M.luck) this.relics.push({ lane: 0, z: FAR - 5 });
    }
    if (this.opts.demo && Math.sin(this.t * 0.6) > 0.995) this.lane = [-1, 0, 1][Math.floor(Math.random() * 3)];

    // темп: каждые 20 секунд быстрее
    if (this.status === 'running' && !this.opts.demo) {
      this.runT += dt;
      const tier = Math.min(5, Math.floor(this.runT / 20));
      if (tier > this.tier) { this.tier = tier; this.toast('Быстрее!', 1.2); sfx.whoosh?.(); }
    }
    this.chase = Math.max(0, this.chase - dt);
    this.coinChainT = Math.max(0, this.coinChainT - dt); if (!this.coinChainT) this.coinChain = 0;
    // таймеры
    for (const k of ['slideT', 'shootCd', 'invuln', 'hurtT', 'flash', 'dashT', 'dashCd', 'kickT', 'jumpBuf', 'landT']) p[k] = Math.max(0, (p[k] || 0) - dt);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flashRed = Math.max(0, this.flashRed - dt * 2);

    // Ида: сама перепрыгивает ямы
    if (M.autoJump && this.y <= 0.001 && this.status === 'running' &&
      this.objs.some(o => FLAT.has(o.type) && !o.dead && Math.abs(o.lane - this.hx) < 0.55 && o.z - Z_HERO < this.speed * 0.2 && o.z > Z_HERO)) this.action('jump');
    // герой: дорожка и прыжок
    this.hx += (this.lane - this.hx) * Math.min(1, dt * 26);   // смена дорожки — за ~0,1 с
    if (this.y > 0 || this.vy > 0) { this.vy -= 22 * dt; this.y = Math.max(0, this.y + this.vy * dt); if (this.y === 0) { this.vy = 0; this.shake = Math.max(this.shake, 4); p.landT = 0.2; if (p.jumpBuf > 0) { p.jumpBuf = 0; this.action('jump'); } } }

    // всё едет на героя
    const es = (L.enemy || 1) * M.enemyMul;
    for (const o of this.objs) {
      o.z -= step;
      const d = ENEMY[o.type];
      if (!o.dead && d.speed && KIND[o.type] !== 'block') o.z -= d.speed / 40 * 0.5 * es * dt;
      if (o.dead) o.dead = Math.min(1, o.dead + dt * 2.5);
      o.flash = Math.max(0, o.flash - dt);
      if (o.type === 'hopper' || o.type === 'puppet') o.hop = Math.abs(Math.sin(this.t * 5 + o.id)) * 80;
      // люстра: висит под потолком, а когда Флит близко — срывается и падает на пол (тогда через неё прыгают)
      if (o.type === 'chandelier' && !o.dead) {
        const was = o.fall;
        if (o.falling === undefined) { o.falling = false; o.fall = 0; }
        if (!o.falling && o.z - Z_HERO < this.speed * 1.4 + 3) { o.falling = true; sfx.crow?.(); }
        if (o.falling && o.fall < 1) o.fall = Math.min(1, o.fall + dt / 0.4);
        if (was < 1 && o.fall >= 1) { this.shake = Math.max(this.shake, 9); sfx.kick(); }
      }
      if (o.z < FAR - 15 && !o.dead) this.met.add(o.type);
    }
    for (const c of this.coinsArr) c.z -= step;
    for (const r of this.relics) r.z -= step;
    for (const m of this.magnets) m.z -= step;
    this.magnetT = Math.max(0, this.magnetT - dt);
    this.wingsT = Math.max(0, this.wingsT - dt); this.doubleT = Math.max(0, this.doubleT - dt); this.cloakT = Math.max(0, this.cloakT - dt);
    // лестница → галерея → прыжок вниз
    const S = this.stairs;
    if (S && this.status === 'running') {
      const d = this.dist, onLane = Math.abs(this.hx - S.lane) < 0.5;
      if (d >= S.a && d <= S.b && onLane && this.y < 0.7 + this.base) {
        if (this.base === 0) { this.toast('Наверх!', 1); sfx.jump(); }
        this.base = FLOOR2 * clamp((d - S.a) / (S.b - S.a), 0, 1);
      } else if (this.base > 0 && d <= S.b && !onLane) { this.y += this.base; this.base = 0; }       // сошёл с лестницы — вниз
      else if (this.base > 0 && d > S.c) { this.y += this.base; this.base = 0; this.vy = Math.max(this.vy, 2.5); this.toast('Вниз!', 0.9); }
      if (d > S.c + 26) this.stairs = null;
    } else if (this.base > 0 && !S) { this.y += this.base; this.base = 0; }

    // пули
    for (const b of this.bullets) {
      b.z += 45 * dt;
      for (const o of this.objs) {
        if (o.dead || b.dead || o.lane !== b.lane || b.hit.includes(o.id)) continue;
        if (o.kind !== 'foe' && o.kind !== 'block') continue;
        if (b.z >= o.z - 0.3 && b.z <= o.z + 1.5) {
          b.hit.push(o.id);
          if (b.rifle && o.kind === 'block' && !['gate', 'ghost', 'fogwall'].includes(o.type)) { o.dead = 0.01; this.bonus += 25; continue; }
          if (o.kind === 'foe') {
            o.hp -= b.dmg || 1; o.flash = 0.14;
            if (o.hp <= 0) this.kill(o); else sfx.hit();
            if (b.pierce > 0) { b.pierce--; continue; }
          }
          b.dead = true;
        }
      }
      if (this.boss && !this.boss.dead && this.boss.enter >= 1 && b.z > 15 && !b.dead) {
        b.dead = true; this.boss.hp--; this.boss.flash = 0.12; this.bonus += 10; sfx.hit();
        if (this.boss.hp <= 0) this.killBoss();
      }
      if (b.z > FAR) b.dead = true;
    }
    this.bullets = this.bullets.filter(b => !b.dead);

    if (this.boss) this.updateBoss(dt);

    // пинок продолжает ломать, пока длится
    if (this.status === 'running' && p.kickT > 0) this.kickHit();
    // столкновения
    if (this.status === 'running') {
      const myLane = Math.round(this.hx), inLane = (l) => Math.abs(this.hx - l) < 0.55;
      for (const o of this.objs) {
        if (o.dead || o.hit || this.base > 0.3) continue;
        // яма лежит на полу от o.z до o.z + длина; остальное — тонкое
        const len = FLAT.has(o.type) ? (o.type === 'ink' ? 1.2 : 1.8) : 0;
        if (o.z > Z_HERO + 0.35 || o.z + len < Z_HERO - 0.35) continue;
        if (!inLane(o.lane)) continue;
        const k = o.kind;
        const safe = this.cloakT > 0 || this.y > 2.2 || (k === 'low' && this.y > 0.55) || (k === 'high' && p.slideT > 0) || (p.dashT > 0 && ENEMY[o.type]?.act === 'dash');
        if (safe) continue;
        o.hit = true;
        if (p.invuln > 0) continue;
        this.hurt();
      }
      // серия: каждое пройденное препятствие растит множитель (до ×5), удар его сбрасывает
      for (const o of this.objs) {
        if (o.passed || o.hit || o.z > Z_HERO - 0.8) continue;
        o.passed = true;
        if (o.dead) continue;
        this.streak++;
        const m = Math.min(5, 1 + Math.floor(this.streak / 8));
        if (m > this.mult) { this.mult = m; this.toast(`Серия ×${m}`, 1.1); sfx.coin(); }
        this.bonus += 3 * this.mult;
      }
      // оболы и находки
      const hy = this.base + this.y;
      // магнит: оболы на том же этаже, что и Флит, летят к нему
      if (this.magnetT > 0) for (const c of this.coinsArr) {
        if (c.taken || c.z < Z_HERO - 1 || c.z > Z_HERO + 15 || Math.abs(c.y - (hy + 0.6)) > 1.5) continue;
        const k = Math.min(1, dt * 9);
        c.lx = (c.lx ?? c.lane) + (this.hx - (c.lx ?? c.lane)) * k;
        c.z += (Z_HERO - c.z) * k; c.y += (hy + 0.7 - c.y) * k;
      }
      for (const c of this.coinsArr) {
        if (c.taken || Math.abs(c.z - Z_HERO) > 0.6) continue;
        const cl = c.lx ?? c.lane;
        const near = Math.abs(this.hx - cl) < 0.55 || (M.magnet && Math.abs(this.hx - cl) < 1.6);
        const top = hy + (p.slideT > 0 ? SLIDE_H : HERO_H) + 0.2;
        if (near && c.y >= hy - 0.3 && c.y <= top) { c.taken = true; this.coins += this.doubleT > 0 ? 2 : 1; this.bonus += 2 * this.mult; this.coinChain++; this.coinChainT = 0.6; sfx.coinN ? sfx.coinN(this.coinChain) : sfx.coin(); }
      }
      for (const m of this.magnets) {
        if (m.taken || Math.abs(m.z - Z_HERO) > 0.8 || Math.abs(this.hx - m.lane) > 0.6 || this.base > 0.3) continue;
        m.taken = true; (m.kind || 'magnet') === 'magnet' ? this.takeMagnet() : this.takePower(m.kind);
      }
      this.magnets = this.magnets.filter(m => !m.taken && m.z > -5);
      for (const r of this.relics) {
        if (r.taken || Math.abs(r.z - Z_HERO) > 0.8 || Math.abs(this.hx - r.lane) > 0.6) continue;
        r.taken = true; sfx.win();
        const res = this.opts.onRelic?.(r.bias || 1);
        if (res) { this.found.push(res); this.toast(res.text, 2.6); }
      }
      // флажки (лёгкий режим)
      for (const cp of L.checkpoints || []) {
        if (cp > this.lastCp && this.meters >= cp) { this.lastCp = cp; this.toast('Флажок: место сохранено'); sfx.coin(); this.opts.onCheckpoint?.(cp); }
      }
      if (M.healEvery && this.meters - this.lastHealM >= M.healEvery) {
        this.lastHealM = this.meters;
        if (this.lives < this.maxLives) { this.lives++; this.toast('+1 сердце'); }
      }
      if (this.dist >= this.finish) { this.lane = 0; this.status = 'won'; this.endTimer = 0.3; sfx.win(); }
    }

    for (const tt of this.toasts) tt.life -= dt;
    this.toasts = this.toasts.filter(tt => tt.life > 0);
    this.objs = this.objs.filter(o => o.z > 0.7);
    this.coinsArr = this.coinsArr.filter(c => c.z > 0.7 && !c.taken);
    this.relics = this.relics.filter(r => r.z > 0.7 && !r.taken);
  }

  updateBoss(dt) {
    const B = this.boss;
    B.flash = Math.max(0, B.flash - dt);
    if (B.dead) { B.dead = Math.min(1, B.dead + dt * 0.7); return; }
    if (B.enter < 1) { B.enter = Math.min(1, B.enter + dt / 1.6); if (B.enter >= 1) this.toast(B.name.toUpperCase() + '!'); return; }
    if (this.status !== 'running') return;
    B.attackT -= dt;
    if (B.attackT <= 0) {
      const w = this.weights(); delete w.brute;
      const type = pickWeighted(w) || 'pit';
      this.add(type, [-1, 0, 1][Math.floor(Math.random() * 3)], 17);
      if (Math.random() < 0.35) this.add(type, [-1, 0, 1][Math.floor(Math.random() * 3)], 18.5);
      const rage = 1 - B.hp / B.max;
      B.attackT = rand(1.0, 1.4) * (1 - rage * 0.35);
    }
  }

  killBoss() {
    const B = this.boss;
    B.dead = 0.01; this.kills++; this.bonus += 500; this.shake = 20; sfx.monsterDie();
    this.toast('Хранитель повержен');
    for (const o of this.objs) o.dead = 0.01;
    this.finish = this.dist + 30;
    this.relics.push({ lane: 0, z: Z_HERO + 15, bias: 2.5 });
    this.opts.onBoss?.();
  }

  kill(o) {
    o.dead = 0.01; this.kills++;
    this.killsBy[o.type] = (this.killsBy[o.type] || 0) + 1;
    this.bonus += ENEMY[o.type].pts || 30;
    if (this.mods.killCoin) this.coins += this.mods.killCoin;
    sfx.monsterDie();
  }

  hurt() {
    if (this.god) return;   // бессмертие из админ-панели
    if (this.tut && !this.tut.done) { this.tutRetry(); return; }   // в обучении ошибка не наказывается — повторяем шаг
    const p = this.p;
    if (this.shield > 0) { this.shield--; p.invuln = 1.0; this.toast('Щит принял удар'); sfx.kick(); return; }
    // каждый удар — ровно одно сердце; Тень только подбирается ближе (см. three3d.js)
    // и ловит Флита, лишь когда сердец не осталось
    this.lives = Math.max(0, this.lives - 1);
    this.streak = 0; this.mult = 1;
    if (this.lives <= 0) this.deathKind = 'caught';
    else { this.chase = 3; this.toast(this.lives === 1 ? 'Тень за плечом — последнее сердце!' : 'Тень ближе', 1.6); }
    p.invuln = PLAYER.invulnTime + this.mods.invulnAdd;
    p.hurtT = 0.4; this.shake = 14; this.flashRed = 1;
    sfx.hit();
    if (this.opts.vibration && navigator.vibrate) navigator.vibrate(120);
    if (this.lives <= 0 && this.revives > 0) { this.revives--; this.lives = 1; this.deathKind = undefined; p.invuln = 2.5; this.toast('Свеча догорела — ты встал'); return; }
    if (this.lives <= 0 && this.charms > 0) {
      // оберег из лавки: сгорает и спасает, вокруг расчищается место
      this.charms--; this.opts.onCharm?.(); this.lives = 1; this.chase = 0; this.deathKind = undefined; p.invuln = 3; this.cloakT = Math.max(this.cloakT, 2);
      this.objs = this.objs.filter(o => o.z > Z_HERO + 14 || o.z < Z_HERO - 1);
      this.toast('Оберег сгорел — ты жив', 2.2); sfx.win(); return;
    }
    if (this.lives <= 0) { this.status = 'dying'; this.deathT = 0; sfx.lose(); }
  }

  toast(text, life = 1.8) { this.toasts.push({ text, life, max: life }); }

  // ---------- отрисовка ----------
  proj(x, y, z) {
    const s = F / z;
    return { x: W / 2 + (x - this.hx * LANE * 0.45) * s, y: HORIZON + (CAM_H - y) * s, s };
  }

  quad(ctx, pts, fill) {
    ctx.beginPath();
    pts.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y));
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }

  drawCorridor(ctx) {
    const C = this.col, P = (x, y, z) => this.proj(x, y, z);
    ctx.fillStyle = '#0b0807'; ctx.fillRect(0, 0, W, H);
    const zn = 0.6, zf = FAR;
    // пол и ковровая дорожка
    this.quad(ctx, [P(-WALL, 0, zn), P(WALL, 0, zn), P(WALL, 0, zf), P(-WALL, 0, zf)], C.floor);
    this.quad(ctx, [P(-LANE * 1.55, 0, zn), P(LANE * 1.55, 0, zn), P(LANE * 1.55, 0, zf), P(-LANE * 1.55, 0, zf)], C.rug);
    // доски поперёк, бегут навстречу
    ctx.strokeStyle = 'rgba(20,14,10,0.45)'; ctx.lineWidth = 2;
    const off = this.dist % 2;
    for (let z = 2 - off; z < zf; z += 2) {
      if (z < zn) continue;
      const a = P(-WALL, 0, z), b = P(WALL, 0, z);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    // границы дорожек
    ctx.strokeStyle = 'rgba(232,220,196,0.18)'; ctx.lineWidth = 2;
    for (const x of [-LANE / 2, LANE / 2]) { const a = P(x, 0, zn + 0.2), b = P(x, 0, zf); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    // потолок
    this.quad(ctx, [P(-WALL, CEIL, zn), P(WALL, CEIL, zn), P(WALL, CEIL, zf), P(-WALL, CEIL, zf)], C.ceil);
    // стены: полосатые обои
    for (const side of [-1, 1]) {
      const x = WALL * side;
      this.quad(ctx, [P(x, 0, zn), P(x, CEIL, zn), P(x, CEIL, zf), P(x, 0, zf)], C.light);
      const so = this.dist % 0.8;
      for (let z = 0.8 - so; z < zf; z += 0.8) {
        if (z < zn) continue;
        this.quad(ctx, [P(x, 0, z), P(x, CEIL, z), P(x, CEIL, z + 0.4), P(x, 0, z + 0.4)], C.dark);
      }
      // плинтус
      this.quad(ctx, [P(x, 0, zn), P(x, 0.18, zn), P(x, 0.18, zf), P(x, 0, zf)], '#3a2f25');
    }
    // картины и бра на стенах, рёбра-арки — каждые 8 м
    const ao = this.dist % 8;
    for (let z = zf - ((zf - ao) % 8); z > zn; z -= 8) {
      const zz = z;
      if (zz < 1) continue;
      for (const side of [-1, 1]) {
        const x = WALL * side * 0.999;
        const a = P(x, 1.3, zz + 1.6), b = P(x, 2.3, zz + 1.6), c = P(x, 2.3, zz + 3.2), d = P(x, 1.3, zz + 3.2);
        this.quad(ctx, [a, b, c, d], '#5a4434');
        const inset = (q, r, k) => ({ x: q.x + (r.x - q.x) * k, y: q.y + (r.y - q.y) * k });
        this.quad(ctx, [inset(a, c, 0.12), inset(b, d, 0.12), inset(c, a, 0.12), inset(d, b, 0.12)], '#8f8a82');
        // бра с огоньком
        const s = P(x, 1.9, zz + 5), r = 70 * s.s / F;
        const g = ctx.createRadialGradient(s.x, s.y, 1, s.x, s.y, r * 4);
        g.addColorStop(0, 'rgba(242,193,78,0.55)'); g.addColorStop(1, 'rgba(242,193,78,0)');
        ctx.fillStyle = g; ctx.fillRect(s.x - r * 4, s.y - r * 4, r * 8, r * 8);
        ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(s.x, s.y, Math.max(1.5, r * 0.6), 0, 7); ctx.fill();
      }
      // чёрная арка-ребро
      const lw = Math.max(1, 0.22 * F / zz);
      ctx.strokeStyle = '#16120f'; ctx.lineWidth = lw;
      const l0 = P(-WALL, 0, zz), l1 = P(-WALL, CEIL, zz), r1 = P(WALL, CEIL, zz), r0 = P(WALL, 0, zz);
      ctx.beginPath(); ctx.moveTo(l0.x, l0.y); ctx.lineTo(l1.x, l1.y); ctx.lineTo(r1.x, r1.y); ctx.lineTo(r0.x, r0.y); ctx.stroke();
    }
    // туман вдали
    const h0 = P(0, 0, zf).y;
    const fog = ctx.createLinearGradient(0, HORIZON - 40, 0, h0 + 120);
    fog.addColorStop(0, 'rgba(8,6,5,1)'); fog.addColorStop(0.5, 'rgba(8,6,5,0.85)'); fog.addColorStop(1, 'rgba(8,6,5,0)');
    ctx.fillStyle = fog; ctx.fillRect(W * 0.2, 0, W * 0.6, h0 + 120);
    const c = P(0, 0, zf);
    const dg = ctx.createRadialGradient(c.x, HORIZON + 20, 10, c.x, HORIZON + 20, 260);
    dg.addColorStop(0, 'rgba(8,6,5,1)'); dg.addColorStop(1, 'rgba(8,6,5,0)');
    ctx.fillStyle = dg; ctx.fillRect(0, 0, W, H);
  }

  // Препятствие: 2D-рисунок из enemies.js, поставленный в перспективу.
  drawObj(ctx, o, t) {
    const d = ENEMY[o.type];
    const lx = o.lane * LANE;
    const fogA = clamp((FAR - 4 - o.z) / 18, 0, 1);
    if (fogA <= 0) return;
    ctx.save();
    ctx.globalAlpha = fogA * (o.dead ? 1 - o.dead : 1);
    if (FLAT.has(o.type)) {
      const len = o.type === 'ink' ? 1.2 : 1.8, hw = LANE * 0.48;
      const a = this.proj(lx - hw, 0.01, o.z), b = this.proj(lx + hw, 0.01, o.z), c = this.proj(lx + hw, 0.01, o.z + len), e = this.proj(lx - hw, 0.01, o.z + len);
      this.quad(ctx, [a, b, c, e], o.type === 'ink' ? '#0d0a10' : '#050303');
      if (o.type !== 'ink') {
        ctx.fillStyle = '#6d655e';
        for (let i = 0; i < 4; i++) { const sp = this.proj(lx - hw * 0.7 + i * hw * 0.47, 0.01, o.z + len * 0.55), s = sp.s / F; ctx.beginPath(); ctx.moveTo(sp.x - 9 * s * 10, sp.y); ctx.lineTo(sp.x, sp.y - 30 * s * 10); ctx.lineTo(sp.x + 9 * s * 10, sp.y); ctx.fill(); }
      }
      ctx.restore();
      return;
    }
    const base = this.proj(lx, 0, o.z);
    const k = base.s / NATIVE * Math.min(1, 1.25 * NATIVE / o.w);
    // тень
    ctx.fillStyle = 'rgba(10,6,4,0.35)';
    ctx.beginPath(); ctx.ellipse(base.x, base.y, o.w * k * 0.45, o.w * k * 0.09, 0, 0, 7); ctx.fill();
    ctx.translate(base.x - o.w / 2 * k, base.y - GROUND_Y * k);
    ctx.scale(k, k);
    if (o.type === 'furniture' && this.opts.images?.furniture) ctx.drawImage(this.opts.images.furniture, 0, GROUND_Y - o.h, o.w, o.h);
    else {
      const R = () => art.makeRng(o.id * 7 + Math.floor(t * 8));
      d.draw?.(ctx, o, 0, this, t, R);
    }
    ctx.restore();
  }

  // Флит со спины.
  drawHero(ctx, t) {
    const p = this.p, base = this.proj(this.hx * LANE, 0, Z_HERO), s = base.s;
    const air = this.y, slide = p.slideT > 0;
    const U = s;                       // пикселей на метр у героя
    const gx = base.x, gy = base.y - air * U;
    // тень на полу
    ctx.fillStyle = `rgba(10,6,4,${0.35 * (1 - Math.min(0.7, air / 2))})`;
    ctx.beginPath(); ctx.ellipse(base.x, base.y, 0.38 * U * (1 - air * 0.15), 0.08 * U, 0, 0, 7); ctx.fill();
    if (p.invuln > 0 && Math.floor(t * 16) % 2 === 0 && this.status === 'running') return;
    const ph = p.run * 2.6, sw = Math.sin(ph);
    const squash = slide ? 0.45 : 1;
    const h = HERO_H * U * squash * (this.skin.sy || 1);
    const lean = (this.lane - this.hx) * 0.25;
    ctx.save();
    ctx.translate(gx, gy); ctx.rotate(lean); ctx.scale(this.skin.sx || 1, 1);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const shirt = this.skin.shirt || '#b3302c';
    const legH = h * 0.46, torsoH = h * 0.34, headR = h * 0.1;
    const hipY = -legH, shY = hipY - torsoH;
    // ноги: по очереди подлетают (вид сзади)
    for (const side of [-1, 1]) {
      const lift = air > 0.05 ? 0.35 : Math.max(0, sw * side) * 0.45;
      const lx = side * h * 0.07;
      ctx.strokeStyle = '#000'; ctx.lineWidth = h * 0.1;
      ctx.beginPath(); ctx.moveTo(lx, hipY); ctx.lineTo(lx + side * h * 0.02, -legH * lift * 0.6 - h * 0.02); ctx.stroke();
      ctx.strokeStyle = '#16120f'; ctx.lineWidth = h * 0.085;
      ctx.beginPath(); ctx.moveTo(lx, hipY); ctx.lineTo(lx + side * h * 0.02, -legH * lift * 0.6 - h * 0.02); ctx.stroke();
      ctx.fillStyle = '#0d0a08';
      ctx.beginPath(); ctx.ellipse(lx + side * h * 0.02, -legH * lift * 0.6, h * 0.06, h * 0.035, 0, 0, 7); ctx.fill();
    }
    // руки: машут, правая с пистолетом
    for (const side of [-1, 1]) {
      const swing = slide ? -0.9 : -sw * side * 0.6;
      const ax = side * h * 0.17, ay = shY + h * 0.04;
      const ex = ax + side * h * 0.08, ey = ay + h * 0.28 * Math.cos(swing), eyz = ay + h * 0.28;
      ctx.strokeStyle = '#000'; ctx.lineWidth = h * 0.075;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex, swing < 0 ? ey : eyz - h * 0.1 * Math.sin(swing)); ctx.stroke();
      ctx.strokeStyle = shirt; ctx.lineWidth = h * 0.06;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + side * h * 0.04, ay + h * 0.12); ctx.stroke();
      if (side === 1 && !this.skin.noGun) {
        ctx.fillStyle = '#4a4440'; ctx.fillRect(ex - h * 0.02, (swing < 0 ? ey : eyz) - h * 0.06, h * 0.04, h * 0.13);
        if (p.flash > 0) { ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(ex, (swing < 0 ? ey : eyz) - h * 0.1, h * 0.06, 0, 7); ctx.fill(); }
      }
    }
    // штаны (таз) и пояс
    ctx.fillStyle = '#16120f';
    ctx.beginPath(); ctx.moveTo(-h * 0.13, hipY - h * 0.02); ctx.lineTo(h * 0.13, hipY - h * 0.02); ctx.lineTo(h * 0.11, hipY + h * 0.08); ctx.lineTo(-h * 0.11, hipY + h * 0.08); ctx.closePath(); ctx.fill();
    // рубашка: спина со складками
    ctx.fillStyle = shirt; ctx.strokeStyle = '#000'; ctx.lineWidth = Math.max(2, h * 0.02);
    ctx.beginPath(); ctx.moveTo(-h * 0.18, shY); ctx.lineTo(h * 0.18, shY); ctx.lineTo(h * 0.14, hipY); ctx.lineTo(-h * 0.14, hipY); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(40,8,6,0.55)'; ctx.lineWidth = Math.max(1.5, h * 0.012);
    for (const k of [-0.07, 0, 0.07]) { ctx.beginPath(); ctx.moveTo(h * k, shY + h * 0.05); ctx.quadraticCurveTo(h * (k + 0.02), shY + torsoH * 0.5, h * k * 0.8, hipY - h * 0.02); ctx.stroke(); }
    ctx.fillStyle = '#0f0c0b'; ctx.fillRect(-h * 0.14, hipY - h * 0.035, h * 0.28, h * 0.04);
    // шея и затылок с зачёсанными волосами
    ctx.fillStyle = '#efe6d4';
    ctx.fillRect(-h * 0.035, shY - h * 0.06, h * 0.07, h * 0.07);
    ctx.fillStyle = '#0d0a08';
    ctx.beginPath(); ctx.ellipse(0, shY - h * 0.06 - headR, headR * 0.92, headR * 1.08, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#efe6d4';
    ctx.beginPath(); ctx.ellipse(-headR * 0.95, shY - h * 0.06 - headR * 0.9, headR * 0.18, headR * 0.3, 0, 0, 7); ctx.ellipse(headR * 0.95, shY - h * 0.06 - headR * 0.9, headR * 0.18, headR * 0.3, 0, 0, 7); ctx.fill();
    // шляпы скинов (со спины)
    const hat = this.skin.hat, hy = shY - h * 0.06 - headR * 1.9;
    if (hat && hat !== 'none') {
      ctx.fillStyle = '#16120f';
      ctx.fillRect(-headR * 1.6, hy + headR * 0.5, headR * 3.2, headR * 0.3);
      if (hat === 'tophat') ctx.fillRect(-headR * 0.85, hy - headR * 1.5, headR * 1.7, headR * 2.0);
      else { ctx.beginPath(); ctx.moveTo(-headR, hy + headR * 0.5); ctx.lineTo(0, hy - headR * 0.8); ctx.lineTo(headR, hy + headR * 0.5); ctx.closePath(); ctx.fill(); }
    }
    ctx.restore();
  }

  draw(ctx) {
    const t = this.t, L = this.level;
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    this.drawCorridor(ctx);

    // дверь выхода в конце коридора
    if (Number.isFinite(this.finish)) {
      const zd = Z_HERO + (this.finish - this.dist) + 2;
      if (zd < FAR && zd > 1.2) {
        const b = this.proj(0, 0, zd), k = b.s / NATIVE;
        ctx.save();
        ctx.globalAlpha = clamp((FAR - 2 - zd) / 14, 0, 1);
        ctx.translate(b.x - 500 * k, b.y - FLOOR_TOP * k); ctx.scale(k, k);
        art.drawExit(ctx, L.exit || 'door', 500, clamp(1 - (zd - Z_HERO) / 12, 0, 1), L.doorLabel ?? 'ВЫХОД', t, this.opts.images?.furniture);
        ctx.restore();
      }
    }
    // хранитель в глубине
    if (this.boss && this.boss.dead < 1) {
      const B = this.boss, zb = 19 + (1 - B.enter) * 25, b = this.proj(Math.sin(t * 0.8) * 0.8, 0, zb), k = b.s / NATIVE;
      if (demonReady()) drawDemon(ctx, b.x, b.y, 430 * k, t * 0.6, B.dead, 3, 'boss', B.flash);
      if (B.enter > 0.5 && !B.dead) {
        ctx.fillStyle = 'rgba(22,18,15,0.85)'; ctx.fillRect(200, 30, W - 400, 22);
        ctx.fillStyle = B.flash > 0 ? '#e8dcc4' : '#b3302c'; ctx.fillRect(204, 34, (W - 408) * B.hp / B.max, 14);
        ctx.font = 'bold 36px "Amatic SC", serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#e8dcc4'; ctx.fillText(B.name, W / 2, 84);
      }
    }

    // всё, что в коридоре, — от дальнего к ближнему; герой — на своей глубине
    const items = [];
    for (const o of this.objs) items.push({ z: o.z, f: () => this.drawObj(ctx, o, t) });
    for (const c of this.coinsArr) items.push({ z: c.z, f: () => {
      const q = this.proj(c.lane * LANE, c.y, c.z), k = q.s / NATIVE;
      ctx.save(); ctx.globalAlpha = clamp((FAR - 4 - c.z) / 18, 0, 1); ctx.translate(q.x, q.y); ctx.scale(k * 1.6, k * 1.6);
      art.drawCoin(ctx, 0, 0, t + c.id, art.makeRng(c.id)); ctx.restore(); } });
    for (const r of this.relics) items.push({ z: r.z, f: () => {
      const q = this.proj(r.lane * LANE, 0.9, r.z), k = q.s / NATIVE;
      ctx.save(); ctx.translate(q.x, q.y); ctx.scale(k * 1.4, k * 1.4); art.drawRelic(ctx, 0, 0, t); ctx.restore(); } });
    for (const b of this.bullets) items.push({ z: b.z, f: () => {
      const q = this.proj(b.lane * LANE, 1.2, b.z);
      ctx.fillStyle = '#2a2522'; ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(2, q.s * 0.06), 0, 7); ctx.fill(); } });
    items.push({ z: Z_HERO + 0.01, f: () => this.drawHeroOrDeath(ctx, t) });
    items.sort((a, b) => b.z - a.z).forEach(i => i.f());

    // подсказки при первой встрече
    if (this.status === 'running' && !this.opts.demo) {
      const o = this.objs.filter(o => !o.dead && !o.hit && o.z > Z_HERO + 2 && o.z < 24 && (L.hintAll || this.opts.showHint?.(o.type))).sort((a, b) => a.z - b.z)[0];
      if (o) { const q = this.proj(o.lane * LANE, 2.4, o.z); art.drawHint(ctx, q.x, Math.max(80, q.y), HINT[o.kind], t); }
    }
    // название комнаты
    if (L.name && !this.opts.demo && t < 2.4) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, t * 3, (2.4 - t) * 2);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 72px "Amatic SC", serif'; ctx.fillStyle = '#e8dcc4'; ctx.fillText(L.name, W / 2, 110);
      ctx.font = 'bold 44px "Amatic SC", serif'; ctx.fillStyle = '#d9a0a0'; ctx.fillText(L.place, W / 2, 170);
      if (L.fresh?.length) { ctx.font = 'bold 40px "Amatic SC", serif'; ctx.fillStyle = '#f2d27a'; ctx.fillText('Новый враг: ' + L.fresh.join(', '), W / 2, 220); }
      ctx.restore();
    }
    this.toasts.forEach((tt, i) => {
      ctx.save();
      ctx.globalAlpha = Math.min(1, tt.life * 3, (tt.max - tt.life) * 6);
      ctx.font = 'bold 46px "Amatic SC", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const w = ctx.measureText(tt.text).width + 40, y = 260 + i * 70;
      ctx.fillStyle = 'rgba(22,18,15,0.85)'; ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(W / 2 - w / 2, y - 32, w, 64, 12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f0d27c'; ctx.fillText(tt.text, W / 2, y + 2);
      ctx.restore();
    });
    ctx.restore();

    if (this.flashRed > 0) { ctx.fillStyle = `rgba(150,20,20,${this.flashRed * 0.25})`; ctx.fillRect(0, 0, W, H); }
    if (this.mods.fog) { ctx.fillStyle = `rgba(20,16,16,${this.mods.fog * 0.6})`; ctx.fillRect(0, 0, W, HORIZON + 120); }
    if (L.nightmare && !this.opts.demo) {
      const a = 0.22 + Math.sin(t * 2.2) * 0.06;
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.7);
      g.addColorStop(0, 'rgba(90,0,0,0)'); g.addColorStop(1, `rgba(90,0,0,${a})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (this.opts.paperFx) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(this.overlay, 0, 0); ctx.restore(); }
  }

  drawHeroOrDeath(ctx, t) {
    if (this.status === 'won') { ctx.save(); ctx.globalAlpha = 1 - this.enter; this.drawHero(ctx, t); ctx.restore(); return; }
    if (this.deathT === undefined) { this.drawHero(ctx, t); return; }
    // «стал портретом»: вокруг застывшего героя прорисовывается рама, всё выцветает
    const T = this.deathT, b = this.proj(this.hx * LANE, 0, Z_HERO), U = b.s;
    const cx = b.x, cy = b.y - HERO_H * U * 0.55, rx = U * 0.55, ry = U * 0.95;
    const k2 = clamp((T - 0.4) / 0.8, 0, 1), k3 = clamp((T - 1.1) / 0.6, 0, 1);
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7);
    ctx.fillStyle = `rgba(42,33,25,${k2})`; ctx.fill();
    ctx.clip();
    this.p.slideT = 0; this.drawHero(ctx, 0);
    if (k3 > 0) { ctx.fillStyle = `rgba(214,184,140,${0.6 * k3})`; ctx.globalCompositeOperation = 'multiply'; ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2); }
    ctx.restore();
    if (k2 > 0) {
      ctx.save(); ctx.lineCap = 'round';
      const a0 = -Math.PI / 2, a1 = a0 + Math.PI * 2 * k2;
      ctx.strokeStyle = '#16120f'; ctx.lineWidth = U * 0.09; ctx.beginPath(); ctx.ellipse(cx, cy, rx + U * 0.05, ry + U * 0.05, 0, a0, a1); ctx.stroke();
      ctx.strokeStyle = '#7a5a36'; ctx.lineWidth = U * 0.06; ctx.beginPath(); ctx.ellipse(cx, cy, rx + U * 0.05, ry + U * 0.05, 0, a0, a1); ctx.stroke();
      ctx.restore();
    }
    if (k3 > 0) {
      ctx.save(); ctx.globalAlpha = k3;
      ctx.fillStyle = '#c9a24a'; ctx.strokeStyle = '#16120f'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(cx - U * 0.4, cy + ry + U * 0.12, U * 0.8, U * 0.2, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#16120f'; ctx.font = `bold ${Math.round(U * 0.15)}px "Amatic SC", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Ф. ВЕЙН', cx, cy + ry + U * 0.22);
      ctx.restore();
    }
  }

  drawPips() {}       // для рисунков врагов из enemies.js
  puff() {}
}
