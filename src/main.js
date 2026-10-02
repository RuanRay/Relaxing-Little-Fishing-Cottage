import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './ui/hud.css';
import { Builder } from './core/builder.js';
import { toonMat, glowMat, noOutline } from './core/materials.js';
import { OutlinePipeline } from './core/outline.js';
import { createTerrain, heightAt } from './world/terrain.js';
import { createBase } from './world/base.js';
import { createOcean } from './world/ocean.js';
import { createHouse, HOUSE_MATRIX } from './world/house.js';
import { createDock, dockToWorld, worldToDock, DOCK_LENGTH } from './world/dock.js';
import { createFlora } from './world/flora.js';
import { createFishSchool } from './world/fish.js';
import { createSky } from './world/sky.js';
import { Game } from './game/game.js';
import { groundAt, isBlocked } from './game/walkable.js';

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 1, 800);
camera.position.set(21, 15.5, 25);

// 開場環繞用；進入第一人稱後由 CameraDirector 停用
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(0, -0.9, 0);
orbit.enableDamping = true;
orbit.dampingFactor = 0.07;
orbit.update();

// 各模組共用的建構環境：
//   lit  → 受光且描邊的靜態零件    glow → 自發光零件
//   soft → 受光但不描邊的細碎植被  updates → 每幀動畫
//   colliders → 第一人稱移動時要避開的圓形障礙（樹幹等）
const ctx = {
  lit: new Builder(),
  glow: new Builder(),
  soft: new Builder(),
  updates: [],
  colliders: [],
  uniforms: { uTime: { value: 0 }, uPointScale: { value: 1 } },
};

// ---- Scene ------------------------------------------------------------------
scene.add(createSky(ctx));
scene.add(createTerrain());
scene.add(createBase(ctx));
scene.add(createOcean(ctx));
scene.add(createHouse(ctx));
scene.add(createDock(ctx));
scene.add(createFlora(ctx));
scene.add(createFishSchool(ctx));

scene.add(ctx.lit.build(toonMat));
scene.add(ctx.glow.build(glowMat, { shadow: false }));
const soft = ctx.soft.build(toonMat);
soft.castShadow = false;
scene.add(noOutline(soft));

const pipeline = new OutlinePipeline(renderer, scene, camera);

// 視角由遊戲的鏡頭導演控制：環繞時 30°，第一人稱時 68°
const view = { fov: 30, widen: true };
function applyView() {
  const half = THREE.MathUtils.degToRad(view.fov / 2);
  // 環繞時若為直式畫面，放寬視角讓整個底座仍完整入鏡
  const widen = view.widen ? Math.max(1, 1.5 / camera.aspect) : 1;
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(half) * widen));
  camera.updateProjectionMatrix();
  const height = renderer.domElement.height;
  ctx.uniforms.uPointScale.value = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
}

// ---- Game：鏡頭導演、玩家、釣竿、浮標、狀態機、HUD、圖鑑 -------------------------
const game = new Game({ scene, camera, renderer, orbit, colliders: ctx.colliders, view, applyView });

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  pipeline.setSize(w, h, renderer.getPixelRatio());
  camera.aspect = w / h;
  applyView();
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  ctx.uniforms.uTime.value = t;
  for (const update of ctx.updates) update(t);
  game.update(dt, t);
  pipeline.render();
});

// 開發模式下提供自動化試玩腳本使用的掛勾；正式建置時會被移除
if (import.meta.env.DEV) {
  Object.assign(window, {
    __game: game,
    __dockToWorld: dockToWorld,
    __worldToDock: worldToDock,
    __dockLength: DOCK_LENGTH,
    __heightAt: heightAt,
    __groundAt: (x, z) => ({ ...groundAt(x, z) }),
    __houseToWorld: (lx, lz) => {
      const v = new THREE.Vector3(lx, 0, lz).applyMatrix4(HOUSE_MATRIX);
      return [v.x, v.z];
    },
    __isBlockedAtPlayer: () => isBlocked(game.player.position.x, game.player.position.z, ctx.colliders, 0.1),
  });
}
