/**
 * 釣魚狀態機與核心玩法系統 (FishingSystem)
 * 嚴格遵循《日式海島第一人稱釣魚遊戲｜功能規劃文檔》
 *
 * 8 個狀態：
 * IDLE -> CHARGING -> CASTING -> WAITING -> BITING -> REELING -> CAUGHT / ESCAPED -> 回到 IDLE
 */

import { drawRandomFish, WATER_ZONES } from './fishData.js';

export const FISHING_STATE = {
  IDLE: 'IDLE',         // 自由走動、準備拋竿
  CHARGING: 'CHARGING', // 按住滑鼠左鍵蓄力
  CASTING: 'CASTING',   // 拋竿中（浮標空中飛行）
  WAITING: 'WAITING',   // 浮標落水等待魚咬鉤（隨機 3-8 秒）
  BITING: 'BITING',     // 咬鉤提示「！」（0.8 秒反應視窗）
  REELING: 'REELING',   // 張力小遊戲（維持在安全區收線）
  CAUGHT: 'CAUGHT',     // 成功釣起，彈出魚卡
  ESCAPED: 'ESCAPED',   // 魚跑掉了／脫鉤／拋到陸地
};

export class FishingSystem {
  /**
   * @param {Object} options
   * @param {import('./collectionSystem.js').CollectionSystem} [options.collectionSystem]
   */
  constructor(options = {}) {
    this.collectionSystem = options.collectionSystem || null;

    // 當前狀態（只讀此狀態驅動所有子系統）
    this.state = FISHING_STATE.IDLE;

    // 蓄力參數
    this.chargeTime = 0;
    this.maxChargeTime = 2.0; // 蓄力最長 2 秒達到 100%
    this.chargeRatio = 0;

    // 拋竿飛行
    this.castFlightTimer = 0;
    this.castFlightDuration = 0.8; // 浮標拋出到落水的過渡時間
    this.pendingWaterZone = WATER_ZONES.SHALLOW;
    this.pendingIsLand = false;

    // 等待咬鉤
    this.waitDuration = 0;
    this.waitTimer = 0;

    // 咬鉤反應視窗
    this.biteReactionWindow = 0.8; // 必須在 0.8 秒內點擊收竿
    this.biteTimer = 0;

    // 當前目標魚
    this.currentFish = null;

    // 張力小遊戲動態參數
    this.tension = 50; // 0 ~ 100
    this.isReelingInput = false;
    this.reelingProgress = 0; // 0 ~ 100%
    this.safeZoneMin = 35;
    this.safeZoneMax = 65;
    this.safeZoneTargetCenter = 50;
    this.safeZoneCenter = 50;
    this.fishFightTimer = 0;
    this.overTensionTimer = 0;
    this.slackTensionTimer = 0;
    this.stallTimer = 0; // 進度停在 0 的累計時間

    // 提示與回調
    this.toastMessage = '';
    this.toastTimer = 0;
    this.caughtCardTimer = 0;

    // 外部監聽器
    this.listeners = {
      onStateChange: [],
      onToast: [],
      onBite: [],
      onCaught: [],
      onEscape: [],
      onTensionUpdate: [],
    };
  }

  // --- 事件註冊機制 ---
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  emit(event, ...args) {
    if (this.listeners[event]) {
      for (const cb of this.listeners[event]) {
        cb(...args);
      }
    }
  }

  setState(nextState) {
    if (this.state === nextState) return;
    const prevState = this.state;
    this.state = nextState;
    this.emit('onStateChange', nextState, prevState);
  }

  showToast(message, duration = 1.5) {
    this.toastMessage = message;
    this.toastTimer = duration;
    this.emit('onToast', message, duration);
  }

  // --- 玩家輸入介面 ---

  /**
   * 按下滑鼠左鍵
   */
  handlePointerDown() {
    if (this.state === FISHING_STATE.IDLE) {
      this.chargeTime = 0;
      this.chargeRatio = 0;
      this.setState(FISHING_STATE.CHARGING);
    } else if (this.state === FISHING_STATE.BITING) {
      // 在 0.8 秒內成功響應咬鉤！進入張力小遊戲
      this.startReelingMiniGame();
    } else if (this.state === FISHING_STATE.REELING) {
      this.isReelingInput = true;
    }
  }

