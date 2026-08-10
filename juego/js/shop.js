const Shop = {
  pool: [
    { id: 'garras', icon: '🔥', name: 'Garras de fuego', desc: '+15% daño total', price: 40, color: '#ff7043',
      buy(p) { p.statsMods.dmgMul += 0.15; } },
    { id: 'guantelete', icon: '🥊', name: 'Guantelete pesado', desc: '+25% daño de ataque básico', price: 45, color: '#e57373',
      buy(p) { p.statsMods.attackMul += 0.25; } },
    { id: 'escudo', icon: '🛡️', name: 'Escudo de hueso', desc: '+25 vida máxima y cura 25', price: 45, color: '#90a4ae',
      buy(p) { p.statsMods.hpFlat += 25; p.refresh(); p.hp = Math.min(p.hp + 25, p.maxHp); } },
    { id: 'botas', icon: '👟', name: 'Botas veloces', desc: '+12% velocidad de movimiento', price: 40, color: '#4db6ac',
      buy(p) { p.statsMods.speedMul += 0.12; p.refresh(); } },
    { id: 'medallon', icon: '🔮', name: 'Medallón de mana', desc: '+25 mana máximo y +5 regeneración', price: 45, color: '#42a5f5',
      buy(p) { p.statsMods.manaFlat += 25; p.statsMods.manaRegenFlat += 5; p.refresh(); p.mana = Math.min(p.mana + 25, p.maxMana); } },
    { id: 'corazon', icon: '❤️', name: 'Corazón rojo', desc: '+3 regeneración de vida y cura 30', price: 45, color: '#ef5350',
      buy(p) { p.statsMods.hpRegenFlat += 3; p.refresh(); p.hp = Math.min(p.hp + 30, p.maxHp); } },
    { id: 'reloj', icon: '⏱️', name: 'Reloj dorado', desc: '-10% enfriamiento de habilidades', price: 55, color: '#ffd54f',
      buy(p) { p.statsMods.cdReduction += 0.1; } },
    { id: 'ojo', icon: '👁️', name: 'Ojo crítico', desc: '+8% de probabilidad de crítico (x2)', price: 50, color: '#f48fb1',
      buy(p) { p.statsMods.crit += 0.08; } },
    { id: 'vampiro', icon: '🦇', name: 'Colmillo vampírico', desc: 'Robas 8% del daño como vida', price: 60, color: '#ce93d8',
      buy(p) { p.statsMods.lifesteal += 0.08; } }
  ],

  offers: [],
  selection: 0,
  wave: 0,

  dialogues: [
    'hoy no fío mañana sí',
    '¿vas a comprar o vas a preguntar?',
    'anda para otro lado hijito',
    '¿10 céntimos? anda a otra tienda mongol'
  ],
  boughtDialogues: [
    'bien hijito sigue comprando que el recibo del agua no se paga solo',
    'eso mi niño eso le da mi plata al arrendatario',
    'otra vez por aquí gastando como rey',
    'buena compra, que la deuda también sube'
  ],
  dialogue: '',
  dialogueStart: 0,
  lastDialogue: -1,

  open(wave) {
    this.wave = wave;
    const pool = this.pool.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Utils.rand(0, i + 1));
      const t = pool[i];
      pool[i] = pool[j];
      pool[j] = t;
    }
    this.offers = pool.slice(0, 3);
    this.selection = 0;
    this.dialogue = '';
    this.dialogueStart = 0;
  },

  tickDialogue(now) {
    if (!this.dialogueStart) this.dialogueStart = now;
    if (now - this.dialogueStart > 6000) {
      let i = Math.floor(Utils.rand(0, this.dialogues.length));
      if (this.dialogues.length > 1) {
        while (i === this.lastDialogue) i = Math.floor(Utils.rand(0, this.dialogues.length));
      }
      this.lastDialogue = i;
      this.dialogue = this.dialogues[i];
      this.dialogueStart = now;
    }
  },

  price(item) {
    return Math.round(item.price * (1 + (this.wave - 1) * 0.08));
  },

  canAfford(player, item) {
    return player.gold >= this.price(item);
  },

  buy(player, item) {
    const price = this.price(item);
    if (player.gold < price) return false;
    player.gold -= price;
    item.buy(player);
    player.owned = player.owned || {};
    player.owned[item.id] = (player.owned[item.id] || 0) + 1;
    Effects.addFloater(player.x, player.y - 60, item.name, item.color);
    Effects.addRing(player.x, player.y, 80, item.color);
    Sfx.heal();
    if (this.boughtDialogues.length) {
      const i = Math.floor(Utils.rand(0, this.boughtDialogues.length));
      this.dialogue = this.boughtDialogues[i];
      this.dialogueStart = performance.now();
    }
    return true;
  }
};
