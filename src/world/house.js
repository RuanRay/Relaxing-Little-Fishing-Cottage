import * as THREE from 'three';
import { rng, lerp } from '../core/math.js';
import { Builder, T, box, cyl, ball, cone, torus, blob, beam, newId } from '../core/builder.js';
import { toonMat, halo } from '../core/materials.js';
import { HOUSE, LIGHTHOUSE, heightAt } from './terrain.js';
import { WOOD, WOOD_DARK, RUST, crate, barrel, lifebuoy, gardenLamp, createNet } from './props.js';

const PLASTER = 0xf8f0dd;
const TILE = [0x46526c, 0x3c475d];
const ROOF_ANGLE = Math.atan2(0.9, 1.5);
const BODY_Z = -0.35; // 屋身中心（前方留給木平台）
const FRONT = BODY_Z + 1.0;
const FLOOR = 0.3;

export const HOUSE_MATRIX = T(HOUSE.x, HOUSE.y, HOUSE.z, 0, 0.42, 0);

function windowAt(ctx, m, w, h) {
  const id = newId();
  ctx.lit.push(m);
  ctx.lit.add(box(w + 0.12, h + 0.12, 0.06), WOOD_DARK, T(0, 0, 0.03), id);
  ctx.lit.add(box(w + 0.26, 0.05, 0.15), 0x8a5f3f, T(0, -h / 2 - 0.08, 0.07), id);
  const bars = newId();
  for (const x of [-w / 4, 0, w / 4]) ctx.lit.add(box(0.03, h, 0.03), WOOD_DARK, T(x, 0, 0.085), bars);
  ctx.lit.add(box(w, 0.03, 0.03), WOOD_DARK, T(0, 0.05, 0.085), bars);
  ctx.lit.pop();
  ctx.glow.push(m);
  ctx.glow.add(box(w, h, 0.02), 0xffdf9c, T(0, 0, 0.065));
  ctx.glow.pop();
}

