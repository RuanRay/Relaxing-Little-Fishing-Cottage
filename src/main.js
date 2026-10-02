import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Builder } from './core/builder.js';
import { toonMat, glowMat, noOutline } from './core/materials.js';
import { OutlinePipeline } from './core/outline.js';
import { createTerrain } from './world/terrain.js';
import { createBase } from './world/base.js';
import { createOcean } from './world/ocean.js';
import { createHouse } from './world/house.js';
import { createDock } from './world/dock.js';
import { createFlora } from './world/flora.js';
import { createFishSchool } from './world/fish.js';
import { createSky } from './world/sky.js';

const BASE_FOV = 30;

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 1, 800);
camera.position.set(21, 15.5, 25);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, -0.9, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 7;
controls.maxDistance = 58;
controls.maxPolarAngle = Math.PI * 0.62;
controls.screenSpacePanning = true;
controls.update();

// 各模組共用的建構環境：
//   lit  → 受光且描邊的靜態零件    glow → 自發光零件
//   soft → 受光但不描邊的細碎植被  updates → 每幀動畫
const ctx = {
  lit: new Builder(),
  glow: new Builder(),
  soft: new Builder(),
  updates: [],
  uniforms: { uTime: { value: 0 }, uPointScale: { value: 1 } },
};

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

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const ratio = renderer.getPixelRatio();
  renderer.setSize(w, h);
  pipeline.setSize(w, h, ratio);
  camera.aspect = w / h;
  // 直式畫面時放寬視角，讓整個底座仍完整入鏡
  const half = THREE.MathUtils.degToRad(BASE_FOV / 2);
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(half) * Math.max(1, 1.5 / camera.aspect)));
  camera.updateProjectionMatrix();
  ctx.uniforms.uPointScale.value = (h * ratio) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  ctx.uniforms.uTime.value = t;
  for (const update of ctx.updates) update(t);
  controls.update();
  pipeline.render();
});
