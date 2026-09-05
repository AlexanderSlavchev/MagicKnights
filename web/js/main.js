/* Управление на играта: нова игра, кампания, hot-seat, цикъл на рисуване, вход по картата,
   движение по нива и вода, събития, битки, ход на ИИ, сейв/лоуд */
(function () {
  'use strict';
  const MK = (window.MK = window.MK || {});
  const D = MK.data;
  const UI = MK.UI;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  class Game {
    constructor() {
      this.canvas = document.getElementById('map');
      this.renderer = new MK.MapRenderer(this.canvas);
      this.world = null; this.human = 0; this.selected = null; this.busy = false; this.hint = '';
      this.campaign = null;
      window.addEventListener('resize', () => { this.renderer.resize(); this.renderer.clamp(); });
      this.renderer.resize();
      this.setupInput();
      this.last = performance.now();
      const loop = (t) => { const dt = t - this.last; this.last = t; if (this.world && document.getElementById('battle').hidden) this.renderer.draw(this.world, this.world.players[this.human], dt); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
      document.getElementById('btn-end').addEventListener('click', () => this.endTurn());
      document.getElementById('btn-menu').addEventListener('click', () => this.gameMenu());
      document.getElementById('btn-hero').addEventListener('click', () => { if (this.selected) UI.showHero(this, this.selected); });
      document.getElementById('btn-next-hero').addEventListener('click', () => this.nextHero());
      document.getElementById('btn-level').addEventListener('click', () => this.toggleLevel());
      document.getElementById('btn-sleep').addEventListener('click', () => { if (this.selected) { this.selected.sleeping = !this.selected.sleeping; UI.toast(this.selected.sleeping ? this.selected.name + ' почива.' : this.selected.name + ' е на крак.'); this.updateHUD(); } });
      UI.showMenu(this);
    }

    // ------------------------------------------------------------ игра
    newGame(opts) {
      UI.closeScreens();
      this.campaign = opts.campaign || null;
      this.world = MK.World.create(opts);
      this.human = this.world.players.findIndex((p) => p.human);
      this.start();
      if (this.campaign) UI.dialog({ title: this.campaign.title, text: this.campaign.text, buttons: [{ label: 'Напред!', value: true, cls: 'primary' }] });
    }
    startCampaign(i) {
      const sc = MK.CAMPAIGN.scenarios[i]; if (!sc) return;
      const prog = MK.Campaign.load();
      const players = [{ faction: sc.playerFaction, human: true }].concat(sc.opponents.map((f) => ({ faction: f, human: false })));
      this.newGame({ size: sc.size, difficulty: sc.difficulty, players, template: D.TEMPLATE(sc.template), seed: (Math.random() * 4294967295) >>> 0, carryHero: prog.hero ? { carry: prog.hero, faction: sc.playerFaction, cls: prog.hero.cls, name: prog.hero.name, portrait: prog.hero.portrait, spec: prog.hero.spec } : null, campaign: { index: i, title: sc.id + '. ' + sc.title, text: sc.text, win: sc.win } });
    }
    start() {
      document.getElementById('hud').hidden = false;
      const p = this.world.players[this.human];
      const h = this.world.heroes[p.heroes[0]];
      this.selectHero(h || null, true);
      if (!h && p.towns.length) { const t = this.world.towns[p.towns[0]]; this.renderer.z = t.z || 0; this.renderer.center(t.x, t.y); }
      this.updateHUD();
      this.drainEvents();
      this.save();
    }
    save() {
      if (!this.world) return;
      try { localStorage.setItem('mk_save', JSON.stringify({ human: this.human, campaign: this.campaign, world: this.world.toJSON() })); } catch (e) { UI.toast('Сейвът не успя: ' + e.message); }
    }
    load() {
      try {
        const j = JSON.parse(localStorage.getItem('mk_save'));
        if (!j) return;
        UI.closeScreens();
        this.world = MK.World.fromJSON(j.world); this.human = j.human || 0; this.campaign = j.campaign || null;
        this.start();
        UI.toast('Играта е заредена.');
      } catch (e) { UI.toast('Сейвът не може да се зареди: ' + e.message); }
    }
    gameMenu() {
      UI.dialog({ title: 'Меню', buttons: [{ label: 'Запази', value: 'save' }, { label: 'Как се играе', value: 'help' }, { label: 'Главно меню', value: 'menu', cls: 'danger' }, { label: 'Назад', value: false }] }).then((v) => {
        if (v === 'save') { this.save(); UI.toast('Запазено.'); }
        if (v === 'help') UI.showHelp();
        if (v === 'menu') { this.save(); UI.showMenu(this); }
      });
    }
    updateHUD() { UI.updateHUD(this); }
    afterScreen() { this.updateHUD(); if (this.selected) this.refreshReach(); this.drainEvents(); }
    selectHero(h, center) {
      this.selected = h;
      this.renderer.selected = h;
      this.renderer.pathPreview = null;
      if (h) { this.renderer.z = h.z || 0; if (center) this.renderer.center(h.x, h.y); this.refreshReach(); this.hint = h.name + ' · движение ' + h.movement + '/' + h.maxMovement + (h.boat ? ' · на кораб' : '') + (h.z ? ' · подземие' : ''); }
      this.updateHUD();
    }
    refreshReach() { const h = this.selected; this.renderer.reach = h ? MK.Path.reachable(this.world, h, h.movement) : null; }
    nextHero() {
      const p = this.world.players[this.human];
      const list = p.heroes.map((id) => this.world.heroes[id]).filter((h) => h.movement > 0 && !h.sleeping);
      if (!list.length) { UI.toast('Всички герои са се движили.'); return; }
      const i = list.indexOf(this.selected);
      this.selectHero(list[(i + 1) % list.length], true);
    }
    toggleLevel() {
      if (!this.world || !this.world.hasUnderground()) return;
      this.renderer.z = this.renderer.z ? 0 : 1;
      this.renderer.pathPreview = null;
      this.renderer.reach = this.selected && (this.selected.z || 0) === this.renderer.z ? MK.Path.reachable(this.world, this.selected, this.selected.movement) : null;
      this.updateHUD();
    }

    // ------------------------------------------------------------ вход
    setupInput() {
      const c = this.canvas;
      const pts = new Map();
      let moved = false, pinchDist = 0, downPos = null;
      c.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); downPos = { x: e.clientX, y: e.clientY }; moved = false; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinchDist = Math.hypot(a.x - b.x, a.y - b.y); } });
      c.addEventListener('pointermove', (e) => {
        const p = pts.get(e.pointerId); if (!p) return;
        const dx = e.clientX - p.x, dy = e.clientY - p.y;
        if (pts.size === 1) {
          if (!moved && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 8) moved = true;
          if (moved) this.renderer.pan(dx, dy);
        }
        p.x = e.clientX; p.y = e.clientY;
        if (pts.size === 2) {
          const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (pinchDist > 0) this.renderer.zoomAt(d / pinchDist, (a.x + b.x) / 2, (a.y + b.y) / 2);
          pinchDist = d; moved = true;
        }
      });
      const up = (e) => { const had = pts.has(e.pointerId); pts.delete(e.pointerId); if (had && !moved && pts.size === 0 && e.type === 'pointerup') { const [tx, ty] = this.renderer.toTile(e.clientX, e.clientY); this.onTap(tx, ty); } if (pts.size < 2) pinchDist = 0; };
      c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up); c.addEventListener('pointerleave', (e) => { pts.delete(e.pointerId); });
      c.addEventListener('wheel', (e) => { e.preventDefault(); this.renderer.zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY); }, { passive: false });
      window.addEventListener('keydown', (e) => {
        if (!this.world || this.busy || document.querySelector('#overlay .screen, #overlay .modal-wrap')) return;
        if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') this.endTurn();
        if (e.key === 'h' || e.key === 'H') this.nextHero();
        if (e.key === 'u' || e.key === 'U') this.toggleLevel();
        if (e.key === ' ' && this.renderer.pathPreview) { e.preventDefault(); this.moveSelected(this.renderer.pathPreview); }
      });
    }
    onTap(tx, ty) {
      const w = this.world;
      if (!w || this.busy || !w.inb(tx, ty)) return;
      if (w.curPlayer !== this.human) return;
      const z = this.renderer.z;
      const p = w.players[this.human];
      const fog = p.fog[z][w.idx(tx, ty)];
      const hero = w.heroAt(tx, ty, z);
      const obj = w.objectAt(tx, ty, z);
      const pp = this.renderer.pathPreview;
      if (pp && this.selected && (this.selected.z || 0) === z && pp.path.length && pp.path[pp.path.length - 1].x === tx && pp.path[pp.path.length - 1].y === ty) {
        if (hero === this.selected) return;
        this.moveSelected(pp); return;
      }
      if (hero && hero.owner === this.human) {
        if (hero === this.selected) { if (hero.inTown) UI.showTown(this, w.towns[hero.inTown]); else UI.showHero(this, hero); }
        else this.selectHero(hero, false);
        return;
      }
      if (obj && obj.type === 'town' && w.towns[obj.townId].owner === this.human && (!this.selected || (this.selected.x === tx && this.selected.y === ty && (this.selected.z || 0) === z))) { UI.showTown(this, w.towns[obj.townId]); return; }
      if (!this.selected || (this.selected.z || 0) !== z) { if (obj && fog) this.describe(obj); else if (!this.selected) this.hint = ''; this.updateHUD(); return; }
      if (!fog) { this.hint = 'Неизследвана земя.'; this.renderer.pathPreview = null; this.updateHUD(); return; }
      const path = MK.Path.findPath(w, this.selected, tx, ty);
      if (!path) { this.renderer.pathPreview = null; this.hint = obj ? this.objName(obj) + ' — няма път.' : w.isWater(tx, ty, z) && !this.selected.boat ? 'Вода — трябва ти кораб.' : 'Няма път дотам.'; this.updateHUD(); return; }
      this.renderer.pathPreview = path;
      const days = Math.ceil(path.total / Math.max(1, this.selected.maxMovement));
      this.hint = (obj ? this.objName(obj) + ' · ' : hero ? (hero.owner === this.human ? hero.name : 'Вражески герой ' + hero.name + ', ниво ' + hero.level) + ' · ' : '') + (path.total <= this.selected.movement ? 'Докосни отново, за да тръгнеш.' : 'Пътят е ' + days + ' дни. Докосни отново, за да тръгнеш.');
      this.updateHUD();
    }
    objName(o) {
      if (o.type === 'town') { const t = this.world.towns[o.townId]; return t.name + ' (' + D.factionById(t.faction).name + (t.owner >= 0 ? ', ' + D.PLAYER_COLORS[t.owner].name.toLowerCase() : ', неутрален') + ')'; }
      if (o.type === 'mine') return D.MINES.find((m) => m.res === o.res).name + (o.owner >= 0 ? ' (' + D.PLAYER_COLORS[o.owner].name.toLowerCase() + ')' : '');
      if (o.type === 'monster') return o.count + ' × ' + D.creatureOf(o.creature).name;
      if (o.type === 'resource') return D.RES_NAME[o.res];
      if (o.type === 'dwelling') return 'Жилище: ' + D.creatureOf(o.creature).name + ' (налични ' + o.available + ')';
      if (o.type === 'artifact') return 'Артефакт';
      if (o.type === 'boat') return 'Кораб' + (o.owner >= 0 ? ' (' + D.PLAYER_COLORS[o.owner].name.toLowerCase() + ')' : '');
      return (D.OBJECTS[o.type] || {}).name || o.type;
    }
    describe(o) { this.hint = this.objName(o) + ((D.OBJECTS[o.type] || {}).desc ? ' — ' + D.OBJECTS[o.type].desc : ''); this.updateHUD(); }

    // ------------------------------------------------------------ движение
    async moveSelected(pp) {
      const h = this.selected, w = this.world;
      if (!h || this.busy) return;
      this.busy = true;
      this.renderer.pathPreview = null; this.renderer.reach = null;
      let pending = null;
      for (const st of pp.path) {
        if (!w.heroes[h.id]) break;
        const fromX = h.x, fromY = h.y, fromZ = h.z;
        const r = w.stepHero(h, st.x, st.y);
        if (r.stop) { if (r.why && r.why !== 'Няма точки за движение.') UI.toast(r.why); break; }
        if ((h.x !== fromX || h.y !== fromY) && h.z === fromZ) {
          this.renderer.anim = { hero: h, fromX, fromY, toX: h.x, toY: h.y, t: 0 };
          const dur = 110;
          const t0 = performance.now();
          while (performance.now() - t0 < dur) { this.renderer.anim.t = (performance.now() - t0) / dur; await sleep(16); }
          this.renderer.anim = null;
          this.followCamera(h);
        } else if (h.z !== fromZ) { this.renderer.z = h.z; this.renderer.center(h.x, h.y); }
        if (r.event) { pending = r.event; break; }
      }
      this.busy = false;
      if (pending) await this.handleEvent(pending);
      if (w.heroes[h.id]) this.selectHero(h, false); else { this.selected = null; this.renderer.selected = null; const p = w.players[this.human]; if (p.heroes.length) this.selectHero(w.heroes[p.heroes[0]], true); }
      await this.drainEvents();
      this.updateHUD();
      this.save();
    }
    followCamera(h) {
      const r = this.renderer; const S = r.tileSize();
      const [sx, sy] = r.toScreen(h.x, h.y);
      const m = S * 2;
      if (sx < m || sy < m + 30 * r.dpr || sx > r.vw - m - 150 * r.dpr || sy > r.vh - m) r.center(h.x, h.y);
    }

    // ------------------------------------------------------------ събития
    async handleEvent(ev) {
      const w = this.world;
      switch (ev.type) {
        case 'visit': UI.toast(ev.text); if (ev.kind === 'artifact' || ev.kind === 'spell' || ev.kind === 'stat' || ev.kind === 'xp') await UI.dialog({ title: ev.obj ? this.objName(ev.obj) : 'Находка', text: ev.text }); break;
        case 'choice': { const v = await UI.dialog({ title: ev.title, text: ev.text, buttons: ev.options.map((o, i) => ({ label: o.label, value: i })) }); ev.options[v].apply(); break; }
        case 'dwelling': await UI.dwellingDialog(this, ev.hero, ev.obj); break;
        case 'enterTown': { if (ev.captured) UI.toast(ev.town.name + ' е превзет!'); if (ev.learned && ev.learned.length) UI.toast('Научени магии: ' + ev.learned.map((s) => D.spellById[s].name).join(', ')); UI.showTown(this, ev.town); break; }
        case 'meet': UI.showHero(this, ev.hero, ev.other); break;
        case 'battle': await this.fight(ev); break;
        case 'msg': UI.toast(ev.text); break;
        case 'battleResult': await UI.dialog({ title: ev.win ? 'Победа' : 'Загуба', text: ev.text }); break;
        case 'eliminated': await UI.dialog({ title: 'Играч е победен', text: ev.text }); break;
        case 'victory': await this.victory(ev.player); break;
        default: break;
      }
      const h = ev.hero || this.selected;
      if (h && w.heroes[h.id] && h.pendingLevels && w.players[h.owner].human) await this.processLevelUps(h);
    }
    async processLevelUps(h) {
      while (h.pendingLevels > 0) {
        const roll = this.world.rollLevelUp(h);
        const skill = await UI.levelUpDialog(this, h, roll);
        this.world.applyLevelUp(h, roll, skill);
      }
      this.updateHUD();
    }
    async drainEvents() {
      const w = this.world;
      while (w && w.events.length) { const ev = w.events.shift(); await this.handleEvent(ev); if (!this.world) return; }
    }
    /* Битка с участие на човек: страните, които човек управлява, се определят по собствениците */
    async fight(ctx) {
      const w = this.world;
      ctx.world = w; ctx.seed = w.rng.int(1, 1e9);
      const h = ctx.attacker.hero;
      ctx.terrain = w.terrainAt(h.x, h.y, h.z);
      const humans = [];
      if (w.players[ctx.attacker.owner] && w.players[ctx.attacker.owner].human) humans.push(0);
      if (ctx.defender.owner >= 0 && w.players[ctx.defender.owner] && w.players[ctx.defender.owner].human) humans.push(1);
      const d = ctx.defender;
      const desc = d.hero ? d.hero.name + ' (ниво ' + d.hero.level + ')' : ctx.town ? 'гарнизона на ' + ctx.town.name : d.obj ? d.obj.count + ' × ' + D.creatureOf(d.obj.creature).name : 'противник';
      const army = (a) => a.filter(Boolean).map((s) => s.n + ' ' + D.creatureOf(s.c).name).join(', ') || 'няма';
      const content = UI.el('div', null, UI.el('p', { class: 'tiny' }, 'Армия на противника: ' + army(d.army) + (d.garrison ? ' + гарнизон: ' + army(d.garrison) : '')), UI.el('p', { class: 'tiny' }, 'Армия на нападателя: ' + army(ctx.attacker.army)), ctx.town ? UI.el('p', { class: 'tiny' }, 'Обсада: ' + ['без укрепления', 'форт (стени)', 'цитадела (стени, ров, кула)', 'замък (дебели стени, ров, три кули)'][w.fortLevel(ctx.town)]) : null);
      if (humans.includes(0) && !humans.includes(1)) await UI.dialog({ title: (ctx.ambush ? 'Засада! ' : 'Битка с ') + desc, content, buttons: [{ label: 'В бой!', value: true, cls: 'primary' }] });
      else await UI.dialog({ title: humans.length === 2 ? 'Битка между двама играчи' : 'Нападнати сме!', text: (ctx.attacker.hero ? ctx.attacker.hero.name : 'Врагът') + ' напада ' + (ctx.town ? ctx.town.name : d.hero ? d.hero.name : 'войските') + '.', content, buttons: [{ label: 'В бой!', value: true, cls: 'primary' }] });
      const b = new MK.Battle(ctx);
      const res = await MK.BattleUI.run(b, humans, this);
      w.resolveBattle(ctx, res);
      return res;
    }
    async victory(pid) {
      const p = this.world.players[pid];
      if (this.campaign && p.human) {
        const prog = MK.Campaign.load();
        const hero = this.world.heroes[p.heroes[0]] || null;
        if (this.campaign.index >= prog.done) prog.done = this.campaign.index + 1;
        if (hero) prog.hero = this.world.heroSnapshot(hero);
        MK.Campaign.save(prog);
        await UI.dialog({ title: 'Победа!', text: this.campaign.win + (hero ? ' ' + hero.name + ' продължава в следващия сценарий с ниво ' + hero.level + '.' : '') });
        localStorage.removeItem('mk_save'); this.world = null; document.getElementById('hud').hidden = true;
        UI.showCampaign(this); return;
      }
      await UI.dialog({ title: p.human ? 'Победа!' : 'Край на играта', text: p.human ? p.colorName + ' играч покори всички противници! Кралството е негово.' : D.PLAYER_COLORS[pid].name + ' играч печели играта.' });
      localStorage.removeItem('mk_save');
      this.world = null; document.getElementById('hud').hidden = true;
      UI.showMenu(this);
    }

    // ------------------------------------------------------------ ход
    async endTurn() {
      const w = this.world;
      if (!w || this.busy || w.curPlayer !== this.human) return;
      this.busy = true;
      this.renderer.pathPreview = null; this.renderer.reach = null;
      const humansCount = w.players.filter((p) => p.human && p.alive).length;
      w.endTurn();
      let guard = 0;
      // Ходове на компютъра до следващия човек
      while (w.players[w.curPlayer] && !w.players[w.curPlayer].human && guard++ < 10) {
        const p = w.players[w.curPlayer];
        if (p.alive) {
          UI.toast('Ход на ' + p.colorName.toLowerCase() + ' играч…');
          const gen = MK.AI.turn(w, p, {});
          let r = gen.next(), k = 0;
          while (!r.done) {
            if (r.value.type === 'battle') { this.busy = false; const res = await this.fight(r.value.ctx); this.busy = true; r = gen.next(res); }
            else { if (++k % 2 === 0) await sleep(0); r = gen.next(); }
          }
        }
        if (!w.players.some((p) => p.human && p.alive)) break;
        w.endTurn();
      }
      this.busy = false;
      if (!this.world) return;
      const me = w.players[w.curPlayer];
      if (!w.players.some((p) => p.human && p.alive)) { await this.drainEvents(); await UI.dialog({ title: 'Поражение', text: 'Кралството ти падна. Опитай отново!' }); localStorage.removeItem('mk_save'); this.world = null; document.getElementById('hud').hidden = true; UI.showMenu(this); return; }
      if (!me.human) { UI.toast('Грешка в реда на ходовете.'); return; }
      // Hot-seat: подаваме устройството
      if (humansCount > 1 || me.id !== this.human) { this.human = me.id; this.selected = null; this.renderer.selected = null; this.updateHUD(); await UI.passDevice(this, me); }
      me.heroes.forEach((id) => { const h = w.heroes[id]; if (h.sleeping && h.movement < h.maxMovement) h.sleeping = false; });
      const first = me.heroes.map((id) => w.heroes[id]).find((h) => !h.sleeping) || (me.heroes.length ? w.heroes[me.heroes[0]] : null);
      this.selectHero(first, !!first);
      if (!first && me.towns.length) { const t = w.towns[me.towns[0]]; this.renderer.z = t.z || 0; this.renderer.center(t.x, t.y); }
      await this.drainEvents();
      this.updateHUD();
      this.save();
    }
  }

  const init = () => { if (!MK.game) MK.game = new Game(); };
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', init); else init();
})();
