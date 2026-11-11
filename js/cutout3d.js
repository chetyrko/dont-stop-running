// Объёмные вырезки из 2D-рисунков: контур картинки выдавливается в толщину,
// на обеих плоских сторонах — сам рисунок, боковые стенки окрашены цветом рисунка у края.
// Из таких деталей собран 3D-Флит (по анимации из rig.js) и статичные враги.

import * as THREE from '../vendor/three.module.min.js?v=65506b1';
import { captureRigPose, RIG_PARTS, rigImages } from './rig.js?v=65506b1';

const geomCache = new WeakMap();

// Контур по столбцам: верх и низ непрозрачного в каждом столбце.
function outline(img, step = 3) {
  const w = img.width, h = img.height;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const a = x.getImageData(0, 0, w, h).data;
  const tops = [], bots = [];
  for (let cx = 0; cx < w; cx += step) {
    let t = -1, b = -1;
    for (let y = 0; y < h; y++) if (a[(y * w + cx) * 4 + 3] > 110) { t = y; break; }
    if (t < 0) continue;
    for (let y = h - 1; y >= t; y--) if (a[(y * w + cx) * 4 + 3] > 110) { b = y; break; }
    tops.push([cx, t - 1]); bots.push([cx, b + 1]);
  }
  if (tops.length < 2) return null;
  return [...tops, ...bots.reverse()];
}

// Геометрия вырезки в пикселях картинки (y вниз), толщина depth пикселей.
export function cutoutGeometry(img, depth = 20) {
  const key = depth;
  let byDepth = geomCache.get(img);
  if (!byDepth) { byDepth = {}; geomCache.set(img, byDepth); }
  if (byDepth[key]) return byDepth[key];
  const pts = outline(img);
  if (!pts) return null;
  const W = img.width, H = img.height;
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const uv = (x, y) => new THREE.Vector2(x / W, 1 - y / H);
  // стенки берут цвет чуть внутри контура — получается цвет рисунка, а не чернильная линия
  const inner = (x, y) => uv(cx + (x - cx) * 0.82, cy + (y - cy) * 0.82);
  const gen = {
    generateTopUV(g, v, a, b, c) { return [uv(v[a * 3], v[a * 3 + 1]), uv(v[b * 3], v[b * 3 + 1]), uv(v[c * 3], v[c * 3 + 1])]; },
    generateSideWallUV(g, v, a, b, c, d) { return [inner(v[a * 3], v[a * 3 + 1]), inner(v[b * 3], v[b * 3 + 1]), inner(v[c * 3], v[c * 3 + 1]), inner(v[d * 3], v[d * 3 + 1])]; },
  };
  const geom = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1, UVGenerator: gen });
  byDepth[key] = geom;
  return geom;
}

const texCache = new WeakMap();
export function texOf(img) {
  let t = texCache.get(img);
  if (!t) { t = new THREE.Texture(img); t.needsUpdate = true; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; texCache.set(img, t); }
  return t;
}
export function cutoutMaterial(img, color) {
  return new THREE.MeshLambertMaterial({ map: texOf(img), alphaTest: 0.45, side: THREE.DoubleSide, color: color ?? 0xffffff });
}

// Статичная объёмная вырезка: стоит на полу (y = 0), смотрит на камеру (+z).
export function cutoutMesh(img, metersPerPx, depthM = 0.25) {
  const D = 20;
  const geom = cutoutGeometry(img, D);
  const g = new THREE.Group();
  if (!geom) return g;
  const m = new THREE.Mesh(geom, cutoutMaterial(img));
  m.scale.set(metersPerPx, -metersPerPx, depthM / D);
  m.position.set(-img.width * metersPerPx / 2, img.height * metersPerPx, -depthM / 2);
  g.add(m);
  return g;
}

