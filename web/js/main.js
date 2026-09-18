/* Управление на играта: нова игра, кампания, hot-seat, цикъл на рисуване, вход по картата,
   движение по нива и вода, събития, битки, ход на ИИ, сейв/лоуд */
(function () {
  'use strict';
  const MK = (window.MK = window.MK || {});
  const T = (s) => (MK.T ? MK.T(s) : s);
  const D = MK.data, G = MK.Gfx;
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
      document.getElementById('btn-sleep').addEventListener('click', () => { if (this.selected) { this.selected.sleeping = !this.selected.sleeping; UI.toast(this.selected.sleeping ? this.selected.name + T(' почива.') : this.selected.name + T(' е на крак.')); this.updateHUD(); } });
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
      if (this.campaign) UI.dialog({ title: this.campaign.title, text: this.campaign.text, buttons: [{ label: T('Напред!'), value: true, cls: 'primary' }] });
    }
    async startCampaign(cid, i) {
      const C = MK.campaignById(cid), sc = C.scenarios[i]; if (!sc) return;
      const prog = MK.Campaign.load(cid);
      // Избор на начален бонус, както в класическите кампании
      let bonus = null;
      if (sc.bonuses && sc.bonuses.length) {
        bonus = await UI.dialog({ title: sc.id + '. ' + sc.title, text: sc.text + ' ' + MK.Campaign.goalText(sc) + T(' Избери начален бонус:'), buttons: sc.bonuses.map((b) => ({ label: b.label, value: b, cls: 'primary' })).concat([{ label: T('Назад'), value: null }]) });
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
        await UI.dialog({ title: T('Срокът изтече'), text: T('Не успя да изпълниш целта до ') + c.days + T('-ия ден. Сценарият може да се играе отново.') });
        localStorage.removeItem('mk_save'); this.world = null; document.getElementById('hud').hidden = true; UI.showCampaignScenarios(this, c.id); return true;
      }
      return false;
    }
    /* Зарежда рисуваните графики за текущия свят преди първото показване, за да не се мяркат старите */
    async preload() {
      const ov = UI.loading(T('Зареждане на света…'));
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
      try { localStorage.setItem('mk_save', JSON.stringify({ human: this.human, campaign: this.campaign, world: this.world.toJSON() })); } catch (e) { UI.toast(T('Сейвът не успя: ') + e.message); }
    }
    async load() {
      try {
        const j = JSON.parse(localStorage.getItem('mk_save'));
        if (!j) return;
        UI.closeScreens();
        this.world = MK.World.fromJSON(j.world); this.human = j.human || 0; this.campaign = j.campaign || null;
        await this.preload();
        this.start();
        UI.toast(T('Играта е заредена.'));
      } catch (e) { UI.toast(T('Сейвът не може да се зареди: ') + e.message); }
    }
    gameMenu() {
      UI.dialog({ title: T('Меню'), buttons: [{ label: T('Запази'), value: 'save' }, { label: MK.Audio.settings.muted ? T('🔇 Звук: изкл.') : T('🔊 Звук: вкл.'), value: 'sound' }, { label: T('Как се играе'), value: 'help' }, { label: T('Главно меню'), value: 'menu', cls: 'danger' }, { label: T('Назад'), value: false }] }).then((v) => {
        if (v === 'save') { this.save(); UI.toast(T('Запазено.')); }
        if (v === 'help') UI.showHelp();
        if (v === 'sound') { MK.Audio.toggleMuted(); UI.toast(MK.Audio.settings.muted ? T('Звукът е изключен.') : T('Звукът е включен.')); }
        if (v === 'menu') { this.save(); UI.showMenu(this); }
      });
    }
    updateHUD() { UI.updateHUD(this); }
    afterScreen() { MK.Audio.resumeMap(); this.updateHUD(); if (this.selected) this.refreshReach(); this.drainEvents(); }
    selectHero(h, center) {
      this._hoverX = null;
      this.renderer.targetIcon = null;
      this.selected = h;
      this.renderer.selected = h;
      this.renderer.pathPreview = null;
      if (h) { MK.Audio.map(h.boat ? 'water' : D.TERRAIN[this.world.terrainAt(h.x, h.y, h.z || 0)].key); this.renderer.z = h.z || 0; if (center) this.renderer.center(h.x, h.y); this.refreshReach(); this.hint = h.name + T(' · движение ') + h.movement + '/' + h.maxMovement + (h.boat ? T(' · на кораб') : '') + (h.z ? T(' · подземие') : ''); }
      this.updateHUD();
    }
    refreshReach() { const h = this.selected; this.renderer.reach = h ? MK.Path.reachable(this.world, h, h.movement) : null; }
    nextHero() {
      const p = this.world.players[this.human];
      const list = p.heroes.map((id) => this.world.heroes[id]).filter((h) => h.movement > 0 && !h.sleeping);
      if (!list.length) { UI.toast(T('Всички герои са се движили.')); return; }
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
      if (!p.fog[z][w.idx(tx, ty)]) return { kind: 'fog', label: T('Неизследвана земя') };
      const hero = w.heroAt(tx, ty, z), obj = w.objectAt(tx, ty, z), sel = this.selected;
      if (hero && hero.owner === this.human) return { kind: 'hero', label: hero === sel ? (hero.inTown ? T('Влез в града') : T('Отвори героя')) : T('Избери ') + hero.name };
      if (!sel || (sel.z || 0) !== z) return obj ? { kind: 'info', label: this.objName(obj) } : { kind: 'none' };
      if (sel.x === tx && sel.y === ty) return { kind: 'hero', label: T('Отвори героя') };
      const path = MK.Path.findPath(w, sel, tx, ty);
      if (!path) return { kind: 'noPath', label: obj ? this.objName(obj) + T(' — няма път') : w.isWater(tx, ty, z) && !sel.boat ? T('Вода — трябва ти кораб') : T('Няма път дотам') };
      const days = Math.ceil(path.total / Math.max(1, sel.maxMovement));
      const r = { path, days, label: '' };
      if (hero) { r.kind = 'attack'; r.label = T('Нападни ') + hero.name + T(' (ниво ') + hero.level + ')'; }
      else if (obj && obj.guard) { r.kind = 'guard'; r.label = this.objName(obj); }
      else if (obj && obj.type === 'monster') { r.kind = 'attack'; r.label = T('Нападни ') + this.objName(obj); }
      else if (obj && obj.type === 'town') { r.kind = w.towns[obj.townId].owner === this.human ? 'enter' : 'attack'; r.label = (r.kind === 'enter' ? T('Влез в ') : T('Обсади ')) + w.towns[obj.townId].name; }
      else if (obj && obj.type === 'boat' && !sel.boat) { r.kind = 'board'; r.label = T('Качи се на кораба'); }
      else if (obj && (obj.type === 'resource' || obj.type === 'chest' || obj.type === 'artifact' || obj.type === 'sea_chest')) { r.kind = 'pickup'; r.label = T('Вземи: ') + this.objName(obj); }
      else if (obj && obj.type === 'mine' && obj.owner !== this.human) { r.kind = 'flag'; r.label = T('Завладей: ') + this.objName(obj); }
      else if (obj) { r.kind = 'visit'; r.label = this.objName(obj); }
      else { r.kind = 'move'; r.label = sel.boat ? T('Плавай') : T('Придвижи се'); }
      return r;
    }
    onHover(tx, ty) {
      if (!this.world || this.busy || this.world.curPlayer !== this.human) return;
      if (this._hoverX === tx && this._hoverY === ty) return;
      this._hoverX = tx; this._hoverY = ty;
      const it = this.intent(tx, ty);
      this.renderer.canvas.style.cursor = CURSORS[it.kind] || 'default';
      if (!this.renderer.pathPreview) { this.hint = it.label ? ICONS[it.kind] + ' ' + it.label + (it.days > 1 ? ' · ' + it.days + T(' дни') : '') : ''; this.updateHUD(); }
    }
    /* Задържане / десен бутон: бърза информация за това, което е на плочката (както в HotA) */
    onLongPress(tx, ty) {
      const w = this.world; if (!w || !w.inb(tx, ty)) return;
      this._tutSeenInfo = true;
      const z = this.renderer.z, p = w.players[this.human];
      if (!p.fog[z][w.idx(tx, ty)]) { UI.toast(T('Неизследвана земя.')); return; }
      const hero = w.heroAt(tx, ty, z), obj = w.objectAt(tx, ty, z);
      if (hero && !(obj && obj.type === 'town')) { UI.heroQuickInfo(this, hero); return; }
      if (!obj) { UI.toast(D.TERRAIN[w.terrainAt(tx, ty, z)].name); return; }
      if (obj.type === 'monster') { UI.creatureInfo(D.creatureOf(obj.creature), UI.stackInfo(obj.count, obj.disposition)); return; }
      if (obj.guard) { UI.guardInfo(this, obj); return; }
      if (obj.type === 'town') { UI.townQuickInfo(this, w.towns[obj.townId]); return; }
      UI.dialog({ title: this.objName(obj), text: (D.OBJECTS[obj.type] || {}).desc || '' });
    }
    /* Показва награди „като в казино“ по текста/данните на събитието */
    showGains(text, ev) {
      const shown = [];
      // имената на ресурсите и „опит“ на текущия език (регулярният израз се строи динамично)
      const resNames = {}; D.RES.forEach((r) => { resNames[D.RES_NAME[r].toLowerCase()] = r; });
      const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const words = Object.keys(resNames).concat([T('опит').toLowerCase()]).map(esc).join('|');
      const re = new RegExp('(?:^|[^\\d])[+]?(\\d+)\\s*(' + words + ')|(' + words + ')\\s*:\\s*\\+?(\\d+)', 'gi'); let m;
      while ((m = re.exec(text))) {
        const n = +(m[1] || m[4]), what = (m[2] || m[3]).toLowerCase();
        if (what === T('опит').toLowerCase()) { UI.reward({ icon: this.iconEl('ui/icon_morale', '⭐'), amount: n, title: T('опит'), cls: 'xp' }); shown.push('xp'); continue; }
        const r = resNames[what]; if (!r) continue;
        UI.reward({ icon: this.iconEl('ui/icon_' + r, '💰'), amount: n, title: D.RES_NAME[r], cls: 'res' }); shown.push(r);
      }
      const ra = new RegExp(esc(T('Намираш артефакт: ')) + '([^.。]+)[.。]').exec(text) || new RegExp(esc(T('намираш ')) + '([^.。]+)[.。]').exec(text);
      if (ev && ev.kind === 'artifact') {
        const names = ra ? ra[1].split(/,| и /).map((x) => x.trim()).filter(Boolean) : [];
        names.forEach((nm) => { const a = D.ARTIFACTS.find((x) => x.name === nm || nm.includes(x.name)); if (a) { UI.reward({ icon: this.iconEl('artifacts/' + a.id, '🏺'), title: a.name, sub: a.desc, cls: 'art', ms: 2400 }); shown.push('art'); } });
      }
      const rs = /„([^“]+)“|"([^"]+)"|「([^」]+)」/.exec(text);
      if (rs && ev && ev.kind === 'spell') { const nm = rs[1] || rs[2] || rs[3]; const sp = D.SPELLS.find((x) => x.name === nm); UI.reward({ icon: this.iconEl(sp ? 'spells/' + sp.id : null, '📖'), title: nm, sub: T('Нова магия'), cls: 'spell' }); shown.push('spell'); }
      const rst = new RegExp('\\+1 (' + Object.values(D.PRIMARY_NAME).map((x) => esc(x.toLowerCase())).join('|') + ')', 'i').exec(text.toLowerCase());
      if (rst) { UI.reward({ icon: this.iconEl('ui/icon_defend', '⚔️'), amount: 1, title: rst[1], cls: 'stat' }); shown.push('stat'); }
      return shown.length > 0;
    }
    iconEl(rel, fallback) {
      const u = rel ? MK.Img.url(rel) : null;
      return u ? UI.el('img', { src: u, alt: '' }) : UI.el('span', { class: 'emoji' }, fallback || '✨');
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
      if (!fog) { this.hint = T('Неизследвана земя.'); this.renderer.pathPreview = null; this.updateHUD(); return; }
      const path = MK.Path.findPath(w, this.selected, tx, ty);
      if (!path) { this.renderer.pathPreview = null; this.hint = obj ? this.objName(obj) + T(' — няма път.') : w.isWater(tx, ty, z) && !this.selected.boat ? T('Вода — трябва ти кораб.') : T('Няма път дотам.'); this.updateHUD(); return; }
      this.renderer.pathPreview = path;
      const days = Math.ceil(path.total / Math.max(1, this.selected.maxMovement));
      const it = this.intent(tx, ty);
      this.renderer.targetIcon = { x: tx, y: ty, icon: ICONS[it.kind], kind: it.kind };
      this.hint = ICONS[it.kind] + ' ' + it.label + ' · ' + (path.total <= this.selected.movement ? T('Докосни отново, за да ') + (it.kind === 'attack' || it.kind === 'guard' ? T('нападнеш.') : T('тръгнеш.')) : T('Пътят е ') + days + T(' дни. Докосни отново, за да тръгнеш.'));
      this.updateHUD();
    }
    objName(o) {
      const cnt = (n) => D.countRange(n).text + ' × ';
      const guard = o.guard ? T(' — пазят го ') + (o.guard.stacks ? o.guard.stacks.map((s) => cnt(s.count) + D.creatureOf(s.creature).name).join(', ') : cnt(o.guard.count) + D.creatureOf(o.guard.creature).name) : '';
      if (o.type === 'town') { const t = this.world.towns[o.townId]; return t.name + ' (' + D.factionById(t.faction).name + (t.owner >= 0 ? ', ' + D.PLAYER_COLORS[t.owner].name.toLowerCase() : T(', неутрален')) + ')' + guard; }
      if (o.type === 'mine') return D.MINES.find((m) => m.res === o.res).name + (o.owner >= 0 ? ' (' + D.PLAYER_COLORS[o.owner].name.toLowerCase() + ')' : '') + guard;
      if (o.type === 'monster') return cnt(o.count) + D.creatureOf(o.creature).name;
      if (o.type === 'resource') return D.RES_NAME[o.res] + guard;
      if (o.type === 'dwelling') return T('Жилище: ') + D.creatureOf(o.creature).name + T(' (налични ') + o.available + ')' + guard;
      if (o.type === 'artifact') return T('Артефакт') + guard;
      if (o.type === 'boat') return T('Кораб') + (o.owner >= 0 ? ' (' + D.PLAYER_COLORS[o.owner].name.toLowerCase() + ')' : '') + guard;
      return (D.OBJECTS[o.type] || {}).name || o.type + guard;
    }
    describe(o) { this.hint = this.objName(o) + ((D.OBJECTS[o.type] || {}).desc ? ' — ' + D.OBJECTS[o.type].desc : ''); this.updateHUD(); }

    // ------------------------------------------------------------ движение
    async moveSelected(pp) {
      const h = this.selected, w = this.world;
      if (!h || this.busy) return;
      this.busy = true;
      this.renderer.pathPreview = null; this.renderer.reach = null; this.renderer.targetIcon = null;
      let pending = null;
      for (const st of pp.path) {
        if (!w.heroes[h.id]) break;
        const fromX = h.x, fromY = h.y, fromZ = h.z;
        const r = w.stepHero(h, st.x, st.y);
        if (r.stop) { if (r.why && r.why !== T('Няма точки за движение.')) UI.toast(r.why); break; }
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
        case 'visit': if (!this.showGains(ev.text, ev)) UI.toast(ev.text); if (ev.kind === 'spell') MK.Audio.sfx('spell_learn'); else if (ev.kind === 'artifact' || ev.kind === 'pickup') MK.Audio.sfx('treasure'); if (ev.kind === 'artifact' || ev.kind === 'spell' || ev.kind === 'stat' || ev.kind === 'xp') await UI.dialog({ title: ev.obj ? this.objName(ev.obj) : T('Находка'), text: ev.text }); break;
        case 'choice': { if (ev.obj && (ev.obj.type === 'chest' || ev.obj.type === 'sea_chest')) MK.Audio.sfx('treasure'); const v = await UI.dialog({ title: ev.title, text: ev.text, buttons: ev.options.map((o, i) => ({ label: o.label, value: i, disabled: !!o.disabled })) }); ev.options[v].apply(); this.showGains(ev.options[v].label, null); break; }
        case 'dwelling': await UI.dwellingDialog(this, ev.hero, ev.obj); break;
        case 'enterTown': { if (ev.captured) UI.toast(ev.town.name + T(' е превзет!')); if (ev.learned && ev.learned.length) MK.Audio.sfx('spell_learn'); if (ev.learned && ev.learned.length) UI.toast(T('Научени магии: ') + ev.learned.map((s) => D.spellById[s].name).join(', ')); UI.showTown(this, ev.town); break; }
        case 'meet': UI.showHero(this, ev.hero, ev.other); break;
        case 'battle': await this.fight(ev); break;
        case 'msg': UI.toast(ev.text); break;
        case 'battleResult': await UI.dialog({ title: ev.win ? T('Победа') : T('Загуба'), text: ev.text }); if (ev.win && ev.xp) UI.reward({ icon: this.iconEl('ui/icon_morale', '⭐'), amount: ev.xp, title: T('опит'), cls: 'xp' }); break;
        case 'eliminated': await UI.dialog({ title: T('Играч е победен'), text: ev.text }); break;
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
      const desc = d.hero ? d.hero.name + T(' (ниво ') + d.hero.level + ')' : ctx.town ? T('гарнизона на ') + ctx.town.name : d.obj ? (ctx.guardOf ? T('пазачите на ') + this.objName(d.obj).split(' — ')[0].toLowerCase() : d.obj.count + ' × ' + D.creatureOf(d.obj.creature).name) : T('противник');
      // Прозорец преди битка (както в HotA): армиите с точен брой и портрети, героите с характеристики; бърз бой без бойния екран
      const armyRow = (a) => { const row = UI.el('div', { class: 'pre-army' }); a.filter((s) => s && s.n > 0).forEach((s) => { const c = D.creatureOf(s.c); row.appendChild(UI.el('div', { class: 'pre-stack', title: c.name, onclick: () => UI.creatureInfo(c, UI.stackInfo(s.n, undefined, true)) }, UI.spriteCanvas(G.creatureSprite(c, 128), 44, 54), UI.el('b', null, String(s.n)), UI.el('small', null, c.name))); }); if (!row.childNodes.length) row.appendChild(UI.el('span', { class: 'tiny' }, T('няма'))); return row; };
      const heroBox = (hero, owner) => hero ? UI.el('div', { class: 'pre-hero' }, UI.spriteCanvas(G.portrait(hero, 96, w.players[owner].color), 52, 52), UI.el('div', null, UI.el('div', { class: 'name' }, hero.name), UI.el('div', { class: 'tiny' }, D.CLASSES[hero.cls].name + T(' · ниво ') + hero.level), UI.el('div', { class: 'tiny' }, '⚔ ' + hero.att + '  🛡 ' + hero.def + '  ✦ ' + hero.pow + '  📖 ' + hero.know + T('  мана ') + hero.mana))) : null;
      const sideBox = (title, hero, owner, a, extra) => UI.el('div', { class: 'pre-side' }, UI.el('div', { class: 'pre-title' }, title), heroBox(hero, owner), armyRow(a), extra || null);
      const content = UI.el('div', { class: 'pre-battle' },
        sideBox(T('Нападател'), ctx.attacker.hero, ctx.attacker.owner, ctx.attacker.army),
        sideBox(T('Защитник'), d.hero, d.owner >= 0 ? d.owner : 0, d.army, d.garrison ? UI.el('div', null, UI.el('div', { class: 'tiny' }, T('Гарнизон:')), armyRow(d.garrison)) : null),
        ctx.town ? UI.el('p', { class: 'tiny', style: 'width:100%;text-align:center' }, T('Обсада: ') + [T('без укрепления'), T('форт (стени)'), T('цитадела (стени, ров, кула)'), T('замък (дебели стени, ров, три кули)')][w.fortLevel(ctx.town)]) : null);
      let choice = true;
      if (humans.includes(0) && !humans.includes(1)) choice = await UI.dialog({ title: T('Битка с ') + desc, content, buttons: [{ label: T('⚔ В бой!'), value: true, cls: 'primary' }, { label: T('⚡ Бърз бой'), value: 'quick' }] });
      else choice = await UI.dialog({ title: humans.length === 2 ? T('Битка между двама играчи') : T('Нападнати сме!'), text: (ctx.attacker.hero ? ctx.attacker.hero.name : T('Врагът')) + T(' напада ') + (ctx.town ? ctx.town.name : d.hero ? d.hero.name : T('войските')) + '.', content, buttons: [{ label: T('⚔ В бой!'), value: true, cls: 'primary' }, { label: T('⚡ Бърз бой'), value: 'quick' }] });
      if (choice === 'quick') {
        // бърз бой: битката се изиграва мигновено от ИИ за двете страни, показва се само резултатът
        const b = new MK.Battle(ctx);
        const snap = (a) => (a || []).filter(Boolean).map((s) => ({ c: s.c, n: s.n }));
        const before = { att: snap(ctx.attacker.army), def: snap(d.army).concat(snap(d.garrison)) };
        const res = b.runAuto();
        const mine = humans.includes(0) ? 0 : 1;
        const won = (res.winner === 'att') === (mine === 0);
        MK.Audio.battleEnd(won);
        // загуби по видове: преди минус след
        const losses = (bef, now) => { const left = {}; now.forEach((s) => { left[s.c] = (left[s.c] || 0) + s.n; }); const out = []; const seen = {}; bef.forEach((s) => { seen[s.c] = (seen[s.c] || 0) + s.n; }); for (const c in seen) { const lost = seen[c] - (left[c] || 0); if (lost > 0) out.push({ c, n: lost }); } return out; };
        const after = { att: snap(ctx.attacker.army), def: snap(d.army).concat(snap(d.garrison)) };
        const lostAtt = losses(before.att, after.att), lostDef = losses(before.def, after.def);
        const total = (l) => l.reduce((s, x) => s + x.n, 0);
        const lossBox = (title, hero, owner, lost) => UI.el('div', { class: 'pre-side' }, UI.el('div', { class: 'pre-title' }, title), heroBox(hero, owner), UI.el('div', { class: 'tiny' }, T('Загуби:') + (lost.length ? '' : ' ' + T('няма'))), lost.length ? armyRow(lost) : null);
        const rc = UI.el('div', { class: 'pre-battle pre-result' },
          lossBox((humans.includes(0) ? T('Твоите загуби') : T('Нападател')) + ' — ' + total(lostAtt), ctx.attacker.hero, ctx.attacker.owner, lostAtt),
          lossBox((humans.includes(1) ? T('Твоите загуби') : T('Загуби на врага')) + ' — ' + total(lostDef), d.hero, d.owner >= 0 ? d.owner : 0, lostDef));
        await UI.dialog({ title: won ? T('Победа!') : T('Поражение'), content: rc });
        w.resolveBattle(ctx, res);
        MK.Audio.resumeMap();
        return res;
      }
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
        await UI.dialog({ title: last ? T('Кампанията е завършена!') : T('Победа!'), text: this.campaign.win + (hero && !last ? ' ' + hero.name + T(' продължава в следващия сценарий с ниво ') + hero.level + '.' : '') });
        localStorage.removeItem('mk_save'); this.world = null; document.getElementById('hud').hidden = true;
        UI.showCampaignScenarios(this, cid); return;
      }
      await UI.dialog({ title: p.human ? T('Победа!') : T('Край на играта'), text: p.human ? p.colorName + T(' играч покори всички противници! Кралството е негово.') : D.PLAYER_COLORS[pid].name + T(' играч печели играта.') });
      localStorage.removeItem('mk_save');
      this.world = null; document.getElementById('hud').hidden = true;
      UI.showMenu(this);
    }

    // ------------------------------------------------------------ ход
    /* Чужд герой минава през разкрита от играча земя: камерата го следва и ходът се анимира (както в класиките) */
    async followStep(v) {
      const w = this.world, p = w.players[this.human], h = v.hero, z = h.z || 0;
      if (!w.heroes[h.id]) return;
      const seen = p.fog[z] && (p.fog[z][w.idx(h.x, h.y)] || p.fog[z][w.idx(v.fromX, v.fromY)]);
      if (!seen) return;
      const R = this.renderer;
      if (R.z !== z) R.z = z;
      if (this._followId !== h.id || !R.isVisible || !R.isVisible(h.x, h.y)) { R.center(h.x, h.y); this._followId = h.id; }
      else R.follow(h.x, h.y);
      R.anim = { hero: h, fromX: v.fromX, fromY: v.fromY, toX: h.x, toY: h.y, t: 0 };
      const dur = 150, t0 = performance.now();
      while (performance.now() - t0 < dur) { R.anim.t = (performance.now() - t0) / dur; await sleep(16); }
      R.anim = null;
    }
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
        const ok = await UI.dialog({ title: T('Край на деня?'), text: T('Не си направил нищо през този ден — никой герой не се е местил, нищо не е построено или купено. Сигурен ли си, че искаш да приключиш деня?'), buttons: [{ label: T('Да, нов ден'), value: true, cls: 'primary' }, { label: T('Назад'), value: false }] });
        if (!ok) return;
      } else if (p0.heroes.some((id) => { const h = w.heroes[id]; return !h.sleeping && h.movement >= h.maxMovement * 0.5 && h.maxMovement > 0; }) && this._turnSnap) {
        const ok = await UI.dialog({ title: T('Край на деня?'), text: T('Един или повече герои все още могат да се движат. Да приключим ли деня?'), buttons: [{ label: T('Да, нов ден'), value: true, cls: 'primary' }, { label: T('Назад'), value: false }] });
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
          UI.toast(T('Ход на ') + p.colorName.toLowerCase() + T(' играч…'));
          const gen = MK.AI.turn(w, p, {});
          let r = gen.next(), k = 0;
          while (!r.done) {
            if (r.value.type === 'battle') { this.busy = false; const res = await this.fight(r.value.ctx); this.busy = true; r = gen.next(res); }
            else if (r.value.type === 'step') { await this.followStep(r.value); r = gen.next(); }
            else { if (++k % 2 === 0) await sleep(0); r = gen.next(); }
          }
        }
        if (!w.players.some((p) => p.human && p.alive)) break;
        w.endTurn();
      }
      this.busy = false;
      if (!this.world) return;
      const me = w.players[w.curPlayer];
      if (!w.players.some((p) => p.human && p.alive)) { await this.drainEvents(); MK.Audio.loseGame(); await UI.dialog({ title: T('Поражение'), text: T('Кралството ти падна. Опитай отново!') }); localStorage.removeItem('mk_save'); this.world = null; document.getElementById('hud').hidden = true; UI.showMenu(this); return; }
      if (!me.human) { UI.toast(T('Грешка в реда на ходовете.')); return; }
      // Hot-seat: подаваме устройството
      if (humansCount > 1 || me.id !== this.human) { this.human = me.id; this.selected = null; this.renderer.selected = null; this.updateHUD(); await UI.passDevice(this, me); }
      if (w.dayOfWeek() === 1) MK.Audio.sfx('new_week'); else MK.Audio.sfxClip('new_week', 2000, 700);
      UI.dayBanner(w.day, w.week(), w.dayOfWeek(), w.dayOfWeek() === 1);
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

  const init = () => { if (MK.i18n) MK.i18n.applyData(); if (!MK.game) MK.game = new Game(); };
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', init); else init();
})();
