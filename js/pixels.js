// Перекраска картинок по пикселям. Работает во всех браузерах
// (ctx.filter на телефонах поддерживается не везде).

// gray: 0..1 — насколько обесцветить; mul: [r, g, b] — множители цвета.
export function recolor(img, { gray = 0, mul = [1, 1, 1] } = {}) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  try {
    const d = ctx.getImageData(0, 0, c.width, c.height);
    const a = d.data;
    for (let i = 0; i < a.length; i += 4) {
      const l = 0.3 * a[i] + 0.59 * a[i + 1] + 0.11 * a[i + 2];
      a[i] = Math.min(255, (a[i] + (l - a[i]) * gray) * mul[0]);
      a[i + 1] = Math.min(255, (a[i + 1] + (l - a[i + 1]) * gray) * mul[1]);
      a[i + 2] = Math.min(255, (a[i + 2] + (l - a[i + 2]) * gray) * mul[2]);
    }
    ctx.putImageData(d, 0, 0);
  } catch (e) { /* нет доступа к пикселям — оставляем как есть */ }
  return c;
}
