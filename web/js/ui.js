/* DOM интерфейс: меню, настройка на игра, HUD, град, герой, диалози */
(function () {
  'use strict';
  const MK = (window.MK = window.MK || {});
  const T = (s) => (MK.T ? MK.T(s) : s);
  const D = MK.data;
  const G = MK.Gfx;

  // ---------------------------------------------------------------- помощни
  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (attrs[k] === null || attrs[k] === undefined || attrs[k] === false) continue;
      if (k === 'class') e.className = attrs[k];
      else if (k === 'onclick') e.addEventListener('click', attrs[k]);
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k === 'style') e.style.cssText = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    children.flat().forEach((c) => { if (c === null || c === undefined || c === false) return; e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c); });
    return e;
  }
  const overlay = () => document.getElementById('overlay');
  function costHtml(cost, res) {
    const c = el('span', { class: 'cost' });
    for (const k in cost) { if (!cost[k]) continue; const lack = res && (res[k] || 0) < cost[k]; const u = MK.Img.url('ui/icon_' + k); c.appendChild(el('span', { class: lack ? 'lack' : '' }, u ? el('img', { src: u, class: 'res-ico', alt: '' }) : el('i', { style: 'background:' + D.RES_COLOR[k] }), String(cost[k]))); }
    return c;
  }
  function spriteCanvas(src, w, h) {
    const c = el('canvas', { width: w, height: h }); const g = c.getContext('2d');
    const k = Math.min(w / src.width, h / src.height); const dw = src.width * k, dh = src.height * k;
    g.drawImage(src, (w - dw) / 2, h - dh, dw, dh); return c;
  }
  /* Награда „като в казино“: централна карта с икона, число с броене и искри; опашка за няколко поред */
  const rewardQ = []; let rewardBusy = false;
  function reward(r) { rewardQ.push(r); if (!rewardBusy) nextReward(); }
  function nextReward() {
    const r = rewardQ.shift(); if (!r) { rewardBusy = false; return; }
    rewardBusy = true;
    const card = el('div', { class: 'reward ' + (r.cls || '') });
    const iconWrap = el('div', { class: 'reward-icon' });
    if (r.icon) iconWrap.appendChild(r.icon);
    const num = el('div', { class: 'reward-num' }, r.amount !== undefined ? '+0' : '');
    card.appendChild(iconWrap);
    if (r.amount !== undefined) card.appendChild(num);
    card.appendChild(el('div', { class: 'reward-title' }, r.title));
    if (r.sub) card.appendChild(el('div', { class: 'reward-sub' }, r.sub));
    for (let i = 0; i < 14; i++) { const sp = el('i', { class: 'spark' }); sp.style.setProperty('--dx', (Math.random() * 2 - 1) * 160 + 'px'); sp.style.setProperty('--dy', (Math.random() * 2 - 1) * 120 - 40 + 'px'); sp.style.setProperty('--d', (Math.random() * 0.4) + 's'); card.appendChild(sp); }
    const wrap = el('div', { class: 'reward-wrap' }, card);
    document.body.appendChild(wrap);
    if (r.amount !== undefined) { const t0 = performance.now(), dur = 700; const tick = () => { const k = Math.min(1, (performance.now() - t0) / dur); num.textContent = '+' + Math.round(r.amount * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
    const done = () => { if (!wrap.parentNode) return; wrap.classList.add('out'); setTimeout(() => { wrap.remove(); nextReward(); }, 320); };
    wrap.addEventListener('pointerdown', done);
    setTimeout(done, r.ms || 1900);
  }
  /* Банер за нов ден / нова седмица през средата на екрана */
  function dayBanner(day, week, dow, newWeek) {
    const b = el('div', { class: 'day-banner' + (newWeek ? ' week' : '') },
      el('div', { class: 'db-top' }, newWeek ? T('Нова седмица') : T('Нов ден')),
      el('div', { class: 'db-main' }, newWeek ? T('Седмица ') + week : T('Ден ') + day),
      el('div', { class: 'db-sub' }, newWeek ? T('Ден ') + day + T(' · съществата в градовете са нараснали') : T('Седмица ') + week + T(', ден ') + dow));
    document.body.appendChild(b);
    setTimeout(() => b.classList.add('out'), newWeek ? 2300 : 1700);
    setTimeout(() => b.remove(), newWeek ? 2800 : 2200);
  }
  /* Прозорец за зареждане; връща елемент с .remove() */
  function loading(text) {
    const wrap = el('div', { class: 'modal-wrap loading' }, el('div', { class: 'modal', style: 'text-align:center;max-width:320px' }, el('div', { class: 'spinner' }), el('p', null, text)));
    overlay().appendChild(wrap); return wrap;
  }
  function toast(text) { const t = el('div', { class: 'toast' }, text); document.getElementById('toasts').appendChild(t); setTimeout(() => t.remove(), 4000); }

  // Модален диалог. buttons: [{label, value, cls}] → Promise<value>
  function dialog(opts) {
    return new Promise((resolve) => {
      const wrap = el('div', { class: 'modal-wrap' });
      const m = el('div', { class: 'modal' });
      if (opts.title) m.appendChild(el('h2', null, opts.title));
      if (opts.text) m.appendChild(el('p', null, opts.text));
      if (opts.content) m.appendChild(opts.content);
      const bs = el('div', { class: 'buttons' });
      (opts.buttons || [{ label: T('Добре'), value: true }]).forEach((b) => bs.appendChild(el('button', { class: b.cls || '', disabled: b.disabled ? 'disabled' : null, onclick: () => { wrap.remove(); resolve(b.value); } }, b.label)));
      m.appendChild(bs);
      wrap.appendChild(m); overlay().appendChild(wrap);
    });
  }
  function closeScreens() { overlay().querySelectorAll('.screen').forEach((s) => s.remove()); }
  function screen(cls) { closeScreens(); const s = el('div', { class: 'screen ' + (cls || '') }); overlay().appendChild(s); return s; }

  // ---------------------------------------------------------------- главно меню
  function showMenu(game) {
    MK.Audio.menu();
    const s = screen('menu');
    const hasSave = !!localStorage.getItem('mk_save');
    const logo = MK.Img.url('ui/logo');
    if (logo) s.appendChild(el('img', { src: logo, class: 'logo', alt: 'MagicKnights' }));
    s.appendChild(el('div', { class: 'title' + (logo ? ' with-logo' : '') }, 'MagicKnights'));
    s.appendChild(el('div', { class: 'subtitle' }, T('Герои, замъци и битки на хексове — класическата стратегия наново, за телефона ти.')));
    s.appendChild(el('div', { class: 'stack' },
      el('button', { class: 'primary', onclick: () => showSetup(game) }, T('Нова игра')),
      el('button', { onclick: () => showCampaign(game) }, T('Кампания')),
      el('button', { onclick: () => game.load(), disabled: hasSave ? null : 'disabled' }, T('Продължи')),
      el('button', { onclick: () => showHelp(game) }, T('Как се играе')),
      game.world ? el('button', { onclick: () => { closeScreens(); game.afterScreen(); } }, T('Назад към играта')) : null
    ));
    s.appendChild(audioPanel());
    s.appendChild(el('div', { class: 'tiny', style: 'margin-top:20px' }, T('Версия 0.3 · Фази 1–3 · 11 фракции, подземие, кораби, кампания · Музиката е оригинална')));
  }
  function audioPanel() {
    const A = MK.Audio, box = el('div', { class: 'audio-panel' });
    const mute = el('button', { class: 'small', onclick: () => { A.toggleMuted(); mute.textContent = A.settings.muted ? T('🔇 Без звук') : T('🔊 Звук'); } }, A.settings.muted ? T('🔇 Без звук') : T('🔊 Звук'));
    const slider = (label, val, on) => { const i = el('input', { type: 'range', min: 0, max: 100, value: Math.round(val * 100) }); i.addEventListener('input', () => on(i.value / 100)); return el('label', { class: 'tiny' }, label, i); };
    box.appendChild(mute);
    // език
    const sel = el('select', { class: 'lang' }); MK.i18n.LANGS.forEach(([c, n]) => { const o = el('option', { value: c }, n); if (c === MK.i18n.lang) o.selected = true; sel.appendChild(o); }); sel.addEventListener('change', () => MK.i18n.set(sel.value));
    box.appendChild(el('label', { class: 'tiny' }, '🌐', sel));
    box.appendChild(slider(T('Музика'), A.settings.music, (v) => A.setMusic(v)));
    box.appendChild(slider(T('Ефекти'), A.settings.sfx, (v) => A.setSfx(v)));
    return box;
  }
  function showHelp(game) {
    if (game && game.newGame) {
      return dialog({ title: T('Как се играе'), text: T('Искаш ли интерактивен урок на малка карта — стъпка по стъпка с показване къде да натиснеш? Или само кратките правила?'), buttons: [{ label: T('▶ Урок'), value: 'tut', cls: 'primary' }, { label: T('Правила'), value: 'text' }, { label: T('Назад'), value: false }] }).then((v) => { if (v === 'tut') MK.Tutorial.start(game); else if (v === 'text') showHelpText(); });
    }
    return showHelpText();
  }
  function showHelpText() {
    dialog({ title: T('Как се играе'), content: el('div', null,
      el('p', null, T('Всеки ход местиш героите си по картата, събираш ресурси, превземаш мини и градове и се биеш с пазачите. Докосни плочка, за да видиш пътя, докосни я пак, за да тръгнеш. Плъзгане мести картата, щипка — мащабира.')),
      el('p', null, T('В града строиш по една сграда на ден и набираш същества всяка седмица. Героят вдига ниво от опит и избира умения.')),
      el('p', null, T('Битката е на хексове: ходът е по скорост. Докосни хекс — местиш се; докосни враг в обхват — нападаш. Стрелците стрелят от разстояние (наполовина щети над 10 хекса и в близък бой). Веднъж на рунд героят може да направи магия.')),
      el('p', null, T('Щетите: всяка точка атака над защитата на врага дава +5%, всяка точка защита над атаката — −2.5%. Морал може да даде втори ход, късмет — двойни щети.')),
      el('p', null, T('Победа: превземи всички вражески градове и разбий героите им. Седем дни без град — загуба.'))
    ) });
  }

  // ---------------------------------------------------------------- нова игра
  function factionPicker(value, onPick, allowRandom) {
    const row = el('div', { class: 'opt-row', style: 'gap:4px' });
    if (allowRandom) row.appendChild(el('button', { class: 'small' + (value === 'random' ? ' sel' : ''), onclick: () => onPick('random') }, T('🎲 Случайна')));
    D.FACTIONS.forEach((f) => row.appendChild(el('button', { class: 'small' + (value === f.id ? ' sel' : ''), style: 'border-color:' + f.color, title: f.desc, onclick: () => onPick(f.id) }, f.name)));
    return row;
  }
  function showSetup(game) {
    const s = screen('menu');
    const st = { size: 's', difficulty: 1, template: 'balanced', players: [{ type: 'human', faction: 'kingdom' }, { type: 'ai', faction: 'random' }, { type: 'none', faction: 'random' }, { type: 'none', faction: 'random' }] };
    s.appendChild(el('div', { class: 'title', style: 'font-size:30px' }, T('Нова игра')));
    const body = el('div', { class: 'modal', style: 'max-width:620px' });
    const optRow = (label, options, get, set) => {
      const row = el('div', { class: 'opt-row' }, el('label', null, label));
      options.forEach((o) => row.appendChild(el('button', { class: 'small' + (get() === o.v ? ' sel' : ''), title: o.t || null, onclick: () => { set(o.v); render(); } }, o.l)));
      return row;
    };
    const render = () => {
      body.innerHTML = '';
      body.appendChild(optRow(T('Карта'), D.MAP_SIZES.map((m) => ({ v: m.id, l: m.name + ' (' + m.size + ')' })), () => st.size, (v) => { st.size = v; }));
      body.appendChild(optRow(T('Шаблон'), D.TEMPLATES.map((t) => ({ v: t.id, l: t.name, t: t.desc })), () => st.template, (v) => { st.template = v; }));
      body.appendChild(el('div', { class: 'tiny', style: 'margin:-2px 0 6px 116px' }, D.TEMPLATE(st.template).desc + (D.TEMPLATE(st.template).underground && st.size === 's' ? T(' Подземие има от средна карта нагоре.') : '')));
      body.appendChild(optRow(T('Трудност'), D.DIFFICULTY.map((d) => ({ v: d.id, l: d.name })), () => st.difficulty, (v) => { st.difficulty = v; }));
      body.appendChild(el('h3', { style: 'margin:10px 0 6px;color:#ffd870' }, T('Играчи (до 4, повече от един човек = hot-seat на едно устройство)')));
      st.players.forEach((pl, i) => {
        const card = el('div', { class: 'panel', style: 'margin-bottom:6px;border-color:' + D.PLAYER_COLORS[i].col });
        const types = [{ v: 'human', l: T('🧑 Човек') }, { v: 'ai', l: T('🤖 Компютър') }];
        if (i > 0) types.push({ v: 'none', l: T('— Няма') });
        card.appendChild(optRow(D.PLAYER_COLORS[i].name, types, () => pl.type, (v) => { pl.type = v; }));
        if (pl.type !== 'none') card.appendChild(factionPicker(pl.faction, (f) => { pl.faction = f; render(); }, true));
        body.appendChild(card);
      });
      const humans = st.players.filter((p) => p.type === 'human').length, active = st.players.filter((p) => p.type !== 'none').length;
      body.appendChild(el('div', { class: 'buttons', style: 'display:flex;gap:8px;margin-top:10px' },
        el('button', { onclick: () => showMenu(game) }, T('Назад')),
        el('button', { class: 'primary', disabled: humans >= 1 && active >= 2 ? null : 'disabled', onclick: () => {
          const players = st.players.filter((p) => p.type !== 'none').map((p) => ({ faction: p.faction === 'random' ? D.FACTIONS[Math.floor(Math.random() * D.FACTIONS.length)].id : p.faction, human: p.type === 'human' }));
          // първият човек винаги е играч 0 (за подредба на ходовете)
          players.sort((a, b) => (b.human ? 1 : 0) - (a.human ? 1 : 0));
          game.newGame({ size: D.MAP_SIZES.find((m) => m.id === st.size).size, difficulty: st.difficulty, players, template: D.TEMPLATE(st.template), seed: (Math.random() * 4294967295) >>> 0 });
        } }, humans > 1 ? T('Започни (hot-seat)') : T('Започни'))
      ));
      if (!(humans >= 1 && active >= 2)) body.appendChild(el('div', { class: 'tiny center' }, T('Нужен е поне един човек и поне двама играчи.')));
    };
    render();
    s.appendChild(body);
  }

  // ---------------------------------------------------------------- кампания
  function showCampaign(game) {
    MK.Audio.campaign();
    const s = screen('menu');
    s.appendChild(el('div', { class: 'title', style: 'font-size:30px' }, T('Кампании')));
    const body = el('div', { class: 'modal', style: 'max-width:640px' });
    MK.CAMPAIGNS.forEach((C) => {
      const prog = MK.Campaign.load(C.id), n = C.scenarios.length, done = Math.min(prog.done, n);
      const row = el('div', { class: 'row', style: 'cursor:pointer', onclick: () => showCampaignScenarios(game, C.id) });
      row.appendChild(spriteCanvas(G.objectSprite({ type: 'town', faction: C.faction, owner: -1 }, 96, null), 56, 56));
      row.appendChild(el('div', { class: 'grow' }, el('div', { class: 'name' }, (done >= n ? '✔ ' : '') + C.title), el('div', { class: 'sub' }, C.intro.split('. ')[0] + '.'), el('div', { class: 'tiny' }, D.factionById(C.faction).name + ' · ' + n + T(' сценария · ') + C.difficulty + T(' · завършени ') + done + '/' + n)));
      row.appendChild(el('button', { class: 'small' + (done < n ? ' primary' : '') }, done >= n ? T('Отново') : done ? T('Продължи') : T('Играй')));
      body.appendChild(row);
    });
    body.appendChild(el('div', { class: 'buttons', style: 'display:flex;gap:8px;margin-top:10px' }, el('button', { onclick: () => showMenu(game) }, T('Назад'))));
    s.appendChild(body);
  }
  function showCampaignScenarios(game, cid) {
    MK.Audio.campaign();
    const s = screen('menu');
    const C = MK.campaignById(cid), prog = MK.Campaign.load(cid);
    s.appendChild(el('div', { class: 'title', style: 'font-size:30px' }, C.title));
    const body = el('div', { class: 'modal', style: 'max-width:640px' });
    body.appendChild(el('p', null, C.intro));
    if (prog.hero) body.appendChild(el('p', { class: 'tiny' }, T('Пренасян герой: ') + prog.hero.name + T(', ниво ') + prog.hero.level + ' (' + D.CLASSES[prog.hero.cls].name + ').'));
    C.scenarios.forEach((sc, i) => {
      const done = i < prog.done, avail = i === prog.done;
      const row = el('div', { class: 'row' });
      row.appendChild(el('div', { class: 'grow' }, el('div', { class: 'name' }, (done ? '✔ ' : avail ? '▶ ' : '🔒 ') + sc.id + '. ' + sc.title), el('div', { class: 'sub' }, sc.text), el('div', { class: 'tiny' }, MK.Campaign.goalText(sc) + ' · ' + D.MAP_SIZES.find((m) => m.size === sc.size).name + T(' карта · ') + D.TEMPLATE(sc.template).name + ' · ' + D.DIFFICULTY[sc.difficulty].name + ' · ' + D.factionById(sc.playerFaction).name + T(' срещу ') + sc.opponents.map((f) => D.factionById(f).name).join(', '))));
      row.appendChild(el('button', { class: 'small' + (avail ? ' primary' : ''), disabled: avail || done ? null : 'disabled', onclick: () => game.startCampaign(cid, i) }, done ? T('Отново') : T('Играй')));
      body.appendChild(row);
    });
    body.appendChild(el('div', { class: 'buttons', style: 'display:flex;gap:8px;margin-top:10px' },
      el('button', { onclick: () => showCampaign(game) }, T('Назад')),
      el('button', { class: 'danger', onclick: () => { MK.Campaign.reset(cid); showCampaignScenarios(game, cid); } }, T('Изтрий напредъка'))
    ));
    s.appendChild(body);
  }
  function passDevice(game, p) {
    return dialog({ title: T('Ред на ') + p.colorName.toLowerCase() + T(' играч'), text: T('Подай устройството на ') + p.colorName.toLowerCase() + T(' играч (') + D.factionById(p.faction).name + T('). Другите да не гледат!'), buttons: [{ label: T('Готов съм'), value: true, cls: 'primary' }] });
  }

  // ---------------------------------------------------------------- HUD
  function updateHUD(game) {
    const w = game.world, p = w.players[game.human];
    const rb = document.getElementById('resbar');
    rb.innerHTML = '';
    D.RES.forEach((r) => { const u = MK.Img.url('ui/icon_' + r); rb.appendChild(el('span', { class: 'res', title: D.RES_NAME[r] }, u ? el('img', { src: u, class: 'res-ico', alt: '' }) : el('i', { style: 'background:' + D.RES_COLOR[r] }), String(p.res[r]))); });
    rb.appendChild(el('span', { class: 'date' }, w.dateText()));
    const hl = document.getElementById('hero-list'); hl.innerHTML = '';
    p.heroes.forEach((id) => {
      const h = w.heroes[id];
      const it = el('div', { class: 'item' + (game.selected === h ? ' sel' : ''), title: h.name, onclick: () => game.selectHero(h, true) });
      it.appendChild(spriteCanvas(G.portrait(h, 96, p.color), 44, 44));
      it.appendChild(el('div', { class: 'bar', style: 'width:' + Math.round(100 * h.movement / Math.max(1, h.maxMovement)) + '%' }));
      it.appendChild(el('div', { class: 'mana', style: 'height:' + Math.round(100 * h.mana / Math.max(1, w.maxMana(h))) + '%' }));
      if (h.pendingLevels) it.appendChild(el('div', { class: 'dot' }));
      it.addEventListener('dblclick', () => showHero(game, h));
      hl.appendChild(it);
    });
    const tl = document.getElementById('town-list'); tl.innerHTML = '';
    p.towns.forEach((id) => {
      const t = w.towns[id];
      const it = el('div', { class: 'item', title: t.name, onclick: () => { game.renderer.center(t.x, t.y); showTown(game, t); } });
      it.appendChild(spriteCanvas(G.objectSprite({ type: 'town', faction: t.faction, owner: t.owner }, 96, w), 44, 44));
      // както в класиките: чук = днес може да се строи, задраскан чук = вече е строено; зелена точка = има същества за наемане
      it.appendChild(el('span', { class: 'badge' + (t.builtToday ? ' built' : ''), title: t.builtToday ? T('Днес вече е строено') : T('Може да се строи') }, '🔨'));
      const canRecruit = t.avail.some((n, tier) => tier > 0 && n > 0 && t.buildings['dw' + tier] && w.maxAffordable(p, t.faction + tier + (t.buildings['dw' + tier + 'u'] ? 'u' : '')) > 0);
      if (canRecruit) it.appendChild(el('span', { class: 'badge recruit', title: T('Има същества за наемане') }, '●'));
      tl.appendChild(it);
    });
    document.getElementById('hint').textContent = game.hint || '';
    const lb = document.getElementById('btn-level'); if (lb) { lb.hidden = !w.hasUnderground(); lb.textContent = game.renderer.z ? T('⬆ Горе') : T('⬇ Долу'); }
    game.renderer.drawMinimap(document.getElementById('minimap'), w, p);
  }

  // ---------------------------------------------------------------- армия (общ компонент)
  /* Рисува 7 слота; sel={army,i}. onPick(army,i) */
  function armyRow(game, army, sel, onPick, opts) {
    const row = el('div', { class: 'army' });
    for (let i = 0; i < 7; i++) {
      const sl = army[i];
      const d = el('div', { class: 'slot' + (sel && sel.army === army && sel.i === i ? ' sel' : ''), onclick: () => onPick(army, i) });
      if (sl) { const c = D.creatureOf(sl.c); d.title = c.name; d.appendChild(spriteCanvas(G.creatureSprite(c, 96), 56, 52)); d.appendChild(el('div', { class: 'n' }, String(sl.n))); if (c.upg) d.appendChild(el('div', { class: 'u' }, '★')); }
      row.appendChild(d);
    }
    return row;
  }
  /* Логика при докосване на слот: избор / размяна / сливане. state.sel = {army,i} */
  function armyPick(state, army, i, rerender, game) {
    const sel = state.sel;
    if (!sel) { if (army[i]) state.sel = { army, i }; rerender(); return; }
    if (sel.army === army && sel.i === i) { // втори тап върху същия: инфо/разделяне
      const sl = army[i];
      if (sl && sl.n > 1) splitDialog(state, army, i, rerender); else { state.sel = null; rerender(); }
      return;
    }
    MK.Army.move(sel.army, sel.i, army, i);
    state.sel = null; rerender();
    if (game) game.onArmyChanged && game.onArmyChanged();
  }
  function splitDialog(state, army, i, rerender) {
    const sl = army[i]; const c = D.creatureOf(sl.c);
    let n = Math.floor(sl.n / 2);
    const lbl = el('b', { style: 'font-size:22px;color:#ffd870;min-width:60px;text-align:center' }, String(n));
    const range = el('input', { type: 'range', min: 1, max: sl.n - 1, value: n, style: 'flex:1' });
    range.addEventListener('input', () => { n = +range.value; lbl.textContent = String(n); });
    const content = el('div', null, el('p', null, c.name + ' × ' + sl.n + T('. Колко да отделиш в нов слот?')), el('div', { style: 'display:flex;gap:8px;align-items:center' }, range, lbl));
    dialog({ title: T('Разделяне'), content, buttons: [{ label: T('Отказ'), value: false }, { label: T('Инфо за съществото'), value: 'info' }, { label: T('Раздели'), value: true, cls: 'primary' }] }).then((v) => {
      if (v === 'info') { creatureInfo(c); }
      else if (v) { const j = army.findIndex((s) => !s); if (j >= 0) MK.Army.split(army, i, army, j, n); else toast(T('Няма свободен слот.')); }
      state.sel = null; rerender();
    });
  }
  function abilityText(c) {
    const a = c.abilities; const out = [];
    if (a.shooter) out.push(T('стрелец (') + c.shots + T(' изстрела)')); if (a.flying) out.push(T('лети')); if (a.noMeleePenalty) out.push(T('без наказание в близък бой'));
    if (a.doubleAttack) out.push(T('двоен удар')); if (a.doubleShot) out.push(T('двоен изстрел')); if (a.noRetaliation) out.push(T('без ответен удар')); if (a.retaliations) out.push(a.retaliations > 10 ? T('неограничени ответни удари') : a.retaliations + T(' ответни удара'));
    if (a.lifeDrain) out.push(T('изпива живот')); if (a.regenerate) out.push(T('регенерира')); if (a.breath) out.push(T('дъх (удря 2 хекса)')); if (a.jousting) out.push(T('атака +5% на хекс разбег'));
    if (a.magicRes) out.push(a.magicRes + T('% магическа съпротива')); if (a.spellImmune) out.push(T('имунитет за магии до ') + a.spellImmune + T(' ниво')); if (a.undead) out.push(T('немъртъв')); if (a.moraleAura) out.push(T('+1 морал на съюзниците'));
    if (a.fearAura) out.push(T('−1 морал на врага')); if (a.curseHit) out.push(a.curseHit + T('% проклятие при удар')); if (a.blindHit) out.push(a.blindHit + T('% ослепяване при удар')); if (a.resurrect) out.push(T('възкресява')); if (a.deathBlow) out.push(a.deathBlow + T('% смъртоносен удар'));
    if (a.ageHit) out.push(a.ageHit + T('% състаряване')); if (a.ignoreDef) out.push(T('пренебрегва ') + a.ignoreDef + T('% от защитата')); if (a.ignoreAtt) out.push(T('намалява атаката на врага с ') + a.ignoreAtt + '%'); if (a.deathStare) out.push(T('смъртоносен поглед ') + a.deathStare + '%'); if (a.fireImmune) out.push(T('огнен имунитет')); if (a.mindImmune) out.push(T('имунитет за ум')); if (a.rebirth) out.push(T('прераждане')); if (a.fireShield) out.push(T('огнен щит ') + a.fireShield + '%'); if (a.badLuckAura) out.push(T('−1 късмет на врага')); if (a.goodMorale) out.push(T('винаги добър морал')); if (a.thunderHit) out.push(a.thunderHit + T('% гръмотевичен удар')); if (a.weakHit) out.push(T('отслабва при удар')); if (a.dispelHit) out.push(T('разсейва магии при удар')); if (a.blindImmune) out.push(T('не може да бъде ослепен')); if (a.noObstaclePenalty) out.push(T('стреля през стени без наказание'));
    if (c.wide) out.push(T('заема два хекса')); if (a.manaDrain) out.push(T('изпива мана')); if (a.deathCloud) out.push(T('облак на смъртта')); if (a.bindHit) out.push(T('оплита корени')); if (a.resAura) out.push(T('20% съпротива за съседите')); if (a.allAround) out.push(T('удря всички съседи')); if (a.manaCost) out.push('+' + a.manaCost + T(' цена на вражеските магии'));
    return out.join(', ') || '—';
  }
  /* Описание на числеността по класическата скала + точен брой */
  const countWord = (n) => (n < 5 ? T('няколко') : n < 10 ? T('малко') : n < 20 ? T('глутница') : n < 50 ? T('много') : n < 100 ? T('орда') : n < 250 ? T('множество') : n < 500 ? T('легион') : T('безброй'));
  function stackInfo(n, disposition, exact) {
    const rng = D.countRange(n);
    if (!exact) return el('p', { class: 'sub' }, el('b', null, rng.word.charAt(0).toUpperCase() + rng.word.slice(1) + ' (' + rng.text + ')'), disposition === undefined ? '' : disposition <= 3 ? T(' · страхливи (може да избягат или да се присъединят)') : disposition <= 7 ? T(' · може да се присъединят срещу заплащане') : T(' · враждебни (никога не се присъединяват)'));
    const word = countWord(n);
    const mood = disposition === undefined ? '' : disposition <= 3 ? T(' · страхливи (може да избягат или да се присъединят)') : disposition <= 7 ? T(' · може да се присъединят срещу заплащане') : T(' · враждебни (никога не се присъединяват)');
    return el('p', { class: 'sub' }, el('b', null, n + T(' на брой')), ' (' + word + ')' + mood);
  }
  function guardInfo(game, o) {
    const g = o.guard, stacks = g.stacks || [{ creature: g.creature, count: g.count }];
    const content = el('div', null, el('p', { class: 'sub' }, T('Пазачи: победи ги, за да вземеш ') + game.objName(o).split(' — ')[0].toLowerCase() + '.'));
    stacks.forEach((s) => { const c = D.creatureOf(s.creature); content.appendChild(el('div', { class: 'row', style: 'cursor:pointer', onclick: () => creatureInfo(c, stackInfo(s.count)) }, spriteCanvas(G.creatureSprite(c, 128), 44, 52), el('div', { class: 'grow' }, el('div', { class: 'name' }, D.countRange(s.count).text + ' × ' + c.name), el('div', { class: 'tiny' }, T('ниво ') + c.tier + T(' · атака ') + c.att + T(' · защита ') + c.def + T(' · щети ') + c.dmin + '–' + c.dmax + T(' · живот ') + c.hp)))); });
    return dialog({ title: game.objName(o).split(' — ')[0], content });
  }
  function heroQuickInfo(game, h) {
    const w = game.world, mine = h.owner === game.human;
    const army = h.army.filter(Boolean);
    const content = el('div', null,
      el('div', { style: 'display:flex;gap:10px;align-items:center' }, spriteCanvas(G.portrait(h, 96, w.players[h.owner].color), 56, 56), el('div', null, el('div', { class: 'sub' }, D.CLASSES[h.cls].name + T(' · ниво ') + h.level + ' · ' + w.players[h.owner].colorName.toLowerCase() + T(' играч')), el('div', { class: 'tiny' }, T('Атака ') + h.att + T(' · Защита ') + h.def + T(' · Сила ') + h.pow + T(' · Знание ') + h.know))),
      el('p', { class: 'sub', style: 'margin-top:8px' }, T('Армия:')),
      ...(army.length ? army.map((s) => { const c = D.creatureOf(s.c); return el('div', { class: 'row' }, spriteCanvas(G.creatureSprite(c, 128), 36, 42), el('div', { class: 'grow' }, el('div', { class: 'name' }, (mine ? s.n : D.countRange(s.n).text) + ' × ' + c.name), el('div', { class: 'tiny' }, T('ниво ') + c.tier))); }) : [el('p', { class: 'tiny' }, T('няма'))])
    );
    return dialog({ title: h.name, content, buttons: mine ? [{ label: T('Отвори'), value: 'open', cls: 'primary' }, { label: T('Затвори'), value: false }] : undefined }).then((v) => { if (v === 'open') showHero(game, h); });
  }
  function townQuickInfo(game, t) {
    const w = game.world, mine = t.owner === game.human, gar = t.garrison.filter(Boolean);
    const content = el('div', null,
      el('div', { class: 'sub' }, D.factionById(t.faction).name + ' · ' + (t.owner >= 0 ? w.players[t.owner].colorName.toLowerCase() + T(' играч') : T('неутрален')) + ' · ' + [T('без укрепления'), T('форт'), T('цитадела'), T('замък')][w.fortLevel(t)]),
      t.visitor && w.heroes[t.visitor] ? el('div', { class: 'row', style: 'cursor:pointer', onclick: () => heroQuickInfo(game, w.heroes[t.visitor]) }, spriteCanvas(G.portrait(w.heroes[t.visitor], 96, w.players[w.heroes[t.visitor].owner].color), 36, 36), el('div', { class: 'grow' }, el('div', { class: 'name' }, T('Герой: ') + w.heroes[t.visitor].name), el('div', { class: 'tiny' }, T('ниво ') + w.heroes[t.visitor].level))) : null,
      el('p', { class: 'sub', style: 'margin-top:8px' }, T('Гарнизон:')),
      ...(gar.length ? gar.map((s) => { const c = D.creatureOf(s.c); return el('div', { class: 'row' }, spriteCanvas(G.creatureSprite(c, 128), 36, 42), el('div', { class: 'grow' }, el('div', { class: 'name' }, (mine ? s.n : D.countRange(s.n).text) + ' × ' + c.name), el('div', { class: 'tiny' }, T('ниво ') + c.tier))); }) : [el('p', { class: 'tiny' }, T('няма'))])
    );
    return dialog({ title: t.name, content, buttons: mine ? [{ label: T('Влез'), value: 'open', cls: 'primary' }, { label: T('Затвори'), value: false }] : undefined }).then((v) => { if (v === 'open') showTown(game, t); });
  }
  function creatureInfo(c, extra) {
    const f = D.factionById(c.faction);
    const content = el('div', null,
      el('div', { style: 'display:flex;gap:10px;align-items:center' }, spriteCanvas(G.creatureSprite(c, 128), 72, 84), el('div', null, el('div', { class: 'sub' }, (f ? f.name : T('Неутрални')) + T(' · ниво ') + c.tier + (c.upg ? T(' (подобрено)') : '')), el('div', { class: 'cost' }, costHtml(c.cost)))),
      el('div', { class: 'stats', style: 'margin:8px 0' }, el('div', null, el('b', null, c.att), el('small', null, T('Атака'))), el('div', null, el('b', null, c.def), el('small', null, T('Защита'))), el('div', null, el('b', null, c.dmin + '–' + c.dmax), el('small', null, T('Щети'))), el('div', null, el('b', null, c.hp), el('small', null, T('Живот'))), el('div', null, el('b', null, c.spd), el('small', null, T('Скорост'))), el('div', null, el('b', null, c.growth), el('small', null, T('Растеж')))),
      el('p', { class: 'tiny' }, T('Способности: ') + abilityText(c)),
      extra || null
    );
    return dialog({ title: c.name, content });
  }

  // ---------------------------------------------------------------- екран на герой
  function showHero(game, h, other) {
    const w = game.world;
    const s = screen('');
    const state = { sel: null };
    const render = () => {
      s.innerHTML = '';
      const p = w.players[h.owner];
      s.appendChild(el('header', null, spriteCanvas(G.portrait(h, 96, p.color), 44, 44), el('h1', null, h.name + ' — ' + D.CLASSES[h.cls].name + T(', ниво ') + h.level), el('button', { onclick: () => { closeScreens(); game.afterScreen(); } }, '✕')));
      const body = el('div', { class: 'body' });
      const cols = el('div', { class: 'cols' });
      // характеристики
      const left = el('div', { class: 'panel' });
      left.appendChild(el('div', { class: 'stats' }, ...D.PRIMARY.map((k) => el('div', { title: D.PRIMARY_NAME[k] }, el('b', null, w.stat(h, k)), el('small', null, D.PRIMARY_NAME[k])))));
      const nxt = D.LEVEL_XP[h.level + 1] || h.xp, cur = D.LEVEL_XP[h.level];
      left.appendChild(el('div', { class: 'tiny', style: 'margin:6px 0 2px' }, T('Опит ') + h.xp + ' / ' + nxt + T(' · Мана ') + h.mana + '/' + w.maxMana(h) + T(' · Движение ') + h.movement + '/' + h.maxMovement));
      left.appendChild(el('div', { class: 'xpbar' }, el('div', { style: 'width:' + Math.round(100 * (h.xp - cur) / Math.max(1, nxt - cur)) + '%' })));
      left.appendChild(el('div', { class: 'tiny', style: 'margin-top:6px' }, T('Морал ') + fmtSign(w.heroMorale(h)) + T(' · Късмет ') + fmtSign(w.heroLuck(h)) + (h.boat ? T(' · на кораб') : '') + (h.z ? T(' · в подземието') : '')));
      if (h.spec) left.appendChild(el('div', { class: 'row' }, el('div', { class: 'grow' }, el('div', { class: 'name' }, T('Специалност: ') + (h.spec.kind === 'creature' ? D.creatureOf(h.spec.id).name : h.spec.kind === 'skill' ? D.SKILLS[h.spec.id].name : h.spec.kind === 'spell' ? D.spellById[h.spec.id].name : D.RES_NAME[h.spec.id])), el('div', { class: 'sub' }, D.specialtyText(h.spec)))));
      w.heroSets(h).forEach((set) => left.appendChild(el('div', { class: 'row' }, el('div', { class: 'grow' }, el('div', { class: 'name', style: 'color:#ffd870' }, '✦ ' + set.name), el('div', { class: 'sub' }, set.desc)))));
      if (h.pendingLevels) left.appendChild(el('button', { class: 'primary', style: 'margin-top:8px;width:100%', onclick: () => game.processLevelUps(h).then(render) }, T('Ново ниво! Избери умение')));
      left.appendChild(el('h3', { style: 'margin-top:10px' }, T('Умения')));
      const sk = Object.keys(h.skills);
      if (!sk.length) left.appendChild(el('div', { class: 'tiny' }, T('Няма')));
      sk.forEach((k) => left.appendChild(el('div', { class: 'row' }, el('div', { class: 'grow' }, el('div', { class: 'name' }, D.SKILLS[k].name + ' — ' + D.SKILL_LEVEL_NAME[h.skills[k]]), el('div', { class: 'sub' }, D.SKILLS[k].desc(h.skills[k]))))));
      left.appendChild(el('h3', { style: 'margin-top:10px' }, T('Магии (') + h.spells.length + ')'));
      if (!h.spells.length) left.appendChild(el('div', { class: 'tiny' }, T('Героят не знае магии. Посети магьосническа гилдия или светилище.')));
      const sb = el('div', { class: 'spellbook' });
      h.spells.map((id) => D.spellById[id]).sort((a, b) => a.level - b.level).forEach((sp) => sb.appendChild(el('div', { class: 'spell school-' + sp.school, onclick: () => dialog({ title: sp.name, text: sp.desc + T(' Ниво ') + sp.level + ', ' + D.SCHOOL_NAME[sp.school] + T(', цена ') + sp.cost + T(' мана.') }) }, el('b', null, sp.name), el('small', null, T('ниво ') + sp.level + ' · ' + sp.cost + T(' мана')))));
      left.appendChild(sb);
      cols.appendChild(left);
      // армия и артефакти
      const right = el('div', { class: 'panel' });
      right.appendChild(el('h3', null, T('Армия')));
      right.appendChild(armyRow(game, h.army, state.sel, (a, i) => armyPick(state, a, i, render, game)));
      if (other) {
        right.appendChild(el('h3', { style: 'margin-top:8px' }, other.name + (other.garrison ? T(' — гарнизон') : '')));
        right.appendChild(armyRow(game, other.army, state.sel, (a, i) => armyPick(state, a, i, render, game)));
      }
      right.appendChild(el('div', { class: 'tiny', style: 'margin:4px 0' }, T('Докосни стек, после друг слот — размяна или сливане. Два пъти същия — разделяне и информация.')));
      right.appendChild(el('h3', { style: 'margin-top:8px' }, T('Артефакти')));
      // „Кукла“ като в класиките: гравиран рицар, слотовете са по местата на тялото
      const doll = el('div', { class: 'doll' });
      const dollImg = MK.Img.url('ui/doll_knight');
      if (dollImg) doll.appendChild(el('img', { src: dollImg, class: 'knight-img', alt: '' })); else doll.innerHTML = KNIGHT_SVG;
      // позиции (% от куклата) по рисувания рицар: шлем, шия, наметало на рамото, оръжие/щит в ръцете, нагръдник, пръстени на ръкавиците, ботуши, разни отдолу
      const POS = { head: [50, 5], neck: [50, 18], shoulders: [77, 17], weapon: [17, 38], shield: [83, 38], torso: [50, 33], ring0: [19, 52], ring1: [81, 52], feet: [50, 86], misc0: [9, 90], misc1: [27, 90], misc2: [73, 90], misc3: [91, 90] };
      let ringN = 0, miscN = 0;
      D.SLOTS.forEach((slot, i) => {
        const aid = h.arts[i];
        const key = slot === 'ring' ? 'ring' + (ringN++) : slot === 'misc' ? 'misc' + (miscN++) : slot;
        const [px, py] = POS[key];
        const a = el('div', { class: 'art slot-' + slot + (aid ? ' filled' : ''), style: 'left:' + px + '%;top:' + py + '%', title: aid ? D.artById[aid].name : D.SLOT_NAME[slot], onclick: () => { if (!aid) return; const art = D.artById[aid]; dialog({ title: art.name, text: art.desc + ' (' + D.SLOT_NAME[art.slot] + ', ' + D.ART_CLASS_NAME[art.cls] + (art.set ? T(', част от „') + D.ART_SETS[art.set].name + '“' : '') + ')', buttons: [{ label: T('В раницата'), value: 'bp' }, { label: T('Добре'), value: true }] }).then((v) => { if (v === 'bp') { w.unequip(h, i); render(); } }); } });
        if (aid) a.appendChild(artIcon(D.artById[aid])); else a.appendChild(el('span', { class: 'slot-glyph' }, artGlyph({ slot })));
        doll.appendChild(a);
      });
      right.appendChild(doll);
      if (h.backpack.length) {
        right.appendChild(el('h3', { style: 'margin-top:8px' }, T('Раница')));
        const bp = el('div', { class: 'arts' });
        h.backpack.forEach((aid, bi) => bp.appendChild(el('div', { class: 'art filled', title: D.artById[aid].name, onclick: () => { const art = D.artById[aid]; dialog({ title: art.name, text: art.desc, buttons: [{ label: T('Сложи'), value: 'eq', cls: 'primary' }, { label: T('Добре'), value: true }] }).then((v) => { if (v === 'eq') { w.equipFromBackpack(h, bi); render(); } }); } }, artIcon(D.artById[aid]))));
        right.appendChild(bp);
      }
      cols.appendChild(right);
      body.appendChild(cols);
      s.appendChild(body);
    };
    render();
  }
  const fmtSign = (n) => (n > 0 ? '+' + n : String(n));
  /* Икона на артефакт: рисуваната картинка (artifacts/<id>) или емотикон по слота */
  function artIcon(a) { const u = MK.Img.url('artifacts/' + a.id); return u ? el('img', { src: u, alt: '', class: 'art-img' }) : el('span', null, artGlyph(a)); }
  /* Гравиран рицар за куклата с артефактите */
  const KNIGHT_SVG = '<svg class="knight" viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
    + '<defs><linearGradient id="kg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a4a2e"/><stop offset="1" stop-color="#2a2114"/></linearGradient></defs>'
    + '<g fill="url(#kg)" stroke="#8a6e3a" stroke-width="0.8" stroke-linejoin="round" opacity="0.9">'
    + '<path d="M50 6 c-7 0 -11 5 -11 12 v6 c0 6 5 10 11 10 s11 -4 11 -10 v-6 c0 -7 -4 -12 -11 -12z"/>' // шлем
    + '<path d="M42 20 h16 v3 h-16z" fill="#1a1408"/>' // визьор
    + '<path d="M36 36 c-8 2 -14 6 -16 12 l-6 24 h10 l4 -16 l2 30 h40 l2 -30 l4 16 h10 l-6 -24 c-2 -6 -8 -10 -16 -12 c-5 3 -9 4 -14 4 s-9 -1 -14 -4z"/>' // торс и ръце
    + '<path d="M50 50 l-8 6 v12 l8 6 l8 -6 v-12z" fill="#3a2e18"/>' // нагръдник
    + '<path d="M34 86 l2 34 h10 l3 -30 h2 l3 30 h10 l2 -34z"/>' // крака
    + '<path d="M36 120 h10 v5 h-12z M54 120 h10 v5 h-12z" fill="#1a1408"/>' // ботуши
    + '</g></svg>';
  function artGlyph(a) { return { head: '⛑', neck: '📿', shoulders: '🧥', weapon: '🗡', shield: '🛡', torso: '🥋', ring: '💍', feet: '👢', misc: '🔮' }[a.slot] || '✦'; }

  // ---------------------------------------------------------------- ниво нагоре
  function levelUpDialog(game, h, roll) {
    const content = el('div', null);
    content.appendChild(el('p', null, h.name + T(' достига ниво ') + (h.level - h.pendingLevels + 1) + '. ' + D.PRIMARY_NAME[roll.stat] + ' +1.'));
    return new Promise((resolve) => {
      if (!roll.offers.length) { dialog({ title: T('Ново ниво'), content }).then(() => resolve(null)); return; }
      content.appendChild(el('p', null, T('Избери умение:')));
      const wrap = el('div', { class: 'modal-wrap' });
      const m = el('div', { class: 'modal' }, el('h2', null, T('Ново ниво')), content);
      roll.offers.forEach((sk) => {
        const lvl = (h.skills[sk] || 0) + 1;
        m.appendChild(el('div', { class: 'row', style: 'cursor:pointer', onclick: () => { wrap.remove(); resolve(sk); } }, el('div', { class: 'grow' }, el('div', { class: 'name' }, D.SKILLS[sk].name + ' — ' + D.SKILL_LEVEL_NAME[lvl]), el('div', { class: 'sub' }, D.SKILLS[sk].desc(lvl))), el('button', { class: 'small primary' }, T('Избери'))));
      });
      wrap.appendChild(m); overlay().appendChild(wrap);
    });
  }

  // ---------------------------------------------------------------- град
  function showTown(game, t) {
    MK.Audio.town(t.faction);
    const w = game.world;
    const p = w.players[t.owner];
    const s = screen('town');
    const bgUrl = MK.Img.url('towns/' + t.faction + '_screen');
    const state = { tab: 'build', sel: null, open: null };
    const visitor = () => (t.visitor ? w.heroes[t.visitor] : null);
    // Разположение на сградите върху панорамата: [x%, y% на основата, ширина%], ред на рисуване по y
    const LAYOUT = {
      fort: [50, 44, 40], hall: [50, 66, 24], mage: [82, 50, 20], tavern: [17, 84, 18], market: [80, 88, 20], silo: [93, 70, 13], well: [38, 92, 9], shipyard: [7, 62, 16],
      dw1: [12, 46, 14], dw2: [30, 56, 15], dw3: [70, 64, 15], dw4: [90, 30, 14], dw5: [30, 76, 17], dw6: [62, 82, 17], dw7: [50, 100, 24]
    };
    const PANES = { build: T('Строеж'), recruit: T('Набор'), mage: T('Гилдия'), tavern: T('Таверна'), market: T('Пазар') };
    const paneAvailable = (id) => !((id === 'mage' && !w.mageLevel(t)) || (id === 'tavern' && !t.buildings.tavern) || (id === 'market' && !t.buildings.market));
    /* Списък на видимите сгради: {slot, id, name, img, pane} */
    const builtList = () => {
      const list = [];
      // Картинка на сградата в стила на фракцията; общите (common_*) са в стил Кралство и важат само за него
      const imgFor = (id) => MK.Img.has('buildings/' + t.faction + '_' + id) ? 'buildings/' + t.faction + '_' + id : t.faction === 'kingdom' ? 'buildings/common_' + id : null;
      const push = (slot, id, pane, extra) => { const bf = D.buildingFor(t.faction, id); list.push(Object.assign({ slot, id, name: bf ? bf.name : id, pane, img: imgFor(id) }, extra)); };
      const top = (ids) => ids.filter((x) => t.buildings[x]).pop();
      const hall = top(['hall1', 'hall2', 'hall3', 'hall4']); if (hall) push('hall', hall, 'build');
      const fort = top(['fort1', 'fort2', 'fort3']); if (fort) push('fort', fort, 'build');
      const mage = top(['mage1', 'mage2', 'mage3', 'mage4']); if (mage) push('mage', mage, 'mage', { img: imgFor('mage1') });
      ['tavern', 'market', 'silo', 'well', 'shipyard'].forEach((id) => { if (t.buildings[id]) push(id, id, id === 'tavern' ? 'tavern' : id === 'market' ? 'market' : 'build'); });
      for (let i = 1; i <= 7; i++) if (t.buildings['dw' + i]) { const c = D.creatureOf(t.faction + i + (t.buildings['dw' + i + 'u'] ? 'u' : '')); push('dw' + i, 'dw' + i + (t.buildings['dw' + i + 'u'] ? 'u' : ''), 'recruit', { img: 'buildings/' + t.faction + '_dwelling' + i, name: (D.buildingFor(t.faction, 'dw' + i) || {}).name || c.name, tier: i }); }
      return list;
    };
    const render = () => {
      s.innerHTML = '';
      const f = D.factionById(t.faction);
      s.appendChild(el('header', null, spriteCanvas(G.objectSprite({ type: 'town', faction: t.faction, owner: t.owner }, 96, w), 44, 44), el('h1', null, t.name + ' — ' + f.name + (t.builtToday ? T(' · строено днес') : '')), el('div', { class: 'tiny', style: 'margin-left:auto' }, T('Доход ') + w.townIncome(t) + T('/ден')), el('button', { onclick: () => { closeScreens(); game.afterScreen(); } }, '✕')));
      // Панорама с кликаеми сгради
      const view = el('div', { class: 'town-view' });
      if (bgUrl) view.style.backgroundImage = 'url(' + bgUrl + ')';
      const items = builtList().sort((a, b) => (LAYOUT[a.slot] || [0, 0])[1] - (LAYOUT[b.slot] || [0, 0])[1]);
      items.forEach((it) => {
        const L = LAYOUT[it.slot]; if (!L) return;
        const url = it.img ? MK.Img.url(it.img) : null;
        const b = el('div', { class: 'town-b', style: 'left:' + L[0] + '%;bottom:' + (100 - L[1]) + '%;width:' + L[2] + '%', title: it.name, onclick: () => openPane(it.pane, it) });
        if (url) b.appendChild(el('img', { src: url, alt: it.name, draggable: 'false' }));
        else b.appendChild(el('div', { class: 'town-b-box' }, it.name));
        b.appendChild(el('span', { class: 'town-b-label' }, it.name));
        view.appendChild(b);
      });
      s.appendChild(view);
      // Долен панел: армии и бързи бутони
      const bottom = el('div', { class: 'town-bottom' + (state.drawer ? ' open' : '') });
      const handle = el('button', { class: 'drawer-handle', onclick: () => { state.drawer = !state.drawer; bottom.classList.toggle('open', state.drawer); handle.textContent = state.drawer ? T('▼ Скрий армиите') : T('▲ Армии') + (visitor() ? T(' и герой') : ''); } }, state.drawer ? T('▼ Скрий армиите') : T('▲ Армии') + (visitor() ? T(' и герой') : ''));
      let ty0 = null; bottom.addEventListener('touchstart', (e) => { ty0 = e.touches[0].clientY; }, { passive: true }); bottom.addEventListener('touchend', (e) => { if (ty0 === null) return; const dy = e.changedTouches[0].clientY - ty0; ty0 = null; if (dy < -30 && !state.drawer) handle.click(); else if (dy > 30 && state.drawer) handle.click(); }, { passive: true });
      bottom.appendChild(handle);
      const ap = el('div', { class: 'panel town-armies' });
      ap.appendChild(el('div', { class: 'row' }, el('div', { class: 'tiny', style: 'min-width:64px' }, T('Гарнизон')), armyRow(game, t.garrison, state.sel, (a, i) => armyPick(state, a, i, render, game))));
      const v = visitor();
      if (v) ap.appendChild(el('div', { class: 'row' }, el('div', { style: 'cursor:pointer', title: v.name + T(', ниво ') + v.level, onclick: () => showHero(game, v, { name: t.name, army: t.garrison, garrison: true }) }, spriteCanvas(G.portrait(v, 96, p.color), 40, 40)), armyRow(game, v.army, state.sel, (a, i) => armyPick(state, a, i, render, game))));
      bottom.appendChild(ap);
      const tabs = el('div', { class: 'tabs town-tabs' });
      Object.keys(PANES).forEach((id) => tabs.appendChild(el('button', { class: 'small', disabled: paneAvailable(id) ? null : 'disabled', onclick: () => openPane(id) }, PANES[id])));
      bottom.appendChild(tabs);
      s.appendChild(bottom);
      if (state.open) state.open.refresh();
      updateHUD(game);
    };
    /* Отваря меню на сграда като прозорец върху панорамата; при промяна се опреснява */
    const openPane = (id, it) => {
      if (!paneAvailable(id)) { toast(id === 'mage' ? T('Няма магьосническа гилдия.') : id === 'tavern' ? T('Няма таверна.') : T('Няма пазар.')); return; }
      if (state.open) { state.open.close(); }
      const pane = el('div', { class: 'panel', style: 'max-height:60vh;overflow-y:auto' });
      const wrap = el('div', { class: 'modal-wrap' });
      const m = el('div', { class: 'modal town-modal' });
      const close = () => { wrap.remove(); if (state.open && state.open.wrap === wrap) state.open = null; };
      m.appendChild(el('div', { class: 'row' }, el('h2', { style: 'flex:1;margin:0' }, it ? it.name : PANES[id]), el('button', { class: 'small', onclick: close }, '✕')));
      m.appendChild(pane);
      const refresh = () => {
        pane.innerHTML = '';
        if (id === 'build') renderBuild(pane);
        if (id === 'recruit') renderRecruit(pane, it && it.tier);
        if (id === 'mage') renderMage(pane);
        if (id === 'tavern') renderTavern(pane);
        if (id === 'market') renderMarket(pane);
      };
      state.open = { wrap, refresh, close };
      refresh();
      wrap.appendChild(m); overlay().appendChild(wrap);
    };
    const renderBuild = (pane) => {
      pane.appendChild(el('h3', null, T('Построено: ') + Object.keys(t.buildings).map((id) => D.buildingFor(t.faction, id).name).join(', ')));
      pane.appendChild(el('div', { class: 'tiny', style: 'margin-bottom:6px' }, T('Доход на града: ') + w.townIncome(t) + T(' злато на ден. Растеж: форт ') + [T('няма'), T('Форт'), T('Цитадела (+50%)'), T('Замък (+100%)')][w.fortLevel(t)] + '.'));
      if (t.buildings.shipyard) pane.appendChild(el('div', { class: 'row' }, el('div', { class: 'grow' }, el('div', { class: 'name' }, T('Кораб')), el('div', { class: 'sub' }, T('Корабостроителницата спуска кораб на най-близката вода.')), costHtml({ gold: 1000, wood: 10 }, p.res)), el('button', { class: 'small primary', disabled: p.res.gold >= 1000 && p.res.wood >= 10 ? null : 'disabled', onclick: () => { const r = w.buildBoat(t); toast(r.ok ? T('Корабът е готов.') : r.why); render(); } }, T('Построй кораб'))));
      D.BUILDINGS.forEach((b) => {
        if (t.buildings[b.id]) return;
        const bf = D.buildingFor(t.faction, b.id);
        // показваме само тези, чиито изисквания са налични или на една стъпка
        const missing = bf.req.filter((r) => !t.buildings[r]);
        if (missing.length > 1) return;
        const chk = w.canBuild(t, b.id);
        pane.appendChild(el('div', { class: 'row' }, el('div', { class: 'grow' }, el('div', { class: 'name' }, bf.name), el('div', { class: 'sub' }, bf.desc || ''), costHtml(bf.cost, p.res), !chk.ok ? el('div', { class: 'sub', style: 'color:#f0a080' }, chk.why) : null), el('button', { class: 'small' + (chk.ok ? ' primary' : ''), disabled: chk.ok ? null : 'disabled', onclick: () => { const r = w.build(t, b.id); if (r.ok) toast(bf.name + T(' е построено.')); else toast(r.why); render(); } }, T('Строй'))));
      });
    };
    const renderRecruit = (pane, onlyTier) => {
      let any = false;
      for (let tier = 1; tier <= 7; tier++) {
        if (!t.buildings['dw' + tier] || (onlyTier && tier !== onlyTier)) continue;
        any = true;
        const upg = !!t.buildings['dw' + tier + 'u'];
        [false, true].forEach((u) => {
          if (u && !upg) return;
          const cid = t.faction + tier + (u ? 'u' : ''); const c = D.creatureOf(cid);
          const target = visitor() ? visitor().army : t.garrison;
          const max = Math.min(t.avail[tier], w.maxAffordable(p, cid));
          const row = el('div', { class: 'row' });
          const cv = spriteCanvas(G.creatureSprite(c, 96), 48, 56); cv.style.cursor = 'pointer'; cv.addEventListener('click', () => creatureInfo(c));
          row.appendChild(cv);
          row.appendChild(el('div', { class: 'grow' }, el('div', { class: 'name' }, c.name), el('div', { class: 'sub' }, T('Налични: ') + t.avail[tier] + T(' · растеж ') + w.growthOf(t, tier) + T('/седм. · А') + c.att + T(' З') + c.def + T(' Щ') + c.dmin + '–' + c.dmax + T(' Ж') + c.hp + T(' С') + c.spd), costHtml(c.cost, p.res)));
          row.appendChild(el('button', { class: 'small', disabled: max > 0 ? null : 'disabled', onclick: () => recruitDialog(cid, tier, u, max, target) }, T('Набор')));
          row.appendChild(el('button', { class: 'small primary', disabled: max > 0 ? null : 'disabled', onclick: () => { const r = w.recruit(t, tier, u, max, target); if (r.ok) toast(r.n + ' × ' + c.name + T(' се присъединяват.')); else toast(r.why); render(); } }, T('Всички (') + max + ')'));
          pane.appendChild(row);
        });
      }
      if (!any) pane.appendChild(el('div', { class: 'tiny' }, T('Няма жилища. Построй Форт и първото жилище.')));
      // подобрения на стекове
      const v = visitor();
      [t.garrison, v ? v.army : null].forEach((army, k) => {
        if (!army) return;
        army.forEach((sl, i) => {
          const cost = w.upgradeCost(t, army, i); if (!cost) return;
          const c = D.creatureOf(sl.c), u = D.upgradeOf(c);
          pane.appendChild(el('div', { class: 'row' }, spriteCanvas(G.creatureSprite(u, 96), 40, 48), el('div', { class: 'grow' }, el('div', { class: 'name' }, T('Подобри ') + sl.n + ' × ' + c.name + ' → ' + u.name), costHtml(cost, p.res)), el('button', { class: 'small', disabled: w.canAfford(p, cost) ? null : 'disabled', onclick: () => { const r = w.upgradeStack(t, army, i); if (!r.ok) toast(r.why); render(); } }, T('Подобри'))));
        });
      });
    };
    const recruitDialog = (cid, tier, u, max, target) => {
      const c = D.creatureOf(cid);
      let n = max;
      const lbl = el('b', { style: 'font-size:22px;color:#ffd870;min-width:60px;text-align:center' }, String(n));
      const cost = el('div', null); const upd = () => { cost.innerHTML = ''; cost.appendChild(costHtml(w.recruitCost(cid, n), p.res)); };
      const range = el('input', { type: 'range', min: 1, max, value: n, style: 'flex:1' }); range.addEventListener('input', () => { n = +range.value; lbl.textContent = String(n); upd(); }); upd();
      dialog({ title: T('Набор: ') + c.name, content: el('div', null, el('div', { style: 'display:flex;gap:8px;align-items:center' }, range, lbl), cost), buttons: [{ label: T('Отказ'), value: false }, { label: T('Наеми'), value: true, cls: 'primary' }] }).then((v) => { if (v) { const r = w.recruit(t, tier, u, n, target); if (!r.ok) toast(r.why); } render(); });
    };
    const renderMage = (pane) => {
      const ml = w.mageLevel(t);
      for (let l = 1; l <= ml; l++) {
        pane.appendChild(el('h3', { style: 'margin-top:6px' }, T('Ниво ') + l));
        const sb = el('div', { class: 'spellbook' });
        t.spells[l].forEach((id) => { const sp = D.spellById[id]; sb.appendChild(el('div', { class: 'spell school-' + sp.school, onclick: () => dialog({ title: sp.name, text: sp.desc + ' ' + D.SCHOOL_NAME[sp.school] + T(', цена ') + sp.cost + T(' мана.') }) }, el('b', null, sp.name), el('small', null, D.SCHOOL_NAME[sp.school] + ' · ' + sp.cost + T(' мана')))); });
        pane.appendChild(sb);
      }
      pane.appendChild(el('div', { class: 'tiny', style: 'margin-top:8px' }, T('Героят в града научава магиите автоматично. За 3-о ниво и нагоре е нужна Мъдрост.')));
    };
    const renderTavern = (pane) => {
      const list = w.tavernHeroes(t);
      if (!list.length) pane.appendChild(el('div', { class: 'tiny' }, T('Днес в таверната няма герои.')));
      list.forEach((proto, i) => {
        const cls = D.CLASSES[proto.cls];
        const fake = { cls: proto.cls, portrait: proto.portrait };
        pane.appendChild(el('div', { class: 'row' }, spriteCanvas(G.portrait(fake, 96, p.color), 44, 44), el('div', { class: 'grow' }, el('div', { class: 'name' }, proto.name + (proto.keep ? T(', ниво ') + proto.keep.level : '')), el('div', { class: 'sub' }, cls.name + ' · ' + D.factionById(proto.faction).name + T(' · армия: ') + proto.army.filter(Boolean).map((s) => s.n + ' ' + D.creatureOf(s.c).name).join(', ')), el('div', { class: 'sub' }, T('Цена: 2500 злато'))), el('button', { class: 'small primary', disabled: p.res.gold >= 2500 && !t.visitor && p.heroes.length < 8 ? null : 'disabled', onclick: () => { const r = w.hireHero(t, i); if (r.ok) { if (proto.keep) Object.assign(r.hero, proto.keep); toast(r.hero.name + T(' се присъединява.')); } else toast(r.why); render(); } }, T('Наеми'))));
      });
      if (t.visitor) pane.appendChild(el('div', { class: 'tiny' }, T('В града вече има герой — изведи го, за да наемеш друг.')));
    };
    const renderMarket = (pane) => {
      // Пазар като в класиките: „Ресурси на кралството“ / „Налични за търговия“ с курсове, оферта, плъзгач за количество
      const st = state.market || (state.market = { from: 'wood', to: 'gold', amount: 0 });
      const icon = (r, size) => { const u = MK.Img.url('ui/icon_' + r); return u ? el('img', { src: u, alt: '', style: 'width:' + size + 'px;height:' + size + 'px;object-fit:contain' }) : el('i', { style: 'display:inline-block;width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + D.RES_COLOR[r] }); };
      const name = (r) => D.RES_NAME[r].toLowerCase();
      const rateText = (to) => { if (to === st.from) return T('н/д'); const r = w.tradeRate(p, st.from, to); return to === 'gold' ? String(r) : '1/' + r; };
      const cell = (r, sub, sel, onclick) => el('button', { class: 'market-cell' + (sel ? ' sel' : ''), title: D.RES_NAME[r], onclick }, icon(r, 30), el('span', null, sub));
      const grid = (key, showOwn) => {
        const g = el('div', { class: 'market-grid' });
        ['wood', 'mercury', 'ore', 'sulfur', 'crystal', 'gems'].forEach((r) => g.appendChild(cell(r, showOwn ? String(p.res[r]) : rateText(r), st[key] === r, () => { st[key] = r; st.amount = 0; render(); })));
        const gold = cell('gold', showOwn ? String(p.res.gold) : rateText('gold'), st[key] === 'gold', () => { st[key] = 'gold'; st.amount = 0; render(); });
        gold.classList.add('gold'); g.appendChild(gold);
        return g;
      };
      const same = st.from === st.to;
      const rate = same ? 0 : w.tradeRate(p, st.from, st.to);
      const toGold = st.to === 'gold';
      const unitGive = toGold ? 1 : rate, unitGet = toGold ? rate : 1;
      const maxUnits = same ? 0 : Math.floor(p.res[st.from] / unitGive);
      if (st.amount > maxUnits) st.amount = maxUnits;
      const offer = same ? T('Избери два различни ресурса.') : T('Мога да ти предложа ') + unitGet + ' ' + name(st.to) + T(' за ') + unitGive + ' ' + name(st.from) + '.';
      pane.appendChild(el('div', { class: 'market-top' },
        el('div', { class: 'market-col' }, el('div', { class: 'market-title' }, T('Ресурси на кралството')), grid('from', true)),
        el('div', { class: 'market-col' }, el('div', { class: 'market-offer' }, offer), el('div', { class: 'market-title' }, T('Налични за търговия')), grid('to', false))
      ));
      // долна лента: даваш — количество — получаваш
      const giveBox = el('div', { class: 'market-box' }, icon(st.from, 30), el('span', null, '0'));
      const getBox = el('div', { class: 'market-box' }, icon(st.to, 30), el('span', null, '0'));
      const range = el('input', { type: 'range', min: 0, max: Math.max(0, maxUnits), value: st.amount, class: 'market-slider' });
      const upd = () => { giveBox.lastChild.textContent = String(st.amount * unitGive); getBox.lastChild.textContent = String(st.amount * unitGet); range.value = st.amount; };
      range.addEventListener('input', () => { st.amount = +range.value; upd(); });
      const step = (d) => { st.amount = Math.max(0, Math.min(maxUnits, st.amount + d)); upd(); };
      const bottom = el('div', { class: 'market-bottom' },
        giveBox,
        el('div', { class: 'market-mid' }, el('div', { class: 'market-qty' }, T('Количество за размяна ▶')), el('div', { class: 'market-pot' }, el('button', { class: 'small', onclick: () => step(-1) }, '◀'), range, el('button', { class: 'small', onclick: () => step(1) }, '▶'))),
        getBox
      );
      pane.appendChild(bottom);
      upd();
      pane.appendChild(el('div', { class: 'market-actions' },
        el('div', { class: 'tiny' }, T('Пазари: ') + w.marketRate(p)),
        el('button', { class: 'small', disabled: maxUnits ? null : 'disabled', title: T('Максимум'), onclick: () => { st.amount = maxUnits; upd(); } }, T('⬆ Макс')),
        el('button', { class: 'primary', disabled: maxUnits ? null : 'disabled', title: T('Търгувай'), onclick: () => { if (!st.amount) return toast(T('Избери количество.')); if (!w.trade(p, st.from, st.to, st.amount)) return toast(T('Недостатъчно ресурси.')); toast(T('Сделката е сключена.')); st.amount = 0; render(); } }, T('🤝 Търгувай'))
      ));
    };
    render();
  }

  // ---------------------------------------------------------------- външно жилище
  function dwellingDialog(game, h, o) {
    const w = game.world, p = w.players[h.owner];
    const c = D.creatureOf(o.creature);
    const max = Math.min(o.available, w.maxAffordable(p, o.creature));
    let n = max;
    const lbl = el('b', { style: 'font-size:22px;color:#ffd870;min-width:60px;text-align:center' }, String(n));
    const range = el('input', { type: 'range', min: 0, max: Math.max(0, max), value: n, style: 'flex:1' });
    const cost = el('div', null); const upd = () => { cost.innerHTML = ''; cost.appendChild(costHtml(w.recruitCost(o.creature, n), p.res)); };
    range.addEventListener('input', () => { n = +range.value; lbl.textContent = String(n); upd(); }); upd();
    return dialog({ title: T('Жилище: ') + c.name, content: el('div', null, el('p', null, T('Налични: ') + o.available + T('. Цена за едно: ') + Object.entries(c.cost).map(([k, v]) => v + ' ' + D.RES_NAME[k].toLowerCase()).join(', ') + '.'), el('div', { style: 'display:flex;gap:8px;align-items:center' }, range, lbl), cost), buttons: [{ label: T('Затвори'), value: false }, { label: T('Инфо'), value: 'info' }, { label: T('Наеми'), value: true, cls: 'primary' }] }).then((v) => {
      if (v === 'info') return creatureInfo(c).then(() => dwellingDialog(game, h, o));
      if (v && n > 0) { if (!MK.Army.canAdd(h.army, o.creature)) return toast(T('Няма свободен слот в армията.')); w.pay(p, w.recruitCost(o.creature, n)); o.available -= n; MK.Army.add(h.army, o.creature, n); toast(n + ' × ' + c.name + T(' се присъединяват.')); }
    });
  }

  MK.UI = { el, dialog, toast, loading, reward, dayBanner, showMenu, showHelp, showCampaign, showCampaignScenarios, passDevice, showSetup, updateHUD, showHero, showTown, levelUpDialog, dwellingDialog, creatureInfo, stackInfo, guardInfo, heroQuickInfo, townQuickInfo, closeScreens, screen, spriteCanvas, costHtml, armyRow, armyPick, abilityText };
})();
