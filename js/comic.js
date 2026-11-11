// Комиксы между актами: панели с жёлтыми плашками-подписями и репликами.
// Всё рисуется движком игры: фон — обои и пол автора, персонажи — герой и демоны из деталей.
// Тап — следующая панель. Кнопка «Пропустить» в правом верхнем углу.

import { GROUND_Y, FLOOR_TOP, HERO_SCALE } from './config.js?v=801243b';
import { drawRigHero, rigReady } from './rig.js?v=801243b';
import { drawDemon, demonReady } from './demon.js?v=801243b';
import { drawFinish } from './art.js?v=801243b';

// Страница — набор панелей сверху вниз. h — доля высоты страницы.
// scene: wall | door | black | eye | paper. actors: hero / demon / door / text.
export const COMICS = {
  prologue: [
    [
      { h: 0.5, scene: 'wall', actors: [{ hero: { x: 420, pose: 'idle' } }],
        caption: 'Флит Вейн, оценщик невозможной недвижимости, получил заказ: провести опись поместья «Паноптикум».' },
      { h: 0.5, scene: 'door', actors: [{ door: { x: 640, open: 1 } }, { hero: { x: 330, pose: 'run', t: 0.2 } }],
        caption: 'Хозяин — Архитектор — исчез двадцать лет назад. Говорили, он не строил комнаты. Он их крал.' },
    ],
    [
      { h: 0.36, scene: 'wall', actors: [{ hero: { x: 520, pose: 'idle', flip: true } }],
        caption: 'Дверь за спиной закрылась. А потом исчезла.', bubble: { text: '…Этого нет в описи.', x: 0.62, y: 0.3 } },
      { h: 0.3, scene: 'eye', caption: 'Око Дома', big: 'ГОСТЬ. ПОКА ТЫ ДВИЖЕШЬСЯ — ТЫ ГОСТЬ.' },
      { h: 0.34, scene: 'wall', actors: [{ hero: { x: 330, pose: 'run', t: 0.1 } }, { demon: { x: 760, h: 300 } }],
        caption: 'Остановишься — станешь портретом на стене. Беги, Флит.' },
    ],
  ],
  act1: [
    [
      { h: 0.5, scene: 'door', actors: [{ door: { x: 600, open: 0.2 } }, { hero: { x: 400, pose: 'kick' } }],
        caption: 'Хранитель пал. Парадная дверь. Засов. Ветер за ней.' },
      { h: 0.5, scene: 'wall', actors: [{ hero: { x: 480, pose: 'idle' } }],
        caption: 'За дверью — та же прихожая. Те же обои. За окнами — пустота.', bubble: { text: 'Нет. Нет-нет-нет.', x: 0.6, y: 0.28 } },
    ],
    [
      { h: 0.4, scene: 'eye', caption: 'Око Дома', big: 'ВЫХОД? ЗДЕСЬ ЕСТЬ ТОЛЬКО ДАЛЬШЕ.' },
      { h: 0.6, scene: 'paper', big: 'АКТ II\nИЗНАНКА БЫТА', caption: 'Стрелки часов пошли назад. Флит спускается туда, куда гостей не пускали.' },
    ],
  ],
  act2: [
    [
      { h: 0.5, scene: 'paper', big: 'Чертёж поместья\n«Паноптикум»\n\nподпись: Ф. Вейн', caption: 'Комната чертежей. Тысячи листов.' },
      { h: 0.5, scene: 'wall', actors: [{ hero: { x: 480, pose: 'idle', flip: true } }],
        caption: 'Почерк Архитектора — его собственный.', bubble: { text: 'Это… моя рука.', x: 0.62, y: 0.3 } },
    ],
    [
      { h: 0.4, scene: 'eye', caption: 'Око Дома', big: 'ТЕПЕРЬ ТЫ ЗНАЕШЬ, ЧЕЙ ЭТО ДОМ.' },
      { h: 0.6, scene: 'paper', big: 'АКТ III\nУКРАДЕННЫЕ ГОРОДА', caption: 'Геометрия ломается. Внутри комнат — целые улицы.' },
    ],
  ],
  act3: [
    [
      { h: 0.5, scene: 'wall', actors: [{ hero: { x: 300, pose: 'idle' } }, { demon: { x: 600, h: 260 } }, { demon: { x: 780, h: 300 } }],
        caption: 'Он вспомнил. Он и есть Архитектор. Он стёр себе память и спрятался в собственном доме.' },
      { h: 0.5, scene: 'wall', actors: [{ demon: { x: 300, h: 280 } }, { demon: { x: 520, h: 320 } }, { demon: { x: 740, h: 280 } }],
        caption: 'Тени никогда на него не охотились. Они пытались его остановить.' },
    ],
    [
      { h: 0.4, scene: 'black', big: 'тук.   тук.   тук.', caption: 'Снаружи кто-то стучит.' },
      { h: 0.6, scene: 'paper', big: 'АКТ IV\nАНАТОМИЯ БЕЗУМИЯ', caption: 'Око Дома начинает говорить с ним напрямую.' },
    ],
  ],
  act4: [
    [
      { h: 0.5, scene: 'door', actors: [{ door: { x: 560, open: 0, label: 'ВХОД' } }, { hero: { x: 300, pose: 'run', t: 0.3 } }],
        caption: 'Тень Стука рассеялась. За ней — дверь. На ней написано не «ВЫХОД», а «ВХОД».' },
      { h: 0.5, scene: 'eye', caption: 'Око Дома', big: 'ЧЕТЫРЕСТА КОМНАТ БЫЛИ ЛИШЬ ПЕРВЫМ ЭТАЖОМ.' },
    ],
    [
      { h: 0.4, scene: 'black', big: 'запах карболки', caption: 'Наверху пахнет больницей.' },
      { h: 0.6, scene: 'paper', big: 'АКТ V\nГОСПИТАЛЬ ЗАБВЕНИЯ', caption: 'Второй этаж. Здесь лечат от воспоминаний.' },
    ],
  ],
  act5: [
    [
      { h: 0.5, scene: 'paper', big: 'Медицинская карта\nПациент: Ф. В.\n«Поступил добровольно.\nПросил стереть всё»', caption: 'Кабинет главврача. На столе — история болезни.' },
      { h: 0.5, scene: 'wall', actors: [{ hero: { x: 480, pose: 'idle', flip: true } }], caption: 'Подпись на согласии — его собственная.', bubble: { text: 'Я сам этого хотел?', x: 0.6, y: 0.3 } },
    ],
    [
      { h: 0.4, scene: 'eye', caption: 'Око Дома', big: 'НЕ ЧИТАЙ ДАЛЬШЕ. ТАМ ТОЛЬКО ПРИЧИНА.' },
      { h: 0.6, scene: 'paper', big: 'АКТ VI\nПОДВАЛЫ ОТРАЖЕНИЙ', caption: 'Лестница ведёт вниз, к зеркалам.' },
    ],
  ],
  act6: [
    [
      { h: 0.5, scene: 'wall', actors: [{ hero: { x: 330, pose: 'idle' } }, { hero: { x: 640, pose: 'idle', flip: true } }],
        caption: 'Отражение остановилось. Впервые оно не убегает.', bubble: { text: 'Я остался, чтобы держать дверь. Ты сбежал.', x: 0.45, y: 0.2 } },
      { h: 0.5, scene: 'black', big: 'он растворился в стекле', caption: 'Двойник — та часть Флита, что не согласилась забыть.' },
    ],
    [
      { h: 0.4, scene: 'eye', caption: 'Око Дома', big: 'ВРЕМЯ НЕ ЛЕЧИТ. ОНО РАСТЁТ.' },
      { h: 0.6, scene: 'paper', big: 'АКТ VII\nОРАНЖЕРЕЯ ВРЕМЕНИ', caption: 'Сады, где вместо цветов растут часы.' },
    ],
  ],
  act7: [
    [
      { h: 0.5, scene: 'wall', actors: [{ hero: { x: 480, pose: 'idle' } }], caption: 'В пруду вчерашнего дня — тот самый день.' },
      { h: 0.5, scene: 'black', big: 'он стирал память\nи плакал от облегчения', caption: 'Флит видит себя прежнего.' },
    ],
    [
      { h: 0.4, scene: 'eye', caption: 'Око Дома', big: 'Я ПРЯТАЛ ЭТОТ ДЕНЬ, ЧТОБЫ ТЕБЯ НЕ НАШЛИ ПО НЕМУ.' },
      { h: 0.6, scene: 'paper', big: 'АКТ VIII\nГОРОД-ПРИЗРАК', caption: 'Дом вырос в город.' },
    ],
  ],
  act8: [
    [
      { h: 0.5, scene: 'wall', actors: [{ hero: { x: 480, pose: 'jump' } }], caption: 'Мэр-Портрет упал со своего мольберта. Флит взбегает на мост.' },
      { h: 0.5, scene: 'paper', big: 'дом внутри города\nгород внутри дома', caption: 'С моста видно всё. Наружу — некуда. И никогда не было.' },
    ],
    [
      { h: 0.4, scene: 'eye', caption: 'Око Дома', big: 'ТЫ ИСКАЛ ВЫХОД. ВЫХОДА НЕТ. ЕСТЬ КАРАНДАШ.' },
      { h: 0.6, scene: 'paper', big: 'АКТ IX\nЧЕРТЁЖНАЯ БЕЗДНА', caption: 'Пол становится бумагой.' },
    ],
  ],
  act9: [
    [
      { h: 0.5, scene: 'wall', actors: [{ demon: { x: 600, h: 320 } }, { hero: { x: 300, pose: 'idle' } }],
        caption: 'Прежний Оценщик, продержавшийся 212 комнат, падает.', bubble: { text: 'Око — не тюремщик. Оно в клетке, как и мы.', x: 0.45, y: 0.15 } },
      { h: 0.5, scene: 'eye', caption: 'Око Дома', big: 'Я ЛИШЬ ЗАМОЧНАЯ СКВАЖИНА. В МЕНЯ СМОТРЯТ С ДРУГОЙ СТОРОНЫ.' },
    ],
    [
      { h: 0.4, scene: 'black', big: 'тук.   тук.   тук.', caption: 'Стук совсем рядом.' },
      { h: 0.6, scene: 'paper', big: 'АКТ X\nПОРОГ', caption: 'Последние сто комнат.' },
    ],
  ],
  act10: [
    [
      { h: 0.5, scene: 'door', actors: [{ door: { x: 560, open: 0, label: '' } }, { hero: { x: 330, pose: 'idle' } }],
        caption: 'Дверь без таблички. Стук прекратился.' },
      { h: 0.5, scene: 'door', actors: [{ door: { x: 560, open: 1, label: '' } }, { hero: { x: 520, pose: 'run', t: 0.2 } }],
        caption: 'Флит открывает её.' },
    ],
    [
      { h: 0.5, scene: 'wall', actors: [{ hero: { x: 480, pose: 'idle' } }],
        caption: 'За дверью — прихожая с полосатыми обоями. На вешалке висит цилиндр.', bubble: { text: '…Я здесь впервые?', x: 0.6, y: 0.3 } },
      { h: 0.5, scene: 'black', big: 'Око закрылось', caption: 'Впервые за тысячу комнат никто не смотрит. Коридор Вечного Сквозняка открыт.' },
    ],
  ],
};

