import * as THREE from 'three';
import { rng, noise, smooth, lerp } from '../core/math.js';
import { Builder, T, box, cyl, ball, cone, torus, blob, tube, ribbon, beam, newId } from '../core/builder.js';
import { toonMat, halo } from '../core/materials.js';
import { HALF, heightAt } from './terrain.js';
import { WOOD, RUST, crate, barrel, buoy, createNet } from './props.js';

// ---- 碼頭位置：從海灣的沙灘沿固定方向伸入淺海 ---------------------------------

const ANGLE = 0.62;
const DECK_Y = 0.42;

function locate() {
  const dir = new THREE.Vector2(Math.cos(ANGLE), Math.sin(ANGLE));
  let r = 2.5;
  // 從島中心往外走，找到沙灘（略高於水面處）
  while (r < 9 && heightAt(-0.8 + dir.x * r, -0.9 + dir.y * r) > 0.34) r += 0.05;
  const origin = new THREE.Vector2(-0.8 + dir.x * (r - 0.3), -0.9 + dir.y * (r - 0.3));
  let length = 4.6;
  while (Math.max(Math.abs(origin.x + dir.x * (length + 0.9)), Math.abs(origin.y + dir.y * (length + 0.9))) > HALF - 0.9) length -= 0.1;
  return { origin, length };
}

const { origin, length: LENGTH } = locate();
export const DOCK_MATRIX = T(origin.x, 0, origin.y, 0, -ANGLE, 0);
export const DOCK_LENGTH = LENGTH;

const DOCK_INVERSE = DOCK_MATRIX.clone().invert();
/** 世界座標 → 碼頭局部座標（x 沿棧橋向海、z 為橫向） */
export function worldToDock(x, z, out = new THREE.Vector3()) {
  return out.set(x, 0, z).applyMatrix4(DOCK_INVERSE);
}

const _v = new THREE.Vector3();
export function dockToWorld(lx, lz, out = new THREE.Vector3()) {
  return out.set(lx, 0, lz).applyMatrix4(DOCK_MATRIX);
}
const ground = (lx, lz) => {
  dockToWorld(lx, lz, _v);
  return heightAt(_v.x, _v.z);
};

// ---- 棧橋 --------------------------------------------------------------------

const END_WIDE = 1.3; // 末端加寬成小平台

function buildPier(ctx) {
  const b = ctx.lit;
  const r = rng(303);
  const L = LENGTH;

  // 略微彎曲、老化的木板
  const count = Math.floor(L / 0.23);
  for (let i = 0; i < count; i++) {
    const x = 0.1 + i * 0.23;
    if (i === 7) continue; // 缺了一片
    const atEnd = x > L - END_WIDE;
    let width = (atEnd ? 1.95 : 1.05) + (r() - 0.5) * 0.1;
    let z = atEnd ? 0.3 : 0;
    if (i === 12) {
      width *= 0.6; // 斷掉的半片
      z = -0.2;
    }
    const sag = 0.035 * Math.sin(x * 1.9) + (r() - 0.5) * 0.02;
    b.add(
      box(0.2, 0.05, width),
      [...WOOD, 0x957352, 0x8a6a4c][Math.floor(r() * 6)],
      T(x, DECK_Y + sag, z, (r() - 0.5) * 0.05, (r() - 0.5) * 0.05, (r() - 0.5) * 0.06),
    );
  }

  // 縱樑
  const frame = newId();
  for (const z of [-0.4, 0.4]) b.add(box(L, 0.09, 0.09), 0x7d5a3c, T(L / 2, DECK_Y - 0.07, z), frame);
  b.add(box(0.09, 0.09, 2.0), 0x7d5a3c, T(L - 0.1, DECK_Y - 0.07, 0.3), frame);
  b.add(box(END_WIDE, 0.09, 0.09), 0x7d5a3c, T(L - END_WIDE / 2, DECK_Y - 0.07, 1.2), frame);

  // 樁柱：水線附近長著青苔
  const posts = [];
  for (let x = 0.5; x < L - 0.2; x += 1.02) posts.push([x, -0.52], [x, 0.52]);
  posts.push([L - 0.08, -0.6], [L - 0.08, 1.24], [L - END_WIDE + 0.1, 1.24]);
  const tops = [];
  for (const [x, z] of posts) {
    const g = ground(x, z);
    const top = DECK_Y + 0.12 + r() * 0.42;
    const id = newId();
    beam(b, [x + (r() - 0.5) * 0.05, g - 0.3, z], [x, top, z], 0.06, 0.075, 0x6a4b35, id, 8);
    b.add(cyl(0.062, 0.062, 0.02, 8), 0x8a6a4c, T(x, top + 0.005, z), id);
    if (g < -0.05) b.add(cyl(0.082, 0.086, 0.2, 8), 0x4d8a66, T(x, -0.02, z), id);
    tops.push([x, top, z]);
  }

  // 樁柱之間垂掛的繩索
  const back = tops.filter((p) => p[2] < -0.4).sort((a, c) => a[0] - c[0]);
  for (let i = 0; i < back.length - 1; i++) {
    const a = back[i];
    const c = back[i + 1];
    const mid = [(a[0] + c[0]) / 2, Math.min(a[1], c[1]) - 0.16, (a[2] + c[2]) / 2];
    b.add(tube([[a[0], a[1] - 0.05, a[2]], mid, [c[0], c[1] - 0.05, c[2]]], 0.014, 10, 5), 0xd9c79a);
  }
  return tops;
}

