import * as THREE from 'three';
import { rng, fbm, noise, lerp } from '../core/math.js';
import { Builder, T, blob, ball, cone, cyl, tube, ribbon, newId } from '../core/builder.js';
import { gradientMap, toonMat, toonMatSolid, noOutline } from '../core/materials.js';
import { HALF, SEG, heightAt } from './terrain.js';

export const WALL_BOTTOM = -3.5;
export const RING_Y = -3.05;

// 四個側面：繞 Y 軸旋轉後，局部 +z 朝外、局部 +x 為觀看者的右手方向
const SIDES = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

// ---- 岩層剖面貼圖 -----------------------------------------------------------

function makeStrataTexture() {
  const W = 1024;
  const H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  const r = rng(42);

  // 由上到下：沉積砂 → 淺灰砂岩 → 深色火山岩
  const layers = [
    { y: 0.0, color: '#e2d3ac' },
    { y: 0.13, color: '#c9c2b2' },
    { y: 0.27, color: '#aaa7a3' },
    { y: 0.4, color: '#8e8d93' },
    { y: 0.53, color: '#74727c' },
    { y: 0.67, color: '#565460' },
    { y: 0.82, color: '#403e49' },
  ];
  // 斷層：在某些 x 位置讓岩層上下錯動
  const faults = [0.17, 0.43, 0.71, 0.9].map((x) => ({ x: x * W, shift: (r() - 0.5) * 46, lean: (r() - 0.5) * 0.5 }));
  const boundary = (layer, x, yPix) => {
    let y = layer.y * H;
    y += 9 * Math.sin((x / W) * Math.PI * 2 * 2 + layer.y * 20) + 5 * Math.sin((x / W) * Math.PI * 2 * 5 + layer.y * 50);
    for (const f of faults) if (x > f.x + (yPix - H / 2) * f.lean) y += f.shift;
    return y;
  };
  // 讓貼圖左右可無縫銜接：最後一道斷層把位移總和歸零
  faults[faults.length - 1].shift = -faults.slice(0, -1).reduce((s, f) => s + f.shift, 0);

  g.fillStyle = layers[0].color;
  g.fillRect(0, 0, W, H);
  for (let li = 1; li < layers.length; li++) {
    const L = layers[li];
    g.fillStyle = L.color;
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) g.lineTo(x, boundary(L, x, L.y * H));
    g.lineTo(W, H);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(30,34,40,0.55)';
    g.lineWidth = 2;
    g.beginPath();
    for (let x = 0; x <= W; x += 4) {
      const y = boundary(L, x, L.y * H);
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }

  // 斷層線
  g.strokeStyle = 'rgba(24,26,32,0.8)';
  g.lineWidth = 3;
  for (const f of faults) {
    g.beginPath();
    g.moveTo(f.x - (H / 2) * f.lean, 0);
    g.lineTo(f.x + (H / 2) * f.lean, H);
    g.stroke();
  }

  // 細小裂縫
  g.lineWidth = 1.5;
  for (let i = 0; i < 46; i++) {
    let x = r() * W;
    let y = r() * H;
    g.strokeStyle = `rgba(22,24,30,${0.35 + r() * 0.4})`;
    g.beginPath();
    g.moveTo(x, y);
    const steps = 3 + Math.floor(r() * 5);
    for (let s = 0; s < steps; s++) {
      x += (r() - 0.5) * 16;
      y += 8 + r() * 16;
      g.lineTo(x, y);
    }
    g.stroke();
  }

  // 礫石與氣孔
  for (let i = 0; i < 260; i++) {
    const x = r() * W;
    const y = r() * H;
    const light = y < H * 0.45;
    g.fillStyle = light ? `rgba(255,250,235,${0.25 + r() * 0.3})` : `rgba(20,20,28,${0.2 + r() * 0.3})`;
    g.beginPath();
    g.ellipse(x, y, 2 + r() * 5, 1.5 + r() * 3, 0, 0, Math.PI * 2);
    g.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// ---- 側壁與底部 -------------------------------------------------------------

function createWalls() {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const v = new THREE.Vector3();
  const nrm = new THREE.Vector3();

  SIDES.forEach((angle, side) => {
    const base = positions.length / 3;
    for (let i = 0; i <= SEG; i++) {
      const s = -HALF + (i / SEG) * HALF * 2;
      v.set(s, 0, HALF).applyAxisAngle(THREE.Object3D.DEFAULT_UP, angle);
      nrm.set(0, 0, 1).applyAxisAngle(THREE.Object3D.DEFAULT_UP, angle);
      const top = heightAt(v.x, v.z);
      const u = side + i / SEG;
      positions.push(v.x, top, v.z, v.x, WALL_BOTTOM, v.z);
      normals.push(nrm.x, 0, nrm.z, nrm.x, 0, nrm.z);
      uvs.push(u, 1 - top / WALL_BOTTOM, u, 0);
    }
    for (let i = 0; i < SEG; i++) {
      const tl = base + i * 2;
      const bl = tl + 1;
      const tr = tl + 2;
      const br = tl + 3;
      indices.push(tl, bl, br, tl, br, tr);
    }
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('oid', new THREE.BufferAttribute(new Float32Array(positions.length / 3).fill(128 / 255), 1));
  geo.setIndex(indices);

  const mesh = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ map: makeStrataTexture(), gradientMap }));
  mesh.receiveShadow = true;
  return mesh;
}

function undersideDepth(x, z) {
  const e = Math.max(Math.abs(x), Math.abs(z)) / HALF;
  const k = 1 - e;
  return Math.pow(k, 0.75) * 3.0 + k * 2.2 * fbm(x * 0.35 + 30, z * 0.35 + 8) + Math.min(1, k * 6) * 0.5 * noise(x * 1.3, z * 1.3);
}

function createUnderside() {
  const N = 40;
  const n = N + 1;
  const positions = [];
  const colors = [];
  const indices = [];
  const dark = new THREE.Color(0x3a3843);
  const mid = new THREE.Color(0x55535f);
  const c = new THREE.Color();
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = -HALF + (i / N) * HALF * 2;
      const z = -HALF + (j / N) * HALF * 2;
      positions.push(x, WALL_BOTTOM - undersideDepth(x, z), z);
      c.copy(noise(x * 0.8 + 4, z * 0.8) > 0.5 ? dark : mid);
      colors.push(c.r, c.g, c.b);
    }
  }
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = j * n + i;
      const b = a + 1;
      const cc = a + n;
      const d = cc + 1;
      indices.push(a, b, cc, b, d, cc); // 面朝下
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('oid', new THREE.BufferAttribute(new Float32Array(n * n).fill(128 / 255), 1));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, toonMatSolid);
}

