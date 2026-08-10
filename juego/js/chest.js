class Chest {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 26;
    this.hp = Config.CHESTS.hp;
    this.maxHp = this.hp;
    this.broken = false;
    this.hitFlash = 0;
    this.shake = 0;
  }

  takeDamage(amount, fromX, fromY) {
    if (this.broken) return;
    this.hp -= amount;
    this.hitFlash = 0.12;
    this.shake = Math.min(10, this.shake + 4);
    Effects.addFloater(this.x, this.y - this.radius - 10, String(Math.round(amount)), '#fff');
    Effects.burst(this.x, this.y, '#8d6e63', 5, 120);
    Sfx.hit();
    if (this.hp <= 0) {
      this.hp = 0;
      this.broken = true;
      Effects.burst(this.x, this.y, '#ffb74d', 18, 240);
      Effects.addDecal(this.x, this.y, '#6d4c41');
      Effects.shake(5);
      if (Math.random() < Config.CHESTS.dropChance) {
        Game.loot.push({ x: this.x, y: this.y, radius: 14, t: 12 });
      }
    }
  }

  update(dt) {
    this.hitFlash -= dt;
    this.shake = Math.max(0, this.shake - dt * 30);
  }

  draw(ctx) {
    ctx.save();
    if (this.broken) {
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#6d4c41';
      ctx.fillRect(this.x - 16, this.y - 9, 32, 20);
      ctx.fillStyle = '#4e342e';
      ctx.fillRect(this.x - 14, this.y - 3, 28, 8);
      ctx.fillStyle = '#3e2723';
      ctx.fillRect(this.x - 4, this.y - 9, 6, 18);
      ctx.restore();
      return;
    }
    if (this.hitFlash > 0 && Math.floor(this.hitFlash * 30) % 2 === 0) ctx.globalAlpha = 0.5;
    const sx = this.shake > 0 ? Utils.rand(-this.shake, this.shake) : 0;
    const sy = this.shake > 0 ? Utils.rand(-this.shake, this.shake) : 0;
    const x = this.x + sx;
    const y = this.y + sy;
    Effects.shadow(ctx, x, y + 16, 28, 0.35);
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(x - 20, y - 9, 40, 24);
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(x - 20, y - 9, 40, 8);
    ctx.fillStyle = '#ffd54f';
    ctx.fillRect(x - 6, y - 7, 12, 19);
    ctx.fillRect(x - 20, y - 5, 40, 4);
    ctx.strokeStyle = '#2b1a10';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 20, y - 9, 40, 24);
    if (this.hp < this.maxHp) {
      const w = 44;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x - w / 2 - 1, y - 22, w + 2, 6);
      ctx.fillStyle = '#ffb74d';
      ctx.fillRect(x - w / 2, y - 21, w * Utils.clamp(this.hp / this.maxHp, 0, 1), 4);
    }
    ctx.restore();
  }
}
