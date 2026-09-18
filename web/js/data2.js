/* Фаза 2/3 данни: още 8 фракции (6 по класическите аналози + 2 по модела на HotA),
   нови терени, способности, артефакти и комплекти, специалности на героите, шаблони за карти. */
(function () {
  'use strict';
  const MK = (window.MK = window.MK || {});
  const T = (x) => (MK.T ? MK.T(x) : x);
  const D = MK.data;

  // ---------------------------------------------------------------- нови терени
  D.TERRAIN.push(
    { id: 8, key: 'subterranean', name: T('Подземие'), cost: 100, passable: true, col: '#6a5a58', col2: '#605250' },
    { id: 9, key: 'wasteland', name: T('Пустиня'), cost: 125, passable: true, col: '#8a7a8a', col2: '#7f7080' }
  );

  // ---------------------------------------------------------------- фракции
  const F = [
    { id: 'academy', name: T('Академия'), adj: T('академски'), terrain: 4, color: '#9fc8f0', rare: 'gems', classes: ['alchemist', 'wizard'],
      desc: T('Гремлини, големи, магове и титани — град на знанието с мощна стрелба и магия.'),
      dwellings: [T('Работилница'), T('Скален парапет'), T('Фабрика за големи'), T('Кула на маговете'), T('Олтар на желанията'), T('Златен павилион'), T('Облачен храм')],
      dwellingsU: [T('Майсторска работилница'), T('Обсидианов парапет'), T('Железна фабрика'), T('Кула на архимаговете'), T('Олтар на великите желания'), T('Кралски павилион'), T('Храм на титаните')] },
    { id: 'inferno', name: T('Пъкъл'), adj: T('пъклен'), terrain: 7, color: '#e0603a', rare: 'mercury', classes: ['demoniac', 'heretic'],
      desc: T('Дяволчета, хрътки, ифрити и дяволи — огън, бързина и удари без ответ.'),
      dwellings: [T('Яма на дяволчетата'), T('Зала на греха'), T('Кучкарник'), T('Порта на демоните'), T('Огнено езеро'), T('Огнен дворец'), T('Разкъсано небе')],
      dwellingsU: [T('Дълбока яма'), T('Кула на греха'), T('Кучкарник на цербера'), T('Порта на рогатите'), T('Езеро на владетелите'), T('Дворец на султаните'), T('Пъклена порта')] },
    { id: 'dungeon', name: T('Подземие'), adj: T('подземен'), terrain: 8, color: '#7a5a9a', rare: 'sulfur', classes: ['overlord', 'warlock'],
      desc: T('Троглодити, харпии, медузи, минотаври и черни дракони — тъмна сила и зли очи.'),
      dwellings: [T('Пещера на троглодитите'), T('Гнездо на харпиите'), T('Стълб на очите'), T('Медузински покои'), T('Лабиринт'), T('Логовище на мантикорите'), T('Драконова пещера')],
      dwellingsU: [T('Пъклена пещера'), T('Гнездо на вещиците'), T('Стълб на злото око'), T('Кралски покои'), T('Кралски лабиринт'), T('Логовище на скорпикорите'), T('Черна пещера')] },
    { id: 'horde', name: T('Орда'), adj: T('ордински'), terrain: 6, color: '#c08a3a', rare: 'crystal', classes: ['barbarian', 'battlemage'],
      desc: T('Гоблини, вълчи ездачи, орки, огъри, циклопи и бегемоти — груба сила и висока атака.'),
      dwellings: [T('Гоблинска казарма'), T('Вълча яма'), T('Оркска кула'), T('Форт на огърите'), T('Скали'), T('Пещера на циклопите'), T('Лагуна на бегемотите')],
      dwellingsU: [T('Хобгоблинска казарма'), T('Вълчи форт'), T('Кула на вожда'), T('Форт на маговете огъри'), T('Гръмовни скали'), T('Пещера на кралете'), T('Древна лагуна')] },
    { id: 'marsh', name: T('Тресавище'), adj: T('блатен'), terrain: 5, color: '#5a8a5a', rare: 'sulfur', classes: ['beastmaster', 'witch'],
      desc: T('Гноли, гущери, базилиски, горгони, виверни и хидри — здрава защита и отрова.'),
      dwellings: [T('Гнолска хижа'), T('Гущерско гнездо'), T('Кошер на мухите'), T('Яма на базилиските'), T('Горгонско пасище'), T('Виверново гнездо'), T('Езеро на хидрите')],
      dwellingsU: [T('Мародерска хижа'), T('Гнездо на войните'), T('Кошер на драконовите мухи'), T('Яма на великите базилиски'), T('Могъщо пасище'), T('Гнездо на монарха'), T('Езеро на хаоса')] },
    { id: 'elements', name: T('Стихии'), adj: T('стихиен'), terrain: 1, color: '#d8c0ff', rare: 'mercury', classes: ['planeswalker', 'elementalist'],
      desc: T('Пикси, елементали и феникси — чиста магия, скорост и имунитети.'),
      dwellings: [T('Магическа решетка'), T('Олтар на въздуха'), T('Олтар на водата'), T('Олтар на огъня'), T('Олтар на земята'), T('Олтар на мисълта'), T('Пирамида')],
      dwellingsU: [T('Решетка на феите'), T('Олтар на бурята'), T('Олтар на леда'), T('Олтар на енергията'), T('Олтар на магмата'), T('Олтар на магията'), T('Пирамида на феникса')] },
    // Двете фракции по модела на Horn of the Abyss
    { id: 'harbor', name: T('Пристан'), adj: T('пристанищен'), terrain: 3, color: '#3a9ab0', rare: 'gems', classes: ['captain', 'navigator'],
      desc: T('Нимфи, моряци, пирати, морски вещици и морски змейове — господари на брега и корабите.'),
      dwellings: [T('Извор на нимфите'), T('Кръчма на моряците'), T('Пиратско пристанище'), T('Скали на буревестниците'), T('Кула на вещиците'), T('Пещера на никсите'), T('Бездна на змейовете')],
      dwellingsU: [T('Извор на океанидите'), T('Каюта на боцманите'), T('Корсарско пристанище'), T('Скали на соколите'), T('Кула на чародейките'), T('Пещера на войните'), T('Бездна на хаспидите')] },
    { id: 'workshop', name: T('Работилница'), adj: T('механичен'), terrain: 9, color: '#b09060', rare: 'crystal', classes: ['mercenary', 'artificer'],
      desc: T('Дребосъци, механици, броненосци, автомати, червеи, стрелци и куатли — машини и барут в пустошта.'),
      dwellings: [T('Дупка на дребосъците'), T('Работилница'), T('Яма на броненосците'), T('Монтажна зала'), T('Пясъчна яма'), T('Салон'), T('Небесен пристан')],
      dwellingsU: [T('Гренадирска дупка'), T('Инженерна работилница'), T('Бойна яма'), T('Зала на стражарите'), T('Дълбока пясъчна яма'), T('Ловджийски салон'), T('Пурпурен пристан')] }
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
  cr('academy', 1, 0, T('Гремлин'), 'infantry', 3, 3, 1, 2, 4, 4, 30, 16);
  cr('academy', 1, 1, T('Майстор гремлин'), 'archer', 4, 4, 1, 2, 4, 5, 40, 16, { shots: 8, abilities: { shooter: 1 } });
  cr('academy', 2, 0, T('Гаргойл'), 'flyer', 6, 6, 2, 3, 16, 6, 130, 9, { abilities: { nonLiving: 1, flying: 1, mindImmune: 1 } });
  cr('academy', 2, 1, T('Обсидианов гаргойл'), 'flyer', 7, 7, 2, 3, 16, 9, 160, 9, { abilities: { nonLiving: 1, flying: 1, mindImmune: 1 } });
  cr('academy', 3, 0, T('Каменен голем'), 'giant', 7, 10, 4, 5, 30, 3, 150, 6, { abilities: { nonLiving: 1, magicRes: 50, mindImmune: 1 } });
  cr('academy', 3, 1, T('Железен голем'), 'giant', 9, 10, 4, 5, 35, 5, 200, 6, { abilities: { nonLiving: 1, magicRes: 75, mindImmune: 1 } });
  cr('academy', 4, 0, T('Маг'), 'mage', 11, 8, 7, 9, 25, 5, 350, 4, { shots: 24, abilities: { shooter: 1, noMeleePenalty: 1 } });
  cr('academy', 4, 1, T('Архимаг'), 'mage', 12, 9, 7, 9, 30, 7, 450, 4, { shots: 24, abilities: { shooter: 1, noMeleePenalty: 1, noObstaclePenalty: 1 } });
  cr('academy', 5, 0, T('Джин'), 'spirit', 12, 12, 13, 16, 40, 7, 550, 3, { abilities: { flying: 1 } });
  cr('academy', 5, 1, T('Велик джин'), 'spirit', 12, 12, 13, 16, 40, 11, 600, 3, { abilities: { flying: 1 } });
  cr('academy', 6, 0, T('Нага'), 'beast', 16, 13, 20, 20, 110, 5, 1100, 2, { wide: 1, abilities: { noRetaliation: 1 } });
  cr('academy', 6, 1, T('Кралица нага'), 'beast', 16, 13, 30, 30, 110, 7, 1600, 2, { wide: 1, abilities: { noRetaliation: 1 } });
  cr('academy', 7, 0, T('Гигант'), 'giant', 19, 16, 40, 60, 150, 7, 2000, 1, { rare: 1, abilities: { mindImmune: 1 } });
  cr('academy', 7, 1, T('Титан'), 'giant', 24, 24, 40, 60, 300, 11, 5000, 1, { rare: 2, shots: 24, abilities: { shooter: 1, noMeleePenalty: 1, mindImmune: 1 } });
  // Пъкъл
  cr('inferno', 1, 0, T('Дяволче'), 'spirit', 2, 3, 1, 2, 4, 5, 50, 15);
  cr('inferno', 1, 1, T('Дребен бяс'), 'spirit', 4, 4, 1, 2, 4, 7, 60, 15, { abilities: { manaDrain: 1 } });
  cr('inferno', 2, 0, T('Гог'), 'archer', 6, 4, 2, 4, 13, 4, 125, 8, { shots: 12, abilities: { shooter: 1 } });
  cr('inferno', 2, 1, T('Магог'), 'archer', 7, 4, 2, 4, 13, 6, 175, 8, { shots: 24, abilities: { shooter: 1, deathCloud: 1 } });
  cr('inferno', 3, 0, T('Адска хрътка'), 'beast', 10, 6, 2, 7, 25, 7, 200, 5, { wide: 1 });
  cr('inferno', 3, 1, T('Цербер'), 'beast', 10, 8, 2, 7, 25, 8, 250, 5, { wide: 1, abilities: { allAround: 1, noRetaliation: 1 } });
  cr('inferno', 4, 0, T('Демон'), 'giant', 10, 10, 7, 9, 35, 5, 250, 4);
  cr('inferno', 4, 1, T('Рогат демон'), 'giant', 10, 10, 7, 9, 40, 6, 270, 4);
  cr('inferno', 5, 0, T('Изчадие'), 'giant', 13, 13, 13, 17, 45, 6, 500, 3);
  cr('inferno', 5, 1, T('Владетел на ямата'), 'giant', 13, 13, 13, 17, 45, 7, 700, 3);
  cr('inferno', 6, 0, T('Ифрит'), 'spirit', 16, 12, 16, 24, 90, 9, 900, 2, { abilities: { flying: 1, fireImmune: 1 } });
  cr('inferno', 6, 1, T('Султан ифрит'), 'spirit', 16, 14, 16, 24, 90, 13, 1100, 2, { abilities: { flying: 1, fireImmune: 1, fireShield: 20 } });
  cr('inferno', 7, 0, T('Дявол'), 'angel', 19, 21, 30, 40, 160, 11, 2700, 1, { rare: 1, abilities: { flying: 1, noRetaliation: 1, badLuckAura: 1 } });
  cr('inferno', 7, 1, T('Архидявол'), 'angel', 26, 28, 30, 40, 200, 17, 4500, 1, { rare: 2, abilities: { flying: 1, noRetaliation: 1, badLuckAura: 1 } });
  // Подземие
  cr('dungeon', 1, 0, T('Троглодит'), 'infantry', 4, 3, 1, 3, 5, 4, 50, 14, { abilities: { blindImmune: 1 } });
  cr('dungeon', 1, 1, T('Пъклен троглодит'), 'infantry', 5, 4, 1, 3, 6, 5, 65, 14, { abilities: { blindImmune: 1 } });
  cr('dungeon', 2, 0, T('Харпия'), 'flyer', 6, 5, 1, 4, 14, 6, 130, 8, { abilities: { flying: 1 } });
  cr('dungeon', 2, 1, T('Харпия вещица'), 'flyer', 6, 6, 1, 4, 14, 9, 170, 8, { abilities: { flying: 1, noRetaliation: 1 } });
  cr('dungeon', 3, 0, T('Наблюдател'), 'spirit', 9, 7, 3, 5, 22, 5, 250, 7, { shots: 12, abilities: { shooter: 1, noMeleePenalty: 1 } });
  cr('dungeon', 3, 1, T('Зло око'), 'spirit', 10, 8, 3, 5, 22, 7, 280, 7, { shots: 24, abilities: { shooter: 1, noMeleePenalty: 1 } });
  cr('dungeon', 4, 0, T('Медуза'), 'mage', 9, 9, 6, 8, 25, 5, 300, 4, { wide: 1, shots: 4, abilities: { shooter: 1, noMeleePenalty: 1, blindHit: 20 } });
  cr('dungeon', 4, 1, T('Кралица медуза'), 'mage', 10, 10, 6, 8, 30, 6, 330, 4, { wide: 1, shots: 8, abilities: { shooter: 1, noMeleePenalty: 1, blindHit: 20 } });
  cr('dungeon', 5, 0, T('Минотавър'), 'giant', 14, 12, 12, 20, 50, 6, 500, 3, { abilities: { goodMorale: 1 } });
  cr('dungeon', 5, 1, T('Минотавър крал'), 'giant', 15, 15, 12, 20, 50, 8, 575, 3, { abilities: { goodMorale: 1 } });
  cr('dungeon', 6, 0, T('Мантикора'), 'dragon', 15, 13, 14, 20, 80, 7, 850, 2, { wide: 1, abilities: { flying: 1 } });
  cr('dungeon', 6, 1, T('Скорпикора'), 'dragon', 16, 14, 14, 20, 80, 11, 1050, 2, { wide: 1, abilities: { flying: 1, blindHit: 20 } });
  cr('dungeon', 7, 0, T('Червен дракон'), 'dragon', 19, 19, 40, 50, 180, 11, 2500, 1, { rare: 1, wide: 1, abilities: { flying: 1, breath: 1, spellImmune: 3 } });
  cr('dungeon', 7, 1, T('Черен дракон'), 'dragon', 25, 25, 40, 50, 300, 15, 4000, 1, { rare: 2, wide: 1, abilities: { flying: 1, breath: 1, spellImmune: 5 } });
  // Орда
  cr('horde', 1, 0, T('Гоблин'), 'infantry', 4, 2, 1, 2, 5, 5, 40, 15);
  cr('horde', 1, 1, T('Хобгоблин'), 'infantry', 5, 3, 1, 2, 5, 7, 50, 15);
  cr('horde', 2, 0, T('Вълчи ездач'), 'rider', 7, 5, 2, 4, 10, 6, 100, 9, { wide: 1 });
  cr('horde', 2, 1, T('Вълчи нападател'), 'rider', 8, 5, 3, 4, 10, 8, 140, 9, { wide: 1, abilities: { doubleAttack: 1 } });
  cr('horde', 3, 0, T('Орк'), 'archer', 8, 4, 2, 5, 15, 4, 150, 7, { shots: 12, abilities: { shooter: 1 } });
  cr('horde', 3, 1, T('Оркски вожд'), 'archer', 8, 4, 2, 5, 20, 5, 165, 7, { shots: 24, abilities: { shooter: 1 } });
  cr('horde', 4, 0, T('Огър'), 'giant', 13, 7, 6, 12, 40, 4, 300, 4);
  cr('horde', 4, 1, T('Огър маг'), 'giant', 13, 7, 6, 12, 60, 5, 400, 4);
  cr('horde', 5, 0, T('Рок'), 'flyer', 13, 11, 11, 15, 60, 7, 600, 3, { wide: 1, abilities: { flying: 1 } });
  cr('horde', 5, 1, T('Гръмовна птица'), 'flyer', 13, 11, 11, 15, 60, 11, 700, 3, { wide: 1, abilities: { flying: 1, thunderHit: 20 } });
  cr('horde', 6, 0, T('Циклоп'), 'giant', 15, 12, 16, 20, 70, 6, 750, 2, { shots: 16, abilities: { shooter: 1 } });
  cr('horde', 6, 1, T('Циклоп крал'), 'giant', 17, 13, 16, 20, 70, 8, 1100, 2, { shots: 24, abilities: { shooter: 1 } });
  cr('horde', 7, 0, T('Бегемот'), 'beast', 17, 17, 30, 50, 160, 6, 1500, 1, { wide: 1, abilities: { ignoreDef: 40 } });
  cr('horde', 7, 1, T('Древен бегемот'), 'beast', 19, 19, 30, 50, 300, 9, 3000, 1, { rare: 1, wide: 1, abilities: { ignoreDef: 80 } });
  // Тресавище
  cr('marsh', 1, 0, T('Гнол'), 'infantry', 3, 5, 2, 3, 6, 4, 50, 12);
  cr('marsh', 1, 1, T('Гнол мародер'), 'infantry', 4, 6, 2, 3, 6, 5, 70, 12);
  cr('marsh', 2, 0, T('Гущерочовек'), 'archer', 5, 6, 2, 3, 14, 4, 110, 9, { shots: 12, abilities: { shooter: 1 } });
  cr('marsh', 2, 1, T('Гущер войн'), 'archer', 6, 8, 2, 5, 15, 5, 140, 9, { shots: 24, abilities: { shooter: 1 } });
  cr('marsh', 3, 0, T('Змийска муха'), 'flyer', 7, 9, 2, 5, 20, 9, 220, 8, { abilities: { flying: 1, dispelHit: 1 } });
  cr('marsh', 3, 1, T('Драконова муха'), 'flyer', 8, 10, 2, 5, 20, 13, 240, 8, { abilities: { flying: 1, dispelHit: 1, weakHit: 1 } });
  cr('marsh', 4, 0, T('Базилиск'), 'beast', 11, 11, 6, 10, 35, 5, 325, 4, { wide: 1, abilities: { blindHit: 20 } });
  cr('marsh', 4, 1, T('Велик базилиск'), 'beast', 12, 12, 6, 10, 40, 7, 400, 4, { wide: 1, abilities: { blindHit: 20 } });
  cr('marsh', 5, 0, T('Горгона'), 'beast', 10, 14, 12, 16, 70, 5, 525, 3, { wide: 1 });
  cr('marsh', 5, 1, T('Могъща горгона'), 'beast', 11, 16, 12, 16, 70, 6, 600, 3, { wide: 1, abilities: { deathStare: 10 } });
  cr('marsh', 6, 0, T('Виверна'), 'dragon', 14, 14, 14, 18, 70, 7, 800, 2, { wide: 1, abilities: { flying: 1 } });
  cr('marsh', 6, 1, T('Виверна монарх'), 'dragon', 14, 14, 18, 22, 70, 11, 1100, 2, { wide: 1, abilities: { flying: 1, weakHit: 1 } });
  cr('marsh', 7, 0, T('Хидра'), 'dragon', 16, 18, 25, 45, 175, 5, 2200, 1, { wide: 1, abilities: { allAround: 1, noRetaliation: 1 } });
  cr('marsh', 7, 1, T('Хидра на хаоса'), 'dragon', 18, 20, 25, 45, 250, 7, 3500, 1, { rare: 1, wide: 1, abilities: { allAround: 1, noRetaliation: 1 } });
  // Стихии
  cr('elements', 1, 0, T('Пикси'), 'flyer', 2, 2, 1, 2, 3, 7, 25, 20, { abilities: { flying: 1 } });
  cr('elements', 1, 1, T('Фея'), 'flyer', 2, 2, 1, 3, 3, 9, 30, 20, { abilities: { flying: 1, noRetaliation: 1 } });
  cr('elements', 2, 0, T('Въздушен елементал'), 'spirit', 9, 9, 2, 8, 25, 7, 250, 6, { abilities: { nonLiving: 1, mindImmune: 1 } });
  cr('elements', 2, 1, T('Буреносен елементал'), 'spirit', 9, 9, 2, 8, 25, 8, 275, 6, { shots: 24, abilities: { shooter: 1, mindImmune: 1 } });
  cr('elements', 3, 0, T('Воден елементал'), 'spirit', 8, 10, 3, 7, 30, 5, 300, 6, { wide: 1, abilities: { mindImmune: 1 } });
  cr('elements', 3, 1, T('Леден елементал'), 'spirit', 8, 10, 3, 7, 30, 6, 375, 6, { wide: 1, shots: 24, abilities: { shooter: 1, mindImmune: 1 } });
  cr('elements', 4, 0, T('Огнен елементал'), 'spirit', 10, 8, 4, 6, 35, 6, 350, 5, { abilities: { nonLiving: 1, fireImmune: 1, mindImmune: 1 } });
  cr('elements', 4, 1, T('Енергиен елементал'), 'spirit', 12, 8, 4, 6, 35, 8, 400, 5, { abilities: { nonLiving: 1, flying: 1, fireImmune: 1, mindImmune: 1 } });
  cr('elements', 5, 0, T('Земен елементал'), 'giant', 10, 10, 4, 8, 40, 4, 400, 4, { abilities: { nonLiving: 1, mindImmune: 1 } });
  cr('elements', 5, 1, T('Магмен елементал'), 'giant', 11, 11, 6, 10, 40, 6, 500, 4, { abilities: { nonLiving: 1, mindImmune: 1, fireImmune: 1 } });
  cr('elements', 6, 0, T('Психичен елементал'), 'spirit', 15, 13, 10, 20, 75, 7, 750, 2, { abilities: { nonLiving: 1, allAround: 1, mindImmune: 1 } });
  cr('elements', 6, 1, T('Магически елементал'), 'spirit', 15, 13, 15, 25, 80, 9, 800, 2, { abilities: { nonLiving: 1, allAround: 1, spellImmune: 5 } });
  cr('elements', 7, 0, T('Огнена птица'), 'flyer', 18, 18, 30, 40, 150, 15, 1500, 2, { wide: 1, abilities: { flying: 1, fireImmune: 1 } });
  cr('elements', 7, 1, T('Феникс'), 'flyer', 21, 18, 30, 40, 200, 21, 2000, 2, { rare: 1, wide: 1, abilities: { flying: 1, fireImmune: 1, rebirth: 1 } });
  // Пристан
  cr('harbor', 1, 0, T('Нимфа'), 'spirit', 5, 2, 1, 2, 4, 6, 35, 16, { abilities: { flying: 1 } });
  cr('harbor', 1, 1, T('Океанида'), 'spirit', 6, 2, 1, 2, 4, 8, 45, 16, { abilities: { flying: 1 } });
  cr('harbor', 2, 0, T('Моряк'), 'infantry', 7, 4, 2, 4, 15, 5, 110, 9);
  cr('harbor', 2, 1, T('Боцман'), 'infantry', 8, 6, 3, 4, 15, 6, 140, 9);
  cr('harbor', 3, 0, T('Пират'), 'archer', 8, 6, 3, 7, 15, 6, 225, 7, { shots: 4, abilities: { shooter: 1, noMeleePenalty: 1 } });
  cr('harbor', 3, 1, T('Корсар'), 'archer', 10, 8, 3, 7, 15, 7, 275, 7, { shots: 4, abilities: { shooter: 1, noMeleePenalty: 1, noRetaliation: 1 } });
  cr('harbor', 4, 0, T('Буревестник'), 'flyer', 10, 8, 6, 9, 30, 9, 275, 4, { abilities: { flying: 1 } });
  cr('harbor', 4, 1, T('Морски сокол'), 'flyer', 11, 8, 6, 9, 30, 11, 375, 4, { abilities: { flying: 1 } });
  cr('harbor', 5, 0, T('Морска вещица'), 'mage', 12, 7, 10, 14, 35, 5, 515, 3, { shots: 12, abilities: { shooter: 1 } });
  cr('harbor', 5, 1, T('Чародейка'), 'mage', 12, 9, 10, 14, 35, 7, 645, 3, { shots: 24, abilities: { shooter: 1, weakHit: 1 } });
  cr('harbor', 6, 0, T('Никс'), 'giant', 13, 16, 18, 22, 80, 6, 1000, 2, { abilities: { ignoreAtt: 30 } });
  cr('harbor', 6, 1, T('Никс войн'), 'giant', 14, 17, 18, 22, 90, 7, 1300, 2, { abilities: { ignoreAtt: 60 } });
  cr('harbor', 7, 0, T('Морски змей'), 'dragon', 22, 16, 30, 55, 180, 9, 2200, 1, { rare: 1, wide: 1, abilities: { weakHit: 1 } });
  cr('harbor', 7, 1, T('Хаспид'), 'dragon', 29, 20, 30, 55, 300, 12, 4000, 1, { rare: 2, wide: 1, abilities: { weakHit: 1, retaliations: 2 } });
  // Работилница
  cr('workshop', 1, 0, T('Дребосък'), 'archer', 4, 2, 1, 3, 6, 5, 40, 15, { shots: 24, abilities: { shooter: 1 } });
  cr('workshop', 1, 1, T('Дребосък гренадир'), 'archer', 5, 3, 2, 3, 7, 6, 60, 15, { shots: 24, abilities: { shooter: 1, noObstaclePenalty: 1 } });
  cr('workshop', 2, 0, T('Механик'), 'infantry', 5, 6, 2, 4, 12, 5, 100, 9);
  cr('workshop', 2, 1, T('Инженер'), 'infantry', 6, 7, 2, 4, 14, 6, 130, 9, { abilities: { repair: 1 } });
  cr('workshop', 3, 0, T('Броненосец'), 'beast', 7, 12, 4, 6, 32, 4, 220, 6, { wide: 1 });
  cr('workshop', 3, 1, T('Боен броненосец'), 'beast', 8, 14, 4, 6, 35, 6, 275, 6, { wide: 1, abilities: { goodMorale: 1 } });
  cr('workshop', 4, 0, T('Автомат'), 'giant', 10, 9, 5, 9, 38, 5, 350, 4, { abilities: { nonLiving: 1, mindImmune: 1 } });
  cr('workshop', 4, 1, T('Автомат стражар'), 'giant', 12, 10, 6, 9, 45, 7, 425, 4, { abilities: { nonLiving: 1, mindImmune: 1, retaliations: 2 } });
  cr('workshop', 5, 0, T('Пясъчен червей'), 'dragon', 14, 11, 12, 18, 72, 5, 550, 3, { wide: 1 });
  cr('workshop', 5, 1, T('Гигантски червей'), 'dragon', 15, 12, 12, 18, 78, 7, 750, 3, { wide: 1, abilities: { regenerate: 1 } });
  cr('workshop', 6, 0, T('Стрелец с револвер'), 'archer', 15, 10, 13, 19, 70, 8, 900, 2, { shots: 16, abilities: { shooter: 1 } });
  cr('workshop', 6, 1, T('Ловец на глави'), 'archer', 16, 11, 13, 19, 80, 9, 1100, 2, { shots: 24, abilities: { shooter: 1, doubleShot: 1 } });
  cr('workshop', 7, 0, T('Куатл'), 'dragon', 18, 16, 25, 45, 175, 14, 2400, 1, { rare: 1, wide: 1, abilities: { flying: 1 } });
  cr('workshop', 7, 1, T('Пурпурен куатл'), 'dragon', 22, 20, 25, 45, 250, 17, 3600, 1, { rare: 2, wide: 1, abilities: { flying: 1, retaliations: 99 } });
  // Двухексови от първите три фракции
  ['kingdom3', 'kingdom3u', 'kingdom6', 'kingdom6u', 'grove1', 'grove1u', 'grove4', 'grove4u', 'grove6', 'grove6u', 'grove7', 'grove7u', 'necropolis6', 'necropolis6u', 'necropolis7', 'necropolis7u', 'n_hydra'].forEach((id) => { D.creatureById[id].wide = 1; });

  // ---------------------------------------------------------------- класове
  const mightW = { offense: 7, armorer: 6, leadership: 6, logistics: 6, tactics: 5, archery: 4, luck: 4, estates: 4, pathfinding: 3, scouting: 3, resistance: 3, diplomacy: 3, navigation: 1, wisdom: 2, learning: 2, intelligence: 1, mysticism: 1, sorcery: 1 };
  const magicW = { wisdom: 8, mysticism: 5, intelligence: 5, sorcery: 4, learning: 4, luck: 3, logistics: 3, estates: 3, armorer: 2, scouting: 2, resistance: 3, leadership: 2, diplomacy: 2, navigation: 1, air: 4, fire: 4, water: 4, earth: 4 };
  function cls(id, name, faction, start, p1, p2, skills, magic, tweak) {
    D.CLASSES[id] = { name, faction, start, p1, p2, skills, magic };
    D.CLASS_SKILL_WEIGHTS[id] = Object.assign({}, magic ? magicW : mightW, tweak || {});
  }
  cls('alchemist', T('Алхимик'), 'academy', [1, 1, 2, 2], [30, 30, 20, 20], [30, 30, 20, 20], ['mysticism', 'scouting'], false, { mysticism: 6, intelligence: 4, wisdom: 4 });
  cls('wizard', T('Магьосник'), 'academy', [0, 0, 2, 3], [10, 10, 40, 40], [20, 20, 30, 30], ['wisdom', 'air'], true, { air: 7, water: 6 });
  cls('demoniac', T('Демонолог'), 'inferno', [2, 2, 1, 1], [35, 35, 15, 15], [30, 30, 20, 20], ['armorer', 'tactics'], false, { fire: 3 });
  cls('heretic', T('Еретик'), 'inferno', [1, 1, 2, 2], [15, 15, 35, 35], [25, 25, 25, 25], ['wisdom', 'fire'], true, { fire: 8 });
  cls('overlord', T('Властелин'), 'dungeon', [2, 2, 1, 1], [35, 35, 15, 15], [30, 30, 20, 20], ['offense', 'scouting'], false, { earth: 3 });
  cls('warlock', T('Чернокнижник'), 'dungeon', [0, 0, 3, 2], [10, 10, 50, 30], [20, 20, 30, 30], ['wisdom', 'earth'], true, { earth: 8, air: 5 });
  cls('barbarian', T('Варварин'), 'horde', [4, 0, 1, 1], [55, 35, 5, 5], [30, 30, 20, 20], ['offense', 'logistics'], false, { offense: 9, resistance: 5, wisdom: 1 });
  cls('battlemage', T('Боен маг'), 'horde', [2, 1, 1, 2], [30, 30, 20, 20], [25, 25, 25, 25], ['wisdom', 'offense'], true, { offense: 5, air: 5 });
  cls('beastmaster', T('Звероукротител'), 'marsh', [0, 4, 1, 1], [30, 60, 5, 5], [30, 30, 20, 20], ['armorer', 'pathfinding'], false, { armorer: 9 });
  cls('witch', T('Вещица'), 'marsh', [0, 1, 2, 2], [5, 15, 40, 40], [20, 20, 30, 30], ['wisdom', 'water'], true, { water: 7, earth: 5 });
  cls('planeswalker', T('Странник'), 'elements', [3, 1, 1, 1], [35, 35, 15, 15], [30, 30, 20, 20], ['tactics', 'air'], false, { air: 4, earth: 3 });
  cls('elementalist', T('Елементалист'), 'elements', [0, 0, 3, 3], [15, 15, 35, 35], [25, 25, 25, 25], ['wisdom', 'water'], true, { air: 6, fire: 6, water: 6, earth: 6 });
  cls('captain', T('Капитан'), 'harbor', [2, 2, 1, 1], [35, 35, 15, 15], [30, 30, 20, 20], ['navigation', 'offense'], false, { navigation: 6, luck: 5 });
  cls('navigator', T('Навигатор'), 'harbor', [1, 0, 2, 2], [15, 15, 35, 35], [25, 25, 25, 25], ['wisdom', 'navigation'], true, { navigation: 6, water: 7 });
  cls('mercenary', T('Наемник'), 'workshop', [3, 1, 1, 1], [40, 30, 15, 15], [30, 30, 20, 20], ['archery', 'estates'], false, { archery: 8, estates: 5 });
  cls('artificer', T('Изобретател'), 'workshop', [1, 1, 2, 2], [15, 15, 35, 35], [25, 25, 25, 25], ['wisdom', 'intelligence'], true, { intelligence: 7, earth: 5 });
  // Нови умения за всички класове
  Object.keys(D.CLASS_SKILL_WEIGHTS).forEach((k) => { const w = D.CLASS_SKILL_WEIGHTS[k]; w.diplomacy = Math.max(w.diplomacy || 0, 4); if (!w.navigation) w.navigation = 1; });
  D.SKILLS.diplomacy = { name: T('Дипломация'), desc: (l) => T('Съществата се присъединяват по-лесно; предаването струва ') + [20, 40, 60][l - 1] + T('% по-малко.') };
  D.SKILLS.navigation = { name: T('Мореплаване'), desc: (l) => '+' + [50, 100, 150][l - 1] + T('% движение по вода.') };

  Object.assign(D.HERO_NAMES, {
    academy: [T('Симеон'), T('Теодора'), T('Ясен Мъдри'), T('Рада'), T('Никифор'), T('Анастасия'), T('Пламен'), T('Зорница'), T('Методи'), T('Ирина')],
    inferno: [T('Огнян'), T('Жарава'), T('Пламък'), T('Сяра'), T('Черен Асен'), T('Пепел'), T('Въглен'), T('Искра'), T('Смола'), T('Жупел')],
    dungeon: [T('Мрак'), T('Сенка'), T('Бездан'), T('Тъмна Яна'), T('Гроз'), T('Отрова'), T('Кремен'), T('Нощен'), T('Черна Рада'), T('Бездън')],
    horde: [T('Крум'), T('Аспарух'), T('Буря'), T('Гръм'), T('Секира'), T('Вихра'), T('Ръмжан'), T('Кален'), T('Дивана'), T('Тарк')],
    marsh: [T('Тиня'), T('Блатан'), T('Отровка'), T('Мочур'), T('Влага'), T('Жабан'), T('Тресава'), T('Гущеран'), T('Змеяна'), T('Ръждан')],
    elements: [T('Вихрен'), T('Пламена'), T('Влага'), T('Камен'), T('Искра'), T('Струя'), T('Лъчезар'), T('Зефира'), T('Ясна'), T('Стихиян')],
    harbor: [T('Морян'), T('Пяна'), T('Котва'), T('Вълна'), T('Корабан'), T('Соленка'), T('Прилив'), T('Бисера'), T('Рибан'), T('Кормила')],
    workshop: [T('Зъбчо'), T('Винтана'), T('Барут'), T('Медяна'), T('Стоман'), T('Пружина'), T('Ковач'), T('Искряна'), T('Динамит'), T('Болтан')]
  });

  // ---------------------------------------------------------------- специалности
  // kind: creature (по-силно същество от фракцията), skill (умение ×1.5 при... +5% на ниво), spell (+3 сила за магията), resource (+доход)
  D.SPECIALTY_KINDS = ['creature', 'skill', 'spell', 'resource'];
  D.specialtyText = (sp) => {
    if (!sp) return '';
    if (sp.kind === 'creature') { const c = D.creatureOf(sp.id); return c.name + T(': +1 атака и защита на всеки 3 нива, +1 скорост.'); }
    if (sp.kind === 'skill') return D.SKILLS[sp.id].name + T(': ефектът расте с 5% на ниво на героя.');
    if (sp.kind === 'spell') return D.spellById[sp.id].name + T(': магията е с +3 сила и струва 1 мана по-малко.');
    if (sp.kind === 'resource') return sp.id === 'gold' ? T('+350 злато на ден.') : '+1 ' + D.RES_NAME[sp.id].toLowerCase() + T(' на ден.');
    return '';
  };

  // ---------------------------------------------------------------- артефакти и комплекти
  const A = D.ARTIFACTS;
  function art(id, name, slot, cls, bonus, desc, set) { const a = { id, name, slot, cls, bonus, desc, set }; A.push(a); D.artById[id] = a; }
  art('dawn_helm', T('Шлем на зората'), 'head', 2, { know: 2, def: 1 }, T('Познание +2, защита +1.'), 'dawn');
  art('dawn_plate', T('Ризница на зората'), 'torso', 2, { def: 3, att: 1 }, T('Защита +3, атака +1.'), 'dawn');
  art('dawn_shield', T('Щит на зората'), 'shield', 2, { def: 3 }, T('Защита +3.'), 'dawn');
  art('dawn_blade', T('Острие на зората'), 'weapon', 2, { att: 3 }, T('Атака +3.'), 'dawn');
  art('storm_cape', T('Плащ на бурята'), 'shoulders', 2, { pow: 2, school: 'air', spellDmg: 25 }, T('Сила +2, въздушни магии +25%.'), 'storm');
  art('storm_ring', T('Пръстен на бурята'), 'ring', 2, { pow: 1, manaRegen: 1 }, T('Сила +1, +1 мана на ден.'), 'storm');
  art('storm_staff', T('Жезъл на бурята'), 'weapon', 3, { pow: 3, know: 1 }, T('Сила +3, познание +1.'), 'storm');
  art('wolf_pelt', T('Вълча кожа'), 'shoulders', 1, { att: 1, moveBonus: 200 }, T('Атака +1, движение +200.'), 'wolf');
  art('wolf_boots', T('Вълчи ботуши'), 'feet', 2, { moveBonus: 400, luck: 1 }, T('Движение +400, късмет +1.'), 'wolf');
  art('wolf_fang', T('Вълчи зъб'), 'neck', 1, { att: 2 }, T('Атака +2.'), 'wolf');
  art('sea_compass', T('Компас на моряка'), 'misc', 1, { seaMove: 500 }, T('+500 движение по вода.'));
  art('sea_charm', T('Амулет на прилива'), 'neck', 2, { seaMove: 1000, luck: 1 }, T('+1000 движение по вода, късмет +1.'));
  art('miners_pick', T('Кирка на рудокопача'), 'misc', 2, { resIncome: 'ore' }, T('+1 руда на ден.'));
  art('lumber_axe', T('Секира на дърваря'), 'misc', 2, { resIncome: 'wood' }, T('+1 дърво на ден.'));
  art('alchemist_vial', T('Стъкленица на алхимика'), 'misc', 3, { resIncome: 'mercury' }, T('+1 живак на ден.'));
  art('cursed_skull', T('Прокълнат череп'), 'misc', 3, { necromancy: 1, morale: -1 }, T('Некромантия +1 степен, морал −1.'));
  art('archers_glove', T('Ръкавица на стрелеца'), 'misc', 2, { archery: 1 }, T('Стрелба +1 степен.'));
  art('shield_of_faith', T('Щит на вярата'), 'shield', 3, { def: 4, resistance: 1 }, T('Защита +4, съпротива +1 степен.'));
  art('tome_earth', T('Том на земята'), 'misc', 3, { spellsOf: 'earth' }, T('Героят знае всички магии на земята.'));
  art('tome_fire', T('Том на огъня'), 'misc', 3, { spellsOf: 'fire' }, T('Героят знае всички магии на огъня.'));
  art('tome_air', T('Том на въздуха'), 'misc', 3, { spellsOf: 'air' }, T('Героят знае всички магии на въздуха.'));
  art('tome_water', T('Том на водата'), 'misc', 3, { spellsOf: 'water' }, T('Героят знае всички магии на водата.'));
  art('speculum', T('Далекоглед'), 'misc', 1, { scouting: 2 }, T('Видимост +2.'));
  art('angel_wings', T('Крила на ангела'), 'shoulders', 3, { flyMove: 1 }, T('Героят лети над препятствия по картата (цена ×1.5).'));
  D.ART_SETS = {
    dawn: { name: T('Доспехи на зората'), parts: ['dawn_helm', 'dawn_plate', 'dawn_shield', 'dawn_blade'], bonus: { att: 3, def: 3, morale: 1 }, desc: T('Пълен комплект: атака и защита +3, морал +1, армията е неуязвима за Проклятие и Слабост.') },
    storm: { name: T('Одежди на бурята'), parts: ['storm_cape', 'storm_ring', 'storm_staff'], bonus: { pow: 3, know: 3 }, desc: T('Пълен комплект: сила и познание +3, всички въздушни магии на експертно ниво.') },
    wolf: { name: T('Вълчи дар'), parts: ['wolf_pelt', 'wolf_boots', 'wolf_fang'], bonus: { moveBonus: 400, att: 1 }, desc: T('Пълен комплект: движение +400, атака +1, армията има +2 скорост.') }
  };

  // ---------------------------------------------------------------- сгради: корабостроителница
  D.BUILDINGS.push({ id: 'shipyard', name: T('Корабостроителница'), cost: { gold: 2000, wood: 20 }, req: ['fort1'], coastal: true, desc: T('Строи кораби (1000 злато, 10 дърво). Само за градове до вода.') });
  D.buildingById.shipyard = D.BUILDINGS[D.BUILDINGS.length - 1];
  D.OBJECTS.boat = { name: T('Кораб'), desc: T('Качи се и плавай по водата.') };
  D.OBJECTS.gate = { name: T('Подземна порта'), desc: T('Води към другото ниво на света.') };
  D.OBJECTS.whirlpool = { name: T('Водовъртеж'), desc: T('Пренася кораба до друг водовъртеж.') };
  D.OBJECTS.lighthouse = { name: T('Фар'), desc: T('+500 движение по вода за корабите на притежателя.') };
  D.OBJECTS.sea_chest = { name: T('Морски сандък'), desc: T('Съкровище сред вълните.') };
  D.OBJECTS.shipwreck = { name: T('Корабокрушение'), desc: T('Останки — понякога със злато и артефакт.') };

  // ---------------------------------------------------------------- шаблони за карти
  D.TEMPLATES = [
    { id: 'balanced', name: T('Балансирана'), desc: T('Класическа карта: равни зони, умерени пазачи, езера.'), water: 0.78, monsterMult: 1, resMult: 1, underground: true, neutralTownsExtra: 0 },
    { id: 'rich', name: T('Богата'), desc: T('Много ресурси и артефакти, повече мини — бърз растеж.'), water: 0.8, monsterMult: 1.1, resMult: 1.8, underground: true, neutralTownsExtra: 1, extraMines: 4 },
    { id: 'islands', name: T('Острови'), desc: T('Море между играчите — без корабостроителница няма среща.'), water: 0.62, monsterMult: 0.9, resMult: 1.1, underground: false, neutralTownsExtra: 0, islands: true },
    { id: 'underworld', name: T('Подземен свят'), desc: T('Голямо подземие с богатства и опасни пазачи.'), water: 0.8, monsterMult: 1.2, resMult: 1.2, underground: true, undergroundRich: true, neutralTownsExtra: 1 },
    { id: 'duel', name: T('Дуел'), desc: T('Малко пазачи, близки градове — бърз сблъсък.'), water: 0.85, monsterMult: 0.6, resMult: 1, underground: false, neutralTownsExtra: 0, close: true }
  ];
  D.TEMPLATE = (id) => D.TEMPLATES.find((t) => t.id === id) || D.TEMPLATES[0];
  D.SEA_MOVEMENT = 1500;
})();
