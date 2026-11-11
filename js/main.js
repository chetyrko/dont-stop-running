// Точка входа: раскладка экрана, меню, поместье, артефакты, лавка, комиксы, игровой цикл.

import { SKINS, CUSTOM_ART, SCREEN_W, DIFFICULTY, DIFF_ORDER, ECONOMY } from './config.js?v=67230c4';
import { Game } from './game.js?v=67230c4';
import { Game3D } from './game3d.js?v=67230c4';
import { World3D, Run3D } from './three3d.js?v=67230c4';
import { setupInput } from './input.js?v=67230c4';
import { sfx, unlockAudio, setSoundEnabled } from './audio.js?v=67230c4';
import { getSave, save, resetSave } from './storage.js?v=67230c4';
import { drawHero, makeRng, drawPit } from './art.js?v=67230c4';
import { drawTrapdoor } from './enemies.js?v=67230c4';
import { computeLayout, createFrame, windowPath, Hud } from './hud.js?v=67230c4';
import { loadHeroRig, rigReady, drawRigHero } from './rig.js?v=67230c4';
import { loadDemon } from './demon.js?v=67230c4';
import { ACTS, ROOMS_TOTAL, roomLevel, endlessLevel, demoLevel, storyAfter, EXITS } from './rooms.js?v=67230c4';
import { UPGRADES, UPGRADE_PRICES } from './characters.js?v=67230c4';
import { ARTIFACTS, BY_ID, slotCount, rollArtifact, shopOffers, drawArtifactIcon, computeMods } from './artifacts.js?v=67230c4';
import { ComicPlayer } from './comic.js?v=67230c4';
import { MINIGAMES } from './minigames.js?v=67230c4';
import { CHARACTERS, CHAR_BY_ID } from './characters.js?v=67230c4';
import { recolor } from './pixels.js?v=67230c4';
import { ENEMY } from './enemies.js?v=67230c4';
import { BEAST_TEXT, knowledge, KNOW_DESC, KNOW_SECRET } from './bestiary.js?v=67230c4';
import { GROUND_Y } from './config.js?v=67230c4';

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const stage = $('#stage');
const cvs = $('#game');
const ctx = cvs.getContext('2d');

let S = getSave();
let game = null;          // текущий забег
let demo = null;          // фон для меню
let comic = null;         // показываемый комикс
let mini = null;          // мини-игра (поиск предметов, три в ряд, пятнашки)
let checkpoint = 0;       // последний взятый флажок (лёгкий режим), в метрах
let paused = false;
let currentLevel = null;
let images = {};
let L = null, frameImg = null, hud = null;
let scale = 1;
let viewAct = 1;          // какой акт открыт в сетке комнат
let artFilter = 'all';
let opisTab = 'beasts';
let artSelected = null;
let shopTab = 'chars';
let charSel = null;
let world = null;                // 3D-сцена (создаётся, когда включён 3D-режим)
const glCanvas = $('#gl');
const is3d = () => S.settings.view === '3d';
// 3D — основной режим: один раз включаем его всем
if (!S.settings.view3dDefault) { S.settings.view = '3d'; S.settings.view3dDefault = true; save(); }
function applyView() {
  document.body.classList.toggle('v3d', is3d());
  if (is3d() && !world && images.wall !== undefined) { try { world = new World3D(glCanvas, images); } catch (e) { console.warn('WebGL недоступен', e); S.settings.view = 'classic'; } }
}
function fade(on) { $('#fade').classList.toggle('on', on); }

// ---------- раскладка под экран ----------
function resize() {
  const vw = window.innerWidth, vh = window.innerHeight;
  L = computeLayout(SCREEN_W * vh / vw, !!images.frame);
  scale = Math.min(vw / L.SW, vh / L.SH);
  stage.style.width = L.SW + 'px';
  stage.style.height = L.SH + 'px';
  stage.style.transform = `scale(${scale}) translate(-50%, -50%)`;
  stage.style.setProperty('--win-top', L.win.y + 'px');
  stage.style.setProperty('--win-bottom', (L.win.y + L.win.h) + 'px');
  stage.style.setProperty('--sh', L.SH + 'px');
  world?.resize();
  cvs.style.width = L.SW + 'px';
  cvs.style.height = L.SH + 'px';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cvs.width = Math.round(L.SW * scale * dpr);
  cvs.height = Math.round(L.SH * scale * dpr);
  frameImg = createFrame(L, images.frame);
  hud = new Hud(L, images);
  if (comic) comic.L = L;
}
window.addEventListener('resize', resize);
resize();

function loadImages() {
  return Promise.all(Object.entries(CUSTOM_ART).map(([k, src]) => new Promise((res) => {
    const img = new Image();
    img.onload = () => { images[k] = img; res(); };
    img.onerror = () => { console.warn('Не загрузилась картинка', src); res(); };
    img.src = src;
  })));
}

// ---------- экраны ----------
const SCREENS = ['menu', 'lobby', 'levels', 'artifacts', 'shop', 'settings', 'pause', 'over', 'story'];
function show(name) {
  SCREENS.forEach(s => $('#' + s).classList.toggle('hidden', s !== name));
  if (name === 'levels') { viewAct = Math.floor(Math.min(ROOMS_TOTAL - 1, S.progress.maxRoom) / 100) + 1; renderLevels(); }
  if (name === 'artifacts') renderOpis();
  if (name === 'shop') renderShop();
  if (name === 'settings') renderSettings();
  updateWallet();
}

function updateWallet() { $$('.gold-total').forEach(el => el.textContent = S.gold); }
function currentChar() { return CHAR_BY_ID[S.char] || CHARACTERS[0]; }
// Облик для рисования: у Флита — выбранный в лавке наряд, у остальных — свой вид.
function lookOf(ch) {
  if (ch.id === 'flit') return SKINS.find(s => s.id === S.skin) || SKINS[0];
  const L = ch.look;
  return { ...L, shirt: shirtColor(L.tint) };
}
function currentSkin() { return lookOf(currentChar()); }
// цвет рубашки для 3D-режима — та же перекраска, что у рисунка
function shirtColor(t) {
  if (!t) return '#b3302c';
  const c = [0xb3, 0x30, 0x2c], l = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  const v = c.map((x, i) => Math.max(0, Math.min(255, Math.round((x + (l - x) * (t.gray || 0)) * (t.mul?.[i] ?? 1)))));
  return `rgb(${v[0]},${v[1]},${v[2]})`;
}
const diff = () => S.settings.difficulty || 'nightmare';

