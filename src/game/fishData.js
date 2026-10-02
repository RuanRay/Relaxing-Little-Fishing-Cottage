/**
 * 魚種資料表與抽魚演算法 (FishData)
 * 依照《日式海島第一人稱釣魚遊戲｜功能規劃文檔》規格定義
 */

export const WATER_ZONES = {
  SHALLOW: 'shallow', // 淺灘
  DEEP: 'deep',       // 深水
};

export const RARITY = {
  COMMON: '普通',
  RARE: '稀有',
  LEGENDARY: '傳說',
};

export const FISH_DATABASE = [
  // 淺灘魚種
  {
    id: 'clownfish',
    name: '小丑魚',
    zone: WATER_ZONES.SHALLOW,
    rarity: RARITY.COMMON,
    weight: 50, // 出現權重
    minWeight: 0.1,
    maxWeight: 0.3,
    difficulty: 1,
    colorName: '珊瑚橙',
    colorHex: '#FF6B4A',
    bodyShape: 'oval', // 幾何卡片繪製形狀
  },
  {
    id: 'squid',
    name: '花枝',
    zone: WATER_ZONES.SHALLOW,
    rarity: RARITY.COMMON,
    weight: 35,
    minWeight: 0.3,
    maxWeight: 1.2,
    difficulty: 2,
    colorName: '奶油白',
    colorHex: '#FFF6E5',
    bodyShape: 'cone',
  },
  {
    id: 'pufferfish',
    name: '河豚',
    zone: WATER_ZONES.SHALLOW,
    rarity: RARITY.RARE,
    weight: 15,
    minWeight: 0.5,
    maxWeight: 2.0,
    difficulty: 3,
    colorName: '暖金色',
    colorHex: '#F4B843',
    bodyShape: 'circle',
  },

  // 深水魚種
  {
    id: 'horse_mackerel',
    name: '竹筴魚',
    zone: WATER_ZONES.DEEP,
    rarity: RARITY.COMMON,
    weight: 50,
    minWeight: 0.2,
    maxWeight: 0.8,
    difficulty: 2,
    colorName: '青綠色',
    colorHex: '#48A9A6',
    bodyShape: 'slender',
  },
  {
    id: 'red_sea_bream',
    name: '真鯛',
    zone: WATER_ZONES.DEEP,
    rarity: RARITY.RARE,
    weight: 35,
    minWeight: 1.0,
    maxWeight: 5.0,
    difficulty: 4,
    colorName: '鏽紅',
    colorHex: '#D9534F',
    bodyShape: 'oval',
  },
  {
    id: 'mahi_mahi',
    name: '鬼頭刀',
    zone: WATER_ZONES.DEEP,
    rarity: RARITY.LEGENDARY,
    weight: 15,
    minWeight: 5.0,
    maxWeight: 15.0,
    difficulty: 5,
    colorName: '翠綠＋金',
    colorHex: '#1B998B',
    accentColorHex: '#E9C46A',
    bodyShape: 'elongated',
  },
];

/**
 * 依水域篩選魚種
 * @param {'shallow'|'deep'} zone
 * @returns {Array}
 */
export function getFishByZone(zone) {
  return FISH_DATABASE.filter((f) => f.zone === zone);
}

/**
 * 依落點水域隨機抽魚並計算重量
 * 規則：依出現權重加權隨機，重量在 [minWeight, maxWeight] 均勻取值四捨五入至小數點後一位
 * @param {'shallow'|'deep'} zone
 * @returns {{ fish: Object, weightKg: number }}
 */
export function drawRandomFish(zone = WATER_ZONES.SHALLOW) {
  const candidateList = getFishByZone(zone);
  if (candidateList.length === 0) {
    throw new Error(`找不到該水域的魚種: ${zone}`);
  }

  const totalWeight = candidateList.reduce((sum, item) => sum + item.weight, 0);
  let randomVal = Math.random() * totalWeight;

  let selectedFish = candidateList[0];
  for (const item of candidateList) {
    if (randomVal < item.weight) {
      selectedFish = item;
      break;
    }
    randomVal -= item.weight;
  }

  // 均勻隨機重量並四捨五入至小數點後 1 位
  const rawWeight = selectedFish.minWeight + Math.random() * (selectedFish.maxWeight - selectedFish.minWeight);
  const weightKg = Math.round(rawWeight * 10) / 10;

  return {
    ...selectedFish,
    weightKg,
  };
}
