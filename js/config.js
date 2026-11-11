// Все настраиваемые числа игры собраны здесь — меняй смело.

// Мир игры (то, что видно в «окне» с рамкой). Окно вписывается в экран телефона.
export const W = 1000;          // ширина мира в кадре
export const H = 600;           // высота мира в кадре
export const FLOOR_TOP = 490;   // где стена переходит в пол
export const GROUND_Y = 545;    // линия, по которой бегут герой и враги (середина пола)
export const PLAYER_X = 190;    // где стоит герой по горизонтали
export const HERO_SCALE = 1.5;  // во сколько раз герой крупнее базового рисунка

// Экран телефона (вертикальный). Высота подстраивается под пропорции телефона.
export const SCREEN_W = 720;

export const PLAYER = {
  lives: 3,
  height: 175,          // рост в полный рост (хитбокс)
  slideHeight: 78,      // рост в подкате
  width: 60,
  jumpVelocity: 1460,   // начальная скорость прыжка
  gravity: 3900,
  slideTime: 0.75,      // сек
  kickTime: 0.38,       // сек, длительность удара ногой
  kickRange: 210,       // на каком расстоянии перед собой достаёт нога
  shootCooldown: 0.28,  // сек между выстрелами
  bulletSpeed: 1500,
  invulnTime: 1.4,      // неуязвимость после удара
};

// Очки
export const SCORE = {
  perMeter: 1,
  coin: 10,
  furniture: 25,
  monster: 40,
};

// Сколько пикселей = 1 метр (для счётчика дистанции)
export const PX_PER_METER = 40;

// Режимы сложности (меняются в настройках).
// speed — скорость бега, gap — паузы между препятствиями, combo — шанс сдвоенных препятствий,
// enemy — скорость врагов, coin — множитель оболов в конце забега, lives — сердца,
// find — шанс найти артефакт, boss — множитель здоровья босса.
export const DIFFICULTY = {
  easy:      { name: 'Лёгкий',        lives: 3, speed: 0.86, gap: 1.3,  combo: 0.0,  enemy: 0.8,  coin: 1.0, find: 0.8, boss: 0.7, hints: true, checkpoints: true },
  normal:    { name: 'Средний',       lives: 3, speed: 1.0,  gap: 1.0,  combo: 0.15, enemy: 1.0,  coin: 1.15, find: 1.0, boss: 1.0 },
  hard:      { name: 'Сложный',       lives: 3, speed: 1.14, gap: 0.84, combo: 0.35, enemy: 1.25, coin: 1.35, find: 1.2, boss: 1.3 },
  nightmare: { name: 'Кошмар наяву',  lives: 1, speed: 1.28, gap: 0.72, combo: 0.55, enemy: 1.5,  coin: 1.7, find: 1.5, boss: 1.6, nightmare: true },
};
export const DIFF_ORDER = ['easy', 'normal', 'hard', 'nightmare'];

// Экономика: оболы редкие, вещи дорогие.
export const ECONOMY = {
  coinRowChance: 0.15,   // шанс ряда оболов между препятствиями
  firstClearBonus: 6,    // оболы за первое прохождение комнаты (+ номер акта)
  shopSize: 6,           // сколько артефактов на прилавке
  shopRerollPrice: 120,   // обновить прилавок
  shopRotateRooms: 3,    // прилавок сам обновляется каждые N пройденных комнат
};

// Скины для магазина. Цвета/шляпы рисуются процедурно (art.js).
export const SKINS = [
  { id: 'classic',    name: 'Задира',         price: 0,   shirt: '#b3302c', pants: '#191615', hat: 'none' },
  { id: 'undertaker', name: 'Гробовщик',      price: 2400,  shirt: '#3a3844', pants: '#141216', hat: 'tophat', tint: { gray: 1, mul: [0.5, 0.5, 0.58] } },
  { id: 'plague',     name: 'Чумной доктор',  price: 5400, shirt: '#5b6a4d', pants: '#1c1a17', hat: 'plague', tint: { gray: 1, mul: [0.75, 1.05, 0.65] } },
  { id: 'hunter',     name: 'Охотник',        price: 9600, shirt: '#a8772e', pants: '#2a2119', hat: 'tricorn', tint: { gray: 1, mul: [1.9, 1.15, 0.4] } },
];

// Свои картинки: положи PNG в www/assets/ и пропиши путь.
// Если картинка указана — она рисуется вместо процедурной графики.
// Размер картинки подгоняется под хитбокс объекта, низ картинки = земля.
export const CUSTOM_ART = {
  furniture: 'assets/props/bookcase.png',   // книжный шкаф
  // monster:   'assets/monster.png',
  // flyer:     'assets/flyer.png',
  // coin:      'assets/coin.png',

  // фон и интерфейс (рисунки автора)
  wall:   'assets/world/wall.png',    // обои с картинами
  floor:  'assets/world/floor.png',   // пол
  frame:  'assets/ui/frame.png',      // чёрная рамка экрана с прозрачным окном
  heart:  'assets/ui/heart.png',      // сердце-жизнь
  plaque: 'assets/ui/plaque.png',     // серая плашка
  eye:    'assets/ui/eye.png',        // глаз (кнопка паузы)
};

// Окно в рамке frame.png (пиксели самой картинки 1440 × 2560): здесь виден мир игры.
export const FRAME_WINDOW = { imgW: 1440, top: 722, bottom: 1571 };
