const Effects = {
  particles: [],
  floaters: [],
  rings: [],
  bolts: [],
  decals: [],
  motes: [],
  shakes: 0,
  time: 0,

  initMotes() {
    this.motes = [];
    const n = 70;
    for (let i = 0; i < n; i++) {
      this.motes.push({
        x: Utils.rand(0, Config.WORLD.w),
        y: Utils.rand(0, Config.WORLD.h),
        baseY: 0,
        phase: Utils.rand(0, Math.PI * 2),
        speed: Utils.rand(0.3, 1),
        size: Utils.rand(1.5, 3.5),
        color: Math.random() < 0.5 ? 'rgba(255,213,79,0.5)' : 'rgba(129,212,250,0.5)'
      });
    }
  },

  burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Utils.rand(speed * 0.3, speed);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: Utils.rand(0.2, 0.6),
        maxLife: 0.6,
        size: Utils.rand(2, 5),
        color
      });
    }
  },

  addFloater(x, y, text, color) {
    this.floaters.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
  },

  addSlash(x, y, angle, color, radius, halfArc) {
    this.rings.push({
      x, y, angle,
      radius: radius || 90,
      maxRadius: radius || 90,
      halfArc: halfArc || Math.PI / 3,
      life: 0.18, maxLife: 0.18,
      color, type: 'slash'
    });
  },

  addRing(x, y, radius, color) {
    this.rings.push({
      x, y, angle: 0,
      radius: 0,
      maxRadius: radius,
      life: 0.4, maxLife: 0.4,
      color, type: 'ring'
    });
  },

  addFlash(x, y, color) {
    this.rings.push({
      x, y, angle: 0,
      radius: 6,
      maxRadius: 80,
      life: 0.3, maxLife: 0.3,
      color, type: 'flash'
    });
  },

  shadow(ctx, x, y, r, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,0.42)');
    g.addColorStop(0.7, 'rgba(0,0,0,0.18)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  addBolt(x1, y1, x2, y2, color) {
    this.bolts.push({ x1, y1, x2, y2, color, life: 0.28, maxLife: 0.28, seed: Math.random() * 100 });
  },

  addDecal(x, y, color) {
    this.decals.push({ x, y, color, life: 12, maxLife: 12, size: Utils.rand(8, 20) });
    if (this.decals.length > 70) this.decals.shift();
  },

  trail(x, y, color) {
    this.particles.push({
      x, y, vx: 0, vy: 0,
      life: 0.25, maxLife: 0.25,
      size: Utils.rand(3, 6), color
    });
  },

  shake(amount) {
    this.shakes = Math.max(this.shakes, amount);
  },

  update(dt) {
    this.time += dt;
    this.shakes = Math.max(0, this.shakes - dt * 32);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-4 * dt);
      p.vy *= Math.exp(-4 * dt);
    }

    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      f.y -= 42 * dt;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) this.rings.splice(i, 1);
    }

    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt;
      if (b.life <= 0) this.bolts.splice(i, 1);
    }

    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i];
      d.life -= dt;
      if (d.life <= 0) this.decals.splice(i, 1);
    }
  },

  drawMotes(ctx) {
    for (const m of this.motes) {
      const bob = Math.sin(this.time * m.speed + m.phase) * 6;
      const alpha = 0.5 + 0.5 * Math.sin(this.time * m.speed * 2 + m.phase);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.arc(m.x, m.y + bob, m.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },

  draw(ctx) {
    for (const r of this.rings) {
      const t = 1 - r.life / r.maxLife;
      const alpha = r.life / r.maxLife;
      if (r.type === 'slash') {
        const rad = r.maxRadius * (0.4 + t * 0.6);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 10 * alpha + 3;
        ctx.beginPath();
        ctx.arc(r.x, r.y, rad, r.angle - r.halfArc, r.angle + r.halfArc);
        ctx.stroke();
        ctx.lineWidth = 4 * alpha + 1;
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.7 * alpha).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(r.x, r.y, rad * 0.85, r.angle - r.halfArc, r.angle + r.halfArc);
        ctx.stroke();
        ctx.globalAlpha = alpha * 0.2;
        ctx.fillStyle = r.color;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.arc(r.x, r.y, rad, r.angle - r.halfArc, r.angle + r.halfArc);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (r.type === 'flash') {
        const rad = Math.max(r.maxRadius * t, 1);
        ctx.save();
        ctx.globalAlpha = alpha;
        const g = ctx.createRadialGradient(r.x, r.y, 1, r.x, r.y, rad);
        g.addColorStop(0, 'rgba(255,255,255,' + (0.9 * alpha).toFixed(3) + ')');
        g.addColorStop(0.35, r.color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        const rad = r.maxRadius * t;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 6 * alpha + 2;
        ctx.beginPath();
        ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = alpha * 0.15;
        ctx.fillStyle = r.color;
        ctx.beginPath();
        ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    for (const b of this.bolts) {
      const alpha = b.life / b.maxLife;
      const segs = 8;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      for (let s = 1; s < segs; s++) {
        const t = s / segs;
        const nx = b.x1 + (b.x2 - b.x1) * t + Math.sin(b.seed + t * 12) * 6;
        const ny = b.y1 + (b.y2 - b.y1) * t + Math.cos(b.seed + t * 14) * 6;
        ctx.lineTo(nx, ny);
      }
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
      ctx.lineWidth = 7;
      ctx.globalAlpha = alpha * 0.3;
      ctx.stroke();
      ctx.restore();
    }

    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Utils.clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const d of this.decals) {
      ctx.save();
      ctx.globalAlpha = Utils.clamp(d.life / d.maxLife, 0, 1) * 0.5;
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const f of this.floaters) {
      ctx.save();
      ctx.globalAlpha = Utils.clamp(f.life / f.maxLife, 0, 1);
      ctx.font = 'bold 16px "Segoe UI", Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText(f.text, f.x + 1, f.y + 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
  }
};
