import * as THREE from 'three';

// 三渲二描邊管線：
//   1. 正常繪製場景到色彩緩衝（MSAA）
//   2. 以覆寫材質繪製「法線 + 零件 ID」與深度（僅 layer 0 的物件）
//   3. 全螢幕合成：在深度、法線、ID 不連續處畫上深綠色輪廓線

const idNormalMaterial = new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  blending: THREE.NoBlending,
  vertexShader: /* glsl */ `
    attribute float oid;
    varying vec3 vNormal;
    varying float vId;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vId = oid;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec3 vNormal;
    varying float vId;
    void main() {
      vec3 n = normalize(vNormal);
      if (!gl_FrontFacing) n = -n;
      gl_FragColor = vec4(n * 0.5 + 0.5, vId);
    }
  `,
});

const compositeMaterial = new THREE.ShaderMaterial({
  defines: { SS: 1 },
  depthTest: false,
  depthWrite: false,
  uniforms: {
    tColor: { value: null },
    tNormal: { value: null },
    tDepth: { value: null },
    uTexel: { value: new THREE.Vector2() },
    uNear: { value: 1 },
    uFar: { value: 100 },
    uThickness: { value: 1 },
    uLineColor: { value: new THREE.Color(0x14261f) },
    uProjInverse: { value: new THREE.Matrix4() },
    uCameraWorld: { value: new THREE.Matrix4() },
    uHalf: { value: 10 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    #include <packing>
    uniform sampler2D tColor;
    uniform sampler2D tNormal;
    uniform sampler2D tDepth;
    uniform vec2 uTexel;
    uniform float uNear;
    uniform float uFar;
    uniform float uThickness;
    uniform vec3 uLineColor;
    uniform mat4 uProjInverse;
    uniform mat4 uCameraWorld;
    uniform float uHalf;
    varying vec2 vUv;

    vec3 worldAt(vec2 uv) {
      vec4 ndc = vec4(uv * 2.0 - 1.0, texture2D(tDepth, uv).x * 2.0 - 1.0, 1.0);
      vec4 view = uProjInverse * ndc;
      return (uCameraWorld * vec4(view.xyz / view.w, 1.0)).xyz;
    }

    float viewDist(vec2 uv) {
      return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar);
    }

    float edgeAt(vec2 uv) {
      vec2 o = uTexel * uThickness;
      vec2 uv1 = uv + vec2(o.x, 0.0);
      vec2 uv2 = uv - vec2(o.x, 0.0);
      vec2 uv3 = uv + vec2(0.0, o.y);
      vec2 uv4 = uv - vec2(0.0, o.y);

      vec4 s0 = texture2D(tNormal, uv);
      vec4 s1 = texture2D(tNormal, uv1);
      vec4 s2 = texture2D(tNormal, uv2);
      vec4 s3 = texture2D(tNormal, uv3);
      vec4 s4 = texture2D(tNormal, uv4);

      float z0 = viewDist(uv);
      float z1 = viewDist(uv1);
      float z2 = viewDist(uv2);
      float z3 = viewDist(uv3);
      float z4 = viewDist(uv4);
      float lap = abs(z1 + z2 - 2.0 * z0) + abs(z3 + z4 - 2.0 * z0);
      float eDepth = smoothstep(0.004, 0.012, lap / z0);

      vec3 n0 = s0.rgb * 2.0 - 1.0;
      float dn = 0.0;
      dn = max(dn, 1.0 - dot(n0, s1.rgb * 2.0 - 1.0));
      dn = max(dn, 1.0 - dot(n0, s2.rgb * 2.0 - 1.0));
      dn = max(dn, 1.0 - dot(n0, s3.rgb * 2.0 - 1.0));
      dn = max(dn, 1.0 - dot(n0, s4.rgb * 2.0 - 1.0));
      float eNormal = smoothstep(0.3, 0.7, dn);

      float di = max(max(abs(s0.a - s1.a), abs(s0.a - s2.a)), max(abs(s0.a - s3.a), abs(s0.a - s4.a)));
      float eId = step(0.003, di);

      float edge = max(eDepth, max(eNormal, eId));

      // 輪廓屬於較近的那個表面；若它泡在海水裡，線條就隨水深淡去
      vec2 nearUv = uv;
      float nearZ = z0;
      if (z1 < nearZ) { nearZ = z1; nearUv = uv1; }
      if (z2 < nearZ) { nearZ = z2; nearUv = uv2; }
      if (z3 < nearZ) { nearZ = z3; nearUv = uv3; }
      if (z4 < nearZ) { nearZ = z4; nearUv = uv4; }
      vec3 wp = worldAt(nearUv);
      float inSea = step(max(abs(wp.x), abs(wp.z)), uHalf + 0.1) * step(-1.32, wp.y);
      return edge * (1.0 - inSea * 0.9 * smoothstep(0.02, 0.4, -wp.y));
    }

    void main() {
      // 法線 / ID 緩衝以 SS 倍解析度繪製，這裡對子像素取平均來柔化線條邊緣
      float edge = 0.0;
      for (int j = 0; j < SS; j++) {
        for (int i = 0; i < SS; i++) {
          vec2 sub = (vec2(float(i), float(j)) + 0.5) / float(SS) - 0.5;
          edge += edgeAt(vUv + sub * uTexel * float(SS));
        }
      }
      edge /= float(SS * SS);

      vec3 color = texture2D(tColor, vUv).rgb;
      color = mix(color, uLineColor, edge * 0.88);

      // 輕微暗角，讓視線聚焦在模型上
      vec2 q = vUv - 0.5;
      color *= 1.0 - 0.22 * smoothstep(0.35, 0.95, length(q) * 1.25);

      gl_FragColor = vec4(color, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
});

export class OutlinePipeline {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    this.colorTarget = new THREE.WebGLRenderTarget(1, 1, {
      samples: 4,
      type: THREE.HalfFloatType,
    });
    this.normalTarget = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });
    this.normalTarget.depthTexture = new THREE.DepthTexture(1, 1);

    this.quadScene = new THREE.Scene();
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), compositeMaterial);
    quad.frustumCulled = false;
    this.quadScene.add(quad);

    const u = compositeMaterial.uniforms;
    u.tColor.value = this.colorTarget.texture;
    u.tNormal.value = this.normalTarget.texture;
    u.tDepth.value = this.normalTarget.depthTexture;
  }

  setSize(width, height, pixelRatio) {
    const w = Math.max(1, Math.floor(width * pixelRatio));
    const h = Math.max(1, Math.floor(height * pixelRatio));
    // 低 DPI 螢幕上線條容易有鋸齒，改以 2 倍超取樣繪製描邊緩衝
    const ss = pixelRatio < 1.5 ? 2 : 1;
    if (compositeMaterial.defines.SS !== ss) {
      compositeMaterial.defines.SS = ss;
      compositeMaterial.needsUpdate = true;
    }
    this.colorTarget.setSize(w, h);
    this.normalTarget.setSize(w * ss, h * ss);
    const u = compositeMaterial.uniforms;
    u.uTexel.value.set(1 / (w * ss), 1 / (h * ss));
    u.uThickness.value = Math.max(1, h / 1000) * ss;
  }

  render() {
    const { renderer, scene, camera } = this;
    const u = compositeMaterial.uniforms;
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    u.uProjInverse.value.copy(camera.projectionMatrixInverse);
    u.uCameraWorld.value.copy(camera.matrixWorld);

    renderer.shadowMap.needsUpdate = true;

    camera.layers.enableAll();
    renderer.setRenderTarget(this.colorTarget);
    renderer.render(scene, camera);

    camera.layers.set(0);
    scene.overrideMaterial = idNormalMaterial;
    renderer.setRenderTarget(this.normalTarget);
    renderer.render(scene, camera);
    scene.overrideMaterial = null;
    camera.layers.enableAll();

    renderer.setRenderTarget(null);
    renderer.render(this.quadScene, this.quadCamera);
  }
}
