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
  chests: [],
  loot: [],
  obstacles: Config.OBSTACLES,
  wave: 0,
  waveBreak: 0,
  roundCountdown: 0,
  roundCountdownMax: 0,
  waveMsg: '',
  waveMsgT: 0,
  levelFlash: 0,
  timeAlive: 0,
  last: 0,
  renderScale: 1,
  currentQuality: 'alta',
  multi: false,
  peers: [],
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
    Sfx.load();
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

  findPeer(idx) {
    for (const p of this.peers) if (p.idx === idx) return p;
    return null;
  },

  getPeerOrCreate(idx, hero, name) {
    let p = this.findPeer(idx);
    if (!p) {
      p = new RemotePlayer(hero, name);
      p.idx = idx;
      this.peers.push(p);
    } else {
      if (hero) p.setHero(hero);
      if (name) p.name = name;
    }
    return p;
  },

  removePeer(idx) {
    this.peers = this.peers.filter((p) => p.idx !== idx);
  },

  rebuildPeers() {
    this.peers = [];
    if (!Net.roster) return;
    for (const r of Net.roster) {
      if (r.idx === Net.idx) continue;
      this.getPeerOrCreate(r.idx, r.hero, r.name);
    }
    Net.players = Net.roster.length;
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
    this.chests = [];
    this.loot = [];
    this.wave = 0;
    this.waveBreak = 0;
    this.roundCountdown = 0;
    this.roundCountdownMax = 0;
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
    this.rebuildPeers();
    this.peerAlive = true;
    this.waveKills = 0;
    this.peerWaveKills = 0;
    this.waveClearedSent = false;
  },

  leaveMulti() {
    if (this.multi) {
      Net.leave();
      this.multi = false;
      this.peers = [];
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
          Net.players = msg.count || msg.idx;
          Net.roster = msg.roster || null;
          this.rebuildPeers();
          Net.status = Net.idx === 1
            ? 'Sala ' + msg.room + ' creada. Comparte el código (hasta ' + Config.MAX_PLAYERS + ' jugadores).'
            : 'Conectado a la sala ' + msg.room + '.';
        }
        break;
      case 'peerJoin':
        this.getPeerOrCreate(msg.idx, msg.hero, msg.name);
        if (Net.roster) Net.players = Net.roster.length;
        Net.status = '¡' + msg.name + ' se unió! (' + Net.players + '/' + Config.MAX_PLAYERS + ')';
        break;
      case 'roster':
        Net.roster = msg.list || [];
        Net.players = Net.roster.length;
        this.rebuildPeers();
        break;
      case 'full':
        Net.status = Net.idx === 1
          ? '¡PARTIDA LISTA! Pulsa COMENZAR.'
          : '¡PARTIDA LISTA! Esperando que el anfitrión comience...';
        break;
      case 'error':
        Net.status = msg.msg || 'Error de sala';
        break;
      case 'peerLeave':
        this.removePeer(msg.idx);
        if (Net.roster) Net.players = Net.roster.length;
        if (this.state === 'lobby') {
          Net.status = 'El jugador salió de la sala.';
        } else if (this.multi) {
          Net.status = 'Jugador desconectado. Sigues jugando.';
        }
        break;
      case 'state':
        if (msg.s) {
          const p = this.findPeer(msg.s.idx);
          if (p) p.apply(msg.s);
        }
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
        if (this.multi) {
          const pa = this.findPeer(msg.idx);
          if (pa) this.applyPeerAttack(msg, pa);
        }
        break;
      case 'skill':
        if (this.multi) {
          const ps = this.findPeer(msg.idx);
          if (ps) this.applyPeerSkill(msg, ps);
        }
        break;
      case 'ready':
        if (this.state === 'lobby') this.startMulti();
        break;
      case 'laugh':
        if (this.multi) Sfx.play('risa');
        break;
      case 'desa':
        if (this.multi) Sfx.play('desa');
        break;
      case 'miku':
      case 'death':
        if (this.multi) Sfx.play('miku');
        break;
      case 'revive':
        if (msg.idx === Net.idx) {
          if (this.player) this.player.revive();
        } else {
          const pr = this.findPeer(msg.idx);
          if (pr) pr.revive();
        }
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
    this.roundCountdown = 0;
    this.roundCountdownMax = 0;
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
    this.spawnChests();
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

  spawnChests() {
    this.chests = [];
    for (let i = 0; i < Config.CHESTS.count; i++) {
      let x = 0;
      let y = 0;
      for (let k = 0; k < 20; k++) {
        x = Utils.rand(160, Config.WORLD.w - 160);
        y = Utils.rand(160, Config.WORLD.h - 160);
        if (Utils.dist(x, y, this.player.x, this.player.y) > 420) break;
      }
      this.chests.push(new Chest(x, y));
    }
  },

  updateLoot(dt) {
    for (let i = this.loot.length - 1; i >= 0; i--) {
      const l = this.loot[i];
      l.t -= dt;
      if (l.t <= 0) {
        this.loot.splice(i, 1);
        continue;
      }
      const pick = (p) => {
        if (!p || p.dead) return false;
        if (Utils.dist(l.x, l.y, p.x, p.y) < l.radius + p.radius) {
          p.hp = Math.min(p.hp + Config.CHESTS.heal, p.maxHp);
          Effects.addFloater(l.x, l.y - 30, '+' + Config.CHESTS.heal + ' PV', '#ffab91');
          Effects.burst(l.x, l.y, '#ffab91', 12, 160);
          Sfx.heal();
          return true;
        }
        return false;
      };
      if (pick(this.player)) {
        this.loot.splice(i, 1);
        continue;
      }
      let picked = false;
      for (const p of this.peers) {
        if (pick(p)) {
          picked = true;
          break;
        }
      }
      if (picked) {
        this.loot.splice(i, 1);
      }
    }
  },

  drawLoot(ctx, l) {
    const bob = Math.sin((this.timeAlive || 0) * 6 + l.x) * 4;
    const y = l.y + bob;
    ctx.save();
    ctx.shadowColor = 'rgba(255,64,129,0.6)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ff80ab';
    ctx.beginPath();
    ctx.moveTo(l.x, y - 13);
    ctx.lineTo(l.x - 10, y + 8);
    ctx.lineTo(l.x + 10, y + 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(l.x, y - 13);
    ctx.lineTo(l.x - 10, y + 8);
    ctx.lineTo(l.x, y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  beginRoundCountdown(n) {
    this.wave = n;
    this.roundCountdown = Config.ROUND.countdown;
    this.roundCountdownMax = Config.ROUND.countdown;
    this.enemies = [];
    this.projectiles = [];
    this.meteors = [];
    this.waveBreak = 0;
    this.waveClearedSent = false;
    this.waveKills = 0;
    this.peerWaveKills = 0;
    this.waveMsg = 'PREPARATE...';
    this.waveMsgT = 1.5;
  },

  openShop() {
    Shop.open(this.wave);
    this.state = 'shop';
    this.waveMsg = '';
    this.shopOpenAt = performance.now();
  },

  shopNext() {
    this.state = 'playing';
    this.beginRoundCountdown(this.wave + 1);
    if (this.multi) Net.send({ t: 'next', n: this.wave });
  },

  updateCamera() {
    const tx = this.player.x - Config.CANVAS.w / 2;
    const ty = this.player.y - Config.CANVAS.h / 2;
    this.cam.x = Utils.clamp(tx, 0, Config.WORLD.w - Config.CANVAS.w);
    this.cam.y = Utils.clamp(ty, 0, Config.WORLD.h - Config.CANVAS.h);
  },

  update(dt) {
    Sfx.updateIntro(this.state);
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

    if (this.roundCountdown > 0) {
      this.roundCountdown -= dt;
      if (this.roundCountdown <= 0) {
        this.roundCountdown = 0;
        this.roundCountdownMax = 0;
        this.spawnWave(this.wave);
      }
    }

    this.player.update(dt);
    for (const p of this.peers) p.update(dt);
    this.updateRevive(dt);

    for (const e of this.enemies) e.update(dt, this.player);
    for (const c of this.chests) c.update(dt);
    this.updateLoot(dt);

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
    } else if (this.enemiesAlive() === 0 && !this.player.dead && this.roundCountdown <= 0) {
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
        idx: Net.idx,
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

  notifyLaugh() {
    if (!this.multi) return;
    Net.send({ t: 'laugh' });
  },

  notifyDesa() {
    if (!this.multi) return;
    Net.send({ t: 'desa' });
  },

  notifyDeath() {
    if (!this.multi) return;
    const p = this.player;
    Net.send({ t: 'death', idx: Net.idx, x: p ? p.x : 0, y: p ? p.y : 0 });
  },

  notifyRevive(idx) {
    if (!this.multi) return;
    Net.send({ t: 'revive', idx });
  },

  updateRevive(dt) {
    if (!this.multi || !this.player || this.player.dead) return;
    const range = Config.REVIVE.range;
    const key = Config.REVIVE.key;
    for (const p of this.peers) {
      if (!p.dead) continue;
      p.reviveProg = p.reviveProg || 0;
      const near = Utils.dist(this.player.x, this.player.y, p.x, p.y) < range;
      if (near && Input.isDown(key)) {
        p.reviveProg = Math.min(1, p.reviveProg + Config.REVIVE.gain * dt);
        if (Math.random() < 0.3) Effects.trail(p.x, p.y, '#81c784');
      } else {
        p.reviveProg = Math.max(0, p.reviveProg - Config.REVIVE.drain * dt);
      }
      if (p.reviveProg >= 1) {
        p.reviveProg = 0;
        this.notifyRevive(p.idx);
        p.revive();
      }
    }
  },

  drawRevivePrompts(ctx) {
    if (!this.multi || !this.player || this.player.dead) return;
    for (const p of this.peers) {
      if (!p.dead) continue;
      const near = Utils.dist(this.player.x, this.player.y, p.x, p.y) < Config.REVIVE.range;
      ctx.save();
      const w = 130;
      const h = 14;
      const x = p.x - w / 2;
      const y = p.y - 78;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      Utils.roundRect(ctx, x - 2, y - 2, w + 4, h + 4, 6);
      ctx.fill();
      ctx.fillStyle = near ? '#66bb6a' : '#9e9e9e';
      Utils.roundRect(ctx, x, y, w * Utils.clamp(p.reviveProg || 0, 0, 1), h, 4);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      Utils.roundRect(ctx, x, y, w, h, 4);
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = 'bold 12px "Segoe UI", Arial';
      ctx.fillStyle = near ? '#a5d6a7' : 'rgba(255,255,255,0.6)';
      ctx.fillText('¡REVIVE CON [' + Config.REVIVE.keyLabel + ']!', p.x, y - 8);
      ctx.restore();
    }
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

  applyPeerAttack(m, peer) {
    const p = peer;
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
      for (const c of this.chests) {
        if (c.broken) continue;
        const d = Utils.dist(p.x, p.y, c.x, c.y);
        if (d > range + c.radius) continue;
        const ang = Utils.angleTo(p.x, p.y, c.x, c.y);
        let diff = ang - m.a;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) <= arc) c.takeDamage(m.dmg, p.x, p.y);
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

  applyPeerSkill(m, peer) {
    const p = peer;
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
        let hitChest = false;
        for (const c of this.chests) {
          if (c.broken) continue;
          if (Utils.dist(p.x, p.y, c.x, c.y) < p.radius + c.radius) {
            c.takeDamage(p.damage, p.x, p.y);
            Effects.burst(p.x, p.y, p.color, 6, 120);
            this.projectiles.splice(i, 1);
            hitChest = true;
            break;
          }
        }
        if (hitChest) continue;
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
    for (const p of this.peers) {
      if (!p.dead) {
        Effects.shadow(ctx, p.x, p.y + p.radius * 0.5, p.radius * 1.1, 0.45);
      }
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

    for (const c of this.chests) c.draw(ctx);
    for (const l of this.loot) this.drawLoot(ctx, l);

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
    for (const p of this.peers) p.draw(ctx);
    this.drawRevivePrompts(ctx);

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
      if (this.state === 'playing' && this.roundCountdown > 0) {
        UI.drawCountdown(ctx, this.roundCountdown, this.roundCountdownMax, this.wave);
      }
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
