/* Езици: речниците са в web/i18n/<код>.json (ключ = българският текст). MK.T(текст) връща превода
   или самия текст. Данните (имена и описания) се превеждат след зареждане чрез MK.i18n.applyData(). */
(function () {
  'use strict';
  const MK = (window.MK = window.MK || {});
  const LANGS = [['bg', 'Български'], ['en', 'English'], ['ru', 'Русский'], ['zh', '中文'], ['ja', '日本語'], ['hi', 'हिन्दी']];
  let lang = 'bg', dict = {};
  try { lang = localStorage.getItem('mk_lang') || (navigator.language || 'bg').slice(0, 2); } catch (e) { /* noop */ }
  if (!LANGS.some((l) => l[0] === lang)) lang = 'bg';
  const T = (s) => (typeof s === 'string' && dict[s]) || s;
  MK.T = T;
  MK.i18n = {
    LANGS, get lang() { return lang; },
    /* Зарежда речника (синхронно през XHR, за да е готов преди данните) */
    load(code) {
      lang = code; dict = {};
      if (code === 'bg') return;
      try { const x = new XMLHttpRequest(); x.open('GET', 'i18n/' + code + '.json', false); x.overrideMimeType('application/json'); x.send(); if (x.status === 200 || x.status === 0) dict = JSON.parse(x.responseText) || {}; } catch (e) { dict = {}; }
    },
    set(code) { try { localStorage.setItem('mk_lang', code); } catch (e) { /* noop */ } location.reload(); },
    /* Превежда имена/описания в данните на място (оригиналът се пази в _bg) */
    applyData() {
      const D = MK.data; if (!D || lang === 'bg') return;
      const tr = (o) => { if (!o || typeof o !== 'object') return; ['name', 'desc', 'rare', 'text', 'win', 'intro', 'title', 'label', 'difficulty'].forEach((k) => { if (typeof o[k] === 'string' && dict[o[k]]) { o['_bg_' + k] = o[k]; o[k] = dict[o[k]]; } }); };
      const walk = (c) => { if (!c) return; if (Array.isArray(c)) c.forEach(tr); else Object.values(c).forEach(tr); };
      ['FACTIONS', 'CREATURES', 'BUILDINGS', 'ARTIFACTS', 'SPELLS', 'SKILLS', 'TERRAIN', 'RES_NAME', 'PLAYER_COLORS', 'TEMPLATES', 'DIFFICULTY', 'MAP_SIZES', 'CLASSES', 'SPECIALTIES', 'SETS'].forEach((k) => walk(D[k]));
      if (D.OBJECTS) Object.values(D.OBJECTS).forEach(tr);
      if (D.RES_NAME) for (const r in D.RES_NAME) if (dict[D.RES_NAME[r]]) D.RES_NAME[r] = dict[D.RES_NAME[r]];
      if (D.COUNT_RANGES) D.COUNT_RANGES.forEach((r) => { if (dict[r[2]]) r[2] = dict[r[2]]; });
      if (D.HERO_NAMES) for (const f in D.HERO_NAMES) D.HERO_NAMES[f] = D.HERO_NAMES[f].map((n) => dict[n] || n);
      (MK.CAMPAIGNS || []).forEach((C) => { tr(C); C.scenarios.forEach((sc) => { tr(sc); (sc.bonuses || []).forEach(tr); }); });
    }
  };
  MK.i18n.load(lang);
  try { document.documentElement.lang = lang; } catch (e) { /* noop */ }
})();
