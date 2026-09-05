/* Тестове на логиката: генерация, свързаност, път, битки, дни, сейв. Пуска се с `node tests/logic.test.js` */
const assert = require('assert');
const MK = require('./harness');
const D = MK.data;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('  ok  ' + name); } catch (e) { console.log('FAIL  ' + name + '\n' + (e.stack || e)); process.exitCode = 1; } }

function newWorld(seed, size, n) {
  const players = [{ faction: 'kingdom', human: true }, { faction: 'necropolis', human: false }];
  if (n >= 3) players.push({ faction: 'grove', human: false });
  if (n >= 4) players.push({ faction: 'kingdom', human: false });
  return MK.World.create({ seed, size: size || 36, players, difficulty: 1 });
}

test('данни: 42 фракционни същества, всички с подобрения', () => {
  D.FACTIONS.forEach((f) => { for (let t = 1; t <= 7; t++) { assert(D.creatureById[f.id + t], f.id + t); assert(D.creatureById[f.id + t + 'u'], f.id + t + 'u'); } });
  assert.strictEqual(D.LEVEL_XP[2], 1000); assert.strictEqual(D.LEVEL_XP[12], 20600); assert(D.LEVEL_XP[13] > 24000);
  assert.strictEqual(D.levelForXp(999), 1); assert.strictEqual(D.levelForXp(1000), 2); assert.strictEqual(D.levelForXp(3200), 4);
});

test('всяка сграда има валидни изисквания', () => {
  D.BUILDINGS.forEach((b) => (b.req || []).forEach((r) => assert(D.buildingById[r], b.id + ' -> ' + r)));
  const b = D.buildingFor('kingdom', 'dw7'); assert(b.cost.gems === 10 && b.name === 'Небесна порта');
});

for (const [size, n] of [[36, 2], [54, 3], [72, 4]]) {
  test('карта ' + size + ' с ' + n + ' играчи: градове, мини, свързаност', () => {
    for (let seed = 1; seed <= 3; seed++) {
      const w = newWorld(seed * 977, size, n);
      const towns = Object.values(w.towns);
      assert(towns.length >= n, 'градове');
      w.players.forEach((p) => { assert.strictEqual(p.towns.length, 1); assert.strictEqual(p.heroes.length, 1); });
      // Свързаност по нива: от първия град (повърхност) и от първата порта (подземие) до всеки сухоземен обект има път
      const h = w.heroes[w.players[0].heroes[0]];
      const saveBlock = w.blocksPassage; w.blocksPassage = () => false;
      const sea = new Set(['boat', 'sea_chest', 'shipwreck', 'whirlpool']);
      for (let z = 0; z < w.map.levels.length; z++) {
        const start = z === 0 ? h : w.map.objects.find((o) => o.type === 'gate' && o.z === 1);
        const fake = { x: start.x, y: start.y, z, skills: {}, army: h.army, owner: 0 };
        const objs = w.map.objects.filter((o) => (o.z || 0) === z && !sea.has(o.type));
        let unreachable = 0;
        objs.forEach((o) => { if (o.x === start.x && o.y === start.y) return; const r = MK.Path.findPath(w, fake, o.x, o.y, 200000); if (!r) unreachable++; });
        assert(unreachable <= Math.floor(objs.length * 0.02), 'ниво ' + z + ': недостижими обекти: ' + unreachable + ' от ' + objs.length);
      }
      w.blocksPassage = saveBlock;
      const mines = w.map.objects.filter((o) => o.type === 'mine');
      assert(mines.length >= n * 3, 'мини ' + mines.length);
    }
  });
}

test('път: цена по терен и точки за движение', () => {
  const w = newWorld(5, 36, 2);
  const h = w.heroes[w.players[0].heroes[0]];
  assert(h.movement >= 1500 && h.movement <= 2600, 'движение ' + h.movement);
  const reach = MK.Path.reachable(w, h, h.movement);
  assert(reach.size > 20, 'достижими плочки ' + reach.size);
  let far = null; reach.forEach((c, i) => { if (!far || c > far.c) far = { i, c }; });
  const tx = far.i % w.map.w, ty = Math.floor(far.i / w.map.w);
  const p = MK.Path.findPath(w, h, tx, ty);
  assert(p && Math.abs(p.total - far.c) < 1, 'A* и Дейкстра съвпадат: ' + (p && p.total) + ' vs ' + far.c);
});

