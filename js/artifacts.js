// 250 артефактов: 25 семейств × 2 предмета × 5 ступеней силы.
// Полезные делают забег легче. Проклятые мешают, но дают больше оболов или очков.
// Слотовые («сундучки») расширяют число артефактов, которые можно взять в забег:
// они действуют всегда, просто лёжа в инвентаре.

// Прилагательные ступеней: [м. р., ж. р., ср. р., мн. ч.]
const GOOD_TIERS = [
  ['Ржавый', 'Ржавая', 'Ржавое', 'Ржавые'],
  ['Медный', 'Медная', 'Медное', 'Медные'],
  ['Серебряный', 'Серебряная', 'Серебряное', 'Серебряные'],
  ['Золотой', 'Золотая', 'Золотое', 'Золотые'],
  ['Чернильный', 'Чернильная', 'Чернильное', 'Чернильные'],
];
const CURSED_TIERS = [
  ['Треснувший', 'Треснувшая', 'Треснувшее', 'Треснувшие'],
  ['Гнилой', 'Гнилая', 'Гнилое', 'Гнилые'],
  ['Шепчущий', 'Шепчущая', 'Шепчущее', 'Шепчущие'],
  ['Плачущий', 'Плачущая', 'Плачущее', 'Плачущие'],
  ['Проклятый', 'Проклятая', 'Проклятое', 'Проклятые'],
];
const G = { m: 0, f: 1, n: 2, pl: 3 };

export const RARITY = [
  { id: 'common', name: 'обычный', color: '#9c9a97', price: 60 },
  { id: 'common', name: 'обычный', color: '#9c9a97', price: 110 },
  { id: 'rare', name: 'редкий', color: '#6f8fa8', price: 220 },
  { id: 'epic', name: 'ценный', color: '#c9a24a', price: 420 },
  { id: 'legend', name: 'легендарный', color: '#6b4a8c', price: 750 },
];

// key — эффект; v — значения по ступеням; d — описание (v подставляется вместо #);
// items — [название, род, значок]; cursed — проклятый; passive — работает из инвентаря.
const FAMILIES = [
  { key: 'life', v: [1, 1, 1, 2, 2], d: '+# к сердцам в забеге', items: [['сердце', 'n', 'heart'], ['медальон', 'm', 'heart']] },
  { key: 'shield', v: [1, 1, 2, 2, 3], d: 'щит гасит удары: # за забег', items: [['брошь', 'f', 'shield'], ['запонки', 'pl', 'shield']] },
  { key: 'coin', v: [10, 20, 30, 45, 60], d: '+#% оболов за забег', items: [['копилка', 'f', 'coin'], ['кошель', 'm', 'coin']] },
  { key: 'magnet', v: [60, 90, 120, 160, 220], d: 'оболы притягиваются издалека (# шагов)', items: [['компас', 'm', 'magnet'], ['подкова', 'f', 'magnet']] },
  { key: 'jump', v: [4, 7, 10, 13, 16], d: 'прыжок выше на #%', items: [['башмак', 'm', 'boot'], ['пружина', 'f', 'boot']] },
  { key: 'slide', v: [10, 20, 30, 40, 50], d: 'подкат длиннее на #%', items: [['перчатка', 'f', 'glove'], ['наколенник', 'm', 'glove']] },
  { key: 'kick', v: [15, 30, 45, 60, 80], d: 'пинок достаёт на # дальше', items: [['шпора', 'f', 'boot'], ['сапог', 'm', 'boot']] },
  { key: 'reload', v: [8, 14, 20, 26, 32], d: 'перезарядка быстрее на #%', items: [['курок', 'm', 'bullet'], ['гильза', 'f', 'bullet']] },
  { key: 'pierce', v: [1, 1, 2, 2, 3], d: 'пуля прошивает ещё # врага', items: [['пуля', 'f', 'bullet'], ['патронташ', 'm', 'bullet']] },
  { key: 'invuln', v: [0.2, 0.4, 0.6, 0.8, 1.0], d: 'после удара неуязвим на # с дольше', items: [['чётки', 'pl', 'candle'], ['ладанка', 'f', 'candle']] },
  { key: 'slow', v: [3, 5, 7, 9, 12], d: 'забег медленнее на #%', items: [['песочные часы', 'pl', 'hourglass'], ['маятник', 'm', 'hourglass']] },
  { key: 'revive', v: [1, 1, 1, 2, 2], d: 'встаёшь после смерти # раз за забег', items: [['свеча', 'f', 'candle'], ['саван', 'm', 'candle']] },
  { key: 'score', v: [10, 20, 30, 40, 50], d: '+#% очков', items: [['перо', 'n', 'feather'], ['монокль', 'm', 'eye']] },
  { key: 'luck', v: [20, 40, 60, 80, 100], d: 'артефакты находятся на #% чаще', items: [['ключ', 'm', 'key'], ['отмычка', 'f', 'key']] },
  { key: 'heal', v: [400, 350, 300, 250, 200], d: 'возвращает сердце каждые # м', items: [['пузырёк', 'm', 'potion'], ['микстура', 'f', 'potion']] },
  { key: 'killCoin', v: [1, 1, 2, 2, 3], d: 'за каждого убитого врага оболы: +#', items: [['клык', 'm', 'fang'], ['трофей', 'm', 'fang']] },
  { key: 'slots', v: [1, 1, 1, 1, 1], d: '+# место для артефакта в забеге (действует из инвентаря, всего не больше 5 мест)', passive: true, items: [['сундучок', 'm', 'chest'], ['саквояж', 'm', 'chest']] },
  { key: 'dash', v: [10, 20, 30, 40, 50], d: 'рывок перезаряжается быстрее на #%', items: [['плащ', 'm', 'cloak'], ['тень', 'f', 'cloak']] },
  { key: 'calm', v: [5, 10, 15, 20, 25], d: 'враги медленнее на #%', items: [['повязка', 'f', 'eye'], ['веко', 'n', 'eye']] },
  // проклятые: мешают, но платят
  { key: 'curseSpeed', cursed: true, v: [5, 10, 15, 20, 25], d: 'забег быстрее на #%, зато оболов больше на #2%', items: [['шестерня', 'f', 'gear'], ['хронометр', 'm', 'gear']] },
  { key: 'curseFragile', cursed: true, v: [1, 1, 1, 1, 1], d: '−1 сердце, зато оболов и очков больше на #2%', items: [['зеркало', 'n', 'mirror'], ['кукла', 'f', 'mirror']] },
  { key: 'curseHorde', cursed: true, v: [15, 30, 45, 60, 75], d: 'врагов больше на #%, за каждого убитого +1 обол', items: [['колокол', 'm', 'bell'], ['приманка', 'f', 'bell']] },
  { key: 'curseFog', cursed: true, v: [20, 30, 40, 50, 60], d: 'туман закрывает #% дальней части комнаты, оболов больше на #2%', items: [['фонарь', 'm', 'lantern'], ['вуаль', 'f', 'lantern']] },
  { key: 'curseHeavy', cursed: true, v: [4, 6, 8, 10, 12], d: 'прыжок ниже на #%, оболов больше на #2%', items: [['гиря', 'f', 'weight'], ['кандалы', 'pl', 'weight']] },
  { key: 'curseEye', cursed: true, v: [5, 10, 15, 20, 25], d: 'Око смотрит: враги быстрее на #%, очков больше на #2%', items: [['портрет', 'm', 'eye'], ['глаз', 'm', 'eye']] },
];

