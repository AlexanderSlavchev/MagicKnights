/* Приключенски ИИ: строене, набор, събиране на ресурси, атака на слаби цели,
   завръщане за подкрепления. Ходът е генератор — при битка с човек
   се предава на интерфейса и продължава след резултата. */
(function () {
  'use strict';
  const MK = (window.MK = window.MK || {});
  const D = MK.data;
  const Army = MK.Army;

  const BUILD_ORDER = ['tavern', 'dw2', 'market', 'dw3', 'hall2', 'mage1', 'dw4', 'fort2', 'hall3', 'dw5', 'well', 'dw6', 'fort3', 'dw1u', 'mage2', 'dw7', 'dw4u', 'dw5u', 'dw3u', 'dw2u', 'hall4', 'dw6u', 'mage3', 'silo', 'dw7u', 'mage4', 'mage5'];

  function* turn(world, p, opts) {
    opts = opts || {};
    const bonus = D.DIFFICULTY[world.difficulty].aiBonus || 1;
    // 1. Градове: строене и набор
    p.towns.slice().forEach((tid) => {
      const t = world.towns[tid];
      // строим по приоритет
      for (const id of BUILD_ORDER) { if (!t.buildings[id] && world.canBuild(t, id).ok) { world.build(t, id); break; } }
      // набор: в посетилия герой, иначе гарнизон
      const vis = t.visitor ? world.heroes[t.visitor] : null;
      recruitAll(world, t, vis ? vis.army : t.garrison);
      // подобрения на посетил герой
      if (vis) vis.army.forEach((s, i) => { if (s && world.upgradeCost(t, vis.army, i)) { const c = world.upgradeCost(t, vis.army, i); if (world.canAfford(p, c) && p.res.gold - c.gold > 3000) world.upgradeStack(t, vis.army, i); } });
    });
    // 2. Наемане на втори/трети герой
    if (p.heroes.length < Math.min(3, 1 + Math.floor(world.week() / 2) + 1) && p.res.gold >= 2500 + 2000) {
      const t = p.towns.map((id) => world.towns[id]).find((t) => t.buildings.tavern && !t.visitor);
      if (t) { const r = world.hireHero(t, 0); if (r.ok) { r.hero.movement = 0; } }
    }
    // 3. Герои
    for (const hid of p.heroes.slice()) {
      const h = world.heroes[hid];
      if (!h) continue;
      world.autoLevelUp(h);
      let guard = 0;
      while (h.movement > 0 && world.heroes[h.id] && guard++ < 12) {
        const target = pickTarget(world, h, p);
        if (!target) break;
        const path = target.path;
        let stopped = false;
        for (const st of path.path) {
          const r = world.stepHero(h, st.x, st.y);
          if (r.stop) { stopped = true; break; }
          if (r.event) {
            const ev = r.event;
            if (ev.type === 'battle') {
              const humanInvolved = world.players[ev.defender.owner] && world.players[ev.defender.owner].human;
              if (humanInvolved && !opts.autoAll) {
                const res = yield { type: 'battle', ctx: ev };
                world.resolveBattle(ev, res);
              } else {
                ev.world = world; ev.seed = world.rng.int(1, 1e9); ev.terrain = world.map.terrain[world.idx(h.x, h.y)];
                const b = new MK.Battle(ev);
                const res = b.runAuto();
                world.resolveBattle(ev, res);
              }
              world.events = world.events.filter((e) => e.type !== 'battleResult' && e.type !== 'enterTown');
              stopped = true; break;
            }
            if (ev.type === 'choice') { const i = ev.aiPick ? ev.aiPick() : 0; ev.options[i].apply(); world.autoLevelUp(h); stopped = true; break; }
            if (ev.type === 'dwelling') { aiDwelling(world, h, ev.obj); stopped = true; break; }
            if (ev.type === 'enterTown') {
              const t = ev.town; if (t.owner === h.owner) { recruitAll(world, t, h.army); mergeGarrison(t, h); }
              stopped = true; break;
            }
            if (ev.type === 'meet') { mergeHeroes(world, h, ev.other); stopped = true; break; }
            if (ev.type === 'visit') { stopped = true; break; }
          }
        }
        if (!world.heroes[h.id]) break;
        world.autoLevelUp(h);
        if (!stopped && target.kind === 'explore') break;
        yield { type: 'moved', hero: h };
      }
    }
    world.events = world.events.filter((e) => e.type !== 'msg' || e.kind === 'week');
    return true;
  }

  function recruitAll(world, t, army) {
    const p = world.players[t.owner];
    for (let tier = 7; tier >= 1; tier--) {
      if (!t.buildings['dw' + tier] || t.avail[tier] <= 0) continue;
      const upg = !!t.buildings['dw' + tier + 'u'];
      const cid = t.faction + tier + (upg ? 'u' : '');
      if (!Army.canAdd(army, cid)) continue;
      // Оставяме резерв злато за строене на по-ниските нива
      const reserve = tier >= 5 ? 0 : 1500;
      const c = D.creatureOf(cid);
      let n = Math.min(t.avail[tier], world.maxAffordable(p, cid));
      n = Math.min(n, Math.floor(Math.max(0, p.res.gold - reserve) / c.cost.gold));
      if (n > 0) world.recruit(t, tier, upg, n, army);
    }
  }
  function mergeGarrison(t, h) {
    // Героят взима гарнизона, оставя минимум ако е стартов град и е седмица 3+
    for (let i = 0; i < 7; i++) { const s = t.garrison[i]; if (s && s.n > 0) { if (!Army.add(h.army, s.c, s.n)) t.garrison[i] = null; } }
  }
  function mergeHeroes(world, h, other) {
    // По-силният взима всичко
    const [strong, weak] = world.heroStrength(h) >= world.heroStrength(other) ? [h, other] : [other, h];
    for (let i = 0; i < 7; i++) { const s = weak.army[i]; if (s && s.n > 0 && Army.add(strong.army, s.c, s.n) === 0) weak.army[i] = null; }
    if (Army.isEmpty(weak.army)) { const s = strong.army.find((x) => x && x.n > 1); if (s) { Army.add(weak.army, s.c, 1); s.n -= 1; } }
  }
  function aiDwelling(world, h, o) {
    const p = world.players[h.owner];
    const c = D.creatureOf(o.creature);
    let n = Math.min(o.available, world.maxAffordable(p, o.creature));
    if (n > 0 && Army.canAdd(h.army, o.creature)) { world.pay(p, world.recruitCost(o.creature, n)); o.available -= n; Army.add(h.army, o.creature, n); }
  }

  /* Избор на цел: стойност / цена на пътя. Връща {path, kind, obj} */
  function pickTarget(world, h, p) {
    const my = world.heroStrength(h);
    const cands = [];
    const bonus = D.DIFFICULTY[world.difficulty].aiBonus || 1;
    const home = p.towns.length ? world.towns[p.towns[0]] : null;
    world.map.objects.forEach((o) => {
      const d = Math.hypot(o.x - h.x, o.y - h.y);
      if (d > 22) return;
      let v = 0, kind = 'visit';
      switch (o.type) {
        case 'resource': v = o.res === 'gold' ? o.amount : o.res === 'wood' || o.res === 'ore' ? o.amount * 60 : o.amount * 120; break;
        case 'chest': v = 1500; break;
        case 'artifact': v = 1800; break;
        case 'campfire': v = 900; break;
        case 'mine': if (o.owner !== h.owner) v = o.res === 'gold' ? 3500 : o.res === 'wood' || o.res === 'ore' ? 1600 : 1400; break;
        case 'dwelling': if (o.owner !== h.owner || o.available > 0) v = 700; break;
        case 'learning': case 'mercenary': case 'tower_def': case 'star_axis': case 'garden': case 'school_war': case 'school_magic': v = h.visited[o.type.slice(0, 4) + o.id] || h.visited['learn' + o.id] || h.visited['merc' + o.id] || h.visited['tdef' + o.id] || h.visited['star' + o.id] || h.visited['gard' + o.id] || h.visited['school' + o.id] ? 0 : 800; break;
        case 'shrine1': case 'shrine2': case 'shrine3': v = h.spells.includes(o.spell) ? 0 : 500; break;
        case 'windmill': case 'watermill': v = o.takenWeek === world.week() ? 0 : 600; break;
        case 'wagon': v = o.empty ? 0 : 700; break;
        case 'monster': {
          const str = o.count * D.fightValue(D.creatureOf(o.creature));
          if (my > str * 1.5 / bonus) { v = 400 + str * 0.5; kind = 'fight'; }
          // ако пази нещо ценно — повече
          break;
        }
        case 'town': {
          const t = world.towns[o.townId];
          if (t.owner === h.owner) { // връщане за подкрепления: гарнизон или налични същества
            const gold = p.res.gold; const canRecruit = t.avail.some((n, i) => i >= 1 && n > 0 && t.buildings['dw' + i]);
            const gar = Army.strength(t.garrison);
            if (gar > my * 0.25) v = 1500 + gar * 3;
            else if (canRecruit && gold > 2000 && (world.dayOfWeek() >= 6 || Army.count(h.army) < 15)) v = 1200;
            break;
          }
          const gar = Army.strength(t.garrison) + (t.visitor && world.heroes[t.visitor] ? world.heroStrength(world.heroes[t.visitor]) : 0);
          const fort = world.fortLevel(t);
          if (my > (gar + 200) * (1.4 + fort * 0.3) / bonus) { v = 6000 + (t.owner >= 0 ? 4000 : 0); kind = 'fight'; }
          break;
        }
      }
      if (v <= 0) return;
      cands.push({ x: o.x, y: o.y, v, kind, obj: o });
    });
    // Вражески герои
    for (const id in world.heroes) {
      const e = world.heroes[id];
      if (e.owner === h.owner || e.owner < 0) continue;
      const d = Math.hypot(e.x - h.x, e.y - h.y);
      if (d > 14) continue;
      const str = world.heroStrength(e) + (e.inTown ? Army.strength(world.towns[e.inTown].garrison) : 0);
      if (my > str * 1.5 / bonus && !world.players[e.owner].human || my > str * 1.8 / bonus) cands.push({ x: e.x, y: e.y, v: 3000 + str * 0.2, kind: 'fight', hero: e });
    }
    // Оценка по път
    let best = null, bs = 0;
    cands.sort((a, b) => b.v - a.v).slice(0, 14).forEach((c) => {
      const path = MK.Path.findPath(world, h, c.x, c.y, 15000);
      if (!path) return;
      // Не тръгваме към неща извън днешния ход, ако има нещо близко (изключение: силни цели)
      const turns = Math.max(1, Math.ceil(path.total / Math.max(1, h.maxMovement)));
      let score = c.v / (turns + (path.total / 1500));
      if (!pathSafe(world, h, path, my, bonus, c.obj)) score = 0;
      if (score > bs) { bs = score; best = { path, kind: c.kind, obj: c.obj }; }
    });
    if (best) return best;
    // Нищо ценно наблизо: към най-близкия неразкрит район или вражески град
    let tgt = null, bd = Infinity;
    for (const id in world.towns) { const t = world.towns[id]; if (t.owner !== h.owner) { const d = Math.hypot(t.x - h.x, t.y - h.y); if (d < bd) { bd = d; tgt = t; } } }
    if (tgt) {
      // стъпваме до частична цел по посока
      for (let tries = 0; tries < 6; tries++) {
        const f = Math.min(1, (6 + tries * 3) / bd);
        const tx = Math.round(h.x + (tgt.x - h.x) * f), ty = Math.round(h.y + (tgt.y - h.y) * f);
        if (!world.inb(tx, ty)) continue;
        if (world.objectAt(tx, ty) || world.heroAt(tx, ty)) continue;
        const path = MK.Path.findPath(world, h, tx, ty, 8000);
        if (path && pathSafe(world, h, path, my, bonus)) return { path, kind: 'explore' };
      }
    }
    // Случайна достижима безопасна плочка
    const reach = MK.Path.reachable(world, h, h.movement);
    const far = [];
    reach.forEach((c, i) => { const x = i % world.map.w, y = Math.floor(i / world.map.w); if (!world.objectAt(x, y) && !world.heroAt(x, y) && c > 0) far.push({ c, x, y }); });
    far.sort((a, b) => b.c - a.c);
    for (const f of far.slice(0, 8)) { const path = MK.Path.findPath(world, h, f.x, f.y, 8000); if (path && pathSafe(world, h, path, my, bonus)) return { path, kind: 'explore' }; }
    return null;
  }

  /* Безопасен ли е пътят: никое чудовище до стъпките (освен самата цел) не е по-силно от нас */
  function pathSafe(world, h, path, my, bonus, targetObj) {
    for (const st of path.path) {
      const isLast = st === path.path[path.path.length - 1];
      for (let d = 0; d < 8; d++) {
        const o = world.objectAt(st.x + MK.DIRS[d][0], st.y + MK.DIRS[d][1]);
        if (!o || o.type !== 'monster' || (isLast && o === targetObj)) continue;
        // последната стъпка върху обект (мина, ресурс) също може да бъде причакана
        const str = o.count * D.fightValue(D.creatureOf(o.creature));
        if (my < str * 1.6 / bonus) return false;
      }
    }
    return true;
  }

  MK.AI = { turn, recruitAll, pickTarget, BUILD_ORDER };
})();
