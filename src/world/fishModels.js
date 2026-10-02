import * as THREE from 'three';
import { Builder, T, ball, newId } from '../core/builder.js';
import { toonMat } from '../core/materials.js';

// 六種魚各自的 3D 模型。差異來自輪廓、身體比例、花紋與鰭的形狀，而不只是顏色。
// 慣例：頭朝 +x、背朝 +y，全長約 1 個單位；尾巴（花枝為觸手）是獨立的 mesh，可左右擺動。

const C = (hex) => new THREE.Color(hex);
const DARK = 0x1b2430;

/** 各魚種的實際體長（世界單位），讓小丑魚與鬼頭刀的大小差距一眼可見 */
export const FISH_LENGTH = {
  clownfish: 0.2,
  squid: 0.3,
  pufferfish: 0.24,
  horse_mackerel: 0.32,
  red_sea_bream: 0.44,
  mahi_mahi: 0.66,
};

// ---- 幾何工具 ----------------------------------------------------------------

/**
 * 魚身：以 x 軸為中心軸的橢球，可調整前後的尖鈍與往尾端收窄的程度。
 * front / back < 1 較圓鈍、> 1 較尖；taper 為尾端相對頭端縮小的比例。
 * 每個四邊形格子帶有 cell 屬性，上色時整格同色，條紋與背腹分界才會是乾淨的直線。
 */
function bodyGeometry({ front = 1, back = 1, taper = 0, around = 16, rings = 18 } = {}) {
  const grid = [];
  for (let i = 0; i <= rings; i++) {
    const theta = (i / rings) * Math.PI;
    const x0 = Math.cos(theta);
    const radius = Math.sin(theta) * (1 - (taper * (1 - x0)) / 2);
    const x = Math.sign(x0) * Math.pow(Math.abs(x0), x0 > 0 ? front : back);
    for (let j = 0; j < around; j++) {
      const phi = (j / around) * Math.PI * 2; // 0 為背脊
      grid.push(x, radius * Math.cos(phi), radius * Math.sin(phi));
    }
  }
  // 先以共用頂點計算平滑法線，再展開成帶 cell 的三角形
  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute('position', new THREE.Float32BufferAttribute(grid, 3));
  const index = [];
  const at = (i, j) => i * around + (j % around);
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < around; j++) index.push(at(i, j), at(i + 1, j), at(i, j + 1), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1));
  }
  indexed.setIndex(index);
  indexed.computeVertexNormals();

  const g = indexed.toNonIndexed();
  const p = g.attributes.position;
  const cell = new Float32Array(p.count * 3);
  for (let q = 0; q < p.count; q += 6) {
    // 一格 = 兩個三角形 = 六個頂點，其中四個角各不相同
    const c = [0, 0, 0];
    for (const k of [0, 1, 2, 4]) {
      c[0] += p.getX(q + k) / 4;
      c[1] += p.getY(q + k) / 4;
      c[2] += p.getZ(q + k) / 4;
    }
    for (let k = 0; k < 6; k++) cell.set(c, (q + k) * 3);
  }
  g.setAttribute('cell', new THREE.BufferAttribute(cell, 3));
  return g;
}

/** 讓任意幾何以三角形為單位上色 */
function faceted(geometry) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const p = g.attributes.position;
  const cell = new Float32Array(p.count * 3);
  for (let q = 0; q < p.count; q += 3) {
    const c = [0, 1, 2].map((axis) => (p.array[q * 3 + axis] + p.array[q * 3 + 3 + axis] + p.array[q * 3 + 6 + axis]) / 3);
    for (let k = 0; k < 3; k++) cell.set(c, (q + k) * 3);
  }
  g.setAttribute('cell', new THREE.BufferAttribute(cell, 3));
  return g;
}

/** XY 平面上的薄片（鰭） */
function fin(points) {
  return new THREE.ShapeGeometry(new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y))));
}

function ellipsePoints(cx, cy, rx, ry, n = 14) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}

