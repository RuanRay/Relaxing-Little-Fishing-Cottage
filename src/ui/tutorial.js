/**
 * 新手教學 (Tutorial)
 * 進入第一人稱後，在畫面上方以一張小卡片逐步帶玩家完成第一尾魚。
 * 每一步都由玩家「實際做到」才會前進，不需要按下一步；可按 Q 跳過，暫停畫面可重看。
 */

import * as THREE from 'three';
import './tutorial.css';
import { FISHING_STATE } from '../game/fishingSystem.js';

const S = FISHING_STATE;
const IN_WATER = new Set([S.WAITING, S.BITING, S.REELING, S.CAUGHT]);
const HOOKED = new Set([S.REELING, S.CAUGHT]);
const BACK_ON_SHORE = new Set([S.IDLE, S.CHARGING, S.ESCAPED]);

const FLASH_TIME = 0.9; // 完成一步後，打勾停留的時間
const DONE_TIME = 7; // 結語卡片停留的時間

const STEPS = [
  {
    id: 'look',
    title: '環顧四周',
    body: '移動 <kbd>滑鼠</kbd> 轉動視角，看看這座小島。',
  },
  {
    id: 'move',
    title: '走上棧橋',
    body: '用 <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 移動，按住 <kbd>Shift</kbd> 可以加速。往棧橋盡頭走走看。',
  },
  {
    id: 'cast',
    title: '拋竿',
    body: '把準心對著水面，<kbd>按住左鍵</kbd> 蓄力，放開就拋出。蓄得越久，拋得越遠。',
  },
  {
    id: 'hook',
    title: '等魚上鉤',
    body: '盯著浮標。出現「！」的瞬間 <kbd>點左鍵</kbd> 收竿，只有 0.8 秒！<span class="tutorial-sub">不想等了可以按 <kbd>右鍵</kbd> 收回浮標</span>',
  },
  {
    id: 'reel',
    title: '收線',
    body: '<kbd>按住左鍵</kbd> 收線、放開放線。讓游標留在綠色安全區，直到右邊的進度滿格。',
  },
  {
    id: 'book',
    title: '翻開圖鑑',
    body: '釣到了！按 <kbd>Tab</kbd> 打開圖鑑，看看你的第一尾魚。',
  },
];

export class Tutorial {
  /**
   * @param {Object} options
   * @param {import('../game/fishingSystem.js').FishingSystem} options.fishing
   * @param {import('./hud.js').HUD} options.hud
   * @param {import('three').Camera} options.camera
   * @param {{ position: import('three').Vector3 }} options.player
   * @param {() => void} [options.onStepComplete] 完成一步時呼叫（播放提示音）
   */
  constructor({ fishing, hud, camera, player, onStepComplete }) {
    this.fishing = fishing;
    this.hud = hud;
    this.camera = camera;
    this.player = player;
    this.onStepComplete = onStepComplete || null;

    this.active = false;
    this.index = 0;
    this.flash = 0; // > 0 表示正在顯示「完成」打勾
    this.doneTimer = 0;
    this.finished = false;

    this.initDOM();
  }

  initDOM() {
    const card = document.createElement('div');
    card.id = 'tutorial-card';
    card.innerHTML = `
      <div class="tutorial-head">
        <span class="tutorial-chip">新手教學</span>
        <span class="tutorial-dots"></span>
        <span class="tutorial-skip"><kbd>Q</kbd> 跳過</span>
      </div>
      <div class="tutorial-title"><span class="tutorial-check">✓</span><span class="tutorial-title-text"></span></div>
      <div class="tutorial-body"></div>
      <div class="tutorial-note"></div>
    `;
    // 放在圖鑑與暫停畫面之前，讓那些全畫面遮罩蓋在教學卡上方
    const root = this.hud.root;
    root.insertBefore(card, root.querySelector('#collection-modal'));

    this.dom = {
      card,
      dots: card.querySelector('.tutorial-dots'),
      title: card.querySelector('.tutorial-title-text'),
      body: card.querySelector('.tutorial-body'),
      note: card.querySelector('.tutorial-note'),
      skip: card.querySelector('.tutorial-skip'),
    };
    this.dom.dots.innerHTML = STEPS.map(() => '<i></i>').join('');

    // 暫停畫面上的「重看教學」
    const replay = document.createElement('button');
    replay.id = 'tutorial-replay';
    replay.type = 'button';
    replay.textContent = '重看新手教學';
    replay.addEventListener('click', () => this.start());
    const pauseBox = root.querySelector('.pause-box');
    if (pauseBox) pauseBox.appendChild(replay);
  }

