// 13 персонажей. У каждого — свой облик и свои особенности.
// look: tint — цвет одежды, hat — головной убор, sx/sy — пропорции (шире/уже, выше/ниже).
// mods — поправки к забегу (как у артефактов), weapon — чем стреляет тап:
//   pistol — обычный выстрел, fists — удар кулаком вблизи, rifle — снайперская винтовка
//   (медленно, прошивает всех и разбивает мебель издалека), shotgun — дробь (две цели, быстро).

export const CHARACTERS = [
  { id: 'flit', name: 'Флит Вейн', role: 'Оценщик', price: 0,
    desc: 'Оценщик невозможной недвижимости. Ничего особенного — кроме того, что он, кажется, всё это построил.',
    perks: ['Пистолет', 'Ровно во всём'],
    look: { hat: 'none' }, weapon: 'pistol', mods: {} },

  { id: 'sirius', name: 'Сириус', role: 'Здоровяк', price: 900,
    desc: 'Бывший вышибала бального зала. Огнестрел не признаёт: «Пуля — это для тех, кто боится подойти».',
    perks: ['Тап — удар кулаком: тени и мебель вблизи', '+1 сердце', 'Прыжок ниже'],
    look: { tint: { gray: 1, mul: [0.55, 0.5, 0.45] }, hat: 'none', sx: 1.35, sy: 1.08, noGun: true },
    weapon: 'fists', mods: { lives: 1, jumpMul: 0.9, kickAdd: 40 } },

  { id: 'zefinnaya', name: 'Зефинная', role: 'Снайпер', price: 1400,
    desc: 'Худой старик с винтовкой длиннее его самого. Стреляет редко, но насквозь — и через шкафы тоже.',
    perks: ['Тап — винтовка: прошивает всех, ломает мебель издалека', 'Перезарядка долгая', '−1 сердце'],
    look: { tint: { gray: 1, mul: [0.8, 0.85, 0.7] }, hat: 'tricorn', sx: 0.78, sy: 1.08 },
    weapon: 'rifle', mods: { lives: -1 } },

  { id: 'lavanda', name: 'Мадам Лаванда', role: 'Медиум', price: 700,
    desc: 'Разговаривает с призраками и иногда сама им становится. Ненадолго.',
    perks: ['Рывок вдвое длиннее и чаще', 'Одно воскрешение'],
    look: { tint: { gray: 1, mul: [0.9, 0.75, 1.15] }, hat: 'plague', sx: 0.92, sy: 1 },
    weapon: 'pistol', mods: { dashLen: 2, dashMul: 0.6, revive: 1 } },

  { id: 'grosh', name: 'Братья Грош', role: 'Скупщики', price: 600,
    desc: 'Двое в одном пальто. Видят обол сквозь стену и не могут пройти мимо.',
    perks: ['Оболов ×1.6', 'Оболы притягиваются', '−1 сердце'],
    look: { tint: { gray: 1, mul: [1.3, 1.1, 0.5] }, hat: 'tophat', sx: 1.1, sy: 0.92 },
    weapon: 'pistol', mods: { coinMult: 0.6, magnet: 140, lives: -1 } },

  { id: 'vual', name: 'Вдова Чёрная Вуаль', role: 'Тень', price: 800,
    desc: 'Скользит по паркету так, будто под ней лёд. Говорят, она и есть тот сквозняк.',
    perks: ['Подкат вдвое длиннее', 'Неуязвимость после удара дольше'],
    look: { tint: { gray: 1, mul: [0.35, 0.33, 0.4] }, hat: 'plague', sx: 0.88, sy: 1.04 },
    weapon: 'pistol', mods: { slideMul: 2, invulnAdd: 0.8 } },

  { id: 'sazha', name: 'Трубочист Сажа', role: 'Акробат', price: 1000,
    desc: 'Полжизни провёл в дымоходах поместья. Отталкивается от воздуха, как от кирпичей.',
    perks: ['Двойной прыжок', 'Прыжок выше'],
    look: { tint: { gray: 1, mul: [0.45, 0.42, 0.4] }, hat: 'tophat', sx: 0.9, sy: 0.95 },
    weapon: 'pistol', mods: { doubleJump: true, jumpMul: 1.1 } },

  { id: 'klyaksa', name: 'Доктор Клякса', role: 'Учёный', price: 1100,
    desc: 'Изучает чернила, из которых сделан дом. Носит на себе пару удачных опытов.',
    perks: ['Два щита в начале забега', 'Артефакты находятся чаще'],
    look: { tint: { gray: 1, mul: [0.6, 0.75, 1.1] }, hat: 'none', sx: 1, sy: 1 },
    weapon: 'pistol', mods: { shield: 2, luck: 0.5 } },

  { id: 'tim', name: 'Звонарь Тим', role: 'Дробовик', price: 1200,
    desc: 'Сторож часовой башни. Его обрез звонит громче колокола.',
    perks: ['Тап — дробь: две цели за выстрел', 'Перезарядка быстрее'],
    look: { tint: { gray: 1, mul: [1.0, 0.55, 0.3] }, hat: 'tricorn', sx: 1.12, sy: 0.96 },
    weapon: 'shotgun', mods: { pierce: 1, reloadMul: 0.75 } },

  { id: 'fern', name: 'Кукольник Ферн', role: 'Кукловод', price: 1300,
    desc: 'Знает, за какие нити дёргать. Тени рядом с ним ходят, будто во сне.',
    perks: ['Враги медленнее на 30%', 'За каждого убитого — обол'],
    look: { tint: { gray: 1, mul: [0.9, 1.05, 0.6] }, hat: 'tophat', sx: 0.95, sy: 1.05 },
    weapon: 'pistol', mods: { enemyMul: 0.7, killCoin: 1 } },

  { id: 'ida', name: 'Сомнамбула Ида', role: 'Лунатик', price: 1500,
    desc: 'Бежит во сне и никогда не падает в ямы. Просыпаться ей не советуют.',
    perks: ['Сама перепрыгивает ямы и люки', 'Забег чуть медленнее'],
    look: { tint: { gray: 1, mul: [1.15, 1.15, 1.2] }, hat: 'none', sx: 0.85, sy: 1.02 },
    weapon: 'pistol', mods: { autoJump: true, speedMul: 0.95 } },

  { id: 'pim', name: 'Архивариус Пим', role: 'Хранитель описи', price: 1600,
    desc: 'Помнит каждую комнату, даже ту, которой ещё нет. Записывает всё — и очки тоже.',
    perks: ['Артефакты находятся вдвое чаще', 'Очков +40%'],
    look: { tint: { gray: 1, mul: [0.95, 0.85, 0.6] }, hat: 'tricorn', sx: 1.05, sy: 0.9 },
    weapon: 'pistol', mods: { luck: 1, scoreMult: 0.4 } },

  { id: 'voron', name: 'Лекарь Ворон', role: 'Чумной доктор', price: 2000,
    desc: 'Лечит всех, кроме себя. Вороны поместья почему-то его слушаются.',
    perks: ['+1 сердце каждые 300 м', 'Одно воскрешение'],
    look: { tint: { gray: 1, mul: [0.5, 0.5, 0.5] }, hat: 'plague', sx: 1, sy: 1.06 },
    weapon: 'pistol', mods: { healEvery: 300, revive: 1 } },
];

