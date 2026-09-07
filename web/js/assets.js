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
  const smoothN = (seed, x, P) => { const i = Math.floor(x / P), f = x / P - i, a = hn(seed, i), b = hn(seed, i + 1), t = f * f * (3 - 2 * f); return a + (b - a) * t; };

  const orig = {};
  ['creatureSprite', 'heroSprite', 'objectSprite', 'portrait', 'terrainTile', 'edgeBlend', 'waterTile', 'decor'].forEach((k) => { orig[k] = G[k]; });

  // ---------------------------------------------------------------- терен
  const GRID = 4; // безшевната текстура се разстила върху 4×4 плочки
  G.terrainTile = function (t, variant, S) {
    const im = get('terrain/' + tkey(t));
    if (!im) return orig.terrainTile(t, variant, S);
    return spr('T' + t + '_' + (variant & 15) + '_' + S, S + 2, S + 2, (g) => {
      const cell = im.width / GRID, k = S / cell, vx = variant & 3, vy = (variant >> 2) & 3;
      const p = g.createPattern(im, 'repeat'); p.setTransform(new DOMMatrix().translate(1 - vx * cell * k, 1 - vy * cell * k).scale(k));
      g.fillStyle = p; g.fillRect(0, 0, S + 2, S + 2);
    });
  };
  G.edgeBlend = function (nt, variant, dir, S) {
    if (!get('terrain/' + tkey(nt))) return orig.edgeBlend(nt, variant, dir, S);
    return spr('E' + nt + '_' + (variant & 15) + '_' + dir + '_' + S, S + 2, S + 2, (g) => {
      g.drawImage(G.terrainTile(nt, variant, S), 0, 0);
      const img = g.getImageData(0, 0, S + 2, S + 2), d = img.data, [dx, dy] = MK.DIRS[dir];
      for (let y = 0; y < S + 2; y++) for (let x = 0; x < S + 2; x++) {
        const px = x - 1, py = y - 1;
        const e = dx ? (dx > 0 ? S - 1 - px : px) : (dy > 0 ? S - 1 - py : py);
        const along = dx ? py : px;
        const n = smoothN(77 + nt, along, S / 5) * 0.7 + smoothN(79 + nt, along, S / 13) * 0.3;
        const w = e / S + (n - 0.5) * 0.34;
        let a = 1 - w / 0.5; a = Math.max(0, Math.min(1, a)); a = a * a * (3 - 2 * a) * 0.92;
        d[(y * (S + 2) + x) * 4 + 3] = Math.round(255 * a);
      }
      g.putImageData(img, 0, 0);
    });
  };
  const WSEQ = [0, 1, 2, 3, 3, 2, 1, 0];
  G.waterTile = function (frame, variant, S) {
    const im = get('terrain/water_frames');
    if (!im) return orig.waterTile(frame, variant, S);
    const f = WSEQ[frame & 7], fw = im.width / 4;
    const frameC = spr('WF' + f, fw, im.height, (g) => g.drawImage(im, -f * fw, 0));
    return spr('W' + f + '_' + (variant & 3) + '_' + S, S + 2, S + 2, (g) => {
      const cell = fw / 2, k = S / cell, vx = variant & 1, vy = (variant >> 1) & 1;
      const p = g.createPattern(frameC, 'repeat'); p.setTransform(new DOMMatrix().translate(1 - vx * cell * k, 1 - vy * cell * k).scale(k));
      g.fillStyle = p; g.fillRect(0, 0, S + 2, S + 2);
    });
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

  MK.Img = { has, get, url, files, procedural: orig };
})();