test('стъпки: героят излиза от града и събира ресурс', () => {
  const w = newWorld(11, 36, 2);
  const h = w.heroes[w.players[0].heroes[0]];
  const res = w.map.objects.filter((o) => o.type === 'resource').sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
  const p = MK.Path.findPath(w, h, res.x, res.y);
  assert(p, 'има път до ресурса');
  const before = w.players[0].res[res.res];
  let ev = null;
  for (const st of p.path) { const r = w.stepHero(h, st.x, st.y); if (r.event) { ev = r.event; break; } if (r.stop) break; }
  if (ev && ev.type === 'visit') assert(w.players[0].res[res.res] > before, 'ресурсът е взет');
  else assert(ev && ev.type === 'battle', 'или битка с пазач: ' + JSON.stringify(ev && ev.type));
});

test('битка: формула за щети и край', () => {
  const w = newWorld(3, 36, 2);
  const h = w.heroes[w.players[0].heroes[0]];
  const att = { hero: h, army: MK.Army.empty(), owner: 0 }; MK.Army.add(att.army, 'kingdom1', 30); MK.Army.add(att.army, 'kingdom2', 10);
  const def = { hero: null, army: MK.Army.empty(), owner: -1 }; MK.Army.add(def.army, 'necropolis1', 20);
  const b = new MK.Battle({ attacker: att, defender: def, world: w, seed: 42, kind: 'monster' });
  assert.strictEqual(b.stacks.length, 3);
  const pk = b.stacks[0], sk = b.stacks[2];
  // 30 копиеносци (атака 4+герой) срещу скелет (защита 4)
  const r = b.calcDamage(pk, sk, { ranged: false, luckRoll: false });
  assert(r.dmg >= 30 && r.dmg <= 30 * 3 * 4, 'щети ' + r.dmg);
  const res = b.runAuto();
  assert(b.finished && (res.winner === 'att' || res.winner === 'def'));
  assert(res.rounds >= 1 && res.rounds < 60);
  assert(b.log.length > 3);
});

test('битка: 100 ангели винаги бият 10 скелета', () => {
  const w = newWorld(3, 36, 2);
  const att = { hero: null, army: MK.Army.empty(), owner: 0 }; MK.Army.add(att.army, 'kingdom7u', 100);
  const def = { hero: null, army: MK.Army.empty(), owner: -1 }; MK.Army.add(def.army, 'necropolis1', 10);
  const b = new MK.Battle({ attacker: att, defender: def, world: w, seed: 7, kind: 'monster' });
  const res = b.runAuto();
  assert.strictEqual(res.winner, 'att'); assert.strictEqual(res.rounds, 1);
  assert.strictEqual(def.army[0].n, 0); assert.strictEqual(att.army[0].n, 100);
});

test('битка: магии — мълния убива, ускорение вдига скоростта', () => {
  const w = newWorld(3, 36, 2);
  const h = w.heroes[w.players[0].heroes[0]];
  h.spells = ['lightning', 'haste']; h.pow = 5; h.mana = 50;
  const att = { hero: h, army: MK.Army.empty(), owner: 0 }; MK.Army.add(att.army, 'kingdom1', 5);
  const def = { hero: null, army: MK.Army.empty(), owner: -1 }; MK.Army.add(def.army, 'necropolis1', 30);
  const b = new MK.Battle({ attacker: att, defender: def, world: w, seed: 9, kind: 'monster' });
  b.nextTurn();
  const sk = b.stacks.find((s) => s.side === 1);
  const r = b.doCast(0, 'lightning', sk.x, sk.y);
  assert(r.ok, 'мълния'); assert.strictEqual(sk.count, 30 - Math.floor(135 / 6) === 8 ? 8 : sk.count); assert(sk.count < 30);
  assert(!b.canCast(0), 'една магия на рунд');
  assert.strictEqual(h.mana, 40);
  b.startRound();
  const pk = b.stacks[0];
  const sp0 = b.speed(pk);
  assert(b.doCast(0, 'haste', pk.x, pk.y).ok);
  assert.strictEqual(b.speed(pk), sp0 + 3);
});

