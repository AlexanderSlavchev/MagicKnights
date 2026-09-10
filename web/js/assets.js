/* MagicKnights — рисувани графики (web/img/*.webp).
   Зарежда manifest.json и подменя функциите на G (gfx.js) с версии, които рисуват
   готовите картинки. Липсва ли картинка (или още не е заредена) — остава процедурната. */
(function () {
  'use strict';
  const MK = (window.MK = window.MK || {});
  const G = MK.Gfx, D = MK.data;
  const BASE = 'img/';
  const files = {}; // rel → {w,h}
  const imgs = {};  // rel → HTMLImageElement (loaded) | 'loading'
  const cache = new Map();
  let ready = false;

  // XHR вместо fetch — работи и от file:// в Android WebView
  try {
    const x = new XMLHttpRequest(); x.open('GET', BASE + 'manifest.json'); x.overrideMimeType('application/json');
    x.onload = () => { try { const m = JSON.parse(x.responseText); Object.assign(files, m.files || {}); ready = true; preload(); } catch (e) { /* без рисувани графики */ } };
    x.send();
  } catch (e) { /* без рисувани графики */ }

  function has(rel) { return ready && !!files[rel]; }
  /* Връща заредена картинка или null (и започва зареждането) */
  function get(rel) {
    if (!has(rel)) return null;
    const i = imgs[rel];
    if (i && i !== 'loading') return i;
    if (!i) { const im = new Image(); im.onload = () => { imgs[rel] = im; }; im.onerror = () => { delete files[rel]; }; im.src = BASE + rel + '.webp'; imgs[rel] = 'loading'; }
    return null;
  }
  function url(rel) { return has(rel) ? BASE + rel + '.webp' : null; }
  /* Зарежда списък от картинки; изпълнява се при готовност или след таймаут */
  function load(list, timeout) {
    return new Promise((resolve) => {
      const start = performance.now();
      const tick = () => {
        let pending = 0;
        list.forEach((rel) => { if (has(rel) && !get(rel)) pending++; });
        if (!pending || (ready && performance.now() - start > (timeout || 8000))) resolve();
        else setTimeout(tick, 40);
      };
      if (!ready) { const wait = () => (ready ? tick() : (performance.now() - start > 3000 ? resolve() : setTimeout(wait, 40))); wait(); } else tick();
    });
  }
  /* Всичко, което текущият свят ще покаже: терени, декор, обекти, същества, герои, градове, UI */
  function listForWorld(w) {
    const D = MK.data, set = new Set();
    Object.keys(files).forEach((k) => { if (/^(terrain|decor|ui)\//.test(k)) set.add(k); });
    const cre = (id) => { if (id) set.add('creatures/' + id); };
    const army = (a) => (a || []).forEach((s) => s && cre(s.c));
    w.map.objects.forEach((o) => {
      set.add(objectName(o, w));
      if (o.type === 'monster') cre(o.creature);
      if (o.guard) (o.guard.stacks || [o.guard]).forEach((g) => cre(g.creature));
      if (o.type === 'dwelling') cre(o.creature);
    });
    for (const id in w.heroes) { const h = w.heroes[id]; set.add('heroes/' + h.cls + '_mounted'); set.add('heroes/' + h.cls + '_portrait'); army(h.army); }
    set.add('objects/boat');
    const factions = new Set(w.players.map((p) => p.faction));
    for (const id in w.towns) { const t = w.towns[id]; factions.add(t.faction); army(t.garrison); }
    factions.forEach((f) => {
      set.add('towns/' + f + '_map'); set.add('towns/' + f + '_map_fort'); set.add('towns/' + f + '_screen'); set.add('objects/dwelling_' + f);
      for (let i = 1; i <= 7; i++) { set.add('buildings/' + f + '_dwelling' + i); cre(f + i); cre(f + i + 'u'); }
      Object.keys(files).forEach((k) => { if (k.startsWith('buildings/' + f + '_') || (f === 'kingdom' && k.startsWith('buildings/common_'))) set.add(k); });
      (D.CLASSES ? Object.keys(D.CLASSES) : []).forEach((c) => { if (D.CLASSES[c].faction === f) { set.add('heroes/' + c + '_mounted'); set.add('heroes/' + c + '_portrait'); } });
    });
    D.TERRAIN.forEach((t) => set.add('battle/bg_' + t.key));
    ['battle/siege_wall', 'battle/catapult', 'battle/obstacles', 'creatures/dungeon7u'].forEach((k) => set.add(k));
    return [...set].filter(has);
  }
  function listForBattle(ctx) {
    const set = new Set();
    [ctx.attacker.army, ctx.defender.army, ctx.defender.garrison].forEach((a) => (a || []).forEach((s) => s && set.add('creatures/' + s.c)));
    [ctx.attacker.hero, ctx.defender.hero].forEach((h) => { if (h) { set.add('heroes/' + h.cls + '_mounted'); set.add('heroes/' + h.cls + '_portrait'); } });
    const D = MK.data; if (ctx.terrain !== undefined && D.TERRAIN[ctx.terrain]) set.add('battle/bg_' + D.TERRAIN[ctx.terrain === 0 ? 3 : ctx.terrain].key);
    Object.keys(files).forEach((k) => { if (/^(ui|battle)\//.test(k)) set.add(k); });
    return [...set].filter(has);
  }
  function preload() {
    Object.keys(files).filter((k) => /^(terrain|decor|ui)\//.test(k)).forEach(get);
  }
  function spr(key, w, h, draw) {
    let c = cache.get(key); if (c) return c;
    c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h);
    draw(c.getContext('2d'), w, h); cache.set(key, c); return c;
  }
  /* Вписва картинка в правоъгълник (contain), закотвена долу-център */
  function fit(g, im, x, y, w, h, flip) {
    const k = Math.min(w / im.width, h / im.height), dw = im.width * k, dh = im.height * k;
    g.save();
    if (flip) { g.translate(x + w, 0); g.scale(-1, 1); g.drawImage(im, (w - dw) / 2, y + h - dh, dw, dh); }
    else g.drawImage(im, x + (w - dw) / 2, y + h - dh, dw, dh);
    g.restore();
  }
  function pennant(g, x, y, s, color) {
    g.fillStyle = '#6b4a22'; g.fillRect(x, y, s * 0.06, s * 0.9);
    g.fillStyle = color; g.beginPath(); g.moveTo(x + s * 0.06, y); g.lineTo(x + s * 0.7, y + s * 0.22); g.lineTo(x + s * 0.06, y + s * 0.44); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; g.stroke();
  }
  const tkey = (t) => (D.TERRAIN[t] ? D.TERRAIN[t].key : 'grass');
  const hn = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + (c || 0) * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  /* Гладък шум по една ос; при зададен период N (в сегменти) се повтаря, за да е непрекъснат през 4×4 плочки */
  const smoothN = (seed, x, P, N) => { let i = Math.floor(x / P); const f = x / P - i; if (N) i = ((i % N) + N) % N; const a = hn(seed, i), b = hn(seed, N ? (i + 1) % N : i + 1), t = f * f * (3 - 2 * f); return a + (b - a) * t; };

  const orig = {};
  ['creatureSprite', 'heroSprite', 'objectSprite', 'portrait', 'terrainTile', 'edgeBlend', 'waterTile', 'decor'].forEach((k) => { orig[k] = G[k]; });

  // ---------------------------------------------------------------- терен
  // Безшевната текстура се разстила върху GRID×GRID плочки. Правим едно голямо платно с
  // 1px обвивка от отсрещния край (за да няма шевове при мащабиране) и режем плочките от него.
  const GRID = 4;
  function bigTex(key, im, S, gx, gy) {
    const W = S * gx, H = S * gy;
    return spr('B' + key + '_' + S, W + 2, H + 2, (g) => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) g.drawImage(im, 1 + dx * W, 1 + dy * H, W, H);
    });
  }
  function cutTile(key, big, S, vx, vy) {
    return spr(key, S + 2, S + 2, (g) => { g.drawImage(big, vx * S, vy * S, S + 2, S + 2, 0, 0, S + 2, S + 2); });
  }
  G.terrainTile = function (t, variant, S) {
    const im = get('terrain/' + tkey(t));
    if (!im) return orig.terrainTile(t, variant, S);
    const big = bigTex('t' + t, im, S, GRID, GRID);
    return cutTile('T' + t + '_' + (variant & 15) + '_' + S, big, S, variant & 3, (variant >> 2) & 3);
  };
  // Ред на преливане (както в класиките): по-„силният“ терен навлиза в по-слабия
  const PRIO = { sand: 0, grass: 1, dirt: 2, subterranean: 3, wasteland: 4, rough: 5, swamp: 6, snow: 7, lava: 8, water: -1 };
  G.blendPriority = (t) => PRIO[tkey(t)] || 0;
  G.edgeBlend = function (nt, variant, dir, S, coast) {
    if (!get('terrain/' + tkey(nt))) return orig.edgeBlend(nt, variant, dir, S);
    return spr('E' + nt + '_' + (variant & 15) + '_' + dir + '_' + S + (coast ? 'c' + coast : ''), S + 2, S + 2, (g) => {
      g.drawImage(G.terrainTile(nt, variant, S), 0, 0);
      const img = g.getImageData(0, 0, S + 2, S + 2), d = img.data, [dx, dy] = MK.DIRS[dir];
      const diag = dx && dy;
      for (let y = 0; y < S + 2; y++) for (let x = 0; x < S + 2; x++) {
        const px = (x - 1) / S, py = (y - 1) / S;
        let e; // разстояние от ръба/ъгъла, откъдето идва съседът (0 = на ръба)
        if (diag) { const cx = dx > 0 ? 1 - px : px, cy = dy > 0 ? 1 - py : py; e = Math.hypot(cx, cy); }
        else e = dx ? (dx > 0 ? 1 - px : px) : (dy > 0 ? 1 - py : py);
        // шумът върви по глобалната координата (плочка×S + пиксел), за да няма прекъсвания на границите
        const along = dx && !dy ? ((variant >> 2) & 3) * S + y : (variant & 3) * S + x;
        const n = (smoothN(77 + nt, along, S / 4, 16) - 0.5) * 0.16 + (smoothN(79 + nt, along, S / 8, 32) - 0.5) * 0.06;
        const w = coast ? (diag ? 0.26 : 0.34) : (diag ? 0.32 : 0.42); // дълбочина на навлизане
        let a = 1 - (e + n) / w; a = Math.max(0, Math.min(1, a));
        const o = (y * (S + 2) + x) * 4;
        if (coast) {
          // бряг: рязък ръб на сушата, влажна тъмна ивица по него и бяла пяна във водата отвън
          const edge = a; // 0 = вода, 1 = суша
          const land = Math.max(0, Math.min(1, (edge - 0.45) * 6)); // почти твърд ръб
          const wet = Math.exp(-Math.pow((edge - 0.5) / 0.09, 2)); // тъмна мокра линия
          const foam = Math.exp(-Math.pow((edge - 0.30) / 0.10, 2)); // пяна пред брега
          const fr = d[o], fg = d[o + 1], fb = d[o + 2];
          d[o] = Math.round(fr * (1 - wet * 0.45)); d[o + 1] = Math.round(fg * (1 - wet * 0.4)); d[o + 2] = Math.round(fb * (1 - wet * 0.3));
          if (coast === 2) { d[o] = 236; d[o + 1] = 246; d[o + 2] = 250; d[o + 3] = Math.round(255 * foam * 0.85 * (1 - land)); }
          else d[o + 3] = Math.round(255 * land);
        } else { a = a * a * (3 - 2 * a); d[o + 3] = Math.round(255 * a); }
      }
      g.putImageData(img, 0, 0);
    });
  };
  // Водата: безшевна плочка (terrain/water, правена от build-assets) върху 4×4 плочки;
  // движението идва от леко „дишане“ на светлината в рендера, не от смяна на кадри.
  G.waterTile = function (frame, variant, S) {
    const im = get('terrain/water');
    if (!im) return orig.waterTile(frame, variant, S);
    const big = bigTex('water', im, S, GRID, GRID);
    return cutTile('W' + (variant & 15) + '_' + S, big, S, variant & 3, (variant >> 2) & 3);
  };

  // ---------------------------------------------------------------- декор
  const TREES = { snow: 'trees_pine', grass: 'trees_leaf', dirt: 'trees_leaf', sand: 'trees_palm', swamp: 'trees_swamp', rough: 'trees_pine', lava: 'trees_dead', subterranean: 'trees_mushroom', wasteland: 'trees_dead', water: 'trees_leaf' };
  const MOUNT = { snow: 'mountain_snow', lava: 'mountain_lava', sand: 'mountain_desert', wasteland: 'mountain_desert', subterranean: 'mountain_cave' };
  function decorName(kind, variant, terrain) {
    const k = tkey(terrain);
    if (kind === 2) return MOUNT[k] || 'mountain_grass';
    if (kind === 3) return variant & 4 ? 'rocks' : 'trees_palm';
    if (kind === 4) return 'trees_dead';
    if (kind === 5) return 'trees_mushroom';
    if (kind === 1 && (k === 'grass' || k === 'dirt') && (variant & 2)) return 'trees_pine';
    return TREES[k] || 'trees_leaf';
  }
  G.decor = function (kind, variant, S, terrain, mask) {
    const im = get('decor/' + decorName(kind, variant, terrain));
    if (!im) return orig.decor(kind, variant, S, terrain, mask);
    const R = Math.max(S, 256);
    return spr('D' + kind + '_' + (variant & 7) + '_' + terrain + '_' + S, R, R * 1.6, (g) => {
      const big = kind === 2;
      fit(g, im, big ? -R * 0.08 : R * 0.03, 0, big ? R * 1.16 : R * 0.94, R * (big ? 1.55 : 1.45), !!(variant & 1));
    });
  };

  // ---------------------------------------------------------------- обекти
  function objectName(o, world) {
    switch (o.type) {
      case 'town': { const t = world && o.townId !== undefined ? world.towns[o.townId] : null; return 'towns/' + (o.faction || 'kingdom') + (t && world.fortLevel(t) >= 1 ? '_map_fort' : '_map'); }
      case 'mine': return 'objects/mine_' + o.res;
      case 'resource': return 'objects/res_' + o.res;
      case 'monster': return 'creatures/' + o.creature;
      case 'dwelling': { const c = D.creatureOf(o.creature); return 'objects/dwelling_' + (c ? c.faction : 'kingdom'); }
      case 'shipyard': return has('objects/shipyard') ? 'objects/shipyard' : 'buildings/common_shipyard';
      case 'dragon_utopia': return has('objects/dragon_utopia') ? 'objects/dragon_utopia' : 'decor/mountain_lava';
      default: return 'objects/' + o.type;
    }
  }
  G.objectSprite = function (o, S, world) {
    const rel = objectName(o, world), im = get(rel);
    if (!im) return orig.objectSprite(o, S, world);
    const owner = o.owner !== undefined ? o.owner : -2;
    const col = owner >= 0 && world && world.players[owner] ? world.players[owner].color : null;
    const R = Math.max(S, 320);
    return spr('O' + rel + '_' + owner + '_' + S + '_' + (o.empty ? 'e' : ''), R, R * 1.4, (g) => {
      const gy = R * 1.4 - R * 0.1;
      const town = o.type === 'town', mons = o.type === 'monster';
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(R / 2, gy - R * 0.03, R * (town ? 0.5 : 0.36), R * (town ? 0.14 : 0.09), 0, 0, Math.PI * 2); g.fill();
      if (town) fit(g, im, -R * 0.1, R * 0.05, R * 1.2, gy - R * 0.05);
      else if (mons) fit(g, im, R * 0.12, R * 0.35, R * 0.76, gy - R * 0.35);
      else fit(g, im, R * 0.05, R * 0.2, R * 0.9, gy - R * 0.2);
      if (o.type === 'dragon_utopia' && rel === 'decor/mountain_lava') { const dr = get('creatures/dungeon7u'); if (dr) fit(g, dr, R * 0.25, R * 0.55, R * 0.6, gy - R * 0.55); }
      if (col && (town || o.type === 'mine' || o.type === 'dwelling')) pennant(g, R * 0.06, R * 0.22, R * 0.28, col);
      if (o.empty) { g.globalAlpha = 0.45; g.fillStyle = '#000'; g.fillRect(0, 0, R, R * 1.4); }
    });
  };

  // ---------------------------------------------------------------- герои и същества
  G.heroSprite = function (h, S, color, frame) {
    const rel = h.boat ? 'objects/boat' : 'heroes/' + h.cls + '_mounted';
    const im = get(rel);
    if (!im) return orig.heroSprite(h, S, color, frame);
    const R = Math.max(S, 320);
    return spr('H' + rel + '_' + color + '_' + S, R, R * 1.4, (g) => {
      const gy = R * 1.28;
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(R / 2, gy, R * 0.4, R * 0.1, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = color; g.lineWidth = R * 0.035; g.beginPath(); g.ellipse(R / 2, gy, R * 0.4, R * 0.1, 0, 0, Math.PI * 2); g.stroke();
      fit(g, im, R * 0.05, R * 0.02, R * 0.9, gy + R * 0.02);
    });
  };
  G.creatureSprite = function (c, S, flip) {
    const im = get('creatures/' + c.id);
    if (!im) return orig.creatureSprite(c, S, flip);
    const R = Math.max(S, 320);
    return spr('C' + c.id + '_' + S + (flip ? 'f' : ''), R, R * 1.4, (g) => {
      const gy = R * 1.3;
      fit(g, im, c.wide ? -R * 0.15 : R * 0.02, R * 0.05, c.wide ? R * 1.3 : R * 0.96, gy - R * 0.05, flip);
    });
  };
  G.portrait = function (h, S, color) {
    const im = get('heroes/' + h.cls + '_portrait');
    if (!im) return orig.portrait(h, S, color);
    return spr('P' + h.cls + '_' + S + '_' + color, S, S, (g) => {
      const k = Math.max(S / im.width, S / im.height);
      g.drawImage(im, (S - im.width * k) / 2, (S - im.height * k) / 2, im.width * k, im.height * k);
      g.strokeStyle = color; g.lineWidth = Math.max(2, S * 0.05); g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, S - g.lineWidth, S - g.lineWidth);
    });
  };

  MK.Img = { has, get, url, load, listForWorld, listForBattle, files, procedural: orig };
})();