function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const w of para.split(' ')) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
    }
    out.push(line);
  }
  return out;
}

export class ComicPlayer {
  constructor(id, L, images, skin, onDone) {
    this.pages = COMICS[id] || [];
    this.L = L; this.images = images; this.skin = skin; this.onDone = onDone;
    this.page = 0; this.shown = 1; this.anim = 0; this.done = !this.pages.length;
    if (this.done) onDone?.();
  }

  // тап по экрану (координаты сцены)
  tap(x, y) {
    if (this.done) return;
    if (x > this.L.SW - 230 && y < 110) { this.finish(); return; }
    const panels = this.pages[this.page];
    if (this.shown < panels.length) { this.shown++; this.anim = 0; return; }
    if (this.page < this.pages.length - 1) { this.page++; this.shown = 1; this.anim = 0; return; }
    this.finish();
  }

  finish() { if (!this.done) { this.done = true; this.onDone?.(); } }

  draw(ctx, t, dt) {
    const L = this.L;
    this.anim = Math.min(1, this.anim + dt * 4);
    ctx.fillStyle = '#0b0908';
    ctx.fillRect(0, 0, L.SW, L.SH);
    const panels = this.pages[this.page] || [];
    const top = 120, bottom = L.SH - 140, gap = 26, pad = 28;
    const avail = bottom - top - gap * (panels.length - 1);
    let y = top;
    panels.forEach((pn, i) => {
      const ph = avail * pn.h;
      if (i < this.shown) {
        const a = i === this.shown - 1 ? this.anim : 1;
        const tilt = (i % 2 ? 1 : -1) * 0.012;
        ctx.save();
        ctx.globalAlpha = a;
        const cx = L.SW / 2, cy = y + ph / 2;
        ctx.translate(cx, cy); ctx.rotate(tilt); ctx.scale(0.94 + 0.06 * a, 0.94 + 0.06 * a); ctx.translate(-cx, -cy);
        this.drawPanel(ctx, pn, pad, y, L.SW - pad * 2, ph, t);
        ctx.restore();
      }
      y += ph + gap;
    });
    // подсказки управления
    ctx.save();
    ctx.font = 'bold 36px "Amatic SC", serif'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#8e8b87'; ctx.textAlign = 'right';
    ctx.fillText('пропустить ›', L.SW - 30, 60);
    ctx.textAlign = 'center'; ctx.globalAlpha = 0.6 + Math.sin(t * 4) * 0.3;
    ctx.fillText('тап — дальше', L.SW / 2, L.SH - 80);
    ctx.restore();
  }

