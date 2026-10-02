// 魚的圖示：以橢圓、三角形、圓等基本幾何圖形拼出，顏色取魚種的體色。
// 圖鑑中尚未釣到的魚以同一輪廓的深色剪影呈現。

const OUTLINE = '#1B4332';
const SILHOUETTE = '#3A3D40';

// 各體型的身體比例：[身長半徑, 身高半徑]，以及尾巴大小
const SHAPES = {
  oval: { rx: 30, ry: 18, tail: 16 },
  circle: { rx: 23, ry: 22, tail: 11 },
  slender: { rx: 36, ry: 11, tail: 15 },
  elongated: { rx: 40, ry: 14, tail: 19 },
  cone: { rx: 26, ry: 15, tail: 0 },
};

/**
 * @param {{ bodyShape: string, colorHex: string, accentColorHex?: string }} fish
 * @param {{ silhouette?: boolean }} [options]
 * @returns {string} SVG 字串
 */
export function fishIconSVG(fish, { silhouette = false } = {}) {
  const shape = SHAPES[fish.bodyShape] || SHAPES.oval;
  const body = silhouette ? SILHOUETTE : fish.colorHex;
  const accent = silhouette ? SILHOUETTE : fish.accentColorHex || shade(fish.colorHex, -0.18);
  const stroke = silhouette ? SILHOUETTE : OUTLINE;
  const cx = 62;
  const cy = 40;
  const parts = [];
  const attr = `stroke="${stroke}" stroke-width="3" stroke-linejoin="round"`;

  if (fish.bodyShape === 'cone') {
    // 花枝：三角形的身體、兩片鰭、垂下的觸手
    for (let i = 0; i < 5; i++) {
      const x = cx - 34 - i * 1.5;
      const y = cy - 10 + i * 5;
      parts.push(`<path d="M${cx - 22} ${y} Q${x - 4} ${y + (i - 2) * 3} ${x - 14} ${y + (i - 2) * 5}" fill="none" stroke="${accent === SILHOUETTE ? SILHOUETTE : OUTLINE}" stroke-width="3" stroke-linecap="round"/>`);
    }
    parts.push(`<polygon points="${cx + 6},${cy - 22} ${cx + 30},${cy} ${cx + 6},${cy + 22}" fill="${accent}" ${attr}/>`);
    parts.push(`<polygon points="${cx - 26},${cy - 13} ${cx + 34},${cy} ${cx - 26},${cy + 13}" fill="${body}" ${attr}/>`);
    parts.push(eye(cx - 14, cy - 3, silhouette));
  } else {
    const { rx, ry, tail } = shape;
    // 尾鰭、背鰭、腹鰭、身體
    parts.push(`<polygon points="${cx - rx + 5},${cy} ${cx - rx - tail},${cy - tail * 0.85} ${cx - rx - tail * 0.55},${cy} ${cx - rx - tail},${cy + tail * 0.85}" fill="${accent}" ${attr}/>`);
    parts.push(`<polygon points="${cx - rx * 0.35},${cy - ry + 2} ${cx + rx * 0.05},${cy - ry - 10} ${cx + rx * 0.4},${cy - ry + 3}" fill="${accent}" ${attr}/>`);
    parts.push(`<polygon points="${cx - rx * 0.1},${cy + ry - 2} ${cx + rx * 0.1},${cy + ry + 8} ${cx + rx * 0.35},${cy + ry - 3}" fill="${accent}" ${attr}/>`);
    parts.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${body}" ${attr}/>`);
    if (!silhouette) {
      if (fish.id === 'clownfish') {
        // 小丑魚的白色條紋
        for (const dx of [-0.42, 0.12]) parts.push(`<rect x="${cx + rx * dx}" y="${cy - ry + 4}" width="7" height="${ry * 2 - 8}" rx="3" fill="#FFF6E5" stroke="${OUTLINE}" stroke-width="2"/>`);
      } else if (fish.bodyShape === 'circle') {
        // 河豚的小刺
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2 + 0.3;
          parts.push(`<circle cx="${(cx + Math.cos(a) * rx * 0.55).toFixed(1)}" cy="${(cy + Math.sin(a) * ry * 0.55).toFixed(1)}" r="2" fill="${OUTLINE}" opacity="0.45"/>`);
        }
      } else if (fish.accentColorHex) {
        // 雙色魚的腹部色帶
        parts.push(`<ellipse cx="${cx + 2}" cy="${cy + ry * 0.45}" rx="${rx * 0.72}" ry="${ry * 0.38}" fill="${fish.accentColorHex}"/>`);
      }
      // 胸鰭
      parts.push(`<polygon points="${cx + rx * 0.2},${cy + 1} ${cx - rx * 0.12},${cy + ry * 0.55} ${cx + rx * 0.3},${cy + ry * 0.45}" fill="${accent}" stroke="${OUTLINE}" stroke-width="2" stroke-linejoin="round"/>`);
    }
    parts.push(eye(cx + rx * 0.58, cy - ry * 0.22, silhouette));
  }

  return `<svg viewBox="0 0 124 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${parts.join('')}</svg>`;
}

function eye(x, y, silhouette) {
  if (silhouette) return '';
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="#fff" stroke="${OUTLINE}" stroke-width="2"/><circle cx="${(x + 1).toFixed(1)}" cy="${y.toFixed(1)}" r="2" fill="${OUTLINE}"/>`;
}

/** 把色碼調亮（amount > 0）或調暗（amount < 0） */
function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const channel = (v) => Math.round(Math.min(255, Math.max(0, amount < 0 ? v * (1 + amount) : v + (255 - v) * amount)));
  const r = channel(n >> 16);
  const g = channel((n >> 8) & 255);
  const b = channel(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
