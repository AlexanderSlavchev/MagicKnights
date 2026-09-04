/* A* върху приключенската карта (8 посоки, цена по терен, диагонал ×1.414) */
(function () {
  'use strict';
  const MK = (window.MK = window.MK || {});
  const D = MK.data;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  MK.DIRS = DIRS;

  // Двоична пирамида за отворения списък
  class Heap {
    constructor() { this.a = []; }
    push(n) { const a = this.a; a.push(n); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
    pop() { const a = this.a; const top = a[0]; const last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < a.length && a[l].f < a[m].f) m = l; if (r < a.length && a[r].f < a[m].f) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
    get size() { return this.a.length; }
  }

  /* Цена за влизане в плочка (x,y) от hero. Връща Infinity ако е непроходима.
     opts.ignoreObjects — за проверки на свързаност при генерирането */
  function tileCost(world, hero, x, y, diag) {
    const m = world.map;
    if (x < 0 || y < 0 || x >= m.w || y >= m.h) return Infinity;
    const i = y * m.w + x;
    const t = D.TERRAIN[m.terrain[i]];
    if (!t.passable || m.block[i]) return Infinity;
    let c;
    if (m.road[i]) c = D.ROAD_COST;
    else {
      c = t.cost;
      if (hero) {
        // Роден терен за цялата армия — без наказание
        if (hero._native === undefined) hero._native = MK.World.armyNativeTerrain(hero);
        if (hero._native === m.terrain[i]) c = 100;
        else if (c > 100) {
          const pf = hero.skills.pathfinding || 0;
          c = 100 + (c - 100) * [1, 0.75, 0.5, 0][pf];
        }
      }
    }
    return diag ? Math.round(c * 1.41421) : c;
  }

  /* Намира път от героя до (tx,ty). Връща {path:[{x,y,cost}], total} или null.
     Пътят не минава през чудовища и герои освен като крайна цел. */
  function findPath(world, hero, tx, ty, maxNodes) {
    const m = world.map;
    if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return null;
    const sx = hero.x, sy = hero.y;
    if (sx === tx && sy === ty) return null;
    const W = m.w;
    const goalIdx = ty * W + tx;
    // Целта трябва да е достъпна поне като крайна плочка
    if (tileCost(world, hero, tx, ty, false) === Infinity) return null;
    const gScore = new Map();
    const came = new Map();
    const heap = new Heap();
    const h = (x, y) => { const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return (Math.max(dx, dy) - Math.min(dx, dy)) * 65 + Math.min(dx, dy) * 92; };
    const startIdx = sy * W + sx;
    gScore.set(startIdx, 0);
    heap.push({ i: startIdx, g: 0, f: h(sx, sy) });
    const closed = new Set();
    let nodes = 0;
    maxNodes = maxNodes || 40000;
    while (heap.size) {
      const cur = heap.pop();
      if (closed.has(cur.i)) continue;
      if (cur.i === goalIdx) {
        // Реконструкция
        const path = [];
        let i = goalIdx;
        while (i !== startIdx) {
          path.push({ x: i % W, y: Math.floor(i / W), cost: gScore.get(i) });
          i = came.get(i);
        }
        path.reverse();
        return { path, total: gScore.get(goalIdx) };
      }
      closed.add(cur.i);
      if (++nodes > maxNodes) break;
      const cx = cur.i % W, cy = Math.floor(cur.i / W);
      for (let d = 0; d < 8; d++) {
        const nx = cx + DIRS[d][0], ny = cy + DIRS[d][1];
        if (nx < 0 || ny < 0 || nx >= W || ny >= m.h) continue;
        const ni = ny * W + nx;
        if (closed.has(ni)) continue;
        const isGoal = ni === goalIdx;
        // Обекти: чудовища, герои и градове са проходими само като цел
        if (!isGoal && world.blocksPassage(nx, ny, hero)) continue;
        // Диагонално не се минава между два непроходими ъгъла (както в класиката)
        const diag = d >= 4;
        if (diag) {
          const c1 = tileCost(world, hero, cx + DIRS[d][0], cy, false), c2 = tileCost(world, hero, cx, cy + DIRS[d][1], false);
          if (c1 === Infinity && c2 === Infinity) continue;
        }
        const step = tileCost(world, hero, nx, ny, diag);
        if (step === Infinity) continue;
        const g = cur.g + step;
        if (g < (gScore.get(ni) ?? Infinity)) {
          gScore.set(ni, g);
          came.set(ni, cur.i);
          heap.push({ i: ni, g, f: g + h(nx, ny) });
        }
      }
    }
    return null;
  }

  /* Всички достъпни плочки с наличните точки — за оцветяване и за ИИ. Връща Map idx->cost */
  function reachable(world, hero, budget) {
    const m = world.map, W = m.w;
    const dist = new Map();
    const heap = new Heap();
    const s = hero.y * W + hero.x;
    dist.set(s, 0); heap.push({ i: s, f: 0 });
    while (heap.size) {
      const cur = heap.pop();
      if (cur.f > dist.get(cur.i)) continue;
      const cx = cur.i % W, cy = Math.floor(cur.i / W);
      for (let d = 0; d < 8; d++) {
        const nx = cx + DIRS[d][0], ny = cy + DIRS[d][1];
        if (nx < 0 || ny < 0 || nx >= W || ny >= m.h) continue;
        const ni = ny * W + nx;
        const blocks = world.blocksPassage(nx, ny, hero);
        const step = tileCost(world, hero, nx, ny, d >= 4);
        if (step === Infinity) continue;
        const g = cur.f + step;
        if (g > budget) continue;
        if (g < (dist.get(ni) ?? Infinity)) {
          dist.set(ni, g);
          if (!blocks) heap.push({ i: ni, f: g });
        }
      }
    }
    return dist;
  }

  MK.Path = { findPath, reachable, tileCost, Heap };
})();