function iconCanvas(a, size) {
  const c = document.createElement('canvas');
  c.width = size * 2; c.height = size * 2;
  drawArtifactIcon(c.getContext('2d'), a, size, size, size * 2);
  return c;
}

// ---------- запуск забегов ----------
function startDemo() {
  game = null; comic = null; mini = null;
  applyView();
  if (is3d() && world) {          // 3D: герой во весь экран, опёрся на меню
    demo = null;
    world.setHero(currentSkin(), currentChar().weapon);
    world.setMode('title');
    return;
  }
  const G = S.settings.view === '3d' ? Game3D : Game;
  demo = new G(demoLevel(), currentSkin(), { demo: true, paperFx: S.settings.paper, images });
}

function startRun(level, extra = {}) {
  currentLevel = level;
  demo = null; comic = null; mini = null;
  paused = false;
  checkpoint = extra.startAt || 0;
  const G = is3d() && world ? Run3D : S.settings.view === '3d' ? Game3D : Game;   // режим игры из настроек
  game = new G(level, currentSkin(), {
    world,
    character: currentChar(),
    images,
    vibration: S.settings.vibration,
    upgrades: upgradeLevels(),
    floorSigns: !!S.settings.signs,
    charms: S.charms || 0,
    onCharm: () => { S.charms = Math.max(0, (S.charms || 0) - 1); save(); },
    paperFx: S.settings.paper,
    equipped: S.equipped,
    seenHints: S.seenHints,
    // подсказка над врагом: пока ни разу не встречен, а потом — в комнате первой встречи и в следующей
    deathRooms: S.records.deathRooms || [],
    showHint: (type) => {
      const rec = S.bestiary[type];
      if (!rec) return true;
      return level.kind === 'room' && level.room <= rec.first + 1;
    },
    onRelic: findRelic,
    onEnd: onGameEnd,
    startAt: extra.startAt || 0,
    onCheckpoint: (cp) => { checkpoint = cp; },
  });
  hud = new Hud(L, images);
  if (game instanceof Run3D) { world.setHero(currentSkin(), currentChar().weapon); world.startRun(game); }
  show(null);
}

// ---------- 3D: меню → разминка → забег ----------
function toLobby() {
  if (!world) return;
  sfx.click();
  show(null);
  world.leaveTitle(() => {
    fade(true);
    setTimeout(() => {
      if (!S.seenComics.includes('prologue')) { fade(false); playComic('prologue', enterLobby); }
      else enterLobby();
    }, 380);
  });
}
function enterLobby() {
  game = null; demo = null; comic = null; mini = null;
  world.setHero(currentSkin(), currentChar().weapon);
  world.setMode('lobby');
  const next = Math.min(ROOMS_TOTAL, S.progress.maxRoom + 1), lv = roomLevel(next, diff());
  $('#lobby-info').innerHTML = `Комната ${next} · ${lv.place}<small>${ACTS[Math.floor((next - 1) / 100)].title} · ${currentChar().name}</small>`;
  show('lobby');
  setTimeout(() => fade(false), 60);
}
$('#lobby').addEventListener('click', (e) => {
  if (e.target.closest('button')) return;
  unlockAudio();
  startRoom(Math.min(ROOMS_TOTAL, S.progress.maxRoom + 1));
});
$('#lobby-back').onclick = (e) => { e.stopPropagation(); sfx.click(); startDemo(); show('menu'); };
$('#lobby-rooms').onclick = (e) => { e.stopPropagation(); sfx.click(); show('levels'); };
$('#lobby-endless').onclick = (e) => { e.stopPropagation(); sfx.click(); startEndless(); };
$('#menu').addEventListener('click', (e) => {
  if (!is3d() || e.target.closest('button')) return;
  unlockAudio();
  toLobby();
});

function startRoom(n) {
  n = Math.max(1, Math.min(ROOMS_TOTAL, n));
  // перед самой первой комнатой — пролог
  if (n === 1 && !S.seenComics.includes('prologue')) {
    playComic('prologue', () => startRoom(1));
    return;
  }
  const lvl = roomLevel(n, diff());
  if (lvl.special) startMini(lvl); else startRun(lvl);
}

// Особая комната: поиск предметов, «три в ряд», «пятнашки».
function startMini(lvl) {
  currentLevel = lvl;
  game = null; demo = null; comic = null;
  show(null);
  mini = new MINIGAMES[lvl.special](lvl, images, currentSkin(), (res) => {
    mini = null;
    if (res.quit) { startDemo(); show('menu'); return; }
    if (res.skipped) {
      // пропуск: комната засчитана, все оболы отданы Дому, награды нет
      S.gold = 0; save();
      finishRoom(lvl, { won: true, skipped: true, coins: 0, coinMult: 1, score: 0, meters: 0, found: [] });
      return;
    }
    const found = [];
    // награда: поиск — шанс артефакта, редкие головоломки — артефакт всегда
    if (res.won && (lvl.special !== 'search' || Math.random() < 0.5)) found.push(findRelic(lvl.special === 'search' ? 1 : 2));
    const coins = res.won ? (lvl.special === 'search' ? 20 : 35) + lvl.act * 8 : 0;
    finishRoom(lvl, { won: res.won, coins, coinMult: 1, score: coins * 10, meters: 0, found });
  });
  mini.gold = S.gold;   // для кнопки «пропустить»
}

function startEndless() { startRun(endlessLevel(diff(), S.progress.maxRoom)); }

function playComic(id, then) {
  game = null; demo = null;
  show(null);
  comic = new ComicPlayer(id, L, images, currentSkin(), () => {
    comic = null;
    if (!S.seenComics.includes(id)) { S.seenComics.push(id); save(); }
    then?.();
  });
}

// Находка в забеге: новый артефакт — в инвентарь; повтор — превращается в оболы.
function findRelic(bias) {
  const a = rollArtifact(Math.random, bias);
  if (S.inventory.includes(a.id)) {
    const coins = Math.round(a.price / 4);
    S.gold += coins; save();
    return { art: a, dup: true, coins, text: `${a.name} — уже есть: +${coins} оболов` };
  }
  S.inventory.push(a.id); save();
  return { art: a, dup: false, text: `Найден артефакт: ${a.name}` };
}

