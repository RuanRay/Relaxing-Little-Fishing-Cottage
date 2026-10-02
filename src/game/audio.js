// 以 Web Audio 即時合成的音效，不需任何音檔。
// AudioContext 必須在使用者手勢後才能啟動，因此由第一次點擊時呼叫 start()。

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.reelTimer = 0;
    this.warningTimer = 0;
    this.isMuted = false;
    this.volume = 0.5;
  }

  start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    this.ctx = new AudioContextClass();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.isMuted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);

    // 共用的白噪音緩衝
    const length = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

    this.startAmbience();
  }

  setPaused(paused) {
    if (!this.ctx) return;
    if (paused) this.ctx.suspend();
    else this.ctx.resume();
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (this.master) {
      this.master.gain.value = this.isMuted ? 0 : this.volume;
    }
  }

  toggleMute() {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  /** 環境音：緩慢起伏的海浪聲 */
  startAmbience() {
    const { ctx } = this;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const depth = ctx.createGain();
    depth.gain.value = 0.035;
    lfo.connect(depth).connect(gain.gain);
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
    lfo.start();
  }

  tone(frequency, duration, { type = 'sine', volume = 0.2, delay = 0, slideTo = null } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  burst(duration, { type = 'bandpass', from = 1000, to = 1000, q = 1, volume = 0.3 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(to, t + duration);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + duration * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(t, Math.random());
    source.stop(t + duration + 0.02);
  }

  /** 拋竿：一道由低到高的破風聲 */
  cast() {
    this.burst(0.32, { from: 500, to: 3200, q: 2.5, volume: 0.28 });
  }

  /** 水花：size 越大越響 */
  splash(size = 0.5) {
    this.burst(0.3 + size * 0.3, { type: 'lowpass', from: 2600, to: 380, q: 0.7, volume: 0.16 + size * 0.3 });
    this.tone(190, 0.14, { volume: 0.1, slideTo: 80 });
  }

  /** 咬鉤提示：兩聲清脆的提示音 */
  bite() {
    this.tone(1320, 0.1, { type: 'triangle', volume: 0.28 });
    this.tone(1760, 0.16, { type: 'triangle', volume: 0.28, delay: 0.09 });
  }

  /** 收線時的齒輪喀噠聲，張力越高越急 */
  reel(dt, active, tension) {
    if (!active) return;
    this.reelTimer -= dt;
    if (this.reelTimer > 0) return;
    this.reelTimer = 0.11 - (tension / 100) * 0.05;
    this.tone(520 + tension * 4, 0.03, { type: 'square', volume: 0.05 });
  }

  caught() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.26, { type: 'triangle', volume: 0.22, delay: i * 0.09 }));
  }

  escaped() {
    this.tone(330, 0.36, { type: 'sine', volume: 0.2, slideTo: 150 });
  }

  /** 拋到陸地上的沉悶彈跳聲 */
  land() {
    this.tone(140, 0.18, { type: 'sine', volume: 0.22, slideTo: 60 });
    this.burst(0.15, { type: 'lowpass', from: 800, to: 150, q: 1.2, volume: 0.2 });
  }

  /** 張力過高或過低時的緊急警報嗶聲 */
  warning(dt) {
    this.warningTimer -= dt;
    if (this.warningTimer > 0) return;
    this.warningTimer = 0.18;
    this.tone(880, 0.08, { type: 'square', volume: 0.12 });
  }

  /** UI 按鍵或點擊回饋音 */
  ui(freq = 640) {
    this.tone(freq, 0.06, { type: 'sine', volume: 0.15 });
  }
}