/** 帶深色邊的圓鰭（小丑魚） */
function rimmedFin(b, cx, cy, rx, ry, fill, rim, matrix, id) {
  b.add(fin(ellipsePoints(cx, cy, rx * 0.76, ry * 0.76)), fill, matrix, id);
  const shape = new THREE.Shape(ellipsePoints(cx, cy, rx, ry).map(([x, y]) => new THREE.Vector2(x, y)));
  shape.holes.push(new THREE.Path(ellipsePoints(cx, cy, rx * 0.76, ry * 0.76).map(([x, y]) => new THREE.Vector2(x, y))));
  b.add(new THREE.ShapeGeometry(shape), rim, matrix, id);
}

/** 與水平面的夾角（度）：正值為背側、負值為腹側 */
const elevation = (p) => (Math.atan2(p.y, Math.abs(p.z)) * 180) / Math.PI;

function eyes(b, x, y, z, r, id) {
  for (const s of [-1, 1]) {
    b.add(ball(1, 8, 6), 0xffffff, T(x, y, s * z, 0, 0, 0, r, r, r * 0.6), id);
    b.add(ball(1, 7, 5), DARK, T(x + r * 0.15, y, s * (z + r * 0.35), 0, 0, 0, r * 0.55, r * 0.55, r * 0.4), id);
  }
}

/** 一對胸鰭：向兩側張開 */
function pectorals(b, points, x, y, z, color, id, splay = 0.9) {
  for (const s of [-1, 1]) b.add(fin(points), color, T(x, y, s * z, -s * splay, 0, 0), id);
}

/** 身體表面上的小圓斑 */
function spots(b, list, size, [rx, ry, rz], color, id) {
  for (const [x, y] of list) {
    const k = 1 - (x * x) / (rx * rx) - (y * y) / (ry * ry);
    if (k <= 0) continue;
    for (const s of [-1, 1]) b.add(ball(1, 6, 5), color, T(x, y, s * rz * Math.sqrt(k) * 0.97, 0, 0, 0, size, size, size * 0.35), id);
  }
}

const FORKED = [
  [0, 0.05],
  [-0.2, 0.2],
  [-0.26, 0.2],
  [-0.12, 0],
  [-0.26, -0.2],
  [-0.2, -0.2],
  [0, -0.05],
];
const scalePts = (pts, sx, sy = sx) => pts.map(([x, y]) => [x * sx, y * sy]);

// ---- 魚種 --------------------------------------------------------------------
// 每個函式把零件加進 b（身體）與 t（尾巴，以尾柄為原點），回傳尾柄的 x 位置。

