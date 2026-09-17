/* Интерактивен урок: малка карта, стъпка по стъпка с прожектор върху нужното място и текст,
   който обяснява какво е и къде да се натисне. Стъпките чакат играчът да го направи. */
(function () {
  'use strict';
  const MK = (window.MK = window.MK || {});
  const TR = (s) => (MK.T ? MK.T(s) : s);
  const $ = (id) => document.getElementById(id);

  const Tut = { active: false, step: -1, ov: null, tip: null, spot: null, timer: null, raf: null, steps: [] };

  /* ---------------------------------------------------------------- екран */
  function ensureOverlay() {
    if (Tut.ov) return;
    Tut.ov = MK.UI.el('div', { class: 'tut-ov' });
    Tut.spot = MK.UI.el('div', { class: 'tut-spot' });
    Tut.hand = MK.UI.el('div', { class: 'tut-hand' }, '👆');
    Tut.tip = MK.UI.el('div', { class: 'tut-tip' });
    Tut.ov.appendChild(Tut.spot); Tut.ov.appendChild(Tut.hand); Tut.ov.appendChild(Tut.tip);
    document.body.appendChild(Tut.ov);
    // Пътеводител: докосванията минават към играта само вътре в осветената цел; всичко друго е блокирано
    const pass = (e) => {
      if (Tut.tip.contains(e.target)) return;
      const step = Tut.steps[Tut.step]; const rect = step && step.when ? Tut.rect : null;
      const inside = rect && e.clientX >= rect.x && e.clientX <= rect.x + rect.w && e.clientY >= rect.y && e.clientY <= rect.y + rect.h;
      if (!inside) { e.stopPropagation(); e.preventDefault(); if (e.type === 'pointerup' && step && step.when) Tut.hand.classList.add('shake'); setTimeout(() => Tut.hand.classList.remove('shake'), 400); return; }
      // препращаме събитието към елемента под целта
      e.stopPropagation(); e.preventDefault();
      Tut.ov.style.pointerEvents = 'none';
      const el = document.elementFromPoint(e.clientX, e.clientY);
      Tut.ov.style.pointerEvents = '';
      if (!el) return;
      const ev = new PointerEvent(e.type, { bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId || 1, pointerType: e.pointerType || 'touch', button: e.button || 0, isPrimary: true });
      el.dispatchEvent(ev);
      if (e.type === 'pointerup') { const ce = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY }); el.dispatchEvent(ce); }
    };
    ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach((t) => Tut.ov.addEventListener(t, pass, true));
    Tut.ov.addEventListener('click', (e) => { if (!Tut.tip.contains(e.target)) { e.stopPropagation(); e.preventDefault(); } }, true);
    Tut.ov.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  function destroyOverlay() { if (Tut.ov) Tut.ov.remove(); Tut.ov = Tut.tip = Tut.spot = Tut.hand = null; Tut.rect = null; if (Tut.raf) cancelAnimationFrame(Tut.raf); Tut.raf = null; if (Tut.timer) clearInterval(Tut.timer); Tut.timer = null; }

  /* Правоъгълник на целта: DOM елемент, плочка от картата или хекс от битката */
  function targetRect(t, game) {
    if (!t) return null;
    if (typeof t === 'string') { const el = document.querySelector(t); if (!el) return null; const r = el.getBoundingClientRect(); return r.width ? { x: r.left, y: r.top, w: r.width, h: r.height } : null; }
    if (t.tile && game.world) {
      const R = game.renderer; if (!R || R.z !== (t.tile.z || 0)) return null;
      const S = R.tileSize() / R.dpr; const [sx, sy] = R.toScreen(t.tile.x, t.tile.y); const c = R.canvas.getBoundingClientRect();
      const x = c.left + sx / R.dpr, y = c.top + sy / R.dpr;
      const pad = S * (t.tile.pad || 0.15);
      return { x: x - pad, y: y - S * 0.5 - pad, w: S + pad * 2, h: S * 1.5 + pad * 2 };
    }
    if (t.fn) return t.fn(game);
    return null;
  }

  function place(step, game) {
    const modal = document.querySelector('#overlay .modal-wrap');
    Tut.ov.classList.toggle('yield', !!modal && !!step.when);
    const rect = targetRect(step.target, game);
    const sp = Tut.spot, tip = Tut.tip;
    Tut.rect = rect;
    if (rect) {
      sp.style.display = 'block';
      Tut.hand.style.display = step.when ? 'block' : 'none';
      const hr = (step.hand && targetRect(step.hand, game)) || rect;
      Tut.hand.style.left = (hr.x + hr.w / 2) + 'px'; Tut.hand.style.top = (hr.y + hr.h * 0.55) + 'px';
      sp.style.left = rect.x + 'px'; sp.style.top = rect.y + 'px'; sp.style.width = rect.w + 'px'; sp.style.height = rect.h + 'px';
      // текстът е под целта, ако има място, иначе над нея
      const vh = window.innerHeight, below = rect.y + rect.h + 12;
      tip.style.left = ''; tip.style.right = ''; tip.style.top = ''; tip.style.bottom = '';
      if (below + 150 < vh) { tip.style.top = below + 'px'; tip.classList.remove('above'); } else { tip.style.bottom = (vh - rect.y + 12) + 'px'; tip.classList.add('above'); }
      const cx = rect.x + rect.w / 2; tip.style.left = Math.max(8, Math.min(window.innerWidth - 8 - Math.min(340, window.innerWidth - 16), cx - 170)) + 'px';
      Tut.ov.classList.remove('center');
    } else {
      sp.style.display = 'none'; Tut.hand.style.display = 'none'; tip.style.left = ''; tip.style.top = ''; tip.style.bottom = '';
      Tut.ov.classList.add('center');
    }
  }

  function render(game) {
    const step = Tut.steps[Tut.step]; if (!step) return;
    ensureOverlay();
    const tip = Tut.tip; tip.innerHTML = '';
    const port = MK.Img.url('heroes/cleric_portrait');
    tip.appendChild(MK.UI.el('div', { class: 'tut-head' }, port ? MK.UI.el('img', { src: port, class: 'tut-avatar', alt: '' }) : MK.UI.el('span', { class: 'tut-avatar emoji' }, '🧙'), MK.UI.el('div', null, MK.UI.el('div', { class: 'tut-who' }, TR('Съветникът')), MK.UI.el('div', { class: 'tut-num' }, (Tut.step + 1) + ' / ' + Tut.steps.length))));
    tip.appendChild(MK.UI.el('div', { class: 'tut-text' }, step.text));
    const row = MK.UI.el('div', { class: 'tut-btns' });
    if (!step.when) row.appendChild(MK.UI.el('button', { class: 'primary small', onclick: () => next(game) }, step.last ? TR('Край на урока') : TR('Напред')));
    else row.appendChild(MK.UI.el('span', { class: 'tiny' }, step.waitText || TR('Направи го, за да продължим…')));
    row.appendChild(MK.UI.el('button', { class: 'small', onclick: () => stop(game, true) }, TR('Спри урока')));
    tip.appendChild(row);
    place(step, game);
  }

  function next(game) {
    Tut.step++;
    if (Tut.step >= Tut.steps.length) { stop(game, false); return; }
    const step = Tut.steps[Tut.step];
    if (step.setup) step.setup(game);
    render(game);
  }
  function stop(game, aborted) {
    Tut.active = false; destroyOverlay();
    try { localStorage.setItem('mk_tutorial_done', '1'); } catch (e) { /* noop */ }
    if (!aborted) MK.UI.dialog({ title: TR('Урокът е завършен'), text: TR('Вече знаеш основното. Продължи да играеш на тази карта или започни нова игра от менюто.') });
  }

  /* ---------------------------------------------------------------- стъпки */
  function buildSteps(game) {
    const w = game.world, p = w.players[game.human];
    const hero = () => w.heroes[p.heroes[0]];
    const town = () => w.towns[p.towns[0]];
    const S = [];
    S.push({ text: TR('Добре дошъл в MagicKnights! Това е кратък урок — ще ти показвам какво е всяко нещо и къде да натиснеш. Може да го спреш по всяко време.') });
    S.push({ text: TR('Това е твоят герой. Героите водят армиите ти по картата. Докосни го, за да го избереш.'), target: { get tile() { const h = hero(); return h ? { x: h.x, y: h.y, z: h.z || 0 } : null; } }, when: () => game.selected && game.selected.id === hero().id });
    S.push({ text: TR('Горе виждаш ресурсите си: злато, дърво, руда и редките — живак, сяра, кристал, скъпоценни камъни. С тях строиш сгради и наемаш войска.'), target: '#resbar' });
    S.push({ text: TR('Долу е подсказката: показва какво ще стане при докосване. Първо докосване на плочка показва пътя и дните, второ — тръгваш.'), target: '#hint' });
    S.push({ text: TR('Наблизо има ресурс. Докосни го веднъж, за да видиш пътя, и още веднъж, за да го вземеш.'), target: { get tile() { const o = game._tutRes; return o && w.objectAt(o.x, o.y, 0) ? { x: o.x, y: o.y, z: 0 } : null; } }, when: () => { const o = game._tutRes; return !o || !w.objectAt(o.x, o.y, 0); }, setup: (g) => { ensureTutorialObjects(g); } });
    S.push({ text: TR('Вляво е панелът: миникарта, героите и градовете ти. Докосни иконата на града, за да влезеш в него.'), target: '#town-list', when: () => !!document.querySelector('.screen.town') });
    S.push({ text: TR('Това е градът ти. Сградите на панорамата са кликаеми. Докосни управата (или бутона „Строеж“) и построй нещо — например Пазар или следващото жилище.'), target: '.screen.town', hand: '.town-tabs button:first-child', when: () => town() && Object.keys(town().buildings).length > game._tutBuildCount, setup: () => { game._tutBuildCount = Object.keys(town().buildings).length; } });
    S.push({ text: TR('Всяка седмица в жилищата се появяват нови същества. Докосни жилището (или „Набор“) и наеми войска — тя отива при героя, ако е в града, иначе в гарнизона.'), target: '.screen.town', hand: '.town-tabs button:nth-child(2)', when: () => { const t = town(); const h = hero(); const cnt = (a) => a.reduce((s, x) => s + (x ? x.n : 0), 0); return cnt(t.garrison) + cnt(h.army) > game._tutArmy; }, setup: () => { const t = town(); const h = hero(); const cnt = (a) => a.reduce((s, x) => s + (x ? x.n : 0), 0); game._tutArmy = cnt(t.garrison) + cnt(h.army); } });
    S.push({ text: TR('Затвори града с ✕ и се върни на картата.'), target: '.screen.town header button:last-child', when: () => !document.querySelector('.screen.town') });
    S.push({ text: TR('Задръж пръста върху нещо на картата (същество, град, обект), за да видиш подробности — колко са, какво дават.') });
    S.push({ text: TR('Когато си свършил за деня, натисни „Ход“. Компютърът играе своя ход, после идва нов ден с нови точки за движение.'), target: '#btn-end', when: () => w.day > game._tutDay, setup: () => { game._tutDay = w.day; } });
    S.push({ text: TR('Наблизо има малка група пазачи. Докосни ги — първо се показва прозорец с двете армии, после избираш „В бой!“ (ръчна битка) или „Бърз бой“. Избери „В бой!“.'), target: { get tile() { const o = game._tutMon; return o && w.objectAt(o.x, o.y, 0) ? { x: o.x, y: o.y, z: 0 } : null; } }, when: () => !$('battle').hidden, setup: (g) => { ensureTutorialObjects(g); } });
    S.push({ text: TR('Това е избраната ти единица (светещ хекс) и подсказката вляво. Съветникът ще мълчи, докато се биеш.'), target: '#battle' });
    S.push({ text: TR('Бойно поле. Единиците се редуват по скорост. Зелените хексове са докъдето може да стигне текущата единица. Докосни враг — светват хексовете, откъдето можеш да го удариш; докосни един от тях.'), target: '#battle', when: () => $('battle').hidden });
    S.push({ text: TR('Победа носи опит: сборът от живота на убитите врагове. С опит героят вдига нива и получава умения. Мините дават ресурси всеки ден — завладей ги, като стъпиш на тях.') });
    S.push({ text: TR('Това е всичко за начало. Целта: превземи градовете на противниците. Успех!'), last: true });
    return S;
  }

  /* Обекти за урока: ресурс и слаба група пазачи до героя (ако вече ги няма) */
  function ensureTutorialObjects(game) {
    const w = game.world, p = w.players[game.human], h = w.heroes[p.heroes[0]]; if (!h) return;
    const free = (x, y) => w.inb(x, y) && !w.isWater(x, y, 0) && !w.lv(0).block[w.idx(x, y)] && !w.objectAt(x, y, 0) && !w.heroAt(x, y, 0);
    const spot = (r0, r1) => { for (let r = r0; r <= r1; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = h.x + dx, y = h.y + dy; if (Math.max(Math.abs(dx), Math.abs(dy)) === r && free(x, y) && MK.Path.findPath(w, h, x, y)) return { x, y }; } return null; };
    if (!game._tutRes || !w.objectAt(game._tutRes.x, game._tutRes.y, 0)) { const s = spot(1, 3); if (s) { game._tutRes = w.addObject({ type: 'resource', res: 'wood', amount: 8, x: s.x, y: s.y, z: 0 }); p.fog[0][w.idx(s.x, s.y)] = 1; } }
    if (!game._tutMon || !w.objectAt(game._tutMon.x, game._tutMon.y, 0)) { const s = spot(2, 4); if (s) { game._tutMon = w.addObject({ type: 'monster', creature: p.faction + '1', count: 3, disposition: 10, x: s.x, y: s.y, z: 0 }); p.fog[0][w.idx(s.x, s.y)] = 1; } }
  }

  /* ---------------------------------------------------------------- старт */
  MK.Tutorial = {
    async start(game) {
      const D = MK.data;
      await game.newGame({ size: D.MAP_SIZES[0].size, difficulty: 0, players: [{ faction: 'kingdom', human: true }, { faction: 'necropolis', human: false }], template: D.TEMPLATE('duel'), seed: 4242, tutorial: true });
      const w = game.world, p = w.players[game.human];
      // без пазачи на нищо в началото — урокът да не спъва
      p.res.gold += 5000; p.res.wood += 20; p.res.ore += 20;
      ensureTutorialObjects(game);
      Tut.active = true; Tut.step = -1; Tut.steps = buildSteps(game);
      next(game);
      // следене: условия и позиция на прожектора
      const tick = () => { if (!Tut.active) return; const step = Tut.steps[Tut.step]; if (step && step.when && step.when()) { next(game); } };
      Tut.timer = setInterval(tick, 250);
      const loop = () => { if (!Tut.active) return; const step = Tut.steps[Tut.step]; if (step) place(step, game); Tut.raf = requestAnimationFrame(loop); }; loop();
    },
    stop: () => stop(MK.game, true),
    get active() { return Tut.active; }
  };
})();