  /**
   * 放開滑鼠左鍵
   * @param {Object} [castInfo] 拋竿判定資訊（由 3D 場景提供落點環境）
   * @param {boolean} [castInfo.isLand] 是否落在陸地
   * @param {'shallow'|'deep'} [castInfo.zone] 水域類型
   */
  handlePointerUp(castInfo = {}) {
    if (this.state === FISHING_STATE.CHARGING) {
      // 放開蓄力，開始拋竿
      this.pendingIsLand = !!castInfo.isLand;
      this.pendingWaterZone = castInfo.zone || WATER_ZONES.SHALLOW;
      this.castFlightTimer = 0;
      this.setState(FISHING_STATE.CASTING);
    } else if (this.state === FISHING_STATE.REELING) {
      this.isReelingInput = false;
    }
  }

  /**
   * 按下右鍵：取消等待，收回浮標
   */
  handleRightClick() {
    if (this.state === FISHING_STATE.WAITING || this.state === FISHING_STATE.CHARGING) {
      this.showToast('已收回浮標');
      this.setState(FISHING_STATE.IDLE);
    }
  }

  /**
   * 手動關閉魚卡
   */
  dismissFishCard() {
    if (this.state === FISHING_STATE.CAUGHT) {
      this.setState(FISHING_STATE.IDLE);
    }
  }

  // --- 內部核心邏輯 ---

  startWaiting(zone) {
    // 依水域抽魚
    this.currentFish = drawRandomFish(zone);
    // 3–8 秒隨機等待時間
    this.waitDuration = 3.0 + Math.random() * 5.0;
    this.waitTimer = 0;
    this.setState(FISHING_STATE.WAITING);
  }

  triggerBite() {
    this.biteTimer = this.biteReactionWindow;
    this.setState(FISHING_STATE.BITING);
    this.emit('onBite', this.currentFish);
  }

  startReelingMiniGame() {
    if (!this.currentFish) return;

    const diff = this.currentFish.difficulty; // 1 ~ 5
    // 難度越高，安全區越窄：難度 1 為 46%，難度 5 為 22%
    const width = Math.max(20, 52 - diff * 6);
    this.safeZoneMin = 50 - width / 2;
    this.safeZoneMax = 50 + width / 2;
    this.safeZoneCenter = 50;
    this.safeZoneTargetCenter = 50;

    this.tension = 50;
    this.reelingProgress = 20; // 初始進度 20% 給予反應空間
    this.overTensionTimer = 0;
    this.slackTensionTimer = 0;
    this.stallTimer = 0;
    this.fishFightTimer = 0;
    this.isReelingInput = true;

    this.setState(FISHING_STATE.REELING);
  }

  // --- 每幀更新 ---

