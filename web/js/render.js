/* Рендер на приключенската карта: камера, плочки, пътища, декори, обекти, герои, мъгла, път на героя */
(function () {
  'use strict';
  const MK = (window.MK = window.MK || {});
  const D = MK.data;
  const G = MK.Gfx;

  class MapRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.cam = { x: 10, y: 10, zoom: 48 }; // центърът в плочки; zoom = px за плочка
      this.z = 0;                             // текущо ниво
      this.minZoom = 22; this.maxZoom = 96;
      this.pathPreview = null;   // {path:[{x,y,cost}], reachableIdx}
      this.selected = null;      // герой
      this.anim = null;          // {hero, fromX, fromY, toX, toY, t}
      this.time = 0;
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
    // плочка -> екран (горен ляв ъгъл)
    toScreen(tx, ty) { const S = this.tileSize(); return [this.vw / 2 + (tx - this.cam.x) * S, this.vh / 2 + (ty - this.cam.y) * S]; }
    toTile(sx, sy) { const S = this.tileSize(); return [Math.floor(this.cam.x + (sx * this.dpr - this.vw / 2) / S), Math.floor(this.cam.y + (sy * this.dpr - this.vh / 2) / S)]; }
    center(x, y) { this.cam.x = x + 0.5; this.cam.y = y + 0.5; this.clamp(); }
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
      // задържаме плочката под пръста
      const nx = this.cam.x + (sx * this.dpr - this.vw / 2) / S, ny = this.cam.y + (sy * this.dpr - this.vh / 2) / S;
      this.cam.x += (tx + 0.5) - nx; this.cam.y += (ty + 0.5) - ny;
      this.clamp();
      return before !== this.cam.zoom;
    }

    draw(world, viewer, dt) {
      this.world = world;
      this.time += dt || 16;
      const g = this.ctx, S = this.tileSize();
      const m = Object.assign({ w: world.map.w, h: world.map.h }, world.lv(this.z));
      g.fillStyle = this.z ? '#0a0608' : '#05060a'; g.fillRect(0, 0, this.vw, this.vh);
      const x0 = Math.max(0, Math.floor(this.cam.x - this.vw / 2 / S) - 1), x1 = Math.min(m.w - 1, Math.ceil(this.cam.x + this.vw / 2 / S) + 1);
      const y0 = Math.max(0, Math.floor(this.cam.y - this.vh / 2 / S) - 1), y1 = Math.min(m.h - 1, Math.ceil(this.cam.y + this.vh / 2 / S) + 1);
      const fog = viewer.fog[this.z] || viewer.fog[0];
      const TS = Math.ceil(S) + 1;
      g.imageSmoothingEnabled = S < 40;
      // терен
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * m.w + x;
        if (!fog[i]) continue;
        const [sx, sy] = this.toScreen(x, y);
        g.drawImage(G.terrainTile(m.terrain[i], (x * 7 + y * 13) & 3, 48), Math.floor(sx), Math.floor(sy), TS, TS);
      }
      // пътища
      g.strokeStyle = '#b9a27a'; g.lineWidth = S * 0.28; g.lineCap = 'round';
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * m.w + x;
        if (!m.road[i] || !fog[i]) continue;
        const [sx, sy] = this.toScreen(x, y);
        const cx = sx + S / 2, cy = sy + S / 2;
        let any = false;
        for (let d = 0; d < 8; d++) {
          const nx = x + MK.DIRS[d][0], ny = y + MK.DIRS[d][1];
          if (!world.inb(nx, ny) || !m.road[ny * m.w + nx]) continue;
          any = true; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + MK.DIRS[d][0] * S / 2, cy + MK.DIRS[d][1] * S / 2); g.stroke();
        }
        if (!any) { g.fillStyle = '#b9a27a'; g.beginPath(); g.arc(cx, cy, S * 0.14, 0, Math.PI * 2); g.fill(); }
      }
      // мрежа при голям мащаб
      if (S >= 60) { g.strokeStyle = 'rgba(0,0,0,0.08)'; g.lineWidth = 1; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { if (!fog[y * m.w + x]) continue; const [sx, sy] = this.toScreen(x, y); g.strokeRect(Math.floor(sx) + 0.5, Math.floor(sy) + 0.5, TS - 1, TS - 1); } }
      // достижими плочки
      if (this.reach && this.selected) {
        g.fillStyle = 'rgba(255,255,255,0.10)';
        this.reach.forEach((c, i) => { const x = i % m.w, y = Math.floor(i / m.w); if (x < x0 || x > x1 || y < y0 || y > y1) return; const [sx, sy] = this.toScreen(x, y); g.fillRect(sx, sy, TS, TS); });
      }
      // декори + обекти + герои (по редове, за да се застъпват правилно)
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = y * m.w + x;
          if (!fog[i]) continue;
          const [sx, sy] = this.toScreen(x, y);
          if (m.block[i]) { if (this.z && m.block[i] === 2) g.drawImage(G.decor(5, (x * 31 + y * 17) & 7, 64, m.terrain[i]), Math.floor(sx), Math.floor(sy), TS, TS); else g.drawImage(G.decor(m.block[i], (x * 31 + y * 17) & 7, 64, m.terrain[i]), Math.floor(sx), Math.floor(sy) - S * 0.2, TS, TS * 1.2); }
          const oid = m.objAt[i];
          if (oid >= 0) {
            const o = world.objById(oid);
            if (o) {
              if (o.type === 'monster') this.drawMonster(o, sx, sy, S);
              else g.drawImage(G.objectSprite(o, 64, world), Math.floor(sx), Math.floor(sy) - S * 0.25, TS, TS * 1.25);
              if (o.type === 'town' && S >= 30) {
                const t = world.towns[o.townId];
                g.font = 'bold ' + Math.max(9, S * 0.22) + 'px sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(t.name, sx + S / 2 + 1, sy + S * 1.18 + 1); g.fillStyle = '#fff'; g.fillText(t.name, sx + S / 2, sy + S * 1.18);
              }
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
          if (h === this.selected) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.ellipse(sx + S / 2, sy + S * 0.86, S * 0.4, S * 0.16, 0, 0, Math.PI * 2); g.stroke(); }
          g.drawImage(G.heroSprite(h, 64, col), Math.floor(sx), Math.floor(sy) - S * 0.2, TS, TS * 1.2);
          if (h.inTown) { g.fillStyle = col; g.beginPath(); g.arc(sx + S * 0.85, sy + S * 0.15, S * 0.1, 0, Math.PI * 2); g.fill(); }
        }
      }
      // мъгла: неразкритите плочки
      g.fillStyle = '#05060a';
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (fog[y * m.w + x]) continue;
        const [sx, sy] = this.toScreen(x, y);
        g.fillRect(Math.floor(sx), Math.floor(sy), TS, TS);
      }
      // мек ръб на мъглата
      g.fillStyle = 'rgba(5,6,10,0.45)';
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * m.w + x; if (!fog[i]) continue;
        let edge = false;
        for (let d = 0; d < 4 && !edge; d++) { const nx = x + MK.DIRS[d][0], ny = y + MK.DIRS[d][1]; if (world.inb(nx, ny) && !fog[ny * m.w + nx]) edge = true; }
        if (edge) { const [sx, sy] = this.toScreen(x, y); g.fillRect(Math.floor(sx), Math.floor(sy), TS, TS); }
      }
      // път на героя
      if (this.pathPreview && this.selected) {
        const p = this.pathPreview;
        const mv = this.selected.movement;
        p.path.forEach((st, k) => {
          const [sx, sy] = this.toScreen(st.x, st.y);
          const ok = st.cost <= mv;
          const last = k === p.path.length - 1;
          g.fillStyle = ok ? 'rgba(120,255,120,0.9)' : 'rgba(255,90,90,0.85)';
          if (last) { g.strokeStyle = g.fillStyle; g.lineWidth = Math.max(2, S * 0.08); g.beginPath(); g.moveTo(sx + S * 0.5, sy + S * 0.15); g.lineTo(sx + S * 0.5, sy + S * 0.85); g.moveTo(sx + S * 0.15, sy + S * 0.5); g.lineTo(sx + S * 0.85, sy + S * 0.5); g.stroke(); }
          else { g.beginPath(); g.arc(sx + S / 2, sy + S / 2, S * 0.1, 0, Math.PI * 2); g.fill(); }
        });
        // брой дни
        if (p.path.length) { const st = p.path[p.path.length - 1]; const days = Math.ceil(p.total / Math.max(1, this.selected.maxMovement)); const [sx, sy] = this.toScreen(st.x, st.y); if (p.total > mv) { g.font = 'bold ' + Math.max(10, S * 0.28) + 'px sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(days + ' д.', sx + S / 2, sy - S * 0.1); } }
      }
    }
    drawMonster(o, sx, sy, S) {
      const g = this.ctx;
      const c = D.creatureOf(o.creature);
      const TS = Math.ceil(S) + 1;
      g.drawImage(G.creatureSprite(c, 64, false), Math.floor(sx), Math.floor(sy) - S * 0.15, TS, TS * 1.1);
      if (S >= 26) {
        const txt = String(o.count);
        g.font = 'bold ' + Math.max(9, S * 0.24) + 'px sans-serif'; g.textAlign = 'center';
        const w = g.measureText(txt).width + S * 0.16;
        g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(sx + S - w - S * 0.02, sy + S * 0.72, w, S * 0.28);
        g.fillStyle = '#ffd870'; g.fillText(txt, sx + S - w / 2 - S * 0.02, sy + S * 0.94);
      }
    }
    // Миникарта в даден канвас
    drawMinimap(canvas, world, viewer) {
      const g = canvas.getContext('2d');
      const m = world.map; const W = canvas.width, H = canvas.height;
      const sx = W / m.w, sy = H / m.h;
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      const L = world.lv(this.z); const fogL = viewer.fog[this.z] || viewer.fog[0];
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        const i = y * m.w + x; if (!fogL[i]) continue;
        g.fillStyle = L.block[i] ? MK.shade(D.TERRAIN[L.terrain[i]].col, 0.55) : D.TERRAIN[L.terrain[i]].col;
        g.fillRect(x * sx, y * sy, sx + 0.5, sy + 0.5);
      }
      m.objects.forEach((o) => {
        if ((o.z || 0) !== this.z || !fogL[o.y * m.w + o.x]) return;
        if (o.type === 'town') { g.fillStyle = o.owner >= 0 ? world.players[o.owner].color : '#ccc'; g.fillRect(o.x * sx - 1.5, o.y * sy - 1.5, sx + 3, sy + 3); }
        else if (o.type === 'mine' && o.owner >= 0) { g.fillStyle = world.players[o.owner].color; g.fillRect(o.x * sx, o.y * sy, sx + 1, sy + 1); }
      });
      for (const id in world.heroes) { const h = world.heroes[id]; if ((h.z || 0) !== this.z || !fogL[h.y * m.w + h.x]) continue; g.fillStyle = world.players[h.owner].color; g.fillRect(h.x * sx - 1, h.y * sy - 1, sx + 2, sy + 2); }
      // рамка на екрана
      const S = this.tileSize(); const hw = this.vw / 2 / S, hh = this.vh / 2 / S;
      g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1; g.strokeRect((this.cam.x - hw) * sx, (this.cam.y - hh) * sy, hw * 2 * sx, hh * 2 * sy);
    }
  }
  MK.MapRenderer = MapRenderer;
})();
