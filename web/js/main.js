/* Управление на играта: нова игра, кампания, hot-seat, цикъл на рисуване, вход по картата,
   движение по нива и вода, събития, битки, ход на ИИ, сейв/лоуд */
(function () {
  'use strict';
  const MK = (window.MK = window.MK || {});
  const D = MK.data;
  const UI = MK.UI;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const svgCur = (body, hx, hy) => 'url("data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">' + body + '</svg>') + '") ' + hx + ' ' + hy + ', pointer';
  const OUT = 'stroke="#000" stroke-width="1.2" stroke-linejoin="round"';
  const CURSORS = {
    move: svgCur('<path d="M6 21 L8 12 L14 8 L20 10 L18 15 L16 13 L12 16 L12 21 Z" fill="#ffe08a" ' + OUT + '/><circle cx="19" cy="9" r="2.3" fill="#ffe08a" ' + OUT + '/>', 6, 21),
    attack: svgCur('<path d="M5 23 L17 11 L15 9 L3 21 Z" fill="#d9d9d9" ' + OUT + '/><path d="M17 11 L25 3 L26 7 L19 13 Z" fill="#ffffff" ' + OUT + '/><path d="M12 8 L20 16" stroke="#c9a23e" stroke-width="3"/>', 4, 23),
    guard: svgCur('<path d="M5 23 L17 11 L15 9 L3 21 Z" fill="#d9d9d9" ' + OUT + '/><path d="M17 11 L25 3 L26 7 L19 13 Z" fill="#ffffff" ' + OUT + '/><path d="M12 8 L20 16" stroke="#c9a23e" stroke-width="3"/><circle cx="21" cy="21" r="5" fill="#d23c3c" ' + OUT + '/>', 4, 23),
    pickup: svgCur('<path d="M8 4 L8 14 L5 14 L5 20 L20 20 L20 8 L12 8 L12 4 Z" fill="#f2c9a0" ' + OUT + '/><path d="M12 8 L12 14 M16 8 L16 14" stroke="#000" stroke-width="1"/>', 8, 4),
    flag: svgCur('<path d="M8 3 L8 25" stroke="#000" stroke-width="2.4"/><path d="M9 4 L22 8 L9 12 Z" fill="#d23c3c" ' + OUT + '/>', 8, 3),
    enter: svgCur('<path d="M4 24 L4 12 L14 5 L24 12 L24 24 Z" fill="#c8b48a" ' + OUT + '/><path d="M11 24 L11 16 L17 16 L17 24" fill="#5a3a1a" ' + OUT + '/>', 14, 14),
    board: svgCur('<path d="M4 18 L24 18 L20 24 L8 24 Z" fill="#8a5a2a" ' + OUT + '/><path d="M14 4 L14 18 M14 5 L22 14 L14 14" fill="#fff" ' + OUT + '/>', 14, 20),
    visit: svgCur('<path d="M8 4 L8 14 L5 14 L5 20 L20 20 L20 8 L12 8 L12 4 Z" fill="#f2c9a0" ' + OUT + '/>', 8, 4),
    hero: svgCur('<circle cx="14" cy="9" r="5" fill="#e8c46a" ' + OUT + '/><path d="M4 26 C4 17 24 17 24 26 Z" fill="#3c6cd2" ' + OUT + '/>', 14, 14),
    noPath: svgCur('<circle cx="14" cy="14" r="9" fill="none" stroke="#d23c3c" stroke-width="3"/><path d="M8 8 L20 20" stroke="#d23c3c" stroke-width="3"/>', 14, 14),
    fog: svgCur('<circle cx="14" cy="14" r="9" fill="none" stroke="#999" stroke-width="3"/><path d="M14 9 L14 15 M14 18 L14 20" stroke="#999" stroke-width="3"/>', 14, 14),
    info: 'help', none: 'default'
  };
  const ICONS = { move: '🐎', attack: '⚔️', guard: '⚔️', pickup: '💰', flag: '🚩', enter: '🏰', board: '⛵', visit: '👋', hero: '🛡️', noPath: '⛔', fog: '❔', info: 'ℹ️', none: '' };
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
    async newGame(opts) {
      UI.closeScreens();
      this.campaign = opts.campaign || null;
      this.world = MK.World.create(opts);
      this.human = this.world.players.findIndex((p) => p.human);
      await this.preload();
      this.start();
      if (this.campaign) UI.dialog({ title: this.campaign.title, text: this.campaign.text, buttons: [{ label: 'Напред!', value: true, cls: 'primary' }] });
    }
    async startCampaign(cid, i) {
      const C = MK.campaignById(cid), sc = C.scenarios[i]; if (!sc) return;
      const prog = MK.Campaign.load(cid);
      // Избор на начален бонус, както в класическите кампании
      let bonus = null;
      if (sc.bonuses && sc.bonuses.length) {
        bonus = await UI.dialog({ title: sc.id + '. ' + sc.title, text: sc.text + ' ' + MK.Campaign.goalText(sc) + ' Избери начален бонус:', buttons: sc.bonuses.map((b) => ({ label: b.label, value: b, cls: 'primary' })).concat([{ label: 'Назад', value: null }]) });
        if (!bonus) return;
      }
      const players = [{ faction: sc.playerFaction, human: true }].concat(sc.opponents.map((f) => ({ faction: f, human: false })));
      this.newGame({ size: sc.size, difficulty: sc.difficulty, players, template: D.TEMPLATE(sc.template), seed: (Math.random() * 4294967295) >>> 0, carryHero: prog.hero ? { carry: prog.hero, faction: sc.playerFaction, cls: prog.hero.cls, name: prog.hero.name, portrait: prog.hero.portrait, spec: prog.hero.spec } : null, campaign: { id: cid, index: i, title: sc.id + '. ' + sc.title, text: sc.text + ' ' + MK.Campaign.goalText(sc), win: sc.win, goal: sc.goal || null, days: sc.days || 0 } });
      if (bonus) { MK.Campaign.applyBonus(this.world, this.human, bonus); this.updateHUD(); this.save(); }
    }
    /* Проверка на специална цел / срок на кампанийния сценарий след края на хода */
    async checkCampaign() {
      const c = this.campaign, w = this.world; if (!c || !w) return false;
      if (c.goal && MK.Campaign.goalMet(w, this.human, { goal: c.goal })) { await this.victory(this.human); return true; }
      if (c.days && w.day > c.days) {
        MK.Audio.loseGame();
        await UI.dialog({ title: 'Срокът изтече', text: 'Не успя да изпълниш целта до ' + c.days + '-ия ден. Сценарият може да се играе отново.' });
        localStorage.removeItem('mk_save'); this.world = null; document.getElementById('hud').hidden = true; UI.showCampaignScenarios(this, c.id); return true;
      }
      return false;
    }
    /* Зарежда рисуваните графики за текущия свят преди първото показване, за да не се мяркат старите */
    async preload() {
      const ov = UI.loading('Зареждане на света…');
      try { await MK.Img.load(MK.Img.listForWorld(this.world), 12000); } catch (e) { /* продължаваме и без всичко */ }
      ov.remove();
    }
    start() {
      document.getElementById('hud').hidden = false;
      this._turnSnap = null; setTimeout(() => { if (this.world) this._turnSnap = this.turnSnapshot(); }, 0);
      // подгряване на текстурите на терените от картата на фон
      try { const ts = new Set(); this.world.map.levels.forEach((L) => L.terrain.forEach((t) => ts.add(t))); MK.Gfx.warm([...ts], [96, 128]); } catch (e) { /* без подгряване */ }
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
    async load() {
      try {
        const j = JSON.parse(localStorage.getItem('mk_save'));
        if (!j) return;
        UI.closeScreens();
        this.world = MK.World.fromJSON(j.world); this.human = j.human || 0; this.campaign = j.campaign || null;
        await this.preload();
        this.start();
        UI.toast('Играта е заредена.');
      } catch (e) { UI.toast('Сейвът не може да се зареди: ' + e.message); }
    }
    gameMenu() {
      UI.dialog({ title: 'Меню', buttons: [{ label: 'Запази', value: 'save' }, { label: MK.Audio.settings.muted ? '🔇 Звук: изкл.' : '🔊 Звук: вкл.', value: 'sound' }, { label: 'Как се играе', value: 'help' }, { label: 'Главно меню', value: 'menu', cls: 'danger' }, { label: 'Назад', value: false }] }).then((v) => {
        if (v === 'save') { this.save(); UI.toast('Запазено.'); }
        if (v === 'help') UI.showHelp();
        if (v === 'sound') { MK.Audio.toggleMuted(); UI.toast(MK.Audio.settings.muted ? 'Звукът е изключен.' : 'Звукът е включен.'); }
        if (v === 'menu') { this.save(); UI.showMenu(this); }
      });
    }
    updateHUD() { UI.updateHUD(this); }
    afterScreen() { MK.Audio.resumeMap(); this.updateHUD(); if (this.selected) this.refreshReach(); this.drainEvents(); }
    selectHero(h, center) {
      this._hoverX = null;
      this.selected = h;
      this.renderer.selected = h;
      this.renderer.pathPreview = null;
      if (h) { MK.Audio.map(h.boat ? 'water' : D.TERRAIN[this.world.terrainAt(h.x, h.y, h.z || 0)].key); this.renderer.z = h.z || 0; if (center) this.renderer.center(h.x, h.y); this.refreshReach(); this.hint = h.name + ' · движение ' + h.movement + '/' + h.maxMovement + (h.boat ? ' · на кораб' : '') + (h.z ? ' · подземие' : ''); }
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
      let pressTimer = null, longPressed = false;
      const clearPress = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };
      c.addEventListener('contextmenu', (e) => { e.preventDefault(); const [tx, ty] = this.renderer.toTile(e.clientX, e.clientY); this.onLongPress(tx, ty); });
      c.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); downPos = { x: e.clientX, y: e.clientY }; moved = false; longPressed = false;
        clearPress(); if (e.button === 0 || e.pointerType !== 'mouse') pressTimer = setTimeout(() => { pressTimer = null; if (!moved && pts.size === 1) { longPressed = true; const [tx, ty] = this.renderer.toTile(e.clientX, e.clientY); this.onLongPress(tx, ty); } }, 450); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinchDist = Math.hypot(a.x - b.x, a.y - b.y); } });
      c.addEventListener('pointermove', (e) => {
        const p = pts.get(e.pointerId);
        if (!p) { if (e.pointerType === 'mouse') { const [tx, ty] = this.renderer.toTile(e.clientX, e.clientY); this.onHover(tx, ty); } return; }
        const dx = e.clientX - p.x, dy = e.clientY - p.y;
        if (pts.size === 1) {
          if (!moved && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 8) { moved = true; clearPress(); }
          if (moved) this.renderer.pan(dx, dy);
        }
        p.x = e.clientX; p.y = e.clientY;
        if (pts.size === 2) {
          const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (pinchDist > 0) this.renderer.zoomAt(d / pinchDist, (a.x + b.x) / 2, (a.y + b.y) / 2);
          pinchDist = d; moved = true;
        }
      });
      const up = (e) => { clearPress(); const had = pts.has(e.pointerId); pts.delete(e.pointerId); if (longPressed) { longPressed = pts.size > 0; return; } if (had && !moved && pts.size === 0 && e.type === 'pointerup') { const [tx, ty] = this.renderer.toTile(e.clientX, e.clientY); this.onTap(tx, ty); } if (pts.size < 2) pinchDist = 0; };
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
    /* Какво ще стане при докосване на плочката: { kind, label, days } — kind: move|attack|guard|pickup|enter|board|visit|hero|none|noPath|fog */
    intent(tx, ty) {
      const w = this.world; if (!w || !w.inb(tx, ty)) return { kind: 'none' };
      const z = this.renderer.z, p = w.players[this.human];
      if (!p.fog[z][w.idx(tx, ty)]) return { kind: 'fog', label: 'Неизследвана земя' };
      const hero = w.heroAt(tx, ty, z), obj = w.objectAt(tx, ty, z), sel = this.selected;
      if (hero && hero.owner === this.human) return { kind: 'hero', label: hero === sel ? (hero.inTown ? 'Влез в града' : 'Отвори героя') : 'Избери ' + hero.name };
      if (!sel || (sel.z || 0) !== z) return obj ? { kind: 'info', label: this.objName(obj) } : { kind: 'none' };
      if (sel.x === tx && sel.y === ty) return { kind: 'hero', label: 'Отвори героя' };
      const path = MK.Path.findPath(w, sel, tx, ty);
      if (!path) return { kind: 'noPath', label: obj ? this.objName(obj) + ' — няма път' : w.isWater(tx, ty, z) && !sel.boat ? 'Вода — трябва ти кораб' : 'Няма път дотам' };
      const days = Math.ceil(path.total / Math.max(1, sel.maxMovement));
      const r = { path, days, label: '' };
      if (hero) { r.kind = 'attack'; r.label = 'Нападни ' + hero.name + ' (ниво ' + hero.level + ')'; }
      else if (obj && obj.guard) { r.kind = 'guard'; r.label = this.objName(obj); }
      else if (obj && obj.type === 'monster') { r.kind = 'attack'; r.label = 'Нападни ' + this.objName(obj); }
      else if (obj && obj.type === 'town') { r.kind = w.towns[obj.townId].owner === this.human ? 'enter' : 'attack'; r.label = (r.kind === 'enter' ? 'Влез в ' : 'Обсади ') + w.towns[obj.townId].name; }
      else if (obj && obj.type === 'boat' && !sel.boat) { r.kind = 'board'; r.label = 'Качи се на кораба'; }
      else if (obj && (obj.type === 'resource' || obj.type === 'chest' || obj.type === 'artifact' || obj.type === 'sea_chest')) { r.kind = 'pickup'; r.label = 'Вземи: ' + this.objName(obj); }
      else if (obj && obj.type === 'mine' && obj.owner !== this.human) { r.kind = 'flag'; r.label = 'Завладей: ' + this.objName(obj); }
      else if (obj) { r.kind = 'visit'; r.label = this.objName(obj); }
      else { r.kind = 'move'; r.label = sel.boat ? 'Плавай' : 'Придвижи се'; }
      return r;
    }
    onHover(tx, ty) {
      if (!this.world || this.busy || this.world.curPlayer !== this.human) return;
      if (this._hoverX === tx && this._hoverY === ty) return;
      this._hoverX = tx; this._hoverY = ty;
      const it = this.intent(tx, ty);
      this.renderer.canvas.style.cursor = CURSORS[it.kind] || 'default';
      if (!this.renderer.pathPreview) { this.hint = it.label ? ICONS[it.kind] + ' ' + it.label + (it.days > 1 ? ' · ' + it.days + ' дни' : '') : ''; this.updateHUD(); }
    }
    /* Задържане / десен бутон: бърза информация за това, което е на плочката (както в HotA) */
    onLongPress(tx, ty) {
      const w = this.world; if (!w || !w.inb(tx, ty)) return;
      const z = this.renderer.z, p = w.players[this.human];
      if (!p.fog[z][w.idx(tx, ty)]) { UI.toast('Неизследвана земя.'); return; }
      const hero = w.heroAt(tx, ty, z), obj = w.objectAt(tx, ty, z);
      if (hero && !(obj && obj.type === 'town')) { UI.heroQuickInfo(this, hero); return; }
      if (!obj) { UI.toast(D.TERRAIN[w.terrainAt(tx, ty, z)].name); return; }
      if (obj.type === 'monster') { UI.creatureInfo(D.creatureOf(obj.creature), UI.stackInfo(obj.count, obj.disposition)); return; }
      if (obj.guard) { UI.guardInfo(this, obj); return; }
      if (obj.type === 'town') { UI.townQuickInfo(this, w.towns[obj.townId]); return; }
      UI.dialog({ title: this.objName(obj), text: (D.OBJECTS[obj.type] || {}).desc || '' });
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
      const it = this.intent(tx, ty);
      this.hint = ICONS[it.kind] + ' ' + it.label + ' · ' + (path.total <= this.selected.movement ? 'Докосни отново, за да ' + (it.kind === 'attack' || it.kind === 'guard' ? 'нападнеш.' : 'тръгнеш.') : 'Пътят е ' + days + ' дни. Докосни отново, за да тръгнеш.');
      this.updateHUD();
    }
    objName(o) {
      const guard = o.guard ? ' — пазят го ' + (o.guard.stacks ? o.guard.stacks.map((s) => s.count + ' × ' + D.creatureOf(s.creature).name).join(', ') : o.guard.count + ' × ' + D.creatureOf(o.guard.creature).name) : '';
      if (o.type === 'town') { const t = this.world.towns[o.townId]; return t.name + ' (' + D.factionById(t.faction).name + (t.owner >= 0 ? ', ' + D.PLAYER_COLORS[t.owner].name.toLowerCase() : ', неутрален') + ')' + guard; }
      if (o.type === 'mine') return D.MINES.find((m) => m.res === o.res).name + (o.owner >= 0 ? ' (' + D.PLAYER_COLORS[o.owner].name.toLowerCase() + ')' : '') + guard;
      if (o.type === 'monster') return o.count + ' × ' + D.creatureOf(o.creature).name;
      if (o.type === 'resource') return D.RES_NAME[o.res] + guard;
      if (o.type === 'dwelling') return 'Жилище: ' + D.creatureOf(o.creature).name + ' (налични ' + o.available + ')' + guard;
      if (o.type === 'artifact') return 'Артефакт' + guard;
      if (o.type === 'boat') return 'Кораб' + (o.owner >= 0 ? ' (' + D.PLAYER_COLORS[o.owner].name.toLowerCase() + ')' : '') + guard;
      return (D.OBJECTS[o.type] || {}).name || o.type + guard;
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
        case 'visit': UI.toast(ev.text); if (ev.kind === 'spell') MK.Audio.sfx('spell_learn'); else if (ev.kind === 'artifact' || ev.kind === 'pickup') MK.Audio.sfx('treasure'); if (ev.kind === 'artifact' || ev.kind === 'spell' || ev.kind === 'stat' || ev.kind === 'xp') await UI.dialog({ title: ev.obj ? this.objName(ev.obj) : 'Находка', text: ev.text }); break;
        case 'choice': { if (ev.obj && (ev.obj.type === 'chest' || ev.obj.type === 'sea_chest')) MK.Audio.sfx('treasure'); const v = await UI.dialog({ title: ev.title, text: ev.text, buttons: ev.options.map((o, i) => ({ label: o.label, value: i })) }); ev.options[v].apply(); break; }
        case 'dwelling': await UI.dwellingDialog(this, ev.hero, ev.obj); break;
        case 'enterTown': { if (ev.captured) UI.toast(ev.town.name + ' е превзет!'); if (ev.learned && ev.learned.length) MK.Audio.sfx('spell_learn'); if (ev.learned && ev.learned.length) UI.toast('Научени магии: ' + ev.learned.map((s) => D.spellById[s].name).join(', ')); UI.showTown(this, ev.town); break; }
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
        MK.Audio.sfx('level_up');
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
      const desc = d.hero ? d.hero.name + ' (ниво ' + d.hero.level + ')' : ctx.town ? 'гарнизона на ' + ctx.town.name : d.obj ? (ctx.guardOf ? 'пазачите на ' + this.objName(d.obj).split(' — ')[0].toLowerCase() : d.obj.count + ' × ' + D.creatureOf(d.obj.creature).name) : 'противник';
      const army = (a) => a.filter(Boolean).map((s) => s.n + ' ' + D.creatureOf(s.c).name).join(', ') || 'няма';
      const content = UI.el('div', null, UI.el('p', { class: 'tiny' }, 'Армия на противника: ' + army(d.army) + (d.garrison ? ' + гарнизон: ' + army(d.garrison) : '')), UI.el('p', { class: 'tiny' }, 'Армия на нападателя: ' + army(ctx.attacker.army)), ctx.town ? UI.el('p', { class: 'tiny' }, 'Обсада: ' + ['без укрепления', 'форт (стени)', 'цитадела (стени, ров, кула)', 'замък (дебели стени, ров, три кули)'][w.fortLevel(ctx.town)]) : null);
      if (humans.includes(0) && !humans.includes(1)) await UI.dialog({ title: 'Битка с ' + desc, content, buttons: [{ label: 'В бой!', value: true, cls: 'primary' }] });
      else await UI.dialog({ title: humans.length === 2 ? 'Битка между двама играчи' : 'Нападнати сме!', text: (ctx.attacker.hero ? ctx.attacker.hero.name : 'Врагът') + ' напада ' + (ctx.town ? ctx.town.name : d.hero ? d.hero.name : 'войските') + '.', content, buttons: [{ label: 'В бой!', value: true, cls: 'primary' }] });
      MK.Audio.battle(!!ctx.town);
      try { await MK.Img.load(MK.Img.listForBattle(ctx), 6000); } catch (e) { /* без изчакване */ }
      const b = new MK.Battle(ctx);
      const res = await MK.BattleUI.run(b, humans, this);
      w.resolveBattle(ctx, res);
      MK.Audio.resumeMap();
      return res;
    }
    async victory(pid) {
      const p = this.world.players[pid];
      if (p.human) MK.Audio.winGame(); else MK.Audio.loseGame();
      if (this.campaign && p.human) {
        const cid = this.campaign.id || 'crown', C = MK.campaignById(cid), prog = MK.Campaign.load(cid);
        const hero = this.world.heroes[p.heroes[0]] || null;
        if (this.campaign.index >= prog.done) prog.done = this.campaign.index + 1;
        if (hero) prog.hero = this.world.heroSnapshot(hero);
        MK.Campaign.save(cid, prog);
        const last = this.campaign.index >= C.scenarios.length - 1;
        await UI.dialog({ title: last ? 'Кампанията е завършена!' : 'Победа!', text: this.campaign.win + (hero && !last ? ' ' + hero.name + ' продължава в следващия сценарий с ниво ' + hero.level + '.' : '') });
        localStorage.removeItem('mk_save'); this.world = null; document.getElementById('hud').hidden = true;
        UI.showCampaignScenarios(this, cid); return;
      }
      await UI.dialog({ title: p.human ? 'Победа!' : 'Край на играта', text: p.human ? p.colorName + ' играч покори всички противници! Кралството е негово.' : D.PLAYER_COLORS[pid].name + ' играч печели играта.' });
      localStorage.removeItem('mk_save');
      this.world = null; document.getElementById('hud').hidden = true;
      UI.showMenu(this);
    }

    // ------------------------------------------------------------ ход
    /* Снимка на състоянието в началото на хода — за да разберем дали играчът е направил нещо */
    turnSnapshot() {
      const w = this.world, p = w.players[this.human];
      return JSON.stringify({ d: w.day, g: p.res.gold, mv: p.heroes.map((id) => w.heroes[id].movement), t: p.towns.map((id) => Object.keys(w.towns[id].buildings).length + ':' + w.towns[id].garrison.filter(Boolean).length) });
    }
    async endTurn() {
      const w = this.world;
      if (!w || this.busy || w.curPlayer !== this.human) return;
      const p0 = w.players[this.human];
      if (this._turnSnap && this._turnSnap === this.turnSnapshot()) {
        const ok = await UI.dialog({ title: 'Край на деня?', text: 'Не си направил нищо през този ден — никой герой не се е местил, нищо не е построено или купено. Сигурен ли си, че искаш да приключиш деня?', buttons: [{ label: 'Да, нов ден', value: true, cls: 'primary' }, { label: 'Назад', value: false }] });
        if (!ok) return;
      } else if (p0.heroes.some((id) => { const h = w.heroes[id]; return !h.sleeping && h.movement >= h.maxMovement * 0.5 && h.maxMovement > 0; }) && this._turnSnap) {
        const ok = await UI.dialog({ title: 'Край на деня?', text: 'Един или повече герои все още могат да се движат. Да приключим ли деня?', buttons: [{ label: 'Да, нов ден', value: true, cls: 'primary' }, { label: 'Назад', value: false }] });
        if (!ok) return;
      }
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
      if (!w.players.some((p) => p.human && p.alive)) { await this.drainEvents(); MK.Audio.loseGame(); await UI.dialog({ title: 'Поражение', text: 'Кралството ти падна. Опитай отново!' }); localStorage.removeItem('mk_save'); this.world = null; document.getElementById('hud').hidden = true; UI.showMenu(this); return; }
      if (!me.human) { UI.toast('Грешка в реда на ходовете.'); return; }
      // Hot-seat: подаваме устройството
      if (humansCount > 1 || me.id !== this.human) { this.human = me.id; this.selected = null; this.renderer.selected = null; this.updateHUD(); await UI.passDevice(this, me); }
      if (w.dayOfWeek() === 1) MK.Audio.sfx('new_week');
      UI.toast((w.dayOfWeek() === 1 ? '🌅 Нова седмица! ' : '🌅 ') + 'Ден ' + w.day + ' · седмица ' + w.week() + ', ден ' + w.dayOfWeek());
      this._turnSnap = null; setTimeout(() => { if (this.world === w) this._turnSnap = this.turnSnapshot(); }, 0);
      me.heroes.forEach((id) => { const h = w.heroes[id]; if (h.sleeping && h.movement < h.maxMovement) h.sleeping = false; });
      const first = me.heroes.map((id) => w.heroes[id]).find((h) => !h.sleeping) || (me.heroes.length ? w.heroes[me.heroes[0]] : null);
      this.selectHero(first, !!first);
      if (!first && me.towns.length) { const t = w.towns[me.towns[0]]; this.renderer.z = t.z || 0; this.renderer.center(t.x, t.y); }
      await this.drainEvents();
      if (await this.checkCampaign()) return;
      this.updateHUD();
      this.save();
    }
  }

  const init = () => { if (!MK.game) MK.game = new Game(); };
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', init); else init();
})();
