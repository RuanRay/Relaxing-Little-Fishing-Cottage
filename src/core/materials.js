import * as THREE from 'three';

// 三階卡通光影：暗部 / 半調 / 亮部
function makeGradientMap() {
  const steps = [108, 108, 108, 108, 180, 255, 255, 255];
  const tex = new THREE.DataTexture(new Uint8Array(steps), steps.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export const gradientMap = makeGradientMap();

/** 受光的卡通材質（頂點色） */
export const toonMat = new THREE.MeshToonMaterial({
  vertexColors: true,
  gradientMap,
  side: THREE.DoubleSide,
});

/** 單面版本：地形、底座等封閉大面 */
export const toonMatSolid = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap });

/** 不受光的自發光材質（窗光、燈火） */
export const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.14)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const glowTexture = makeGlowTexture();

/** 柔光暈（取代 bloom 後製） */
export function halo(color, size, opacity = 0.6) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  sprite.scale.setScalar(size);
  sprite.layers.set(1);
  return sprite;
}

/** 讓物件不參與描邊（水面、光暈、細小植被） */
export function noOutline(object) {
  object.traverse((o) => o.layers.set(1));
  return object;
}
