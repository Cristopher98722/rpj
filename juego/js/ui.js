const UI = {
  bar(ctx, x, y, w, h, ratio, fill, label) {
    ratio = Utils.clamp(ratio, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    Utils.roundRect(ctx, x - 1, y - 1, w + 2, h + 2, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (ratio > 0) {
      ctx.fillStyle = fill;
      Utils.roundRect(ctx, x, y, w * ratio, h, 4);
      ctx.fill();
    }
    if (label) {
      ctx.font = 'bold 12px "Segoe UI", Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(label, x + w / 2, y + h / 2 + 4);
    }
  },

  abilityIcon(ctx, x, y, size, slot, cds, cdsTotal, manaCost, mana) {
    const ready = cds <= 0;
    const affordable = mana >= manaCost;
    ctx.save();
    ctx.globalAlpha = ready && affordable ? 1 : 0.45;
    ctx.fillStyle = '#1b2838';
    Utils.roundRect(ctx, x, y, size, size, 8);
    ctx.fill();
    ctx.strokeStyle = ready && affordable ? '#9fb8ff' : '#445';
    ctx.lineWidth = 2;
    ctx.stroke();

    const cx = x + size / 2;
    const cy = y + size / 2;
    ctx.strokeStyle = '#8ca9ff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.27, 0, Math.PI * 2);
    ctx.stroke();

    if (cds > 0) {
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#000';
      const frac = Utils.clamp(cds / cdsTotal, 0, 1);
      ctx.fillRect(x, y, size, size * frac);
      ctx.globalAlpha = 1;
      ctx.font = 'bold 16px "Segoe UI", Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(cds.toFixed(1), cx, cy + 6);
    }

    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x + 13, y + 13, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.font = 'bold 12px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd54f';
    ctx.fillText(slot.toUpperCase(), x + 13, y + 14);
    ctx.restore();

    ctx.restore();
  },

  drawHUD(ctx, player, game) {
    const W = Config.CANVAS.w;
    const H = Config.CANVAS.h;

    ctx.save();
    ctx.textAlign = 'left';
    ctx.font = 'bold 15px "Segoe UI", Arial';
    ctx.fillStyle = player.hero.color;
    ctx.fillText(player.hero.name, 20, 40);

    const hpRatio = player.hp / player.maxHp;
    this.bar(ctx, 20, 50, 300, 22, hpRatio,
      hpRatio > 0.5 ? '#66bb6a' : hpRatio > 0.25 ? '#ffa726' : '#e53935',
      Math.ceil(player.hp) + ' / ' + player.maxHp);
    this.bar(ctx, 20, 78, 300, 14, player.mana / player.maxMana, '#42a5f5',
      Math.floor(player.mana) + ' / ' + player.maxMana);

    const ultRatio = Utils.clamp(player.ult / player.ultMax, 0, 1);
    const ultReady = ultRatio >= 1;
    ctx.save();
    if (ultReady) {
      const pulse = 0.5 + 0.5 * Math.sin((Game.timeAlive || 0) * 8);
      ctx.globalAlpha = 0.72 + pulse * 0.28;
    }
    this.bar(ctx, 20, 98, 300, 16, ultRatio, player.hero.ult.color,
      ultReady ? '¡PODER OCULTO LISTO!  (' + (Input.touch.device ? 'ULT' : 'F') + ')' : 'PODER ' + Math.floor(ultRatio * 100) + '%');
    ctx.restore();

    this.bar(ctx, 20, H - 30, 420, 16, player.xp / player.xpNext, '#ab47bc',
      'Nivel ' + player.level + '  ·  XP ' + Math.floor(player.xp) + '/' + player.xpNext);

    ctx.textAlign = 'center';
    ctx.font = 'bold 16px "Segoe UI", Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText('OLEADA ' + game.wave, W / 2, 40);
    ctx.font = '13px "Segoe UI", Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('Enemigos: ' + game.enemiesAlive() + '   ·   Bajas: ' + player.kills, W / 2, 62);

    if (game.multi) {
      const ph = game.peer;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = 'bold 13px "Segoe UI", Arial';
      ctx.fillStyle = ph && ph.hero ? ph.hero.color : '#4fc3f7';
      ctx.fillText((ph && ph.name) || 'Aliado' + (ph && ph.dead ? '  ·  CAÍDO' : ''), W / 2, 86);
      if (ph && !ph.dead) {
        const w = 160;
        const h = 7;
        const x = W / 2 - w / 2;
        const y = 92;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
        ctx.fillStyle = ph.hp > ph.maxHp * 0.5 ? '#66bb6a' : '#e53935';
        ctx.fillRect(x, y, w * Utils.clamp(ph.hp / ph.maxHp, 0, 1), h);
      }
      ctx.font = '11px "Segoe UI", Arial';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(Net.connected ? (game.waveTotal ? 'Oleada: ' + (game.waveKills + game.peerWaveKills) + ' / ' + game.waveTotal + ' bajas' : Net.status) : Net.status, W / 2, 110);
      ctx.restore();
    }

    if (game.waveMsgT > 0) {
      ctx.globalAlpha = Utils.clamp(game.waveMsgT / 2.5, 0, 1);
      ctx.font = 'bold 34px "Segoe UI", Arial';
      ctx.fillStyle = '#ffd54f';
      ctx.fillText(game.waveMsg, W / 2, H / 2 - 140);
      ctx.globalAlpha = 1;
    }

    ctx.textAlign = 'right';
    ctx.font = 'bold 20px "Segoe UI", Arial';
    ctx.fillStyle = '#ffd54f';
    ctx.fillText('💰 ' + Math.floor(player.gold), W - 30, 96);

    const boss = game.enemies.find((e) => !e.dead && ['jefe', 'isaacn', 'charlief', 'charlieg'].includes(e.type));
    if (boss) {
      ctx.save();
      ctx.fillStyle = '#1b2838';
      Utils.roundRect(ctx, W / 2 - 260, 88, 520, 26, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      const br = Utils.clamp(boss.hp / boss.maxHp, 0, 1);
      if (br > 0) {
        ctx.fillStyle = boss.type === 'jefe' ? '#ef5350' : '#ff9800';
        Utils.roundRect(ctx, W / 2 - 258, 90, 516 * br, 22, 6);
        ctx.fill();
      }
      ctx.font = 'bold 13px "Segoe UI", Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(boss.def.name + '  ·  ' + Math.ceil(boss.hp) + ' / ' + boss.maxHp, W / 2, 104);
      ctx.restore();
    }

    ctx.textAlign = 'right';
    ctx.font = '12px "Segoe UI", Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(
      Input.touch.device
        ? 'Sticks fijos: IZQ mover · DER atacar · Q/E/R habilidades · RISA'
        : 'WASD mover · Clic atacar · Q/E/R habilidades · F PODER · L risa · ESC menú',
      W - 20, H - 12);

    const slots = ['q', 'e', 'r'];
    const size = 56;
    Input.abilityRects().forEach((rect, i) => {
      const id = player.hero.skills[slots[i]];
      const ab = Config.ABILITIES[id];
      this.abilityIcon(ctx, rect.cx - size / 2, rect.cy - size / 2, size, slots[i], player.cds[slots[i]], ab.cooldown, ab.mana, player.mana);
      ctx.font = '10px "Segoe UI", Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(ab.name, rect.cx, rect.cy + size / 2 + 16);
    });

    if (Input.touch.device) this.drawTouch(ctx, player);

    if (player.dead) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();
  },

  drawFullscreenButton(ctx) {
    const f = Input.fullscreenButtonRect();
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#1b2838';
    Utils.roundRect(ctx, f.x, f.y, f.w, f.h, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    const cx = f.x + f.w / 2;
    const cy = f.y + f.h / 2;
    ctx.strokeRect(cx - 11, cy - 9, 22, 18);
    ctx.beginPath();
    ctx.moveTo(cx - 11, cy - 3); ctx.lineTo(cx - 16, cy - 3); ctx.lineTo(cx - 16, cy - 15); ctx.lineTo(cx - 4, cy - 15); ctx.lineTo(cx - 4, cy - 10);
    ctx.moveTo(cx + 11, cy + 3); ctx.lineTo(cx + 16, cy + 3); ctx.lineTo(cx + 16, cy + 15); ctx.lineTo(cx + 4, cy + 15); ctx.lineTo(cx + 4, cy + 10);
    ctx.stroke();
    ctx.restore();
  },

  drawTouch(ctx, player) {
    const drawBase = (ox, oy, color, label) => {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(ox, oy, 48, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ox, oy, 48, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(ox, oy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 13px "Segoe UI", Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillText(label, ox, oy + 66);
      ctx.restore();
    };
    const drawKnob = (s, color) => {
      if (!s) return;
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const mv = Input.moveAnchor();
    const am = Input.aimAnchor();
    drawBase(mv.x, mv.y, 'rgba(255,255,255,0.85)', 'MOV');
    drawBase(am.x, am.y, player.hero.color, 'ATAC');
    drawKnob(Input.touch.move, 'rgba(255,255,255,0.95)');
    drawKnob(Input.touch.aim, player.hero.color);

    const ub = Input.ultButtonRect();
    const ultReady = player.ult >= player.ultMax;
    ctx.save();
    if (ultReady) {
      const pulse = 0.5 + 0.5 * Math.sin((Game.timeAlive || 0) * 8);
      ctx.globalAlpha = 0.65 + pulse * 0.3;
    } else {
      ctx.globalAlpha = 0.7;
    }
    ctx.fillStyle = '#1b2838';
    ctx.beginPath();
    ctx.arc(ub.cx, ub.cy, ub.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ultReady ? player.hero.ult.color : 'rgba(255,255,255,0.35)';
    ctx.lineWidth = ultReady ? 4 : 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px "Segoe UI", Arial';
    ctx.fillStyle = ultReady ? '#fff' : 'rgba(255,255,255,0.8)';
    ctx.fillText(ultReady ? '¡ULT!' : 'ULT', ub.cx, ub.cy + 5);
    ctx.restore();

    const lb = Input.laughButtonRect();
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#1b2838';
    ctx.beginPath();
    ctx.arc(lb.cx, lb.cy, lb.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px "Segoe UI", Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText('RISA', lb.cx, lb.cy + 5);
    ctx.restore();

    const m = Input.menuButtonRect();
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#1b2838';
    Utils.roundRect(ctx, m.x, m.y, m.w, m.h, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.font = 'bold 13px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText('MENÚ', m.x + m.w / 2, m.y + m.h / 2 + 5);
    ctx.restore();

    this.drawFullscreenButton(ctx);
  },

  selectLayout() {
    const W = Config.CANVAS.w;
    const H = Config.CANVAS.h;
    const cols = 3;
    const cw = 210;
    const ch = 252;
    const gapX = 30;
    const gapY = 26;
    const rows = Math.ceil(HEROES.length / cols);
    const totalW = cols * cw + (cols - 1) * gapX;
    const totalH = rows * ch + (rows - 1) * gapY;
    const x0 = (W - totalW) / 2;
    const y0 = Math.max(110, (H - totalH) / 2 + 20);
    const rects = [];
    HEROES.forEach((h, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      rects.push({ x: x0 + col * (cw + gapX), y: y0 + row * (ch + gapY), w: cw, h: ch, index: i });
    });
    return rects;
  },

  qualityRect() {
    const W = Config.CANVAS.w;
    const H = Config.CANVAS.h;
    return { x: W / 2 - 180, y: H - 70, w: 360, h: 44 };
  },

  multiButtonRects() {
    const W = Config.CANVAS.w;
    const H = Config.CANVAS.h;
    const w = 250;
    const h = 50;
    const gap = 24;
    const x0 = (W - (w * 2 + gap)) / 2;
    const y = H - 148;
    return {
      create: { x: x0, y, w, h },
      join: { x: x0 + w + gap, y, w, h }
    };
  },

  drawMultiButton(ctx, r, label, color) {
    ctx.save();
    ctx.fillStyle = '#1b2838';
    Utils.roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = 'bold 17px "Segoe UI", Arial';
    ctx.fillStyle = color;
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 6);
    ctx.restore();
  },

  lobbyRects() {
    const W = Config.CANVAS.w;
    const H = Config.CANVAS.h;
    return {
      start: { x: W / 2 - 200, y: H / 2 + 70, w: 400, h: 58 },
      exit: { x: W / 2 - 120, y: H / 2 + 150, w: 240, h: 48 }
    };
  },

  drawLobby(ctx, net) {
    const W = Config.CANVAS.w;
    const H = Config.CANVAS.h;

    ctx.save();
    ctx.fillStyle = 'rgba(6,10,16,0.92)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.font = 'bold 54px "Segoe UI", Arial';
    ctx.fillStyle = '#ffd54f';
    ctx.fillText('SALA MULTIJUGADOR', W / 2, 90);

    ctx.font = 'bold 34px "Segoe UI", Arial';
    ctx.fillStyle = '#4fc3f7';
    ctx.fillText('SALA: ' + net.room, W / 2, H / 2 - 60);

    ctx.font = '20px "Segoe UI", Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText('Jugadores: ' + net.players + ' / 2', W / 2, H / 2 - 20);

    ctx.font = '18px "Segoe UI", Arial';
    ctx.fillStyle = net.players >= 2 ? '#66bb6a' : 'rgba(255,255,255,0.8)';
    ctx.fillText(net.status, W / 2, H / 2 + 20);

    const lr = this.lobbyRects();
    const canStart = net.idx === 1 && net.players >= 2 && net.connected;
    ctx.save();
    ctx.globalAlpha = canStart ? 1 : 0.45;
    ctx.fillStyle = '#1c3b25';
    Utils.roundRect(ctx, lr.start.x, lr.start.y, lr.start.w, lr.start.h, 12);
    ctx.fill();
    ctx.strokeStyle = '#66bb6a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px "Segoe UI", Arial';
    ctx.fillStyle = '#66bb6a';
    ctx.fillText(net.idx === 1 ? 'COMENZAR PARTIDA  (ENTER)' : 'ESPERANDO AL ANFITRIÓN...', lr.start.x + lr.start.w / 2, lr.start.y + lr.start.h / 2 + 7);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#3a1c1c';
    Utils.roundRect(ctx, lr.exit.x, lr.exit.y, lr.exit.w, lr.exit.h, 12);
    ctx.fill();
    ctx.strokeStyle = '#ef5350';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = 'bold 17px "Segoe UI", Arial';
    ctx.fillStyle = '#ef5350';
    ctx.fillText('SALIR  (ESC)', lr.exit.x + lr.exit.w / 2, lr.exit.y + lr.exit.h / 2 + 6);
    ctx.restore();

    ctx.font = '15px "Segoe UI", Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(
      net.mode === 'create'
        ? 'Comparte el código de sala con tu amigo para que se una.'
        : 'Espera a que el anfitrión comience la partida.',
      W / 2, H - 30);
    ctx.restore();

    if (Input.touch.device) this.drawFullscreenButton(ctx);
  },

  drawSelect(ctx, selectedIndex) {
    const W = Config.CANVAS.w;
    const H = Config.CANVAS.h;

    ctx.fillStyle = 'rgba(6,10,16,0.92)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.font = 'bold 58px "Segoe UI", Arial';
    ctx.fillStyle = '#ffd54f';
    ctx.fillText('ELIGE TU GATO', W / 2, 82);

    const rects = this.selectLayout();
    rects.forEach((r, i) => {
      const h = HEROES[i];
      const sel = i === selectedIndex;

      ctx.save();
      ctx.shadowColor = sel ? h.color : 'transparent';
      ctx.shadowBlur = sel ? 24 : 0;
      ctx.fillStyle = sel ? '#22334a' : '#151f2c';
      Utils.roundRect(ctx, r.x, r.y, r.w, r.h, 14);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = sel ? h.color : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = sel ? 3 : 1;
      ctx.stroke();

      const img = Assets.cache[`assets/characters/${h.id}/${h.id}.png`];
      const pw = r.w - 40;
      const ph = r.h - 88;
      const py = r.y + 10;
      if (img) {
        const scale = Math.min(pw / img.width, ph / img.height);
        const iw = img.width * scale;
        const ih = img.height * scale;
        ctx.drawImage(img, r.x + (r.w - iw) / 2, py + (ph - ih) / 2, iw, ih);
      } else {
        ctx.fillStyle = h.color;
        ctx.beginPath();
        ctx.arc(r.x + r.w / 2, py + ph / 2, 30, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.textAlign = 'center';
      ctx.font = 'bold 18px "Segoe UI", Arial';
      ctx.fillStyle = '#fff';
      ctx.fillText(h.name, r.x + r.w / 2, r.y + r.h - 58);

      ctx.font = '11px "Segoe UI", Arial';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(h.attack.type === 'melee' ? 'Cuerpo a cuerpo' : 'A distancia', r.x + r.w / 2, r.y + r.h - 42);

      const slots = ['q', 'e', 'r'];
      const sStart = r.x + r.w / 2 - 60;
      slots.forEach((s, si) => {
        const ab = Config.ABILITIES[h.skills[s]];
        const y = r.y + r.h - 24;
        const x = sStart + si * 40;
        ctx.save();
        ctx.fillStyle = ab.color;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.font = '10px "Segoe UI", Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText(ab.name, x, y + 13);
      });

      ctx.restore();
    });

    const qr = this.qualityRect();
    ctx.save();
    ctx.fillStyle = '#1b2838';
    Utils.roundRect(ctx, qr.x, qr.y, qr.w, qr.h, 22);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = 'bold 17px "Segoe UI", Arial';
    ctx.fillStyle = '#ffd54f';
    const q = Config.QUALITY.presets[Game.currentQuality];
    ctx.fillText('CALIDAD: ' + q.label + '  ·  toca o C', qr.x + qr.w / 2, qr.y + qr.h / 2 + 6);
    ctx.restore();

    const mr = this.multiButtonRects();
    this.drawMultiButton(ctx, mr.create, '🌐 CREAR PARTIDA', '#4fc3f7');
    this.drawMultiButton(ctx, mr.join, '🔗 UNIR PARTIDA', '#ab47bc');

    ctx.font = '15px "Segoe UI", Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(
      Input.touch.device
        ? 'Toca un gato para elegir y jugar'
        : '← → o mueve el ratón para elegir  ·  CLIC o ENTER para jugar',
      W / 2, H - 18);

    if (Input.touch.device) this.drawFullscreenButton(ctx);
  },

  shopLayout() {
    const W = Config.CANVAS.w;
    const H = Config.CANVAS.h;
    const cols = 3;
    const cw = 260;
    const ch = 270;
    const gapX = 30;
    const totalW = cols * cw + (cols - 1) * gapX;
    const x0 = (W - totalW) / 2;
    const y0 = 150;
    const rects = [];
    Shop.offers.forEach((item, i) => {
      rects.push({ x: x0 + i * (cw + gapX), y: y0, w: cw, h: ch, index: i });
    });
    return {
      items: rects,
      cont: { x: W / 2 - 150, y: y0 + ch + 42, w: 300, h: 56 }
    };
  },

  drawShop(ctx, player, game) {
    const W = Config.CANVAS.w;
    const H = Config.CANVAS.h;

    ctx.save();
    ctx.fillStyle = 'rgba(6,10,16,0.82)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.font = 'bold 50px "Segoe UI", Arial';
    ctx.fillStyle = '#ffd54f';
    ctx.fillText('TIENDA', W / 2, 72);
    ctx.font = '18px "Segoe UI", Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('Oleada ' + game.wave + ' completada · elige tu mejora', W / 2, 104);

    ctx.textAlign = 'right';
    ctx.font = 'bold 24px "Segoe UI", Arial';
    ctx.fillStyle = '#ffd54f';
    ctx.fillText('💰 ORO: ' + Math.floor(player.gold), W - 30, 50);

    const layout = this.shopLayout();
    layout.items.forEach((r, i) => {
      const item = Shop.offers[i];
      const price = Shop.price(item);
      const affordable = Shop.canAfford(player, item);
      const sel = Shop.selection === i;
      const owned = player.owned[item.id] || 0;

      ctx.save();
      ctx.shadowColor = sel ? item.color : 'transparent';
      ctx.shadowBlur = sel ? 24 : 0;
      ctx.fillStyle = sel ? '#22334a' : '#151f2c';
      Utils.roundRect(ctx, r.x, r.y, r.w, r.h, 14);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = sel ? item.color : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = sel ? 3 : 1;
      ctx.stroke();

      ctx.globalAlpha = affordable ? 1 : 0.55;
      ctx.textAlign = 'center';
      ctx.font = '52px "Segoe UI", Arial';
      ctx.fillText(item.icon, r.x + r.w / 2, r.y + 92);

      ctx.font = 'bold 20px "Segoe UI", Arial';
      ctx.fillStyle = '#fff';
      ctx.fillText(item.name + (owned > 0 ? '  Nv ' + (owned + 1) : ''), r.x + r.w / 2, r.y + 148);

      ctx.font = '14px "Segoe UI", Arial';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(item.desc, r.x + r.w / 2, r.y + 172);

      ctx.font = 'bold 24px "Segoe UI", Arial';
      ctx.fillStyle = affordable ? '#ffd54f' : '#ef5350';
      ctx.fillText('💰 ' + price, r.x + r.w / 2, r.y + 216);

      if (owned > 0) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(r.x + r.w - 24, r.y + 26, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px "Segoe UI", Arial';
        ctx.textAlign = 'center';
        ctx.fillText('x' + owned, r.x + r.w - 24, r.y + 31);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    });

    const c = layout.cont;
    const onCont = Shop.selection === 3;
    ctx.save();
    ctx.shadowColor = onCont ? '#66bb6a' : 'transparent';
    ctx.shadowBlur = onCont ? 18 : 0;
    ctx.fillStyle = onCont ? '#1c3b25' : '#16301f';
    Utils.roundRect(ctx, c.x, c.y, c.w, c.h, 12);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = onCont ? '#66bb6a' : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = onCont ? 3 : 1;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px "Segoe UI", Arial';
    ctx.fillStyle = '#66bb6a';
    ctx.fillText('SIGUIENTE OLEADA  ▶  (ENTER)', c.x + c.w / 2, c.y + c.h / 2 + 7);
    ctx.restore();

    ctx.font = '14px "Segoe UI", Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('← → para elegir  ·  ENTER compra o continúa  ·  ESC continúa  ·  los boosters se acumulan al recomprar', W / 2, H - 16);
    ctx.restore();
  },

  drawGameOver(ctx, player, game) {
    const W = Config.CANVAS.w;
    const H = Config.CANVAS.h;
    ctx.fillStyle = 'rgba(10,4,4,0.78)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.font = 'bold 60px "Segoe UI", Arial';
    ctx.fillStyle = '#ef5350';
    ctx.fillText('HAS CAÍDO', W / 2, H / 2 - 130);

    ctx.font = '20px "Segoe UI", Arial';
    ctx.fillStyle = player.hero.color;
    ctx.fillText('Personaje: ' + player.hero.name, W / 2, H / 2 - 80);

    ctx.fillStyle = '#fff';
    const lines = [
      'Nivel alcanzado: ' + player.level,
      'Oleada: ' + game.wave,
      'Enemigos derrotados: ' + player.kills,
      'Tiempo de batalla: ' + game.formatTime()
    ];
    lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 - 40 + i * 30));

    ctx.font = 'bold 22px "Segoe UI", Arial';
    ctx.fillStyle = '#66bb6a';
    ctx.fillText(
      Input.touch.device ? 'Toca para elegir otro personaje' : 'Pulsa ENTER para elegir otro personaje',
      W / 2, H / 2 + 120);
  }
};
