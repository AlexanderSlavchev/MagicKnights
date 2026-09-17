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
    // свободни стъпки (битка): целият екран е достъпен, съветникът само коментира
    Tut.ov.classList.toggle('yield', (!!modal && !!step.when) || !!step.free);
    // цел на картата извън екрана → камерата отива при нея (иначе играчът не може да я докосне)
    if (step.target && step.target.tile && game.renderer) {
      const t = step.target.tile;
      if (t) { if (game.renderer.z !== (t.z || 0)) game.renderer.z = t.z || 0; if (!game.renderer.isVisible(t.x, t.y)) game.renderer.center(t.x, t.y); }
    }
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
    const bar = MK.UI.el('div', { class: 'tut-progress' }); const pct = Math.round(100 * Tut.step / Math.max(1, Tut.steps.length - 1)); bar.appendChild(MK.UI.el('i', { style: 'width:' + pct + '%' })); tip.appendChild(bar);
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

  /* Празнуване на изпълнена стъпка: конфети, „Браво!“, звук; при етап — награда */
  function celebrate(game, step) {
    if (!step || !step.when) return;
    MK.Audio.sfx('treasure');
    const box = MK.UI.el('div', { class: 'tut-cheer' }, MK.UI.el('div', { class: 'tut-cheer-text' }, step.cheer || TR('Браво!')));
    for (let i = 0; i < 26; i++) { const c = MK.UI.el('i'); c.style.setProperty('--dx', (Math.random() * 2 - 1) * 260 + 'px'); c.style.setProperty('--dy', (Math.random() * -1) * 260 - 60 + 'px'); c.style.setProperty('--r', Math.random() * 720 + 'deg'); c.style.background = ['#ffd870', '#ff7a5c', '#7ad7ff', '#9fe39f', '#ff9de2'][i % 5]; box.appendChild(c); }
    document.body.appendChild(box); setTimeout(() => box.remove(), 1300);
    if (step.reward) { const p = game.world.players[game.human]; p.res.gold += step.reward; MK.UI.reward({ icon: MK.UI.el('img', { src: MK.Img.url('ui/icon_gold') || '', alt: '' }), amount: step.reward, title: MK.data.RES_NAME.gold, cls: 'res', ms: 1500 }); game.updateHUD(); }
  }
  function next(game) {
    celebrate(game, Tut.steps[Tut.step]);
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
    const cnt = (a) => a.reduce((s, x) => s + (x ? x.n : 0), 0);
    S.push({ text: TR('Добре дошъл в MagicKnights! Аз съм Съветникът и ще те водя. Ще правим истински неща — а за всяка задача има награда. Готов ли си?') });
    S.push({ text: TR('Това е твоят герой. Героите водят армиите ти по картата. Докосни го, за да го избереш.'), target: { get tile() { const h = hero(); return h ? { x: h.x, y: h.y, z: h.z || 0 } : null; } }, when: () => game.selected && game.selected.id === hero().id, cheer: TR('Героят е избран!') });
    S.push({ text: TR('Гледай — ще покажа как се движи кончето. Пътят се рисува със стрелки, а числото показва за колко дни се стига.'), demo: true, when: () => game._tutDemoDone, waitText: TR('Гледай…'), setup: (g) => { demoMove(g); } });
    S.push({ text: TR('Сега ти: наблизо има дърво. Докосни го веднъж, за да видиш пътя, и още веднъж, за да го вземеш.'), target: { get tile() { const o = game._tutRes; return o && w.objectAt(o.x, o.y, 0) ? { x: o.x, y: o.y, z: 0 } : null; } }, when: () => { const o = game._tutRes; return !o || !w.objectAt(o.x, o.y, 0); }, setup: (g) => { ensureTutorialObjects(g); }, cheer: TR('Първата плячка!'), reward: 500 });
    S.push({ text: TR('Горе са ресурсите ти. Златото е най-важно — плаща войската; дървото и рудата са за сгради; редките са за силните същества и магиите.'), target: '#resbar' });
    S.push({ text: TR('Ей там има мина. Стъпи на нея, за да я завладееш — от утре ще ти носи ресурси всеки ден.'), target: { get tile() { const o = game._tutMine; return o ? { x: o.x, y: o.y, z: 0 } : null; } }, when: () => { const o = game._tutMine; return !o || o.owner === game.human; }, setup: (g) => { ensureTutorialObjects(g); }, cheer: TR('Мината е твоя!'), reward: 500 });
    S.push({ text: TR('Вляво е панелът: миникарта, герои и градове. Докосни иконата на града, за да влезеш в него.'), target: '#town-list', when: () => !!document.querySelector('.screen.town'), cheer: TR('Добре дошъл у дома!') });
    S.push({ text: TR('Това е градът ти. Сградите на панорамата са кликаеми. Докосни „Строеж“ и построй нещо — Пазар или следващото жилище.'), target: '.screen.town', hand: '.town-tabs button:first-child', when: () => town() && Object.keys(town().buildings).length > game._tutBuildCount, setup: () => { game._tutBuildCount = Object.keys(town().buildings).length; }, cheer: TR('Строител!'), reward: 300 });
    S.push({ text: TR('Всяка седмица в жилищата се появяват нови същества. Докосни „Набор“ и наеми войска — колкото повече, толкова по-силен си в бой.'), target: '.screen.town', hand: '.town-tabs button:nth-child(2)', when: () => cnt(town().garrison) + cnt(hero().army) > game._tutArmy, setup: () => { game._tutArmy = cnt(town().garrison) + cnt(hero().army); }, cheer: TR('Армията расте!') });
    S.push({ text: TR('Таверната предлага втори герой. Двама герои = два пъти повече плячка. Докосни „Таверна“ и наеми един (златото е от мен).'), target: '.screen.town', hand: '.town-tabs button:nth-child(4)', when: () => p.heroes.length > 1, setup: () => { p.res.gold += 3000; if (!town().buildings.tavern) town().buildings.tavern = true; }, cheer: TR('Втори герой!') });
    S.push({ text: TR('Затвори града с ✕ и се върни на картата.'), target: '.screen.town header button:last-child', when: () => !document.querySelector('.screen.town') });
    S.push({ text: TR('Подарък: артефакт! Отвори героя (бутона „Герой“) — артефактите се слагат по тялото на рицаря и дават бонуси.'), target: '#btn-hero', when: () => !!document.querySelector('.screen .doll'), setup: () => { const h = hero(); if (!h.arts.some(Boolean) && !h.backpack.length) w.equipArtifact(h, 'shield_oak'); }, cheer: TR('Екипиран!') });
    S.push({ text: TR('Затвори екрана на героя.'), target: '.screen header button:last-child', when: () => !document.querySelector('.screen .doll') });
    S.push({ text: TR('Задръж пръста върху нещо на картата (същество, град, обект), за да видиш подробности. Пробвай върху пазачите ей там.'), target: { get tile() { const o = game._tutMon; return o && w.objectAt(o.x, o.y, 0) ? { x: o.x, y: o.y, z: 0 } : null; } }, when: () => !!document.querySelector('#overlay .modal') || game._tutSeenInfo, setup: (g) => { ensureTutorialObjects(g); }, cheer: TR('Знанието е сила!') });
    S.push({ text: TR('Когато си свършил за деня, натисни „Ход“. Компютърът играе, после идва нов ден с нови точки за движение.'), target: '#btn-end', when: () => w.day > game._tutDay, setup: () => { game._tutDay = w.day; document.querySelectorAll('#overlay .modal-wrap').forEach((m) => m.remove()); }, cheer: TR('Нов ден!') });
    S.push({ text: TR('Време за бой! Докосни пазачите — избери „В бой!“, за да ти покажа бойното поле.'), target: { get tile() { const o = game._tutMon; return o && w.objectAt(o.x, o.y, 0) ? { x: o.x, y: o.y, z: 0 } : null; } }, when: () => !$('battle').hidden, setup: (g) => { ensureTutorialObjects(g); const h = hero(); if (!h.spells.includes('magic_arrow')) h.spells.push('magic_arrow'); h.mana = Math.max(h.mana, 10); } });
    S.push({ text: TR('Бойно поле! Единиците се редуват по скорост. Зелените хексове са докъдето стига текущата. Опитай магия: „Магия“ → Магическа стрела → врага. После ги довърши с меча: докосни враг и избери откъде да го удариш.'), target: null, free: true, when: () => $('battle').hidden, waitText: TR('Бий се…'), cheer: TR('Победа!'), reward: 700 });
    S.push({ text: TR('Опитът от битката вдига ниво! Избери умение — те правят героя уникален.'), target: '#btn-level', when: () => !hero().pendingLevels, setup: () => { const h = hero(); if (!h.pendingLevels) w.gainXp(h, 1000); game.updateHUD(); }, cheer: TR('Ново ниво!') });
    S.push({ text: TR('Това е играта: ход по ход събираш, строиш, наемаш и се биеш, докато превземеш всички вражески градове. Ето финалната награда — и те чакат шест кампании с истории.'), last: true, reward: 1000 });
    return S;
  }

  /* Демонстрация: героят тръгва сам по къс път, за да се види конят, стрелките и дните */
  async function demoMove(game) {
    const w = game.world, p = w.players[game.human], h = w.heroes[p.heroes[0]];
    game._tutDemoDone = false;
    let target = null;
    for (let r = 2; r <= 3 && !target; r++) for (let dy = -r; dy <= r && !target; dy++) for (let dx = -r; dx <= r && !target; dx++) { const x = h.x + dx, y = h.y + dy; if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; if (w.inb(x, y) && !w.isWater(x, y, 0) && !w.lv(0).block[w.idx(x, y)] && !w.objectAt(x, y, 0) && !w.heroAt(x, y, 0)) { const pp = MK.Path.findPath(w, h, x, y); if (pp && pp.total <= h.movement) target = { x, y, pp }; } }
    if (!target) { game._tutDemoDone = true; return; }
    game.selectHero(h, true);
    game.renderer.pathPreview = target.pp;
    await new Promise((r) => setTimeout(r, 1400));
    try { await game.moveSelected(game.renderer.pathPreview); } catch (e) { /* noop */ }
    await new Promise((r) => setTimeout(r, 400));
    game._tutDemoDone = true;
  }
  /* Обекти за урока: ресурс и слаба група пазачи до героя (ако вече ги няма) */
  function ensureTutorialObjects(game) {
    const w = game.world, p = w.players[game.human], h = w.heroes[p.heroes[0]]; if (!h) return;
    const free = (x, y) => w.inb(x, y) && !w.isWater(x, y, 0) && !w.lv(0).block[w.idx(x, y)] && !w.objectAt(x, y, 0) && !w.heroAt(x, y, 0);
    const spot = (r0, r1) => { for (let r = r0; r <= r1; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = h.x + dx, y = h.y + dy; if (Math.max(Math.abs(dx), Math.abs(dy)) === r && free(x, y) && MK.Path.findPath(w, h, x, y)) return { x, y }; } return null; };
    if (!game._tutRes || !w.objectAt(game._tutRes.x, game._tutRes.y, 0)) { const s = spot(1, 3); if (s) { game._tutRes = w.addObject({ type: 'resource', res: 'wood', amount: 8, x: s.x, y: s.y, z: 0 }); p.fog[0][w.idx(s.x, s.y)] = 1; } }
    if (!game._tutMine) { let best = null, bd = Infinity; w.map.objects.forEach((o) => { if (o.type === 'mine' && (o.z || 0) === 0 && o.owner !== game.human) { const d = Math.hypot(o.x - h.x, o.y - h.y); if (d < bd && MK.Path.findPath(w, h, o.x, o.y)) { bd = d; best = o; } } }); if (best) { delete best.guard; game._tutMine = best; p.fog[0][w.idx(best.x, best.y)] = 1; } }
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
      const tick = () => { if (!Tut.active) return; const step = Tut.steps[Tut.step]; if (!step) return; if (step.when && step.when()) { next(game); return; } if (step.target && step.target.tile === null && step.when) { next(game); } };
      Tut.timer = setInterval(tick, 250);
      const loop = () => { if (!Tut.active) return; const step = Tut.steps[Tut.step]; if (step) place(step, game); Tut.raf = requestAnimationFrame(loop); }; loop();
    },
    stop: () => stop(MK.game, true),
    get active() { return Tut.active; }
  };
})();