function buildPierProps(ctx, group) {
  const b = ctx.lit;
  const L = LENGTH;
  const y = DECK_Y + 0.03;

  barrel(b, T(1.25, y, -0.3));
  crate(b, T(1.75, y, -0.3, 0, 0.25, 0), 0.3);

  // 魚簍與漁獲
  const basket = newId();
  b.add(cyl(0.17, 0.12, 0.24, 10, true), 0xcfa76b, T(2.35, y + 0.12, 0.25), basket);
  b.add(cyl(0.12, 0.12, 0.02, 10), 0xb38a55, T(2.35, y + 0.01, 0.25), basket);
  b.add(torus(0.17, 0.016, 5, 12), 0xa87a48, T(2.35, y + 0.24, 0.25, Math.PI / 2), basket);
  for (const [dx, dz, ry] of [[-0.03, 0.02, 0.4], [0.04, -0.03, 2.0]])
    b.add(ball(0.09, 8, 6), 0xbfd4e0, T(2.35 + dx, y + 0.2, 0.25 + dz, 0, ry, 0.3, 1, 0.42, 0.3));

  // 堆在一起的漁網與浮子
  const pile = newId();
  b.add(blob(2, 1, 0.3), 0x4fa69c, T(L - 0.85, y + 0.06, -0.15, 0, 0.4, 0, 0.34, 0.11, 0.28), pile);
  b.add(blob(4, 1, 0.3), 0x3f8f8a, T(L - 0.6, y + 0.05, 0.05, 0, 1.4, 0, 0.24, 0.09, 0.2), pile);
  for (const [dx, dz] of [[-1.0, 0.05], [-0.7, -0.3], [-0.5, 0.2]]) b.add(ball(0.05, 8, 6), 0xff8a4c, T(L + dx, y + 0.13, dz));

  // 浮球
  buoy(b, T(L - 0.45, y, 0.75), 0xff7d4d, 0.14);
  buoy(b, T(L - 0.75, y, 0.95, 0, 0, 0), 0xffc94d, 0.11);
  buoy(b, T(L - 1.05, y, 0.82, 0.5, 0, 0.9), 0x3fb6c8, 0.1);

  // 盤起來的繩索
  const coil = newId();
  for (let k = 0; k < 3; k++) b.add(torus(0.13 - k * 0.012, 0.028, 6, 14), 0xd9c79a, T(3.1, y + 0.03 + k * 0.045, 0.28, Math.PI / 2), coil);
  b.add(tube([[3.22, y + 0.03, 0.3], [3.4, y + 0.02, 0.2], [3.5, y + 0.02, -0.1], [3.42, y + 0.02, -0.4]], 0.02, 12, 5), 0xd9c79a, null, coil);

  // 靠在樁柱旁的錨
  b.push(T(L - 0.35, y, -0.42, 0, 0.5, -0.3));
  const anchor = newId();
  b.add(cyl(0.022, 0.022, 0.56, 6), 0x4a4f58, T(0, 0.33, 0), anchor);
  b.add(torus(0.05, 0.013, 5, 10), 0x4a4f58, T(0, 0.65, 0), anchor);
  b.add(box(0.26, 0.03, 0.03), 0x4a4f58, T(0, 0.52, 0), anchor);
  b.add(torus(0.17, 0.024, 6, 12, Math.PI), 0x4a4f58, T(0, 0.22, 0, 0, 0, Math.PI), anchor);
  for (const sx of [-1, 1]) b.add(cone(0.05, 0.11, 4), RUST, T(sx * 0.17, 0.26, 0, 0, 0, sx * 0.5), anchor);
  b.pop();

  // 折疊梯：從平台末端伸入水中
  const ladder = newId();
  for (const z of [0.5, 0.86]) beam(b, [L + 0.16, -0.75, z], [L + 0.04, DECK_Y + 0.42, z], 0.018, 0.018, 0xc7ccd1, ladder, 6);
  for (let k = 0; k < 6; k++) {
    const t = k / 5;
    b.add(cyl(0.014, 0.014, 0.36, 5), 0xaab0b7, T(lerp(L + 0.15, L + 0.05, t), lerp(-0.6, DECK_Y + 0.25, t), 0.68, Math.PI / 2), ladder);
  }

  // 小型信號燈
  const lampId = newId();
  const lx = L - 0.08;
  const lz = 1.24;
  beam(b, [lx, DECK_Y, lz], [lx, DECK_Y + 1.5, lz], 0.022, 0.03, 0x4a4f58, lampId, 6);
  b.add(box(0.2, 0.025, 0.03), 0x4a4f58, T(lx - 0.08, DECK_Y + 1.42, lz), lampId);
  b.add(cyl(0.07, 0.07, 0.025, 8), 0x3d4756, T(lx, DECK_Y + 1.52, lz), lampId);
  b.add(cone(0.1, 0.1, 8), RUST, T(lx, DECK_Y + 1.74, lz), lampId);
  ctx.glow.add(cyl(0.055, 0.055, 0.16, 8), 0xff7a55, T(lx, DECK_Y + 1.61, lz));
  const h = halo(0xff8050, 1.3, 0.6);
  h.position.set(lx, DECK_Y + 1.61, lz).applyMatrix4(DOCK_MATRIX);
  group.add(h);

  // 掛在平台邊的漁網
  const net = createNet(0.9, 0.5);
  net.position.set(L - 0.7, DECK_Y + 0.02, -0.705);
  const holder = new THREE.Group();
  holder.applyMatrix4(DOCK_MATRIX);
  holder.add(net);
  group.add(holder);
}

