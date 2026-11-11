// Админ-панель для отладки. Открывается: адрес с ?admin, или 7 быстрых тапов по заголовку в меню.
// Всё делает через window.__dsr — ту же «ручку», что и автотесты.
const D = () => window.__dsr;
const $ = (s, r = document) => r.querySelector(s);

const CSS = `
#adm-btn { position: fixed; right: 8px; top: 50%; z-index: 9999; width: 42px; height: 42px; border-radius: 50%; border: 2px solid #f0d27c;
  background: rgba(20,14,10,0.85); color: #f0d27c; font: 22px sans-serif; }
#adm { position: fixed; right: 0; top: 0; bottom: 0; width: min(360px, 92vw); z-index: 9998; overflow-y: auto; touch-action: pan-y;
  background: rgba(14,10,8,0.95); color: #e8dcc4; font: 14px/1.3 system-ui, sans-serif; padding: 10px 12px 60px; box-shadow: -4px 0 18px #000; }
#adm.hidden { display: none; }
#adm h3 { margin: 14px 0 6px; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; color: #f0d27c; border-bottom: 1px solid #4a3e36; padding-bottom: 3px; }
#adm .row { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0; align-items: center; }
#adm button { background: #2a2420; color: #e8dcc4; border: 1px solid #6a5a4a; border-radius: 6px; padding: 6px 9px; font: inherit; }
#adm button.on { background: #e8dcc4; color: #16120f; }
#adm select, #adm input { background: #1d1814; color: #e8dcc4; border: 1px solid #6a5a4a; border-radius: 6px; padding: 5px; font: inherit; }
#adm input[type=number] { width: 80px; }
#adm input[type=range] { flex: 1; }
#adm .stat { font: 12px/1.35 monospace; white-space: pre; color: #b9e0a0; background: #0b0907; padding: 6px; border-radius: 6px; }
#adm .x { position: sticky; top: 0; float: right; }
`;

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'on') for (const [ev, f] of Object.entries(v)) e.addEventListener(ev, f); else if (k === 'class') e.className = v; else e.setAttribute(k, v); }
  for (const k of kids) e.append(k);
  return e;
}
const btn = (text, f, cls = '') => el('button', { class: cls, on: { click: (e) => { e.stopPropagation(); f(e.currentTarget); } } }, text);
const row = (...k) => el('div', { class: 'row' }, ...k);

