import * as THREE from 'three';
import { fbm, noise, smooth, gauss, lerp } from '../core/math.js';
import { toonMatSolid } from '../core/materials.js';

// 底座為 20 x 20 的正方形；海平面在 y = 0。
export const HALF = 10;
export const SEG = 160;
export const SEA_FLOOR = -1.15;

const CENTER = { x: -0.8, z: -0.9 };
const HILL = { x: -2.6, z: -2.8 };
const BAY = { x: 4.9, z: 2.6 };
const CLIFF_ANGLE = Math.atan2(-1, -0.75);

/** 建築用的平整地基 */
export const HOUSE = { x: -0.2, z: 1.0, y: 1.05, r: 2.1 };
export const LIGHTHOUSE = { x: -4.9, z: -4.6, y: 2.35, r: 0.75 };

const PADS = [
  { ...HOUSE, blend: 1.0 },
  { ...LIGHTHOUSE, blend: 0.7 },
];

function islandT(x, z) {
  const dx = x - CENTER.x;
  const dz = z - CENTER.z;
  const r = Math.hypot(dx, dz);
  const th = Math.atan2(dz, dx);
  const R =
    6.2 +
    0.65 * Math.sin(th * 3 + 0.6) +
    0.4 * Math.sin(th * 5 + 2.1) +
    1.0 * (fbm(x * 0.25 + 10, z * 0.25 + 3) - 0.5);
  return 1 - r / R - 0.3 * gauss(x - BAY.x, z - BAY.z, 1.5);
}

export function heightAt(x, z) {
  const t = islandT(x, z);

  let h = SEA_FLOOR - SEA_FLOOR * smooth(-0.45, 0, t); // 海床 → 岸線
  h += 0.4 * smooth(0, 0.18, t); // 沙灘

  const land = smooth(0.1, 0.4, t);
  h += land * (0.45 + 3.0 * gauss(x - HILL.x, z - HILL.z, 2.3) + 0.4 * (fbm(x * 0.45, z * 0.45) - 0.5));

  // 背側的小型懸崖
  const th = Math.atan2(z - CENTER.z, x - CENTER.x);
  const sector = smooth(0.45, 0.95, Math.cos(th - CLIFF_ANGLE));
  h += sector * 1.5 * smooth(0.01, 0.08, t);

  // 海床起伏
  h += (1 - smooth(-0.08, 0.02, t)) * 0.22 * (fbm(x * 0.55 + 7, z * 0.55 + 1) - 0.5);

  for (const p of PADS) {
    const d = Math.hypot(x - p.x, z - p.z);
    h = lerp(h, p.y, 1 - smooth(p.r, p.r + p.blend, d));
  }

  // 靠近底座邊緣一律沉入水下，確保四周被海環抱
  const e = Math.max(Math.abs(x), Math.abs(z));
  h = lerp(h, Math.min(h, -0.95), smooth(8.4, 9.7, e));
  return h;
}

export function normalAt(x, z, out = new THREE.Vector3()) {
  const d = 0.08;
  return out
    .set(heightAt(x - d, z) - heightAt(x + d, z), 2 * d, heightAt(x, z - d) - heightAt(x, z + d))
    .normalize();
}

/** 是否為適合擺放植被的陸地 */
export function isLand(x, z, minH = 0.5) {
  return heightAt(x, z) > minH;
}

const C = (hex) => new THREE.Color(hex);
const PALETTE = {
  seaDeep: C(0x8fbfae),
  seaMid: C(0xc9d6a6),
  seaShallow: C(0xeadfae),
  sandWet: C(0xe8d3a0),
  sand: C(0xf8ebc2),
  grassLight: C(0xa5dc6f),
  grass: C(0x6fcb6b),
  grassDeep: C(0x47b070),
  rockDark: C(0x6a6d78),
  rock: C(0x8f9199),
  rockLight: C(0xb4b2ae),
};

function terrainColor(x, z, h, ny, out) {
  const n = fbm(x * 0.9 + 3, z * 0.9 + 9) - 0.5;
  const fine = noise(x * 3.1, z * 3.1) - 0.5;
  const P = PALETTE;

  if (h < 0.02) {
    const d = -h + n * 0.25;
    out.copy(d > 0.75 ? P.seaDeep : d > 0.35 ? P.seaMid : P.seaShallow);
    if (ny < 0.8) out.lerp(P.rock, 0.6);
    return out;
  }
  if (ny < 0.74 + fine * 0.06) {
    const k = h + n * 1.4;
    return out.copy(k > 1.9 ? P.rockLight : k > 0.9 ? P.rock : P.rockDark);
  }
  const hh = h + n * 0.35 + fine * 0.08;
  if (hh < 0.2) return out.copy(P.sandWet);
  if (hh < 0.62) return out.copy(P.sand);
  if (hh < 1.25) return out.copy(P.grassLight);
  if (hh < 2.5) return out.copy(P.grass);
  return out.copy(P.grassDeep);
}

export function createTerrain() {
  const n = SEG + 1;
  const positions = new Float32Array(n * n * 3);
  const colors = new Float32Array(n * n * 3);
  const normals = new Float32Array(n * n * 3);
  const indices = [];
  const col = new THREE.Color();
  const nor = new THREE.Vector3();

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = -HALF + (i / SEG) * HALF * 2;
      const z = -HALF + (j / SEG) * HALF * 2;
      const h = heightAt(x, z);
      const k = (j * n + i) * 3;
      positions[k] = x;
      positions[k + 1] = h;
      positions[k + 2] = z;
      normalAt(x, z, nor);
      normals[k] = nor.x;
      normals[k + 1] = nor.y;
      normals[k + 2] = nor.z;
      terrainColor(x, z, h, nor.y, col);
      colors[k] = col.r;
      colors[k + 1] = col.g;
      colors[k + 2] = col.b;
    }
  }
  for (let j = 0; j < SEG; j++) {
    for (let i = 0; i < SEG; i++) {
      const a = j * n + i;
      const b = a + 1;
      const c = a + n;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('oid', new THREE.BufferAttribute(new Float32Array(n * n).fill(0.5), 1));
  geo.setIndex(indices);

  const mesh = new THREE.Mesh(geo, toonMatSolid);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
