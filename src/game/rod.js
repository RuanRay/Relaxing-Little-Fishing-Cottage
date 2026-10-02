import * as THREE from 'three';
import { Builder, T, cyl, ball, torus, newId } from '../core/builder.js';
import { toonMat } from '../core/materials.js';
import { FISHING_STATE } from './fishingSystem.js';

const ROD_LENGTH = 1.3;
const REST = -1.12; // 靜止時竿身朝前上方
const BASE_Y = -0.25;

/** 釣竿：固定在鏡頭右下方，姿態只由釣魚狀態決定 */
export class Rod {
  constructor(camera, fishing) {
    this.fishing = fishing;

    const b = new Builder();
    const id = newId();
    // 握把、捲線器、竿身、竿尖
    b.add(cyl(0.02, 0.023, 0.3, 8), 0x3d2e26, T(0, 0.15, 0), id);
    b.add(cyl(0.024, 0.024, 0.02, 8), 0xd9a441, T(0, 0.3, 0), id);
    b.add(cyl(0.024, 0.024, 0.02, 8), 0xd9a441, T(0, 0.01, 0), id);
    b.add(cyl(0.012, 0.018, 0.62, 7), 0xcfa35e, T(0, 0.61, 0), id);
    b.add(cyl(0.006, 0.012, 0.36, 6), 0xb98a4a, T(0, 1.1, 0), id);
    b.add(ball(0.012, 6, 5), 0xe8452f, T(0, ROD_LENGTH - 0.01, 0), id);
    for (const y of [0.5, 0.78, 1.02]) b.add(torus(0.016, 0.004, 4, 8), 0x4a4f58, T(0, y, -0.02, Math.PI / 2), id);
    const reel = newId();
    b.add(cyl(0.045, 0.045, 0.035, 10), 0x5c636d, T(0.03, 0.34, 0.02, 0, 0, Math.PI / 2), reel);
    b.add(cyl(0.008, 0.008, 0.05, 5), 0x3d2e26, T(0.07, 0.36, 0.02, 0, 0, Math.PI / 2), reel);

    this.mesh = b.build(toonMat, { shadow: false });
    this.mesh.frustumCulled = false;

    // pivot 位於握把底端
    this.pivot = new THREE.Group();
    this.pivot.position.set(0.25, BASE_Y, -0.4);
    this.pivot.scale.setScalar(0.62);
    this.pivot.add(this.mesh);
    camera.add(this.pivot);
    this.pivot.visible = false;

    this.tipLocal = new THREE.Vector3(0, ROD_LENGTH, 0);
    this.pitch = REST;
    this.roll = 0;
    this.stateTime = 0;
    this.lastState = fishing.state;
    this.time = 0;
  }

  setVisible(visible) {
    this.pivot.visible = visible;
  }

  /** 竿尖的世界座標（釣線起點） */
  tipWorld(out = new THREE.Vector3()) {
    this.pivot.updateWorldMatrix(true, true);
    return out.copy(this.tipLocal).applyMatrix4(this.mesh.matrixWorld);
  }

  update(dt, walkSpeed = 0) {
    const f = this.fishing;
    if (f.state !== this.lastState) {
      this.lastState = f.state;
      this.stateTime = 0;
    }
    this.stateTime += dt;
    this.time += dt;

    let target = REST;
    let stiffness = 10;
    let shake = 0;
    let roll = 0;

    switch (f.state) {
      case FISHING_STATE.CHARGING:
        // 蓄力：竿身逐漸後仰，蓄滿時微微顫抖
        target = REST + f.chargeRatio * 1.25;
        stiffness = 14;
        shake = f.chargeRatio >= 1 ? 0.012 : 0;
        break;
      case FISHING_STATE.CASTING:
        // 拋出：迅速前甩後回穩
        target = this.stateTime < 0.22 ? REST - 0.5 : REST - 0.12;
        stiffness = this.stateTime < 0.22 ? 26 : 8;
        break;
      case FISHING_STATE.WAITING:
        target = REST - 0.08;
        break;
      case FISHING_STATE.BITING:
        target = REST + 0.12;
        stiffness = 20;
        shake = 0.03;
        break;
      case FISHING_STATE.REELING: {
        // 收線：張力越高竿身越彎向自己，並隨魚的掙扎抖動
        const tension = f.tension / 100;
        target = REST + 0.3 + tension * 0.45;
        stiffness = 12;
        shake = 0.012 + tension * 0.03;
        roll = Math.sin(this.time * 2.3) * 0.12;
        break;
      }
      case FISHING_STATE.CAUGHT:
        target = REST + 0.4;
        stiffness = 9;
        break;
      default:
        break;
    }

    const k = 1 - Math.exp(-stiffness * dt);
    this.pitch += (target - this.pitch) * k;
    this.roll += (roll - this.roll) * (1 - Math.exp(-6 * dt));

    const sway = walkSpeed > 0 ? Math.sin(this.time * 9) * 0.012 : 0;
    this.pivot.rotation.set(
      this.pitch + Math.sin(this.time * 47) * shake,
      -0.16 + Math.sin(this.time * 39) * shake * 0.6,
      -0.1 + this.roll + sway,
    );
    this.pivot.position.y = BASE_Y + (walkSpeed > 0 ? Math.abs(Math.sin(this.time * 4.5)) * 0.01 : 0);
  }
}
