import * as THREE from 'three';
import { T, box, cyl, ball, cone, torus, newId } from '../core/builder.js';
import { halo } from '../core/materials.js';

// 木屋與碼頭共用的小道具。b 為 Builder，m 為擺放矩陣。

export const WOOD = [0xc49a6c, 0xb88c5f, 0xcfa678, 0xa9855f];
export const WOOD_DARK = 0x5a3b2a;
export const RUST = 0xb1513c;

export function crate(b, m, size = 0.4) {
  const id = newId();
  b.push(m);
  b.add(box(size, size * 0.85, size), 0xb98d5e, T(0, size * 0.425, 0), id);
  for (const y of [0.08, 0.77]) b.add(box(size * 1.08, size * 0.12, size * 1.08), 0x8f6a45, T(0, size * y, 0), id);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      b.add(box(size * 0.1, size * 0.85, size * 0.1), 0x8f6a45, T(sx * size * 0.5, size * 0.425, sz * size * 0.5), id);
  b.pop();
}

export function barrel(b, m) {
  const id = newId();
  b.push(m);
  b.add(cyl(0.15, 0.14, 0.42, 10), 0xa87a50, T(0, 0.21, 0), id);
  b.add(cyl(0.165, 0.165, 0.12, 10), 0xb98a5c, T(0, 0.21, 0), id);
  for (const y of [0.09, 0.33]) b.add(torus(0.152, 0.014, 5, 12), RUST, T(0, y, 0, Math.PI / 2), id);
  b.add(cyl(0.13, 0.13, 0.02, 10), 0x7d5a3c, T(0, 0.425, 0), id);
  b.pop();
}

/** 橘白相間的救生圈（躺在 XY 平面，面向 +z） */
export function lifebuoy(b, m, r = 0.17) {
  const white = new THREE.Color(0xfff6e6);
  const orange = new THREE.Color(0xff7a45);
  b.add(
    torus(r, r * 0.32, 8, 24),
    (p, out) => out.copy(Math.floor((Math.atan2(p.y, p.x) + Math.PI) / (Math.PI / 4)) % 2 ? orange : white),
    m,
  );
}

/** 浮球：上半亮色、下半白，頂部有繩環 */
export function buoy(b, m, color = 0xff7d4d, r = 0.13) {
  const id = newId();
  const top = new THREE.Color(color);
  const bottom = new THREE.Color(0xfff3dc);
  b.push(m);
  b.add(ball(r, 12, 8), (p, out) => out.copy(p.y > -r * 0.15 ? top : bottom), T(0, r, 0), id);
  b.add(torus(r * 0.3, r * 0.09, 5, 10), 0x6b5a48, T(0, r * 2.05, 0), id);
  b.pop();
}

/** 低矮庭院燈；回傳光暈 sprite 的位置由呼叫端加入場景 */
export function gardenLamp(ctx, m, height = 0.34) {
  const id = newId();
  ctx.lit.push(m);
  ctx.lit.add(box(0.06, height, 0.06), 0x4a3a33, T(0, height / 2, 0), id);
  ctx.lit.add(box(0.17, 0.03, 0.17), 0x4a3a33, T(0, height, 0), id);
  ctx.lit.add(cone(0.15, 0.09, 4), 0x3d4756, T(0, height + 0.19, 0, 0, Math.PI / 4), id);
  ctx.lit.pop();
  ctx.glow.push(m);
  ctx.glow.add(box(0.11, 0.12, 0.11), 0xffd98a, T(0, height + 0.08, 0));
  ctx.glow.pop();
  const h = halo(0xffc070, 0.9, 0.55);
  h.position.set(0, height + 0.08, 0).applyMatrix4(m);
  return h;
}

// ---- 漁網（alpha 貼圖） -------------------------------------------------------

let netTexture = null;
function getNetTexture() {
  if (netTexture) return netTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  g.strokeStyle = '#3f8f8a';
  g.lineWidth = 5;
  const step = 32;
  for (let i = -256; i <= 512; i += step) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 256, 256);
    g.moveTo(i, 0);
    g.lineTo(i - 256, 256);
    g.stroke();
  }
  netTexture = new THREE.CanvasTexture(c);
  netTexture.colorSpace = THREE.SRGBColorSpace;
  netTexture.wrapS = netTexture.wrapT = THREE.RepeatWrapping;
  return netTexture;
}

/** 晾曬中的漁網：頂邊固定、中段微微下垂鼓起 */
export function createNet(width, height) {
  const geo = new THREE.PlaneGeometry(width, height, 12, 8);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / width;
    const v = 0.5 - p.getY(i) / height; // 0 = 頂邊
    p.setZ(i, Math.sin(v * Math.PI) * 0.1 * Math.cos(u * Math.PI) + Math.sin(u * 9) * 0.02 * v);
    p.setY(i, p.getY(i) - (0.25 - u * u) * 0.25 * v);
  }
  geo.translate(0, -height / 2, 0);
  const tex = getNetTexture().clone();
  tex.repeat.set(width / 0.42, height / 0.42);
  tex.needsUpdate = true;
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, transparent: false }),
  );
  mesh.layers.set(1);
  return mesh;
}