function onGameEnd(won) {
  const g = game;
  recordBeasts(g, currentLevel);
  finishRoom(currentLevel, { won, coins: g.coins, coinMult: g.mods.coinMult, score: g.score, meters: g.meters, found: g.found, met: g.met });
}

// Бестиарий: кого встретил в забеге и скольких убил.
function recordBeasts(g, lvl) {
  const room = lvl.kind === 'room' ? lvl.room : Math.max(1, S.progress.maxRoom);
  for (const t of g.met) {
    const r = S.bestiary[t] ||= { first: room, runs: 0, kills: 0 };
    r.first = Math.min(r.first, room);
    r.runs++;
    r.kills += g.killsBy[t] || 0;
  }
  save();
}

function finishRoom(lvl, g) {
  const D = DIFFICULTY[lvl.diff] || DIFFICULTY.normal;
  let earned = Math.round(g.coins * D.coin * g.coinMult);
  const score = g.score;
  const R = S.records;
  $('#btn-checkpoint').classList.add('hidden');

  if (lvl.kind === 'endless') {
    if (score > (R.endless[lvl.diff] || 0)) R.endless[lvl.diff] = score;
    R.endlessMeters = Math.max(R.endlessMeters || 0, g.meters);
    S.gold += earned; save();
    $('#over-title').textContent = 'Сквозняк стих';
    $('#over-result').innerHTML = `<div>Пробежал: <b>${g.meters} м</b></div><div>Счёт: <b>${score}</b></div>` +
      `<div>Оболы: <b>+${earned}</b></div><div>Рекорд (${D.name.toLowerCase()}): <b>${R.endless[lvl.diff]}</b></div>` + foundHtml(g);
    show('over');
    return;
  }

  if (!g.won) {
    R.deaths++;
    if (lvl.kind === 'room') { (R.deathRooms ||= []).push(lvl.room); R.deathRooms = R.deathRooms.slice(-12); }
    S.gold += earned; save();
    $('#over-title').textContent = lvl.special ? 'Не вышло' : 'Ты стал портретом';
    $('#over-result').innerHTML = `<div>${lvl.name} · ${lvl.place}</div>` + (g.meters ? `<div>Пробежал: <b>${g.meters} м</b> из ${lvl.length}</div>` : '') + `<div>Оболы: <b>+${earned}</b></div>` + foundHtml(g);
    // лёгкий режим: можно продолжить с последнего флажка
    if (checkpoint > 0 && !lvl.special) {
      const cpBtn = $('#btn-checkpoint');
      cpBtn.textContent = `С флажка (${checkpoint} м)`;
      cpBtn.classList.remove('hidden');
      const cp = checkpoint;
      cpBtn.onclick = () => { sfx.click(); startRun(roomLevel(lvl.room, diff()), { startAt: cp }); };
    }
    show('over');
    return;
  }

  // комната пройдена
  const first = lvl.room > S.progress.maxRoom;
  if (first) {
    S.progress.maxRoom = lvl.room;
    if (!g.skipped) earned += ECONOMY.firstClearBonus + lvl.act;   // за пропуск бонуса нет
  }
  R.roomsCleared++;
  if (lvl.boss) R.bosses++;
  R.bestRoomScore[lvl.room] = Math.max(R.bestRoomScore[lvl.room] || 0, score);
  S.gold += earned; save();

  const showStory = () => renderStory(lvl, g, earned, first);
  const comicId = lvl.boss ? 'act' + lvl.act : null;
  if (comicId && !S.seenComics.includes(comicId)) playComic(comicId, showStory);
  else showStory();
}

function foundHtml(g) {
  if (!g.found.length) return '';
  return '<div class="found">' + g.found.map(f => `<div>${f.dup ? '' : '★ '}${f.text}</div>`).join('') + '</div>';
}

function renderStory(lvl, g, earned, first) {
  game = null;
  startDemo();
  const st = storyAfter(lvl.room, g.met || new Set(), new Set(S.seenLore));
  if (st.key && !S.seenLore.includes(st.key)) { S.seenLore.push(st.key); save(); }
  const how = lvl.special ? '' : ' · ' + (EXITS[lvl.exit]?.phrase || 'через дверь');
  $('#story-room').textContent = lvl.room < ROOMS_TOTAL ? `Комната ${lvl.room} → ${lvl.room + 1}${how}` : `Комната ${ROOMS_TOTAL}`;
  $('#story-label').textContent = st.label;
  const tx = $('#story-text');
  tx.textContent = st.kind === 'house' ? st.text : `«${st.text}»`;
  tx.className = 'story-text' + (st.kind === 'house' ? ' house' : '');
  $('#story-gain').innerHTML = `Оболы: <b>+${earned}</b>${first ? ' (первое прохождение)' : ''} · счёт <b>${g.score}</b>` + foundHtml(g);
  const next = lvl.room + 1;
  $('#btn-next').textContent = next <= ROOMS_TOTAL ? `Комната ${next}` : S.settings.endless ? 'Коридор Вечного Сквозняка' : 'В меню';
  $('#btn-next').onclick = () => { sfx.click(); next <= ROOMS_TOTAL ? startRoom(next) : S.settings.endless ? startEndless() : (startDemo(), show('menu')); };
  show('story');
}