export function openAdmin() {
  if ($('#adm')) { $('#adm').classList.toggle('hidden'); return; }
  document.head.append(el('style', {}, CSS));
  const d = D();
  const S = () => d.save;
  const persist = () => d.persist();
  const game = () => d.game;
  const panel = el('div', { id: 'adm' });
  // нажатия по панели не должны уходить в свайпы игры
  for (const ev of ['pointerdown', 'pointerup', 'click']) panel.addEventListener(ev, (e) => e.stopPropagation());
  const toggle = el('button', { id: 'adm-btn', on: { click: () => panel.classList.toggle('hidden') } }, '⚙');
  document.body.append(panel, toggle);

  panel.append(btn('✕', () => panel.classList.add('hidden'), 'x'), el('b', {}, 'Отладка'));

  // ---- состояние ----
  const stat = el('div', { class: 'stat' }, '…');
  panel.append(el('h3', {}, 'Сейчас'), stat);
  let fps = 0, frames = 0, last = performance.now();
  const loop = (now) => {
    frames++;
    if (now - last > 500) { fps = Math.round(frames * 1000 / (now - last)); frames = 0; last = now; }
    const g = game();
    if (g && d.god) { g.god = true; }
    if (!panel.classList.contains('hidden')) {
      const s = S();
      stat.textContent = `FPS ${fps}   оболы ${s.gold}   пройдено ${s.progress.maxRoom}\nперсонаж ${s.char}   вид ${s.settings.view}   ${s.settings.difficulty}` +
        (g ? `\nзабег: ${g.level?.kind} ${g.level?.room || ''} · ${g.status}\n${g.meters} м · скорость ${g.speed?.toFixed?.(1)} · сердца ${g.lives}\nобъектов ${g.objs?.length ?? g.obstacles?.length ?? '-'} · серия ×${g.mult ?? 1} · бонусы 🧲${(g.magnetT || 0).toFixed(0)} 🪶${(g.wingsT || 0).toFixed(0)} 🪙${(g.doubleT || 0).toFixed(0)} 👻${(g.cloakT || 0).toFixed(0)}` : '\nзабега нет');
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // ---- игрок ----
  const room = el('input', { type: 'number', value: '1', min: '1', max: '1000' });
  panel.append(el('h3', {}, 'Игрок'),
    row(btn('+1 000 оболов', () => { S().gold += 1000; persist(); d.updateWallet?.(); }), btn('+100 000', () => { S().gold += 100000; persist(); d.updateWallet?.(); }), btn('0', () => { S().gold = 0; persist(); d.updateWallet?.(); })),
    row(btn('Открыть всех персонажей и облики', () => { S().ownedChars = d.CHARACTERS.map(c => c.id); S().ownedSkins = d.SKINS.map(s => s.id); persist(); })),
    row(btn('Прокачка на максимум', () => { const u = S().upgrades; for (const k of ['magnet', 'wings', 'double', 'cloak', 'fame', 'weapon']) u[k] = 5; u.hero ||= {}; for (const c of d.CHARACTERS) u.hero[c.id] = 5; persist(); }),
      btn('Сбросить прокачку', () => { S().upgrades = { magnet: 0, wings: 0, double: 0, cloak: 0, fame: 0, weapon: 0, hero: {} }; persist(); })),
    row(btn('+5 оберегов', () => { S().charms = (S().charms || 0) + 5; persist(); })),
    row(el('span', {}, 'Пройдено комнат:'), room, btn('Задать', () => { S().progress.maxRoom = Math.max(0, Math.min(1000, +room.value || 0)); persist(); })),
    row(btn('Забыть комиксы и записки', () => { S().seenComics = []; S().seenLore = []; S().seenHints = []; persist(); }),
      btn('Сбросить всё сохранение', (b) => { if (b.dataset.armed) { d.resetSave(); location.reload(); } else { b.dataset.armed = 1; b.textContent = 'Точно? Ещё раз'; } })),
  );

  // ---- персонаж и модель ----
  const ch = el('select', {}, ...d.CHARACTERS.map(c => el('option', { value: c.id }, c.name)));
  ch.value = S().char;
  const sk = el('select', {}, ...d.SKINS.map(s => el('option', { value: s.id }, s.name)));
  sk.value = S().skin;
  const yaw = el('input', { type: 'range', min: '-3.14', max: '3.14', step: '0.05', value: '0' });
  const dist = el('input', { type: 'range', min: '1.5', max: '7', step: '0.1', value: '3.2' });
  const poses = ['run', 'jump', 'slide', 'idle', 'kick', 'warmup'];
  const poseBtns = poses.map(pz => btn({ run: 'бег', jump: 'прыжок', slide: 'подкат', idle: 'стойка', kick: 'пинок', warmup: 'разминка' }[pz], (b) => {
    d.world.viewPose = pz; poseBtns.forEach(x => x.classList.toggle('on', x === b));
  }));
  panel.append(el('h3', {}, 'Персонаж и 3D-модель'),
    row(ch, btn('Выбрать', () => { if (!S().ownedChars.includes(ch.value)) S().ownedChars.push(ch.value); S().char = ch.value; persist(); d.refreshHero(); })),
    row(sk, btn('Надеть (Флиту)', () => { if (!S().ownedSkins.includes(sk.value)) S().ownedSkins.push(sk.value); S().skin = sk.value; persist(); d.refreshHero(); })),
    row(btn('Смотреть модель', () => { if (!d.world) return; d.stopAll(); d.refreshHero(); d.world.setMode('viewer'); d.world.viewYaw = +yaw.value; d.world.viewDist = +dist.value; })),
    row(...poseBtns),
    row(el('span', {}, 'поворот'), el('span', {}, ''), yaw),
    row(el('span', {}, 'камера'), dist),
    row(btn('Крутить сам', (b) => { d.world.viewSpin = !d.world.viewSpin; b.classList.toggle('on', d.world.viewSpin); }), btn('В меню', () => d.toMenu())),
  );
  yaw.addEventListener('input', () => { if (d.world) d.world.viewYaw = +yaw.value; });
  dist.addEventListener('input', () => { if (d.world) d.world.viewDist = +dist.value; });

  // ---- забег ----
  const rn = el('input', { type: 'number', value: '1', min: '1', max: '1000' });
  const enemy = el('select', {}, ...Object.entries(d.ENEMY).map(([k, e]) => el('option', { value: k }, `${e.name} (${k})`)));
  const lane = el('select', {}, el('option', { value: '-1' }, 'слева'), el('option', { value: '0', selected: 'selected' }, 'по центру'), el('option', { value: '1' }, 'справа'));
  const ts = el('input', { type: 'range', min: '0.1', max: '2', step: '0.05', value: '1' });
  const tsv = el('span', {}, '×1');
  const godB = btn('Бессмертие', (b) => { d.god = !d.god; b.classList.toggle('on', d.god); if (game()) game().god = d.god; });
  panel.append(el('h3', {}, 'Забег'),
    row(btn('Бесконечный', () => d.startEndless()), rn, btn('Комната', () => d.startRoom(+rn.value || 1)), btn('Босс', () => d.startRoom(Math.max(100, Math.ceil((+rn.value || 1) / 100) * 100)))),
    row(godB, btn('+500 м', () => { const g = game(); if (!g) return; if (g.dist !== undefined && g.objs) { g.dist += 500; } else if (g.camX !== undefined) g.camX += 500 * 40; }),
      btn('К выходу', () => { const g = game(); if (!g) return; if (g.objs) { g.objs.length = 0; g.dist = Math.min(g.dist + 1e9, g.finish - 2); } else g.camX = g.finishX - 200; })),
    row(el('span', {}, 'время'), ts, tsv),
    row(enemy, lane, btn('Поставить', () => { const g = game(); if (g?.add) g.add(enemy.value, +lane.value, 3.6 + 22); })),
    row(btn('🧲', () => game()?.takeMagnet?.()), btn('🪶', () => game()?.takePower?.('wings')), btn('🪙', () => game()?.takePower?.('double')), btn('👻', () => game()?.takePower?.('cloak')), btn('+100 оболов в забеге', () => { const g = game(); if (g) g.coins += 100; })),
    row(btn('Удар', () => { const g = game(); if (!g) return; const gd = d.god; d.god = false; g.god = false; g.p.invuln = 0; g.hurt(); d.god = gd; }),
      btn('Смерть: руки', () => { const g = game(); if (!g) return; d.god = false; g.god = false; g.chase = 0; g.charms = 0; g.revives = 0; g.shield = 0; g.lives = 1; g.p.invuln = 0; g.hurt(); }),
      btn('Смерть: Тень', () => { const g = game(); if (!g) return; d.god = false; g.god = false; g.charms = 0; g.revives = 0; g.shield = 0; g.chase = 3; g.p.invuln = 0; g.hurt(); })),
  );
  ts.addEventListener('input', () => { window.__dsrTimeScale = +ts.value; tsv.textContent = '×' + (+ts.value).toFixed(2); });

  // ---- комиксы, мини-игры, вид ----
  panel.append(el('h3', {}, 'Комиксы и особые комнаты'),
    row(...Object.keys(d.COMICS).map(id => btn(id, () => d.playComic(id, () => d.toMenu())))),
    row(btn('Поиск предметов', () => d.startMini({ ...d.roomLevel(50, S().settings.difficulty), special: 'search' })),
      btn('Три в ряд', () => d.startMini({ ...d.roomLevel(7, S().settings.difficulty), special: 'match3' })),
      btn('Пятнашки', () => d.startMini({ ...d.roomLevel(8, S().settings.difficulty), special: 'puzzle' })),
      btn('Решить', () => d.mini?.autoSolve?.())),
    el('h3', {}, 'Вид'),
    row(btn('3D', () => d.setView('3d')), btn('Классика', () => d.setView('classic'))),
  );
}

// 7 быстрых тапов по заголовку меню — открыть панель (и запомнить)
export function armAdminGesture() {
  let n = 0, t0 = 0;
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest?.('.title')) return;
    const now = performance.now();
    n = now - t0 < 600 ? n + 1 : 1; t0 = now;
    if (n >= 7) { n = 0; try { localStorage.setItem('dsr-admin', '1'); } catch (_) { /* без хранилища — просто откроем */ } openAdmin(); }
  }, true);
}
