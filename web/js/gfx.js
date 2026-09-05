/* Процедурна графика: плочки, декори, обекти, герои, същества. Всичко е рисувано с код,
   кешира се в offscreen канваси по ключ. */
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

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, Math.round(r * f))); g = Math.max(0, Math.min(255, Math.round(g * f))); b = Math.max(0, Math.min(255, Math.round(b * f)));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  MK.shade = shade;

  // ---------------------------------------------------------------- терен
  function terrainTile(t, variant, S) {
    return sprite('t' + t + '_' + variant + '_' + S, S, S, (g) => {
      const T = D.TERRAIN[t];
      g.fillStyle = variant & 1 ? T.col : T.col2; g.fillRect(0, 0, S, S);
      // текстура
      const n = Math.floor(S * S / 40);
      for (let i = 0; i < n; i++) {
        const r1 = hashN(i, variant, t), r2 = hashN(i, variant + 7, t), r3 = hashN(i, variant + 13, t);
        const x = r1 * S, y = r2 * S;
        g.fillStyle = shade(T.col, 0.85 + r3 * 0.3);
        if (t === 0) { g.fillStyle = 'rgba(255,255,255,' + (0.05 + r3 * 0.12) + ')'; g.fillRect(x, y, S * 0.12 + r3 * S * 0.1, Math.max(1, S * 0.02)); }
        else if (t === 1 || t === 5) { g.fillRect(x, y, Math.max(1, S * 0.03), Math.max(1, S * 0.06)); }
        else if (t === 3 || t === 4) { g.globalAlpha = 0.5; g.fillRect(x, y, Math.max(1, S * 0.05), Math.max(1, S * 0.02)); g.globalAlpha = 1; }
        else if (t === 7) { g.fillStyle = r3 > 0.85 ? '#d0502a' : shade(T.col, 0.8 + r3 * 0.4); g.fillRect(x, y, Math.max(1, S * 0.05), Math.max(1, S * 0.03)); }
        else { g.fillRect(x, y, Math.max(1, S * 0.04), Math.max(1, S * 0.04)); }
      }
      if (t === 5) { g.fillStyle = 'rgba(60,90,120,0.35)'; for (let i = 0; i < 3; i++) { const r = hashN(i, variant, 99); g.beginPath(); g.ellipse(r * S, hashN(i, variant, 77) * S, S * 0.12, S * 0.07, 0, 0, Math.PI * 2); g.fill(); } }
    });
  }

  // ---------------------------------------------------------------- декор
  function decor(kind, variant, S, terrain) {
    return sprite('d' + kind + '_' + variant + '_' + S + '_' + terrain, S, S, (g) => {
      const r = (i) => hashN(i, variant, kind);
      if (kind === 1 || kind === 4) { // гора / мъртва гора
        const dead = kind === 4;
        for (let i = 0; i < 3; i++) {
          const x = S * (0.25 + r(i) * 0.5), y = S * (0.3 + r(i + 5) * 0.45), rad = S * (0.18 + r(i + 9) * 0.1);
          g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x + S * 0.04, y + rad * 0.9, rad * 0.9, rad * 0.35, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = dead ? '#4a3a2a' : '#3b2a14'; g.fillRect(x - S * 0.03, y, S * 0.06, rad);
          if (dead) { g.strokeStyle = '#5a4a3a'; g.lineWidth = Math.max(1, S * 0.03); g.beginPath(); g.moveTo(x, y); g.lineTo(x - rad * 0.6, y - rad * 0.6); g.moveTo(x, y - rad * 0.2); g.lineTo(x + rad * 0.6, y - rad * 0.7); g.stroke(); }
          else {
            const base = terrain === 4 ? '#3f6f5a' : terrain === 5 ? '#4a6a2a' : '#2f6a2a';
            g.fillStyle = shade(base, 0.8); g.beginPath(); g.moveTo(x, y - rad * 1.3); g.lineTo(x + rad * 0.9, y + rad * 0.2); g.lineTo(x - rad * 0.9, y + rad * 0.2); g.fill();
            g.fillStyle = shade(base, 1.1); g.beginPath(); g.moveTo(x, y - rad * 1.3); g.lineTo(x + rad * 0.5, y - rad * 0.1); g.lineTo(x - rad * 0.5, y - rad * 0.1); g.fill();
            if (terrain === 4) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.moveTo(x, y - rad * 1.3); g.lineTo(x + rad * 0.3, y - rad * 0.6); g.lineTo(x - rad * 0.3, y - rad * 0.6); g.fill(); }
          }
        }
      } else if (kind === 2) { // планина
        const base = terrain === 7 ? '#5a3a3a' : terrain === 4 ? '#8a94a8' : '#7a6a5a';
        for (let i = 0; i < 2; i++) {
          const x = S * (0.3 + r(i) * 0.4), h = S * (0.5 + r(i + 3) * 0.4), w = S * (0.35 + r(i + 6) * 0.2);
          g.fillStyle = shade(base, 0.7); g.beginPath(); g.moveTo(x, S * 0.95 - h); g.lineTo(x + w, S * 0.95); g.lineTo(x - w, S * 0.95); g.fill();
          g.fillStyle = shade(base, 1.05); g.beginPath(); g.moveTo(x, S * 0.95 - h); g.lineTo(x - w, S * 0.95); g.lineTo(x - w * 0.1, S * 0.95); g.fill();
          g.fillStyle = terrain === 7 ? '#e06030' : '#f0f4f8'; g.beginPath(); g.moveTo(x, S * 0.95 - h); g.lineTo(x + w * 0.3, S * 0.95 - h * 0.65); g.lineTo(x - w * 0.3, S * 0.95 - h * 0.65); g.fill();
        }
      } else if (kind === 5) { // подземна скала (стена на пещера)
        g.fillStyle = '#2a2226'; g.fillRect(0, 0, S, S);
        for (let i = 0; i < 6; i++) { const x = r(i) * S, y = r(i + 6) * S, rad = S * (0.1 + r(i + 12) * 0.16); g.fillStyle = shade('#3a3036', 0.8 + r(i + 3) * 0.5); g.beginPath(); g.moveTo(x - rad, y + rad * 0.6); g.lineTo(x - rad * 0.4, y - rad); g.lineTo(x + rad * 0.7, y - rad * 0.7); g.lineTo(x + rad, y + rad * 0.5); g.fill(); }
        if (r(20) > 0.7) { g.fillStyle = '#a070e0'; g.beginPath(); g.moveTo(S * 0.5, S * 0.3); g.lineTo(S * 0.58, S * 0.55); g.lineTo(S * 0.5, S * 0.65); g.lineTo(S * 0.42, S * 0.55); g.fill(); }
      } else if (kind === 3) { // скали
        for (let i = 0; i < 4; i++) {
          const x = S * (0.2 + r(i) * 0.6), y = S * (0.35 + r(i + 4) * 0.45), rad = S * (0.1 + r(i + 8) * 0.12);
          g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(x, y + rad * 0.5, rad * 1.1, rad * 0.4, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = shade('#a09080', 0.8 + r(i + 12) * 0.4); g.beginPath(); g.moveTo(x - rad, y + rad * 0.4); g.lineTo(x - rad * 0.5, y - rad); g.lineTo(x + rad * 0.6, y - rad * 0.8); g.lineTo(x + rad, y + rad * 0.4); g.fill();
        }
      }
    });
  }

  // ---------------------------------------------------------------- обекти
  const RES_ICON = { gold: '●', wood: '≡', ore: '▲', mercury: '◉', sulfur: '✶', crystal: '◆', gems: '❖' };
  function flag(g, x, y, S, color) {
    g.fillStyle = '#332'; g.fillRect(x - S * 0.015, y - S * 0.28, S * 0.03, S * 0.28);
    g.fillStyle = color; g.beginPath(); g.moveTo(x, y - S * 0.28); g.lineTo(x + S * 0.16, y - S * 0.22); g.lineTo(x, y - S * 0.15); g.fill();
  }
  function objectSprite(o, S, world) {
    const owner = o.owner !== undefined ? o.owner : -2;
    const ownerCol = owner >= 0 ? world.players[owner].color : null;
    const key = 'o' + o.type + '_' + (o.res || '') + '_' + (o.faction || '') + '_' + (o.creature || '') + '_' + owner + '_' + S + '_' + (o.empty ? 'e' : '') + '_' + (o.art ? D.artById[o.art].cls : '');
    return sprite(key, S, S, (g) => {
      const cx = S / 2;
      const shadow = () => { g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx, S * 0.85, S * 0.4, S * 0.12, 0, 0, Math.PI * 2); g.fill(); };
      switch (o.type) {
        case 'town': {
          const f = D.factionById(o.faction);
          const wall = o.faction === 'necropolis' ? '#5a4a6a' : o.faction === 'grove' ? '#8a7a5a' : '#b8b0a0';
          const roof = f.color;
          shadow();
          g.fillStyle = shade(wall, 0.8); g.fillRect(S * 0.12, S * 0.5, S * 0.76, S * 0.38);
          g.fillStyle = wall; g.fillRect(S * 0.12, S * 0.5, S * 0.76, S * 0.08);
          // кули
          [0.2, 0.5, 0.8].forEach((fx, i) => {
            const h = i === 1 ? S * 0.5 : S * 0.35, w = S * 0.16;
            g.fillStyle = shade(wall, 0.95); g.fillRect(fx * S - w / 2, S * 0.88 - h, w, h);
            g.fillStyle = roof; g.beginPath(); g.moveTo(fx * S - w * 0.7, S * 0.88 - h); g.lineTo(fx * S, S * 0.88 - h - w * (o.faction === 'necropolis' ? 1.4 : 0.9)); g.lineTo(fx * S + w * 0.7, S * 0.88 - h); g.fill();
            g.fillStyle = '#222'; g.fillRect(fx * S - w * 0.15, S * 0.88 - h * 0.6, w * 0.3, w * 0.4);
          });
          g.fillStyle = '#3a2a1a'; g.fillRect(cx - S * 0.08, S * 0.7, S * 0.16, S * 0.18);
          if (ownerCol) flag(g, cx, S * 0.4, S, ownerCol);
          break;
        }
        case 'mine': {
          const m = D.MINES.find((m) => m.res === o.res);
          shadow();
          g.fillStyle = '#6a5a4a'; g.beginPath(); g.moveTo(S * 0.1, S * 0.85); g.lineTo(S * 0.3, S * 0.35); g.lineTo(S * 0.7, S * 0.3); g.lineTo(S * 0.9, S * 0.85); g.fill();
          g.fillStyle = '#2a1a10'; g.beginPath(); g.arc(cx, S * 0.75, S * 0.16, Math.PI, 0); g.lineTo(cx + S * 0.16, S * 0.85); g.lineTo(cx - S * 0.16, S * 0.85); g.fill();
          g.fillStyle = '#f0e8d8'; g.beginPath(); g.arc(cx, S * 0.44, S * 0.15, 0, Math.PI * 2); g.fill();
          g.fillStyle = D.RES_COLOR[o.res]; g.beginPath(); g.arc(cx, S * 0.44, S * 0.11, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#222'; g.font = 'bold ' + S * 0.16 + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(RES_ICON[o.res], cx, S * 0.45);
          if (ownerCol) flag(g, S * 0.8, S * 0.5, S, ownerCol);
          break;
        }
        case 'resource': {
          g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, S * 0.78, S * 0.28, S * 0.1, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = D.RES_COLOR[o.res];
          if (o.res === 'wood') { for (let i = 0; i < 3; i++) { g.fillStyle = shade('#8a5a2b', 0.9 + i * 0.1); g.fillRect(S * 0.2, S * 0.55 + i * S * 0.08, S * 0.6, S * 0.07); } }
          else if (o.res === 'gold') { for (let i = 0; i < 5; i++) { g.fillStyle = shade('#e8c040', 0.85 + hashN(i, 1, 2) * 0.3); g.beginPath(); g.arc(S * (0.3 + hashN(i, 3, 4) * 0.4), S * (0.55 + hashN(i, 5, 6) * 0.2), S * 0.1, 0, Math.PI * 2); g.fill(); } }
          else { for (let i = 0; i < 4; i++) { g.fillStyle = shade(D.RES_COLOR[o.res], 0.8 + hashN(i, 1, 9) * 0.4); const x = S * (0.28 + hashN(i, 2, 3) * 0.44), y = S * (0.5 + hashN(i, 4, 5) * 0.22); g.beginPath(); g.moveTo(x, y - S * 0.14); g.lineTo(x + S * 0.1, y); g.lineTo(x, y + S * 0.12); g.lineTo(x - S * 0.1, y); g.fill(); } }
          break;
        }
        case 'chest': {
          shadow();
          g.fillStyle = '#6a3a1a'; g.fillRect(S * 0.22, S * 0.5, S * 0.56, S * 0.32);
          g.fillStyle = '#8a5a2a'; g.beginPath(); g.moveTo(S * 0.22, S * 0.5); g.quadraticCurveTo(cx, S * 0.28, S * 0.78, S * 0.5); g.fill();
          g.fillStyle = '#e8c040'; g.fillRect(S * 0.22, S * 0.5, S * 0.56, S * 0.04); g.fillRect(cx - S * 0.05, S * 0.5, S * 0.1, S * 0.12);
          break;
        }
        case 'artifact': {
          g.fillStyle = 'rgba(255,240,150,0.35)'; g.beginPath(); g.arc(cx, S * 0.6, S * 0.3, 0, Math.PI * 2); g.fill();
          const a = D.artById[o.art]; const col = ['', '#c0d0e0', '#e8c040', '#e060e0'][a ? a.cls : 1];
          g.fillStyle = col; g.beginPath(); g.moveTo(cx, S * 0.3); g.lineTo(cx + S * 0.2, S * 0.6); g.lineTo(cx, S * 0.88); g.lineTo(cx - S * 0.2, S * 0.6); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.moveTo(cx, S * 0.35); g.lineTo(cx + S * 0.08, S * 0.55); g.lineTo(cx - S * 0.08, S * 0.55); g.fill();
          break;
        }
        case 'dwelling': {
          const c = D.creatureOf(o.creature); const f = D.factionById(c.faction);
          shadow();
          g.fillStyle = '#9a8a6a'; g.fillRect(S * 0.2, S * 0.5, S * 0.6, S * 0.35);
          g.fillStyle = f ? f.color : '#888'; g.beginPath(); g.moveTo(S * 0.12, S * 0.5); g.lineTo(cx, S * 0.2); g.lineTo(S * 0.88, S * 0.5); g.fill();
          g.fillStyle = '#3a2a1a'; g.fillRect(cx - S * 0.08, S * 0.65, S * 0.16, S * 0.2);
          if (ownerCol) flag(g, S * 0.82, S * 0.45, S, ownerCol);
          break;
        }
        case 'boat': {
          g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, S * 0.8, S * 0.42, S * 0.1, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#6a4a2a'; g.beginPath(); g.moveTo(S * 0.1, S * 0.58); g.lineTo(S * 0.9, S * 0.58); g.lineTo(S * 0.78, S * 0.8); g.lineTo(S * 0.22, S * 0.8); g.closePath(); g.fill();
          g.fillStyle = '#8a6a3a'; g.fillRect(S * 0.1, S * 0.56, S * 0.8, S * 0.05);
          g.fillStyle = '#3a2a1a'; g.fillRect(cx - S * 0.02, S * 0.15, S * 0.04, S * 0.45);
          g.fillStyle = ownerCol || '#e8e0d0'; g.beginPath(); g.moveTo(cx + S * 0.02, S * 0.17); g.lineTo(cx + S * 0.34, S * 0.5); g.lineTo(cx + S * 0.02, S * 0.5); g.fill();
          g.fillStyle = '#f0e8d8'; g.beginPath(); g.moveTo(cx - S * 0.02, S * 0.2); g.lineTo(cx - S * 0.3, S * 0.5); g.lineTo(cx - S * 0.02, S * 0.5); g.fill();
          break;
        }
        case 'gate': {
          g.fillStyle = '#4a4048'; g.beginPath(); g.moveTo(S * 0.15, S * 0.9); g.lineTo(S * 0.2, S * 0.35); g.quadraticCurveTo(cx, S * 0.05, S * 0.8, S * 0.35); g.lineTo(S * 0.85, S * 0.9); g.fill();
          g.fillStyle = '#0a0810'; g.beginPath(); g.moveTo(S * 0.3, S * 0.9); g.lineTo(S * 0.32, S * 0.45); g.quadraticCurveTo(cx, S * 0.25, S * 0.68, S * 0.45); g.lineTo(S * 0.7, S * 0.9); g.fill();
          g.fillStyle = 'rgba(160,120,255,0.5)'; g.beginPath(); g.ellipse(cx, S * 0.7, S * 0.14, S * 0.2, 0, 0, Math.PI * 2); g.fill();
          break;
        }
        case 'whirlpool': {
          g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = S * 0.05;
          for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(cx, S * 0.55, S * (0.12 + k * 0.11), k * 1.2, k * 1.2 + 4.2); g.stroke(); }
          break;
        }
        case 'lighthouse': {
          shadow();
          g.fillStyle = '#e8e0d0'; g.beginPath(); g.moveTo(cx - S * 0.12, S * 0.85); g.lineTo(cx - S * 0.08, S * 0.25); g.lineTo(cx + S * 0.08, S * 0.25); g.lineTo(cx + S * 0.12, S * 0.85); g.fill();
          g.fillStyle = '#d23c3c'; g.fillRect(cx - S * 0.11, S * 0.55, S * 0.22, S * 0.1);
          g.fillStyle = '#ffe070'; g.fillRect(cx - S * 0.1, S * 0.15, S * 0.2, S * 0.12);
          g.fillStyle = 'rgba(255,230,120,0.35)'; g.beginPath(); g.moveTo(cx + S * 0.1, S * 0.2); g.lineTo(S, S * 0.05); g.lineTo(S, S * 0.4); g.fill();
          if (ownerCol) flag(g, cx + S * 0.2, S * 0.5, S, ownerCol);
          break;
        }
        case 'sea_chest': {
          g.fillStyle = '#5a3a1a'; g.fillRect(S * 0.25, S * 0.5, S * 0.5, S * 0.28); g.fillStyle = '#e8c040'; g.fillRect(S * 0.25, S * 0.5, S * 0.5, S * 0.05); g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.ellipse(cx, S * 0.82, S * 0.35, S * 0.06, 0, 0, Math.PI * 2); g.fill();
          break;
        }
        case 'shipwreck': {
          g.fillStyle = '#4a3a2a'; g.beginPath(); g.moveTo(S * 0.15, S * 0.7); g.lineTo(S * 0.85, S * 0.6); g.lineTo(S * 0.75, S * 0.85); g.lineTo(S * 0.3, S * 0.85); g.fill();
          g.fillStyle = '#3a2a1a'; g.save(); g.translate(cx, S * 0.62); g.rotate(-0.4); g.fillRect(-S * 0.02, -S * 0.45, S * 0.04, S * 0.45); g.restore();
          if (o.empty) g.globalAlpha = 0.6;
          break;
        }
        default: {
          const glyph = { windmill: '🌬', watermill: '⚙', learning: '📜', rally: '🚩', mercenary: '⚔', tower_def: '🛡', star_axis: '✨', garden: '🌸', campfire: '🔥', shrine1: '⛩', shrine2: '⛩', shrine3: '⛩', tree_knowledge: '🌳', magic_well: '💧', wagon: '🛒', fountain: '⛲', idol: '🗿', obelisk: '🗼', stables: '🐎', sanctuary: '🏛', school_war: '🏫', school_magic: '🔮', library: '📚', monolith: '🌀' }[o.type] || '?';
          g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, S * 0.82, S * 0.3, S * 0.1, 0, 0, Math.PI * 2); g.fill();
          g.font = S * 0.6 + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
          if (o.empty) g.globalAlpha = 0.5;
          g.fillText(glyph, cx, S * 0.5);
        }
      }
    });
  }

  // ---------------------------------------------------------------- герои и същества
  function heroSprite(h, S, color, mounted) {
    if (h.boat) return sprite('hb' + color + '_' + S, S, S, (g) => {
      const cx = S / 2;
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, S * 0.82, S * 0.44, S * 0.1, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#6a4a2a'; g.beginPath(); g.moveTo(S * 0.08, S * 0.58); g.lineTo(S * 0.92, S * 0.58); g.lineTo(S * 0.8, S * 0.82); g.lineTo(S * 0.2, S * 0.82); g.closePath(); g.fill();
      g.fillStyle = '#3a2a1a'; g.fillRect(cx - S * 0.02, S * 0.12, S * 0.04, S * 0.48);
      g.fillStyle = color; g.beginPath(); g.moveTo(cx + S * 0.02, S * 0.14); g.lineTo(cx + S * 0.36, S * 0.5); g.lineTo(cx + S * 0.02, S * 0.5); g.fill();
      g.fillStyle = '#f0e8d8'; g.beginPath(); g.moveTo(cx - S * 0.02, S * 0.18); g.lineTo(cx - S * 0.32, S * 0.5); g.lineTo(cx - S * 0.02, S * 0.5); g.fill();
      g.fillStyle = '#e8c8a0'; g.beginPath(); g.arc(cx - S * 0.2, S * 0.5, S * 0.06, 0, Math.PI * 2); g.fill();
      g.fillStyle = color; g.fillRect(cx - S * 0.26, S * 0.55, S * 0.12, S * 0.1);
    });
    return sprite('h' + h.faction + '_' + color + '_' + S + '_' + (h.portrait || 0), S, S, (g) => {
      const cx = S / 2;
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx, S * 0.86, S * 0.32, S * 0.1, 0, 0, Math.PI * 2); g.fill();
      // кон
      const horse = h.faction === 'necropolis' ? '#2a2230' : '#6a4a2a';
      g.fillStyle = horse; g.beginPath(); g.ellipse(cx, S * 0.66, S * 0.3, S * 0.15, 0, 0, Math.PI * 2); g.fill();
      g.fillRect(cx - S * 0.26, S * 0.7, S * 0.07, S * 0.16); g.fillRect(cx + S * 0.18, S * 0.7, S * 0.07, S * 0.16);
      g.beginPath(); g.ellipse(cx + S * 0.3, S * 0.55, S * 0.1, S * 0.07, -0.5, 0, Math.PI * 2); g.fill();
      // ездач
      g.fillStyle = color; g.fillRect(cx - S * 0.1, S * 0.36, S * 0.2, S * 0.26);
      g.fillStyle = '#e8c8a0'; g.beginPath(); g.arc(cx, S * 0.3, S * 0.08, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#c0c8d0'; g.beginPath(); g.arc(cx, S * 0.28, S * 0.09, Math.PI, 0); g.fill();
      // знаме
      g.fillStyle = '#442'; g.fillRect(cx - S * 0.26, S * 0.15, S * 0.025, S * 0.45);
      g.fillStyle = color; g.beginPath(); g.moveTo(cx - S * 0.24, S * 0.15); g.lineTo(cx - S * 0.05, S * 0.21); g.lineTo(cx - S * 0.24, S * 0.28); g.fill();
    });
  }
  const FAM_COLOR = { kingdom: '#6f9fe8', grove: '#6fc070', necropolis: '#a07fd0', neutral: '#c0a070', academy: '#a8d0f0', inferno: '#e07050', dungeon: '#9070b0', horde: '#c89050', marsh: '#70a070', elements: '#d0b8f8', harbor: '#50b0c8', workshop: '#c0a878' };
  function creatureSprite(c, S, flip) {
    return sprite('c' + c.id + '_' + S + '_' + (flip ? 'f' : ''), S, S, (g) => {
      const col = FAM_COLOR[c.faction] || '#aaa';
      const dark = shade(col, 0.6), light = shade(col, 1.25);
      const cx = S / 2;
      if (flip) { g.translate(S, 0); g.scale(-1, 1); }
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx, S * 0.9, S * 0.3, S * 0.08, 0, 0, Math.PI * 2); g.fill();
      const u = c.upg ? '#ffd870' : null;
      switch (c.fam) {
        case 'infantry': case 'mage': case 'undead': {
          g.fillStyle = c.fam === 'undead' ? '#d8d8c8' : col; g.fillRect(cx - S * 0.12, S * 0.4, S * 0.24, S * 0.32);
          g.fillStyle = c.fam === 'undead' ? '#e8e8d8' : '#e8c8a0'; g.beginPath(); g.arc(cx, S * 0.32, S * 0.1, 0, Math.PI * 2); g.fill();
          g.fillStyle = dark; g.fillRect(cx - S * 0.12, S * 0.72, S * 0.09, S * 0.16); g.fillRect(cx + S * 0.03, S * 0.72, S * 0.09, S * 0.16);
          if (c.fam === 'mage') { g.fillStyle = dark; g.beginPath(); g.moveTo(cx - S * 0.14, S * 0.3); g.lineTo(cx, S * 0.1); g.lineTo(cx + S * 0.14, S * 0.3); g.fill(); g.strokeStyle = '#e8c040'; g.lineWidth = S * 0.03; g.beginPath(); g.moveTo(cx + S * 0.2, S * 0.2); g.lineTo(cx + S * 0.2, S * 0.85); g.stroke(); }
          else { g.strokeStyle = '#d0d8e0'; g.lineWidth = S * 0.04; g.beginPath(); g.moveTo(cx + S * 0.16, S * 0.15); g.lineTo(cx + S * 0.2, S * 0.75); g.stroke(); if (c.tier >= 4) { g.fillStyle = light; g.beginPath(); g.arc(cx - S * 0.2, S * 0.55, S * 0.12, 0, Math.PI * 2); g.fill(); } }
          if (c.fam === 'undead') { g.fillStyle = '#222'; g.fillRect(cx - S * 0.06, S * 0.29, S * 0.04, S * 0.04); g.fillRect(cx + S * 0.02, S * 0.29, S * 0.04, S * 0.04); }
          break;
        }
        case 'archer': {
          g.fillStyle = col; g.fillRect(cx - S * 0.11, S * 0.4, S * 0.22, S * 0.3);
          g.fillStyle = '#e8c8a0'; g.beginPath(); g.arc(cx, S * 0.32, S * 0.09, 0, Math.PI * 2); g.fill();
          g.fillStyle = dark; g.fillRect(cx - S * 0.11, S * 0.7, S * 0.08, S * 0.18); g.fillRect(cx + S * 0.03, S * 0.7, S * 0.08, S * 0.18);
          g.strokeStyle = '#8a5a2a'; g.lineWidth = S * 0.04; g.beginPath(); g.arc(cx + S * 0.22, S * 0.5, S * 0.25, -Math.PI / 2 - 0.3, Math.PI / 2 + 0.3); g.stroke();
          g.strokeStyle = '#eee'; g.lineWidth = S * 0.015; g.beginPath(); g.moveTo(cx + S * 0.15, S * 0.26); g.lineTo(cx + S * 0.15, S * 0.74); g.stroke();
          break;
        }
        case 'rider': {
          g.fillStyle = dark; g.beginPath(); g.ellipse(cx, S * 0.62, S * 0.3, S * 0.14, 0, 0, Math.PI * 2); g.fill();
          g.fillRect(cx - S * 0.26, S * 0.66, S * 0.07, S * 0.2); g.fillRect(cx + S * 0.18, S * 0.66, S * 0.07, S * 0.2);
          g.beginPath(); g.ellipse(cx + S * 0.3, S * 0.5, S * 0.1, S * 0.07, -0.5, 0, Math.PI * 2); g.fill();
          g.fillStyle = col; g.fillRect(cx - S * 0.09, S * 0.3, S * 0.18, S * 0.26);
          g.fillStyle = '#e8c8a0'; g.beginPath(); g.arc(cx, S * 0.24, S * 0.08, 0, Math.PI * 2); g.fill();
          g.strokeStyle = '#d0d8e0'; g.lineWidth = S * 0.035; g.beginPath(); g.moveTo(cx + S * 0.1, S * 0.5); g.lineTo(cx + S * 0.45, S * 0.15); g.stroke();
          break;
        }
        case 'flyer': case 'angel': case 'spirit': {
          const wing = c.fam === 'angel' ? '#f8f8ff' : c.fam === 'spirit' ? 'rgba(200,190,240,0.7)' : light;
          g.fillStyle = wing;
          g.beginPath(); g.moveTo(cx - S * 0.08, S * 0.45); g.lineTo(cx - S * 0.45, S * 0.2); g.lineTo(cx - S * 0.35, S * 0.6); g.fill();
          g.beginPath(); g.moveTo(cx + S * 0.08, S * 0.45); g.lineTo(cx + S * 0.45, S * 0.2); g.lineTo(cx + S * 0.35, S * 0.6); g.fill();
          g.fillStyle = c.fam === 'spirit' ? 'rgba(220,220,255,0.85)' : col; g.beginPath(); g.ellipse(cx, S * 0.52, S * 0.14, S * 0.24, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = c.fam === 'spirit' ? '#f0f0ff' : '#e8c8a0'; g.beginPath(); g.arc(cx, S * 0.28, S * 0.09, 0, Math.PI * 2); g.fill();
          if (c.fam === 'angel') { g.strokeStyle = '#ffe070'; g.lineWidth = S * 0.02; g.beginPath(); g.arc(cx, S * 0.16, S * 0.07, 0, Math.PI * 2); g.stroke(); }
          if (c.fam === 'spirit') { g.fillStyle = '#f04040'; g.fillRect(cx - S * 0.05, S * 0.26, S * 0.03, S * 0.03); g.fillRect(cx + S * 0.02, S * 0.26, S * 0.03, S * 0.03); }
          break;
        }
        case 'beast': {
          g.fillStyle = c.faction === 'grove' ? '#f0f0f8' : col; g.beginPath(); g.ellipse(cx, S * 0.6, S * 0.3, S * 0.16, 0, 0, Math.PI * 2); g.fill();
          g.fillRect(cx - S * 0.26, S * 0.66, S * 0.07, S * 0.2); g.fillRect(cx + S * 0.18, S * 0.66, S * 0.07, S * 0.2); g.fillRect(cx - S * 0.12, S * 0.68, S * 0.07, S * 0.18); g.fillRect(cx + S * 0.05, S * 0.68, S * 0.07, S * 0.18);
          g.beginPath(); g.ellipse(cx + S * 0.3, S * 0.42, S * 0.11, S * 0.08, -0.6, 0, Math.PI * 2); g.fill();
          if (c.faction === 'grove') { g.fillStyle = '#e8c040'; g.beginPath(); g.moveTo(cx + S * 0.34, S * 0.36); g.lineTo(cx + S * 0.44, S * 0.08); g.lineTo(cx + S * 0.39, S * 0.36); g.fill(); }
          break;
        }
        case 'tree': {
          g.fillStyle = '#5a3a1a'; g.fillRect(cx - S * 0.14, S * 0.4, S * 0.28, S * 0.48);
          g.fillStyle = '#3a7a2a'; g.beginPath(); g.arc(cx, S * 0.3, S * 0.26, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#e8e040'; g.fillRect(cx - S * 0.08, S * 0.48, S * 0.05, S * 0.05); g.fillRect(cx + S * 0.03, S * 0.48, S * 0.05, S * 0.05);
          break;
        }
        case 'giant': {
          g.fillStyle = col; g.fillRect(cx - S * 0.2, S * 0.3, S * 0.4, S * 0.42);
          g.fillStyle = '#c8b090'; g.beginPath(); g.arc(cx, S * 0.22, S * 0.13, 0, Math.PI * 2); g.fill();
          g.fillStyle = dark; g.fillRect(cx - S * 0.2, S * 0.72, S * 0.15, S * 0.16); g.fillRect(cx + S * 0.05, S * 0.72, S * 0.15, S * 0.16);
          g.fillStyle = '#8a6a4a'; g.fillRect(cx + S * 0.22, S * 0.15, S * 0.08, S * 0.6);
          break;
        }
        case 'dragon': {
          const body = c.faction === 'necropolis' ? '#d8d0c0' : c.upg ? '#e8c040' : c.faction === 'grove' ? '#3fa050' : col;
          g.fillStyle = shade(body, 0.8);
          g.beginPath(); g.moveTo(cx - S * 0.1, S * 0.5); g.lineTo(cx - S * 0.48, S * 0.15); g.lineTo(cx - S * 0.3, S * 0.6); g.fill();
          g.beginPath(); g.moveTo(cx + S * 0.1, S * 0.5); g.lineTo(cx + S * 0.48, S * 0.15); g.lineTo(cx + S * 0.3, S * 0.6); g.fill();
          g.fillStyle = body; g.beginPath(); g.ellipse(cx, S * 0.6, S * 0.22, S * 0.18, 0, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.moveTo(cx + S * 0.1, S * 0.5); g.quadraticCurveTo(cx + S * 0.3, S * 0.2, cx + S * 0.38, S * 0.3); g.lineTo(cx + S * 0.2, S * 0.5); g.fill();
          g.beginPath(); g.moveTo(cx - S * 0.15, S * 0.7); g.quadraticCurveTo(cx - S * 0.4, S * 0.9, cx - S * 0.45, S * 0.7); g.lineTo(cx - S * 0.2, S * 0.62); g.fill();
          g.fillStyle = '#f04040'; g.beginPath(); g.arc(cx + S * 0.33, S * 0.3, S * 0.025, 0, Math.PI * 2); g.fill();
          break;
        }
      }
      if (u) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = u; g.beginPath(); g.arc(S * 0.15, S * 0.15, S * 0.06, 0, Math.PI * 2); g.fill(); }
    });
  }

  // Портрет на герой (за списъци)
  function portrait(h, S, color) {
    return sprite('p' + h.cls + '_' + h.portrait + '_' + S + '_' + color, S, S, (g) => {
      const cls = D.CLASSES[h.cls];
      g.fillStyle = shade(color, 0.5); g.fillRect(0, 0, S, S);
      g.fillStyle = color; g.fillRect(0, S * 0.75, S, S * 0.25);
      const skin = ['#e8c8a0', '#d8b090', '#c89a70', '#f0d8b8', '#b88a60', '#e0c0a0'][h.portrait % 6];
      const hair = ['#3a2a1a', '#e8d080', '#8a3a1a', '#222', '#c0c0c0', '#6a3a2a'][(h.portrait + 2) % 6];
      g.fillStyle = cls.magic ? '#5a4a8a' : '#7a7a8a'; g.fillRect(S * 0.2, S * 0.62, S * 0.6, S * 0.2);
      g.fillStyle = skin; g.beginPath(); g.ellipse(S / 2, S * 0.45, S * 0.2, S * 0.24, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = hair; g.beginPath(); g.ellipse(S / 2, S * 0.3, S * 0.21, S * 0.13, 0, Math.PI, 0); g.fill();
      if (cls.magic) { g.fillStyle = '#5a4a8a'; g.beginPath(); g.moveTo(S * 0.25, S * 0.3); g.lineTo(S / 2, S * 0.02); g.lineTo(S * 0.75, S * 0.3); g.fill(); }
      else { g.fillStyle = '#a0a8b0'; g.beginPath(); g.ellipse(S / 2, S * 0.28, S * 0.22, S * 0.14, 0, Math.PI, 0); g.fill(); }
      g.fillStyle = '#222'; g.fillRect(S * 0.42, S * 0.45, S * 0.04, S * 0.04); g.fillRect(S * 0.55, S * 0.45, S * 0.04, S * 0.04);
    });
  }

  MK.Gfx = { terrainTile, decor, objectSprite, heroSprite, creatureSprite, portrait, hashN, shade, FAM_COLOR, RES_ICON, clear: () => cache.clear() };
})();
