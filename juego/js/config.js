const Config = {
  CANVAS: { w: 1280, h: 720 },
  WORLD: { w: 2400, h: 1600 },

  QUALITY: {
    presets: {
      auto: { scale: 1, label: 'AUTO' },
      alta: { scale: 2, label: 'ALTA (1440p)' },
      ultra4k: { scale: 3, label: 'ULTRA 4K' }
    },
    order: ['auto', 'alta', 'ultra4k']
  },

  NET: {
    wsUrl: ''
  },

  PLAYER: {
    maxMana: 100,
    hpRegen: 1.5,
    invulnTime: 0.6
  },

  ABILITIES: {
    fireball: { cooldown: 2.0, mana: 18, damage: 34, speed: 460, radius: 14, range: 620, knockback: 180, color: '#ff7043', glow: '#ffab40', name: 'Bola de fuego' },
    frost: { cooldown: 2.2, mana: 20, damage: 26, speed: 430, radius: 15, range: 560, knockback: 120, slow: 0.45, slowTime: 2.0, color: '#4fc3f7', glow: '#b3e5fc', name: 'Chorro helado' },
    lightning: { cooldown: 3.2, mana: 25, damage: 32, targets: 3, range: 430, color: '#b388ff', glow: '#e1bee7', name: 'Cadena eléctrica' },
    meteor: { cooldown: 6.0, mana: 35, damage: 55, radius: 130, delay: 0.6, knockback: 320, color: '#ff7043', glow: '#ffd54f', name: 'Meteorito' },
    dash: { cooldown: 2.6, mana: 15, speed: 720, duration: 0.2, damage: 22, knockback: 160, color: '#81d4fa', glow: '#e1f5fe', name: 'Embate' },
    nova: { cooldown: 8.0, mana: 40, radius: 210, damage: 48, knockback: 460, color: '#7e57c2', glow: '#b39ddb', name: 'Nova' },
    blades: { cooldown: 5.0, mana: 25, damage: 26, range: 150, knockback: 240, color: '#eceff1', glow: '#cfd8dc', name: 'Cuchillas' },
    heal: { cooldown: 7.0, mana: 30, heal: 45, color: '#81c784', glow: '#c8e6c9', name: 'Cura' }
  },

  ENEMIES: {
    melee: {
      radius: 20, speed: 125, hp: 42, damage: 10, xp: 12, gold: 4,
      attackRange: 46, attackCd: 1.1, color: '#ef5350'
    },
    ranged: {
      radius: 18, speed: 100, hp: 30, damage: 9, xp: 16, gold: 5,
      attackRange: 330, attackCd: 2.2, color: '#ab47bc', projSpeed: 260
    },
    tank: {
      radius: 32, speed: 58, hp: 150, damage: 17, xp: 30, gold: 10,
      attackRange: 58, attackCd: 1.7, color: '#8d6e63'
    },
    isaacn: {
      radius: 34, speed: 250, hp: 340, damage: 18, xp: 160, gold: 60,
      attackRange: 62, attackCd: 1.2, color: '#5c6bc0',
      name: 'Isaac Negro'
    },
    charlief: {
      radius: 46, speed: 95, hp: 560, damage: 28, xp: 210, gold: 90,
      attackRange: 82, attackCd: 1.5, color: '#f44336',
      name: 'Charlie Fuerte'
    },
    charlieg: {
      radius: 36, speed: 170, hp: 420, damage: 22, xp: 180, gold: 75,
      attackRange: 340, attackCd: 2.0, color: '#66bb6a', projSpeed: 300,
      name: 'Charlie Gei'
    },
    jefe: {
      radius: 48, speed: 78, hp: 2600, damage: 38, xp: 500, gold: 300,
      attackRange: 80, attackCd: 1.3, color: '#ff7043', projSpeed: 260,
      name: 'JEFE FINAL'
    }
  },

  OBSTACLES: [
    { x: 700, y: 600, w: 170, h: 60 },
    { x: 1500, y: 500, w: 60, h: 210 },
    { x: 1000, y: 1100, w: 220, h: 70 },
    { x: 420, y: 1300, w: 70, h: 170 },
    { x: 1900, y: 1000, w: 170, h: 60 },
    { x: 1700, y: 300, w: 80, h: 220 },
    { x: 300, y: 700, w: 60, h: 140 },
    { x: 2000, y: 1300, w: 190, h: 60 }
  ]
};