// Плоская живая картинка (для анимированных врагов): canvas перерисовывается, текстура обновляется.
// За ней — тёмная копия, чтобы фигура читалась как вырезанная из толстого картона.
export function liveCutout(canvas, metersPerPx) {
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  const w = canvas.width * metersPerPx, h = canvas.height * metersPerPx;
  const g = new THREE.Group();
  const front = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide }));
  front.position.y = h / 2; g.add(front);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, color: 0x050303, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide }));
  back.position.set(0.03, h / 2 - 0.02, -0.08); g.add(back);
  g.userData.tex = tex;
  return g;
}

// ---------- 3D-Флит из деталей автора ----------
// Каждая деталь «надувается» по своему контуру: середина толще, к краю объём скругляется до нуля,
// как у лепной фигурки. Рисунок автора проецируется спереди и сзади, свет — ступенчатый
// (как заливка тушью), по силуэту — чернильный контур. Получается объёмная модель, которая
// с любого ракурса выглядит нарисованной.

const DEPTH = { torso: 0.34, pelvis: 0.3, head: 0.26, sleeve: 0.15, forearm: 0.1, thigh: 0.14, shin: 0.11, foot: 0.12, gun: 0.06, fist: 0.11 };
const LAT = { Thigh: 0.1, Shin: 0.1, Foot: 0.1, Sleeve: 0.2, Forearm: 0.22 };
const K = 0.0115;          // единицы героя → метры (рост ≈ 1.75 м)

function alphaGrid(img, step) {
  const w = img.width, h = img.height;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const a = x.getImageData(0, 0, w, h).data;
  const gw = Math.ceil(w / step) + 1, gh = Math.ceil(h / step) + 1;
  const inside = new Uint8Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const px = Math.min(w - 1, i * step), py = Math.min(h - 1, j * step);
    inside[j * gw + i] = a[(py * w + px) * 4 + 3] > 90 ? 1 : 0;
  }
  return { gw, gh, inside };
}

// Расстояние до края (фаска 3-4), в пикселях картинки.
function distField(gw, gh, inside, step) {
  const INF = 1e9, d = new Float32Array(gw * gh);
  for (let k = 0; k < d.length; k++) d[k] = inside[k] ? INF : 0;
  const s1 = step, s2 = step * Math.SQRT2;
  const at = (i, j) => (i < 0 || j < 0 || i >= gw || j >= gh) ? 0 : d[j * gw + i];
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const k = j * gw + i; if (!d[k]) continue;
    d[k] = Math.min(d[k], at(i - 1, j) + s1, at(i, j - 1) + s1, at(i - 1, j - 1) + s2, at(i + 1, j - 1) + s2);
  }
  for (let j = gh - 1; j >= 0; j--) for (let i = gw - 1; i >= 0; i--) {
    const k = j * gw + i; if (!d[k]) continue;
    d[k] = Math.min(d[k], at(i + 1, j) + s1, at(i, j + 1) + s1, at(i + 1, j + 1) + s2, at(i - 1, j + 1) + s2);
  }
  return d;
}