// ---------- поместье ----------
function renderLevels() {
  const R = S.records, D = DIFFICULTY[diff()];
  const next = Math.min(ROOMS_TOTAL, S.progress.maxRoom + 1);
  $('#records').innerHTML = `Сложность: <b>${D.name}</b> · пройдено комнат: <b>${S.progress.maxRoom}</b> / ${ROOMS_TOTAL}<br>` +
    `Рекорд сквозняка: <b>${R.endless[diff()] || 0}</b> · дальше всех: <b>${R.endlessMeters || 0} м</b> · хранителей: <b>${R.bosses}</b>`;
  $('#btn-endless').innerHTML = `Коридор Вечного Сквозняка<span class="sub">бесконечный забег</span>`;
  $('#btn-endless').onclick = () => { sfx.click(); startEndless(); };
  $('#btn-continue').innerHTML = `${S.progress.maxRoom ? 'Продолжить' : 'Начать'}: комната ${next}<span class="sub">${ACTS[Math.floor((next - 1) / 100)].title}</span>`;
  $('#btn-continue').onclick = () => { sfx.click(); startRoom(next); };

  // что берём в забег
  const lo = $('#loadout');
  lo.innerHTML = '';
  const label = document.createElement('span');
  label.textContent = S.equipped.length ? 'В забег:' : 'Артефактов в забеге нет';
  lo.appendChild(label);
  S.equipped.forEach(id => lo.appendChild(iconCanvas(BY_ID[id], 28)));
  lo.onclick = () => { sfx.click(); show('artifacts'); };

  // вкладки актов
  viewAct = Math.min(viewAct, Math.floor((next - 1) / 100) + 1);
  const tabs = $('#act-tabs');
  tabs.innerHTML = '';
  ACTS.forEach(a => {
    const b = document.createElement('button');
    b.className = 'tab' + (a.n === viewAct ? ' on' : '');
    b.textContent = 'Акт ' + ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][a.n - 1];
    b.disabled = (a.n - 1) * 100 + 1 > next;
    b.onclick = () => { sfx.click(); viewAct = a.n; renderLevels(); };
    tabs.appendChild(b);
  });
  $('#act-title').textContent = ACTS[viewAct - 1].title;
  const grid = $('#room-grid');
  grid.innerHTML = '';
  for (let r = (viewAct - 1) * 100 + 1; r <= viewAct * 100; r++) {
    const b = document.createElement('button');
    const done = r <= S.progress.maxRoom;
    b.className = 'room' + (done ? ' done' : '') + (r === next && !done ? ' next' : '') + (r % 100 === 0 ? ' boss' : '');
    b.textContent = r % 100 === 0 ? '☠' : r;
    b.disabled = r > next;
    b.onclick = () => { sfx.click(); startRoom(r); };
    grid.appendChild(b);
  }
}

// ---------- опись: бестиарий и артефакты ----------
function renderOpis() {
  const tabs = $('#opis-tabs');
  tabs.innerHTML = '';
  [['beasts', 'Бестиарий'], ['art', 'Артефакты']].forEach(([k, nm]) => {
    const b = document.createElement('button');
    b.className = 'tab' + (opisTab === k ? ' on' : '');
    b.textContent = nm;
    b.onclick = () => { sfx.click(); opisTab = k; renderOpis(); };
    tabs.appendChild(b);
  });
  $('#opis-beasts').classList.toggle('hidden', opisTab !== 'beasts');
  $('#opis-art').classList.toggle('hidden', opisTab !== 'art');
  if (opisTab === 'beasts') renderBeasts(); else renderArtifacts();
}

