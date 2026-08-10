const Sfx = {
  ctx: null,

  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        try {
          this.ctx = new AC();
        } catch (err) {
          return;
        }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended' && this.ctx.resume) {
      try {
        this.ctx.resume();
      } catch (err) {}
    }
  },

  beep(freq, dur, type, vol, slide) {
    if (!this.ctx) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), this.ctx.currentTime + dur);
      g.gain.setValueAtTime(vol, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start();
      o.stop(this.ctx.currentTime + dur);
    } catch (err) {}
  },

  hit() { this.beep(220, 0.08, 'square', 0.1, -90); },
  hurt() { this.beep(130, 0.2, 'sawtooth', 0.14, -70); },
  shoot() { this.beep(520, 0.14, 'triangle', 0.1, -240); },
  nova() { this.beep(90, 0.5, 'sawtooth', 0.13, 90); },
  zap() { this.beep(880, 0.12, 'sawtooth', 0.1, -400); },
  heal() { this.beep(380, 0.12, 'triangle', 0.11, 60); },
  dash() { this.beep(300, 0.16, 'triangle', 0.1, 320); },
  ult() { this.beep(180, 0.5, 'sawtooth', 0.16, 260); },
  levelup() {
    this.beep(420, 0.11, 'square', 0.12);
    setTimeout(() => this.beep(620, 0.13, 'square', 0.12), 110);
    setTimeout(() => this.beep(900, 0.2, 'square', 0.12), 240);
  },
  death() { this.beep(300, 0.45, 'sawtooth', 0.14, -220); }
};