// ---- 碼頭下方：礁石、海草、貝殼 ------------------------------------------------

function buildSeabed(ctx) {
  const b = ctx.lit;
  const r = rng(808);
  const L = LENGTH;
  const rocks = [0x6a6d78, 0x8f9199, 0x7c7f89];
  for (let i = 0; i < 9; i++) {
    const x = lerp(1.2, L + 0.8, r());
    const z = lerp(-1.6, 2.4, r());
    const g = ground(x, z);
    if (g > -0.15) continue;
    const s = Math.min(0.16 + r() * 0.26, (-g - 0.06) / 1.1);
    b.add(blob(Math.floor(r() * 6), 1, 0.25), rocks[Math.floor(r() * 3)], T(x, g + s * 0.3, z, 0, r() * 6, 0, s * 1.3, s * 0.8, s));
  }
  // 海草：自海床向上生長
  for (let i = 0; i < 16; i++) {
    const x = lerp(1.0, L + 0.6, r());
    const z = lerp(-1.4, 2.0, r());
    const g = ground(x, z);
    if (g > -0.3) continue;
    const id = newId();
    const strands = 3 + Math.floor(r() * 3);
    for (let k = 0; k < strands; k++) {
      const len = Math.min(-g - 0.06, 0.3 + r() * 0.45);
      b.add(
        ribbon(len, 0.035 + r() * 0.02, r() * 6, 0.08),
        r() < 0.5 ? 0x2f9c72 : 0x47b580,
        T(x + (r() - 0.5) * 0.16, g, z + (r() - 0.5) * 0.16, Math.PI, r() * 6, 0),
        id,
      );
    }
  }
  // 貝殼與海星
  for (let i = 0; i < 12; i++) {
    const x = lerp(0.6, L + 0.8, r());
    const z = lerp(-1.6, 2.2, r());
    const g = ground(x, z);
    if (g > 0.1) continue;
    if (r() < 0.6) ctx.soft.add(ball(0.07, 8, 5), r() < 0.5 ? 0xfff4de : 0xf9c9b0, T(x, g + 0.02, z, 0, r() * 6, 0, 1, 0.4, 0.8));
    else ctx.soft.add(cyl(0.09, 0.09, 0.025, 5), 0xff8f5c, T(x, g + 0.02, z, 0, r() * 6, 0));
  }
}