// ---- 側壁上的細節：岩塊、貝殼、珊瑚、海藻 -----------------------------------

function decorateWalls(b) {
  const r = rng(7);
  const rocks = [0x4a4853, 0x5d5b66, 0x7b7a82, 0x9b9994, 0xb9b3a3];
  const shells = [0xfff4de, 0xf9d2b4, 0xffe9c9, 0xf6b9a0];
  const corals = [0xff7f5c, 0xff9a7a, 0xf0685a, 0xffb38a];
  const weeds = [0x2f8f6a, 0x3fa878, 0x257a5c];

  SIDES.forEach((angle) => {
    b.push(T(0, 0, 0, 0, angle, 0)).push(T(0, 0, HALF));

    // 突出的岩塊：越往下顏色越深
    for (let i = 0; i < 16; i++) {
      const s = lerp(-9.3, 9.3, r());
      const y = lerp(-1.5, WALL_BOTTOM + 0.15, r());
      const depthT = (y + 1.5) / (WALL_BOTTOM + 1.5);
      const color = rocks[Math.min(rocks.length - 1, Math.floor((1 - depthT) * 3 + r() * 2))];
      const size = 0.22 + r() * 0.42;
      b.add(
        blob(Math.floor(r() * 6), 1, 0.25),
        color,
        T(s, y, -size * 0.25, r() * 3, r() * 3, r() * 3, size * (0.9 + r() * 0.8), size * (0.55 + r() * 0.4), size * 0.7),
      );
    }

    // 貝殼：扇貝與螺
    for (let i = 0; i < 9; i++) {
      const s = lerp(-9.4, 9.4, r());
      const y = lerp(-1.25, -2.7, r());
      const color = shells[Math.floor(r() * shells.length)];
      if (r() < 0.6) {
        b.add(ball(0.13, 9, 6), color, T(s, y, 0.01, 0, 0, r() * 6, 1, 0.85, 0.32));
      } else {
        b.add(cone(0.085, 0.26, 7), color, T(s, y, 0.05, Math.PI / 2 - 0.5, 0, r() * 6));
      }
    }

    // 珊瑚碎片：幾根分岔的短枝
    for (let i = 0; i < 6; i++) {
      const s = lerp(-9.2, 9.2, r());
      const y = lerp(-1.2, -2.4, r());
      const color = corals[Math.floor(r() * corals.length)];
      const id = newId();
      const twigs = 3 + Math.floor(r() * 3);
      for (let k = 0; k < twigs; k++) {
        const len = 0.16 + r() * 0.2;
        const lean = (r() - 0.5) * 1.6;
        b.add(
          cyl(0.022, 0.04, len, 6),
          color,
          T(s + Math.sin(lean) * len * 0.5, y + Math.cos(lean) * len * 0.5, 0.05 + r() * 0.05, 0.5 * r(), 0, -lean),
          id,
        );
        b.add(ball(0.035, 6, 5), color, T(s + Math.sin(lean) * len, y + Math.cos(lean) * len, 0.07), id);
      }
    }

    // 海藻：貼著水線下方的岩壁垂落
    for (let i = 0; i < 12; i++) {
      const s = lerp(-9.5, 9.5, r());
      const top = heightAt(...sideToWorld(angle, s)) - 0.02;
      const color = weeds[Math.floor(r() * weeds.length)];
      const id = newId();
      const strands = 2 + Math.floor(r() * 3);
      for (let k = 0; k < strands; k++) {
        const len = 0.35 + r() * 0.75;
        const x = s + (k - strands / 2) * 0.09;
        b.add(
          ribbon(len, 0.06 + r() * 0.04, r() * 6),
          color,
          T(x, top, 0.03, 0, 0, 0),
          id,
        );
      }
    }

    b.pop().pop();
  });
}

