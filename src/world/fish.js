import * as THREE from 'three';
import { rng } from '../core/math.js';
import { Builder, T, ball, cone, box, newId } from '../core/builder.js';
import { toonMat } from '../core/materials.js';
import { heightAt } from './terrain.js';
import { dockToWorld, DOCK_LENGTH } from './dock.js';

const COLORS = [
  [0xff8a4c, 0xfff3dc],
  [0xffc94d, 0xff8a4c],
  [0xfff3dc, 0xff6f55],
  [0x5aa9e6, 0xfff3dc],
  [0xff9fb5, 0xfff3dc],
];

function createFish(colors, size) {
  const group = new THREE.Group();
  const id = newId();
  const body = new THREE.Color(colors[0]);
  const patch = new THREE.Color(colors[1]);

  const b = new Builder();
  // 頭朝 +x；背上帶一塊色斑
  b.add(ball(1, 10, 8), (p, out) => out.copy(p.x < -0.15 && p.y > -0.2 ? patch : body), T(0, 0, 0, 0, 0, 0, 0.5, 0.2, 0.13), id);
  b.add(box(0.2, 0.14, 0.012), colors[0], T(-0.05, 0.2, 0, 0, 0, -0.5), id);
  for (const s of [-1, 1]) b.add(ball(0.035, 6, 5), 0x1b2430, T(0.33, 0.04, s * 0.085), id);
  const bodyMesh = b.build(toonMat, { shadow: false });

  const t = new Builder();
  t.add(cone(0.2, 0.34, 4), colors[1], T(-0.15, 0, 0, 0, 0, -Math.PI / 2, 1, 1, 0.12), id);
  const tail = t.build(toonMat, { shadow: false });
  tail.position.x = -0.42;

  group.add(bodyMesh, tail);
  group.scale.setScalar(size);
  group.userData.tail = tail;
  return group;
}

/** 在碼頭下方的透明淺水中巡游的小魚 */
export function createFishSchool(ctx) {
  const group = new THREE.Group();
  const r = rng(555);
  const school = [];
  const count = 9;

  for (let i = 0; i < count; i++) {
    const fish = createFish(COLORS[i % COLORS.length], 0.22 + r() * 0.12);
    const center = dockToWorld(DOCK_LENGTH * (0.45 + r() * 0.5), (r() - 0.5) * 2.2);
    school.push({
      fish,
      cx: center.x,
      cz: center.z,
      rx: 0.5 + r() * 1.1,
      rz: 0.35 + r() * 0.7,
      tilt: r() * Math.PI,
      speed: (0.35 + r() * 0.35) * (r() < 0.5 ? 1 : -1),
      phase: r() * 6.28,
      depth: 0.22 + r() * 0.25,
    });
    group.add(fish);
  }

  const p = new THREE.Vector3();
  const q = new THREE.Vector3();
  const at = (s, a, out) => {
    const ex = Math.cos(a) * s.rx;
    const ez = Math.sin(a) * s.rz;
    const c = Math.cos(s.tilt);
    const sn = Math.sin(s.tilt);
    out.x = s.cx + ex * c - ez * sn;
    out.z = s.cz + ex * sn + ez * c;
    // 保持在水面下、海床上
    out.y = Math.max(heightAt(out.x, out.z) + 0.1, -s.depth);
    out.y = Math.min(out.y, -0.07);
    return out;
  };

  ctx.updates.push((t) => {
    for (const s of school) {
      const a = t * s.speed + s.phase;
      at(s, a, p);
      at(s, a + 0.05 * Math.sign(s.speed), q);
      s.fish.position.copy(p);
      s.fish.rotation.y = Math.atan2(-(q.z - p.z), q.x - p.x);
      s.fish.userData.tail.rotation.y = Math.sin(t * 9 + s.phase) * 0.55;
    }
  });
  return group;
}
