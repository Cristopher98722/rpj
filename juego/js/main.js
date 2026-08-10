const Game = {
  canvas: null,
  ctx: null,
  offscreen: null,
  cam: { x: 0, y: 0 },
  state: 'menu',
  selectedIndex: 0,
  selectedHero: HEROES[0],
  player: null,
  enemies: [],
  projectiles: [],
  meteors: [],
  obstacles: Config.OBSTACLES,
  wave: 0,
  waveBreak: 0,
  waveMsg: '',
  waveMsgT: 0,
  levelFlash: 0,
  timeAlive: 0,
  last: 0,
  renderScale: 1,
  currentQuality: 'alta',
  multi: false,
  peer: null,
  waveKills: 0,
  peerWaveKills: 0,
  waveTotal: 0,
  waveClearedSent: false,
  peerAlive: true,

  boot() {
    this.canvas = document.getElementById('game');
    this.offscreen = document.createElement('canvas');
    this.ctx = this.offscreen.getContext('2d');
    Input.init(this.canvas);
    this.setQuality(Input.touch.device ? 'auto' : 'alta');
    Assets.loadAll().then(() => {
      this.selectedHero = HEROES[0];
      this.player = new Player();
      this.player.animator.play('idle');
      requestAnimationFrame((t) => {
        this.last = t;
        this.frame(t);
      });
    });
  },

  setQuality(name) {
    if (!Config.QUALITY.presets[name]) name = 'auto';
    this.currentQuality = name;
    const q = Config.QUALITY.presets[name];
    this.renderScale = q.scale;
    if (this.canvas) {
      this.canvas.width = Config.CANVAS.w * q.scale;
      this.canvas.height = Config.CANVAS.h * q.scale;
    }
    this.offscreen.width = Config.CANVAS.w * q.scale;
    this.offscreen.height = Config.CANVAS.h * q.scale;
    this.ctx = this.offscreen.getContext('2d');
    this.ctx.setTransform(q.scale, 0, 0, q.scale, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
  },

  cycleQuality() {
    const order = Config.QUALITY.order;
    const i = order.indexOf(this.currentQuality);
    this.setQuality(order[(i + 1) % order.length]);
  },

  start() {
    this.selectedHero = HEROES[this.selectedIndex];
    this.player = new Player();
    this.player.animator.play('idle');
    this.enemies = [];
    this.projectiles = [];
    this.meteors = [];
    this.wave = 0;
    this.waveBreak = 0;
    this.timeAlive = 0;
    this.waveMsgT = 0;
    this.levelFlash = 0;
    this.waveKills = 0;
    this.peerWaveKills = 0;
    this.waveClearedSent = false;
    Effects.initMotes();
    this.spawnWave(1);
    this.state = 'playing';
  },

  startMulti() {
    if (this.multi) return;
    Net.send({ t: 'ready' });
    this.multi = true;
    this.start();
    if (!this.peer) this.peer = new RemotePlayer();
    this.peerAlive = true;
    this.waveKills = 0;
    this.peerWaveKills = 0;
    this.waveClearedSent = false;
  },

  leaveMulti() {
    if (this.multi) {
      Net.leave();
      this.multi = false;
      this.peer = null;
    }
    this.state = 'menu';
  },

  createMulti() {
    Net.begin('create', Net.makeCode());
    this.state = 'lobby';
  },

  joinMulti() {
    let code = '';
    try { code = prompt('Código de sala (4 letras/números):'); } catch (e) {}
    if (!code) return;
    code = String(code).trim().toUpperCase();
    if (!/^[0-9A-Z]{4}$/.test(code)) {
      Net.status = 'Código inválido: usa 4 letras o números';
      this.state = 'lobby';
      return;
    }
    Net.begin('join', code);
    this.state = 'lobby';
  },

  onNetMessage(msg) {
    if (!msg || !msg.t) return;
    switch (msg.t) {
      case 'join':
        if (msg.ok) {
          Net.connected = true;
          Net.room = msg.room;
          Net.idx = msg.idx;
          Net.players = msg.idx;
          Net.status = Net.idx === 1
            ? 'Sala ' + msg.room + ' creada. Esperando jugador...'
            : 'Conectado a la sala ' + msg.room + '.';
        }
        break;
      case 'peerJoin':
        Net.players = 2;
        Net.status = Net.idx === 1
          ? '¡' + msg.name + ' conectado! Esperando jugador...'
          : '¡Sala completa!';
        if (!this.peer || this.peer.heroId !== msg.hero) {
          this.peer = new RemotePlayer(msg.hero, msg.name);
        }
        break;
      case 'full':
        Net.players = 2;
        Net.status = Net.idx === 1
          ? '¡PARTIDA LISTA! Pulsa COMENZAR.'
          : '¡PARTIDA LISTA! Esperando que el anfitrión comience...';
        break;
      case 'error':
        Net.status = msg.msg || 'Error de sala';
        break;
      case 'peerLeave':
        Net.players = Math.max(0, Net.players - 1);
        if (this.state === 'lobby') {
          Net.status = 'El jugador salió de la sala.';
          this.peer = null;
        } else if (this.multi) {
          Net.status = 'Jugador desconectado. Sigues solo.';
          this.peer = null;
          this.peerAlive = false;
        }
        break;
      case 'state':
        if (this.peer) this.peer.apply(msg.s);
        break;
      case 'kill':
        if (!this.multi) break;
        if (this.peerWaveKills < this.waveTotal) this.peerWaveKills++;
        this.peerKillSilent();
        this.checkWaveClear();
        break;
      case 'cleared':
        if (!this.multi || this.state !== 'playing' || this.waveClearedSent) break;
        this.waveClearedSent = true;
        this.waveBreak = 1.2;
        this.waveMsg = '¡OLEADA COMPLETADA!';
        this.waveMsgT = 1.2;
        break;
      case 'next':
        if (!this.multi) break;
        if (this.state === 'shop' && msg.n === this.wave + 1) {
          this.shopNext();
        }
        break;
      case 'atk':
        if (this.multi) this.applyPeerAttack(msg);
        break;
      case 'skill':
        if (this.multi) this.applyPeerSkill(msg);
        break;
      case 'ready':
        if (this.state === 'lobby') this.startMulti();
        break;
    }
  },

  blit() {
    const c = this.canvas.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.imageSmoothingEnabled = true;
    c.drawImage(this.offscreen, 0, 0, this.canvas.width, this.canvas.height);
  },

  screenToWorld(sx, sy) {
    return { x: this.cam.x + sx, y: this.cam.y + sy };
  },

  enemiesAlive() {
    let n = 0;
    for (const e of this.enemies) if (!e.dead) n++;
    return n;
  },

  waveComposition(n) {
    const types = [];
    for (let i = 0; i < 3 + Math.floor(n * 1.2); i++) types.push('melee');
    if (n >= 2) for (let i = 0; i < 1 + Math.floor((n - 1) / 2); i++) types.push('ranged');
    if (n >= 3) for (let i = 0; i < Math.floor((n - 1) / 2); i++) types.push('tank');
    while (types.length > 18) types.pop();
    if (n >= 4 && n % 3 === 1) types.push('charlief');
    if (n >= 6 && n % 3 === 0) types.push('isaacn');
    if (n >= 8 && n % 3 === 2) types.push('charlieg');
    if (n % 5 === 0) types.push('jefe');
    while (types.length > 22) types.pop();
    return types;
  },

  spawnWave(n) {
    this.wave = n;
    const types = this.waveComposition(n);
    this.waveTotal = types.length;
    for (const t of types) {
      let x = 0;
      let y = 0;
      for (let i = 0; i < 20; i++) {
        x = Utils.rand(140, Config.WORLD.w - 140);
        y = Utils.rand(140, Config.WORLD.h - 140);
        if (Utils.dist(x, y, this.player.x, this.player.y) > 380) break;
      }
      const e = new Enemy(t, x, y);
      this.enemies.push(e);
    }
    const bosses = types.filter((t) => t === 'jefe' || t === 'isaacn' || t === 'charlief' || t === 'charlieg');
    if (types.includes('jefe')) {
      this.waveMsg = '¡JEFE FINAL!';
    } else if (bosses.length) {
      this.waveMsg = '¡JEFE: ' + bosses.map((b) => Config.ENEMIES[b].name).join(' + ') + '!';
    } else {
      this.waveMsg = 'OLEADA ' + n;
    }
    this.waveMsgT = 2.5;
  },

  openShop() {
    Shop.open(this.wave);
    this.state = 'shop';
    this.waveMsg = '';
  },

  shopNext() {
    this.state = 'playing';
    this.spawnWave(this.wave + 1);
    if (this.multi) Net.send({ t: 'next', n: this.wave });
  },

  updateCamera() {
    const tx = this.player.x - Config.CANVAS.w / 2;
    const ty = this.player.y - Config.CANVAS.h / 2;
    this.cam.x = Utils.clamp(tx, 0, Config.WORLD.w - Config.CANVAS.w);
    this.cam.y = Utils.clamp(ty, 0, Config.WORLD.h - Config.CANVAS.h);
  },

  update(dt) {
    if (this.state === 'menu') {
      const qr = UI.qualityRect();
      const mr = UI.multiButtonRects();
      const qx = Input.mouse.x;
      const qy = Input.mouse.y;
      const hitQuality = Input.mouse.clicked && Input.inRect(qx, qy, qr);
      const hitCreate = Input.mouse.clicked && Input.inRect(qx, qy, mr.create);
      const hitJoin = Input.mouse.clicked && Input.inRect(qx, qy, mr.join);
      if (hitCreate) {
        this.createMulti();
      } else if (hitJoin) {
        this.joinMulti();
      } else if (hitQuality) {
        this.cycleQuality();
      } else {
        const rects = UI.selectLayout();
        for (const r of rects) {
          const mx = Input.mouse.x;
          const my = Input.mouse.y;
          if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
            this.selectedIndex = r.index;
            if (Input.mouse.clicked) this.start();
          }
        }
      }
      if (Input.wasPressed('arrowleft')) this.selectedIndex = (this.selectedIndex - 1 + HEROES.length) % HEROES.length;
      if (Input.wasPressed('arrowright')) this.selectedIndex = (this.selectedIndex + 1) % HEROES.length;
      if (Input.wasPressed('enter')) this.start();
      if (Input.wasPressed('c')) this.cycleQuality();
      Effects.update(dt);
      return;
    }

    if (this.state === 'lobby') {
      const lr = UI.lobbyRects();
      const mx = Input.mouse.x;
      const my = Input.mouse.y;
      const hitStart = Input.mouse.clicked && Input.inRect(mx, my, lr.start);
      const hitExit = Input.mouse.clicked && Input.inRect(mx, my, lr.exit);
      if ((Input.wasPressed('enter') || hitStart) && Net.idx === 1 && Net.players >= 2 && Net.connected) {
        this.startMulti();
      } else if (Input.wasPressed('escape') || hitExit) {
        this.leaveMulti();
      }
      Effects.update(dt);
      return;
    }

    if (this.state === 'gameover') {
      if (Input.wasPressed('enter') || Input.mouse.clicked) this.leaveMulti();
      Effects.update(dt);
      return;
    }

    if (this.state === 'shop') {
      this.waveMsgT -= dt;
      const layout = UI.shopLayout();
      const mx = Input.mouse.x;
      const my = Input.mouse.y;
      let hovered = -1;
      layout.items.forEach((r, i) => {
        if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) hovered = i;
      });
      if (mx >= layout.cont.x && mx <= layout.cont.x + layout.cont.w && my >= layout.cont.y && my <= layout.cont.y + layout.cont.h) {
        hovered = 3;
      }
      if (hovered >= 0) Shop.selection = hovered;

      if (Input.wasPressed('arrowleft')) Shop.selection = Shop.selection <= 0 ? 0 : Shop.selection - 1;
      if (Input.wasPressed('arrowright')) Shop.selection = Shop.selection >= 3 ? 3 : Shop.selection + 1;
      if (Input.wasPressed('arrowup') || Input.wasPressed('arrowdown')) Shop.selection = 3;

      if (Input.wasPressed('enter') || (Input.mouse.clicked && hovered >= 0)) {
        if (Shop.selection === 3) {
          this.shopNext();
        } else {
          const item = Shop.offers[Shop.selection];
          if (item) Shop.buy(this.player, item);
        }
      }
      if (Input.wasPressed('escape')) this.shopNext();
      Effects.update(dt);
      return;
    }

    if (this.state !== 'playing') return;

    this.timeAlive += dt;
    this.waveMsgT -= dt;
    this.levelFlash -= dt;

    this.player.update(dt);
    if (this.peer) this.peer.update(dt);

    for (const e of this.enemies) e.update(dt, this.player);

    this.separateEnemies();
    this.updateProjectiles(dt);
    this.updateMeteors(dt);
    Effects.update(dt);
    this.updateCamera();

    this.enemies = this.enemies.filter((e) => !(e.dead && e.deathT > 0.6));

    if (this.multi) {
      if (this.waveBreak > 0 && this.waveClearedSent) {
        this.waveBreak -= dt;
        if (this.waveBreak <= 0) this.openShop();
      }
      this.checkWaveClear();
    } else if (this.enemiesAlive() === 0 && !this.player.dead) {
      if (this.waveBreak <= 0) {
        this.waveBreak = 1.2;
        this.waveMsg = '¡OLEADA COMPLETADA!';
        this.waveMsgT = 1.2;
      } else {
        this.waveBreak -= dt;
        if (this.waveBreak <= 0) this.openShop();
      }
    }

    if (this.multi && Net.connected) {
      const now = performance.now();
      if (now - Net.lastSend > 66) {
        Net.lastSend = now;
        this.sendState();
      }
    }

    if (Input.wasPressed('escape')) {
      if (this.multi) this.leaveMulti();
      else this.state = 'menu';
    }
  },

  sendState() {
    const p = this.player;
    if (!p) return;
    Net.send({
      t: 'state',
      s: {
        x: Math.round(p.x), y: Math.round(p.y),
        a: Math.round(p.angle * 1000) / 1000,
        hp: Math.round(p.hp), maxHp: p.maxHp,
        mana: Math.round(p.mana), ult: Math.round(p.ult),
        ua: Math.round(p.ultActive * 100) / 100,
        lev: p.level,
        dead: p.dead,
        name: p.hero.name,
        hero: p.hero.id,
        at: Math.round(p.attackTimer * 100) / 100,
        dash: Math.round(p.dashT * 100) / 100,
        cast: Math.round(p.casting * 100) / 100
      }
    });
  },

  notifyKill() {
    if (!this.multi) return;
    this.waveKills = Math.min(this.waveTotal, this.waveKills + 1);
    Net.send({ t: 'kill' });
    this.checkWaveClear();
  },

  checkWaveClear() {
    if (!this.multi || this.state !== 'playing' || this.waveClearedSent) return;
    if (this.waveKills + this.peerWaveKills >= this.waveTotal) {
      this.waveClearedSent = true;
      Net.send({ t: 'cleared', wave: this.wave });
      this.waveBreak = 1.2;
      this.waveMsg = '¡OLEADA COMPLETADA!';
      this.waveMsgT = 1.2;
    }
  },

  notifyAttack(msg) {
    if (!this.multi) return;
    Net.send(Object.assign({ t: 'atk' }, msg));
  },

  notifySkill(id) {
    if (!this.multi) return;
    Net.send({ t: 'skill', id, a: this.player ? this.player.angle : 0 });
  },

  peerKillSilent() {
    let best = null;
    for (const e of this.enemies) {
      if (e.dead || e.spawning > 0) continue;
      if (!best || e.hp < best.hp) best = e;
    }
    if (!best) return;
    best.dead = true;
    best.deathT = 0;
    best.animator.play('death');
    Effects.burst(best.x, best.y, best.def.color, 20, 240);
    Effects.addDecal(best.x, best.y, best.def.color);
  },

  applyPeerAttack(m) {
    const p = this.peer;
    if (!p || p.dead) return;
    if (m.k === 'm') {
      const range = m.range, arc = m.arc;
      Effects.addSlash(p.x + Math.cos(m.a) * range * 0.55, p.y + Math.sin(m.a) * range * 0.55, m.a, m.color, range, arc);
      if (m.full) Effects.addSlash(p.x, p.y, m.a + Math.PI, m.color, range, Math.PI / 2);
      for (const e of this.enemies) {
        if (e.dead || e.spawning > 0) continue;
        const d = Utils.dist(p.x, p.y, e.x, e.y);
        if (d > range + e.radius) continue;
        const ang = Utils.angleTo(p.x, p.y, e.x, e.y);
        let diff = ang - m.a;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) <= arc) e.takeDamage(m.dmg, p.x, p.y, m.kb || 220);
      }
    } else if (m.k === 'r') {
      Effects.burst(p.x + Math.cos(m.a) * 24, p.y + Math.sin(m.a) * 24, m.color, 4, 100);
      this.projectiles.push({
        x: p.x + Math.cos(m.a) * 24,
        y: p.y + Math.sin(m.a) * 24,
        vx: Math.cos(m.a) * m.speed,
        vy: Math.sin(m.a) * m.speed,
        radius: m.radius || 9,
        damage: m.dmg,
        knockback: 60,
        color: m.color,
        glow: m.color,
        life: 0.9,
        from: 'peer'
      });
    }
  },

  applyPeerSkill(m) {
    const p = this.peer;
    if (!p || p.dead) return;
    const ab = Config.ABILITIES[m.id];
    if (!ab) return;
    if (m.id === 'fireball' || m.id === 'frost') {
      const cos = Math.cos(m.a), sin = Math.sin(m.a);
      this.projectiles.push({
        x: p.x + cos * 30, y: p.y + sin * 30,
        vx: cos * ab.speed, vy: sin * ab.speed,
        radius: ab.radius, damage: ab.damage, knockback: ab.knockback,
        color: ab.color, glow: ab.glow,
        life: ab.range / ab.speed, from: 'peer',
        slow: ab.slow || 0, slowTime: ab.slowTime || 0
      });
      Effects.burst(p.x + cos * 30, p.y + sin * 30, ab.glow, 6, 120);
    } else if (m.id === 'lightning') {
      const targets = this.enemies
        .filter((e) => !e.dead && e.spawning <= 0 && Utils.dist(p.x, p.y, e.x, e.y) < ab.range)
        .sort((a, b) => Utils.dist(p.x, p.y, a.x, a.y) - Utils.dist(p.x, p.y, b.x, b.y))
        .slice(0, ab.targets);
      let fx = p.x, fy = p.y;
      for (const t of targets) {
        t.takeDamage(ab.damage, fx, fy, 120);
        Effects.addBolt(fx, fy, t.x, t.y, ab.color);
        Effects.burst(t.x, t.y, ab.glow, 6, 120);
        fx = t.x; fy = t.y;
      }
      if (targets.length) { Effects.addRing(p.x, p.y, 60, ab.color); Effects.shake(3); }
    } else if (m.id === 'meteor') {
      let mx = Utils.clamp(p.x + Math.cos(m.a) * 250, 40, Config.WORLD.w - 40);
      let my = Utils.clamp(p.y + Math.sin(m.a) * 250, 40, Config.WORLD.h - 40);
      this.meteors.push({ x: mx, y: my, life: ab.delay, maxLife: ab.delay, radius: ab.radius, damage: ab.damage, knockback: ab.knockback, color: ab.glow });
      Effects.addRing(mx, my, ab.radius, ab.glow);
    } else if (m.id === 'nova') {
      Effects.shake(12);
      Effects.addRing(p.x, p.y, ab.radius, ab.color);
      Effects.addRing(p.x, p.y, ab.radius * 0.6, ab.glow);
      Effects.burst(p.x, p.y, ab.color, 24, 260);
      for (const e of this.enemies) {
        if (e.dead) continue;
        const d = Utils.dist(p.x, p.y, e.x, e.y);
        if (d < ab.radius + e.radius) {
          const fall = 1 - d / ab.radius;
          e.takeDamage(ab.damage * (0.5 + fall * 0.5), p.x, p.y, ab.knockback);
        }
      }
    } else if (m.id === 'blades') {
      const n = 6;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + m.a * 0.25;
        Effects.addSlash(p.x + Math.cos(a) * ab.range * 0.55, p.y + Math.sin(a) * ab.range * 0.55, a, ab.color, ab.range, Math.PI / 6);
      }
      Effects.burst(p.x, p.y, ab.glow, 16, 200);
      for (const e of this.enemies) {
        if (e.dead) continue;
        const d = Utils.dist(p.x, p.y, e.x, e.y);
        if (d < ab.range + e.radius) e.takeDamage(ab.damage, p.x, p.y, ab.knockback);
      }
    }
  },

  separateEnemies() {
    for (let i = 0; i < this.enemies.length; i++) {
      for (let j = i + 1; j < this.enemies.length; j++) {
        const a = this.enemies[i];
        const b = this.enemies[j];
        if (a.dead || b.dead) continue;
        const d = Utils.dist(a.x, a.y, b.x, b.y);
        const min = a.radius + b.radius;
        if (d > 0 && d < min) {
          const push = (min - d) / 2;
          const dx = (b.x - a.x) / d;
          const dy = (b.y - a.y) / d;
          a.x -= dx * push;
          a.y -= dy * push;
          b.x += dx * push;
          b.y += dy * push;
        }
      }
    }
  },

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.homing && this.player && !this.player.dead) {
        const ta = Math.atan2(this.player.y - p.y, this.player.x - p.x);
        const ca = Math.atan2(p.vy, p.vx);
        let diff = ta - ca;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const turn = Utils.clamp(diff, -4 * dt, 4 * dt);
        const sp = Math.hypot(p.vx, p.vy);
        p.vx = Math.cos(ca + turn) * sp;
        p.vy = Math.sin(ca + turn) * sp;
      }

      if (p.x < 0 || p.x > Config.WORLD.w || p.y < 0 || p.y > Config.WORLD.h) {
        this.projectiles.splice(i, 1);
        continue;
      }

      let blocked = false;
      for (const o of this.obstacles) {
        if (p.x > o.x && p.x < o.x + o.w && p.y > o.y && p.y < o.y + o.h) {
          blocked = true;
          break;
        }
      }
      if (blocked) {
        Effects.burst(p.x, p.y, p.color, 6, 120);
        this.projectiles.splice(i, 1);
        continue;
      }

      if (Math.random() < 0.35) Effects.trail(p.x, p.y, p.glow || p.color);

      if (p.from === 'player' || p.from === 'peer') {
        for (const e of this.enemies) {
          if (e.dead || e.spawning > 0) continue;
          if (Utils.dist(p.x, p.y, e.x, e.y) < p.radius + e.radius) {
            e.takeDamage(p.damage, p.x, p.y, p.knockback);
            if (p.from === 'player') this.player.lifesteal(p.damage);
            if (p.slow) {
              e.slow = p.slowTime;
              e.slowFactor = p.slow;
            }
            Effects.burst(p.x, p.y, p.color, 10, 180);
            this.projectiles.splice(i, 1);
            break;
          }
        }
      } else {
        if (this.player && !this.player.dead && this.player.dashT <= 0) {
          if (Utils.dist(p.x, p.y, this.player.x, this.player.y) < p.radius + this.player.radius) {
            this.player.takeDamage(p.damage, p.x, p.y, p.knockback);
            Effects.burst(p.x, p.y, p.color, 10, 180);
            this.projectiles.splice(i, 1);
          }
        }
      }
    }
  },

  updateMeteors(dt) {
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.life -= dt;
      if (m.life <= 0) {
        this.meteors.splice(i, 1);
        Effects.addRing(m.x, m.y, m.radius, m.color);
        Effects.addFlash(m.x, m.y, m.color);
        Effects.burst(m.x, m.y, m.color, 26, 300);
        Effects.shake(10);
        Sfx.nova();
        for (const e of this.enemies) {
          if (e.dead) continue;
          const d = Utils.dist(m.x, m.y, e.x, e.y);
          if (d < m.radius + e.radius) {
            const fall = 1 - d / m.radius;
            e.takeDamage(m.damage * (0.4 + fall * 0.6), m.x, m.y, m.knockback);
          }
        }
      }
    }
  },

  formatTime() {
    const s = Math.floor(this.timeAlive);
    const m = Math.floor(s / 60);
    return m + ':' + String(s % 60).padStart(2, '0');
  },

  drawBackground(ctx) {
    const x0 = this.cam.x;
    const y0 = this.cam.y;
    const x1 = this.cam.x + Config.CANVAS.w;
    const y1 = this.cam.y + Config.CANVAS.h;

    ctx.fillStyle = '#14211a';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

    const g = ctx.createRadialGradient(this.player.x - this.cam.x, this.player.y - this.cam.y, 80, x0, y0, 900);
    g.addColorStop(0, 'rgba(70,120,90,0.18)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.translate(x0, y0);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, x1 - x0, y1 - y0);
    ctx.restore();

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    const grid = 64;
    for (let gx = Math.floor(x0 / grid) * grid; gx < x1; gx += grid) {
      ctx.beginPath();
      ctx.moveTo(gx, y0);
      ctx.lineTo(gx, y1);
      ctx.stroke();
    }
    for (let gy = Math.floor(y0 / grid) * grid; gy < y1; gy += grid) {
      ctx.beginPath();
      ctx.moveTo(x0, gy);
      ctx.lineTo(x1, gy);
      ctx.stroke();
    }

    Effects.drawMotes(ctx);

    ctx.strokeStyle = '#8d6e63';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, Config.WORLD.w, Config.WORLD.h);

    for (const o of this.obstacles) {
      if (o.x > x1 || o.x + o.w < x0 || o.y > y1 || o.y + o.h < y0) continue;
      ctx.fillStyle = '#33463a';
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.strokeStyle = '#1f2b24';
      ctx.lineWidth = 4;
      ctx.strokeRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(o.x + 6, o.y + 6, o.w - 12, 10);
    }
  },

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, Config.CANVAS.w, Config.CANVAS.h);

    if (this.state === 'menu') {
      ctx.fillStyle = '#14211a';
      ctx.fillRect(0, 0, Config.CANVAS.w, Config.CANVAS.h);
      UI.drawSelect(ctx, this.selectedIndex);
      this.blit();
      return;
    }

    if (this.state === 'lobby') {
      ctx.fillStyle = '#14211a';
      ctx.fillRect(0, 0, Config.CANVAS.w, Config.CANVAS.h);
      UI.drawLobby(ctx, Net);
      this.blit();
      return;
    }

    ctx.save();
    if (Effects.shakes > 0) {
      ctx.translate(
        Utils.rand(-Effects.shakes, Effects.shakes),
        Utils.rand(-Effects.shakes, Effects.shakes)
      );
    }
    ctx.translate(-this.cam.x, -this.cam.y);

    this.drawBackground(ctx);

    for (const e of this.enemies) {
      if (!e.dead) Effects.shadow(ctx, e.x, e.y + e.radius * 0.5, e.radius * 1.1, 0.4);
    }
    if (this.player && !this.player.dead) {
      Effects.shadow(ctx, this.player.x, this.player.y + this.player.radius * 0.5, this.player.radius * 1.1, 0.45);
    }
    if (this.peer && !this.peer.dead) {
      Effects.shadow(ctx, this.peer.x, this.peer.y + this.peer.radius * 0.5, this.peer.radius * 1.1, 0.45);
    }
    for (const p of this.projectiles) Effects.shadow(ctx, p.x, p.y + p.radius * 0.6, p.radius * 1.1, 0.25);

    for (const m of this.meteors) {
      const p = 1 - m.life / m.maxLife;
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = m.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.radius * (1 - p), 0, Math.PI * 2);
      ctx.stroke();
      const fy = m.y - 340 * p;
      const gg = ctx.createRadialGradient(m.x, fy, 2, m.x, fy, 44);
      gg.addColorStop(0, m.color);
      gg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(m.x, fy, 44, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const e of this.enemies) e.draw(ctx);

    for (const p of this.projectiles) {
      ctx.save();
      const gg = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.radius * 2.2);
      gg.addColorStop(0, p.glow || p.color);
      gg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (this.player) this.player.draw(ctx);
    if (this.peer) this.peer.draw(ctx);

    if (Input.touch.device && Input.touch.aim && this.player && !this.player.dead) {
      const p = this.player;
      const len = 150;
      const cos = Math.cos(p.angle);
      const sin = Math.sin(p.angle);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(p.x + cos * 28, p.y + sin * 28);
      ctx.lineTo(p.x + cos * len, p.y + sin * len);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.arc(p.x + cos * len, p.y + sin * len, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    Effects.draw(ctx);
    ctx.restore();

    if (this.state === 'shop') {
      UI.drawShop(ctx, this.player, this);
    }

    if (this.state === 'playing' || this.state === 'gameover') {
      UI.drawHUD(ctx, this.player, this);
      if (this.levelFlash > 0) {
        ctx.save();
        ctx.globalAlpha = Utils.clamp(this.levelFlash, 0, 1);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, 0, Config.CANVAS.w, Config.CANVAS.h);
        ctx.textAlign = 'center';
        ctx.font = 'bold 56px "Segoe UI", Arial';
        ctx.fillStyle = '#ffd54f';
        ctx.fillText('¡SUBISTE DE NIVEL!', Config.CANVAS.w / 2, Config.CANVAS.h / 2);
        ctx.restore();
      }
      if (this.state === 'gameover') UI.drawGameOver(ctx, this.player, this);
    }

    this.blit();
  },

  frame(t) {
    requestAnimationFrame((tt) => this.frame(tt));
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    this.update(dt);
    this.draw();
    Input.update();
  }
};

window.addEventListener('DOMContentLoaded', () => Game.boot());
