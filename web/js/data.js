/* MagicKnights — игрови данни.
   Правилата следват класическата формула на Heroes III / Horn of the Abyss,
   но всички имена, графика и текстове са оригинални. */
(function () {
  'use strict';
  const MK = (window.MK = window.MK || {});
  const D = (MK.data = {});

  // ---------------------------------------------------------------- ресурси
  D.RES = ['gold', 'wood', 'ore', 'mercury', 'sulfur', 'crystal', 'gems'];
  D.RES_NAME = {
    gold: 'Злато', wood: 'Дърво', ore: 'Руда', mercury: 'Живак',
    sulfur: 'Сяра', crystal: 'Кристал', gems: 'Скъпоценни камъни'
  };
  D.RES_COLOR = {
    gold: '#e8c040', wood: '#8a5a2b', ore: '#8d8d95', mercury: '#c0d8f0',
    sulfur: '#e0d040', crystal: '#e05050', gems: '#50c0e8'
  };

  // ---------------------------------------------------------------- терени
  // cost: точки за движение за плочка (диагонал ×1.41)
  D.TERRAIN = [
    { id: 0, key: 'water', name: 'Вода', cost: 0, passable: false, col: '#2b5fa8', col2: '#2454a0' },
    { id: 1, key: 'grass', name: 'Трева', cost: 100, passable: true, col: '#4e8a3a', col2: '#467f34' },
    { id: 2, key: 'dirt', name: 'Пръст', cost: 100, passable: true, col: '#8a6a3c', col2: '#7f6136' },
    { id: 3, key: 'sand', name: 'Пясък', cost: 150, passable: true, col: '#d8c47a', col2: '#cfba70' },
    { id: 4, key: 'snow', name: 'Сняг', cost: 150, passable: true, col: '#e6ecf2', col2: '#d8e0ea' },
    { id: 5, key: 'swamp', name: 'Блато', cost: 175, passable: true, col: '#5a7a4a', col2: '#517043' },
    { id: 6, key: 'rough', name: 'Пустош', cost: 125, passable: true, col: '#9a8a6a', col2: '#8f7f60' },
    { id: 7, key: 'lava', name: 'Лава', cost: 100, passable: true, col: '#3a3038', col2: '#332a30' }
  ];
  D.ROAD_COST = 65;

  // ---------------------------------------------------------------- фракции
  D.FACTIONS = [
    {
      id: 'kingdom', name: 'Кралство', adj: 'кралски', terrain: 1, color: '#4f7fd8',
      rare: 'gems', classes: ['knight', 'cleric'],
      desc: 'Рицари, стрелци и ангели — дисциплинирана армия със силна защита и висок морал.',
      dwellings: ['Казарма', 'Стрелкова кула', 'Гнездо на грифони', 'Оръжейница', 'Манастир', 'Конюшни', 'Небесна порта'],
      dwellingsU: ['Укрепена казарма', 'Ловджийска кула', 'Кралско гнездо', 'Рицарска зала', 'Катедрала', 'Турнирно поле', 'Порта на славата']
    },
    {
      id: 'grove', name: 'Горско царство', adj: 'горски', terrain: 1, color: '#4faf5a',
      rare: 'crystal', classes: ['ranger', 'druid'],
      desc: 'Кентаври, елфи, еднорози и дракони — бърза армия със силни стрелци и магическа съпротива.',
      dwellings: ['Конюшни на кентаврите', 'Джуджешка шахта', 'Елфийска беседка', 'Скали на пегасите', 'Свещена горичка', 'Поляна на еднорозите', 'Драконова пещера'],
      dwellingsU: ['Капитански конюшни', 'Бойна шахта', 'Голяма беседка', 'Сребърни скали', 'Древна горичка', 'Свещена поляна', 'Златна пещера']
    },
    {
      id: 'necropolis', name: 'Некропол', adj: 'некрополски', terrain: 2, color: '#8a5fb8',
      rare: 'mercury', classes: ['deathknight', 'necromancer'],
      desc: 'Немъртви пълчища без морал и без страх — скелети, вампири и костени дракони.',
      dwellings: ['Костница', 'Гробище', 'Кула на духовете', 'Имение', 'Мавзолей', 'Зала на мрака', 'Драконова гробница'],
      dwellingsU: ['Голяма костница', 'Гробищен парк', 'Обсебена кула', 'Мрачно имение', 'Некромантски мавзолей', 'Зала на ужаса', 'Призрачна гробница']
    }
  ];
  D.factionById = (id) => D.FACTIONS.find((f) => f.id === id);

  // ---------------------------------------------------------------- същества
  // att/def/dmg/hp/spd/cost/growth — по калъпа на класиката.
  // abilities: flying, shooter, noMeleePenalty, doubleAttack, doubleShot,
  //   noRetaliation, retaliations:N|inf, lifeDrain, regenerate, breath,
  //   jousting, magicRes:N, spellImmune:L, undead, moraleAura, fearAura,
  //   curseHit, blindHit:P, resurrect, deathBlow:P, ageHit, manaDrain,
  //   noObstaclePenalty (стрелецът стреля през стени без наказание)
  const C = [];
  function cr(faction, tier, upg, name, fam, att, def, dmin, dmax, hp, spd, gold, growth, extra) {
    const c = Object.assign({
      id: faction + tier + (upg ? 'u' : ''),
      faction, tier, upg, name, fam, att, def, dmin, dmax, hp, spd,
      cost: { gold }, growth, shots: 0, abilities: {}
    }, extra || {});
    if (extra && extra.rare) { c.cost[D.factionById(faction).rare] = extra.rare; delete c.rare; }
    C.push(c);
    return c;
  }
  // Кралство
  cr('kingdom', 1, 0, 'Копиеносец', 'infantry', 4, 5, 1, 3, 10, 4, 60, 14);
  cr('kingdom', 1, 1, 'Алебардист', 'infantry', 6, 5, 2, 3, 10, 5, 75, 14);
  cr('kingdom', 2, 0, 'Стрелец', 'archer', 6, 3, 2, 3, 10, 4, 100, 9, { shots: 12, abilities: { shooter: 1 } });
  cr('kingdom', 2, 1, 'Ловец', 'archer', 6, 3, 2, 3, 10, 6, 150, 9, { shots: 24, abilities: { shooter: 1, doubleShot: 1 } });
  cr('kingdom', 3, 0, 'Грифон', 'flyer', 8, 8, 3, 6, 25, 6, 200, 7, { abilities: { flying: 1, retaliations: 2 } });
  cr('kingdom', 3, 1, 'Кралски грифон', 'flyer', 9, 9, 3, 6, 25, 9, 240, 7, { abilities: { flying: 1, retaliations: 99 } });
  cr('kingdom', 4, 0, 'Мечоносец', 'infantry', 10, 12, 6, 9, 35, 5, 300, 4);
  cr('kingdom', 4, 1, 'Кръстоносец', 'infantry', 12, 12, 7, 10, 35, 6, 400, 4, { abilities: { doubleAttack: 1 } });
  cr('kingdom', 5, 0, 'Монах', 'mage', 12, 7, 10, 12, 30, 5, 400, 3, { shots: 12, abilities: { shooter: 1 } });
  cr('kingdom', 5, 1, 'Ревнител', 'mage', 12, 10, 10, 12, 30, 7, 450, 3, { shots: 24, abilities: { shooter: 1, noMeleePenalty: 1 } });
  cr('kingdom', 6, 0, 'Конник', 'rider', 15, 15, 15, 25, 100, 7, 1000, 2, { abilities: { jousting: 1 } });
  cr('kingdom', 6, 1, 'Шампион', 'rider', 16, 16, 20, 25, 100, 9, 1200, 2, { abilities: { jousting: 1 } });
  cr('kingdom', 7, 0, 'Ангел', 'angel', 20, 20, 50, 50, 200, 12, 3000, 1, { rare: 1, abilities: { flying: 1, moraleAura: 1 } });
  cr('kingdom', 7, 1, 'Архангел', 'angel', 30, 30, 50, 50, 250, 18, 5000, 1, { rare: 3, abilities: { flying: 1, moraleAura: 1, resurrect: 100 } });
  // Горско царство
  cr('grove', 1, 0, 'Кентавър', 'rider', 5, 3, 2, 3, 8, 6, 70, 14);
  cr('grove', 1, 1, 'Кентавър капитан', 'rider', 6, 3, 2, 3, 10, 8, 90, 14);
  cr('grove', 2, 0, 'Джудже', 'infantry', 6, 7, 2, 4, 20, 3, 120, 8, { abilities: { magicRes: 20 } });
  cr('grove', 2, 1, 'Бойно джудже', 'infantry', 7, 7, 2, 4, 20, 5, 150, 8, { abilities: { magicRes: 40 } });
  cr('grove', 3, 0, 'Горски елф', 'archer', 9, 5, 3, 5, 15, 6, 200, 7, { shots: 24, abilities: { shooter: 1 } });
  cr('grove', 3, 1, 'Велик елф', 'archer', 9, 5, 3, 5, 15, 7, 225, 7, { shots: 24, abilities: { shooter: 1, doubleShot: 1 } });
  cr('grove', 4, 0, 'Пегас', 'flyer', 9, 8, 5, 9, 30, 8, 250, 5, { abilities: { flying: 1, manaCost: 2 } });
  cr('grove', 4, 1, 'Сребърен пегас', 'flyer', 9, 10, 5, 9, 30, 12, 275, 5, { abilities: { flying: 1, manaCost: 2 } });
  cr('grove', 5, 0, 'Дендроид пазач', 'tree', 9, 12, 10, 14, 55, 3, 350, 3, { abilities: { bindHit: 1 } });
  cr('grove', 5, 1, 'Дендроид войн', 'tree', 9, 12, 10, 14, 65, 4, 425, 3, { abilities: { bindHit: 1 } });
  cr('grove', 6, 0, 'Еднорог', 'beast', 15, 14, 18, 22, 90, 7, 850, 2, { abilities: { blindHit: 20, resAura: 20 } });
  cr('grove', 6, 1, 'Боен еднорог', 'beast', 15, 14, 18, 22, 110, 9, 950, 2, { abilities: { blindHit: 20, resAura: 20 } });
  cr('grove', 7, 0, 'Зелен дракон', 'dragon', 18, 18, 40, 50, 180, 10, 2400, 1, { rare: 1, abilities: { flying: 1, breath: 1, spellImmune: 3 } });
  cr('grove', 7, 1, 'Златен дракон', 'dragon', 27, 27, 40, 50, 250, 16, 4000, 1, { rare: 2, abilities: { flying: 1, breath: 1, spellImmune: 4 } });
  // Некропол
  cr('necropolis', 1, 0, 'Скелет', 'undead', 5, 4, 1, 3, 6, 4, 60, 12, { abilities: { undead: 1 } });
  cr('necropolis', 1, 1, 'Скелет войн', 'undead', 6, 6, 1, 3, 6, 5, 70, 12, { abilities: { undead: 1 } });
  cr('necropolis', 2, 0, 'Ходещ мъртвец', 'undead', 5, 5, 2, 3, 15, 3, 100, 8, { abilities: { undead: 1 } });
  cr('necropolis', 2, 1, 'Зомби', 'undead', 5, 5, 2, 3, 20, 4, 125, 8, { abilities: { undead: 1 } });
  cr('necropolis', 3, 0, 'Дух', 'spirit', 7, 7, 3, 5, 18, 5, 200, 7, { abilities: { undead: 1, flying: 1, regenerate: 1 } });
  cr('necropolis', 3, 1, 'Призрак', 'spirit', 7, 7, 3, 5, 18, 7, 230, 7, { abilities: { undead: 1, flying: 1, regenerate: 1, manaDrain: 2 } });
  cr('necropolis', 4, 0, 'Вампир', 'spirit', 10, 9, 5, 8, 30, 6, 360, 4, { abilities: { undead: 1, flying: 1, noRetaliation: 1 } });
  cr('necropolis', 4, 1, 'Вампирски лорд', 'spirit', 10, 10, 5, 8, 40, 9, 500, 4, { abilities: { undead: 1, flying: 1, noRetaliation: 1, lifeDrain: 1 } });
  cr('necropolis', 5, 0, 'Лич', 'mage', 13, 10, 11, 13, 30, 6, 550, 3, { shots: 12, abilities: { undead: 1, shooter: 1, deathCloud: 1 } });
  cr('necropolis', 5, 1, 'Могъщ лич', 'mage', 13, 10, 11, 15, 40, 7, 600, 3, { shots: 24, abilities: { undead: 1, shooter: 1, deathCloud: 1 } });
  cr('necropolis', 6, 0, 'Черен рицар', 'rider', 16, 16, 15, 30, 120, 7, 1200, 2, { abilities: { undead: 1, curseHit: 20 } });
  cr('necropolis', 6, 1, 'Рицар на ужаса', 'rider', 18, 18, 15, 30, 120, 9, 1500, 2, { abilities: { undead: 1, curseHit: 20, deathBlow: 20 } });
  cr('necropolis', 7, 0, 'Костен дракон', 'dragon', 17, 15, 25, 50, 150, 9, 1800, 1, { abilities: { undead: 1, flying: 1, fearAura: 1 } });
  cr('necropolis', 7, 1, 'Призрачен дракон', 'dragon', 19, 17, 25, 50, 200, 14, 3000, 1, { rare: 1, abilities: { undead: 1, flying: 1, fearAura: 1, ageHit: 20 } });
  // Неутрални (без фракция) — за пазачи и външни жилища
  function nt(id, name, fam, att, def, dmin, dmax, hp, spd, gold, growth, extra) {
    const c = Object.assign({ id, faction: 'neutral', tier: extra && extra.tier || 0, upg: 0, name, fam, att, def, dmin, dmax, hp, spd, cost: { gold }, growth, shots: 0, abilities: {} }, extra || {});
    C.push(c); return c;
  }
  nt('n_bandit', 'Разбойник', 'infantry', 8, 3, 2, 4, 10, 6, 100, 8, { tier: 2 });
  nt('n_wolf', 'Степен вълк', 'beast', 7, 5, 2, 4, 12, 7, 90, 9, { tier: 2 });
  nt('n_troll', 'Пещерен трол', 'giant', 11, 9, 8, 12, 45, 5, 450, 3, { tier: 4, abilities: { regenerate: 1 } });
  nt('n_golem', 'Каменен голем', 'giant', 9, 12, 5, 8, 40, 4, 350, 4, { tier: 4, abilities: { magicRes: 50 } });
  nt('n_hydra', 'Блатна хидра', 'dragon', 16, 18, 25, 45, 175, 5, 2200, 1, { tier: 7, abilities: { noRetaliation: 1, allAround: 1 } });

  D.CREATURES = C;
  D.creatureById = {};
  C.forEach((c) => { D.creatureById[c.id] = c; });
  D.creatureOf = (id) => D.creatureById[id];
  D.upgradeOf = (c) => c.upg || c.faction === 'neutral' ? null : D.creatureById[c.faction + c.tier + 'u'];
  D.avgDmg = (c) => (c.dmin + c.dmax) / 2;
  // Бойна стойност на едно същество — за оценка на силата на армиите.
  /* Стойност на обект на картата (мащаб на класическите генератори) — определя силата на пазачите */
  D.treasureValue = (o) => {
    switch (o.type) {
      case 'resource': return o.res === 'gold' ? 750 : o.res === 'wood' || o.res === 'ore' ? 1400 : 2000;
      case 'chest': return 1500;
      case 'artifact': { const a = o.art && D.artById[o.art]; return a ? [0, 2000, 5000, 12000][a.cls] || 2000 : 2000; }
      case 'mine': return o.res === 'gold' ? 7000 : o.res === 'wood' || o.res === 'ore' ? 1500 : 3500;
      case 'dwelling': { const c = D.creatureOf(o.creature); return c ? [0, 750, 1500, 2500, 4000, 6000, 10000, 15000][c.tier] : 0; }
      case 'learning': return 1500; case 'shrine1': return 500; case 'shrine2': return 2000; case 'shrine3': return 3000;
      case 'tree_knowledge': return 2500; case 'windmill': return 1500; case 'watermill': return 750; case 'campfire': return 2000;
      case 'wagon': return 500; case 'garden': return 1500; case 'idol': return 1000; case 'library': return 2000;
      case 'mercenary': return 3000; case 'tower_def': return 3000; case 'star_axis': return 1000; case 'school_war': case 'school_magic': return 1000;
      case 'rally': return 750; case 'magic_well': return 250; case 'fountain': return 500; case 'sea_chest': return 1500;
      default: return 0;
    }
  };
  D.fightValue = (c) => {
    const off = D.avgDmg(c) * (1 + c.att * 0.05);
    const def = c.hp * (1 + c.def * 0.05);
    let v = Math.sqrt(off * def) * (1 + Math.min(c.spd, 12) / 20);
    if (c.abilities.shooter) v *= 1.25;
    if (c.abilities.flying) v *= 1.1;
    if (c.abilities.doubleAttack || c.abilities.doubleShot) v *= 1.3;
    if (c.abilities.noRetaliation || c.abilities.lifeDrain) v *= 1.15;
    if (c.abilities.breath || c.abilities.allAround) v *= 1.15;
    return v;
  };

  // ---------------------------------------------------------------- сгради
  // Общ калъп за всяка фракция; имена на жилищата идват от фракцията.
  // req: списък от id на нужни сгради. Цени в ресурси.
  D.BUILDINGS = [
    { id: 'hall1', name: 'Селска управа', cost: {}, income: 500, desc: 'Носи 500 злато на ден.' },
    { id: 'hall2', name: 'Градска управа', cost: { gold: 2500 }, req: ['hall1', 'tavern'], income: 1000, desc: 'Носи 1000 злато на ден.' },
    { id: 'hall3', name: 'Кметство', cost: { gold: 5000, wood: 5, ore: 5 }, req: ['hall2', 'market', 'mage1'], income: 2000, desc: 'Носи 2000 злато на ден.' },
    { id: 'hall4', name: 'Капитолий', cost: { gold: 10000, wood: 5, ore: 5 }, req: ['hall3', 'fort3'], income: 4000, desc: 'Носи 4000 злато на ден. Само един на кралство.' },
    { id: 'fort1', name: 'Форт', cost: { gold: 5000, wood: 20, ore: 20 }, desc: 'Стени при обсада. Нужен за жилищата на съществата.' },
    { id: 'fort2', name: 'Цитадела', cost: { gold: 2500, wood: 5, ore: 5 }, req: ['fort1'], desc: '+50% растеж на съществата, стрелкова кула и ров.' },
    { id: 'fort3', name: 'Замък', cost: { gold: 5000, wood: 10, ore: 10 }, req: ['fort2'], desc: '+100% растеж, две допълнителни кули, по-здрави стени.' },
    { id: 'tavern', name: 'Таверна', cost: { gold: 500, wood: 5 }, desc: 'Наемане на герои. +1 морал за защитниците.' },
    { id: 'market', name: 'Пазар', cost: { gold: 500, wood: 5 }, desc: 'Обмен на ресурси. Всеки следващ пазар подобрява курса.' },
    { id: 'silo', name: 'Склад', cost: { gold: 5000, wood: 5, ore: 5 }, req: ['market'], desc: 'Носи по 1 от рядкия ресурс на фракцията на ден.' },
    { id: 'well', name: 'Кладенец', cost: { gold: 1000 }, req: ['fort1'], desc: '+2 растеж на всички същества всяка седмица.' },
    { id: 'mage1', name: 'Магьосническа гилдия I', cost: { gold: 2000, wood: 5, ore: 5 }, desc: 'Магии от 1-во ниво. Възстановява маната на посетил герой.' },
    { id: 'mage2', name: 'Магьосническа гилдия II', cost: { gold: 1000, wood: 5, ore: 5, mercury: 4, sulfur: 4, crystal: 4, gems: 4 }, req: ['mage1'], desc: 'Магии от 2-ро ниво.' },
    { id: 'mage3', name: 'Магьосническа гилдия III', cost: { gold: 1000, wood: 5, ore: 5, mercury: 6, sulfur: 6, crystal: 6, gems: 6 }, req: ['mage2'], desc: 'Магии от 3-то ниво.' },
    { id: 'mage4', name: 'Магьосническа гилдия IV', cost: { gold: 1000, wood: 5, ore: 5, mercury: 8, sulfur: 8, crystal: 8, gems: 8 }, req: ['mage3'], desc: 'Магии от 4-то ниво.' },
    { id: 'mage5', name: 'Магьосническа гилдия V', cost: { gold: 1000, wood: 5, ore: 5, mercury: 10, sulfur: 10, crystal: 10, gems: 10 }, req: ['mage4'], desc: 'Магии от 5-то ниво.' },
    { id: 'dw1', tier: 1, cost: { gold: 300, wood: 5 }, req: ['fort1'] },
    { id: 'dw2', tier: 2, cost: { gold: 1000, ore: 5 }, req: ['dw1'] },
    { id: 'dw3', tier: 3, cost: { gold: 1000, wood: 5 }, req: ['dw1'] },
    { id: 'dw4', tier: 4, cost: { gold: 2000, wood: 10, ore: 5 }, req: ['dw2', 'dw3'] },
    { id: 'dw5', tier: 5, cost: { gold: 3000, wood: 5, ore: 5, rare: 2 }, req: ['dw4', 'mage1'] },
    { id: 'dw6', tier: 6, cost: { gold: 5000, wood: 10, ore: 10, rare: 5 }, req: ['dw5'] },
    { id: 'dw7', tier: 7, cost: { gold: 10000, wood: 10, ore: 10, rare: 10 }, req: ['dw6', 'mage2'] },
    { id: 'dw1u', tier: 1, upg: 1, cost: { gold: 1000, wood: 5 }, req: ['dw1'] },
    { id: 'dw2u', tier: 2, upg: 1, cost: { gold: 1500, wood: 5, ore: 5 }, req: ['dw2'] },
    { id: 'dw3u', tier: 3, upg: 1, cost: { gold: 2000, ore: 5 }, req: ['dw3'] },
    { id: 'dw4u', tier: 4, upg: 1, cost: { gold: 2000, wood: 5, ore: 5 }, req: ['dw4'] },
    { id: 'dw5u', tier: 5, upg: 1, cost: { gold: 3000, wood: 5, ore: 5, rare: 2 }, req: ['dw5'] },
    { id: 'dw6u', tier: 6, upg: 1, cost: { gold: 5000, wood: 10, ore: 10, rare: 5 }, req: ['dw6'] },
    { id: 'dw7u', tier: 7, upg: 1, cost: { gold: 15000, wood: 20, ore: 20, rare: 20 }, req: ['dw7', 'fort3'] }
  ];
  D.buildingById = {};
  D.BUILDINGS.forEach((b) => { D.buildingById[b.id] = b; });
  // Име и цена на сграда за конкретна фракция (заменя 'rare' с реалния ресурс)
  D.buildingFor = (faction, id) => {
    const b = D.buildingById[id];
    const f = D.factionById(faction);
    const cost = {};
    for (const k in b.cost) cost[k === 'rare' ? f.rare : k] = b.cost[k];
    let name = b.name, desc = b.desc;
    if (b.tier) {
      name = (b.upg ? f.dwellingsU : f.dwellings)[b.tier - 1];
      const c = D.creatureById[faction + b.tier + (b.upg ? 'u' : '')];
      desc = (b.upg ? 'Подобрява ' : 'Жилище на ') + c.name + (b.upg ? '' : ' (' + c.growth + ' на седмица).');
    }
    return { id, name, cost, req: b.req || [], tier: b.tier, upg: b.upg, income: b.income, desc };
  };

  // ---------------------------------------------------------------- герои
  // Класове: начални характеристики и шансове за повишение (%, на нива 2-9 / 10+)
  D.CLASSES = {
    knight: { name: 'Рицар', faction: 'kingdom', start: [2, 2, 1, 1], p1: [35, 45, 10, 10], p2: [30, 30, 20, 20], skills: ['leadership', 'offense'], magic: false },
    cleric: { name: 'Клирик', faction: 'kingdom', start: [1, 0, 2, 2], p1: [20, 15, 30, 35], p2: [20, 20, 30, 30], skills: ['wisdom', 'water'], magic: true },
    ranger: { name: 'Следотърсач', faction: 'grove', start: [1, 3, 1, 1], p1: [35, 45, 10, 10], p2: [30, 30, 20, 20], skills: ['archery', 'pathfinding'], magic: false },
    druid: { name: 'Друид', faction: 'grove', start: [0, 2, 1, 2], p1: [10, 20, 35, 35], p2: [20, 20, 30, 30], skills: ['wisdom', 'earth'], magic: true },
    deathknight: { name: 'Рицар на смъртта', faction: 'necropolis', start: [1, 2, 2, 1], p1: [30, 25, 20, 25], p2: [30, 25, 20, 25], skills: ['necromancy', 'armorer'], magic: false },
    necromancer: { name: 'Некромант', faction: 'necropolis', start: [1, 0, 2, 2], p1: [15, 15, 35, 35], p2: [25, 25, 25, 25], skills: ['necromancy', 'wisdom'], magic: true }
  };
  // Умения, които класът има шанс да получи (тежести) — извън списъка: рядко
  D.CLASS_SKILL_WEIGHTS = {
    knight: { leadership: 8, offense: 7, armorer: 6, tactics: 5, logistics: 5, archery: 4, luck: 4, estates: 4, pathfinding: 3, scouting: 3, resistance: 3, wisdom: 2, intelligence: 1, mysticism: 1, learning: 2, sorcery: 1 },
    cleric: { wisdom: 8, water: 7, air: 5, earth: 4, fire: 3, mysticism: 5, intelligence: 5, learning: 4, sorcery: 4, leadership: 4, luck: 3, logistics: 3, estates: 3, armorer: 2, scouting: 2, resistance: 3 },
    ranger: { archery: 8, pathfinding: 7, scouting: 5, logistics: 6, luck: 5, offense: 5, armorer: 4, leadership: 4, tactics: 3, resistance: 4, estates: 3, wisdom: 2, learning: 2, earth: 2, air: 1 },
    druid: { wisdom: 8, earth: 7, water: 5, air: 5, fire: 2, mysticism: 5, intelligence: 5, sorcery: 4, learning: 4, luck: 4, logistics: 3, scouting: 3, resistance: 4, estates: 2, archery: 2 },
    deathknight: { necromancy: 8, armorer: 6, offense: 5, tactics: 5, logistics: 5, earth: 4, wisdom: 3, mysticism: 3, intelligence: 3, luck: 3, pathfinding: 3, estates: 3, resistance: 3, sorcery: 2, learning: 2, archery: 2 },
    necromancer: { necromancy: 8, wisdom: 7, earth: 6, air: 4, fire: 3, water: 2, mysticism: 5, intelligence: 5, sorcery: 4, learning: 3, logistics: 3, estates: 3, armorer: 2, scouting: 2, resistance: 3 }
  };
  D.HERO_NAMES = {
    kingdom: ['Богдан', 'Радослава', 'Тервел', 'Ивайла', 'Кало̀ян', 'Десислава', 'Борил', 'Елена', 'Владимир', 'Мирена'],
    grove: ['Илиана', 'Веслан', 'Зоряна', 'Ясен', 'Дивна', 'Явор', 'Росица', 'Горан', 'Лилиана', 'Калин'],
    necropolis: ['Мрачен', 'Тъмра', 'Черномор', 'Сивана', 'Костадин', 'Нощева', 'Вражан', 'Пепелина', 'Зловест', 'Гнилана']
  };
  D.PRIMARY = ['att', 'def', 'pow', 'know'];
  D.PRIMARY_NAME = { att: 'Атака', def: 'Защита', pow: 'Сила', know: 'Познание' };

  // Опит, нужен за ниво (индекс = ниво)
  D.LEVEL_XP = [0, 0, 1000, 2000, 3200, 4600, 6200, 8000, 10000, 12200, 14700, 17500, 20600];
  (function () {
    for (let l = 13; l <= 75; l++) {
      const d = D.LEVEL_XP[l - 1] - D.LEVEL_XP[l - 2];
      D.LEVEL_XP[l] = D.LEVEL_XP[l - 1] + Math.round(d * 1.2);
    }
  })();
  D.levelForXp = (xp) => { let l = 1; while (l + 1 < D.LEVEL_XP.length && xp >= D.LEVEL_XP[l + 1]) l++; return l; };

  // ---------------------------------------------------------------- умения
  D.SKILL_LEVEL_NAME = ['', 'Основно', 'Напреднало', 'Експертно'];
  D.SKILLS = {
    logistics: { name: 'Логистика', desc: (l) => '+' + [10, 20, 30][l - 1] + '% точки за движение по суша.' },
    pathfinding: { name: 'Пътеводство', desc: (l) => 'Наказанието на трудния терен намалява с ' + [25, 50, 100][l - 1] + '%.' },
    scouting: { name: 'Разузнаване', desc: (l) => '+' + l + ' радиус на видимост.' },
    offense: { name: 'Нападение', desc: (l) => '+' + [10, 20, 30][l - 1] + '% щети в близък бой.' },
    archery: { name: 'Стрелба', desc: (l) => '+' + [10, 25, 50][l - 1] + '% щети от стрелба.' },
    armorer: { name: 'Бронник', desc: (l) => 'Понесените щети намаляват с ' + [5, 10, 15][l - 1] + '%.' },
    leadership: { name: 'Водачество', desc: (l) => '+' + l + ' морал.' },
    luck: { name: 'Късмет', desc: (l) => '+' + l + ' късмет.' },
    wisdom: { name: 'Мъдрост', desc: (l) => 'Позволява учене на магии от ' + (l + 2) + '-о ниво.' },
    mysticism: { name: 'Мистицизъм', desc: (l) => '+' + [2, 3, 4][l - 1] + ' мана на ден.' },
    intelligence: { name: 'Интелект', desc: (l) => '+' + [25, 50, 100][l - 1] + '% максимална мана.' },
    estates: { name: 'Имоти', desc: (l) => '+' + [125, 250, 500][l - 1] + ' злато на ден.' },
    necromancy: { name: 'Некромантия', desc: (l) => [10, 20, 30][l - 1] + '% от убитите врагове се вдигат като скелети.' },
    tactics: { name: 'Тактика', desc: (l) => 'Армията ти започва битката с ' + l + ' хекса напред.' },
    resistance: { name: 'Съпротива', desc: (l) => [5, 10, 20][l - 1] + '% шанс вражеска магия да не подейства.' },
    sorcery: { name: 'Чародейство', desc: (l) => '+' + [5, 10, 15][l - 1] + '% щети от магии.' },
    learning: { name: 'Ученолюбие', desc: (l) => '+' + [5, 10, 15][l - 1] + '% опит.' },
    air: { name: 'Магия на въздуха', desc: (l) => 'Магиите на въздуха стават ' + D.SKILL_LEVEL_NAME[l].toLowerCase() + ' силни.' },
    fire: { name: 'Магия на огъня', desc: (l) => 'Магиите на огъня стават ' + D.SKILL_LEVEL_NAME[l].toLowerCase() + ' силни.' },
    water: { name: 'Магия на водата', desc: (l) => 'Магиите на водата стават ' + D.SKILL_LEVEL_NAME[l].toLowerCase() + ' силни.' },
    earth: { name: 'Магия на земята', desc: (l) => 'Магиите на земята стават ' + D.SKILL_LEVEL_NAME[l].toLowerCase() + ' силни.' }
  };
  D.SCHOOLS = ['air', 'fire', 'water', 'earth'];
  D.SCHOOL_NAME = { air: 'Въздух', fire: 'Огън', water: 'Вода', earth: 'Земя', all: 'Всички' };

  // ---------------------------------------------------------------- магии
  // kind: dmg (единична), area (около хекс), all (всички врагове/съюзници), buff, debuff, heal, res, special
  // val: [основно, напреднало, експертно] — щети/ефект; mass: true при експертно става масова
  const S = [];
  function sp(id, name, school, level, cost, kind, extra) {
    S.push(Object.assign({ id, name, school, level, cost, kind }, extra));
  }
  // Ниво 1
  sp('magic_arrow', 'Магическа стрела', 'all', 1, 5, 'dmg', { base: 10, perPow: 10, target: 'enemy', desc: 'Стрела от чиста магия. Щети 10 + 10×Сила.' });
  sp('haste', 'Ускорение', 'air', 1, 6, 'buff', { effect: 'haste', val: [3, 5, 5], mass: true, dur: 'pow', desc: 'Скорост +3 (+5 при напреднало). Експертно: масово.' });
  sp('slow', 'Забавяне', 'earth', 1, 6, 'debuff', { effect: 'slow', val: [25, 50, 50], mass: true, desc: 'Скорост −25% (−50%). Експертно: масово.' });
  sp('bless', 'Благослов', 'water', 1, 5, 'buff', { effect: 'bless', val: [0, 1, 1], mass: true, desc: 'Съществата нанасят максимални щети. Експертно: масово.' });
  sp('curse', 'Проклятие', 'fire', 1, 6, 'debuff', { effect: 'curse', val: [0, 1, 1], mass: true, desc: 'Съществата нанасят минимални щети. Експертно: масово.' });
  sp('shield', 'Щит', 'earth', 1, 5, 'buff', { effect: 'shield', val: [15, 30, 30], mass: true, desc: 'Щетите от близък бой намаляват с 15% (30%).' });
  sp('stone_skin', 'Каменна кожа', 'earth', 1, 5, 'buff', { effect: 'stoneskin', val: [3, 6, 6], mass: true, desc: 'Защита +3 (+6). Експертно: масово.' });
  sp('bloodlust', 'Кръвожадност', 'fire', 1, 5, 'buff', { effect: 'bloodlust', val: [3, 6, 6], mass: true, desc: 'Атака +3 (+6) в близък бой. Експертно: масово.' });
  sp('cure', 'Лечение', 'water', 1, 6, 'heal', { base: 10, perPow: 5, mass: true, dispelNeg: true, desc: 'Лекува 10 + 5×Сила точки и маха проклятията. Експертно: масово.' });
  sp('dispel', 'Разсейване', 'water', 1, 5, 'special', { effect: 'dispel', desc: 'Премахва всички магии от целта. Напреднало: и от врагове; експертно: от всички.' });
  // Ниво 2
  sp('lightning', 'Мълния', 'air', 2, 10, 'dmg', { base: 10, perPow: 25, target: 'enemy', desc: 'Щети 10 + 25×Сила.' });
  sp('ice_bolt', 'Ледена стрела', 'water', 2, 8, 'dmg', { base: 10, perPow: 20, target: 'enemy', desc: 'Щети 10 + 20×Сила.' });
  sp('death_ripple', 'Вълна на смъртта', 'earth', 2, 10, 'all', { base: 10, perPow: 5, onlyLiving: true, desc: 'Щети 10 + 5×Сила на всички живи същества на полето.' });
  sp('blind', 'Ослепяване', 'fire', 2, 10, 'debuff', { effect: 'blind', val: [1, 1, 1], desc: 'Целта не може да действа, докато не бъде ударена.' });
  sp('weakness', 'Слабост', 'water', 2, 8, 'debuff', { effect: 'weakness', val: [3, 6, 6], mass: true, desc: 'Атака −3 (−6). Експертно: масово.' });
  sp('precision', 'Точност', 'air', 2, 8, 'buff', { effect: 'precision', val: [3, 6, 6], mass: true, desc: 'Атака +3 (+6) при стрелба. Експертно: масово.' });
  sp('fortune', 'Щастие', 'air', 2, 7, 'buff', { effect: 'fortune', val: [1, 2, 2], mass: true, desc: 'Късмет +1 (+2). Експертно: масово.' });
  sp('disrupting_ray', 'Разрушителен лъч', 'air', 2, 10, 'debuff', { effect: 'disrupt', val: [3, 4, 5], permanent: true, stack: true, desc: 'Защита −3/−4/−5 до края на битката. Натрупва се.' });
  // Ниво 3
  sp('fireball', 'Огнено кълбо', 'fire', 3, 15, 'area', { base: 15, perPow: 10, radius: 1, desc: 'Щети 15 + 10×Сила на целта и съседните хексове.' });
  sp('frost_ring', 'Леден пръстен', 'water', 3, 12, 'area', { base: 15, perPow: 10, radius: 1, ring: true, desc: 'Щети 15 + 10×Сила по хексовете около целта (не и на нея).' });
  sp('air_shield', 'Въздушен щит', 'air', 3, 12, 'buff', { effect: 'airshield', val: [25, 50, 50], mass: true, desc: 'Щетите от стрелба намаляват с 25% (50%).' });
  sp('animate_dead', 'Вдигане на мъртви', 'earth', 3, 15, 'res', { base: 30, perPow: 50, onlyUndead: true, desc: 'Връща 30 + 50×Сила точки живот на немъртви.' });
  sp('mirth', 'Веселие', 'water', 3, 12, 'buff', { effect: 'mirth', val: [1, 2, 2], mass: true, desc: 'Морал +1 (+2). Експертно: масово.' });
  sp('misfortune', 'Нещастие', 'fire', 3, 12, 'debuff', { effect: 'misfortune', val: [1, 2, 2], mass: true, desc: 'Късмет −1 (−2). Експертно: масово.' });
  sp('destroy_undead', 'Изгаряне на немъртви', 'air', 3, 15, 'all', { base: 10, perPow: 10, onlyUndead: true, desc: 'Щети 10 + 10×Сила на всички немъртви на полето.' });
  sp('anti_magic', 'Антимагия', 'earth', 3, 15, 'buff', { effect: 'antimagic', val: [3, 4, 5], desc: 'Целта е неуязвима за магии до ' + '3/4/5' + '-о ниво.' });
  // Ниво 4
  sp('chain_lightning', 'Верижна мълния', 'air', 4, 24, 'chain', { base: 25, perPow: 40, hits: [4, 4, 5], desc: 'Щети 25 + 40×Сила, после скача по най-близките, като всеки път се разполовява.' });
  sp('meteor_shower', 'Метеорен дъжд', 'earth', 4, 16, 'area', { base: 25, perPow: 10, radius: 1, desc: 'Щети 25 + 10×Сила на целта и съседните хексове.' });
  sp('inferno', 'Инферно', 'fire', 4, 16, 'area', { base: 20, perPow: 10, radius: 2, desc: 'Щети 20 + 10×Сила в голяма област.' });
  sp('resurrection', 'Възкресение', 'earth', 4, 20, 'res', { base: 40, perPow: 50, onlyLiving: true, desc: 'Връща 40 + 50×Сила точки живот на живи същества.' });
  sp('prayer', 'Молитва', 'water', 4, 16, 'buff', { effect: 'prayer', val: [2, 4, 4], mass: true, desc: 'Атака, защита и скорост +2 (+4). Експертно: масово.' });
  sp('slayer', 'Драконоубиец', 'fire', 4, 16, 'buff', { effect: 'slayer', val: [8, 8, 8], desc: 'Атака +8 срещу същества от 7-о ниво.' });
  sp('sorrow', 'Скръб', 'earth', 4, 16, 'debuff', { effect: 'sorrow', val: [1, 2, 2], mass: true, desc: 'Морал −1 (−2). Експертно: масово.' });
  sp('counterstrike', 'Контраудар', 'air', 4, 24, 'buff', { effect: 'counterstrike', val: [1, 2, 3], desc: 'Целта отвръща на 1/2/3 удара повече на рунд.' });
  // Ниво 5
  sp('implosion', 'Имплозия', 'earth', 5, 30, 'dmg', { base: 100, perPow: 75, target: 'enemy', desc: 'Щети 100 + 75×Сила на едно същество.' });
  sp('armageddon', 'Армагедон', 'fire', 5, 24, 'all', { base: 30, perPow: 50, both: true, desc: 'Щети 30 + 50×Сила на всички същества на полето.' });
  D.SPELLS = S;
  D.spellById = {};
  S.forEach((s) => { D.spellById[s.id] = s; });
  D.GUILD_SLOTS = [0, 5, 4, 3, 2, 1];

  // ---------------------------------------------------------------- артефакти
  // slot: head, neck, shoulders, weapon, shield, torso, ring, feet, misc
  const A = [];
  function art(id, name, slot, cls, bonus, desc) { A.push({ id, name, slot, cls, bonus, desc }); }
  art('sword_dawn', 'Меч на зората', 'weapon', 1, { att: 2 }, 'Атака +2.');
  art('sword_hurricane', 'Меч на бурята', 'weapon', 2, { att: 4 }, 'Атака +4.');
  art('axe_titan', 'Секира на титана', 'weapon', 3, { att: 6 }, 'Атака +6.');
  art('shield_oak', 'Дъбов щит', 'shield', 1, { def: 2 }, 'Защита +2.');
  art('shield_lion', 'Лъвски щит', 'shield', 2, { def: 4 }, 'Защита +4.');
  art('shield_dragon', 'Драконов щит', 'shield', 3, { def: 6 }, 'Защита +6.');
  art('helm_scout', 'Шлем на разузнавача', 'head', 1, { know: 1, scouting: 1 }, 'Познание +1, видимост +1.');
  art('helm_sage', 'Шлем на мъдреца', 'head', 2, { know: 3 }, 'Познание +3.');
  art('crown_kings', 'Кралска корона', 'head', 3, { att: 1, def: 1, pow: 1, know: 1, morale: 1 }, 'Всички характеристики +1, морал +1.');
  art('armor_leather', 'Кожена броня', 'torso', 1, { def: 1, att: 1 }, 'Атака и защита +1.');
  art('armor_plate', 'Ризница на пазителя', 'torso', 2, { def: 3, pow: 1 }, 'Защита +3, сила +1.');
  art('armor_stars', 'Броня на звездите', 'torso', 3, { def: 5, pow: 3 }, 'Защита +5, сила +3.');
  art('cape_wind', 'Плащ на вятъра', 'shoulders', 1, { pow: 1, moveBonus: 200 }, 'Сила +1, движение +200.');
  art('cape_ash', 'Пепелен плащ', 'shoulders', 2, { pow: 3 }, 'Сила +3.');
  art('amulet_focus', 'Амулет на съсредоточението', 'neck', 1, { pow: 1, know: 1 }, 'Сила и познание +1.');
  art('amulet_courage', 'Амулет на смелостта', 'neck', 2, { morale: 2 }, 'Морал +2.');
  art('ring_luck', 'Пръстен на щастието', 'ring', 1, { luck: 1 }, 'Късмет +1.');
  art('ring_life', 'Пръстен на живота', 'ring', 2, { hpBonus: 1 }, '+1 живот на всички същества.');
  art('ring_mana', 'Пръстен на потока', 'ring', 2, { manaRegen: 2 }, '+2 мана на ден.');
  art('boots_speed', 'Ботуши на бързината', 'feet', 2, { moveBonus: 600 }, 'Движение +600.');
  art('boots_path', 'Ботуши на пътника', 'feet', 1, { moveBonus: 300 }, 'Движение +300.');
  art('boots_iron', 'Железни ботуши', 'feet', 1, { def: 2 }, 'Защита +2.');
  art('orb_fire', 'Кълбо на пламъка', 'misc', 3, { spellDmg: 50, school: 'fire' }, 'Огнените магии нанасят +50% щети.');
  art('orb_storm', 'Кълбо на гръмотевицата', 'misc', 3, { spellDmg: 50, school: 'air' }, 'Въздушните магии нанасят +50% щети.');
  art('book_wisdom', 'Книга на познанието', 'misc', 2, { know: 2 }, 'Познание +2.');
  art('horn_rally', 'Рог на сбора', 'misc', 2, { morale: 1, luck: 1 }, 'Морал и късмет +1.');
  art('bag_gold', 'Кесия без дъно', 'misc', 2, { goldIncome: 500 }, '+500 злато на ден.');
  art('badge_courage', 'Знак за храброст', 'misc', 1, { morale: 1 }, 'Морал +1.');
  art('clover', 'Четирилистна детелина', 'misc', 1, { luck: 1 }, 'Късмет +1.');
  art('talisman_mana', 'Талисман на маната', 'misc', 1, { manaRegen: 1 }, '+1 мана на ден.');
  D.ARTIFACTS = A;
  D.artById = {};
  A.forEach((a) => { D.artById[a.id] = a; });
  D.SLOTS = ['head', 'neck', 'shoulders', 'weapon', 'shield', 'torso', 'ring', 'ring', 'feet', 'misc', 'misc', 'misc', 'misc'];
  D.SLOT_NAME = { head: 'Глава', neck: 'Шия', shoulders: 'Рамене', weapon: 'Оръжие', shield: 'Щит', torso: 'Тяло', ring: 'Пръстен', feet: 'Крака', misc: 'Разни' };
  D.ART_CLASS_NAME = ['', 'Съкровище', 'Ценен', 'Реликва'];

  // ---------------------------------------------------------------- обекти по картата
  // Типове (type) и параметри. Взаимодействието е в world.js.
  D.MINES = [
    { res: 'gold', name: 'Златна мина', amount: 1000 },
    { res: 'wood', name: 'Дърводелница', amount: 2 },
    { res: 'ore', name: 'Рудник', amount: 2 },
    { res: 'mercury', name: 'Алхимична лаборатория', amount: 1 },
    { res: 'sulfur', name: 'Серна яма', amount: 1 },
    { res: 'crystal', name: 'Кристална пещера', amount: 1 },
    { res: 'gems', name: 'Находище на камъни', amount: 1 }
  ];
  D.OBJECTS = {
    town: { name: 'Град' },
    mine: { name: 'Мина' },
    resource: { name: 'Ресурси' },
    chest: { name: 'Сандък със съкровище' },
    artifact: { name: 'Артефакт' },
    monster: { name: 'Същества' },
    dwelling: { name: 'Жилище' },
    windmill: { name: 'Вятърна мелница', desc: 'Всяка седмица дава рядък ресурс.' },
    watermill: { name: 'Водна мелница', desc: 'Всяка седмица дава злато.' },
    learning: { name: 'Камък на познанието', desc: '+1000 опит, веднъж за герой.' },
    rally: { name: 'Знаме на сбора', desc: '+1 морал и +1 късмет за следващата битка.' },
    mercenary: { name: 'Лагер на наемниците', desc: '+1 атака, веднъж за герой.' },
    tower_def: { name: 'Кула на стража', desc: '+1 защита, веднъж за герой.' },
    star_axis: { name: 'Звездна ос', desc: '+1 сила, веднъж за герой.' },
    garden: { name: 'Градина на прозрението', desc: '+1 познание, веднъж за герой.' },
    campfire: { name: 'Лагерен огън', desc: 'Злато и ресурси.' },
    shrine1: { name: 'Светилище на шепота', desc: 'Учи магия от 1-во ниво.' },
    shrine2: { name: 'Светилище на словото', desc: 'Учи магия от 2-ро ниво.' },
    shrine3: { name: 'Светилище на мисълта', desc: 'Учи магия от 3-то ниво (нужна Мъдрост).' },
    tree_knowledge: { name: 'Дърво на познанието', desc: 'Ниво нагоре срещу 2000 злато или 10 камъка.' },
    magic_well: { name: 'Магически кладенец', desc: 'Възстановява маната.' },
    wagon: { name: 'Изоставена каруца', desc: 'Артефакт или ресурси.' },
    fountain: { name: 'Извор на щастието', desc: '+1 късмет за следващата битка.' },
    idol: { name: 'Идол на духа', desc: '+1 морал за следващата битка (+1 късмет в неделя).' },
    obelisk: { name: 'Обелиск', desc: 'Древен камък. Носи 250 опит първия път.' },
    stables: { name: 'Конюшни', desc: '+400 движение до края на седмицата.' },
    sanctuary: { name: 'Убежище', desc: 'Тук героят не може да бъде нападнат.' },
    school_war: { name: 'Школа на войната', desc: '+1 атака или защита срещу 1000 злато.' },
    school_magic: { name: 'Школа на магията', desc: '+1 сила или познание срещу 1000 злато.' },
    library: { name: 'Библиотека', desc: 'Учи всички магии от 1-во ниво срещу 500 злато.' },
    dragon_utopia: { name: 'Драконова утопия', desc: 'Леговище на дракони. Победи ги и вземи съкровището им: злато и ценни артефакти.' },
    monolith: { name: 'Монолит', desc: 'Пренася героя до другия монолит.' }
  };
  D.DECOR = { tree: 'Гора', mountain: 'Планина', rock: 'Скали', lake: 'Езеро', dead_tree: 'Мъртва гора' };

  // ---------------------------------------------------------------- трудност
  D.DIFFICULTY = [
    { id: 0, name: 'Лесно', start: { gold: 30000, wood: 30, ore: 30, mercury: 15, sulfur: 15, crystal: 15, gems: 15 }, ai: { gold: 15000, wood: 15, ore: 15, mercury: 7, sulfur: 7, crystal: 7, gems: 7 }, aiBonus: 0.8 },
    { id: 1, name: 'Нормално', start: { gold: 20000, wood: 20, ore: 20, mercury: 10, sulfur: 10, crystal: 10, gems: 10 }, ai: { gold: 20000, wood: 20, ore: 20, mercury: 10, sulfur: 10, crystal: 10, gems: 10 }, aiBonus: 1 },
    { id: 2, name: 'Трудно', start: { gold: 15000, wood: 15, ore: 15, mercury: 7, sulfur: 7, crystal: 7, gems: 7 }, ai: { gold: 25000, wood: 25, ore: 25, mercury: 12, sulfur: 12, crystal: 12, gems: 12 }, aiBonus: 1.15 },
    { id: 3, name: 'Експертно', start: { gold: 10000, wood: 10, ore: 10, mercury: 4, sulfur: 4, crystal: 4, gems: 4 }, ai: { gold: 30000, wood: 30, ore: 30, mercury: 15, sulfur: 15, crystal: 15, gems: 15 }, aiBonus: 1.3 },
    { id: 4, name: 'Невъзможно', start: { gold: 0, wood: 0, ore: 0, mercury: 0, sulfur: 0, crystal: 0, gems: 0 }, ai: { gold: 35000, wood: 35, ore: 35, mercury: 20, sulfur: 20, crystal: 20, gems: 20 }, aiBonus: 1.5 }
  ];
  D.MAP_SIZES = [
    { id: 's', name: 'Малка', size: 36 },
    { id: 'm', name: 'Средна', size: 54 },
    { id: 'l', name: 'Голяма', size: 72 }
  ];
  D.PLAYER_COLORS = [
    { name: 'Червен', col: '#d23c3c' },
    { name: 'Син', col: '#3c6cd2' },
    { name: 'Зелен', col: '#3ca84c' },
    { name: 'Оранжев', col: '#e08a2c' }
  ];
  D.DAY_NAMES = ['понеделник', 'вторник', 'сряда', 'четвъртък', 'петък', 'събота', 'неделя'];

  // Точки за движение по най-бавното същество (класическата таблица)
  D.baseMovement = (minSpeed) => {
    if (minSpeed <= 3) return 1500;
    return [0, 0, 0, 0, 1560, 1630, 1700, 1760, 1830, 1900, 1960, 2000][Math.min(minSpeed, 11)];
  };
})();