function buildShell(ctx) {
  const b = ctx.lit;

  // 石基與屋身
  b.add(box(3.1, FLOOR, 2.3), 0x9a9ba1, T(0, FLOOR / 2, BODY_Z));
  b.add(box(2.8, 1.5, 2.0), PLASTER, T(0, FLOOR + 0.75, BODY_Z));

  // 腰板：一片片直立的舊木板
  const r = rng(11);
  const plank = (x, z, ry) => b.add(box(0.2, 0.62, 0.035), WOOD[Math.floor(r() * 4)], T(x, FLOOR + 0.31, z, 0, ry, 0));
  for (let i = 0; i < 14; i++) {
    plank(-1.3 + i * 0.2, FRONT + 0.012, 0);
    plank(-1.3 + i * 0.2, BODY_Z - 1.012, 0);
  }
  for (let i = 0; i < 10; i++) {
    plank(1.412, BODY_Z - 0.9 + i * 0.2, Math.PI / 2);
    plank(-1.412, BODY_Z - 0.9 + i * 0.2, Math.PI / 2);
  }

  // 柱與橫樑
  const frame = newId();
  for (const x of [-1.4, 1.4]) for (const z of [-1, 1]) b.add(box(0.14, 1.5, 0.14), WOOD_DARK, T(x, FLOOR + 0.75, BODY_Z + z), frame);
  b.add(box(0.1, 1.5, 0.08), WOOD_DARK, T(0.22, FLOOR + 0.75, FRONT + 0.02), frame);
  b.add(box(2.96, 0.12, 2.16), WOOD_DARK, T(0, FLOOR + 1.5, BODY_Z), frame);

  // 山牆
  const gable = new THREE.Shape();
  gable.moveTo(-1.0, 1.8);
  gable.lineTo(1.0, 1.8);
  gable.lineTo(1.0, 2.14);
  gable.lineTo(0, 2.74);
  gable.lineTo(-1.0, 2.14);
  gable.closePath();
  b.add(new THREE.ExtrudeGeometry(gable, { depth: 2.8, bevelEnabled: false }), PLASTER, T(-1.4, 0, BODY_Z, 0, Math.PI / 2, 0));
  for (const sx of [-1, 1]) {
    b.add(box(0.04, 0.5, 0.09), WOOD_DARK, T(sx * 1.42, 2.05, BODY_Z));
    b.add(cyl(0.12, 0.12, 0.04, 10), 0x4b3a30, T(sx * 1.42, 2.36, BODY_Z, 0, 0, Math.PI / 2));
  }

  // 屋瓦：一排排交疊的瓦片
  const ridgeY = 2.78;
  for (const sgn of [1, -1]) {
    b.add(box(3.5, 0.05, 1.75), 0x6b4a36, T(0, ridgeY - 0.47, BODY_Z + sgn * 0.75, sgn * ROOF_ANGLE, 0, 0));
    for (let k = 0; k < 5; k++) {
      const u = (k + 0.5) / 5;
      b.add(
        box(3.62 - k * 0.012, 0.07, 0.44),
        TILE[k % 2],
        T(0, ridgeY - 0.9 + 0.9 * u + 0.045, BODY_Z + sgn * 1.5 * (1 - u), sgn * (ROOF_ANGLE - 0.08), 0, 0),
      );
    }
  }
  const ridge = newId();
  b.add(box(3.76, 0.15, 0.28), 0x2d3546, T(0, ridgeY + 0.05, BODY_Z), ridge);
  for (const sx of [-1, 1]) b.add(box(0.13, 0.26, 0.32), 0x2d3546, T(sx * 1.86, ridgeY + 0.09, BODY_Z), ridge);

  // 窗與門
  windowAt(ctx, T(-0.62, FLOOR + 0.95, FRONT), 1.05, 0.68);
  windowAt(ctx, T(1.4, FLOOR + 1.0, BODY_Z - 0.2, 0, Math.PI / 2, 0), 0.8, 0.56);
  windowAt(ctx, T(0.3, FLOOR + 1.0, BODY_Z - 1.0, 0, Math.PI, 0), 0.9, 0.56);

  const door = newId();
  b.add(box(0.84, 1.3, 0.06), WOOD_DARK, T(0.82, FLOOR + 0.65, FRONT + 0.03), door);
  const lattice = newId();
  for (const x of [-0.12, 0.12]) b.add(box(0.025, 1.18, 0.025), 0x8a5f3f, T(0.82 + x, FLOOR + 0.62, FRONT + 0.085), lattice);
  for (let k = 0; k < 4; k++) b.add(box(0.72, 0.025, 0.025), 0x8a5f3f, T(0.82, FLOOR + 0.2 + k * 0.28, FRONT + 0.085), lattice);
  ctx.glow.add(box(0.72, 1.18, 0.02), 0xffeccb, T(0.82, FLOOR + 0.62, FRONT + 0.065));

  // 暖簾
  for (let k = 0; k < 3; k++) {
    const id = newId();
    b.add(box(0.24, 0.3, 0.015), 0x2b5c8f, T(0.57 + k * 0.25, FLOOR + 1.2, FRONT + 0.13, 0.06 * (k - 1), 0, 0), id);
    b.add(ball(0.05, 8, 6), 0xfff3dc, T(0.57 + k * 0.25, FLOOR + 1.17, FRONT + 0.138, 0, 0, 0, 1, 1, 0.15), id);
  }
  b.add(cyl(0.015, 0.015, 0.9, 6), WOOD_DARK, T(0.82, FLOOR + 1.36, FRONT + 0.13, 0, 0, Math.PI / 2));
}