export const CHAR_BY_ID = Object.fromEntries(CHARACTERS.map(c => [c.id, c]));

// Добавить особенности персонажа к модификаторам забега (результат computeMods).
export function applyCharacter(m, ch) {
  const c = ch?.mods || {};
  m.weapon = ch?.weapon || 'pistol';
  m.lives += c.lives || 0;
  m.shield += c.shield || 0;
  m.revive += c.revive || 0;
  m.coinMult += c.coinMult || 0;
  m.scoreMult += c.scoreMult || 0;
  m.luck += c.luck || 0;
  m.pierce += c.pierce || 0;
  m.killCoin += c.killCoin || 0;
  m.kickAdd += c.kickAdd || 0;
  m.invulnAdd += c.invulnAdd || 0;
  if (c.magnet) m.magnet = Math.max(m.magnet, c.magnet);
  if (c.healEvery) m.healEvery = m.healEvery ? Math.min(m.healEvery, c.healEvery) : c.healEvery;
  for (const k of ['jumpMul', 'slideMul', 'reloadMul', 'speedMul', 'dashMul', 'enemyMul']) if (c[k]) m[k] *= c[k];
  m.doubleJump = !!c.doubleJump;
  m.autoJump = !!c.autoJump;
  m.dashLen = c.dashLen || 1;
  if (m.weapon === 'rifle') m.reloadMul *= 3.2;
  return m;
}
