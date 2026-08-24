'use strict';
// ============================================================
// SND — WebAudio 절차적 사운드 효과 + 스텝 시퀀서 음악
// 외부 오디오 파일 없음. 전부 신스로 실시간 합성한다.
// ============================================================
const SND = {
  ctx: null, outS: null, outM: null, noiseBuf: null,
  muted: false, _painT: 0,

  init() {
    if (this.ctx) { this.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const master = this.ctx.createGain(); master.gain.value = 0.85;
    master.connect(this.ctx.destination);
    this.outS = this.ctx.createGain(); this.outS.gain.value = 0.9; this.outS.connect(master);
    this.outM = this.ctx.createGain(); this.outM.gain.value = 0.42; this.outM.connect(master);
    const len = this.ctx.sampleRate * 1.5;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  tone(o) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + (o.delay || 0), d = o.d;
    const osc = this.ctx.createOscillator();
    osc.type = o.w || 'square';
    osc.frequency.setValueAtTime(Math.max(1, o.f0), t);
    if (o.f1 !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + d);
    const g = this.ctx.createGain();
    const v = o.v || 0.3;
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + d);
    osc.connect(g); g.connect(o.m ? this.outM : this.outS);
    osc.start(t); osc.stop(t + d + 0.03);
  },

  noise(o) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + (o.delay || 0), d = o.d;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    src.playbackRate.value = o.rate || 1;
    const f = this.ctx.createBiquadFilter();
    f.type = o.type || 'lowpass'; f.Q.value = o.q || 0.8;
    f.frequency.setValueAtTime(Math.max(20, o.f0 || 8000), t);
    if (o.f1 !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + d);
    const g = this.ctx.createGain();
    const v = o.v || 0.3;
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + d);
    src.connect(f); f.connect(g); g.connect(o.m ? this.outM : this.outS);
    src.start(t); src.stop(t + d + 0.03);
  },

  // ---------- 무기 ----------
  pistol() {
    this.noise({ d: 0.10, v: 0.50, f0: 5200, f1: 800 });
    this.tone({ w: 'square', f0: 1900, f1: 170, d: 0.08, v: 0.22 });
  },
  shotgun() {
    this.noise({ d: 0.34, v: 0.72, f0: 2800, f1: 110 });
    this.tone({ w: 'sine', f0: 150, f1: 38, d: 0.26, v: 0.55 });
    this.noise({ d: 0.06, v: 0.3, f0: 7000, f1: 2500 });
  },
  pump() { this.noise({ d: 0.07, v: 0.22, f0: 2400, f1: 900 }); this.noise({ d: 0.07, v: 0.22, f0: 900, f1: 2400, delay: 0.09 }); },
  chaingun() {
    this.noise({ d: 0.07, v: 0.42, f0: 4200, f1: 900 });
    this.tone({ w: 'square', f0: 1300, f1: 200, d: 0.05, v: 0.16 });
  },
  dryfire() { this.noise({ d: 0.03, v: 0.15, f0: 3000, f1: 1500 }); },

  // ---------- 적 ----------
  fireball() {
    this.tone({ w: 'sawtooth', f0: 880, f1: 130, d: 0.30, v: 0.26 });
    this.noise({ d: 0.25, v: 0.18, f0: 3200, f1: 500, type: 'bandpass' });
  },
  explosion(near) {
    this.noise({ d: 0.72, v: near ? 0.95 : 0.55, f0: 1500, f1: 50 });
    this.tone({ w: 'sine', f0: 100, f1: 26, d: 0.5, v: 0.6 });
    this.noise({ d: 0.9, v: 0.3, f0: 400, f1: 40, delay: 0.08 });
  },
  alert(type) {
    if (type === 'fiend')      { this.tone({ w: 'sawtooth', f0: 130, f1: 48, d: 0.5, v: 0.4 }); this.noise({ d: 0.4, v: 0.25, f0: 900, f1: 250 }); }
    else if (type === 'warlock'){ this.tone({ w: 'triangle', f0: 620, f1: 240, d: 0.6, v: 0.3 }); this.tone({ w: 'triangle', f0: 627, f1: 236, d: 0.6, v: 0.2 }); }
    else if (type === 'brute') { this.tone({ w: 'sawtooth', f0: 90, f1: 40, d: 0.7, v: 0.5 }); this.noise({ d: 0.5, v: 0.3, f0: 500, f1: 120 }); }
    else                       { this.tone({ w: 'sawtooth', f0: 175, f1: 92, d: 0.34, v: 0.34 }); this.noise({ d: 0.25, v: 0.2, f0: 1200, f1: 400 }); }
  },
  mpain(type) {
    const f = type === 'brute' ? 70 : type === 'fiend' ? 100 : 160;
    this.tone({ w: 'sawtooth', f0: f * 2.2, f1: f, d: 0.16, v: 0.3 });
  },
  mdie(type) {
    const f = type === 'brute' ? 60 : type === 'fiend' ? 90 : type === 'warlock' ? 300 : 140;
    this.tone({ w: 'sawtooth', f0: f * 2.4, f1: f * 0.5, d: 0.5, v: 0.36 });
    this.noise({ d: 0.45, v: 0.3, f0: 800, f1: 90, delay: 0.1 });
  },

  // ---------- 플레이어 ----------
  playerPain() {
    const n = this.ctx ? this.ctx.currentTime : 0;
    if (n - this._painT < 0.28) return;
    this._painT = n;
    this.tone({ w: 'sawtooth', f0: 230, f1: 96, d: 0.2, v: 0.4 });
    this.noise({ d: 0.14, v: 0.22, f0: 1500, f1: 400 });
  },
  playerDie() {
    this.tone({ w: 'sawtooth', f0: 280, f1: 42, d: 1.0, v: 0.5 });
    this.noise({ d: 0.8, v: 0.35, f0: 900, f1: 60, delay: 0.15 });
  },

  // ---------- 아이템/세계 ----------
  pickup() { this.tone({ w: 'square', f0: 660, f1: 880, d: 0.06, v: 0.22 }); this.tone({ w: 'square', f0: 990, d: 0.07, v: 0.18, delay: 0.06 }); },
  weaponUp() { [392, 523, 659].forEach((f, i) => this.tone({ w: 'square', f0: f, d: 0.09, v: 0.22, delay: i * 0.07 })); },
  keyGet()  { [523, 659, 784, 1046].forEach((f, i) => this.tone({ w: 'triangle', f0: f, d: 0.11, v: 0.24, delay: i * 0.06 })); },
  secret()  { [660, 784].forEach((f, i) => { this.tone({ w: 'triangle', f0: f, d: 0.5, v: 0.16, delay: i * 0.02 }); this.tone({ w: 'triangle', f0: f * 1.007, d: 0.5, v: 0.12, delay: i * 0.02 }); }); },
  doorOpen()  { this.noise({ d: 0.5, v: 0.26, f0: 180, f1: 640, type: 'bandpass', q: 2 }); },
  doorClose() { this.noise({ d: 0.4, v: 0.24, f0: 640, f1: 160, type: 'bandpass', q: 2 }); this.noise({ d: 0.09, v: 0.4, f0: 500, f1: 90, delay: 0.38 }); },
  switchHit() { this.noise({ d: 0.08, v: 0.4, f0: 2000, f1: 300 }); this.tone({ w: 'square', f0: 220, f1: 110, d: 0.12, v: 0.25, delay: 0.05 }); },
  buzz() { this.tone({ w: 'square', f0: 110, d: 0.12, v: 0.3 }); this.tone({ w: 'square', f0: 104, d: 0.12, v: 0.3, delay: 0.15 }); },
  levelDone() { [659, 784, 988, 1319].forEach((f, i) => this.tone({ w: 'square', f0: f, d: 0.16, v: 0.24, delay: i * 0.13 })); },
  menuMove() { this.tone({ w: 'square', f0: 500, d: 0.04, v: 0.14 }); },
  menuSel() { this.tone({ w: 'square', f0: 700, f1: 1050, d: 0.08, v: 0.2 }); },

  // ---------- 음악 시퀀서 ----------
  _mus: { name: null, step: 0, nextT: 0, timer: null },

  mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); },

  TRACKS: {
    game: {
      bpm: 136, steps: 32,
      bass: [
        40, 0, 40, 40,  0, 40, 43, 0,  40, 0, 40, 40,  0, 38, 36, 0,
        40, 0, 40, 40,  0, 40, 43, 45, 47, 0, 45, 0,  43, 41, 38, 0
      ],
      kick: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,1],
      snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hat:  [0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,1,1]
    },
    title: {
      bpm: 76, steps: 16,
      bass: [28, 0, 0, 0, 31, 0, 0, 0, 33, 0, 0, 0, 30, 0, 26, 0],
      pad:  [52, 0, 0, 0, 55, 0, 0, 0, 57, 0, 0, 0, 54, 0, 50, 0],
      kick: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      snare:[], hat: []
    }
  },

  startMusic(name) {
    this.init();
    if (!this.ctx) return;
    if (this._mus.name === name && this._mus.timer) return;
    this.stopMusic();
    const tr = this.TRACKS[name];
    if (!tr) return;
    this._mus.name = name; this._mus.step = 0;
    this._mus.nextT = this.ctx.currentTime + 0.06;
    this._mus.timer = setInterval(() => this._sched(tr), 40);
  },
  stopMusic() {
    if (this._mus.timer) { clearInterval(this._mus.timer); this._mus.timer = null; }
    this._mus.name = null;
  },
  _sched(tr) {
    if (!this.ctx || this.muted) { /* 음소거 중에도 시간만 흐른다 */ }
    const spb = 60 / tr.bpm / 4;
    while (this._mus.nextT < this.ctx.currentTime + 0.16) {
      if (!this.muted) this._step(tr, this._mus.step, this._mus.nextT, spb);
      this._mus.nextT += spb;
      this._mus.step = (this._mus.step + 1) % tr.steps;
    }
  },
  _step(tr, s, t, spb) {
    const dl = t - this.ctx.currentTime;
    const b = tr.bass[s % tr.bass.length];
    if (b) {
      const f = this.mtof(b);
      this.tone({ w: 'sawtooth', f0: f, f1: f, d: spb * 1.7, v: 0.30, delay: dl, m: true });
      this.tone({ w: 'square',   f0: f / 2, d: spb * 1.5, v: 0.14, delay: dl, m: true });
    }
    if (tr.pad && tr.pad[s]) {
      const f = this.mtof(tr.pad[s]);
      ['triangle'].forEach(w => {
        this.tone({ w, f0: f, d: spb * 14, v: 0.10, delay: dl, m: true });
        this.tone({ w, f0: f * 1.005, d: spb * 14, v: 0.08, delay: dl, m: true });
        this.tone({ w, f0: f * 1.498, d: spb * 14, v: 0.05, delay: dl, m: true });
      });
    }
    if (tr.kick && tr.kick[s]) {
      this.tone({ w: 'sine', f0: 120, f1: 35, d: 0.13, v: 0.62, delay: dl, m: true });
    }
    if (tr.snare && tr.snare[s]) {
      // 노이즈 스네어는 예약 재생 불가 → 지연 없이 근사 처리하지 않고 tone 대체
      this.tone({ w: 'square', f0: 189, f1: 120, d: 0.09, v: 0.22, delay: dl, m: true });
    }
    if (tr.hat && tr.hat[s]) {
      this.tone({ w: 'square', f0: 5200, f1: 4800, d: 0.02, v: 0.05, delay: dl, m: true });
    }
  }
};