// бонус проклятых предметов (подставляется вместо #2)
const CURSE_BONUS = [15, 30, 45, 60, 80];

function build() {
  const list = [];
  let id = 1;
  for (const f of FAMILIES) {
    for (const [noun, g, icon] of f.items) {
      for (let tier = 0; tier < 5; tier++) {
        const adj = (f.cursed ? CURSED_TIERS : GOOD_TIERS)[tier][G[g]];
        const v = f.v[tier], b = CURSE_BONUS[tier];
        const name = `${adj} ${noun}`;
        const desc = f.d.replace('#2', b).replace('#', v);
        list.push({
          id: id++, key: f.key, v, bonus: f.cursed ? b : 0, tier, name, desc, icon,
          cursed: !!f.cursed, passive: !!f.passive,
          rarity: RARITY[tier],
          price: Math.round(RARITY[tier].price * 3 * (f.cursed ? 0.7 : 1) * (f.key === 'slots' ? 1.6 : 1)),
        });
      }
    }
  }
  return list;
}

export const ARTIFACTS = build();       // 250 штук, id 1..250
export const BY_ID = Object.fromEntries(ARTIFACTS.map(a => [a.id, a]));

export const BASE_SLOTS = 2;
export const MAX_SLOTS = 5;

export function slotCount(inventory) {
  const n = inventory.filter(id => BY_ID[id]?.key === 'slots').length;
  return Math.min(MAX_SLOTS, BASE_SLOTS + n);
}