// Маленький портрет монстра: рисуем его той же функцией, что и в игре.
const MOCK = { t: 1.3, speed: 420, shake: 0, enemySpeed: 1, puff() {}, drawPips() {} };
function beastCanvas(type, known) {
  const c = document.createElement('canvas');
  c.width = 360; c.height = 300;
  const x = c.getContext('2d');
  const d = ENEMY[type];
  const w = d.w || 200, h = d.h || 120;
  const o = { id: 3, type, x: 0, w, h, dead: 0, hp: d.hp || 0, flash: 0, rise: 1, fall: 1, open: 1, hop: 0, y: GROUND_Y - 150 };
  const viewTop = GROUND_Y - 380;
  const k = Math.min(300 / (w + 80), 300 / 400);
  x.save();
  x.translate((360 - w * k) / 2, 0); x.scale(k, k); x.translate(0, -viewTop);
  try {
    if (type === 'pit') drawPit(x, 0, 200, makeRng(3));
    else if (type === 'trapdoor') drawTrapdoor(x, o, 0, makeRng(3));
    else if (type === 'furniture' && images.furniture) x.drawImage(images.furniture, 0, GROUND_Y - h, w, h);
    else d.draw?.(x, o, 0, MOCK, 1.3, () => makeRng(3));
  } catch (e) { /* какой-то рисунок не подошёл для превью — не страшно */ }
  x.restore();
  if (!known) { x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#0b0908'; x.fillRect(0, 0, 360, 300); }
  return c;
}

function renderBeasts() {
  const box = $('#opis-beasts');
  box.innerHTML = '';
  const types = Object.keys(ENEMY).sort((a, b) => ENEMY[a].unlock - ENEMY[b].unlock);
  const met = types.filter(t => S.bestiary[t]);
  const head = document.createElement('div');
  head.className = 'records';
  head.innerHTML = `Встречено: <b>${met.length}</b> / ${types.length}. Сведения о монстре открываются постепенно — чем дальше проходишь комнаты и чем чаще его встречаешь.`;
  box.appendChild(head);
  for (const t of types) {
    const rec = S.bestiary[t], d = ENEMY[t];
    const card = document.createElement('div');
    card.className = 'beast' + (rec ? '' : ' unknown');
    card.appendChild(beastCanvas(t, !!rec));
    const info = document.createElement('div');
    info.className = 'info';
    if (!rec) {
      info.innerHTML = `<div class="nm">???</div><div class="lock">Ещё не встречен</div>`;
    } else {
      const k = knowledge(rec, S.progress.maxRoom);
      const [desc, secret] = BEAST_TEXT[t] || ['', ''];
      let html = `<div class="nm">${d.name}</div><div class="how">${kickText(d.hint)}</div><div class="lock">впервые: комната ${rec.first} · встреч: ${rec.runs} · убито: ${rec.kills}</div>`;
      html += k >= KNOW_DESC ? `<div class="tx">${desc}</div>` : `<div class="lock">Описание откроется через ${KNOW_DESC - k} комн.</div>`;
      if (k >= KNOW_DESC) html += k >= KNOW_SECRET ? `<div class="sec">Тайна: ${secret}</div>` : `<div class="lock">Тайна откроется через ${KNOW_SECRET - k} комн.</div>`;
      info.innerHTML = html;
    }
    card.appendChild(info);
    box.appendChild(card);
  }
}

// ---------- артефакты ----------
function renderArtifacts() {
  const slots = slotCount(S.inventory);
  S.equipped = S.equipped.filter(id => S.inventory.includes(id) && !BY_ID[id]?.passive).slice(0, slots);
  $('#art-count').innerHTML = `Найдено: <b>${S.inventory.length}</b> / ${ARTIFACTS.length} · мест в забеге: <b>${slots}</b>`;
  const sl = $('#slots');
  sl.innerHTML = '';
  for (let i = 0; i < slots; i++) {
    const d = document.createElement('div');
    d.className = 'slot';
    const id = S.equipped[i];
    if (id) {
      d.appendChild(iconCanvas(BY_ID[id], 44));
      d.onclick = () => { sfx.click(); artSelected = id; renderArtifacts(); };
    }
    sl.appendChild(d);
  }
  // карточка выбранного
  const det = $('#art-detail');
  const a = artSelected && BY_ID[artSelected];
  det.classList.toggle('hidden', !a);
  if (a) {
    const on = S.equipped.includes(a.id);
    det.innerHTML = '';
    det.appendChild(iconCanvas(a, 50));
    det.insertAdjacentHTML('beforeend', `<div class="nm">${a.name}</div><div class="rr" style="color:${a.cursed ? '#7a1d1b' : '#2a2522'}">${a.cursed ? 'проклятый · ' : ''}${a.rarity.name}</div><div class="ds">${a.desc}</div>`);
    const b = document.createElement('button');
    b.className = 'btn';
    if (a.passive) { b.textContent = 'Действует всегда'; b.disabled = true; }
    else if (on) b.textContent = 'Снять';
    else if (S.equipped.length >= slots) { b.textContent = 'Все места заняты'; b.disabled = true; }
    else b.textContent = 'Взять в забег';
    b.onclick = () => {
      sfx.click();
      if (on) S.equipped = S.equipped.filter(x => x !== a.id); else S.equipped.push(a.id);
      save(); renderArtifacts();
    };
    det.appendChild(b);
  }
  // фильтр
  const tabs = $('#art-tabs');
  tabs.innerHTML = '';
  [['all', 'Все'], ['good', 'Полезные'], ['cursed', 'Проклятые'], ['mine', 'Мои']].forEach(([k, nm]) => {
    const b = document.createElement('button');
    b.className = 'tab' + (artFilter === k ? ' on' : '');
    b.textContent = nm;
    b.onclick = () => { sfx.click(); artFilter = k; renderArtifacts(); };
    tabs.appendChild(b);
  });
  const grid = $('#art-grid');
  grid.innerHTML = '';
  for (const x of ARTIFACTS) {
    const owned = S.inventory.includes(x.id);
    if (artFilter === 'good' && x.cursed) continue;
    if (artFilter === 'cursed' && !x.cursed) continue;
    if (artFilter === 'mine' && !owned) continue;
    const c = document.createElement('div');
    c.className = 'art-cell' + (S.equipped.includes(x.id) ? ' on' : '');
    if (owned) {
      c.appendChild(iconCanvas(x, 44));
      c.onclick = () => { sfx.click(); artSelected = x.id; renderArtifacts(); $('#artifacts').scrollTop = 0; };
    } else c.textContent = '?';
    grid.appendChild(c);
  }
}

// ---------- лавка ----------
function shopSeed() { return Math.floor(S.records.roomsCleared / ECONOMY.shopRotateRooms) * 31 + S.shop.shift * 7 + 1; }

function renderShop() {
  const tabs = $('#shop-tabs');
  tabs.innerHTML = '';
  [['chars', 'Персонажи'], ['upg', 'Прокачка'], ['art', 'Артефакты'], ['skins', 'Облики']].forEach(([k, nm]) => {
    const b = document.createElement('button');
    b.className = 'tab' + (shopTab === k ? ' on' : '');
    b.textContent = nm;
    b.onclick = () => { sfx.click(); shopTab = k; renderShop(); };
    tabs.appendChild(b);
  });
  $('#shop-art').classList.toggle('hidden', shopTab !== 'art');
  $('#shop-reroll').classList.toggle('hidden', shopTab !== 'art');
  $('#skin-list').classList.toggle('hidden', shopTab !== 'skins');
  $('#char-shop').classList.toggle('hidden', shopTab !== 'chars');
  $('#upg-shop').classList.toggle('hidden', shopTab !== 'upg');
  if (shopTab === 'art') renderShopArt(); else if (shopTab === 'chars') renderChars(); else if (shopTab === 'upg') renderUpgrades(); else renderSkins();
}

// ---------- прокачка ----------
function upgradeLevels() {
  const U = S.upgrades || {};
  return { magnet: U.magnet || 0, wings: U.wings || 0, double: U.double || 0, cloak: U.cloak || 0, fame: U.fame || 0, weapon: U.weapon || 0, hero: (U.hero || {})[S.char] || 0 };
}
function renderUpgrades() {
  const box = $('#upg-shop');
  box.innerHTML = '';
  const lv = upgradeLevels();
  for (const u of UPGRADES) {
    const l = lv[u.id], max = l >= UPGRADE_PRICES.length, price = UPGRADE_PRICES[l];
    const d = document.createElement('div');
    d.className = 'upg';
    const who = u.perChar ? ` · ${currentChar().name}` : '';
    d.innerHTML = `<div class="ico">${u.ico}</div><div class="txt"><div class="nm">${u.name}${who}</div>` +
      `<div class="pips">${UPGRADE_PRICES.map((_, i) => `<span class="${i < l ? 'on' : ''}"></span>`).join('')}</div>` +
      `<div class="ds">${l ? 'Сейчас: ' + u.desc(l) : 'Не прокачано'}</div>` + (max ? '' : `<div class="ds next">Дальше: ${u.desc(l + 1)}</div>`) + `</div>`;
    const b = document.createElement('button');
    b.className = 'btn';
    b.textContent = max ? 'Максимум' : `Улучшить · ${price}`;
    b.disabled = max || S.gold < price;
    b.onclick = () => {
      if (max || S.gold < price) return;
      S.gold -= price;
      if (u.perChar) { S.upgrades.hero ||= {}; S.upgrades.hero[S.char] = l + 1; } else S.upgrades[u.id] = l + 1;
      save(); sfx.coin(); renderUpgrades(); updateWallet();
    };
    d.appendChild(b);
    box.appendChild(d);
  }
  // оберег — расходуемая вторая жизнь
  const ch = document.createElement('div');
  ch.className = 'upg';
  const CP = 600;
  ch.innerHTML = `<div class="ico">🕯️</div><div class="txt"><div class="nm">Оберег · есть ${S.charms || 0}</div><div class="ds">Сгорает, когда ты должен стать портретом, — и ты бежишь дальше. Тратится сам.</div></div>`;
  const cb = document.createElement('button'); cb.className = 'btn'; cb.textContent = `Купить · ${CP}`; cb.disabled = S.gold < CP;
  cb.onclick = () => { if (S.gold < CP) return; S.gold -= CP; S.charms = (S.charms || 0) + 1; save(); sfx.coin(); renderUpgrades(); updateWallet(); };
  ch.appendChild(cb); box.appendChild(ch);
  box.insertAdjacentHTML('beforeend', '<div class="records">Персонаж прокачивается у каждого свой: выбери другого в «Персонажах», чтобы прокачать его.</div>');
}

function renderShopArt() {
  const box = $('#shop-art');
  box.innerHTML = '';
  const offers = shopOffers(shopSeed(), ECONOMY.shopSize, S.inventory);
  if (!offers.length) box.innerHTML = '<div class="records">Прилавок пуст. Загляни после пары комнат.</div>';
  for (const a of offers) {
    const d = document.createElement('div');
    d.className = 'offer' + (a.cursed ? ' cursed' : '');
    d.appendChild(iconCanvas(a, 50));
    d.insertAdjacentHTML('beforeend', `<div class="nm">${a.name}</div><div class="ds">${a.desc}</div>`);
    const b = document.createElement('button');
    b.className = 'btn';
    b.textContent = `Купить · ${a.price}`;
    b.disabled = S.gold < a.price;
    b.onclick = () => {
      if (S.gold < a.price) return;
      sfx.coin();
      S.gold -= a.price; S.inventory.push(a.id); save();
      renderShop(); updateWallet();
    };
    d.appendChild(b);
    box.appendChild(d);
  }
  const rr = $('#shop-reroll');
  rr.textContent = `Другой товар · ${ECONOMY.shopRerollPrice}`;
  rr.disabled = S.gold < ECONOMY.shopRerollPrice;
  rr.onclick = () => {
    if (S.gold < ECONOMY.shopRerollPrice) return;
    sfx.click();
    S.gold -= ECONOMY.shopRerollPrice; S.shop.shift++; save();
    renderShop(); updateWallet();
  };
}

// Портрет персонажа на обоях (как превью в лавке).
function charCanvas(ch, w, h, scale) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const cx = c.getContext('2d');
  const st = w / 6;
  for (let i = 0; i < 6; i++) { cx.fillStyle = i % 2 ? '#cbbd9f' : '#e4d8c0'; cx.fillRect(i * st, 0, st, h); }
  cx.fillStyle = '#776a5b'; cx.fillRect(0, h * 0.86, w, h * 0.14);
  const skin = lookOf(ch);
  cx.save(); cx.translate(w * 0.48, h * 0.9); cx.scale(scale * (skin.sx || 1), scale * (skin.sy || 1));
  if (rigReady()) drawRigHero(cx, 0, 0, 'idle', 0, skin);
  cx.restore();
  return c;
}