function buildRoofGear(ctx) {
  const b = ctx.lit;
  const ridgeY = 2.78;

  // 太陽能板（前坡右側）
  b.push(T(0.85, ridgeY - 0.45, BODY_Z + 0.75, ROOF_ANGLE, 0, 0));
  const panel = newId();
  b.add(box(1.1, 0.04, 0.78), 0xd9dee4, T(0, 0.13, 0), panel);
  b.add(box(1.02, 0.03, 0.7), 0x2b4a86, T(0, 0.16, 0), panel);
  const grid = newId();
  for (const x of [-0.17, 0.17]) b.add(box(0.015, 0.012, 0.7), 0x8fb4e0, T(x, 0.18, 0), grid);
  b.add(box(1.02, 0.012, 0.015), 0x8fb4e0, T(0, 0.18, 0), grid);
  b.pop();

  // 天線
  const ant = newId();
  beam(b, [-1.25, ridgeY, BODY_Z], [-1.25, ridgeY + 1.0, BODY_Z], 0.015, 0.02, 0x8c939b, ant, 6);
  b.add(box(0.03, 0.03, 0.62), 0x8c939b, T(-1.25, ridgeY + 0.82, BODY_Z), ant);
  for (let k = 0; k < 5; k++)
    b.add(box(0.46 - k * 0.06, 0.02, 0.02), 0x8c939b, T(-1.25, ridgeY + 0.82, BODY_Z - 0.26 + k * 0.13), ant);

  // 生鏽的煙囪管
  const pipe = newId();
  b.add(cyl(0.08, 0.08, 0.75, 8), RUST, T(0.45, ridgeY - 0.2, BODY_Z - 0.8), pipe);
  b.add(cone(0.16, 0.13, 8), 0x7a4032, T(0.45, ridgeY + 0.24, BODY_Z - 0.8), pipe);

  // 風向標的固定座（會轉的部分另外建立）
  const vane = newId();
  beam(b, [1.3, ridgeY, BODY_Z], [1.3, ridgeY + 0.6, BODY_Z], 0.014, 0.018, 0x4a4f58, vane, 6);
  b.add(box(0.36, 0.02, 0.02), 0x4a4f58, T(1.3, ridgeY + 0.34, BODY_Z), vane);
  b.add(box(0.02, 0.02, 0.36), 0x4a4f58, T(1.3, ridgeY + 0.34, BODY_Z), vane);

  // 屋頂上的苔蘚
  const r = rng(31);
  for (let i = 0; i < 9; i++) {
    const sgn = i < 6 ? 1 : -1;
    const u = 0.1 + r() * 0.6;
    b.add(
      blob(i % 4, 1, 0.3),
      r() < 0.5 ? 0x7fc36a : 0x5fae62,
      T(-1.6 + r() * 1.7, ridgeY - 0.9 + 0.9 * u + 0.1, BODY_Z + sgn * 1.5 * (1 - u), sgn * ROOF_ANGLE, r() * 6, 0, 0.2 + r() * 0.16, 0.05, 0.14 + r() * 0.12),
    );
  }
}

/** 攀在外牆上的藤蔓、苔蘚與熱帶花卉 */
function buildVines(ctx) {
  const r = rng(77);
  const greens = [0x49b56c, 0x6fd17a, 0x379a62, 0x58c26f];
  const flowers = [0xff7a66, 0xff9fb5, 0xffd35a, 0xfff3dc];
  // 沿著牆面的幾條爬升路徑：[起點, 終點, 牆面法線軸, 數量]
  const paths = [
    { a: [-1.42, 0.35, FRONT + 0.06], c: [-0.9, 2.05, FRONT + 0.1], flat: 'z', n: 11 },
    { a: [-1.2, 1.75, FRONT + 0.1], c: [0.1, 1.95, FRONT + 0.1], flat: 'z', n: 7 },
    { a: [1.46, 0.35, BODY_Z + 0.9], c: [1.46, 1.9, BODY_Z - 0.6], flat: 'x', n: 9 },
    { a: [-1.46, 0.4, BODY_Z - 0.9], c: [-1.46, 2.2, BODY_Z - 0.2], flat: 'x', n: 8 },
    { a: [-1.0, 0.35, BODY_Z - 1.06], c: [-0.4, 1.7, BODY_Z - 1.06], flat: 'z', n: 7 },
  ];
  for (const p of paths) {
    let id = newId();
    for (let i = 0; i < p.n; i++) {
      if (i % 4 === 0) id = newId();
      const t = i / (p.n - 1);
      const x = lerp(p.a[0], p.c[0], t) + (p.flat === 'z' ? (r() - 0.5) * 0.4 : 0);
      const y = lerp(p.a[1], p.c[1], t) + (r() - 0.5) * 0.2;
      const z = lerp(p.a[2], p.c[2], t) + (p.flat === 'x' ? (r() - 0.5) * 0.4 : 0);
      const s = 0.2 + r() * 0.14;
      const sx = p.flat === 'x' ? s * 0.45 : s * 1.2;
      const sz = p.flat === 'z' ? s * 0.45 : s * 1.2;
      ctx.lit.add(blob(Math.floor(r() * 6), 1, 0.3), greens[Math.floor(r() * 4)], T(x, y, z, 0, 0, 0, sx, s, sz), id);
      if (r() < 0.75) {
        const out = 0.11;
        ctx.soft.add(
          ball(0.055, 7, 5),
          flowers[Math.floor(r() * 4)],
          T(x + (p.flat === 'x' ? Math.sign(x) * out : (r() - 0.5) * 0.2), y + (r() - 0.3) * 0.15, z + (p.flat === 'z' ? Math.sign(z - BODY_Z) * out : (r() - 0.5) * 0.2)),
        );
      }
    }
  }
}

