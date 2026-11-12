// Простые синтезированные звуки (заглушки, пока нет настоящих).
let ac = null;
let enabled = true;
let sfxVol = 1;

export function setSoundEnabled(v) { enabled = v; }
export function setSfxVolume(v) { sfxVol = Math.max(0, Math.min(1, v)); }

// ---------- фоновая музыка (файл автора, по кругу) ----------
const music = typeof Audio !== 'undefined' ? new Audio('assets/audio/music.mp3') : null;
let musicOn = true, musicVol = 0.6, musicWanted = false;
if (music) { music.loop = true; music.preload = 'auto'; music.volume = musicVol; }
function applyMusic() {
  if (!music) return;
  music.volume = musicVol;
  if (musicOn && musicWanted && musicVol > 0 && !document.hidden) { const p = music.play(); p?.catch?.(() => { /* ждём касания */ }); }
  else music.pause();
}
export function setMusic(on, vol) { musicOn = !!on; if (vol !== undefined) musicVol = Math.max(0, Math.min(1, vol)); applyMusic(); }
// мобильные браузеры разрешают звук только после касания — тогда и запускаем
export function startMusic() { musicWanted = true; applyMusic(); }
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', applyMusic);

function ctx() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

// Разблокировка звука первым касанием (требование мобильных браузеров).
export function unlockAudio() { if (enabled) ctx(); startMusic(); }

function tone(freq, dur, type = 'square', vol = 0.15, slideTo = null, delay = 0) {
  if (!enabled) return;
  const a = ctx(); if (!a) return;
  const t0 = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(Math.max(0.0002, vol * sfxVol), t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function noise(dur, vol = 0.2, filterFreq = 1200, delay = 0) {
  if (!enabled) return;
  const a = ctx(); if (!a) return;
  const t0 = a.currentTime + delay;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
  const g = a.createGain(); g.gain.value = vol * sfxVol;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t0);
}

// «вшик»: шум с фильтром, который быстро уходит вверх
function sweep(dur, vol) {
  if (!enabled) return;
  const a = ctx(); if (!a) return;
  const t0 = a.currentTime, len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / len);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2;
  f.frequency.setValueAtTime(300, t0); f.frequency.exponentialRampToValueAtTime(5000, t0 + dur);
  const g = a.createGain(); g.gain.value = vol * sfxVol;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t0);
}

export const sfx = {
  jump: () => tone(220, 0.18, 'triangle', 0.2, 520),
  slide: () => noise(0.25, 0.18, 700),
  kick: () => { tone(90, 0.12, 'sine', 0.35, 40); noise(0.18, 0.25, 2500, 0.03); },
  shoot: () => { noise(0.22, 0.4, 3000); tone(120, 0.15, 'sawtooth', 0.12, 50); },
  coin: () => { tone(880, 0.07, 'square', 0.07); tone(1320, 0.12, 'square', 0.07, null, 0.06); },
  hit: () => { tone(160, 0.35, 'sawtooth', 0.2, 50); noise(0.2, 0.2, 600); },
  monsterDie: () => tone(300, 0.4, 'sawtooth', 0.12, 60),
  crow: () => tone(700, 0.15, 'sawtooth', 0.06, 400),
  win: () => [392, 494, 587, 784].forEach((f, i) => tone(f, 0.25, 'triangle', 0.15, null, i * 0.13)),
  lose: () => [330, 262, 220, 165].forEach((f, i) => tone(f, 0.35, 'triangle', 0.15, null, i * 0.2)),
  click: () => tone(500, 0.05, 'square', 0.06),
  // обол в цепочке: каждый следующий звенит чуть выше
  coinN: (n) => { const f = 880 * Math.pow(1.06, Math.min(n, 14)); tone(f, 0.06, 'square', 0.06); tone(f * 1.5, 0.1, 'square', 0.05, null, 0.05); },
  // смерть: руки хватают, «пшик» дыма, «вшик» — портрет на стену
  grab: () => { tone(70, 0.5, 'sawtooth', 0.18, 35); noise(0.35, 0.18, 400); },
  puff: () => { noise(0.45, 0.45, 900); tone(140, 0.3, 'sine', 0.2, 50); },
  whoosh: () => sweep(0.4, 0.3),
};