// Сложение эффектов надетых артефактов (плюс слотовые из инвентаря — они на забег не влияют).
export function computeMods(equipped) {
  const m = {
    lives: 0, shield: 0, coinMult: 1, scoreMult: 1, magnet: 0, jumpMul: 1, slideMul: 1, kickAdd: 0,
    reloadMul: 1, pierce: 0, invulnAdd: 0, speedMul: 1, revive: 0, luck: 1, healEvery: 0,
    killCoin: 0, dashMul: 1, enemyMul: 1, hordeMul: 1, fog: 0,
  };
  for (const id of equipped) {
    const a = BY_ID[id];
    if (!a) continue;
    const v = a.v, b = a.bonus / 100;
    switch (a.key) {
      case 'life': m.lives += v; break;
      case 'shield': m.shield += v; break;
      case 'coin': m.coinMult += v / 100; break;
      case 'magnet': m.magnet = Math.max(m.magnet, v); break;
      case 'jump': m.jumpMul += v / 100; break;
      case 'slide': m.slideMul += v / 100; break;
      case 'kick': m.kickAdd += v; break;
      case 'reload': m.reloadMul *= 1 - v / 100; break;
      case 'pierce': m.pierce += v; break;
      case 'invuln': m.invulnAdd += v; break;
      case 'slow': m.speedMul *= 1 - v / 100; break;
      case 'revive': m.revive += v; break;
      case 'score': m.scoreMult += v / 100; break;
      case 'luck': m.luck += v / 100; break;
      case 'heal': m.healEvery = m.healEvery ? Math.min(m.healEvery, v) : v; break;
      case 'killCoin': m.killCoin += v; break;
      case 'dash': m.dashMul *= 1 - v / 100; break;
      case 'calm': m.enemyMul *= 1 - v / 100; break;
      case 'curseSpeed': m.speedMul *= 1 + v / 100; m.coinMult += b; break;
      case 'curseFragile': m.lives -= 1; m.coinMult += b; m.scoreMult += b; break;
      case 'curseHorde': m.hordeMul += v / 100; m.killCoin += 1; break;
      case 'curseFog': m.fog = Math.max(m.fog, v / 100); m.coinMult += b; break;
      case 'curseHeavy': m.jumpMul *= 1 - v / 100; m.coinMult += b; break;
      case 'curseEye': m.enemyMul *= 1 + v / 100; m.scoreMult += b; break;
    }
  }
  return m;
}

// Случайный артефакт-находка: чем выше ступень, тем реже. bias > 1 — щедрее (босс).
export function rollArtifact(rng = Math.random, bias = 1) {
  const w = [40, 30, 18 * bias, 9 * bias, 3 * bias];
  const total = w.reduce((s, x) => s + x, 0);
  let r = rng() * total, tier = 0;
  for (; tier < 4; tier++) if ((r -= w[tier]) <= 0) break;
  const pool = ARTIFACTS.filter(a => a.tier === tier);
  return pool[Math.floor(rng() * pool.length)];
}

// Прилавок магазина: детерминирован от «номера смены», чтобы не менялся при каждом открытии.
export function shopOffers(seed, size, owned) {
  let s = (seed * 2654435761) >>> 0 || 1;
  const rng = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const out = [];
  let guard = 0;
  while (out.length < size && guard++ < 500) {
    const a = rollArtifact(rng, 1.4);
    if (!out.includes(a) && !owned.includes(a.id)) out.push(a);
  }
  return out;
}

