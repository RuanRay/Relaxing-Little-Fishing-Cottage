import * as THREE from 'three';
import { HALF, HOUSE, LIGHTHOUSE, heightAt, normalAt } from '../world/terrain.js';
import { worldToDock, DOCK_LENGTH, DECK_Y, END_WIDE } from '../world/dock.js';
import { HOUSE_MATRIX, BODY_Z, FRONT, FLOOR, STAIR_X, STAIR_LENGTH } from '../world/house.js';
import { WATER_ZONES } from './fishData.js';

// 可行走區域與落點判定。
// 地面高度直接取地形函式與幾個平台的解析式，效果等同向下 raycast，但不必每幀掃過整個合併網格。

const HOUSE_INVERSE = HOUSE_MATRIX.clone().invert();
const DECK_TOP = HOUSE.y + FLOOR;
const DECK_Z0 = FRONT - 0.03;
const DECK_Z1 = DECK_Z0 + 1.42;
const PIER_TOP = DECK_Y + 0.05;
// 台階底端的地面高度
const STAIR_FOOT = new THREE.Vector3(STAIR_X, 0, DECK_Z1 + STAIR_LENGTH).applyMatrix4(HOUSE_MATRIX);
const STAIR_BOTTOM = heightAt(STAIR_FOOT.x, STAIR_FOOT.z);

/** 深於此值的水域視為深水 */
export const DEEP_WATER_DEPTH = 0.7;

const _d = new THREE.Vector3();
const _h = new THREE.Vector3();
const _n = new THREE.Vector3();

/** 棧橋與末端平台 */
function onPier(x, z) {
  worldToDock(x, z, _d);
  const L = DOCK_LENGTH;
  const main = _d.x > -0.25 && _d.x < L + 0.02 && Math.abs(_d.z) < 0.5;
  const end = _d.x > L - END_WIDE && _d.x < L + 0.02 && _d.z > -0.64 && _d.z < 1.24;
  return main || end;
}

/**
 * 某一點的地面資訊。
 * @returns {{ y: number, walkable: boolean, platform: boolean }}
 */
export function groundAt(x, z, out = { y: 0, walkable: false, platform: false }) {
  const terrain = heightAt(x, z);
  out.platform = false;

  if (onPier(x, z)) {
    out.y = Math.max(terrain, PIER_TOP);
    out.walkable = true;
    out.platform = true;
    return out;
  }

  _h.set(x, 0, z).applyMatrix4(HOUSE_INVERSE);
  if (Math.abs(_h.x) < 1.95 && _h.z > DECK_Z0 && _h.z < DECK_Z1) {
    out.y = DECK_TOP;
    out.walkable = true;
    out.platform = true;
    return out;
  }
  // 平台前方的台階：當成一道斜坡
  if (Math.abs(_h.x - STAIR_X) < 0.45 && _h.z >= DECK_Z1 && _h.z < DECK_Z1 + STAIR_LENGTH) {
    const k = (_h.z - DECK_Z1) / STAIR_LENGTH;
    out.y = Math.max(terrain, DECK_TOP + (STAIR_BOTTOM - DECK_TOP) * k);
    out.walkable = true;
    out.platform = true;
    return out;
  }

  out.y = terrain;
  // 不可走進海裡，也不可爬上崖面
  out.walkable = terrain > 0.05 && normalAt(x, z, _n).y > 0.5 && Math.max(Math.abs(x), Math.abs(z)) < HALF - 0.3;
  return out;
}

/** 實心障礙物：木屋屋身、燈塔，以及場景登記的樹幹等圓形碰撞 */
export function isBlocked(x, z, colliders, radius = 0.18) {
  _h.set(x, 0, z).applyMatrix4(HOUSE_INVERSE);
  if (Math.abs(_h.x) < 1.5 + radius && _h.z > BODY_Z - 1.1 - radius && _h.z < FRONT + 0.08 + radius) return true;
  if (Math.hypot(x - LIGHTHOUSE.x, z - LIGHTHOUSE.z) < 0.5 + radius) return true;
  for (const c of colliders) {
    if (Math.hypot(x - c.x, z - c.z) < c.r + radius) return true;
  }
  return false;
}

/**
 * 拋竿落點判定。
 * @returns {{ isLand: boolean, zone: 'shallow'|'deep', y: number }}
 */
export function castInfoAt(x, z) {
  const terrain = heightAt(x, z);
  if (onPier(x, z)) return { isLand: true, zone: WATER_ZONES.SHALLOW, y: Math.max(terrain, PIER_TOP) };
  _h.set(x, 0, z).applyMatrix4(HOUSE_INVERSE);
  if (Math.abs(_h.x) < 1.95 && _h.z > BODY_Z - 1.1 && _h.z < DECK_Z1) return { isLand: true, zone: WATER_ZONES.SHALLOW, y: DECK_TOP };
  if (terrain > -0.03) return { isLand: true, zone: WATER_ZONES.SHALLOW, y: terrain };
  return { isLand: false, zone: -terrain > DEEP_WATER_DEPTH ? WATER_ZONES.DEEP : WATER_ZONES.SHALLOW, y: 0 };
}
