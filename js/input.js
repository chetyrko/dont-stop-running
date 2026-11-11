// Управление: свайпы и тапы (палец или мышь) + клавиатура для теста на ПК.
// Свайп срабатывает сразу, как только палец прошёл порог — без ожидания отпускания.

const SWIPE_DIST = 34;   // px на экране
const TAP_TIME = 260;    // мс

export function setupInput(el, onAction) {
  let start = null;

  el.addEventListener('pointerdown', (e) => {
    start = { x: e.clientX, y: e.clientY, t: performance.now(), fired: false, id: e.pointerId };
  });

  el.addEventListener('pointermove', (e) => {
    if (!start || start.fired || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (Math.hypot(dx, dy) < SWIPE_DIST) return;
    start.fired = true;
    const from = { clientX: start.x, clientY: start.y };
    if (Math.abs(dy) > Math.abs(dx)) onAction(dy < 0 ? 'jump' : 'slide', from);
    else onAction(dx < 0 ? 'kick' : 'right', from);
  });

  const end = (e) => {
    if (!start || e.pointerId !== start.id) return;
    if (!start.fired && performance.now() - start.t < TAP_TIME) onAction('shoot', e);
    start = null;
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', () => { start = null; });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const map = {
      ArrowUp: 'jump', KeyW: 'jump',
      ArrowDown: 'slide', KeyS: 'slide',
      ArrowLeft: 'kick', KeyA: 'kick',
      Space: 'shoot', KeyF: 'shoot',
      Escape: 'pause', KeyP: 'pause',
    };
    const a = map[e.code];
    if (a) { e.preventDefault(); onAction(a); }
  });
}
