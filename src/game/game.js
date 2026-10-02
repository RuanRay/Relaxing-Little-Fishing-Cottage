import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { dockToWorld } from '../world/dock.js';
import { HUD } from '../ui/hud.js';
import { Tutorial } from '../ui/tutorial.js';
import { FishingSystem, FISHING_STATE } from './fishingSystem.js';
import { CollectionSystem } from './collectionSystem.js';
import { CameraDirector, CAMERA_MODE } from './cameraDirector.js';
import { Player } from './player.js';
import { Rod } from './rod.js';
import { Bobber } from './bobber.js';
import { GameAudio } from './audio.js';
import { WATER_ZONES } from './fishData.js';

const ZONE_LABEL = { [WATER_ZONES.SHALLOW]: '淺灘', [WATER_ZONES.DEEP]: '深水' };
// 這些狀態下玩家可以走動；浮標在水裡時則站定不動
const MOVABLE = new Set([FISHING_STATE.IDLE, FISHING_STATE.CHARGING, FISHING_STATE.CAUGHT, FISHING_STATE.ESCAPED]);

/**
 * 遊戲主程式：把場景、鏡頭、玩家、釣竿、浮標、狀態機與 HUD 串在一起。
 * 各模組只讀取 FishingSystem 的 state 決定自己的表現，彼此不直接呼叫。
 */
export class Game {
  constructor({ scene, camera, renderer, orbit, colliders, view, applyView }) {
    this.camera = camera;
    scene.add(camera); // 釣竿掛在鏡頭底下，鏡頭必須在場景樹裡

    this.collection = new CollectionSystem();
    this.fishing = new FishingSystem({ collectionSystem: this.collection });
    this.hud = new HUD({ fishingSystem: this.fishing, collectionSystem: this.collection });
    this.audio = new GameAudio();

    this.director = new CameraDirector({ camera, orbit, view, applyView });
    this.player = new Player(camera, colliders);
    this.rod = new Rod(camera, this.fishing);
    this.bobber = new Bobber({ scene, camera, rod: this.rod, fishing: this.fishing, player: this.player });

    // 起點：碼頭靠岸的一端，面向海
    const start = dockToWorld(0.4, 0);
    this.player.place(start.x, start.z);
    this.startLookAt = dockToWorld(4, 0).setY(this.player.position.y + 0.55);

    this.look = new PointerLockControls(camera, renderer.domElement);
    this.look.enabled = false;
    this.look.pointerSpeed = 0.9;
    this.look.minPolarAngle = 0.3;
    this.look.maxPolarAngle = Math.PI - 0.25;

    this.tutorial = new Tutorial({
      fishing: this.fishing,
      hud: this.hud,
      camera,
      player: this.player,
      onStepComplete: () => this.audio.ui(880),
    });

    this.debug = new URLSearchParams(window.location.search).has('debug');

    this.bindInput(renderer.domElement.ownerDocument);
    this.bindSystems();
  }

  get mode() {
    return this.director.mode;
  }

  /** 第一人稱中，且沒有被暫停或圖鑑遮住 */
  get playing() {
    return this.mode === CAMERA_MODE.FIRST_PERSON && this.look.isLocked && !this.hud.isCollectionOpen;
  }

  bindSystems() {
    const { fishing, audio, hud } = this;

    this.director.onArrive = () => {
      hud.activateFirstPerson();
      this.rod.setVisible(true);
      this.bobber.setVisible(true);
      this.look.enabled = true;
      // 過場期間若滑鼠鎖定失敗，就停在暫停畫面等玩家再點一次
      if (!this.look.isLocked) this.pause();
      this.tutorial.start();
    };

    this.look.addEventListener('lock', () => {
      hud.togglePause(false);
      audio.setPaused(false);
    });
    this.look.addEventListener('unlock', () => {
      if (this.mode === CAMERA_MODE.FIRST_PERSON) this.pause();
    });

    hud.onCollectionToggle = (open) => {
      this.look.enabled = !open && this.mode === CAMERA_MODE.FIRST_PERSON;
      if (open) this.interruptInput();
      audio.ui(open ? 760 : 520);
    };

    fishing.on('onStateChange', (state) => {
      if (state === FISHING_STATE.CASTING) audio.cast();
      else if (state === FISHING_STATE.BITING) audio.bite();
      else if (state === FISHING_STATE.CAUGHT) audio.caught();
      else if (state === FISHING_STATE.ESCAPED) {
        if (fishing.pendingIsLand) audio.land();
        else audio.escaped();
      }
    });
    this.bobber.onSplash = (size) => audio.splash(size);
  }

