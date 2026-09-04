/* Детерминиран генератор на случайни числа (mulberry32) + помощни функции */
(function () {
  'use strict';
  const MK = (window.MK = window.MK || {});
  class RNG {
    constructor(seed) { this.s = (seed >>> 0) || 0x9e3779b9; }
    next() {
      let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    chance(p) { return this.next() < p; }
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    }
    // Избор по тежести: obj {key: weight}
    weighted(obj) {
      let sum = 0; for (const k in obj) sum += obj[k];
      let r = this.next() * sum;
      for (const k in obj) { r -= obj[k]; if (r <= 0) return k; }
      return Object.keys(obj)[0];
    }
  }
  MK.RNG = RNG;
  MK.hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  // Проста 2D стойностна шумова функция (детерминирана от seed)
  MK.noise2 = function (seed) {
    const hash = (x, y) => {
      let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + seed;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    };
    const lerp = (a, b, t) => a + (b - a) * t;
    const fade = (t) => t * t * (3 - 2 * t);
    return function (x, y) {
      const x0 = Math.floor(x), y0 = Math.floor(y);
      const tx = fade(x - x0), ty = fade(y - y0);
      return lerp(lerp(hash(x0, y0), hash(x0 + 1, y0), tx), lerp(hash(x0, y0 + 1), hash(x0 + 1, y0 + 1), tx), ty);
    };
  };
})();
