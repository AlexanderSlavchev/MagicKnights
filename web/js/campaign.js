/* Кампании: всяка е поредица от сценарии с история; героят се пренася между тях.
   Всеки сценарий има избор на начален бонус (както в класиките), а някои — специална цел
   или срок в дни. Бонуси: gold, res, art, creatures, spell, xp. Цели: towns, level. */
(function () {
  'use strict';
  const MK = (window.MK = window.MK || {});
  const gold = (n) => ({ label: n + ' злато', type: 'gold', n });
  const res = (label, r) => ({ label, type: 'res', r });
  const art = (aid, label) => ({ label, type: 'art', aid });
  const cre = (cid, n, label) => ({ label, type: 'creatures', cid, n });
  const spell = (sid, label) => ({ label, type: 'spell', sid });
  const xp = (n) => ({ label: n + ' опит', type: 'xp', n });

  MK.CAMPAIGNS = [
    {
      id: 'crown', title: 'Короната на Белоград', faction: 'kingdom', difficulty: 'Начинаеща',
      intro: 'Старият крал умря без наследник и короната на Белоград остана без глава. Ти, млад пълководец от граничните земи, събираш малка дружина, за да върнеш реда — а всяка победа ще ти отвори път към следващата земя.',
      scenarios: [
        { id: 1, title: 'Граничната застава', size: 36, difficulty: 0, template: 'duel', playerFaction: 'kingdom', opponents: ['necropolis'],
          text: 'Немъртви от изток прекосяват границата и опустошават селата около заставата. Превземи техния град, преди да се укрепят. Първата победа ще ти даде име.',
          win: 'Заставата е спасена, а името ти вече се носи из кралството. Но на запад горските народи затварят пътищата.',
          bonuses: [gold(3000), cre('kingdom2', 12, '12 стрелци'), art('shield_oak', 'Дъбов щит')] },
        { id: 2, title: 'Гората на мълчанието', size: 54, difficulty: 1, template: 'balanced', playerFaction: 'kingdom', opponents: ['grove', 'horde'],
          text: 'Горското царство и ордата от пустошта са сключили съюз срещу Белоград. Двама противници, две посоки — избери правилната. Ще ти трябват мини, гилдия и втори герой.',
          win: 'Гората е отворена, ордата се оттегля в пустошта. Морето на юг чака кораби.',
          bonuses: [res('10 дърво и 10 руда', { wood: 10, ore: 10 }), cre('kingdom3', 4, '4 грифона'), spell('haste', 'магия Ускорение')] },
        { id: 3, title: 'Островите на пристана', size: 54, difficulty: 1, template: 'islands', playerFaction: 'kingdom', opponents: ['harbor', 'marsh'],
          text: 'Пиратите от Пристана владеят проливите, а в блатата се крият горгони. Само с корабостроителница и смели капитани ще стигнеш до враговете си. Пази се от водовъртежите.',
          win: 'Флотът на Пристана гори, а блатата мълчат. Под краката ти обаче нещо кънти: подземието се отваря.',
          bonuses: [art('sea_compass', 'Компас на моряка'), gold(5000), cre('kingdom4', 8, '8 мечоносци')] },
        { id: 4, title: 'Подземният сблъсък', size: 54, difficulty: 2, template: 'underworld', playerFaction: 'kingdom', opponents: ['dungeon', 'inferno'],
          text: 'Чернокнижниците на Подземието и демоните на Пъкъла делят богатствата под земята. Слез през портите, вземи мините им и ги разбий в собствените им пещери.',
          win: 'Подземието е прочистено, а съкровищата му пълнят хазната на Белоград. Остава последният претендент за короната.',
          bonuses: [art('armor_plate', 'Ризница на пазителя'), cre('kingdom5', 6, '6 монаси'), spell('lightning', 'магия Мълния')] },
        { id: 5, title: 'Короната', size: 72, difficulty: 2, template: 'rich', playerFaction: 'kingdom', opponents: ['academy', 'elements', 'workshop'],
          text: 'Академията, Стихиите и Работилницата издигат собствени кандидати за трона. Голяма и богата карта, трима противници, никакви извинения. Победи ги и короната е твоя.',
          win: 'Короната на Белоград е на главата ти. Кралството е обединено — а летописците вече пишат за твоите походи.',
          bonuses: [art('crown_kings', 'Кралска корона'), cre('kingdom6', 4, '4 конника'), gold(8000)] }
      ]
    },
    {
      id: 'bones', title: 'Сянката на костите', faction: 'necropolis', difficulty: 'Средна',
      intro: 'Изгонен от Академията заради забранени опити, магът Черномор се заселва в изоставен некропол. Там открива, че мъртвите слушат по-добре от живите. Тази кампания се играе от страната на тъмнината: всяка победа пълни редиците ти с нови мъртъвци.',
      scenarios: [
        { id: 1, title: 'Изоставеният некропол', size: 36, difficulty: 0, template: 'duel', playerFaction: 'necropolis', opponents: ['kingdom'],
          text: 'Малък гарнизон на Кралството пази долината около стария некропол. Събуди костите в гробището, вдигни скелетна армия и превземи заставата им.',
          win: 'Заставата падна, а падналите ѝ защитници се изправиха отново — вече под твоето знаме.',
          bonuses: [cre('necropolis1', 30, '30 скелета'), spell('slow', 'магия Забавяне'), gold(3000)] },
        { id: 2, title: 'Гласът на гората', size: 54, difficulty: 1, template: 'balanced', playerFaction: 'necropolis', opponents: ['grove', 'academy'],
          text: 'Академията е пратила бившите ти колеги да те спрат, а елфите на гората ги подкрепят. Изгори гората и покажи на Академията какво са изгонили. Достигни ниво 12 с Черномор — умът е по-важен от армията.',
          win: 'Академията мълчи. Кулите ѝ ще станат гробници.',
          goal: { type: 'level', n: 12 },
          bonuses: [art('cursed_skull', 'Прокълнат череп'), cre('necropolis3', 8, '8 призрака'), xp(2000)] },
        { id: 3, title: 'Пактът с подземието', size: 54, difficulty: 2, template: 'underworld', playerFaction: 'necropolis', opponents: ['dungeon', 'horde'],
          text: 'Чернокнижниците на Подземието предлагат съюз — но само ако докажеш силата си. Ордата от пустошта е пробният камък. Слез под земята и завладей 4 града до 90-ия ден.',
          win: 'Подземието коленичи. Вампирските ти лордове вече обикалят и техните пещери.',
          goal: { type: 'towns', n: 4 }, days: 90,
          bonuses: [cre('necropolis4', 6, '6 вампира'), spell('animate_dead', 'магия Вдигане на мъртви'), res('15 руда и 10 живак', { ore: 15, mercury: 10 })] },
        { id: 4, title: 'Кралството на живите', size: 72, difficulty: 2, template: 'rich', playerFaction: 'necropolis', opponents: ['kingdom', 'grove', 'harbor'],
          text: 'Белоград, гората и пристанът се обединяват срещу мъртвата заплаха. Голяма карта, трима живи врагове. Всяка тяхна загубена битка е твоя нова армия.',
          win: 'Над Белоград се вее черно знаме. Мъртвите вече не се страхуват от зората — зората се страхува от тях.',
          bonuses: [art('orb_storm', 'Кълбо на гръмотевицата'), cre('necropolis6', 4, '4 черни рицаря'), gold(10000)] }
      ]
    },
    {
      id: 'blade', title: 'Острието на зората', faction: 'grove', difficulty: 'Средна',
      intro: 'Портите на Пъкъла се отварят и демонски орди изгарят пограничните земи. Според старите елфически летописи само Острието на зората — комплект от четири части — може да затвори портите. Тръгни по следите му през гора, море и огън; всяка спечелена част остава у героя.',
      scenarios: [
        { id: 1, title: 'Първата искра', size: 36, difficulty: 1, template: 'duel', playerFaction: 'grove', opponents: ['inferno'],
          text: 'Демоните са прегазили долината. Първата част — Шлемът на зората — е у водача им. Разбий предната им армия и превземи горящия им град.',
          win: 'Шлемът на зората е у теб. Летописите сочат на юг, към морето.',
          bonuses: [art('dawn_helm', 'Шлем на зората'), cre('grove3', 10, '10 елфи'), spell('bless', 'магия Благослов')] },
        { id: 2, title: 'Морето на пепелта', size: 54, difficulty: 1, template: 'islands', playerFaction: 'grove', opponents: ['harbor', 'inferno'],
          text: 'Пиратите държат втората част — Щита на зората — в островно светилище, а демоните ги следват по петите. Построй кораби и стигни до островите преди огъня.',
          win: 'Щитът на зората е спасен от вълните. Следващата част е в ръцете на Работилницата.',
          bonuses: [art('dawn_shield', 'Щит на зората'), art('sea_charm', 'Амулет на прилива'), cre('grove4', 5, '5 пегаса')] },
        { id: 3, title: 'Ковачницата', size: 54, difficulty: 2, template: 'balanced', playerFaction: 'kingdom', opponents: ['workshop', 'dungeon'],
          text: 'Инженерите на Работилницата са претопили Ризницата на зората в машина, а Подземието иска остатъците. Този път командваш рицарите на Белоград, дошли на помощ. Покори 3 града до 80-ия ден, иначе машината е готова.',
          win: 'Ризницата е извадена от машината. Остава самото острие — а то е в Пъкъла.',
          goal: { type: 'towns', n: 3 }, days: 80,
          bonuses: [art('dawn_plate', 'Ризница на зората'), cre('kingdom3', 6, '6 грифона'), gold(6000)] },
        { id: 4, title: 'Портите на пъкъла', size: 72, difficulty: 2, template: 'underworld', playerFaction: 'grove', opponents: ['inferno', 'inferno', 'dungeon'],
          text: 'Двама демонски принцове и чернокнижниците пазят острието в най-дълбоката пещера. С трите части на комплекта под ръка, вземи четвъртата от ръцете им. Победи всички и затвори портите.',
          win: 'Острието на зората е цяло. Портите на Пъкъла се затварят с тътен, който ще помнят поколения.',
          bonuses: [art('dawn_blade', 'Острие на зората'), cre('grove7', 2, '2 зелени дракона'), spell('resurrection', 'магия Възкресение')] }
      ]
    },
    {
      id: 'depths', title: 'Огън и мрак', faction: 'dungeon', difficulty: 'Трудна',
      intro: 'Чернокнижникът Мортус и демонската княгиня Аскара сключват съюз: Подземието ще получи горните земи, а Пъкълът — душите им. Играеш ту от едната, ту от другата страна на този съюз, докато не остане само един господар.',
      scenarios: [
        { id: 1, title: 'Тунелите', size: 36, difficulty: 1, template: 'underworld', playerFaction: 'dungeon', opponents: ['horde'],
          text: 'Ордата е нахлула в горните ти тунели. Мортус трябва да ги прочисти сам, преди Аскара да види слабост. Използвай портите между нивата.',
          win: 'Тунелите са твои. Аскара праща поздрави — и предупреждение.',
          bonuses: [cre('dungeon2', 15, '15 харпии'), spell('magic_arrow', 'магия Магическа стрела'), gold(4000)] },
        { id: 2, title: 'Огнена жътва', size: 54, difficulty: 1, template: 'balanced', playerFaction: 'inferno', opponents: ['kingdom', 'marsh'],
          text: 'Сега водиш демоните на Аскара. Кралството и блатните племена държат плодородните долини. Изгори ги: 4 града до 75-ия ден.',
          win: 'Долините горят, а душите им пълнят пещите на Пъкъла. Мортус обаче се пазари за твоята част.',
          goal: { type: 'towns', n: 4 }, days: 75,
          bonuses: [cre('inferno3', 10, '10 адски хрътки'), art('orb_fire', 'Кълбо на пламъка'), spell('fireball', 'магия Огнено кълбо')] },
        { id: 3, title: 'Нощта на ножовете', size: 54, difficulty: 2, template: 'rich', playerFaction: 'dungeon', opponents: ['academy', 'elements'],
          text: 'Академията и Стихиите пращат обединена армия срещу съюза. Мортус трябва да я разбие с драконите си, а Аскара „забравя“ да помогне. Достигни ниво 15 — ще ти трябва за финала.',
          win: 'Академията е в руини. Черният дракон на Мортус е достатъчно силен да лети срещу самия Пъкъл.',
          goal: { type: 'level', n: 15 },
          bonuses: [cre('dungeon7', 1, '1 червен дракон'), art('book_wisdom', 'Книга на познанието'), xp(4000)] },
        { id: 4, title: 'Единственият господар', size: 72, difficulty: 3, template: 'underworld', playerFaction: 'dungeon', opponents: ['inferno', 'inferno', 'necropolis'],
          text: 'Съюзът е мъртъв. Аскара и брат ѝ държат по един град в дълбините, а Некрополът дебне и двамата. Победи всички. Няма втори шанс — трудността е максимална.',
          win: 'Мортус е единственият господар на дълбините. Огънят е угасен, мракът остава.',
          bonuses: [cre('dungeon7u', 1, '1 черен дракон'), art('shield_dragon', 'Драконов щит'), gold(15000)] }
      ]
    },
    {
      id: 'freedom', title: 'Освобождение', faction: 'elements', difficulty: 'Трудна',
      intro: 'Работилницата е поробила стихиите: вързала е елементалите за машините си. Планинската жрица Зоряна тръгва да ги освободи с малцината, които е събрала. Кампания за напреднали: кратки срокове и силни врагове.',
      scenarios: [
        { id: 1, title: 'Първата свобода', size: 36, difficulty: 1, template: 'duel', playerFaction: 'elements', opponents: ['workshop'],
          text: 'Една работилница, един поробен град на стихиите. Освободи го до 40-ия ден, иначе машините му ще бъдат довършени.',
          win: 'Елементалите се откъсват от веригите. Работилницата бие тревога.',
          days: 40,
          bonuses: [cre('elements1', 20, '20 феи'), spell('haste', 'магия Ускорение'), gold(3000)] },
        { id: 2, title: 'Пустинята на зъбните колела', size: 54, difficulty: 2, template: 'balanced', playerFaction: 'elements', opponents: ['workshop', 'horde'],
          text: 'Работилницата е наела ордата за охрана. Пясъкът е техен, планините — твои. Владей 3 града до 70-ия ден.',
          win: 'Зъбните колела спират. Пустинята диша отново.',
          goal: { type: 'towns', n: 3 }, days: 70,
          bonuses: [cre('elements4', 6, '6 огнени елементала'), art('boots_speed', 'Ботуши на бързината'), res('10 кристал и 10 скъпоценни камъни', { crystal: 10, gems: 10 })] },
        { id: 3, title: 'Сърцето на машината', size: 72, difficulty: 3, template: 'rich', playerFaction: 'elements', opponents: ['workshop', 'workshop', 'academy'],
          text: 'Главната работилница, нейният филиал и купената Академия. Три врага, огромна карта. Освободи всичко и стихиите ще бъдат свободни завинаги.',
          win: 'Машините мълчат. Вятър, вода, огън и земя се връщат там, откъдето са дошли — а Зоряна вече е легенда.',
          bonuses: [cre('elements7', 2, '2 огнени птици'), art('angel_wings', 'Крила на ангела'), spell('chain_lightning', 'магия Верижна мълния')] }
      ]
    },
    {
      id: 'father', title: 'Песен за бащата', faction: 'harbor', difficulty: 'Кратка',
      intro: 'Старият капитан Иво изчезва с кораба си в проливите. Дъщеря му Мирена наследява само една лодка, един пристан и упоритост. Три кратки сценария по море и суша в търсене на баща ѝ.',
      scenarios: [
        { id: 1, title: 'Празният пристан', size: 36, difficulty: 0, template: 'islands', playerFaction: 'harbor', opponents: ['marsh'],
          text: 'Блатните племена са блокирали проливите. Построй кораби и отвори пътя, за да тръгнеш по дирите на бащиния кораб.',
          win: 'Проливите са свободни. Рибарите шепнат за черни платна на север.',
          bonuses: [cre('harbor2', 15, '15 моряци'), art('sea_compass', 'Компас на моряка'), gold(2500)] },
        { id: 2, title: 'Черните платна', size: 54, difficulty: 1, template: 'islands', playerFaction: 'harbor', opponents: ['necropolis', 'harbor'],
          text: 'Некрополът е превърнал изчезналия екипаж в немъртви, а конкурентни пирати продават на всеки, който плати. Двама врагове по островите. Достигни ниво 10 с Мирена — ще ѝ трябва, за да преговаря с онова, което пази баща ѝ.',
          win: 'Черните платна горят. В трюма им — картата към последния остров.',
          goal: { type: 'level', n: 10 },
          bonuses: [cre('harbor5', 5, '5 морски вещици'), spell('ice_bolt', 'магия Ледена стрела'), art('sea_charm', 'Амулет на прилива')] },
        { id: 3, title: 'Островът на бащата', size: 54, difficulty: 2, template: 'islands', playerFaction: 'harbor', opponents: ['dungeon', 'inferno'],
          text: 'Капитан Иво е пленник в подземен затвор на острова, пазен от чернокнижници и демони. Превземи всичко и го върни у дома.',
          win: 'Бащата и дъщерята се прибират на един кораб. Пристанът пее.',
          bonuses: [cre('harbor7', 2, '2 морски змея'), gold(8000), art('helm_sage', 'Шлем на мъдреца')] }
      ]
    }
  ];
  MK.CAMPAIGN = MK.CAMPAIGNS[0];
  MK.campaignById = (id) => MK.CAMPAIGNS.find((c) => c.id === id) || MK.CAMPAIGNS[0];

  MK.Campaign = {
    key(id) { return id === 'crown' ? 'mk_campaign' : 'mk_campaign_' + id; },
    load(id) { try { return JSON.parse(localStorage.getItem(this.key(id || 'crown'))) || { done: 0, hero: null }; } catch (e) { return { done: 0, hero: null }; } },
    save(id, p) { try { localStorage.setItem(this.key(id || 'crown'), JSON.stringify(p)); } catch (e) { /* без място */ } },
    reset(id) { localStorage.removeItem(this.key(id || 'crown')); },
    /* Прилага избрания начален бонус върху света */
    applyBonus(w, pid, b) {
      const p = w.players[pid], h = w.heroes[p.heroes[0]];
      if (!b) return;
      if (b.type === 'gold') p.res.gold += b.n;
      if (b.type === 'res') for (const k in b.r) p.res[k] = (p.res[k] || 0) + b.r[k];
      if (b.type === 'art' && h) w.equipArtifact(h, b.aid);
      if (b.type === 'creatures' && h) MK.Army.add(h.army, b.cid, b.n);
      if (b.type === 'spell' && h) { if (!h.spells.includes(b.sid)) h.spells.push(b.sid); }
      if (b.type === 'xp' && h) w.gainXp(h, b.n);
    },
    /* Описание на целта на сценария */
    goalText(sc) {
      const g = sc.goal;
      let t = g ? (g.type === 'towns' ? 'Цел: владей ' + g.n + ' града.' : g.type === 'level' ? 'Цел: герой на ниво ' + g.n + '.' : '') : 'Цел: победи всички противници.';
      if (sc.days) t += ' Срок: ' + sc.days + ' дни.';
      return t;
    },
    /* true ако специалната цел е изпълнена */
    goalMet(w, pid, sc) {
      const g = sc.goal; if (!g) return false;
      const p = w.players[pid];
      if (g.type === 'towns') return p.towns.length >= g.n;
      if (g.type === 'level') return p.heroes.some((id) => w.heroes[id].level >= g.n);
      return false;
    }
  };
})();