const inflCache = new Map();
// Объёмная деталь: x, y — пиксели картинки (y вниз), z — толщина в тех же пикселях (±T).
export function inflateGeometry(img, T) {
  const key = img.src + '|' + Math.round(T);
  if (inflCache.has(key)) return inflCache.get(key);
  const W = img.width, H = img.height;
  const step = Math.max(3, Math.ceil(Math.max(W, H) / 96));
  const { gw, gh, inside } = alphaGrid(img, step);
  const dist = distField(gw, gh, inside, step);
  let maxD = 0; for (const v of dist) if (v > maxD) maxD = v;
  const R = Math.max(step, Math.min(maxD - step, T * 1.15));
  const INK = 3;   // край берёт цвет чуть глубже, но не глубже чернильной линии: волосы, ремень и обводка на месте
  const zOf = (k) => { const q = Math.min(1, Math.max(0, dist[k] - step) / R); return T * Math.sqrt(1 - (1 - q) * (1 - q)); };
  const pos = [], uv = [], idx = [];
  const map = [new Int32Array(gw * gh).fill(-1), new Int32Array(gw * gh).fill(-1)];
  const vert = (side, i, j) => {
    const k = j * gw + i;
    if (map[side][k] >= 0) return map[side][k];
    const x = Math.min(W, i * step), y = Math.min(H, j * step);
    pos.push(x, y, (side ? -1 : 1) * zOf(k));
    // у края поверхность крутая, и проекция растянула бы чернильную линию полосами;
    // поэтому край берёт цвет чуть глубже внутри детали (контур рисует чернильная обводка)
    const D = (ii, jj) => dist[Math.min(gh - 1, Math.max(0, jj)) * gw + Math.min(gw - 1, Math.max(0, ii))];
    let gx = D(i + 1, j) - D(i - 1, j), gy = D(i, j + 1) - D(i, j - 1);
    const gl = Math.hypot(gx, gy) || 1; gx /= gl; gy /= gl;
    const inset = Math.max(0, Math.min(INK, INK - (dist[k] - step)));
    uv.push((x + gx * inset) / W, 1 - (y + gy * inset) / H);
    return (map[side][k] = pos.length / 3 - 1);
  };
  for (let j = 0; j < gh - 1; j++) for (let i = 0; i < gw - 1; i++) {
    const k = j * gw + i;
    if (!(inside[k] && inside[k + 1] && inside[k + gw] && inside[k + gw + 1])) continue;
    for (const side of [0, 1]) {
      const a = vert(side, i, j), b = vert(side, i + 1, j), c = vert(side, i, j + 1), e = vert(side, i + 1, j + 1);
      if (side) idx.push(a, b, c, b, e, c); else idx.push(a, c, b, b, c, e);
    }
  }
  // сглаживание (Таубин): «лесенка» по краю и грани на гребнях уходят, объём не сдувается
  const verts = [];
  for (let k = 0; k < gw * gh; k++) if (map[0][k] >= 0) verts.push(k);
  const nb = new Map();
  for (const k of verts) {
    const i = k % gw, j = (k - i) / gw, list = [];
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= gw || jj >= gh) continue;
      const v = map[0][jj * gw + ii];
      if (v >= 0) list.push(v);
    }
    nb.set(map[0][k], list);
  }
  const rim = new Set(verts.filter(k => dist[k] - step <= 0.5).map(k => map[0][k]));
  const orig = pos.slice();   // край не уходит от рисунка дальше, чем на полшага сетки: чёлка, ухо, пальцы целы
  for (let it = 0; it < 8; it++) {
    const f = it % 2 ? -0.53 : 0.5;
    const nx = new Map();
    for (const [v, list] of nb) {
      if (!list.length) continue;
      let sx = 0, sy = 0, sz = 0;
      for (const u of list) { sx += pos[u * 3]; sy += pos[u * 3 + 1]; sz += pos[u * 3 + 2]; }
      const n = list.length;
      nx.set(v, [pos[v * 3] + f * (sx / n - pos[v * 3]), pos[v * 3 + 1] + f * (sy / n - pos[v * 3 + 1]), pos[v * 3 + 2] + f * (sz / n - pos[v * 3 + 2])]);
    }
    const lim = step * 0.55, cl = (v, o) => Math.max(o - lim, Math.min(o + lim, v));
    for (const [v, q] of nx) { pos[v * 3] = cl(q[0], orig[v * 3]); pos[v * 3 + 1] = cl(q[1], orig[v * 3 + 1]); pos[v * 3 + 2] = rim.has(v) ? 0 : Math.max(0, q[2]); }
  }
  for (const k of verts) {
    const a = map[0][k], b = map[1][k];
    if (b < 0) continue;
    pos[b * 3] = pos[a * 3]; pos[b * 3 + 1] = pos[a * 3 + 1]; pos[b * 3 + 2] = -pos[a * 3 + 2];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  inflCache.set(key, g);
  return g;
}