function sideToWorld(angle, s) {
  const v = new THREE.Vector3(s, 0, HALF).applyAxisAngle(THREE.Object3D.DEFAULT_UP, angle);
  return [v.x, v.z];
}

// ---- 從邊緣垂落的藤蔓（會隨風輕擺） ------------------------------------------

function createVines() {
  const r = rng(99);
  const group = new THREE.Group();
  const leaves = [0x4fb86a, 0x6fd17a, 0x3c9c63];

  SIDES.forEach((angle) => {
    for (let i = 0; i < 4; i++) {
      const s = lerp(-8.8, 8.8, (i + 0.15 + r() * 0.7) / 4);
      const [wx, wz] = sideToWorld(angle, s);
      const top = heightAt(wx, wz);
      const b = new Builder();
      const strands = 2 + Math.floor(r() * 3);
      for (let k = 0; k < strands; k++) {
        const len = 0.9 + r() * 1.7;
        const ox = (k - (strands - 1) / 2) * 0.22 + (r() - 0.5) * 0.1;
        const sway = (r() - 0.5) * 0.35;
        const pts = [];
        for (let q = 0; q <= 5; q++) {
          const t = q / 5;
          pts.push([ox + Math.sin(t * 3 + k) * 0.07 + sway * t * t, -t * len, 0.05 + 0.03 * Math.sin(t * 6 + k)]);
        }
        const id = newId();
        b.add(tube(pts, 0.022, 12, 5), 0x3a7f52, null, id);
        const leafCount = Math.floor(len * 5);
        for (let q = 0; q < leafCount; q++) {
          const t = (q + 0.6) / leafCount;
          const p = pts[Math.min(5, Math.round(t * 5))];
          const sideSign = q % 2 ? 1 : -1;
          b.add(
            ball(0.085, 7, 5),
            leaves[Math.floor(r() * leaves.length)],
            T(p[0] + sideSign * 0.07, -t * len, p[2] + 0.02, 0, 0, sideSign * 0.7, 1, 0.6, 0.35),
            id,
          );
        }
        // 藤蔓末端的小花
        if (r() < 0.5) b.add(ball(0.05, 6, 5), r() < 0.5 ? 0xff8f7a : 0xffe08a, T(pts[5][0], -len - 0.03, 0.08), id);
      }
      const mesh = b.build(toonMat, { shadow: false });
      mesh.position.set(wx, top - 0.05, wz);
      mesh.rotation.y = angle;
      mesh.userData.phase = r() * 6.28;
      group.add(mesh);
    }
  });
  return group;
}

// ---- 環繞底座的一圈淺海與浪花 ------------------------------------------------

