/* Генератор на случайни карти: шаблони, зони по Вороной, гори/планини по шум, вода и острови,
   подземно ниво с порти, гарантирана свързаност, градове, мини, ресурси, пазачи по разстояние. */
(function () {
  'use strict';
  const MK = (window.MK = window.MK || {});
  const D = MK.data;

  function newLevel(N) {
    return { terrain: new Uint8Array(N * N), road: new Uint8Array(N * N), block: new Uint8Array(N * N), objAt: new Int32Array(N * N).fill(-1) };
  }

  function generate(opts) {
    const rng = new MK.RNG(opts.seed);
    const N = opts.size;
    const players = opts.players; // [{faction, human}]
    const T = opts.template || D.TEMPLATES[0];
    const hasUnder = T.underground && N >= 54 || T.undergroundRich;
    const map = { w: N, h: N, levels: [newLevel(N)], objects: [] };
    if (hasUnder) map.levels.push(newLevel(N));
    const L0 = map.levels[0];
    const idx = (x, y) => y * N + x;
    const inb = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

    // --- 1. Стартови позиции: по ъглите (до 4 играча), с отстъп
    const pad = Math.max(5, Math.floor(N * (T.close ? 0.22 : 0.14)));
    const corners = rng.shuffle([[pad, pad], [N - 1 - pad, N - 1 - pad], [N - 1 - pad, pad], [pad, N - 1 - pad]]);
    const starts = players.map((p, i) => ({ x: corners[i][0] + rng.int(-2, 2), y: corners[i][1] + rng.int(-2, 2), faction: p.faction, player: i }));

    // --- 2. Зони (Вороной): стартови + неутрални
    const zones = starts.map((s) => ({ x: s.x, y: s.y, terrain: D.factionById(s.faction).terrain === 8 ? 2 : D.factionById(s.faction).terrain, start: s }));
    const extra = Math.max(3, Math.round((N * N) / 500));
    const neutralTerrains = [1, 2, 3, 4, 5, 6, 7, 9, 1, 2, 6];
    for (let i = 0; i < extra; i++) {
      let best = null, bestD = -1;
      for (let t = 0; t < 12; t++) {
        const x = rng.int(3, N - 4), y = rng.int(3, N - 4);
        let d = Infinity; zones.forEach((z) => { d = Math.min(d, Math.hypot(z.x - x, z.y - y)); });
        if (d > bestD) { bestD = d; best = [x, y]; }
      }
      zones.push({ x: best[0], y: best[1], terrain: rng.pick(neutralTerrains) });
    }
    const warp = MK.noise2(opts.seed ^ 0x5151);
    const zoneOf = new Int16Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const wx = x + (warp(x / 7, y / 7) - 0.5) * 6, wy = y + (warp(y / 7 + 40, x / 7) - 0.5) * 6;
      let bi = 0, bd = Infinity, sd = Infinity;
      zones.forEach((z, i) => { const d = Math.hypot(z.x - wx, z.y - wy); if (d < bd) { sd = bd; bd = d; bi = i; } else if (d < sd) sd = d; });
      zoneOf[idx(x, y)] = bi;
      L0.terrain[idx(x, y)] = zones[bi].terrain;
      // Острови: каналите между зоните са море
      if (T.islands && sd - bd < 3.2 && bi < starts.length + 1) L0.terrain[idx(x, y)] = 0;
      if (T.islands && sd - bd < 2.2) L0.terrain[idx(x, y)] = 0;
    }

    // --- 3. Вода: езера + пясъчен бряг
    const lakeN = MK.noise2(opts.seed ^ 0xabc);
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
      const v = lakeN(x / 9, y / 9);
      let nearStart = false; starts.forEach((s) => { if (Math.hypot(s.x - x, s.y - y) < 9) nearStart = true; });
      if (v > T.water && !nearStart) L0.terrain[idx(x, y)] = 0;
    }
    if (T.islands) { // морска рамка
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (x < 2 || y < 2 || x >= N - 2 || y >= N - 2) L0.terrain[idx(x, y)] = 0;
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (L0.terrain[idx(x, y)] !== 0) continue;
      for (let d = 0; d < 8; d++) {
        const nx = x + MK.DIRS[d][0], ny = y + MK.DIRS[d][1];
        if (inb(nx, ny) && L0.terrain[idx(nx, ny)] !== 0 && L0.terrain[idx(nx, ny)] !== 3 && rng.chance(0.5)) L0.terrain[idx(nx, ny)] = 3;
      }
    }

    // --- 4. Препятствия по шум (гора/планина според терена)
    const bn = MK.noise2(opts.seed ^ 0x77);
    const bn2 = MK.noise2(opts.seed ^ 0x99);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = idx(x, y);
      if (L0.terrain[i] === 0) continue;
      const v = bn(x / 5.5, y / 5.5) * 0.7 + bn2(x / 2.3, y / 2.3) * 0.3;
      let nearStart = false; starts.forEach((s) => { if (Math.hypot(s.x - x, s.y - y) < 4) nearStart = true; });
      if (nearStart) continue;
      const edge = x === 0 || y === 0 || x === N - 1 || y === N - 1;
      if (v > 0.63 || edge && rng.chance(0.75)) {
        const t = L0.terrain[i];
        L0.block[i] = t === 6 || t === 4 || t === 7 || t === 9 ? 2 : t === 3 ? 3 : t === 5 || t === 2 && rng.chance(0.4) ? 4 : 1;
      }
    }

    // --- 5. Помощни за обекти
    const lvl = (z) => map.levels[z || 0];
    const free = (x, y, z) => { const L = lvl(z); return inb(x, y) && L.terrain[idx(x, y)] !== 0 && !L.block[idx(x, y)] && L.objAt[idx(x, y)] < 0; };
    const freeWater = (x, y) => inb(x, y) && L0.terrain[idx(x, y)] === 0 && L0.objAt[idx(x, y)] < 0;
    const clearAround = (x, y, r, z) => { const L = lvl(z); for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inb(x + dx, y + dy)) { const i = idx(x + dx, y + dy); L.block[i] = 0; if (L.terrain[i] === 0) L.terrain[i] = 3; } };
    let nextId = 1;
    function place(obj) {
      obj.id = nextId++; obj.z = obj.z || 0;
      map.objects.push(obj);
      lvl(obj.z).objAt[idx(obj.x, obj.y)] = obj.id;
      return obj;
    }
    const distToStart = (x, y) => { let d = Infinity; starts.forEach((s) => { d = Math.min(d, Math.hypot(s.x - x, s.y - y)); }); return d; };
    const noAdjObj = (x, y, z) => { const L = lvl(z); for (let d = 0; d < 8; d++) { const nx = x + MK.DIRS[d][0], ny = y + MK.DIRS[d][1]; if (inb(nx, ny) && L.objAt[idx(nx, ny)] >= 0) return false; } return true; };
    function findSpot(cx, cy, r0, r1, tries, allowAdj, z) {
      for (let t = 0; t < (tries || 60); t++) {
        const a = rng.next() * Math.PI * 2, r = r0 + rng.next() * (r1 - r0);
        const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
        if (!free(x, y, z) || x < 1 || y < 1 || x >= N - 1 || y >= N - 1) continue;
        if (!allowAdj && !noAdjObj(x, y, z)) continue;
        return { x, y };
      }
      return null;
    }
    function anySpot(pred, z) {
      for (let t = 0; t < 400; t++) {
        const x = rng.int(2, N - 3), y = rng.int(2, N - 3);
        if (free(x, y, z) && (!pred || pred(x, y)) && noAdjObj(x, y, z)) return { x, y };
      }
      return null;
    }
    const guardPool = D.CREATURES.filter((c) => c.tier >= 1);
    function makeGuard(x, y, budget, z) {
      let cands = guardPool.filter((c) => { const n = budget / D.fightValue(c); return n >= 2 && n <= 60; });
      if (z) cands = cands.filter((c) => c.faction !== 'harbor' && c.faction !== 'elements');
      if (!cands.length) cands = guardPool.slice().sort((a, b) => Math.abs(budget / D.fightValue(a) - 10) - Math.abs(budget / D.fightValue(b) - 10)).slice(0, 4);
      const c = rng.pick(cands);
      const n = Math.max(1, Math.round(budget / D.fightValue(c)));
      return place({ type: 'monster', x, y, z, creature: c.id, count: n, growth: true, disposition: rng.int(1, 10) });
    }
    /* Пазач за дадена стойност на съкровище (стойността е в мащаба на класиките; бойната ни стойност е ~1/14 от нея) */
    function guardFor(value, z) {
      const budget = value / 14;
      let cands = guardPool.filter((c) => { const n = budget / D.fightValue(c); return n >= 3 && n <= 50; });
      if (z) cands = cands.filter((c) => c.faction !== 'harbor' && c.faction !== 'elements');
      if (!cands.length) cands = guardPool.slice().sort((a, b) => Math.abs(budget / D.fightValue(a) - 12) - Math.abs(budget / D.fightValue(b) - 12)).slice(0, 4);
      const c = rng.pick(cands);
      return { creature: c.id, count: Math.max(1, Math.round(budget / D.fightValue(c))), disposition: rng.int(1, 10) };
    }
    /* Стража на утопия: зелени, червени, златни и черни дракони (класическото 8/5/2/1, мащабирано) */
    function dragonGuard(k) {
      const st = [['grove7', 8], ['dungeon7', 5], ['grove7u', 2], ['dungeon7u', 1]].map(([c, n]) => ({ creature: c, count: Math.max(1, Math.round(n * k)) }));
      return { creature: st[0].creature, count: st[0].count, stacks: st, disposition: 1 };
    }
    /* Награда: злато + артефакти; колкото по-голяма картата, толкова по-ценни */
    function utopiaLoot(lvl) {
      const arts = [];
      const grab = (cls) => { const a = takeArt(cls); if (a) arts.push(a); };
      if (lvl >= 3) { grab(3); grab(3); grab(2); }
      else if (lvl === 2) { grab(3); grab(2); grab(2); }
      else { grab(3); grab(2); }
      return { gold: [0, 15000, 25000, 40000][lvl], arts };
    }
    const budgetAt = (x, y, z) => {
      const d = distToStart(x, y) / N;
      return Math.round((40 + d * d * 2800 + d * 300) * (0.7 + rng.next() * 0.6) * (T.monsterMult || 1) * (opts.monsterMult || 1) * (z ? 1.4 : 1));
    };

    // --- 6. Градове на играчите
    const townNames = rng.shuffle(['Белоград', 'Ветрен', 'Тъмнолес', 'Звезден брод', 'Кремен', 'Росеник', 'Черна скала', 'Златица', 'Мъглин', 'Севернище', 'Огнище', 'Синигер', 'Върбица', 'Камендол', 'Лунев', 'Драконовец', 'Пепелград', 'Сребърник', 'Каменица', 'Мочурин']);
    const towns = [];
    starts.forEach((s, i) => {
      clearAround(s.x, s.y, 2, 0);
      towns.push(place({ type: 'town', x: s.x, y: s.y, faction: s.faction, owner: i, name: townNames.pop(), start: true }));
      [['wood'], ['ore']].forEach(([res]) => {
        const sp = findSpot(s.x, s.y, 3, 7, 80);
        if (sp) { clearAround(sp.x, sp.y, 1, 0); place({ type: 'mine', x: sp.x, y: sp.y, res, owner: -1 }); }
      });
      const gm = findSpot(s.x, s.y, 7, 12, 80);
      if (gm) { clearAround(gm.x, gm.y, 1, 0); place({ type: 'mine', x: gm.x, y: gm.y, res: 'gold', owner: -1, guard: true }); }
      for (let k = 0; k < 6; k++) {
        const sp = findSpot(s.x, s.y, 2, 7, 40, true);
        if (sp) place({ type: 'resource', x: sp.x, y: sp.y, res: rng.pick(['gold', 'wood', 'ore', 'wood', 'ore', rng.pick(['mercury', 'sulfur', 'crystal', 'gems'])]), amount: 0 });
      }
      const dw = findSpot(s.x, s.y, 4, 9, 60);
      if (dw) place({ type: 'dwelling', x: dw.x, y: dw.y, creature: s.faction + rng.pick([1, 2]), owner: -1, available: 0 });
      // Острови: кораб до града
      if (T.islands) {
        let boat = null;
        for (let r = 2; r <= 6 && !boat; r++) for (let t = 0; t < 40 && !boat; t++) { const a = rng.next() * Math.PI * 2; const x = Math.round(s.x + Math.cos(a) * r), y = Math.round(s.y + Math.sin(a) * r); if (freeWater(x, y)) boat = { x, y }; }
        if (boat) place({ type: 'boat', x: boat.x, y: boat.y, owner: i });
      }
    });
    const neutralTownN = Math.max(1, Math.floor(players.length / 2) + (N >= 54 ? 1 : 0) + (N >= 72 ? 1 : 0)) + (T.neutralTownsExtra || 0);
    for (let k = 0; k < neutralTownN; k++) {
      const sp = anySpot((x, y) => distToStart(x, y) > N * 0.3 && towns.every((t) => Math.hypot(t.x - x, t.y - y) > N * 0.22));
      if (!sp) continue;
      clearAround(sp.x, sp.y, 2, 0);
      const f = rng.pick(D.FACTIONS).id;
      towns.push(place({ type: 'town', x: sp.x, y: sp.y, faction: f, owner: -1, name: townNames.pop() || 'Град', neutralGuard: true }));
    }

    // --- 7. Мини, обекти, ресурси, артефакти, жилища, чудовища (повърхност)
    const rareList = ['mercury', 'sulfur', 'crystal', 'gems'];
    const rareMines = Math.max(4, players.length * 2 + (N >= 54 ? 2 : 0)) + (T.extraMines || 0);
    for (let k = 0; k < rareMines; k++) {
      const sp = anySpot((x, y) => distToStart(x, y) > 6);
      if (sp) { clearAround(sp.x, sp.y, 0, 0); place({ type: 'mine', x: sp.x, y: sp.y, res: rareList[k % 4], owner: -1, guard: true }); }
    }
    for (let k = 0; k < players.length + 1 + (T.extraMines || 0); k++) {
      const sp = anySpot((x, y) => distToStart(x, y) > 10);
      if (sp) place({ type: 'mine', x: sp.x, y: sp.y, res: rng.pick(['wood', 'ore', 'gold']), owner: -1, guard: true });
    }
    const area = N * N;
    const misc = ['windmill', 'watermill', 'learning', 'rally', 'mercenary', 'tower_def', 'star_axis', 'garden', 'campfire', 'campfire', 'shrine1', 'shrine2', 'shrine3', 'tree_knowledge', 'magic_well', 'wagon', 'fountain', 'idol', 'obelisk', 'stables', 'school_war', 'school_magic', 'library'];
    const miscN = Math.round(area / 110);
    for (let k = 0; k < miscN; k++) {
      const type = rng.pick(misc);
      const sp = anySpot((x, y) => distToStart(x, y) > 3);
      if (!sp) continue;
      const o = place({ type, x: sp.x, y: sp.y });
      if (type === 'campfire' || type === 'wagon' || type === 'learning' || type === 'tree_knowledge' || type === 'shrine3') o.guard = rng.chance(0.6);
    }
    if (N >= 54) {
      const a = anySpot((x, y) => distToStart(x, y) > 8), b = a && anySpot((x, y) => Math.hypot(a.x - x, a.y - y) > N * 0.4);
      if (a && b) { const o1 = place({ type: 'monolith', x: a.x, y: a.y }); const o2 = place({ type: 'monolith', x: b.x, y: b.y }); o1.pair = o2.id; o2.pair = o1.id; }
    }
    const resN = Math.round(area / 45 * (T.resMult || 1));
    for (let k = 0; k < resN; k++) {
      const sp = anySpot();
      if (!sp) continue;
      if (rng.chance(0.22)) place({ type: 'chest', x: sp.x, y: sp.y, guard: rng.chance(0.4) });
      else place({ type: 'resource', x: sp.x, y: sp.y, res: rng.weighted({ gold: 5, wood: 4, ore: 4, mercury: 1.5, sulfur: 1.5, crystal: 1.5, gems: 1.5 }), amount: 0 });
    }
    const artN = Math.round(area / 260 * (T.resMult || 1)) + players.length;
    const artPool = rng.shuffle(D.ARTIFACTS.slice());
    const takeArt = (cls) => { let ai = artPool.findIndex((a) => a.cls === cls); if (ai < 0) ai = 0; return artPool.length ? artPool.splice(ai, 1)[0].id : null; };
    // Драконови утопии: далеч от стартовете, пазени от дракони, с богата награда
    const utopiaN = N >= 72 ? 3 : N >= 54 ? 2 : 1;
    for (let k = 0; k < utopiaN; k++) {
      const sp = anySpot((x, y) => distToStart(x, y) > N * 0.32);
      if (!sp) continue;
      clearAround(sp.x, sp.y, 0, 0);
      const o = place({ type: 'dragon_utopia', x: sp.x, y: sp.y });
      o.guard = dragonGuard(N >= 72 ? 1.3 : N >= 54 ? 1 : 0.7);
      o.loot = utopiaLoot(N >= 72 ? 3 : N >= 54 ? 2 : 1);
    }
    for (let k = 0; k < artN && artPool.length; k++) {
      const sp = anySpot((x, y) => distToStart(x, y) > 5);
      if (!sp) continue;
      const far = distToStart(sp.x, sp.y) / N;
      place({ type: 'artifact', x: sp.x, y: sp.y, art: takeArt(far > 0.6 ? 3 : far > 0.35 ? 2 : 1), guard: true });
    }
    const dwN = Math.round(area / 400);
    for (let k = 0; k < dwN; k++) {
      const sp = anySpot((x, y) => distToStart(x, y) > 8);
      if (!sp) continue;
      const tier = +rng.weighted({ 1: 3, 2: 4, 3: 4, 4: 3, 5: 2, 6: 1 });
      const f = rng.pick(D.FACTIONS).id;
      place({ type: 'dwelling', x: sp.x, y: sp.y, creature: f + tier, owner: -1, available: 0, guard: tier >= 3 });
    }
    const monN = Math.round(area / 90);
    for (let k = 0; k < monN; k++) {
      const sp = anySpot((x, y) => distToStart(x, y) > 6);
      if (sp) makeGuard(sp.x, sp.y, budgetAt(sp.x, sp.y, 0), 0);
    }
    // Морски обекти
    const waterTiles = []; for (let y = 2; y < N - 2; y++) for (let x = 2; x < N - 2; x++) if (L0.terrain[idx(x, y)] === 0) waterTiles.push([x, y]);
    if (waterTiles.length > 40) {
      const seaN = Math.round(waterTiles.length / 60);
      for (let k = 0; k < seaN; k++) {
        const [x, y] = rng.pick(waterTiles);
        if (!freeWater(x, y)) continue;
        place({ type: rng.chance(0.6) ? 'sea_chest' : 'shipwreck', x, y });
      }
      if (waterTiles.length > 120) {
        const a = rng.pick(waterTiles), b = rng.pick(waterTiles);
        if (freeWater(a[0], a[1]) && freeWater(b[0], b[1]) && Math.hypot(a[0] - b[0], a[1] - b[1]) > N * 0.3) { const o1 = place({ type: 'whirlpool', x: a[0], y: a[1] }); const o2 = place({ type: 'whirlpool', x: b[0], y: b[1] }); o1.pair = o2.id; o2.pair = o1.id; }
      }
      // корабостроителници на брега (както в класиките: кораб за злато и дърво) — по една на ~600 водни плочки, поне 1, до 4
      const coastal = (x, y) => { for (let d = 0; d < 8; d++) { const nx = x + MK.DIRS[d][0], ny = y + MK.DIRS[d][1]; if (inb(nx, ny) && L0.terrain[idx(nx, ny)] === 0) return true; } return false; };
      const yards = [];
      for (let k = 0; k < (waterTiles.length < 250 ? 0 : Math.min(4, Math.max(1, Math.round(waterTiles.length / 600)))); k++) {
        const sp = anySpot((x, y) => coastal(x, y) && yards.every((q) => Math.hypot(q.x - x, q.y - y) > N * 0.25));
        if (sp) yards.push(place({ type: 'shipyard', x: sp.x, y: sp.y }));
      }
      // фарове на брега
      for (let k = 0; k < Math.max(1, players.length - 1); k++) {
        const sp = anySpot((x, y) => { for (let d = 0; d < 8; d++) { const nx = x + MK.DIRS[d][0], ny = y + MK.DIRS[d][1]; if (inb(nx, ny) && L0.terrain[idx(nx, ny)] === 0) return true; } return false; });
        if (sp) place({ type: 'lighthouse', x: sp.x, y: sp.y, owner: -1 });
      }
    }

    // --- 8. Подземие
    if (hasUnder) generateUnderground(map, rng, N, T, starts, { place, free, anySpot, makeGuard, budgetAt, takeArt, distToStart, townNames });

    // --- 9. Пазачи по стойност (както в класическите генератори): всеки ценен обект
    // има „стойност“, а пазачите му са с обща бойна стойност, пропорционална на нея.
    // Евтините неща стоят свободни, скъпите почти винаги са пазени, а ~20% от
    // ценните са оставени без пазач — за късмет. Пазачът е закачен за обекта.
    map.objects.slice().forEach((o) => {
      if (o.guard && o.guard.stacks) return; // собствена стража (драконова утопия)
      delete o.guard;
      const v = D.treasureValue(o);
      if (v <= 0) return;
      const chance = v < 1000 ? 0 : v < 2000 ? 0.4 : 0.8;
      if (!rng.chance(chance)) return;
      o.guard = guardFor(v * (0.8 + rng.next() * 0.5) * (T.monsterMult || 1) * (opts.monsterMult || 1), o.z);
    });
    // --- 10. Свързаност (по нива); на острови водата се брои за проходима
    ensureConnected(map, 0, N, towns, T.islands);
    // На острови: всеки стартов град трябва да е до вода (за корабостроителница) и започва с кораб на брега,
    // за да няма положение „трябва кораб, а няма как да се стигне до такъв“
    if (T.islands) {
      const L0 = map.levels[0];
      const isW = (x, y) => inb(x, y) && L0.terrain[y * N + x] === 0;
      towns.filter((t) => t.start).forEach((t) => {
        let coast = null;
        const occupied = (x, y) => map.objects.some((o) => o.z === 0 && o.x === x && o.y === y);
        // предпочитаме свободна водна плочка; иначе коя да е
        for (let pass = 0; pass < 2 && !coast; pass++) for (let r = 1; r <= 3 && !coast; r++) for (let dy = -r; dy <= r && !coast; dy++) for (let dx = -r; dx <= r && !coast; dx++) if (isW(t.x + dx, t.y + dy) && (pass === 1 || !occupied(t.x + dx, t.y + dy))) coast = { x: t.x + dx, y: t.y + dy };
        if (!coast) {
          // няма вода наблизо: прокопаваме канал от най-близкото море до 2 плочки от града
          let best = null, bd = Infinity;
          for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (L0.terrain[y * N + x] === 0) { const d = Math.hypot(x - t.x, y - t.y); if (d < bd) { bd = d; best = { x, y }; } }
          if (!best) return;
          const ang = Math.atan2(best.y - t.y, best.x - t.x);
          const ex = Math.round(t.x + Math.cos(ang) * 2), ey = Math.round(t.y + Math.sin(ang) * 2);
          let x = best.x, y = best.y;
          while (x !== ex || y !== ey) {
            if (x !== ex) x += Math.sign(ex - x); else y += Math.sign(ey - y);
            const i = y * N + x; if (L0.objAt && L0.objAt[i] >= 0) continue;
            L0.terrain[i] = 0; L0.block[i] = 0; L0.road[i] = 0;
          }
          coast = { x: ex, y: ey };
        }
        // кораб на брега; ако мястото е заето от друг морски обект, той се маха
        const old = map.objects.find((o) => o.z === 0 && o.x === coast.x && o.y === coast.y);
        if (old && old.type !== 'boat') { map.objects.splice(map.objects.indexOf(old), 1); L0.objAt[coast.y * N + coast.x] = -1; }
        if (!old || old.type !== 'boat') place({ type: 'boat', x: coast.x, y: coast.y, z: 0, owner: t.owner });
        else old.owner = t.owner;
      });
      ensureConnected(map, 0, N, towns, true);
    }
    if (hasUnder) { const gates = map.objects.filter((o) => o.type === 'gate' && o.z === 1); if (gates.length) ensureConnected(map, 1, N, gates, false); }

    // --- 11. Пътища между близки градове
    for (let i = 0; i < towns.length; i++) for (let j = i + 1; j < towns.length; j++) {
      const a = towns[i], b = towns[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) > N * 0.6) continue;
      carveRoad(map, a.x, a.y, b.x, b.y, N);
    }
    map.starts = starts;
    return map;
  }

  /* Подземие: скала навсякъде, прокопани пещери между портите, богатства и силни пазачи */
  function generateUnderground(map, rng, N, T, starts, H) {
    const L1 = map.levels[1];
    const idx = (x, y) => y * N + x;
    L1.terrain.fill(8); L1.block.fill(2);
    const carve = (x, y, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (dx * dx + dy * dy > r * r + 1) continue; const nx = x + dx, ny = y + dy; if (nx >= 1 && ny >= 1 && nx < N - 1 && ny < N - 1) L1.block[idx(nx, ny)] = 0; } };
    // Порти: по една близо до всеки старт + допълнителни
    const gates = [];
    const gateCount = starts.length + (N >= 72 ? 2 : 1);
    for (let k = 0; k < gateCount; k++) {
      let sp;
      if (k < starts.length) sp = findNear(starts[k].x, starts[k].y, 6, 12);
      else sp = H.anySpot((x, y) => H.distToStart(x, y) > 8, 0);
      if (!sp) continue;
      const g0 = H.place({ type: 'gate', x: sp.x, y: sp.y, z: 0 });
      carve(sp.x, sp.y, 2);
      const g1 = H.place({ type: 'gate', x: sp.x, y: sp.y, z: 1 });
      g0.pair = g1.id; g1.pair = g0.id;
      gates.push(g1);
    }
    function findNear(cx, cy, r0, r1) { for (let t = 0; t < 80; t++) { const a = rng.next() * Math.PI * 2, r = r0 + rng.next() * (r1 - r0); const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r); if (H.free(x, y, 0) && x > 1 && y > 1 && x < N - 2 && y < N - 2) return { x, y }; } return null; }
    // Тунели: червеи между портите през централен хъб и стаи
    const hub = { x: Math.round(N / 2 + rng.int(-4, 4)), y: Math.round(N / 2 + rng.int(-4, 4)) };
    carve(hub.x, hub.y, 4);
    const rooms = [];
    const roomN = Math.round(N * N / 260) + (T.undergroundRich ? 4 : 0);
    for (let k = 0; k < roomN; k++) { const r = { x: rng.int(3, N - 4), y: rng.int(3, N - 4), r: rng.int(2, 4) }; rooms.push(r); carve(r.x, r.y, r.r); }
    const worm = (a, b) => { let x = a.x, y = a.y; let guard = 0; while ((x !== b.x || y !== b.y) && guard++ < N * 4) { carve(x, y, 1); if (rng.chance(0.7)) { if (Math.abs(b.x - x) > Math.abs(b.y - y)) x += Math.sign(b.x - x); else y += Math.sign(b.y - y); } else { x += rng.int(-1, 1); y += rng.int(-1, 1); x = Math.max(1, Math.min(N - 2, x)); y = Math.max(1, Math.min(N - 2, y)); } } carve(b.x, b.y, 1); };
    gates.forEach((g) => worm(g, hub));
    rooms.forEach((r, i) => worm(r, i % 2 ? hub : rng.pick(gates) || hub));
    // Лава в някои пещери
    const ln = MK.noise2(rng.int(1, 1e9));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = idx(x, y); if (!L1.block[i] && ln(x / 6, y / 6) > 0.72) L1.terrain[i] = 7; }
    // Обекти: мини, ресурси, артефакти, жилища, чудовища, град
    const rich = T.undergroundRich ? 1.6 : 1;
    const spots = []; for (let y = 2; y < N - 2; y++) for (let x = 2; x < N - 2; x++) if (!L1.block[idx(x, y)]) spots.push([x, y]);
    const anyU = (pred) => { for (let t = 0; t < 200; t++) { const [x, y] = rng.pick(spots); if (H.free(x, y, 1) && (!pred || pred(x, y))) { let ok = true; for (let d = 0; d < 8 && ok; d++) { const nx = x + MK.DIRS[d][0], ny = y + MK.DIRS[d][1]; if (L1.objAt[idx(nx, ny)] >= 0) ok = false; } if (ok) return { x, y }; } } return null; };
    const nearGate = (x, y) => gates.some((g) => Math.hypot(g.x - x, g.y - y) < 4);
    const mineN = Math.round(4 * rich) + starts.length;
    for (let k = 0; k < mineN; k++) { const sp = anyU((x, y) => !nearGate(x, y)); if (sp) H.place({ type: 'mine', x: sp.x, y: sp.y, z: 1, res: rng.pick(['mercury', 'sulfur', 'crystal', 'gems', 'gold', 'ore']), owner: -1, guard: true }); }
    const resN = Math.round(spots.length / 30 * rich);
    for (let k = 0; k < resN; k++) { const sp = anyU(); if (!sp) continue; if (rng.chance(0.3)) H.place({ type: 'chest', x: sp.x, y: sp.y, z: 1, guard: rng.chance(0.5) }); else H.place({ type: 'resource', x: sp.x, y: sp.y, z: 1, res: rng.weighted({ gold: 5, ore: 3, mercury: 2, sulfur: 2, crystal: 2, gems: 2 }), amount: 0 }); }
    const artN = Math.round(2 * rich) + Math.floor(starts.length / 2);
    for (let k = 0; k < artN; k++) { const sp = anyU((x, y) => !nearGate(x, y)); const a = H.takeArt(rng.chance(0.5) ? 3 : 2); if (sp && a) H.place({ type: 'artifact', x: sp.x, y: sp.y, z: 1, art: a, guard: true }); }
    for (let k = 0; k < 2; k++) { const sp = anyU((x, y) => !nearGate(x, y)); if (sp) { const f = rng.pick(['dungeon', 'inferno', 'necropolis']); H.place({ type: 'dwelling', x: sp.x, y: sp.y, z: 1, creature: f + rng.int(3, 5), owner: -1, available: 0, guard: true }); } }
    ['learning', 'star_axis', 'garden', 'magic_well', 'shrine2', 'shrine3', 'school_magic'].forEach((type) => { if (rng.chance(0.6)) { const sp = anyU(); if (sp) H.place({ type, x: sp.x, y: sp.y, z: 1 }); } });
    const monN = Math.round(spots.length / 45);
    for (let k = 0; k < monN; k++) { const sp = anyU((x, y) => !nearGate(x, y)); if (sp) H.makeGuard(sp.x, sp.y, H.budgetAt(sp.x, sp.y, 1), 1); }
    if (T.undergroundRich || N >= 72) {
      const sp = anyU((x, y) => !nearGate(x, y) && Math.hypot(x - hub.x, y - hub.y) < 8);
      if (sp) { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) L1.block[idx(sp.x + dx, sp.y + dy)] = 0; H.place({ type: 'town', x: sp.x, y: sp.y, z: 1, faction: rng.pick(['dungeon', 'inferno', 'necropolis']), owner: -1, name: H.townNames.pop() || 'Подземен град', neutralGuard: true }); }
    }
  }

  /* Свързваме всички проходими компоненти с обекти към главната (4-свързаност) */
  function ensureConnected(map, z, N, anchors, waterPassable) {
    const L = map.levels[z];
    const idx = (x, y) => y * N + x;
    const passable = (x, y) => x >= 0 && y >= 0 && x < N && y < N && (L.terrain[idx(x, y)] !== 0 || waterPassable) && !L.block[idx(x, y)];
    function components() {
      const comp = new Int32Array(N * N).fill(-1);
      let c = 0;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (!passable(x, y) || comp[idx(x, y)] >= 0) continue;
        const stack = [[x, y]]; comp[idx(x, y)] = c;
        while (stack.length) {
          const [cx, cy] = stack.pop();
          for (let d = 0; d < 4; d++) {
            const nx = cx + MK.DIRS[d][0], ny = cy + MK.DIRS[d][1];
            if (passable(nx, ny) && comp[idx(nx, ny)] < 0) { comp[idx(nx, ny)] = c; stack.push([nx, ny]); }
          }
        }
        c++;
      }
      return comp;
    }
    const objs = map.objects.filter((o) => o.z === z && o.type !== 'boat' && o.type !== 'sea_chest' && o.type !== 'shipwreck' && o.type !== 'whirlpool');
    for (let iter = 0; iter < 30; iter++) {
      const comp = components();
      const main = comp[idx(anchors[0].x, anchors[0].y)];
      const need = new Map();
      objs.forEach((o) => { const c = comp[idx(o.x, o.y)]; if (c >= 0 && c !== main && !need.has(c)) need.set(c, o); });
      if (!need.size) break;
      need.forEach((o) => {
        let best = null, bd = Infinity;
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { if (comp[idx(x, y)] !== main) continue; const d = Math.hypot(x - o.x, y - o.y); if (d < bd) { bd = d; best = [x, y]; } }
        if (best) carveLine(L, o.x, o.y, best[0], best[1], N, true, waterPassable, z);
      });
    }
  }

  function carveLine(L, x0, y0, x1, y1, N, wide, keepWater, z) {
    const idx = (x, y) => y * N + x;
    let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (;;) {
      const cells = wide ? [[x0, y0], [x0 + 1, y0], [x0, y0 + 1]] : [[x0, y0]];
      cells.forEach(([x, y]) => {
        if (x < 0 || y < 0 || x >= N || y >= N) return;
        const i = idx(x, y);
        L.block[i] = 0;
        if (L.terrain[i] === 0 && !keepWater) L.terrain[i] = 3;
        if (z && L.terrain[i] === 0) L.terrain[i] = 8;
      });
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  function carveRoad(map, x0, y0, x1, y1, N) {
    const L = map.levels[0];
    const idx = (x, y) => y * N + x;
    let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, err = dx + dy;
    let x = x0, y = y0;
    for (;;) {
      const i = idx(x, y);
      if (L.terrain[i] !== 0 && !L.block[i] && (L.objAt[i] < 0 || (x === x0 && y === y0) || (x === x1 && y === y1))) L.road[i] = 1;
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
  }

  MK.MapGen = { generate };
})();
