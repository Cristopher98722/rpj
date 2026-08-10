const Assets = {
  cache: {},
  spriteSets: {},

  loadImage(src) {
    return new Promise((resolve) => {
      if (this.cache[src]) return resolve(this.cache[src]);
      const img = new Image();
      img.onload = () => {
        this.cache[src] = img;
        resolve(img);
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  },

  getSpriteSet(name) {
    if (this.spriteSets[name]) return this.spriteSets[name];
    const set = new SpriteSet(name, Characters[name]);
    this.spriteSets[name] = set;
    set.loading = set.load();
    return set;
  },

  async loadAll() {
    const names = Object.keys(Characters);
    await Promise.all([
      ...names.map((n) => this.getSpriteSet(n).loading),
      Assets.loadImage('assets/img/yerald.jpeg')
    ]);
  }
};

class SpriteSet {
  constructor(name, def) {
    this.name = name;
    this.def = def;
    this.size = def.size;
    this.color = def.color;
    this.animations = {};
  }

  async load() {
    for (const [aname, adef] of Object.entries(this.def.animations)) {
      this.animations[aname] = {
        frames: await this.loadAnimation(aname, adef),
        fps: adef.fps || 8,
        loop: adef.loop !== false
      };
    }
  }

  async loadAnimation(aname, adef) {
    const sheetSrc = `${this.def.folder}/${adef.file}.png`;
    const sheet = await Assets.loadImage(sheetSrc);
    if (sheet) {
      const n = adef.frames || 1;
      const fw = sheet.width / n;
      const fh = sheet.height;
      if (fw >= 2) {
        const frames = [];
        for (let i = 0; i < n; i++) {
          const c = document.createElement('canvas');
          c.width = fw;
          c.height = fh;
          c.getContext('2d').drawImage(sheet, i * fw, 0, fw, fh, 0, 0, fw, fh);
          frames.push(c);
        }
        return frames;
      }
    }

    const n = adef.frames || 1;
    const frames = [];
    let anyLoaded = false;
    for (let i = 0; i < n; i++) {
      const img = await Assets.loadImage(`${this.def.folder}/${aname}_${i}.png`);
      if (img) anyLoaded = true;
      frames.push(img);
    }
    if (anyLoaded) {
      const fallback = frames.find(Boolean);
      return frames.map((f) => f || fallback);
    }

    const placeholders = [];
    for (let i = 0; i < n; i++) placeholders.push(makePlaceholderFrame(aname, i, n, this.color, this.size));
    return placeholders;
  }

  animator() {
    return new SpriteAnimator(this);
  }
}

class SpriteAnimator {
  constructor(set) {
    this.set = set;
    this.current = null;
    this.time = 0;
    this.facing = 1;
  }

  play(name) {
    if (this.current !== name) {
      this.current = name;
      this.time = 0;
    }
  }

  update(dt) {
    const a = this.set.animations[this.current];
    if (!a) return;
    this.time += dt;
    const dur = a.frames.length / a.fps;
    if (a.loop && this.time >= dur) this.time %= dur;
  }

  get frameIndex() {
    const a = this.set.animations[this.current];
    if (!a) return 0;
    return Math.min(a.frames.length - 1, Math.floor(this.time * a.fps));
  }

  get done() {
    const a = this.set.animations[this.current];
    if (!a || a.loop) return true;
    return this.time >= a.frames.length / a.fps;
  }

  draw(ctx, x, y, facing) {
    const a = this.set.animations[this.current];
    if (!a) return;
    const img = a.frames[this.frameIndex] || a.frames[0];
    if (!img) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);
    const scale = this.set.size / Math.max(img.width, img.height);
    ctx.drawImage(img, (-img.width * scale) / 2, (-img.height * scale) / 2, img.width * scale, img.height * scale);
    ctx.restore();
  }
}

function makePlaceholderFrame(type, i, n, color, size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.translate(size / 2, size / 2);
  const p = n > 1 ? i / (n - 1) : 0;
  const bob = Math.sin(p * Math.PI * 2);
  const bw = size * 0.5;
  const bh = size * 0.6;
  let scaleY = 1;
  let rot = 0;
  let weapon = null;

  switch (type) {
    case 'idle':
      scaleY = 1 + bob * 0.02;
      break;
    case 'walk':
      scaleY = 1 + bob * 0.06;
      rot = bob * 0.05;
      break;
    case 'attack':
      weapon = { angle: -1.5 + (p - 0.5) * 2 * 1.5, len: size * 0.5, glow: false };
      break;
    case 'cast':
      weapon = { angle: -Math.PI / 2 + bob * 0.3, len: size * 0.4, glow: true };
      break;
    case 'hurt':
      rot = 0.15 * (p * 2 - 1);
      break;
    case 'death':
      rot = p * Math.PI * 1.4;
      scaleY = 1 - p * 0.6;
      break;
  }

  ctx.rotate(rot);
  ctx.scale(1, scaleY);

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, size * 0.32, size * 0.28, size * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();

  if (type === 'walk') {
    ctx.fillStyle = Utils.shade(color, -30);
    const l1 = Math.sin(p * Math.PI * 2) * size * 0.12;
    const l2 = -l1;
    ctx.fillRect(-size * 0.14 + l1 * 0.2, size * 0.05, size * 0.12, size * 0.2);
    ctx.fillRect(size * 0.02 + l2 * 0.2, size * 0.05, size * 0.12, size * 0.2);
  }

  Utils.roundRect(ctx, -bw / 2, -bh / 2, bw, bh, size * 0.1);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = Utils.shade(color, -45);
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, size * 0.05, bw * 0.3, bh * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  const eyeY = -bh * 0.15;
  const ex = size * 0.07;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(ex, eyeY, size * 0.05, 0, Math.PI * 2);
  ctx.arc(-ex, eyeY, size * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(ex + size * 0.015, eyeY, size * 0.024, 0, Math.PI * 2);
  ctx.arc(-ex + size * 0.015, eyeY, size * 0.024, 0, Math.PI * 2);
  ctx.fill();

  if (type === 'hurt') {
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ex - size * 0.05, eyeY - size * 0.04);
    ctx.lineTo(ex + size * 0.05, eyeY + size * 0.01);
    ctx.moveTo(-ex + size * 0.05, eyeY - size * 0.04);
    ctx.lineTo(-ex - size * 0.05, eyeY + size * 0.01);
    ctx.stroke();
  }

  if (type === 'death') {
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    for (const sx of [ex, -ex]) {
      ctx.beginPath();
      ctx.moveTo(sx - size * 0.03, eyeY - size * 0.03);
      ctx.lineTo(sx + size * 0.03, eyeY + size * 0.03);
      ctx.moveTo(sx + size * 0.03, eyeY - size * 0.03);
      ctx.lineTo(sx - size * 0.03, eyeY + size * 0.03);
      ctx.stroke();
    }
  }

  if (weapon) {
    ctx.save();
    ctx.rotate(weapon.angle);
    ctx.fillStyle = weapon.glow ? '#fff' : '#e0e0e0';
    ctx.fillRect(size * 0.18, -size * 0.02, weapon.len, size * 0.045);
    ctx.fillStyle = weapon.glow ? '#ffd54f' : '#b0bec5';
    ctx.beginPath();
    ctx.moveTo(size * 0.18 + weapon.len, -size * 0.045);
    ctx.lineTo(size * 0.18 + weapon.len + size * 0.07, size * 0.02);
    ctx.lineTo(size * 0.18 + weapon.len, size * 0.09);
    ctx.fill();
    if (weapon.glow) {
      const g = ctx.createRadialGradient(size * 0.18, 0, 2, size * 0.18, 0, size * 0.2);
      g.addColorStop(0, 'rgba(255,213,79,0.6)');
      g.addColorStop(1, 'rgba(255,213,79,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(size * 0.18, 0, size * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  return c;
}