function buildDeck(ctx, ground) {
  const b = ctx.lit;
  const r = rng(53);
  const z0 = FRONT - 0.03;
  const depth = 1.45;

  // 木平台
  for (let i = 0; i < 13; i++) {
    const x = -1.8 + i * 0.3;
    b.add(box(0.28, 0.07, depth + (r() - 0.5) * 0.08), WOOD[Math.floor(r() * 4)], T(x, FLOOR - 0.035, z0 + depth / 2, 0, (r() - 0.5) * 0.02, 0));
  }
  const under = newId();
  b.add(box(3.9, 0.12, 0.1), 0x7d5a3c, T(0, FLOOR - 0.13, z0 + depth - 0.06), under);
  b.add(box(3.9, 0.12, 0.1), 0x7d5a3c, T(0, FLOOR - 0.13, z0 + 0.6), under);
  for (const x of [-1.85, -0.62, 0.62, 1.85])
    for (const z of [z0 + depth - 0.06, z0 + 0.6])
      beam(b, [x, ground(x, z) - 0.25, z], [x, FLOOR - 0.07, z], 0.05, 0.06, 0x6a4b35, under, 7);

  // 通往沙灘的台階
  for (let k = 0; k < 3; k++) {
    const z = z0 + depth + 0.2 + k * 0.32;
    const y = Math.max(ground(0.95, z) + 0.05, FLOOR - 0.15 * (k + 1));
    b.add(box(0.9, 0.09, 0.3), 0xa9a8a6, T(0.95, y, z, 0, (r() - 0.5) * 0.1, 0));
  }

  // 小桌椅與茶具
  const tx = -1.2;
  const tz = z0 + 0.85;
  const table = newId();
  b.add(cyl(0.3, 0.3, 0.04, 14), 0xcfa678, T(tx, FLOOR + 0.42, tz), table);
  b.add(cyl(0.04, 0.07, 0.4, 8), 0x8a5f3f, T(tx, FLOOR + 0.2, tz), table);
  b.add(cyl(0.16, 0.16, 0.03, 10), 0x8a5f3f, T(tx, FLOOR + 0.015, tz), table);
  for (const [dx, dz] of [[-0.45, 0.25], [0.42, 0.32]]) b.add(cyl(0.12, 0.1, 0.26, 10), 0xb88c5f, T(tx + dx, FLOOR + 0.13, tz + dz));
  const tea = newId();
  b.add(ball(0.07, 9, 7), 0x3f6f8f, T(tx - 0.05, FLOOR + 0.5, tz, 0, 0, 0, 1, 0.8, 1), tea);
  b.add(cyl(0.012, 0.012, 0.1, 5), 0x3f6f8f, T(tx + 0.03, FLOOR + 0.52, tz, 0, 0, -1.1), tea);
  for (const [dx, dz] of [[0.14, 0.1], [0.1, -0.13]]) b.add(cyl(0.03, 0.024, 0.045, 8), 0xfff3dc, T(tx + dx, FLOOR + 0.465, tz + dz));

  // 折疊躺椅（條紋帆布）
  b.push(T(-0.1, FLOOR, z0 + 1.0, 0, -0.35, 0));
  const chair = newId();
  for (const sx of [-1, 1]) {
    beam(b, [sx * 0.27, 0, -0.35], [sx * 0.27, 0.62, 0.3], 0.018, 0.018, 0xb88c5f, chair, 5);
    beam(b, [sx * 0.27, 0, 0.42], [sx * 0.27, 0.42, -0.2], 0.018, 0.018, 0xb88c5f, chair, 5);
  }
  b.add(box(0.58, 0.03, 0.03), 0xb88c5f, T(0, 0.62, 0.3), chair);
  b.add(box(0.58, 0.03, 0.03), 0xb88c5f, T(0, 0.14, -0.25), chair);
  const cloth = newId();
  for (let k = 0; k < 5; k++) {
    const x = (k - 2) * 0.1;
    const color = k % 2 ? 0xfff3dc : 0xff8f6b;
    beamStrip(b, [x, 0.6, 0.29], [x, 0.3, -0.02], 0.1, color, cloth);
    beamStrip(b, [x, 0.3, -0.02], [x, 0.15, -0.25], 0.1, color, cloth);
  }
  b.pop();

  // 門邊的救生圈、舊木箱
  lifebuoy(b, T(1.28, FLOOR + 0.9, FRONT + 0.09));
  b.add(cyl(0.012, 0.012, 0.1, 5), WOOD_DARK, T(1.28, FLOOR + 1.1, FRONT + 0.06, Math.PI / 2));
  crate(b, T(1.55, FLOOR, z0 + 0.38, 0, 0.2, 0), 0.4);
  crate(b, T(1.5, FLOOR + 0.34, z0 + 0.36, 0, -0.35, 0), 0.3);
  crate(b, T(1.02, FLOOR, z0 + 0.3, 0, 0.6, 0), 0.26);

  // 晾漁網的木架
  const rack = newId();
  const rz = z0 + depth - 0.12;
  beam(b, [0.55, FLOOR, rz], [0.55, FLOOR + 1.3, rz], 0.025, 0.03, 0x8a5f3f, rack, 6);
  beam(b, [1.82, FLOOR, rz], [1.82, FLOOR + 1.3, rz], 0.025, 0.03, 0x8a5f3f, rack, 6);
  beam(b, [0.45, FLOOR + 1.25, rz], [1.92, FLOOR + 1.25, rz], 0.02, 0.02, 0x8a5f3f, rack, 6);
  for (const x of [0.75, 1.2, 1.62]) b.add(ball(0.05, 8, 6), 0xff8a4c, T(x, FLOOR + 1.2, rz + 0.02));
}