  /** 開始（或重新開始）教學 */
  start() {
    this.active = true;
    this.finished = false;
    this.flash = 0;
    this.doneTimer = 0;
    this.lastDirection = this.camera.getWorldDirection(new THREE.Vector3());
    this.direction = new THREE.Vector3();
    this.turned = 0;
    this.lastX = this.player.position.x;
    this.lastZ = this.player.position.z;
    this.walked = 0;
    this.dom.card.classList.remove('done');
    this.dom.card.classList.add('show');
    this.dom.skip.style.display = '';
    this.goTo(0);
  }

  /** 玩家按 Q 跳過 */
  skip() {
    if (!this.active || this.finished) return false;
    this.active = false;
    this.dom.card.classList.remove('show');
    this.hud.showHint('已跳過教學。按 Esc 暫停後可以「重看新手教學」', 6);
    return true;
  }

  goTo(index, note = '') {
    this.index = index;
    const step = STEPS[index];
    this.dom.title.textContent = step.title;
    this.dom.body.innerHTML = step.body;
    this.dom.note.textContent = note;
    this.dom.note.classList.toggle('show', !!note);
    this.dom.card.classList.remove('complete');
    [...this.dom.dots.children].forEach((dot, i) => {
      dot.className = i < index ? 'past' : i === index ? 'current' : '';
    });
    // 換步驟時讓卡片輕輕彈一下，吸引目光
    this.dom.card.classList.remove('bump');
    void this.dom.card.offsetWidth;
    this.dom.card.classList.add('bump');
  }

  completeStep() {
    this.flash = FLASH_TIME;
    this.dom.card.classList.add('complete');
    this.dom.note.classList.remove('show');
    if (this.onStepComplete) this.onStepComplete();
  }

  finish() {
    this.finished = true;
    this.doneTimer = DONE_TIME;
    this.dom.card.classList.remove('complete');
    this.dom.card.classList.add('done');
    this.dom.title.textContent = '教學完成';
    this.dom.body.innerHTML = '碼頭兩側是<b>淺灘</b>，盡頭前方是<b>深水</b>，住著不同的魚。蓄力時準心下方會顯示瞄準的水域。祝你釣魚愉快！';
    this.dom.note.classList.remove('show');
    this.dom.skip.style.display = 'none';
    [...this.dom.dots.children].forEach((dot) => (dot.className = 'past'));
  }

  /** 目前這一步是否已經做到 */
  isStepDone() {
    const state = this.fishing.state;
    switch (STEPS[this.index].id) {
      case 'look':
        return this.turned > 0.9;
      case 'move':
        return this.walked > 2.2;
      case 'cast':
        return IN_WATER.has(state);
      case 'hook':
        return HOOKED.has(state);
      case 'reel':
        return state === S.CAUGHT;
      case 'book':
        return this.hud.isCollectionOpen;
      default:
        return false;
    }
  }

  /** 魚跑了或浮標收回時，退回「拋竿」並說明原因 */
  checkSetback() {
    const state = this.fishing.state;
    const id = STEPS[this.index].id;
    if (id === 'cast') {
      if (state === S.ESCAPED && this.fishing.pendingIsLand) {
        this.dom.note.textContent = '拋到陸地上了。把準心對著水面再試一次。';
        this.dom.note.classList.add('show');
      }
      return;
    }
    if ((id !== 'hook' && id !== 'reel') || !BACK_ON_SHORE.has(state)) return;
    let note = '';
    if (state === S.ESCAPED) note = id === 'hook' ? '慢了一點！看到「！」要立刻點左鍵。再拋一次吧。' : '魚跑掉了，沒關係，再拋一次。';
    this.goTo(2, note);
  }

  /**
   * @param {number} dt
   * @param {boolean} playing 遊戲是否正在進行（未暫停、圖鑑未開啟）
   */
  update(dt, playing) {
    if (!this.active) return;

    if (this.finished) {
      // 結語停留幾秒後淡出（圖鑑開著時先不倒數）
      if (!this.hud.isCollectionOpen) this.doneTimer -= dt;
      if (this.doneTimer <= 0) {
        this.active = false;
        this.dom.card.classList.remove('show');
      }
      return;
    }

    if (playing) {
      // 累計視角轉動量與行走距離
      this.camera.getWorldDirection(this.direction);
      this.turned += this.direction.angleTo(this.lastDirection);
      this.lastDirection.copy(this.direction);

      const p = this.player.position;
      this.walked += Math.hypot(p.x - this.lastX, p.z - this.lastZ);
      this.lastX = p.x;
      this.lastZ = p.z;
    }

    if (this.flash > 0) {
      this.flash -= dt;
      if (this.flash <= 0) {
        if (this.index === STEPS.length - 1) this.finish();
        else this.goTo(this.index + 1);
      }
      return;
    }

    if (this.isStepDone()) this.completeStep();
    else this.checkSetback();
  }
}
