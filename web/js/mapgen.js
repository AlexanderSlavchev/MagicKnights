/* Генератор на случайни карти: зони по Вороной, гори/планини по шум,
   гарантирана свързаност, градове, мини, ресурси, пазачи по разстояние. */
(function () {
  'use strict';
  const MK = (window.MK = window.MK || {});
  const D = MK.data;

  function generate(opts) {
    const rng = new MK.RNG(opts.seed);
    const N = opts.size;
    const players = opts.players; // [{faction, human}]
    const map = {
      w: N, h: N,
      terrain: new Uint8Array(N * N),
      road: new Uint8Array(N * N),
      block: new Uint8Array(N * N),     // 0 свободно, 1 гора, 2 планина, 3 скали, 4 мъртва гора
      objects: [],
      objAt: new Int32Array(N * N).fill(-1)
    };
    const idx = (x, y) => y * N + x;
    const inb = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

    // --- 1. Стартови позиции: по ъглите (до 4 играча), с отстъп
    const pad = Math.max(5, Math.floor(N * 0.14));
    const corners = rng.shuffle([[pad, pad], [N - 1 - pad, N - 1 - pad], [N - 1 - pad, pad], [pad, N - 1 - pad]]);
    const starts = players.map((p, i) => ({ x: corners[i][0] + rng.int(-2, 2), y: corners[i][1] + rng.int(-2, 2), faction: p.faction, player: i }));

    // --- 2. Зони (Вороной): стартови + неутрални
    const zones = starts.map((s) => ({ x: s.x, y: s.y, terrain: D.factionById(s.faction).terrain, start: s }));
    const extra = Math.max(3, Math.round((N * N) / 500));
    const neutralTerrains = [1, 2, 3, 4, 5, 6, 7, 1, 2, 6];
    for (let i = 0; i < extra; i++) {
      let best = null, bestD = -1;
      for (let t = 0; t < 12; t++) {
        const x = rng.int(3, N - 4), y = rng.int(3, N - 4);
        let d = Infinity; zones.forEach((z) => { d = Math.min(d, Math.hypot(z.x - x, z.y - y)); });
        if (d > bestD) { bestD = d; best = [x, y]; }
      }
      zones.push({ x: best[0], y: best[1], terrain: rng.pick(neutralTerrains) });
    }
    const zoneOf = new Int16Array(N * N);
    const warp = MK.noise2(opts.seed ^ 0x5151);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const wx = x + (warp(x / 7, y / 7) - 0.5) * 6, wy = y + (warp(y / 7 + 40, x / 7) - 0.5) * 6;
      let bi = 0, bd = Infinity;
      zones.forEach((z, i) => { const d = Math.hypot(z.x - wx, z.y - wy); if (d < bd) { bd = d; bi = i; } });
      zoneOf[idx(x, y)] = bi;
      map.terrain[idx(x, y)] = zones[bi].terrain;
    }

    // --- 3. Вода: няколко езера + пясъчен бряг
    const lakeN = MK.noise2(opts.seed ^ 0xabc);
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
      const v = lakeN(x / 9, y / 9);
      let nearStart = false; starts.forEach((s) => { if (Math.hypot(s.x - x, s.y - y) < 9) nearStart = true; });
      if (v > 0.78 && !nearStart) map.terrain[idx(x, y)] = 0;
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (map.terrain[idx(x, y)] !== 0) continue;
      for (let d = 0; d < 8; d++) {
        const nx = x + MK.DIRS[d][0], ny = y + MK.DIRS[d][1];
        if (inb(nx, ny) && map.terrain[idx(nx, ny)] !== 0 && map.terrain[idx(nx, ny)] !== 3 && rng.chance(0.5)) map.terrain[idx(nx, ny)] = 3;
      }
    }

    // --- 4. Препятствия по шум (гора/планина според терена)
    const bn = MK.noise2(opts.seed ^ 0x77);
    const bn2 = MK.noise2(opts.seed ^ 0x99);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = idx(x, y);
      if (map.terrain[i] === 0) continue;
      const v = bn(x / 5.5, y / 5.5) * 0.7 + bn2(x / 2.3, y / 2.3) * 0.3;
      let nearStart = false; starts.forEach((s) => { if (Math.hypot(s.x - x, s.y - y) < 4) nearStart = true; });
      if (nearStart) continue;
      const edge = x === 0 || y === 0 || x === N - 1 || y === N - 1;
      if (v > 0.63 || edge && rng.chance(0.75)) {
        const t = map.terrain[i];
        map.block[i] = t === 6 || t === 4 || t === 7 ? 2 : t === 3 ? 3 : t === 5 || t === 2 && rng.chance(0.4) ? 4 : 1;
      }
    }

    // --- 5. Обекти. Помощни функции
    const free = (x, y) => inb(x, y) && map.terrain[idx(x, y)] !== 0 && !map.block[idx(x, y)] && map.objAt[idx(x, y)] < 0;
    const clearAround = (x, y, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inb(x + dx, y + dy)) { const i = idx(x + dx, y + dy); map.block[i] = 0; if (map.terrain[i] === 0) map.terrain[i] = 3; } };
    let nextId = 1;
    function place(obj) {
      obj.id = nextId++;
      map.objects.push(obj);
      map.objAt[idx(obj.x, obj.y)] = obj.id;
      return obj;
    }
    const distToStart = (x, y) => { let d = Infinity; starts.forEach((s) => { d = Math.min(d, Math.hypot(s.x - x, s.y - y)); }); return d; };
    const distToAnyStartTown = distToStart;
    // Случайна свободна плочка на разстояние [r0,r1] от (cx,cy), без съседни обекти
    function findSpot(cx, cy, r0, r1, tries, allowAdj) {
      for (let t = 0; t < (tries || 60); t++) {
        const a = rng.next() * Math.PI * 2, r = r0 + rng.next() * (r1 - r0);
        const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
        if (!free(x, y)) continue;
        if (x < 1 || y < 1 || x >= N - 1 || y >= N - 1) continue;
        if (!allowAdj) {
          let ok = true;
          for (let d = 0; d < 8 && ok; d++) { const nx = x + MK.DIRS[d][0], ny = y + MK.DIRS[d][1]; if (inb(nx, ny) && map.objAt[idx(nx, ny)] >= 0) ok = false; }
          if (!ok) continue;
        }
        return { x, y };
      }
      return null;
    }
    function anySpot(pred) {
      for (let t = 0; t < 400; t++) {
        const x = rng.int(2, N - 3), y = rng.int(2, N - 3);
        if (free(x, y) && (!pred || pred(x, y))) {
          let ok = true;
          for (let d = 0; d < 8 && ok; d++) { const nx = x + MK.DIRS[d][0], ny = y + MK.DIRS[d][1]; if (inb(nx, ny) && map.objAt[idx(nx, ny)] >= 0) ok = false; }
          if (ok) return { x, y };
        }
      }
      return null;
    }

    // Пазач с бюджет по бойна стойност
    const guardPool = D.CREATURES.filter((c) => c.tier >= 1);
    function makeGuard(x, y, budget, preferTier) {
      let cands = guardPool.filter((c) => !preferTier || Math.abs(c.tier - preferTier) <= 1);
      if (!cands.length) cands = guardPool;
      // избираме същество така, че броят да е между 3 и 60
      cands = cands.filter((c) => { const n = budget / D.fightValue(c); return n >= 2 && n <= 60; });
      if (!cands.length) cands = guardPool.slice().sort((a, b) => Math.abs(budget / D.fightValue(a) - 10) - Math.abs(budget / D.fightValue(b) - 10)).slice(0, 4);
      const c = rng.pick(cands);
      const n = Math.max(1, Math.round(budget / D.fightValue(c)));
      return place({ type: 'monster', x, y, creature: c.id, count: n, growth: true, disposition: rng.int(1, 10) });
    }
    const budgetAt = (x, y) => {
      const d = distToAnyStartTown(x, y) / N;   // 0..~1.4
      // Стартова армия ≈ 150 бойни точки; близо до дома пазачите са по-слаби от нея,
      // в средата на картата — колкото армия от 2-3 седмица, далече — драконови.
      return Math.round((40 + d * d * 2800 + d * 300) * (0.7 + rng.next() * 0.6) * (opts.monsterMult || 1));
    };

    // --- Градове на играчите
    const townNames = rng.shuffle(['Белоград', 'Ветрен', 'Тъмнолес', 'Звезден брод', 'Кремен', 'Росеник', 'Черна скала', 'Златица', 'Мъглин', 'Севернище', 'Огнище', 'Синигер', 'Върбица', 'Камендол', 'Лунев', 'Драконовец']);
    const towns = [];
    starts.forEach((s, i) => {
      clearAround(s.x, s.y, 2);
      towns.push(place({ type: 'town', x: s.x, y: s.y, faction: s.faction, owner: i, name: townNames.pop(), start: true }));
      // Дърводелница и рудник близо, без пазачи
      [['wood', 0], ['ore', 0]].forEach(([res]) => {
        const sp = findSpot(s.x, s.y, 3, 7, 80);
        if (sp) { clearAround(sp.x, sp.y, 1); place({ type: 'mine', x: sp.x, y: sp.y, res, owner: -1 }); }
      });
      // Златна мина с пазач
      const gm = findSpot(s.x, s.y, 7, 12, 80);
      if (gm) { clearAround(gm.x, gm.y, 1); place({ type: 'mine', x: gm.x, y: gm.y, res: 'gold', owner: -1, guard: true }); }
      // Стартови ресурси наоколо
      for (let k = 0; k < 6; k++) {
        const sp = findSpot(s.x, s.y, 2, 7, 40, true);
        if (sp) place({ type: 'resource', x: sp.x, y: sp.y, res: rng.pick(['gold', 'wood', 'ore', 'wood', 'ore', rng.pick(['mercury', 'sulfur', 'crystal', 'gems'])]), amount: 0 });
      }
      // Външно жилище от ниво 1-2 наблизо
      const dw = findSpot(s.x, s.y, 4, 9, 60);
      if (dw) { clearAround(dw.x, dw.y, 0); place({ type: 'dwelling', x: dw.x, y: dw.y, creature: s.faction + rng.pick([1, 2]), owner: -1, available: 0 }); }
    });
    // Неутрални градове
    const neutralTownN = Math.max(1, Math.floor(players.length / 2) + (N >= 54 ? 1 : 0) + (N >= 72 ? 1 : 0));
    for (let k = 0; k < neutralTownN; k++) {
      const sp = anySpot((x, y) => distToStart(x, y) > N * 0.3 && towns.every((t) => Math.hypot(t.x - x, t.y - y) > N * 0.22));
      if (!sp) continue;
      clearAround(sp.x, sp.y, 2);
      const f = rng.pick(D.FACTIONS).id;
      towns.push(place({ type: 'town', x: sp.x, y: sp.y, faction: f, owner: -1, name: townNames.pop() || 'Град', neutralGuard: true }));
    }

    // Мини за редки ресурси + още дърво/руда
    const rareList = ['mercury', 'sulfur', 'crystal', 'gems'];
    const rareMines = Math.max(4, players.length * 2 + (N >= 54 ? 2 : 0));
    for (let k = 0; k < rareMines; k++) {
      const res = rareList[k % 4];
      const sp = anySpot((x, y) => distToStart(x, y) > 6);
      if (sp) { clearAround(sp.x, sp.y, 0); place({ type: 'mine', x: sp.x, y: sp.y, res, owner: -1, guard: true }); }
    }
    for (let k = 0; k < players.length + 1; k++) {
      const sp = anySpot((x, y) => distToStart(x, y) > 10);
      if (sp) { clearAround(sp.x, sp.y, 0); place({ type: 'mine', x: sp.x, y: sp.y, res: rng.pick(['wood', 'ore', 'gold']), owner: -1, guard: true }); }
    }

    // Разни обекти
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
    // Двойка монолити
    if (N >= 54) {
      const a = anySpot((x, y) => distToStart(x, y) > 8), b = a && anySpot((x, y) => Math.hypot(a.x - x, a.y - y) > N * 0.4);
      if (a && b) { const o1 = place({ type: 'monolith', x: a.x, y: a.y }); const o2 = place({ type: 'monolith', x: b.x, y: b.y }); o1.pair = o2.id; o2.pair = o1.id; }
    }
    // Ресурси и сандъци
    const resN = Math.round(area / 45);
    for (let k = 0; k < resN; k++) {
      const sp = anySpot();
      if (!sp) continue;
      if (rng.chance(0.22)) place({ type: 'chest', x: sp.x, y: sp.y, guard: rng.chance(0.4) });
      else place({ type: 'resource', x: sp.x, y: sp.y, res: rng.weighted({ gold: 5, wood: 4, ore: 4, mercury: 1.5, sulfur: 1.5, crystal: 1.5, gems: 1.5 }), amount: 0 });
    }
    // Артефакти с пазачи
    const artN = Math.round(area / 260) + players.length;
    const artPool = rng.shuffle(D.ARTIFACTS.slice());
    for (let k = 0; k < artN && artPool.length; k++) {
      const sp = anySpot((x, y) => distToStart(x, y) > 5);
      if (!sp) continue;
      const far = distToStart(sp.x, sp.y) / N;
      const cls = far > 0.6 ? 3 : far > 0.35 ? 2 : 1;
      let ai = artPool.findIndex((a) => a.cls === cls); if (ai < 0) ai = 0;
      place({ type: 'artifact', x: sp.x, y: sp.y, art: artPool.splice(ai, 1)[0].id, guard: true });
    }
    // Външни жилища
    const dwN = Math.round(area / 400);
    for (let k = 0; k < dwN; k++) {
      const sp = anySpot((x, y) => distToStart(x, y) > 8);
      if (!sp) continue;
      const tier = rng.weighted({ 1: 3, 2: 4, 3: 4, 4: 3, 5: 2, 6: 1 });
      const f = rng.pick(D.FACTIONS).id;
      place({ type: 'dwelling', x: sp.x, y: sp.y, creature: f + tier, owner: -1, available: 0, guard: tier >= 3 });
    }
    // Свободно бродещи чудовища
    const monN = Math.round(area / 90);
    for (let k = 0; k < monN; k++) {
      const sp = anySpot((x, y) => distToStart(x, y) > 6);
      if (sp) makeGuard(sp.x, sp.y, budgetAt(sp.x, sp.y));
    }
    // Пазачи на маркираните обекти — на съседна плочка (или до самия обект)
    map.objects.slice().forEach((o) => {
      if (!o.guard) return;
      delete o.guard;
      const cand = [];
      for (let d = 0; d < 8; d++) { const nx = o.x + MK.DIRS[d][0], ny = o.y + MK.DIRS[d][1]; if (free(nx, ny)) cand.push([nx, ny]); }
      if (!cand.length) return;
      const [gx, gy] = rng.pick(cand);
      let budget = budgetAt(gx, gy);
      if (o.type === 'artifact') budget *= D.artById[o.art].cls === 3 ? 2.2 : D.artById[o.art].cls === 2 ? 1.5 : 1;
      if (o.type === 'mine' && o.res === 'gold') budget *= 1.3;
      makeGuard(gx, gy, budget);
    });
    // Пазачи на неутралните градове — в гарнизона (правят се в world.js по маркер)

    // --- 6. Свързаност: всички градове, мини и обекти трябва да са достижими
    ensureConnected(map, rng, N, towns);

    // --- 7. Пътища между близки градове (прости L-образни отсечки през проходимо)
    for (let i = 0; i < towns.length; i++) for (let j = i + 1; j < towns.length; j++) {
      const a = towns[i], b = towns[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) > N * 0.6) continue;
      carveRoad(map, a.x, a.y, b.x, b.y, N);
    }
    map.starts = starts;
    return map;
  }

  /* Свързваме всички проходими компоненти, които съдържат обекти, с главната */
  function ensureConnected(map, rng, N, towns) {
    const idx = (x, y) => y * N + x;
    const passable = (x, y) => x >= 0 && y >= 0 && x < N && y < N && map.terrain[idx(x, y)] !== 0 && !map.block[idx(x, y)];
    function components() {
      const comp = new Int32Array(N * N).fill(-1);
      let c = 0; const sizes = [];
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (!passable(x, y) || comp[idx(x, y)] >= 0) continue;
        const stack = [[x, y]]; comp[idx(x, y)] = c; let size = 0;
        while (stack.length) {
          const [cx, cy] = stack.pop(); size++;
          // 4-свързаност: по-строга от търсенето на път, за да няма диагонални „цепки“
          for (let d = 0; d < 4; d++) {
            const nx = cx + MK.DIRS[d][0], ny = cy + MK.DIRS[d][1];
            if (passable(nx, ny) && comp[idx(nx, ny)] < 0) { comp[idx(nx, ny)] = c; stack.push([nx, ny]); }
          }
        }
        sizes.push(size); c++;
      }
      return { comp, sizes };
    }
    for (let iter = 0; iter < 30; iter++) {
      const { comp, sizes } = components();
      const main = comp[idx(towns[0].x, towns[0].y)];
      // компоненти с обекти, различни от главната
      const need = new Map();
      map.objects.forEach((o) => {
        const c = comp[idx(o.x, o.y)];
        if (c >= 0 && c !== main && !need.has(c)) need.set(c, o);
      });
      if (!need.size) break;
      // за всяка: прокопаваме права линия до най-близка плочка от главната
      need.forEach((o, c) => {
        let best = null, bd = Infinity;
        for (let y = 0; y < N; y += 1) for (let x = 0; x < N; x += 1) {
          if (comp[idx(x, y)] !== main) continue;
          const d = Math.hypot(x - o.x, y - o.y);
          if (d < bd) { bd = d; best = [x, y]; }
        }
        if (!best) return;
        carveLine(map, o.x, o.y, best[0], best[1], N, true);
      });
    }
    // Обекти, изолирани върху непроходимо (не би трябвало), се освобождават
  }

  function carveLine(map, x0, y0, x1, y1, N, wide) {
    const idx = (x, y) => y * N + x;
    let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (;;) {
      const cells = wide ? [[x0, y0], [x0 + 1, y0], [x0, y0 + 1]] : [[x0, y0]];
      cells.forEach(([x, y]) => {
        if (x < 0 || y < 0 || x >= N || y >= N) return;
        const i = idx(x, y);
        map.block[i] = 0;
        if (map.terrain[i] === 0) map.terrain[i] = 3;
      });
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  function carveRoad(map, x0, y0, x1, y1, N) {
    // Път по права линия, само през вече проходими плочки без обекти (не рушим гори)
    const idx = (x, y) => y * N + x;
    let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, err = dx + dy;
    let x = x0, y = y0;
    for (;;) {
      const i = idx(x, y);
      if (map.terrain[i] !== 0 && !map.block[i] && (map.objAt[i] < 0 || (x === x0 && y === y0) || (x === x1 && y === y1))) map.road[i] = 1;
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
  }

  MK.MapGen = { generate };
})();
