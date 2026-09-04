/* DOM интерфейс: меню, настройка на игра, HUD, град, герой, диалози */
(function () {
  'use strict';
  const MK = (window.MK = window.MK || {});
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
    for (const k in cost) { if (!cost[k]) continue; const lack = res && (res[k] || 0) < cost[k]; c.appendChild(el('span', { class: lack ? 'lack' : '' }, el('i', { style: 'background:' + D.RES_COLOR[k] }), String(cost[k]))); }
    return c;
  }
  function spriteCanvas(src, w, h) { const c = el('canvas', { width: w, height: h }); c.getContext('2d').drawImage(src, 0, 0, w, h); return c; }
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
      (opts.buttons || [{ label: 'Добре', value: true }]).forEach((b) => bs.appendChild(el('button', { class: b.cls || '', onclick: () => { wrap.remove(); resolve(b.value); } }, b.label)));
      m.appendChild(bs);
      wrap.appendChild(m); overlay().appendChild(wrap);
    });
  }
  function closeScreens() { overlay().querySelectorAll('.screen').forEach((s) => s.remove()); }
  function screen(cls) { closeScreens(); const s = el('div', { class: 'screen ' + (cls || '') }); overlay().appendChild(s); return s; }

  // ---------------------------------------------------------------- главно меню
  function showMenu(game) {
    const s = screen('menu');
    const hasSave = !!localStorage.getItem('mk_save');
    s.appendChild(el('div', { class: 'title' }, 'MagicKnights'));
    s.appendChild(el('div', { class: 'subtitle' }, 'Герои, замъци и битки на хексове — класическата стратегия наново, за телефона ти.'));
    s.appendChild(el('div', { class: 'stack' },
      el('button', { class: 'primary', onclick: () => showSetup(game) }, 'Нова игра'),
      el('button', { onclick: () => game.load(), disabled: hasSave ? null : 'disabled' }, 'Продължи'),
      el('button', { onclick: () => showHelp() }, 'Как се играе'),
      game.world ? el('button', { onclick: () => closeScreens() }, 'Назад към играта') : null
    ));
    s.appendChild(el('div', { class: 'tiny', style: 'margin-top:20px' }, 'Версия 0.1 · Фаза 1 · Цялата графика е процедурна и оригинална'));
  }
  function showHelp() {
    dialog({ title: 'Как се играе', content: el('div', null,
      el('p', null, 'Всеки ход местиш героите си по картата, събираш ресурси, превземаш мини и градове и се биеш с пазачите. Докосни плочка, за да видиш пътя, докосни я пак, за да тръгнеш. Плъзгане мести картата, щипка — мащабира.'),
      el('p', null, 'В града строиш по една сграда на ден и набираш същества всяка седмица. Героят вдига ниво от опит и избира умения.'),
      el('p', null, 'Битката е на хексове: ходът е по скорост. Докосни хекс — местиш се; докосни враг в обхват — нападаш. Стрелците стрелят от разстояние (наполовина щети над 10 хекса и в близък бой). Веднъж на рунд героят може да направи магия.'),
      el('p', null, 'Щетите: всяка точка атака над защитата на врага дава +5%, всяка точка защита над атаката — −2.5%. Морал може да даде втори ход, късмет — двойни щети.'),
      el('p', null, 'Победа: превземи всички вражески градове и разбий героите им. Седем дни без град — загуба.')
    ) });
  }

  // ---------------------------------------------------------------- нова игра
  function showSetup(game) {
    const s = screen('menu');
    const st = { size: 's', difficulty: 1, faction: 'kingdom', opponents: 1, oppFactions: ['necropolis', 'grove', 'kingdom'] };
    s.appendChild(el('div', { class: 'title', style: 'font-size:30px' }, 'Нова игра'));
    const body = el('div', { class: 'modal', style: 'max-width:560px' });
    const optRow = (label, options, get, set) => {
      const row = el('div', { class: 'opt-row' }, el('label', null, label));
      const bs = options.map((o) => el('button', { class: 'small' + (get() === o.v ? ' sel' : ''), onclick: () => { set(o.v); render(); } }, o.l));
      bs.forEach((b) => row.appendChild(b));
      return row;
    };
    const render = () => {
      body.innerHTML = '';
      body.appendChild(optRow('Карта', D.MAP_SIZES.map((m) => ({ v: m.id, l: m.name + ' (' + m.size + '×' + m.size + ')' })), () => st.size, (v) => { st.size = v; }));
      body.appendChild(optRow('Трудност', D.DIFFICULTY.map((d) => ({ v: d.id, l: d.name })), () => st.difficulty, (v) => { st.difficulty = v; }));
      body.appendChild(optRow('Противници', [1, 2, 3].map((n) => ({ v: n, l: String(n) })), () => st.opponents, (v) => { st.opponents = v; }));
      body.appendChild(el('h3', { style: 'margin:10px 0 6px;color:#ffd870' }, 'Твоята фракция'));
      D.FACTIONS.forEach((f) => {
        const card = el('div', { class: 'faction-card' + (st.faction === f.id ? ' sel' : ''), onclick: () => { st.faction = f.id; render(); } });
        card.appendChild(spriteCanvas(G.objectSprite({ type: 'town', faction: f.id, owner: -2 }, 64, { players: [] }), 56, 56));
        const army = el('div', { class: 'army' });
        for (let t = 1; t <= 7; t++) { const c = D.creatureOf(f.id + t); const sl = el('div', { class: 'slot', style: 'width:34px;height:34px', title: c.name }); sl.appendChild(spriteCanvas(G.creatureSprite(c, 64), 30, 30)); sl.querySelector('canvas').style.height = '30px'; army.appendChild(sl); }
        card.appendChild(el('div', { class: 'grow' }, el('div', { class: 'name' }, f.name), el('div', { class: 'sub' }, f.desc), army));
        body.appendChild(card);
      });
      body.appendChild(el('div', { class: 'buttons', style: 'display:flex;gap:8px;margin-top:10px' },
        el('button', { onclick: () => showMenu(game) }, 'Назад'),
        el('button', { class: 'primary', onclick: () => {
          const players = [{ faction: st.faction, human: true }];
          const pool = D.FACTIONS.map((f) => f.id).filter((f) => f !== st.faction).concat(D.FACTIONS.map((f) => f.id));
          for (let i = 0; i < st.opponents; i++) players.push({ faction: pool[i % pool.length], human: false });
          game.newGame({ size: D.MAP_SIZES.find((m) => m.id === st.size).size, difficulty: st.difficulty, players, seed: (Math.random() * 4294967295) >>> 0 });
        } }, 'Започни')
      ));
    };
    render();
    s.appendChild(body);
  }

  // ---------------------------------------------------------------- HUD
  function updateHUD(game) {
    const w = game.world, p = w.players[game.human];
    const rb = document.getElementById('resbar');
    rb.innerHTML = '';
    D.RES.forEach((r) => rb.appendChild(el('span', { class: 'res', title: D.RES_NAME[r] }, el('i', { style: 'background:' + D.RES_COLOR[r] }), String(p.res[r]))));
    rb.appendChild(el('span', { class: 'date' }, w.dateText()));
    const hl = document.getElementById('hero-list'); hl.innerHTML = '';
    p.heroes.forEach((id) => {
      const h = w.heroes[id];
      const it = el('div', { class: 'item' + (game.selected === h ? ' sel' : ''), title: h.name, onclick: () => game.selectHero(h, true) });
      it.appendChild(spriteCanvas(G.portrait(h, 64, p.color), 44, 44));
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
      it.appendChild(spriteCanvas(G.objectSprite({ type: 'town', faction: t.faction, owner: t.owner }, 64, w), 44, 44));
      if (!t.builtToday) it.appendChild(el('div', { class: 'dot', style: 'background:#8f8' }));
      tl.appendChild(it);
    });
    document.getElementById('hint').textContent = game.hint || '';
    game.renderer.drawMinimap(document.getElementById('minimap'), w, p);
  }

  // ---------------------------------------------------------------- армия (общ компонент)
  /* Рисува 7 слота; sel={army,i}. onPick(army,i) */
  function armyRow(game, army, sel, onPick, opts) {
    const row = el('div', { class: 'army' });
    for (let i = 0; i < 7; i++) {
      const sl = army[i];
      const d = el('div', { class: 'slot' + (sel && sel.army === army && sel.i === i ? ' sel' : ''), onclick: () => onPick(army, i) });
      if (sl) { const c = D.creatureOf(sl.c); d.title = c.name; d.appendChild(spriteCanvas(G.creatureSprite(c, 64), 56, 52)); d.appendChild(el('div', { class: 'n' }, String(sl.n))); if (c.upg) d.appendChild(el('div', { class: 'u' }, '★')); }
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
    const content = el('div', null, el('p', null, c.name + ' × ' + sl.n + '. Колко да отделиш в нов слот?'), el('div', { style: 'display:flex;gap:8px;align-items:center' }, range, lbl));
    dialog({ title: 'Разделяне', content, buttons: [{ label: 'Отказ', value: false }, { label: 'Инфо за съществото', value: 'info' }, { label: 'Раздели', value: true, cls: 'primary' }] }).then((v) => {
      if (v === 'info') { creatureInfo(c); }
      else if (v) { const j = army.findIndex((s) => !s); if (j >= 0) MK.Army.split(army, i, army, j, n); else toast('Няма свободен слот.'); }
      state.sel = null; rerender();
    });
  }
  function abilityText(c) {
    const a = c.abilities; const out = [];
    if (a.shooter) out.push('стрелец (' + c.shots + ' изстрела)'); if (a.flying) out.push('лети'); if (a.noMeleePenalty) out.push('без наказание в близък бой');
    if (a.doubleAttack) out.push('двоен удар'); if (a.doubleShot) out.push('двоен изстрел'); if (a.noRetaliation) out.push('без ответен удар'); if (a.retaliations) out.push(a.retaliations > 10 ? 'неограничени ответни удари' : a.retaliations + ' ответни удара');
    if (a.lifeDrain) out.push('изпива живот'); if (a.regenerate) out.push('регенерира'); if (a.breath) out.push('дъх (удря 2 хекса)'); if (a.jousting) out.push('атака +5% на хекс разбег');
    if (a.magicRes) out.push(a.magicRes + '% магическа съпротива'); if (a.spellImmune) out.push('имунитет за магии до ' + a.spellImmune + ' ниво'); if (a.undead) out.push('немъртъв'); if (a.moraleAura) out.push('+1 морал на съюзниците');
    if (a.fearAura) out.push('−1 морал на врага'); if (a.curseHit) out.push(a.curseHit + '% проклятие при удар'); if (a.blindHit) out.push(a.blindHit + '% ослепяване при удар'); if (a.resurrect) out.push('възкресява'); if (a.deathBlow) out.push(a.deathBlow + '% смъртоносен удар');
    if (a.ageHit) out.push(a.ageHit + '% състаряване'); if (a.manaDrain) out.push('изпива мана'); if (a.deathCloud) out.push('облак на смъртта'); if (a.bindHit) out.push('оплита корени'); if (a.resAura) out.push('20% съпротива за съседите'); if (a.allAround) out.push('удря всички съседи'); if (a.manaCost) out.push('+' + a.manaCost + ' цена на вражеските магии');
    return out.join(', ') || '—';
  }
  function creatureInfo(c, extra) {
    const f = D.factionById(c.faction);
    const content = el('div', null,
      el('div', { style: 'display:flex;gap:10px;align-items:center' }, spriteCanvas(G.creatureSprite(c, 64), 64, 64), el('div', null, el('div', { class: 'sub' }, (f ? f.name : 'Неутрални') + ' · ниво ' + c.tier + (c.upg ? ' (подобрено)' : '')), el('div', { class: 'cost' }, costHtml(c.cost)))),
      el('div', { class: 'stats', style: 'margin:8px 0' }, el('div', null, el('b', null, c.att), el('small', null, 'Атака')), el('div', null, el('b', null, c.def), el('small', null, 'Защита')), el('div', null, el('b', null, c.dmin + '–' + c.dmax), el('small', null, 'Щети')), el('div', null, el('b', null, c.hp), el('small', null, 'Живот')), el('div', null, el('b', null, c.spd), el('small', null, 'Скорост')), el('div', null, el('b', null, c.growth), el('small', null, 'Растеж'))),
      el('p', { class: 'tiny' }, 'Способности: ' + abilityText(c)),
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
      s.appendChild(el('header', null, spriteCanvas(G.portrait(h, 64, p.color), 44, 44), el('h1', null, h.name + ' — ' + D.CLASSES[h.cls].name + ', ниво ' + h.level), el('button', { onclick: () => { closeScreens(); game.afterScreen(); } }, '✕')));
      const body = el('div', { class: 'body' });
      const cols = el('div', { class: 'cols' });
      // характеристики
      const left = el('div', { class: 'panel' });
      left.appendChild(el('div', { class: 'stats' }, ...D.PRIMARY.map((k) => el('div', { title: D.PRIMARY_NAME[k] }, el('b', null, w.stat(h, k)), el('small', null, D.PRIMARY_NAME[k])))));
      const nxt = D.LEVEL_XP[h.level + 1] || h.xp, cur = D.LEVEL_XP[h.level];
      left.appendChild(el('div', { class: 'tiny', style: 'margin:6px 0 2px' }, 'Опит ' + h.xp + ' / ' + nxt + ' · Мана ' + h.mana + '/' + w.maxMana(h) + ' · Движение ' + h.movement + '/' + h.maxMovement));
      left.appendChild(el('div', { class: 'xpbar' }, el('div', { style: 'width:' + Math.round(100 * (h.xp - cur) / Math.max(1, nxt - cur)) + '%' })));
      left.appendChild(el('div', { class: 'tiny', style: 'margin-top:6px' }, 'Морал ' + fmtSign(w.heroMorale(h)) + ' · Късмет ' + fmtSign(w.heroLuck(h))));
      if (h.pendingLevels) left.appendChild(el('button', { class: 'primary', style: 'margin-top:8px;width:100%', onclick: () => game.processLevelUps(h).then(render) }, 'Ново ниво! Избери умение'));
      left.appendChild(el('h3', { style: 'margin-top:10px' }, 'Умения'));
      const sk = Object.keys(h.skills);
      if (!sk.length) left.appendChild(el('div', { class: 'tiny' }, 'Няма'));
      sk.forEach((k) => left.appendChild(el('div', { class: 'row' }, el('div', { class: 'grow' }, el('div', { class: 'name' }, D.SKILLS[k].name + ' — ' + D.SKILL_LEVEL_NAME[h.skills[k]]), el('div', { class: 'sub' }, D.SKILLS[k].desc(h.skills[k]))))));
      left.appendChild(el('h3', { style: 'margin-top:10px' }, 'Магии (' + h.spells.length + ')'));
      if (!h.spells.length) left.appendChild(el('div', { class: 'tiny' }, 'Героят не знае магии. Посети магьосническа гилдия или светилище.'));
      const sb = el('div', { class: 'spellbook' });
      h.spells.map((id) => D.spellById[id]).sort((a, b) => a.level - b.level).forEach((sp) => sb.appendChild(el('div', { class: 'spell school-' + sp.school, onclick: () => dialog({ title: sp.name, text: sp.desc + ' Ниво ' + sp.level + ', ' + D.SCHOOL_NAME[sp.school] + ', цена ' + sp.cost + ' мана.' }) }, el('b', null, sp.name), el('small', null, 'ниво ' + sp.level + ' · ' + sp.cost + ' мана'))));
      left.appendChild(sb);
      cols.appendChild(left);
      // армия и артефакти
      const right = el('div', { class: 'panel' });
      right.appendChild(el('h3', null, 'Армия'));
      right.appendChild(armyRow(game, h.army, state.sel, (a, i) => armyPick(state, a, i, render, game)));
      if (other) {
        right.appendChild(el('h3', { style: 'margin-top:8px' }, other.name + (other.garrison ? ' — гарнизон' : '')));
        right.appendChild(armyRow(game, other.army, state.sel, (a, i) => armyPick(state, a, i, render, game)));
      }
      right.appendChild(el('div', { class: 'tiny', style: 'margin:4px 0' }, 'Докосни стек, после друг слот — размяна или сливане. Два пъти същия — разделяне и информация.'));
      right.appendChild(el('h3', { style: 'margin-top:8px' }, 'Артефакти'));
      const arts = el('div', { class: 'arts' });
      D.SLOTS.forEach((slot, i) => {
        const aid = h.arts[i];
        const a = el('div', { class: 'art' + (aid ? ' filled' : ''), title: aid ? D.artById[aid].name : D.SLOT_NAME[slot], onclick: () => { if (!aid) return; const art = D.artById[aid]; dialog({ title: art.name, text: art.desc + ' (' + D.SLOT_NAME[art.slot] + ', ' + D.ART_CLASS_NAME[art.cls] + ')', buttons: [{ label: 'В раницата', value: 'bp' }, { label: 'Добре', value: true }] }).then((v) => { if (v === 'bp') { w.unequip(h, i); render(); } }); } }, aid ? artGlyph(D.artById[aid]) : '', el('small', null, D.SLOT_NAME[slot].slice(0, 4)));
        arts.appendChild(a);
      });
      right.appendChild(arts);
      if (h.backpack.length) {
        right.appendChild(el('h3', { style: 'margin-top:8px' }, 'Раница'));
        const bp = el('div', { class: 'arts' });
        h.backpack.forEach((aid, bi) => bp.appendChild(el('div', { class: 'art filled', title: D.artById[aid].name, onclick: () => { const art = D.artById[aid]; dialog({ title: art.name, text: art.desc, buttons: [{ label: 'Сложи', value: 'eq', cls: 'primary' }, { label: 'Добре', value: true }] }).then((v) => { if (v === 'eq') { w.equipFromBackpack(h, bi); render(); } }); } }, artGlyph(D.artById[aid]))));
        right.appendChild(bp);
      }
      cols.appendChild(right);
      body.appendChild(cols);
      s.appendChild(body);
    };
    render();
  }
  const fmtSign = (n) => (n > 0 ? '+' + n : String(n));
  function artGlyph(a) { return { head: '⛑', neck: '📿', shoulders: '🧥', weapon: '🗡', shield: '🛡', torso: '🥋', ring: '💍', feet: '👢', misc: '🔮' }[a.slot] || '✦'; }

  // ---------------------------------------------------------------- ниво нагоре
  function levelUpDialog(game, h, roll) {
    const content = el('div', null);
    content.appendChild(el('p', null, h.name + ' достига ниво ' + (h.level - h.pendingLevels + 1) + '. ' + D.PRIMARY_NAME[roll.stat] + ' +1.'));
    return new Promise((resolve) => {
      if (!roll.offers.length) { dialog({ title: 'Ново ниво', content }).then(() => resolve(null)); return; }
      content.appendChild(el('p', null, 'Избери умение:'));
      const wrap = el('div', { class: 'modal-wrap' });
      const m = el('div', { class: 'modal' }, el('h2', null, 'Ново ниво'), content);
      roll.offers.forEach((sk) => {
        const lvl = (h.skills[sk] || 0) + 1;
        m.appendChild(el('div', { class: 'row', style: 'cursor:pointer', onclick: () => { wrap.remove(); resolve(sk); } }, el('div', { class: 'grow' }, el('div', { class: 'name' }, D.SKILLS[sk].name + ' — ' + D.SKILL_LEVEL_NAME[lvl]), el('div', { class: 'sub' }, D.SKILLS[sk].desc(lvl))), el('button', { class: 'small primary' }, 'Избери')));
      });
      wrap.appendChild(m); overlay().appendChild(wrap);
    });
  }

  // ---------------------------------------------------------------- град
  function showTown(game, t) {
    const w = game.world;
    const p = w.players[t.owner];
    const s = screen('');
    const state = { tab: 'build', sel: null };
    const visitor = () => (t.visitor ? w.heroes[t.visitor] : null);
    const render = () => {
      s.innerHTML = '';
      const f = D.factionById(t.faction);
      s.appendChild(el('header', null, spriteCanvas(G.objectSprite({ type: 'town', faction: t.faction, owner: t.owner }, 64, w), 44, 44), el('h1', null, t.name + ' — ' + f.name + (t.builtToday ? ' · строено днес' : '')), el('button', { onclick: () => { closeScreens(); game.afterScreen(); } }, '✕')));
      const body = el('div', { class: 'body' });
      // армии
      const ap = el('div', { class: 'panel' });
      ap.appendChild(el('h3', null, 'Гарнизон'));
      ap.appendChild(armyRow(game, t.garrison, state.sel, (a, i) => armyPick(state, a, i, render, game)));
      const v = visitor();
      if (v) {
        ap.appendChild(el('div', { class: 'row', style: 'margin-top:6px' }, spriteCanvas(G.portrait(v, 64, p.color), 36, 36), el('div', { class: 'grow' }, el('div', { class: 'name' }, v.name + ', ниво ' + v.level), el('div', { class: 'sub' }, 'Посетил герой · движение ' + v.movement)), el('button', { class: 'small', onclick: () => showHero(game, v, { name: t.name, army: t.garrison, garrison: true }) }, 'Герой')));
        ap.appendChild(armyRow(game, v.army, state.sel, (a, i) => armyPick(state, a, i, render, game)));
      }
      body.appendChild(ap);
      // табове
      const tabs = el('div', { class: 'tabs' });
      [['build', 'Строеж'], ['recruit', 'Набор'], ['mage', 'Гилдия'], ['tavern', 'Таверна'], ['market', 'Пазар']].forEach(([id, l]) => {
        const disabled = (id === 'mage' && !w.mageLevel(t)) || (id === 'tavern' && !t.buildings.tavern) || (id === 'market' && !t.buildings.market);
        tabs.appendChild(el('button', { class: state.tab === id ? 'sel' : '', disabled: disabled ? 'disabled' : null, onclick: () => { state.tab = id; render(); } }, l));
      });
      body.appendChild(tabs);
      const pane = el('div', { class: 'panel' });
      if (state.tab === 'build') renderBuild(pane);
      if (state.tab === 'recruit') renderRecruit(pane);
      if (state.tab === 'mage') renderMage(pane);
      if (state.tab === 'tavern') renderTavern(pane);
      if (state.tab === 'market') renderMarket(pane);
      body.appendChild(pane);
      s.appendChild(body);
      updateHUD(game);
    };
    const renderBuild = (pane) => {
      pane.appendChild(el('h3', null, 'Построено: ' + Object.keys(t.buildings).map((id) => D.buildingFor(t.faction, id).name).join(', ')));
      pane.appendChild(el('div', { class: 'tiny', style: 'margin-bottom:6px' }, 'Доход на града: ' + w.townIncome(t) + ' злато на ден. Растеж: форт ' + ['няма', 'Форт', 'Цитадела (+50%)', 'Замък (+100%)'][w.fortLevel(t)] + '.'));
      D.BUILDINGS.forEach((b) => {
        if (t.buildings[b.id]) return;
        const bf = D.buildingFor(t.faction, b.id);
        // показваме само тези, чиито изисквания са налични или на една стъпка
        const missing = bf.req.filter((r) => !t.buildings[r]);
        if (missing.length > 1) return;
        const chk = w.canBuild(t, b.id);
        pane.appendChild(el('div', { class: 'row' }, el('div', { class: 'grow' }, el('div', { class: 'name' }, bf.name), el('div', { class: 'sub' }, bf.desc || ''), costHtml(bf.cost, p.res), !chk.ok ? el('div', { class: 'sub', style: 'color:#f0a080' }, chk.why) : null), el('button', { class: 'small' + (chk.ok ? ' primary' : ''), disabled: chk.ok ? null : 'disabled', onclick: () => { const r = w.build(t, b.id); if (r.ok) toast(bf.name + ' е построено.'); else toast(r.why); render(); } }, 'Строй')));
      });
    };
    const renderRecruit = (pane) => {
      let any = false;
      for (let tier = 1; tier <= 7; tier++) {
        if (!t.buildings['dw' + tier]) continue;
        any = true;
        const upg = !!t.buildings['dw' + tier + 'u'];
        [false, true].forEach((u) => {
          if (u && !upg) return;
          const cid = t.faction + tier + (u ? 'u' : ''); const c = D.creatureOf(cid);
          const target = visitor() ? visitor().army : t.garrison;
          const max = Math.min(t.avail[tier], w.maxAffordable(p, cid));
          const row = el('div', { class: 'row' });
          const cv = spriteCanvas(G.creatureSprite(c, 64), 48, 48); cv.style.cursor = 'pointer'; cv.addEventListener('click', () => creatureInfo(c));
          row.appendChild(cv);
          row.appendChild(el('div', { class: 'grow' }, el('div', { class: 'name' }, c.name), el('div', { class: 'sub' }, 'Налични: ' + t.avail[tier] + ' · растеж ' + w.growthOf(t, tier) + '/седм. · А' + c.att + ' З' + c.def + ' Щ' + c.dmin + '–' + c.dmax + ' Ж' + c.hp + ' С' + c.spd), costHtml(c.cost, p.res)));
          row.appendChild(el('button', { class: 'small', disabled: max > 0 ? null : 'disabled', onclick: () => recruitDialog(cid, tier, u, max, target) }, 'Набор'));
          row.appendChild(el('button', { class: 'small primary', disabled: max > 0 ? null : 'disabled', onclick: () => { const r = w.recruit(t, tier, u, max, target); if (r.ok) toast(r.n + ' × ' + c.name + ' се присъединяват.'); else toast(r.why); render(); } }, 'Всички (' + max + ')'));
          pane.appendChild(row);
        });
      }
      if (!any) pane.appendChild(el('div', { class: 'tiny' }, 'Няма жилища. Построй Форт и първото жилище.'));
      // подобрения на стекове
      const v = visitor();
      [t.garrison, v ? v.army : null].forEach((army, k) => {
        if (!army) return;
        army.forEach((sl, i) => {
          const cost = w.upgradeCost(t, army, i); if (!cost) return;
          const c = D.creatureOf(sl.c), u = D.upgradeOf(c);
          pane.appendChild(el('div', { class: 'row' }, spriteCanvas(G.creatureSprite(u, 64), 40, 40), el('div', { class: 'grow' }, el('div', { class: 'name' }, 'Подобри ' + sl.n + ' × ' + c.name + ' → ' + u.name), costHtml(cost, p.res)), el('button', { class: 'small', disabled: w.canAfford(p, cost) ? null : 'disabled', onclick: () => { const r = w.upgradeStack(t, army, i); if (!r.ok) toast(r.why); render(); } }, 'Подобри')));
        });
      });
    };
    const recruitDialog = (cid, tier, u, max, target) => {
      const c = D.creatureOf(cid);
      let n = max;
      const lbl = el('b', { style: 'font-size:22px;color:#ffd870;min-width:60px;text-align:center' }, String(n));
      const cost = el('div', null); const upd = () => { cost.innerHTML = ''; cost.appendChild(costHtml(w.recruitCost(cid, n), p.res)); };
      const range = el('input', { type: 'range', min: 1, max, value: n, style: 'flex:1' }); range.addEventListener('input', () => { n = +range.value; lbl.textContent = String(n); upd(); }); upd();
      dialog({ title: 'Набор: ' + c.name, content: el('div', null, el('div', { style: 'display:flex;gap:8px;align-items:center' }, range, lbl), cost), buttons: [{ label: 'Отказ', value: false }, { label: 'Наеми', value: true, cls: 'primary' }] }).then((v) => { if (v) { const r = w.recruit(t, tier, u, n, target); if (!r.ok) toast(r.why); } render(); });
    };
    const renderMage = (pane) => {
      const ml = w.mageLevel(t);
      for (let l = 1; l <= ml; l++) {
        pane.appendChild(el('h3', { style: 'margin-top:6px' }, 'Ниво ' + l));
        const sb = el('div', { class: 'spellbook' });
        t.spells[l].forEach((id) => { const sp = D.spellById[id]; sb.appendChild(el('div', { class: 'spell school-' + sp.school, onclick: () => dialog({ title: sp.name, text: sp.desc + ' ' + D.SCHOOL_NAME[sp.school] + ', цена ' + sp.cost + ' мана.' }) }, el('b', null, sp.name), el('small', null, D.SCHOOL_NAME[sp.school] + ' · ' + sp.cost + ' мана'))); });
        pane.appendChild(sb);
      }
      pane.appendChild(el('div', { class: 'tiny', style: 'margin-top:8px' }, 'Героят в града научава магиите автоматично. За 3-о ниво и нагоре е нужна Мъдрост.'));
    };
    const renderTavern = (pane) => {
      const list = w.tavernHeroes(t);
      if (!list.length) pane.appendChild(el('div', { class: 'tiny' }, 'Днес в таверната няма герои.'));
      list.forEach((proto, i) => {
        const cls = D.CLASSES[proto.cls];
        const fake = { cls: proto.cls, portrait: proto.portrait };
        pane.appendChild(el('div', { class: 'row' }, spriteCanvas(G.portrait(fake, 64, p.color), 44, 44), el('div', { class: 'grow' }, el('div', { class: 'name' }, proto.name + (proto.keep ? ', ниво ' + proto.keep.level : '')), el('div', { class: 'sub' }, cls.name + ' · ' + D.factionById(proto.faction).name + ' · армия: ' + proto.army.filter(Boolean).map((s) => s.n + ' ' + D.creatureOf(s.c).name).join(', ')), el('div', { class: 'sub' }, 'Цена: 2500 злато')), el('button', { class: 'small primary', disabled: p.res.gold >= 2500 && !t.visitor && p.heroes.length < 8 ? null : 'disabled', onclick: () => { const r = w.hireHero(t, i); if (r.ok) { if (proto.keep) Object.assign(r.hero, proto.keep); toast(r.hero.name + ' се присъединява.'); } else toast(r.why); render(); } }, 'Наеми')));
      });
      if (t.visitor) pane.appendChild(el('div', { class: 'tiny' }, 'В града вече има герой — изведи го, за да наемеш друг.'));
    };
    const renderMarket = (pane) => {
      const st = state.market || (state.market = { from: 'wood', to: 'gold' });
      pane.appendChild(el('div', { class: 'tiny' }, 'Пазари в кралството: ' + w.marketRate(p) + '. Повече пазари — по-добър курс.'));
      const mk = (key, label) => { const row = el('div', { class: 'opt-row' }, el('label', null, label)); D.RES.forEach((r) => row.appendChild(el('button', { class: 'small' + (st[key] === r ? ' sel' : ''), style: 'border-color:' + D.RES_COLOR[r], onclick: () => { st[key] = r; render(); } }, D.RES_NAME[r].split(' ')[0]))); return row; };
      pane.appendChild(mk('from', 'Даваш'));
      pane.appendChild(mk('to', 'Получаваш'));
      if (st.from === st.to) { pane.appendChild(el('div', { class: 'tiny' }, 'Избери различни ресурси.')); return; }
      const rate = w.tradeRate(p, st.from, st.to);
      const text = st.to === 'gold' ? '1 ' + D.RES_NAME[st.from] + ' → ' + rate + ' злато' : rate + ' ' + D.RES_NAME[st.from] + ' → 1 ' + D.RES_NAME[st.to];
      pane.appendChild(el('p', null, 'Курс: ' + text));
      const amounts = st.to === 'gold' ? [1, 5, 10, 'всичко'] : [1, 2, 5];
      const row = el('div', { class: 'opt-row' });
      amounts.forEach((a) => row.appendChild(el('button', { class: 'small', onclick: () => { const n = a === 'всичко' ? p.res[st.from] : a; if (!w.trade(p, st.from, st.to, n)) toast('Недостатъчно ресурси.'); render(); } }, a === 'всичко' ? 'Всичко' : '× ' + a)));
      pane.appendChild(row);
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
    return dialog({ title: 'Жилище: ' + c.name, content: el('div', null, el('p', null, 'Налични: ' + o.available + '. Цена за едно: ' + Object.entries(c.cost).map(([k, v]) => v + ' ' + D.RES_NAME[k].toLowerCase()).join(', ') + '.'), el('div', { style: 'display:flex;gap:8px;align-items:center' }, range, lbl), cost), buttons: [{ label: 'Затвори', value: false }, { label: 'Инфо', value: 'info' }, { label: 'Наеми', value: true, cls: 'primary' }] }).then((v) => {
      if (v === 'info') return creatureInfo(c).then(() => dwellingDialog(game, h, o));
      if (v && n > 0) { if (!MK.Army.canAdd(h.army, o.creature)) return toast('Няма свободен слот в армията.'); w.pay(p, w.recruitCost(o.creature, n)); o.available -= n; MK.Army.add(h.army, o.creature, n); toast(n + ' × ' + c.name + ' се присъединяват.'); }
    });
  }

  MK.UI = { el, dialog, toast, showMenu, showHelp, showSetup, updateHUD, showHero, showTown, levelUpDialog, dwellingDialog, creatureInfo, closeScreens, screen, spriteCanvas, costHtml, armyRow, armyPick, abilityText };
})();