const HEROES = [
  {
    id: 'gato', name: 'Gato Weón', color: '#ff9800', size: 64,
    stats: { maxHp: 130, speed: 260, manaRegen: 14 },
    attack: { type: 'melee', color: '#ffcc80', damage: 16, range: 95, halfArc: Math.PI / 3, cooldown: 0.28, knockback: 260, lunge: 220 },
    skills: { q: 'fireball', e: 'dash', r: 'nova' },
    desc: 'Garras ardientes y fuego felino',
    ult: { name: 'Garra Infernal', color: '#ff7043', duration: 2.5, mult: 3 }
  },
  {
    id: 'simsop', name: 'Simsop', color: '#4fc3f7', size: 64,
    stats: { maxHp: 100, speed: 235, manaRegen: 20 },
    attack: { type: 'ranged', color: '#4fc3f7', damage: 13, projSpeed: 430, radius: 9, cooldown: 0.45 },
    skills: { q: 'frost', e: 'lightning', r: 'meteor' },
    desc: 'Mago de hielo y relámpagos',
    ult: { name: 'Tormenta Arcano', color: '#00e5ff', duration: 1, damage: 42, count: 12 }
  },
  {
    id: 'isaac', name: 'Isaac Gato', color: '#ab47bc', size: 64,
    stats: { maxHp: 115, speed: 275, manaRegen: 16 },
    attack: { type: 'melee', color: '#e1bee7', damage: 14, range: 90, halfArc: Math.PI / 2.2, cooldown: 0.24, knockback: 240, lunge: 230 },
    skills: { q: 'blades', e: 'dash', r: 'meteor' },
    desc: 'Asaltante veloz de cuchillas',
    ult: { name: 'Torbellino de Cuchillas', color: '#e040fb', duration: 3.5, damage: 46, blades: 8 }
  }
];

const HeroAnim = (id) => ({
  idle: { file: id, frames: 1, fps: 1 },
  walk: { file: id, frames: 1, fps: 1 },
  attack: { file: id, frames: 1, fps: 1, loop: false },
  cast: { file: id, frames: 1, fps: 1, loop: false },
  hurt: { file: id, frames: 1, fps: 1, loop: false },
  death: { file: id, frames: 1, fps: 1, loop: false }
});

const BossAnim = HeroAnim;

const Characters = {
  melee: {
    folder: 'assets/enemies/melee',
    color: '#ef5350',
    size: 56,
    animations: {
      idle: { file: 'idle', frames: 4, fps: 5 },
      walk: { file: 'walk', frames: 6, fps: 9 },
      attack: { file: 'attack', frames: 4, fps: 14, loop: false },
      cast: { file: 'cast', frames: 4, fps: 12, loop: false },
      hurt: { file: 'hurt', frames: 2, fps: 8, loop: false },
      death: { file: 'death', frames: 4, fps: 6, loop: false }
    }
  },
  ranged: {
    folder: 'assets/enemies/ranged',
    color: '#ab47bc',
    size: 56,
    animations: {
      idle: { file: 'idle', frames: 4, fps: 5 },
      walk: { file: 'walk', frames: 6, fps: 9 },
      attack: { file: 'attack', frames: 4, fps: 14, loop: false },
      cast: { file: 'cast', frames: 4, fps: 12, loop: false },
      hurt: { file: 'hurt', frames: 2, fps: 8, loop: false },
      death: { file: 'death', frames: 4, fps: 6, loop: false }
    }
  },
  tank: {
    folder: 'assets/enemies/tank',
    color: '#8d6e63',
    size: 72,
    animations: {
      idle: { file: 'idle', frames: 4, fps: 4 },
      walk: { file: 'walk', frames: 6, fps: 7 },
      attack: { file: 'attack', frames: 4, fps: 12, loop: false },
      cast: { file: 'cast', frames: 4, fps: 10, loop: false },
      hurt: { file: 'hurt', frames: 2, fps: 7, loop: false },
      death: { file: 'death', frames: 4, fps: 6, loop: false }
    }
  },
  jefe: {
    folder: 'assets/enemies/jefe',
    color: '#ff7043',
    size: 150,
    animations: {
      idle: { file: 'jefe', frames: 1, fps: 1 },
      walk: { file: 'jefe', frames: 1, fps: 1 },
      attack: { file: 'jefe', frames: 1, fps: 1, loop: false },
      cast: { file: 'jefe', frames: 1, fps: 1, loop: false },
      hurt: { file: 'jefe', frames: 1, fps: 1, loop: false },
      death: { file: 'jefe', frames: 1, fps: 1, loop: false }
    }
  }
};

for (const b of ['isaacn', 'charlief', 'charlieg']) {
  Characters[b] = {
    folder: `assets/enemies/${b}`,
    color: Config.ENEMIES[b].color,
    size: b === 'charlief' ? 96 : b === 'isaacn' ? 84 : 84,
    animations: BossAnim(b)
  };
}

for (const h of HEROES) {
  Characters[h.id] = {
    folder: `assets/characters/${h.id}`,
    color: h.color,
    size: h.size,
    animations: HeroAnim(h.id)
  };
}

const CONTROLS = [
  { key: 'W A S D', action: 'Moverse' },
  { key: 'Clic / Espacio', action: 'Ataque básico' },
  { key: 'Q E R', action: 'Habilidades' },
  { key: 'ESC', action: 'Volver a selección' },
  { key: 'Táctil', action: 'Toca IZQ para mover, DER para apuntar/atacar, Q/E/R para habilidades' }
];
