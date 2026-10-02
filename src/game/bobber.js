import * as THREE from 'three';
import { Builder, T, ball, cyl, newId } from '../core/builder.js';
import { toonMat } from '../core/materials.js';
import { waveHeight } from '../world/ocean.js';
import { createFishModel } from '../world/fishModels.js';
import { HALF } from '../world/terrain.js';
import { FISHING_STATE } from './fishingSystem.js';
import { WATER_ZONES } from './fishData.js';
import { castInfoAt } from './walkable.js';

const MIN_CAST = 1.6;
const MAX_CAST = 9.5;
const LINE_POINTS = 18;
const ZONE_COLOR = { land: 0xe63946, [WATER_ZONES.SHALLOW]: 0x7fe3d0, [WATER_ZONES.DEEP]: 0x2f7fe0 };

const _tip = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _a = new THREE.Vector3();

/** 浮標、釣線、落點標記、水花，以及釣起時飛出水面的魚 */
export class Bobber {
  constructor({ scene, camera, rod, fishing, player }) {
    this.camera = camera;
    this.rod = rod;
    this.fishing = fishing;
    this.player = player;
    this.group = new THREE.Group();
    scene.add(this.group);

    // 浮標：上紅下白，頂端一根細桿
    const b = new Builder();
    const id = newId();
    const red = new THREE.Color(0xe8452f);
    const white = new THREE.Color(0xfff6e6);
    b.add(ball(0.065, 12, 8), (p, out) => out.copy(p.y > 0 ? red : white), T(0, 0, 0, 0, 0, 0, 1, 1.15, 1), id);
    b.add(cyl(0.008, 0.008, 0.12, 5), 0x3d2e26, T(0, 0.12, 0), id);
    b.add(ball(0.016, 6, 5), 0xffd35a, T(0, 0.18, 0), id);
    this.mesh = b.build(toonMat, { shadow: false });
    this.group.add(this.mesh);

    // 釣線
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LINE_POINTS * 3), 3));
    this.line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
    this.line.frustumCulled = false;
    this.line.layers.set(1);
    this.group.add(this.line);

    // 落點標記：蓄力時顯示，顏色代表水域
    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.17, 0.24, 28).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.marker.layers.set(1);
    this.marker.visible = false;
    this.group.add(this.marker);

    // 水花：一圈擴散的漣漪 + 幾顆飛濺的水珠
    this.ripple = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.ripple.layers.set(1);
    this.ripple.visible = false;
    this.group.add(this.ripple);
    this.rippleAge = 1;
    this.rippleSize = 0.5;

    this.drops = [];
    const dropGeo = new THREE.SphereGeometry(0.028, 6, 5);
    const dropMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < 14; i++) {
      const mesh = new THREE.Mesh(dropGeo, dropMat);
      mesh.layers.set(1);
      mesh.visible = false;
      this.group.add(mesh);
      this.drops.push({ mesh, velocity: new THREE.Vector3(), life: 0 });
    }

    // 釣起的魚：每個魚種有自己的模型，第一次釣到時才建立
    this.fishModels = new Map();
    this.fishMesh = null;
    this.fishLength = 0.3;

    this.position = new THREE.Vector3();
    this.start = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.hookPoint = new THREE.Vector3();
    this.lastState = fishing.state;
    this.prevState = fishing.state;
    this.stateTime = 0;
    this.time = 0;
    this.sag = 0.3;
    this.splashTimer = 0;
    this.onSplash = null;
    this.visible = false;
    this.group.visible = false;
  }

  setVisible(visible) {
    this.visible = visible;
    this.group.visible = visible;
  }

  /**
   * 依目前視角與蓄力程度計算落點。拋竿距離與蓄力成正比。
   * @returns {{ isLand: boolean, zone: string, y: number, x: number, z: number }}
   */
  aim(chargeRatio) {
    this.camera.getWorldDirection(_dir);
    _dir.y = 0;
    _dir.normalize();
    const distance = MIN_CAST + (MAX_CAST - MIN_CAST) * chargeRatio;
    const p = this.player.position;
    // 落點不會超出底座
    const limit = HALF - 0.35;
    const x = THREE.MathUtils.clamp(p.x + _dir.x * distance, -limit, limit);
    const z = THREE.MathUtils.clamp(p.z + _dir.z * distance, -limit, limit);
    return { ...castInfoAt(x, z), x, z };
  }

  /** 放開左鍵的瞬間鎖定落點 */
  lockTarget(info) {
    this.target.set(info.x, info.y, info.z);
  }

  splash(at, size = 0.5, count = 8) {
    this.ripple.position.set(at.x, 0.03, at.z);
    this.ripple.visible = true;
    this.rippleAge = 0;
    this.rippleSize = size;
    let spawned = 0;
    for (const d of this.drops) {
      if (spawned >= count) break;
      if (d.life > 0) continue;
      const a = Math.random() * Math.PI * 2;
      const s = 0.5 + Math.random() * 0.9;
      d.velocity.set(Math.cos(a) * s * size, 1.6 + Math.random() * 1.4, Math.sin(a) * s * size);
      d.mesh.position.set(at.x, 0.03, at.z);
      d.mesh.visible = true;
      d.life = 0.7;
      spawned++;
    }
    if (this.onSplash) this.onSplash(size);
  }

  update(dt, t) {
    if (!this.visible) return;
    const f = this.fishing;
    if (f.state !== this.lastState) {
      this.prevState = this.lastState;
      this.lastState = f.state;
      this.stateTime = 0;
      this.enter(f.state);
    }
    this.stateTime += dt;
    this.time += dt;

    this.rod.tipWorld(_tip);
    const p = this.position;
    let sag = 0.05;
    let showLine = true;

    switch (f.state) {
      case FISHING_STATE.CASTING: {
        // 拋物線飛向落點
        const k = Math.min(1, f.castFlightTimer / f.castFlightDuration);
        const arc = 0.9 + this.start.distanceTo(this.target) * 0.16;
        p.lerpVectors(this.start, this.target, k);
        p.y += Math.sin(k * Math.PI) * arc;
        sag = 0.1;
        break;
      }
      case FISHING_STATE.WAITING: {
        // 隨水面輕微起伏
        p.set(this.target.x, waveHeight(this.target.x, this.target.z, t) + 0.015 + Math.sin(this.time * 2.4) * 0.012, this.target.z);
        this.mesh.rotation.set(Math.sin(this.time * 1.7) * 0.12, 0, Math.cos(this.time * 1.3) * 0.12);
        sag = 0.5;
        break;
      }
      case FISHING_STATE.BITING: {
        // 咬鉤：浮標被拉入水中並抖動
        p.set(
          this.target.x + Math.sin(this.time * 38) * 0.02,
          -0.1 + Math.sin(this.time * 30) * 0.025,
          this.target.z + Math.cos(this.time * 33) * 0.02,
        );
        sag = 0.12;
        break;
      }
      case FISHING_STATE.REELING: {
        // 魚拖著浮標左右竄動；進度越高越靠近玩家
        const progress = f.reelingProgress / 100;
        const player = this.player.position;
        _a.set(this.hookPoint.x - player.x, 0, this.hookPoint.z - player.z);
        const dist = Math.max(0.01, _a.length());
        _a.divideScalar(dist);
        const reach = Math.min(dist, 1.3) + (dist - Math.min(dist, 1.3)) * (1 - progress * 0.85);
        const swing = Math.sin(this.time * (1.4 + f.currentFish.difficulty * 0.35)) * (0.35 + 0.12 * f.currentFish.difficulty);
        p.set(
          player.x + _a.x * reach - _a.z * swing,
          -0.06 + Math.sin(this.time * 14) * 0.03,
          player.z + _a.z * reach + _a.x * swing,
        );
        // 張力越高釣線越直
        sag = 0.3 * (1 - f.tension / 100) + 0.02;
        this.splashTimer -= dt;
        if (this.splashTimer <= 0) {
          this.splashTimer = 0.45 + Math.random() * 0.5;
          this.splash(p, 0.28, 3);
        }
        break;
      }
      case FISHING_STATE.ESCAPED: {
        // 拋到陸地：彈回竿尖；其餘情況直接收回
        const k = Math.min(1, this.stateTime / 0.45);
        p.lerpVectors(this.start, _tip, k);
        p.y += Math.sin(k * Math.PI) * (this.prevState === FISHING_STATE.CASTING ? 0.7 : 0.3);
        if (k >= 1) this.dangle(p, dt, true);
        break;
      }
      default: {
        this.dangle(p, dt, false);
        break;
      }
    }

    if (f.state !== FISHING_STATE.WAITING) this.mesh.rotation.set(0, 0, 0);
    // 釣起時線的末端掛的是魚，浮標先收起來
    this.mesh.visible = f.state !== FISHING_STATE.CAUGHT;
    this.mesh.position.copy(p);
    this.sag += (sag - this.sag) * Math.min(1, dt * 8);
    this.updateLine(_tip, p, showLine);
    this.updateMarker(f);
    this.updateEffects(dt, t);
    this.updateCaughtFish(dt, _tip);
  }

  /** 浮標垂在竿尖下方輕輕擺盪 */
  dangle(p, dt, snap) {
    _a.set(_tip.x, _tip.y - 0.2, _tip.z);
    if (snap) p.copy(_a);
    else p.lerp(_a, Math.min(1, dt * 16));
  }

  enter(state) {
    const f = this.fishing;
    if (state === FISHING_STATE.CASTING) {
      this.start.copy(this.position);
    } else if (state === FISHING_STATE.WAITING) {
      this.splash(this.target, 0.42, 7);
    } else if (state === FISHING_STATE.BITING) {
      this.splash(this.target, 0.6, 10);
    } else if (state === FISHING_STATE.REELING) {
      this.hookPoint.copy(this.target);
      this.splashTimer = 0.3;
    } else if (state === FISHING_STATE.CAUGHT) {
      this.splash(this.position, 0.75, 14);
      this.fishStart = this.position.clone();
      this.showCaughtFish(f.currentFish);
    } else if (state === FISHING_STATE.ESCAPED) {
      this.start.copy(this.position);
      if (this.prevState !== FISHING_STATE.CASTING) this.splash(this.position, 0.45, 6);
    }
    if (state !== FISHING_STATE.CAUGHT && this.fishMesh) this.fishMesh.visible = false;
  }

  showCaughtFish(fish) {
    if (this.fishMesh) this.fishMesh.visible = false;
    let model = this.fishModels.get(fish.id);
    if (!model) {
      model = createFishModel(fish);
      this.fishModels.set(fish.id, model);
      this.group.add(model);
    }
    // 體長隨重量在該魚種的範圍內變化：同一種魚，釣到大的看起來就是比較大
    const k = (fish.weightKg - fish.minWeight) / Math.max(0.001, fish.maxWeight - fish.minWeight);
    // 拿在眼前看會顯得很大，所以比水中的實際體長略小
    this.fishLength = model.userData.length * 0.75 * (0.85 + 0.4 * k);
    model.scale.setScalar(this.fishLength);
    model.visible = true;
    this.fishMesh = model;
    this.fishTime = 0;
  }

  updateLine(tip, bobber, show) {
    this.line.visible = show;
    const attr = this.line.geometry.attributes.position;
    for (let i = 0; i < LINE_POINTS; i++) {
      const k = i / (LINE_POINTS - 1);
      attr.setXYZ(
        i,
        tip.x + (bobber.x - tip.x) * k,
        tip.y + (bobber.y - tip.y) * k - Math.sin(k * Math.PI) * this.sag,
        tip.z + (bobber.z - tip.z) * k,
      );
    }
    attr.needsUpdate = true;
  }

  updateMarker(f) {
    if (f.state !== FISHING_STATE.CHARGING) {
      this.marker.visible = false;
      return;
    }
    const info = this.aim(f.chargeRatio);
    this.lastAim = info;
    this.marker.visible = true;
    this.marker.position.set(info.x, info.y + 0.04, info.z);
    this.marker.material.color.set(ZONE_COLOR[info.isLand ? 'land' : info.zone]);
    this.marker.scale.setScalar(1 + Math.sin(this.time * 7) * 0.08);
  }

  updateEffects(dt, t) {
    if (this.ripple.visible) {
      this.rippleAge += dt * 1.6;
      const k = Math.min(1, this.rippleAge);
      this.ripple.scale.setScalar(this.rippleSize * (0.3 + k * 1.3));
      this.ripple.position.y = waveHeight(this.ripple.position.x, this.ripple.position.z, t) + 0.02;
      this.ripple.material.opacity = 0.85 * (1 - k);
      if (k >= 1) this.ripple.visible = false;
    }
    for (const d of this.drops) {
      if (d.life <= 0) continue;
      d.life -= dt;
      d.velocity.y -= 7 * dt;
      d.mesh.position.addScaledVector(d.velocity, dt);
      if (d.life <= 0 || d.mesh.position.y < -0.02) {
        d.life = 0;
        d.mesh.visible = false;
      }
    }
  }

  /** 釣起的魚躍出水面，飛到竿尖下方掛著 */
  updateCaughtFish(dt, tip) {
    if (!this.fishMesh || !this.fishMesh.visible) return;
    this.fishTime += dt;
    const k = Math.min(1, this.fishTime / 0.55);
    const e = 1 - (1 - k) * (1 - k);
    // 頭掛在竿尖下方，魚越長垂得越低
    _a.set(tip.x, tip.y - 0.1 - this.fishLength * 0.5, tip.z);
    this.fishMesh.position.lerpVectors(this.fishStart, _a, e);
    this.fishMesh.position.y += Math.sin(k * Math.PI) * 0.6;
    // 頭朝上掛著，並左右甩動
    this.fishMesh.rotation.set(0, this.fishTime * 2.2, Math.PI / 2 * e + Math.sin(this.fishTime * 16) * 0.22 * (1 - k * 0.6));
    this.fishMesh.userData.tail.rotation.y = Math.sin(this.fishTime * 18) * 0.5;
  }
}

export { MIN_CAST, MAX_CAST };