  drawPanel(ctx, pn, x, y, w, h, t) {
    const I = this.images;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    // сцена в координатах мира 1000 × 600, вписана с выравниванием по низу
    const s = Math.max(w / 1000, h / 600);
    const ox = x + (w - 1000 * s) / 2, oy = y + h - 600 * s;
    ctx.save();
    ctx.translate(ox, oy); ctx.scale(s, s);
    if (pn.scene === 'wall' || pn.scene === 'door') {
      if (I.wall) {
        const wh = FLOOR_TOP + 24, ww = I.wall.width * wh / I.wall.height;
        ctx.drawImage(I.wall, -40, 0, ww, wh);
        if (ww < 1100) ctx.drawImage(I.wall, ww - 41, 0, ww, wh);
      } else { ctx.fillStyle = '#d9cdb4'; ctx.fillRect(0, 0, 1000, 600); }
      if (I.floor) ctx.drawImage(I.floor, 0, FLOOR_TOP - 8, 1100, 600 - FLOOR_TOP + 12);
      else { ctx.fillStyle = '#776a5b'; ctx.fillRect(0, FLOOR_TOP, 1000, 200); }
    } else if (pn.scene === 'paper') {
      ctx.fillStyle = '#e4d8c0'; ctx.fillRect(0, 0, 1000, 600);
      ctx.strokeStyle = 'rgba(120,100,80,0.25)'; ctx.lineWidth = 2;
      for (let yy = 40; yy < 600; yy += 44) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(1000, yy); ctx.stroke(); }
    } else {
      ctx.fillStyle = '#0b0908'; ctx.fillRect(0, 0, 1000, 600);
    }
    if (pn.scene === 'eye') {
      const g = ctx.createRadialGradient(500, 300, 20, 500, 300, 420);
      g.addColorStop(0, 'rgba(120,20,20,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 1000, 600);
      if (I.eye) { const ew = 520, eh = I.eye.height * ew / I.eye.width; ctx.drawImage(I.eye, 500 - ew / 2, 250 - eh / 2, ew, eh); }
    }
    for (const a of pn.actors || []) {
      if (a.door) drawFinish(ctx, a.door.x, a.door.open || 0, a.door.label ?? 'ВЫХОД');
      if (a.demon && demonReady()) drawDemon(ctx, a.demon.x, GROUND_Y + 4, a.demon.h || 300, t + a.demon.x * 0.01, 0, a.demon.x, a.demon.variant || '');
      if (a.hero && rigReady()) {
        ctx.save();
        ctx.translate(a.hero.x, GROUND_Y);
        ctx.scale(HERO_SCALE * (a.hero.flip ? -1 : 1), HERO_SCALE);
        drawRigHero(ctx, 0, 0, a.hero.pose || 'idle', a.hero.t ?? t, this.skin, { vy: a.hero.pose === 'jump' ? -600 : 0 });
        ctx.restore();
      }
    }
    if (pn.big) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const dark = pn.scene === 'paper';
      ctx.font = `bold ${pn.scene === 'eye' ? 54 : 76}px "Amatic SC", serif`;
      const lines = wrap(ctx, pn.big, 900);
      const lh = pn.scene === 'eye' ? 60 : 82;
      const y0 = (pn.scene === 'eye' ? 480 : 330) - (lines.length - 1) * lh / 2;
      lines.forEach((ln, i) => {
        if (pn.scene === 'eye') { ctx.fillStyle = '#e8dcc4'; ctx.fillText(ln, 500, y0 + i * lh); }
        else { ctx.fillStyle = dark ? '#16120f' : '#e8dcc4'; ctx.fillText(ln, 500, y0 + i * lh); }
      });
    }
    ctx.restore();

