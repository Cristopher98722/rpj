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
    Effects.addFloater(player.x, player.y - 60, item.name, item.color);
    Effects.addRing(player.x, player.y, 80, item.color);
    Sfx.heal();
    return true;
  }
};
