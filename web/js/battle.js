/* Битка: хексово поле 15×11, ред по скорост, чакане/защита, ответен удар,
   стрелба с наказания, класическата формула за щети, морал и късмет,
   магии, специални способности, обсада с кули и стени, боен ИИ. */
(function () {
  'use strict';
  const MK = (window.MK = window.MK || {});
  const D = MK.data;
  const W = 15, H = 11;

  // ---------------------------------------------------------------- хексове (odd-r)
  const Hex = {
    W, H,
    idx: (x, y) => y * W + x,
    inb: (x, y) => x >= 0 && y >= 0 && x < W && y < H,
    neighbors(x, y) {
      const odd = y & 1;
      const d = odd ? [[1, 0], [-1, 0], [1, -1], [0, -1], [1, 1], [0, 1]] : [[1, 0], [-1, 0], [0, -1], [-1, -1], [0, 1], [-1, 1]];
      const out = [];
      for (const [dx, dy] of d) { const nx = x + dx, ny = y + dy; if (Hex.inb(nx, ny)) out.push([nx, ny]); }
      return out;
    },
    toCube(x, y) { const q = x - ((y - (y & 1)) >> 1); const r = y; return [q, r, -q - r]; },
    dist(x1, y1, x2, y2) { const a = Hex.toCube(x1, y1), b = Hex.toCube(x2, y2); return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])); },
    // Хексът "зад" целта по линията от атакуващия (за дъх на дракон)
    behind(ax, ay, tx, ty) {
      const a = Hex.toCube(ax, ay), t = Hex.toCube(tx, ty);
      const d = [t[0] - a[0], t[1] - a[1], t[2] - a[2]];
      const c = [t[0] + d[0], t[1] + d[1], t[2] + d[2]];
      const y = c[1], x = c[0] + ((y - (y & 1)) >> 1);
      return Hex.inb(x, y) ? [x, y] : null;
    }
  };
  MK.Hex = Hex;

  const START_ROWS = { 1: [5], 2: [3, 7], 3: [2, 5, 8], 4: [1, 4, 6, 9], 5: [0, 3, 5, 7, 10], 6: [0, 2, 4, 6, 8, 10], 7: [0, 2, 4, 5, 6, 8, 10] };

  // ---------------------------------------------------------------- битката
  class Battle {
    /* ctx: {attacker:{hero,army,owner}, defender:{hero,army,owner,garrison,obj}, town, kind, world, seed, terrain} */
    constructor(ctx) {
      this.ctx = ctx;
      this.world = ctx.world;
      this.rng = new MK.RNG((ctx.seed || 1) ^ 0x51ba77);
      this.terrain = ctx.terrain ?? 1;
      this.round = 0;
      this.log = [];
      this.finished = false;
      this.winner = null;
      this.sides = [this.makeSide(ctx.attacker, 0), this.makeSide(ctx.defender, 1)];
      this.stacks = [];
      this.obstacles = new Set();
      this.walls = new Set();
      this.towers = [];
      this.siege = 0;
      if (ctx.town && this.world) {
        this.siege = this.world.fortLevel(ctx.town);
      }
      this.placeObstacles();
      this.placeStacks();
      this.casted = [false, false];
      this.queue = [];
      this.waitQueue = [];
      this.current = null;
      this.events = [];
    }
    makeSide(s, i) {
      const w = this.world;
      const h = s.hero;
      const side = { i, hero: h, owner: s.owner, army: s.army, garrison: s.garrison, obj: s.obj, mana: h ? h.mana : 0, ai: false };
      side.att = h ? w.stat(h, 'att') : 0;
      side.def = h ? w.stat(h, 'def') : 0;
      side.pow = h ? w.stat(h, 'pow') : 0;
      side.know = h ? w.stat(h, 'know') : 0;
      side.skills = h ? h.skills : {};
      side.spells = h ? h.spells : [];
      side.morale = h ? w.heroMorale(h) : 0;
      side.luck = h ? w.heroLuck(h) : 0;
      side.arts = h ? h.arts : [];
      side.hpBonus = h ? w.artBonus(h, 'hpBonus') : 0;
      // морал от смесени фракции
      const fs = MK.Army.factions(s.army); if (s.garrison) MK.Army.factions(s.garrison).forEach((f) => fs.add(f));
      fs.delete('neutral');
      side.factionMorale = fs.size <= 1 ? (fs.size === 1 ? 1 : 0) : fs.size === 2 ? 0 : -(fs.size - 2);
      side.hasUndead = [...fs].includes('necropolis');
      if (this.ctx.town && i === 1 && this.ctx.town.buildings.tavern) side.morale += 1;
      side.tactics = side.skills.tactics || 0;
      return side;
    }
    placeObstacles() {
      const n = this.rng.int(3, 7);
      for (let k = 0; k < n; k++) {
        const x = this.rng.int(3, W - 4), y = this.rng.int(0, H - 1);
        if (this.siege && x >= 9) continue;
        this.obstacles.add(Hex.idx(x, y));
        if (this.rng.chance(0.5)) { const nb = this.rng.pick(Hex.neighbors(x, y)); if (nb[0] >= 3 && nb[0] <= W - 4 && !(this.siege && nb[0] >= 9)) this.obstacles.add(Hex.idx(nb[0], nb[1])); }
      }
      if (this.siege) {
        // Стени в колона 10, отворена порта в редове 4-6; кули по нивата
        for (let y = 0; y < H; y++) if (y < 4 || y > 6) { this.walls.add(Hex.idx(10, y)); this.obstacles.add(Hex.idx(10, y)); }
        if (this.siege >= 2) this.towers.push({ x: 13, y: 5, dmg: 15 });
        if (this.siege >= 3) { this.towers.push({ x: 12, y: 0, dmg: 10 }); this.towers.push({ x: 12, y: 10, dmg: 10 }); }
      }
    }
    addStack(side, slot, sl, x, y, fromGarrison) {
      const c = D.creatureOf(sl.c);
      const s = {
        id: this.stacks.length, side, slot, fromGarrison: !!fromGarrison, ref: sl, c, count: sl.n, hp: c.hp + this.sides[side].hpBonus, maxHp: c.hp + this.sides[side].hpBonus,
        x, y, shots: c.shots, effects: {}, retaliations: 0, waited: false, defended: false, acted: false, alive: true, killed: 0, movedHexes: 0, boundBy: null
      };
      this.stacks.push(s);
      return s;
    }
    placeStacks() {
      [0, 1].forEach((si) => {
        const side = this.sides[si];
        const slots = [];
        side.army.forEach((sl, i) => { if (sl && sl.n > 0) slots.push({ sl, i, g: false }); });
        if (side.garrison) side.garrison.forEach((sl, i) => { if (sl && sl.n > 0 && slots.length < 7) slots.push({ sl, i, g: true }); });
        const rows = START_ROWS[Math.min(7, slots.length)] || [];
        let col = si === 0 ? 0 : W - 1;
        if (side.tactics && !(si === 1 && this.siege)) col += si === 0 ? side.tactics : -side.tactics;
        if (si === 1 && this.siege) col = W - 2;
        slots.forEach((s, k) => {
          let x = col, y = rows[k] ?? k;
          // ако хексът е препятствие — търсим свободен наблизо
          while (this.obstacles.has(Hex.idx(x, y)) || this.stackAt(x, y)) { x += si === 0 ? 1 : -1; }
          this.addStack(si, s.i, s.sl, x, y, s.g);
        });
      });
    }
    stackAt(x, y) { return this.stacks.find((s) => s.alive && s.x === x && s.y === y) || null; }
    alive(side) { return this.stacks.filter((s) => s.alive && s.side === side); }
    enemySide(s) { return 1 - s.side; }
    pushEv(e) { this.events.push(e); }

    // ------------------------------------------------------------ характеристики
    eff(s, name) { const e = s.effects[name]; return e ? e.val : 0; }
    isNative(s) { const f = D.factionById(s.c.faction); return f && f.terrain === this.terrain; }
    speed(s) {
      let v = s.c.spd + this.eff(s, 'haste') + this.eff(s, 'prayer');
      if (s.effects.slow) v = Math.floor(v * (1 - s.effects.slow.val / 100));
      if (this.isNative(s)) v += 1;
      return Math.max(1, v);
    }
    attack(s, ranged) {
      const side = this.sides[s.side];
      let a = s.c.att + side.att + this.eff(s, 'prayer') - this.eff(s, 'weakness');
      if (!ranged) a += this.eff(s, 'bloodlust'); else a += this.eff(s, 'precision');
      if (this.isNative(s)) a += 1;
      return Math.max(0, a);
    }
    defense(s) {
      const side = this.sides[s.side];
      let d = s.c.def + side.def + this.eff(s, 'stoneskin') + this.eff(s, 'prayer') - this.eff(s, 'disrupt');
      if (s.defended) d += Math.ceil(s.c.def * 0.2);
      if (this.isNative(s)) d += 1;
      return Math.max(0, d);
    }
    morale(s) {
      if (s.c.abilities.undead || s.c.faction === 'neutral' && s.c.abilities.undead) return 0;
      const side = this.sides[s.side];
      let m = side.morale + side.factionMorale + this.eff(s, 'mirth') - this.eff(s, 'sorrow');
      if (side.hasUndead && !s.c.abilities.undead) m -= 1;
      if (this.alive(s.side).some((o) => o.c.abilities.moraleAura && o !== s)) m += 1;
      if (this.alive(1 - s.side).some((o) => o.c.abilities.fearAura)) m -= 1;
      return Math.max(-3, Math.min(3, m));
    }
    luck(s) {
      const side = this.sides[s.side];
      return Math.max(-3, Math.min(3, side.luck + this.eff(s, 'fortune') - this.eff(s, 'misfortune')));
    }
    isShooter(s) { return !!s.c.abilities.shooter && s.shots > 0; }
    adjacentEnemy(s) { return Hex.neighbors(s.x, s.y).some(([x, y]) => { const o = this.stackAt(x, y); return o && o.side !== s.side; }); }
    behindWall(s) { return this.siege && s.x > 10; }

    // ------------------------------------------------------------ рундове и ред
    startRound() {
      this.round++;
      this.casted = [false, false];
      this.stacks.forEach((s) => {
        if (!s.alive) return;
        s.waited = false; s.defended = false; s.acted = false; s.movedHexes = 0;
        s.retaliations = s.c.abilities.retaliations || 1;
        // ефекти с продължителност
        for (const k in s.effects) { const e = s.effects[k]; if (e.turns !== Infinity && --e.turns <= 0) delete s.effects[k]; }
        if (s.c.abilities.regenerate) s.hp = s.maxHp;
      });
      // Кули стрелят по нападателя
      this.towers.forEach((t) => {
        const targets = this.alive(0);
        if (!targets.length) return;
        const tgt = this.rng.pick(targets);
        const dmg = Math.floor(t.dmg * (1 + this.sides[1].def * 0.05) * (this.siege === 3 ? 1.5 : 1));
        const r = this.applyDamage(tgt, dmg);
        this.pushEv({ type: 'tower', from: t, target: tgt.id, dmg, kills: r.kills });
        this.logLine('Кулата стреля по ' + tgt.c.name + ': ' + dmg + ' щети' + (r.kills ? ', убити ' + r.kills : '') + '.');
      });
      this.checkEnd();
      const order = this.stacks.filter((s) => s.alive).sort((a, b) => {
        const d = this.speed(b) - this.speed(a);
        if (d) return d;
        return (this.round & 1) ? a.side - b.side : b.side - a.side;
      });
      this.queue = order;
      this.waitQueue = [];
      this.pushEv({ type: 'round', round: this.round });
    }
    /* Взима следващия стек за действие; обработва морал (лош) и слепота. Връща стека или null ако битката е приключила. */
    nextTurn() {
      if (this.finished) return null;
      for (;;) {
        if (!this.queue.length && !this.waitQueue.length) { this.startRound(); if (this.finished) return null; continue; }
        let s;
        if (this.queue.length) s = this.queue.shift();
        else { this.waitQueue.sort((a, b) => this.speed(a) - this.speed(b)); s = this.waitQueue.shift(); }
        if (!s.alive) continue;
        if (s.effects.blind) { this.pushEv({ type: 'skip', stack: s.id, why: 'blind' }); continue; }
        if (s.effects.bound && s.boundBy && !(s.boundBy.alive && Hex.dist(s.x, s.y, s.boundBy.x, s.boundBy.y) === 1)) { delete s.effects.bound; s.boundBy = null; }
        // Присмукване на мана
        if (s.c.abilities.manaDrain) { const es = this.sides[1 - s.side]; if (es.hero && es.mana > 0) { es.mana = Math.max(0, es.mana - s.c.abilities.manaDrain); this.pushEv({ type: 'manaDrain', stack: s.id }); } }
        // Лош морал
        if (!s.waited) {
          const m = this.morale(s);
          if (m < 0 && this.rng.chance(-m / 24)) { s.acted = true; this.pushEv({ type: 'morale', stack: s.id, good: false }); this.logLine(s.c.name + ' се колебае от лош морал.'); continue; }
        }
        this.current = s;
        return s;
      }
    }
    /* Извиква се след действие: добър морал дава още един ход веднага */
    afterAction(s) {
      if (this.finished) return;
      this.checkEnd();
      if (this.finished) return;
      if (s && s.alive && !s.waited && !s.goodMoraleUsed && s.actionKind !== 'defend' && s.actionKind !== 'wait') {
        const m = this.morale(s);
        if (m > 0 && this.rng.chance(m / 24)) {
          s.goodMoraleUsed = true;
          this.pushEv({ type: 'morale', stack: s.id, good: true });
          this.logLine('Висок морал! ' + s.c.name + ' действа отново.');
          this.queue.unshift(s);
        }
      }
      if (s) s.goodMoraleUsed = false;
    }

    // ------------------------------------------------------------ движение
    /* Достижими хексове за стека: Map idx -> {x,y,dist,prev} */
    reach(s) {
      const sp = this.speed(s);
      const out = new Map();
      if (s.effects.bound) { out.set(Hex.idx(s.x, s.y), { x: s.x, y: s.y, d: 0, prev: null }); return out; }
      if (s.c.abilities.flying) {
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const d = Hex.dist(s.x, s.y, x, y);
          if (d <= sp && !this.obstacles.has(Hex.idx(x, y)) && (!this.stackAt(x, y) || (x === s.x && y === s.y))) out.set(Hex.idx(x, y), { x, y, d, prev: null });
        }
        return out;
      }
      const start = Hex.idx(s.x, s.y);
      out.set(start, { x: s.x, y: s.y, d: 0, prev: null });
      const q = [[s.x, s.y, 0]];
      while (q.length) {
        const [x, y, d] = q.shift();
        if (d >= sp) continue;
        for (const [nx, ny] of Hex.neighbors(x, y)) {
          const i = Hex.idx(nx, ny);
          if (out.has(i) || this.obstacles.has(i) || this.stackAt(nx, ny)) continue;
          out.set(i, { x: nx, y: ny, d: d + 1, prev: Hex.idx(x, y) });
          q.push([nx, ny, d + 1]);
        }
      }
      return out;
    }
    pathTo(reach, x, y) {
      const path = []; let i = Hex.idx(x, y);
      while (i !== null && i !== undefined) { const n = reach.get(i); if (!n) return null; path.push([n.x, n.y]); i = n.prev; }
      return path.reverse();
    }
    /* Възможни атаки: за всеки враг — от кой достижим съседен хекс (или стрелба) */
    attackOptions(s, reach) {
      reach = reach || this.reach(s);
      const opts = [];
      const enemies = this.alive(1 - s.side);
      if (this.isShooter(s) && !this.adjacentEnemy(s)) enemies.forEach((e) => opts.push({ target: e, ranged: true }));
      enemies.forEach((e) => {
        let best = null;
        for (const [nx, ny] of Hex.neighbors(e.x, e.y)) {
          const r = reach.get(Hex.idx(nx, ny));
          if (r && (!best || r.d < best.d)) best = r;
        }
        if (best) opts.push({ target: e, ranged: false, from: best });
      });
      return opts;
    }

    // ------------------------------------------------------------ щети
    baseDamage(att, def) {
      const c = att.c;
      let dmin = c.dmin, dmax = c.dmax;
      if (att.effects.bless) { dmin = dmax = dmax + (att.effects.bless.val ? 1 : 0); }
      if (att.effects.curse) { dmax = dmin = Math.max(1, dmin - (att.effects.curse.val ? 1 : 0)); }
      const n = att.count;
      if (dmin === dmax) return dmin * n;
      if (n <= 10) { let s = 0; for (let i = 0; i < n; i++) s += this.rng.int(dmin, dmax); return s; }
      let s = 0; for (let i = 0; i < 10; i++) s += this.rng.int(dmin, dmax);
      return Math.round(s * n / 10);
    }
    /* Пълна формула. opts: {ranged, retaliation, luckRoll:true} → {dmg, luck} */
    calcDamage(att, def, opts) {
      opts = opts || {};
      const ranged = !!opts.ranged;
      const A = this.attack(att, ranged) + (att.effects.slayer && def.c.tier === 7 ? att.effects.slayer.val : 0);
      const Dd = this.defense(def);
      let mult;
      if (A >= Dd) mult = Math.min(4, 1 + 0.05 * (A - Dd)); else mult = Math.max(0.3, 1 - 0.025 * (Dd - A));
      let base = this.baseDamage(att, def);
      const side = this.sides[att.side], dside = this.sides[def.side];
      let bonus = 0, red = 1;
      if (!ranged) bonus += [0, 0.1, 0.2, 0.3][side.skills.offense || 0]; else bonus += [0, 0.1, 0.25, 0.5][side.skills.archery || 0];
      if (!ranged && att.c.abilities.jousting) bonus += 0.05 * att.movedHexes;
      let luck = 0;
      if (opts.luckRoll !== false && !opts.retaliation) {
        const l = this.luck(att);
        if (l > 0 && this.rng.chance(l / 24)) { bonus += 1; luck = 1; }
        else if (l < 0 && this.rng.chance(-l / 24)) { red *= 0.5; luck = -1; }
      }
      red *= 1 - [0, 0.05, 0.1, 0.15][dside.skills.armorer || 0];
      if (!ranged && def.effects.shield) red *= 1 - def.effects.shield.val / 100;
      if (ranged && def.effects.airshield) red *= 1 - def.effects.airshield.val / 100;
      if (ranged) {
        if (Hex.dist(att.x, att.y, def.x, def.y) > 10) red *= 0.5;
        if (this.siege && this.behindWall(def) && !this.behindWall(att)) red *= 0.5;
      } else if (att.c.abilities.shooter && !att.c.abilities.noMeleePenalty) red *= 0.5;
      if (att.c.abilities.deathBlow && !opts.retaliation && this.rng.chance(att.c.abilities.deathBlow / 100)) { bonus += 1; opts.deathBlow = true; }
      let dmg = Math.floor(base * mult * (1 + bonus) * red);
      return { dmg: Math.max(1, dmg), luck, deathBlow: !!opts.deathBlow };
    }
    /* Прилага щети: връща {kills, dmg} */
    applyDamage(s, dmg) {
      const total = (s.count - 1) * s.maxHp + s.hp;
      const left = total - dmg;
      let kills;
      if (left <= 0) { kills = s.count; s.count = 0; s.hp = 0; s.alive = false; this.pushEv({ type: 'death', stack: s.id }); }
      else { const nc = Math.ceil(left / s.maxHp); kills = s.count - nc; s.count = nc; s.hp = left - (nc - 1) * s.maxHp; }
      s.killed += kills;
      s.ref.n = s.count;
      const es = this.sides[1 - s.side];
      es.kills = (es.kills || 0) + kills; es.hpKilled = (es.hpKilled || 0) + Math.min(dmg, total);
      if (!s.alive) { this.stacks.forEach((o) => { if (o.boundBy === s) { o.boundBy = null; delete o.effects.bound; } }); }
      return { kills, dmg: Math.min(dmg, total) };
    }
    heal(s, amount, resurrect) {
      if (!s.alive && !resurrect) return 0;
      const orig = s.ref.n0 ?? s.origCount;
      const maxCount = s.origCount;
      const total = (s.count - 1) * s.maxHp + s.hp;
      let nt = Math.min(maxCount * s.maxHp, Math.max(0, total) + amount);
      if (!resurrect) nt = Math.min(nt, s.count * s.maxHp); // само лечение на живите
      const nc = Math.max(0, Math.ceil(nt / s.maxHp));
      const healed = nt - Math.max(0, total);
      if (nc > 0) { s.alive = true; s.count = nc; s.hp = nt - (nc - 1) * s.maxHp; s.ref.n = nc; }
      return healed;
    }

    // ------------------------------------------------------------ действия
    logLine(t) { this.log.push(t); this.pushEv({ type: 'log', text: t }); }
    doMove(s, x, y) {
      const reach = this.reach(s);
      const r = reach.get(Hex.idx(x, y));
      if (!r || this.stackAt(x, y)) return false;
      const path = s.c.abilities.flying ? [[s.x, s.y], [x, y]] : this.pathTo(reach, x, y);
      s.movedHexes = r.d;
      this.pushEv({ type: 'move', stack: s.id, path, fly: !!s.c.abilities.flying });
      s.x = x; s.y = y;
      // ако е бил вързан — вече не
      return true;
    }
    /* Единичен удар (без ответ). Връща {dmg,kills,luck} */
    strike(att, def, opts) {
      const r = this.calcDamage(att, def, opts);
      const a = this.applyDamage(def, r.dmg);
      this.pushEv({ type: 'hit', from: att.id, to: def.id, dmg: a.dmg, kills: a.kills, luck: r.luck, ranged: !!opts.ranged, retaliation: !!opts.retaliation, deathBlow: r.deathBlow });
      this.logLine((opts.retaliation ? 'Ответен удар: ' : opts.ranged ? 'Изстрел: ' : '') + att.c.name + ' → ' + def.c.name + ': ' + a.dmg + ' щети' + (a.kills ? ', убити ' + a.kills : '') + (r.luck > 0 ? ' (късмет!)' : r.luck < 0 ? ' (лош късмет)' : '') + (r.deathBlow ? ' (смъртоносен удар!)' : '') + '.');
      // Специални ефекти при удар
      if (!opts.ranged || att.c.abilities.shooter === undefined) {
        if (att.c.abilities.lifeDrain && a.dmg > 0) { const h = this.heal(att, a.dmg, true); if (h > 0) this.pushEv({ type: 'heal', stack: att.id, amount: h }); }
      }
      if (def.alive) {
        const ab = att.c.abilities;
        if (ab.curseHit && this.rng.chance(ab.curseHit / 100)) this.addEffect(def, 'curse', 0, 3);
        if (ab.blindHit && !opts.retaliation && !def.c.abilities.undead && this.rng.chance(ab.blindHit / 100)) this.addEffect(def, 'blind', 1, 2);
        if (ab.bindHit && !opts.ranged) { this.addEffect(def, 'bound', 1, Infinity); def.boundBy = att; }
        if (ab.ageHit && this.rng.chance(ab.ageHit / 100)) this.addEffect(def, 'weakness', 6, 3);
      }
      return a;
    }
    // Стек удря стек (с всички добавки: дъх, обкръжение, облак), после ответ
    meleeAttack(att, def) {
      const targets = [def];
      if (att.c.abilities.breath) { const b = Hex.behind(att.x, att.y, def.x, def.y); if (b) { const o = this.stackAt(b[0], b[1]); if (o && o !== att) targets.push(o); } }
      if (att.c.abilities.allAround) Hex.neighbors(att.x, att.y).forEach(([x, y]) => { const o = this.stackAt(x, y); if (o && o.side !== att.side && o !== def) targets.push(o); });
      targets.forEach((t) => { if (t.alive) this.strike(att, t, { ranged: false }); });
      if (def.effects.blind) delete def.effects.blind; // ударът събужда ослепения
      // Ответен удар
      if (def.alive && !att.c.abilities.noRetaliation && (def.retaliations > 0) && !def.effects.blind) {
        def.retaliations--;
        this.strike(def, att, { ranged: false, retaliation: true });
        if (def.effects.counterstrike && def.retaliations <= 0) { /* контраудар вече е вдигнал броя */ }
      }
    }
    doAttack(s, target, fromX, fromY) {
      if (!target.alive || target.side === s.side) return false;
      if (fromX !== undefined && (fromX !== s.x || fromY !== s.y)) { if (!this.doMove(s, fromX, fromY)) return false; }
      if (Hex.dist(s.x, s.y, target.x, target.y) !== 1) return false;
      s.actionKind = 'attack';
      this.meleeAttack(s, target);
      if (s.alive && target.alive && s.c.abilities.doubleAttack) this.meleeAttack(s, target);
      s.acted = true;
      return true;
    }
    doShoot(s, target) {
      if (!this.isShooter(s) || this.adjacentEnemy(s) || !target.alive || target.side === s.side) return false;
      s.actionKind = 'shoot';
      const volley = () => {
        s.shots--;
        this.strike(s, target, { ranged: true });
        if (s.c.abilities.deathCloud) Hex.neighbors(target.x, target.y).forEach(([x, y]) => { const o = this.stackAt(x, y); if (o && !o.c.abilities.undead && o.alive) this.strike(s, o, { ranged: true, luckRoll: false }); });
        if (target.effects.blind) delete target.effects.blind;
      };
      volley();
      if (s.c.abilities.doubleShot && target.alive && s.shots > 0) volley();
      s.acted = true;
      return true;
    }
    doWait(s) { if (s.waited) return false; s.waited = true; s.actionKind = 'wait'; this.waitQueue.push(s); this.pushEv({ type: 'wait', stack: s.id }); return true; }
    doDefend(s) { s.defended = true; s.acted = true; s.actionKind = 'defend'; this.pushEv({ type: 'defend', stack: s.id }); return true; }
    // Бягство: героят на страната напуска (губи армията); ако е чудовище — не може
    canRetreat(side) { const sd = this.sides[side]; return !!sd.hero && !(this.ctx.town && side === 1); }
    doRetreat(side) {
      if (!this.canRetreat(side)) return false;
      this.finished = true; this.winner = 1 - side; this.retreated = side;
      this.stacks.filter((s) => s.side === side && s.alive).forEach((s) => { s.alive = false; s.ref.n = 0; });
      this.pushEv({ type: 'retreat', side });
      return true;
    }

    // ------------------------------------------------------------ ефекти и магии
    addEffect(s, name, val, turns) {
      const cur = s.effects[name];
      if (cur && cur.stack) { cur.val += val; cur.turns = Math.max(cur.turns, turns); }
      else s.effects[name] = { val, turns };
      this.pushEv({ type: 'effect', stack: s.id, name, val });
    }
    schoolLevel(side, spell) {
      if (spell.school === 'all') { let m = 0; D.SCHOOLS.forEach((sc) => { m = Math.max(m, side.skills[sc] || 0); }); return m; }
      return side.skills[spell.school] || 0;
    }
    spellPower(side, spell) {
      const lvl = this.schoolLevel(side, spell);
      let dmg = spell.base * (1 + lvl) + spell.perPow * side.pow;
      dmg *= 1 + [0, 0.05, 0.1, 0.15][side.skills.sorcery || 0];
      side.arts.forEach((aid) => { if (aid) { const a = D.artById[aid]; if (a.bonus.spellDmg && a.bonus.school === spell.school) dmg *= 1 + a.bonus.spellDmg / 100; } });
      return Math.floor(dmg);
    }
    canCast(side) { const sd = this.sides[side]; return !!sd.hero && !this.casted[side] && sd.spells.length > 0; }
    spellCost(side, spell) {
      let c = spell.cost;
      // Пегасите оскъпяват магиите на врага
      const extra = this.alive(1 - side).reduce((m, s) => Math.max(m, s.c.abilities.manaCost || 0), 0);
      return c + extra;
    }
    /* Може ли магията да засегне стека (имунитети). Връща {ok, why} */
    affects(spell, s, casterSide) {
      const ab = s.c.abilities;
      if (ab.spellImmune && spell.level <= ab.spellImmune) return { ok: false, why: 'имунитет' };
      if (s.effects.antimagic && spell.level <= s.effects.antimagic.val) return { ok: false, why: 'антимагия' };
      if (spell.onlyUndead && !ab.undead) return { ok: false, why: 'само немъртви' };
      if (spell.onlyLiving && ab.undead) return { ok: false, why: 'немъртвите са неуязвими' };
      if (ab.undead && (spell.effect === 'blind' || spell.effect === 'mirth' || spell.effect === 'sorrow')) return { ok: false, why: 'немъртвите нямат ум' };
      return { ok: true };
    }
    resists(spell, s, casterSide) {
      if (s.side === casterSide) return false;
      let res = s.c.abilities.magicRes || 0;
      if (Hex.neighbors(s.x, s.y).some(([x, y]) => { const o = this.stackAt(x, y); return o && o.side === s.side && o.c.abilities.resAura; })) res = Math.max(res, 20);
      res += [0, 5, 10, 20][this.sides[s.side].skills.resistance || 0];
      return this.rng.chance(res / 100);
    }
    /* Целите на магия при избор на хекс (x,y). Връща списък от стекове или null ако целта е невалидна */
    spellTargets(side, spell, x, y) {
      const lvl = this.schoolLevel(this.sides[side], spell);
      const mass = spell.mass && lvl >= 3;
      const t = Hex.inb(x, y) ? this.stackAt(x, y) : null;
      switch (spell.kind) {
        case 'dmg': return t && t.side !== side ? [t] : null;
        case 'area': {
          if (!Hex.inb(x, y)) return null;
          const out = [];
          this.stacks.forEach((s) => { if (!s.alive) return; const d = Hex.dist(s.x, s.y, x, y); if (d <= spell.radius && !(spell.ring && d === 0)) out.push(s); });
          return out;
        }
        case 'all': return this.stacks.filter((s) => s.alive && (spell.both || s.side !== side));
        case 'chain': return t && t.side !== side ? [t] : null;
        case 'buff': if (mass) return this.alive(side); return t && t.side === side ? [t] : null;
        case 'debuff': if (mass) return this.alive(1 - side); return t && t.side !== side ? [t] : null;
        case 'heal': if (mass) return this.alive(side); return t && t.side === side ? [t] : null;
        case 'res': { // и мъртви стекове на своя хекс
          const dead = this.stacks.find((s) => !s.alive && s.side === side && s.x === x && s.y === y && s.count === 0);
          const tt = t && t.side === side ? t : dead;
          return tt ? [tt] : null;
        }
        case 'special': if (spell.effect === 'dispel') { if (lvl >= 3) return this.stacks.filter((s) => s.alive); if (t && (t.side === side || lvl >= 2)) return [t]; return null; } return null;
      }
      return null;
    }
    needsTarget(side, spell) {
      const lvl = this.schoolLevel(this.sides[side], spell);
      if (spell.kind === 'all') return false;
      if ((spell.kind === 'buff' || spell.kind === 'debuff' || spell.kind === 'heal') && spell.mass && lvl >= 3) return false;
      if (spell.kind === 'special' && lvl >= 3) return false;
      return true;
    }
    doCast(side, spellId, x, y) {
      const sd = this.sides[side];
      const spell = D.spellById[spellId];
      if (!this.canCast(side) || !sd.spells.includes(spellId)) return { ok: false, why: 'Не може да се направи магия сега.' };
      const cost = this.spellCost(side, spell);
      if (sd.mana < cost) return { ok: false, why: 'Недостатъчно мана.' };
      const targets = this.spellTargets(side, spell, x, y);
      if (!targets || !targets.length) return { ok: false, why: 'Невалидна цел.' };
      const lvl = this.schoolLevel(sd, spell);
      sd.mana -= cost; this.casted[side] = true;
      if (sd.hero) sd.hero.mana = sd.mana;
      const dur = Math.max(1, sd.pow);
      this.pushEv({ type: 'cast', side, spell: spellId, x, y });
      this.logLine((sd.hero ? sd.hero.name : 'Героят') + ' прави магия „' + spell.name + '“.');
      const affectedList = [];
      const hitDmg = (t, dmg) => {
        const a = this.affects(spell, t, side);
        if (!a.ok) { this.pushEv({ type: 'immune', stack: t.id, why: a.why }); return; }
        if (this.resists(spell, t, side)) { this.pushEv({ type: 'resist', stack: t.id }); this.logLine(t.c.name + ' устоява на магията.'); return; }
        const r = this.applyDamage(t, dmg);
        this.pushEv({ type: 'spellHit', stack: t.id, dmg: r.dmg, kills: r.kills });
        this.logLine('„' + spell.name + '“ → ' + t.c.name + ': ' + r.dmg + ' щети' + (r.kills ? ', убити ' + r.kills : '') + '.');
        affectedList.push(t);
      };
      switch (spell.kind) {
        case 'dmg': case 'area': case 'all': {
          const dmg = this.spellPower(sd, spell);
          targets.forEach((t) => hitDmg(t, dmg));
          break;
        }
        case 'chain': {
          let dmg = this.spellPower(sd, spell);
          let cur = targets[0]; const hit = new Set();
          for (let k = 0; k < spell.hits[Math.max(0, lvl - 1)] && cur; k++) {
            hitDmg(cur, dmg); hit.add(cur.id); dmg = Math.floor(dmg / 2);
            let next = null, bd = Infinity;
            this.stacks.forEach((s) => { if (s.alive && !hit.has(s.id)) { const d = Hex.dist(s.x, s.y, cur.x, cur.y); if (d < bd) { bd = d; next = s; } } });
            cur = next;
          }
          break;
        }
        case 'buff': case 'debuff': {
          const val = spell.val[Math.max(0, lvl - 1)];
          targets.forEach((t) => {
            const a = this.affects(spell, t, side); if (!a.ok) { this.pushEv({ type: 'immune', stack: t.id, why: a.why }); return; }
            if (spell.kind === 'debuff' && this.resists(spell, t, side)) { this.pushEv({ type: 'resist', stack: t.id }); return; }
            if (spell.effect === 'counterstrike') { t.retaliations += val; }
            const e = { val, turns: spell.permanent ? Infinity : spell.effect === 'blind' ? 3 : dur, stack: !!spell.stack };
            if (spell.stack && t.effects[spell.effect]) t.effects[spell.effect].val += val; else t.effects[spell.effect] = e;
            // противоположните ефекти се изключват
            const opp = { haste: 'slow', slow: 'haste', bless: 'curse', curse: 'bless', bloodlust: 'weakness', weakness: 'bloodlust', fortune: 'misfortune', misfortune: 'fortune', mirth: 'sorrow', sorrow: 'mirth' }[spell.effect];
            if (opp) delete t.effects[opp];
            this.pushEv({ type: 'effect', stack: t.id, name: spell.effect, val });
            affectedList.push(t);
          });
          break;
        }
        case 'heal': {
          const amount = this.spellPower(sd, spell);
          targets.forEach((t) => { if (t.c.abilities.undead) return; const h = this.heal(t, amount, false); if (spell.dispelNeg) ['slow', 'curse', 'weakness', 'misfortune', 'sorrow', 'blind', 'disrupt'].forEach((k) => delete t.effects[k]); this.pushEv({ type: 'heal', stack: t.id, amount: h }); affectedList.push(t); });
          break;
        }
        case 'res': {
          const amount = this.spellPower(sd, spell);
          targets.forEach((t) => { const a = this.affects(spell, t, side); if (!a.ok) { this.pushEv({ type: 'immune', stack: t.id, why: a.why }); return; } const h = this.heal(t, amount, true); this.pushEv({ type: 'heal', stack: t.id, amount: h, resurrect: true }); this.logLine(t.c.name + ': възстановени ' + h + ' точки живот.'); affectedList.push(t); });
          break;
        }
        case 'special': {
          targets.forEach((t) => { for (const k in t.effects) if (k !== 'bound') delete t.effects[k]; this.pushEv({ type: 'dispel', stack: t.id }); affectedList.push(t); });
          break;
        }
      }
      this.checkEnd();
      return { ok: true, targets: affectedList };
    }

    // ------------------------------------------------------------ край
    checkEnd() {
      if (this.finished) return;
      const a0 = this.alive(0).length, a1 = this.alive(1).length;
      if (a0 && a1) return;
      this.finished = true;
      this.winner = a0 ? 0 : 1;
      this.pushEv({ type: 'end', winner: this.winner });
    }
    /* Резултат за света */
    result() {
      const s0 = this.sides[0], s1 = this.sides[1];
      return {
        winner: this.winner === 0 ? 'att' : 'def', retreated: this.retreated === 0,
        attKills: s0.kills || 0, attHpKilled: s0.hpKilled || 0, defKills: s1.kills || 0, defHpKilled: s1.hpKilled || 0,
        rounds: this.round
      };
    }

    // ------------------------------------------------------------ боен ИИ
    valueOf(s) { return D.fightValue(s.c); }
    /* Оценка на удар: очаквани убити × стойност − очакван ответен удар */
    evalAttack(s, opt) {
      const t = opt.target;
      const A = this.attack(s, opt.ranged), Dd = this.defense(t);
      const mult = A >= Dd ? Math.min(4, 1 + 0.05 * (A - Dd)) : Math.max(0.3, 1 - 0.025 * (Dd - A));
      let dmg = D.avgDmg(s.c) * s.count * mult;
      if (opt.ranged && Hex.dist(s.x, s.y, t.x, t.y) > 10) dmg *= 0.5;
      if (!opt.ranged && s.c.abilities.shooter && !s.c.abilities.noMeleePenalty) dmg *= 0.5;
      if (s.c.abilities.doubleAttack || (opt.ranged && s.c.abilities.doubleShot)) dmg *= 1.8;
      const total = (t.count - 1) * t.maxHp + t.hp;
      const kills = Math.min(t.count, dmg / t.maxHp);
      let score = Math.min(dmg, total) / t.maxHp * this.valueOf(t) * (kills >= t.count ? 1.3 : 1);
      if (t.c.abilities.shooter) score *= 1.2;
      if (!opt.ranged && t.alive && !s.c.abilities.noRetaliation && t.retaliations > 0 && kills < t.count) {
        const A2 = this.attack(t, false), D2 = this.defense(s);
        const m2 = A2 >= D2 ? Math.min(4, 1 + 0.05 * (A2 - D2)) : Math.max(0.3, 1 - 0.025 * (D2 - A2));
        const back = D.avgDmg(t.c) * (t.count - kills) * m2;
        score -= back / s.maxHp * this.valueOf(s) * 0.8;
      }
      return score;
    }
    aiSpell(side) {
      if (!this.canCast(side)) return false;
      const sd = this.sides[side];
      if (sd.mana <= 0) return false;
      let best = null, bs = 0;
      const enemies = this.alive(1 - side), own = this.alive(side);
      sd.spells.forEach((sid) => {
        const sp = D.spellById[sid];
        if (this.spellCost(side, sp) > sd.mana) return;
        if (sp.kind === 'dmg' || sp.kind === 'chain') {
          const dmg = this.spellPower(sd, sp);
          enemies.forEach((e) => { if (!this.affects(sp, e, side).ok) return; const total = (e.count - 1) * e.maxHp + e.hp; const sc = Math.min(dmg, total) / e.maxHp * this.valueOf(e) * (sp.kind === 'chain' ? 1.4 : 1); if (sc > bs) { bs = sc; best = { sp, x: e.x, y: e.y }; } });
        } else if (sp.kind === 'area') {
          const dmg = this.spellPower(sd, sp);
          enemies.forEach((e) => { let sc = 0; this.spellTargets(side, sp, e.x, e.y).forEach((t) => { if (!this.affects(sp, t, side).ok) return; const total = (t.count - 1) * t.maxHp + t.hp; sc += Math.min(dmg, total) / t.maxHp * this.valueOf(t) * (t.side === side ? -1.2 : 1); }); if (sc > bs) { bs = sc; best = { sp, x: e.x, y: e.y }; } });
        } else if (sp.kind === 'all') {
          const dmg = this.spellPower(sd, sp); let sc = 0;
          this.spellTargets(side, sp, 0, 0).forEach((t) => { if (!this.affects(sp, t, side).ok) return; const total = (t.count - 1) * t.maxHp + t.hp; sc += Math.min(dmg, total) / t.maxHp * this.valueOf(t) * (t.side === side ? -1.2 : 1); });
          if (sc > bs) { bs = sc; best = { sp, x: 0, y: 0 }; }
        } else if (sp.kind === 'debuff' && (sp.effect === 'slow' || sp.effect === 'blind' || sp.effect === 'curse' || sp.effect === 'weakness')) {
          const t = enemies.slice().sort((a, b) => this.valueOf(b) * b.count - this.valueOf(a) * a.count)[0];
          if (t && !t.effects[sp.effect] && this.affects(sp, t, side).ok) { const sc = this.valueOf(t) * t.count * 0.25 * (sp.effect === 'blind' ? 1.6 : 1); if (sc > bs) { bs = sc; best = { sp, x: t.x, y: t.y }; } }
        } else if (sp.kind === 'buff' && (sp.effect === 'haste' || sp.effect === 'bless' || sp.effect === 'stoneskin' || sp.effect === 'shield' || sp.effect === 'prayer' || sp.effect === 'bloodlust')) {
          const t = own.slice().sort((a, b) => this.valueOf(b) * b.count - this.valueOf(a) * a.count)[0];
          if (t && !t.effects[sp.effect]) { const sc = this.valueOf(t) * t.count * 0.2; if (sc > bs) { bs = sc; best = { sp, x: t.x, y: t.y }; } }
        } else if (sp.kind === 'res' || sp.kind === 'heal') {
          own.forEach((t) => { if (!this.affects(sp, t, side).ok) return; const missing = t.origCount * t.maxHp - ((t.count - 1) * t.maxHp + t.hp); const amount = Math.min(missing, this.spellPower(sd, sp)); const sc = amount / t.maxHp * this.valueOf(t) * 1.1; if (sc > bs) { bs = sc; best = { sp, x: t.x, y: t.y }; } });
        }
      });
      // прагът: да си струва маната
      if (best && bs > 25) { const r = this.doCast(side, best.sp.id, best.x, best.y); return r.ok; }
      return false;
    }
    /* Ход на ИИ за текущия стек */
    aiAct(s) {
      const side = s.side;
      this.aiSpell(side);
      if (this.finished || !s.alive) return;
      const reach = this.reach(s);
      const opts = this.attackOptions(s, reach);
      let best = null, bs = -Infinity;
      opts.forEach((o) => { const sc = this.evalAttack(s, o); if (sc > bs) { bs = sc; best = o; } });
      if (best && (bs > 0 || opts.every((o) => !o.ranged))) {
        if (best.ranged) { this.doShoot(s, best.target); return; }
        this.doAttack(s, best.target, best.from.x, best.from.y); return;
      }
      // Стрелец без изстрели или обкръжен → удря
      const enemies = this.alive(1 - side);
      if (!enemies.length) { this.doDefend(s); return; }
      // Близък бой: няма достижим враг. Ако враговете могат да ни стигнат — чакаме (веднъж), иначе приближаваме.
      const nearest = enemies.slice().sort((a, b) => Hex.dist(s.x, s.y, a.x, a.y) - Hex.dist(s.x, s.y, b.x, b.y))[0];
      const enemyCanReach = enemies.some((e) => Hex.dist(e.x, e.y, s.x, s.y) <= this.speed(e) + 1 && !e.c.abilities.shooter);
      if (!s.waited && enemyCanReach && !s.c.abilities.shooter && this.rng.chance(0.6)) { this.doWait(s); return; }
      if (s.c.abilities.shooter && !this.isShooter(s) && !enemyCanReach) { /* без стрели: върви */ }
      let bestHex = null, bd = Hex.dist(s.x, s.y, nearest.x, nearest.y);
      reach.forEach((r) => { const d = Hex.dist(r.x, r.y, nearest.x, nearest.y); if (d < bd || (d === bd && bestHex && r.d < bestHex.d)) { bd = d; bestHex = r; } });
      if (bestHex && (bestHex.x !== s.x || bestHex.y !== s.y)) { this.doMove(s, bestHex.x, bestHex.y); s.acted = true; s.actionKind = 'move'; return; }
      this.doDefend(s);
    }
    /* Цялата битка автоматично (ИИ срещу ИИ или автобитка) */
    runAuto(maxRounds) {
      maxRounds = maxRounds || 60;
      while (!this.finished) {
        const s = this.nextTurn();
        if (!s) break;
        this.aiAct(s);
        this.afterAction(s);
        if (this.round > maxRounds) { this.finished = true; this.winner = 1; break; }
      }
      return this.result();
    }
  }
  // Запомняме първоначалния брой за възкресение
  const origPlace = Battle.prototype.placeStacks;
  Battle.prototype.placeStacks = function () { origPlace.call(this); this.stacks.forEach((s) => { s.origCount = s.count; }); };
  MK.Battle = Battle;
})();
