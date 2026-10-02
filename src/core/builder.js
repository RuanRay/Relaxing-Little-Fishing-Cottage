import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from './math.js';

// 每個零件一個描邊 ID；後製描邊會在 ID 不同處畫線。
let idCounter = 0;
export function newId() {
  idCounter++;
  return (((idCounter * 97) % 251) + 3) / 255;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

/** 位移 / 旋轉 / 縮放 → Matrix4 */
export function T(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ'));
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}

/**
 * 把大量小零件合併成單一 Mesh（頂點色 + 描邊 ID），大幅減少 draw call。
 * color 可為色碼，或 (localPosition, outColor) => void 的函式。
 */
export class Builder {
  constructor() {
    this.parts = [];
    this.stack = [new THREE.Matrix4()];
  }

  push(matrix) {
    this.stack.push(this.stack[this.stack.length - 1].clone().multiply(matrix));
    return this;
  }

  pop() {
    this.stack.pop();
    return this;
  }

  /**
   * 幾何若帶有 cell 屬性（每個頂點所屬色格的中心），color 函式會以 cell 取色而非頂點位置，
   * 同一格的顏色一致，色塊邊界才會銳利（條紋、斑紋用）。
   */
  add(geometry, color, matrix, id = newId()) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    const pos = g.attributes.position;
    const n = pos.count;
    const colors = new Float32Array(n * 3);
    const ids = new Float32Array(n).fill(id);
    if (typeof color === 'function') {
      const at = g.attributes.cell || pos;
      for (let i = 0; i < n; i++) {
        color(_p.fromBufferAttribute(at, i), _c);
        colors[i * 3] = _c.r;
        colors[i * 3 + 1] = _c.g;
        colors[i * 3 + 2] = _c.b;
      }
    } else {
      _c.set(color);
      for (let i = 0; i < n; i++) {
        colors[i * 3] = _c.r;
        colors[i * 3 + 1] = _c.g;
        colors[i * 3 + 2] = _c.b;
      }
    }
    _m.copy(this.stack[this.stack.length - 1]);
    if (matrix) _m.multiply(matrix);
    g.applyMatrix4(_m);
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.setAttribute('oid', new THREE.BufferAttribute(ids, 1));
    this.parts.push(g);
    return this;
  }

  get empty() {
    return this.parts.length === 0;
  }

  build(material, { shadow = true } = {}) {
    const mesh = new THREE.Mesh(mergeGeometries(this.parts), material);
    mesh.castShadow = shadow;
    mesh.receiveShadow = shadow;
    this.parts.length = 0;
    return mesh;
  }
}

// ---- 常用幾何（快取） -------------------------------------------------------

const cache = new Map();
function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

export const box = (w, h, d) => cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
export const cyl = (rt, rb, h, seg = 10, open = false) =>
  cached(`c${rt},${rb},${h},${seg},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
export const ball = (r, w = 12, h = 8) => cached(`s${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h));
export const cone = (r, h, seg = 8) => cached(`k${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg));
export const torus = (r, t, a = 8, b = 16, arc = Math.PI * 2) =>
  cached(`t${r},${t},${a},${b},${arc}`, () => new THREE.TorusGeometry(r, t, a, b, arc));

/** 不規則的圓潤團塊（岩石、樹冠、灌木）：平滑法線，輪廓為低多邊形。 */
export function blob(variant = 0, detail = 1, jitter = 0.22) {
  return cached(`blob${variant},${detail},${jitter}`, () => {
    let g = new THREE.IcosahedronGeometry(1, detail);
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    g = mergeVertices(g, 1e-4);
    const r = rng(1000 + variant * 77 + detail * 13);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = 1 + (r() - 0.5) * 2 * jitter;
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    return g;
  });
}

/** 沿曲線的細管（繩索、藤蔓、纜線） */
export function tube(points, radius = 0.02, segments = 16, radial = 5) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
  return new THREE.TubeGeometry(curve, segments, radius, radial, false);
}

/** 朝 -y 垂落的波浪狀葉帶（海藻、布條） */
export function ribbon(length, width, phase = 0, wave = 0.06) {
  const segs = 6;
  const pos = [];
  const idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const w = width * (1 - t * 0.75);
    const x = Math.sin(t * 5 + phase) * wave * t;
    const z = 0.02 + Math.sin(t * 3 + phase) * wave * 0.5;
    pos.push(x - w, -t * length, z, x + w, -t * length, z);
    if (i < segs) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 兩點之間的圓柱（柱、桿、樑） */
export function beam(b, a, c, rTop, rBottom, color, id, seg = 8) {
  const va = new THREE.Vector3(a[0], a[1], a[2]);
  const vc = new THREE.Vector3(c[0], c[1], c[2]);
  const dir = vc.clone().sub(va);
  const len = dir.length();
  const m = new THREE.Matrix4().compose(
    va.clone().add(vc).multiplyScalar(0.5),
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()),
    new THREE.Vector3(1, 1, 1),
  );
  b.add(new THREE.CylinderGeometry(rTop, rBottom, len, seg), color, m, id);
}