test('обсада: стени и кули', () => {
  const w = newWorld(3, 36, 2);
  const t = w.towns[w.players[1].towns[0]];
  t.buildings.fort2 = true; MK.Army.add(t.garrison, 'necropolis2', 20);
  const h = w.heroes[w.players[0].heroes[0]];
  const ctx = w.startBattle(h, { type: 'town', town: t });
  ctx.world = w; ctx.seed = 5;
  const b = new MK.Battle(ctx);
  assert(b.siege === 2 && b.towers.length === 1 && b.walls.size === 10 && b.moat.size === 10 && b.isGateIntact());
  const res = b.runAuto();
  assert(b.finished);
});

test('ден/седмица: доход, растеж, точки за движение', () => {
  const w = newWorld(21, 36, 2);
  const p = w.players[0];
  const g0 = p.res.gold;
  const t = w.towns[p.towns[0]];
  const a1 = t.avail[1];
  w.endTurn(); // ИИ ход (без ИИ модул само сменя)
  w.endTurn(); // нов ден
  assert.strictEqual(w.day, 2);
  assert.strictEqual(p.res.gold, g0 + 500);
  for (let i = 0; i < 12; i++) w.endTurn();
  assert.strictEqual(w.day, 8);
  assert(t.avail[1] > a1, 'растеж');
  // строене
  const r = w.build(t, 'market'); assert(r.ok, r.why);
  assert(!w.build(t, 'tavern').ok, 'едно строене на ден');
  assert(!w.canBuild(t, 'hall3').ok);
});

test('набор и подобрение', () => {
  const w = newWorld(8, 36, 2);
  const p = w.players[0]; const t = w.towns[p.towns[0]]; const h = w.heroes[p.heroes[0]];
  p.res.gold = 100000;
  const n = t.avail[1];
  const r = w.recruit(t, 1, false, 999, h.army);
  assert(r.ok && r.n === n, 'набрани ' + r.n);
  assert.strictEqual(t.avail[1], 0);
  t.buildings.dw1u = true;
  const i = h.army.findIndex((s) => s && s.c === 'kingdom1');
  assert(w.upgradeStack(t, h.army, i).ok);
  assert.strictEqual(h.army[i].c, 'kingdom1u');
});

test('ниво нагоре: атрибут и умение', () => {
  const w = newWorld(8, 36, 2);
  const h = w.heroes[w.players[0].heroes[0]];
  const sum = () => h.att + h.def + h.pow + h.know;
  const s0 = sum();
  w.gainXp(h, 3200);
  assert.strictEqual(h.level, 4); assert.strictEqual(h.pendingLevels, 3);
  w.autoLevelUp(h);
  assert.strictEqual(sum(), s0 + 3);
  assert(Object.keys(h.skills).length >= 2);
});

test('пазар: курс и обмен', () => {
  const w = newWorld(8, 36, 2);
  const p = w.players[0]; const t = w.towns[p.towns[0]]; t.buildings.market = true;
  p.res.wood = 20; const g = p.res.gold;
  assert(w.trade(p, 'wood', 'gold', 10));
  assert(p.res.wood === 10 && p.res.gold > g);
  const rate = w.tradeRate(p, 'gold', 'ore');
  assert(rate > 0);
  const o = p.res.ore; assert(w.trade(p, 'gold', 'ore', 2)); assert.strictEqual(p.res.ore, o + 2);
});

test('сейв/лоуд запазва света', () => {
  const w = newWorld(77, 36, 2);
  const j = JSON.parse(JSON.stringify(w.toJSON()));
  const w2 = MK.World.fromJSON(j);
  assert.strictEqual(Object.keys(w2.heroes).length, Object.keys(w.heroes).length);
  assert.strictEqual(w2.map.objects.length, w.map.objects.length);
  const h = w2.heroes[w2.players[0].heroes[0]];
  assert(w2.objectAt(h.x, h.y).type === 'town');
});

