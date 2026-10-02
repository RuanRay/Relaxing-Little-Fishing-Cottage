/**
 * 情境式 HUD 管理器 (HUD)
 * 依照規格：準心、蓄力條、咬鉤警示、張力與進度條、魚卡、Toast 提示、圖鑑與暫停介面
 */

import { FISHING_STATE } from '../game/fishingSystem.js';

export class HUD {
  /**
   * @param {Object} options
   * @param {import('../game/fishingSystem.js').FishingSystem} options.fishingSystem
   * @param {import('../game/collectionSystem.js').CollectionSystem} options.collectionSystem
   * @param {HTMLElement} [options.container]
   */
  constructor(options) {
    this.fishingSystem = options.fishingSystem;
    this.collectionSystem = options.collectionSystem;
    this.container = options.container || document.body;

    this.isCollectionOpen = false;
    this.isPaused = false;
    this.isFirstPersonActive = false; // 是否已從開場環繞切換至第一人稱

    this.initDOM();
    this.bindEvents();
  }

  initDOM() {
    // 建立 HUD 根容器
    let root = document.getElementById('hud-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'hud-root';
      this.container.appendChild(root);
    }
    this.root = root;

    this.root.innerHTML = `
      <!-- 1. 開場標題與點擊開始 -->
      <div id="start-screen" class="interactive">
        <div class="start-title">🎣 日式幻想海島</div>
        <div class="start-sub">點擊畫面進入第一人稱</div>
      </div>

      <!-- 2. 準心 -->
      <div id="crosshair" class="hidden"></div>

      <!-- 3. 蓄力條 -->
      <div id="charge-container">
        <div id="charge-fill"></div>
      </div>

      <!-- 4. 咬鉤提示 -->
      <div id="bite-alert">！</div>

      <!-- 5. 張力條與收線進度條 -->
      <div id="reeling-hud">
        <div class="meter-column">
          <div class="meter-title">釣線張力</div>
          <div class="tension-track">
            <div id="safe-zone"></div>
            <div id="tension-indicator"></div>
          </div>
          <div class="reeling-tip">按住收線<br>放開放線</div>
        </div>
        <div class="meter-column">
          <div class="meter-title">捕獲進度</div>
          <div class="progress-track">
            <div id="catch-progress-fill"></div>
          </div>
          <div class="reeling-tip">維持在<br>安全區</div>
        </div>
      </div>

      <!-- 6. 結果提示字 -->
      <div id="toast-message"></div>

      <!-- 7. 釣獲魚卡 -->
      <div id="fish-card" class="interactive">
        <div class="fish-card-header">✦ 釣到新漁獲 ✦</div>
        <div class="fish-visual">
          <div id="fish-card-shape" class="fish-avatar-shape"></div>
        </div>
        <div id="fish-card-name" class="fish-card-name">小丑魚</div>
        <div id="fish-card-badge" class="fish-card-badge rarity-普通">普通</div>
        <div id="fish-card-weight" class="fish-card-meta">重量：0.2 kg</div>
        <div class="fish-card-hint">點擊任意處收起 (或 3 秒後自動收起)</div>
      </div>

      <!-- 8. 圖鑑視窗 (Tab 鍵) -->
      <div id="collection-modal">
        <div class="collection-dialog">
          <div class="collection-header">
            <div class="collection-title">📖 海島釣魚圖鑑</div>
            <div id="collection-stats" class="collection-stats">收集進度：0 / 6</div>
          </div>
          <div id="collection-grid" class="collection-grid"></div>
          <div class="collection-footer">按 [Tab] 或點擊背景關閉圖鑑</div>
        </div>
      </div>

      <!-- 9. 暫停視窗 (Esc 鍵) -->
      <div id="pause-screen">
        <div class="pause-box interactive">
          <h2 style="margin:0 0 10px 0; color:var(--dark-green);">遊戲暫停</h2>
          <p style="margin:0 0 16px 0; color:#555;">滑鼠已釋放</p>
          <button id="resume-btn" style="
            background: var(--ocean-blue);
            color: #fff;
            border: 2px solid var(--dark-green);
            padding: 8px 24px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 800;
            cursor: pointer;
          ">點擊恢復遊戲</button>
        </div>
      </div>
    `;

    // 取得 DOM 引用
    this.dom = {
      startScreen: document.getElementById('start-screen'),
      crosshair: document.getElementById('crosshair'),
      chargeContainer: document.getElementById('charge-container'),
      chargeFill: document.getElementById('charge-fill'),
      biteAlert: document.getElementById('bite-alert'),
      reelingHUD: document.getElementById('reeling-hud'),
      safeZone: document.getElementById('safe-zone'),
      tensionIndicator: document.getElementById('tension-indicator'),
      catchProgressFill: document.getElementById('catch-progress-fill'),
      toastMessage: document.getElementById('toast-message'),
      fishCard: document.getElementById('fish-card'),
      fishCardShape: document.getElementById('fish-card-shape'),
      fishCardName: document.getElementById('fish-card-name'),
      fishCardBadge: document.getElementById('fish-card-badge'),
      fishCardWeight: document.getElementById('fish-card-weight'),
      collectionModal: document.getElementById('collection-modal'),
      collectionStats: document.getElementById('collection-stats'),
      collectionGrid: document.getElementById('collection-grid'),
      pauseScreen: document.getElementById('pause-screen'),
      resumeBtn: document.getElementById('resume-btn'),
    };
  }