function renderChars() {
  const box = $('#char-shop');
  box.innerHTML = '';
  const sel = CHAR_BY_ID[charSel] || currentChar();
  charSel = sel.id;
  const owned = S.ownedChars.includes(sel.id), chosen = S.char === sel.id;
  // большая карточка выбранного
  const top = document.createElement('div');
  top.className = 'char-top';
  top.appendChild(charCanvas(sel, 300, 340, 1.55));
  const info = document.createElement('div');
  info.className = 'char-info';
  info.innerHTML = `<div class="nm">${sel.name}</div><div class="role">${sel.role}</div><div class="ds">${sel.desc}</div>` +
    `<ul class="perks">${sel.perks.map(x => `<li>${x}</li>`).join('')}</ul>`;
  const b = document.createElement('button');
  b.className = 'btn';
  if (chosen) { b.textContent = 'Выбран'; b.disabled = true; }
  else if (owned) b.textContent = 'Играть им';
  else { b.textContent = `Нанять · ${sel.price}`; b.disabled = S.gold < sel.price; }
  b.onclick = () => {
    if (!owned) { if (S.gold < sel.price) return; S.gold -= sel.price; S.ownedChars.push(sel.id); sfx.coin(); }
    else sfx.click();
    S.char = sel.id; save();
    if (demo) startDemo();
    renderChars(); updateWallet();
  };
  info.appendChild(b);
  top.appendChild(info);
  box.appendChild(top);
  // сетка всех персонажей
  const grid = document.createElement('div');
  grid.className = 'char-grid';
  for (const ch of CHARACTERS) {
    const d = document.createElement('div');
    d.className = 'char-cell' + (ch.id === sel.id ? ' on' : '') + (S.char === ch.id ? ' chosen' : '');
    d.appendChild(charCanvas(ch, 150, 170, 0.78));
    const has = S.ownedChars.includes(ch.id);
    d.insertAdjacentHTML('beforeend', `<div class="cn">${ch.name}</div><div class="cp">${S.char === ch.id ? '✓ выбран' : has ? 'нанят' : ch.price + ' обол.'}</div>`);
    d.onclick = () => { sfx.click(); charSel = ch.id; renderChars(); $('#shop').scrollTop = 0; };
    grid.appendChild(d);
  }
  box.appendChild(grid);
}