// ступенчатый свет, как заливка тушью в три тона
let toonRamp;
function ramp() {
  if (toonRamp) return toonRamp;
  toonRamp = new THREE.DataTexture(new Uint8Array([120, 120, 120, 255, 190, 190, 190, 255, 255, 255, 255, 255]), 3, 1);
  toonRamp.minFilter = toonRamp.magFilter = THREE.NearestFilter; toonRamp.needsUpdate = true;
  return toonRamp;
}

// чернильный контур: та же деталь, раздутая вдоль нормалей, рисуется изнанкой
let inkMat;
function inkMaterial() {
  return inkMat ||= new THREE.ShaderMaterial({
    uniforms: { uW: { value: 0.02 }, uC: { value: new THREE.Color(0x0d0907) } },
    vertexShader: 'uniform float uW; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vec3 n = normalize(normalMatrix * normal); mv.xyz += n * uW; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uC; void main(){ gl_FragColor = vec4(uC, 1.0); }',
    side: THREE.BackSide,
  });
}

export class HeroCut {
  constructor(look = {}) {
    this.root = new THREE.Group();
    this.parts = new Map();
    const imgs = rigImages();
    this.ok = !!imgs;
    if (!imgs) return;
    this.noGun = !!look.noGun;
    const rest = captureRigPose('idle', 0, {}, {}) || [];
    const unit = {};
    for (const r of rest) { const [a, b, c, d] = r.m; unit[r.tag] = Math.sqrt(Math.abs(a * d - b * c)); }
    const tint = look.tint?.mul ? new THREE.Color(...look.tint.mul.map(v => Math.min(1.6, v))) : null;
    const add = (tag, imgKey) => {
      const img = imgs[imgKey];
      if (!img) return;
      const depth = DEPTH[imgKey] ?? 0.12;
      const u = unit[tag] || 0.16;
      const T = depth / 2 / (u * K);                       // полутолщина в пикселях картинки
      const geom = inflateGeometry(img, T);
      const colored = (imgKey === 'torso' || imgKey === 'sleeve') && tint;
      const mat = new THREE.MeshToonMaterial({ map: texOf(img), gradientMap: ramp(), alphaTest: 0.4, side: THREE.DoubleSide, color: colored ? tint : 0xffffff });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.matrixAutoUpdate = false;
      const ink = new THREE.Mesh(geom, inkMaterial());
      mesh.add(ink);
      this.root.add(mesh);
      const side = tag === 'gun' ? 1 : tag === 'fist' ? -1 : tag[0] === 'f' ? 1 : tag[0] === 'b' ? -1 : 0;
      const lk = Object.keys(LAT).find(k => tag.endsWith(k));
      const lat = side * (lk ? LAT[lk] : tag === 'gun' ? 0.25 : tag === 'fist' ? 0.22 : 0);
      this.parts.set(tag, { mesh, lat });
    };
    for (const p of RIG_PARTS) if (p.name !== 'head') add(p.name, p.img);
    add('head', 'head');
    add('fist', 'fist');
    this.root.scale.set(look.sx || 1, look.sy || 1, look.sx || 1);
  }

  // pose: run | jump | slide | idle | kick; t — время цикла бега; extra — как у drawRigHero
  pose(pose, t, extra = {}) {
    if (!this.ok) return;
    const out = captureRigPose(pose, t, { noGun: this.noGun }, extra);
    if (!out) return;
    for (const v of this.parts.values()) v.mesh.visible = false;
    for (const r of out) {
      const v = this.parts.get(r.tag);
      if (!v) continue;
      const [a, b, c, d, e, f] = r.m;
      const zk = Math.sqrt(Math.abs(a * d - b * c)) * K;
      v.mesh.matrix.set(
        0, 0, zk, v.lat,
        -b * K, -d * K, 0, -f * K,
        -a * K, -c * K, 0, -e * K,
        0, 0, 0, 1);
      v.mesh.matrixWorldNeedsUpdate = true;
      v.mesh.visible = true;
    }
  }
}
