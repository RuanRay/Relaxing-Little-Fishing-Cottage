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
    varying vec2 vUv;

    float viewDist(vec2 uv) {
      return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar);
    }

    void main() {
      vec2 o = uTexel * uThickness;
      vec2 uv1 = vUv + vec2(o.x, 0.0);
      vec2 uv2 = vUv - vec2(o.x, 0.0);
      vec2 uv3 = vUv + vec2(0.0, o.y);
      vec2 uv4 = vUv - vec2(0.0, o.y);

      vec4 s0 = texture2D(tNormal, vUv);
      vec4 s1 = texture2D(tNormal, uv1);
      vec4 s2 = texture2D(tNormal, uv2);
      vec4 s3 = texture2D(tNormal, uv3);
      vec4 s4 = texture2D(tNormal, uv4);

      float z0 = viewDist(vUv);
      float lap = abs(viewDist(uv1) + viewDist(uv2) - 2.0 * z0)
                + abs(viewDist(uv3) + viewDist(uv4) - 2.0 * z0);
      float eDepth = smoothstep(0.004, 0.012, lap / z0);

      vec3 n0 = s0.rgb * 2.0 - 1.0;
      float dn = 0.0;
      dn = max(dn, 1.0 - dot(n0, s1.rgb * 2.0 - 1.0));
      dn = max(dn, 1.0 - dot(n0, s2.rgb * 2.0 - 1.0));
      dn = max(dn, 1.0 - dot(n0, s3.rgb * 2.0 - 1.0));
      dn = max(dn, 1.0 - dot(n0, s4.rgb * 2.0 - 1.0));
      float eNormal = smoothstep(0.3, 0.7, dn);

      float di = max(max(abs(s0.a - s1.a), abs(s0.a - s2.a)), max(abs(s0.a - s3.a), abs(s0.a - s4.a)));
      float eId = step(0.002, di);

      float edge = max(eDepth, max(eNormal, eId));

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
    this.colorTarget.setSize(w, h);
    this.normalTarget.setSize(w, h);
    const u = compositeMaterial.uniforms;
    u.uTexel.value.set(1 / w, 1 / h);
    u.uThickness.value = Math.max(1, h / 1000);
  }

  render() {
    const { renderer, scene, camera } = this;
    const u = compositeMaterial.uniforms;
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;

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
