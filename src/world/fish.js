import * as THREE from 'three';
import { rng } from '../core/math.js';
import { HALF, heightAt } from './terrain.js';
import { dockToWorld, DOCK_LENGTH } from './dock.js';
import { createFishModel } from './fishModels.js';
import { FISH_DATABASE } from '../game/fishData.js';

const byId = Object.fromEntries(FISH_DATABASE.map((f) => [f.id, f]));

// 游動的位置（碼頭局部座標）與魚種：棧橋兩側是淺灘的魚，盡頭外的深水是深水的魚，
// 讓玩家光用看的就知道哪裡釣得到什麼。
const SCHOOL = [
  ...['clownfish', 'squid', 'clownfish', 'pufferfish', 'clownfish', 'squid'].map((id) => ({ id, deep: false })),
  ...['horse_mackerel', 'red_sea_bream', 'horse_mackerel', 'mahi_mahi', 'horse_mackerel'].map((id) => ({ id, deep: true })),
];

/** 在碼頭周圍巡游的魚 */
export function createFishSchool(ctx) {
  const group = new THREE.Group();
  const r = rng(555);
  const school = [];

  for (const { id, deep } of SCHOOL) {
    const fish = createFishModel(byId[id]);
    // 隔著水面看會顯小，稍微放大才認得出魚種
    fish.scale.setScalar(fish.userData.length * 1.35);
    const center = deep
      ? dockToWorld(DOCK_LENGTH + 1.5 + r() * 1.0, (r() - 0.5) * 3.0)
      : dockToWorld(DOCK_LENGTH * (0.45 + r() * 0.5), (r() - 0.5) * 2.2);
    school.push({
      fish,
      cx: center.x,
      cz: center.z,
      rx: deep ? 0.5 + r() * 0.5 : 0.5 + r() * 1.1,
      rz: deep ? 0.35 + r() * 0.35 : 0.35 + r() * 0.7,
      tilt: r() * Math.PI,
      speed: (0.35 + r() * 0.35) * (r() < 0.5 ? 1 : -1) * (id === 'pufferfish' ? 0.5 : 1),
      phase: r() * 6.28,
      // 深水的魚貼近水面游，否則會被深色的海水完全蓋住
      depth: deep ? 0.14 + r() * 0.1 : 0.22 + r() * 0.25,
      wiggle: id === 'squid' ? 0.25 : 0.55,
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
    const limit = HALF - 0.6;
    out.x = THREE.MathUtils.clamp(s.cx + ex * c - ez * sn, -limit, limit);
    out.z = THREE.MathUtils.clamp(s.cz + ex * sn + ez * c, -limit, limit);
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
      s.fish.userData.tail.rotation.y = Math.sin(t * 9 + s.phase) * s.wiggle;
    }
  });
  return group;
}
