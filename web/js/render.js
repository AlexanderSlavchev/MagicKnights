/* Рендер на приключенската карта: камера, текстурирани плочки с преливане между терените,
   жива вода, пътища, гори, обекти с животни детайли (знамена, дим, сияния), герои, мъгла,
   атмосферни частици, светлина и път на героя. */
(function () {
  'use strict';
  const MK = (window.MK = window.MK || {});
  const D = MK.data;
  const G = MK.Gfx;
  const TAU = Math.PI * 2;

  class MapRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.cam = { x: 10, y: 10, zoom: 52 };
      this.z = 0;
      this.minZoom = 24; this.maxZoom = 110;
      this.pathPreview = null;
      this.selected = null;
      this.anim = null;
      this.time = 0;
      this.particles = [];
      this.smoke = [];
    }
    resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.canvas.width = Math.floor(this.canvas.clientWidth * dpr);
      this.canvas.height = Math.floor(this.canvas.clientHeight * dpr);
      this.dpr = dpr;
    }
    get vw() { return this.canvas.width; }
    get vh() { return this.canvas.height; }
    tileSize() { return this.cam.zoom * this.dpr; }
    toScreen(tx, ty) { const S = this.tileSize(); return [this.vw / 2 + (tx - this.cam.x) * S, this.vh / 2 + (ty - this.cam.y) * S]; }
    toTile(sx, sy) { const S = this.tileSize(); return [Math.floor(this.cam.x + (sx * this.dpr - this.vw / 2) / S), Math.floor(this.cam.y + (sy * this.dpr - this.vh / 2) / S)]; }
    center(x, y) { this.cam.x = x + 0.5; this.cam.y = y + 0.5; this.clamp(); }
    /* Плочката е в границите на екрана (с малък запас) */
    isVisible(x, y) { const S = this.tileSize(); const hw = this.vw / 2 / S, hh = this.vh / 2 / S; return Math.abs(x + 0.5 - this.cam.x) < hw - 1.5 && Math.abs(y + 0.5 - this.cam.y) < hh - 1.5; }
    /* Меко следване: камерата се мести само колкото плочката да остане в „удобната“ зона на екрана */
    follow(x, y) {
      const S = this.tileSize(); const hw = this.vw / 2 / S, hh = this.vh / 2 / S;
      const mx = hw * 0.55, my = hh * 0.55, dx = x + 0.5 - this.cam.x, dy = y + 0.5 - this.cam.y;
      if (dx > mx) this.cam.x += dx - mx; else if (dx < -mx) this.cam.x += dx + mx;
      if (dy > my) this.cam.y += dy - my; else if (dy < -my) this.cam.y += dy + my;
      this.clamp();
    }
    clamp() {
      const w = this.world; if (!w) return;
      const S = this.tileSize();
      const halfW = this.vw / 2 / S, halfH = this.vh / 2 / S;
      this.cam.x = Math.max(Math.min(halfW, w.map.w / 2), Math.min(w.map.w - halfW, this.cam.x));
      this.cam.y = Math.max(Math.min(halfH, w.map.h / 2), Math.min(w.map.h - halfH, this.cam.y));
      if (w.map.w < halfW * 2) this.cam.x = w.map.w / 2;
      if (w.map.h < halfH * 2) this.cam.y = w.map.h / 2;
    }
    pan(dx, dy) { const S = this.tileSize(); this.cam.x -= dx * this.dpr / S; this.cam.y -= dy * this.dpr / S; this.clamp(); }
    zoomAt(factor, sx, sy) {
      const [tx, ty] = this.toTile(sx, sy);
      const before = this.cam.zoom;
      this.cam.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.cam.zoom * factor));
      const S = this.tileSize();
      const nx = this.cam.x + (sx * this.dpr - this.vw / 2) / S, ny = this.cam.y + (sy * this.dpr - this.vh / 2) / S;
      this.cam.x += (tx + 0.5) - nx; this.cam.y += (ty + 0.5) - ny;
      this.clamp();
      return before !== this.cam.zoom;
    }

    draw(world, viewer, dt) {
      this.world = world;
      this.time += dt || 16;
      const T = this.time / 1000;
      const g = this.ctx, S = this.tileSize();
      const L = world.lv(this.z);
      const m = { w: world.map.w, h: world.map.h, terrain: L.terrain, road: L.road, block: L.block, objAt: L.objAt };
      g.fillStyle = this.z ? '#0a0608' : '#05060a'; g.fillRect(0, 0, this.vw, this.vh);
      const x0 = Math.max(0, Math.floor(this.cam.x - this.vw / 2 / S) - 1), x1 = Math.min(m.w - 1, Math.ceil(this.cam.x + this.vw / 2 / S) + 1);
      const y0 = Math.max(0, Math.floor(this.cam.y - this.vh / 2 / S) - 2), y1 = Math.min(m.h - 1, Math.ceil(this.cam.y + this.vh / 2 / S) + 1);
      const fog = viewer.fog[this.z] || viewer.fog[0];
      const TS = Math.ceil(S) + 1;
      const texSize = S > 60 ? 128 : 96;
      g.imageSmoothingEnabled = true;
      const waterFrame = Math.floor(T * 6) % 8;
      // --- терен
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * m.w + x;
        if (!fog[i]) continue;
        const [sx, sy] = this.toScreen(x, y);
        const t = m.terrain[i];
        if (t === 0) {
          const drawnW = MK.Img.has('terrain/water');
          const wt = G.waterTile(waterFrame, (x & 3) | ((y & 3) << 2), drawnW ? texSize : 64);
          g.drawImage(wt, 1, 1, wt.width - 2, wt.height - 2, Math.floor(sx), Math.floor(sy), TS, TS);
          if (drawnW) { // бавно преминаващ отблясък по вълните
            const k = 0.5 + 0.5 * Math.sin(T * 1.2 + x * 0.22 + y * 0.31);
            g.fillStyle = 'rgba(200,235,255,' + (0.045 * k) + ')'; g.fillRect(Math.floor(sx), Math.floor(sy), TS, TS);
          }
        }
        else g.drawImage(G.terrainTile(t, (x & 3) | ((y & 3) << 2), texSize), 1, 1, texSize, texSize, Math.floor(sx), Math.floor(sy), TS, TS);
      }
      // --- преливане между терените и бряг
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * m.w + x;
        if (!fog[i]) continue;
        const t = m.terrain[i];
        const [sx, sy] = this.toScreen(x, y);
        const drawn = MK.Img.has('terrain/grass'); // рисувани текстури: преливане с приоритет и ъгли
        const coastDirs = [];
        for (let d = 0; d < (drawn ? 8 : 4); d++) {
          const nx = x + MK.DIRS[d][0], ny = y + MK.DIRS[d][1];
          if (!world.inb(nx, ny)) continue;
          const nt = m.terrain[ny * m.w + nx];
          if (nt === t) continue;
          if (drawn) {
            if (G.blendPriority(nt) <= G.blendPriority(t)) continue; // само по-силният терен навлиза (водата е най-слаба)
            if (d >= 4) { // ъгъл: само ако двата съседни ръба не са същия терен (иначе ръбовете вече го покриват)
              const ax = m.terrain[y * m.w + nx], ay = m.terrain[ny * m.w + x];
              if (ax === nt || ay === nt) continue;
            }
            if (t === 0) { coastDirs.push([d, nt]); continue; } // бряг: рисува се на два слоя след цикъла
          } else if (d >= 4) continue;
          if (t === 0) { // бряг: пяна върху водата
            const foam = 0.4 + 0.2 * Math.sin(T * 2.2 + x * 1.7 + y * 2.3);
            const gr = MK.DIRS[d][0] ? g.createLinearGradient(sx + (MK.DIRS[d][0] > 0 ? S : 0), 0, sx + (MK.DIRS[d][0] > 0 ? S - S * 0.34 : S * 0.34), 0) : g.createLinearGradient(0, sy + (MK.DIRS[d][1] > 0 ? S : 0), 0, sy + (MK.DIRS[d][1] > 0 ? S - S * 0.34 : S * 0.34));
            gr.addColorStop(0, 'rgba(235,245,250,' + foam + ')'); gr.addColorStop(0.18, 'rgba(120,200,215,0.22)'); gr.addColorStop(1, 'rgba(70,160,190,0)');
            g.fillStyle = gr; g.fillRect(sx, sy, TS, TS);
          } else if (nt !== 0) { // преход: текстурата на съседа навлиза с неравен ръб
            g.drawImage(G.edgeBlend(nt, (x & 3) | ((y & 3) << 2), d, texSize), 1, 1, texSize, texSize, Math.floor(sx), Math.floor(sy), TS, TS);
          } else { // сушата до вода: тъмен влажен ръб
            const gr = MK.DIRS[d][0] ? g.createLinearGradient(sx + (MK.DIRS[d][0] > 0 ? S : 0), 0, sx + (MK.DIRS[d][0] > 0 ? S * 0.75 : S * 0.25), 0) : g.createLinearGradient(0, sy + (MK.DIRS[d][1] > 0 ? S : 0), 0, sy + (MK.DIRS[d][1] > 0 ? S * 0.75 : S * 0.25));
            gr.addColorStop(0, 'rgba(40,60,50,0.35)'); gr.addColorStop(1, 'rgba(40,60,50,0)');
            g.fillStyle = gr; g.fillRect(sx, sy, TS, TS);
          }
        }
        if (coastDirs.length) { // 1) сушата навлиза във водата (твърд ръб, мокра линия); 2) пяна пред целия бряг
          const v = (x & 3) | ((y & 3) << 2);
          coastDirs.forEach(([d, nt]) => g.drawImage(G.edgeBlend(nt, v, d, texSize, 1), 1, 1, texSize, texSize, Math.floor(sx), Math.floor(sy), TS, TS));
          g.globalAlpha = 0.75 + 0.25 * Math.sin(T * 1.8 + x * 0.7 + y * 0.9);
          coastDirs.forEach(([d, nt]) => g.drawImage(G.edgeBlend(nt, v, d, texSize, 2), 1, 1, texSize, texSize, Math.floor(sx), Math.floor(sy), TS, TS));
          g.globalAlpha = 1;
        }
      }
      // --- пътища
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * m.w + x;
        if (!m.road[i] || !fog[i]) continue;
        const [sx, sy] = this.toScreen(x, y);
        const cx = sx + S / 2, cy = sy + S / 2;
        let any = false;
        for (let pass = 0; pass < 2; pass++) {
          g.strokeStyle = pass ? '#c2a97d' : 'rgba(60,45,25,0.45)'; g.lineWidth = S * (pass ? 0.26 : 0.34); g.lineCap = 'round';
          for (let d = 0; d < 8; d++) {
            const nx = x + MK.DIRS[d][0], ny = y + MK.DIRS[d][1];
            if (!world.inb(nx, ny) || !m.road[ny * m.w + nx]) continue;
            any = true; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + MK.DIRS[d][0] * S / 2, cy + MK.DIRS[d][1] * S / 2); g.stroke();
          }
        }
        if (!any) { g.fillStyle = '#c2a97d'; g.beginPath(); g.arc(cx, cy, S * 0.14, 0, TAU); g.fill(); }
        // камъчета
        g.fillStyle = 'rgba(90,70,45,0.35)'; for (let k = 0; k < 3; k++) { const r = G.hashN(x, y, k); g.beginPath(); g.arc(cx + (r - 0.5) * S * 0.3, cy + (G.hashN(y, x, k) - 0.5) * S * 0.3, S * 0.02, 0, TAU); g.fill(); }
      }
      // --- достижими плочки
      if (this.reach && this.selected && (this.selected.z || 0) === this.z) {
        // един път за всички плочки: припокриванията не се сумират и не се вижда решетка
        g.fillStyle = 'rgba(255,255,255,0.09)'; g.beginPath();
        this.reach.forEach((c, i) => { const x = i % m.w, y = Math.floor(i / m.w); if (x < x0 || x > x1 || y < y0 || y > y1) return; const [sx, sy] = this.toScreen(x, y); g.rect(Math.floor(sx), Math.floor(sy), TS, TS); });
        g.fill();
      }
      // --- декори, обекти и герои по редове
      const spriteS = S > 60 ? 128 : 96;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = y * m.w + x;
          if (!fog[i]) continue;
          const [sx, sy] = this.toScreen(x, y);
          if (m.block[i]) {
            if (this.z && m.block[i] === 2) g.drawImage(G.decor(5, (x * 31 + y * 17) & 7, spriteS, m.terrain[i]), Math.floor(sx), Math.floor(sy) - S * 0.6, TS, TS * 1.6);
            else {
              let mask = 0;
              if (m.block[i] === 2) { // съседни планини → слят масив
                const isM = (xx, yy) => world.inb(xx, yy) && m.block[yy * m.w + xx] === 2;
                mask = (isM(x, y - 1) ? 1 : 0) | (isM(x + 1, y) ? 2 : 0) | (isM(x, y + 1) ? 4 : 0) | (isM(x - 1, y) ? 8 : 0);
              }
              g.drawImage(G.decor(m.block[i], (x * 31 + y * 17) & 7, spriteS, m.terrain[i], mask), Math.floor(sx), Math.floor(sy) - S * 0.6, TS, TS * 1.6);
            }
          }
          const oid = m.objAt[i];
          if (oid >= 0) {
            const o = world.objById(oid);
            if (!o) continue;
            if (o.type === 'monster') this.drawMonster(o, sx, sy, S, T);
            else {
              // сияния под магически обекти
              if (o.type === 'artifact' || o.type === 'gate' || o.type === 'monolith' || o.type === 'magic_well' || o.type === 'shrine1' || o.type === 'shrine2' || o.type === 'shrine3') {
                const pulse = 0.25 + 0.15 * Math.sin(T * 3 + x);
                const col = o.type === 'artifact' ? '255,220,120' : '160,120,255';
                const gr = g.createRadialGradient(sx + S / 2, sy + S * 0.7, S * 0.05, sx + S / 2, sy + S * 0.7, S * 0.6);
                gr.addColorStop(0, 'rgba(' + col + ',' + pulse + ')'); gr.addColorStop(1, 'rgba(' + col + ',0)');
                g.fillStyle = gr; g.fillRect(sx - S * 0.2, sy, S * 1.4, S * 1.1);
              }
              if (o.type === 'campfire' || (o.type === 'town' && o.faction === 'inferno')) {
                const f = 0.3 + 0.15 * Math.sin(T * 9 + x * 3) + 0.1 * Math.sin(T * 13);
                const gr = g.createRadialGradient(sx + S / 2, sy + S * 0.6, S * 0.05, sx + S / 2, sy + S * 0.6, S * 0.9);
                gr.addColorStop(0, 'rgba(255,140,40,' + f + ')'); gr.addColorStop(1, 'rgba(255,100,20,0)');
                g.fillStyle = gr; g.fillRect(sx - S * 0.5, sy - S * 0.3, S * 2, S * 1.6);
              }
              const bob = o.type === 'boat' ? Math.sin(T * 2 + x) * S * 0.03 : 0;
              const scale = o.type === 'town' ? 1.45 : o.type === 'mine' || o.type === 'dwelling' || o.type === 'lighthouse' ? 1.15 : 1;
              g.drawImage(G.objectSprite(o, spriteS, world), Math.floor(sx - S * (scale - 1) / 2), Math.floor(sy) - S * 0.4 * scale - S * (scale - 1) * 0.72 + bob, TS * scale, TS * 1.4 * scale);
              if (o.guard) this.drawGuard(o, sx, sy, S, T);
              // анимирано знаме
              if (o.type === 'town' && o.owner >= 0) this.drawFlag(sx + S / 2, sy - S * 0.22, S * 1.3, world.players[o.owner].color, T + x);
              if (o.type === 'town' && S >= 30) {
                const t = world.towns[o.townId];
                g.font = '600 ' + Math.max(9, S * 0.2) + 'px "Segoe UI", Roboto, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
                const tw = g.measureText(t.name).width;
                g.fillStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.roundRect(sx + S / 2 - tw / 2 - S * 0.08, sy + S * 1.05, tw + S * 0.16, S * 0.26, S * 0.06); g.fill();
                g.fillStyle = t.owner >= 0 ? world.players[t.owner].color : '#ddd'; g.fillText(t.name, sx + S / 2, sy + S * 1.24);
              }
              if (o.type === 'town' && o.faction !== 'necropolis' && o.faction !== 'elements') this.spawnSmoke(x, y, T);
            }
          }
        }
        // герои на този ред
        for (const id in world.heroes) {
          const h = world.heroes[id];
          if ((h.z || 0) !== this.z) continue;
          let hx = h.x, hy = h.y;
          if (this.anim && this.anim.hero === h) { const a = this.anim; hx = a.fromX + (a.toX - a.fromX) * a.t; hy = a.fromY + (a.toY - a.fromY) * a.t; }
          if (Math.round(hy) !== y) continue;
          if (!fog[h.y * m.w + h.x] && !(this.anim && this.anim.hero === h)) continue;
          const [sx, sy] = this.toScreen(hx, hy);
          const col = world.players[h.owner].color;
          const bob = (this.anim && this.anim.hero === h) ? Math.abs(Math.sin(this.anim.t * Math.PI * 2)) * S * 0.06 : Math.sin(T * 2.5 + h.id) * S * 0.015;
          if (h === this.selected) {
            const pulse = 0.5 + 0.3 * Math.sin(T * 4);
            g.strokeStyle = 'rgba(255,216,112,' + pulse + ')'; g.lineWidth = Math.max(2, S * 0.05); g.beginPath(); g.ellipse(sx + S / 2, sy + S * 0.88, S * 0.42, S * 0.17, 0, 0, TAU); g.stroke();
            g.fillStyle = 'rgba(255,216,112,0.15)'; g.fill();
          }
          const moving = this.anim && this.anim.hero === h;
          const frame = moving ? 1 + Math.floor(((this.anim.t + (this.animStep || 0)) * 4) % 4) : 0;
          const hs = h.boat ? 1 : 1.25;
          g.drawImage(G.heroSprite(h, 160, col, frame), Math.floor(sx - S * (hs - 1) / 2), Math.floor(sy) - S * 0.4 * hs - S * (hs - 1) * 0.6 - (moving ? 0 : bob), TS * hs, TS * 1.4 * hs);
          if (h.inTown) { g.fillStyle = col; g.beginPath(); g.arc(sx + S * 0.86, sy + S * 0.14, S * 0.09, 0, TAU); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke(); }
        }
      }
      // --- частици: дим, атмосфера
      this.updateParticles(dt || 16, world, m, x0, x1, y0, y1, fog);
      // --- мъгла
      g.fillStyle = this.z ? '#0a0608' : '#05060a';
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (fog[y * m.w + x]) continue;
        const [sx, sy] = this.toScreen(x, y);
        g.fillRect(Math.floor(sx), Math.floor(sy), TS, TS);
      }
      // мек ръб на мъглата с двоен градиент
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * m.w + x; if (!fog[i]) continue;
        for (let d = 0; d < 4; d++) {
          const nx = x + MK.DIRS[d][0], ny = y + MK.DIRS[d][1];
          if (!world.inb(nx, ny) || fog[ny * m.w + nx]) continue;
          const [sx, sy] = this.toScreen(x, y);
          const gr = MK.DIRS[d][0] ? g.createLinearGradient(sx + (MK.DIRS[d][0] > 0 ? S : 0), 0, sx + (MK.DIRS[d][0] > 0 ? S * 0.3 : S * 0.7), 0) : g.createLinearGradient(0, sy + (MK.DIRS[d][1] > 0 ? S : 0), 0, sy + (MK.DIRS[d][1] > 0 ? S * 0.3 : S * 0.7));
          gr.addColorStop(0, 'rgba(5,6,10,0.85)'); gr.addColorStop(1, 'rgba(5,6,10,0)');
          g.fillStyle = gr; g.fillRect(sx, sy, TS, TS);
        }
      }
      // --- път на героя
      if (this.pathPreview && this.selected && (this.selected.z || 0) === this.z) {
        const p = this.pathPreview;
        const mv = this.selected.movement;
        g.lineCap = 'round';
        // линия
        g.beginPath(); const [hx0, hy0] = this.toScreen(this.selected.x, this.selected.y); g.moveTo(hx0 + S / 2, hy0 + S / 2);
        p.path.forEach((st) => { const [sx, sy] = this.toScreen(st.x, st.y); g.lineTo(sx + S / 2, sy + S / 2); });
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = S * 0.12; g.stroke();
        g.setLineDash([S * 0.25, S * 0.2]); g.lineDashOffset = -T * S * 0.8;
        g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = S * 0.06; g.stroke(); g.setLineDash([]);
        p.path.forEach((st, k) => {
          const [sx, sy] = this.toScreen(st.x, st.y);
          const ok = st.cost <= mv;
          const last = k === p.path.length - 1;
          g.fillStyle = ok ? '#8cf08c' : '#ff7070';
          if (last) { g.strokeStyle = g.fillStyle; g.lineWidth = Math.max(2, S * 0.08); g.beginPath(); g.arc(sx + S / 2, sy + S / 2, S * 0.3 + Math.sin(T * 5) * S * 0.03, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(sx + S * 0.5, sy + S * 0.3); g.lineTo(sx + S * 0.5, sy + S * 0.7); g.moveTo(sx + S * 0.3, sy + S * 0.5); g.lineTo(sx + S * 0.7, sy + S * 0.5); g.stroke(); }
          else { g.beginPath(); g.arc(sx + S / 2, sy + S / 2, S * 0.08, 0, TAU); g.fill(); }
        });
        if (p.path.length) { const st = p.path[p.path.length - 1]; const days = Math.ceil(p.total / Math.max(1, this.selected.maxMovement)); const [sx, sy] = this.toScreen(st.x, st.y); if (p.total > mv) { g.font = 'bold ' + Math.max(10, S * 0.26) + 'px sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(0,0,0,0.6)'; g.beginPath(); g.roundRect(sx + S * 0.2, sy - S * 0.36, S * 0.6, S * 0.3, S * 0.06); g.fill(); g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(days + ' д.', sx + S / 2, sy - S * 0.2); } }
      }
      if (this.selected && (this.selected.z || 0) === this.z) this.drawTargetIcon(S, T);
      // --- светлина: топла винетка (повърхност) или студена (подземие)
      const vg = g.createRadialGradient(this.vw * 0.5, this.vh * 0.45, Math.min(this.vw, this.vh) * 0.35, this.vw * 0.5, this.vh * 0.5, Math.max(this.vw, this.vh) * 0.8);
      vg.addColorStop(0, this.z ? 'rgba(20,10,30,0)' : 'rgba(255,240,200,0.04)'); vg.addColorStop(1, this.z ? 'rgba(5,0,10,0.55)' : 'rgba(10,8,20,0.35)');
      g.fillStyle = vg; g.fillRect(0, 0, this.vw, this.vh);
    }
    drawFlag(x, y, S, color, t) {
      const g = this.ctx;
      const wave = Math.sin(t * 5) * S * 0.03;
      g.fillStyle = '#3a2a1a'; g.fillRect(x - S * 0.012, y - S * 0.3, S * 0.024, S * 0.3);
      g.fillStyle = color;
      g.beginPath(); g.moveTo(x, y - S * 0.3); g.quadraticCurveTo(x + S * 0.1, y - S * 0.31 + wave, x + S * 0.2, y - S * 0.27 + wave * 1.5); g.quadraticCurveTo(x + S * 0.1, y - S * 0.2 + wave * 0.5, x, y - S * 0.17); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.moveTo(x, y - S * 0.3); g.quadraticCurveTo(x + S * 0.1, y - S * 0.31 + wave, x + S * 0.2, y - S * 0.27 + wave * 1.5); g.lineTo(x + S * 0.1, y - S * 0.26 + wave); g.fill();
    }
    drawMonster(o, sx, sy, S, T) {
      const g = this.ctx;
      const c = D.creatureOf(o.creature);
      const TS = Math.ceil(S) + 1;
      const bob = Math.sin(T * 2 + o.id) * S * 0.015;
      const spriteS = S > 60 ? 128 : 96;
      g.drawImage(G.creatureSprite(c, spriteS, false), Math.floor(sx), Math.floor(sy) - S * 0.4 - bob, TS, TS * 1.4);
      if (S >= 26) {
        const txt = D.countRange(o.count).text;
        g.font = 'bold ' + Math.max(9, S * 0.2) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        const w = g.measureText(txt).width + S * 0.18;
        g.fillStyle = 'rgba(20,10,10,0.8)'; g.beginPath(); g.roundRect(sx + S - w - S * 0.02, sy + S * 0.74, w, S * 0.26, S * 0.05); g.fill();
        g.strokeStyle = 'rgba(255,216,112,0.6)'; g.lineWidth = 1; g.stroke();
        g.fillStyle = '#ffd870'; g.fillText(txt, sx + S - w / 2 - S * 0.02, sy + S * 0.87);
      }
    }
    /* Пазач, закачен за обект: по-малък спрайт пред и вдясно от обекта, с брояч */
    /* Икона на действието върху целевата плочка (заместител на курсора при докосване) */
    drawTargetIcon(S, T) {
      const ti = this.targetIcon; if (!ti || !ti.icon) return;
      const g = this.ctx, [sx, sy] = this.toScreen(ti.x, ti.y);
      const bob = Math.sin(T * 4) * S * 0.04, cx = sx + S / 2, cy = sy - S * 0.85 + bob, R = S * 0.34;
      g.save();
      g.fillStyle = 'rgba(10,8,14,0.82)'; g.strokeStyle = ti.kind === 'attack' || ti.kind === 'guard' ? 'rgba(255,110,90,0.95)' : 'rgba(255,216,112,0.9)'; g.lineWidth = Math.max(1.5, S * 0.04);
      g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(cx - R * 0.3, cy + R * 0.9); g.lineTo(cx, cy + R * 1.35); g.lineTo(cx + R * 0.3, cy + R * 0.9); g.fillStyle = g.strokeStyle; g.fill();
      g.font = Math.round(R * 1.2) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(ti.icon, cx, cy + R * 0.08);
      g.restore();
    }
    drawGuard(o, sx, sy, S, T) {
      const g = this.ctx, gd = o.guard;
      const c = D.creatureOf(gd.creature); if (!c) return;
      const k = 0.72, GS = S * k, bob = Math.sin(T * 2 + o.id) * S * 0.015;
      const gx = sx + S * 0.45, gy = sy + S * 0.15 - bob;
      g.drawImage(G.creatureSprite(c, S > 60 ? 128 : 96, false), Math.floor(gx), Math.floor(gy) - GS * 0.4, Math.ceil(GS) + 1, (Math.ceil(GS) + 1) * 1.4);
      if (S >= 26) {
        const txt = D.countRange(gd.count).text;
        g.font = 'bold ' + Math.max(8, S * 0.18) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        const w = g.measureText(txt).width + S * 0.16;
        g.fillStyle = 'rgba(60,10,10,0.85)'; g.beginPath(); g.roundRect(sx + S - w + S * 0.12, sy + S * 0.8, w, S * 0.24, S * 0.05); g.fill();
        g.strokeStyle = 'rgba(255,120,90,0.7)'; g.lineWidth = 1; g.stroke();
        g.fillStyle = '#ffb090'; g.fillText(txt, sx + S - w / 2 + S * 0.12, sy + S * 0.92);
      }
    }
    // ---------------------------------------------------------------- частици
    spawnSmoke(x, y, T) {
      if (this.smoke.length > 120) return;
      if (Math.random() > 0.05) return;
      this.smoke.push({ x: x + 0.5 + (Math.random() - 0.5) * 0.3, y: y + 0.1, z: this.z, vx: (Math.random() - 0.3) * 0.05, vy: -0.12 - Math.random() * 0.06, r: 0.06, life: 1 });
    }
    updateParticles(dt, world, m, x0, x1, y0, y1, fog) {
      const g = this.ctx, S = this.tileSize();
      const k = dt / 1000;
      // дим
      this.smoke = this.smoke.filter((p) => p.life > 0 && p.z === this.z);
      this.smoke.forEach((p) => { p.x += p.vx * k; p.y += p.vy * k; p.r += 0.08 * k; p.life -= 0.35 * k; const [sx, sy] = this.toScreen(p.x, p.y); g.fillStyle = 'rgba(220,220,230,' + (0.35 * p.life) + ')'; g.beginPath(); g.arc(sx, sy, p.r * S, 0, TAU); g.fill(); });
      // атмосфера според терена под камерата
      const cxT = Math.floor(this.cam.x), cyT = Math.floor(this.cam.y);
      const t = world.inb(cxT, cyT) ? m.terrain[cyT * m.w + cxT] : 1;
      const kind = this.z ? 'dust' : t === 4 ? 'snow' : t === 7 ? 'ember' : t === 5 ? 'mist' : t === 1 || t === 2 ? 'leaf' : t === 3 || t === 9 ? 'dust' : t === 0 ? 'spray' : 'leaf';
      const want = kind === 'snow' ? 90 : kind === 'ember' ? 50 : kind === 'mist' ? 14 : kind === 'leaf' ? 22 : kind === 'spray' ? 20 : 25;
      while (this.particles.length < want) this.particles.push(this.newParticle(kind, true));
      this.particles = this.particles.filter((p) => p.life > 0);
      this.particles.forEach((p) => {
        p.life -= k * p.decay; p.x += p.vx * k; p.y += p.vy * k; p.phase += k * 2;
        const px = p.x * this.vw, py = p.y * this.vh;
        if (p.kind === 'snow') { g.fillStyle = 'rgba(255,255,255,' + Math.min(0.9, p.life) * 0.8 + ')'; g.beginPath(); g.arc(px + Math.sin(p.phase) * 6 * this.dpr, py, p.size * this.dpr, 0, TAU); g.fill(); }
        else if (p.kind === 'ember') { g.fillStyle = 'rgba(255,' + Math.floor(120 + 100 * p.life) + ',40,' + Math.min(1, p.life) * 0.9 + ')'; g.beginPath(); g.arc(px + Math.sin(p.phase * 2) * 4 * this.dpr, py, p.size * this.dpr, 0, TAU); g.fill(); }
        else if (p.kind === 'mist') { const gr = g.createRadialGradient(px, py, 0, px, py, p.size * this.dpr * 12); gr.addColorStop(0, 'rgba(200,220,210,' + 0.12 * Math.min(1, p.life) + ')'); gr.addColorStop(1, 'rgba(200,220,210,0)'); g.fillStyle = gr; g.fillRect(px - p.size * 12 * this.dpr, py - p.size * 12 * this.dpr, p.size * 24 * this.dpr, p.size * 24 * this.dpr); }
        else if (p.kind === 'leaf') { g.save(); g.translate(px, py); g.rotate(p.phase); g.fillStyle = 'rgba(' + (p.hue ? '190,150,60' : '120,170,70') + ',' + Math.min(1, p.life) * 0.75 + ')'; g.beginPath(); g.ellipse(0, 0, p.size * 1.6 * this.dpr, p.size * 0.8 * this.dpr, 0, 0, TAU); g.fill(); g.restore(); }
        else if (p.kind === 'dust') { g.fillStyle = 'rgba(230,210,180,' + Math.min(1, p.life) * 0.35 + ')'; g.beginPath(); g.arc(px, py, p.size * this.dpr, 0, TAU); g.fill(); }
        else if (p.kind === 'spray') { g.fillStyle = 'rgba(220,240,255,' + Math.min(1, p.life) * 0.5 + ')'; g.beginPath(); g.arc(px, py, p.size * this.dpr, 0, TAU); g.fill(); }
      });
      if (this.particles.length < want) this.particles.push(this.newParticle(kind, false));
    }
    newParticle(kind, anywhere) {
      const r = Math.random;
      const base = { kind, x: r(), y: anywhere ? r() : -0.05, phase: r() * 6, life: 1 + r() * 2, decay: 0.25 + r() * 0.3 };
      if (kind === 'snow') return Object.assign(base, { vx: 0.02 + r() * 0.03, vy: 0.08 + r() * 0.1, size: 1 + r() * 2.2, decay: 0.12 });
      if (kind === 'ember') return Object.assign(base, { y: anywhere ? r() : 1.05, vx: (r() - 0.5) * 0.05, vy: -(0.06 + r() * 0.1), size: 1 + r() * 1.8, decay: 0.45 });
      if (kind === 'mist') return Object.assign(base, { y: r(), vx: 0.02 + r() * 0.02, vy: (r() - 0.5) * 0.01, size: 6 + r() * 6, decay: 0.15, life: 2 + r() * 3 });
      if (kind === 'leaf') return Object.assign(base, { vx: 0.05 + r() * 0.06, vy: 0.05 + r() * 0.06, size: 1.5 + r() * 1.5, hue: r() > 0.5, decay: 0.2 });
      if (kind === 'spray') return Object.assign(base, { y: r(), vx: 0.03 + r() * 0.03, vy: -0.01 + r() * 0.02, size: 0.8 + r() * 1.2, decay: 0.6 });
      return Object.assign(base, { y: r(), vx: 0.04 + r() * 0.05, vy: (r() - 0.5) * 0.02, size: 1 + r() * 1.5, decay: 0.3 });
    }
    // ---------------------------------------------------------------- миникарта
    drawMinimap(canvas, world, viewer) {
      const g = canvas.getContext('2d');
      const m = world.map; const W = canvas.width, H = canvas.height;
      const sx = W / m.w, sy = H / m.h;
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      const L = world.lv(this.z); const fogL = viewer.fog[this.z] || viewer.fog[0];
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        const i = y * m.w + x; if (!fogL[i]) continue;
        const T = D.TERRAIN[L.terrain[i]];
        g.fillStyle = L.block[i] ? MK.shade(T.col, 0.5) : T.col;
        g.fillRect(x * sx, y * sy, sx + 0.5, sy + 0.5);
      }
      m.objects.forEach((o) => {
        if ((o.z || 0) !== this.z || !fogL[o.y * m.w + o.x]) return;
        if (o.type === 'town') { g.fillStyle = o.owner >= 0 ? world.players[o.owner].color : '#ccc'; g.fillRect(o.x * sx - 1.5, o.y * sy - 1.5, sx + 3, sy + 3); g.strokeStyle = '#000'; g.strokeRect(o.x * sx - 1.5, o.y * sy - 1.5, sx + 3, sy + 3); }
        else if (o.type === 'mine' && o.owner >= 0) { g.fillStyle = world.players[o.owner].color; g.fillRect(o.x * sx, o.y * sy, sx + 1, sy + 1); }
      });
      for (const id in world.heroes) { const h = world.heroes[id]; if ((h.z || 0) !== this.z || !fogL[h.y * m.w + h.x]) continue; g.fillStyle = world.players[h.owner].color; g.beginPath(); g.arc(h.x * sx + sx / 2, h.y * sy + sy / 2, Math.max(2, sx), 0, TAU); g.fill(); }
      const S = this.tileSize(); const hw = this.vw / 2 / S, hh = this.vh / 2 / S;
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1; g.strokeRect((this.cam.x - hw) * sx, (this.cam.y - hh) * sy, hw * 2 * sx, hh * 2 * sy);
    }
  }
  MK.MapRenderer = MapRenderer;
})();
