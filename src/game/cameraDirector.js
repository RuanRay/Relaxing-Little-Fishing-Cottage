import * as THREE from 'three';

export const CAMERA_MODE = {
  ORBIT: 'ORBIT', // 開場自動環繞
  TRANSITION: 'TRANSITION', // 飛向碼頭起點
  FIRST_PERSON: 'FIRST_PERSON',
};

const TRANSITION_TIME = 1.5;
const ORBIT_FOV = 30;
const FIRST_PERSON_FOV = 68;

/** 開場環繞與鏡頭過場 */
export class CameraDirector {
  /**
   * @param {Object} options
   * @param {THREE.PerspectiveCamera} options.camera
   * @param {import('three/addons/controls/OrbitControls.js').OrbitControls} options.orbit
   * @param {{ fov: number, widen: boolean }} options.view 由 main.js 持有的視角設定
   * @param {() => void} options.applyView 套用視角設定
   */
  constructor({ camera, orbit, view, applyView }) {
    this.camera = camera;
    this.orbit = orbit;
    this.view = view;
    this.applyView = applyView;
    this.mode = CAMERA_MODE.ORBIT;
    this.onArrive = null;

    // 環繞期間不接受玩家操作，只自動旋轉
    orbit.autoRotate = true;
    orbit.autoRotateSpeed = 1.1;
    orbit.enableRotate = false;
    orbit.enableZoom = false;
    orbit.enablePan = false;

    view.fov = ORBIT_FOV;
    view.widen = true;
    applyView();

    this.time = 0;
    this.fromPosition = new THREE.Vector3();
    this.fromQuaternion = new THREE.Quaternion();
    this.toPosition = new THREE.Vector3();
    this.toQuaternion = new THREE.Quaternion();
    this.fromFov = ORBIT_FOV;
  }

  /**
   * 結束環繞，1.5 秒內飛到指定的眼睛位置並看向指定方向。
   * @param {THREE.Vector3} eye
   * @param {THREE.Vector3} lookAt
   */
  begin(eye, lookAt) {
    if (this.mode !== CAMERA_MODE.ORBIT) return;
    this.mode = CAMERA_MODE.TRANSITION;
    this.orbit.enabled = false;
    this.orbit.autoRotate = false;

    this.time = 0;
    this.fromPosition.copy(this.camera.position);
    this.fromQuaternion.copy(this.camera.quaternion);
    this.fromFov = this.camera.fov;
    this.toPosition.copy(eye);
    // PointerLockControls 以 YXZ 尤拉角控制視角，終點姿態不可帶有翻滾
    const m = new THREE.Matrix4().lookAt(eye, lookAt, THREE.Object3D.DEFAULT_UP);
    this.toQuaternion.setFromRotationMatrix(m);

    // 第一人稱需要貼近物體，把近裁切面拉近
    this.camera.near = 0.08;
    this.view.widen = false;
  }

  update(dt) {
    if (this.mode === CAMERA_MODE.ORBIT) {
      this.orbit.update();
      return;
    }
    if (this.mode !== CAMERA_MODE.TRANSITION) return;

    this.time += dt;
    const t = Math.min(1, this.time / TRANSITION_TIME);
    const e = t * t * (3 - 2 * t);
    this.camera.position.lerpVectors(this.fromPosition, this.toPosition, e);
    this.camera.quaternion.slerpQuaternions(this.fromQuaternion, this.toQuaternion, e);
    this.view.fov = this.fromFov + (FIRST_PERSON_FOV - this.fromFov) * e;
    this.applyView();

    if (t >= 1) {
      this.mode = CAMERA_MODE.FIRST_PERSON;
      this.orbit.dispose();
      if (this.onArrive) this.onArrive();
    }
  }
}
