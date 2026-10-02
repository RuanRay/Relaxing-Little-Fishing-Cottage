import * as THREE from 'three';
import { rng, lerp } from '../core/math.js';
import { Builder, T, box, cyl, ball, cone, blob, beam, newId } from '../core/builder.js';
import { toonMat, halo } from '../core/materials.js';
import { HALF, HOUSE, LIGHTHOUSE, heightAt, normalAt } from './terrain.js';
import { HOUSE_MATRIX } from './house.js';
import { dockToWorld, worldToDock, DOCK_LENGTH } from './dock.js';

const CENTER = { x: -0.8, z: -0.9 };
const GREENS = [0x2f9862, 0x45b56c, 0x63c871, 0x86dd7c];
const FLOWERS = [0xff7a66, 0xff9fb5, 0xffd35a, 0xfff3dc, 0xff8f5c];
const ROCKS = [0x6a6d78, 0x8f9199, 0x7c7f89, 0xa9a8a6];

const dockStart = dockToWorld(0.4, 0);
const dist = (x, z, p) => Math.hypot(x - p.x, z - p.z);

// 鳥居與石燈籠的位置：周圍不放岩石與灌木
const TORII = shorePoint(118, -0.38);
const LANTERN = new THREE.Vector3(-1.75, 0, 2.7).applyMatrix4(HOUSE_MATRIX);

const _d = new THREE.Vector3();
function nearDock(x, z) {
  worldToDock(x, z, _d);
  return _d.x > -0.6 && _d.x < DOCK_LENGTH + 1.0 && _d.z > -1.5 && _d.z < 2.8;
}

/** 不擋到建築與碼頭的空地 */
function isFree(x, z, margin = 0) {
  return (
    !nearDock(x, z) &&
    dist(x, z, LANTERN) > 0.9 &&
    (!TORII || dist(x, z, TORII) > 1.0) &&
    dist(x, z, HOUSE) > HOUSE.r + 0.75 + margin &&
    dist(x, z, LIGHTHOUSE) > LIGHTHOUSE.r + 0.35 + margin &&
    dist(x, z, dockStart) > 1.3 + margin
  );
}

/** 沿某個方位角由外往內，找到指定高度的岸邊位置 */
function shorePoint(angleDeg, targetH) {
  const a = (angleDeg * Math.PI) / 180;
  for (let r = 9.5; r > 1; r -= 0.05) {
    const x = CENTER.x + Math.cos(a) * r;
    const z = CENTER.z + Math.sin(a) * r;
    if (Math.max(Math.abs(x), Math.abs(z)) < HALF - 0.6 && heightAt(x, z) > targetH) return { x, z, a };
  }
  return null;
}

// ---- 椰子樹 ------------------------------------------------------------------

