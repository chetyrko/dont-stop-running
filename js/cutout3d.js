// Объёмные вырезки из 2D-рисунков: контур картинки выдавливается в толщину,
// на обеих плоских сторонах — сам рисунок, боковые стенки окрашены цветом рисунка у края.
// Из таких деталей собран 3D-Флит (по анимации из rig.js) и статичные враги.

import * as THREE from '../vendor/three.module.min.js';
import { captureRigPose, RIG_PARTS, rigImages } from './rig.js';

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
const DEPTH = { torso: 0.34, pelvis: 0.3, head: 0.27, sleeve: 0.15, forearm: 0.1, thigh: 0.13, shin: 0.11, foot: 0.13, gun: 0.06, fist: 0.1 };
const LAT = { Thigh: 0.1, Shin: 0.1, Foot: 0.1, Sleeve: 0.21, Forearm: 0.23 };
const K = 0.0115;          // единицы героя → метры (рост ≈ 1.75 м)
const DPX = 20;            // толщина геометрии в пикселях

export class HeroCut {
  constructor(look = {}) {
    this.root = new THREE.Group();
    this.parts = new Map();
    const imgs = rigImages();
    this.ok = !!imgs;
    if (!imgs) return;
    const shirt = look.shirt && look.id !== undefined ? new THREE.Color(look.shirt) : null;
    const tint = look.tint?.mul ? new THREE.Color(...look.tint.mul.map(v => Math.min(1.6, v))) : null;
    const add = (tag, imgKey) => {
      const img = imgs[imgKey];
      if (!img) return;
      const geom = cutoutGeometry(img, DPX);
      if (!geom) return;
      const colored = (imgKey === 'torso' || imgKey === 'sleeve') && tint;
      const mesh = new THREE.Mesh(geom, cutoutMaterial(img, colored ? tint : undefined));
      mesh.matrixAutoUpdate = false;
      this.root.add(mesh);
      const side = tag[0] === 'f' && tag !== 'fist' ? 1 : tag[0] === 'b' ? -1 : tag === 'gun' ? 1 : tag === 'fist' ? -1 : 0;
      const lat = side * (LAT[Object.keys(LAT).find(k => tag.endsWith(k))] ?? (tag === 'gun' ? 0.24 : tag === 'fist' ? 0.23 : 0));
      this.parts.set(tag, { mesh, depth: DEPTH[imgKey] ?? 0.12, lat });
    };
    for (const p of RIG_PARTS) if (p.name !== 'head') add(p.name, p.img);
    add('head', 'head');
    add('fist', 'fist');
    this.noGun = !!look.noGun;
    this.root.scale.set(look.sx || 1, look.sy || 1, look.sx || 1);
  }

  // pose: run | jump | slide | idle | kick; t — секунды для цикла бега
  pose(pose, t, extra = {}) {
    if (!this.ok) return;
    const out = captureRigPose(pose, t, { noGun: this.noGun }, extra);
    if (!out) return;
    for (const v of this.parts.values()) v.mesh.visible = false;
    for (const r of out) {
      const v = this.parts.get(r.tag);
      if (!v) continue;
      const [a, b, c, d, e, f] = r.m;
      v.mesh.matrix.set(
        0, 0, v.depth / DPX, v.lat - v.depth / 2,
        -b * K, -d * K, 0, -f * K,
        -a * K, -c * K, 0, -e * K,
        0, 0, 0, 1);
      v.mesh.matrixWorldNeedsUpdate = true;
      v.mesh.visible = true;
    }
  }
}
