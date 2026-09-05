/* Фаза 2/3 данни: още 8 фракции (6 по класическите аналози + 2 по модела на HotA),
   нови терени, способности, артефакти и комплекти, специалности на героите, шаблони за карти. */
(function () {
  'use strict';
  const MK = (window.MK = window.MK || {});
  const D = MK.data;

  // ---------------------------------------------------------------- нови терени
  D.TERRAIN.push(
    { id: 8, key: 'subterranean', name: 'Подземие', cost: 100, passable: true, col: '#6a5a58', col2: '#605250' },
    { id: 9, key: 'wasteland', name: 'Пустиня', cost: 125, passable: true, col: '#8a7a8a', col2: '#7f7080' }
  );

  // ---------------------------------------------------------------- фракции
  const F = [
    { id: 'academy', name: 'Академия', adj: 'академски', terrain: 4, color: '#9fc8f0', rare: 'gems', classes: ['alchemist', 'wizard'],
      desc: 'Гремлини, големи, магове и титани — град на знанието с мощна стрелба и магия.',
      dwellings: ['Работилница', 'Скален парапет', 'Фабрика за големи', 'Кула на маговете', 'Олтар на желанията', 'Златен павилион', 'Облачен храм'],
      dwellingsU: ['Майсторска работилница', 'Обсидианов парапет', 'Железна фабрика', 'Кула на архимаговете', 'Олтар на великите желания', 'Кралски павилион', 'Храм на титаните'] },
    { id: 'inferno', name: 'Пъкъл', adj: 'пъклен', terrain: 7, color: '#e0603a', rare: 'mercury', classes: ['demoniac', 'heretic'],
      desc: 'Дяволчета, хрътки, ифрити и дяволи — огън, бързина и удари без ответ.',
      dwellings: ['Яма на дяволчетата', 'Зала на греха', 'Кучкарник', 'Порта на демоните', 'Огнено езеро', 'Огнен дворец', 'Разкъсано небе'],
      dwellingsU: ['Дълбока яма', 'Кула на греха', 'Кучкарник на цербера', 'Порта на рогатите', 'Езеро на владетелите', 'Дворец на султаните', 'Пъклена порта'] },
    { id: 'dungeon', name: 'Подземие', adj: 'подземен', terrain: 8, color: '#7a5a9a', rare: 'sulfur', classes: ['overlord', 'warlock'],
      desc: 'Троглодити, харпии, медузи, минотаври и черни дракони — тъмна сила и зли очи.',
      dwellings: ['Пещера на троглодитите', 'Гнездо на харпиите', 'Стълб на очите', 'Медузински покои', 'Лабиринт', 'Логовище на мантикорите', 'Драконова пещера'],
      dwellingsU: ['Пъклена пещера', 'Гнездо на вещиците', 'Стълб на злото око', 'Кралски покои', 'Кралски лабиринт', 'Логовище на скорпикорите', 'Черна пещера'] },
    { id: 'horde', name: 'Орда', adj: 'ордински', terrain: 6, color: '#c08a3a', rare: 'crystal', classes: ['barbarian', 'battlemage'],
      desc: 'Гоблини, вълчи ездачи, орки, огъри, циклопи и бегемоти — груба сила и висока атака.',
      dwellings: ['Гоблинска казарма', 'Вълча яма', 'Оркска кула', 'Форт на огърите', 'Скали', 'Пещера на циклопите', 'Лагуна на бегемотите'],
      dwellingsU: ['Хобгоблинска казарма', 'Вълчи форт', 'Кула на вожда', 'Форт на маговете огъри', 'Гръмовни скали', 'Пещера на кралете', 'Древна лагуна'] },
    { id: 'marsh', name: 'Тресавище', adj: 'блатен', terrain: 5, color: '#5a8a5a', rare: 'sulfur', classes: ['beastmaster', 'witch'],
      desc: 'Гноли, гущери, базилиски, горгони, виверни и хидри — здрава защита и отрова.',
      dwellings: ['Гнолска хижа', 'Гущерско гнездо', 'Кошер на мухите', 'Яма на базилиските', 'Горгонско пасище', 'Виверново гнездо', 'Езеро на хидрите'],
      dwellingsU: ['Мародерска хижа', 'Гнездо на войните', 'Кошер на драконовите мухи', 'Яма на великите базилиски', 'Могъщо пасище', 'Гнездо на монарха', 'Езеро на хаоса'] },
    { id: 'elements', name: 'Стихии', adj: 'стихиен', terrain: 1, color: '#d8c0ff', rare: 'mercury', classes: ['planeswalker', 'elementalist'],
      desc: 'Пикси, елементали и феникси — чиста магия, скорост и имунитети.',
      dwellings: ['Магическа решетка', 'Олтар на въздуха', 'Олтар на водата', 'Олтар на огъня', 'Олтар на земята', 'Олтар на мисълта', 'Пирамида'],
      dwellingsU: ['Решетка на феите', 'Олтар на бурята', 'Олтар на леда', 'Олтар на енергията', 'Олтар на магмата', 'Олтар на магията', 'Пирамида на феникса'] },
    // Двете фракции по модела на Horn of the Abyss
    { id: 'harbor', name: 'Пристан', adj: 'пристанищен', terrain: 3, color: '#3a9ab0', rare: 'gems', classes: ['captain', 'navigator'],
      desc: 'Нимфи, моряци, пирати, морски вещици и морски змейове — господари на брега и корабите.',
      dwellings: ['Извор на нимфите', 'Кръчма на моряците', 'Пиратско пристанище', 'Скали на буревестниците', 'Кула на вещиците', 'Пещера на никсите', 'Бездна на змейовете'],
      dwellingsU: ['Извор на океанидите', 'Каюта на боцманите', 'Корсарско пристанище', 'Скали на соколите', 'Кула на чародейките', 'Пещера на войните', 'Бездна на хаспидите'] },
    { id: 'workshop', name: 'Работилница', adj: 'механичен', terrain: 9, color: '#b09060', rare: 'crystal', classes: ['mercenary', 'artificer'],
      desc: 'Дребосъци, механици, броненосци, автомати, червеи, стрелци и куатли — машини и барут в пустошта.',
      dwellings: ['Дупка на дребосъците', 'Работилница', 'Яма на броненосците', 'Монтажна зала', 'Пясъчна яма', 'Салон', 'Небесен пристан'],
      dwellingsU: ['Гренадирска дупка', 'Инженерна работилница', 'Бойна яма', 'Зала на стражарите', 'Дълбока пясъчна яма', 'Ловджийски салон', 'Пурпурен пристан'] }
  ];
  F.forEach((f) => D.FACTIONS.push(f));

  // ---------------------------------------------------------------- същества
  // extra.wide = 1 → двухексово; нови способности: ignoreDef, ignoreAtt, deathStare, fireImmune,
  //   mindImmune, rebirth, spellImmune: 5 = пълен имунитет, magicShot (стрелба с огнено кълбо)
  const C = D.CREATURES;
  function cr(faction, tier, upg, name, fam, att, def, dmin, dmax, hp, spd, gold, growth, extra) {
    extra = extra || {};
    const c = Object.assign({ id: faction + tier + (upg ? 'u' : ''), faction, tier, upg, name, fam, att, def, dmin, dmax, hp, spd, cost: { gold }, growth, shots: 0, abilities: {} }, extra);
    if (extra.rare) { c.cost[D.factionById(faction).rare] = extra.rare; delete c.rare; }
    C.push(c); D.creatureById[c.id] = c;
  }
  // Академия
  cr('academy', 1, 0, 'Гремлин', 'infantry', 3, 3, 1, 2, 4, 4, 30, 16);
  cr('academy', 1, 1, 'Майстор гремлин', 'archer', 4, 4, 1, 2, 4, 5, 40, 16, { shots: 8, abilities: { shooter: 1 } });
  cr('academy', 2, 0, 'Гаргойл', 'flyer', 6, 6, 2, 3, 16, 6, 130, 9, { abilities: { flying: 1, mindImmune: 1 } });
  cr('academy', 2, 1, 'Обсидианов гаргойл', 'flyer', 7, 7, 2, 3, 16, 9, 160, 9, { abilities: { flying: 1, mindImmune: 1 } });
  cr('academy', 3, 0, 'Каменен голем', 'giant', 7, 10, 4, 5, 30, 3, 150, 6, { abilities: { magicRes: 50, mindImmune: 1 } });
  cr('academy', 3, 1, 'Железен голем', 'giant', 9, 10, 4, 5, 35, 5, 200, 6, { abilities: { magicRes: 75, mindImmune: 1 } });
  cr('academy', 4, 0, 'Маг', 'mage', 11, 8, 7, 9, 25, 5, 350, 4, { shots: 24, abilities: { shooter: 1, noMeleePenalty: 1 } });
  cr('academy', 4, 1, 'Архимаг', 'mage', 12, 9, 7, 9, 30, 7, 450, 4, { shots: 24, abilities: { shooter: 1, noMeleePenalty: 1, noObstaclePenalty: 1 } });
  cr('academy', 5, 0, 'Джин', 'spirit', 12, 12, 13, 16, 40, 7, 550, 3, { abilities: { flying: 1 } });
  cr('academy', 5, 1, 'Велик джин', 'spirit', 12, 12, 13, 16, 40, 11, 600, 3, { abilities: { flying: 1 } });
  cr('academy', 6, 0, 'Нага', 'beast', 16, 13, 20, 20, 110, 5, 1100, 2, { wide: 1, abilities: { noRetaliation: 1 } });
  cr('academy', 6, 1, 'Кралица нага', 'beast', 16, 13, 30, 30, 110, 7, 1600, 2, { wide: 1, abilities: { noRetaliation: 1 } });
  cr('academy', 7, 0, 'Гигант', 'giant', 19, 16, 40, 60, 150, 7, 2000, 1, { rare: 1, abilities: { mindImmune: 1 } });
  cr('academy', 7, 1, 'Титан', 'giant', 24, 24, 40, 60, 300, 11, 5000, 1, { rare: 2, shots: 24, abilities: { shooter: 1, noMeleePenalty: 1, mindImmune: 1 } });
  // Пъкъл
  cr('inferno', 1, 0, 'Дяволче', 'spirit', 2, 3, 1, 2, 4, 5, 50, 15);
  cr('inferno', 1, 1, 'Дребен бяс', 'spirit', 4, 4, 1, 2, 4, 7, 60, 15, { abilities: { manaDrain: 1 } });
  cr('inferno', 2, 0, 'Гог', 'archer', 6, 4, 2, 4, 13, 4, 125, 8, { shots: 12, abilities: { shooter: 1 } });
  cr('inferno', 2, 1, 'Магог', 'archer', 7, 4, 2, 4, 13, 6, 175, 8, { shots: 24, abilities: { shooter: 1, deathCloud: 1 } });
  cr('inferno', 3, 0, 'Адска хрътка', 'beast', 10, 6, 2, 7, 25, 7, 200, 5, { wide: 1 });
  cr('inferno', 3, 1, 'Цербер', 'beast', 10, 8, 2, 7, 25, 8, 250, 5, { wide: 1, abilities: { allAround: 1, noRetaliation: 1 } });
  cr('inferno', 4, 0, 'Демон', 'giant', 10, 10, 7, 9, 35, 5, 250, 4);
  cr('inferno', 4, 1, 'Рогат демон', 'giant', 10, 10, 7, 9, 40, 6, 270, 4);
  cr('inferno', 5, 0, 'Изчадие', 'giant', 13, 13, 13, 17, 45, 6, 500, 3);
  cr('inferno', 5, 1, 'Владетел на ямата', 'giant', 13, 13, 13, 17, 45, 7, 700, 3);
  cr('inferno', 6, 0, 'Ифрит', 'spirit', 16, 12, 16, 24, 90, 9, 900, 2, { abilities: { flying: 1, fireImmune: 1 } });
  cr('inferno', 6, 1, 'Султан ифрит', 'spirit', 16, 14, 16, 24, 90, 13, 1100, 2, { abilities: { flying: 1, fireImmune: 1, fireShield: 20 } });
  cr('inferno', 7, 0, 'Дявол', 'angel', 19, 21, 30, 40, 160, 11, 2700, 1, { rare: 1, abilities: { flying: 1, noRetaliation: 1, badLuckAura: 1 } });
  cr('inferno', 7, 1, 'Архидявол', 'angel', 26, 28, 30, 40, 200, 17, 4500, 1, { rare: 2, abilities: { flying: 1, noRetaliation: 1, badLuckAura: 1 } });
  // Подземие
  cr('dungeon', 1, 0, 'Троглодит', 'infantry', 4, 3, 1, 3, 5, 4, 50, 14, { abilities: { blindImmune: 1 } });
  cr('dungeon', 1, 1, 'Пъклен троглодит', 'infantry', 5, 4, 1, 3, 6, 5, 65, 14, { abilities: { blindImmune: 1 } });
  cr('dungeon', 2, 0, 'Харпия', 'flyer', 6, 5, 1, 4, 14, 6, 130, 8, { abilities: { flying: 1 } });
  cr('dungeon', 2, 1, 'Харпия вещица', 'flyer', 6, 6, 1, 4, 14, 9, 170, 8, { abilities: { flying: 1, noRetaliation: 1 } });
  cr('dungeon', 3, 0, 'Наблюдател', 'spirit', 9, 7, 3, 5, 22, 5, 250, 7, { shots: 12, abilities: { shooter: 1, noMeleePenalty: 1 } });
  cr('dungeon', 3, 1, 'Зло око', 'spirit', 10, 8, 3, 5, 22, 7, 280, 7, { shots: 24, abilities: { shooter: 1, noMeleePenalty: 1 } });
  cr('dungeon', 4, 0, 'Медуза', 'mage', 9, 9, 6, 8, 25, 5, 300, 4, { wide: 1, shots: 4, abilities: { shooter: 1, noMeleePenalty: 1, blindHit: 20 } });
  cr('dungeon', 4, 1, 'Кралица медуза', 'mage', 10, 10, 6, 8, 30, 6, 330, 4, { wide: 1, shots: 8, abilities: { shooter: 1, noMeleePenalty: 1, blindHit: 20 } });
  cr('dungeon', 5, 0, 'Минотавър', 'giant', 14, 12, 12, 20, 50, 6, 500, 3, { abilities: { goodMorale: 1 } });
  cr('dungeon', 5, 1, 'Минотавър крал', 'giant', 15, 15, 12, 20, 50, 8, 575, 3, { abilities: { goodMorale: 1 } });
  cr('dungeon', 6, 0, 'Мантикора', 'dragon', 15, 13, 14, 20, 80, 7, 850, 2, { wide: 1, abilities: { flying: 1 } });
  cr('dungeon', 6, 1, 'Скорпикора', 'dragon', 16, 14, 14, 20, 80, 11, 1050, 2, { wide: 1, abilities: { flying: 1, blindHit: 20 } });
  cr('dungeon', 7, 0, 'Червен дракон', 'dragon', 19, 19, 40, 50, 180, 11, 2500, 1, { rare: 1, wide: 1, abilities: { flying: 1, breath: 1, spellImmune: 3 } });
  cr('dungeon', 7, 1, 'Черен дракон', 'dragon', 25, 25, 40, 50, 300, 15, 4000, 1, { rare: 2, wide: 1, abilities: { flying: 1, breath: 1, spellImmune: 5 } });
  // Орда
  cr('horde', 1, 0, 'Гоблин', 'infantry', 4, 2, 1, 2, 5, 5, 40, 15);
  cr('horde', 1, 1, 'Хобгоблин', 'infantry', 5, 3, 1, 2, 5, 7, 50, 15);
  cr('horde', 2, 0, 'Вълчи ездач', 'rider', 7, 5, 2, 4, 10, 6, 100, 9, { wide: 1 });
  cr('horde', 2, 1, 'Вълчи нападател', 'rider', 8, 5, 3, 4, 10, 8, 140, 9, { wide: 1, abilities: { doubleAttack: 1 } });
  cr('horde', 3, 0, 'Орк', 'archer', 8, 4, 2, 5, 15, 4, 150, 7, { shots: 12, abilities: { shooter: 1 } });
  cr('horde', 3, 1, 'Оркски вожд', 'archer', 8, 4, 2, 5, 20, 5, 165, 7, { shots: 24, abilities: { shooter: 1 } });
  cr('horde', 4, 0, 'Огър', 'giant', 13, 7, 6, 12, 40, 4, 300, 4);
  cr('horde', 4, 1, 'Огър маг', 'giant', 13, 7, 6, 12, 60, 5, 400, 4);
  cr('horde', 5, 0, 'Рок', 'flyer', 13, 11, 11, 15, 60, 7, 600, 3, { wide: 1, abilities: { flying: 1 } });
  cr('horde', 5, 1, 'Гръмовна птица', 'flyer', 13, 11, 11, 15, 60, 11, 700, 3, { wide: 1, abilities: { flying: 1, thunderHit: 20 } });
  cr('horde', 6, 0, 'Циклоп', 'giant', 15, 12, 16, 20, 70, 6, 750, 2, { shots: 16, abilities: { shooter: 1 } });
  cr('horde', 6, 1, 'Циклоп крал', 'giant', 17, 13, 16, 20, 70, 8, 1100, 2, { shots: 24, abilities: { shooter: 1 } });
  cr('horde', 7, 0, 'Бегемот', 'beast', 17, 17, 30, 50, 160, 6, 1500, 1, { wide: 1, abilities: { ignoreDef: 40 } });
  cr('horde', 7, 1, 'Древен бегемот', 'beast', 19, 19, 30, 50, 300, 9, 3000, 1, { rare: 1, wide: 1, abilities: { ignoreDef: 80 } });
  // Тресавище
  cr('marsh', 1, 0, 'Гнол', 'infantry', 3, 5, 2, 3, 6, 4, 50, 12);
  cr('marsh', 1, 1, 'Гнол мародер', 'infantry', 4, 6, 2, 3, 6, 5, 70, 12);
  cr('marsh', 2, 0, 'Гущерочовек', 'archer', 5, 6, 2, 3, 14, 4, 110, 9, { shots: 12, abilities: { shooter: 1 } });
  cr('marsh', 2, 1, 'Гущер войн', 'archer', 6, 8, 2, 5, 15, 5, 140, 9, { shots: 24, abilities: { shooter: 1 } });
  cr('marsh', 3, 0, 'Змийска муха', 'flyer', 7, 9, 2, 5, 20, 9, 220, 8, { abilities: { flying: 1, dispelHit: 1 } });
  cr('marsh', 3, 1, 'Драконова муха', 'flyer', 8, 10, 2, 5, 20, 13, 240, 8, { abilities: { flying: 1, dispelHit: 1, weakHit: 1 } });
  cr('marsh', 4, 0, 'Базилиск', 'beast', 11, 11, 6, 10, 35, 5, 325, 4, { wide: 1, abilities: { blindHit: 20 } });
  cr('marsh', 4, 1, 'Велик базилиск', 'beast', 12, 12, 6, 10, 40, 7, 400, 4, { wide: 1, abilities: { blindHit: 20 } });
  cr('marsh', 5, 0, 'Горгона', 'beast', 10, 14, 12, 16, 70, 5, 525, 3, { wide: 1 });
  cr('marsh', 5, 1, 'Могъща горгона', 'beast', 11, 16, 12, 16, 70, 6, 600, 3, { wide: 1, abilities: { deathStare: 10 } });
  cr('marsh', 6, 0, 'Виверна', 'dragon', 14, 14, 14, 18, 70, 7, 800, 2, { wide: 1, abilities: { flying: 1 } });
  cr('marsh', 6, 1, 'Виверна монарх', 'dragon', 14, 14, 18, 22, 70, 11, 1100, 2, { wide: 1, abilities: { flying: 1, weakHit: 1 } });
  cr('marsh', 7, 0, 'Хидра', 'dragon', 16, 18, 25, 45, 175, 5, 2200, 1, { wide: 1, abilities: { allAround: 1, noRetaliation: 1 } });
  cr('marsh', 7, 1, 'Хидра на хаоса', 'dragon', 18, 20, 25, 45, 250, 7, 3500, 1, { rare: 1, wide: 1, abilities: { allAround: 1, noRetaliation: 1 } });
  // Стихии
  cr('elements', 1, 0, 'Пикси', 'flyer', 2, 2, 1, 2, 3, 7, 25, 20, { abilities: { flying: 1 } });
  cr('elements', 1, 1, 'Фея', 'flyer', 2, 2, 1, 3, 3, 9, 30, 20, { abilities: { flying: 1, noRetaliation: 1 } });
  cr('elements', 2, 0, 'Въздушен елементал', 'spirit', 9, 9, 2, 8, 25, 7, 250, 6, { abilities: { mindImmune: 1 } });
  cr('elements', 2, 1, 'Буреносен елементал', 'spirit', 9, 9, 2, 8, 25, 8, 275, 6, { shots: 24, abilities: { shooter: 1, mindImmune: 1 } });
  cr('elements', 3, 0, 'Воден елементал', 'spirit', 8, 10, 3, 7, 30, 5, 300, 6, { wide: 1, abilities: { mindImmune: 1 } });
  cr('elements', 3, 1, 'Леден елементал', 'spirit', 8, 10, 3, 7, 30, 6, 375, 6, { wide: 1, shots: 24, abilities: { shooter: 1, mindImmune: 1 } });
  cr('elements', 4, 0, 'Огнен елементал', 'spirit', 10, 8, 4, 6, 35, 6, 350, 5, { abilities: { fireImmune: 1, mindImmune: 1 } });
  cr('elements', 4, 1, 'Енергиен елементал', 'spirit', 12, 8, 4, 6, 35, 8, 400, 5, { abilities: { flying: 1, fireImmune: 1, mindImmune: 1 } });
  cr('elements', 5, 0, 'Земен елементал', 'giant', 10, 10, 4, 8, 40, 4, 400, 4, { abilities: { mindImmune: 1 } });
  cr('elements', 5, 1, 'Магмен елементал', 'giant', 11, 11, 6, 10, 40, 6, 500, 4, { abilities: { mindImmune: 1, fireImmune: 1 } });
  cr('elements', 6, 0, 'Психичен елементал', 'spirit', 15, 13, 10, 20, 75, 7, 750, 2, { abilities: { allAround: 1, mindImmune: 1 } });
  cr('elements', 6, 1, 'Магически елементал', 'spirit', 15, 13, 15, 25, 80, 9, 800, 2, { abilities: { allAround: 1, spellImmune: 5 } });
  cr('elements', 7, 0, 'Огнена птица', 'flyer', 18, 18, 30, 40, 150, 15, 1500, 2, { wide: 1, abilities: { flying: 1, fireImmune: 1 } });
  cr('elements', 7, 1, 'Феникс', 'flyer', 21, 18, 30, 40, 200, 21, 2000, 2, { rare: 1, wide: 1, abilities: { flying: 1, fireImmune: 1, rebirth: 1 } });
  // Пристан
  cr('harbor', 1, 0, 'Нимфа', 'spirit', 5, 2, 1, 2, 4, 6, 35, 16, { abilities: { flying: 1 } });
  cr('harbor', 1, 1, 'Океанида', 'spirit', 6, 2, 1, 2, 4, 8, 45, 16, { abilities: { flying: 1 } });
  cr('harbor', 2, 0, 'Моряк', 'infantry', 7, 4, 2, 4, 15, 5, 110, 9);
  cr('harbor', 2, 1, 'Боцман', 'infantry', 8, 6, 3, 4, 15, 6, 140, 9);
  cr('harbor', 3, 0, 'Пират', 'archer', 8, 6, 3, 7, 15, 6, 225, 7, { shots: 4, abilities: { shooter: 1, noMeleePenalty: 1 } });
  cr('harbor', 3, 1, 'Корсар', 'archer', 10, 8, 3, 7, 15, 7, 275, 7, { shots: 4, abilities: { shooter: 1, noMeleePenalty: 1, noRetaliation: 1 } });
  cr('harbor', 4, 0, 'Буревестник', 'flyer', 10, 8, 6, 9, 30, 9, 275, 4, { abilities: { flying: 1 } });
  cr('harbor', 4, 1, 'Морски сокол', 'flyer', 11, 8, 6, 9, 30, 11, 375, 4, { abilities: { flying: 1 } });
  cr('harbor', 5, 0, 'Морска вещица', 'mage', 12, 7, 10, 14, 35, 5, 515, 3, { shots: 12, abilities: { shooter: 1 } });
  cr('harbor', 5, 1, 'Чародейка', 'mage', 12, 9, 10, 14, 35, 7, 645, 3, { shots: 24, abilities: { shooter: 1, weakHit: 1 } });
  cr('harbor', 6, 0, 'Никс', 'giant', 13, 16, 18, 22, 80, 6, 1000, 2, { abilities: { ignoreAtt: 30 } });
  cr('harbor', 6, 1, 'Никс войн', 'giant', 14, 17, 18, 22, 90, 7, 1300, 2, { abilities: { ignoreAtt: 60 } });
  cr('harbor', 7, 0, 'Морски змей', 'dragon', 22, 16, 30, 55, 180, 9, 2200, 1, { rare: 1, wide: 1, abilities: { weakHit: 1 } });
  cr('harbor', 7, 1, 'Хаспид', 'dragon', 29, 20, 30, 55, 300, 12, 4000, 1, { rare: 2, wide: 1, abilities: { weakHit: 1, retaliations: 2 } });
  // Работилница
  cr('workshop', 1, 0, 'Дребосък', 'archer', 4, 2, 1, 3, 6, 5, 40, 15, { shots: 24, abilities: { shooter: 1 } });
  cr('workshop', 1, 1, 'Дребосък гренадир', 'archer', 5, 3, 2, 3, 7, 6, 60, 15, { shots: 24, abilities: { shooter: 1, noObstaclePenalty: 1 } });
  cr('workshop', 2, 0, 'Механик', 'infantry', 5, 6, 2, 4, 12, 5, 100, 9);
  cr('workshop', 2, 1, 'Инженер', 'infantry', 6, 7, 2, 4, 14, 6, 130, 9, { abilities: { repair: 1 } });
  cr('workshop', 3, 0, 'Броненосец', 'beast', 7, 12, 4, 6, 32, 4, 220, 6, { wide: 1 });
  cr('workshop', 3, 1, 'Боен броненосец', 'beast', 8, 14, 4, 6, 35, 6, 275, 6, { wide: 1, abilities: { goodMorale: 1 } });
  cr('workshop', 4, 0, 'Автомат', 'giant', 10, 9, 5, 9, 38, 5, 350, 4, { abilities: { mindImmune: 1 } });
  cr('workshop', 4, 1, 'Автомат стражар', 'giant', 12, 10, 6, 9, 45, 7, 425, 4, { abilities: { mindImmune: 1, retaliations: 2 } });
  cr('workshop', 5, 0, 'Пясъчен червей', 'dragon', 14, 11, 12, 18, 72, 5, 550, 3, { wide: 1 });
  cr('workshop', 5, 1, 'Гигантски червей', 'dragon', 15, 12, 12, 18, 78, 7, 750, 3, { wide: 1, abilities: { regenerate: 1 } });
  cr('workshop', 6, 0, 'Стрелец с револвер', 'archer', 15, 10, 13, 19, 70, 8, 900, 2, { shots: 16, abilities: { shooter: 1 } });
  cr('workshop', 6, 1, 'Ловец на глави', 'archer', 16, 11, 13, 19, 80, 9, 1100, 2, { shots: 24, abilities: { shooter: 1, doubleShot: 1 } });
  cr('workshop', 7, 0, 'Куатл', 'dragon', 18, 16, 25, 45, 175, 14, 2400, 1, { rare: 1, wide: 1, abilities: { flying: 1 } });
  cr('workshop', 7, 1, 'Пурпурен куатл', 'dragon', 22, 20, 25, 45, 250, 17, 3600, 1, { rare: 2, wide: 1, abilities: { flying: 1, retaliations: 99 } });
  // Двухексови от първите три фракции
  ['kingdom3', 'kingdom3u', 'kingdom6', 'kingdom6u', 'grove1', 'grove1u', 'grove4', 'grove4u', 'grove6', 'grove6u', 'grove7', 'grove7u', 'necropolis6', 'necropolis6u', 'necropolis7', 'necropolis7u', 'n_hydra'].forEach((id) => { D.creatureById[id].wide = 1; });

  // ---------------------------------------------------------------- класове
  const mightW = { offense: 7, armorer: 6, leadership: 6, logistics: 6, tactics: 5, archery: 4, luck: 4, estates: 4, pathfinding: 3, scouting: 3, resistance: 3, diplomacy: 3, navigation: 1, wisdom: 2, learning: 2, intelligence: 1, mysticism: 1, sorcery: 1 };
  const magicW = { wisdom: 8, mysticism: 5, intelligence: 5, sorcery: 4, learning: 4, luck: 3, logistics: 3, estates: 3, armorer: 2, scouting: 2, resistance: 3, leadership: 2, diplomacy: 2, navigation: 1, air: 4, fire: 4, water: 4, earth: 4 };
  function cls(id, name, faction, start, p1, p2, skills, magic, tweak) {
    D.CLASSES[id] = { name, faction, start, p1, p2, skills, magic };
    D.CLASS_SKILL_WEIGHTS[id] = Object.assign({}, magic ? magicW : mightW, tweak || {});
  }
  cls('alchemist', 'Алхимик', 'academy', [1, 1, 2, 2], [30, 30, 20, 20], [30, 30, 20, 20], ['mysticism', 'scouting'], false, { mysticism: 6, intelligence: 4, wisdom: 4 });
  cls('wizard', 'Магьосник', 'academy', [0, 0, 2, 3], [10, 10, 40, 40], [20, 20, 30, 30], ['wisdom', 'air'], true, { air: 7, water: 6 });
  cls('demoniac', 'Демонолог', 'inferno', [2, 2, 1, 1], [35, 35, 15, 15], [30, 30, 20, 20], ['armorer', 'tactics'], false, { fire: 3 });
  cls('heretic', 'Еретик', 'inferno', [1, 1, 2, 2], [15, 15, 35, 35], [25, 25, 25, 25], ['wisdom', 'fire'], true, { fire: 8 });
  cls('overlord', 'Властелин', 'dungeon', [2, 2, 1, 1], [35, 35, 15, 15], [30, 30, 20, 20], ['offense', 'scouting'], false, { earth: 3 });
  cls('warlock', 'Чернокнижник', 'dungeon', [0, 0, 3, 2], [10, 10, 50, 30], [20, 20, 30, 30], ['wisdom', 'earth'], true, { earth: 8, air: 5 });
  cls('barbarian', 'Варварин', 'horde', [4, 0, 1, 1], [55, 35, 5, 5], [30, 30, 20, 20], ['offense', 'logistics'], false, { offense: 9, resistance: 5, wisdom: 1 });
  cls('battlemage', 'Боен маг', 'horde', [2, 1, 1, 2], [30, 30, 20, 20], [25, 25, 25, 25], ['wisdom', 'offense'], true, { offense: 5, air: 5 });
  cls('beastmaster', 'Звероукротител', 'marsh', [0, 4, 1, 1], [30, 60, 5, 5], [30, 30, 20, 20], ['armorer', 'pathfinding'], false, { armorer: 9 });
  cls('witch', 'Вещица', 'marsh', [0, 1, 2, 2], [5, 15, 40, 40], [20, 20, 30, 30], ['wisdom', 'water'], true, { water: 7, earth: 5 });
  cls('planeswalker', 'Странник', 'elements', [3, 1, 1, 1], [35, 35, 15, 15], [30, 30, 20, 20], ['tactics', 'air'], false, { air: 4, earth: 3 });
  cls('elementalist', 'Елементалист', 'elements', [0, 0, 3, 3], [15, 15, 35, 35], [25, 25, 25, 25], ['wisdom', 'water'], true, { air: 6, fire: 6, water: 6, earth: 6 });
  cls('captain', 'Капитан', 'harbor', [2, 2, 1, 1], [35, 35, 15, 15], [30, 30, 20, 20], ['navigation', 'offense'], false, { navigation: 6, luck: 5 });
  cls('navigator', 'Навигатор', 'harbor', [1, 0, 2, 2], [15, 15, 35, 35], [25, 25, 25, 25], ['wisdom', 'navigation'], true, { navigation: 6, water: 7 });
  cls('mercenary', 'Наемник', 'workshop', [3, 1, 1, 1], [40, 30, 15, 15], [30, 30, 20, 20], ['archery', 'estates'], false, { archery: 8, estates: 5 });
  cls('artificer', 'Изобретател', 'workshop', [1, 1, 2, 2], [15, 15, 35, 35], [25, 25, 25, 25], ['wisdom', 'intelligence'], true, { intelligence: 7, earth: 5 });
  // Нови умения за всички класове
  Object.keys(D.CLASS_SKILL_WEIGHTS).forEach((k) => { const w = D.CLASS_SKILL_WEIGHTS[k]; w.diplomacy = Math.max(w.diplomacy || 0, 4); if (!w.navigation) w.navigation = 1; });
  D.SKILLS.diplomacy = { name: 'Дипломация', desc: (l) => 'Съществата се присъединяват по-лесно; предаването струва ' + [20, 40, 60][l - 1] + '% по-малко.' };
  D.SKILLS.navigation = { name: 'Мореплаване', desc: (l) => '+' + [50, 100, 150][l - 1] + '% движение по вода.' };

  Object.assign(D.HERO_NAMES, {
    academy: ['Симеон', 'Теодора', 'Ясен Мъдри', 'Рада', 'Никифор', 'Анастасия', 'Пламен', 'Зорница', 'Методи', 'Ирина'],
    inferno: ['Огнян', 'Жарава', 'Пламък', 'Сяра', 'Черен Асен', 'Пепел', 'Въглен', 'Искра', 'Смола', 'Жупел'],
    dungeon: ['Мрак', 'Сенка', 'Бездан', 'Тъмна Яна', 'Гроз', 'Отрова', 'Кремен', 'Нощен', 'Черна Рада', 'Бездън'],
    horde: ['Крум', 'Аспарух', 'Буря', 'Гръм', 'Секира', 'Вихра', 'Ръмжан', 'Кален', 'Дивана', 'Тарк'],
    marsh: ['Тиня', 'Блатан', 'Отровка', 'Мочур', 'Влага', 'Жабан', 'Тресава', 'Гущеран', 'Змеяна', 'Ръждан'],
    elements: ['Вихрен', 'Пламена', 'Влага', 'Камен', 'Искра', 'Струя', 'Лъчезар', 'Зефира', 'Ясна', 'Стихиян'],
    harbor: ['Морян', 'Пяна', 'Котва', 'Вълна', 'Корабан', 'Соленка', 'Прилив', 'Бисера', 'Рибан', 'Кормила'],
    workshop: ['Зъбчо', 'Винтана', 'Барут', 'Медяна', 'Стоман', 'Пружина', 'Ковач', 'Искряна', 'Динамит', 'Болтан']
  });

  // ---------------------------------------------------------------- специалности
  // kind: creature (по-силно същество от фракцията), skill (умение ×1.5 при... +5% на ниво), spell (+3 сила за магията), resource (+доход)
  D.SPECIALTY_KINDS = ['creature', 'skill', 'spell', 'resource'];
  D.specialtyText = (sp) => {
    if (!sp) return '';
    if (sp.kind === 'creature') { const c = D.creatureOf(sp.id); return c.name + ': +1 атака и защита на всеки 3 нива, +1 скорост.'; }
    if (sp.kind === 'skill') return D.SKILLS[sp.id].name + ': ефектът расте с 5% на ниво на героя.';
    if (sp.kind === 'spell') return D.spellById[sp.id].name + ': магията е с +3 сила и струва 1 мана по-малко.';
    if (sp.kind === 'resource') return sp.id === 'gold' ? '+350 злато на ден.' : '+1 ' + D.RES_NAME[sp.id].toLowerCase() + ' на ден.';
    return '';
  };

  // ---------------------------------------------------------------- артефакти и комплекти
  const A = D.ARTIFACTS;
  function art(id, name, slot, cls, bonus, desc, set) { const a = { id, name, slot, cls, bonus, desc, set }; A.push(a); D.artById[id] = a; }
  art('dawn_helm', 'Шлем на зората', 'head', 2, { know: 2, def: 1 }, 'Познание +2, защита +1.', 'dawn');
  art('dawn_plate', 'Ризница на зората', 'torso', 2, { def: 3, att: 1 }, 'Защита +3, атака +1.', 'dawn');
  art('dawn_shield', 'Щит на зората', 'shield', 2, { def: 3 }, 'Защита +3.', 'dawn');
  art('dawn_blade', 'Острие на зората', 'weapon', 2, { att: 3 }, 'Атака +3.', 'dawn');
  art('storm_cape', 'Плащ на бурята', 'shoulders', 2, { pow: 2, school: 'air', spellDmg: 25 }, 'Сила +2, въздушни магии +25%.', 'storm');
  art('storm_ring', 'Пръстен на бурята', 'ring', 2, { pow: 1, manaRegen: 1 }, 'Сила +1, +1 мана на ден.', 'storm');
  art('storm_staff', 'Жезъл на бурята', 'weapon', 3, { pow: 3, know: 1 }, 'Сила +3, познание +1.', 'storm');
  art('wolf_pelt', 'Вълча кожа', 'shoulders', 1, { att: 1, moveBonus: 200 }, 'Атака +1, движение +200.', 'wolf');
  art('wolf_boots', 'Вълчи ботуши', 'feet', 2, { moveBonus: 400, luck: 1 }, 'Движение +400, късмет +1.', 'wolf');
  art('wolf_fang', 'Вълчи зъб', 'neck', 1, { att: 2 }, 'Атака +2.', 'wolf');
  art('sea_compass', 'Компас на моряка', 'misc', 1, { seaMove: 500 }, '+500 движение по вода.');
  art('sea_charm', 'Амулет на прилива', 'neck', 2, { seaMove: 1000, luck: 1 }, '+1000 движение по вода, късмет +1.');
  art('miners_pick', 'Кирка на рудокопача', 'misc', 2, { resIncome: 'ore' }, '+1 руда на ден.');
  art('lumber_axe', 'Секира на дърваря', 'misc', 2, { resIncome: 'wood' }, '+1 дърво на ден.');
  art('alchemist_vial', 'Стъкленица на алхимика', 'misc', 3, { resIncome: 'mercury' }, '+1 живак на ден.');
  art('cursed_skull', 'Прокълнат череп', 'misc', 3, { necromancy: 1, morale: -1 }, 'Некромантия +1 степен, морал −1.');
  art('archers_glove', 'Ръкавица на стрелеца', 'misc', 2, { archery: 1 }, 'Стрелба +1 степен.');
  art('shield_of_faith', 'Щит на вярата', 'shield', 3, { def: 4, resistance: 1 }, 'Защита +4, съпротива +1 степен.');
  art('tome_earth', 'Том на земята', 'misc', 3, { spellsOf: 'earth' }, 'Героят знае всички магии на земята.');
  art('tome_fire', 'Том на огъня', 'misc', 3, { spellsOf: 'fire' }, 'Героят знае всички магии на огъня.');
  art('tome_air', 'Том на въздуха', 'misc', 3, { spellsOf: 'air' }, 'Героят знае всички магии на въздуха.');
  art('tome_water', 'Том на водата', 'misc', 3, { spellsOf: 'water' }, 'Героят знае всички магии на водата.');
  art('speculum', 'Далекоглед', 'misc', 1, { scouting: 2 }, 'Видимост +2.');
  art('angel_wings', 'Крила на ангела', 'shoulders', 3, { flyMove: 1 }, 'Героят лети над препятствия по картата (цена ×1.5).');
  D.ART_SETS = {
    dawn: { name: 'Доспехи на зората', parts: ['dawn_helm', 'dawn_plate', 'dawn_shield', 'dawn_blade'], bonus: { att: 3, def: 3, morale: 1 }, desc: 'Пълен комплект: атака и защита +3, морал +1, армията е неуязвима за Проклятие и Слабост.' },
    storm: { name: 'Одежди на бурята', parts: ['storm_cape', 'storm_ring', 'storm_staff'], bonus: { pow: 3, know: 3 }, desc: 'Пълен комплект: сила и познание +3, всички въздушни магии на експертно ниво.' },
    wolf: { name: 'Вълчи дар', parts: ['wolf_pelt', 'wolf_boots', 'wolf_fang'], bonus: { moveBonus: 400, att: 1 }, desc: 'Пълен комплект: движение +400, атака +1, армията има +2 скорост.' }
  };

  // ---------------------------------------------------------------- сгради: корабостроителница
  D.BUILDINGS.push({ id: 'shipyard', name: 'Корабостроителница', cost: { gold: 2000, wood: 20 }, req: ['fort1'], coastal: true, desc: 'Строи кораби (1000 злато, 10 дърво). Само за градове до вода.' });
  D.buildingById.shipyard = D.BUILDINGS[D.BUILDINGS.length - 1];
  D.OBJECTS.boat = { name: 'Кораб', desc: 'Качи се и плавай по водата.' };
  D.OBJECTS.gate = { name: 'Подземна порта', desc: 'Води към другото ниво на света.' };
  D.OBJECTS.whirlpool = { name: 'Водовъртеж', desc: 'Пренася кораба до друг водовъртеж.' };
  D.OBJECTS.lighthouse = { name: 'Фар', desc: '+500 движение по вода за корабите на притежателя.' };
  D.OBJECTS.sea_chest = { name: 'Морски сандък', desc: 'Съкровище сред вълните.' };
  D.OBJECTS.shipwreck = { name: 'Корабокрушение', desc: 'Останки — понякога със злато и артефакт.' };

  // ---------------------------------------------------------------- шаблони за карти
  D.TEMPLATES = [
    { id: 'balanced', name: 'Балансирана', desc: 'Класическа карта: равни зони, умерени пазачи, езера.', water: 0.78, monsterMult: 1, resMult: 1, underground: true, neutralTownsExtra: 0 },
    { id: 'rich', name: 'Богата', desc: 'Много ресурси и артефакти, повече мини — бърз растеж.', water: 0.8, monsterMult: 1.1, resMult: 1.8, underground: true, neutralTownsExtra: 1, extraMines: 4 },
    { id: 'islands', name: 'Острови', desc: 'Море между играчите — без корабостроителница няма среща.', water: 0.62, monsterMult: 0.9, resMult: 1.1, underground: false, neutralTownsExtra: 0, islands: true },
    { id: 'underworld', name: 'Подземен свят', desc: 'Голямо подземие с богатства и опасни пазачи.', water: 0.8, monsterMult: 1.2, resMult: 1.2, underground: true, undergroundRich: true, neutralTownsExtra: 1 },
    { id: 'duel', name: 'Дуел', desc: 'Малко пазачи, близки градове — бърз сблъсък.', water: 0.85, monsterMult: 0.6, resMult: 1, underground: false, neutralTownsExtra: 0, close: true }
  ];
  D.TEMPLATE = (id) => D.TEMPLATES.find((t) => t.id === id) || D.TEMPLATES[0];
  D.SEA_MOVEMENT = 1500;
})();
