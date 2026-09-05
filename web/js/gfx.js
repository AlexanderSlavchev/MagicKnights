/* Процедурна графика с високо ниво на детайл: текстурирани плочки, анимирана вода,
   многослойни гори и планини, фракционни градове, детайлни същества и герои.
   Всичко се рисува с код и се кешира по ключ. */
(function () {
  'use strict';
  const MK = (window.MK = window.MK || {});
  const D = MK.data;
  const cache = new Map();

  function sprite(key, w, h, draw) {
    let c = cache.get(key);
    if (c) return c;
    c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h);
    const g = c.getContext('2d');
    draw(g, w, h);
    cache.set(key, c);
    return c;
  }
  const hashN = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + (c || 0) * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const TAU = Math.PI * 2;

  // ---------------------------------------------------------------- цветове
  function parse(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function toHex(r, g, b) { return '#' + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1); }
  function shade(hex, f) { const [r, g, b] = parse(hex); const cl = (v) => Math.max(0, Math.min(255, v * f)); return toHex(cl(r), cl(g), cl(b)); }
  function mix(a, b, t) { const A = parse(a), B = parse(b); return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); }
  function rgba(hex, a) { const [r, g, b] = parse(hex); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; }
  MK.shade = shade; MK.mix = mix; MK.rgba = rgba;

  // ---------------------------------------------------------------- рисувателни помощници
  function ell(g, x, y, rx, ry, col) { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); }
  function circ(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  function poly(g, pts, col, strokeCol, lw) { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); if (col) { g.fillStyle = col; g.fill(); } if (strokeCol) { g.strokeStyle = strokeCol; g.lineWidth = lw || 1; g.stroke(); } }
  function rrect(g, x, y, w, h, r, col) { g.fillStyle = col; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); }
  function rgrad(g, x, y, r, c1, c2, ox, oy) { const gr = g.createRadialGradient(x + (ox || 0), y + (oy || 0), r * 0.1, x, y, r); gr.addColorStop(0, c1); gr.addColorStop(1, c2); return gr; }
  function lgrad(g, x0, y0, x1, y1, stops) { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach((s) => gr.addColorStop(s[0], s[1])); return gr; }
  function shadow(g, x, y, rx, ry, a) { ell(g, x, y, rx, ry, 'rgba(0,0,0,' + (a || 0.35) + ')'); }
  // Сфера със светлина от горе-ляво
  function sphere(g, x, y, r, col) { g.fillStyle = rgrad(g, x, y, r, shade(col, 1.35), shade(col, 0.6), -r * 0.35, -r * 0.35); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  // Кръгло дърво (широколистно)
  function leafTree(g, x, y, rad, col, dead) {
    shadow(g, x + rad * 0.2, y + rad * 0.15, rad * 1.1, rad * 0.35, 0.3);
    g.fillStyle = lgrad(g, x, y - rad, x, y + rad * 0.2, [[0, '#5a3e1e'], [1, '#2e1e0c']]); g.fillRect(x - rad * 0.12, y - rad * 0.6, rad * 0.24, rad * 0.9);
    if (dead) { g.strokeStyle = '#4a3a2a'; g.lineWidth = rad * 0.1; g.lineCap = 'round'; [[-0.7, -1.1], [0.6, -1.2], [-0.3, -1.5], [0.4, -0.6]].forEach(([dx, dy]) => { g.beginPath(); g.moveTo(x, y - rad * 0.5); g.quadraticCurveTo(x + dx * rad * 0.5, y - rad * 0.8, x + dx * rad, y + dy * rad); g.stroke(); }); return; }
    const c = [[0, -0.85, 0.75], [-0.55, -0.45, 0.62], [0.55, -0.5, 0.6], [0, -0.35, 0.7]];
    c.forEach(([dx, dy, k]) => sphere(g, x + dx * rad, y + dy * rad, rad * k, col));
    g.fillStyle = 'rgba(255,255,220,0.12)'; g.beginPath(); g.arc(x - rad * 0.25, y - rad * 1.05, rad * 0.35, 0, TAU); g.fill();
  }
  // Иглолистно дърво
  function pineTree(g, x, y, h, col, snow) {
    shadow(g, x + h * 0.1, y + h * 0.05, h * 0.4, h * 0.12, 0.3);
    g.fillStyle = '#3a2812'; g.fillRect(x - h * 0.05, y - h * 0.25, h * 0.1, h * 0.3);
    for (let i = 0; i < 3; i++) {
      const ty = y - h * (0.15 + i * 0.28), w = h * (0.42 - i * 0.1), hh = h * 0.42;
      g.fillStyle = lgrad(g, x - w, ty, x + w, ty, [[0, shade(col, 1.25)], [0.5, col], [1, shade(col, 0.55)]]);
      poly(g, [[x, ty - hh], [x + w, ty + hh * 0.1], [x - w, ty + hh * 0.1]], g.fillStyle);
      if (snow) poly(g, [[x, ty - hh], [x + w * 0.45, ty - hh * 0.35], [x - w * 0.45, ty - hh * 0.35]], 'rgba(255,255,255,0.85)');
    }
  }

  // ---------------------------------------------------------------- терен
  const noiseA = MK.noise2(1234), noiseB = MK.noise2(777), noiseC = MK.noise2(4242);
  // Безшевен шум: смес от четири отместени проби, така че плочката да се повтаря без ръбове
  function tileable(nf, x, y, S, scale, ox, oy) {
    const u = x / S, v = y / S;
    const a = nf((x + ox) / scale, (y + oy) / scale), b = nf((x - S + ox) / scale, (y + oy) / scale), c = nf((x + ox) / scale, (y - S + oy) / scale), d = nf((x - S + ox) / scale, (y - S + oy) / scale);
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  }
  function terrainTile(t, variant, S) {
    return sprite('t' + t + '_' + variant + '_' + S, S, S, (g) => {
      const T = D.TERRAIN[t];
      const ox = variant * 37, oy = variant * 53;
      // основен градиент от шум
      const img = g.createImageData(S, S); const d = img.data;
      const base = parse(T.col), base2 = parse(T.col2);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const n1 = tileable(noiseA, x, y, S, S / 4.5, ox, oy), n2 = tileable(noiseB, x, y, S, S / 14, ox, oy), n3 = tileable(noiseC, x, y, S, S / 36, ox, oy);
        let n = n1 * 0.7 + n2 * 0.25 + n3 * 0.05;
        let f = 0.88 + n * 0.24;
        let r = base[0] * (1 - n1) + base2[0] * n1, gg = base[1] * (1 - n1) + base2[1] * n1, b = base[2] * (1 - n1) + base2[2] * n1;
        if (t === 1) { if (n2 > 0.78) f *= 1.06; if (n2 < 0.25) f *= 0.94; } // трева: меки петна
        if (t === 3 || t === 4) { f = 0.9 + n * 0.2; if (t === 4 && n3 > 0.85) { r = 240; gg = 248; b = 255; f = 1.05; } }
        if (t === 5) { if (n1 > 0.62) { r = 60; gg = 95; b = 110; f = 0.9 + n3 * 0.2; } }
        if (t === 7) { if (n2 > 0.72) { r = 210; gg = 90 + n3 * 60; b = 30; f = 1; } else f *= 0.9; }
        if (t === 8) { if (n3 > 0.8) f *= 1.15; }
        if (t === 9) { if (n2 > 0.75) { r = 120; gg = 100; b = 120; } }
        const i = (y * S + x) * 4; d[i] = Math.min(255, r * f); d[i + 1] = Math.min(255, gg * f); d[i + 2] = Math.min(255, b * f); d[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      // детайли
      const n = Math.floor(S * S / 900);
      for (let i = 0; i < n; i++) {
        const r1 = hashN(i, variant, t), r2 = hashN(i, variant + 7, t), r3 = hashN(i, variant + 13, t);
        const x = r1 * S, y = r2 * S;
        if (t === 1 || t === 5) { g.strokeStyle = rgba(shade(T.col, 1.3 + r3 * 0.25), 0.55); g.lineWidth = Math.max(1, S * 0.014); g.lineCap = 'round'; for (let b = 0; b < 3; b++) { g.beginPath(); g.moveTo(x + b * S * 0.015, y); g.quadraticCurveTo(x + b * S * 0.015 + S * 0.005, y - S * 0.04, x + (b - 1) * S * 0.02 + S * 0.01 * (r3 - 0.5), y - S * 0.07); g.stroke(); } }
        else if (t === 2 || t === 6 || t === 8 || t === 9) { sphere(g, x, y, S * (0.012 + r3 * 0.02), shade(T.col, 0.9 + r3 * 0.4)); }
        else if (t === 3) { g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + S * 0.08, y - S * 0.02, x + S * 0.16, y); g.stroke(); }
        else if (t === 4) { circ(g, x, y, S * 0.008, 'rgba(255,255,255,0.7)'); }
        else if (t === 7 && r3 > 0.6) { g.strokeStyle = 'rgba(255,120,40,0.7)'; g.lineWidth = Math.max(1, S * 0.015); g.beginPath(); g.moveTo(x, y); g.lineTo(x + S * 0.08 * (r1 - 0.5), y + S * 0.08 * (r2 - 0.5)); g.stroke(); }
      }
      if (t === 5) for (let i = 0; i < 2; i++) { const r = hashN(i, variant, 99); ell(g, r * S, hashN(i, variant, 77) * S, S * 0.16, S * 0.09, 'rgba(50,80,110,0.45)'); ell(g, r * S - S * 0.04, hashN(i, variant, 77) * S - S * 0.02, S * 0.06, S * 0.025, 'rgba(200,230,255,0.25)'); }
    });
  }
  // Вода: кадри с движещи се отблясъци
  function waterTile(frame, variant, S) {
    return sprite('w' + frame + '_' + variant + '_' + S, S, S, (g) => {
      const img = g.createImageData(S, S); const d = img.data;
      const ox = variant * 41;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const n1 = tileable(noiseA, x, y, S, S / 3.5, frame * 1.7, frame * 0.9), n2 = tileable(noiseB, x, y, S, S / 8, -frame * 2.2, frame * 1.3);
        const depth = 0.8 + n1 * 0.35;
        let r = 28 * depth, gg = 96 * depth, b = 170 * depth + n2 * 24;
        const crest = n2 > 0.74 ? (n2 - 0.74) * 3 : 0;
        r += 70 * crest; gg += 60 * crest; b += 40 * crest;
        const i = (y * S + x) * 4; d[i] = Math.min(255, r); d[i + 1] = Math.min(255, gg); d[i + 2] = Math.min(255, b); d[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    });
  }

  // ---------------------------------------------------------------- декор (гори, планини, скали)
  function decor(kind, variant, S, terrain) {
    return sprite('d' + kind + '_' + variant + '_' + S + '_' + terrain, S, S * 1.25, (g) => {
      const r = (i) => hashN(i, variant, kind);
      const base = S * 0.25; // отстъп отгоре (спрайтът е по-висок от плочката)
      if (kind === 1 || kind === 4) {
        const dead = kind === 4;
        const pine = terrain === 4 || terrain === 6 || (terrain === 1 && r(30) > 0.55);
        const col = dead ? '#4a3a2a' : terrain === 4 ? '#2f6650' : terrain === 5 ? '#4f7a2a' : terrain === 8 ? '#5a4a7a' : terrain === 2 ? '#3d7a2f' : '#2e7a2c';
        const n = 2 + Math.floor(r(1) * 2);
        const trees = [];
        for (let i = 0; i < n; i++) trees.push({ x: S * (0.22 + r(i) * 0.56), y: base + S * (0.45 + r(i + 5) * 0.45), k: 0.6 + r(i + 9) * 0.5 });
        trees.sort((a, b) => a.y - b.y).forEach((t) => { if (dead) leafTree(g, t.x, t.y, S * 0.2 * t.k, col, true); else if (pine) pineTree(g, t.x, t.y, S * 0.7 * t.k, col, terrain === 4); else leafTree(g, t.x, t.y, S * 0.2 * t.k, shade(col, 0.85 + r(t.x) * 0.3)); });
      } else if (kind === 2) {
        const rock = terrain === 7 ? '#5a3a3a' : terrain === 4 ? '#7a8498' : terrain === 9 ? '#6a5a70' : '#6e6258';
        const peaks = [{ x: S * 0.32, h: S * 0.8, w: S * 0.42 }, { x: S * 0.68, h: S * 0.62 + r(3) * S * 0.2, w: S * 0.36 }];
        if (r(7) > 0.5) peaks.push({ x: S * 0.5, h: S * 0.5, w: S * 0.3 });
        peaks.sort((a, b) => a.h - b.h).forEach((p) => {
          const top = base + S * 0.98 - p.h, bot = base + S * 0.98;
          shadow(g, p.x + S * 0.05, bot, p.w * 1.1, S * 0.08, 0.3);
          poly(g, [[p.x, top], [p.x + p.w, bot], [p.x - p.w, bot]], lgrad(g, p.x - p.w, top, p.x + p.w, bot, [[0, shade(rock, 1.3)], [0.5, rock], [1, shade(rock, 0.5)]]));
          poly(g, [[p.x, top], [p.x + p.w * 0.15, bot], [p.x - p.w, bot]], 'rgba(0,0,0,0.12)');
          const snowCol = terrain === 7 ? 'rgba(255,110,40,0.9)' : 'rgba(245,248,255,0.95)';
          poly(g, [[p.x, top], [p.x + p.w * 0.32, top + p.h * 0.3], [p.x + p.w * 0.12, top + p.h * 0.26], [p.x - p.w * 0.05, top + p.h * 0.36], [p.x - p.w * 0.3, top + p.h * 0.3]], snowCol);
        });
      } else if (kind === 3) {
        for (let i = 0; i < 4; i++) {
          const x = S * (0.2 + r(i) * 0.6), y = base + S * (0.45 + r(i + 4) * 0.45), rad = S * (0.1 + r(i + 8) * 0.13);
          shadow(g, x + rad * 0.2, y + rad * 0.45, rad * 1.15, rad * 0.4, 0.25);
          const col = shade('#a08c74', 0.8 + r(i + 12) * 0.4);
          poly(g, [[x - rad, y + rad * 0.4], [x - rad * 0.5, y - rad], [x + rad * 0.6, y - rad * 0.8], [x + rad, y + rad * 0.4]], lgrad(g, x - rad, y - rad, x + rad, y + rad, [[0, shade(col, 1.3)], [1, shade(col, 0.55)]]));
        }
      } else if (kind === 5) {
        // стена на пещера
        g.fillStyle = '#231c20'; g.fillRect(0, base, S, S);
        for (let i = 0; i < 7; i++) { const x = r(i) * S, y = base + r(i + 6) * S, rad = S * (0.1 + r(i + 12) * 0.18); const col = shade('#3a3038', 0.8 + r(i + 3) * 0.5); poly(g, [[x - rad, y + rad * 0.6], [x - rad * 0.4, y - rad], [x + rad * 0.7, y - rad * 0.7], [x + rad, y + rad * 0.5]], lgrad(g, x - rad, y - rad, x + rad, y + rad, [[0, shade(col, 1.4)], [1, shade(col, 0.5)]])); }
        if (r(20) > 0.65) { const x = S * 0.5, y = base + S * 0.55; g.fillStyle = rgrad(g, x, y, S * 0.25, 'rgba(170,120,255,0.45)', 'rgba(170,120,255,0)'); g.fillRect(x - S * 0.25, y - S * 0.25, S * 0.5, S * 0.5); poly(g, [[x, y - S * 0.22], [x + S * 0.07, y], [x, y + S * 0.08], [x - S * 0.07, y]], lgrad(g, x - S * 0.07, y - S * 0.2, x + S * 0.07, y, [[0, '#e0c8ff'], [1, '#8050d0']])); }
      }
    });
  }

  // ---------------------------------------------------------------- обекти
  const RES_ICON = { gold: '●', wood: '≡', ore: '▲', mercury: '◉', sulfur: '✶', crystal: '◆', gems: '❖' };
  function house(g, x, y, w, h, wall, roof, roofK, windows) {
    // тяло
    g.fillStyle = lgrad(g, x - w / 2, y, x + w / 2, y, [[0, shade(wall, 1.15)], [1, shade(wall, 0.7)]]); g.fillRect(x - w / 2, y - h, w, h);
    // покрив
    poly(g, [[x - w * 0.6, y - h], [x, y - h - w * (roofK || 0.55)], [x + w * 0.6, y - h]], lgrad(g, x - w * 0.6, y - h - w * 0.5, x + w * 0.6, y - h, [[0, shade(roof, 1.3)], [1, shade(roof, 0.6)]]), 'rgba(0,0,0,0.35)', 1);
    // прозорци
    for (let i = 0; i < (windows || 0); i++) { const wx = x - w * 0.3 + (w * 0.6 / Math.max(1, windows - 1)) * i; g.fillStyle = 'rgba(255,220,120,0.95)'; g.fillRect(wx - w * 0.06, y - h * 0.65, w * 0.12, h * 0.22); g.fillStyle = 'rgba(255,240,180,0.35)'; g.fillRect(wx - w * 0.12, y - h * 0.72, w * 0.24, h * 0.34); }
    // врата
    g.fillStyle = '#2a1a10'; g.beginPath(); g.roundRect(x - w * 0.09, y - h * 0.32, w * 0.18, h * 0.32, [w * 0.09, w * 0.09, 0, 0]); g.fill();
  }
  function tower(g, x, y, w, h, wall, roof, spireK) {
    g.fillStyle = lgrad(g, x - w / 2, y, x + w / 2, y, [[0, shade(wall, 1.2)], [0.6, wall], [1, shade(wall, 0.6)]]); g.fillRect(x - w / 2, y - h, w, h);
    // зъбци или конус
    if (spireK) poly(g, [[x - w * 0.7, y - h], [x, y - h - w * spireK], [x + w * 0.7, y - h]], lgrad(g, x - w * 0.7, y - h - w, x + w * 0.7, y - h, [[0, shade(roof, 1.3)], [1, shade(roof, 0.55)]]), 'rgba(0,0,0,0.35)', 1);
    else { g.fillStyle = shade(wall, 1.1); for (let i = -1; i <= 1; i++) g.fillRect(x + i * w * 0.36 - w * 0.14, y - h - w * 0.2, w * 0.28, w * 0.22); }
    g.fillStyle = '#1a1410'; g.fillRect(x - w * 0.12, y - h * 0.62, w * 0.24, w * 0.3);
    g.fillStyle = 'rgba(255,220,120,0.9)'; g.fillRect(x - w * 0.08, y - h * 0.6, w * 0.16, w * 0.2);
  }
  const TOWN_STYLE = {
    kingdom: { wall: '#c8c0b0', roof: '#3f6fd0', ground: '#7a9a5a' }, grove: { wall: '#8a6a44', roof: '#4a9a44', ground: '#4e8a3a' }, necropolis: { wall: '#4a4056', roof: '#6a3f9a', ground: '#5a5058' },
    academy: { wall: '#e8eef8', roof: '#4a8ad0', ground: '#c8d8e8' }, inferno: { wall: '#3a2626', roof: '#e0602a', ground: '#4a3030' }, dungeon: { wall: '#3a3050', roof: '#8a5ab0', ground: '#3a3040' },
    horde: { wall: '#7a5a3a', roof: '#c08a3a', ground: '#8a7a5a' }, marsh: { wall: '#6a6a4a', roof: '#3a7a5a', ground: '#4a6a3a' }, elements: { wall: '#d8d0f0', roof: '#a080ff', ground: '#9ab070' },
    harbor: { wall: '#d8cfb8', roof: '#2a8aa0', ground: '#c0b088' }, workshop: { wall: '#8a7a68', roof: '#a06040', ground: '#8a7a80' }
  };
  function flagShape(g, x, y, S, color, wave) {
    g.fillStyle = '#3a2a1a'; g.fillRect(x - S * 0.012, y - S * 0.3, S * 0.024, S * 0.3);
    const w = wave || 0;
    g.fillStyle = lgrad(g, x, y, x + S * 0.2, y, [[0, shade(color, 1.2)], [1, shade(color, 0.8)]]);
    g.beginPath(); g.moveTo(x, y - S * 0.3); g.quadraticCurveTo(x + S * 0.1, y - S * 0.31 + w, x + S * 0.2, y - S * 0.27 + w * 1.5); g.quadraticCurveTo(x + S * 0.1, y - S * 0.2 + w * 0.5, x, y - S * 0.17); g.fill();
  }
  function objectSprite(o, S, world) {
    const owner = o.owner !== undefined ? o.owner : -2;
    const ownerCol = owner >= 0 && world && world.players[owner] ? world.players[owner].color : null;
    const key = 'o' + o.type + '_' + (o.res || '') + '_' + (o.faction || '') + '_' + (o.creature || '') + '_' + owner + '_' + S + '_' + (o.empty ? 'e' : '') + '_' + (o.art ? D.artById[o.art].cls : '');
    return sprite(key, S, S * 1.4, (g) => {
      const cx = S / 2, gy = S * 1.4 - S * 0.12; // линия на земята
      const top = S * 0.4;
      switch (o.type) {
        case 'town': {
          const st = TOWN_STYLE[o.faction] || TOWN_STYLE.kingdom;
          shadow(g, cx, gy, S * 0.5, S * 0.14, 0.35);
          ell(g, cx, gy - S * 0.02, S * 0.5, S * 0.16, st.ground);
          // стена с зъбци
          g.fillStyle = lgrad(g, 0, gy - S * 0.42, 0, gy, [[0, shade(st.wall, 1.05)], [1, shade(st.wall, 0.6)]]); g.fillRect(S * 0.1, gy - S * 0.4, S * 0.8, S * 0.38);
          g.fillStyle = shade(st.wall, 1.15); for (let i = 0; i < 7; i++) g.fillRect(S * 0.11 + i * S * 0.115, gy - S * 0.46, S * 0.07, S * 0.08);
          // сгради зад стената
          if (o.faction === 'necropolis' || o.faction === 'dungeon') { tower(g, cx - S * 0.26, gy - S * 0.3, S * 0.16, S * 0.6, st.wall, st.roof, 2.2); tower(g, cx + S * 0.26, gy - S * 0.3, S * 0.16, S * 0.5, st.wall, st.roof, 2.4); tower(g, cx, gy - S * 0.3, S * 0.2, S * 0.75, st.wall, st.roof, 2.6); }
          else if (o.faction === 'academy' || o.faction === 'elements') { tower(g, cx - S * 0.26, gy - S * 0.3, S * 0.16, S * 0.55, st.wall, st.roof, 0); sphere(g, cx - S * 0.26, gy - S * 0.9, S * 0.11, st.roof); tower(g, cx + S * 0.26, gy - S * 0.3, S * 0.16, S * 0.48, st.wall, st.roof, 0); sphere(g, cx + S * 0.26, gy - S * 0.82, S * 0.11, st.roof); tower(g, cx, gy - S * 0.3, S * 0.2, S * 0.7, st.wall, st.roof, 1.8); }
          else if (o.faction === 'horde' || o.faction === 'marsh') { house(g, cx - S * 0.25, gy - S * 0.3, S * 0.26, S * 0.3, st.wall, st.roof, 0.7, 1); house(g, cx + S * 0.25, gy - S * 0.3, S * 0.24, S * 0.28, st.wall, st.roof, 0.7, 1); tower(g, cx, gy - S * 0.3, S * 0.22, S * 0.6, st.wall, st.roof, 0); }
          else if (o.faction === 'workshop') { house(g, cx - S * 0.24, gy - S * 0.3, S * 0.28, S * 0.34, st.wall, st.roof, 0.3, 2); g.fillStyle = '#4a4040'; g.fillRect(cx + S * 0.18, gy - S * 0.95, S * 0.08, S * 0.65); g.fillRect(cx + S * 0.3, gy - S * 0.85, S * 0.06, S * 0.55); tower(g, cx, gy - S * 0.3, S * 0.2, S * 0.5, st.wall, st.roof, 0); }
          else if (o.faction === 'inferno') { tower(g, cx - S * 0.26, gy - S * 0.3, S * 0.16, S * 0.5, st.wall, st.roof, 3); tower(g, cx + S * 0.26, gy - S * 0.3, S * 0.16, S * 0.55, st.wall, st.roof, 2.6); tower(g, cx, gy - S * 0.3, S * 0.22, S * 0.6, st.wall, st.roof, 3.2); g.fillStyle = rgrad(g, cx, gy - S * 0.5, S * 0.45, 'rgba(255,90,20,0.35)', 'rgba(255,90,20,0)'); g.fillRect(0, gy - S * 1.0, S, S * 0.7); }
          else if (o.faction === 'harbor') { house(g, cx - S * 0.26, gy - S * 0.3, S * 0.24, S * 0.28, st.wall, st.roof, 0.5, 2); tower(g, cx + S * 0.28, gy - S * 0.3, S * 0.13, S * 0.75, '#e8e0d0', '#d23c3c', 0.6); g.fillStyle = '#d23c3c'; g.fillRect(cx + S * 0.215, gy - S * 0.75, S * 0.13, S * 0.08); tower(g, cx, gy - S * 0.3, S * 0.2, S * 0.55, st.wall, st.roof, 1.2); }
          else { tower(g, cx - S * 0.27, gy - S * 0.3, S * 0.16, S * 0.5, st.wall, st.roof, 1.4); tower(g, cx + S * 0.27, gy - S * 0.3, S * 0.16, S * 0.56, st.wall, st.roof, 1.4); house(g, cx, gy - S * 0.36, S * 0.3, S * 0.3, st.wall, st.roof, 0.5, 2); tower(g, cx, gy - S * 0.3, S * 0.18, S * 0.78, st.wall, st.roof, 1.6); }
          // порта
          g.fillStyle = '#2a1a10'; g.beginPath(); g.roundRect(cx - S * 0.09, gy - S * 0.24, S * 0.18, S * 0.22, [S * 0.09, S * 0.09, 0, 0]); g.fill();
          g.strokeStyle = '#8a6a3a'; g.lineWidth = Math.max(1, S * 0.01); g.beginPath(); g.moveTo(cx, gy - S * 0.24); g.lineTo(cx, gy - S * 0.02); g.stroke();
          if (ownerCol) flagShape(g, cx, gy - S * 1.05, S, ownerCol, 0);
          break;
        }
        case 'mine': {
          const m = D.MINES.find((m) => m.res === o.res);
          shadow(g, cx, gy, S * 0.46, S * 0.13, 0.35);
          // хълм
          g.fillStyle = lgrad(g, 0, gy - S * 0.6, 0, gy, [[0, '#8a7a6a'], [1, '#4a3e34']]); g.beginPath(); g.moveTo(S * 0.06, gy); g.quadraticCurveTo(S * 0.3, gy - S * 0.75, cx, gy - S * 0.62); g.quadraticCurveTo(S * 0.72, gy - S * 0.72, S * 0.94, gy); g.fill();
          // дървена рамка на входа
          g.fillStyle = '#5a3e1e'; g.fillRect(cx - S * 0.2, gy - S * 0.36, S * 0.06, S * 0.36); g.fillRect(cx + S * 0.14, gy - S * 0.36, S * 0.06, S * 0.36); g.fillRect(cx - S * 0.22, gy - S * 0.38, S * 0.44, S * 0.06);
          g.fillStyle = lgrad(g, 0, gy - S * 0.32, 0, gy, [[0, '#0a0806'], [1, '#2a2018']]); g.fillRect(cx - S * 0.14, gy - S * 0.32, S * 0.28, S * 0.32);
          // релси и вагонетка
          g.strokeStyle = '#3a3030'; g.lineWidth = Math.max(1, S * 0.012); g.beginPath(); g.moveTo(cx - S * 0.06, gy); g.lineTo(cx - S * 0.02, gy + S * 0.08); g.moveTo(cx + S * 0.06, gy); g.lineTo(cx + S * 0.02, gy + S * 0.08); g.stroke();
          rrect(g, cx + S * 0.22, gy - S * 0.14, S * 0.2, S * 0.12, S * 0.02, '#4a3a2a'); circ(g, cx + S * 0.27, gy - S * 0.01, S * 0.03, '#222'); circ(g, cx + S * 0.37, gy - S * 0.01, S * 0.03, '#222');
          for (let i = 0; i < 4; i++) sphere(g, cx + S * 0.25 + hashN(i, 1, 2) * S * 0.14, gy - S * 0.16 - hashN(i, 3, 4) * S * 0.04, S * 0.03, D.RES_COLOR[o.res]);
          // табела
          rrect(g, cx - S * 0.12, gy - S * 0.62, S * 0.24, S * 0.18, S * 0.03, '#e8dcc0'); g.strokeStyle = '#5a3e1e'; g.lineWidth = 1; g.strokeRect(cx - S * 0.12, gy - S * 0.62, S * 0.24, S * 0.18);
          circ(g, cx, gy - S * 0.53, S * 0.06, D.RES_COLOR[o.res]);
          g.fillStyle = '#222'; g.font = 'bold ' + S * 0.09 + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(RES_ICON[o.res], cx, gy - S * 0.525);
          if (ownerCol) flagShape(g, cx + S * 0.34, gy - S * 0.42, S, ownerCol, 0);
          break;
        }
        case 'resource': {
          shadow(g, cx, gy, S * 0.3, S * 0.09, 0.3);
          const col = D.RES_COLOR[o.res];
          if (o.res === 'wood') { for (let i = 0; i < 3; i++) { const y = gy - S * 0.07 - i * S * 0.1, x = cx + (i === 2 ? 0 : (i ? 1 : -1)) * S * 0.0; g.fillStyle = lgrad(g, 0, y - S * 0.06, 0, y + S * 0.06, [[0, '#a8743e'], [1, '#5a3a1e']]); g.beginPath(); g.roundRect(cx - S * 0.28 + i * S * 0.02, y - S * 0.055, S * 0.5, S * 0.11, S * 0.05); g.fill(); circ(g, cx + S * 0.22 + i * S * 0.02, y, S * 0.05, '#d8b078'); } }
          else if (o.res === 'gold') { for (let i = 0; i < 7; i++) { const x = cx + (hashN(i, 3, 4) - 0.5) * S * 0.44, y = gy - S * 0.05 - hashN(i, 5, 6) * S * 0.16; ell(g, x, y, S * 0.085, S * 0.05, shade('#c8a030', 0.9 + hashN(i, 1, 2) * 0.3)); ell(g, x, y - S * 0.02, S * 0.07, S * 0.035, '#f0d060'); } }
          else if (o.res === 'ore') { for (let i = 0; i < 5; i++) { const x = cx + (hashN(i, 3, 4) - 0.5) * S * 0.4, y = gy - S * 0.05 - hashN(i, 5, 6) * S * 0.12, r = S * 0.08; poly(g, [[x - r, y + r * 0.5], [x - r * 0.5, y - r], [x + r * 0.5, y - r * 0.9], [x + r, y + r * 0.5]], lgrad(g, x - r, y - r, x + r, y + r, [[0, '#b0b0b8'], [1, '#505058']])); } }
          else { for (let i = 0; i < 4; i++) { const x = cx + (hashN(i, 2, 3) - 0.5) * S * 0.36, y = gy - S * 0.08 - hashN(i, 4, 5) * S * 0.1, h = S * (0.14 + hashN(i, 7, 8) * 0.1); poly(g, [[x, y - h], [x + S * 0.08, y - h * 0.3], [x + S * 0.05, y + S * 0.06], [x - S * 0.05, y + S * 0.06], [x - S * 0.08, y - h * 0.3]], lgrad(g, x - S * 0.08, y - h, x + S * 0.08, y, [[0, shade(col, 1.5)], [0.5, col], [1, shade(col, 0.5)]]), 'rgba(255,255,255,0.35)', 1); } g.fillStyle = rgrad(g, cx, gy - S * 0.15, S * 0.3, rgba(col, 0.35), rgba(col, 0)); g.fillRect(cx - S * 0.3, gy - S * 0.45, S * 0.6, S * 0.6); }
          break;
        }
        case 'chest': case 'sea_chest': {
          shadow(g, cx, gy, S * 0.3, S * 0.08, 0.35);
          g.fillStyle = lgrad(g, cx - S * 0.25, 0, cx + S * 0.25, 0, [[0, '#8a5a2a'], [1, '#4a2e12']]); g.fillRect(cx - S * 0.25, gy - S * 0.26, S * 0.5, S * 0.26);
          g.fillStyle = lgrad(g, 0, gy - S * 0.46, 0, gy - S * 0.26, [[0, '#b07a3a'], [1, '#6a4a22']]); g.beginPath(); g.moveTo(cx - S * 0.25, gy - S * 0.26); g.quadraticCurveTo(cx, gy - S * 0.5, cx + S * 0.25, gy - S * 0.26); g.fill();
          g.fillStyle = '#e8c040'; g.fillRect(cx - S * 0.25, gy - S * 0.27, S * 0.5, S * 0.03); g.fillRect(cx - S * 0.05, gy - S * 0.3, S * 0.1, S * 0.12); g.fillRect(cx - S * 0.25, gy - S * 0.05, S * 0.5, S * 0.03);
          g.fillStyle = rgrad(g, cx, gy - S * 0.3, S * 0.3, 'rgba(255,220,120,0.4)', 'rgba(255,220,120,0)'); g.fillRect(cx - S * 0.3, gy - S * 0.6, S * 0.6, S * 0.6);
          break;
        }
        case 'artifact': {
          const a = D.artById[o.art]; const col = ['', '#c8d8e8', '#f0c840', '#e070f0'][a ? a.cls : 1];
          shadow(g, cx, gy, S * 0.22, S * 0.07, 0.3);
          // пиедестал
          g.fillStyle = lgrad(g, 0, gy - S * 0.16, 0, gy, [[0, '#a0a0a8'], [1, '#505058']]); g.beginPath(); g.roundRect(cx - S * 0.16, gy - S * 0.14, S * 0.32, S * 0.14, S * 0.03); g.fill();
          g.fillStyle = rgrad(g, cx, gy - S * 0.42, S * 0.36, rgba(col, 0.5), rgba(col, 0)); g.fillRect(cx - S * 0.36, gy - S * 0.8, S * 0.72, S * 0.72);
          poly(g, [[cx, gy - S * 0.7], [cx + S * 0.16, gy - S * 0.42], [cx, gy - S * 0.16], [cx - S * 0.16, gy - S * 0.42]], lgrad(g, cx - S * 0.16, gy - S * 0.7, cx + S * 0.16, gy - S * 0.16, [[0, shade(col, 1.4)], [0.5, col], [1, shade(col, 0.55)]]), 'rgba(255,255,255,0.5)', 1);
          poly(g, [[cx, gy - S * 0.66], [cx + S * 0.06, gy - S * 0.5], [cx - S * 0.06, gy - S * 0.5]], 'rgba(255,255,255,0.7)');
          break;
        }
        case 'dwelling': {
          const c = D.creatureOf(o.creature); const f = D.factionById(c.faction); const st = TOWN_STYLE[c.faction] || TOWN_STYLE.kingdom;
          shadow(g, cx, gy, S * 0.4, S * 0.11, 0.35);
          house(g, cx, gy, S * 0.5, S * 0.34, st.wall, f ? f.color : '#888', 0.6, 2);
          g.strokeStyle = '#5a3e1e'; g.lineWidth = Math.max(1, S * 0.015); g.beginPath(); g.moveTo(cx - S * 0.36, gy); g.lineTo(cx - S * 0.36, gy - S * 0.16); g.moveTo(cx + S * 0.36, gy); g.lineTo(cx + S * 0.36, gy - S * 0.16); g.moveTo(cx - S * 0.4, gy - S * 0.1); g.lineTo(cx + S * 0.4, gy - S * 0.1); g.stroke();
          if (ownerCol) flagShape(g, cx + S * 0.3, gy - S * 0.36, S, ownerCol, 0);
          break;
        }
        case 'boat': {
          ell(g, cx, gy - S * 0.02, S * 0.46, S * 0.08, 'rgba(255,255,255,0.35)');
          g.fillStyle = lgrad(g, 0, gy - S * 0.26, 0, gy, [[0, '#8a5a2a'], [1, '#3a2210']]); g.beginPath(); g.moveTo(S * 0.06, gy - S * 0.24); g.quadraticCurveTo(cx, gy - S * 0.18, S * 0.94, gy - S * 0.26); g.lineTo(S * 0.8, gy); g.lineTo(S * 0.2, gy); g.closePath(); g.fill();
          g.fillStyle = '#c09050'; g.fillRect(S * 0.08, gy - S * 0.26, S * 0.84, S * 0.04);
          g.fillStyle = '#3a2a1a'; g.fillRect(cx - S * 0.02, gy - S * 0.85, S * 0.04, S * 0.62);
          g.fillStyle = lgrad(g, cx, 0, cx + S * 0.34, 0, [[0, '#f8f4ec'], [1, '#c8c0b0']]); g.beginPath(); g.moveTo(cx + S * 0.02, gy - S * 0.82); g.quadraticCurveTo(cx + S * 0.4, gy - S * 0.6, cx + S * 0.32, gy - S * 0.32); g.lineTo(cx + S * 0.02, gy - S * 0.32); g.fill();
          g.fillStyle = ownerCol ? lgrad(g, cx - S * 0.3, 0, cx, 0, [[0, shade(ownerCol, 0.8)], [1, shade(ownerCol, 1.2)]]) : '#e8e0d0'; g.beginPath(); g.moveTo(cx - S * 0.02, gy - S * 0.78); g.quadraticCurveTo(cx - S * 0.36, gy - S * 0.6, cx - S * 0.28, gy - S * 0.32); g.lineTo(cx - S * 0.02, gy - S * 0.32); g.fill();
          break;
        }
        case 'gate': {
          shadow(g, cx, gy, S * 0.42, S * 0.1, 0.35);
          g.fillStyle = lgrad(g, 0, gy - S * 0.7, 0, gy, [[0, '#6a6070'], [1, '#2a2430']]); g.beginPath(); g.moveTo(S * 0.12, gy); g.lineTo(S * 0.16, gy - S * 0.45); g.quadraticCurveTo(cx, gy - S * 0.95, S * 0.84, gy - S * 0.45); g.lineTo(S * 0.88, gy); g.fill();
          g.fillStyle = rgrad(g, cx, gy - S * 0.2, S * 0.3, '#3a1a70', '#08040f'); g.beginPath(); g.moveTo(S * 0.28, gy); g.lineTo(S * 0.3, gy - S * 0.4); g.quadraticCurveTo(cx, gy - S * 0.7, S * 0.7, gy - S * 0.4); g.lineTo(S * 0.72, gy); g.fill();
          g.fillStyle = rgrad(g, cx, gy - S * 0.15, S * 0.22, 'rgba(180,130,255,0.75)', 'rgba(180,130,255,0)'); g.fillRect(cx - S * 0.25, gy - S * 0.45, S * 0.5, S * 0.5);
          break;
        }
        case 'whirlpool': { for (let k = 0; k < 4; k++) { g.strokeStyle = 'rgba(255,255,255,' + (0.85 - k * 0.15) + ')'; g.lineWidth = S * 0.035; g.beginPath(); g.arc(cx, gy - S * 0.3, S * (0.08 + k * 0.1), k * 1.1, k * 1.1 + 4.4); g.stroke(); } break; }
        case 'lighthouse': {
          shadow(g, cx, gy, S * 0.25, S * 0.08, 0.35);
          g.fillStyle = lgrad(g, cx - S * 0.12, 0, cx + S * 0.12, 0, [[0, '#f4f0e8'], [1, '#a8a098']]); poly(g, [[cx - S * 0.13, gy], [cx - S * 0.09, gy - S * 0.72], [cx + S * 0.09, gy - S * 0.72], [cx + S * 0.13, gy]], g.fillStyle);
          g.fillStyle = '#d23c3c'; g.fillRect(cx - S * 0.11, gy - S * 0.45, S * 0.22, S * 0.1); g.fillRect(cx - S * 0.125, gy - S * 0.2, S * 0.25, S * 0.1);
          g.fillStyle = '#2a2a30'; g.fillRect(cx - S * 0.11, gy - S * 0.86, S * 0.22, S * 0.14); g.fillStyle = '#ffe070'; g.fillRect(cx - S * 0.08, gy - S * 0.84, S * 0.16, S * 0.1);
          g.fillStyle = rgrad(g, cx, gy - S * 0.8, S * 0.5, 'rgba(255,230,120,0.35)', 'rgba(255,230,120,0)'); g.fillRect(0, gy - S * 1.3, S, S);
          if (ownerCol) flagShape(g, cx + S * 0.2, gy - S * 0.5, S, ownerCol, 0);
          break;
        }
        case 'shipwreck': {
          if (o.empty) g.globalAlpha = 0.6;
          g.fillStyle = '#3a2a1a'; g.beginPath(); g.moveTo(S * 0.12, gy - S * 0.1); g.lineTo(S * 0.9, gy - S * 0.22); g.lineTo(S * 0.78, gy + S * 0.05); g.lineTo(S * 0.28, gy + S * 0.05); g.fill();
          g.save(); g.translate(cx, gy - S * 0.15); g.rotate(-0.5); g.fillStyle = '#2a1a10'; g.fillRect(-S * 0.02, -S * 0.5, S * 0.04, S * 0.5); g.fillStyle = 'rgba(200,190,170,0.6)'; g.beginPath(); g.moveTo(S * 0.02, -S * 0.48); g.lineTo(S * 0.22, -S * 0.2); g.lineTo(S * 0.02, -S * 0.15); g.fill(); g.restore();
          ell(g, cx, gy, S * 0.4, S * 0.07, 'rgba(255,255,255,0.3)');
          break;
        }
        default: {
          const glyph = { windmill: '🌬', watermill: '⚙', learning: '📜', rally: '🚩', mercenary: '⚔', tower_def: '🛡', star_axis: '✨', garden: '🌸', campfire: '🔥', shrine1: '⛩', shrine2: '⛩', shrine3: '⛩', tree_knowledge: '🌳', magic_well: '💧', wagon: '🛒', fountain: '⛲', idol: '🗿', obelisk: '🗼', stables: '🐎', sanctuary: '🏛', school_war: '🏫', school_magic: '🔮', library: '📚', monolith: '🌀' }[o.type] || '?';
          shadow(g, cx, gy, S * 0.3, S * 0.09, 0.3);
          // каменна плоча-основа
          ell(g, cx, gy - S * 0.03, S * 0.3, S * 0.1, '#7a7068'); ell(g, cx, gy - S * 0.06, S * 0.26, S * 0.08, '#a8a098');
          g.font = S * 0.62 + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
          if (o.empty) g.globalAlpha = 0.5;
          g.fillText(glyph, cx, gy - S * 0.42);
        }
      }
    });
  }

  // ---------------------------------------------------------------- герои
  function heroSprite(h, S, color) {
    if (h.boat) return sprite('hb' + color + '_' + S, S, S * 1.4, (g) => {
      const cx = S / 2, gy = S * 1.28;
      ell(g, cx, gy - S * 0.02, S * 0.48, S * 0.08, 'rgba(255,255,255,0.35)');
      g.fillStyle = lgrad(g, 0, gy - S * 0.28, 0, gy, [[0, '#8a5a2a'], [1, '#3a2210']]); g.beginPath(); g.moveTo(S * 0.04, gy - S * 0.26); g.quadraticCurveTo(cx, gy - S * 0.2, S * 0.96, gy - S * 0.28); g.lineTo(S * 0.82, gy); g.lineTo(S * 0.18, gy); g.closePath(); g.fill();
      g.fillStyle = '#c09050'; g.fillRect(S * 0.06, gy - S * 0.28, S * 0.88, S * 0.04);
      g.fillStyle = '#3a2a1a'; g.fillRect(cx - S * 0.02, gy - S * 0.92, S * 0.04, S * 0.66);
      g.fillStyle = lgrad(g, cx, 0, cx + S * 0.36, 0, [[0, '#f8f4ec'], [1, '#c0b8a8']]); g.beginPath(); g.moveTo(cx + S * 0.02, gy - S * 0.88); g.quadraticCurveTo(cx + S * 0.42, gy - S * 0.62, cx + S * 0.34, gy - S * 0.34); g.lineTo(cx + S * 0.02, gy - S * 0.34); g.fill();
      g.fillStyle = lgrad(g, cx - S * 0.32, 0, cx, 0, [[0, shade(color, 0.8)], [1, shade(color, 1.25)]]); g.beginPath(); g.moveTo(cx - S * 0.02, gy - S * 0.84); g.quadraticCurveTo(cx - S * 0.38, gy - S * 0.62, cx - S * 0.3, gy - S * 0.34); g.lineTo(cx - S * 0.02, gy - S * 0.34); g.fill();
      sphere(g, cx - S * 0.22, gy - S * 0.44, S * 0.06, '#e8c8a0'); g.fillStyle = color; g.fillRect(cx - S * 0.28, gy - S * 0.38, S * 0.12, S * 0.1);
    });
    return sprite('h' + h.faction + '_' + color + '_' + S + '_' + (h.portrait || 0), S, S * 1.4, (g) => {
      const cx = S / 2, gy = S * 1.28;
      shadow(g, cx, gy, S * 0.36, S * 0.1, 0.35);
      const horse = h.faction === 'necropolis' || h.faction === 'dungeon' ? '#2a2230' : h.faction === 'academy' ? '#e8e8f0' : h.faction === 'inferno' ? '#5a2020' : '#6a4a2a';
      // крака
      g.fillStyle = shade(horse, 0.8);
      [[-0.28, 0], [-0.18, 0.02], [0.14, 0.01], [0.26, 0]].forEach(([dx, dy]) => { g.beginPath(); g.roundRect(cx + dx * S - S * 0.035, gy - S * 0.3 + dy * S, S * 0.07, S * 0.3, S * 0.02); g.fill(); });
      // тяло
      g.fillStyle = rgrad(g, cx, gy - S * 0.42, S * 0.36, shade(horse, 1.3), shade(horse, 0.7), -S * 0.1, -S * 0.1); g.beginPath(); g.ellipse(cx, gy - S * 0.4, S * 0.32, S * 0.17, 0, 0, TAU); g.fill();
      // шия и глава
      g.beginPath(); g.moveTo(cx + S * 0.18, gy - S * 0.5); g.quadraticCurveTo(cx + S * 0.36, gy - S * 0.78, cx + S * 0.42, gy - S * 0.66); g.lineTo(cx + S * 0.3, gy - S * 0.44); g.fill();
      ell(g, cx + S * 0.4, gy - S * 0.66, S * 0.11, S * 0.075, shade(horse, 1.05));
      circ(g, cx + S * 0.45, gy - S * 0.68, S * 0.014, '#000');
      // грива и опашка
      g.strokeStyle = shade(horse, 0.5); g.lineWidth = S * 0.04; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx + S * 0.22, gy - S * 0.55); g.quadraticCurveTo(cx + S * 0.3, gy - S * 0.75, cx + S * 0.38, gy - S * 0.74); g.stroke();
      g.beginPath(); g.moveTo(cx - S * 0.3, gy - S * 0.44); g.quadraticCurveTo(cx - S * 0.44, gy - S * 0.3, cx - S * 0.4, gy - S * 0.12); g.stroke();
      // наметка
      g.fillStyle = lgrad(g, cx - S * 0.2, gy - S * 0.9, cx, gy - S * 0.4, [[0, shade(color, 1.2)], [1, shade(color, 0.6)]]); g.beginPath(); g.moveTo(cx - S * 0.02, gy - S * 0.86); g.quadraticCurveTo(cx - S * 0.3, gy - S * 0.75, cx - S * 0.24, gy - S * 0.4); g.lineTo(cx - S * 0.02, gy - S * 0.5); g.fill();
      // ездач
      g.fillStyle = lgrad(g, cx - S * 0.1, 0, cx + S * 0.1, 0, [[0, '#d0d8e0'], [1, '#7a8290']]); g.beginPath(); g.roundRect(cx - S * 0.1, gy - S * 0.86, S * 0.2, S * 0.34, S * 0.05); g.fill();
      g.fillStyle = color; g.fillRect(cx - S * 0.1, gy - S * 0.7, S * 0.2, S * 0.06);
      sphere(g, cx, gy - S * 0.93, S * 0.085, '#e8c8a0');
      g.fillStyle = lgrad(g, cx - S * 0.1, gy - S * 1.02, cx + S * 0.1, gy - S * 0.9, [[0, '#e8ecf0'], [1, '#8a9098']]); g.beginPath(); g.arc(cx, gy - S * 0.94, S * 0.095, Math.PI, 0); g.fill();
      g.fillStyle = color; g.beginPath(); g.moveTo(cx - S * 0.02, gy - S * 1.03); g.quadraticCurveTo(cx + S * 0.02, gy - S * 1.14, cx + S * 0.12, gy - S * 1.08); g.lineTo(cx + S * 0.03, gy - S * 1.02); g.fill();
      // копие
      g.strokeStyle = '#5a3e1e'; g.lineWidth = S * 0.02; g.beginPath(); g.moveTo(cx + S * 0.16, gy - S * 0.45); g.lineTo(cx + S * 0.2, gy - S * 1.25); g.stroke();
      poly(g, [[cx + S * 0.2, gy - S * 1.32], [cx + S * 0.24, gy - S * 1.22], [cx + S * 0.16, gy - S * 1.22]], '#d0d8e0');
    });
  }

  // ---------------------------------------------------------------- същества
  const FAM_COLOR = { kingdom: '#6f9fe8', grove: '#6fc070', necropolis: '#a07fd0', neutral: '#c0a070', academy: '#a8d0f0', inferno: '#e07050', dungeon: '#9070b0', horde: '#c89050', marsh: '#70a070', elements: '#d0b8f8', harbor: '#50b0c8', workshop: '#c0a878' };
  const SKIN = { kingdom: '#e8c8a0', grove: '#e8d0b0', necropolis: '#d8d8c8', academy: '#e8d8c8', inferno: '#c05040', dungeon: '#8a70a0', horde: '#8aa060', marsh: '#7a9a50', elements: '#e8e0ff', harbor: '#e0c0a0', workshop: '#e8c8a0', neutral: '#d0b090' };
  function humanoid(g, cx, gy, S, opt) {
    // opt: skin, cloth, armor(0..3), weapon: 'sword'|'spear'|'bow'|'staff'|'axe'|'gun'|'club', shield, cape, hood, helmet, robe, big
    const k = opt.big ? 1.35 : 1;
    const skin = opt.skin, cloth = opt.cloth;
    shadow(g, cx, gy, S * 0.22 * k, S * 0.07 * k, 0.35);
    // крака
    g.fillStyle = shade(cloth, 0.55); [[-0.07, 0], [0.07, 0]].forEach(([dx]) => { g.beginPath(); g.roundRect(cx + dx * S * k - S * 0.05 * k, gy - S * 0.28 * k, S * 0.1 * k, S * 0.28 * k, S * 0.03); g.fill(); });
    g.fillStyle = '#2a2018'; [[-0.08, 0], [0.06, 0]].forEach(([dx]) => { g.beginPath(); g.roundRect(cx + dx * S * k - S * 0.055 * k, gy - S * 0.07 * k, S * 0.12 * k, S * 0.07 * k, S * 0.02); g.fill(); });
    // наметка
    if (opt.cape) { g.fillStyle = lgrad(g, cx - S * 0.2, gy - S * 0.6, cx, gy, [[0, shade(opt.cape, 1.15)], [1, shade(opt.cape, 0.5)]]); g.beginPath(); g.moveTo(cx - S * 0.1 * k, gy - S * 0.62 * k); g.quadraticCurveTo(cx - S * 0.34 * k, gy - S * 0.4 * k, cx - S * 0.26 * k, gy - S * 0.08 * k); g.lineTo(cx + S * 0.02 * k, gy - S * 0.3 * k); g.fill(); }
    // тяло / роба
    if (opt.robe) { g.fillStyle = lgrad(g, cx - S * 0.2, 0, cx + S * 0.2, 0, [[0, shade(cloth, 1.2)], [1, shade(cloth, 0.6)]]); g.beginPath(); g.moveTo(cx - S * 0.12 * k, gy - S * 0.62 * k); g.lineTo(cx + S * 0.12 * k, gy - S * 0.62 * k); g.lineTo(cx + S * 0.22 * k, gy - S * 0.02 * k); g.lineTo(cx - S * 0.22 * k, gy - S * 0.02 * k); g.closePath(); g.fill(); }
    else { g.fillStyle = lgrad(g, cx - S * 0.15, 0, cx + S * 0.15, 0, [[0, shade(cloth, 1.2)], [1, shade(cloth, 0.6)]]); g.beginPath(); g.roundRect(cx - S * 0.15 * k, gy - S * 0.62 * k, S * 0.3 * k, S * 0.36 * k, S * 0.05); g.fill(); }
    // броня
    if (opt.armor) { g.fillStyle = lgrad(g, cx - S * 0.15, gy - S * 0.62, cx + S * 0.15, gy - S * 0.3, [[0, '#e0e6ee'], [0.5, '#9aa4b0'], [1, '#5a6470']]); g.beginPath(); g.roundRect(cx - S * 0.14 * k, gy - S * 0.6 * k, S * 0.28 * k, S * 0.22 * k * (opt.armor >= 2 ? 1.3 : 1), S * 0.05); g.fill(); if (opt.armor >= 2) { ell(g, cx - S * 0.16 * k, gy - S * 0.6 * k, S * 0.07 * k, S * 0.05 * k, '#c0c8d0'); ell(g, cx + S * 0.16 * k, gy - S * 0.6 * k, S * 0.07 * k, S * 0.05 * k, '#c0c8d0'); } if (opt.armor >= 3) { g.strokeStyle = '#ffd870'; g.lineWidth = Math.max(1, S * 0.012); g.strokeRect(cx - S * 0.1 * k, gy - S * 0.56 * k, S * 0.2 * k, S * 0.16 * k); } }
    // колан
    g.fillStyle = '#3a2a1a'; g.fillRect(cx - S * 0.15 * k, gy - S * 0.3 * k, S * 0.3 * k, S * 0.04 * k);
    // ръце
    g.fillStyle = opt.armor ? '#9aa4b0' : skin; g.beginPath(); g.roundRect(cx - S * 0.22 * k, gy - S * 0.6 * k, S * 0.08 * k, S * 0.28 * k, S * 0.04); g.fill(); g.beginPath(); g.roundRect(cx + S * 0.14 * k, gy - S * 0.6 * k, S * 0.08 * k, S * 0.28 * k, S * 0.04); g.fill();
    // глава
    sphere(g, cx, gy - S * 0.72 * k, S * 0.1 * k, skin);
    g.fillStyle = '#2a1a10'; g.fillRect(cx - S * 0.045 * k, gy - S * 0.735 * k, S * 0.025 * k, S * 0.025 * k); g.fillRect(cx + S * 0.02 * k, gy - S * 0.735 * k, S * 0.025 * k, S * 0.025 * k);
    if (opt.helmet) { g.fillStyle = lgrad(g, cx - S * 0.11, gy - S * 0.85, cx + S * 0.11, gy - S * 0.7, [[0, '#e8ecf0'], [1, '#6a7480']]); g.beginPath(); g.arc(cx, gy - S * 0.74 * k, S * 0.11 * k, Math.PI, 0); g.fill(); if (opt.helmet >= 2) { g.fillStyle = opt.plume || '#d23c3c'; g.beginPath(); g.moveTo(cx - S * 0.02 * k, gy - S * 0.85 * k); g.quadraticCurveTo(cx + S * 0.02 * k, gy - S * 0.98 * k, cx + S * 0.14 * k, gy - S * 0.9 * k); g.lineTo(cx + S * 0.03 * k, gy - S * 0.84 * k); g.fill(); } }
    if (opt.hood) { g.fillStyle = shade(cloth, 0.7); g.beginPath(); g.moveTo(cx - S * 0.13 * k, gy - S * 0.66 * k); g.quadraticCurveTo(cx, gy - S * 0.98 * k, cx + S * 0.13 * k, gy - S * 0.66 * k); g.lineTo(cx + S * 0.1 * k, gy - S * 0.6 * k); g.lineTo(cx - S * 0.1 * k, gy - S * 0.6 * k); g.fill(); }
    if (opt.hat) { g.fillStyle = shade(cloth, 0.6); poly(g, [[cx - S * 0.16 * k, gy - S * 0.78 * k], [cx + S * 0.02 * k, gy - S * 1.12 * k], [cx + S * 0.16 * k, gy - S * 0.78 * k]], g.fillStyle); g.fillStyle = '#e8c040'; g.fillRect(cx - S * 0.14 * k, gy - S * 0.8 * k, S * 0.28 * k, S * 0.025 * k); }
    // оръжие
    const wx = cx + S * 0.2 * k;
    g.lineCap = 'round';
    if (opt.weapon === 'sword') { g.strokeStyle = '#e0e6ee'; g.lineWidth = S * 0.035 * k; g.beginPath(); g.moveTo(wx, gy - S * 0.36 * k); g.lineTo(wx + S * 0.06 * k, gy - S * 0.9 * k); g.stroke(); g.strokeStyle = '#c9a961'; g.lineWidth = S * 0.03 * k; g.beginPath(); g.moveTo(wx - S * 0.05 * k, gy - S * 0.45 * k); g.lineTo(wx + S * 0.07 * k, gy - S * 0.42 * k); g.stroke(); }
    if (opt.weapon === 'spear') { g.strokeStyle = '#6a4a2a'; g.lineWidth = S * 0.03 * k; g.beginPath(); g.moveTo(wx, gy - S * 0.05 * k); g.lineTo(wx + S * 0.02 * k, gy - S * 1.15 * k); g.stroke(); poly(g, [[wx + S * 0.02 * k, gy - S * 1.24 * k], [wx + S * 0.06 * k, gy - S * 1.12 * k], [wx - S * 0.02 * k, gy - S * 1.12 * k]], '#e0e6ee'); }
    if (opt.weapon === 'axe') { g.strokeStyle = '#6a4a2a'; g.lineWidth = S * 0.035 * k; g.beginPath(); g.moveTo(wx, gy - S * 0.2 * k); g.lineTo(wx + S * 0.04 * k, gy - S * 0.95 * k); g.stroke(); poly(g, [[wx + S * 0.04 * k, gy - S * 0.98 * k], [wx + S * 0.2 * k, gy - S * 0.92 * k], [wx + S * 0.18 * k, gy - S * 0.72 * k], [wx + S * 0.03 * k, gy - S * 0.78 * k]], lgrad(g, wx, gy - S, wx + S * 0.2, gy - S * 0.7, [[0, '#e0e6ee'], [1, '#6a7480']])); }
    if (opt.weapon === 'club') { g.strokeStyle = '#6a4a2a'; g.lineWidth = S * 0.05 * k; g.beginPath(); g.moveTo(wx, gy - S * 0.3 * k); g.lineTo(wx + S * 0.1 * k, gy - S * 0.85 * k); g.stroke(); sphere(g, wx + S * 0.12 * k, gy - S * 0.9 * k, S * 0.08 * k, '#5a4a3a'); }
    if (opt.weapon === 'bow') { g.strokeStyle = '#8a5a2a'; g.lineWidth = S * 0.035 * k; g.beginPath(); g.arc(wx + S * 0.02 * k, gy - S * 0.5 * k, S * 0.3 * k, -Math.PI / 2 - 0.35, Math.PI / 2 + 0.35); g.stroke(); g.strokeStyle = '#f0f0f0'; g.lineWidth = Math.max(1, S * 0.012); g.beginPath(); g.moveTo(wx - S * 0.06 * k, gy - S * 0.22 * k); g.lineTo(wx - S * 0.06 * k, gy - S * 0.78 * k); g.stroke(); g.strokeStyle = '#d8c090'; g.lineWidth = S * 0.02; g.beginPath(); g.moveTo(wx - S * 0.06 * k, gy - S * 0.5 * k); g.lineTo(wx + S * 0.28 * k, gy - S * 0.5 * k); g.stroke(); }
    if (opt.weapon === 'staff') { g.strokeStyle = '#5a3e1e'; g.lineWidth = S * 0.035 * k; g.beginPath(); g.moveTo(wx, gy - S * 0.02 * k); g.lineTo(wx + S * 0.02 * k, gy - S * 1.0 * k); g.stroke(); g.fillStyle = rgrad(g, wx + S * 0.02 * k, gy - S * 1.06 * k, S * 0.12 * k, opt.gem || '#c0a0ff', rgba(opt.gem || '#c0a0ff', 0)); g.fillRect(wx - S * 0.12 * k, gy - S * 1.2 * k, S * 0.28 * k, S * 0.28 * k); sphere(g, wx + S * 0.02 * k, gy - S * 1.06 * k, S * 0.05 * k, opt.gem || '#c0a0ff'); }
    if (opt.weapon === 'gun') { g.strokeStyle = '#3a3a40'; g.lineWidth = S * 0.04 * k; g.beginPath(); g.moveTo(wx - S * 0.02 * k, gy - S * 0.5 * k); g.lineTo(wx + S * 0.34 * k, gy - S * 0.56 * k); g.stroke(); g.fillStyle = '#6a4a2a'; g.fillRect(wx - S * 0.06 * k, gy - S * 0.52 * k, S * 0.1 * k, S * 0.1 * k); }
    if (opt.shield) { g.fillStyle = lgrad(g, cx - S * 0.32, gy - S * 0.6, cx - S * 0.1, gy - S * 0.3, [[0, shade(opt.shield, 1.3)], [1, shade(opt.shield, 0.6)]]); g.beginPath(); g.moveTo(cx - S * 0.3 * k, gy - S * 0.58 * k); g.lineTo(cx - S * 0.1 * k, gy - S * 0.58 * k); g.lineTo(cx - S * 0.1 * k, gy - S * 0.36 * k); g.quadraticCurveTo(cx - S * 0.2 * k, gy - S * 0.22 * k, cx - S * 0.3 * k, gy - S * 0.36 * k); g.fill(); g.strokeStyle = '#c9a961'; g.lineWidth = Math.max(1, S * 0.015); g.stroke(); circ(g, cx - S * 0.2 * k, gy - S * 0.45 * k, S * 0.03 * k, '#c9a961'); }
  }
  function quadruped(g, cx, gy, S, col, opt) {
    // opt: horn, wings, rider, mane, scales, tail, head:'wolf'|'horse'|'lizard'|'bull'
    shadow(g, cx, gy, S * 0.4, S * 0.1, 0.35);
    g.fillStyle = shade(col, 0.7); [[-0.3, 0], [-0.18, 0.01], [0.16, 0.01], [0.28, 0]].forEach(([dx]) => { g.beginPath(); g.roundRect(cx + dx * S - S * 0.04, gy - S * 0.3, S * 0.08, S * 0.3, S * 0.03); g.fill(); });
    if (opt.wings) { g.fillStyle = lgrad(g, cx - S * 0.1, gy - S * 1.0, cx - S * 0.5, gy - S * 0.5, [[0, shade(col, 1.4)], [1, shade(col, 0.7)]]); g.beginPath(); g.moveTo(cx - S * 0.05, gy - S * 0.55); g.quadraticCurveTo(cx - S * 0.35, gy - S * 1.05, cx - S * 0.55, gy - S * 0.75); g.quadraticCurveTo(cx - S * 0.35, gy - S * 0.7, cx - S * 0.15, gy - S * 0.5); g.fill(); }
    g.fillStyle = rgrad(g, cx, gy - S * 0.45, S * 0.4, shade(col, 1.3), shade(col, 0.65), -S * 0.12, -S * 0.12); g.beginPath(); g.ellipse(cx, gy - S * 0.42, S * 0.36, S * 0.18, 0, 0, TAU); g.fill();
    if (opt.scales) { g.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 12; i++) { const x = cx - S * 0.28 + (i % 4) * S * 0.18, y = gy - S * 0.55 + Math.floor(i / 4) * S * 0.1; g.beginPath(); g.arc(x, y, S * 0.05, 0, Math.PI); g.fill(); } }
    // опашка
    g.strokeStyle = shade(col, 0.6); g.lineWidth = S * 0.05; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - S * 0.34, gy - S * 0.46); g.quadraticCurveTo(cx - S * 0.5, gy - S * 0.55, cx - S * 0.48, gy - S * (opt.tail === 'up' ? 0.8 : 0.2)); g.stroke();
    // шия и глава
    g.fillStyle = shade(col, 1.05); g.beginPath(); g.moveTo(cx + S * 0.2, gy - S * 0.52); g.quadraticCurveTo(cx + S * 0.38, gy - S * 0.85, cx + S * 0.46, gy - S * 0.72); g.lineTo(cx + S * 0.34, gy - S * 0.44); g.fill();
    const hx = cx + S * 0.44, hy = gy - S * 0.72;
    if (opt.head === 'wolf') { poly(g, [[hx - S * 0.1, hy - S * 0.1], [hx + S * 0.18, hy - S * 0.02], [hx + S * 0.16, hy + S * 0.08], [hx - S * 0.1, hy + S * 0.1]], shade(col, 1.05)); poly(g, [[hx - S * 0.06, hy - S * 0.1], [hx - S * 0.02, hy - S * 0.22], [hx + S * 0.04, hy - S * 0.1]], shade(col, 1.05)); }
    else if (opt.head === 'lizard') { poly(g, [[hx - S * 0.1, hy - S * 0.08], [hx + S * 0.22, hy], [hx - S * 0.1, hy + S * 0.09]], shade(col, 1.1)); }
    else ell(g, hx, hy, S * 0.13, S * 0.085, shade(col, 1.05));
    circ(g, hx + S * 0.06, hy - S * 0.02, S * 0.016, opt.eye || '#000');
    if (opt.horn) { poly(g, [[hx - S * 0.02, hy - S * 0.08], [hx + S * 0.04, hy - S * 0.4], [hx + S * 0.03, hy - S * 0.08]], lgrad(g, hx, hy - S * 0.4, hx, hy, [[0, '#fff8e0'], [1, '#c9a961']])); }
    if (opt.mane) { g.strokeStyle = opt.mane; g.lineWidth = S * 0.05; g.beginPath(); g.moveTo(cx + S * 0.22, gy - S * 0.58); g.quadraticCurveTo(cx + S * 0.32, gy - S * 0.82, cx + S * 0.42, gy - S * 0.84); g.stroke(); }
    if (opt.rider) { humanoid(g, cx + S * 0.02, gy - S * 0.5, S * 0.75, Object.assign({ skin: '#e8c8a0', cloth: col }, opt.rider)); }
  }
  function creatureSprite(c, S, flip) {
    return sprite('c' + c.id + '_' + S + '_' + (flip ? 'f' : ''), S, S * 1.4, (g) => {
      const col = FAM_COLOR[c.faction] || '#aaa';
      const skin = SKIN[c.faction] || '#e8c8a0';
      const cx = S / 2, gy = S * 1.3;
      if (flip) { g.translate(S, 0); g.scale(-1, 1); }
      const upg = c.upg;
      const t = c.tier;
      const gold = upg ? '#ffd870' : null;
      switch (c.fam) {
        case 'infantry': humanoid(g, cx, gy, S, { skin, cloth: col, armor: t >= 4 ? 3 : t >= 2 ? 1 : 0, helmet: t >= 4 ? 2 : t >= 1 ? 1 : 0, plume: gold || '#d23c3c', weapon: t >= 4 ? 'sword' : c.faction === 'horde' ? 'club' : 'spear', shield: t >= 2 ? (gold || shade(col, 0.8)) : null, cape: t >= 4 ? shade(col, 1.1) : null }); break;
        case 'archer': humanoid(g, cx, gy, S, { skin, cloth: shade(col, 0.9), armor: t >= 5 ? 1 : 0, hood: t < 4, weapon: c.faction === 'workshop' ? 'gun' : 'bow', cape: upg ? shade(col, 1.2) : null }); break;
        case 'mage': humanoid(g, cx, gy, S, { skin, cloth: shade(col, 0.85), robe: true, hat: c.faction === 'academy' || c.faction === 'harbor', hood: !(c.faction === 'academy' || c.faction === 'harbor'), weapon: 'staff', gem: gold || '#c0a0ff', cape: upg ? shade(col, 1.2) : null }); break;
        case 'undead': humanoid(g, cx, gy, S, { skin: '#e8e8d8', cloth: t >= 2 ? '#5a6a5a' : '#8a8a80', armor: upg ? 1 : 0, helmet: upg ? 1 : 0, weapon: t >= 2 ? 'club' : 'sword', shield: upg ? '#6a5a7a' : null }); g.fillStyle = '#000'; g.fillRect(cx - S * 0.05, gy - S * 0.74, S * 0.035, S * 0.035); g.fillRect(cx + S * 0.02, gy - S * 0.74, S * 0.035, S * 0.035); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(cx - S * 0.04, gy - S * 0.66, S * 0.08, S * 0.02); break;
        case 'giant': humanoid(g, cx, gy, S, { skin: c.faction === 'academy' ? (upg ? '#9aa4b0' : '#a89880') : c.faction === 'workshop' ? '#9a9aa8' : skin, cloth: col, big: true, armor: t >= 6 ? 3 : t >= 4 ? 2 : 0, helmet: t >= 6 ? 2 : 0, plume: gold || '#e8e0ff', weapon: c.faction === 'horde' ? 'club' : t >= 7 ? 'axe' : c.faction === 'inferno' ? 'axe' : 'club', cape: t >= 7 ? shade(col, 1.15) : null }); if (c.faction === 'academy' && t >= 7) { g.fillStyle = rgrad(g, cx + S * 0.3, gy - S * 1.2, S * 0.2, 'rgba(160,220,255,0.8)', 'rgba(160,220,255,0)'); g.fillRect(cx, gy - S * 1.4, S * 0.6, S * 0.5); } break;
        case 'rider': quadruped(g, cx, gy, S, c.faction === 'horde' ? '#8a8078' : c.faction === 'necropolis' ? '#2a2230' : c.faction === 'grove' ? '#a07a50' : '#7a5a3a', { head: c.faction === 'horde' ? 'wolf' : 'horse', mane: c.faction === 'grove' ? '#e8d8a0' : '#3a2a1a', tail: 'down', eye: c.faction === 'necropolis' ? '#f04040' : '#000', rider: c.faction === 'grove' ? null : { armor: t >= 6 ? 3 : 1, helmet: t >= 6 ? 2 : 1, plume: gold || '#d23c3c', weapon: t >= 6 ? 'spear' : c.faction === 'horde' ? 'axe' : 'bow', shield: t >= 6 ? (gold || col) : null, cape: shade(col, 1.1) } }); if (c.faction === 'grove') { humanoid(g, cx + S * 0.08, gy - S * 0.5, S * 0.75, { skin, cloth: col, weapon: 'bow', armor: upg ? 1 : 0 }); } break;
        case 'beast': quadruped(g, cx, gy, S, c.faction === 'grove' ? '#f4f0f8' : c.faction === 'marsh' ? '#6a8a4a' : c.faction === 'academy' ? '#c0a0d0' : c.faction === 'workshop' ? '#8a7a68' : c.faction === 'inferno' ? '#8a2a20' : col, { head: c.faction === 'marsh' || c.faction === 'academy' ? 'lizard' : c.faction === 'inferno' ? 'wolf' : 'horse', horn: c.faction === 'grove', scales: c.faction === 'marsh' || c.faction === 'workshop' || c.faction === 'academy', mane: c.faction === 'grove' ? '#e8e0f0' : c.faction === 'horde' ? '#3a2a1a' : null, tail: 'up', eye: c.faction === 'inferno' || c.faction === 'marsh' ? '#f04040' : '#000' }); if (c.faction === 'horde') { g.fillStyle = '#6a4a30'; g.beginPath(); g.ellipse(cx, gy - S * 0.6, S * 0.34, S * 0.22, 0, 0, TAU); g.fill(); poly(g, [[cx + S * 0.34, gy - S * 0.7], [cx + S * 0.52, gy - S * 0.9], [cx + S * 0.4, gy - S * 0.58]], '#e8dcc0'); } break;
        case 'tree': { shadow(g, cx, gy, S * 0.3, S * 0.09, 0.35); g.fillStyle = lgrad(g, cx - S * 0.18, 0, cx + S * 0.18, 0, [[0, '#7a5a30'], [1, '#3a2812']]); g.beginPath(); g.roundRect(cx - S * 0.18, gy - S * 0.7, S * 0.36, S * 0.7, S * 0.06); g.fill(); g.strokeStyle = '#5a3e1e'; g.lineWidth = S * 0.05; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - S * 0.16, gy - S * 0.5); g.lineTo(cx - S * 0.38, gy - S * 0.3); g.moveTo(cx + S * 0.16, gy - S * 0.55); g.lineTo(cx + S * 0.4, gy - S * 0.75); g.stroke(); sphere(g, cx, gy - S * 0.92, S * 0.3, upg ? '#4a9a3a' : '#3a7a2a'); sphere(g, cx - S * 0.22, gy - S * 0.8, S * 0.18, upg ? '#4a9a3a' : '#3a7a2a'); sphere(g, cx + S * 0.24, gy - S * 0.82, S * 0.17, upg ? '#4a9a3a' : '#3a7a2a'); g.fillStyle = '#ffe070'; g.fillRect(cx - S * 0.1, gy - S * 0.5, S * 0.05, S * 0.05); g.fillRect(cx + S * 0.05, gy - S * 0.5, S * 0.05, S * 0.05); g.fillStyle = '#2a1a10'; g.fillRect(cx - S * 0.06, gy - S * 0.38, S * 0.12, S * 0.03); break; }
        case 'flyer': case 'angel': case 'spirit': {
          const wingCol = c.fam === 'angel' ? (c.faction === 'inferno' ? '#5a1a1a' : '#f8f8ff') : c.fam === 'spirit' ? rgba(shade(col, 1.2), 0.65) : c.faction === 'grove' && t >= 4 ? '#f4f4ff' : shade(col, 1.2);
          shadow(g, cx, gy, S * 0.25, S * 0.07, 0.25);
          [[-1, 0], [1, 0]].forEach(([dir]) => { g.fillStyle = lgrad(g, cx, gy - S * 0.9, cx + dir * S * 0.5, gy - S * 0.4, [[0, shade(typeof wingCol === 'string' && wingCol[0] === '#' ? wingCol : '#ccc', 1.2)], [1, wingCol]]); g.beginPath(); g.moveTo(cx + dir * S * 0.08, gy - S * 0.62); g.quadraticCurveTo(cx + dir * S * 0.45, gy - S * 1.1, cx + dir * S * 0.55, gy - S * 0.7); g.quadraticCurveTo(cx + dir * S * 0.42, gy - S * 0.62, cx + dir * S * 0.3, gy - S * 0.36); g.quadraticCurveTo(cx + dir * S * 0.2, gy - S * 0.5, cx + dir * S * 0.08, gy - S * 0.45); g.fill(); if (c.fam === 'angel') { g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(cx + dir * S * 0.1, gy - S * 0.55); g.quadraticCurveTo(cx + dir * S * (0.3 + i * 0.05), gy - S * (0.9 - i * 0.1), cx + dir * S * (0.5 - i * 0.04), gy - S * (0.72 - i * 0.08)); g.stroke(); } } });
          if (c.fam === 'spirit') { g.fillStyle = lgrad(g, 0, gy - S * 0.9, 0, gy, [[0, rgba(shade(col, 1.4), 0.95)], [1, rgba(col, 0)]]); g.beginPath(); g.moveTo(cx - S * 0.16, gy - S * 0.7); g.quadraticCurveTo(cx, gy - S * 0.1, cx + S * 0.16, gy - S * 0.7); g.fill(); sphere(g, cx, gy - S * 0.78, S * 0.1, c.faction === 'inferno' ? '#c05040' : '#f0f0ff'); g.fillStyle = c.faction === 'necropolis' || c.faction === 'inferno' ? '#ff4040' : '#4060ff'; g.fillRect(cx - S * 0.05, gy - S * 0.8, S * 0.03, S * 0.03); g.fillRect(cx + S * 0.02, gy - S * 0.8, S * 0.03, S * 0.03); if (c.faction === 'inferno') { poly(g, [[cx - S * 0.08, gy - S * 0.85], [cx - S * 0.12, gy - S * 0.98], [cx - S * 0.03, gy - S * 0.88]], '#3a1a1a'); poly(g, [[cx + S * 0.08, gy - S * 0.85], [cx + S * 0.12, gy - S * 0.98], [cx + S * 0.03, gy - S * 0.88]], '#3a1a1a'); } }
          else if (c.fam === 'angel') { humanoid(g, cx, gy, S, { skin: c.faction === 'inferno' ? '#c04030' : skin, cloth: c.faction === 'inferno' ? '#3a1a1a' : '#f0f0ff', robe: true, armor: upg ? 3 : 1, weapon: 'sword', cape: null }); if (c.faction === 'inferno') { poly(g, [[cx - S * 0.08, gy - S * 0.8], [cx - S * 0.14, gy - S * 0.98], [cx - S * 0.02, gy - S * 0.82]], '#2a1010'); poly(g, [[cx + S * 0.08, gy - S * 0.8], [cx + S * 0.14, gy - S * 0.98], [cx + S * 0.02, gy - S * 0.82]], '#2a1010'); } else { g.strokeStyle = gold || '#ffe070'; g.lineWidth = S * 0.02; g.beginPath(); g.ellipse(cx, gy - S * 0.9, S * 0.1, S * 0.03, 0, 0, TAU); g.stroke(); } }
          else { // птици, грифони, пегаси, гаргойли
            const body = c.faction === 'kingdom' ? '#c8a060' : c.faction === 'academy' ? '#7a7a88' : c.faction === 'grove' ? '#f4f4ff' : c.faction === 'harbor' ? '#7ab0c8' : c.faction === 'horde' ? '#8a6a3a' : c.faction === 'marsh' ? '#6aa050' : c.faction === 'dungeon' ? '#8a6aa0' : c.faction === 'elements' ? '#ffb040' : col;
            g.fillStyle = rgrad(g, cx, gy - S * 0.5, S * 0.28, shade(body, 1.3), shade(body, 0.6), -S * 0.08, -S * 0.08); g.beginPath(); g.ellipse(cx, gy - S * 0.48, S * 0.2, S * 0.26, 0, 0, TAU); g.fill();
            sphere(g, cx + S * 0.04, gy - S * 0.8, S * 0.11, body);
            poly(g, [[cx + S * 0.12, gy - S * 0.8], [cx + S * 0.26, gy - S * 0.78], [cx + S * 0.12, gy - S * 0.74]], '#e8c040');
            circ(g, cx + S * 0.08, gy - S * 0.83, S * 0.02, '#000');
            g.strokeStyle = shade(body, 0.6); g.lineWidth = S * 0.04; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - S * 0.06, gy - S * 0.24); g.lineTo(cx - S * 0.08, gy - S * 0.04); g.moveTo(cx + S * 0.06, gy - S * 0.24); g.lineTo(cx + S * 0.08, gy - S * 0.04); g.stroke();
            if (c.faction === 'kingdom') { g.fillStyle = '#e8dcc0'; g.beginPath(); g.ellipse(cx + S * 0.04, gy - S * 0.8, S * 0.12, S * 0.1, 0, 0, TAU); g.fill(); circ(g, cx + S * 0.08, gy - S * 0.83, S * 0.02, '#000'); poly(g, [[cx + S * 0.14, gy - S * 0.8], [cx + S * 0.28, gy - S * 0.78], [cx + S * 0.14, gy - S * 0.73]], '#e8c040'); }
            if (c.faction === 'grove') { g.strokeStyle = '#e8e0f0'; g.lineWidth = S * 0.05; g.beginPath(); g.moveTo(cx - S * 0.02, gy - S * 0.88); g.quadraticCurveTo(cx - S * 0.2, gy - S * 0.95, cx - S * 0.26, gy - S * 0.7); g.stroke(); }
          }
          break;
        }
        case 'dragon': {
          const body = c.faction === 'necropolis' ? (upg ? '#c8d8c8' : '#d8d0c0') : upg && c.faction === 'grove' ? '#e8c040' : c.faction === 'grove' ? '#3fa050' : c.faction === 'dungeon' ? (upg ? '#2a2030' : '#c03030') : c.faction === 'marsh' ? (upg ? '#7a3aa0' : '#5a8a3a') : c.faction === 'harbor' ? '#3a8aa0' : c.faction === 'workshop' ? (t >= 7 ? (upg ? '#c03060' : '#40a080') : '#c0a070') : c.faction === 'neutral' ? '#5a7a4a' : col;
          shadow(g, cx, gy, S * 0.46, S * 0.11, 0.35);
          if (!(c.faction === 'workshop' && t === 5) && !(c.faction === 'marsh' && t === 7) && c.id !== 'n_hydra' && !(c.faction === 'harbor')) [[-1], [1]].forEach(([dir]) => { g.fillStyle = lgrad(g, cx, gy - S * 0.8, cx + dir * S * 0.5, gy - S * 0.3, [[0, shade(body, 0.9)], [1, shade(body, 0.5)]]); g.beginPath(); g.moveTo(cx + dir * S * 0.1, gy - S * 0.62); g.lineTo(cx + dir * S * 0.55, gy - S * 1.15); g.lineTo(cx + dir * S * 0.5, gy - S * 0.85); g.lineTo(cx + dir * S * 0.42, gy - S * 0.5); g.lineTo(cx + dir * S * 0.3, gy - S * 0.36); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = Math.max(1, S * 0.012); g.beginPath(); g.moveTo(cx + dir * S * 0.1, gy - S * 0.62); g.lineTo(cx + dir * S * 0.5, gy - S * 0.85); g.moveTo(cx + dir * S * 0.1, gy - S * 0.62); g.lineTo(cx + dir * S * 0.42, gy - S * 0.5); g.stroke(); });
          // крака
          g.fillStyle = shade(body, 0.7); [[-0.22], [0.18]].forEach(([dx]) => { g.beginPath(); g.roundRect(cx + dx * S - S * 0.06, gy - S * 0.3, S * 0.12, S * 0.3, S * 0.04); g.fill(); });
          // тяло
          g.fillStyle = rgrad(g, cx, gy - S * 0.5, S * 0.42, shade(body, 1.3), shade(body, 0.6), -S * 0.1, -S * 0.12); g.beginPath(); g.ellipse(cx, gy - S * 0.48, S * 0.34, S * 0.22, 0, 0, TAU); g.fill();
          g.fillStyle = 'rgba(0,0,0,0.1)'; for (let i = 0; i < 9; i++) { const x = cx - S * 0.24 + (i % 3) * S * 0.24, y = gy - S * 0.6 + Math.floor(i / 3) * S * 0.12; g.beginPath(); g.arc(x, y, S * 0.06, 0, Math.PI); g.fill(); }
          // опашка
          g.strokeStyle = shade(body, 0.8); g.lineWidth = S * 0.09; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - S * 0.3, gy - S * 0.42); g.quadraticCurveTo(cx - S * 0.6, gy - S * 0.55, cx - S * 0.56, gy - S * 0.15); g.stroke();
          // шия и глава (хидрата има три)
          const heads = c.id === 'n_hydra' || (c.faction === 'marsh' && t === 7) ? 3 : 1;
          for (let k = 0; k < heads; k++) {
            const off = heads === 1 ? 0 : (k - 1) * 0.22;
            g.fillStyle = shade(body, 1.0); g.beginPath(); g.moveTo(cx + S * 0.18, gy - S * 0.6); g.quadraticCurveTo(cx + S * (0.4 + off * 0.3), gy - S * (1.0 + off), cx + S * (0.5 + off * 0.4), gy - S * (0.88 + off * 1.2)); g.lineTo(cx + S * 0.34, gy - S * 0.44); g.fill();
            const hx = cx + S * (0.52 + off * 0.4), hy = gy - S * (0.9 + off * 1.2);
            poly(g, [[hx - S * 0.12, hy - S * 0.1], [hx + S * 0.22, hy - S * 0.02], [hx + S * 0.2, hy + S * 0.08], [hx - S * 0.1, hy + S * 0.1]], lgrad(g, hx, hy - S * 0.1, hx, hy + S * 0.1, [[0, shade(body, 1.2)], [1, shade(body, 0.7)]]));
            poly(g, [[hx - S * 0.06, hy - S * 0.1], [hx - S * 0.02, hy - S * 0.3], [hx + S * 0.05, hy - S * 0.1]], shade(body, 0.7));
            circ(g, hx + S * 0.06, hy - S * 0.02, S * 0.02, c.faction === 'necropolis' ? '#40ff80' : '#ffcc20');
            if (c.faction === 'inferno' || (c.faction === 'dungeon' && !upg)) { g.fillStyle = rgrad(g, hx + S * 0.3, hy + S * 0.02, S * 0.14, 'rgba(255,140,40,0.8)', 'rgba(255,140,40,0)'); g.fillRect(hx + S * 0.15, hy - S * 0.15, S * 0.35, S * 0.3); }
          }
          if (c.faction === 'workshop' && t === 5) { g.fillStyle = '#e0c8a0'; g.beginPath(); g.arc(cx + S * 0.52, gy - S * 0.9, S * 0.12, 0, TAU); g.fill(); g.fillStyle = '#3a1a10'; g.beginPath(); g.arc(cx + S * 0.52, gy - S * 0.9, S * 0.07, 0, TAU); g.fill(); }
          break;
        }
      }
      if (gold) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = rgrad(g, S * 0.14, S * 0.5, S * 0.07, '#fff0a0', '#e0a020'); g.beginPath(); g.moveTo(S * 0.14, S * 0.43); g.lineTo(S * 0.16, S * 0.48); g.lineTo(S * 0.21, S * 0.485); g.lineTo(S * 0.17, S * 0.52); g.lineTo(S * 0.185, S * 0.57); g.lineTo(S * 0.14, S * 0.545); g.lineTo(S * 0.095, S * 0.57); g.lineTo(S * 0.11, S * 0.52); g.lineTo(S * 0.07, S * 0.485); g.lineTo(S * 0.12, S * 0.48); g.closePath(); g.fill(); }
    });
  }

  // ---------------------------------------------------------------- портрет
  function portrait(h, S, color) {
    return sprite('p' + h.cls + '_' + h.portrait + '_' + S + '_' + color + '_' + (h.faction || ''), S, S, (g) => {
      const cls = D.CLASSES[h.cls];
      g.fillStyle = rgrad(g, S * 0.5, S * 0.35, S * 0.8, shade(color, 0.9), shade(color, 0.3)); g.fillRect(0, 0, S, S);
      // светлина зад героя
      g.fillStyle = rgrad(g, S * 0.5, S * 0.45, S * 0.45, 'rgba(255,240,200,0.35)', 'rgba(255,240,200,0)'); g.fillRect(0, 0, S, S);
      const skin = SKIN[h.faction] || ['#e8c8a0', '#d8b090', '#c89a70', '#f0d8b8', '#b88a60', '#e0c0a0'][h.portrait % 6];
      const hair = ['#3a2a1a', '#e8d080', '#8a3a1a', '#222', '#c0c0c0', '#6a3a2a'][(h.portrait + 2) % 6];
      // рамене
      g.fillStyle = lgrad(g, 0, S * 0.62, 0, S, [[0, cls.magic ? '#6a5a9a' : '#9aa4b0'], [1, cls.magic ? '#3a2a5a' : '#4a5460']]); g.beginPath(); g.moveTo(S * 0.1, S); g.quadraticCurveTo(S * 0.5, S * 0.55, S * 0.9, S); g.fill();
      g.fillStyle = color; g.beginPath(); g.moveTo(S * 0.32, S); g.quadraticCurveTo(S * 0.5, S * 0.7, S * 0.68, S); g.fill();
      // шия и лице
      g.fillStyle = shade(skin, 0.85); g.fillRect(S * 0.42, S * 0.58, S * 0.16, S * 0.14);
      g.fillStyle = rgrad(g, S * 0.5, S * 0.42, S * 0.28, shade(skin, 1.15), shade(skin, 0.75), -S * 0.08, -S * 0.08); g.beginPath(); g.ellipse(S * 0.5, S * 0.44, S * 0.19, S * 0.24, 0, 0, TAU); g.fill();
      // коса
      g.fillStyle = hair; g.beginPath(); g.ellipse(S * 0.5, S * 0.3, S * 0.2, S * 0.13, 0, Math.PI, 0); g.fill();
      if (h.portrait % 3 === 0) { g.beginPath(); g.moveTo(S * 0.3, S * 0.32); g.quadraticCurveTo(S * 0.28, S * 0.6, S * 0.34, S * 0.7); g.lineTo(S * 0.36, S * 0.34); g.fill(); g.beginPath(); g.moveTo(S * 0.7, S * 0.32); g.quadraticCurveTo(S * 0.72, S * 0.6, S * 0.66, S * 0.7); g.lineTo(S * 0.64, S * 0.34); g.fill(); }
      // очи, вежди, уста
      ell(g, S * 0.43, S * 0.45, S * 0.035, S * 0.022, '#fff'); ell(g, S * 0.57, S * 0.45, S * 0.035, S * 0.022, '#fff');
      circ(g, S * 0.435, S * 0.45, S * 0.016, '#2a3a5a'); circ(g, S * 0.565, S * 0.45, S * 0.016, '#2a3a5a');
      g.strokeStyle = shade(hair, 0.7); g.lineWidth = S * 0.02; g.beginPath(); g.moveTo(S * 0.38, S * 0.4); g.lineTo(S * 0.47, S * 0.39); g.moveTo(S * 0.53, S * 0.39); g.lineTo(S * 0.62, S * 0.4); g.stroke();
      g.strokeStyle = shade(skin, 0.55); g.lineWidth = S * 0.015; g.beginPath(); g.moveTo(S * 0.45, S * 0.57); g.quadraticCurveTo(S * 0.5, S * 0.6, S * 0.55, S * 0.57); g.stroke();
      // шлем / шапка
      if (cls.magic) { g.fillStyle = lgrad(g, S * 0.3, S * 0.05, S * 0.7, S * 0.3, [[0, '#7a6ab0'], [1, '#3a2a5a']]); poly(g, [[S * 0.24, S * 0.3], [S * 0.5, -S * 0.02], [S * 0.76, S * 0.3]], g.fillStyle); g.fillStyle = '#e8c040'; g.fillRect(S * 0.26, S * 0.28, S * 0.48, S * 0.03); }
      else { g.fillStyle = lgrad(g, S * 0.3, S * 0.1, S * 0.7, S * 0.35, [[0, '#e8ecf0'], [1, '#6a7480']]); g.beginPath(); g.ellipse(S * 0.5, S * 0.28, S * 0.22, S * 0.15, 0, Math.PI, 0); g.fill(); g.fillStyle = color; g.beginPath(); g.moveTo(S * 0.5, S * 0.13); g.quadraticCurveTo(S * 0.6, S * 0.02, S * 0.74, S * 0.1); g.lineTo(S * 0.58, S * 0.16); g.fill(); }
      // винетка и рамка
      g.fillStyle = rgrad(g, S * 0.5, S * 0.5, S * 0.75, 'rgba(0,0,0,0)', 'rgba(0,0,0,0.45)'); g.fillRect(0, 0, S, S);
    });
  }

  MK.Gfx = { terrainTile, waterTile, decor, objectSprite, heroSprite, creatureSprite, portrait, flagShape, hashN, shade, mix, rgba, FAM_COLOR, RES_ICON, TOWN_STYLE, clear: () => cache.clear() };
})();
