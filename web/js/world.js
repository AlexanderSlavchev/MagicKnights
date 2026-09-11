/* Светът на играта: играчи, герои, градове, дни и седмици, доход, движение по нива и вода,
   посещение на обекти, набиране, строене, опит и нива, дипломация, сейв/лоуд. */
(function () {
  'use strict';
  const MK = (window.MK = window.MK || {});
  const D = MK.data;

  // ------------------------------------------------------------ армии
  const Army = {
    empty: () => [null, null, null, null, null, null, null],
    count: (army) => army.reduce((s, sl) => s + (sl ? sl.n : 0), 0),
    isEmpty: (army) => army.every((sl) => !sl || sl.n <= 0),
    strength: (army) => army.reduce((s, sl) => s + (sl ? sl.n * D.fightValue(D.creatureOf(sl.c)) : 0), 0),
    goldValue: (army) => army.reduce((s, sl) => s + (sl ? sl.n * D.creatureOf(sl.c).cost.gold : 0), 0),
    add(army, cid, n) {
      if (n <= 0) return 0;
      for (const sl of army) if (sl && sl.c === cid) { sl.n += n; return 0; }
      for (let i = 0; i < 7; i++) if (!army[i]) { army[i] = { c: cid, n }; return 0; }
      return n;
    },
    canAdd(army, cid) { return army.some((sl) => sl && sl.c === cid) || army.some((sl) => !sl); },
    clean(army) { for (let i = 0; i < 7; i++) if (army[i] && army[i].n <= 0) army[i] = null; },
    minSpeed(army) { let m = 99; army.forEach((sl) => { if (sl) m = Math.min(m, D.creatureOf(sl.c).spd); }); return m === 99 ? 4 : m; },
    clone: (army) => army.map((sl) => (sl ? { c: sl.c, n: sl.n } : null)),
    move(a, i, b, j) {
      const s = a[i]; if (!s) return false;
      const t = b[j];
      if (t && t.c === s.c) { t.n += s.n; a[i] = null; return true; }
      a[i] = t; b[j] = s; return true;
    },
    split(a, i, b, j, n) {
      const s = a[i]; if (!s || n <= 0 || n >= s.n) return false;
      const t = b[j];
      if (t && t.c !== s.c) return false;
      if (t) t.n += n; else b[j] = { c: s.c, n };
      s.n -= n; return true;
    },
    factions(army) { const f = new Set(); army.forEach((sl) => { if (sl) f.add(D.creatureOf(sl.c).faction); }); return f; }
  };
  MK.Army = Army;

  // ------------------------------------------------------------ светът
  class World {
    constructor() { this.events = []; }

    static create(opts) {
      const w = new World();
      w.seed = opts.seed >>> 0;
      w.rng = new MK.RNG(w.seed ^ 0x1234567);
      w.difficulty = opts.difficulty || 1;
      w.template = (opts.template && opts.template.id) || 'balanced';
      w.day = 1; w.curPlayer = 0; w.nextId = 1; w.heroes = {}; w.towns = {};
      w.players = opts.players.map((p, i) => ({
        id: i, faction: p.faction, human: !!p.human, color: D.PLAYER_COLORS[i].col, colorName: D.PLAYER_COLORS[i].name,
        res: Object.assign({}, D.DIFFICULTY[w.difficulty][p.human ? 'start' : 'ai']),
        heroes: [], towns: [], alive: true, daysWithoutTown: 0, visited: {}, fog: null
      }));
      w.map = MK.MapGen.generate({ seed: w.seed, size: opts.size, players: opts.players, template: opts.template });
      w.players.forEach((p) => { p.fog = w.map.levels.map(() => new Uint8Array(w.map.w * w.map.h)); });
      w.map.objects.forEach((o) => {
        if (o.type === 'town') w.createTown(o);
        if (o.type === 'resource') o.amount = w.resourceAmount(o.res);
        if (o.type === 'dwelling') o.available = D.creatureOf(o.creature).growth;
        if (o.type.startsWith('shrine')) o.spell = w.rng.pick(D.SPELLS.filter((s) => s.level === +o.type.slice(-1))).id;
        if (o.type === 'tree_knowledge') o.price = w.rng.pick(['gold', 'gems']);
        if (o.type === 'windmill' || o.type === 'watermill') o.takenWeek = 0;
      });
      w.players.forEach((p, i) => {
        const town = w.towns[p.towns[0]];
        const h = w.createHero(p.faction, i, town.x, town.y, true, opts.carryHero && i === 0 ? opts.carryHero : null);
        h.inTown = town.id; town.visitor = h.id;
        w.revealAround(i, town.x, town.y, 0, 6);
        w.revealAround(i, h.x, h.y, 0, w.sightRadius(h));
      });
      w.day = 0; w.newDay();
      return w;
    }

    // ---------------------------------------------------------- помощни
    idx(x, y) { return y * this.map.w + x; }
    inb(x, y) { return x >= 0 && y >= 0 && x < this.map.w && y < this.map.h; }
    lv(z) { return this.map.levels[z || 0]; }
    hasUnderground() { return this.map.levels.length > 1; }
    terrainAt(x, y, z) { return this.lv(z).terrain[this.idx(x, y)]; }
    objectAt(x, y, z) { if (!this.inb(x, y)) return null; const id = this.lv(z).objAt[this.idx(x, y)]; return id < 0 ? null : this.objById(id); }
    objById(id) { if (!this._objIndex) this.reindexObjects(); return this._objIndex.get(id) || null; }
    reindexObjects() { this._objIndex = new Map(); this.map.objects.forEach((o) => this._objIndex.set(o.id, o)); }
    addObject(o) { o.id = this.nextId++; o.z = o.z || 0; this.map.objects.push(o); this.lv(o.z).objAt[this.idx(o.x, o.y)] = o.id; this._objIndex && this._objIndex.set(o.id, o); return o; }
    removeObject(o) {
      const i = this.map.objects.indexOf(o);
      if (i >= 0) this.map.objects.splice(i, 1);
      const L = this.lv(o.z);
      if (L.objAt[this.idx(o.x, o.y)] === o.id) L.objAt[this.idx(o.x, o.y)] = -1;
      this._objIndex && this._objIndex.delete(o.id);
    }
    heroAt(x, y, z) { z = z || 0; for (const id in this.heroes) { const h = this.heroes[id]; if (h.x === x && h.y === y) { if ((h.z || 0) === z) return h; } } return null; }
    blocksPassage(x, y, z, hero) {
      const o = this.objectAt(x, y, z);
      if (o) return true;
      const h = this.heroAt(x, y, z);
      if (h && h !== hero) return true;
      return false;
    }
    isWater(x, y, z) { return this.inb(x, y) && this.terrainAt(x, y, z) === 0; }
    resourceAmount(res) {
      if (res === 'gold') return this.rng.int(5, 10) * 100;
      if (res === 'wood' || res === 'ore') return this.rng.int(5, 10);
      return this.rng.int(3, 6);
    }
    player(i) { return this.players[i]; }
    cur() { return this.players[this.curPlayer]; }
    log(text, kind) { this.events.push({ type: 'msg', text, kind }); }
    week() { return Math.floor((this.day - 1) / 7) + 1; }
    dayOfWeek() { return ((this.day - 1) % 7) + 1; }
    month() { return Math.floor((this.day - 1) / 28) + 1; }
    dateText() { return 'Месец ' + this.month() + ', седмица ' + (Math.floor(((this.day - 1) % 28) / 7) + 1) + ', ден ' + this.dayOfWeek(); }

    // ---------------------------------------------------------- мъгла
    revealAround(pi, x, y, z, r) {
      const fog = this.players[pi].fog[z || 0];
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r + r) continue;
        const nx = x + dx, ny = y + dy;
        if (this.inb(nx, ny)) fog[this.idx(nx, ny)] = 1;
      }
    }
    isRevealed(pi, x, y, z) { return this.players[pi].fog[z || 0][this.idx(x, y)] === 1; }
    sightRadius(h) { return 5 + this.skillLevel(h, 'scouting') + (h.boat ? 1 : 0); }

    // ---------------------------------------------------------- градове
    createTown(o) {
      const t = {
        id: this.nextId++, name: o.name, faction: o.faction, owner: o.owner, x: o.x, y: o.y, z: o.z || 0,
        buildings: { hall1: true }, builtToday: false, avail: [0, 0, 0, 0, 0, 0, 0, 0],
        garrison: Army.empty(), visitor: null, spells: { 1: [], 2: [], 3: [], 4: [], 5: [] }
      };
      o.townId = t.id;
      if (o.owner >= 0) {
        t.buildings.fort1 = true; t.buildings.dw1 = true; t.buildings.tavern = true;
        if (this.rng.chance(0.5)) t.buildings.dw2 = true;
        if (this.template === 'islands') t.buildings.shipyard = true;
        this.players[o.owner].towns.push(t.id);
      } else if (o.neutralGuard) {
        const f = o.faction;
        Army.add(t.garrison, f + '1', this.rng.int(20, 40));
        Army.add(t.garrison, f + '2', this.rng.int(10, 20));
        if (this.rng.chance(0.6)) Army.add(t.garrison, f + '3', this.rng.int(5, 10));
        t.buildings.fort1 = true; t.buildings.dw1 = true;
        if (this.rng.chance(0.5)) t.buildings.dw2 = true;
      }
      this.towns[t.id] = t;
      this.setTownAvail(t, true);
      return t;
    }
    townOfHero(h) { return h.inTown ? this.towns[h.inTown] : null; }
    fortLevel(t) { return t.buildings.fort3 ? 3 : t.buildings.fort2 ? 2 : t.buildings.fort1 ? 1 : 0; }
    hallLevel(t) { return t.buildings.hall4 ? 4 : t.buildings.hall3 ? 3 : t.buildings.hall2 ? 2 : 1; }
    mageLevel(t) { for (let l = 5; l >= 1; l--) if (t.buildings['mage' + l]) return l; return 0; }
    townIncome(t) { return [0, 500, 1000, 2000, 4000][this.hallLevel(t)]; }
    growthOf(t, tier) {
      const c = D.creatureOf(t.faction + tier);
      let g = c.growth;
      const fl = this.fortLevel(t);
      if (fl >= 2) g += Math.floor(c.growth * 0.5);
      if (fl >= 3) g += Math.floor(c.growth * 0.5);
      if (t.buildings.well) g += 2;
      return g;
    }
    setTownAvail(t) { for (let tier = 1; tier <= 7; tier++) if (t.buildings['dw' + tier]) t.avail[tier] += this.growthOf(t, tier); }
    isCoastal(t) { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (this.isWater(t.x + dx, t.y + dy, t.z)) return true; return false; }
    canBuild(t, id) {
      const b = D.buildingFor(t.faction, id);
      if (t.buildings[id]) return { ok: false, why: 'Вече е построено.' };
      if (t.builtToday) return { ok: false, why: 'Днес вече е строено в този град.' };
      for (const r of b.req) if (!t.buildings[r]) return { ok: false, why: 'Нужно е: ' + D.buildingFor(t.faction, r).name + '.' };
      if (id === 'shipyard' && !this.isCoastal(t)) return { ok: false, why: 'Градът не е до вода.' };
      const p = this.players[t.owner];
      if (id === 'hall4' && p.towns.some((tid) => this.towns[tid].buildings.hall4)) return { ok: false, why: 'Вече имаш Капитолий.' };
      for (const k in b.cost) if ((p.res[k] || 0) < b.cost[k]) return { ok: false, why: 'Недостатъчно ' + D.RES_NAME[k].toLowerCase() + '.' };
      return { ok: true };
    }
    build(t, id) {
      const chk = this.canBuild(t, id);
      if (!chk.ok) return chk;
      const b = D.buildingFor(t.faction, id);
      const p = this.players[t.owner];
      for (const k in b.cost) p.res[k] -= b.cost[k];
      t.buildings[id] = true; t.builtToday = true;
      if (b.tier && !b.upg) t.avail[b.tier] += this.growthOf(t, b.tier);
      if (id.startsWith('mage')) this.generateGuildSpells(t, +id.slice(4));
      if (t.visitor && this.heroes[t.visitor]) this.learnTownSpells(this.heroes[t.visitor], t);
      return { ok: true };
    }
    // Кораб от корабостроителница: 1000 злато, 10 дърво; появява се на най-близката свободна вода
    /* Кораб до котва (град или корабостроителница на картата) за 1000 злато и 10 дърво */
    buildBoatAt(anchor, owner, radius) {
      const p = this.players[owner];
      if (p.res.gold < 1000 || p.res.wood < 10) return { ok: false, why: 'Нужни са 1000 злато и 10 дърво.' };
      let best = null, bd = Infinity;
      const R = radius || 3;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const x = anchor.x + dx, y = anchor.y + dy;
        if (!this.isWater(x, y, anchor.z || 0) || this.objectAt(x, y, anchor.z || 0) || this.heroAt(x, y, anchor.z || 0)) continue;
        const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = { x, y }; }
      }
      if (!best) return { ok: false, why: 'Няма свободна вода наблизо.' };
      p.res.gold -= 1000; p.res.wood -= 10;
      this.addObject({ type: 'boat', x: best.x, y: best.y, z: anchor.z || 0, owner });
      return { ok: true, x: best.x, y: best.y };
    }
    buildBoat(t) {
      if (!t.buildings.shipyard) return { ok: false, why: 'Няма корабостроителница.' };
      return this.buildBoatAt(t, t.owner, 3);
    }
    generateGuildSpells(t, level) {
      const used = new Set(); for (let l = 1; l <= 5; l++) t.spells[l].forEach((s) => used.add(s));
      const pool = this.rng.shuffle(D.SPELLS.filter((s) => s.level === level && !used.has(s.id)));
      t.spells[level] = pool.slice(0, D.GUILD_SLOTS[level]).map((s) => s.id);
    }
    learnTownSpells(h, t) {
      const ml = this.mageLevel(t);
      const wis = this.skillLevel(h, 'wisdom');
      const learned = [];
      for (let l = 1; l <= ml; l++) {
        if (l >= 3 && wis < l - 2) continue;
        t.spells[l].forEach((sid) => { if (!h.spells.includes(sid)) { h.spells.push(sid); learned.push(sid); } });
      }
      if (ml) h.mana = Math.max(h.mana, this.maxMana(h));
      return learned;
    }
    recruitCost(cid, n) { const c = D.creatureOf(cid); const cost = {}; for (const k in c.cost) cost[k] = c.cost[k] * n; return cost; }
    canAfford(p, cost) { for (const k in cost) if ((p.res[k] || 0) < cost[k]) return false; return true; }
    pay(p, cost) { for (const k in cost) p.res[k] -= cost[k]; }
    maxAffordable(p, cid) { const c = D.creatureOf(cid); let n = Infinity; for (const k in c.cost) n = Math.min(n, Math.floor((p.res[k] || 0) / c.cost[k])); return n === Infinity ? 0 : n; }
    recruit(t, tier, upg, n, targetArmy) {
      const p = this.players[t.owner];
      if (upg && !t.buildings['dw' + tier + 'u']) return { ok: false, why: 'Няма подобрено жилище.' };
      n = Math.min(n, t.avail[tier]);
      if (n <= 0) return { ok: false, why: 'Няма налични същества.' };
      const cid = t.faction + tier + (upg ? 'u' : '');
      n = Math.min(n, this.maxAffordable(p, cid));
      if (n <= 0) return { ok: false, why: 'Недостатъчно ресурси.' };
      if (!Army.canAdd(targetArmy, cid)) return { ok: false, why: 'Няма свободно място в армията.' };
      this.pay(p, this.recruitCost(cid, n));
      t.avail[tier] -= n;
      Army.add(targetArmy, cid, n);
      return { ok: true, n };
    }
    upgradeCost(t, army, i) {
      const sl = army[i]; if (!sl) return null;
      const c = D.creatureOf(sl.c); const u = D.upgradeOf(c);
      if (!u || c.faction !== t.faction || !t.buildings['dw' + c.tier + 'u']) return null;
      const cost = {}; for (const k in u.cost) cost[k] = (u.cost[k] - (c.cost[k] || 0)) * sl.n;
      return cost;
    }
    upgradeStack(t, army, i) {
      const cost = this.upgradeCost(t, army, i);
      if (!cost) return { ok: false, why: 'Тук не може да се подобри.' };
      const p = this.players[t.owner];
      if (!this.canAfford(p, cost)) return { ok: false, why: 'Недостатъчно ресурси.' };
      this.pay(p, cost); army[i].c = D.upgradeOf(D.creatureOf(army[i].c)).id;
      return { ok: true };
    }
    marketRate(p) { let n = 0; p.towns.forEach((tid) => { if (this.towns[tid].buildings.market) n++; }); return Math.max(1, n); }
    tradeRate(p, from, to) {
      const val = { gold: 1, wood: 50, ore: 50, mercury: 100, sulfur: 100, crystal: 100, gems: 100 };
      const m = this.marketRate(p);
      const base = val[to] / val[from];
      const fee = [0, 10, 5, 4, 3, 2.5, 2, 1.8, 1.6, 1.5][Math.min(m, 9)];
      if (from === 'gold') return Math.ceil(val[to] * fee / 2);
      if (to === 'gold') return Math.max(1, Math.floor(val[from] / fee));
      return Math.max(1, Math.ceil(base * fee / 2));
    }
    trade(p, from, to, amount) {
      if (from === to) return false;
      if (to === 'gold') { const r = this.tradeRate(p, from, to); if (p.res[from] < amount) return false; p.res[from] -= amount; p.res.gold += r * amount; return true; }
      const r = this.tradeRate(p, from, to); const give = r * amount;
      if (p.res[from] < give) return false;
      p.res[from] -= give; p.res[to] += amount; return true;
    }
    tavernHeroes(t) {
      if (!t.tavern || t.tavernWeek !== this.week()) {
        t.tavernWeek = this.week();
        const keep = (t.tavern || []).filter((h) => h.keep);
        const f1 = t.faction, f2 = this.rng.pick(D.FACTIONS.filter((f) => f.id !== f1)).id;
        t.tavern = keep.concat([this.rollHero(f1), this.rollHero(f2)]);
      }
      return t.tavern;
    }
    rollHero(faction) {
      const f = D.factionById(faction);
      const cls = this.rng.pick(f.classes);
      const used = new Set(Object.values(this.heroes).map((h) => h.name));
      const names = D.HERO_NAMES[faction].filter((n) => !used.has(n));
      return { faction, cls, name: names.length ? this.rng.pick(names) : this.rng.pick(D.HERO_NAMES[faction]) + ' II', portrait: this.rng.int(0, 5), army: this.rollStartArmy(faction), spec: this.rollSpecialty(faction, cls) };
    }
    rollSpecialty(faction, clsId) {
      const cls = D.CLASSES[clsId];
      const kind = this.rng.weighted({ creature: 40, skill: 30, spell: cls.magic ? 15 : 5, resource: 15 });
      if (kind === 'creature') return { kind, id: faction + this.rng.int(1, 4) };
      if (kind === 'skill') return { kind, id: this.rng.pick(cls.skills.filter((s) => s !== 'wisdom')) || cls.skills[0] };
      if (kind === 'spell') return { kind, id: this.rng.pick(D.SPELLS.filter((s) => s.level <= 2)).id };
      return { kind, id: this.rng.weighted({ gold: 4, wood: 1, ore: 1, mercury: 1, sulfur: 1, crystal: 1, gems: 1 }) };
    }
    rollStartArmy(faction) {
      const a = Army.empty();
      Army.add(a, faction + '1', this.rng.int(10, 20));
      if (this.rng.chance(0.85)) Army.add(a, faction + '2', this.rng.int(4, 7));
      if (this.rng.chance(0.25)) Army.add(a, faction + '3', this.rng.int(2, 3));
      return a;
    }
    hireHero(t, i) {
      const p = this.players[t.owner];
      if (p.heroes.length >= 8) return { ok: false, why: 'Не може повече от 8 герои.' };
      if (p.res.gold < 2500) return { ok: false, why: 'Нужни са 2500 злато.' };
      if (t.visitor) return { ok: false, why: 'В града вече има герой.' };
      const proto = this.tavernHeroes(t)[i];
      if (!proto) return { ok: false };
      p.res.gold -= 2500;
      const h = this.createHero(proto.faction, t.owner, t.x, t.y, false, proto);
      h.z = t.z; h.inTown = t.id; t.visitor = h.id;
      if (proto.keep) { Object.assign(h, proto.keep); h.pendingLevels = 0; h.mana = Math.min(h.mana || 0, this.maxMana(h)); this.resetMovement(h); }
      t.tavern.splice(i, 1);
      this.learnTownSpells(h, t);
      this.revealAround(t.owner, h.x, h.y, h.z, this.sightRadius(h));
      return { ok: true, hero: h };
    }

    // ---------------------------------------------------------- герои
    createHero(faction, owner, x, y, isStart, proto) {
      proto = proto || this.rollHero(faction);
      const cls = D.CLASSES[proto.cls];
      const h = {
        id: this.nextId++, name: proto.name, cls: proto.cls, faction, owner, x, y, z: 0, portrait: proto.portrait,
        level: 1, xp: 0, att: cls.start[0], def: cls.start[1], pow: cls.start[2], know: cls.start[3],
        skills: {}, spells: [], mana: 0, movement: 0, maxMovement: 0, spec: proto.spec || this.rollSpecialty(faction, proto.cls),
        army: proto.army || this.rollStartArmy(faction), arts: D.SLOTS.map(() => null), backpack: [],
        visited: {}, moraleTmp: 0, luckTmp: 0, moveTmp: 0, moveTmpWeek: 0, inTown: null, pendingLevels: 0, sleeping: false, boat: false
      };
      cls.skills.forEach((s) => { h.skills[s] = 1; });
      if (cls.magic) h.spells.push('magic_arrow');
      if (h.spec.kind === 'spell' && !h.spells.includes(h.spec.id)) h.spells.push(h.spec.id);
      if (isStart && this.rng.chance(0.5)) { const s = this.rng.pick(['haste', 'slow', 'bless', 'curse', 'shield', 'stone_skin', 'cure']); if (!h.spells.includes(s)) h.spells.push(s); }
      // Пренесен герой от кампания
      if (proto.carry) { const c = proto.carry; Object.assign(h, { name: c.name, cls: c.cls, portrait: c.portrait, level: c.level, xp: c.xp, att: c.att, def: c.def, pow: c.pow, know: c.know, skills: Object.assign({}, c.skills), spells: c.spells.slice(), arts: c.arts.slice(), backpack: c.backpack.slice(), spec: c.spec }); }
      h.mana = this.maxMana(h);
      this.heroes[h.id] = h;
      this.players[owner].heroes.push(h.id);
      this.resetMovement(h);
      return h;
    }
    heroSnapshot(h) { return { name: h.name, cls: h.cls, portrait: h.portrait, level: h.level, xp: h.xp, att: h.att, def: h.def, pow: h.pow, know: h.know, skills: h.skills, spells: h.spells, arts: h.arts, backpack: h.backpack, spec: h.spec }; }
    // Артефакти: бонуси + пълни комплекти
    artBonus(h, key) {
      let s = 0;
      h.arts.forEach((aid) => { if (aid && D.artById[aid].bonus[key]) s += D.artById[aid].bonus[key]; });
      this.heroSets(h).forEach((set) => { if (set.bonus[key]) s += set.bonus[key]; });
      return s;
    }
    heroSets(h) { const out = []; for (const k in D.ART_SETS) { const set = D.ART_SETS[k]; if (set.parts.every((p) => h.arts.includes(p))) out.push(set); } return out; }
    hasArt(h, key) { return h.arts.some((aid) => aid && D.artById[aid].bonus[key]); }
    stat(h, k) { return Math.max(0, h[k] + this.artBonus(h, k)); }
    // Ефективна степен на умение (умение + артефакти), 0..3
    skillLevel(h, sk) { return Math.min(3, (h.skills[sk] || 0) + this.artBonus(h, sk)); }
    // Множител от специалност в умение
    skillMult(h, sk) { return h.spec && h.spec.kind === 'skill' && h.spec.id === sk ? 1 + 0.05 * h.level : 1; }
    heroSpells(h) {
      const out = h.spells.slice();
      h.arts.forEach((aid) => { if (aid && D.artById[aid].bonus.spellsOf) D.SPELLS.forEach((s) => { if (s.school === D.artById[aid].bonus.spellsOf && !out.includes(s.id)) out.push(s.id); }); });
      return out;
    }
    maxMana(h) { return Math.floor(this.stat(h, 'know') * 10 * (1 + [0, 0.25, 0.5, 1][this.skillLevel(h, 'intelligence')])); }
    heroMorale(h) { return Math.round(this.skillLevel(h, 'leadership') * this.skillMult(h, 'leadership')) + this.artBonus(h, 'morale') + h.moraleTmp; }
    heroLuck(h) { return Math.round(this.skillLevel(h, 'luck') * this.skillMult(h, 'luck')) + this.artBonus(h, 'luck') + h.luckTmp; }
    static armyNativeTerrain(h) {
      const fs = Army.factions(h.army);
      if (fs.size !== 1) return -1;
      const f = D.factionById([...fs][0]);
      return f ? f.terrain : -1;
    }
    computeMaxMovement(h) {
      if (h.boat) {
        let m = D.SEA_MOVEMENT * (1 + [0, 0.5, 1, 1.5][this.skillLevel(h, 'navigation')]);
        m += this.artBonus(h, 'seaMove');
        if (this.map.objects.some((o) => o.type === 'lighthouse' && o.owner === h.owner)) m += 500;
        return Math.floor(m);
      }
      let m = D.baseMovement(Army.minSpeed(h.army) + (this.heroSets(h).some((s) => s === D.ART_SETS.wolf) ? 2 : 0));
      m = Math.floor(m * (1 + [0, 0.1, 0.2, 0.3][this.skillLevel(h, 'logistics')] * this.skillMult(h, 'logistics')));
      m += this.artBonus(h, 'moveBonus');
      if (h.moveTmpWeek === this.week()) m += h.moveTmp;
      return m;
    }
    resetMovement(h) { h.maxMovement = this.computeMaxMovement(h); h.movement = h.maxMovement; h._native = undefined; h._fly = this.hasArt(h, 'flyMove'); }
    gainXp(h, xp) {
      xp = Math.round(xp * (1 + [0, 0.05, 0.1, 0.15][this.skillLevel(h, 'learning')] * this.skillMult(h, 'learning')));
      h.xp += xp;
      const nl = D.levelForXp(h.xp);
      while (h.level < nl) { h.level++; h.pendingLevels++; }
      return xp;
    }
    rollLevelUp(h) {
      const cls = D.CLASSES[h.cls];
      const probs = h.level <= 9 ? cls.p1 : cls.p2;
      const w = {}; D.PRIMARY.forEach((k, i) => { w[k] = probs[i]; });
      const stat = this.rng.weighted(w);
      const upgradable = Object.keys(h.skills).filter((s) => h.skills[s] < 3);
      const weights = D.CLASS_SKILL_WEIGHTS[h.cls];
      const newCands = Object.keys(D.SKILLS).filter((s) => !h.skills[s] && (s !== 'necromancy' || h.faction === 'necropolis'));
      const offers = [];
      const nSkills = Object.keys(h.skills).length;
      if (upgradable.length) offers.push(this.rng.pick(upgradable));
      if (nSkills < 8 && newCands.length) { const w2 = {}; newCands.forEach((s) => { w2[s] = weights[s] || 1; }); offers.push(this.rng.weighted(w2)); }
      else if (upgradable.length > 1) offers.push(this.rng.pick(upgradable.filter((s) => s !== offers[0])));
      return { stat, offers };
    }
    applyLevelUp(h, roll, skillChoice) {
      h[roll.stat]++;
      if (skillChoice) h.skills[skillChoice] = (h.skills[skillChoice] || 0) + 1;
      h.pendingLevels = Math.max(0, h.pendingLevels - 1);
      if (roll.stat === 'know') h.mana = Math.min(this.maxMana(h), h.mana + 10);
      h._native = undefined;
    }
    autoLevelUp(h) {
      while (h.pendingLevels > 0) {
        const roll = this.rollLevelUp(h);
        const weights = D.CLASS_SKILL_WEIGHTS[h.cls];
        let best = null, bw = -1;
        roll.offers.forEach((s) => { const w = (weights[s] || 1) + (h.skills[s] ? 3 : 0); if (w > bw) { bw = w; best = s; } });
        this.applyLevelUp(h, roll, best);
      }
    }
    equipArtifact(h, aid) {
      const a = D.artById[aid];
      for (let i = 0; i < D.SLOTS.length; i++) if (D.SLOTS[i] === a.slot && !h.arts[i]) { h.arts[i] = aid; h._native = undefined; h._fly = this.hasArt(h, 'flyMove'); return true; }
      h.backpack.push(aid); return false;
    }
    unequip(h, i) { const a = h.arts[i]; if (!a) return; h.arts[i] = null; h.backpack.push(a); h._fly = this.hasArt(h, 'flyMove'); }
    equipFromBackpack(h, bi) {
      const aid = h.backpack[bi]; if (!aid) return false;
      const a = D.artById[aid];
      let slot = -1;
      for (let i = 0; i < D.SLOTS.length; i++) if (D.SLOTS[i] === a.slot && !h.arts[i]) { slot = i; break; }
      if (slot < 0) for (let i = 0; i < D.SLOTS.length; i++) if (D.SLOTS[i] === a.slot) { slot = i; break; }
      if (slot < 0) return false;
      h.backpack.splice(bi, 1);
      if (h.arts[slot]) h.backpack.push(h.arts[slot]);
      h.arts[slot] = aid; h._fly = this.hasArt(h, 'flyMove'); return true;
    }
    removeHero(h) {
      const p = this.players[h.owner];
      p.heroes = p.heroes.filter((id) => id !== h.id);
      if (h.inTown && this.towns[h.inTown] && this.towns[h.inTown].visitor === h.id) this.towns[h.inTown].visitor = null;
      if (h.boat) this.addObject({ type: 'boat', x: h.x, y: h.y, z: h.z, owner: h.owner });
      delete this.heroes[h.id];
    }
    heroStrength(h) { return Army.strength(h.army) * (1 + this.stat(h, 'att') * 0.05 + this.stat(h, 'def') * 0.05); }

    // ---------------------------------------------------------- ход и дни
    endTurn() {
      let n = this.curPlayer;
      for (let k = 0; k < this.players.length; k++) {
        n++;
        if (n >= this.players.length) { this.newDay(); n = 0; }
        if (this.players[n].alive) break;
      }
      this.curPlayer = n;
      this.startTurn();
    }
    startTurn() {
      const p = this.cur();
      p.heroes.forEach((id) => { const h = this.heroes[id]; this.revealAround(p.id, h.x, h.y, h.z, this.sightRadius(h)); });
      p.towns.forEach((id) => { const t = this.towns[id]; this.revealAround(p.id, t.x, t.y, t.z, 6); });
    }
    newDay() {
      this.day++;
      const newWeek = this.dayOfWeek() === 1;
      const newMonth = (this.day - 1) % 28 === 0 && this.day > 1;
      this.players.forEach((p) => {
        if (!p.alive) return;
        let gold = 0;
        p.towns.forEach((tid) => { const t = this.towns[tid]; gold += this.townIncome(t); t.builtToday = false; if (t.buildings.silo) p.res[D.factionById(t.faction).rare] += 1; });
        this.map.objects.forEach((o) => { if (o.type === 'mine' && o.owner === p.id) { const m = D.MINES.find((m) => m.res === o.res); p.res[o.res] += m.amount; } });
        p.heroes.forEach((hid) => {
          const h = this.heroes[hid];
          gold += Math.round([0, 125, 250, 500][this.skillLevel(h, 'estates')] * this.skillMult(h, 'estates')) + this.artBonus(h, 'goldIncome');
          h.arts.forEach((aid) => { if (aid && D.artById[aid].bonus.resIncome) p.res[D.artById[aid].bonus.resIncome] += 1; });
          if (h.spec && h.spec.kind === 'resource') { if (h.spec.id === 'gold') gold += 350; else p.res[h.spec.id] += 1; }
          const inGuild = h.inTown && this.mageLevel(this.towns[h.inTown]) > 0;
          const mm = this.maxMana(h);
          h.mana = inGuild ? mm : Math.min(mm, h.mana + 1 + [0, 2, 3, 4][this.skillLevel(h, 'mysticism')] + this.artBonus(h, 'manaRegen'));
          this.resetMovement(h);
        });
        p.res.gold += gold;
        if (p.towns.length === 0) { p.daysWithoutTown++; if (p.daysWithoutTown > 7) this.eliminate(p, 'Седем дни без град — кралството се разпада.'); }
        else p.daysWithoutTown = 0;
      });
      if (newWeek) {
        for (const id in this.towns) { const t = this.towns[id]; if (t.owner >= 0 || t.garrison.some((s) => s)) this.setTownAvail(t); }
        this.map.objects.forEach((o) => {
          if (o.type === 'dwelling') o.available += D.creatureOf(o.creature).growth;
          if (o.type === 'monster' && o.growth) o.count += Math.max(1, Math.floor(o.count * 0.1));
          if (o.guard && !o.guard.stacks) o.guard.count += Math.max(1, Math.floor(o.guard.count * 0.1));
        });
        this.weekName = this.rollWeekName();
        this.log('Нова седмица: ' + this.weekName, 'week');
      }
      if (newMonth) this.log('Нов месец!', 'week');
    }
    rollWeekName() { return this.rng.pick(['на гарвана', 'на лисицата', 'на елена', 'на бухала', 'на вълка', 'на мечката', 'на щуреца', 'на дъба', 'на реката', 'на мъглата', 'на меда', 'на желязото']); }
    eliminate(p, why) {
      if (!p.alive) return;
      p.alive = false;
      p.heroes.slice().forEach((id) => this.removeHero(this.heroes[id]));
      p.towns.slice().forEach((tid) => { this.towns[tid].owner = -1; });
      p.towns = [];
      this.events.push({ type: 'eliminated', player: p.id, text: (p.human ? D.PLAYER_COLORS[p.id].name + ' играч е победен. ' : D.PLAYER_COLORS[p.id].name + ' играч е победен. ') + (why || '') });
    }
    checkVictory() {
      this.players.forEach((p) => { if (p.alive && !p.towns.length && !p.heroes.length) this.eliminate(p, 'Нито градове, нито герои.'); });
      const alive = this.players.filter((p) => p.alive);
      if (alive.length === 1) return alive[0];
      if (alive.length > 1 && alive.every((p) => p.human) === false && alive.filter((p) => p.human).length === 0) return alive[0];
      return null;
    }

    // ---------------------------------------------------------- движение
    /* Една стъпка. {ok:true} | {stop:true, why} | {event} */
    stepHero(h, x, y) {
      const diag = h.x !== x && h.y !== y;
      const z = h.z || 0;
      let cost = MK.Path.tileCost(this, h, x, y, diag, false);
      const target = this.objectAt(x, y, z);
      const other = this.heroAt(x, y, z);
      const goalCost = MK.Path.tileCost(this, h, x, y, diag, true);
      if (cost === Infinity) cost = goalCost;
      if (cost === Infinity) return { stop: true, why: 'Непроходимо.' };
      if (h.movement < cost) return { stop: true, why: 'Няма точки за движение.' };
      if (h.inTown) { const t = this.towns[h.inTown]; if (t.visitor === h.id) t.visitor = null; h.inTown = null; }
      if (other && other !== h) {
        h.movement -= cost;
        if (other.owner === h.owner) return { event: { type: 'meet', hero: h, other } };
        // от суша към кораб и обратно битката е позволена; победителят остава на мястото си, корабът на победения остава на водата
        return { event: this.startBattle(h, { type: 'hero', hero: other }) };
      }
      // Кораб: качване / слизане
      if (!h.boat && this.isWater(x, y, z)) {
        if (!target || target.type !== 'boat') return { stop: true, why: 'Вода.' };
        this.removeObject(target);
        h.x = x; h.y = y; h.boat = true; h.movement = 0; h.maxMovement = this.computeMaxMovement(h);
        this.revealAround(h.owner, x, y, z, this.sightRadius(h));
        return { event: { type: 'visit', obj: target, text: h.name + ' се качва на кораба. Плаването започва утре.', kind: 'boat' } };
      }
      if (h.boat && !this.isWater(x, y, z)) {
        if (target && target.type === 'monster') { h.movement -= cost; return { event: this.startBattle(h, { type: 'monster', obj: target }) }; }
        if (target && target.type === 'town') { /* влизане в град от кораб — продължава долу */ }
        else {
          this.addObject({ type: 'boat', x: h.x, y: h.y, z, owner: h.owner });
          h.x = x; h.y = y; h.boat = false; h.movement = 0; h.maxMovement = this.computeMaxMovement(h);
          this.revealAround(h.owner, x, y, z, this.sightRadius(h));
          const ev = target ? this.visit(h, target) : null;
          return { event: ev || { type: 'visit', obj: null, text: h.name + ' слиза на сушата.', kind: 'boat' } };
        }
      }
      if (target && target.guard && !h.boat) {
        // Обектът е пазен: първо битка с пазачите; при победа обектът остава и се посещава с нов ход
        h.movement -= cost;
        return { event: this.startBattle(h, { type: 'monster', obj: target, guardOf: true }) };
      }
      if (target && target.type === 'monster') {
        h.movement -= cost;
        // Дипломация: предложение за присъединяване или бягство на пазачите
        const offer = this.diplomacyOffer(h, target);
        if (offer) return { event: offer };
        return { event: this.startBattle(h, { type: 'monster', obj: target }) };
      }
      if (target && target.type === 'town') {
        const t = this.towns[target.townId];
        if (t.owner === h.owner) {
          if (t.visitor && t.visitor !== h.id) return { stop: true, why: 'В града вече има герой.' };
          if (h.boat) { this.addObject({ type: 'boat', x: h.x, y: h.y, z, owner: h.owner }); h.boat = false; }
          h.movement -= cost; h.x = x; h.y = y; h.inTown = t.id; t.visitor = h.id; h.maxMovement = this.computeMaxMovement(h);
          this.revealAround(h.owner, x, y, z, this.sightRadius(h));
          return { event: { type: 'enterTown', town: t, hero: h, learned: this.learnTownSpells(h, t) } };
        }
        h.movement -= cost;
        return { event: this.startBattle(h, { type: 'town', town: t }) };
      }
      h.movement -= cost; h.x = x; h.y = y;
      this.revealAround(h.owner, x, y, z, this.sightRadius(h));
      // Съществата на картата не нападат сами — битка има само ако героят ги атакува.
      if (target) { const ev = this.visit(h, target); if (ev) return { event: ev }; }
      return { ok: true };
    }
    diplomacyOffer(h, o) {
      const my = this.heroStrength(h);
      const c = D.creatureOf(o.creature);
      const str = o.count * D.fightValue(c);
      const dip = this.skillLevel(h, 'diplomacy');
      const p = this.players[h.owner];
      if (str <= 0) return null;
      const ratio = my / str;
      // Бягство: много по-силна армия и плахи същества
      if (ratio >= 5 && o.disposition <= 3 && dip === 0) { this.removeObject(o); return { type: 'visit', obj: o, text: o.count + ' × ' + c.name + ' бягат от армията ти.', kind: 'flee' }; }
      if (!dip || ratio < [99, 3, 2, 1.5][dip] || o.disposition > 7 || !Army.canAdd(h.army, o.creature)) return null;
      const free = dip === 3 && ratio >= 2 || (dip >= 2 && ratio >= 4);
      const cost = free ? 0 : Math.round(o.count * c.cost.gold * (1 - 0.2 * dip));
      const join = () => { Army.add(h.army, o.creature, o.count); p.res.gold -= cost; this.removeObject(o); };
      const options = [];
      if (cost === 0 || p.res.gold >= cost) options.push({ label: cost ? 'Приеми за ' + cost + ' злато' : 'Приеми (безплатно)', apply: join });
      options.push({ label: 'Откажи и нападни', apply: () => { this.events.unshift(this.startBattle(h, { type: 'monster', obj: o })); } });
      options.push({ label: 'Откажи и се оттегли', apply: () => {} });
      return { type: 'choice', obj: o, title: 'Дипломация', text: o.count + ' × ' + c.name + ' искат да се присъединят към ' + h.name + (cost ? ' срещу ' + cost + ' злато.' : ' безплатно.'), options, aiPick: () => (cost === 0 || p.res.gold - cost > 3000 ? 0 : 1) };
    }

    // ---------------------------------------------------------- посещения
    visit(h, o) {
      const p = this.players[h.owner];
      const once = (key) => { if (h.visited[key]) return false; h.visited[key] = true; return true; };
      const msg = (text, kind) => ({ type: 'visit', obj: o, text, kind: kind || 'info' });
      switch (o.type) {
        case 'resource': { p.res[o.res] += o.amount; const t = D.RES_NAME[o.res] + ': +' + o.amount; this.removeObject(o); return msg(t, 'pickup'); }
        case 'chest': case 'sea_chest': {
          const r = this.rng.int(0, 2); const gold = [1000, 1500, 2000][r] + (o.type === 'sea_chest' ? 500 : 0), xp = [500, 1000, 1500][r];
          this.removeObject(o);
          return { type: 'choice', obj: o, title: o.type === 'chest' ? 'Сандък със съкровище' : 'Морски сандък', text: 'Намираш сандък. Какво ще вземеш?', options: [
            { label: gold + ' злато', apply: () => { p.res.gold += gold; } },
            { label: xp + ' опит', apply: () => { this.gainXp(h, xp); } }
          ], aiPick: () => (h.level < 6 ? 1 : 0) };
        }
        case 'shipwreck': {
          if (o.empty) return msg('Останките са претърсени.');
          o.empty = true;
          if (this.rng.chance(0.3)) { const a = this.rng.pick(D.ARTIFACTS.filter((a) => a.cls <= 2)); this.equipArtifact(h, a.id); return msg('Сред останките намираш ' + a.name + '. ' + a.desc, 'artifact'); }
          const g = this.rng.int(10, 20) * 100; p.res.gold += g; return msg('Сред останките намираш ' + g + ' злато.', 'pickup');
        }
        case 'dragon_utopia': {
          if (o.empty || !o.loot) return msg('Драконовата утопия е празна — съкровището вече е взето.', 'stat');
          const L = o.loot; o.empty = true; p.res.gold += L.gold;
          const names = L.arts.map((aid) => { this.equipArtifact(h, aid); return D.artById[aid].name; });
          return msg('Драконите са победени! В леговището намираш ' + L.gold + ' злато' + (names.length ? ' и артефактите: ' + names.join(', ') : '') + '.', 'artifact');
        }
        case 'artifact': { const a = D.artById[o.art]; this.removeObject(o); this.equipArtifact(h, o.art); return msg('Намираш артефакт: ' + a.name + '. ' + a.desc, 'artifact'); }
        case 'mine': { if (o.owner === h.owner) return null; o.owner = h.owner; const m = D.MINES.find((m) => m.res === o.res); return msg(m.name + ' е вече твоя: +' + m.amount + ' ' + D.RES_NAME[o.res].toLowerCase() + ' на ден.', 'flag'); }
        case 'shipyard': {
          const near = this.map.objects.some((b) => b.type === 'boat' && (b.z || 0) === (o.z || 0) && Math.abs(b.x - o.x) <= 2 && Math.abs(b.y - o.y) <= 2);
          const canPay = p.res.gold >= 1000 && p.res.wood >= 10;
          return { type: 'choice', obj: o, title: 'Корабостроителница', text: 'Тук може да се построи кораб за 1000 злато и 10 дърво.' + (near ? ' На брега вече има кораб.' : '') + (canPay ? '' : ' Нямаш достатъчно ресурси.'), options: [
            { label: 'Построй кораб (1000 злато, 10 дърво)', disabled: !canPay || near, apply: () => { const r = this.buildBoatAt(o, h.owner, 2); this.events.push({ type: 'msg', text: r.ok ? 'Корабът е готов и чака на брега.' : r.why }); } },
            { label: 'Откажи', apply: () => {} }
          ], aiPick: () => (!near && canPay && !this.players[h.owner].heroes.some((id) => this.heroes[id].boat) ? 0 : 1) };
        }
        case 'lighthouse': { if (o.owner === h.owner) return null; o.owner = h.owner; p.heroes.forEach((id) => { const hh = this.heroes[id]; if (hh.boat) hh.maxMovement = this.computeMaxMovement(hh); }); return msg('Фарът е твой: +500 движение по вода за корабите ти.', 'flag'); }
        case 'dwelling': { o.owner = h.owner; return { type: 'dwelling', obj: o, hero: h }; }
        case 'windmill': { if (o.takenWeek === this.week()) return msg('Мелницата вече е дала своето тази седмица.'); o.takenWeek = this.week(); const res = this.rng.pick(['mercury', 'sulfur', 'crystal', 'gems', 'ore', 'wood']); const n = this.rng.int(3, 6); p.res[res] += n; return msg('Мелничарят ти дава ' + n + ' ' + D.RES_NAME[res].toLowerCase() + '.', 'pickup'); }
        case 'watermill': { if (o.takenWeek === this.week()) return msg('Водната мелница вече е платила тази седмица.'); o.takenWeek = this.week(); const g = this.week() === 1 ? 500 : 1000; p.res.gold += g; return msg('Водната мелница ти носи ' + g + ' злато.', 'pickup'); }
        case 'learning': if (!once('learn' + o.id)) return msg('Камъкът вече ти е дал знанието си.'); this.gainXp(h, 1000); return msg('Камъкът на познанието те дарява с 1000 опит.', 'xp');
        case 'obelisk': if (p.visited['ob' + o.id]) return msg('Древни знаци, които вече си разчел.'); p.visited['ob' + o.id] = true; this.gainXp(h, 250); return msg('Разчиташ древните знаци. +250 опит.', 'xp');
        case 'rally': if (!once('rally' + o.id + 'w' + this.week())) return msg('Знамето вече те е вдъхновило тази седмица.'); h.moraleTmp = 1; h.luckTmp = 1; h.movement += 400; return msg('Знамето на сбора: +1 морал, +1 късмет за следващата битка и +400 движение.', 'buff');
        case 'mercenary': if (!once('merc' + o.id)) return msg('Наемниците вече са те обучили.'); h.att++; return msg('Наемниците те обучават: +1 атака.', 'stat');
        case 'tower_def': if (!once('tdef' + o.id)) return msg('Стражите вече са те обучили.'); h.def++; return msg('Стражите те учат да се защитаваш: +1 защита.', 'stat');
        case 'star_axis': if (!once('star' + o.id)) return msg('Звездите вече са ти говорили.'); h.pow++; return msg('Звездите ти шепнат: +1 сила.', 'stat');
        case 'garden': if (!once('gard' + o.id)) return msg('Градината вече ти е дала прозрение.'); h.know++; h.mana = Math.min(this.maxMana(h), h.mana + 10); return msg('Прозрение в градината: +1 познание.', 'stat');
        case 'campfire': { const g = this.rng.int(4, 6) * 100, res = this.rng.pick(['wood', 'ore', 'mercury', 'sulfur', 'crystal', 'gems']), n = this.rng.int(4, 6); p.res.gold += g; p.res[res] += n; this.removeObject(o); return msg('Край огъня намираш ' + g + ' злато и ' + n + ' ' + D.RES_NAME[res].toLowerCase() + '.', 'pickup'); }
        case 'shrine1': case 'shrine2': case 'shrine3': {
          const s = D.spellById[o.spell];
          if (o.type === 'shrine3' && this.skillLevel(h, 'wisdom') < 1) return msg('Магията „' + s.name + '“ е твърде сложна без Мъдрост.');
          if (h.spells.includes(s.id)) return msg('Вече знаеш магията „' + s.name + '“.');
          h.spells.push(s.id); return msg('Научаваш магията „' + s.name + '“.', 'spell');
        }
        case 'tree_knowledge': {
          if (!once('tree' + o.id)) return msg('Дървото вече те е научило.');
          const gold = o.price === 'gold', have = gold ? p.res.gold >= 2000 : p.res.gems >= 10;
          if (!have) { h.visited['tree' + o.id] = false; return msg('Дървото иска ' + (gold ? '2000 злато' : '10 скъпоценни камъка') + ', а ти нямаш.'); }
          const nextXp = D.LEVEL_XP[h.level + 1] - h.xp;
          return { type: 'choice', obj: o, title: 'Дърво на познанието', text: 'Дървото ще те издигне с едно ниво срещу ' + (gold ? '2000 злато' : '10 скъпоценни камъка') + '.', options: [
            { label: 'Плати', apply: () => { if (gold) p.res.gold -= 2000; else p.res.gems -= 10; this.gainXp(h, Math.max(1, nextXp)); } },
            { label: 'Отказ', apply: () => { h.visited['tree' + o.id] = false; } }
          ], aiPick: () => 0 };
        }
        case 'magic_well': { if (h.visited['well' + o.id] === this.day) return msg('Днес вече пи от кладенеца.'); h.visited['well' + o.id] = this.day; h.mana = Math.max(h.mana, this.maxMana(h)); return msg('Кладенецът възстановява маната ти.', 'buff'); }
        case 'wagon': {
          if (o.empty) return msg('Каруцата е празна.');
          o.empty = true;
          if (this.rng.chance(0.5)) { const a = this.rng.pick(D.ARTIFACTS.filter((a) => a.cls <= 2)); this.equipArtifact(h, a.id); return msg('В каруцата намираш ' + a.name + '. ' + a.desc, 'artifact'); }
          const res = this.rng.pick(['wood', 'ore', 'mercury', 'sulfur', 'crystal', 'gems']), n = this.rng.int(3, 8); p.res[res] += n; return msg('В каруцата намираш ' + n + ' ' + D.RES_NAME[res].toLowerCase() + '.', 'pickup');
        }
        case 'fountain': if (!once('fount' + o.id + 'd' + this.day)) return null; h.luckTmp = Math.max(h.luckTmp, 1); return msg('Изворът те дарява с късмет: +1 за следващата битка.', 'buff');
        case 'idol': if (!once('idol' + o.id + 'd' + this.day)) return null; h.moraleTmp = Math.max(h.moraleTmp, 1); if (this.dayOfWeek() === 7) h.luckTmp = Math.max(h.luckTmp, 1); return msg('Идолът повдига духа: +1 морал' + (this.dayOfWeek() === 7 ? ' и +1 късмет' : '') + ' за следващата битка.', 'buff');
        case 'stables': if (h.moveTmpWeek === this.week()) return msg('Конете ти вече са отпочинали.'); h.moveTmpWeek = this.week(); h.moveTmp = 400; h.movement += 400; h.maxMovement += 400; return msg('Свежи коне: +400 движение до края на седмицата.', 'buff');
        case 'sanctuary': return msg('Убежище. Тук никой не може да те нападне.');
        case 'school_war': case 'school_magic': {
          if (!once('school' + o.id)) return msg('Вече си учил тук.');
          if (p.res.gold < 1000) { h.visited['school' + o.id] = false; return msg('Обучението струва 1000 злато.'); }
          const war = o.type === 'school_war';
          return { type: 'choice', obj: o, title: D.OBJECTS[o.type].name, text: 'Срещу 1000 злато учителите ще подобрят едно от уменията ти.', options: [
            { label: '+1 ' + (war ? 'атака' : 'сила'), apply: () => { p.res.gold -= 1000; if (war) h.att++; else h.pow++; } },
            { label: '+1 ' + (war ? 'защита' : 'познание'), apply: () => { p.res.gold -= 1000; if (war) h.def++; else h.know++; } },
            { label: 'Отказ', apply: () => { h.visited['school' + o.id] = false; } }
          ], aiPick: () => (p.res.gold > 5000 ? 0 : 2) };
        }
        case 'library': {
          if (!once('lib' + o.id)) return msg('Прочел си всичко тук.');
          if (p.res.gold < 500) { h.visited['lib' + o.id] = false; return msg('Достъпът струва 500 злато.'); }
          p.res.gold -= 500; let n = 0; D.SPELLS.filter((s) => s.level === 1).forEach((s) => { if (!h.spells.includes(s.id)) { h.spells.push(s.id); n++; } });
          return msg('Научаваш ' + n + ' нови магии от 1-во ниво.', 'spell');
        }
        case 'monolith': case 'gate': case 'whirlpool': {
          const pair = this.objById(o.pair);
          if (!pair || this.heroAt(pair.x, pair.y, pair.z)) return msg('Порталът мълчи.');
          h.x = pair.x; h.y = pair.y; h.z = pair.z || 0;
          this.revealAround(h.owner, h.x, h.y, h.z, this.sightRadius(h));
          if (o.type === 'whirlpool') { // водовъртежът отнася част от най-слабия стек
            let wi = -1, wv = Infinity; h.army.forEach((s, i) => { if (s) { const v = s.n * D.fightValue(D.creatureOf(s.c)); if (v < wv) { wv = v; wi = i; } } });
            if (wi >= 0 && h.army[wi].n > 1 && Army.count(h.army) > 1) { const lost = Math.floor(h.army[wi].n / 2); h.army[wi].n -= lost; return msg('Водовъртежът те изхвърля другаде. Загубени: ' + lost + ' × ' + D.creatureOf(h.army[wi].c).name + '.', 'buff'); }
            return msg('Водовъртежът те изхвърля на друго място.', 'buff');
          }
          return msg(o.type === 'gate' ? (h.z ? 'Слизаш в подземието.' : 'Излизаш на повърхността.') : 'Монолитът те пренася през пространството.', 'buff');
        }
      }
      return null;
    }

    // ---------------------------------------------------------- битки
    startBattle(attHero, def) {
      const ctx = { type: 'battle', kind: def.type, attacker: { hero: attHero, army: attHero.army, owner: attHero.owner }, defender: null };
      if (def.type === 'monster') {
        const o = def.obj, g = def.guardOf ? o.guard : o;
        const army = Army.empty();
        if (g.stacks) g.stacks.forEach((s) => Army.add(army, s.creature, s.count)); else Army.add(army, g.creature, g.count);
        ctx.guardOf = !!def.guardOf;
        ctx.defender = { hero: null, army, owner: -1, obj: o };
      } else if (def.type === 'hero') {
        ctx.defender = { hero: def.hero, army: def.hero.army, owner: def.hero.owner };
        const t = this.townOfHero(def.hero);
        if (t) { ctx.town = t; ctx.kind = 'town'; ctx.defender.garrison = t.garrison; }
      } else if (def.type === 'town') {
        const t = def.town;
        const vis = t.visitor ? this.heroes[t.visitor] : null;
        ctx.town = t;
        if (vis) ctx.defender = { hero: vis, army: vis.army, owner: t.owner, garrison: t.garrison };
        else ctx.defender = { hero: null, army: t.garrison, owner: t.owner, isGarrison: true };
        if (Army.isEmpty(ctx.defender.army) && (!ctx.defender.garrison || Army.isEmpty(ctx.defender.garrison))) {
          this.captureTown(t, attHero);
          return { type: 'enterTown', town: t, hero: attHero, captured: true, learned: this.learnTownSpells(attHero, t) };
        }
      }
      return ctx;
    }
    /* r: {winner, retreated, surrendered, surrenderCost, attKills, defKills, attHpKilled, defHpKilled}
       attKills/attHpKilled = убитите ОТ нападателя; defKills/defHpKilled = убитите ОТ защитника */
    resolveBattle(ctx, r) {
      const a = ctx.attacker, d = ctx.defender;
      const attHero = a.hero, defHero = d.hero;
      const events = [];
      Army.clean(a.army); Army.clean(d.army); if (d.garrison) Army.clean(d.garrison);
      const attWon = r.winner === 'att';
      if (attWon && attHero) {
        const xp = this.gainXp(attHero, r.attHpKilled);
        events.push({ type: 'battleResult', win: true, hero: attHero, xp, text: 'Победа! ' + attHero.name + ' получава ' + xp + ' опит.' });
        this.necromancy(attHero, r.attKills);
      } else if (!attWon && defHero) {
        const xp = this.gainXp(defHero, r.defHpKilled);
        events.push({ type: 'battleResult', win: false, hero: defHero, xp, text: defHero.name + ' отблъсква нападението и получава ' + xp + ' опит.' });
        this.necromancy(defHero, r.defKills);
      } else if (!attWon) {
        events.push({ type: 'battleResult', win: false, hero: attHero, xp: 0, text: attHero ? attHero.name + ' е разбит.' : 'Нападението е отблъснато.' });
      }
      const loserHero = attWon ? defHero : attHero, winnerHero = attWon ? attHero : defHero;
      const loserSide = attWon ? 1 : 0;
      if (attWon) {
        if (ctx.kind === 'monster') { if (ctx.guardOf) delete d.obj.guard; else this.removeObject(d.obj); }
        if (ctx.town) { if (d.garrison) d.garrison.forEach((s, i) => { d.garrison[i] = null; }); }
      }
      if (loserHero) {
        if (r.surrendered === loserSide) {
          const p = this.players[loserHero.owner]; p.res.gold -= r.surrenderCost || 0;
          this.retreatHero(loserHero, true);
          events.push({ type: 'msg', text: loserHero.name + ' се предава срещу ' + (r.surrenderCost || 0) + ' злато и запазва армията си. Ще го намериш в таверна.' });
        } else if (r.retreated === loserSide) {
          loserHero.army = Army.empty();
          this.retreatHero(loserHero, false);
          events.push({ type: 'msg', text: loserHero.name + ' отстъпва и ще може да бъде нает отново в таверна.' });
        } else {
          if (winnerHero) this.transferArtifacts(loserHero, winnerHero);
          this.removeHero(loserHero);
        }
      }
      if (attWon && ctx.town) { this.captureTown(ctx.town, attHero); events.push({ type: 'enterTown', town: ctx.town, hero: attHero, captured: true, learned: this.learnTownSpells(attHero, ctx.town) }); }
      if (!attWon && ctx.kind === 'monster' && d.obj) { const g = ctx.guardOf ? d.obj.guard : d.obj; g.count = Army.count(d.army); if (g.stacks) { g.stacks = d.army.filter((s) => s && s.n > 0).map((s) => ({ creature: s.c, count: s.n })); if (g.stacks.length) { g.creature = g.stacks[0].creature; g.count = g.stacks[0].count; } } if (g.count <= 0) { if (ctx.guardOf) delete d.obj.guard; else this.removeObject(d.obj); } }
      if (attHero && this.heroes[attHero.id]) this.revealAround(attHero.owner, attHero.x, attHero.y, attHero.z, this.sightRadius(attHero));
      this.events.push(...events);
      const v = this.checkVictory();
      if (v) this.events.push({ type: 'victory', player: v.id });
      return events;
    }
    necromancy(h, kills) {
      const lvl = this.skillLevel(h, 'necromancy');
      if (!lvl || !kills) return;
      const n = Math.floor(kills * [0, 0.1, 0.2, 0.3][lvl] * this.skillMult(h, 'necromancy'));
      if (n > 0) { const cid = h.army.some((s) => s && s.c === 'necropolis1u') ? 'necropolis1u' : 'necropolis1'; if (!Army.add(h.army, cid, n)) this.events.push({ type: 'msg', text: 'Некромантия: ' + n + ' скелети се присъединяват към ' + h.name + '.' }); }
    }
    transferArtifacts(from, to) {
      if (!to) return;
      from.arts.forEach((aid) => { if (aid) this.equipArtifact(to, aid); });
      from.backpack.forEach((aid) => this.equipArtifact(to, aid));
    }
    retreatHero(h, keepArmy) {
      const p = this.players[h.owner];
      const army = keepArmy ? Army.clone(h.army) : this.rollStartArmy(h.faction);
      this.removeHero(h);
      if (p.towns.length) {
        const t = this.towns[this.rng.pick(p.towns)];
        this.tavernHeroes(t);
        t.tavern.unshift({ faction: h.faction, cls: h.cls, name: h.name, portrait: h.portrait, army, spec: h.spec, keep: { level: h.level, xp: h.xp, att: h.att, def: h.def, pow: h.pow, know: h.know, skills: h.skills, spells: h.spells, arts: h.arts, backpack: h.backpack, mana: h.mana } });
      }
    }
    captureTown(t, hero) {
      if (t.owner >= 0) { const old = this.players[t.owner]; old.towns = old.towns.filter((id) => id !== t.id); }
      if (t.visitor && this.heroes[t.visitor] && this.heroes[t.visitor].owner !== hero.owner) this.removeHero(this.heroes[t.visitor]);
      t.visitor = null;
      t.owner = hero.owner;
      this.players[hero.owner].towns.push(t.id);
      if (hero.boat) { this.addObject({ type: 'boat', x: hero.x, y: hero.y, z: hero.z, owner: hero.owner }); hero.boat = false; }
      hero.x = t.x; hero.y = t.y; hero.z = t.z; hero.inTown = t.id; t.visitor = hero.id;
      this.players[hero.owner].daysWithoutTown = 0;
      if (t.buildings.hall4) { const p = this.players[hero.owner]; if (p.towns.some((id) => id !== t.id && this.towns[id].buildings.hall4)) delete t.buildings.hall4; }
      this.revealAround(hero.owner, t.x, t.y, t.z, 6);
    }

    // ---------------------------------------------------------- сейв
    toJSON() {
      const m = this.map;
      return {
        v: 2, seed: this.seed, rngState: this.rng.s, difficulty: this.difficulty, template: this.template, day: this.day, curPlayer: this.curPlayer, nextId: this.nextId, weekName: this.weekName,
        heroes: this.heroes, towns: this.towns,
        players: this.players.map((p) => Object.assign({}, p, { fog: p.fog.map((f) => Array.from(f)) })),
        map: { w: m.w, h: m.h, levels: m.levels.map((L) => ({ terrain: Array.from(L.terrain), road: Array.from(L.road), block: Array.from(L.block) })), objects: m.objects, starts: m.starts }
      };
    }
    static fromJSON(j) {
      if (j.v !== 2) throw new Error('Стар формат на сейва.');
      const w = new World();
      Object.assign(w, { seed: j.seed, difficulty: j.difficulty, template: j.template, day: j.day, curPlayer: j.curPlayer, nextId: j.nextId, weekName: j.weekName, heroes: j.heroes, towns: j.towns });
      w.rng = new MK.RNG(j.seed); w.rng.s = j.rngState;
      w.players = j.players.map((p) => Object.assign({}, p, { fog: p.fog.map((f) => Uint8Array.from(f)) }));
      const m = j.map;
      w.map = { w: m.w, h: m.h, levels: m.levels.map((L) => ({ terrain: Uint8Array.from(L.terrain), road: Uint8Array.from(L.road), block: Uint8Array.from(L.block), objAt: new Int32Array(m.w * m.h).fill(-1) })), objects: m.objects, starts: m.starts };
      m.objects.forEach((o) => { w.map.levels[o.z || 0].objAt[o.y * m.w + o.x] = o.id; });
      for (const id in w.heroes) { const h = w.heroes[id]; h._native = undefined; h._fly = w.hasArt(h, 'flyMove'); }
      return w;
    }
  }
  MK.World = World;
})();
