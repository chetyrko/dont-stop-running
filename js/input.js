// Управление: свайпы и тапы (палец или мышь) + клавиатура для теста на ПК.
// Свайп срабатывает сразу, как только палец прошёл порог — без ожидания отпускания.

const SWIPE_DIST = 22;   // px на экране — короткого движения достаточно
const TAP_TIME = 260;    // мс

export function setupInput(el, onAction) {
  let start = null;

  // слушаем весь экран (и поля вокруг сцены), кроме кнопок и открытых меню
  const own = (e) => !(e.target.closest && e.target.closest('button, .screen, #act-btns, a, input'));
  document.addEventListener('pointerdown', (e) => {
    if (!own(e)) return;
    start = { x: e.clientX, y: e.clientY, t: performance.now(), fired: false, id: e.pointerId };
  });

  // за одно касание можно сделать несколько свайпов подряд (влево-вверх-вправо…), не отрывая палец;
  // повтор в ту же сторону — только после смены направления, чтобы длинный свайп не сработал дважды
  const move = (e) => {
    if (!start || e.pointerId !== start.id) return;
    const pts = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const q of pts.length ? pts : [e]) {
      const dx = q.clientX - start.x, dy = q.clientY - start.y;
      if (Math.hypot(dx, dy) < SWIPE_DIST) continue;
      const a = Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? 'jump' : 'slide') : (dx < 0 ? 'kick' : 'right');
      const from = { clientX: start.x, clientY: start.y };
      start.x = q.clientX; start.y = q.clientY;
      if (a === start.last) continue;
      start.fired = true; start.last = a;
      onAction(a, from);
    }
  };
  document.addEventListener('pointermove', move);

  const end = (e) => {
    if (!start || e.pointerId !== start.id) return;
    if (!start.fired && performance.now() - start.t < TAP_TIME) onAction('shoot', e);
    start = null;
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', () => { start = null; });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const map = {
      ArrowUp: 'jump', KeyW: 'jump',
      ArrowDown: 'slide', KeyS: 'slide',
      ArrowLeft: 'kick', KeyA: 'kick',
      ArrowRight: 'right', KeyD: 'right',
      Space: 'shoot', KeyF: 'shoot',
      Escape: 'pause', KeyP: 'pause',
    };
    const a = map[e.code];
    if (a) { e.preventDefault(); onAction(a); }
  });
}