function renderSkins() {
  const list = $('#skin-list');
  list.innerHTML = currentChar().id === 'flit' ? '' : '<div class="records">Облики — наряды Флита Вейна. Выбери его в «Персонажах», чтобы переодеть.</div>';
  for (const s of SKINS) {
    const owned = S.ownedSkins.includes(s.id);
    const equipped = S.skin === s.id;
    const card = document.createElement('div');
    card.className = 'skin' + (equipped ? ' equipped' : '');
    const c = document.createElement('canvas');
    c.width = 220; c.height = 230;
    const cx = c.getContext('2d');
    for (let x = 0; x < 220; x += 36) { cx.fillStyle = (x / 36) % 2 ? '#cbbd9f' : '#e4d8c0'; cx.fillRect(x, 0, 36, 230); }
    cx.fillStyle = '#776a5b'; cx.fillRect(0, 200, 220, 30);
    cx.save(); cx.translate(106, 208); cx.scale(0.98, 0.98);
    if (rigReady()) drawRigHero(cx, 0, 0, 'idle', 0, s);
    else drawHero(cx, 0, 0, 'idle', 0, s, makeRng(3));
    cx.restore();
    card.appendChild(c);
    card.insertAdjacentHTML('beforeend', `<div class="name">${s.name}</div>`);
    const b = document.createElement('button');
    b.className = 'btn';
    if (equipped) { b.textContent = 'Надето'; b.disabled = true; }
    else if (owned) b.textContent = 'Надеть';
    else { b.textContent = `Купить · ${s.price}`; b.disabled = S.gold < s.price; }
    b.onclick = () => {
      sfx.click();
      if (!owned) { if (S.gold < s.price) return; S.gold -= s.price; S.ownedSkins.push(s.id); sfx.coin(); }
      S.skin = s.id; save();
      if (demo) demo.skin = s;
      renderShop(); updateWallet();
    };
    card.appendChild(b);
    list.appendChild(card);
  }
}

// ---------- настройки ----------
const DIFF_DESC = {
  easy: 'Медленнее, больше места между препятствиями, подсказки всегда. Оболы ×1.',
  normal: 'Как задумано. Оболы ×1.15.',
  hard: 'Быстрее, теснее, чаще сдвоенные препятствия. Оболы ×1.35.',
  nightmare: 'Одно сердце. Всё быстрее и злее. Оболы ×1.7, артефакты находятся чаще.',
};
// стрелки и слова в подсказках, если пинок перенесён на свайп вправо
function kickText(t) {
  if (S.settings.kickSide !== 'right' || is3d() || !t) return t;
  return t.replace(/←|→|влево|вправо/g, (m) => ({ '←': '→', '→': '←', 'влево': 'вправо', 'вправо': 'влево' })[m]);
}
window.__kickText = kickText;

function renderControls() {
  const k = S.settings.kickSide === 'right';
  const rows = is3d()
    ? [['⇆', 'дорожка', 'обойти что угодно'], ['↑', 'прыжок', 'ямы, люки, крысы, руки из пола, шипы'], ['↓', 'подкат', 'вороны, паук, портреты, взгляд Ока'],
      ['👢', 'пинок', 'кнопка: шкафы, часы, доспехи, тень со щитом'], ['💨', 'рывок', 'кнопка: призрак, решётка, туман'], ['☝', 'тап', 'выстрел в тени и марионеток'], ['👁', 'Око', 'пауза']]
    : [['↑', 'прыжок', 'ямы, люки, крысы, руки из пола, низкие вороны, шипы'], ['↓', 'подкат', 'вороны, паук, портреты, взгляд Ока'],
      [k ? '→' : '←', 'пинок', 'шкафы, часы, доспехи, тень со щитом'], [k ? '←' : '→', 'рывок', 'призрачная решётка, призрак, туман'],
      ['☝', 'тап', 'выстрел в тени и марионеток'], ['👁', 'глаз', 'пауза']];
  $('#controls-list').innerHTML = rows.map(([g, a, w]) => `<div class="ctl"><span class="g">${g}</span><span class="a">${a}</span><span class="w">${w}</span></div>`).join('');
}

function renderSettings() {
  const st = S.settings;
  const v3 = st.view === '3d';
  const seg = (id, val) => $$(`#${id} button`).forEach(b => b.classList.toggle('on', b.dataset.v === val));
  seg('seg-view', v3 ? '3d' : 'classic');
  seg('seg-diff', diff());
  seg('seg-kick', st.kickSide === 'right' ? 'right' : 'left');
  seg('seg-endless', st.endless ? 'on' : 'off');
  $('#view-desc').textContent = v3 ? 'Вид сзади, три дорожки, Флит объёмный.' : 'Вид сбоку, как в рисунках.';
  $('#diff-desc').textContent = DIFF_DESC[diff()];
  $('#kick-desc').textContent = v3
    ? (st.kickSide === 'right' ? 'В 3D-забеге кнопка «Пинок» справа внизу, «Рывок» — слева.' : 'В 3D-забеге кнопка «Пинок» слева внизу, «Рывок» — справа.')
    : (st.kickSide === 'right' ? 'Свайп вправо — пинок, свайп влево — рывок.' : 'Свайп влево — пинок, свайп вправо — рывок.');
  $('#set-sound').classList.toggle('on', !!st.sound);
  $('#set-vibration').classList.toggle('on', !!st.vibration);
  $('#set-paper').classList.toggle('on', !!st.paper);
  $('#set-signs').classList.toggle('on', !!st.signs);
  renderControls();
  applyEndless();
}
// бесконечный режим можно спрятать: тогда игра — только сюжет
function applyEndless() {
  const on = !!S.settings.endless;
  $('#lobby-endless')?.classList.toggle('hidden', !on);
  $('#btn-endless')?.classList.toggle('hidden', !on);
}
function toggleSetting(key) {
  S.settings[key] = !S.settings[key];
  save();
  setSoundEnabled(S.settings.sound);
  if (demo) demo.opts.paperFx = S.settings.paper;
  sfx.click();
  renderSettings();
}
const onSeg = (id, fn) => $$(`#${id} button`).forEach(b => b.onclick = () => { sfx.click(); fn(b.dataset.v); save(); renderSettings(); });
onSeg('seg-view', (v) => { if (S.settings.view === v) return; S.settings.view = v; save(); applyView(); startDemo(); });
onSeg('seg-diff', (v) => { S.settings.difficulty = v; });
onSeg('seg-kick', (v) => { S.settings.kickSide = v; });
onSeg('seg-endless', (v) => { S.settings.endless = v === 'on'; });
$('#set-sound').onclick = () => toggleSetting('sound');
$('#set-vibration').onclick = () => toggleSetting('vibration');
$('#set-paper').onclick = () => toggleSetting('paper');
$('#set-signs').onclick = () => toggleSetting('signs');
applyEndless();
let resetArmed = false;
$('#set-reset').onclick = () => {
  const b = $('#set-reset');
  if (!resetArmed) {
    resetArmed = true;
    b.textContent = 'Точно? Нажми ещё раз';
    setTimeout(() => { resetArmed = false; b.textContent = 'Сбросить прогресс'; }, 3000);
    return;
  }
  resetArmed = false;
  S = resetSave();
  setSoundEnabled(S.settings.sound);
  b.textContent = 'Прогресс сброшен';
  renderSettings();
};