function frondGeometry(length, droop) {
  const N = 8;
  const pos = [];
  const idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const w = 0.23 * Math.pow(Math.sin(Math.PI * (0.06 + 0.94 * t)), 0.55) * (1 - t * 0.25);
    const x = t * length;
    const y = 0.22 * length * Math.sin(t * Math.PI * 0.6) - droop * t * t * length;
    pos.push(x, y - w * 0.45, -w, x, y, 0, x, y - w * 0.45, w);
    if (i < N) {
      const a = i * 3;
      idx.push(a, a + 1, a + 3, a + 3, a + 1, a + 4, a + 1, a + 2, a + 4, a + 4, a + 2, a + 5);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function createPalm(ctx, spot, r) {
  const height = 2.3 + r() * 1.1;
  const bend = 0.5 + r() * 0.7;
  const dx = Math.cos(spot.a + (r() - 0.5) * 0.8);
  const dz = Math.sin(spot.a + (r() - 0.5) * 0.8);
  const y0 = heightAt(spot.x, spot.z) - 0.1;

  const trunk = newId();
  const point = (t) => [spot.x + dx * bend * t * t, y0 + height * t, spot.z + dz * bend * t * t];
  const SEGS = 7;
  for (let i = 0; i < SEGS; i++) {
    const t0 = i / SEGS;
    const t1 = (i + 1) / SEGS;
    beam(ctx.lit, point(t0), point(t1), lerp(0.115, 0.07, t1), lerp(0.125, 0.07, t0), i % 2 ? 0xb08a60 : 0x9c7650, trunk, 8);
  }

  const b = new Builder();
  const crown = newId();
  const count = 9;
  for (let k = 0; k < count; k++) {
    const len = 1.15 + r() * 0.45;
    b.add(
      frondGeometry(len, 0.5 + r() * 0.35),
      k % 3 === 0 ? 0x3aa864 : k % 3 === 1 ? 0x57c276 : 0x2f9a60,
      T(0, 0, 0, 0, (k / count) * Math.PI * 2 + r() * 0.3, 0.15 + r() * 0.5),
      crown,
    );
  }
  for (let k = 0; k < 3; k++) {
    const a = k * 2.1 + r();
    b.add(ball(0.095, 8, 6), 0x7a5234, T(Math.cos(a) * 0.12, -0.1, Math.sin(a) * 0.12), crown);
  }
  const mesh = b.build(toonMat);
  const top = point(1);
  mesh.position.set(top[0], top[1], top[2]);
  mesh.userData.phase = r() * 6.28;
  return mesh;
}

// ---- 圓潤的闊葉樹與黑松 --------------------------------------------------------

function addRoundTree(b, x, z, r) {
  const y = heightAt(x, z);
  const h = 0.55 + r() * 0.4;
  const s = 0.75 + r() * 0.45;
  const id = newId();
  beam(b, [x, y - 0.15, z], [x + (r() - 0.5) * 0.15, y + h + 0.2, z + (r() - 0.5) * 0.15], 0.07, 0.11, 0x8a6244, id, 7);
  b.add(blob(Math.floor(r() * 6), 2, 0.16), GREENS[1], T(x, y + h + 0.55 * s, z, 0, r() * 6, 0, 0.78 * s, 0.68 * s, 0.78 * s), id);
  const puffs = 4 + Math.floor(r() * 2);
  for (let k = 0; k < puffs; k++) {
    const a = (k / puffs) * Math.PI * 2 + r();
    b.add(
      blob(Math.floor(r() * 6), 1, 0.2),
      GREENS[0],
      T(x + Math.cos(a) * 0.5 * s, y + h + 0.3 * s + r() * 0.15, z + Math.sin(a) * 0.5 * s, 0, r() * 6, 0, 0.46 * s, 0.4 * s, 0.46 * s),
      id,
    );
  }
  // 受光面的亮色葉團
  b.add(blob(Math.floor(r() * 6), 1, 0.2), GREENS[3], T(x + 0.18 * s, y + h + 0.98 * s, z + 0.12 * s, 0, r() * 6, 0, 0.42 * s, 0.32 * s, 0.42 * s), id);
  b.add(blob(Math.floor(r() * 6), 1, 0.2), GREENS[2], T(x - 0.3 * s, y + h + 0.8 * s, z + 0.3 * s, 0, r() * 6, 0, 0.36 * s, 0.3 * s, 0.36 * s), id);
}

function addPine(b, x, z, r, lean) {
  const y = heightAt(x, z);
  const id = newId();
  const s = 0.85 + r() * 0.35;
  const dx = Math.cos(lean);
  const dz = Math.sin(lean);
  const p0 = [x, y - 0.15, z];
  const p1 = [x + dx * 0.25 * s, y + 0.75 * s, z + dz * 0.25 * s];
  const p2 = [x + dx * 0.1 * s, y + 1.4 * s, z + dz * 0.1 * s];
  const p3 = [x + dx * 0.55 * s, y + 1.95 * s, z + dz * 0.55 * s];
  beam(b, p0, p1, 0.085, 0.12, 0x6b4a3a, id, 7);
  beam(b, p1, p2, 0.065, 0.085, 0x6b4a3a, id, 7);
  beam(b, p2, p3, 0.045, 0.065, 0x6b4a3a, id, 7);
  const side = [x + dx * 0.95 * s, y + 1.05 * s, z + dz * 0.95 * s];
  beam(b, p1, side, 0.035, 0.055, 0x6b4a3a, id, 6);
  // 一層層扁平的雲狀松針
  const pads = [
    [p3, 0.7],
    [[p2[0] - dx * 0.35 * s, p2[1] + 0.1, p2[2] - dz * 0.35 * s], 0.5],
    [side, 0.55],
  ];
  for (const [p, size] of pads) {
    const pid = newId();
    b.add(blob(Math.floor(r() * 6), 1, 0.22), 0x2b7f5a, T(p[0], p[1], p[2], 0, r() * 6, 0, size * s, size * 0.32 * s, size * 0.85 * s), pid);
    b.add(blob(Math.floor(r() * 6), 1, 0.22), 0x3d9a68, T(p[0] + 0.05, p[1] + size * 0.2 * s, p[2], 0, r() * 6, 0, size * 0.65 * s, size * 0.22 * s, size * 0.55 * s), pid);
  }
}

// ---- 鳥居（立在淺海中的前景） --------------------------------------------------

function addTorii(b) {
  const spot = TORII;
  if (!spot) return;
  const y0 = heightAt(spot.x, spot.z);
  const VERMILION = 0xd9472f;
  const DARK = 0x2e2a33;
  b.push(T(spot.x, 0, spot.z, 0, -spot.a + Math.PI / 2, 0));
  const id = newId();
  for (const sx of [-1, 1]) {
    beam(b, [sx * 0.5, y0 - 0.2, 0], [sx * 0.46, 1.32, 0], 0.06, 0.075, VERMILION, id, 10);
    b.add(cyl(0.095, 0.105, 0.3, 10), DARK, T(sx * 0.5, y0 + 0.1, 0), id);
  }
  b.add(box(1.3, 0.09, 0.07), VERMILION, T(0, 0.95, 0), id);
  b.add(box(0.1, 0.26, 0.05), VERMILION, T(0, 1.14, 0), id);
  b.add(box(1.5, 0.11, 0.13), VERMILION, T(0, 1.34, 0), id);
  const cap = newId();
  b.add(box(1.3, 0.07, 0.19), DARK, T(0, 1.43, 0), cap);
  for (const sx of [-1, 1]) {
    b.add(box(0.36, 0.11, 0.13), VERMILION, T(sx * 0.82, 1.365, 0, 0, 0, sx * 0.16), id);
    b.add(box(0.4, 0.07, 0.19), DARK, T(sx * 0.84, 1.46, 0, 0, 0, sx * 0.16), cap);
  }
  b.pop();
}

// ---- 石燈籠與踏石小徑 ----------------------------------------------------------

function addStoneLantern(ctx, group, x, z) {
  const y = heightAt(x, z) - 0.03;
  const STONE = 0xa3a5a8;
  const id = newId();
  const b = ctx.lit;
  b.add(cyl(0.2, 0.24, 0.1, 6), STONE, T(x, y + 0.05, z), id);
  b.add(cyl(0.07, 0.09, 0.42, 6), STONE, T(x, y + 0.31, z), id);
  b.add(cyl(0.17, 0.11, 0.07, 6), STONE, T(x, y + 0.55, z), id);
  b.add(box(0.2, 0.18, 0.2), 0x8f9199, T(x, y + 0.67, z), id);
  b.add(cone(0.27, 0.16, 6), 0x7c7f89, T(x, y + 0.84, z), id);
  b.add(ball(0.045, 7, 5), STONE, T(x, y + 0.95, z), id);
  for (const ry of [0, Math.PI / 2]) ctx.glow.add(box(0.11, 0.1, 0.215), 0xffd98a, T(x, y + 0.67, z, 0, ry, 0));
  const h = halo(0xffc070, 1.0, 0.55);
  h.position.set(x, y + 0.67, z);
  group.add(h);
}

function addPath(b, r) {
  const from = new THREE.Vector3(0.95, 0, 3.3).applyMatrix4(HOUSE_MATRIX);
  const to = dockToWorld(0.2, 0);
  const count = 11;
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const bow = Math.sin(t * Math.PI) * 0.6;
    const x = lerp(from.x, to.x, t) + (r() - 0.5) * 0.14 - bow * 0.3;
    const z = lerp(from.z, to.z, t) + (r() - 0.5) * 0.14 + bow;
    const y = heightAt(x, z);
    if (y < 0.2) continue;
    const n = normalAt(x, z);
    const s = 0.17 + r() * 0.08;
    b.add(cyl(s, s * 1.08, 0.07, 7), r() < 0.5 ? 0xc9c5bb : 0xb4b2ae, T(x, y + 0.012, z, n.z * 0.9, 0, -n.x * 0.9, 1, 1, 0.8 + r() * 0.3));
  }
}

// ---- 組裝 --------------------------------------------------------------------

export function createFlora(ctx) {
  const group = new THREE.Group();
  const r = rng(2026);
  const b = ctx.lit;

  // 椰子樹：沿著沙灘邊緣
  const palms = [];
  for (const deg of [8, 62, 98, 140, 172, 205, 300, 338]) {
    const spot = shorePoint(deg + (r() - 0.5) * 8, 0.5);
    if (!spot || !isFree(spot.x, spot.z, 0.2)) continue;
    const palm = createPalm(ctx, spot, r);
    ctx.colliders.push({ x: spot.x, z: spot.z, r: 0.16 });
    palms.push(palm);
    group.add(palm);
  }

  // 闊葉樹：覆蓋中央丘陵
  const trees = [];
  for (let i = 0; i < 400 && trees.length < 12; i++) {
    const x = lerp(-7, 5, r());
    const z = lerp(-7, 3, r());
    if (heightAt(x, z) < 1.25 || normalAt(x, z).y < 0.8 || !isFree(x, z, 0.5)) continue;
    if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 1.45)) continue;
    trees.push({ x, z });
    addRoundTree(b, x, z, r);
    ctx.colliders.push({ x, z, r: 0.16 });
  }

  // 黑松：懸崖與燈塔一帶
  for (const [px, pz, lean] of [
    [LIGHTHOUSE.x + 1.3, LIGHTHOUSE.z - 0.5, -2.3],
    [LIGHTHOUSE.x - 0.3, LIGHTHOUSE.z + 1.5, 2.7],
    [HOUSE.x - 2.9, HOUSE.z + 0.9, 2.2],
  ]) {
    addPine(b, px, pz, r, lean);
    ctx.colliders.push({ x: px, z: pz, r: 0.16 });
  }

  // 灌木與花叢
  for (let i = 0, placed = 0; i < 600 && placed < 42; i++) {
    const x = lerp(-8, 7, r());
    const z = lerp(-8, 7, r());
    const y = heightAt(x, z);
    if (y < 0.68 || normalAt(x, z).y < 0.7 || !isFree(x, z)) continue;
    placed++;
    const id = newId();
    const n = 2 + Math.floor(r() * 2);
    for (let k = 0; k < n; k++) {
      const s = 0.17 + r() * 0.16;
      const px = x + (r() - 0.5) * 0.3;
      const pz = z + (r() - 0.5) * 0.3;
      b.add(blob(Math.floor(r() * 6), 1, 0.25), GREENS[Math.floor(r() * 4)], T(px, y + s * 0.55, pz, 0, r() * 6, 0, s * 1.15, s * 0.9, s * 1.15), id);
      if (r() < 0.6) {
        const c = FLOWERS[Math.floor(r() * FLOWERS.length)];
        for (let q = 0; q < 3; q++) ctx.soft.add(ball(0.05, 7, 5), c, T(px + (r() - 0.5) * s * 1.6, y + s * (1.1 + r() * 0.35), pz + (r() - 0.5) * s * 1.6));
      }
    }
  }

  // 草叢與野花（不描邊的細節）
  for (let i = 0, placed = 0; i < 1500 && placed < 190; i++) {
    const x = lerp(-8.5, 8, r());
    const z = lerp(-8.5, 8, r());
    const y = heightAt(x, z);
    if (y < 0.66 || normalAt(x, z).y < 0.75 || dist(x, z, HOUSE) < HOUSE.r - 0.3) continue;
    placed++;
    if (r() < 0.7) {
      for (let k = 0; k < 3; k++)
        ctx.soft.add(cone(0.035, 0.17 + r() * 0.1, 4), r() < 0.5 ? 0x4fb86a : 0xb9e77e, T(x + (k - 1) * 0.05, y + 0.08, z + (r() - 0.5) * 0.06, (r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5));
    } else {
      ctx.soft.add(cyl(0.008, 0.008, 0.14, 4), 0x4fb86a, T(x, y + 0.07, z));
      ctx.soft.add(ball(0.05, 7, 5), FLOWERS[Math.floor(r() * FLOWERS.length)], T(x, y + 0.16, z, 0, 0, 0, 1, 0.7, 1));
    }
  }

  // 岩礁：沙灘、淺海與崖腳
  for (let i = 0, placed = 0; i < 900 && placed < 46; i++) {
    const x = lerp(-9.2, 9.2, r());
    const z = lerp(-9.2, 9.2, r());
    const y = heightAt(x, z);
    const inWater = y < -0.15 && y > -0.85;
    const onShore = y > 0.05 && y < 0.5;
    if (!(inWater || onShore) || !isFree(x, z, -0.4)) continue;
    if (onShore && r() < 0.55) continue;
    placed++;
    const s = inWater ? 0.22 + r() * 0.42 : 0.1 + r() * 0.2;
    const id = newId();
    b.add(blob(Math.floor(r() * 6), 1, 0.26), ROCKS[Math.floor(r() * 4)], T(x, y + s * 0.25, z, r() * 0.4, r() * 6, r() * 0.4, s * (1 + r() * 0.5), s * (0.75 + r() * 0.6), s), id);
    if (r() < 0.5) b.add(blob(Math.floor(r() * 6), 1, 0.26), ROCKS[Math.floor(r() * 4)], T(x + s * 0.9, y + s * 0.1, z + (r() - 0.5) * s, 0, r() * 6, 0, s * 0.6, s * 0.5, s * 0.55), id);
  }

  // 崖面上嵌著的岩塊與攀附的灌木
  for (let i = 0, placed = 0; i < 2500 && placed < 46; i++) {
    const x = lerp(-8.5, 6, r());
    const z = lerp(-8.5, 6, r());
    const y = heightAt(x, z);
    const ny = normalAt(x, z).y;
    if (y < 0.5 || ny > 0.62 || !isFree(x, z, -0.5)) continue;
    placed++;
    if (r() < 0.6) {
      const s = 0.16 + r() * 0.3;
      b.add(blob(Math.floor(r() * 6), 1, 0.26), ROCKS[Math.floor(r() * 4)], T(x, y, z, r() * 3, r() * 6, r() * 3, s * 1.2, s * 0.8, s));
    } else {
      const s = 0.2 + r() * 0.18;
      const id = newId();
      b.add(blob(Math.floor(r() * 6), 1, 0.25), GREENS[Math.floor(r() * 3)], T(x, y + s * 0.3, z, 0, r() * 6, 0, s * 1.2, s * 0.8, s * 1.2), id);
      b.add(blob(Math.floor(r() * 6), 1, 0.25), GREENS[3], T(x + s * 0.5, y + s * 0.5, z + s * 0.2, 0, r() * 6, 0, s * 0.7, s * 0.55, s * 0.7), id);
    }
  }

  // 沙灘上的貝殼與海星
  for (let i = 0, placed = 0; i < 500 && placed < 26; i++) {
    const x = lerp(-8, 8, r());
    const z = lerp(-8, 8, r());
    const y = heightAt(x, z);
    if (y < 0.06 || y > 0.42) continue;
    placed++;
    if (r() < 0.65) ctx.soft.add(ball(0.06, 8, 5), r() < 0.5 ? 0xfff8ea : 0xf9c9b0, T(x, y + 0.015, z, 0, r() * 6, 0, 1, 0.4, 0.8));
    else ctx.soft.add(cyl(0.08, 0.08, 0.025, 5), 0xff8f5c, T(x, y + 0.02, z, 0, r() * 6, 0));
  }

  addTorii(b);
  addPath(b, r);
  addStoneLantern(ctx, group, LANTERN.x, LANTERN.z);
  ctx.colliders.push({ x: LANTERN.x, z: LANTERN.z, r: 0.22 });

  ctx.updates.push((t) => {
    for (const p of palms) {
      p.rotation.z = Math.sin(t * 0.8 + p.userData.phase) * 0.045;
      p.rotation.x = Math.sin(t * 0.6 + p.userData.phase * 1.7) * 0.035;
    }
  });
  return group;
}
