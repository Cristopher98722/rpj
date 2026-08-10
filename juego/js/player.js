class Player {
  constructor() {
    this.hero = Game.selectedHero || HEROES[0];
    this.animator = Assets.getSpriteSet(this.hero.id).animator();
    this.reset();
  }

  reset() {
    this.x = Config.WORLD.w / 2;
    this.y = Config.WORLD.h / 2;
    this.radius = 22;
    this.baseMaxHp = this.hero.stats.maxHp;
    this.baseMaxMana = Config.PLAYER.maxMana;
    this.baseSpeed = this.hero.stats.speed;
    this.baseManaRegen = this.hero.stats.manaRegen;
    this.baseHpRegen = Config.PLAYER.hpRegen;
    this.statsMods = {
      dmgMul: 0,
      attackMul: 0,
      hpFlat: 0,
      speedMul: 0,
      manaFlat: 0,
      manaRegenFlat: 0,
      hpRegenFlat: 0,
      cdReduction: 0,
      crit: 0,
      lifesteal: 0
    };
    this.gold = 0;
    this.owned = {};
    this.ult = 0;
    this.ultMax = 100;
    this.ultActive = 0;
    this.blades = [];
    this.maxHp = this.baseMaxHp;
    this.hp = this.maxHp;
    this.maxMana = this.baseMaxMana;
    this.mana = this.maxMana;
    this.manaRegen = this.baseManaRegen;
    this.speed = this.baseSpeed;
    this.level = 1;
    this.xp = 0;
    this.xpNext = this.nextXp(1);
    this.angle = 0;
    this.facing = 1;
    this.attack = this.hero.attack;
    this.attackTimer = 0;
    this.attackDuration = this.attack.type === 'melee' ? 0.28 : 0.2;
    this.casting = 0;
    this.hurtTimer = 0;
    this.invuln = 0;
    this.dead = false;
    this.deathTimer = 0;
    this.dashT = 0;
    this.dashDir = { x: 1, y: 0 };
    this.dashed = new Set();
    this.lungeX = 0;
    this.lungeY = 0;
    this.kills = 0;
    this.cds = { q: 0, e: 0, r: 0 };
    this.hitFlash = 0;
    this.animator.current = null;
    this.animator.time = 0;
    this.refresh();
  }

  refresh() {
    const prevHp = this.hp;
    const prevMana = this.mana;
    this.maxHp = this.baseMaxHp + this.statsMods.hpFlat;
    this.maxMana = this.baseMaxMana + this.statsMods.manaFlat;
    this.manaRegen = (this.baseManaRegen + this.statsMods.manaRegenFlat) * Config.PLAYER.manaRegenMult;
    this.hpRegen = this.baseHpRegen + this.statsMods.hpRegenFlat;
    this.speed = this.baseSpeed * (1 + this.statsMods.speedMul);
    if (this.maxHp > 0) this.hp = Math.min(prevHp, this.maxHp);
    else this.hp = 0;
    this.mana = Math.min(prevMana, this.maxMana);
  }

  dmg(x) {
    return x * (1 + this.statsMods.dmgMul);
  }

  basicDamage() {
    let d = this.attack.damage * (1 + this.statsMods.dmgMul) * (1 + this.statsMods.attackMul);
    if (this.statsMods.crit > 0 && Utils.rand(0, 1) < this.statsMods.crit) {
      d *= 2;
      this.critFlash = 0.3;
      Effects.addFloater(this.x, this.y - 46, '¡CRÍTICO!', '#ffd54f');
    }
    return d;
  }

  lifesteal(amount) {
    if (this.statsMods.lifesteal > 0 && amount > 0) {
      const heal = amount * this.statsMods.lifesteal;
      this.hp = Math.min(this.hp + heal, this.maxHp);
      Effects.addFloater(this.x, this.y - 60, '+' + Math.round(heal), '#a5d6a7');
    }
  }

  gainUlt(amount) {
    if (amount <= 0 || this.ultActive > 0) return;
    const wasFull = this.ult >= this.ultMax;
    this.ult = Math.min(this.ultMax, this.ult + amount);
    if (!wasFull && this.ult >= this.ultMax) {
      Effects.addFloater(this.x, this.y - 72, '¡PODER OCULTO LISTO!', this.hero.ult.color);
      Sfx.levelup();
    }
  }

  useUltimate() {
    if (this.ult < this.ultMax || this.ultActive > 0) return false;
    this.ult = 0;
    const u = this.hero.ult;
    this.ultActive = u.duration;
    this.casting = 0.4;
    this.animator.play('cast');
    Effects.shake(8);
    Effects.addRing(this.x, this.y, 130, u.color);
    Effects.addFlash(this.x, this.y, u.color);
    Sfx.ult();
    const fn = this['ult_' + this.hero.id];
    if (fn) fn.call(this);
    return true;
  }

  ult_gato() {
    const u = this.hero.ult;
    Effects.addRing(this.x, this.y, 150, u.color);
    Effects.burst(this.x, this.y, u.color, 26, 300);
  }

  ult_simsop() {
    const u = this.hero.ult;
    const targets = Game.enemies.filter((e) => !e.dead && e.spawning <= 0).slice(0, u.count);
    const count = Math.max(targets.length, 6);
    const sp = 520;
    for (let i = 0; i < count; i++) {
      const t = targets[i];
      const a = t ? Math.atan2(t.y - this.y, t.x - this.x) : (i / count) * Math.PI * 2;
      Game.projectiles.push({
        x: this.x + Math.cos(a) * 20,
        y: this.y + Math.sin(a) * 20,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        radius: 12,
        damage: this.dmg(u.damage),
        knockback: 200,
        color: u.color,
        glow: '#b3e5fc',
        life: 1.6,
        from: 'player'
      });
    }
    Effects.shake(6);
    Sfx.shoot();
  }

  ult_isaac() {
    const u = this.hero.ult;
    this.blades = [];
    for (let i = 0; i < u.blades; i++) {
      this.blades.push({ angle: (i / u.blades) * Math.PI * 2, speed: 7, dist: 70 });
    }
    Effects.addRing(this.x, this.y, 90, u.color);
    Effects.burst(this.x, this.y, u.color, 18, 220);
  }

  updateBlades(dt) {
    if (!this.blades.length) return;
    const u = this.hero.ult;
    for (const b of this.blades) b.angle += b.speed * dt;
    for (const e of Game.enemies) {
      if (e.dead) continue;
      e.bladeCd = Math.max(0, (e.bladeCd || 0) - dt);
    }
    const dmg = this.dmg(u.damage);
    for (const b of this.blades) {
      const bx = this.x + Math.cos(b.angle) * b.dist;
      const by = this.y + Math.sin(b.angle) * b.dist;
      if (Math.random() < 0.4) Effects.trail(bx, by, u.color);
      for (const e of Game.enemies) {
        if (e.dead || e.spawning > 0 || (e.bladeCd || 0) > 0) continue;
        if (Utils.dist(bx, by, e.x, e.y) < e.radius + 18) {
          e.takeDamage(dmg, this.x, this.y, 220);
          e.bladeCd = 0.35;
        }
      }
    }
  }

  nextXp(level) {
    return 50 + (level - 1) * 45;
  }

  get moving() {
    return Input.isDown('d') || Input.isDown('a') || Input.isDown('s') || Input.isDown('w') ||
      (Input.touch.move !== null && Input.stickVector(Input.touch.move, 8).mag > 0);
  }

  get aimWorld() {
    return Game.screenToWorld(Input.mouse.x, Input.mouse.y);
  }

  update(dt) {
    this.attackTimer -= dt;
    this.casting -= dt;
    this.hurtTimer -= dt;
    this.invuln -= dt;
    this.hitFlash -= dt;
    for (const k in this.cds) this.cds[k] -= dt * (1 + this.statsMods.cdReduction);
    this.lungeX *= Math.exp(-10 * dt);
    this.lungeY *= Math.exp(-10 * dt);

    this.animator.update(dt);

    if (this.dead) {
      this.deathTimer += dt;
      if (this.deathTimer > 1.3 && Game.state === 'playing') Game.state = 'gameover';
      return;
    }

    this.hp = Math.min(this.hp + this.hpRegen * dt, this.maxHp);
    this.mana = Math.min(this.mana + this.manaRegen * dt, this.maxMana);
    this.ult = Math.min(this.ultMax, this.ult + dt * 3);

    if (this.ultActive > 0) {
      this.ultActive -= dt;
      if (this.ultActive <= 0) {
        this.ultActive = 0;
        this.blades = [];
      }
    }
    this.updateBlades(dt);

    const aw = this.aimWorld;
    let aimAngle = null;
    if (Input.touch.device && Input.touch.aim) {
      const sv = Input.stickVector(Input.touch.aim, 6);
      if (sv.mag > 0) aimAngle = Math.atan2(sv.y, sv.x);
    }
    if (aimAngle === null) {
      this.angle = Math.atan2(aw.y - this.y, aw.x - this.x);
    } else {
      this.angle = aimAngle;
    }
    this.facing = Math.cos(this.angle) >= 0 ? 1 : -1;

    if (this.dashT > 0) {
      this.dashT -= dt;
      this.x += this.dashDir.x * Config.ABILITIES.dash.speed * dt;
      this.y += this.dashDir.y * Config.ABILITIES.dash.speed * dt;
      this.damageThroughDash();
      if (Math.random() < 0.6) Effects.trail(this.x, this.y, Config.ABILITIES.dash.color);
    } else {
      let dx = 0;
      let dy = 0;
      if (Input.isDown('d')) dx += 1;
      if (Input.isDown('a')) dx -= 1;
      if (Input.isDown('s')) dy += 1;
      if (Input.isDown('w')) dy -= 1;
      if (Input.touch.move) {
        const sv = Input.stickVector(Input.touch.move, 8);
        dx += sv.x;
        dy += sv.y;
      }
      const len = Math.hypot(dx, dy);
      if (len > 0) {
        dx /= len;
        dy /= len;
        this.x += dx * this.speed * dt + this.lungeX * dt;
        this.y += dy * this.speed * dt + this.lungeY * dt;
      } else {
        this.x += this.lungeX * dt;
        this.y += this.lungeY * dt;
      }
      this.collideWorld();

      if (Input.aiming && this.attackTimer <= 0 && this.casting <= 0) this.doAttack();
      if (Input.wasPressed('q')) this.tryAbility('q');
      if (Input.wasPressed('e')) this.tryAbility('e');
      if (Input.wasPressed('r')) this.tryAbility('r');
      if (Input.wasPressed('f') && this.ultActive <= 0) this.useUltimate();
      if (Input.wasPressed('l')) {
        Sfx.play('risa');
        Game.notifyLaugh();
      }
      if (Input.wasPressed('f11')) Input.toggleFullscreen();
    }

    this.pickAnimation();
  }

  collideWorld() {
    this.x = Utils.clamp(this.x, this.radius, Config.WORLD.w - this.radius);
    this.y = Utils.clamp(this.y, this.radius, Config.WORLD.h - this.radius);
    for (const o of Game.obstacles) {
      const res = Utils.resolveCircleRect(this.x, this.y, this.radius, o);
      if (res) {
        this.x = res.x;
        this.y = res.y;
      }
    }
  }

  doAttack() {
    const frenzy = this.ultActive > 0 && this.hero.id === 'gato';
    this.attackTimer = this.attack.cooldown * (frenzy ? 0.4 : 1);
    this.animator.play('attack');
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    const dmg = this.basicDamage() * (frenzy ? this.hero.ult.mult : 1);

    if (this.attack.type === 'ranged') {
      Sfx.shoot();
      Effects.burst(this.x + cos * 24, this.y + sin * 24, this.attack.color, 4, 100);
      Game.projectiles.push({
        x: this.x + cos * 24,
        y: this.y + sin * 24,
        vx: cos * this.attack.projSpeed,
        vy: sin * this.attack.projSpeed,
        radius: this.attack.radius || 9,
        damage: dmg,
        knockback: 60,
        color: this.attack.color,
        glow: this.attack.color,
        life: 0.9,
        from: 'player'
      });
      Game.notifyAttack({ k: 'r', a: this.angle, dmg, speed: this.attack.projSpeed, radius: this.attack.radius || 9, color: this.attack.color });
      return;
    }

    Sfx.hit();
    const range = frenzy ? this.attack.range * 1.4 : this.attack.range;
    this.lungeX = cos * (this.attack.lunge || 220);
    this.lungeY = sin * (this.attack.lunge || 220);
    Effects.addSlash(
      this.x + cos * range * 0.55,
      this.y + sin * range * 0.55,
      this.angle, frenzy ? this.hero.ult.color : this.attack.color, range, frenzy ? Math.PI * 2 : this.attack.halfArc
    );
    if (frenzy) Effects.addSlash(this.x, this.y, this.angle + Math.PI, this.hero.ult.color, range, Math.PI / 2);
    Effects.shake(frenzy ? 6 : 3);

    Game.notifyAttack({ k: 'm', a: this.angle, dmg, range, arc: frenzy ? Math.PI * 2 : this.attack.halfArc, kb: this.attack.knockback, color: frenzy ? this.hero.ult.color : this.attack.color, full: frenzy });

    for (const e of Game.enemies) {
      if (e.dead || e.spawning > 0) continue;
      const d = Utils.dist(this.x, this.y, e.x, e.y);
      if (d > range + e.radius) continue;
      const ang = Utils.angleTo(this.x, this.y, e.x, e.y);
      let diff = ang - this.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) <= (frenzy ? Math.PI * 2 : this.attack.halfArc)) {
        e.takeDamage(dmg, this.x, this.y, this.attack.knockback);
        this.lifesteal(dmg);
      }
    }

    for (const c of Game.chests) {
      if (c.broken) continue;
      const d = Utils.dist(this.x, this.y, c.x, c.y);
      if (d > range + c.radius) continue;
      const ang = Utils.angleTo(this.x, this.y, c.x, c.y);
      let diff = ang - this.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) <= (frenzy ? Math.PI * 2 : this.attack.halfArc)) {
        c.takeDamage(dmg, this.x, this.y);
      }
    }
  }

  tryAbility(slot) {
    const id = this.hero.skills[slot];
    const ab = Config.ABILITIES[id];
    if (this.cds[slot] > 0 || this.mana < ab.mana) return;
    this.cds[slot] = ab.cooldown;
    this.mana -= ab.mana;
    this.casting = 0.32;
    this.animator.play('cast');
    this['cast_' + id]();
    Game.notifySkill(id);
  }

  cast_fireball() {
    const ab = Config.ABILITIES.fireball;
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    Sfx.shoot();
    Game.projectiles.push({
      x: this.x + cos * 30,
      y: this.y + sin * 30,
      vx: cos * ab.speed,
      vy: sin * ab.speed,
      radius: ab.radius,
      damage: this.dmg(ab.damage),
      knockback: ab.knockback,
      color: ab.color,
      glow: ab.glow,
      life: ab.range / ab.speed,
      from: 'player'
    });
    Effects.burst(this.x + cos * 30, this.y + sin * 30, ab.glow, 6, 120);
  }

  cast_frost() {
    const ab = Config.ABILITIES.frost;
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    Sfx.shoot();
    Game.projectiles.push({
      x: this.x + cos * 30,
      y: this.y + sin * 30,
      vx: cos * ab.speed,
      vy: sin * ab.speed,
      radius: ab.radius,
      damage: this.dmg(ab.damage),
      knockback: ab.knockback,
      color: ab.color,
      glow: ab.glow,
      life: ab.range / ab.speed,
      from: 'player',
      slow: ab.slow,
      slowTime: ab.slowTime
    });
    Effects.burst(this.x + cos * 30, this.y + sin * 30, ab.glow, 6, 100);
  }

  cast_lightning() {
    const ab = Config.ABILITIES.lightning;
    const targets = Game.enemies
      .filter((e) => !e.dead && e.spawning <= 0 && Utils.dist(this.x, this.y, e.x, e.y) < ab.range)
      .sort((a, b) => Utils.dist(this.x, this.y, a.x, a.y) - Utils.dist(this.x, this.y, b.x, b.y))
      .slice(0, ab.targets);
    let fromX = this.x;
    let fromY = this.y;
    for (const t of targets) {
      t.takeDamage(this.dmg(ab.damage), fromX, fromY, 120);
      Effects.addBolt(fromX, fromY, t.x, t.y, ab.color);
      Effects.burst(t.x, t.y, ab.glow, 6, 120);
      fromX = t.x;
      fromY = t.y;
    }
    if (targets.length) {
      Effects.addRing(this.x, this.y, 60, ab.color);
      Effects.shake(3);
      Sfx.zap();
    }
  }

  cast_meteor() {
    const ab = Config.ABILITIES.meteor;
    const aim = this.aimWorld;
    let mx = this.x + Math.cos(this.angle) * 250;
    let my = this.y + Math.sin(this.angle) * 250;
    mx = Utils.clamp(mx, 40, Config.WORLD.w - 40);
    my = Utils.clamp(my, 40, Config.WORLD.h - 40);
    Game.meteors.push({
      x: mx, y: my,
      life: ab.delay, maxLife: ab.delay,
      radius: ab.radius, damage: this.dmg(ab.damage), knockback: ab.knockback,
      color: ab.glow
    });
    Effects.addRing(mx, my, ab.radius, ab.glow);
    Sfx.zap();
  }

  cast_dash() {
    const ab = Config.ABILITIES.dash;
    this.dashT = ab.duration;
    this.dashDir = { x: Math.cos(this.angle), y: Math.sin(this.angle) };
    this.dashed = new Set();
    Sfx.dash();
    Effects.shake(4);
  }

  cast_nova() {
    const ab = Config.ABILITIES.nova;
    Sfx.nova();
    Effects.shake(12);
    Effects.addRing(this.x, this.y, ab.radius, ab.color);
    Effects.addRing(this.x, this.y, ab.radius * 0.6, ab.glow);
    Effects.burst(this.x, this.y, ab.color, 24, 260);

    for (const e of Game.enemies) {
      if (e.dead) continue;
      const d = Utils.dist(this.x, this.y, e.x, e.y);
      if (d < ab.radius + e.radius) {
        const fall = 1 - (d / ab.radius);
        e.takeDamage(this.dmg(ab.damage) * (0.5 + fall * 0.5), this.x, this.y, ab.knockback);
      }
    }
  }

  cast_blades() {
    const ab = Config.ABILITIES.blades;
    Sfx.hit();
    Effects.shake(5);
    const n = 6;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + this.angle * 0.25;
      Effects.addSlash(
        this.x + Math.cos(a) * ab.range * 0.55,
        this.y + Math.sin(a) * ab.range * 0.55,
        a, ab.color, ab.range, Math.PI / 6
      );
    }
    Effects.burst(this.x, this.y, ab.glow, 16, 200);
    for (const e of Game.enemies) {
      if (e.dead) continue;
      const d = Utils.dist(this.x, this.y, e.x, e.y);
      if (d < ab.range + e.radius) {
        e.takeDamage(this.dmg(ab.damage), this.x, this.y, ab.knockback);
      }
    }
  }

  cast_heal() {
    const ab = Config.ABILITIES.heal;
    this.hp = Math.min(this.hp + ab.heal, this.maxHp);
    Effects.addFloater(this.x, this.y - 50, '+' + ab.heal, '#a5d6a7');
    Effects.addRing(this.x, this.y, 90, ab.color);
    Effects.burst(this.x, this.y, ab.glow, 14, 160);
    Sfx.heal();
  }

  damageThroughDash() {
    const ab = Config.ABILITIES.dash;
    for (const e of Game.enemies) {
      if (e.dead || this.dashed.has(e)) continue;
      const d = Utils.dist(this.x, this.y, e.x, e.y);
      if (d < e.radius + this.radius + 8) {
        this.dashed.add(e);
        e.takeDamage(this.dmg(ab.damage), this.x, this.y, ab.knockback);
      }
    }
  }

  takeDamage(amount, fromX, fromY, knockback) {
    if (this.invuln > 0 || this.dashT > 0 || this.dead) return;
    this.hp -= amount;
    this.invuln = Config.PLAYER.invulnTime;
    this.hurtTimer = 0.3;
    this.hitFlash = 0.2;
    const a = Math.atan2(this.y - fromY, this.x - fromX);
    this.lungeX += Math.cos(a) * knockback;
    this.lungeY += Math.sin(a) * knockback;
    Effects.burst(this.x, this.y, '#ff5252', 8, 170);
    Effects.addFloater(this.x, this.y - 40, String(Math.round(amount)), '#ff8a80');
    Sfx.hurt();
    Effects.shake(5);
    Effects.addFlash(this.x, this.y, '#ff5252');
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.deathTimer = 0;
      this.animator.play('death');
      Sfx.death();
      Effects.burst(this.x, this.y, this.hero.color, 30, 300);
      Effects.shake(14);
    } else {
      this.animator.play('hurt');
    }
  }

  gainXp(amount) {
    this.xp += amount;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = this.nextXp(this.level);
      this.hp = this.maxHp;
      this.mana = this.maxMana;
      Effects.addFloater(this.x, this.y - 60, 'NIVEL ' + this.level + '!', '#ffd54f');
      Effects.addRing(this.x, this.y, 90, '#ffd54f');
      Effects.burst(this.x, this.y, '#ffd54f', 20, 220);
      Sfx.levelup();
      Game.levelFlash = 1;
    }
  }

  pickAnimation() {
    if (this.dashT > 0) {
      this.animator.play('cast');
      return;
    }
    if (this.attackTimer > this.attack.cooldown - this.attackDuration) {
      this.animator.play('attack');
      return;
    }
    if (this.casting > 0) {
      this.animator.play('cast');
      return;
    }
    if (this.hurtTimer > 0) {
      this.animator.play('hurt');
      return;
    }
    if (this.moving) this.animator.play('walk');
    else this.animator.play('idle');
  }

  draw(ctx) {
    const u = this.hero.ult;
    if (this.ultActive > 0 && u) {
      const pulse = 0.5 + 0.5 * Math.sin((Game.timeAlive || 0) * 12);
      ctx.save();
      const g = ctx.createRadialGradient(this.x, this.y, 8, this.x, this.y, 100);
      g.addColorStop(0, u.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.28 + pulse * 0.2;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 100, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (this.hitFlash > 0 && Math.floor(this.hitFlash * 30) % 2 === 0) ctx.globalAlpha = 0.4;
    if (this.dashT > 0) ctx.globalAlpha = 0.6;
    this.animator.facing = this.facing;
    this.animator.draw(ctx, this.x, this.y, this.facing);
    ctx.globalAlpha = 1;

    if (this.blades.length && u) {
      for (const b of this.blades) {
        const bx = this.x + Math.cos(b.angle) * b.dist;
        const by = this.y + Math.sin(b.angle) * b.dist;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(b.angle + Math.PI / 2);
        ctx.fillStyle = u.color;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(5, 10);
        ctx.lineTo(-5, 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
  }
}