/** 兩點之間的扁平布條 */
function beamStrip(b, a, c, width, color, id) {
  const va = new THREE.Vector3(...a);
  const vc = new THREE.Vector3(...c);
  const dir = vc.clone().sub(va);
  const len = dir.length();
  const m = new THREE.Matrix4().compose(
    va.add(vc).multiplyScalar(0.5),
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()),
    new THREE.Vector3(1, 1, 1),
  );
  b.add(box(width, len, 0.012), color, m, id);
}

/** 鐵皮棚與棚下雜物 */
function buildShed(ctx, ground) {
  const b = ctx.lit;
  b.push(T(-2.02, 1.5, BODY_Z, 0, 0, 0.27));
  const roof = newId();
  for (let i = 0; i < 6; i++)
    b.add(box(0.215, 0.04 + (i % 2) * 0.025, 1.6), i % 2 ? 0xa3482f : RUST, T((i - 2.5) * 0.215, 0, 0), roof);
  b.pop();
  for (const z of [-0.7, 0.7]) {
    const y = ground(-2.58, BODY_Z + z);
    beam(b, [-2.58, y - 0.2, BODY_Z + z], [-2.58, 1.33, BODY_Z + z], 0.03, 0.035, 0x6a4b35, undefined, 6);
  }
  barrel(b, T(-1.85, ground(-1.85, BODY_Z - 0.4), BODY_Z - 0.4));
  crate(b, T(-2.1, ground(-2.1, BODY_Z + 0.25), BODY_Z + 0.25, 0, 0.3, 0), 0.36);
  // 靠牆的衝浪板
  b.add(ball(1, 14, 8), 0xff8f6b, T(-1.55, FLOOR + 0.75, FRONT - 0.25, 0, 0, 0.12, 0.2, 0.88, 0.03));
  b.add(box(0.05, 1.5, 0.02), 0xfff3dc, T(-1.535, FLOOR + 0.75, FRONT - 0.215, 0, 0, 0.12));
}

