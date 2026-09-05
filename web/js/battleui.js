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
      this.floats = []; this.flash = {}; this.animPos = {};
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
      const availW = this.canvas.width - 20 * dpr, availH = this.canvas.height - barH - 30 * dpr;
      this.r = Math.max(4, Math.min(availW / (Math.sqrt(3) * (Hex.W + 0.5)), availH / (1.5 * (Hex.H - 1) + 2)));
      this.ox = (this.canvas.width - Math.sqrt(3) * this.r * (Hex.W + 0.5)) / 2 + Math.sqrt(3) * this.r / 2;
      this.oy = 26 * dpr + this.r;
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
    draw() {
      const g = this.ctx, b = this.b, r = this.r;
      const W = this.canvas.width, H = this.canvas.height;
      const T = D.TERRAIN[b.terrain] || D.TERRAIN[1];
      g.fillStyle = MK.shade(T.col, 0.55); g.fillRect(0, 0, W, H);
      g.fillStyle = MK.shade(T.col, 0.8); g.fillRect(0, 0, W, this.oy - r);
      const cur = b.current;
      const input = this.state === 'input' && cur;
      const tactics = this.state === 'tactics';
      const reach = input ? this.reach : null;
      for (let y = 0; y < Hex.H; y++) for (let x = 0; x < Hex.W; x++) {
        const [cx, cy] = this.hexCenter(x, y);
        const i = Hex.idx(x, y);
        this.hexPath(g, cx, cy, r - 1);
        if (b.walls.has(i) || (i === Hex.idx(10, 5) && b.isGateIntact())) {
          const gate = i === Hex.idx(10, 5);
          g.fillStyle = gate ? '#6a4a2a' : '#8a8070'; g.fill();
          if (!gate) { g.fillStyle = '#6a6050'; g.fillRect(cx - r * 0.5, cy - r * 0.7, r, r * 0.25); g.fillRect(cx - r * 0.5, cy + 0.1 * r, r, r * 0.25); }
          else { g.fillStyle = '#3a2a1a'; g.fillRect(cx - r * 0.3, cy - r * 0.6, r * 0.6, r * 1.2); g.fillStyle = '#c9a961'; g.fillRect(cx - r * 0.3, cy - r * 0.1, r * 0.6, r * 0.08); }
          const hp = b.wallHp[i]; if (hp) { g.fillStyle = '#fff'; g.font = Math.max(8, r * 0.3) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('■'.repeat(hp), cx, cy + r * 0.75); }
          continue;
        }
        if (b.rubble.has(i)) { g.fillStyle = '#5a5048'; g.fill(); g.fillStyle = '#7a7068'; g.fillRect(cx - r * 0.4, cy - r * 0.1, r * 0.35, r * 0.25); g.fillRect(cx + r * 0.05, cy + r * 0.15, r * 0.3, r * 0.2); continue; }
        if (b.obstacles.has(i)) { g.fillStyle = MK.shade(T.col, 0.7); g.fill(); g.drawImage(G.decor(b.terrain === 6 || b.terrain === 4 || b.terrain === 7 || b.terrain === 9 ? 2 : b.terrain === 3 ? 3 : b.terrain === 8 ? 5 : 1, (x * 3 + y) & 7, 64, b.terrain), cx - r * 0.9, cy - r * 1.1, r * 1.8, r * 1.8); continue; }
        g.fillStyle = (x + y) & 1 ? T.col : T.col2; g.fill();
        if (b.moat.has(i)) { g.fillStyle = 'rgba(40,80,140,0.6)'; g.fill(); }
        if (reach && reach.has(i) && b.canStand(cur, x, y) && !(x === cur.x && y === cur.y)) { g.fillStyle = 'rgba(255,255,255,0.16)'; g.fill(); }
        if (tactics && this.tacticsStack && b.tacticsAllowed(this.tacticsStack.side, x) && b.canStand(this.tacticsStack, x, y)) { g.fillStyle = 'rgba(255,216,112,0.18)'; g.fill(); }
        g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; g.stroke();
      }
      b.towers.forEach((t) => { const [cx, cy] = this.hexCenter(t.x, t.y); g.fillStyle = '#7a7060'; g.fillRect(cx - r * 0.35, cy - r * 0.9, r * 0.7, r * 1.3); g.fillStyle = '#5a5040'; g.fillRect(cx - r * 0.45, cy - r * 1.0, r * 0.9, r * 0.2); });
      if (b.siege && b.alive(0).length) { const [cx, cy] = this.hexCenter(0, 10); g.fillStyle = '#5a4a2a'; g.fillRect(cx - r * 0.5, cy + r * 0.2, r, r * 0.3); g.strokeStyle = '#3a2a1a'; g.lineWidth = r * 0.12; g.beginPath(); g.moveTo(cx - r * 0.2, cy + r * 0.2); g.lineTo(cx + r * 0.3, cy - r * 0.6); g.stroke(); }
      // текущ стек, цели, тактика
      const hi = tactics ? this.tacticsStack : (cur && cur.alive ? cur : null);
      if (hi) { b.hexes(hi).forEach(([hx, hy]) => { const p = this.hexCenter(hx, hy); this.hexPath(g, p[0], p[1], r - 1); g.strokeStyle = '#ffd870'; g.lineWidth = 3; g.stroke(); }); }
      if (reach && cur) this.attackOpts.forEach((o) => { b.hexes(o.target).forEach(([hx, hy]) => { const [cx, cy] = this.hexCenter(hx, hy); this.hexPath(g, cx, cy, r - 2); g.strokeStyle = o.ranged ? '#8fd0ff' : '#ff6060'; g.lineWidth = 2.5; g.stroke(); }); });
      if (this.castSpell) { g.fillStyle = 'rgba(140,120,255,0.12)'; g.fillRect(0, 0, W, H - this.barH); }
      // стекове
      const stacks = b.stacks.filter((s) => s.alive).sort((a, c) => a.y - c.y);
      stacks.forEach((s) => {
        const p = this.animPos[s.id] || this.stackCenter(s);
        const size = r * (s.wide ? 2.6 : 1.9);
        const flip = s.side === 1;
        const col = this.sideColor(s.side);
        g.fillStyle = col; g.globalAlpha = 0.5; g.beginPath(); g.ellipse(p[0], p[1] + r * 0.6, r * (s.wide ? 1.2 : 0.6), r * 0.22, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
        if (this.flash[s.id]) g.globalAlpha = 0.5 + 0.5 * Math.sin(performance.now() / 40);
        g.drawImage(G.creatureSprite(s.c, 64, flip), p[0] - size / 2, p[1] - size * 0.75 + (s.wide ? r * 0.3 : 0), size, size);
        g.globalAlpha = 1;
        const effs = Object.keys(s.effects);
        if (effs.length) { g.font = Math.max(8, r * 0.32) + 'px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(effs.map((e) => EFFECT_ICON[e] || '•').join(''), p[0], p[1] - r * 1.05); }
        const txt = String(s.count);
        g.font = 'bold ' + Math.max(10, r * 0.42) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        const tw = g.measureText(txt).width + r * 0.4;
        g.fillStyle = col; g.fillRect(p[0] - tw / 2, p[1] + r * 0.45, tw, r * 0.5);
        g.strokeStyle = '#000'; g.lineWidth = 1; g.strokeRect(p[0] - tw / 2, p[1] + r * 0.45, tw, r * 0.5);
        g.fillStyle = '#fff'; g.fillText(txt, p[0], p[1] + r * 0.7);
      });
      const now = performance.now();
      this.floats = this.floats.filter((f) => now - f.t < 1100);
      this.floats.forEach((f) => { const k = (now - f.t) / 1100; g.globalAlpha = 1 - k; g.font = 'bold ' + Math.max(12, r * 0.55) + 'px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#000'; g.fillText(f.text, f.x + 1, f.y - k * r * 1.5 + 1); g.fillStyle = f.color; g.fillText(f.text, f.x, f.y - k * r * 1.5); g.globalAlpha = 1; });
      g.font = 'bold ' + 14 * this.dpr + 'px sans-serif'; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillStyle = '#ffd870';
      const s0 = b.sides[0], s1 = b.sides[1];
      g.fillText((s0.hero ? s0.hero.name + ' (мана ' + s0.mana + ')' : 'Нападатели'), 8 * this.dpr, 6 * this.dpr);
      g.textAlign = 'right'; g.fillText((s1.hero ? s1.hero.name + ' (мана ' + s1.mana + ')' : b.ctx.town ? b.ctx.town.name : 'Защитници'), W - 8 * this.dpr, 6 * this.dpr);
      g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(tactics ? 'Тактика: подреди армията' : 'Рунд ' + b.round, W / 2, 6 * this.dpr);
    }

    // ------------------------------------------------------------ анимации
    async playEvents() {
      const b = this.b;
      const evs = b.events.splice(0, b.events.length);
      const fast = this.auto ? 0.35 : 1;
      for (const e of evs) {
        const st = (id) => b.stacks[id];
        switch (e.type) {
          case 'move': {
            const s = st(e.stack); const path = e.path;
            const per = (e.fly ? 260 : 120) * fast / this.speed;
            const center = (x, y) => { const hs = b.hexesAt(s, x, y); let cx = 0, cy = 0; hs.forEach(([hx, hy]) => { const c = this.hexCenter(hx, hy); cx += c[0]; cy += c[1]; }); return [cx / hs.length, cy / hs.length]; };
            for (let k = 1; k < path.length; k++) {
              const [ax, ay] = center(path[k - 1][0], path[k - 1][1]), [bx, by] = center(path[k][0], path[k][1]);
              const t0 = performance.now();
              while (performance.now() - t0 < per) { const t = (performance.now() - t0) / per; this.animPos[s.id] = [ax + (bx - ax) * t, ay + (by - ay) * t - (e.fly ? Math.sin(t * Math.PI) * this.r : 0)]; await sleep(16); }
            }
            delete this.animPos[s.id];
            break;
          }
          case 'hit': case 'spellHit': case 'tower': {
            const tgt = st(e.type === 'hit' ? e.to : e.type === 'tower' ? e.target : e.stack);
            const [cx, cy] = this.stackCenter(tgt);
            this.flash[tgt.id] = 1;
            this.floats.push({ x: cx, y: cy - this.r * 0.5, text: '-' + e.dmg + (e.kills ? ' ☠' + e.kills : ''), color: e.luck > 0 ? '#ffe070' : e.type === 'spellHit' ? '#c0a0ff' : e.fire ? '#ff9040' : '#ff8080', t: performance.now() });
            if (e.luck > 0) this.floats.push({ x: cx, y: cy - this.r * 1.2, text: 'Късмет!', color: '#ffe070', t: performance.now() });
            if (e.deathBlow) this.floats.push({ x: cx, y: cy - this.r * 1.2, text: 'Смъртоносен удар!', color: '#ff4040', t: performance.now() });
            await sleep(e.retaliation ? 260 * fast : 320 * fast);
            delete this.flash[tgt.id];
            break;
          }
          case 'heal': { const s = st(e.stack); const [cx, cy] = this.stackCenter(s); this.floats.push({ x: cx, y: cy - this.r * 0.5, text: '+' + e.amount, color: '#80ff80', t: performance.now() }); await sleep(250 * fast); break; }
          case 'rebirth': { const s = st(e.stack); const [cx, cy] = this.stackCenter(s); this.floats.push({ x: cx, y: cy - this.r, text: 'Прераждане!', color: '#ffb040', t: performance.now() }); await sleep(400 * fast); break; }
          case 'stare': { const s = st(e.stack); const [cx, cy] = this.stackCenter(s); this.floats.push({ x: cx, y: cy - this.r, text: 'Смъртоносен поглед ☠' + e.kills, color: '#c0ffc0', t: performance.now() }); await sleep(300 * fast); break; }
          case 'catapult': { const [cx, cy] = this.hexCenter(e.idx % Hex.W, Math.floor(e.idx / Hex.W)); this.floats.push({ x: cx, y: cy - this.r * 0.5, text: e.destroyed ? (e.gate ? 'Портата пада!' : 'Стената пада!') : 'Катапулт!', color: '#ffd870', t: performance.now() }); await sleep(350 * fast); break; }
          case 'death': { await sleep(150 * fast); break; }
          case 'morale': { const s = st(e.stack); const [cx, cy] = this.stackCenter(s); this.floats.push({ x: cx, y: cy - this.r, text: e.good ? 'Висок морал!' : 'Лош морал', color: e.good ? '#ffe070' : '#a0a0a0', t: performance.now() }); await sleep(400 * fast); break; }
          case 'cast': { this.floats.push({ x: this.canvas.width / 2, y: this.oy, text: '✦ ' + D.spellById[e.spell].name + ' ✦', color: '#c0a0ff', t: performance.now() }); await sleep(350 * fast); break; }
          case 'effect': { const s = st(e.stack); if (s) { const [cx, cy] = this.stackCenter(s); this.floats.push({ x: cx, y: cy - this.r * 0.6, text: '✦', color: '#c0a0ff', t: performance.now() }); } await sleep(120 * fast); break; }
          case 'resist': case 'immune': { const s = st(e.stack); const [cx, cy] = this.stackCenter(s); this.floats.push({ x: cx, y: cy - this.r * 0.6, text: e.type === 'resist' ? 'Устоява!' : 'Имунитет', color: '#fff', t: performance.now() }); await sleep(250 * fast); break; }
          case 'wait': case 'defend': { await sleep(120 * fast); break; }
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
      const mk = (label, fn, dis, cls) => bar.appendChild(UI.el('button', { class: cls || '', disabled: dis ? 'disabled' : null, onclick: fn }, label));
      if (this.state === 'tactics') {
        bar.appendChild(UI.el('div', { class: 'tiny' }, 'Докосни свой стек, после хекс в осветената зона.'));
        mk('✔ Готово', () => this.resolveTactics(), false, 'primary');
        return;
      }
      const canAct = this.state === 'input' && cur && this.isHuman(cur.side) && !this.auto;
      const side = cur ? cur.side : this.humans[0];
      if (cur && canAct) bar.appendChild(UI.el('button', { class: 'small', onclick: () => UI.creatureInfo(cur.c) }, cur.c.name + ' ×' + cur.count + (cur.shots ? ' 🏹' + cur.shots : '')));
      mk('⏳ Чакай', () => this.act(() => b.doWait(cur)), !canAct || (cur && cur.waited));
      mk('🛡 Защита', () => this.act(() => b.doDefend(cur)), !canAct);
      mk('📖 Магия', () => this.openSpellbook(side), !canAct || !b.canCast(side));
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
