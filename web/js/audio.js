/* MagicKnights — музика и звуци.
   Музика: два <audio> слоя с плавен crossfade; терен на картата, град, битка, меню.
   Звуци: кратки стингери (победа, ниво, съкровище…). Настройките се пазят в localStorage. */
(function () {
  'use strict';
  const MK = (window.MK = window.MK || {});
  const BASE = 'audio/';
  const FADE = 1400; // ms

  const settings = Object.assign({ music: 0.7, sfx: 0.9, muted: false }, load());
  function load() { try { return JSON.parse(localStorage.getItem('mk_audio')) || {}; } catch (e) { return {}; } }
  function save() { try { localStorage.setItem('mk_audio', JSON.stringify(settings)); } catch (e) { /* без място */ } }

  let unlocked = false, current = null, currentName = null, fading = [];
  let mapTrack = null; // последно избраната тема на картата (за връщане след град/битка)
  const sfxCache = {};

  function mk(name, loop) {
    const a = new Audio(BASE + name + '.mp3');
    a.loop = !!loop; a.preload = 'auto'; a.volume = 0;
    return a;
  }
  function target() { return settings.muted ? 0 : settings.music; }

  // Плавно преминаване: старият слой затихва, новият се усилва.
  function music(name) {
    if (name === currentName) { if (current && current.paused && unlocked) current.play().catch(() => {}); return; }
    const old = current;
    currentName = name;
    if (!name) { current = null; if (old) fadeOut(old); return; }
    const a = mk(name, true);
    current = a;
    if (unlocked) a.play().catch(() => {});
    fadeTo(a, target(), FADE);
    if (old) fadeOut(old);
  }
  function fadeOut(a) { fadeTo(a, 0, FADE, () => { try { a.pause(); a.src = ''; } catch (e) { /* noop */ } }); }
  function fadeTo(a, vol, ms, done) {
    const from = a.volume, t0 = performance.now();
    const id = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      a.volume = from + (vol - from) * k;
      if (k >= 1) { clearInterval(id); fading = fading.filter((x) => x !== id); if (done) done(); }
    }, 40);
    fading.push(id);
  }

  function sfx(name) {
    if (settings.muted || !unlocked) return;
    let a = sfxCache[name];
    if (!a) { a = sfxCache[name] = mk(name, false); }
    try { a.currentTime = 0; a.volume = settings.sfx; a.play().catch(() => {}); } catch (e) { /* noop */ }
  }

  /* Пуска звук само за ms милисекунди и го затихва плавно накрая */
  function sfxClip(name, ms, fadeMs) {
    if (settings.muted || !unlocked) return;
    const a = mk(name, false); a.volume = settings.sfx; a.play().catch(() => {});
    setTimeout(() => fadeTo(a, 0, fadeMs || 600, () => { try { a.pause(); } catch (e) { /* noop */ } }), Math.max(0, ms - (fadeMs || 600)));
  }
  // Браузърите изискват първо докосване преди звук
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    if (current) current.play().catch(() => {});
  }
  ['pointerdown', 'touchstart', 'keydown', 'click'].forEach((ev) => window.addEventListener(ev, unlock, { once: false, passive: true }));

  // ---------------------------------------------------------------- игрови помощници
  const BATTLE = ['battle_1', 'battle_2', 'battle_3'];
  const A = (MK.Audio = {
    settings,
    music, sfx, sfxClip,
    menu() { mapTrack = null; music('main_theme'); },
    campaign() { mapTrack = null; music('campaign'); },
    /* Тема според терена под героя (или вода, ако е на кораб) */
    map(terrainKey) {
      const key = terrainKey || 'grass';
      mapTrack = 'terrain_' + key;
      music(mapTrack);
    },
    /* Връщане към картата след град/битка/екран */
    resumeMap() { if (mapTrack) music(mapTrack); },
    town(factionId) { music('town_' + factionId); },
    battle(siege) { sfx('battle_start'); music(siege ? 'battle_siege' : BATTLE[Math.floor(Math.random() * BATTLE.length)]); },
    battleEnd(humanWon) { if (humanWon === true) sfx('victory'); else if (humanWon === false) sfx('defeat'); },
    winGame() { mapTrack = null; music('win_game'); },
    loseGame() { mapTrack = null; music('lose_game'); },
    setMusic(v) { settings.music = v; save(); if (current) current.volume = target(); },
    setSfx(v) { settings.sfx = v; save(); },
    setMuted(m) { settings.muted = !!m; save(); if (current) current.volume = target(); },
    toggleMuted() { A.setMuted(!settings.muted); return settings.muted; }
  });
})();