function buildLighthouse(ctx, group) {
  const b = ctx.lit;
  const m = T(LIGHTHOUSE.x, LIGHTHOUSE.y, LIGHTHOUSE.z, 0, 0.6, 0);
  b.push(m);
  const white = new THREE.Color(0xfaf4e6);
  const red = new THREE.Color(0xc8523a);
  b.add(cyl(0.62, 0.72, 0.3, 12), 0x8f9199, T(0, 0.12, 0));
  // 塔身：白、鏽紅、白三段
  const tower = newId();
  const radius = (y) => lerp(0.46, 0.29, (y - 0.25) / 2.3);
  for (const [y0, y1, color] of [[0.25, 1.05, white], [1.05, 1.7, red], [1.7, 2.55, white]])
    b.add(new THREE.CylinderGeometry(radius(y1), radius(y0), y1 - y0, 14), color, T(0, (y0 + y1) / 2, 0), tower);
  b.add(box(0.26, 0.5, 0.06), WOOD_DARK, T(0, 0.52, 0.44));
  const gallery = newId();
  b.add(cyl(0.5, 0.42, 0.08, 14), 0x3d4756, T(0, 2.58, 0), gallery);
  b.add(torus(0.47, 0.014, 5, 20), 0x3d4756, T(0, 2.8, 0, Math.PI / 2), gallery);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    b.add(cyl(0.012, 0.012, 0.2, 5), 0x3d4756, T(Math.cos(a) * 0.47, 2.7, Math.sin(a) * 0.47), gallery);
  }
  const bars = newId();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    b.add(box(0.03, 0.42, 0.03), 0x3d4756, T(Math.cos(a) * 0.25, 2.83, Math.sin(a) * 0.25), bars);
  }
  const cap = newId();
  b.add(cone(0.36, 0.32, 10), RUST, T(0, 3.2, 0), cap);
  b.add(ball(0.05, 8, 6), 0x3d4756, T(0, 3.38, 0), cap);
  b.pop();

  ctx.glow.push(m);
  ctx.glow.add(cyl(0.23, 0.23, 0.4, 10), 0xffe9ad, T(0, 2.83, 0));
  ctx.glow.add(box(0.1, 0.16, 0.02), 0xffdf9c, T(0, 1.75, 0.345));
  ctx.glow.pop();

  const h = halo(0xffd890, 2.6, 0.5);
  h.position.set(0, 2.83, 0).applyMatrix4(m);
  group.add(h);
}