  bindInput(doc) {
    doc.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.onPrimaryDown();
      else if (e.button === 2 && this.playing) this.fishing.handleRightClick();
    });
    doc.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.onPrimaryUp();
    });
    doc.addEventListener('contextmenu', (e) => e.preventDefault());
    doc.addEventListener('keydown', (e) => {
      if (this.mode !== CAMERA_MODE.FIRST_PERSON) return;
      if (this.player.setKey(e.code, true)) e.preventDefault();
      else if (e.code === 'KeyQ' && this.playing) this.tutorial.skip();
    });
    doc.addEventListener('keyup', (e) => this.player.setKey(e.code, false));
    window.addEventListener('blur', () => this.player.releaseKeys());
  }

  onPrimaryDown() {
    if (this.mode === CAMERA_MODE.ORBIT) {
      // 開場：點擊後飛向碼頭起點並鎖定滑鼠
      this.audio.start();
      this.director.begin(this.player.eyePosition(), this.startLookAt);
      this.look.lock();
      return;
    }
    if (this.mode !== CAMERA_MODE.FIRST_PERSON) return;
    if (!this.look.isLocked) {
      // 暫停中：點擊恢復
      this.look.lock();
      return;
    }
    if (this.hud.isCollectionOpen) {
      this.hud.toggleCollection(false);
      return;
    }
    if (this.fishing.state === FISHING_STATE.CAUGHT) {
      this.fishing.dismissFishCard();
      return;
    }
    this.fishing.handlePointerDown();
  }

  onPrimaryUp() {
    const { fishing } = this;
    if (fishing.state === FISHING_STATE.CHARGING) {
      // 放開的瞬間依視角與蓄力決定落點，交給狀態機判定陸地或水域
      const info = this.bobber.aim(fishing.chargeRatio);
      this.bobber.lockTarget(info);
      fishing.handlePointerUp(info);
    } else {
      fishing.handlePointerUp();
    }
  }

  /** 暫停或開啟圖鑑時，中止正在進行的按鍵與蓄力 */
  interruptInput() {
    this.player.releaseKeys();
    if (this.fishing.state === FISHING_STATE.CHARGING) this.fishing.setState(FISHING_STATE.IDLE);
    this.fishing.isReelingInput = false;
  }

  pause() {
    this.interruptInput();
    this.hud.togglePause(true);
    this.audio.setPaused(true);
  }

  update(dt, time) {
    const { fishing, hud } = this;
    this.director.update(dt);

    if (this.mode === CAMERA_MODE.FIRST_PERSON) {
      const active = this.playing;
      const step = active ? dt : 0;
      if (active) {
        this.player.canMove = MOVABLE.has(fishing.state);
        this.player.update(dt);
        fishing.update(dt);
        this.audio.reel(dt, fishing.state === FISHING_STATE.REELING && fishing.isReelingInput, fishing.tension);
        if (fishing.state === FISHING_STATE.REELING && (fishing.tension >= 88 || fishing.tension <= 12)) {
          this.audio.warning(dt);
        }
      }
      this.rod.update(step, active ? this.player.speed : 0);
      this.bobber.update(step, time);
      this.tutorial.update(dt, active);

      if (fishing.state === FISHING_STATE.CHARGING && this.bobber.lastAim) {
        const aim = this.bobber.lastAim;
        if (aim.isLand) hud.setZoneLabel('陸地', 'land');
        else hud.setZoneLabel(ZONE_LABEL[aim.zone], aim.zone);
      }
    }

    hud.update(dt);
    if (this.debug) {
      const p = this.player.position;
      hud.setDebugState(`mode  ${this.mode}\nstate ${fishing.state}\npos   ${p.x.toFixed(1)}, ${p.y.toFixed(2)}, ${p.z.toFixed(1)}`);
    }
  }
}
