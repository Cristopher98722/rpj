class Enemy {
  constructor(type, x, y, netId) {
    this.type = type;
    this.def = Config.ENEMIES[type];
    this.x = x;
    this.y = y;
    this.netId = netId || 0;
    this.tx = x;
    this.ty = y;
    this.noAI = false;
    this.radius = this.def.radius;
    this.hp = this.def.hp;
    this.maxHp = this.def.hp;
    if (this.isBoss() && Game.multi && Net.players > 1) {
      const mult = 1 + 0.5 * (Net.players - 1);
      this.hp = Math.round(this.hp * mult);
      this.maxHp = Math.round(this.maxHp * mult);
    }
    this.speed = this.def.speed;
    this.attackTimer = 0;
    this.shootTimer = 0;
    this.hurtTimer = 0;
    this.hitFlash = 0;
    this.kx = 0;
    this.ky = 0;
    this.spawning = 0.5;
    this.dead = false;
    this.deathT = 0;
    this.casiPlayed = false;
    this.facing = 1;
    this.slow = 0;
    this.slowFactor = 0.45;
    this.volleyT = 2.5;
    this.specialT = 2 + Utils.rand(0, 1);
    this.teleportT = 3;
    this.dashT = 0;
    this.dashDir = { x: 1, y: 0, angle: 0 };
    this.dashHit = false;
    this.dashCount = 0;
    this.charmCount = 0;
    this.animator = Assets.getSpriteSet(type).animator();
    this.animator.play('idle');
  }

  isBoss() {
    return this.type === 'jefe' || this.type === 'isaacn' || this.type === 'charlief' || this.type === 'charlieg';
  }

  update(dt, game, target) {
    this.attackTimer -= dt;
    this.shootTimer -= dt;
    this.hurtTimer -= dt;
    this.hitFlash -= dt;
    this.slow -= dt;
    this.kx *= Math.exp(-6 * dt);
    this.ky *= Math.exp(-6 * dt);
    this.animator.update(dt);

    if (this.spawning > 0) {
      this.spawning -= dt;
      if (this.spawning <= 0) this.animator.play('idle');
      return;
    }

    if (this.dead) {
      this.deathT += dt;
      return;
    }

    if (this.noAI) {
      const k = Math.min(1, dt * 12);
      this.x += (this.tx - this.x) * k;
      this.y += (this.ty - this.y) * k;
      this.pickAnimation(0, 0);
      return;
    }

    const t = target || (game && game.player);
    if (!t) return;
    this.facing = t.x >= this.x ? 1 : -1;
    const d = Utils.dist(this.x, this.y, t.x, t.y);
    const ang = Math.atan2(t.y - this.y, t.x - this.x);
    let mx = 0;
    let my = 0;

    if (this.dashT > 0) {
      this.dashT -= dt;
      this.x += this.dashDir.x * this.speed * 4.2 * dt;
      this.y += this.dashDir.y * this.speed * 4.2 * dt;
      if (this.dashHit && Utils.dist(this.x, this.y, t.x, t.y) < 74) {
        this.dashHit = false;
        game.applyEnemyHit(t, this.def.damage * 0.7, this.x, this.y, 280);
        Effects.addSlash(this.x, this.y, this.dashDir.angle, this.def.color, 95, Math.PI / 2);
        Effects.burst(this.x, this.y, this.def.color, 12, 240);
        Sfx.hit();
      }
    } else {
      if (this.type === 'ranged') {
        if (d > this.def.attackRange * 0.9) {
          mx = Math.cos(ang);
          my = Math.sin(ang);
        } else if (d < this.def.attackRange * 0.55) {
          mx = -Math.cos(ang);
          my = -Math.sin(ang);
        } else {
          mx = 0;
          my = 0;
        }
        if (d <= this.def.attackRange && this.shootTimer <= 0) {
          this.shootTimer = this.def.attackCd;
          this.shoot(game, t);
        }
      } else {
        if (d > this.def.attackRange) {
          mx = Math.cos(ang);
          my = Math.sin(ang);
        } else if (this.attackTimer <= 0) {
          this.meleeAttack(game, t);
        }
      }

      this.x += (mx * this.speed * (this.slow > 0 ? this.slowFactor : 1) + this.kx) * dt;
      this.y += (my * this.speed * (this.slow > 0 ? this.slowFactor : 1) + this.ky) * dt;
    }

    this.x = Utils.clamp(this.x, this.radius, Config.WORLD.w - this.radius);
    this.y = Utils.clamp(this.y, this.radius, Config.WORLD.h - this.radius);
    for (const o of Game.obstacles) {
      const res = Utils.resolveCircleRect(this.x, this.y, this.radius, o);
      if (res) {
        this.x = res.x;
        this.y = res.y;
      }
    }

    if (this.isBoss()) {
      this.specialT -= dt;
      if (this.type === 'jefe') {
        this.volleyT -= dt;
        if (this.volleyT <= 0 && d < 620) {
          this.volleyT = 3.2;
          this.volley(game);
        }
      }
      if (this.type === 'charlieg') {
        this.teleportT -= dt;
        if (this.teleportT <= 0) {
          this.teleportT = 5;
          this.teleport(t);
        }
      }
      if (this.specialT <= 0) {
        if (this.type === 'charlief' && d < 280) {
          this.specialT = 3.6;
          this.slam(game);
        } else if (this.type === 'isaacn' && d < 440) {
          this.specialT = 3.0;
          this.ninjaDash(game, t);
        } else if (this.type === 'charlieg') {
          this.specialT = 3.8;
          this.charm(game);
        } else if (this.type === 'jefe') {
          this.specialT = 4.5;
          this.slam(game);
        }
      }
    }

    this.pickAnimation(mx, my);
  }

  areaDamage(game, x, y, radius, dmg, kb) {
    for (const t of game.aliveTargets()) {
      if (Utils.dist(x, y, t.x, t.y) < radius + (t.radius || 20)) {
        game.applyEnemyHit(t, dmg, x, y, kb);
      }
    }
  }

  ninjaDash(game, target) {
    const ang = Math.atan2(target.y - this.y, target.x - this.x);
    this.dashT = 0.32;
    this.dashHit = true;
    this.dashCount++;
    this.dashDir = { x: Math.cos(ang), y: Math.sin(ang), angle: ang };
    Effects.addRing(this.x, this.y, 30, this.def.color);
    Effects.burst(this.x, this.y, this.def.color, 10, 240);
    Sfx.dash();
  }

  slam(game) {
    const def = this.def;
    const radius = 195;
    this.animator.play('cast');
    Effects.shake(this.type === 'jefe' ? 16 : 10);
    Effects.addRing(this.x, this.y, radius, def.color);
    Effects.addRing(this.x, this.y, radius * 0.6, '#ffd54f');
    Effects.burst(this.x, this.y, def.color, 24, 320);
    Sfx.nova();
    this.areaDamage(game, this.x, this.y, radius, def.damage * 1.2, 540);
  }

  charm(game) {
    const def = this.def;
    this.animator.play('cast');
    this.charmCount++;
    Sfx.shoot();
    Effects.burst(this.x, this.y, '#81c784', 14, 220);
    for (let k = 0; k < 6; k++) {
      const a = Utils.rand(0, Math.PI * 2);
      Game.projectiles.push({
        x: this.x,
        y: this.y,
        vx: Math.cos(a) * 140,
        vy: Math.sin(a) * 140,
        radius: 8,
        damage: def.damage * 0.8,
        knockback: 130,
        color: '#81c784',
        glow: '#c8e6c9',
        life: 4,
        from: 'enemy',
        homing: true
      });
    }
  }

  teleport(target) {
    const a = Utils.rand(0, Math.PI * 2);
    const dist = Utils.rand(160, 330);
    this.x = Utils.clamp(target.x + Math.cos(a) * dist, this.radius, Config.WORLD.w - this.radius);
    this.y = Utils.clamp(target.y + Math.sin(a) * dist, this.radius, Config.WORLD.h - this.radius);
    Effects.burst(this.x, this.y, this.def.color, 14, 240);
    Effects.addRing(this.x, this.y, 40, this.def.color);
    Sfx.zap();
  }

  volley(game) {
    const def = this.def;
    this.animator.play('cast');
    Sfx.nova();
    const n = 10;
    const offset = Utils.rand(0, Math.PI * 2);
    for (let k = 0; k < n; k++) {
      const a = offset + (k / n) * Math.PI * 2;
      Game.projectiles.push({
        x: this.x + Math.cos(a) * 30,
        y: this.y + Math.sin(a) * 30,
        vx: Math.cos(a) * def.projSpeed,
        vy: Math.sin(a) * def.projSpeed,
        radius: 9,
        damage: def.damage * 0.8,
        knockback: 160,
        color: '#ff8a65',
        glow: '#ff7043',
        life: 3,
        from: 'enemy'
      });
    }
    Effects.addRing(this.x, this.y, 120, '#ff7043');
    Effects.shake(6);
  }

  shoot(game, target) {
    const ang = Math.atan2(target.y - this.y, target.x - this.x);
    const speed = this.def.projSpeed;
    Game.projectiles.push({
      x: this.x + Math.cos(ang) * 24,
      y: this.y + Math.sin(ang) * 24,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      radius: 8,
      damage: this.def.damage,
      knockback: 140,
      color: '#ff8a65',
      glow: '#ff5252',
      life: 3,
      from: 'enemy'
    });
    this.animator.play('cast');
    Sfx.shoot();
    Effects.burst(this.x + Math.cos(ang) * 24, this.y + Math.sin(ang) * 24, '#ff8a65', 5, 90);
  }

  meleeAttack(game, target) {
    this.attackTimer = this.def.attackCd;
    this.animator.play('attack');
    const ang = Math.atan2(target.y - this.y, target.x - this.x);
    Effects.addSlash(
      this.x + Math.cos(ang) * this.def.attackRange * 0.6,
      this.y + Math.sin(ang) * this.def.attackRange * 0.6,
      ang, this.def.color, this.def.attackRange, Math.PI / 3
    );
    Sfx.hit();
    game.applyEnemyHit(target, this.def.damage, this.x, this.y, 220);
  }

  pickAnimation(mx, my) {
    if (this.attackTimer > this.def.attackCd - 0.4) {
      this.animator.play('attack');
      return;
    }
    if (this.hurtTimer > 0) {
      this.animator.play('hurt');
      return;
    }
    if (mx !== 0 || my !== 0) this.animator.play('walk');
    else this.animator.play('idle');
  }

  takeDamage(amount, fromX, fromY, knockback) {
    if (this.dead || this.spawning > 0) return;
    if (Game.multi && Net && Net.connected && Net.idx !== 1 && this.netId) {
      const ra = Math.atan2(this.y - fromY, this.x - fromX);
      Net.send({ t: 'dmg', id: this.netId, dmg: amount, kx: Math.cos(ra) * knockback, ky: Math.sin(ra) * knockback });
    }
    this.hp -= amount;
    this.hurtTimer = 0.25;
    this.hitFlash = 0.12;
    const a = Math.atan2(this.y - fromY, this.x - fromX);
    this.kx += Math.cos(a) * knockback;
    this.ky += Math.sin(a) * knockback;
    Effects.addFloater(this.x, this.y - this.radius - 12, String(Math.round(amount)), '#fff');
    Effects.burst(this.x, this.y, this.def.color, 6, 150);
    Sfx.hit();
    if (this.type === 'jefe' && this.hp > 0 && !this.casiPlayed && this.hp <= this.maxHp * 0.25) {
      this.casiPlayed = true;
      Sfx.play('casi');
    }
    if (Game.player && !Game.player.dead) Game.player.gainUlt(amount * 0.12);
    if (this.hp <= 0) {
      this.dead = true;
      this.deathT = 0;
      this.animator.play('death');
      Effects.burst(this.x, this.y, this.def.color, 20, 240);
      Effects.addDecal(this.x, this.y, this.def.color);
      Effects.shake(this.type === 'jefe' ? 12 : 4);
      if (this.type === 'jefe') Sfx.play('jefe');
      if (this.def.gold) {
        Game.player.gold += this.def.gold;
        Effects.addFloater(this.x, this.y - this.radius - 30, '+' + this.def.gold + ' oro', '#ffd54f');
        Effects.burst(this.x, this.y, '#ffd54f', 8, 160);
      }
      Game.player.gainXp(this.def.xp);
      Game.player.kills++;
      Game.player.gainUlt(8);
      if (Game.notifyKill) Game.notifyKill();
    } else {
      this.animator.play('hurt');
    }
  }

  draw(ctx) {
    if (this.spawning > 0) {
      ctx.globalAlpha = 0.3 + 0.7 * (1 - this.spawning / 0.5);
    }
    if (this.hitFlash > 0 && Math.floor(this.hitFlash * 30) % 2 === 0) ctx.globalAlpha = 0.45;
    if (this.slow > 0) {
      ctx.fillStyle = 'rgba(79,195,247,0.22)';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 4, 0, Math.PI * 2);
      ctx.fill();
    }
    this.animator.facing = this.facing;
    this.animator.draw(ctx, this.x, this.y, this.facing);
    ctx.globalAlpha = 1;

    if (!this.dead && this.hp < this.maxHp) {
      const w = this.radius * 2.2;
      const h = 5;
      const y = this.y - this.radius - 14;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(this.x - w / 2 - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = '#e53935';
      ctx.fillRect(this.x - w / 2, y, w * Utils.clamp(this.hp / this.maxHp, 0, 1), h);
    }
  }
}
