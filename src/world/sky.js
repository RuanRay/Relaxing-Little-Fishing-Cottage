import * as THREE from 'three';
import { rng } from '../core/math.js';
import { Builder, T, blob, newId } from '../core/builder.js';
import { noOutline } from '../core/materials.js';

/** 午後的天空：頂部清澈的藍，往地平線過渡到帶暖意的奶油色 */
function createDome() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x3f9be0) },
      uMid: { value: new THREE.Color(0x8fd3f4) },
      uHorizon: { value: new THREE.Color(0xe9f7f1) },
      uBottom: { value: new THREE.Color(0x63c3e6) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uMid;
      uniform vec3 uHorizon;
      uniform vec3 uBottom;
      varying vec3 vDir;
      void main() {
        float h = normalize(vDir).y;
        vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.28, h));
        col = mix(col, uTop, smoothstep(0.25, 0.85, h));
        col = mix(col, uBottom, smoothstep(0.0, -0.55, h));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 16), mat);
  dome.renderOrder = -10;
  return dome;
}

/** 動畫風格的積雲：幾顆壓扁的雲團疊成一朵 */
function createClouds(ctx) {
  const group = new THREE.Group();
  const r = rng(404);
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const white = new THREE.Color(0xffffff);
  const shade = new THREE.Color(0xcfe6f6);
  const tone = (p, out) => out.copy(p.y < -0.22 ? shade : white);
  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const b = new Builder();
    const id = newId();
    const puffs = 4 + Math.floor(r() * 3);
    for (let k = 0; k < puffs; k++) {
      const s = 3.5 + r() * 3.5;
      b.add(blob(Math.floor(r() * 6), 2, 0.12), tone, T((k - puffs / 2) * 4.2 + r() * 2, r() * 1.6 + (k % 2) * 1.4, (r() - 0.5) * 3, 0, r() * 6, 0, s * 1.25, s * 0.72, s), id);
    }
    const mesh = b.build(mat, { shadow: false });
    const angle = (i / 9) * Math.PI * 2 + r() * 0.5;
    const radius = 78 + r() * 34;
    const height = -22 + r() * 34;
    mesh.userData = { angle, radius, height, speed: 0.004 + r() * 0.006 };
    mesh.scale.setScalar(0.7 + r() * 0.7);
    clouds.push(mesh);
    group.add(mesh);
  }
  ctx.updates.push((t) => {
    for (const c of clouds) {
      const a = c.userData.angle + t * c.userData.speed;
      c.position.set(Math.cos(a) * c.userData.radius, c.userData.height, Math.sin(a) * c.userData.radius);
      c.rotation.y = -a + Math.PI / 2;
    }
  });
  return group;
}

/** 幾隻繞著海島盤旋的海鷗 */
function createGulls(ctx) {
  const group = new THREE.Group();
  const r = rng(909);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.09, 0, 0, -0.09, 0.5, 0, -0.03], 3));
  const gulls = [];
  for (let i = 0; i < 4; i++) {
    const gull = new THREE.Group();
    const left = new THREE.Mesh(wingGeo, mat);
    const right = new THREE.Mesh(wingGeo, mat);
    right.scale.x = -1;
    gull.add(left, right);
    gull.userData = { left, right, radius: 6 + r() * 5, height: 5.2 + r() * 2.5, speed: 0.22 + r() * 0.15, phase: r() * 6.28 };
    gulls.push(gull);
    group.add(gull);
  }
  ctx.updates.push((t) => {
    for (const g of gulls) {
      const u = g.userData;
      const a = t * u.speed + u.phase;
      g.position.set(Math.cos(a) * u.radius - 1, u.height + Math.sin(t * 0.5 + u.phase) * 0.4, Math.sin(a) * u.radius - 1);
      g.rotation.y = -a;
      const flap = Math.sin(t * 5 + u.phase) * 0.45 + 0.15;
      u.left.rotation.z = flap;
      u.right.rotation.z = -flap;
    }
  });
  return group;
}

export function createSky(ctx) {
  const group = new THREE.Group();
  group.add(createDome(), createClouds(ctx), createGulls(ctx));
  noOutline(group);

  // 午後斜陽：暖色主光 + 偏藍的天空補光
  const sun = new THREE.DirectionalLight(0xfff0d6, 1.75);
  sun.position.set(11, 17, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const cam = sun.shadow.camera;
  cam.left = cam.bottom = -15;
  cam.right = cam.top = 15;
  cam.near = 1;
  cam.far = 50;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.035;

  const fill = new THREE.HemisphereLight(0xd6ecff, 0xffe3bd, 1.75);
  group.add(sun, sun.target, fill);
  return group;
}
