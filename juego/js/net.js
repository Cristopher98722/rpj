const Net = {
  ws: null,
  connected: false,
  mode: '',
  room: '',
  idx: 0,
  players: 0,
  roster: null,
  status: '',
  lastSend: 0,

  wsUrl() {
    try {
      const q = new URLSearchParams(location.search);
      const override = q.get('ws');
      if (override) return override;
    } catch (e) {}
    if (Config.NET && Config.NET.wsUrl) return Config.NET.wsUrl;
    try {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      return proto + '//' + location.host + '/ws';
    } catch (e) {
      return null;
    }
  },

  makeCode() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let c = '';
    for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
    return c;
  },

  reset() {
    if (this.ws) {
      try { this.ws.onclose = null; this.ws.close(); } catch (e) {}
    }
    this.ws = null;
    this.connected = false;
    this.mode = '';
    this.room = '';
    this.idx = 0;
    this.players = 0;
    this.roster = null;
    this.status = '';
  },

  begin(mode, code) {
    this.reset();
    this.mode = mode;
    this.room = code;
    this.status = 'Conectando...';
    this.connect();
  },

  connect() {
    const url = this.wsUrl();
    if (!url) {
      this.status = 'Servidor no disponible';
      return;
    }
    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      this.status = 'No se pudo conectar';
      return;
    }
    this.ws.onopen = () => {
      this.connected = true;
      this.send({ t: 'join', room: this.room, name: this.myName(), hero: this.myHero() });
    };
    this.ws.onmessage = (ev) => this.onMessage(ev.data);
    this.ws.onclose = () => this.onClose();
    this.ws.onerror = () => {
      if (!this.connected) this.status = 'No se pudo conectar al servidor';
    };
  },

  myName() {
    try {
      const h = HEROES[(Game && Game.selectedIndex) || 0];
      return h ? h.name : 'Jugador';
    } catch (e) { return 'Jugador'; }
  },

  myHero() {
    try {
      const h = HEROES[(Game && Game.selectedIndex) || 0];
      return h ? h.id : 'gato';
    } catch (e) { return 'gato'; }
  },

  onClose() {
    this.connected = false;
    if (Game && Game.state === 'lobby') {
      this.status = 'Se perdió la conexión';
    }
  },

  send(obj) {
    if (this.connected && this.ws && this.ws.readyState === 1) {
      try { this.ws.send(JSON.stringify(obj)); } catch (e) {}
    }
  },

  leave() {
    this.send({ t: 'leave' });
    this.reset();
  },

  onMessage(raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    Game.onNetMessage(msg);
  }
};

class RemotePlayer {
  constructor(heroId, name) {
    this.heroId = heroId || 'gato';
    this.hero = HEROES.find((h) => h.id === this.heroId) || HEROES[0];
    this.animator = Assets.getSpriteSet(this.hero.id).animator();
    this.name = name || 'Jugador';
    this.idx = 0;
    this.x = Config.WORLD.w / 2;
    this.y = Config.WORLD.h / 2 - 120;
    this.tx = this.x;
    this.ty = this.y;
    this.angle = 0;
    this.facing = 1;
    this.radius = 22;
    this.hp = this.hero.stats.maxHp;
    this.maxHp = this.hero.stats.maxHp;
    this.ultActive = 0;
    this.dead = false;
    this.attackTimer = 0;
    this.dashT = 0;
    this.casting = 0;
    this.reviveProg = 0;
    this.animator.play('idle');
  }

  revive() {
    if (!this.dead) return;
    this.dead = false;
    this.hp = Math.max(1, Math.round(this.maxHp * Config.REVIVE.heal));
    this.animator.play('idle');
    Effects.addRing(this.x, this.y, 120, '#81c784');
    Effects.burst(this.x, this.y, '#81c784', 24, 260);
    Effects.addFloater(this.x, this.y - 50, '¡REVIVIDO!', '#a5d6a7');
    Sfx.heal();
  }

  setHero(id) {
    if (id === this.heroId) return;
    this.heroId = id;
    this.hero = HEROES.find((h) => h.id === id) || this.hero;
    this.animator = Assets.getSpriteSet(this.hero.id).animator();
    this.animator.play('idle');
  }

  apply(s) {
    this.tx = s.x;
    this.ty = s.y;
    this.angle = s.a || 0;
    this.facing = Math.cos(this.angle) >= 0 ? 1 : -1;
    this.hp = s.hp || 0;
    this.maxHp = s.maxHp || 100;
    this.ultActive = s.ua || 0;
    this.dead = !!s.dead;
    this.name = s.name || this.name;
    this.attackTimer = s.at || 0;
    this.dashT = s.dash || 0;
    this.casting = s.cast || 0;
    if (s.hero) this.setHero(s.hero);
  }

  get moving() {
    return Math.hypot(this.tx - this.x, this.ty - this.y) > 10;
  }

  update(dt) {
    const k = Math.min(1, dt * 12);
    this.x += (this.tx - this.x) * k;
    this.y += (this.ty - this.y) * k;
    this.animator.update(dt);
    if (this.dead) {
      this.animator.play('death');
      return;
    }
    if (this.dashT > 0 || this.casting > 0) {
      this.animator.play('cast');
    } else if (this.attackTimer > 0.18) {
      this.animator.play('attack');
    } else {
      this.animator.play(this.moving ? 'walk' : 'idle');
    }
  }

  draw(ctx) {
    const u = this.hero.ult;
    if (this.ultActive > 0 && u) {
      const pulse = 0.5 + 0.5 * Math.sin((Game.timeAlive || 0) * 12);
      ctx.save();
      const g = ctx.createRadialGradient(this.x, this.y, 8, this.x, this.y, 100);
      g.addColorStop(0, u.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.25 + pulse * 0.2;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 100, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (this.dead) ctx.globalAlpha = 0.35;
    this.animator.facing = this.facing;
    this.animator.draw(ctx, this.x, this.y, this.facing);
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.font = 'bold 13px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';
    ctx.fillText(this.name, this.x + 1, this.y - 40);
    ctx.fillStyle = this.hero.color;
    ctx.fillText(this.name, this.x, this.y - 41);
    const w = 44;
    const h = 5;
    const yy = this.y - 32;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(this.x - w / 2 - 1, yy - 1, w + 2, h + 2);
    ctx.fillStyle = this.hp > this.maxHp * 0.5 ? '#66bb6a' : '#e53935';
    ctx.fillRect(this.x - w / 2, yy, w * Utils.clamp(this.hp / this.maxHp, 0, 1), h);
    ctx.restore();
  }
}
