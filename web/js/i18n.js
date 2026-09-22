/* Езици: речниците са в web/i18n/<код>.json (ключ = българският текст). MK.T(текст) връща превода
   или самия текст. Данните (имена и описания) се превеждат след зареждане чрез MK.i18n.applyData(). */
(function () {
  'use strict';
  const MK = (window.MK = window.MK || {});
  const LANGS = [['bg', 'Български'], ['en', 'English'], ['ru', 'Русский'], ['zh', '中文'], ['ja', '日本語'], ['hi', 'हिन्दी']];
  // версията от собствения <script src=...?v=N> се добавя към JSON заявките, за да не се кешират стари речници
  const VER = (() => { try { const m = /[?&]v=([^&]+)/.exec((document.currentScript && document.currentScript.src) || ''); return m ? m[1] : String(Date.now()); } catch (e) { return String(Date.now()); } })();
  let lang = 'bg', dict = {};
  try { lang = localStorage.getItem('mk_lang') || (navigator.language || 'bg').slice(0, 2); } catch (e) { /* noop */ }
  if (!LANGS.some((l) => l[0] === lang)) lang = 'bg';
  const T = (s) => (typeof s === 'string' && dict[s]) || s;
  MK.T = T;

  MK.i18n = {
    LANGS, VER, get lang() { return lang; },
    /* Зарежда речника (синхронно през XHR, за да е готов преди данните) */
    load(code) {
      lang = code; dict = {};
      if (code === 'bg') return;
      try { const x = new XMLHttpRequest(); x.open('GET', 'i18n/' + code + '.json?v=' + VER, false); x.overrideMimeType('application/json'); x.send(); if (x.status === 200 || x.status === 0) dict = JSON.parse(x.responseText) || {}; } catch (e) { dict = {}; }
    },
    set(code) { try { localStorage.setItem('mk_lang', code); } catch (e) { /* noop */ } location.reload(); },
    /* Ключът (българският) на име, което може да е записано на кой да е от поддържаните езици */
    keyOf(s) {
      if (typeof s !== 'string') return s;
      if (!this._revAll) {
        this._revAll = {};
        LANGS.forEach(([code]) => { if (code === 'bg') return; try { const x = new XMLHttpRequest(); x.open('GET', 'i18n/' + code + '.json?v=' + VER, false); x.overrideMimeType('application/json'); x.send(); if (x.status === 200 || x.status === 0) { const d = JSON.parse(x.responseText); for (const k in d) if (!(d[k] in this._revAll)) this._revAll[d[k]] = k; } } catch (e) { /* noop */ } });
      }
      const suffix = / II$/.test(s) ? ' II' : ''; const base = suffix ? s.slice(0, -3) : s;
      return (this._revAll[base] || base) + suffix;
    },
    /* Превежда имената на градове и герои в света към текущия език (след нова игра или зареждане) */
    localizeWorld(w) {
      if (!w || !MK.i18n.keyOf) return;
      const fix = (o) => { if (o && typeof o.name === 'string') { const k = o.nameKey || this.keyOf(o.name); o.nameKey = k; o.name = T(k.replace(/ II$/, '')) + (/ II$/.test(k) ? ' II' : ''); } };
      Object.values(w.towns || {}).forEach(fix); Object.values(w.heroes || {}).forEach(fix);
      (w.map && w.map.objects || []).forEach((o) => { if (o.type === 'town') fix(o); });
    },
    /* Превежда всички текстове в данните на място: обхожда дълбоко D и кампаниите и заменя
       всеки низ, който има превод в речника (идентификаторите са на латиница и не се засягат) */
    applyData() {
      const D = MK.data; if (!D || lang === 'bg') return;
      const seen = new Set();
      const walk = (o, depth) => {
        if (!o || typeof o !== 'object' || seen.has(o) || depth > 8) return; seen.add(o);
        if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) { if (typeof o[i] === 'string') { if (dict[o[i]]) o[i] = dict[o[i]]; } else walk(o[i], depth + 1); } return; }
        for (const k in o) { const v = o[k]; if (typeof v === 'string') { if (dict[v]) o[k] = dict[v]; } else if (v && typeof v === 'object') walk(v, depth + 1); }
      };
      walk(D, 0); walk(MK.CAMPAIGNS || [], 0);
      // статични етикети в HTML
      document.querySelectorAll('[data-i18n]').forEach((el) => { const k = el.getAttribute('data-i18n'); if (dict[k]) el.textContent = dict[k]; if (el.title && dict[el.title]) el.title = dict[el.title]; });
    }
  };
  MK.i18n.load(lang);
  try { document.documentElement.lang = lang; } catch (e) { /* noop */ }
})();