  update(dt) {
    // Toast 訊息倒數
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) {
        this.toastMessage = '';
      }
    }

    switch (this.state) {
      case FISHING_STATE.CHARGING: {
        this.chargeTime += dt;
        this.chargeRatio = Math.min(1.0, this.chargeTime / this.maxChargeTime);
        break;
      }

      case FISHING_STATE.CASTING: {
        this.castFlightTimer += dt;
        if (this.castFlightTimer >= this.castFlightDuration) {
          // 浮標落水判定
          if (this.pendingIsLand) {
            this.showToast('拋到陸地上了！');
            this.setState(FISHING_STATE.ESCAPED);
          } else {
            this.startWaiting(this.pendingWaterZone);
          }
        }
        break;
      }

      case FISHING_STATE.WAITING: {
        this.waitTimer += dt;
        if (this.waitTimer >= this.waitDuration) {
          this.triggerBite();
        }
        break;
      }

      case FISHING_STATE.BITING: {
        this.biteTimer -= dt;
        if (this.biteTimer <= 0) {
          // 超過 0.8 秒未點擊收竿 -> 脫鉤！
          this.showToast('魚跑掉了（反應太慢）！');
          this.setState(FISHING_STATE.ESCAPED);
        }
        break;
      }

      case FISHING_STATE.REELING: {
        this.updateReelingGame(dt);
        break;
      }

      case FISHING_STATE.CAUGHT: {
        this.caughtCardTimer -= dt;
        if (this.caughtCardTimer <= 0) {
          this.setState(FISHING_STATE.IDLE);
        }
        break;
      }

      case FISHING_STATE.ESCAPED: {
        // 脫鉤 1.5 秒後淡出自動重置回 IDLE
        if (this.toastTimer <= 0) {
          this.setState(FISHING_STATE.IDLE);
        }
        break;
      }

      case FISHING_STATE.IDLE:
      default:
        break;
    }
  }

  updateReelingGame(dt) {
    const fish = this.currentFish;
    const diff = fish ? fish.difficulty : 1;

    // 1. 玩家收線對張力的影響
    const reelPullSpeed = 70; // 按住收線的上升速度
    const reelSlackSpeed = 45; // 放開時張力自然回落速度

    if (this.isReelingInput) {
      this.tension += reelPullSpeed * dt;
    } else {
      this.tension -= reelSlackSpeed * dt;
    }

    // 2. 魚的游動掙扎（隨機拉扯阻力與安全區移動）
    this.fishFightTimer += dt;
    // 每隔一定間隔切換安全區目標位置（難度越大幅度越快越飄）
    const shiftInterval = Math.max(0.6, 2.2 - diff * 0.32);
    if (this.fishFightTimer >= shiftInterval) {
      this.fishFightTimer = 0;
      // 隨機移動安全區中心位置 (25 ~ 75)
      const range = 25 + (diff - 1) * 6;
      this.safeZoneTargetCenter = 50 + (Math.random() - 0.5) * range;
    }

    // 安全區平滑插值追蹤目標
    const lerpSpeed = 1.8 + diff * 0.9;
    this.safeZoneCenter += (this.safeZoneTargetCenter - this.safeZoneCenter) * Math.min(1.0, lerpSpeed * dt);
    const halfWidth = (this.safeZoneMax - this.safeZoneMin) / 2;
    this.safeZoneMin = Math.max(5, this.safeZoneCenter - halfWidth);
    this.safeZoneMax = Math.min(95, this.safeZoneCenter + halfWidth);

    // 魚本身的拉扯阻力加成
    const fishThrash = Math.sin(Date.now() * 0.006 * diff) * (diff * 7);
    this.tension += fishThrash * dt;

    // 張力邊界限制
    this.tension = Math.max(0, Math.min(100, this.tension));

    // 3. 判定張力是否在安全區內
    const inSafeZone = this.tension >= this.safeZoneMin && this.tension <= this.safeZoneMax;

    if (inSafeZone) {
      // 安全區內：進度上升（難度 5 上升較慎重）
      const gainRate = Math.max(14, 28 - diff * 2.8);
      this.reelingProgress += gainRate * dt;
      this.overTensionTimer = Math.max(0, this.overTensionTimer - dt * 2);
      this.slackTensionTimer = Math.max(0, this.slackTensionTimer - dt * 2);
    } else {
      // 偏離安全區：進度倒退
      const lossRate = 8 + diff * 2;
      this.reelingProgress -= lossRate * dt;

      // 檢查斷線（過載 > 92% 維持太久）
      if (this.tension >= 92) {
        this.overTensionTimer += dt;
        if (this.overTensionTimer >= 1.2) {
          this.showToast('釣線繃斷了！魚跑掉了！');
          this.setState(FISHING_STATE.ESCAPED);
          this.emit('onEscape', 'line_snap');
          return;
        }
      }

      // 檢查脫鉤（鬆線 < 8% 維持太久）
      if (this.tension <= 8) {
        this.slackTensionTimer += dt;
        if (this.slackTensionTimer >= 1.6) {
          this.showToast('釣線過鬆脫鉤了！魚跑掉了！');
          this.setState(FISHING_STATE.ESCAPED);
          this.emit('onEscape', 'slack_hook');
          return;
        }
      }
    }

    this.reelingProgress = Math.max(0, Math.min(100, this.reelingProgress));

    // 進度歸零後僵持太久：魚掙脫
    if (this.reelingProgress <= 0) {
      this.stallTimer += dt;
      if (this.stallTimer >= 2.0) {
        this.showToast('魚掙脫了！魚跑掉了！');
        this.setState(FISHING_STATE.ESCAPED);
        this.emit('onEscape', 'stall');
        return;
      }
    } else {
      this.stallTimer = 0;
    }

    this.emit('onTensionUpdate', {
      tension: this.tension,
      safeZoneMin: this.safeZoneMin,
      safeZoneMax: this.safeZoneMax,
      progress: this.reelingProgress,
      inSafeZone,
    });

    // 4. 成功釣起！
    if (this.reelingProgress >= 100) {
      this.caughtFishSuccess();
    }
  }

  caughtFishSuccess() {
    const fish = this.currentFish;
    this.caughtCardTimer = 3.0; // 3 秒自動關閉，亦可點擊關閉
    this.setState(FISHING_STATE.CAUGHT);

    if (this.collectionSystem && fish) {
      this.collectionSystem.recordCatch(fish);
    }

    this.emit('onCaught', fish);
  }
}
