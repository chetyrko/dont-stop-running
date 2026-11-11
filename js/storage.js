// Сохранение прогресса в памяти телефона (localStorage внутри приложения).
// Хранится: оболы, пройденные комнаты, рекорды, инвентарь артефактов, облики, настройки.
const KEY = 'dsr-save-v2';
const OLD_KEY = 'dsr-save-v1';

const DEFAULT = {
  gold: 0,
  ownedSkins: ['classic'],
  ownedChars: ['flit'],   // купленные персонажи
  char: 'flit',           // кем играем
  skin: 'classic',
  settings: { sound: true, vibration: true, paper: true, difficulty: 'nightmare', view: 'classic', kickSide: 'left', endless: true },
  progress: { maxRoom: 0 },                 // последняя пройденная комната (0 — ни одной)
  records: {
    endless: { easy: 0, normal: 0, hard: 0, nightmare: 0 },   // лучший счёт в бесконечном забеге
    endlessMeters: 0,
    roomsCleared: 0,                         // всего прохождений комнат
    bosses: 0,
    deaths: 0,
    deathRooms: [],                          // в каких комнатах стал портретом (последние 12)
    bestRoomScore: {},                       // лучший счёт по комнатам
  },
  inventory: [],       // id артефактов, которые есть у игрока
  equipped: [],        // id артефактов, взятых в забег
  seenHints: [],       // какие препятствия уже объяснены
  seenComics: [],      // какие комиксы показаны
  seenLore: [],        // какие сюжетные записки уже прочитаны
  bestiary: {},        // монстры: { вид: { first: комната первой встречи, runs: забегов с ним, kills: убито } }
  shop: { shift: 0, bought: [] },
  upgrades: { magnet: 0, wings: 0, double: 0, cloak: 0, fame: 0, weapon: 0, hero: {} },
  charms: 0,          // обереги — вторые жизни
};

function merge(d) {
  return {
    ...structuredClone(DEFAULT), ...d,
    settings: { ...DEFAULT.settings, ...(d.settings || {}) },
    progress: { ...DEFAULT.progress, ...(d.progress || {}) },
    records: { ...structuredClone(DEFAULT.records), ...(d.records || {}),
      endless: { ...DEFAULT.records.endless, ...(d.records?.endless || {}) } },
    shop: { ...DEFAULT.shop, ...(d.shop || {}) },
    upgrades: { ...structuredClone(DEFAULT.upgrades), ...(d.upgrades || {}) },
  };
}

let data = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return merge(JSON.parse(raw));
    // перенос со старой версии: оболы и облики сохраняются
    const old = localStorage.getItem(OLD_KEY);
    if (old) {
      const o = JSON.parse(old);
      return merge({ gold: o.gold || 0, ownedSkins: o.ownedSkins, skin: o.skin, settings: o.settings });
    }
  } catch (e) { /* нет доступа к хранилищу — играем без сохранений */ }
  return structuredClone(DEFAULT);
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* игнор */ }
}

export function getSave() { return data; }

export function resetSave() {
  data = structuredClone(DEFAULT);
  save();
  return data;
}
