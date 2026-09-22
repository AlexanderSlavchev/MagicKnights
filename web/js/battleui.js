/* Екран на битката: хексове, двухексови същества, тактика, обсада (ров, стени, порта, кули),
   анимации, управление с докосване, магьосническа книга, предаване, битки между двама човеци */
(function () {
  'use strict';
  const MK = (window.MK = window.MK || {});
  const TR = (s) => (MK.T ? MK.T(s) : s);
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
      this.floats = []; this.flash = {}; this.animPos = {}; this.lunge = {}; this.shake = {}; this.fading = {}; this.particles = []; this.projectiles = []; this.fx = []; this.rings = [];
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
      // Размерът на полето се смята веднъж и се преизчислява само при истинска промяна на прозореца (завъртане),
      // не при всяка промяна на лентата отдолу — иначе полето „подскача“ при всеки ход.
      this._winW = window.innerWidth; this._winH = window.innerHeight;
      // Мащабиране на полето (щипване) и плъзгане — бутоните остават на място; двойно докосване връща 1×
      this.view = { s: 1, x: 0, y: 0 };
      const pts = new Map(); let pinch = null, moved = false, down = null, lastTap = 0;
      this.onDown = (e) => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = false; down = { x: e.clientX, y: e.clientY, vx: this.view.x, vy: this.view.y }; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: this.view.s, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, vx: this.view.x, vy: this.view.y }; } try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* noop */ } };
      this.onMove2 = (e) => {
        if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size === 2 && pinch) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const ns = Math.max(1, Math.min(3, pinch.s * d / pinch.d)); const rect = this.canvas.getBoundingClientRect(); const cx = (pinch.cx - rect.left) * this.dpr, cy = (pinch.cy - rect.top) * this.dpr; this.view.x = cx - (cx - pinch.vx) * ns / pinch.s; this.view.y = cy - (cy - pinch.vy) * ns / pinch.s; this.view.s = ns; this.clampView(); moved = true; return; }
        if (pts.size === 1 && down && this.view.s > 1) { const dx = e.clientX - down.x, dy = e.clientY - down.y; if (moved || Math.hypot(dx, dy) > 8) { moved = true; this.view.x = down.vx + dx * this.dpr; this.view.y = down.vy + dy * this.dpr; this.clampView(); } }
      };
      this.onPointer = (e) => { const had = pts.has(e.pointerId); pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!had || moved) { if (pts.size === 0) moved = false; return; } const now = performance.now(); if (now - lastTap < 320 && this.view.s > 1) { lastTap = 0; this.view = { s: 1, x: 0, y: 0 }; return; } lastTap = now; this.tap(e); };
      this.canvas.addEventListener('pointerdown', this.onDown); this.canvas.addEventListener('pointermove', this.onMove2); this.canvas.addEventListener('pointercancel', this.onPointer);
      this.canvas.style.touchAction = 'none';
      // колелце на мишката: мащаб около курсора
      this.onWheel = (e) => { e.preventDefault(); const rect = this.canvas.getBoundingClientRect(); const cx = (e.clientX - rect.left) * this.dpr, cy = (e.clientY - rect.top) * this.dpr; const ns = Math.max(1, Math.min(3, this.view.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); this.view.x = cx - (cx - this.view.x) * ns / this.view.s; this.view.y = cy - (cy - this.view.y) * ns / this.view.s; this.view.s = ns; this.clampView(); };
      this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
      this.onHover = (e) => { if (e.pointerType !== 'mouse') return; const rect = this.canvas.getBoundingClientRect(); this.updateHoverAttack(...this.toField((e.clientX - rect.left) * this.dpr, (e.clientY - rect.top) * this.dpr)); };
      this.canvas.addEventListener('pointermove', this.onHover);
      this.canvas.addEventListener('pointerup', this.onPointer);
      this.raf = null;
      this.loopDraw();
    }
    isHuman(side) { return this.humans.includes(side); }
    get human() { return this.b.current ? this.b.current.side : this.humans[0]; }
    /* Подредба на битката: bar = bottom|right|left|overlay; squash = вертикално сплескване на хексовете; band = небе */
    static layout() { return { bar: 'auto', squash: 0.6, band: 0 }; } // избрано след проби на телефон: бутони авто, сплескани хексове, без небе
    static saveLayout(l) { localStorage.setItem('mk_battle_layout', JSON.stringify(l)); }
    applyLayoutClass() {
      const L = BattleUI.layout(); const bar = this.bar;
      bar.classList.remove('lay-bottom', 'lay-right', 'lay-left', 'lay-overlay');
      let mode = L.bar;
      if (mode === 'auto') mode = window.innerWidth > window.innerHeight && window.innerHeight < 520 ? 'right' : 'bottom';
      bar.classList.add('lay-' + mode);
      this.layoutMode = mode; this.squash = L.squash || 1; this.bandK = L.band === undefined ? 0.08 : L.band;
    }
    resize(force) {
      this.applyLayoutClass();
      const cw = this.canvas.clientWidth, ch = this.canvas.clientHeight;
      if (!force && this.r && cw === this._cw && ch === this._ch) return;
      if (!cw || !ch) { setTimeout(() => this.resize(true), 50); return; } // платното още не е показано
      this._cw = cw; this._ch = ch;
      this._winW = window.innerWidth; this._winH = window.innerHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.dpr = dpr;
      this.canvas.width = Math.floor(this.canvas.clientWidth * dpr);
      this.canvas.height = Math.floor(this.canvas.clientHeight * dpr);
      // Лентата с бутоните е отдолу (портрет/десктоп) или отдясно като колона (телефон в landscape)
      const rect = this.bar.getBoundingClientRect();
      const mode = this.layoutMode, sq = this.squash;
      const barH = mode === 'bottom' ? (rect.height || 96) * dpr : 0, barW = mode === 'right' || mode === 'left' ? rect.width * dpr : 0;
      const fieldW = this.canvas.width - barW, fieldX = mode === 'left' ? barW : 0;
      const band = Math.floor((this.canvas.height - barH) * this.bandK);
      const availW = fieldW - 16 * dpr, availH = this.canvas.height - barH - 24 * dpr - band;
      const heroPad = (this.b.sides[0].hero ? 1.3 : 0) + (this.b.sides[1].hero ? 1.3 : 0); // място за героите отстрани
      const rW = availW / (Math.sqrt(3) * (Hex.W + 0.5) + heroPad), rH = availH / ((1.5 * (Hex.H - 1)) * sq + 2);
      this.r = Math.max(4, Math.min(rW, rH));
      // ако ширината ограничава, редовете се разтварят вертикално (до правилни хексове), за да се запълни височината
      this.squash = rW <= rH ? Math.max(sq, Math.min(1, (availH - 2 * this.r) / (1.5 * (Hex.H - 1) * this.r))) : sq;
      this.ox = fieldX + (fieldW - Math.sqrt(3) * this.r * (Hex.W + 0.5)) / 2 + Math.sqrt(3) * this.r / 2;
      this.oy = 22 * dpr + band + this.r;
      this.fieldX = fieldX;
      this.band = band; this._bg = null;
      this.barH = barH; this.barW = barW; this.fieldW = fieldW;
    }
    hexCenter(x, y) { const r = this.r; return [this.ox + Math.sqrt(3) * r * (x + (y & 1) * 0.5), this.oy + 1.5 * r * y * (this.squash || 1)]; }
    stackCenter(s) { const hs = this.b.hexes(s); let x = 0, y = 0; hs.forEach(([hx, hy]) => { const [cx, cy] = this.hexCenter(hx, hy); x += cx; y += cy; }); return [x / hs.length, y / hs.length]; }
    /* Ограничава плъзгането, така че полето да не излиза от екрана */
    clampView() { const v = this.view, W = this.fieldW || this.canvas.width, H = this.canvas.height - (this.barH || 0); v.x = Math.min(0, Math.max(W - W * v.s, v.x)); v.y = Math.min(0, Math.max(H - H * v.s, v.y)); if (v.s === 1) { v.x = 0; v.y = 0; } }
    /* Екранни пиксели → координати на полето (обратно на мащаба) */
    toField(px, py) { const v = this.view || { s: 1, x: 0, y: 0 }; return [(px - v.x) / v.s, (py - v.y) / v.s]; }
    pixelToHex(px, py) {
      let best = null, bd = Infinity;
      for (let y = 0; y < Hex.H; y++) for (let x = 0; x < Hex.W; x++) { const [cx, cy] = this.hexCenter(x, y); const d = (cx - px) ** 2 + (cy - py) ** 2; if (d < bd) { bd = d; best = [x, y]; } }
      return bd < this.r * this.r ? best : null;
    }
    /* Героите стоят на кон отляво и отдясно на полето, както в класиките */
    heroRects() {
      // Както в класиките: героят стои на кон отстрани на полето, на средата по височина, с големина ~1.2 единица;
      // където няма място встрани (телефон), навлиза леко над крайната колона, но се рисува под единиците.
      const b = this.b, r = this.r, sq = this.squash || 1, out = [];
      const gridL = this.hexCenter(0, 0)[0] - Math.sqrt(3) * r / 2, gridR = this.hexCenter(Hex.W - 1, 1)[0] + Math.sqrt(3) * r / 2;
      const fieldX = this.fieldX || 0, fieldW = this.fieldW || this.canvas.width;
      const hgt = r * 4.2, w = hgt / 1.4;
      const gy = this.hexCenter(0, 6)[1] + r * sq * 0.8;
      [0, 1].forEach((side) => {
        const h = b.sides[side].hero; if (!h) return;
        const margin = side === 0 ? gridL - fieldX : fieldX + fieldW - gridR;
        const over = Math.max(0, w - margin + r * 0.1); // колко навлиза над полето
        const x = side === 0 ? gridL - w + over : gridR - over;
        out.push({ side, hero: h, x, y: gy - hgt, w, h: hgt, alpha: over > r * 0.5 ? 0.8 : 1 });
      });
      return out;
    }
    drawHeroes(T) {
      const g = this.ctx;
      this.heroRects().forEach((hr) => {
        const bob = Math.sin(T * 1.5 + hr.side) * this.r * 0.02;
        const spr = G.heroSprite(hr.hero, 320, this.sideColor(hr.side));
        g.save(); g.globalAlpha = hr.alpha || 1;
        if (hr.side === 1) { g.translate(hr.x + hr.w, 0); g.scale(-1, 1); g.drawImage(spr, 0, hr.y + bob, hr.w, hr.h); }
        else g.drawImage(spr, hr.x, hr.y + bob, hr.w, hr.h);
        g.restore();
        if (this.b.current && this.b.current.side === hr.side && this.state === 'input') { g.strokeStyle = 'rgba(255,216,112,0.6)'; g.lineWidth = 2; g.beginPath(); g.ellipse(hr.x + hr.w / 2, hr.y + hr.h - this.r * 0.15, hr.w * 0.45, this.r * 0.25, 0, 0, Math.PI * 2); g.stroke(); }
      });
    }
    /* Стена, порта и кули на ред y (само при обсада): 3/4 перспектива, каменна текстура, зъбери, щети; стрелци на кулите */
    /* Рисувани части на обсадата за фракцията на града (img/siege/<фракция>_*) или null */
    siegeArt() {
      const t = this.b.ctx.town; if (!t) return null;
      const f = t.faction; if (!MK.Img.has('siege/' + f + '_wall')) return null;
      const get = (k) => MK.Img.get('siege/' + f + '_' + k);
      const art = { wall: get('wall'), wall_damaged: get('wall_damaged'), rubble: get('rubble'), gate: get('gate'), gate_broken: get('gate_broken'), tower: get('tower'), keep: get('keep'), tower_ruin: get('tower_ruin'), moat: get('moat') };
      return art.wall && art.gate && art.tower ? art : null;
    }
    /* Непрекъсната колона на стената: горен парапет + повтаряща се средна част + основа, кеширана по размер */
    wallColumn(art, w, h) {
      const key = Math.round(w) + 'x' + Math.round(h) + this.b.ctx.town.faction;
      if (this._wallCol && this._wallCol.key === key) return this._wallCol.c;
      const im = art.wall, c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); const g = c.getContext('2d');
      const k = w / im.width, capT = im.height * 0.24, capB = im.height * 0.14, mid0 = im.height * 0.26, mid1 = im.height * 0.84;
      const capTh = capT * k, capBh = capB * k;
      g.drawImage(im, 0, 0, im.width, capT, 0, 0, w, capTh);
      g.drawImage(im, 0, im.height - capB, im.width, capB, 0, h - capBh, w, capBh);
      let y = capTh; const midH = (mid1 - mid0) * k;
      while (y < h - capBh) { const hh = Math.min(midH, h - capBh - y); g.drawImage(im, 0, mid0, im.width, (mid1 - mid0) * hh / midH, 0, y, w, hh); y += hh; }
      this._wallCol = { key, c }; return c;
    }
    drawWallRow(y, T) {
      const b = this.b; if (!b.siege) return;
      const g = this.ctx, r = this.r, sq = this.squash || 1;
      const WX = 10, gateI = Hex.idx(WX, 5);
      const art = this.siegeArt();
      if (art) {
        // Рисувана обсада: стената е една непрекъсната колона по цялата височина на полето (горен парапет,
        // повтаряща се средна част, основа), рисувана по ленти ред по ред, за да стои правилно спрямо единиците.
        const rowH = 1.5 * r * sq, hexW = Math.sqrt(3) * r;
        const top0 = this.hexCenter(WX, 0)[1] - rowH * 0.5 - r * sq * 0.9, base0 = this.hexCenter(WX, Hex.H - 1)[1] + r * sq * 0.95;
        const colW = hexW * 1.5, colX = this.hexCenter(WX, 0)[0] - colW / 2 + (0 & 1) * 0;
        const col = this.wallColumn(art, colW, base0 - top0);
        const [cx, cy] = this.hexCenter(WX, y);
        const bandTop = cy - rowH * 0.5 - (y === 0 ? r * sq : 0), bandBot = cy + rowH * 0.5 + (y === Hex.H - 1 ? r * sq * 0.5 : 0);
        const i = Hex.idx(WX, y), isGate = i === gateI;
        const hp = b.wallHp[i] || 0, maxHp = b.siege + (isGate ? 1 : 0);
        const alive = b.walls.has(i) || (isGate && b.isGateIntact());
        const drawPart = (im, cx2, cy2, wMul) => { if (!im) return; const w = hexW * wMul, h = w * im.height / im.width; const base = cy2 + r * sq * 0.95; g.drawImage(im, cx2 - w / 2, base - h, w, h); return { top: base - h, base, w, h }; };
        const hpBar = (base, hpv, mx) => { if (!mx) return; const dmg = 1 - hpv / mx; g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(cx - r * 0.5, base + r * 0.05, r, r * 0.12); g.fillStyle = dmg > 0.5 ? '#ff8a60' : '#ffd870'; g.fillRect(cx - r * 0.5, base + r * 0.05, r * (hpv / mx), r * 0.12); };
        if (alive || isGate) {
          g.save(); g.beginPath(); g.rect(colX - r, bandTop, colW + r * 2, bandBot - bandTop); g.clip();
          g.drawImage(col, colX, top0);
          if (alive && !isGate && hp < maxHp && art.wall_damaged) { // пукнатини по повредения сегмент
            const im = art.wall_damaged; g.globalAlpha = 0.95; g.drawImage(im, 0, im.height * 0.25, im.width, im.height * 0.5, colX, bandTop, colW, bandBot - bandTop); g.globalAlpha = 1;
          }
          g.restore();
        }
        if (isGate) { const q = drawPart(b.isGateIntact() ? art.gate : (art.gate_broken || art.rubble), cx, cy, 1.7); if (q && b.isGateIntact()) { const cl = this.sideColor(1); const fx = cx, fy = q.top + r * 0.1; g.strokeStyle = '#3a2a10'; g.lineWidth = Math.max(1, r * 0.05); g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx, fy - r); g.stroke(); g.fillStyle = cl; g.beginPath(); g.moveTo(fx, fy - r); g.lineTo(fx + r * 0.5 + Math.sin(T * 3) * r * 0.06, fy - r * 0.82); g.lineTo(fx, fy - r * 0.6); g.closePath(); g.fill(); } }
        else if (!alive && b.rubble.has(i)) drawPart(art.rubble, cx, cy, 1.3);
        if (alive) hpBar(cy + r * sq * 0.6, hp, maxHp);
        b.towers.forEach((tw) => {
          if (tw.y !== y) return;
          const [tx, ty0] = this.hexCenter(tw.x, tw.y); const big = tw.x === 13; const ty = tw.y === 0 ? ty0 + r * sq * 1.4 : ty0; // горната кула стъпва по-ниско, за да не излиза от екрана
          if (tw.destroyed) { drawPart(art.tower_ruin || art.rubble, tx, ty, big ? 1.5 : 1.2); return; }
          const q = drawPart(big ? (art.keep || art.tower) : art.tower, tx, ty, big ? 1.6 : 1.2);
          const t = b.ctx.town; const c = t ? D.creatureOf(t.faction + '2' + (t.buildings && t.buildings.dw2u ? 'u' : '')) : null;
          if (c && q) { const spr = G.creatureSprite(c, 128, true); const sz = r * 1.25; g.drawImage(spr, tx - sz / 2 + (big ? -r * 0.05 : 0), q.top + q.h * 0.1 - sz * 1.4 + Math.sin(T * 1.7 + tx) * r * 0.02, sz, sz * 1.4); }
        });
        return;
      }
      const stone = MK.Img.get('terrain/rough');
      const seg = (cx, cy, kind, hp, maxHp) => {
        const w = Math.sqrt(3) * r * 1.02, hgt = r * 2.4, top = cy - hgt + r * sq * 0.9, base = cy + r * sq * 0.9;
        const dmg = maxHp ? 1 - hp / maxHp : 0;
        // тяло
        g.save(); g.beginPath(); g.rect(cx - w / 2, top, w, base - top); g.clip();
        if (stone) { g.drawImage(stone, cx - w / 2, top, w, base - top); g.fillStyle = 'rgba(120,110,100,0.35)'; g.fillRect(cx - w / 2, top, w, base - top); }
        else { const gr = g.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0); gr.addColorStop(0, '#b8b0a0'); gr.addColorStop(1, '#6a6458'); g.fillStyle = gr; g.fillRect(cx - w / 2, top, w, base - top); }
        // каменни редове
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = Math.max(1, r * 0.04);
        for (let k = 0; k < 5; k++) { const yy = top + (base - top) * (k + 1) / 6; g.beginPath(); g.moveTo(cx - w / 2, yy); g.lineTo(cx + w / 2, yy); g.stroke(); for (let m = 0; m < 3; m++) { const xx = cx - w / 2 + w * ((m + (k % 2) * 0.5) / 3); g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx, yy - (base - top) / 6); g.stroke(); } }
        // сянка отдясно (гледаме от ляво-горе)
        const sh = g.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0); sh.addColorStop(0, 'rgba(255,255,255,0.12)'); sh.addColorStop(1, 'rgba(0,0,0,0.35)'); g.fillStyle = sh; g.fillRect(cx - w / 2, top, w, base - top);
        // щети: пукнатини и липсващи камъни
        if (dmg > 0) { g.strokeStyle = 'rgba(20,16,12,0.8)'; g.lineWidth = Math.max(1, r * 0.06); for (let k = 0; k < Math.ceil(dmg * 4); k++) { const sx = cx - w / 2 + w * G.hashN(y, k, 3), sy = top + (base - top) * G.hashN(y, k, 4); g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + (G.hashN(y, k, 5) - 0.5) * r, sy + r * 0.6); g.lineTo(sx + (G.hashN(y, k, 6) - 0.5) * r * 1.4, sy + r * 1.2); g.stroke(); } }
        g.restore();
        // зъбери
        g.fillStyle = '#9a9284'; for (let k = 0; k < 3; k++) { g.fillRect(cx - w / 2 + w * (k / 3) + w * 0.06, top - r * 0.28, w * 0.2, r * 0.3); }
        g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; g.strokeRect(cx - w / 2, top, w, base - top);
        if (kind === 'gate') {
          // сводеста порта с дървени врати
          const gw = w * 0.62, gh = (base - top) * 0.7;
          g.fillStyle = '#1a1208'; g.beginPath(); g.roundRect(cx - gw / 2, base - gh, gw, gh, [gw / 2, gw / 2, 0, 0]); g.fill();
          g.fillStyle = '#6a4522'; g.beginPath(); g.roundRect(cx - gw / 2 + r * 0.06, base - gh + r * 0.06, gw - r * 0.12, gh - r * 0.06, [gw / 2, gw / 2, 0, 0]); g.fill();
          g.strokeStyle = '#c9a961'; g.lineWidth = Math.max(1, r * 0.05); g.beginPath(); g.moveTo(cx, base - gh + r * 0.1); g.lineTo(cx, base); g.moveTo(cx - gw / 2 + r * 0.1, base - gh * 0.5); g.lineTo(cx + gw / 2 - r * 0.1, base - gh * 0.5); g.stroke();
        }
        // знаме в цвета на защитника (на портата и през сегмент)
        if (kind === 'gate' || (y % 2 === 0)) { const col = this.sideColor(1); const fx = cx + (kind === 'gate' ? 0 : -w * 0.18), fy = top - r * 0.28; g.strokeStyle = '#3a2a10'; g.lineWidth = Math.max(1, r * 0.05); g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx, fy - r * 1.1); g.stroke(); g.fillStyle = col; g.beginPath(); g.moveTo(fx, fy - r * 1.1); g.lineTo(fx + r * 0.55 + Math.sin(T * 3 + y) * r * 0.06, fy - r * 0.9); g.lineTo(fx, fy - r * 0.65); g.closePath(); g.fill(); }
        // здравина
        if (maxHp) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(cx - r * 0.5, base + r * 0.05, r, r * 0.12); g.fillStyle = dmg > 0.5 ? '#ff8a60' : '#ffd870'; g.fillRect(cx - r * 0.5, base + r * 0.05, r * (hp / maxHp), r * 0.12); }
      };
      const tower = (cx, cy, big, alive, side) => {
        const tw = r * (big ? 1.7 : 1.3), th = r * (big ? 4.2 : 3.3), base = cy + r * sq * 0.9, top = base - th;
        g.save();
        if (!alive) { g.globalAlpha = 0.9; g.fillStyle = '#6a6458'; g.beginPath(); g.ellipse(cx, base, tw * 0.8, r * 0.35, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#8a8070'; for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(cx + (G.hashN(cx | 0, k, 1) - 0.5) * tw * 1.4, base - G.hashN(cx | 0, k, 2) * r * 0.5, r * 0.25, r * 0.16, k, 0, Math.PI * 2); g.fill(); } g.restore(); return; }
        // тяло на кулата (цилиндър)
        const gr = g.createLinearGradient(cx - tw / 2, 0, cx + tw / 2, 0); gr.addColorStop(0, '#c8c0b0'); gr.addColorStop(0.5, '#9a9284'); gr.addColorStop(1, '#5a544a');
        g.fillStyle = gr; g.beginPath(); g.rect(cx - tw / 2, top + r * 0.3, tw, th - r * 0.3); g.fill();
        if (stone) { g.save(); g.globalAlpha = 0.35; g.beginPath(); g.rect(cx - tw / 2, top + r * 0.3, tw, th - r * 0.3); g.clip(); g.drawImage(stone, cx - tw / 2, top, tw, th); g.restore(); }
        g.fillStyle = '#6a6458'; g.beginPath(); g.ellipse(cx, base, tw / 2, r * 0.2, 0, 0, Math.PI * 2); g.fill();
        // зъбери на върха и платформа
        g.fillStyle = '#aaa294'; g.beginPath(); g.ellipse(cx, top + r * 0.3, tw / 2 * 1.15, r * 0.22, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#8a8274'; for (let k = 0; k < 5; k++) { g.fillRect(cx - tw * 0.575 + tw * 1.15 * k / 5 + tw * 0.03, top + r * 0.05, tw * 0.13, r * 0.28); }
        // прозорче-бойница
        g.fillStyle = '#1a1208'; g.fillRect(cx - r * 0.06, top + r * 1.4, r * 0.12, r * 0.5);
        // стрелец на кулата (същество от 2-ро ниво на фракцията на защитника)
        const t = b.ctx.town; const c = t ? D.creatureOf(t.faction + '2' + (t.buildings && t.buildings.dw2u ? 'u' : '')) : null;
        if (c) { const spr = G.creatureSprite(c, 128, true); const sz = r * 1.3; g.drawImage(spr, cx - sz / 2, top + r * 0.35 - sz * 1.4 + Math.sin(T * 1.7 + cx) * r * 0.02, sz, sz * 1.4); }
        g.restore();
      };
      // сегменти на този ред
      for (let x = 0; x < Hex.W; x++) {
        const i = Hex.idx(x, y);
        if (b.walls.has(i) || (i === gateI && b.isGateIntact())) { const [cx, cy] = this.hexCenter(x, y); seg(cx, cy, i === gateI ? 'gate' : 'wall', b.wallHp[i] || 0, b.siege + (i === gateI ? 1 : 0)); }
      }
      b.towers.forEach((t) => { if (t.y !== y) return; const [cx, cy] = this.hexCenter(t.x, t.y); tower(cx, cy, t.x === 13, !t.destroyed, 1); });
    }
    hexPath(g, cx, cy, r) { const sq = this.squash || 1; g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a) * sq; if (i) g.lineTo(px, py); else g.moveTo(px, py); } g.closePath(); }
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
      if (this.canvas.clientWidth !== this._cw || this.canvas.clientHeight !== this._ch) this.resize(true); // показано/завъртяно
      const g = this.ctx, b = this.b, r = this.r, sq = this.squash || 1;
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (this.view && this.view.s !== 1) { g.translate(this.view.x, this.view.y); g.scale(this.view.s, this.view.s); }
      if (this.fieldShake) { const fs = this.fieldShake, kk = (performance.now() - fs.t0) / fs.ms; if (kk >= 1) this.fieldShake = null; else g.translate((Math.random() - 0.5) * fs.amp * (1 - kk), (Math.random() - 0.5) * fs.amp * (1 - kk)); }
      const W = this.canvas.width, H = this.canvas.height;
      const now = performance.now(), T = now / 1000;
      const Tcol = D.TERRAIN[b.terrain] || D.TERRAIN[1];
      // рисуван фон: земя, небе с хоризонт, планини и гори в далечината (кеширан)
      g.drawImage(this.backdrop(), 0, 0);
      this.drawHeroes(T); // както в класиките: в края на полето, зад мрежата и единиците
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
          // основата на стената (самата стена се рисува по-късно, подредена по дълбочина с единиците)
          g.fillStyle = 'rgba(70,64,56,0.75)'; g.fill(); continue;
        }
        if (b.rubble.has(i)) { g.fillStyle = 'rgba(60,54,48,0.7)'; g.fill(); for (let k = 0; k < 5; k++) { const rr = G.hashN(i, k, 1); g.fillStyle = MK.shade('#8a8070', 0.7 + rr * 0.6); g.beginPath(); g.ellipse(cx + (rr - 0.5) * r, cy + (G.hashN(i, k, 2) - 0.5) * r, r * 0.22, r * 0.14, rr * 3, 0, Math.PI * 2); g.fill(); } continue; }
        if (b.obstacles.has(i)) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fill(); g.drawImage(G.decor(b.terrain === 6 || b.terrain === 4 || b.terrain === 7 || b.terrain === 9 ? 2 : b.terrain === 3 ? 3 : b.terrain === 8 ? 5 : 1, (x * 3 + y) & 7, 96, b.terrain), cx - r * 1.05, cy + r * 0.95 - r * 3.36, r * 2.1, r * 3.36); continue; }
        g.fillStyle = (x + y) & 1 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)'; g.fill();
        if (b.moat.has(i)) { const sa = this.siegeArt(); const wimg = sa && sa.moat ? sa.moat : MK.Img.get('terrain/water'); if (wimg && sa && sa.moat) { g.save(); g.clip(); g.drawImage(wimg, wimg.width * 0.25, wimg.height * 0.25, wimg.width * 0.5, wimg.height * 0.5, cx - r, cy - r * sq, r * 2, r * 2 * sq); g.restore(); g.strokeStyle = 'rgba(20,40,80,0.7)'; g.lineWidth = Math.max(1, r * 0.06); g.stroke(); } else if (wimg) { g.save(); g.clip(); g.globalAlpha = 0.85; g.drawImage(wimg, ((x * 7) % 4) * wimg.width / 4, ((y * 5) % 4) * wimg.height / 4, wimg.width / 4, wimg.height / 4, cx - r, cy - r * sq, r * 2, r * 2 * sq); g.restore(); g.strokeStyle = 'rgba(20,40,80,0.7)'; g.lineWidth = Math.max(1, r * 0.06); g.stroke(); } else { const mg = g.createRadialGradient(cx, cy, 0, cx, cy, r); mg.addColorStop(0, 'rgba(40,90,160,0.75)'); mg.addColorStop(1, 'rgba(20,50,110,0.6)'); g.fillStyle = mg; g.fill(); } g.fillStyle = 'rgba(255,255,255,' + (0.15 + 0.1 * Math.sin(T * 2 + x + y)) + ')'; g.fillRect(cx - r * 0.5, cy - r * 0.1 + Math.sin(T * 3 + x) * r * 0.1, r, r * 0.06); }
        if (reach && reach.has(i) && b.canStand(cur, x, y) && !(x === cur.x && y === cur.y) && MK.Img.get('ui/hex_move')) { g.globalAlpha = 0.55; g.drawImage(MK.Img.get('ui/hex_move'), cx - r * 0.98, cy - r * 0.98, r * 1.96, r * 1.96); g.globalAlpha = 1; }
        else if (reach && reach.has(i) && b.canStand(cur, x, y) && !(x === cur.x && y === cur.y)) { const rg = g.createRadialGradient(cx, cy, r * 0.2, cx, cy, r); rg.addColorStop(0, 'rgba(120,255,80,0.08)'); rg.addColorStop(1, 'rgba(60,200,40,0.24)'); g.fillStyle = rg; g.fill(); g.strokeStyle = 'rgba(150,255,100,0.6)'; g.lineWidth = Math.max(1, r * 0.045); g.stroke(); }
        if (tactics && this.tacticsStack && b.tacticsAllowed(this.tacticsStack.side, x) && b.canStand(this.tacticsStack, x, y)) { g.fillStyle = 'rgba(255,216,112,0.18)'; g.fill(); }
        g.strokeStyle = 'rgba(190,255,120,0.28)'; g.lineWidth = 1; g.stroke();
      }
      // кулите се рисуват заедно със стените по дълбочина
      if (b.siege && b.alive(0).length) { const [cx, cy] = this.hexCenter(0, 10); const cat = MK.Img.get('battle/catapult');
        if (cat) { const cw = r * 2.4, ch = cw * cat.height / cat.width, sq2 = this.squash || 1; g.save(); g.translate(cx + cw / 2, 0); g.scale(-1, 1); g.drawImage(cat, 0, cy + r * sq2 * 0.9 - ch, cw, ch); g.restore(); }
        else { g.fillStyle = '#5a4a2a'; g.fillRect(cx - r * 0.55, cy + r * 0.2, r * 1.1, r * 0.28); g.fillStyle = '#3a2a1a'; g.beginPath(); g.arc(cx - r * 0.4, cy + r * 0.5, r * 0.16, 0, Math.PI * 2); g.arc(cx + r * 0.4, cy + r * 0.5, r * 0.16, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#6a4a2a'; g.lineWidth = r * 0.12; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - r * 0.2, cy + r * 0.2); g.lineTo(cx + r * 0.35, cy - r * 0.7); g.stroke(); g.fillStyle = '#7a7068'; g.beginPath(); g.arc(cx + r * 0.4, cy - r * 0.78, r * 0.14, 0, Math.PI * 2); g.fill(); } }
      const hi = tactics ? this.tacticsStack : (cur && cur.alive ? cur : null);
      if (hi) { const pulse = 0.6 + 0.35 * Math.sin(T * 5); b.hexes(hi).forEach(([hx, hy]) => { const p = this.hexCenter(hx, hy); const hv = MK.Img.get('ui/hex_hover'); if (hv) { g.globalAlpha = pulse; g.drawImage(hv, p[0] - r * 1.02, p[1] - r * 1.02, r * 2.04, r * 2.04); g.globalAlpha = 1; return; } this.hexPath(g, p[0], p[1], r - 1); g.strokeStyle = 'rgba(255,216,112,' + pulse + ')'; g.lineWidth = 3; g.stroke(); g.fillStyle = 'rgba(255,216,112,0.12)'; g.fill(); }); }
      if (this.pickTarget && input) { // всички посоки за удар по избраната цел
        const [tx, ty] = this.hexCenter(this.pickTarget.x, this.pickTarget.y);
        const pulse = 0.35 + 0.15 * Math.sin(T * 6);
        this.attackOpts.filter((o) => o.target === this.pickTarget && !o.ranged).forEach((o) => {
          const [fx, fy] = this.hexCenter(o.from.x, o.from.y);
          this.hexPath(g, fx, fy, r - 2); g.fillStyle = 'rgba(255,170,60,' + pulse + ')'; g.fill(); g.strokeStyle = 'rgba(255,200,90,0.95)'; g.lineWidth = 2; g.stroke();
          const ang = Math.atan2(ty - fy, tx - fx), L = Math.hypot(tx - fx, ty - fy) * 0.5;
          g.save(); g.translate(fx, fy); g.rotate(ang); g.strokeStyle = 'rgba(255,230,140,0.95)'; g.lineWidth = Math.max(2, r * 0.09); g.lineCap = 'round';
          g.beginPath(); g.moveTo(r * 0.15, 0); g.lineTo(L, 0); g.stroke(); g.beginPath(); g.moveTo(L, 0); g.lineTo(L - r * 0.3, -r * 0.24); g.lineTo(L - r * 0.3, r * 0.24); g.closePath(); g.fillStyle = 'rgba(255,230,140,0.95)'; g.fill(); g.restore();
        });
        this.hexPath(g, tx, ty, r - 1); g.strokeStyle = 'rgba(255,80,60,0.95)'; g.lineWidth = 3; g.stroke();
      } else if (this.hoverAttack && this.hoverAttack.opt && !this.hoverAttack.opt.ranged && input) {
        const o = this.hoverAttack.opt; const [fx, fy] = this.hexCenter(o.from.x, o.from.y); const [tx, ty] = this.hexCenter(o.target.x, o.target.y);
        this.hexPath(g, fx, fy, r - 2); g.fillStyle = 'rgba(255,170,60,0.45)'; g.fill(); g.strokeStyle = 'rgba(255,200,90,0.95)'; g.lineWidth = 2; g.stroke();
        const ang = Math.atan2(ty - fy, tx - fx), L = Math.hypot(tx - fx, ty - fy) * 0.55;
        g.save(); g.translate(fx, fy); g.rotate(ang); g.strokeStyle = 'rgba(255,220,120,0.95)'; g.lineWidth = Math.max(2, r * 0.1); g.lineCap = 'round';
        g.beginPath(); g.moveTo(r * 0.2, 0); g.lineTo(L, 0); g.stroke(); g.beginPath(); g.moveTo(L, 0); g.lineTo(L - r * 0.35, -r * 0.28); g.lineTo(L - r * 0.35, r * 0.28); g.closePath(); g.fillStyle = 'rgba(255,220,120,0.95)'; g.fill(); g.restore();
      }
      if (reach && cur) this.attackOpts.forEach((o) => { b.hexes(o.target).forEach(([hx, hy]) => { const [cx, cy] = this.hexCenter(hx, hy); const ha = MK.Img.get('ui/hex_attack'); if (ha && !o.ranged) { g.globalAlpha = 0.6; g.drawImage(ha, cx - r * 0.98, cy - r * 0.98, r * 1.96, r * 1.96); g.globalAlpha = 1; return; } this.hexPath(g, cx, cy, r - 2); g.fillStyle = o.ranged ? 'rgba(90,160,255,0.28)' : 'rgba(230,50,50,0.32)'; g.fill(); g.strokeStyle = o.ranged ? 'rgba(143,208,255,0.95)' : 'rgba(255,96,96,0.95)'; g.lineWidth = Math.max(2, r * 0.07); g.stroke(); }); });
      if (this.castSpell) { g.fillStyle = 'rgba(140,120,255,0.12)'; g.fillRect(0, 0, W, H - this.barH); }
      // стекове (сенки, спрайтове, ефекти, брой)
      const stacks = b.stacks.filter((s) => s.alive || this.fading[s.id]).sort((a, c) => a.y - c.y);
      let wallRow = 0;
      const drawWallsUpTo = (row) => { while (wallRow <= row && wallRow < Hex.H) { this.drawWallRow(wallRow, T); wallRow++; } };
      stacks.forEach((s) => {
        drawWallsUpTo(s.y);
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
          // Ответен удар този рунд: златно ↩ = още може да отвърне, сиво зачеркнато = вече е отвърнал
          {
            const can = s.retaliations > 0 && !s.effects.blind, rr = Math.max(6, r * 0.24);
            const cx = p[0] + Math.max(tw * 0.62, r * 0.45) + rr * 0.9, cy = p[1] + r * 0.7;
            g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.fillStyle = can ? 'rgba(40,28,8,0.92)' : 'rgba(20,20,24,0.8)'; g.fill();
            g.lineWidth = Math.max(1, rr * 0.18); g.strokeStyle = can ? '#f0cc6a' : '#6a6a72'; g.stroke();
            g.font = 'bold ' + rr * 1.35 + 'px sans-serif'; g.fillStyle = can ? '#ffe08a' : '#77777f'; g.fillText(s.retaliations > 10 ? '∞' : '↩', cx, cy + rr * 0.06);
            if (!can) { g.beginPath(); g.moveTo(cx - rr * 0.7, cy + rr * 0.7); g.lineTo(cx + rr * 0.7, cy - rr * 0.7); g.strokeStyle = '#c05050'; g.lineWidth = Math.max(1.2, rr * 0.22); g.stroke(); }
          }
        }
        g.globalAlpha = 1;
      });
      drawWallsUpTo(Hex.H - 1);
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
      // магически ефекти
      this.fx = this.fx.filter((f) => now < f.t0 + f.life);
      this.fx.forEach((f) => { const k = Math.min(1, (now - f.t0) / f.life); g.save(); try { f.draw(g, k, now); } finally { g.restore(); } });
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
      // заглавие (без мащаба)
      g.setTransform(1, 0, 0, 1, 0, 0);
      const hg = g.createLinearGradient(0, 0, 0, this.oy - r); hg.addColorStop(0, 'rgba(10,8,16,0.85)'); hg.addColorStop(1, 'rgba(10,8,16,0)'); g.fillStyle = hg; g.fillRect(0, 0, W, this.oy - r + 4);
      g.font = '600 ' + 14 * this.dpr + 'px "Segoe UI", Roboto, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillStyle = '#ffd870';
      const s0 = b.sides[0], s1 = b.sides[1];
      g.fillText((s0.hero ? s0.hero.name + '  ✦ ' + s0.mana : TR('Нападатели')), (this.fieldX || 0) + 8 * this.dpr, 6 * this.dpr);
      g.textAlign = 'right'; g.fillText((s1.hero ? s1.hero.name + '  ✦ ' + s1.mana : b.ctx.town ? b.ctx.town.name : TR('Защитници')), (this.fieldX || 0) + (this.fieldW || W) - 8 * this.dpr, 6 * this.dpr);
      g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(tactics ? TR('Тактика: подреди армията') : TR('Рунд ') + b.round, (this.fieldX || 0) + (this.fieldW || W) / 2, 6 * this.dpr);
    }
    burst(x, y, color, n, speed, size, g) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random()); this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, g: g || this.r * 1.5, t0: performance.now(), life: 400 + Math.random() * 400, color, size: size * (0.5 + Math.random()) }); } }
    /* ---------------------------------------------------------------- анимации на магиите (по духа на класиките, с повече ефекти) */
    spellVisual(sp) {
      const S = sp.id;
      const school = { fire: ['#ff8a30', '#ffd070'], water: ['#70c8ff', '#e0f6ff'], air: ['#c8d8ff', '#ffffff'], earth: ['#b8e070', '#e8ffb0'], all: ['#d0b0ff', '#ffffff'] }[sp.school] || ['#d0b0ff', '#fff'];
      const map = {
        magic_arrow: { kind: 'bolt', color: '#e0c0ff' }, ice_bolt: { kind: 'bolt', color: '#a0e0ff', ice: true }, lightning: { kind: 'sky_bolt', color: '#e8f0ff' }, chain_lightning: { kind: 'chain', color: '#e8f0ff' },
        fireball: { kind: 'fireball', color: '#ff9030' }, inferno: { kind: 'inferno', color: '#ff6020' }, meteor_shower: { kind: 'meteors', color: '#ffb060' }, frost_ring: { kind: 'frost', color: '#b0f0ff' },
        implosion: { kind: 'implode', color: '#c8ff80' }, armageddon: { kind: 'armageddon', color: '#ff7030' }, death_ripple: { kind: 'ripple', color: '#a080ff' }, destroy_undead: { kind: 'holy_wave', color: '#fff6c0' },
        cure: { kind: 'holy', color: '#a0ffb0' }, resurrection: { kind: 'holy', color: '#fff0a0', big: true }, animate_dead: { kind: 'necro', color: '#b070ff' }, dispel: { kind: 'flash', color: '#ffffff' },
        blind: { kind: 'debuff', color: '#ffe080', icon: '👁' }, slow: { kind: 'debuff', color: '#b0a080' }, curse: { kind: 'debuff', color: '#ff6060' }, weakness: { kind: 'debuff', color: '#80c0ff' }, misfortune: { kind: 'debuff', color: '#ff8080' }, sorrow: { kind: 'debuff', color: '#8080c0' }, disrupting_ray: { kind: 'bolt', color: '#ff80ff' },
        haste: { kind: 'buff', color: '#ffe080' }, bless: { kind: 'buff', color: '#ffffff' }, shield: { kind: 'buff', color: '#c0c0ff', shield: true }, air_shield: { kind: 'buff', color: '#d0f0ff', shield: true }, stone_skin: { kind: 'buff', color: '#c0b090', shield: true }, bloodlust: { kind: 'buff', color: '#ff5050' }, precision: { kind: 'buff', color: '#80ff80' }, fortune: { kind: 'buff', color: '#80ff80' }, mirth: { kind: 'buff', color: '#ffd0ff' }, anti_magic: { kind: 'buff', color: '#ff80ff', shield: true }, prayer: { kind: 'buff', color: '#fff0c0' }, slayer: { kind: 'buff', color: '#ff9040' }, counterstrike: { kind: 'buff', color: '#ffd070' }
      };
      const v = map[S] || { kind: sp.kind === 'dmg' ? 'bolt' : sp.kind === 'area' ? 'fireball' : sp.kind === 'buff' ? 'buff' : sp.kind === 'debuff' ? 'debuff' : 'flash', color: school[0] };
      v.color2 = school[1]; return v;
    }
    casterPoint(side) {
      const hr = this.heroRects().find((q) => q.side === side);
      if (hr) return [hr.x + hr.w * (side === 0 ? 0.62 : 0.38), hr.y + hr.h * 0.35];
      return [side === 0 ? this.fieldX + this.r : this.fieldX + this.fieldW - this.r, this.oy + this.r * 4];
    }
    addFx(life, draw) { const f = { t0: performance.now(), life, draw }; this.fx.push(f); return f; }
    async playSpell(sp, side, tx, ty, targets) {
      const v = this.spellVisual(sp), r = this.r, dur = (ms) => sleep(ms * (this.auto ? 0.5 : 1) / this.speed);
      const [cx, cy] = Hex.inb(tx, ty) ? this.hexCenter(tx, ty) : [this.fieldX + this.fieldW / 2, this.oy + r * 7];
      const from = this.casterPoint(side);
      const pts = (targets && targets.length ? targets : [[cx, cy]]);
      const iconImg = MK.Img.get('spells/' + sp.id);
      const showIcon = (x, y) => this.addFx(900, (g, k) => { const a = k < 0.2 ? k / 0.2 : k > 0.7 ? (1 - k) / 0.3 : 1; g.globalAlpha = a; const s = r * 0.9; if (iconImg) g.drawImage(iconImg, x - s / 2, y - r * 1.9 - k * r * 0.8 - s / 2, s, s); });
      const glow = (x, y, color, life, rise, size) => this.addFx(life, (g, k) => { const rr = (size || r) * (0.6 + 0.6 * k); const gr = g.createRadialGradient(x, y - k * (rise || 0), 0, x, y - k * (rise || 0), rr); gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = (1 - k) * 0.9; g.fillStyle = gr; g.beginPath(); g.arc(x, y - k * (rise || 0), rr, 0, Math.PI * 2); g.fill(); });
      switch (v.kind) {
        case 'bolt': {
          // светеща стрела от героя към целта с опашка, после взрив
          await this.magicBolt(from, [cx, cy - r * 0.4], v.color, v.ice);
          this.burst(cx, cy - r * 0.4, v.color, 18, r * 2.2, r * 0.1); this.rings.push({ x: cx, y: cy - r * 0.3, r0: r * 0.2, r1: r * 1.3, t0: performance.now(), life: 400, color: v.color });
          if (v.ice) this.addFx(700, (g, k) => { g.globalAlpha = 1 - k; g.strokeStyle = '#d8f4ff'; g.lineWidth = Math.max(1, r * 0.05); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.beginPath(); g.moveTo(cx, cy - r * 0.4); g.lineTo(cx + Math.cos(a) * r * (0.5 + k), cy - r * 0.4 + Math.sin(a) * r * (0.5 + k)); g.stroke(); } });
          await dur(150); break;
        }
        case 'sky_bolt': case 'chain': {
          const chain = v.kind === 'chain' ? pts : [[cx, cy]];
          let prev = [chain[0][0], -r * 2];
          for (const p of chain) {
            const a = prev, bpt = [p[0], p[1] - r * 0.5];
            this.addFx(380, (g, k) => { const seg = 9; g.globalAlpha = k < 0.15 ? 1 : 1 - (k - 0.15) / 0.85; g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(2, r * 0.09); g.shadowColor = '#a0c0ff'; g.shadowBlur = r * 0.5; g.beginPath(); g.moveTo(a[0], a[1]); for (let i = 1; i <= seg; i++) { const t = i / seg; g.lineTo(a[0] + (bpt[0] - a[0]) * t + (i < seg ? (Math.sin(i * 7.3 + k * 40) * r * 0.45) : 0), a[1] + (bpt[1] - a[1]) * t + (i < seg ? Math.cos(i * 5.1 + k * 30) * r * 0.25 : 0)); } g.stroke(); });
            this.addFx(220, (g, k) => { g.globalAlpha = (1 - k) * 0.5; g.fillStyle = '#e8f0ff'; g.fillRect(this.fieldX, 0, this.fieldW, this.canvas.height); });
            this.burst(bpt[0], bpt[1], '#e8f0ff', 14, r * 2.4, r * 0.09);
            prev = bpt; await dur(v.kind === 'chain' ? 160 : 60);
          }
          await dur(250); break;
        }
        case 'fireball': {
          await this.magicBolt(from, [cx, cy - r * 0.3], '#ff9030', false, true);
          this.addFx(650, (g, k) => { const rr = r * (0.5 + 2.6 * Math.sqrt(k)); const gr = g.createRadialGradient(cx, cy - r * 0.3, 0, cx, cy - r * 0.3, rr); gr.addColorStop(0, 'rgba(255,255,200,' + (1 - k) + ')'); gr.addColorStop(0.35, 'rgba(255,140,40,' + (0.9 - k * 0.9) + ')'); gr.addColorStop(1, 'rgba(120,20,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy - r * 0.3, rr, 0, Math.PI * 2); g.fill(); });
          this.burst(cx, cy - r * 0.3, '#ff9030', 26, r * 3, r * 0.14, -r); this.shakeField(6, 350); await dur(500); break;
        }
        case 'inferno': {
          this.addFx(900, (g, k) => { for (let i = 0; i < 18; i++) { const a = i * 0.35 + k * 2, rad = r * 2.4 * (0.3 + 0.7 * Math.sin(k * Math.PI)); const px = cx + Math.cos(a) * rad * (0.5 + 0.5 * ((i * 37) % 10) / 10), py = cy - r * 0.2 + Math.sin(a) * rad * 0.5; const h = r * (1 + 1.6 * Math.sin(k * Math.PI)) * (0.6 + ((i * 53) % 10) / 20); g.globalAlpha = 0.85 * (1 - k * k); const gr = g.createLinearGradient(px, py, px, py - h); gr.addColorStop(0, '#ff5010'); gr.addColorStop(0.5, '#ffb030'); gr.addColorStop(1, 'rgba(255,240,150,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(px - r * 0.25, py); g.quadraticCurveTo(px, py - h * 0.5, px, py - h); g.quadraticCurveTo(px, py - h * 0.5, px + r * 0.25, py); g.fill(); } });
          this.burst(cx, cy, '#ff6020', 30, r * 3.5, r * 0.12, -r * 2); this.shakeField(5, 500); await dur(800); break;
        }
        case 'meteors': {
          for (let i = 0; i < 7; i++) {
            const ox = (Math.random() - 0.5) * r * 4, oy = (Math.random() - 0.5) * r * 2.4, tx2 = cx + ox, ty2 = cy + oy;
            this.addFx(420, (g, k) => { const x = tx2 + r * 5 * (1 - k), y = ty2 - r * 9 * (1 - k); g.globalAlpha = 1; g.fillStyle = '#ffb060'; g.shadowColor = '#ff8020'; g.shadowBlur = r * 0.6; g.beginPath(); g.ellipse(x, y, r * 0.35, r * 0.25, -0.9, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(255,160,60,' + (0.6) + ')'; g.lineWidth = r * 0.25; g.beginPath(); g.moveTo(x, y); g.lineTo(x + r * 1.5, y - r * 2.7); g.stroke(); });
            setTimeout(() => { this.burst(tx2, ty2, '#ffb060', 12, r * 2.2, r * 0.12, -r); this.rings.push({ x: tx2, y: ty2, r0: r * 0.2, r1: r * 1.2, t0: performance.now(), life: 350, color: 'rgba(255,170,80,0.9)' }); this.shakeField(4, 200); }, 400 / this.speed);
            await dur(110);
          }
          await dur(500); break;
        }
        case 'frost': {
          this.addFx(800, (g, k) => { const rr = r * (1.2 + 1.6 * k); g.globalAlpha = 1 - k * k; g.strokeStyle = '#d8f8ff'; g.lineWidth = Math.max(2, r * 0.14); g.shadowColor = '#80d0ff'; g.shadowBlur = r * 0.5; g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.stroke(); for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6 + k; g.lineWidth = Math.max(1, r * 0.05); g.beginPath(); g.moveTo(cx + Math.cos(a) * rr * 0.85, cy + Math.sin(a) * rr * 0.85); g.lineTo(cx + Math.cos(a) * rr * 1.15, cy + Math.sin(a) * rr * 1.15); g.stroke(); } });
          this.burst(cx, cy, '#d8f8ff', 24, r * 2.8, r * 0.1, -r * 0.5); await dur(600); break;
        }
        case 'implode': {
          this.addFx(700, (g, k) => { const rr = r * 2.6 * (1 - k) + r * 0.2; g.globalAlpha = 0.9; g.strokeStyle = '#c8ff80'; g.lineWidth = Math.max(2, r * 0.12); g.shadowColor = '#80ff40'; g.shadowBlur = r * 0.4; g.beginPath(); g.arc(cx, cy - r * 0.3, rr, 0, Math.PI * 2); g.stroke(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + k * 3; g.beginPath(); g.moveTo(cx + Math.cos(a) * rr, cy - r * 0.3 + Math.sin(a) * rr); g.lineTo(cx + Math.cos(a) * rr * 0.3, cy - r * 0.3 + Math.sin(a) * rr * 0.3); g.stroke(); } });
          await dur(600); this.burst(cx, cy - r * 0.3, '#c8ff80', 30, r * 3.5, r * 0.12); this.shakeField(8, 400); await dur(250); break;
        }
        case 'armageddon': {
          this.addFx(1400, (g, k) => { g.globalAlpha = k < 0.3 ? k / 0.3 * 0.85 : 0.85 * (1 - (k - 0.3) / 0.7); const gr = g.createLinearGradient(0, 0, 0, this.canvas.height); gr.addColorStop(0, '#ff9030'); gr.addColorStop(1, '#600'); g.fillStyle = gr; g.fillRect(this.fieldX, 0, this.fieldW, this.canvas.height); });
          for (let i = 0; i < 16; i++) { const tx2 = this.fieldX + Math.random() * this.fieldW, ty2 = this.oy + Math.random() * r * 15; setTimeout(() => { this.burst(tx2, ty2, '#ffb060', 14, r * 2.6, r * 0.14, -r); this.shakeField(6, 250); }, (i * 60) / this.speed); }
          await dur(1300); break;
        }
        case 'ripple': case 'holy_wave': {
          const col = v.kind === 'ripple' ? 'rgba(160,120,255,' : 'rgba(255,246,190,';
          this.addFx(1000, (g, k) => { const cxx = this.fieldX + this.fieldW / 2, cyy = this.oy + r * 7; for (let i = 0; i < 3; i++) { const kk = Math.max(0, k - i * 0.15); const rr = r * 16 * kk; g.globalAlpha = 1; g.strokeStyle = col + (1 - kk) + ')'; g.lineWidth = Math.max(2, r * 0.3 * (1 - kk)); g.beginPath(); g.ellipse(cxx, cyy, rr, rr * 0.55, 0, 0, Math.PI * 2); g.stroke(); } });
          await dur(900); break;
        }
        case 'holy': case 'necro': {
          for (const [px, py] of pts) {
            const col = v.kind === 'necro' ? 'rgba(176,112,255,' : 'rgba(255,250,200,';
            this.addFx(900, (g, k) => { const w = r * 0.9 * (1 - Math.abs(k - 0.5) * 2 * 0.5); g.globalAlpha = k < 0.15 ? k / 0.15 : k > 0.7 ? (1 - k) / 0.3 : 1; const gr = g.createLinearGradient(px, py - r * 8, px, py + r * 0.5); gr.addColorStop(0, col + '0)'); gr.addColorStop(0.6, col + '0.75)'); gr.addColorStop(1, col + '0.2)'); g.fillStyle = gr; g.fillRect(px - w / 2, py - r * 8, w, r * 8.5); });
            glow(px, py + r * 0.2, v.color, 900, r * 1.5, r * 1.3);
            this.burst(px, py, v.color, 16, r * 1.2, r * 0.09, -r * 2.5); showIcon(px, py);
          }
          await dur(700); break;
        }
        case 'flash': { for (const [px, py] of pts) { this.rings.push({ x: px, y: py - r * 0.4, r0: r * 0.3, r1: r * 1.6, t0: performance.now(), life: 450, color: 'rgba(255,255,255,0.95)' }); glow(px, py - r * 0.4, '#fff', 400, 0, r); } await dur(350); break; }
        case 'buff': case 'debuff': {
          const up = v.kind === 'buff';
          for (const [px, py] of pts) {
            // мек ореол + издигащи се (или спускащи се) искри + иконата на магията
            glow(px, py - r * 0.3, v.color, 800, up ? r * 0.8 : -r * 0.6, r * 1.1);
            this.addFx(800, (g, k) => { for (let i = 0; i < 10; i++) { const a = i * 0.63 + k * 2, rad = r * 0.75; const yy = py - r * 0.4 + (up ? -k * r * 1.8 : k * r * 1.2) + Math.sin(a * 2) * r * 0.2; g.globalAlpha = (1 - k) * 0.9; g.fillStyle = i % 2 ? v.color : v.color2; g.beginPath(); g.arc(px + Math.cos(a) * rad, yy, r * 0.07, 0, Math.PI * 2); g.fill(); } });
            if (v.shield) this.addFx(900, (g, k) => { g.globalAlpha = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8; g.strokeStyle = v.color; g.lineWidth = Math.max(2, r * 0.1); g.shadowColor = v.color; g.shadowBlur = r * 0.4; g.beginPath(); g.ellipse(px, py - r * 0.5, r * 0.9, r * 1.2, 0, 0, Math.PI * 2); g.stroke(); });
            if (!up) this.addFx(800, (g, k) => { g.globalAlpha = 0.5 * (1 - k); g.fillStyle = '#000'; g.beginPath(); g.ellipse(px, py - r * 0.5, r * 0.9, r * 1.2, 0, 0, Math.PI * 2); g.fill(); });
            showIcon(px, py);
          }
          await dur(550); break;
        }
        default: { glow(cx, cy, v.color, 500, 0, r); await dur(300); }
      }
    }
    /* Светещ снаряд с опашка от героя към целта */
    async magicBolt(from, to, color, ice, fire) {
      const r = this.r, d = 380 * (this.auto ? 0.5 : 1) / this.speed;
      const f = this.addFx(d + 120, (g, k) => { const kk = Math.min(1, k * (d + 120) / d); const x = from[0] + (to[0] - from[0]) * kk, y = from[1] + (to[1] - from[1]) * kk - Math.sin(kk * Math.PI) * r * 1.2; g.globalAlpha = 1; for (let i = 6; i >= 0; i--) { const t2 = Math.max(0, kk - i * 0.035); const tx = from[0] + (to[0] - from[0]) * t2, ty = from[1] + (to[1] - from[1]) * t2 - Math.sin(t2 * Math.PI) * r * 1.2; const gr = g.createRadialGradient(tx, ty, 0, tx, ty, r * (fire ? 0.45 : 0.3) * (1 - i * 0.12)); gr.addColorStop(0, i === 0 ? '#fff' : color); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = 1 - i * 0.13; g.fillStyle = gr; g.beginPath(); g.arc(tx, ty, r * (fire ? 0.5 : 0.32), 0, Math.PI * 2); g.fill(); } if (ice) { g.strokeStyle = '#e8ffff'; g.lineWidth = Math.max(1, r * 0.04); for (let i = 0; i < 3; i++) { const a = i * 1.05 + kk * 6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5); g.stroke(); } } });
      await sleep(d);
      this.fx = this.fx.filter((q) => q !== f);
    }
    shakeField(amp, ms) { this.fieldShake = { amp: amp * this.dpr, t0: performance.now(), ms }; }
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
            if (e.luck > 0) this.floats.push({ x: tp[0], y: tp[1] - this.r * 1.4, text: TR('Късмет!'), color: '#ffe070', t: performance.now() });
            if (e.deathBlow) this.floats.push({ x: tp[0], y: tp[1] - this.r * 1.4, text: TR('Смъртоносен удар!'), color: '#ff4040', t: performance.now() });
            await sleep((e.retaliation ? 220 : 300) * fast / this.speed);
            delete this.flash[tgt.id]; delete this.shake[tgt.id];
            break;
          }
          case 'heal': { const s = st(e.stack); const [cx, cy] = this.stackCenter(s); this.burst(cx, cy - this.r * 0.5, 'rgba(120,255,140,0.9)', 12, this.r * 1.2, this.r * 0.1, -this.r * 2); this.floats.push({ x: cx, y: cy - this.r * 0.6, text: '+' + e.amount, color: '#80ff80', t: performance.now() }); await sleep(260 * fast); break; }
          case 'rebirth': { const s = st(e.stack); const [cx, cy] = this.stackCenter(s); delete this.fading[s.id]; this.rings.push({ x: cx, y: cy - this.r * 0.3, r0: 0, r1: this.r * 2.5, t0: performance.now(), life: 600, color: 'rgba(255,170,60,0.9)' }); this.burst(cx, cy, 'rgba(255,160,40,0.9)', 30, this.r * 3, this.r * 0.14, -this.r); this.floats.push({ x: cx, y: cy - this.r, text: TR('Прераждане!'), color: '#ffb040', t: performance.now(), big: true }); await sleep(500 * fast); break; }
          case 'stare': { const s = st(e.stack); const [cx, cy] = this.stackCenter(s); this.burst(cx, cy - this.r * 0.4, 'rgba(160,255,200,0.9)', 16, this.r * 1.5, this.r * 0.1); this.floats.push({ x: cx, y: cy - this.r, text: TR('Смъртоносен поглед ☠') + e.kills, color: '#c0ffc0', t: performance.now() }); await sleep(300 * fast); break; }
          case 'catapult': { const [cx, cy] = this.hexCenter(e.idx % Hex.W, Math.floor(e.idx / Hex.W)); await this.projectile(this.hexCenter(0, 10), [cx, cy], 'rock'); this.burst(cx, cy, 'rgba(160,150,130,0.9)', 18, this.r * 2.5, this.r * 0.14); this.shakeScreen = performance.now(); this.floats.push({ x: cx, y: cy - this.r * 0.5, text: e.destroyed ? (e.gate ? TR('Портата пада!') : TR('Стената пада!')) : TR('Удар по стената'), color: '#ffd870', t: performance.now(), big: e.destroyed }); await sleep(350 * fast); break; }
          case 'death': { const s = st(e.stack); const [cx, cy] = this.stackCenter(s); this.burst(cx, cy, 'rgba(90,80,70,0.7)', 14, this.r * 1.5, this.r * 0.16, this.r); const t0 = performance.now(), dur = 450 * fast; while (performance.now() - t0 < dur) { this.fading[s.id] = 1 - (performance.now() - t0) / dur; await sleep(16); } delete this.fading[s.id]; break; }
          case 'morale': { const s = st(e.stack); const [cx, cy] = this.stackCenter(s); this.floats.push({ x: cx, y: cy - this.r, text: e.good ? TR('Висок морал!') : TR('Лош морал'), color: e.good ? '#ffe070' : '#a0a0a0', t: performance.now() }); if (e.good) this.burst(cx, cy - this.r, 'rgba(255,224,112,0.9)', 10, this.r, this.r * 0.08, -this.r); await sleep(400 * fast); break; }
          case 'cast': { const sd = b.sides[e.side]; const [cx, cy] = Hex.inb(e.x, e.y) ? this.hexCenter(e.x, e.y) : [this.canvas.width / 2, this.oy + this.r * 7]; const sp = D.spellById[e.spell];
            { const tg = (e.targets || []).map((id) => st(id)).filter(Boolean).map((s) => this.stackCenter(s)); this.floats.push({ x: this.casterPoint(e.side)[0], y: this.casterPoint(e.side)[1] - this.r, text: sp.name, color: '#e0c8ff', t: performance.now(), big: true }); await this.playSpell(sp, e.side, e.x, e.y, tg); } const col = sp.school === 'fire' ? 'rgba(255,120,40,0.9)' : sp.school === 'water' ? 'rgba(100,180,255,0.9)' : sp.school === 'earth' ? 'rgba(160,220,100,0.9)' : 'rgba(190,160,255,0.9)'; this.rings.push({ x: cx, y: cy, r0: this.r * 0.3, r1: this.r * (sp.kind === 'all' ? 9 : sp.kind === 'area' ? 2.6 : 1.4), t0: performance.now(), life: 550, color: col }); this.burst(cx, cy, col, 16, this.r * 2, this.r * 0.12, -this.r * 0.5); this.floats.push({ x: this.canvas.width / 2, y: this.oy + this.r * 0.5, text: '✦ ' + sp.name + ' ✦', color: '#d8c0ff', t: performance.now(), big: true }); await sleep(380 * fast); break; }
          case 'effect': { const s = st(e.stack); if (s) { const [cx, cy] = this.stackCenter(s); this.burst(cx, cy - this.r * 0.6, 'rgba(200,170,255,0.9)', 8, this.r, this.r * 0.08, -this.r * 1.5); } await sleep(120 * fast); break; }
          case 'resist': case 'immune': { const s = st(e.stack); const [cx, cy] = this.stackCenter(s); this.rings.push({ x: cx, y: cy - this.r * 0.4, r0: this.r * 0.8, r1: this.r * 1.1, t0: performance.now(), life: 350, color: 'rgba(255,255,255,0.9)' }); this.floats.push({ x: cx, y: cy - this.r * 0.6, text: e.type === 'resist' ? TR('Устоява!') : TR('Имунитет'), color: '#fff', t: performance.now() }); await sleep(250 * fast); break; }
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
      const btns = UI.el('div', { class: 'btns' });
      const pages = UI.el('div', { class: 'pages' }, UI.el('div', { class: 'page' }, btns), UI.el('div', { class: 'page' }, UI.el('div', { class: 'tiny', style: 'padding:2px 4px' }, TR('История')), log));
      bar.appendChild(pages);
      bar.appendChild(UI.el('div', { class: 'dots' }, UI.el('i', { class: 'on' }), UI.el('i')));
      pages.addEventListener('scroll', () => { const on = pages.scrollLeft > pages.clientWidth / 2; bar.querySelectorAll('.dots i').forEach((d, i) => d.classList.toggle('on', (i === 1) === on)); }, { passive: true });
      requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; }); // най-новото е най-долу
      const ico = (name, txt) => { const u = MK.Img.url('ui/' + name); return u ? [UI.el('img', { src: u, class: 'btn-ico', alt: '' }), ' ' + txt] : [txt]; };
      const mk = (label, fn, dis, cls) => btns.appendChild(UI.el('button', { class: cls || '', disabled: dis ? 'disabled' : null, onclick: fn }, ...(Array.isArray(label) ? label : [label])));
      if (this.state === 'tactics') {
        btns.appendChild(UI.el('div', { class: 'tiny' }, TR('Докосни свой стек, после хекс в осветената зона.')));
        mk(TR('✔ Готово'), () => this.resolveTactics(), false, 'primary');
        return;
      }
      const canAct = this.state === 'input' && cur && this.isHuman(cur.side) && !this.auto;
      const side = cur ? cur.side : this.humans[0];
      if (cur && canAct) btns.appendChild(UI.el('button', { class: 'small', onclick: () => UI.creatureInfo(cur.c) }, cur.c.name + ' ×' + cur.count + (cur.shots ? ' 🏹' + cur.shots : '')));
      mk(ico('icon_wait', TR('Чакай')), () => this.act(() => b.doWait(cur)), !canAct || (cur && cur.waited));
      mk(ico('icon_defend', TR('Защита')), () => this.act(() => b.doDefend(cur)), !canAct);
      mk(ico('icon_spellbook', TR('Магия')), () => this.openSpellbook(side), !canAct || !b.canCast(side));
      mk(this.auto ? TR('⏸ Ръчно') : TR('⚡ Авто'), () => { this.auto = !this.auto; if (this.auto && this.state === 'input' && cur) this.resolveInput({ auto: true }); this.renderBar(); }, !this.humans.length);
      mk(TR('🏳 Бягство'), () => this.retreat(side), !canAct || !b.canRetreat(side), 'danger');
      mk(TR('💰 Предаване'), () => this.surrender(side), !canAct || !b.canSurrender(side), 'danger');
      mk(this.speed > 1 ? '⏩' : '▶', () => { this.speed = this.speed > 1 ? 1 : 3; this.renderBar(); });
    }
    act(fn) { if (this.state !== 'input') return; if (fn() !== false) this.resolveInput({}); }
    async retreat(side) {
      const ok = await UI.dialog({ title: TR('Бягство'), text: TR('Героят ще избяга, армията ще бъде изгубена, но той ще може да бъде нает отново в таверна. Сигурен ли си?'), buttons: [{ label: TR('Не'), value: false }, { label: TR('Бягай'), value: true, cls: 'danger' }] });
      if (ok && this.state === 'input') { this.b.doRetreat(side); this.resolveInput({}); }
    }
    async surrender(side) {
      const cost = this.b.surrenderCost(side);
      const p = this.game && this.game.world.players[this.b.sides[side].owner];
      const ok = await UI.dialog({ title: TR('Предаване'), text: TR('Срещу ') + cost + TR(' злато врагът ще пусне героя с цялата му армия. Той ще чака в таверна. ') + (p && p.res.gold < cost ? TR('Нямаш толкова злато.') : TR('Приемаш ли?')), buttons: [{ label: TR('Не'), value: false }, { label: TR('Предай се'), value: true, cls: 'danger' }] });
      if (ok && this.state === 'input') { if (!this.b.doSurrender(side)) { UI.toast(TR('Предаването не е възможно.')); return; } this.resolveInput({}); }
    }
    tap(e) {
      const rect = this.canvas.getBoundingClientRect();
      const [px, py] = this.toField((e.clientX - rect.left) * this.dpr, (e.clientY - rect.top) * this.dpr);
      const h = this.pixelToHex(px, py);
      if (!h) {
        const hr = this.heroRects().find((q) => px >= q.x && px <= q.x + q.w && py >= q.y && py <= q.y + q.h);
        if (hr) { const side = hr.side; if (this.isHuman(side) && this.state === 'input' && this.b.current && this.b.current.side === side && this.b.canCast(side)) this.openSpellbook(side); else if (this.game) UI.heroQuickInfo(this.game, hr.hero); }
        return;
      }
      const b = this.b;
      const [x, y] = h;
      const target = b.occupant(x, y);
      if (this.state === 'tactics') {
        if (target && target.side === b.tacticsSide) { this.tacticsStack = target; return; }
        if (this.tacticsStack && !target) { if (!b.placeStack(this.tacticsStack, x, y)) UI.toast(TR('Не може там.')); }
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
      // избрана цел за близък бой: осветени са всички хексове, откъдето може да се удари — докосни един от тях
      if (this.pickTarget) {
        const o = this.attackOpts.find((q) => q.target === this.pickTarget && !q.ranged && q.from.x === x && q.from.y === y);
        if (o) { this.pickTarget = null; b.doAttack(cur, o.target, o.from.x, o.from.y); this.resolveInput({}); return; }
        if (target === this.pickTarget) { const d = this.chooseAttackOpt(target, px, py); this.pickTarget = null; if (d) { b.doAttack(cur, target, d.from.x, d.from.y); this.resolveInput({}); } return; }
        this.pickTarget = null; // друго докосване: отказ и обичайна обработка
      }
      if (target && target.side !== cur.side) {
        const ranged = this.attackOpts.find((o) => o.target === target && o.ranged);
        if (ranged) { b.doShoot(cur, target); this.resolveInput({}); return; }
        const opts = this.attackOpts.filter((o) => o.target === target && !o.ranged);
        if (!opts.length) { UI.toast(TR('Не можеш да стигнеш до тази цел.')); return; }
        if (opts.length === 1) { b.doAttack(cur, target, opts[0].from.x, opts[0].from.y); this.resolveInput({}); return; }
        this.pickTarget = target; this.hint(TR('Избери откъде да удариш — докосни осветен хекс.'));
        return;
      }
      if (target && target.side === cur.side) { UI.creatureInfo(target.c); return; }
      if (this.reach.has(Hex.idx(x, y)) && b.canStand(cur, x, y) && !(x === cur.x && y === cur.y)) { b.doMove(cur, x, y); cur.acted = true; cur.actionKind = 'move'; this.resolveInput({}); }
    }
    /* Избор откъде да се удари: от възможните съседни хексове се взима този, чиято посока спрямо
       центъра на целта е най-близка до посоката на курсора/докосването */
    chooseAttackOpt(target, px, py) {
      const opts = this.attackOpts.filter((o) => o.target === target && !o.ranged);
      if (!opts.length) return null;
      const [cx, cy] = this.hexCenter(target.x, target.y);
      const a = Math.atan2(py - cy, px - cx);
      let best = null, bd = Infinity;
      opts.forEach((o) => { const [fx, fy] = this.hexCenter(o.from.x, o.from.y); let d = Math.abs(Math.atan2(fy - cy, fx - cx) - a); if (d > Math.PI) d = 2 * Math.PI - d; if (d < bd) { bd = d; best = o; } });
      return best;
    }
    updateHoverAttack(px, py) {
      const h = this.pixelToHex(px, py);
      let ha = null;
      if (h && this.state === 'input' && this.b.current && !this.castSpell) {
        const t = this.b.occupant(h[0], h[1]);
        if (t && t.side !== this.b.current.side) { const ranged = this.attackOpts.find((o) => o.target === t && o.ranged); const opt = ranged || this.chooseAttackOpt(t, px, py); if (opt) ha = { target: t, opt, px, py }; }
      }
      const changed = !!ha !== !!this.hoverAttack || (ha && this.hoverAttack && (ha.opt !== this.hoverAttack.opt));
      this.hoverAttack = ha;
      if (changed || !ha) this.canvas.style.cursor = ha ? (ha.opt.ranged ? 'crosshair' : 'pointer') : '';
    }
    hint(t) { const el = this.bar.querySelector('.log'); if (el && t) el.innerHTML = '<b style="color:#c0a0ff">' + t + '</b>'; }
    openSpellbook(side) {
      const b = this.b, sd = b.sides[side];
      const content = UI.el('div', { class: 'spellbook' });
      sd.spells.map((id) => D.spellById[id]).sort((a, c) => a.level - c.level).forEach((sp) => {
        const cost = b.spellCost(side, sp);
        const dis = cost > sd.mana;
        const lvl = b.schoolLevel(sd, sp);
        content.appendChild(UI.el('div', { class: 'spell school-' + sp.school + (dis ? ' dis' : ''), onclick: () => { if (dis) return; wrap.remove(); this.beginCast(side, sp); } }, UI.el('b', null, sp.name), UI.el('small', null, D.SCHOOL_NAME[sp.school] + ' · ' + cost + TR(' мана') + (lvl ? ' · ' + D.SKILL_LEVEL_NAME[lvl] : '')), UI.el('div', { class: 'tiny' }, sp.desc)));
      });
      const wrap = UI.el('div', { class: 'modal-wrap' }, UI.el('div', { class: 'modal', style: 'max-width:640px' }, UI.el('h2', null, TR('Книга с магии (мана ') + sd.mana + ')'), content, UI.el('div', { class: 'buttons' }, UI.el('button', { onclick: () => wrap.remove() }, TR('Затвори')))));
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
      this.castSpell = sp; this.renderBar(); this.hint(TR('Избери цел за „') + sp.name + TR('“ (докосни хекс)'));
    }
    prepareInput(cur) { this.reach = this.b.reach(cur); this.attackOpts = this.b.attackOptions(cur, this.reach); this.hoverAttack = null; this.pickTarget = null; }
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
      const cas = (side) => b.stacks.filter((s) => s.side === side && s.origCount - s.count > 0).map((s) => (s.origCount - s.count) + ' ' + s.c.name).join(', ') || TR('няма');
      const title = humanSide < 0 ? TR('Битката приключи') : humanWon ? TR('Победа!') : res.surrendered !== undefined ? TR('Предаване') : res.retreated !== undefined ? TR('Отстъпление') : TR('Поражение');
      await UI.dialog({ title, content: UI.el('div', null, UI.el('p', null, (res.winner === 'att' ? TR('Нападателите') : TR('Защитниците')) + TR(' печелят след ') + res.rounds + TR(' рунда.')), UI.el('p', { class: 'tiny' }, TR('Загуби на нападателите: ') + cas(0)), UI.el('p', { class: 'tiny' }, TR('Загуби на защитниците: ') + cas(1))) });
    }
    destroy() {
      this.running = false; cancelAnimationFrame(this.raf);
      window.removeEventListener('resize', this.onResize);
      if (this.ro) this.ro.disconnect();
      this.canvas.removeEventListener('pointerup', this.onPointer); this.canvas.removeEventListener('pointermove', this.onHover); this.canvas.removeEventListener('pointerdown', this.onDown); this.canvas.removeEventListener('pointermove', this.onMove2); this.canvas.removeEventListener('pointercancel', this.onPointer); this.canvas.removeEventListener('wheel', this.onWheel); this.canvas.style.cursor = '';
      this.canvas.hidden = true; this.bar.hidden = true; this.bar.innerHTML = '';
      if (this.hudWasVisible) document.getElementById('hud').hidden = false;
    }
  }
  MK.BattleUI = { run: (battle, humanSides, game) => new BattleUI(battle, Array.isArray(humanSides) ? humanSides : humanSides < 0 ? [] : [humanSides], game).run() };
})();