console.log('\n' + passed + ' теста минаха' + (process.exitCode ? ', има провалени' : ''));

test('ИИ: 30 дни симулация без грешки, строи и се движи', () => {
  const w = newWorld(31, 36, 3);
  w.players[0].human = false; // всички ИИ
  let battles = 0, maxLevel = 1;
  for (let day = 0; day < 30 * 3; day++) {
    const p = w.cur();
    if (p.alive) {
      const gen = MK.AI.turn(w, p, { autoAll: true });
      let r = gen.next();
      while (!r.done) { if (r.value.type === 'battle') { battles++; throw new Error('не трябва да има човешка битка'); } r = gen.next(); }
    }
    Object.values(w.heroes).forEach((h) => { maxLevel = Math.max(maxLevel, h.level); });
    w.endTurn();
    w.events.length = 0;
  }
  assert(w.day >= 30, 'ден ' + w.day);
  const built = w.players.reduce((s, p) => s + p.towns.reduce((s2, tid) => s2 + Object.keys(w.towns[tid].buildings).length, 0), 0);
  assert(built > 12, 'сгради ' + built);
  assert(maxLevel > 1, 'някой герой е вдигнал ниво');
  const mines = w.map.objects.filter((o) => o.type === 'mine' && o.owner >= 0).length;
  assert(mines >= 3, 'превзети мини ' + mines);
});


test('фаза 2: 11 фракции × 14 същества, класове, имена, двухексови', () => {
  assert.strictEqual(D.FACTIONS.length, 11);
  D.FACTIONS.forEach((f) => { for (let t = 1; t <= 7; t++) { assert(D.creatureById[f.id + t] && D.creatureById[f.id + t + 'u'], f.id + t); } f.classes.forEach((c) => assert(D.CLASSES[c], c)); assert(D.HERO_NAMES[f.id].length >= 8); assert.strictEqual(f.dwellings.length, 7); assert.strictEqual(f.dwellingsU.length, 7); });
  assert(D.CREATURES.filter((c) => c.wide).length > 30);
  for (const k in D.ART_SETS) D.ART_SETS[k].parts.forEach((p) => assert(D.artById[p], p));
});

test('подземие: порти по двойки, свързаност, герой минава през порта', () => {
  const w = MK.World.create({ seed: 4242, size: 54, players: [{ faction: 'dungeon', human: true }, { faction: 'kingdom' }], difficulty: 1, template: D.TEMPLATE('underworld') });
  assert(w.hasUnderground());
  const gates = w.map.objects.filter((o) => o.type === 'gate');
  assert(gates.length >= 4 && gates.length % 2 === 0, 'порти ' + gates.length);
  gates.forEach((g) => { const pair = w.objById(g.pair); assert(pair && pair.z !== g.z); });
  const h = w.heroes[w.players[0].heroes[0]];
  const g0 = gates.find((g) => g.z === 0);
  h.x = g0.x; h.y = g0.y - 1; h.z = 0; h.inTown = null; h.movement = 2000;
  if (w.objectAt(h.x, h.y, 0) || w.isWater(h.x, h.y, 0)) { h.x = g0.x - 1; }
  const r = w.stepHero(h, g0.x, g0.y);
  assert(r.event && r.event.type === 'visit', JSON.stringify(r));
  assert.strictEqual(h.z, 1, 'героят е в подземието');
  assert(w.map.objects.filter((o) => o.z === 1 && o.type === 'mine').length >= 3);
});