function createSeaRing(uniforms) {
  const outer = HALF + 3.2;
  const shape = new THREE.Shape();
  shape.moveTo(-outer, -outer);
  shape.lineTo(outer, -outer);
  shape.lineTo(outer, outer);
  shape.lineTo(-outer, outer);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-HALF, -HALF);
  hole.lineTo(-HALF, HALF);
  hole.lineTo(HALF, HALF);
  hole.lineTo(HALF, -HALF);
  hole.closePath();
  shape.holes.push(hole);

  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: uniforms.uTime,
      uHalf: { value: HALF },
      uShallow: { value: new THREE.Color(0x8fe6da) },
      uDeep: { value: new THREE.Color(0x2fa9d6) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vPos;
      void main() {
        vPos = position.xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uHalf;
      uniform vec3 uShallow;
      uniform vec3 uDeep;
      varying vec2 vPos;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }

      void main() {
        // 到底座外壁的距離（圓角方形）
        vec2 q = abs(vPos) - uHalf;
        float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
        float n = vnoise(vPos * 1.4 + vec2(uTime * 0.12, -uTime * 0.09));

        vec3 col = mix(uShallow, uDeep, smoothstep(0.5, 0.56, d * 0.42 + n * 0.25));

        // 向外擴散的浪圈 + 貼著岩壁的浪花
        float ring = fract(d * 0.75 - uTime * 0.16 + n * 0.3);
        float foam = step(0.86, ring) * (1.0 - smoothstep(0.6, 2.4, d));
        foam = max(foam, 1.0 - smoothstep(0.1 + 0.12 * n, 0.16 + 0.12 * n, d));
        col = mix(col, vec3(1.0), foam);

        float edge = 1.0 - smoothstep(1.9 + n * 0.7, 2.3 + n * 0.7, d);
        float alpha = edge * mix(0.78, 0.98, foam);
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = RING_Y;
  return mesh;
}

function createSpray(uniforms) {
  const r = rng(5);
  const count = 220;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const side = Math.floor(r() * 4);
    const s = lerp(-HALF, HALF, r());
    const v = new THREE.Vector3(s, 0, HALF + 0.05 + r() * 0.3).applyAxisAngle(THREE.Object3D.DEFAULT_UP, SIDES[side]);
    positions.set([v.x, RING_Y, v.z], i * 3);
    seeds.set([r(), 0.5 + r() * 0.5], i * 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 2));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: uniforms.uTime, uScale: uniforms.uPointScale },
    vertexShader: /* glsl */ `
      attribute vec2 seed;
      uniform float uTime;
      uniform float uScale;
      varying float vAlpha;
      void main() {
        float t = fract(uTime * 0.35 * seed.y + seed.x);
        vec3 p = position;
        p.y += sin(t * 3.14159) * 0.42 * seed.y;
        vAlpha = sin(t * 3.14159);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uScale * 0.16 * seed.y * (0.5 + vAlpha * 0.5) / -mv.z;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      void main() {
        if (length(gl_PointCoord - 0.5) > 0.5) discard;
        gl_FragColor = vec4(vec3(1.0), vAlpha * 0.9);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}

// ---- 組裝 --------------------------------------------------------------------

export function createBase(ctx) {
  const group = new THREE.Group();
  group.add(createWalls(), createUnderside());

  decorateWalls(ctx.lit);

  // 底部垂下的岩錐，強化「懸浮」感
  const r = rng(21);
  for (let i = 0; i < 26; i++) {
    const x = lerp(-7.5, 7.5, r());
    const z = lerp(-7.5, 7.5, r());
    const len = 0.5 + r() * 1.3;
    const y = WALL_BOTTOM - undersideDepth(x, z);
    ctx.lit.add(
      cone(0.22 + r() * 0.3, len, 6),
      r() < 0.5 ? 0x3a3843 : 0x4b4954,
      T(x, y - len * 0.35, z, Math.PI + (r() - 0.5) * 0.3, r() * 6, (r() - 0.5) * 0.3),
    );
  }

  const vines = createVines();
  group.add(vines);
  group.add(noOutline(createSeaRing(ctx.uniforms)), noOutline(createSpray(ctx.uniforms)));

  ctx.updates.push((t) => {
    for (const v of vines.children) v.rotation.z = Math.sin(t * 0.9 + v.userData.phase) * 0.035;
  });
  return group;
}
