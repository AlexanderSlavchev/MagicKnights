/* Битка: хексово поле 15×11, ред по скорост, чакане/защита, ответен удар,
   стрелба с наказания, класическата формула за щети, морал и късмет, магии,
   специални способности, двухексови същества, тактика, обсада с ров, стени,
   порта, катапулт и кули, предаване, боен ИИ. */
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
    fromCube(q, r) { const y = r, x = q + ((y - (y & 1)) >> 1); return [x, y]; },
    dist(x1, y1, x2, y2) { const a = Hex.toCube(x1, y1), b = Hex.toCube(x2, y2); return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])); },
    behind(ax, ay, tx, ty) {
      const a = Hex.toCube(ax, ay), t = Hex.toCube(tx, ty);
      const d = [t[0] - a[0], t[1] - a[1], t[2] - a[2]];
      const [x, y] = Hex.fromCube(t[0] + d[0], t[1] + d[1]);
      return Hex.inb(x, y) ? [x, y] : null;
    }
  };
  MK.Hex = Hex;

  const START_ROWS = { 1: [5], 2: [3, 7], 3: [2, 5, 8], 4: [1, 4, 6, 9], 5: [0, 3, 5, 7, 10], 6: [0, 2, 4, 6, 8, 10], 7: [0, 2, 4, 5, 6, 8, 10] };
  const GATE = Hex.idx(10, 5);
  const NO_MORALE = new Set(['academy2', 'academy2u', 'academy3', 'academy3u', 'workshop4', 'workshop4u', 'elements2', 'elements2u', 'elements3', 'elements3u', 'elements4', 'elements4u', 'elements5', 'elements5u', 'elements6', 'elements6u', 'n_golem']);

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
      this.obstacles = new Set();   // естествени препятствия
      this.walls = new Set();       // стени (без портата)
      this.wallHp = {};             // idx -> hp (стени и порта)
      this.rubble = new Set();      // разбити стени
      this.moat = new Set();
      this.towers = [];
      this.siege = ctx.town && this.world ? this.world.fortLevel(ctx.town) : 0;
      this.placeObstacles();
      this.placeStacks();
      this.stacks.forEach((s) => { s.origCount = s.count; });
      this.casted = [false, false];
      this.queue = [];
      this.waitQueue = [];
      this.current = null;
      this.events = [];
      // Тактика: страната с по-висока тактика подрежда ръчно (в интерфейса)
      const t0 = this.sides[0].tactics, t1 = this.sides[1].tactics;
      this.tacticsSide = t0 > t1 ? 0 : t1 > t0 && !this.siege ? 1 : -1;
      this.tacticsLevel = Math.abs(t0 - t1);
    }
    makeSide(s, i) {
      const w = this.world;
      const h = s.hero;
      const side = { i, hero: h, owner: s.owner, army: s.army, garrison: s.garrison, obj: s.obj, mana: h ? h.mana : 0, ai: false };
      side.att = h ? w.stat(h, 'att') : 0;
      side.def = h ? w.stat(h, 'def') : 0;
      side.pow = h ? w.stat(h, 'pow') : 0;
      side.know = h ? w.stat(h, 'know') : 0;
      side.skills = {};
      if (h) Object.keys(D.SKILLS).forEach((k) => { const l = w.skillLevel(h, k); if (l) side.skills[k] = l; });
      side.skillMult = (k) => (h ? w.skillMult(h, k) : 1);
      side.spells = h ? w.heroSpells(h) : [];
      side.morale = h ? w.heroMorale(h) : 0;
      side.luck = h ? w.heroLuck(h) : 0;
      side.arts = h ? h.arts : [];
      side.sets = h ? w.heroSets(h) : [];
      side.spec = h ? h.spec : null;
      side.level = h ? h.level : 0;
      side.hpBonus = h ? w.artBonus(h, 'hpBonus') : 0;
      const fs = MK.Army.factions(s.army); if (s.garrison) MK.Army.factions(s.garrison).forEach((f) => fs.add(f));
      fs.delete('neutral');
      side.factionMorale = fs.size <= 1 ? (fs.size === 1 ? 1 : 0) : fs.size === 2 ? 0 : -(fs.size - 2);
      side.hasUndead = [...fs].includes('necropolis');
      if (this.ctx.town && i === 1 && this.ctx.town.buildings.tavern) side.morale += 1;
      side.tactics = side.skills.tactics || 0;
      return side;
    }
    hasSet(side, id) { return this.sides[side].sets.some((s) => s === D.ART_SETS[id]); }
    placeObstacles() {
      const n = this.rng.int(3, 7) + (this.terrain === 5 || this.terrain === 8 ? 2 : 0) - (this.terrain === 3 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const x = this.rng.int(3, W - 4), y = this.rng.int(0, H - 1);
        if (this.siege && x >= 8) continue;
        this.obstacles.add(Hex.idx(x, y));
        if (this.rng.chance(0.5)) { const nb = this.rng.pick(Hex.neighbors(x, y)); if (nb[0] >= 3 && nb[0] <= W - 4 && !(this.siege && nb[0] >= 8)) this.obstacles.add(Hex.idx(nb[0], nb[1])); }
      }
      if (this.siege) {
        const hp = this.siege; // здравина на сегмент
        for (let y = 0; y < H; y++) {
          const i = Hex.idx(10, y);
          if (i === GATE) { this.wallHp[i] = hp + 1; continue; }
          this.walls.add(i); this.wallHp[i] = hp;
          if (this.siege >= 2) this.moat.add(Hex.idx(9, y));
        }
        if (this.siege >= 2) this.towers.push({ x: 13, y: 5, dmg: 15 });
        if (this.siege >= 3) { this.towers.push({ x: 12, y: 0, dmg: 10 }); this.towers.push({ x: 12, y: 10, dmg: 10 }); }
      }
    }
    // Проходимост на хекс за страна (стени, порта, естествени препятствия)
    blocked(i, side) {
      if (this.obstacles.has(i)) return true;
      if (this.walls.has(i)) return true;
      if (i === GATE && this.siege && this.wallHp[GATE] > 0 && side === 0) return true;
      return false;
    }
    isGateIntact() { return this.siege && this.wallHp[GATE] > 0; }
    // ---------------------------------------------------------------- хексове на стек
    tailX(s, x) { return x + (s.side === 0 ? -1 : 1); }
    hexesAt(s, x, y) { return s.wide ? [[x, y], [this.tailX(s, x), y]] : [[x, y]]; }
    hexes(s) { return this.hexesAt(s, s.x, s.y); }
    occupant(x, y) { for (const s of this.stacks) { if (!s.alive) continue; if (s.x === x && s.y === y) return s; if (s.wide && s.y === y && this.tailX(s, s.x) === x) return s; } return null; }
    stackAt(x, y) { return this.occupant(x, y); }
    canStand(s, x, y) {
      for (const [hx, hy] of this.hexesAt(s, x, y)) {
        if (!Hex.inb(hx, hy) || this.blocked(Hex.idx(hx, hy), s.side)) return false;
        const o = this.occupant(hx, hy); if (o && o !== s) return false;
      }
      return true;
    }
    adjacent(a, b) { for (const [ax, ay] of this.hexes(a)) for (const [bx, by] of this.hexes(b)) if (Hex.dist(ax, ay, bx, by) === 1) return true; return false; }
    adjacentAt(a, x, y, b) { for (const [ax, ay] of this.hexesAt(a, x, y)) for (const [bx, by] of this.hexes(b)) if (Hex.dist(ax, ay, bx, by) === 1) return true; return false; }
    distBetween(a, b) { let m = Infinity; for (const [ax, ay] of this.hexes(a)) for (const [bx, by] of this.hexes(b)) m = Math.min(m, Hex.dist(ax, ay, bx, by)); return m; }
    distToHex(s, x, y) { let m = Infinity; for (const [ax, ay] of this.hexes(s)) m = Math.min(m, Hex.dist(ax, ay, x, y)); return m; }
    inMoat(s) { return this.moat.size > 0 && this.hexes(s).some(([x, y]) => this.moat.has(Hex.idx(x, y))); }

    addStack(side, slot, sl, x, y, fromGarrison) {
      const c = D.creatureOf(sl.c);
      const s = {
        id: this.stacks.length, side, slot, fromGarrison: !!fromGarrison, ref: sl, c, wide: !!c.wide, count: sl.n, hp: c.hp + this.sides[side].hpBonus, maxHp: c.hp + this.sides[side].hpBonus,
        x, y, shots: c.shots, effects: {}, retaliations: 0, waited: false, defended: false, acted: false, alive: true, killed: 0, movedHexes: 0, boundBy: null, reborn: false
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
        if (si === 1 && this.siege) col = W - 2;
        slots.forEach((sd, k) => {
          const c = D.creatureOf(sd.sl.c);
          let x = col + (c.wide ? (si === 0 ? 1 : -1) : 0), y = rows[k] ?? k;
          const probe = { side: si, wide: !!c.wide, alive: false };
          let guard = 0;
          while (!this.canStand(probe, x, y) && guard++ < 20) { x += si === 0 ? 1 : -1; if (x < 0 || x >= W) { x = col; y = (y + 1) % H; } }
          this.addStack(si, sd.i, sd.sl, x, y, sd.g);
        });
      });
      // Автоматична тактика за ИИ (човекът подрежда ръчно)
      [0, 1].forEach((si) => {
        const side = this.sides[si]; const other = this.sides[1 - si];
        const t = side.tactics - other.tactics;
        if (t <= 0 || (si === 1 && this.siege)) return;
        this.alive(si).forEach((s) => { for (let k = 0; k < t; k++) { const nx = s.x + (si === 0 ? 1 : -1); if (this.canStand(s, nx, s.y)) s.x = nx; } });
      });
    }
    // Ръчна тактика: колони, в които страната може да подрежда
    tacticsAllowed(side, x) { const t = this.tacticsLevel; return side === 0 ? x <= 1 + 2 * t : x >= W - 2 - 2 * t; }
    placeStack(s, x, y) { if (!this.tacticsAllowed(s.side, x) || !this.canStand(s, x, y)) return false; s.x = x; s.y = y; return true; }
    alive(side) { return this.stacks.filter((s) => s.alive && s.side === side); }
    pushEv(e) { this.events.push(e); }

    // ------------------------------------------------------------ характеристики
    eff(s, name) { const e = s.effects[name]; return e ? e.val : 0; }
    isNative(s) { const f = D.factionById(s.c.faction); return f && f.terrain === this.terrain; }
    specBonus(s) { const sp = this.sides[s.side].spec; if (!sp || sp.kind !== 'creature') return 0; const c = D.creatureOf(sp.id); return c.faction === s.c.faction && c.tier === s.c.tier ? Math.floor(this.sides[s.side].level / 3) : 0; }
    isSpecCreature(s) { const sp = this.sides[s.side].spec; return sp && sp.kind === 'creature' && D.creatureOf(sp.id).faction === s.c.faction && D.creatureOf(sp.id).tier === s.c.tier; }
    speed(s) {
      let v = s.c.spd + this.eff(s, 'haste') + this.eff(s, 'prayer');
      if (s.effects.slow) v = Math.floor(v * (1 - s.effects.slow.val / 100));
      if (this.isNative(s)) v += 1;
      if (this.isSpecCreature(s)) v += 1;
      if (this.hasSet(s.side, 'wolf')) v += 2;
      return Math.max(1, v);
    }
    attack(s, ranged) {
      const side = this.sides[s.side];
      let a = s.c.att + side.att + this.eff(s, 'prayer') - this.eff(s, 'weakness') + this.specBonus(s);
      if (!ranged) a += this.eff(s, 'bloodlust'); else a += this.eff(s, 'precision');
      if (this.isNative(s)) a += 1;
      return Math.max(0, a);
    }
    defense(s) {
      const side = this.sides[s.side];
      let d = s.c.def + side.def + this.eff(s, 'stoneskin') + this.eff(s, 'prayer') - this.eff(s, 'disrupt') + this.specBonus(s);
      if (s.defended) d += Math.ceil(s.c.def * 0.2);
      if (this.isNative(s)) d += 1;
      if (this.inMoat(s)) d -= 3;
      return Math.max(0, d);
    }
    morale(s) {
      if (s.c.abilities.undead || NO_MORALE.has(s.c.id)) return 0;
      const side = this.sides[s.side];
      let m = side.morale + side.factionMorale + this.eff(s, 'mirth') - this.eff(s, 'sorrow');
      if (side.hasUndead && !s.c.abilities.undead) m -= 1;
      if (this.alive(s.side).some((o) => o.c.abilities.moraleAura && o !== s)) m += 1;
      if (this.alive(1 - s.side).some((o) => o.c.abilities.fearAura)) m -= 1;
      if (s.c.abilities.goodMorale) m = Math.max(1, m);
      return Math.max(-3, Math.min(3, m));
    }
    luck(s) {
      const side = this.sides[s.side];
      let l = side.luck + this.eff(s, 'fortune') - this.eff(s, 'misfortune');
      if (this.alive(1 - s.side).some((o) => o.c.abilities.badLuckAura)) l -= 1;
      return Math.max(-3, Math.min(3, l));
    }
    isShooter(s) { return !!s.c.abilities.shooter && s.shots > 0; }
    adjacentEnemy(s) { return this.alive(1 - s.side).some((e) => this.adjacent(s, e)); }
    behindWall(s) { return this.siege && s.x > 10 && this.walls.size > 4; }

    // ------------------------------------------------------------ рундове и ред
    startRound() {
      this.round++;
      this.casted = [false, false];
      this.stacks.forEach((s) => {
        if (!s.alive) return;
        s.waited = false; s.defended = false; s.acted = false; s.movedHexes = 0;
        s.retaliations = s.c.abilities.retaliations || 1;
        for (const k in s.effects) { const e = s.effects[k]; if (e.turns !== Infinity && --e.turns <= 0) delete s.effects[k]; }
        if (s.c.abilities.regenerate) s.hp = s.maxHp;
      });
      // Катапултът на нападателя удря стена или порта
      if (this.siege && this.alive(0).length) {
        const intact = Object.keys(this.wallHp).map(Number).filter((i) => this.wallHp[i] > 0);
        if (intact.length) {
          const i = this.wallHp[GATE] > 0 && this.rng.chance(0.5) ? GATE : this.rng.pick(intact);
          if (this.wallHp[i] > 0) {
            this.wallHp[i] = Math.max(0, this.wallHp[i] - 2);
            const destroyed = this.wallHp[i] <= 0;
            if (destroyed) { this.walls.delete(i); this.rubble.add(i); }
            this.pushEv({ type: 'catapult', idx: i, destroyed, gate: i === GATE });
            this.logLine('Катапултът удря ' + (i === GATE ? 'портата' : 'стената') + (destroyed ? ' и я разбива!' : '.'));
          }
        }
      }
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
    nextTurn() {
      if (this.finished) return null;
      for (;;) {
        if (!this.queue.length && !this.waitQueue.length) { this.startRound(); if (this.finished) return null; continue; }
        let s;
        if (this.queue.length) s = this.queue.shift();
        else { this.waitQueue.sort((a, b) => this.speed(a) - this.speed(b)); s = this.waitQueue.shift(); }
        if (!s.alive) continue;
        if (s.effects.blind) { this.pushEv({ type: 'skip', stack: s.id, why: 'blind' }); continue; }
        if (s.effects.bound && s.boundBy && !(s.boundBy.alive && this.adjacent(s, s.boundBy))) { delete s.effects.bound; s.boundBy = null; }
        if (s.c.abilities.manaDrain) { const es = this.sides[1 - s.side]; if (es.hero && es.mana > 0) { es.mana = Math.max(0, es.mana - s.c.abilities.manaDrain); this.pushEv({ type: 'manaDrain', stack: s.id }); } }
        if (!s.waited) {
          const m = this.morale(s);
          if (m < 0 && this.rng.chance(-m / 24)) { s.acted = true; this.pushEv({ type: 'morale', stack: s.id, good: false }); this.logLine(s.c.name + ' се колебае от лош морал.'); continue; }
        }
        this.current = s;
        return s;
      }
    }
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
    /* Достижими позиции (глава): Map idx -> {x,y,d,prev} */
    reach(s) {
      const sp = this.speed(s);
      const out = new Map();
      const start = Hex.idx(s.x, s.y);
      out.set(start, { x: s.x, y: s.y, d: 0, prev: null });
      if (s.effects.bound) return out;
      if (s.c.abilities.flying) {
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const d = Hex.dist(s.x, s.y, x, y);
          if (d <= sp && d > 0 && this.canStand(s, x, y)) out.set(Hex.idx(x, y), { x, y, d, prev: null });
        }
        return out;
      }
      const q = [[s.x, s.y, 0]];
      const startMoat = this.inMoat(s);
      while (q.length) {
        const [x, y, d] = q.shift();
        if (d >= sp) continue;
        for (const [nx, ny] of Hex.neighbors(x, y)) {
          const i = Hex.idx(nx, ny);
          if (out.has(i) || !this.canStand(s, nx, ny)) continue;
          out.set(i, { x: nx, y: ny, d: d + 1, prev: Hex.idx(x, y) });
          // ровът спира движението
          const moat = this.moat.size && this.hexesAt(s, nx, ny).some(([hx, hy]) => this.moat.has(Hex.idx(hx, hy)));
          if (moat && !startMoat) continue;
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
    /* Възможни атаки: стрелба или удар от достижима позиция */
    attackOptions(s, reach) {
      reach = reach || this.reach(s);
      const opts = [];
      const enemies = this.alive(1 - s.side);
      if (this.isShooter(s) && !this.adjacentEnemy(s)) enemies.forEach((e) => opts.push({ target: e, ranged: true }));
      enemies.forEach((e) => {
        let best = null;
        reach.forEach((r) => { if (this.adjacentAt(s, r.x, r.y, e) && (!best || r.d < best.d)) best = r; });
        if (best) opts.push({ target: e, ranged: false, from: best });
      });
      return opts;
    }

    // ------------------------------------------------------------ щети
    baseDamage(att) {
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
    calcDamage(att, def, opts) {
      opts = opts || {};
      const ranged = !!opts.ranged;
      let A = this.attack(att, ranged) + (att.effects.slayer && def.c.tier === 7 ? att.effects.slayer.val : 0);
      if (!ranged && def.c.abilities.ignoreAtt) A = Math.floor(A * (1 - def.c.abilities.ignoreAtt / 100));
      let Dd = this.defense(def);
      if (att.c.abilities.ignoreDef) Dd = Math.floor(Dd * (1 - att.c.abilities.ignoreDef / 100));
      let mult;
      if (A >= Dd) mult = Math.min(4, 1 + 0.05 * (A - Dd)); else mult = Math.max(0.3, 1 - 0.025 * (Dd - A));
      const base = this.baseDamage(att);
      const side = this.sides[att.side], dside = this.sides[def.side];
      let bonus = 0, red = 1;
      if (!ranged) bonus += [0, 0.1, 0.2, 0.3][side.skills.offense || 0] * side.skillMult('offense'); else bonus += [0, 0.1, 0.25, 0.5][side.skills.archery || 0] * side.skillMult('archery');
      if (!ranged && att.c.abilities.jousting) bonus += 0.05 * att.movedHexes;
      if (att.c.abilities.thunderHit && this.rng.chance(att.c.abilities.thunderHit / 100)) { bonus += 0.25; opts.thunder = true; }
      let luck = 0;
      if (opts.luckRoll !== false && !opts.retaliation) {
        const l = this.luck(att);
        if (l > 0 && this.rng.chance(l / 24)) { bonus += 1; luck = 1; }
        else if (l < 0 && this.rng.chance(-l / 24)) { red *= 0.5; luck = -1; }
      }
      red *= 1 - [0, 0.05, 0.1, 0.15][dside.skills.armorer || 0] * dside.skillMult('armorer');
      if (!ranged && def.effects.shield) red *= 1 - def.effects.shield.val / 100;
      if (ranged && def.effects.airshield) red *= 1 - def.effects.airshield.val / 100;
      if (ranged) {
        if (this.distBetween(att, def) > 10) red *= 0.5;
        if (this.siege && this.behindWall(def) && !this.behindWall(att) && !att.c.abilities.noObstaclePenalty) red *= 0.5;
      } else if (att.c.abilities.shooter && !att.c.abilities.noMeleePenalty) red *= 0.5;
      if (att.c.abilities.deathBlow && !opts.retaliation && this.rng.chance(att.c.abilities.deathBlow / 100)) { bonus += 1; opts.deathBlow = true; }
      const dmg = Math.floor(base * mult * (1 + bonus) * red);
      return { dmg: Math.max(1, dmg), luck, deathBlow: !!opts.deathBlow };
    }
    applyDamage(s, dmg) {
      const total = (s.count - 1) * s.maxHp + s.hp;
      const left = total - dmg;
      let kills;
      if (left <= 0) { kills = s.count; s.count = 0; s.hp = 0; s.alive = false; this.onDeath(s); }
      else { const nc = Math.ceil(left / s.maxHp); kills = s.count - nc; s.count = nc; s.hp = left - (nc - 1) * s.maxHp; }
      s.killed += kills;
      s.ref.n = s.count;
      const es = this.sides[1 - s.side];
      // Опитът е като в класиките: пълният живот на всяко убито същество (ранените не носят опит)
      es.kills = (es.kills || 0) + kills; es.hpKilled = (es.hpKilled || 0) + kills * s.maxHp;
      return { kills, dmg: Math.min(dmg, total) };
    }
    onDeath(s) {
      this.pushEv({ type: 'death', stack: s.id });
      this.stacks.forEach((o) => { if (o.boundBy === s) { o.boundBy = null; delete o.effects.bound; } });
      if (s.c.abilities.rebirth && !s.reborn) {
        s.reborn = true;
        const n = Math.max(1, Math.floor(s.origCount * 0.2));
        s.alive = true; s.count = n; s.hp = s.maxHp; s.ref.n = n; s.effects = {};
        this.pushEv({ type: 'rebirth', stack: s.id, count: n });
        this.logLine(s.c.name + ' се преражда от пепелта: ' + n + '!');
      }
    }
    killCreatures(s, n) { if (n <= 0 || !s.alive) return 0; n = Math.min(n, s.count); const dmg = (n - 1) * s.maxHp + s.hp; return this.applyDamage(s, dmg).kills; }
    heal(s, amount, resurrect) {
      if (!s.alive && !resurrect) return 0;
      const maxCount = s.origCount;
      const total = (s.count - 1) * s.maxHp + s.hp;
      let nt = Math.min(maxCount * s.maxHp, Math.max(0, total) + amount);
      if (!resurrect) nt = Math.min(nt, s.count * s.maxHp);
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
      if (!r || !this.canStand(s, x, y)) return false;
      const path = s.c.abilities.flying ? [[s.x, s.y], [x, y]] : this.pathTo(reach, x, y);
      s.movedHexes = r.d;
      this.pushEv({ type: 'move', stack: s.id, path, fly: !!s.c.abilities.flying });
      s.x = x; s.y = y;
      return true;
    }
    strike(att, def, opts) {
      const r = this.calcDamage(att, def, opts);
      const a = this.applyDamage(def, r.dmg);
      this.pushEv({ type: 'hit', from: att.id, to: def.id, dmg: a.dmg, kills: a.kills, luck: r.luck, ranged: !!opts.ranged, retaliation: !!opts.retaliation, deathBlow: r.deathBlow });
      this.logLine((opts.retaliation ? 'Ответен удар: ' : opts.ranged ? 'Изстрел: ' : '') + att.c.name + ' → ' + def.c.name + ': ' + a.dmg + ' щети' + (a.kills ? ', убити ' + a.kills : '') + (r.luck > 0 ? ' (късмет!)' : r.luck < 0 ? ' (лош късмет)' : '') + (r.deathBlow ? ' (смъртоносен удар!)' : '') + '.');
      const ab = att.c.abilities;
      if (!opts.ranged && ab.lifeDrain && a.dmg > 0) { const h = this.heal(att, a.dmg, true); if (h > 0) this.pushEv({ type: 'heal', stack: att.id, amount: h }); }
      if (!opts.ranged && def.c.abilities.fireShield && att.alive && !att.c.abilities.fireImmune) { const back = Math.floor(a.dmg * def.c.abilities.fireShield / 100); if (back > 0) { const rb = this.applyDamage(att, back); this.pushEv({ type: 'hit', from: def.id, to: att.id, dmg: rb.dmg, kills: rb.kills, fire: true }); this.logLine('Огнен щит: ' + back + ' щети на ' + att.c.name + '.'); } }
      if (def.alive) {
        if (ab.curseHit && this.rng.chance(ab.curseHit / 100)) this.addEffect(def, 'curse', 0, 3);
        if (ab.blindHit && !opts.retaliation && !def.c.abilities.undead && !def.c.abilities.mindImmune && !def.c.abilities.blindImmune && this.rng.chance(ab.blindHit / 100)) this.addEffect(def, 'blind', 1, 2);
        if (ab.bindHit && !opts.ranged) { this.addEffect(def, 'bound', 1, Infinity); def.boundBy = att; }
        if (ab.ageHit && this.rng.chance(ab.ageHit / 100)) this.addEffect(def, 'weakness', 6, 3);
        if (ab.weakHit && !this.hasSet(def.side, 'dawn')) this.addEffect(def, 'weakness', 3, 3);
        if (ab.dispelHit) { ['haste', 'bless', 'shield', 'stoneskin', 'bloodlust', 'precision', 'fortune', 'mirth', 'prayer', 'airshield', 'slayer', 'counterstrike', 'antimagic'].forEach((k) => delete def.effects[k]); }
        if (ab.deathStare && !opts.retaliation && !opts.ranged && !def.c.abilities.undead && !def.c.abilities.mindImmune) {
          let n = 0; for (let i = 0; i < Math.min(att.count, 100); i++) if (this.rng.chance(ab.deathStare / 100)) n++;
          n = Math.min(n, Math.ceil(att.count / 10));
          if (n > 0) { const k = this.killCreatures(def, n); this.pushEv({ type: 'stare', stack: def.id, kills: k }); this.logLine('Смъртоносен поглед: ' + k + ' × ' + def.c.name + ' падат.'); }
        }
      }
      return a;
    }
    // Хексът зад целта по линията от нападателя (за дъх); за двухексови — отвъд цялото същество
    breathTarget(att, def) {
      let best = null, bd = Infinity;
      for (const [ax, ay] of this.hexes(att)) for (const [dx, dy] of this.hexes(def)) { const d = Hex.dist(ax, ay, dx, dy); if (d < bd) { bd = d; best = [ax, ay, dx, dy]; } }
      if (!best) return null;
      let b = Hex.behind(best[0], best[1], best[2], best[3]);
      if (b && this.occupant(b[0], b[1]) === def) b = Hex.behind(best[2], best[3], b[0], b[1]);
      if (!b) return null;
      const o = this.occupant(b[0], b[1]);
      return o && o !== att && o !== def ? o : null;
    }
    meleeAttack(att, def) {
      const targets = [def];
      if (att.c.abilities.breath) { const o = this.breathTarget(att, def); if (o) targets.push(o); }
      if (att.c.abilities.allAround) this.alive(1 - att.side).forEach((o) => { if (o !== def && this.adjacent(att, o)) targets.push(o); });
      targets.forEach((t) => { if (t.alive) this.strike(att, t, { ranged: false }); });
      if (def.effects.blind) delete def.effects.blind;
      if (def.alive && !att.c.abilities.noRetaliation && def.retaliations > 0 && !def.effects.blind) {
        def.retaliations--;
        this.strike(def, att, { ranged: false, retaliation: true });
      }
    }
    doAttack(s, target, fromX, fromY) {
      if (!target.alive || target.side === s.side) return false;
      if (fromX !== undefined && (fromX !== s.x || fromY !== s.y)) { if (!this.doMove(s, fromX, fromY)) return false; }
      if (!this.adjacent(s, target)) return false;
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
        if (s.c.abilities.deathCloud) { const seen = new Set([target.id]); this.hexes(target).forEach(([tx, ty]) => Hex.neighbors(tx, ty).forEach(([x, y]) => { const o = this.occupant(x, y); if (o && !seen.has(o.id) && !o.c.abilities.undead && o.alive && !o.c.abilities.fireImmune) { seen.add(o.id); this.strike(s, o, { ranged: true, luckRoll: false }); } })); }
        if (target.effects.blind) delete target.effects.blind;
      };
      volley();
      if (s.c.abilities.doubleShot && target.alive && s.shots > 0) volley();
      s.acted = true;
      return true;
    }
    doWait(s) { if (s.waited) return false; s.waited = true; s.actionKind = 'wait'; this.waitQueue.push(s); this.pushEv({ type: 'wait', stack: s.id }); return true; }
    doDefend(s) { s.defended = true; s.acted = true; s.actionKind = 'defend'; this.pushEv({ type: 'defend', stack: s.id }); return true; }
    canRetreat(side) { const sd = this.sides[side]; return !!sd.hero && !(this.ctx.town && side === 1); }
    doRetreat(side) {
      if (!this.canRetreat(side)) return false;
      this.finished = true; this.winner = 1 - side; this.retreated = side;
      this.stacks.filter((s) => s.side === side && s.alive).forEach((s) => { s.alive = false; s.ref.n = 0; });
      this.pushEv({ type: 'retreat', side });
      return true;
    }
    // Предаване: срещу злато армията се запазва; само пред герой
    canSurrender(side) { return this.canRetreat(side) && !!this.sides[1 - side].hero; }
    surrenderCost(side) {
      const sd = this.sides[side];
      let sum = 0; this.alive(side).forEach((s) => { sum += s.count * s.c.cost.gold; });
      return Math.floor(sum * 0.5 * (1 - [0, 0.2, 0.4, 0.6][sd.skills.diplomacy || 0]));
    }
    doSurrender(side) {
      if (!this.canSurrender(side)) return false;
      const cost = this.surrenderCost(side);
      const p = this.world.players[this.sides[side].owner];
      if (!p || p.res.gold < cost) return false;
      this.finished = true; this.winner = 1 - side; this.surrendered = side; this.surrenderCostVal = cost;
      this.pushEv({ type: 'surrender', side, cost });
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
      if (spell.school === 'air' && this.hasSet(side.i, 'storm')) return 3;
      if (spell.school === 'all') { let m = 0; D.SCHOOLS.forEach((sc) => { m = Math.max(m, side.skills[sc] || 0); }); return m; }
      return side.skills[spell.school] || 0;
    }
    specPow(side, spell) { return side.spec && side.spec.kind === 'spell' && side.spec.id === spell.id ? 3 : 0; }
    spellPower(side, spell) {
      const lvl = this.schoolLevel(side, spell);
      let dmg = spell.base * (1 + lvl) + spell.perPow * (side.pow + this.specPow(side, spell));
      dmg *= 1 + [0, 0.05, 0.1, 0.15][side.skills.sorcery || 0];
      side.arts.forEach((aid) => { if (aid) { const a = D.artById[aid]; if (a.bonus.spellDmg && a.bonus.school === spell.school) dmg *= 1 + a.bonus.spellDmg / 100; } });
      return Math.floor(dmg);
    }
    canCast(side) { const sd = this.sides[side]; return !!sd.hero && !this.casted[side] && sd.spells.length > 0; }
    spellCost(side, spell) {
      const extra = this.alive(1 - side).reduce((m, s) => Math.max(m, s.c.abilities.manaCost || 0), 0);
      return Math.max(1, spell.cost + extra - (this.specPow(this.sides[side], spell) ? 1 : 0));
    }
    affects(spell, s, casterSide) {
      const ab = s.c.abilities;
      if (ab.spellImmune && spell.level <= ab.spellImmune) return { ok: false, why: 'имунитет' };
      if (ab.fireImmune && spell.school === 'fire') return { ok: false, why: 'огнен имунитет' };
      if (s.effects.antimagic && spell.level <= s.effects.antimagic.val) return { ok: false, why: 'антимагия' };
      if (spell.onlyUndead && !ab.undead) return { ok: false, why: 'само немъртви' };
      if (spell.onlyLiving && ab.undead) return { ok: false, why: 'немъртвите са неуязвими' };
      if ((ab.undead || ab.mindImmune) && (spell.effect === 'blind' || spell.effect === 'mirth' || spell.effect === 'sorrow')) return { ok: false, why: 'няма ум за омагьосване' };
      if (ab.blindImmune && spell.effect === 'blind') return { ok: false, why: 'имунитет' };
      if ((spell.effect === 'curse' || spell.effect === 'weakness') && this.hasSet(s.side, 'dawn')) return { ok: false, why: 'Доспехите на зората' };
      return { ok: true };
    }
    resists(spell, s, casterSide) {
      if (s.side === casterSide) return false;
      let res = s.c.abilities.magicRes || 0;
      if (this.alive(s.side).some((o) => o !== s && o.c.abilities.resAura && this.adjacent(o, s))) res = Math.max(res, 20);
      res += [0, 5, 10, 20][this.sides[s.side].skills.resistance || 0];
      return this.rng.chance(res / 100);
    }
    spellTargets(side, spell, x, y) {
      const lvl = this.schoolLevel(this.sides[side], spell);
      const mass = spell.mass && lvl >= 3;
      const t = Hex.inb(x, y) ? this.occupant(x, y) : null;
      switch (spell.kind) {
        case 'dmg': return t && t.side !== side ? [t] : null;
        case 'area': {
          if (!Hex.inb(x, y)) return null;
          const out = [];
          this.stacks.forEach((s) => { if (!s.alive) return; const d = this.distToHex(s, x, y); if (d <= spell.radius && !(spell.ring && d === 0)) out.push(s); });
          return out;
        }
        case 'all': return this.stacks.filter((s) => s.alive && (spell.both || s.side !== side));
        case 'chain': return t && t.side !== side ? [t] : null;
        case 'buff': if (mass) return this.alive(side); return t && t.side === side ? [t] : null;
        case 'debuff': if (mass) return this.alive(1 - side); return t && t.side !== side ? [t] : null;
        case 'heal': if (mass) return this.alive(side); return t && t.side === side ? [t] : null;
        case 'res': {
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
      const dur = Math.max(1, sd.pow + this.specPow(sd, spell));
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
        case 'dmg': case 'area': case 'all': { const dmg = this.spellPower(sd, spell); targets.forEach((t) => hitDmg(t, dmg)); break; }
        case 'chain': {
          let dmg = this.spellPower(sd, spell);
          let cur = targets[0]; const hit = new Set();
          for (let k = 0; k < spell.hits[Math.max(0, lvl - 1)] && cur; k++) {
            hitDmg(cur, dmg); hit.add(cur.id); dmg = Math.floor(dmg / 2);
            let next = null, bd = Infinity;
            this.stacks.forEach((s) => { if (s.alive && !hit.has(s.id)) { const d = this.distBetween(s, cur); if (d < bd) { bd = d; next = s; } } });
            cur = next;
          }
          break;
        }
        case 'buff': case 'debuff': {
          const val = spell.val[Math.max(0, lvl - 1)];
          targets.forEach((t) => {
            const a = this.affects(spell, t, side); if (!a.ok) { this.pushEv({ type: 'immune', stack: t.id, why: a.why }); return; }
            if (spell.kind === 'debuff' && this.resists(spell, t, side)) { this.pushEv({ type: 'resist', stack: t.id }); return; }
            if (spell.effect === 'counterstrike') t.retaliations += val;
            const e = { val, turns: spell.permanent ? Infinity : spell.effect === 'blind' ? 3 : dur, stack: !!spell.stack };
            if (spell.stack && t.effects[spell.effect]) t.effects[spell.effect].val += val; else t.effects[spell.effect] = e;
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
        case 'special': { targets.forEach((t) => { for (const k in t.effects) if (k !== 'bound') delete t.effects[k]; this.pushEv({ type: 'dispel', stack: t.id }); affectedList.push(t); }); break; }
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
    result() {
      const s0 = this.sides[0], s1 = this.sides[1];
      return {
        winner: this.winner === 0 ? 'att' : 'def', retreated: this.retreated, surrendered: this.surrendered, surrenderCost: this.surrenderCostVal || 0,
        attKills: s0.kills || 0, attHpKilled: s0.hpKilled || 0, defKills: s1.kills || 0, defHpKilled: s1.hpKilled || 0,
        rounds: this.round
      };
    }

    // ------------------------------------------------------------ боен ИИ
    valueOf(s) { return D.fightValue(s.c); }
    evalAttack(s, opt) {
      const t = opt.target;
      const A = this.attack(s, opt.ranged), Dd = this.defense(t);
      const mult = A >= Dd ? Math.min(4, 1 + 0.05 * (A - Dd)) : Math.max(0.3, 1 - 0.025 * (Dd - A));
      let dmg = D.avgDmg(s.c) * s.count * mult;
      if (opt.ranged && this.distBetween(s, t) > 10) dmg *= 0.5;
      if (!opt.ranged && s.c.abilities.shooter && !s.c.abilities.noMeleePenalty) dmg *= 0.5;
      if (s.c.abilities.doubleAttack || (opt.ranged && s.c.abilities.doubleShot)) dmg *= 1.8;
      const total = (t.count - 1) * t.maxHp + t.hp;
      const kills = Math.min(t.count, dmg / t.maxHp);
      let score = Math.min(dmg, total) / t.maxHp * this.valueOf(t) * (kills >= t.count ? 1.3 : 1);
      if (t.c.abilities.shooter) score *= 1.2;
      if (!opt.ranged && opt.from && this.moat.size && this.hexesAt(s, opt.from.x, opt.from.y).some(([x, y]) => this.moat.has(Hex.idx(x, y)))) score *= 0.7;
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
      if (best && bs > 25) { const r = this.doCast(side, best.sp.id, best.x, best.y); return r.ok; }
      return false;
    }
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
      const enemies = this.alive(1 - side);
      if (!enemies.length) { this.doDefend(s); return; }
      // Защитник при обсада: стрелците стоят зад стените
      if (side === 1 && this.siege && s.c.abilities.shooter) { this.doDefend(s); return; }
      const nearest = enemies.slice().sort((a, b) => this.distBetween(s, a) - this.distBetween(s, b))[0];
      const enemyCanReach = enemies.some((e) => this.distBetween(e, s) <= this.speed(e) + 1 && !e.c.abilities.shooter);
      if (!s.waited && enemyCanReach && !s.c.abilities.shooter && !(side === 0 && this.siege) && this.rng.chance(0.6)) { this.doWait(s); return; }
      let bestHex = null, bd = this.distBetween(s, nearest);
      reach.forEach((r) => { let d = Infinity; for (const [hx, hy] of this.hexesAt(s, r.x, r.y)) for (const [ex, ey] of this.hexes(nearest)) d = Math.min(d, Hex.dist(hx, hy, ex, ey)); if (d < bd || (d === bd && bestHex && r.d < bestHex.d)) { bd = d; bestHex = r; } });
      if (bestHex && (bestHex.x !== s.x || bestHex.y !== s.y)) { this.doMove(s, bestHex.x, bestHex.y); s.acted = true; s.actionKind = 'move'; return; }
      this.doDefend(s);
    }
    sideStrength(side) { return this.alive(side).reduce((s, st) => s + st.count * D.fightValue(st.c), 0); }
    // ИИ се предава, когато битката е безнадеждна (само пред герой, с достатъчно злато)
    aiConsiderSurrender(side) {
      if (!this.canSurrender(side) || this.round < 2) return false;
      const my = this.sideStrength(side), en = this.sideStrength(1 - side);
      if (my <= 0 || my > en * 0.3) return false;
      const cost = this.surrenderCost(side);
      const p = this.world && this.world.players[this.sides[side].owner];
      if (!p || p.res.gold < cost || cost < 200) return false;
      return this.doSurrender(side);
    }
    runAuto(maxRounds) {
      maxRounds = maxRounds || 60;
      let lastRound = 0;
      while (!this.finished) {
        const s = this.nextTurn();
        if (!s) break;
        if (this.round !== lastRound) { lastRound = this.round; for (const side of [0, 1]) if (!this.finished) this.aiConsiderSurrender(side); if (this.finished) break; }
        this.aiAct(s);
        this.afterAction(s);
        if (this.round > maxRounds) { this.finished = true; this.winner = 1; break; }
      }
      return this.result();
    }
  }
  MK.Battle = Battle;
})();