test('кораби: качване, плаване, слизане; острови имат кораби', () => {
  const w = MK.World.create({ seed: 77, size: 54, players: [{ faction: 'harbor', human: true }, { faction: 'kingdom' }], difficulty: 1, template: D.TEMPLATE('islands') });
  const boats = w.map.objects.filter((o) => o.type === 'boat');
  assert(boats.length >= 2, 'кораби ' + boats.length);
  const h = w.heroes[w.players[0].heroes[0]];
  const boat = boats.find((b) => b.owner === 0);
  assert(boat, 'играчът има кораб');
  const p = MK.Path.findPath(w, h, boat.x, boat.y);
  assert(p, 'има път до кораба');
  h.movement = 99999;
  let ev = null;
  for (const st of p.path) { const r = w.stepHero(h, st.x, st.y); if (r.event) { ev = r.event; break; } if (r.stop) break; }
  assert(h.boat, 'героят е на кораб'); assert.strictEqual(h.movement, 0);
  w.resetMovement(h);
  assert(h.maxMovement >= 1500, 'морско движение ' + h.maxMovement);
  // намираме вода до брега и слизаме
  const reach = MK.Path.reachable(w, h, h.movement);
  let land = null; reach.forEach((c, i) => { const x = i % w.map.w, y = Math.floor(i / w.map.w); if (!land && !w.isWater(x, y, 0) && !w.objectAt(x, y, 0) && !w.heroAt(x, y, 0)) land = { x, y }; });
  assert(land, 'има бряг в обхват');
  const p2 = MK.Path.findPath(w, h, land.x, land.y); assert(p2, 'път до брега');
  for (const st of p2.path) { const r = w.stepHero(h, st.x, st.y); if (r.event || r.stop) break; }
  assert(!h.boat && h.x === land.x && h.y === land.y, 'слязъл на брега');
  assert(w.map.objects.some((o) => o.type === 'boat' && o.owner === 0), 'корабът остава във водата');
});

test('битка: двухексови същества заемат два хекса и се бият', () => {
  const w = newWorld(3, 36, 2);
  const att = { hero: null, army: MK.Army.empty(), owner: 0 }; MK.Army.add(att.army, 'horde7u', 5); MK.Army.add(att.army, 'kingdom6u', 10);
  const def = { hero: null, army: MK.Army.empty(), owner: -1 }; MK.Army.add(def.army, 'dungeon7u', 3); MK.Army.add(def.army, 'academy1', 50);
  const b = new MK.Battle({ attacker: att, defender: def, world: w, seed: 11, kind: 'monster' });
  const wide = b.stacks.filter((s) => s.wide);
  assert.strictEqual(wide.length, 3);
  wide.forEach((s) => { const hs = b.hexes(s); assert.strictEqual(hs.length, 2); hs.forEach(([x, y]) => assert.strictEqual(b.occupant(x, y), s)); });
  const res = b.runAuto();
  assert(b.finished && res.rounds >= 1);
});

test('обсада: катапултът разбива порта/стени, ров', () => {
  const w = newWorld(3, 36, 2);
  const t = w.towns[w.players[1].towns[0]];
  t.buildings.fort2 = true; t.buildings.fort3 = true; MK.Army.add(t.garrison, 'necropolis2', 5);
  const h = w.heroes[w.players[0].heroes[0]]; MK.Army.add(h.army, 'kingdom4u', 60);
  const ctx = w.startBattle(h, { type: 'town', town: t }); ctx.world = w; ctx.seed = 5;
  const b = new MK.Battle(ctx);
  assert(b.siege === 3 && b.towers.length === 3 && b.isGateIntact());
  for (let i = 0; i < 6 && b.isGateIntact() && b.rubble.size === 0; i++) b.startRound();
  assert(!b.isGateIntact() || b.rubble.size > 0, 'катапултът пробива');
});

test('предаване и дипломация', () => {
  const w = newWorld(7, 36, 2);
  const h1 = w.heroes[w.players[0].heroes[0]], h2 = w.heroes[w.players[1].heroes[0]];
  const ctx = w.startBattle(h1, { type: 'hero', hero: h2 }); ctx.world = w; ctx.seed = 1;
  const b = new MK.Battle(ctx); b.nextTurn();
  assert(b.canSurrender(0)); const cost = b.surrenderCost(0); assert(cost > 0);
  assert(b.doSurrender(0)); w.resolveBattle(ctx, b.result());
  assert(!w.heroes[h1.id], 'героят е напуснал картата'); assert(w.players[0].res.gold < 20000);
  const t = w.towns[w.players[0].towns[0]]; assert((t.tavern || []).some((x) => x.keep && x.army.some((s) => s)), 'героят чака в таверната с армията си');
  // дипломация: силна армия + умение → предложение
  h2.skills.diplomacy = 3; MK.Army.add(h2.army, 'necropolis7u', 50);
  const mon = { type: 'monster', creature: 'kingdom1', count: 5, disposition: 5, x: 1, y: 1, z: 0, id: 99999 };
  const offer = w.diplomacyOffer(h2, mon);
  assert(offer && offer.type === 'choice' && /безплатно/.test(offer.text), JSON.stringify(offer && offer.text));
});

