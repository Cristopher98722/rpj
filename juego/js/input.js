const Input = {
  keys: {},
  pressed: {},
  mouse: { x: 0, y: 0, down: false, clicked: false },
  virtual: {},
  touch: { device: false, move: null, aim: null },
  inited: false,

  init(canvas) {
    if (this.inited) return;
    this.inited = true;
    this.touch.device = this.detectTouch();

    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      if (!this.keys[k]) this.pressed[k] = true;
      this.keys[k] = true;
      Sfx.init();
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    window.addEventListener('blur', () => {
      this.keys = {};
      this.touch.move = null;
      this.touch.aim = null;
    });

    canvas.addEventListener('mousemove', (e) => this.updateMouse(canvas, e));
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.updateMouse(canvas, e);
        this.mouse.down = true;
        this.mouse.clicked = true;
      }
      Sfx.init();
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('touchstart', (e) => this.onTouchStart(canvas, e), { passive: false });
    canvas.addEventListener('touchmove', (e) => this.onTouchMove(canvas, e), { passive: false });
    canvas.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });
    canvas.addEventListener('touchcancel', (e) => this.onTouchEnd(e), { passive: false });
  },

  detectTouch() {
    try {
      if ('ontouchstart' in window) return true;
      if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) return true;
    } catch (err) {}
    return false;
  },

  updateMouse(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) * (canvas.width / rect.width)) / Game.renderScale;
    this.mouse.y = ((e.clientY - rect.top) * (canvas.height / rect.height)) / Game.renderScale;
  },

  toCanvas(canvas, x, y) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((x - rect.left) * (canvas.width / rect.width)) / Game.renderScale,
      y: ((y - rect.top) * (canvas.height / rect.height)) / Game.renderScale
    };
  },

  abilityRects() {
    const W = Config.CANVAS.w;
    const H = Config.CANVAS.h;
    const size = 56;
    const gap = 92;
    const x = W - 70;
    const y0 = H - 330;
    const rects = [];
    ['q', 'e', 'r'].forEach((s, i) => {
      rects.push({ id: s, cx: x, cy: y0 + i * gap + size / 2, radius: 40, size });
    });
    return rects;
  },

  moveAnchor() {
    return { x: 160, y: Config.CANVAS.h - 120 };
  },

  aimAnchor() {
    return { x: Config.CANVAS.w - 160, y: Config.CANVAS.h - 120 };
  },

  menuButtonRect() {
    return { x: Config.CANVAS.w - 74, y: 14, w: 60, h: 56 };
  },

  fullscreenButtonRect() {
    return { x: 14, y: 14, w: 60, h: 56 };
  },

  toggleFullscreen() {
    const d = document;
    const de = d.documentElement || d.body;
    if (!de) return;
    try {
      if (!d.fullscreenElement && !d.webkitFullscreenElement && !d.mozFullScreenElement) {
        const r = de.requestFullscreen || de.webkitRequestFullscreen || de.mozRequestFullScreen || de.msRequestFullscreen;
        if (r) r.call(de);
      } else {
        const x = d.exitFullscreen || d.webkitExitFullscreen || d.mozCancelFullScreen || d.msExitFullscreen;
        if (x) x.call(d);
      }
    } catch (e) {}
  },

  ultButtonRect() {
    return { cx: Config.CANVAS.w / 2, cy: Config.CANVAS.h - 100, r: 54 };
  },

  laughButtonRect() {
    return { cx: Config.CANVAS.w / 2 - 130, cy: Config.CANVAS.h - 100, r: 44 };
  },

  hitAbility(cx, cy) {
    for (const r of this.abilityRects()) {
      if (Math.hypot(cx - r.cx, cy - r.cy) <= r.radius) return r.id;
    }
    return null;
  },

  inRect(cx, cy, r) {
    return cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h;
  },

  onTouchStart(canvas, e) {
    e.preventDefault();
    Sfx.init();
    for (const t of e.changedTouches) {
      const p = this.toCanvas(canvas, t.clientX, t.clientY);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.mouse.clicked = true;

      const fs = this.fullscreenButtonRect();
      if (this.inRect(p.x, p.y, fs)) {
        this.toggleFullscreen();
        continue;
      }

      if (Game.state === 'playing') {
        const m = this.menuButtonRect();
        if (this.inRect(p.x, p.y, m)) {
          this.virtual['escape'] = true;
          continue;
        }
        const ub = this.ultButtonRect();
        if (Math.hypot(p.x - ub.cx, p.y - ub.cy) <= ub.r) {
          this.virtual['f'] = true;
          continue;
        }
        const lb = this.laughButtonRect();
        if (Math.hypot(p.x - lb.cx, p.y - lb.cy) <= lb.r) {
          this.virtual['l'] = true;
          continue;
        }
        if (this.touch.move === null && p.x < Config.CANVAS.w * 0.5) {
          const a = this.moveAnchor();
          this.touch.move = { id: t.identifier, ox: a.x, oy: a.y, x: a.x, y: a.y };
          continue;
        }
        const ab = this.hitAbility(p.x, p.y);
        if (ab) {
          this.virtual[ab] = true;
          continue;
        }
        if (this.touch.aim === null) {
          const a = this.aimAnchor();
          this.touch.aim = { id: t.identifier, ox: a.x, oy: a.y, x: a.x, y: a.y };
        }
      }
    }
  },

  onTouchMove(canvas, e) {
    e.preventDefault();
    const r = 46;
    for (const t of e.changedTouches) {
      const p = this.toCanvas(canvas, t.clientX, t.clientY);
      const clampTo = (stick) => {
        const dx = p.x - stick.ox;
        const dy = p.y - stick.oy;
        const d = Math.hypot(dx, dy);
        if (d > r) {
          stick.x = stick.ox + (dx / d) * r;
          stick.y = stick.oy + (dy / d) * r;
        } else {
          stick.x = p.x;
          stick.y = p.y;
        }
      };
      if (this.touch.move && this.touch.move.id === t.identifier) clampTo(this.touch.move);
      if (this.touch.aim && this.touch.aim.id === t.identifier) clampTo(this.touch.aim);
    }
  },

  onTouchEnd(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (this.touch.move && this.touch.move.id === t.identifier) this.touch.move = null;
      if (this.touch.aim && this.touch.aim.id === t.identifier) this.touch.aim = null;
    }
  },

  update() {
    this.pressed = {};
    this.virtual = {};
    this.mouse.clicked = false;
  },

  isDown(k) {
    return !!this.keys[k];
  },

  wasPressed(k) {
    return !!this.pressed[k] || !!this.virtual[k];
  },

  get aiming() {
    return this.mouse.down || (this.touch.device && this.touch.aim !== null);
  },

  stickVector(stick, deadzone) {
    if (!stick) return { x: 0, y: 0, mag: 0 };
    const dx = stick.x - stick.ox;
    const dy = stick.y - stick.oy;
    const dist = Math.hypot(dx, dy);
    if (dist < deadzone) return { x: 0, y: 0, mag: 0 };
    const mag = Math.min(1, dist / 46);
    return { x: (dx / dist) * mag, y: (dy / dist) * mag, mag };
  }
};
