import * as THREE from 'three';
import { groundAt, isBlocked } from './walkable.js';

const EYE_HEIGHT = 0.8;
const WALK_SPEED = 1.9;
const RUN_SPEED = 3.3;
const STEP_UP = 0.45;
const RADIUS = 0.18;

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _probe = { y: 0, walkable: false, platform: false };

/** 第一人稱移動：WASD、Shift 加速、貼地、隱形牆 */
export class Player {
  constructor(camera, colliders) {
    this.camera = camera;
    this.colliders = colliders;
    this.position = new THREE.Vector3();
    this.keys = { forward: false, back: false, left: false, right: false, run: false };
    this.bobTime = 0;
    this.speed = 0; // 目前水平速度，供釣竿晃動使用
    this.canMove = true;
  }

  /** 把玩家放到指定地點（站在地面上） */
  place(x, z) {
    this.position.set(x, groundAt(x, z, _probe).y, z);
  }

  /** 眼睛位置，供鏡頭過場對準 */
  eyePosition(out = new THREE.Vector3()) {
    return out.copy(this.position).setY(this.position.y + EYE_HEIGHT);
  }

  setKey(code, down) {
    const k = this.keys;
    if (code === 'KeyW' || code === 'ArrowUp') k.forward = down;
    else if (code === 'KeyS' || code === 'ArrowDown') k.back = down;
    else if (code === 'KeyA' || code === 'ArrowLeft') k.left = down;
    else if (code === 'KeyD' || code === 'ArrowRight') k.right = down;
    else if (code === 'ShiftLeft' || code === 'ShiftRight') k.run = down;
    else return false;
    return true;
  }

  releaseKeys() {
    for (const key of Object.keys(this.keys)) this.keys[key] = false;
  }

  /** 是否可以站到 (x, z)：可行走、沒有障礙、落差不會太大 */
  canStand(x, z) {
    const g = groundAt(x, z, _probe);
    return g.walkable && g.y - this.position.y < STEP_UP && !isBlocked(x, z, this.colliders, RADIUS);
  }

  update(dt) {
    const k = this.keys;
    const moveZ = (k.forward ? 1 : 0) - (k.back ? 1 : 0);
    const moveX = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    let moving = false;

    if (this.canMove && (moveZ || moveX)) {
      // 以鏡頭的水平朝向為前方
      this.camera.getWorldDirection(_forward);
      _forward.y = 0;
      _forward.normalize();
      _right.set(-_forward.z, 0, _forward.x);

      const speed = k.run ? RUN_SPEED : WALK_SPEED;
      const len = Math.hypot(moveX, moveZ);
      const dx = ((_forward.x * moveZ + _right.x * moveX) / len) * speed * dt;
      const dz = ((_forward.z * moveZ + _right.z * moveX) / len) * speed * dt;
      const p = this.position;

      // 被擋住時沿著牆面滑動
      if (this.canStand(p.x + dx, p.z + dz)) {
        p.x += dx;
        p.z += dz;
        moving = true;
      } else if (this.canStand(p.x + dx, p.z)) {
        p.x += dx;
        moving = true;
      } else if (this.canStand(p.x, p.z + dz)) {
        p.z += dz;
        moving = true;
      }
      this.speed = moving ? speed : 0;
    } else {
      this.speed = 0;
    }

    // 貼地：高度平滑追上地面，上下台階不會瞬間跳動
    const ground = groundAt(this.position.x, this.position.z, _probe).y;
    this.position.y += (ground - this.position.y) * Math.min(1, dt * 14);

    if (moving) this.bobTime += dt * (k.run ? 13 : 9);
    const bob = moving ? Math.sin(this.bobTime) * 0.018 : 0;
    this.camera.position.set(this.position.x, this.position.y + EYE_HEIGHT + bob, this.position.z);
  }
}