test('специалности, комплекти и умения от артефакти', () => {
  const w = newWorld(8, 36, 2);
  const h = w.heroes[w.players[0].heroes[0]];
  assert(h.spec && D.SPECIALTY_KINDS.includes(h.spec.kind));
  h.arts = D.SLOTS.map(() => null);
  ['dawn_helm', 'dawn_plate', 'dawn_shield', 'dawn_blade'].forEach((a) => w.equipArtifact(h, a));
  assert.strictEqual(w.heroSets(h).length, 1);
  assert(w.artBonus(h, 'att') >= 3 + 3 && w.artBonus(h, 'morale') === 1);
  w.equipArtifact(h, 'archers_glove'); assert.strictEqual(w.skillLevel(h, 'archery'), Math.min(3, (h.skills.archery || 0) + 1));
  w.equipArtifact(h, 'tome_fire'); assert(w.heroSpells(h).includes('armageddon'));
});

test('кампания: сценарии и пренасяне на герой', () => {
  assert.strictEqual(MK.CAMPAIGN.scenarios.length, 5);
  const sc = MK.CAMPAIGN.scenarios[1];
  const carry = { name: 'Тест', cls: 'knight', portrait: 1, level: 7, xp: 8000, att: 6, def: 5, pow: 2, know: 2, skills: { leadership: 3, offense: 2 }, spells: ['haste'], arts: D.SLOTS.map(() => null), backpack: [], spec: { kind: 'skill', id: 'offense' } };
  const w = MK.World.create({ size: sc.size, difficulty: sc.difficulty, players: [{ faction: sc.playerFaction, human: true }].concat(sc.opponents.map((f) => ({ faction: f }))), template: D.TEMPLATE(sc.template), seed: 5, carryHero: { carry, faction: sc.playerFaction, cls: carry.cls, name: carry.name, portrait: 1, spec: carry.spec } });
  const h = w.heroes[w.players[0].heroes[0]];
  assert.strictEqual(h.name, 'Тест'); assert.strictEqual(h.level, 7); assert.strictEqual(h.skills.leadership, 3);
  assert.strictEqual(w.players.length, 3);
});

test('сейв/лоуд с нива и кораби', () => {
  const w = MK.World.create({ seed: 4242, size: 54, players: [{ faction: 'dungeon', human: true }, { faction: 'kingdom' }], difficulty: 1, template: D.TEMPLATE('underworld') });
  const j = JSON.parse(JSON.stringify(w.toJSON()));
  const w2 = MK.World.fromJSON(j);
  assert.strictEqual(w2.map.levels.length, 2);
  assert.strictEqual(w2.players[0].fog.length, 2);
  const gate = w2.map.objects.find((o) => o.type === 'gate' && o.z === 1);
  assert.strictEqual(w2.objectAt(gate.x, gate.y, 1), gate);
});

test('ИИ: 25 дни с 11 фракции на подземна карта без грешки', () => {
  const players = ['academy', 'inferno', 'marsh', 'workshop'].map((f) => ({ faction: f }));
  const w = MK.World.create({ seed: 313, size: 54, players, difficulty: 2, template: D.TEMPLATE('underworld') });
  for (let d = 0; d < 25 * 4; d++) { const p = w.cur(); if (p.alive) { const gen = MK.AI.turn(w, p, { autoAll: true }); let r = gen.next(); while (!r.done) r = gen.next(); } w.endTurn(); w.events.length = 0; }
  assert(w.day >= 25);
  assert(Object.values(w.heroes).length > 0);
});
console.log(passed + ' теста общо');
