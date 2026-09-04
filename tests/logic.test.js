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
      // Свързаност: от първия град до всеки обект има път (пренебрегвайки чудовища)
      const h = w.heroes[w.players[0].heroes[0]];
      const fake = { x: h.x, y: h.y, skills: {}, army: h.army, owner: 0 };
      const saveBlock = w.blocksPassage; w.blocksPassage = () => false;
      let unreachable = 0;
      w.map.objects.forEach((o) => { if (o.x === h.x && o.y === h.y) return; const r = MK.Path.findPath(w, fake, o.x, o.y, 200000); if (!r) unreachable++; });
      w.blocksPassage = saveBlock;
      assert(unreachable <= Math.floor(w.map.objects.length * 0.02), 'недостижими обекти: ' + unreachable + ' от ' + w.map.objects.length);
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
  assert(b.siege === 2 && b.towers.length === 1 && b.walls.size === 8);
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
  let battles = 0;
  for (let day = 0; day < 30 * 3; day++) {
    const p = w.cur();
    if (p.alive) {
      const gen = MK.AI.turn(w, p, { autoAll: true });
      let r = gen.next();
      while (!r.done) { if (r.value.type === 'battle') { battles++; throw new Error('не трябва да има човешка битка'); } r = gen.next(); }
    }
    w.endTurn();
    w.events.length = 0;
  }
  assert(w.day >= 30, 'ден ' + w.day);
  const built = w.players.reduce((s, p) => s + p.towns.reduce((s2, tid) => s2 + Object.keys(w.towns[tid].buildings).length, 0), 0);
  assert(built > 12, 'сгради ' + built);
  const heroes = Object.values(w.heroes);
  assert(heroes.some((h) => h.level > 1), 'някой герой е вдигнал ниво');
  const mines = w.map.objects.filter((o) => o.type === 'mine' && o.owner >= 0).length;
  assert(mines >= 3, 'превзети мини ' + mines);
});
console.log(passed + ' теста общо');
