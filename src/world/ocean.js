import * as THREE from 'three';
import { noOutline } from '../core/materials.js';
import { HALF, heightAt } from './terrain.js';

const WATER_SEG = 128;

const NOISE_GLSL = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
`;

/** 環抱海島的水面：依水深分色、岸邊浪花、卡通高光 */
function createSurface(uniforms) {
  const geo = new THREE.PlaneGeometry(HALF * 2, HALF * 2, WATER_SEG, WATER_SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const depth = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) depth[i] = -heightAt(pos.getX(i), pos.getZ(i));
  geo.setAttribute('depth', new THREE.BufferAttribute(depth, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: uniforms.uTime,
      uShallow: { value: new THREE.Color(0xa6f2e2) },
      uMid: { value: new THREE.Color(0x3fc8d8) },
      uDeep: { value: new THREE.Color(0x1f8fd6) },
      uHalf: { value: HALF },
    },
    vertexShader: /* glsl */ `
      attribute float depth;
      uniform float uTime;
      uniform float uHalf;
      varying float vDepth;
      varying vec2 vPos;
      void main() {
        vDepth = depth;
        vPos = position.xz;
        vec3 p = position;
        // 邊緣固定不動，才能與側面的水體剖面對齊
        float inner = smoothstep(0.0, 1.5, uHalf - max(abs(p.x), abs(p.z)));
        p.y += inner * 0.035 * (sin(p.x * 1.7 + uTime * 1.3) + sin(p.z * 2.1 - uTime * 1.1));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uShallow;
      uniform vec3 uMid;
      uniform vec3 uDeep;
      varying float vDepth;
      varying vec2 vPos;
      ${NOISE_GLSL}

      void main() {
        float d = vDepth;
        float n = vnoise(vPos * 1.6 + vec2(uTime * 0.14, -uTime * 0.1));
        float wob = (n - 0.5) * 0.16;

        // 乾淨的色塊分層
        vec3 col = mix(uShallow, uMid, smoothstep(0.30, 0.34, d + wob));
        col = mix(col, uDeep, smoothstep(0.82, 0.88, d + wob));
        float alpha = mix(0.4, 0.86, smoothstep(0.1, 1.0, d));

        // 岸邊浪花：貼岸的一圈白沫 + 往岸上推的浪線
        float foam = 1.0 - smoothstep(0.045 + 0.05 * n, 0.075 + 0.05 * n, d);
        float band = fract(d * 2.4 + uTime * 0.2 + n * 0.45);
        float bandMask = smoothstep(0.1, 0.16, d) * (1.0 - smoothstep(0.34, 0.62, d));
        foam = max(foam, step(0.84, band) * bandMask);

        // 卡通高光：緩慢漂移的碎亮片
        float sp = vnoise(vPos * 2.6 + vec2(uTime * 0.22, 0.0)) * vnoise(vPos * 3.3 - vec2(0.0, uTime * 0.18));
        float spark = step(0.52, sp) * smoothstep(0.3, 0.6, d);

        col = mix(col, vec3(1.0), spark * 0.38);
        col = mix(col, vec3(1.0), foam);
        alpha = max(alpha, foam * 0.96);

        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;
  return mesh;
}

/** 底座邊緣露出的水體剖面，像被切開的一塊海 */
function createSides() {
  const positions = [];
  const colors = [];
  const indices = [];
  const top = new THREE.Color(0x7fe0e6);
  const bottom = new THREE.Color(0x2a8fd0);
  const v = new THREE.Vector3();
  const SEGS = 80;

  [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach((angle) => {
    const base = positions.length / 3;
    for (let i = 0; i <= SEGS; i++) {
      v.set(-HALF + (i / SEGS) * HALF * 2, 0, HALF + 0.004).applyAxisAngle(THREE.Object3D.DEFAULT_UP, angle);
      positions.push(v.x, 0, v.z, v.x, heightAt(v.x, v.z), v.z);
      colors.push(top.r, top.g, top.b, bottom.r, bottom.g, bottom.b);
    }
    for (let i = 0; i < SEGS; i++) {
      const a = base + i * 2;
      indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  mesh.renderOrder = 1;
  return mesh;
}

/** 水面切口的白色描線 */
function createRim() {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const geo = new THREE.BoxGeometry(HALF * 2 + 0.05, 0.035, 0.035);
  [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach((angle) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(0, 0, HALF).applyAxisAngle(THREE.Object3D.DEFAULT_UP, angle);
    m.rotation.y = angle;
    group.add(m);
  });
  return group;
}

export function createOcean(ctx) {
  const group = new THREE.Group();
  group.add(createSurface(ctx.uniforms), createSides(), createRim());
  return noOutline(group);
}