// ---- 小漁船 ------------------------------------------------------------------

function hullProfile(u) {
  const w = 0.44 * (u < 0.4 ? lerp(0.7, 1, smooth(0, 0.4, u)) : Math.pow(Math.cos(((u - 0.4) / 0.6) * Math.PI * 0.5), 0.7));
  return {
    x: (u - 0.5) * 2.2,
    w: Math.max(w, 0.015),
    gunwale: 0.25 + 0.15 * Math.pow(u, 2.4) + 0.03 * (1 - u) * (1 - u),
    keel: -0.13 * (1 - 0.92 * u * u * u),
  };
}

function hullGeometry() {
  const S = 16;
  const R = 10;
  const pos = [];
  const idx = [];
  for (let i = 0; i <= S; i++) {
    const p = hullProfile(i / S);
    for (let j = 0; j <= R; j++) {
      const phi = (j / R - 0.5) * Math.PI;
      const s = Math.sin(phi);
      pos.push(p.x, lerp(p.gunwale, p.keel, Math.pow(Math.cos(phi), 1.3)), p.w * Math.sign(s) * Math.pow(Math.abs(s), 0.8));
    }
  }
  const n = R + 1;
  for (let i = 0; i < S; i++) {
    for (let j = 0; j < R; j++) {
      const a = i * n + j;
      const b = a + n;
      const c = a + 1;
      const d = b + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  // 船尾板
  const stern = hullProfile(0);
  const center = pos.length / 3;
  pos.push(stern.x, stern.gunwale, 0);
  for (let j = 0; j < R; j++) idx.push(center, j, j + 1);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 船艙底板（高於水面，避免海水「穿」進船內） */
function floorGeometry(y) {
  const S = 16;
  const pos = [];
  const idx = [];
  for (let i = 0; i <= S; i++) {
    const p = hullProfile(i / S);
    let z = 0;
    let fy = y;
    if (y > p.keel) {
      const c = Math.pow((p.gunwale - y) / (p.gunwale - p.keel), 1 / 1.3);
      z = p.w * Math.pow(Math.sqrt(Math.max(0, 1 - c * c)), 0.8) * 0.97;
    } else fy = p.keel;
    pos.push(p.x, fy, -z, p.x, fy, z);
    if (i < S) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function createBoat() {
  const b = new Builder();
  const cream = new THREE.Color(0xf6eedb);
  const worn = new THREE.Color(0xd8cbb0);
  const teal = new THREE.Color(0x2f9c95);
  const red = new THREE.Color(0xb1513c);
  const redDark = new THREE.Color(0x8e3f30);
  const hull = newId();

  // 船殼：水線下為防污紅漆，中段一道青綠飾帶，並帶有海水侵蝕的斑駁
  b.add(
    hullGeometry(),
    (p, out) => {
      const n = noise(p.x * 5 + 3, p.y * 14 + p.z * 6);
      if (p.y < 0.035 + (n - 0.5) * 0.05) out.copy(n > 0.62 ? redDark : red);
      else if (p.y < 0.105) out.copy(teal);
      else out.copy(n > 0.66 ? worn : cream);
    },
    null,
    hull,
  );
  b.add(floorGeometry(0.06), 0xc49a6c, null, hull);

  // 船舷護條
  for (const side of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const p = hullProfile(i / 16);
      pts.push([p.x, p.gunwale + 0.005, side * p.w]);
    }
    b.add(tube(pts, 0.024, 24, 6), 0x7d5a3c, null, hull);
  }

  // 座板
  for (const u of [0.24, 0.56]) {
    const p = hullProfile(u);
    b.add(box(0.14, 0.03, p.w * 1.9), 0xb88c5f, T(p.x, 0.18, 0));
  }

  // 槳
  for (const side of [-1, 1]) {
    const id = newId();
    beam(b, [-0.75, 0.2, side * 0.12], [0.55, 0.3, side * 0.2], 0.014, 0.016, 0xcfa678, id, 6);
    b.add(box(0.28, 0.02, 0.085), 0xcfa678, T(0.66, 0.31, side * 0.207, 0, -side * 0.06, 0.08), id);
  }

  // 帆布、工具箱、水桶
  const canvas = newId();
  b.add(blob(1, 1, 0.3), 0xe9dfc4, T(-0.62, 0.11, 0.02, 0, 0.3, 0, 0.3, 0.07, 0.22), canvas);
  b.add(blob(3, 1, 0.3), 0xd9cdb0, T(-0.5, 0.14, -0.08, 0, 1.2, 0, 0.17, 0.05, 0.14), canvas);
  const tool = newId();
  b.add(box(0.2, 0.1, 0.12), 0xb5493a, T(0.12, 0.115, -0.12, 0, 0.3, 0), tool);
  b.add(box(0.1, 0.02, 0.02), 0x4a4f58, T(0.12, 0.175, -0.12, 0, 0.3, 0), tool);
  b.add(cyl(0.06, 0.05, 0.11, 8), 0x3f8fc0, T(0.34, 0.12, 0.14));
  // 船側的舊輪胎碰墊
  b.add(torus(0.075, 0.03, 6, 12), 0x3a3d45, T(0.1, 0.16, -0.455));
  // 船首繫纜樁
  b.add(cyl(0.02, 0.02, 0.1, 6), 0x7d5a3c, T(0.92, 0.37, 0));

  return b.build(toonMat);
}

// ---- 組裝 --------------------------------------------------------------------

export function createDock(ctx) {
  const group = new THREE.Group();

  for (const b of [ctx.lit, ctx.glow, ctx.soft]) b.push(DOCK_MATRIX);
  buildPier(ctx);
  buildPierProps(ctx, group);
  buildSeabed(ctx);

  // 漁船繫在棧橋外側
  const boatPos = new THREE.Vector3(LENGTH - 2.15, 0, 1.62);
  // 繫纜繩
  ctx.lit.add(
    tube(
      [
        [boatPos.x + 0.92, 0.4, boatPos.z + 0.09],
        [boatPos.x + 1.0, 0.3, boatPos.z - 0.12],
        [LENGTH - END_WIDE + 0.1, DECK_Y + 0.2, 1.24],
      ],
      0.012,
      10,
      5,
    ),
    0xd9c79a,
  );
  for (const b of [ctx.lit, ctx.glow, ctx.soft]) b.pop();

  const boatHolder = new THREE.Group();
  boatHolder.applyMatrix4(DOCK_MATRIX);
  const boat = createBoat();
  boat.position.copy(boatPos);
  boat.rotation.y = -0.1;
  boatHolder.add(boat);
  group.add(boatHolder);

  ctx.updates.push((t) => {
    boat.position.y = Math.sin(t * 1.1) * 0.018;
    boat.rotation.x = Math.sin(t * 0.9 + 0.5) * 0.035;
    boat.rotation.z = Math.sin(t * 0.7) * 0.015;
  });
  return group;
}
