/**
 * 圖鑑與漁獲紀錄系統 (CollectionSystem)
 * 負責紀錄釣獲的魚種、重量、次數，並提供圖鑑渲染資料
 */

import { FISH_DATABASE } from './fishData.js';

export class CollectionSystem {
  constructor() {
    // 記憶體中記錄每個魚種的捕獲狀態
    // key: fishId -> { count: number, maxWeight: number, minWeight: number, firstCaughtAt: Date }
    this.records = new Map();
  }

  /**
   * 記錄釣獲一條魚
   * @param {Object} caughtFish 包含 id, weightKg 等屬性的物件
   */
  recordCatch(caughtFish) {
    const existing = this.records.get(caughtFish.id);
    if (!existing) {
      this.records.set(caughtFish.id, {
        count: 1,
        maxWeight: caughtFish.weightKg,
        minWeight: caughtFish.weightKg,
        firstCaughtAt: new Date(),
      });
    } else {
      existing.count += 1;
      existing.maxWeight = Math.max(existing.maxWeight, caughtFish.weightKg);
      existing.minWeight = Math.min(existing.minWeight, caughtFish.weightKg);
    }
  }

  /**
   * 檢查某魚種是否已經釣到過
   * @param {string} fishId
   * @returns {boolean}
   */
  hasCaught(fishId) {
    return this.records.has(fishId);
  }

  /**
   * 取得某魚種的詳細紀錄
   * @param {string} fishId
   */
  getRecord(fishId) {
    return this.records.get(fishId) || null;
  }

  /**
   * 取得完整的圖鑑條目列表（包含未解鎖的剪影項目）
   * @returns {Array<Object>}
   */
  getAllEntries() {
    return FISH_DATABASE.map((fish) => {
      const record = this.records.get(fish.id);
      if (record) {
        return {
          id: fish.id,
          name: fish.name,
          isUnlocked: true,
          rarity: fish.rarity,
          zone: fish.zone,
          colorHex: fish.colorHex,
          accentColorHex: fish.accentColorHex,
          bodyShape: fish.bodyShape,
          count: record.count,
          maxWeight: record.maxWeight,
          minWeight: record.minWeight,
        };
      } else {
        return {
          id: fish.id,
          name: '？？？',
          isUnlocked: false,
          rarity: fish.rarity,
          zone: fish.zone,
          colorHex: '#3A3D40', // 剪影色
          accentColorHex: null,
          bodyShape: fish.bodyShape,
          count: 0,
          maxWeight: null,
          minWeight: null,
        };
      }
    });
  }

  /**
   * 取得當前圖鑑解鎖進度（如 3/6）
   */
  getProgress() {
    const total = FISH_DATABASE.length;
    const unlocked = this.records.size;
    return {
      unlocked,
      total,
      percentage: Math.round((unlocked / total) * 100),
    };
  }

  /**
   * 重設圖鑑（僅保留在記憶體）
   */
  reset() {
    this.records.clear();
  }
}