const SPECIES = {
  /** 小丑魚：圓胖的身體、三道黑邊白帶、全是圓弧的鰭 */
  clownfish(b, t, id) {
    const orange = C(0xff7a2e);
    const white = C(0xfff6e5);
    const edge = C(0x2a2330);
    const S = [0.4, 0.25, 0.15];
    const bands = [0.4, -0.12, -0.74];
    b.add(
      bodyGeometry({ front: 0.8, back: 0.9, rings: 30 }),
      (p, out) => {
        const d = Math.min(...bands.map((c) => Math.abs(p.x - c)));
        out.copy(d < 0.09 ? white : d < 0.14 ? edge : orange);
      },
      T(0, 0, 0, 0, 0, 0, ...S),
      id,
    );
    rimmedFin(b, 0.0, 0.23, 0.2, 0.1, 0xff7a2e, 0x2a2330, null, id);
    rimmedFin(b, -0.1, -0.23, 0.11, 0.08, 0xff7a2e, 0x2a2330, null, id);
    for (const s of [-1, 1]) rimmedFin(b, -0.07, -0.05, 0.1, 0.075, 0xff7a2e, 0x2a2330, T(0.14, -0.03, s * 0.13, -s * 0.9, s * 0.5, 0), id);
    eyes(b, 0.27, 0.05, 0.085, 0.045, id);
    rimmedFin(t, -0.13, 0, 0.15, 0.17, 0xff7a2e, 0x2a2330, null, id);
    return -0.33;
  },

  /** 花枝：尖錐狀的外套膜、兩片菱形鰭、大眼睛，身後拖著一束觸手 */
  squid(b, t, id) {
    const cream = C(0xfff6e5);
    const freckle = C(0xf4b3a2);
    b.add(
      faceted(new THREE.ConeGeometry(0.16, 0.66, 12, 6)),
      (p, out) => out.copy(Math.sin(p.y * 31 + Math.atan2(p.z, p.x) * 5) > 0.72 ? freckle : cream),
      T(0.17, 0, 0, 0, 0, -Math.PI / 2),
      id,
    );
    // 鰭在水平面上，從上方看是一個菱形
    b.add(fin([[0.5, 0], [0.26, 0.24], [0.1, 0], [0.26, -0.24]]), 0xfbd3c2, T(0, 0.01, 0, Math.PI / 2, 0, 0), id);
    b.add(ball(1, 10, 8), 0xffe6d2, T(-0.2, 0, 0, 0, 0, 0, 0.11, 0.1, 0.12), id);
    eyes(b, -0.2, 0.02, 0.095, 0.05, id);
    // 八隻短腕 + 兩隻帶吸盤的長觸腕
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const len = 0.3 + (i % 2) * 0.05;
      t.add(new THREE.ConeGeometry(0.03, len, 5), 0xf6c1b0, T(-len / 2, Math.sin(a) * 0.07, Math.cos(a) * 0.07, 0, Math.cos(a) * 0.2, Math.PI / 2 + Math.sin(a) * 0.2), id);
    }
    for (const s of [-1, 1]) {
      t.add(new THREE.CylinderGeometry(0.008, 0.012, 0.5, 5), 0xf6c1b0, T(-0.25, 0, s * 0.03, 0, 0, Math.PI / 2), id);
      t.add(ball(1, 7, 5), 0xf4a08c, T(-0.52, 0, s * 0.03, 0, 0, 0, 0.05, 0.022, 0.03), id);
    }
    return -0.29;
  },

  /** 河豚：鼓成一顆球，上金下白，全身短刺，鰭和尾巴都很小 */
  pufferfish(b, t, id) {
    const gold = C(0xf4b843);
    const patch = C(0xd9942b);
    const belly = C(0xfff3dc);
    const S = [0.33, 0.31, 0.29];
    b.add(
      bodyGeometry({ rings: 16 }),
      (p, out) => {
        if (elevation(p) < -8) return out.copy(belly);
        return out.copy(Math.sin(p.x * 9) * Math.sin(p.z * 8 + 1) > 0.45 ? patch : gold);
      },
      T(0, 0, 0, 0, 0, 0, ...S),
      id,
    );
    // 短刺：均勻分佈在球面上，避開臉和尾柄
    const up = new THREE.Vector3(0, 1, 0);
    const n = new THREE.Vector3();
    const count = 46;
    for (let i = 0; i < count; i++) {
      const y = 1 - (2 * (i + 0.5)) / count;
      const r = Math.sqrt(1 - y * y);
      const a = i * 2.39996;
      n.set(Math.cos(a) * r, y, Math.sin(a) * r);
      if (n.x > 0.72 || n.x < -0.88) continue;
      const pos = new THREE.Vector3(n.x * S[0], n.y * S[1], n.z * S[2]);
      const normal = new THREE.Vector3(n.x / S[0], n.y / S[1], n.z / S[2]).normalize();
      const m = new THREE.Matrix4().compose(pos.addScaledVector(normal, 0.025), new THREE.Quaternion().setFromUnitVectors(up, normal), new THREE.Vector3(1, 1, 1));
      b.add(new THREE.ConeGeometry(0.02, 0.08, 4), n.y < -0.15 ? 0xfff3dc : 0xfbe3a8, m, id);
    }
    b.add(ball(1, 8, 6), 0xf08c78, T(0.325, -0.03, 0, 0, 0, 0, 0.035, 0.045, 0.06), id);
    eyes(b, 0.2, 0.1, 0.19, 0.06, id);
    pectorals(b, ellipsePoints(-0.06, -0.01, 0.07, 0.05, 10), -0.02, -0.02, 0.28, 0xf7cf7a, id, 0.3);
    b.add(fin(ellipsePoints(-0.24, 0.27, 0.07, 0.05, 10)), 0xf7cf7a, null, id);
    t.add(fin([[0.02, 0.03], [-0.14, 0.1], [-0.17, 0], [-0.14, -0.1], [0.02, -0.03]]), 0xd9942b, null, id);
    return -0.31;
  },

  /** 竹筴魚：細長的流線型，青背銀腹，側面一條金線，深叉的尾巴 */
  horse_mackerel(b, t, id) {
    const back = C(0x2f8f93);
    const line = C(0xe9d36a);
    const belly = C(0xe2edf2);
    const S = [0.5, 0.125, 0.085];
    b.add(
      bodyGeometry({ front: 1.15, back: 1.1, taper: 0.25, around: 20, rings: 16 }),
      (p, out) => {
        const e = elevation(p);
        out.copy(e > 40 ? back : e > 12 ? line : belly);
      },
      T(0, 0, 0, 0, 0, 0, ...S),
      id,
    );
    b.add(fin([[0.2, 0.1], [0.1, 0.24], [-0.02, 0.1]]), 0x2f8f93, null, id);
    b.add(fin([[-0.06, 0.1], [-0.12, 0.17], [-0.42, 0.04], [-0.42, 0.02]]), 0x3fa5a8, null, id);
    b.add(fin([[-0.1, -0.09], [-0.15, -0.15], [-0.42, -0.04], [-0.42, -0.02]]), 0xcfdde4, null, id);
    pectorals(b, [[0, 0], [-0.16, -0.02], [-0.1, -0.07]], 0.2, -0.02, 0.07, 0xcfdde4, id, 0.6);
    eyes(b, 0.36, 0.02, 0.055, 0.035, id);
    t.add(fin(scalePts(FORKED, 0.85, 0.95)), 0xd9c46a, null, id);
    return -0.46;
  },

  /** 真鯛：側扁而高的身體，紅背粉腹，背上有藍色小點，長長的鋸齒背鰭 */
  red_sea_bream(b, t, id) {
    const red = C(0xd9534f);
    const pink = C(0xf7c7bd);
    const S = [0.42, 0.29, 0.1];
    b.add(
      bodyGeometry({ front: 0.72, back: 1, taper: 0.3, rings: 16 }),
      (p, out) => out.copy(elevation(p) > -6 ? red : pink),
      T(0, 0, 0, 0, 0, 0, ...S),
      id,
    );
    spots(b, [[0.12, 0.14], [0.0, 0.17], [-0.12, 0.14], [0.06, 0.07], [-0.08, 0.06], [-0.2, 0.07], [0.2, 0.08]], 0.016, S, 0x5fc3ff, id);
    // 背鰭：一排硬棘
    const spikes = [[0.2, 0.2]];
    for (let i = 0; i < 7; i++) {
      const x = 0.16 - i * 0.075;
      spikes.push([x, 0.37 - i * 0.022], [x - 0.04, 0.27 - i * 0.022]);
    }
    spikes.push([-0.38, 0.06], [-0.3, 0.02], [0.2, 0.1]);
    b.add(fin(spikes), 0xb8433f, null, id);
    b.add(fin([[-0.08, -0.2], [-0.14, -0.3], [-0.32, -0.08], [-0.3, -0.03]]), 0xe8928a, null, id);
    b.add(fin([[0.12, -0.24], [0.04, -0.36], [-0.02, -0.25]]), 0xe8928a, null, id);
    pectorals(b, [[0, 0], [-0.2, -0.04], [-0.16, -0.12], [-0.04, -0.08]], 0.16, -0.04, 0.085, 0xf2a59b, id, 0.7);
    eyes(b, 0.27, 0.08, 0.07, 0.055, id);
    b.add(ball(1, 7, 5), 0xb8433f, T(0.405, -0.05, 0, 0, 0, 0, 0.025, 0.02, 0.05), id);
    t.add(fin(scalePts(FORKED, 1.0, 1.2)), 0xb8433f, null, id);
    return -0.38;
  },

  /** 鬼頭刀：又高又鈍的額頭，身體一路收窄到尾柄，貫穿全背的藍色背鰭，翠綠配金 */
  mahi_mahi(b, t, id) {
    const green = C(0x1b998b);
    const lime = C(0x9fcf4f);
    const goldC = C(0xe9c46a);
    const S = [0.56, 0.2, 0.085];
    b.add(
      bodyGeometry({ front: 0.38, back: 1.05, taper: 0.66, around: 20 }),
      (p, out) => {
        const e = elevation(p);
        out.copy(e > 38 ? green : e > 8 ? lime : goldC);
      },
      T(0, 0, 0, 0, 0, 0, ...S),
      id,
    );
    spots(b, [[0.25, 0.02], [0.12, 0.05], [0.0, 0.01], [-0.12, 0.03], [-0.25, 0.0], [0.18, -0.06], [-0.05, -0.05], [0.32, -0.03]], 0.014, [S[0], S[1] * 0.75, S[2] * 0.9], 0x3fa9f5, id);
    // 背鰭從額頭一路延伸到尾柄
    b.add(fin([[0.46, 0.12], [0.42, 0.31], [0.2, 0.29], [-0.1, 0.2], [-0.4, 0.09], [-0.5, 0.04], [-0.5, 0.0], [0.3, 0.08]]), 0x1668b0, null, id);
    b.add(fin([[0.0, -0.1], [-0.06, -0.17], [-0.48, -0.035], [-0.48, 0.0]]), 0xd9a441, null, id);
    b.add(fin([[0.3, -0.15], [0.2, -0.3], [0.16, -0.14]]), 0xd9a441, null, id);
    pectorals(b, [[0, 0], [-0.2, -0.02], [-0.12, -0.1]], 0.3, -0.04, 0.075, 0xe9c46a, id, 0.7);
    eyes(b, 0.44, -0.02, 0.06, 0.04, id);
    t.add(fin(scalePts(FORKED, 1.15, 1.7)), 0xe9c46a, null, id);
    return -0.53;
  },
};