// ---------- значки (рисуются кодом в чернильном стиле) ----------
export function drawArtifactIcon(ctx, a, x, y, size, opt = {}) {
  const r = size / 2;
  ctx.save();
  ctx.translate(x, y);
  let k;
  if (opt.plain) {
    // просто предмет, без медальона (для поиска предметов и «трёх в ряд»)
    k = r * 0.95;
    ctx.fillStyle = opt.color || '#16120f';
    ctx.strokeStyle = opt.color || '#16120f';
  } else {
    // медальон: цвет — редкость, проклятые — тёмно-красные
    ctx.fillStyle = a.cursed ? '#5a1e1e' : a.rarity.color;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = Math.max(2, size * 0.06);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.95, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = a.cursed ? '#2a0f0f' : '#e8dcc4';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.76, 0, 7); ctx.fill();
    k = r * 0.5;
    ctx.fillStyle = a.cursed ? '#c25a4a' : '#16120f';
    ctx.strokeStyle = a.cursed ? '#c25a4a' : '#16120f';
  }
  ctx.lineWidth = Math.max(1.5, size * 0.05);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const P = (pts, fill = true) => { ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px * k, py * k) : ctx.moveTo(px * k, py * k)); ctx.closePath(); fill ? ctx.fill() : ctx.stroke(); };
  const C = (cx, cy, rr, fill = true) => { ctx.beginPath(); ctx.arc(cx * k, cy * k, rr * k, 0, 7); fill ? ctx.fill() : ctx.stroke(); };
  switch (a.icon) {
    case 'heart': P([[0, 0.9], [-0.9, -0.1], [-0.7, -0.7], [-0.25, -0.75], [0, -0.4], [0.25, -0.75], [0.7, -0.7], [0.9, -0.1]]); break;
    case 'shield': P([[-0.75, -0.8], [0.75, -0.8], [0.7, 0.1], [0, 0.95], [-0.7, 0.1]]); break;
    case 'coin': C(0, 0, 0.75, false); C(0, 0, 0.4, false); break;
    case 'magnet': ctx.beginPath(); ctx.arc(0, 0, 0.6 * k, Math.PI, 0); ctx.stroke(); P([[-0.75, 0], [-0.45, 0], [-0.45, 0.7], [-0.75, 0.7]]); P([[0.45, 0], [0.75, 0], [0.75, 0.7], [0.45, 0.7]]); break;
    case 'boot': P([[-0.4, -0.9], [0.1, -0.9], [0.1, 0.3], [0.9, 0.5], [0.9, 0.85], [-0.4, 0.85]]); break;
    case 'glove': P([[-0.6, 0.9], [-0.6, -0.2], [-0.4, -0.85], [-0.15, -0.2], [0.05, -0.9], [0.25, -0.2], [0.5, -0.7], [0.65, 0.1], [0.4, 0.9]]); break;
    case 'bullet': P([[-0.25, 0.9], [-0.25, -0.3], [0, -0.9], [0.25, -0.3], [0.25, 0.9]]); break;
    case 'hourglass': P([[-0.6, -0.85], [0.6, -0.85], [0.1, 0], [0.6, 0.85], [-0.6, 0.85], [-0.1, 0]], false); P([[-0.35, 0.6], [0.35, 0.6], [0, 0.2]]); break;
    case 'candle': P([[-0.3, 0.9], [-0.3, -0.3], [0.3, -0.3], [0.3, 0.9]]); P([[0, -0.95], [0.18, -0.55], [0, -0.4], [-0.18, -0.55]]); break;
    case 'feather': P([[0.7, -0.9], [0.2, -0.3], [-0.6, 0.8], [-0.5, 0.9], [0.3, 0.1], [0.8, -0.5]]); break;
    case 'eye': P([[-0.9, 0], [0, -0.55], [0.9, 0], [0, 0.55]], false); C(0, 0, 0.3); break;
    case 'key': C(-0.45, 0, 0.35, false); P([[-0.1, -0.1], [0.9, -0.1], [0.9, 0.1], [-0.1, 0.1]]); P([[0.55, 0.1], [0.75, 0.1], [0.75, 0.4], [0.55, 0.4]]); break;
    case 'potion': P([[-0.2, -0.9], [0.2, -0.9], [0.2, -0.35], [0.7, 0.3], [0.5, 0.85], [-0.5, 0.85], [-0.7, 0.3], [-0.2, -0.35]]); break;
    case 'fang': P([[-0.5, -0.8], [0.5, -0.8], [0.1, 0.9], [-0.1, 0.9]]); break;
    case 'chest': P([[-0.85, -0.3], [0.85, -0.3], [0.85, 0.75], [-0.85, 0.75]], false); ctx.beginPath(); ctx.arc(0, -0.3 * k, 0.85 * k, Math.PI, 0); ctx.stroke(); C(0, 0.1, 0.15); break;
    case 'cloak': P([[0, -0.9], [0.4, -0.5], [0.8, 0.9], [0, 0.6], [-0.8, 0.9], [-0.4, -0.5]]); break;
    case 'gear': for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4; P([[Math.cos(an - 0.15) * 0.6, Math.sin(an - 0.15) * 0.6], [Math.cos(an - 0.1) * 0.9, Math.sin(an - 0.1) * 0.9], [Math.cos(an + 0.1) * 0.9, Math.sin(an + 0.1) * 0.9], [Math.cos(an + 0.15) * 0.6, Math.sin(an + 0.15) * 0.6]]); } C(0, 0, 0.62); ctx.fillStyle = opt.plain ? '#e8dcc4' : a.cursed ? '#2a0f0f' : '#e8dcc4'; C(0, 0, 0.25); break;
    case 'mirror': ctx.beginPath(); ctx.ellipse(0, -0.2 * k, 0.5 * k, 0.65 * k, 0, 0, 7); ctx.stroke(); P([[-0.1, 0.45], [0.1, 0.45], [0.1, 0.95], [-0.1, 0.95]]); break;
    case 'bell': P([[-0.7, 0.6], [-0.5, -0.4], [0, -0.85], [0.5, -0.4], [0.7, 0.6]]); C(0, 0.78, 0.18); break;
    case 'lantern': P([[-0.45, -0.6], [0.45, -0.6], [0.55, 0.8], [-0.55, 0.8]], false); P([[-0.2, -0.95], [0.2, -0.95], [0.2, -0.6], [-0.2, -0.6]]); C(0, 0.15, 0.22); break;
    case 'weight': P([[-0.35, -0.5], [0.35, -0.5], [0.8, 0.85], [-0.8, 0.85]]); C(0, -0.7, 0.22, false); break;
    default: C(0, 0, 0.5);
  }
  ctx.restore();
}