    // реплика
    if (pn.bubble) {
      const b = pn.bubble;
      ctx.font = 'bold 38px "Amatic SC", serif';
      const lines = wrap(ctx, b.text, w * 0.42);
      const bw = Math.max(...lines.map(l => ctx.measureText(l).width)) + 40, bh = lines.length * 40 + 26;
      const bx = x + w * b.x, by = y + h * b.y;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 22); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx + 30, by + bh - 2); ctx.lineTo(bx - 10, by + bh + 34); ctx.lineTo(bx + 60, by + bh - 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillRect(bx + 28, by + bh - 6, 34, 8);
      ctx.fillStyle = '#16120f'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      lines.forEach((ln, i) => ctx.fillText(ln, bx + 20, by + 14 + i * 40));
    }
    // подпись — жёлтая плашка в углу
    if (pn.caption) {
      ctx.font = 'bold 36px "Amatic SC", serif';
      const lines = wrap(ctx, pn.caption, w - 70);
      const cw = Math.max(...lines.map(l => ctx.measureText(l).width)) + 34, ch = lines.length * 38 + 20;
      ctx.fillStyle = '#f2d27a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
      ctx.fillRect(x + 10, y + 10, cw, ch); ctx.strokeRect(x + 10, y + 10, cw, ch);
      ctx.fillStyle = '#16120f'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      lines.forEach((ln, i) => ctx.fillText(ln, x + 27, y + 20 + i * 38));
    }
    ctx.restore();
    // рамка панели
    ctx.strokeStyle = '#000'; ctx.lineWidth = 8;
    ctx.strokeRect(x, y, w, h);
    ctx.strokeStyle = '#e8dcc4'; ctx.lineWidth = 2;
    ctx.strokeRect(x - 6, y - 6, w + 12, h + 12);
  }
}