/** 資料表新增了魚種但還沒有專屬模型時的備用外型：依 bodyShape 決定比例，顏色取體色 */
function generic(fish) {
  const proportions = { oval: [0.42, 0.22, 0.12], circle: [0.33, 0.3, 0.26], slender: [0.5, 0.13, 0.09], elongated: [0.55, 0.16, 0.09], cone: [0.45, 0.16, 0.14] };
  const S = proportions[fish.bodyShape] || proportions.oval;
  const body = fish.colorHex || '#9fb4c0';
  const accent = fish.accentColorHex || body;
  return (b, t, id) => {
    b.add(bodyGeometry({ taper: 0.2 }), body, T(0, 0, 0, 0, 0, 0, ...S), id);
    b.add(fin([[0.12, S[1] * 0.8], [-0.02, S[1] + 0.12], [-0.2, S[1] * 0.7]]), accent, null, id);
    eyes(b, S[0] * 0.65, S[1] * 0.2, S[2] * 0.55, 0.04, id);
    t.add(fin(FORKED), accent, null, id);
    return -S[0] * 0.92;
  };
}

/**
 * 建立魚的模型。
 * @param {{ id: string, bodyShape?: string, colorHex?: string, accentColorHex?: string }} fish 魚種資料
 * @returns {THREE.Group} userData.tail 為可擺動的尾巴，userData.length 為建議的體長
 */
export function createFishModel(fish) {
  const b = new Builder();
  const t = new Builder();
  const tailX = (SPECIES[fish.id] || generic(fish))(b, t, newId());

  const group = new THREE.Group();
  const body = b.build(toonMat, { shadow: false });
  const tail = t.build(toonMat, { shadow: false });
  tail.position.x = tailX;
  group.add(body, tail);
  group.userData.tail = tail;
  group.userData.length = FISH_LENGTH[fish.id] || 0.3;
  return group;
}