  bindEvents() {
    // 1. 綁定 FishingSystem 事件
    this.fishingSystem.on('onStateChange', (newState) => {
      this.handleStateChange(newState);
    });

    this.fishingSystem.on('onToast', (message) => {
      this.showToast(message);
    });

    this.fishingSystem.on('onBite', () => {
      this.dom.biteAlert.classList.add('active');
    });

    this.fishingSystem.on('onCaught', (fish) => {
      this.showFishCard(fish);
    });

    this.fishingSystem.on('onTensionUpdate', (data) => {
      this.updateTensionHUD(data);
    });

    // 2. 魚卡點擊收起
    this.dom.fishCard.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.fishingSystem.dismissFishCard();
      this.hideFishCard();
    });

    // 3. 鍵盤事件：Tab 切換圖鑑、Esc 暫停
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        this.toggleCollection();
      } else if (e.key === 'Escape') {
        this.togglePause();
      }
    });

    // 點擊圖鑑遮罩可關閉
    this.dom.collectionModal.addEventListener('pointerdown', (e) => {
      if (e.target === this.dom.collectionModal) {
        this.toggleCollection(false);
      }
    });

    // 暫停恢復按鈕
    this.dom.resumeBtn.addEventListener('click', () => {
      this.togglePause(false);
    });
  }

  /**
   * 進入第一人稱視角（開場結束後呼叫）
   */
  activateFirstPerson() {
    this.isFirstPersonActive = true;
    this.dom.startScreen.style.display = 'none';
    this.dom.crosshair.classList.remove('hidden');
  }

  handleStateChange(state) {
    // 準心：第一人稱中恆常顯示，但在彈出視窗時可淡化
    if (this.isFirstPersonActive) {
      this.dom.crosshair.classList.remove('hidden');
    }

    // 蓄力條
    if (state === FISHING_STATE.CHARGING) {
      this.dom.chargeContainer.style.display = 'block';
      this.dom.chargeFill.style.width = '0%';
    } else {
      this.dom.chargeContainer.style.display = 'none';
    }

    // 咬鉤提示「！」
    if (state !== FISHING_STATE.BITING) {
      this.dom.biteAlert.classList.remove('active');
    }

    // 張力小遊戲面板
    if (state === FISHING_STATE.REELING) {
      this.dom.reelingHUD.style.display = 'flex';
    } else {
      this.dom.reelingHUD.style.display = 'none';
    }

    // 魚卡關閉
    if (state !== FISHING_STATE.CAUGHT) {
      this.hideFishCard();
    }
  }

  updateTensionHUD({ tension, safeZoneMin, safeZoneMax, progress, inSafeZone }) {
    // 安全區在高度上的位置（bottom 百分比，高度百分比）
    const bottomPct = safeZoneMin;
    const heightPct = safeZoneMax - safeZoneMin;
    this.dom.safeZone.style.bottom = `${bottomPct}%`;
    this.dom.safeZone.style.height = `${heightPct}%`;

    // 當前張力游標
    this.dom.tensionIndicator.style.bottom = `${tension}%`;
    if (inSafeZone) {
      this.dom.tensionIndicator.classList.add('safe');
    } else {
      this.dom.tensionIndicator.classList.remove('safe');
    }

    // 捕獲進度
    this.dom.catchProgressFill.style.height = `${progress}%`;
  }

  showToast(message) {
    this.dom.toastMessage.textContent = message;
    this.dom.toastMessage.classList.add('show');
    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      this.dom.toastMessage.classList.remove('show');
    }, 1500);
  }

  showFishCard(fish) {
    this.dom.fishCardName.textContent = fish.name;
    this.dom.fishCardBadge.textContent = fish.rarity;
    this.dom.fishCardBadge.className = `fish-card-badge rarity-${fish.rarity}`;
    this.dom.fishCardWeight.textContent = `重量：${fish.weightKg.toFixed(1)} kg  (${fish.zone === 'shallow' ? '淺灘' : '深水'})`;

    // 設置幾何形狀體色
    this.dom.fishCardShape.style.backgroundColor = fish.colorHex;

    this.dom.fishCard.classList.add('show');
  }

  hideFishCard() {
    this.dom.fishCard.classList.remove('show');
  }

  toggleCollection(forceState = null) {
    this.isCollectionOpen = forceState !== null ? forceState : !this.isCollectionOpen;
    if (this.isCollectionOpen) {
      this.renderCollectionGrid();
      this.dom.collectionModal.classList.add('show');
    } else {
      this.dom.collectionModal.classList.remove('show');
    }
  }

  renderCollectionGrid() {
    if (!this.collectionSystem) return;
    const entries = this.collectionSystem.getAllEntries();
    const progress = this.collectionSystem.getProgress();

    this.dom.collectionStats.textContent = `收集進度：${progress.unlocked} / ${progress.total} (${progress.percentage}%)`;

    this.dom.collectionGrid.innerHTML = entries
      .map((entry) => {
        if (entry.isUnlocked) {
          return `
            <div class="collection-card">
              <div class="collection-card-icon" style="background:${entry.colorHex};"></div>
              <div class="collection-card-name">${entry.name}</div>
              <div class="collection-card-info">
                ${entry.rarity} · ${entry.zone === 'shallow' ? '淺灘' : '深水'}<br>
                最大紀錄: ${entry.maxWeight.toFixed(1)} kg<br>
                釣獲次數: ${entry.count} 次
              </div>
            </div>
          `;
        } else {
          return `
            <div class="collection-card locked">
              <div class="collection-card-icon" style="background:#4A4E51;"></div>
              <div class="collection-card-name">？？？</div>
              <div class="collection-card-info">
                ${entry.rarity} · ${entry.zone === 'shallow' ? '淺灘' : '深水'}<br>
                尚未釣獲
              </div>
            </div>
          `;
        }
      })
      .join('');
  }

  togglePause(forceState = null) {
    this.isPaused = forceState !== null ? forceState : !this.isPaused;
    if (this.isPaused) {
      this.dom.pauseScreen.classList.add('show');
    } else {
      this.dom.pauseScreen.classList.remove('show');
    }
  }

  /**
   * 每幀更新（如蓄力條即時跟隨系統）
   */
  update(dt) {
    if (this.fishingSystem.state === FISHING_STATE.CHARGING) {
      const pct = (this.fishingSystem.chargeRatio * 100).toFixed(1);
      this.dom.chargeFill.style.width = `${pct}%`;
    }
  }
}
