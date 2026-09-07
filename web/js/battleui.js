/* Екран на битката: хексове, двухексови същества, тактика, обсада (ров, стени, порта, кули),
   анимации, управление с докосване, магьосническа книга, предаване, битки между двама човеци */
(function () {
  'use strict';
  const MK = (window.MK = window.MK || {});
  const D = MK.data;
  const G = MK.Gfx;
  const Hex = MK.Hex;
  const UI = MK.UI;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const EFFECT_ICON = { haste: '⏩', slow: '🐢', bless: '✨', curse: '☠', shield: '🛡', stoneskin: '🪨', bloodlust: '🩸', blind: '🙈', weakness: '⬇', precision: '🎯', fortune: '🍀', misfortune: '💀', disrupt: '💢', airshield: '🌀', mirth: '😊', sorrow: '😢', prayer: '🙏', slayer: '🗡', counterstrike: '↩', antimagic: '🔮', bound: '🌿' };

  class BattleUI {
    /* humanSides: масив от страни, които човек управлява ([] = автоматично, [0,1] = двама човеци) */
    constructor(battle, humanSides, game) {
      this.b = battle; this.humans = humanSides; this.game = game;
      this.canvas = document.getElementById('battle');
      this.ctx = this.canvas.getContext('2d');
      this.bar = document.getElementById('battlebar');
      this.auto = humanSides.length === 0;
      this.speed = 1;
      this.floats = []; this.flash = {}; this.animPos = {}; this.lunge = {}; this.shake = {}; this.fading = {}; this.particles = []; this.projectiles = []; this.rings = [];
      this.state = 'anim';
      this.castSpell = null;
      this.logLines = [];
      this.running = true;
      this.canvas.hidden = false; this.bar.hidden = false;
      const hud = document.getElementById('hud'); this.hudWasVisible = hud && !hud.hidden; if (hud) hud.hidden = true;
      this.renderBar();
      this.resize();
      this.onResize = () => this.resize();
      window.addEventListener('resize', this.onResize);
      if (window.ResizeObserver) { this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(this.bar); }
      this.onPointer = (e) => this.tap(e);
      this.canvas.addEventListener('pointerup', this.onPointer);
      this.raf = null;
      this.loopDraw();
    }
    isHuman(side) { return this.humans.includes(side); }
    get human() { return this.b.current ? this.b.current.side : this.humans[0]; }
    resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.dpr = dpr;
      this.canvas.width = Math.floor(this.canvas.clientWidth * dpr);
      this.canvas.height = Math.floor(this.canvas.clientHeight * dpr);
      const barH = (this.bar.offsetHeight || 60) * dpr;
      // отгоре остава лента за рисувания хоризонт (небе и планини)
      const band = Math.floor(this.canvas.height * 0.15);
      const availW = this.canvas.width - 20 * dpr, availH = this.canvas.height - barH - 30 * dpr - band;
      this.r = Math.max(4, Math.min(availW / (Math.sqrt(3) * (Hex.W + 0.5)), availH / (1.5 * (Hex.H - 1) + 2)));
      this.ox = (this.canvas.width - Math.sqrt(3) * this.r * (Hex.W + 0.5)) / 2 + Math.sqrt(3) * this.r / 2;
      this.oy = 26 * dpr + band + this.r;
      this.band = band; this._bg = null;
      this.barH = barH;
    }
    hexCenter(x, y) { const r = this.r; return [this.ox + Math.sqrt(3) * r * (x + (y & 1) * 0.5), this.oy + 1.5 * r * y]; }
    stackCenter(s) { const hs = this.b.hexes(s); let x = 0, y = 0; hs.forEach(([hx, hy]) => { const [cx, cy] = this.hexCenter(hx, hy); x += cx; y += cy; }); return [x / hs.length, y / hs.length]; }
    pixelToHex(px, py) {
      let best = null, bd = Infinity;
      for (let y = 0; y < Hex.H; y++) for (let x = 0; x < Hex.W; x++) { const [cx, cy] = this.hexCenter(x, y); const d = (cx - px) ** 2 + (cy - py) ** 2; if (d < bd) { bd = d; best = [x, y]; } }
      return bd < this.r * this.r ? best : null;
    }
    hexPath(g, cx, cy, r) { g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a); if (i) g.lineTo(px, py); else g.moveTo(px, py); } g.closePath(); }
    sideColor(side) {
      const sd = this.b.sides[side];
      if (this.game && sd.owner >= 0 && this.game.world.players[sd.owner]) return this.game.world.players[sd.owner].color;
      return side === 0 ? '#d23c3c' : '#7a7a8a';
    }

    // ------------------------------------------------------------ рисуване
    loopDraw() { if (!this.running) return; this.draw(); this.raf = requestAnimationFrame(() => this.loopDraw()); }
    backdrop() {
      if (this._bg && this._bg.width === this.canvas.width && this._bg.height === this.canvas.height) return this._bg;
      const W = this.canvas.width, H = this.canvas.height, r = this.r, t = this.b.terrain;
      const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
      const horizon = this.oy - r * 1.35;
      const bgImg = MK.Img.get('battle/bg_' + (D.TERRAIN[t === 0 ? 3 : t] || D.TERRAIN[1]).key);
      if (bgImg) {
        // Рисуван фон: хоризонтът на картината (~42% от височината) се подравнява с хоризонта на полето
        const k = Math.max(W / bgImg.width, (H - horizon) / (bgImg.height * 0.58), horizon / (bgImg.height * 0.42));
        const dw = bgImg.width * k, dh = bgImg.height * k;
        g.drawImage(bgImg, (W - dw) / 2, horizon - dh * 0.42, dw, dh);
        const light = g.createLinearGradient(0, horizon, 0, H); light.addColorStop(0, 'rgba(0,0,0,0)'); light.addColorStop(1, 'rgba(0,0,0,0.35)'); g.fillStyle = light; g.fillRect(0, horizon, W, H - horizon);
        this._bg = c; return c;
      }
      g.fillStyle = this.groundPattern(); g.fillRect(0, 0, W, H);
      // небе по терен
      const SKY = { 7: ['#1a0608', '#7a1a12', '#ff7a2a'], 8: ['#050308', '#1e1230', '#4a3a70'], 4: ['#6f9fd8', '#c9def2', '#f6fbff'], 3: ['#5a8ac8', '#e8c890', '#fff0c8'], 9: ['#3a2e58', '#8a6a9a', '#e0b8b0'], 6: ['#586a86', '#a8b4c0', '#e8e0d0'], 5: ['#4a6a70', '#8aa89a', '#d8e8c8'] };
      const sk = SKY[t] || ['#3f7fd0', '#9dc8f0', '#f4f0d8'];
      const sky = g.createLinearGradient(0, 0, 0, horizon); sky.addColorStop(0, sk[0]); sky.addColorStop(0.65, sk[1]); sky.addColorStop(1, sk[2]);
      g.fillStyle = sky; g.fillRect(0, 0, W, horizon);
      if (t === 7) { g.fillStyle = g.createRadialGradient(W * 0.5, horizon, 0, W * 0.5, horizon, W * 0.5); g.fillStyle.addColorStop(0, 'rgba(255,120,40,0.55)'); g.fillStyle.addColorStop(1, 'rgba(255,120,40,0)'); g.fillRect(0, 0, W, horizon); }
      // далечни планини (два реда, задният по-блед) и гори по хоризонта
      const mS = r * 5.2;
      for (let row = 0; row < 2; row++) {
        const scale = row ? 1 : 0.75, alpha = row ? 1 : 0.55;
        g.globalAlpha = alpha;
        for (let x = -mS * 0.5 + row * mS * 0.5; x < W + mS; x += mS * scale * 0.72) {
          const v = (Math.floor(x / 37) * 7 + row * 3) & 7;
          g.drawImage(G.decor(2, v, 96, t, 10), x, horizon + r * 0.2 - mS * scale * 1.6, mS * scale, mS * scale * 1.6);
        }
      }
      g.globalAlpha = 1;
      if (t !== 8 && t !== 7 && t !== 3) { const tS = r * 2.2; for (let x = -tS * 0.3; x < W + tS; x += tS * 0.7) g.drawImage(G.decor(t === 7 ? 4 : 1, (Math.floor(x / 23) * 5) & 7, 96, t), x, horizon + r * 0.35 - tS * 1.6, tS, tS * 1.6); }
      // мъгла на хоризонта и потъмняване към ръбовете
      const haze = g.createLinearGradient(0, horizon - r * 1.2, 0, horizon + r * 1.2); haze.addColorStop(0, 'rgba(255,255,255,0)'); haze.addColorStop(0.5, 'rgba(230,236,240,0.25)'); haze.addColorStop(1, 'rgba(230,236,240,0)'); g.fillStyle = haze; g.fillRect(0, horizon - r * 1.2, W, r * 2.4);
      const vig = g.createRadialGradient(W / 2, H * 0.55, H * 0.2, W / 2, H * 0.55, H * 0.85); vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.4)'); g.fillStyle = vig; g.fillRect(0, 0, W, H);
      const light = g.createLinearGradient(0, horizon, 0, H); light.addColorStop(0, 'rgba(255,240,200,0.14)'); light.addColorStop(0.5, 'rgba(0,0,0,0)'); light.addColorStop(1, 'rgba(0,0,0,0.3)'); g.fillStyle = light; g.fillRect(0, horizon, W, H - horizon);
      this._bg = c; return c;
    }
    groundPattern() {
      if (this._pat && this._patT === this.b.terrain) return this._pat;
      const tile = G.terrainAtlas(this.b.terrain === 0 ? 3 : this.b.terrain, 96);
      this._pat = this.ctx.createPattern(tile, 'repeat'); this._patT = this.b.terrain;
      try { if (this._pat.setTransform) this._pat.setTransform(new DOMMatrix().scale(Math.max(0.5, this.r / 30))); } catch (e) { /* стар браузър */ }
      return this._pat;
    }
    draw() {
      const g = this.ctx, b = this.b, r = this.r;
      const W = this.canvas.width, H = this.canvas.height;
      const now = performance.now(), T = now / 1000;
      const Tcol = D.TERRAIN[b.terrain] || D.TERRAIN[1];
      // рисуван фон: земя, небе с хоризонт, планини и гори в далечината (кеширан)
      g.drawImage(this.backdrop(), 0, 0);
      const cur = b.current;
      const input = this.state === 'input' && cur;
      const tactics = this.state === 'tactics';
      const reach = input ? this.reach : null;
      const gateI = Hex.idx(10, 5);
      for (let y = 0; y < Hex.H; y++) for (let x = 0; x < Hex.W; x++) {
        const [cx, cy] = this.hexCenter(x, y);
        const i = Hex.idx(x, y);
        this.hexPath(g, cx, cy, r - 1.5);
        if (b.walls.has(i) || (i === gateI && b.isGateIntact())) {
          const gate = i === gateI;
          const wg = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r); wg.addColorStop(0, gate ? '#8a6a3a' : '#a8a090'); wg.addColorStop(1, gate ? '#4a2e12' : '#5a5448');
          g.fillStyle = wg; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.5; g.stroke();
          if (!gate) { g.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 3; k++) { g.fillRect(cx - r * 0.7 + (k % 2) * r * 0.35, cy - r * 0.6 + k * r * 0.4, r * 0.7, r * 0.06); g.fillRect(cx - r * 0.35 + (k % 2) * r * 0.35, cy - r * 0.6 + k * r * 0.4, r * 0.06, r * 0.4); } g.fillStyle = '#c8c0b0'; for (let k = -1; k <= 1; k++) g.fillRect(cx + k * r * 0.5 - r * 0.15, cy - r * 0.95, r * 0.3, r * 0.25); }
          else { g.fillStyle = '#2a1a10'; g.beginPath(); g.roundRect(cx - r * 0.45, cy - r * 0.7, r * 0.9, r * 1.4, [r * 0.45, r * 0.45, 0, 0]); g.fill(); g.strokeStyle = '#c9a961'; g.lineWidth = Math.max(1, r * 0.05); g.beginPath(); g.moveTo(cx, cy - r * 0.7); g.lineTo(cx, cy + r * 0.7); g.moveTo(cx - r * 0.45, cy); g.lineTo(cx + r * 0.45, cy); g.stroke(); }
          const hp = b.wallHp[i]; if (hp) { g.fillStyle = '#ffd870'; for (let k = 0; k < hp; k++) g.fillRect(cx - r * 0.3 + k * r * 0.22, cy + r * 0.72, r * 0.16, r * 0.1); }
          continue;
        }
        if (b.rubble.has(i)) { g.fillStyle = 'rgba(60,54,48,0.7)'; g.fill(); for (let k = 0; k < 5; k++) { const rr = G.hashN(i, k, 1); g.fillStyle = MK.shade('#8a8070', 0.7 + rr * 0.6); g.beginPath(); g.ellipse(cx + (rr - 0.5) * r, cy + (G.hashN(i, k, 2) - 0.5) * r, r * 0.22, r * 0.14, rr * 3, 0, Math.PI * 2); g.fill(); } continue; }
        if (b.obstacles.has(i)) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fill(); g.drawImage(G.decor(b.terrain === 6 || b.terrain === 4 || b.terrain === 7 || b.terrain === 9 ? 2 : b.terrain === 3 ? 3 : b.terrain === 8 ? 5 : 1, (x * 3 + y) & 7, 96, b.terrain), cx - r * 1.05, cy + r * 0.95 - r * 3.36, r * 2.1, r * 3.36); continue; }
        g.fillStyle = (x + y) & 1 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)'; g.fill();
        if (b.moat.has(i)) { const mg = g.createRadialGradient(cx, cy, 0, cx, cy, r); mg.addColorStop(0, 'rgba(40,90,160,0.75)'); mg.addColorStop(1, 'rgba(20,50,110,0.6)'); g.fillStyle = mg; g.fill(); g.fillStyle = 'rgba(255,255,255,' + (0.15 + 0.1 * Math.sin(T * 2 + x + y)) + ')'; g.fillRect(cx - r * 0.5, cy - r * 0.1 + Math.sin(T * 3 + x) * r * 0.1, r, r * 0.06); }
        if (reach && reach.has(i) && b.canStand(cur, x, y) && !(x === cur.x && y === cur.y) && MK.Img.get('ui/hex_move')) { g.globalAlpha = 0.55; g.drawImage(MK.Img.get('ui/hex_move'), cx - r * 0.98, cy - r * 0.98, r * 1.96, r * 1.96); g.globalAlpha = 1; }
        else if (reach && reach.has(i) && b.canStand(cur, x, y) && !(x === cur.x && y === cur.y)) { const rg = g.createRadialGradient(cx, cy, r * 0.2, cx, cy, r); rg.addColorStop(0, 'rgba(120,255,80,0.08)'); rg.addColorStop(1, 'rgba(60,200,40,0.24)'); g.fillStyle = rg; g.fill(); g.strokeStyle = 'rgba(150,255,100,0.6)'; g.lineWidth = Math.max(1, r * 0.045); g.stroke(); }
        if (tactics && this.tacticsStack && b.tacticsAllowed(this.tacticsStack.side, x) && b.canStand(this.tacticsStack, x, y)) { g.fillStyle = 'rgba(255,216,112,0.18)'; g.fill(); }
        g.strokeStyle = 'rgba(190,255,120,0.28)'; g.lineWidth = 1; g.stroke();
      }
      b.towers.forEach((t) => { const [cx, cy] = this.hexCenter(t.x, t.y); const tg = g.createLinearGradient(cx - r * 0.4, 0, cx + r * 0.4, 0); tg.addColorStop(0, '#b0a898'); tg.addColorStop(1, '#5a5448'); g.fillStyle = tg; g.fillRect(cx - r * 0.38, cy - r * 1.2, r * 0.76, r * 1.6); g.fillStyle = '#7a7268'; for (let k = -1; k <= 1; k++) g.fillRect(cx + k * r * 0.28 - r * 0.1, cy - r * 1.4, r * 0.2, r * 0.25); g.fillStyle = '#1a1410'; g.fillRect(cx - r * 0.1, cy - r * 0.9, r * 0.2, r * 0.3); });
      if (b.siege && b.alive(0).length) { const [cx, cy] = this.hexCenter(0, 10); g.fillStyle = '#5a4a2a'; g.fillRect(cx - r * 0.55, cy + r * 0.2, r * 1.1, r * 0.28); g.fillStyle = '#3a2a1a'; g.beginPath(); g.arc(cx - r * 0.4, cy + r * 0.5, r * 0.16, 0, Math.PI * 2); g.arc(cx + r * 0.4, cy + r * 0.5, r * 0.16, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#6a4a2a'; g.lineWidth = r * 0.12; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - r * 0.2, cy + r * 0.2); g.lineTo(cx + r * 0.35, cy - r * 0.7); g.stroke(); g.fillStyle = '#7a7068'; g.beginPath(); g.arc(cx + r * 0.4, cy - r * 0.78, r * 0.14, 0, Math.PI * 2); g.fill(); }
      const hi = tactics ? this.tacticsStack : (cur && cur.alive ? cur : null);
      if (hi) { const pulse = 0.6 + 0.35 * Math.sin(T * 5); b.hexes(hi).forEach(([hx, hy]) => { const p = this.hexCenter(hx, hy); const hv = MK.Img.get('ui/hex_hover'); if (hv) { g.globalAlpha = pulse; g.drawImage(hv, p[0] - r * 1.02, p[1] - r * 1.02, r * 2.04, r * 2.04); g.globalAlpha = 1; return; } this.hexPath(g, p[0], p[1], r - 1); g.strokeStyle = 'rgba(255,216,112,' + pulse + ')'; g.lineWidth = 3; g.stroke(); g.fillStyle = 'rgba(255,216,112,0.12)'; g.fill(); }); }
      if (reach && cur) this.attackOpts.forEach((o) => { b.hexes(o.target).forEach(([hx, hy]) => { const [cx, cy] = this.hexCenter(hx, hy); const ha = MK.Img.get('ui/hex_attack'); if (ha && !o.ranged) { g.globalAlpha = 0.6; g.drawImage(ha, cx - r * 0.98, cy - r * 0.98, r * 1.96, r * 1.96); g.globalAlpha = 1; return; } this.hexPath(g, cx, cy, r - 2); g.fillStyle = o.ranged ? 'rgba(90,160,255,0.28)' : 'rgba(230,50,50,0.32)'; g.fill(); g.strokeStyle = o.ranged ? 'rgba(143,208,255,0.95)' : 'rgba(255,96,96,0.95)'; g.lineWidth = Math.max(2, r * 0.07); g.stroke(); }); });
      if (this.castSpell) { g.fillStyle = 'rgba(140,120,255,0.12)'; g.fillRect(0, 0, W, H - this.barH); }
      // стекове (сенки, спрайтове, ефекти, брой)
      const stacks = b.stacks.filter((s) => s.alive || this.fading[s.id]).sort((a, c) => a.y - c.y);
      stacks.forEach((s) => {
        const base = this.animPos[s.id] || this.stackCenter(s);
        const lunge = this.lunge[s.id] || [0, 0], shake = this.shake[s.id] ? (Math.random() - 0.5) * r * 0.25 : 0;
        const p = [base[0] + lunge[0] + shake, base[1] + lunge[1]];
        const bob = s.alive ? Math.sin(T * 2.2 + s.id * 1.7) * r * 0.03 : 0;
        const size = r * (s.wide ? 3.0 : 2.3);
        const flip = s.side === 1;
        const col = this.sideColor(s.side);
        const fade = this.fading[s.id] !== undefined ? this.fading[s.id] : 1;
        g.globalAlpha = fade;
        const shg = g.createRadialGradient(p[0], p[1] + r * 0.6, 0, p[0], p[1] + r * 0.6, r * (s.wide ? 1.2 : 0.7)); shg.addColorStop(0, 'rgba(0,0,0,0.45)'); shg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = shg; g.beginPath(); g.ellipse(p[0], p[1] + r * 0.6, r * (s.wide ? 1.2 : 0.7), r * 0.3, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = col; g.lineWidth = Math.max(1.5, r * 0.06); g.beginPath(); g.ellipse(p[0], p[1] + r * 0.6, r * (s.wide ? 1.15 : 0.62), r * 0.24, 0, 0, Math.PI * 2); g.stroke();
        if (this.flash[s.id]) g.globalAlpha = fade * (0.55 + 0.45 * Math.sin(now / 35));
        const spr = G.creatureSprite(s.c, 128, flip);
        g.drawImage(spr, p[0] - size / 2, p[1] + r * 0.7 - size * 1.4 - bob, size, size * 1.4);
        if (this.flash[s.id]) { g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.35; g.fillStyle = '#ff6060'; g.fillRect(p[0] - size / 2, p[1] + r * 0.7 - size * 1.4 - bob, size, size * 1.4); g.globalCompositeOperation = 'source-over'; }
        g.globalAlpha = fade;
        const effs = Object.keys(s.effects);
        if (effs.length) { g.font = Math.max(8, r * 0.32) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(effs.map((e) => EFFECT_ICON[e] || '•').join(''), p[0], p[1] - size * 0.75); }
        if (s.alive) {
          const txt = String(s.count);
          g.font = 'bold ' + Math.max(10, r * 0.4) + 'px "Segoe UI", Roboto, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
          const tw = g.measureText(txt).width + r * 0.45;
          const badge = MK.Img.get(s.side === 0 ? 'ui/badge_hp_blue' : 'ui/badge_hp');
          if (badge) { const bw = Math.max(tw * 1.25, r * 0.9), bh = r * 0.6; g.drawImage(badge, p[0] - bw / 2, p[1] + r * 0.4, bw, bh); }
          else { const bg = g.createLinearGradient(0, p[1] + r * 0.42, 0, p[1] + r * 0.95); bg.addColorStop(0, MK.shade(col, 1.2)); bg.addColorStop(1, MK.shade(col, 0.65)); g.fillStyle = bg; g.beginPath(); g.roundRect(p[0] - tw / 2, p[1] + r * 0.45, tw, r * 0.5, r * 0.12); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1; g.stroke(); }
          g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 2; g.fillText(txt, p[0], p[1] + r * 0.71); g.shadowBlur = 0;
        }
        g.globalAlpha = 1;
      });
      // снаряди
      this.projectiles.forEach((pr) => {
        const k = Math.min(1, (now - pr.t0) / pr.dur);
        const x = pr.x0 + (pr.x1 - pr.x0) * k, y = pr.y0 + (pr.y1 - pr.y0) * k - Math.sin(k * Math.PI) * pr.arc;
        const ang = Math.atan2((pr.y1 - pr.y0) - Math.cos(k * Math.PI) * Math.PI * pr.arc, pr.x1 - pr.x0);
        g.save(); g.translate(x, y); g.rotate(ang);
        if (pr.kind === 'rock') { g.fillStyle = '#7a7068'; g.beginPath(); g.arc(0, 0, r * 0.22, 0, Math.PI * 2); g.fill(); }
        else if (pr.kind === 'magic') { const mg = g.createRadialGradient(0, 0, 0, 0, 0, r * 0.35); mg.addColorStop(0, 'rgba(255,255,255,0.95)'); mg.addColorStop(0.4, pr.color || 'rgba(180,140,255,0.8)'); mg.addColorStop(1, 'rgba(180,140,255,0)'); g.fillStyle = mg; g.beginPath(); g.arc(0, 0, r * 0.35, 0, Math.PI * 2); g.fill(); }
        else { g.strokeStyle = '#e8dcc0'; g.lineWidth = Math.max(1.5, r * 0.06); g.beginPath(); g.moveTo(-r * 0.45, 0); g.lineTo(r * 0.35, 0); g.stroke(); g.fillStyle = '#d0d8e0'; g.beginPath(); g.moveTo(r * 0.45, 0); g.lineTo(r * 0.28, -r * 0.08); g.lineTo(r * 0.28, r * 0.08); g.fill(); }
        g.restore();
      });
      // частици
      this.particles = this.particles.filter((pt) => now < pt.t0 + pt.life);
      this.particles.forEach((pt) => {
        const k = (now - pt.t0) / pt.life; const x = pt.x + pt.vx * k * pt.life / 1000, y = pt.y + pt.vy * k * pt.life / 1000 + pt.g * k * k;
        g.globalAlpha = 1 - k; g.fillStyle = pt.color; g.beginPath(); g.arc(x, y, pt.size * (pt.grow ? 1 + k * 2 : 1 - k * 0.5), 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
      });
      // пръстени от магии
      this.rings = this.rings.filter((rg) => now < rg.t0 + rg.life);
      this.rings.forEach((rg) => { const k = (now - rg.t0) / rg.life; g.globalAlpha = 1 - k; g.strokeStyle = rg.color; g.lineWidth = Math.max(2, r * 0.12 * (1 - k)); g.beginPath(); g.arc(rg.x, rg.y, rg.r0 + (rg.r1 - rg.r0) * k, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1; });
      // плаващи числа
      this.floats = this.floats.filter((f) => now - f.t < 1200);
      this.floats.forEach((f) => { const k = (now - f.t) / 1200; const ease = 1 - Math.pow(1 - k, 3); g.globalAlpha = 1 - k * k; g.font = 'bold ' + Math.max(12, r * (f.big ? 0.7 : 0.52)) + 'px "Segoe UI", Roboto, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.strokeText(f.text, f.x, f.y - ease * r * 1.6); g.fillStyle = f.color; g.fillText(f.text, f.x, f.y - ease * r * 1.6); g.globalAlpha = 1; });
      // заглавие
      const hg = g.createLinearGradient(0, 0, 0, this.oy - r); hg.addColorStop(0, 'rgba(10,8,16,0.85)'); hg.addColorStop(1, 'rgba(10,8,16,0)'); g.fillStyle = hg; g.fillRect(0, 0, W, this.oy - r + 4);
      g.font = '600 ' + 14 * this.dpr + 'px "Segoe UI", Roboto, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillStyle = '#ffd870';
      const s0 = b.sides[0], s1 = b.sides[1];
      g.fillText((s0.hero ? s0.hero.name + '  ✦ ' + s0.mana : 'Нападатели'), 8 * this.dpr, 6 * this.dpr);
      g.textAlign = 'right'; g.fillText((s1.hero ? s1.hero.name + '  ✦ ' + s1.mana : b.ctx.town ? b.ctx.town.name : 'Защитници'), W - 8 * this.dpr, 6 * this.dpr);
      g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(tactics ? 'Тактика: подреди армията' : 'Рунд ' + b.round, W / 2, 6 * this.dpr);
    }
    burst(x, y, color, n, speed, size, g) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random()); this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, g: g || this.r * 1.5, t0: performance.now(), life: 400 + Math.random() * 400, color, size: size * (0.5 + Math.random()) }); } }
    async projectile(from, to, kind, color) {
      const dur = kind === 'rock' ? 500 : 320;
      const pr = { x0: from[0], y0: from[1] - this.r * 0.6, x1: to[0], y1: to[1] - this.r * 0.4, arc: kind === 'rock' ? this.r * 3 : this.r * 1.2, t0: performance.now(), dur, kind, color };
      this.projectiles.push(pr);
      await sleep(dur * (this.auto ? 0.5 : 1) / this.speed);
      this.projectiles = this.projectiles.filter((q) => q !== pr);
    }
    async lungeTo(s, target) {
      const a = this.stackCenter(s), t = this.stackCenter(target);
      const dx = t[0] - a[0], dy = t[1] - a[1]; const len = Math.hypot(dx, dy) || 1;
      const amp = this.r * 0.8; const dur = 160 / this.speed;
      const t0 = performance.now();
      while (performance.now() - t0 < dur) { const k = (performance.now() - t0) / dur; const e = Math.sin(k * Math.PI); this.lunge[s.id] = [dx / len * amp * e, dy / len * amp * e]; await sleep(16); }
      delete this.lunge[s.id];
    }

    // ------------------------------------------------------------ анимации
    async playEvents() {
      const b = this.b;
      const evs = b.events.splice(0, b.events.length);
      const fast = this.auto ? 0.35 : 1;
      const st = (id) => b.stacks[id];
      const bloodColor = (s) => (s.c.abilities.undead ? 'rgba(120,200,120,0.8)' : s.fam === 'giant' && s.c.faction === 'academy' ? 'rgba(200,200,210,0.9)' : s.c.faction === 'elements' ? 'rgba(200,180,255,0.9)' : 'rgba(200,30,30,0.85)');
      for (const e of evs) {
        switch (e.type) {
          case 'move': {
            const s = st(e.stack); const path = e.path;
            const per = (e.fly ? 260 : 130) * fast / this.speed;
            const center = (x, y) => { const hs = b.hexesAt(s, x, y); let cx = 0, cy = 0; hs.forEach(([hx, hy]) => { const c = this.hexCenter(hx, hy); cx += c[0]; cy += c[1]; }); return [cx / hs.length, cy / hs.length]; };
            for (let k = 1; k < path.length; k++) {
              const [ax, ay] = center(path[k - 1][0], path[k - 1][1]), [bx, by] = center(path[k][0], path[k][1]);
              const t0 = performance.now();
              while (performance.now() - t0 < per) { const t = (performance.now() - t0) / per; this.animPos[s.id] = [ax + (bx - ax) * t, ay + (by - ay) * t - (e.fly ? Math.sin(t * Math.PI) * this.r * 1.2 : Math.abs(Math.sin(t * Math.PI)) * this.r * 0.15)]; await sleep(16); }
              if (!e.fly && b.terrain !== 0) this.burst(bx, by + this.r * 0.6, 'rgba(120,100,70,0.5)', 3, this.r * 0.8, this.r * 0.08, this.r);
            }
            delete this.animPos[s.id];
            break;
          }
          case 'hit': case 'spellHit': case 'tower': {
            const tgt = st(e.type === 'hit' ? e.to : e.type === 'tower' ? e.target : e.stack);
            const tp = this.stackCenter(tgt);
            if (e.type === 'hit') {
              const att = st(e.from);
              if (e.ranged) await this.projectile(this.stackCenter(att), tp, att.c.fam === 'mage' || att.c.fam === 'spirit' ? 'magic' : 'arrow', att.c.faction === 'inferno' ? 'rgba(255,140,40,0.9)' : undefined);
              else if (!e.fire) await this.lungeTo(att, tgt);
            }
            if (e.type === 'tower') await this.projectile(this.hexCenter(e.from.x, e.from.y), tp, 'arrow');
            this.flash[tgt.id] = 1; this.shake[tgt.id] = 1;
            this.burst(tp[0], tp[1] - this.r * 0.3, e.type === 'spellHit' ? 'rgba(190,150,255,0.9)' : bloodColor(tgt), e.kills ? 14 : 8, this.r * 2.2, this.r * 0.12);
            this.floats.push({ x: tp[0], y: tp[1] - this.r * 0.6, text: '−' + e.dmg + (e.kills ? '  ☠' + e.kills : ''), color: e.luck > 0 ? '#ffe070' : e.type === 'spellHit' ? '#d0b0ff' : e.fire ? '#ff9040' : '#ff8a8a', t: performance.now(), big: e.kills > 0 });
            if (e.luck > 0) this.floats.push({ x: tp[0], y: tp[1] - this.r * 1.4, text: 'Късмет!', color: '#ffe070', t: performance.now() });
            if (e.deathBlow) this.floats.push({ x: tp[0], y: tp[1] - this.r * 1.4, text: 'Смъртоносен удар!', color: '#ff4040', t: performance.now() });
            await sleep((e.retaliation ? 220 : 300) * fast / this.speed);
            delete this.flash[tgt.id]; delete this.shake[tgt.id];
            break;
          }
          case 'heal': { const s = st(e.stack); const [cx, cy] = this.stackCenter(s); this.burst(cx, cy - this.r * 0.5, 'rgba(120,255,140,0.9)', 12, this.r * 1.2, this.r * 0.1, -this.r * 2); this.floats.push({ x: cx, y: cy - this.r * 0.6, text: '+' + e.amount, color: '#80ff80', t: performance.now() }); await sleep(260 * fast); break; }
          case 'rebirth': { const s = st(e.stack); const [cx, cy] = this.stackCenter(s); delete this.fading[s.id]; this.rings.push({ x: cx, y: cy - this.r * 0.3, r0: 0, r1: this.r * 2.5, t0: performance.now(), life: 600, color: 'rgba(255,170,60,0.9)' }); this.burst(cx, cy, 'rgba(255,160,40,0.9)', 30, this.r * 3, this.r * 0.14, -this.r); this.floats.push({ x: cx, y: cy - this.r, text: 'Прераждане!', color: '#ffb040', t: performance.now(), big: true }); await sleep(500 * fast); break; }
          case 'stare': { const s = st(e.stack); const [cx, cy] = this.stackCenter(s); this.burst(cx, cy - this.r * 0.4, 'rgba(160,255,200,0.9)', 16, this.r * 1.5, this.r * 0.1); this.floats.push({ x: cx, y: cy - this.r, text: 'Смъртоносен поглед ☠' + e.kills, color: '#c0ffc0', t: performance.now() }); await sleep(300 * fast); break; }
          case 'catapult': { const [cx, cy] = this.hexCenter(e.idx % Hex.W, Math.floor(e.idx / Hex.W)); await this.projectile(this.hexCenter(0, 10), [cx, cy], 'rock'); this.burst(cx, cy, 'rgba(160,150,130,0.9)', 18, this.r * 2.5, this.r * 0.14); this.shakeScreen = performance.now(); this.floats.push({ x: cx, y: cy - this.r * 0.5, text: e.destroyed ? (e.gate ? 'Портата пада!' : 'Стената пада!') : 'Удар по стената', color: '#ffd870', t: performance.now(), big: e.destroyed }); await sleep(350 * fast); break; }
          case 'death': { const s = st(e.stack); const [cx, cy] = this.stackCenter(s); this.burst(cx, cy, 'rgba(90,80,70,0.7)', 14, this.r * 1.5, this.r * 0.16, this.r); const t0 = performance.now(), dur = 450 * fast; while (performance.now() - t0 < dur) { this.fading[s.id] = 1 - (performance.now() - t0) / dur; await sleep(16); } delete this.fading[s.id]; break; }
          case 'morale': { const s = st(e.stack); const [cx, cy] = this.stackCenter(s); this.floats.push({ x: cx, y: cy - this.r, text: e.good ? 'Висок морал!' : 'Лош морал', color: e.good ? '#ffe070' : '#a0a0a0', t: performance.now() }); if (e.good) this.burst(cx, cy - this.r, 'rgba(255,224,112,0.9)', 10, this.r, this.r * 0.08, -this.r); await sleep(400 * fast); break; }
          case 'cast': { const sd = b.sides[e.side]; const [cx, cy] = Hex.inb(e.x, e.y) ? this.hexCenter(e.x, e.y) : [this.canvas.width / 2, this.oy + this.r * 7]; const sp = D.spellById[e.spell]; const col = sp.school === 'fire' ? 'rgba(255,120,40,0.9)' : sp.school === 'water' ? 'rgba(100,180,255,0.9)' : sp.school === 'earth' ? 'rgba(160,220,100,0.9)' : 'rgba(190,160,255,0.9)'; this.rings.push({ x: cx, y: cy, r0: this.r * 0.3, r1: this.r * (sp.kind === 'all' ? 9 : sp.kind === 'area' ? 2.6 : 1.4), t0: performance.now(), life: 550, color: col }); this.burst(cx, cy, col, 16, this.r * 2, this.r * 0.12, -this.r * 0.5); this.floats.push({ x: this.canvas.width / 2, y: this.oy + this.r * 0.5, text: '✦ ' + sp.name + ' ✦', color: '#d8c0ff', t: performance.now(), big: true }); await sleep(380 * fast); break; }
          case 'effect': { const s = st(e.stack); if (s) { const [cx, cy] = this.stackCenter(s); this.burst(cx, cy - this.r * 0.6, 'rgba(200,170,255,0.9)', 8, this.r, this.r * 0.08, -this.r * 1.5); } await sleep(120 * fast); break; }
          case 'resist': case 'immune': { const s = st(e.stack); const [cx, cy] = this.stackCenter(s); this.rings.push({ x: cx, y: cy - this.r * 0.4, r0: this.r * 0.8, r1: this.r * 1.1, t0: performance.now(), life: 350, color: 'rgba(255,255,255,0.9)' }); this.floats.push({ x: cx, y: cy - this.r * 0.6, text: e.type === 'resist' ? 'Устоява!' : 'Имунитет', color: '#fff', t: performance.now() }); await sleep(250 * fast); break; }
          case 'wait': case 'defend': { const s = st(e.stack); if (s && e.type === 'defend') { const [cx, cy] = this.stackCenter(s); this.rings.push({ x: cx, y: cy - this.r * 0.3, r0: this.r * 0.4, r1: this.r * 1.0, t0: performance.now(), life: 400, color: 'rgba(160,200,255,0.8)' }); } await sleep(120 * fast); break; }
          case 'log': { this.logLines.push(e.text); this.logLines = this.logLines.slice(-3); this.renderBar(); break; }
          case 'round': { this.renderBar(); break; }
          default: break;
        }
      }
    }

    // ------------------------------------------------------------ управление
    renderBar() {
      const b = this.b, bar = this.bar;
      bar.innerHTML = '';
      const cur = b.current;
      const log = UI.el('div', { class: 'log' }, ...this.logLines.map((l) => UI.el('div', null, l)));
      bar.appendChild(log);
      const ico = (name, txt) => { const u = MK.Img.url('ui/' + name); return u ? [UI.el('img', { src: u, class: 'btn-ico', alt: '' }), ' ' + txt] : [txt]; };
      const mk = (label, fn, dis, cls) => bar.appendChild(UI.el('button', { class: cls || '', disabled: dis ? 'disabled' : null, onclick: fn }, ...(Array.isArray(label) ? label : [label])));
      if (this.state === 'tactics') {
        bar.appendChild(UI.el('div', { class: 'tiny' }, 'Докосни свой стек, после хекс в осветената зона.'));
        mk('✔ Готово', () => this.resolveTactics(), false, 'primary');
        return;
      }
      const canAct = this.state === 'input' && cur && this.isHuman(cur.side) && !this.auto;
      const side = cur ? cur.side : this.humans[0];
      if (cur && canAct) bar.appendChild(UI.el('button', { class: 'small', onclick: () => UI.creatureInfo(cur.c) }, cur.c.name + ' ×' + cur.count + (cur.shots ? ' 🏹' + cur.shots : '')));
      mk(ico('icon_wait', 'Чакай'), () => this.act(() => b.doWait(cur)), !canAct || (cur && cur.waited));
      mk(ico('icon_defend', 'Защита'), () => this.act(() => b.doDefend(cur)), !canAct);
      mk(ico('icon_spellbook', 'Магия'), () => this.openSpellbook(side), !canAct || !b.canCast(side));
      mk(this.auto ? '⏸ Ръчно' : '⚡ Авто', () => { this.auto = !this.auto; if (this.auto && this.state === 'input' && cur) this.resolveInput({ auto: true }); this.renderBar(); }, !this.humans.length);
      mk('🏳 Бягство', () => this.retreat(side), !canAct || !b.canRetreat(side), 'danger');
      mk('💰 Предаване', () => this.surrender(side), !canAct || !b.canSurrender(side), 'danger');
      mk(this.speed > 1 ? '⏩' : '▶', () => { this.speed = this.speed > 1 ? 1 : 3; this.renderBar(); });
    }
    act(fn) { if (this.state !== 'input') return; if (fn() !== false) this.resolveInput({}); }
    async retreat(side) {
      const ok = await UI.dialog({ title: 'Бягство', text: 'Героят ще избяга, армията ще бъде изгубена, но той ще може да бъде нает отново в таверна. Сигурен ли си?', buttons: [{ label: 'Не', value: false }, { label: 'Бягай', value: true, cls: 'danger' }] });
      if (ok && this.state === 'input') { this.b.doRetreat(side); this.resolveInput({}); }
    }
    async surrender(side) {
      const cost = this.b.surrenderCost(side);
      const p = this.game && this.game.world.players[this.b.sides[side].owner];
      const ok = await UI.dialog({ title: 'Предаване', text: 'Срещу ' + cost + ' злато врагът ще пусне героя с цялата му армия. Той ще чака в таверна. ' + (p && p.res.gold < cost ? 'Нямаш толкова злато.' : 'Приемаш ли?'), buttons: [{ label: 'Не', value: false }, { label: 'Предай се', value: true, cls: 'danger' }] });
      if (ok && this.state === 'input') { if (!this.b.doSurrender(side)) { UI.toast('Предаването не е възможно.'); return; } this.resolveInput({}); }
    }
    tap(e) {
      const rect = this.canvas.getBoundingClientRect();
      const px = (e.clientX - rect.left) * this.dpr, py = (e.clientY - rect.top) * this.dpr;
      const h = this.pixelToHex(px, py);
      if (!h) return;
      const b = this.b;
      const [x, y] = h;
      const target = b.occupant(x, y);
      if (this.state === 'tactics') {
        if (target && target.side === b.tacticsSide) { this.tacticsStack = target; return; }
        if (this.tacticsStack && !target) { if (!b.placeStack(this.tacticsStack, x, y)) UI.toast('Не може там.'); }
        return;
      }
      if (this.state !== 'input') return;
      const cur = b.current;
      if (this.castSpell) {
        const r = b.doCast(cur.side, this.castSpell.id, x, y);
        if (!r.ok) { UI.toast(r.why); return; }
        this.castSpell = null;
        this.playEvents().then(() => { if (b.finished) this.resolveInput({}); else { this.prepareInput(cur); this.renderBar(); } });
        return;
      }
      if (target && target.side !== cur.side) {
        const opt = this.attackOpts.find((o) => o.target === target && o.ranged) || this.attackOpts.find((o) => o.target === target);
        if (!opt) { UI.toast('Не можеш да стигнеш до тази цел.'); return; }
        if (opt.ranged) b.doShoot(cur, target); else b.doAttack(cur, target, opt.from.x, opt.from.y);
        this.resolveInput({}); return;
      }
      if (target && target.side === cur.side) { UI.creatureInfo(target.c); return; }
      if (this.reach.has(Hex.idx(x, y)) && b.canStand(cur, x, y) && !(x === cur.x && y === cur.y)) { b.doMove(cur, x, y); cur.acted = true; cur.actionKind = 'move'; this.resolveInput({}); }
    }
    hint(t) { const el = this.bar.querySelector('.log'); if (el && t) el.innerHTML = '<b style="color:#c0a0ff">' + t + '</b>'; }
    openSpellbook(side) {
      const b = this.b, sd = b.sides[side];
      const content = UI.el('div', { class: 'spellbook' });
      sd.spells.map((id) => D.spellById[id]).sort((a, c) => a.level - c.level).forEach((sp) => {
        const cost = b.spellCost(side, sp);
        const dis = cost > sd.mana;
        const lvl = b.schoolLevel(sd, sp);
        content.appendChild(UI.el('div', { class: 'spell school-' + sp.school + (dis ? ' dis' : ''), onclick: () => { if (dis) return; wrap.remove(); this.beginCast(side, sp); } }, UI.el('b', null, sp.name), UI.el('small', null, D.SCHOOL_NAME[sp.school] + ' · ' + cost + ' мана' + (lvl ? ' · ' + D.SKILL_LEVEL_NAME[lvl] : '')), UI.el('div', { class: 'tiny' }, sp.desc)));
      });
      const wrap = UI.el('div', { class: 'modal-wrap' }, UI.el('div', { class: 'modal', style: 'max-width:640px' }, UI.el('h2', null, 'Книга с магии (мана ' + sd.mana + ')'), content, UI.el('div', { class: 'buttons' }, UI.el('button', { onclick: () => wrap.remove() }, 'Затвори'))));
      document.getElementById('overlay').appendChild(wrap);
    }
    beginCast(side, sp) {
      const b = this.b;
      if (!b.needsTarget(side, sp)) {
        const r = b.doCast(side, sp.id, 0, 0);
        if (!r.ok) { UI.toast(r.why); return; }
        this.playEvents().then(() => { if (b.finished) this.resolveInput({}); else { this.prepareInput(b.current); this.renderBar(); } });
        return;
      }
      this.castSpell = sp; this.renderBar(); this.hint('Избери цел за „' + sp.name + '“ (докосни хекс)');
    }
    prepareInput(cur) { this.reach = this.b.reach(cur); this.attackOpts = this.b.attackOptions(cur, this.reach); }
    waitInput(cur) {
      this.state = 'input'; this.prepareInput(cur); this.castSpell = null; this.renderBar();
      return new Promise((res) => { this.resolveInput = (v) => { this.state = 'anim'; this.resolveInput = () => {}; res(v); }; });
    }
    resolveInput() {}
    waitTactics() {
      this.state = 'tactics'; this.tacticsStack = this.b.alive(this.b.tacticsSide)[0] || null; this.renderBar();
      return new Promise((res) => { this.resolveTactics = () => { this.state = 'anim'; this.resolveTactics = () => {}; res(); }; });
    }
    resolveTactics() {}

    // ------------------------------------------------------------ цикъл
    async run() {
      const b = this.b;
      this.renderBar();
      await sleep(300);
      if (b.tacticsSide >= 0 && this.isHuman(b.tacticsSide) && !this.auto) await this.waitTactics();
      while (!b.finished) {
        const s = b.nextTurn();
        await this.playEvents();
        if (!s) break;
        if (this.isHuman(s.side) && !this.auto) {
          const r = await this.waitInput(s);
          if (r.auto && !s.acted && !s.waited && !b.finished) b.aiAct(s);
        } else { await sleep(120); b.aiAct(s); }
        await this.playEvents();
        b.afterAction(s);
        await this.playEvents();
        if (b.round > 80) { b.finished = true; b.winner = 1; }
      }
      await sleep(400);
      const res = b.result();
      await this.showResult(res);
      this.destroy();
      return res;
    }
    async showResult(res) {
      const b = this.b;
      const humanSide = this.humans.length === 1 ? this.humans[0] : -1;
      const humanWon = humanSide >= 0 && ((res.winner === 'att') === (humanSide === 0));
      if (humanSide >= 0) MK.Audio.battleEnd(humanWon);
      const cas = (side) => b.stacks.filter((s) => s.side === side && s.origCount - s.count > 0).map((s) => (s.origCount - s.count) + ' ' + s.c.name).join(', ') || 'няма';
      const title = humanSide < 0 ? 'Битката приключи' : humanWon ? 'Победа!' : res.surrendered !== undefined ? 'Предаване' : res.retreated !== undefined ? 'Отстъпление' : 'Поражение';
      await UI.dialog({ title, content: UI.el('div', null, UI.el('p', null, (res.winner === 'att' ? 'Нападателите' : 'Защитниците') + ' печелят след ' + res.rounds + ' рунда.'), UI.el('p', { class: 'tiny' }, 'Загуби на нападателите: ' + cas(0)), UI.el('p', { class: 'tiny' }, 'Загуби на защитниците: ' + cas(1))) });
    }
    destroy() {
      this.running = false; cancelAnimationFrame(this.raf);
      window.removeEventListener('resize', this.onResize);
      if (this.ro) this.ro.disconnect();
      this.canvas.removeEventListener('pointerup', this.onPointer);
      this.canvas.hidden = true; this.bar.hidden = true; this.bar.innerHTML = '';
      if (this.hudWasVisible) document.getElementById('hud').hidden = false;
    }
  }
  MK.BattleUI = { run: (battle, humanSides, game) => new BattleUI(battle, Array.isArray(humanSides) ? humanSides : humanSides < 0 ? [] : [humanSides], game).run() };
})();
