/* Светът на играта: играчи, герои, градове, дни и седмици, доход, движение,
   посещение на обекти, набиране, строене, опит и нива, сейв/лоуд. */
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
    // Добавя същества; връща колко не са се вместили
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
    // Преместване/размяна/сливане между два слота (може и между две армии)
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
    // Кои фракции присъстват (за морал)
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
      w.day = 1;
      w.curPlayer = 0;
      w.nextId = 1;
      w.heroes = {};
      w.towns = {};
      w.players = opts.players.map((p, i) => ({
        id: i, faction: p.faction, human: !!p.human, color: D.PLAYER_COLORS[i].col, colorName: D.PLAYER_COLORS[i].name,
        res: Object.assign({}, D.DIFFICULTY[w.difficulty][p.human ? 'start' : 'ai']),
        heroes: [], towns: [], alive: true, daysWithoutTown: 0, visited: {}, fog: null
      }));
      w.map = MK.MapGen.generate({ seed: w.seed, size: opts.size, players: opts.players });
      w.players.forEach((p) => { p.fog = new Uint8Array(w.map.w * w.map.h); });
      // Градовете от картата стават реални обекти
      w.map.objects.forEach((o) => {
        if (o.type === 'town') w.createTown(o);
        if (o.type === 'resource') o.amount = w.resourceAmount(o.res);
        if (o.type === 'dwelling') o.available = D.creatureOf(o.creature).growth;
        if (o.type.startsWith('shrine')) o.spell = w.rng.pick(D.SPELLS.filter((s) => s.level === +o.type.slice(-1))).id;
        if (o.type === 'tree_knowledge') o.price = w.rng.pick(['gold', 'gems']);
        if (o.type === 'windmill' || o.type === 'watermill') o.takenWeek = 0;
      });
      // Стартови герои
      w.players.forEach((p, i) => {
        const town = w.towns[p.towns[0]];
        const h = w.createHero(p.faction, i, town.x, town.y, true);
        h.inTown = town.id; town.visitor = h.id;
        w.revealAround(i, town.x, town.y, 6);
        w.revealAround(i, h.x, h.y, w.sightRadius(h));
      });
      w.day = 0; w.newDay(); // ден 1 с доход и точки за движение
      return w;
    }

    // ---------------------------------------------------------- помощни
    idx(x, y) { return y * this.map.w + x; }
    inb(x, y) { return x >= 0 && y >= 0 && x < this.map.w && y < this.map.h; }
    objectAt(x, y) { if (!this.inb(x, y)) return null; const id = this.map.objAt[this.idx(x, y)]; return id < 0 ? null : this.objById(id); }
    objById(id) { if (!this._objIndex) this.reindexObjects(); return this._objIndex.get(id) || null; }
    reindexObjects() { this._objIndex = new Map(); this.map.objects.forEach((o) => this._objIndex.set(o.id, o)); }
    removeObject(o) {
      const i = this.map.objects.indexOf(o);
      if (i >= 0) this.map.objects.splice(i, 1);
      if (this.map.objAt[this.idx(o.x, o.y)] === o.id) this.map.objAt[this.idx(o.x, o.y)] = -1;
      this._objIndex && this._objIndex.delete(o.id);
    }
    heroAt(x, y) { for (const id in this.heroes) { const h = this.heroes[id]; if (h.x === x && h.y === y) return h; } return null; }
    // Пречи ли плочката за минаване (не като крайна цел)
    blocksPassage(x, y, hero) {
      const o = this.objectAt(x, y);
      if (o) return true; // всеки обект е крайна цел, не се минава през него
      const h = this.heroAt(x, y);
      if (h && h !== hero) return true;
      return false;
    }
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
    revealAround(pi, x, y, r) {
      const fog = this.players[pi].fog;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r + r) continue;
        const nx = x + dx, ny = y + dy;
        if (this.inb(nx, ny)) fog[this.idx(nx, ny)] = 1;
      }
    }
    isRevealed(pi, x, y) { return this.players[pi].fog[this.idx(x, y)] === 1; }
    sightRadius(h) { return 5 + (h.skills.scouting || 0) + this.artBonus(h, 'scouting'); }

    // ---------------------------------------------------------- градове
    createTown(o) {
      const t = {
        id: this.nextId++, name: o.name, faction: o.faction, owner: o.owner, x: o.x, y: o.y,
        buildings: { hall1: true }, builtToday: false, avail: [0, 0, 0, 0, 0, 0, 0, 0],
        garrison: Army.empty(), visitor: null, spells: { 1: [], 2: [], 3: [], 4: [], 5: [] }
      };
      o.townId = t.id;
      if (o.owner >= 0) {
        t.buildings.fort1 = true; t.buildings.dw1 = true; t.buildings.tavern = true;
        if (this.rng.chance(0.5)) t.buildings.dw2 = true;
        this.players[o.owner].towns.push(t.id);
      } else if (o.neutralGuard) {
        // Неутрален град с гарнизон
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
    hasBuilding(t, id) { return !!t.buildings[id]; }
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
    setTownAvail(t, initial) {
      for (let tier = 1; tier <= 7; tier++) if (t.buildings['dw' + tier]) t.avail[tier] += this.growthOf(t, tier);
    }
    canBuild(t, id) {
      const b = D.buildingFor(t.faction, id);
      if (t.buildings[id]) return { ok: false, why: 'Вече е построено.' };
      if (t.builtToday) return { ok: false, why: 'Днес вече е строено в този град.' };
      for (const r of b.req) if (!t.buildings[r]) return { ok: false, why: 'Нужно е: ' + D.buildingFor(t.faction, r).name + '.' };
      if (id === 'hall4') {
        const p = this.players[t.owner];
        if (p.towns.some((tid) => this.towns[tid].buildings.hall4)) return { ok: false, why: 'Вече имаш Капитолий.' };
      }
      const p = this.players[t.owner];
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
      if (b.tier && !b.upg) t.avail[b.tier] += this.growthOf(t, b.tier); // веднага първи набор
      if (id.startsWith('mage')) this.generateGuildSpells(t, +id.slice(4));
      // ако в града има герой — учи новите магии
      if (t.visitor && this.heroes[t.visitor]) this.learnTownSpells(this.heroes[t.visitor], t);
      return { ok: true };
    }
    generateGuildSpells(t, level) {
      const used = new Set(); for (let l = 1; l <= 5; l++) t.spells[l].forEach((s) => used.add(s));
      const pool = this.rng.shuffle(D.SPELLS.filter((s) => s.level === level && !used.has(s.id)));
      t.spells[level] = pool.slice(0, D.GUILD_SLOTS[level]).map((s) => s.id);
    }
    learnTownSpells(h, t) {
      const ml = this.mageLevel(t);
      const wis = h.skills.wisdom || 0;
      let learned = [];
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
    // Набор от град: tier, подобрени ли, брой; армията-цел (гарнизон или герой)
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
    // Подобряване на стек в град (цената е разликата)
    upgradeStack(t, army, i) {
      const sl = army[i]; if (!sl) return { ok: false };
      const c = D.creatureOf(sl.c);
      const u = D.upgradeOf(c);
      if (!u || c.faction !== t.faction || !t.buildings['dw' + c.tier + 'u']) return { ok: false, why: 'Тук не може да се подобри.' };
      const p = this.players[t.owner];
      const cost = {}; for (const k in u.cost) cost[k] = (u.cost[k] - (c.cost[k] || 0)) * sl.n;
      if (!this.canAfford(p, cost)) return { ok: false, why: 'Недостатъчно ресурси.' };
      this.pay(p, cost); sl.c = u.id;
      return { ok: true };
    }
    upgradeCost(t, army, i) {
      const sl = army[i]; if (!sl) return null;
      const c = D.creatureOf(sl.c); const u = D.upgradeOf(c);
      if (!u || c.faction !== t.faction || !t.buildings['dw' + c.tier + 'u']) return null;
      const cost = {}; for (const k in u.cost) cost[k] = (u.cost[k] - (c.cost[k] || 0)) * sl.n;
      return cost;
    }
    marketRate(p) { // колко единици даваш за 1 (за не-злато); злато: колко злато за 1 ресурс
      let n = 0; p.towns.forEach((tid) => { if (this.towns[tid].buildings.market) n++; });
      return Math.max(1, n);
    }
    // Курс: колко "from" за 1 "to"
    tradeRate(p, from, to) {
      const val = { gold: 1, wood: 50, ore: 50, mercury: 100, sulfur: 100, crystal: 100, gems: 100 };
      const m = this.marketRate(p);
      const base = val[to] / val[from];
      const fee = [0, 10, 5, 4, 3, 2.5, 2, 1.8, 1.6, 1.5][Math.min(m, 9)];
      if (from === 'gold') return Math.ceil(val[to] * fee / 2);          // злато за 1 ресурс
      if (to === 'gold') return Math.max(1, Math.floor(val[from] / fee)); // злато за 1 ресурс (получаваш)
      return Math.max(1, Math.ceil(base * fee / 2));
    }
    trade(p, from, to, amount) {
      if (from === to) return false;
      if (to === 'gold') { const r = this.tradeRate(p, from, to); if (p.res[from] < amount) return false; p.res[from] -= amount; p.res.gold += r * amount; return true; }
      const r = this.tradeRate(p, from, to); // from за 1 to
      const give = r * amount;
      if (p.res[from] < give) return false;
      p.res[from] -= give; p.res[to] += amount; return true;
    }
    // Наемане на герой в таверна
    tavernHeroes(t) {
      if (!t.tavern || t.tavernWeek !== this.week()) {
        t.tavernWeek = this.week();
        const f1 = t.faction, f2 = this.rng.pick(D.FACTIONS.filter((f) => f.id !== f1)).id;
        t.tavern = [this.rollHero(f1), this.rollHero(f2)];
      }
      return t.tavern;
    }
    rollHero(faction) {
      const f = D.factionById(faction);
      const cls = this.rng.pick(f.classes);
      const used = new Set(Object.values(this.heroes).map((h) => h.name));
      const names = D.HERO_NAMES[faction].filter((n) => !used.has(n));
      return { faction, cls, name: names.length ? this.rng.pick(names) : this.rng.pick(D.HERO_NAMES[faction]) + ' II', portrait: this.rng.int(0, 5), army: this.rollStartArmy(faction) };
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
      h.inTown = t.id; t.visitor = h.id;
      t.tavern.splice(i, 1);
      this.learnTownSpells(h, t);
      this.revealAround(t.owner, h.x, h.y, this.sightRadius(h));
      return { ok: true, hero: h };
    }

    // ---------------------------------------------------------- герои
    createHero(faction, owner, x, y, isStart, proto) {
      proto = proto || this.rollHero(faction);
      const cls = D.CLASSES[proto.cls];
      const h = {
        id: this.nextId++, name: proto.name, cls: proto.cls, faction, owner, x, y, portrait: proto.portrait,
        level: 1, xp: 0, att: cls.start[0], def: cls.start[1], pow: cls.start[2], know: cls.start[3],
        skills: {}, spells: [], mana: 0, movement: 0, maxMovement: 0,
        army: proto.army || this.rollStartArmy(faction), arts: D.SLOTS.map(() => null), backpack: [],
        visited: {}, moraleTmp: 0, luckTmp: 0, moveTmp: 0, moveTmpWeek: 0, inTown: null, pendingLevels: 0, sleeping: false
      };
      cls.skills.forEach((s) => { h.skills[s] = 1; });
      if (cls.magic) { h.spells.push('magic_arrow'); }
      if (isStart && this.rng.chance(0.5)) h.spells.push(this.rng.pick(['haste', 'slow', 'bless', 'curse', 'shield', 'stone_skin', 'cure']));
      h.mana = this.maxMana(h);
      this.heroes[h.id] = h;
      this.players[owner].heroes.push(h.id);
      this.resetMovement(h);
      return h;
    }
    artBonus(h, key) {
      let s = 0;
      h.arts.forEach((aid) => { if (aid && D.artById[aid].bonus[key]) s += D.artById[aid].bonus[key]; });
      return s;
    }
    stat(h, k) { return Math.max(0, h[k] + this.artBonus(h, k)); }
    maxMana(h) { return Math.floor(this.stat(h, 'know') * 10 * (1 + [0, 0.25, 0.5, 1][h.skills.intelligence || 0])); }
    // Морал/късмет на героя (без бойните модификатори за фракции)
    heroMorale(h) { return (h.skills.leadership || 0) + this.artBonus(h, 'morale') + h.moraleTmp; }
    heroLuck(h) { return (h.skills.luck || 0) + this.artBonus(h, 'luck') + h.luckTmp; }
    static armyNativeTerrain(h) {
      const fs = Army.factions(h.army);
      if (fs.size !== 1) return -1;
      const f = D.factionById([...fs][0]);
      return f ? f.terrain : -1;
    }
    computeMaxMovement(h) {
      let m = D.baseMovement(Army.minSpeed(h.army));
      m = Math.floor(m * (1 + [0, 0.1, 0.2, 0.3][h.skills.logistics || 0]));
      m += this.artBonus(h, 'moveBonus');
      if (h.moveTmpWeek === this.week()) m += h.moveTmp;
      return m;
    }
    resetMovement(h) { h.maxMovement = this.computeMaxMovement(h); h.movement = h.maxMovement; h._native = undefined; }
    gainXp(h, xp) {
      xp = Math.round(xp * (1 + [0, 0.05, 0.1, 0.15][h.skills.learning || 0]));
      h.xp += xp;
      const nl = D.levelForXp(h.xp);
      while (h.level < nl) { h.level++; h.pendingLevels++; }
      return xp;
    }
    // Подготовка на едно повишение: първичен атрибут + предложени умения
    rollLevelUp(h) {
      const cls = D.CLASSES[h.cls];
      const probs = h.level <= 9 ? cls.p1 : cls.p2;
      const w = {}; D.PRIMARY.forEach((k, i) => { w[k] = probs[i]; });
      const stat = this.rng.weighted(w);
      // умения: едно за подобрение (ако има), едно ново (ако има място)
      const upgradable = Object.keys(h.skills).filter((s) => h.skills[s] < 3);
      const weights = D.CLASS_SKILL_WEIGHTS[h.cls];
      const newCands = Object.keys(D.SKILLS).filter((s) => !h.skills[s] && (s !== 'necromancy' || h.faction === 'necropolis'));
      const offers = [];
      const nSkills = Object.keys(h.skills).length;
      if (upgradable.length) offers.push(this.rng.pick(upgradable));
      if (nSkills < 8 && newCands.length) {
        const w2 = {}; newCands.forEach((s) => { w2[s] = weights[s] || 1; });
        offers.push(this.rng.weighted(w2));
      } else if (upgradable.length > 1) {
        const rest = upgradable.filter((s) => s !== offers[0]);
        offers.push(this.rng.pick(rest));
      }
      return { stat, offers };
    }
    applyLevelUp(h, roll, skillChoice) {
      h[roll.stat]++;
      if (skillChoice) h.skills[skillChoice] = (h.skills[skillChoice] || 0) + 1;
      h.pendingLevels = Math.max(0, h.pendingLevels - 1);
      const mm = this.maxMana(h); if (roll.stat === 'know') h.mana = Math.min(mm, h.mana + 10);
      h._native = undefined;
    }
    // ИИ/автоматично повишение
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
      for (let i = 0; i < D.SLOTS.length; i++) if (D.SLOTS[i] === a.slot && !h.arts[i]) { h.arts[i] = aid; h._native = undefined; return true; }
      h.backpack.push(aid); return false;
    }
    unequip(h, i) { const a = h.arts[i]; if (!a) return; h.arts[i] = null; h.backpack.push(a); }
    equipFromBackpack(h, bi) {
      const aid = h.backpack[bi]; if (!aid) return false;
      const a = D.artById[aid];
      let slot = -1;
      for (let i = 0; i < D.SLOTS.length; i++) if (D.SLOTS[i] === a.slot && !h.arts[i]) { slot = i; break; }
      if (slot < 0) for (let i = 0; i < D.SLOTS.length; i++) if (D.SLOTS[i] === a.slot) { slot = i; break; }
      if (slot < 0) return false;
      h.backpack.splice(bi, 1);
      if (h.arts[slot]) h.backpack.push(h.arts[slot]);
      h.arts[slot] = aid; return true;
    }
    removeHero(h) {
      const p = this.players[h.owner];
      p.heroes = p.heroes.filter((id) => id !== h.id);
      if (h.inTown && this.towns[h.inTown] && this.towns[h.inTown].visitor === h.id) this.towns[h.inTown].visitor = null;
      delete this.heroes[h.id];
    }
    // Всички същества на героя са роден терен → без наказание; ползва се от pathfind
    heroStrength(h) { return Army.strength(h.army) * (1 + this.stat(h, 'att') * 0.05 + this.stat(h, 'def') * 0.05); }

    // ---------------------------------------------------------- ход и дни
    endTurn() {
      // следващ жив играч; ако няма — нов ден
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
      // Героите на играча виждат наоколо
      p.heroes.forEach((id) => { const h = this.heroes[id]; this.revealAround(p.id, h.x, h.y, this.sightRadius(h)); });
      p.towns.forEach((id) => { const t = this.towns[id]; this.revealAround(p.id, t.x, t.y, 6); });
    }
    newDay() {
      this.day++;
      const newWeek = this.dayOfWeek() === 1;
      const newMonth = (this.day - 1) % 28 === 0 && this.day > 1;
      this.players.forEach((p) => {
        if (!p.alive) return;
        // Доход
        let gold = 0;
        p.towns.forEach((tid) => { const t = this.towns[tid]; gold += this.townIncome(t); t.builtToday = false; if (t.buildings.silo) p.res[D.factionById(t.faction).rare] += 1; });
        this.map.objects.forEach((o) => { if (o.type === 'mine' && o.owner === p.id) { const m = D.MINES.find((m) => m.res === o.res); p.res[o.res] += m.amount; } });
        p.heroes.forEach((hid) => {
          const h = this.heroes[hid];
          gold += [0, 125, 250, 500][h.skills.estates || 0] + this.artBonus(h, 'goldIncome');
          // мана
          const inGuild = h.inTown && this.mageLevel(this.towns[h.inTown]) > 0;
          const mm = this.maxMana(h);
          h.mana = inGuild ? mm : Math.min(mm, h.mana + 1 + [0, 2, 3, 4][h.skills.mysticism || 0] + this.artBonus(h, 'manaRegen'));
          this.resetMovement(h);
          h.sleeping = h.sleeping && true;
        });
        p.res.gold += gold;
        // Загуба без градове
        if (p.towns.length === 0) { p.daysWithoutTown++; if (p.daysWithoutTown > 7) this.eliminate(p, 'Седем дни без град — кралството се разпада.'); }
        else p.daysWithoutTown = 0;
      });
      if (newWeek) {
        for (const id in this.towns) {
          const t = this.towns[id];
          if (t.owner >= 0 || t.garrison.some((s) => s)) this.setTownAvail(t);
        }
        this.map.objects.forEach((o) => {
          if (o.type === 'dwelling') o.available += D.creatureOf(o.creature).growth;
          if (o.type === 'monster' && o.growth) o.count += Math.max(1, Math.floor(o.count * 0.1));
        });
        this.weekName = this.rollWeekName();
        this.log('Нова седмица: ' + this.weekName, 'week');
      }
      if (newMonth) this.log('Нов месец!', 'week');
    }
    rollWeekName() {
      const names = ['на гарвана', 'на лисицата', 'на елена', 'на бухала', 'на вълка', 'на мечката', 'на щуреца', 'на дъба', 'на реката', 'на мъглата', 'на меда', 'на желязото'];
      return this.rng.pick(names);
    }
    eliminate(p, why) {
      if (!p.alive) return;
      p.alive = false;
      p.heroes.slice().forEach((id) => this.removeHero(this.heroes[id]));
      p.towns.slice().forEach((tid) => { this.towns[tid].owner = -1; });
      p.towns = [];
      this.events.push({ type: 'eliminated', player: p.id, text: (p.human ? 'Вие сте победени. ' : D.PLAYER_COLORS[p.id].name + ' играч е победен. ') + (why || '') });
    }
    checkVictory() {
      this.players.forEach((p) => { if (p.alive && !p.towns.length && !p.heroes.length) this.eliminate(p, 'Нито градове, нито герои.'); });
      const alive = this.players.filter((p) => p.alive);
      if (alive.length === 1) return alive[0];
      return null;
    }

    // ---------------------------------------------------------- движение
    /* Прави една стъпка по пътя. Връща:
       {ok:true} — стъпил; {stop:true, why} — не може; {event} — битка/посещение и спира */
    stepHero(h, x, y, isFinal) {
      const diag = h.x !== x && h.y !== y;
      const cost = MK.Path.tileCost(this, h, x, y, diag);
      if (cost === Infinity) return { stop: true, why: 'Непроходимо.' };
      if (h.movement < cost) return { stop: true, why: 'Няма точки за движение.' };
      const target = this.objectAt(x, y);
      const other = this.heroAt(x, y);
      // Излизане от град
      if (h.inTown) { const t = this.towns[h.inTown]; if (t.visitor === h.id) t.visitor = null; h.inTown = null; }
      // Герой на целта
      if (other && other !== h) {
        h.movement -= cost;
        if (other.owner === h.owner) return { event: { type: 'meet', hero: h, other } };
        return { event: this.startBattle(h, { type: 'hero', hero: other }) };
      }
      if (target && target.type === 'monster') {
        h.movement -= cost;
        return { event: this.startBattle(h, { type: 'monster', obj: target }) };
      }
      if (target && target.type === 'town') {
        const t = this.towns[target.townId];
        if (t.owner === h.owner) {
          if (t.visitor && t.visitor !== h.id) return { stop: true, why: 'В града вече има герой.' };
          h.movement -= cost; h.x = x; h.y = y; h.inTown = t.id; t.visitor = h.id;
          this.revealAround(h.owner, x, y, this.sightRadius(h));
          const learned = this.learnTownSpells(h, t);
          return { event: { type: 'enterTown', town: t, hero: h, learned } };
        }
        h.movement -= cost;
        return { event: this.startBattle(h, { type: 'town', town: t }) };
      }
      // Обикновена стъпка
      h.movement -= cost; h.x = x; h.y = y;
      this.revealAround(h.owner, x, y, this.sightRadius(h));
      // Пазачи наоколо: чудовище в съседство напада
      for (let d = 0; d < 8; d++) {
        const o = this.objectAt(x + MK.DIRS[d][0], y + MK.DIRS[d][1]);
        if (o && o.type === 'monster') return { event: this.startBattle(h, { type: 'monster', obj: o, ambush: true }) };
      }
      if (target) {
        const ev = this.visit(h, target);
        if (ev) return { event: ev };
      }
      return { ok: true };
    }

    // ---------------------------------------------------------- посещения
    visit(h, o) {
      const p = this.players[h.owner];
      const once = (key) => { if (h.visited[key]) return false; h.visited[key] = true; return true; };
      const msg = (text, kind) => ({ type: 'visit', obj: o, text, kind: kind || 'info' });
      switch (o.type) {
        case 'resource': {
          p.res[o.res] += o.amount; const t = D.RES_NAME[o.res] + ': +' + o.amount; this.removeObject(o); return msg(t, 'pickup');
        }
        case 'chest': {
          const r = this.rng.int(0, 2); const gold = [1000, 1500, 2000][r], xp = [500, 1000, 1500][r];
          this.removeObject(o);
          return { type: 'choice', obj: o, title: 'Сандък със съкровище', text: 'Намираш сандък. Какво ще вземеш?', options: [
            { label: gold + ' злато', apply: () => { p.res.gold += gold; } },
            { label: xp + ' опит', apply: () => { this.gainXp(h, xp); } }
          ], aiPick: () => (h.level < 6 ? 1 : 0) };
        }
        case 'artifact': {
          const a = D.artById[o.art]; this.removeObject(o); this.equipArtifact(h, o.art);
          return msg('Намираш артефакт: ' + a.name + '. ' + a.desc, 'artifact');
        }
        case 'mine': {
          if (o.owner === h.owner) return null;
          o.owner = h.owner; const m = D.MINES.find((m) => m.res === o.res);
          return msg(m.name + ' е вече твоя: +' + m.amount + ' ' + D.RES_NAME[o.res].toLowerCase() + ' на ден.', 'flag');
        }
        case 'dwelling': {
          o.owner = h.owner;
          return { type: 'dwelling', obj: o, hero: h };
        }
        case 'windmill': {
          if (o.takenWeek === this.week()) return msg('Мелницата вече е дала своето тази седмица.');
          o.takenWeek = this.week(); const res = this.rng.pick(['mercury', 'sulfur', 'crystal', 'gems', 'ore', 'wood']); const n = this.rng.int(3, 6);
          p.res[res] += n; return msg('Мелничарят ти дава ' + n + ' ' + D.RES_NAME[res].toLowerCase() + '.', 'pickup');
        }
        case 'watermill': {
          if (o.takenWeek === this.week()) return msg('Водната мелница вече е платила тази седмица.');
          o.takenWeek = this.week(); const g = this.week() === 1 ? 500 : 1000; p.res.gold += g; return msg('Водната мелница ти носи ' + g + ' злато.', 'pickup');
        }
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
          if (o.type === 'shrine3' && !(h.skills.wisdom >= 1)) return msg('Магията „' + s.name + '“ е твърде сложна без Мъдрост.');
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
        case 'monolith': {
          const pair = this.objById(o.pair);
          if (!pair || this.heroAt(pair.x, pair.y)) return msg('Порталът мълчи.');
          h.x = pair.x; h.y = pair.y; this.revealAround(h.owner, h.x, h.y, this.sightRadius(h));
          return msg('Монолитът те пренася през пространството.', 'buff');
        }
      }
      return null;
    }

    // ---------------------------------------------------------- битки
    /* Създава контекст на битка; резултатът се прилага с resolveBattle */
    startBattle(attHero, def) {
      const ctx = { type: 'battle', kind: def.type, attacker: { hero: attHero, army: attHero.army, owner: attHero.owner }, defender: null };
      if (def.type === 'monster') {
        const o = def.obj;
        const army = Army.empty(); Army.add(army, o.creature, o.count);
        ctx.defender = { hero: null, army, owner: -1, obj: o };
        ctx.ambush = !!def.ambush;
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
          // Празен град — пада без бой
          this.captureTown(t, attHero);
          return { type: 'enterTown', town: t, hero: attHero, captured: true, learned: this.learnTownSpells(attHero, t) };
        }
      }
      return ctx;
    }
    /* Резултат: {winner:'att'|'def', retreated:bool, attKills, defKills (брой убити същества),
       attHpKilled, defHpKilled, attArmy, defArmy (крайни армии), garrison} */
    resolveBattle(ctx, r) {
      const a = ctx.attacker, d = ctx.defender;
      const attHero = a.hero, defHero = d.hero;
      const events = [];
      // Армиите са редактирани на място от битката (същите обекти)
      Army.clean(a.army); Army.clean(d.army); if (d.garrison) Army.clean(d.garrison);
      const attWon = r.winner === 'att';
      // Опит
      if (attWon && attHero) {
        let xp = r.defHpKilled + (defHero ? 500 : 0);
        xp = this.gainXp(attHero, xp);
        events.push({ type: 'battleResult', win: true, hero: attHero, xp, text: 'Победа! ' + attHero.name + ' получава ' + xp + ' опит.' });
        this.necromancy(attHero, r.defKills);
      } else if (!attWon && defHero) {
        let xp = r.attHpKilled + (attHero ? 500 : 0);
        xp = this.gainXp(defHero, xp);
        events.push({ type: 'battleResult', win: false, hero: defHero, xp, text: defHero.name + ' отблъсква нападението и получава ' + xp + ' опит.' });
        this.necromancy(defHero, r.attKills);
      } else if (!attWon) {
        events.push({ type: 'battleResult', win: false, hero: attHero, xp: 0, text: attHero ? attHero.name + ' е разбит.' : 'Нападението е отблъснато.' });
      }
      // Съдба на губещия
      if (attWon) {
        if (ctx.kind === 'monster') { this.removeObject(d.obj); }
        if (defHero) { this.transferArtifacts(defHero, attHero); this.removeHero(defHero); }
        if (ctx.town) { if (d.garrison) d.garrison.forEach((s, i) => { d.garrison[i] = null; }); this.captureTown(ctx.town, attHero); events.push({ type: 'enterTown', town: ctx.town, hero: attHero, captured: true, learned: this.learnTownSpells(attHero, ctx.town) }); }
        if (attHero && Army.isEmpty(attHero.army)) { /* невъзможно при победа */ }
      } else {
        if (attHero) {
          if (r.retreated) {
            // Отстъпление: героят се връща в таверна (губи армията)
            attHero.army = Army.empty();
            this.retreatHero(attHero);
            events.push({ type: 'msg', text: attHero.name + ' отстъпва и ще може да бъде нает отново в таверна.' });
          } else {
            if (defHero) this.transferArtifacts(attHero, defHero);
            this.removeHero(attHero);
          }
        }
        if (ctx.kind === 'monster' && d.obj) { d.obj.count = Army.count(d.army); if (d.obj.count <= 0) this.removeObject(d.obj); }
      }
      if (attHero && this.heroes[attHero.id]) this.revealAround(attHero.owner, attHero.x, attHero.y, this.sightRadius(attHero));
      this.events.push(...events);
      const v = this.checkVictory();
      if (v) this.events.push({ type: 'victory', player: v.id });
      return events;
    }
    necromancy(h, kills) {
      const lvl = h.skills.necromancy || 0;
      if (!lvl || !kills) return;
      const n = Math.floor(kills * [0, 0.1, 0.2, 0.3][lvl]);
      if (n > 0) { const cid = h.army.some((s) => s && s.c === 'necropolis1u') ? 'necropolis1u' : 'necropolis1'; if (!Army.add(h.army, cid, n)) this.events.push({ type: 'msg', text: 'Некромантия: ' + n + ' скелети се присъединяват към ' + h.name + '.' }); }
    }
    transferArtifacts(from, to) {
      if (!to) return;
      from.arts.forEach((aid) => { if (aid) this.equipArtifact(to, aid); });
      from.backpack.forEach((aid) => this.equipArtifact(to, aid));
    }
    retreatHero(h) {
      // Става наличен в таверна на произволен град на играча (или изчезва)
      const p = this.players[h.owner];
      this.removeHero(h);
      if (p.towns.length) {
        const t = this.towns[this.rng.pick(p.towns)];
        this.tavernHeroes(t);
        t.tavern.unshift({ faction: h.faction, cls: h.cls, name: h.name, portrait: h.portrait, army: this.rollStartArmy(h.faction), keep: { level: h.level, xp: h.xp, att: h.att, def: h.def, pow: h.pow, know: h.know, skills: h.skills, spells: h.spells } });
      }
    }
    captureTown(t, hero) {
      if (t.owner >= 0) { const old = this.players[t.owner]; old.towns = old.towns.filter((id) => id !== t.id); }
      if (t.visitor && this.heroes[t.visitor] && this.heroes[t.visitor].owner !== hero.owner) { this.removeHero(this.heroes[t.visitor]); }
      t.visitor = null;
      t.owner = hero.owner;
      this.players[hero.owner].towns.push(t.id);
      hero.x = t.x; hero.y = t.y; hero.inTown = t.id; t.visitor = hero.id;
      if (hero.owner >= 0) this.players[hero.owner].daysWithoutTown = 0;
      // Капитолий само един — при превземане пада до кметство
      if (t.buildings.hall4) { const p = this.players[hero.owner]; if (p.towns.some((id) => id !== t.id && this.towns[id].buildings.hall4)) { delete t.buildings.hall4; } }
      this.revealAround(hero.owner, t.x, t.y, 6);
    }

    // ---------------------------------------------------------- сейв
    toJSON() {
      const m = this.map;
      return {
        v: 1, seed: this.seed, rngState: this.rng.s, difficulty: this.difficulty, day: this.day, curPlayer: this.curPlayer, nextId: this.nextId, weekName: this.weekName,
        heroes: this.heroes, towns: this.towns,
        players: this.players.map((p) => Object.assign({}, p, { fog: Array.from(p.fog) })),
        map: { w: m.w, h: m.h, terrain: Array.from(m.terrain), road: Array.from(m.road), block: Array.from(m.block), objects: m.objects, starts: m.starts }
      };
    }
    static fromJSON(j) {
      const w = new World();
      Object.assign(w, { seed: j.seed, difficulty: j.difficulty, day: j.day, curPlayer: j.curPlayer, nextId: j.nextId, weekName: j.weekName, heroes: j.heroes, towns: j.towns });
      w.rng = new MK.RNG(j.seed); w.rng.s = j.rngState;
      w.players = j.players.map((p) => Object.assign({}, p, { fog: Uint8Array.from(p.fog) }));
      const m = j.map;
      w.map = { w: m.w, h: m.h, terrain: Uint8Array.from(m.terrain), road: Uint8Array.from(m.road), block: Uint8Array.from(m.block), objects: m.objects, starts: m.starts, objAt: new Int32Array(m.w * m.h).fill(-1) };
      m.objects.forEach((o) => { w.map.objAt[o.y * m.w + o.x] = o.id; });
      for (const id in w.heroes) w.heroes[id]._native = undefined;
      return w;
    }
  }
  World.armyNativeTerrain = World.armyNativeTerrain;
  MK.World = World;
})();