export function createHouse(ctx) {
  const group = new THREE.Group();
  const M = HOUSE_MATRIX;
  const inv = HOUSE.y;
  const v = new THREE.Vector3();
  // 局部座標下的地面高度（讓柱腳、道具能貼地）
  const ground = (lx, lz) => {
    v.set(lx, 0, lz).applyMatrix4(M);
    return heightAt(v.x, v.z) - inv;
  };

  for (const b of [ctx.lit, ctx.glow, ctx.soft]) b.push(M);
  buildShell(ctx);
  buildRoofGear(ctx);
  buildVines(ctx);
  buildDeck(ctx, ground);
  buildShed(ctx, ground);
  for (const b of [ctx.lit, ctx.glow, ctx.soft]) b.pop();

  // ---- 會動或會發光的部分 ----
  const local = new THREE.Group();
  local.applyMatrix4(M);
  group.add(local);

  // 風向標
  const vb = new Builder();
  const vid = newId();
  vb.add(box(0.56, 0.025, 0.025), 0x4a4f58, T(0, 0, 0), vid);
  vb.add(cone(0.05, 0.14, 6), RUST, T(0.32, 0, 0, 0, 0, -Math.PI / 2), vid);
  vb.add(box(0.18, 0.16, 0.012), RUST, T(-0.24, 0.03, 0), vid);
  const vane = vb.build(toonMat);
  vane.position.set(1.3, 2.78 + 0.5, BODY_Z);
  local.add(vane);

  // 風鈴
  const cb = new Builder();
  const cid = newId();
  cb.add(cyl(0.004, 0.004, 0.14, 4), 0x6b5a48, T(0, -0.07, 0), cid);
  cb.add(ball(0.065, 10, 7), 0xc8f0f4, T(0, -0.17, 0, 0, 0, 0, 1, 0.85, 1), cid);
  cb.add(cyl(0.004, 0.004, 0.12, 4), 0x6b5a48, T(0, -0.28, 0), cid);
  cb.add(box(0.045, 0.2, 0.006), 0xff8f7a, T(0, -0.44, 0), cid);
  const chime = cb.build(toonMat);
  chime.position.set(0.25, 1.86, FRONT + 0.42);
  local.add(chime);

  // 屋簷下的紙燈籠
  const lid = newId();
  ctx.lit.push(M);
  ctx.lit.add(cyl(0.05, 0.05, 0.03, 8), WOOD_DARK, T(-1.25, 1.72, FRONT + 0.4), lid);
  ctx.lit.add(cyl(0.05, 0.05, 0.03, 8), WOOD_DARK, T(-1.25, 1.44, FRONT + 0.4), lid);
  ctx.lit.pop();
  ctx.glow.push(M);
  ctx.glow.add(ball(0.11, 10, 8), 0xffc98a, T(-1.25, 1.58, FRONT + 0.4, 0, 0, 0, 1, 1.25, 1));
  ctx.glow.pop();

  // 晾曬的漁網
  const net = createNet(1.25, 0.95);
  net.position.set(1.185, FLOOR + 1.24, FRONT - 0.03 + 1.45 - 0.12);
  local.add(net);

  // 庭院燈
  const lampSpots = [
    [0.35, FRONT + 1.75],
    [1.6, FRONT + 1.8],
    [-2.3, FRONT + 1.2],
    [2.35, FRONT + 0.3],
  ];
  for (const [lx, lz] of lampSpots) {
    v.set(lx, 0, lz).applyMatrix4(M);
    group.add(gardenLamp(ctx, T(v.x, heightAt(v.x, v.z) - 0.02, v.z)));
  }

  // 窗光與燈籠的光暈
  const halos = [
    [-0.62, FLOOR + 0.95, FRONT + 0.12, 2.2, 0.42],
    [0.82, FLOOR + 0.65, FRONT + 0.12, 2.0, 0.3],
    [-1.25, 1.58, FRONT + 0.4, 1.1, 0.6],
    [1.5, FLOOR + 1.0, BODY_Z - 0.2, 1.6, 0.35],
    [0.3, FLOOR + 1.0, BODY_Z - 1.1, 1.6, 0.35],
  ];
  for (const [x, y, z, size, op] of halos) {
    const h = halo(0xffc070, size, op);
    h.position.set(x, y, z);
    local.add(h);
  }

  const light = new THREE.PointLight(0xffb060, 3.2, 6, 2);
  light.position.set(0.2, 1.35, FRONT + 0.9);
  local.add(light);

  buildLighthouse(ctx, group);

  ctx.updates.push((t) => {
    vane.rotation.y = 0.6 + Math.sin(t * 0.35) * 0.7 + Math.sin(t * 1.7) * 0.08;
    chime.rotation.z = Math.sin(t * 1.6) * 0.16;
    chime.rotation.x = Math.sin(t * 1.1 + 1) * 0.1;
  });
  return group;
}