$$('[data-go]').forEach(b => b.addEventListener('click', (e) => {
  if (is3d() && b.dataset.go === 'levels' && b.closest('#menu')) { e.stopPropagation(); toLobby(); return; }
  sfx.click(); show(b.dataset.go);
}));

// ---------- пауза ----------
function pause() {
  if (!game || game.status !== 'running' || paused) return;
  paused = true;
  sfx.click();
  show('pause');
}
function resume() { paused = false; show(null); }
$('#btn-resume').onclick = () => { sfx.click(); resume(); };
$$('.btn-restart').forEach(b => b.onclick = () => { sfx.click(); currentLevel.kind === 'room' ? startRoom(currentLevel.room) : startEndless(); });
$$('.btn-tomenu').forEach(b => b.onclick = () => { sfx.click(); startDemo(); show('menu'); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ---------- управление ----------
setupInput(cvs, (a, e) => {
  unlockAudio();
  const r = cvs.getBoundingClientRect();
  const x = e ? (e.clientX - r.left) * L.SW / r.width : 0, y = e ? (e.clientY - r.top) * L.SH / r.height : 0;
  if (comic) { if (a !== 'pause') comic.tap(x, y); return; }
  if (mini) { if (a === 'shoot') mini.tap(x, y); else if (e && a !== 'pause') mini.swipe?.(x, y, a); return; }
  if (a === 'pause') { paused ? resume() : pause(); return; }
  if (a === 'shoot' && e && (game?.hitEye ? game.hitEye(x, y) : hud && hud.hitEye(x, y))) { pause(); return; }
  if (!is3d() && S.settings.kickSide === 'right') a = a === 'kick' ? 'right' : a === 'right' ? 'kick' : a;   // пинок — свайпом вправо
  if (game && !paused) game.action(a);
});
document.addEventListener('pointerdown', unlockAudio, { once: true });
// кнопки пинка и рывка (3D): нажатие не уходит в свайпы
for (const [id, a] of [['#act-kick', 'smash'], ['#act-dash', 'dash']]) {
  $(id).addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation(); unlockAudio();
    if (game && !paused && !comic && !mini) game.action(a);
  });
}
function syncActButtons() {
  const on = is3d() && world && game && !game.opts.demo && game.status === 'running' && !paused && !comic && !mini;
  const el = $('#act-btns');
  if (el.classList.contains('hidden') === on) el.classList.toggle('hidden', !on);
  const side = S.settings.kickSide === 'right' ? 'kick-right' : 'kick-left';
  if (!el.classList.contains(side)) { el.classList.remove('kick-left', 'kick-right'); el.classList.add(side); }
  if (on) { $('#act-dash').classList.toggle('cd', (game.p.dashCd || 0) > 0); $('#act-kick').classList.toggle('cd', (game.p.kickT || 0) > 0); }
}

// ---------- цикл ----------
let last = performance.now();
let time = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  const k = cvs.width / L.SW;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  const use3d = is3d() && world && !comic && !mini;
  const disp = use3d ? 'block' : 'none';
  if (glCanvas.style.display !== disp) glCanvas.style.display = disp;
  if (use3d) {
    // 3D: мир на весь экран, поверх — только сердца, Око, оболы и подсказки
    ctx.clearRect(0, 0, L.SW, L.SH);
    if (game && !paused) game.update(dt);
    world.frame(paused ? 0 : dt);
    if (game?.drawOverlay) game.drawOverlay(ctx, L, time, paused ? 0 : dt, cvs.getBoundingClientRect());
    syncActButtons();
    requestAnimationFrame(frame);
    return;
  }
  if (!$('#act-btns').classList.contains('hidden')) $('#act-btns').classList.add('hidden');
  ctx.fillStyle = '#050404';
  ctx.fillRect(0, 0, L.SW, L.SH);
  if (comic) {
    comic.draw(ctx, time, dt);
  } else if (mini && (mini.update(dt), mini)) {   // update может завершить игру и обнулить mini
    if (mini.useFrame) {
      ctx.save();
      ctx.beginPath(); ctx.rect(L.win.x, L.win.y, L.win.w, L.win.h); ctx.clip();
      ctx.translate(L.win.x, L.win.y); ctx.scale(L.win.s, L.win.s);
      mini.drawWorld(ctx);
      ctx.restore();
      ctx.drawImage(frameImg, 0, 0, L.SW, L.SH);
    }
    mini.drawUI(ctx, L);
  } else {
    const g = game || demo;
    if (g) {
      if (!(game && paused)) g.update(dt);
      ctx.save();
      if (L.framed) { ctx.beginPath(); ctx.rect(L.win.x, L.win.y, L.win.w, L.win.h); }
      else windowPath(ctx, L.win);
      ctx.clip();
      ctx.translate(L.win.x, L.win.y);
      ctx.scale(L.win.s, L.win.s);
      g.draw(ctx);
      ctx.restore();
    }
    ctx.drawImage(frameImg, 0, 0, L.SW, L.SH);
    if (game) hud.draw(ctx, game, time, paused ? 0 : dt);
  }
  requestAnimationFrame(frame);
}

// ---------- старт ----------
setSoundEnabled(S.settings.sound);
Promise.all([loadImages(), loadHeroRig(), loadDemon()]).then(() => resize()).then(() => document.fonts?.load('bold 40px "Amatic SC"', 'АБВ abc 0123')).then(() => {
  startDemo();
  show('menu');
  requestAnimationFrame(frame);
});

// для отладки из консоли
window.__dsr = {
  get game() { return game; }, get world() { return world; }, toLobby, enterLobby, get comic() { return comic; }, get mini() { return mini; }, get save() { return S; }, startMini,
  startRoom, startEndless, startRun, playComic, roomLevel, endlessLevel, computeMods,
};
