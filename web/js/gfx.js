/* Процедурна графика с високо ниво на детайл: текстурирани плочки, анимирана вода,
   многослойни гори и планини, фракционни градове, детайлни същества и герои.
   Всичко се рисува с код и се кешира по ключ. */
(function () {
  'use strict';
  const MK = (window.MK = window.MK || {});
  const D = MK.data;
  const cache = new Map();

  function sprite(key, w, h, draw) {
    let c = cache.get(key);
    if (c) return c;
    c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h);
    const g = c.getContext('2d');
    draw(g, w, h);
    cache.set(key, c);
    return c;
  }
  const hashN = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + (c || 0) * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const TAU = Math.PI * 2;

  // ---------------------------------------------------------------- цветове
  function parse(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function toHex(r, g, b) { return '#' + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1); }
  function shade(hex, f) { const [r, g, b] = parse(hex); const cl = (v) => Math.max(0, Math.min(255, v * f)); return toHex(cl(r), cl(g), cl(b)); }
  function mix(a, b, t) { const A = parse(a), B = parse(b); return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); }
  function rgba(hex, a) { const [r, g, b] = parse(hex); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; }
  MK.shade = shade; MK.mix = mix; MK.rgba = rgba;

  // ---------------------------------------------------------------- рисувателни помощници
  function ell(g, x, y, rx, ry, col) { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); }
  function circ(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  function poly(g, pts, col, strokeCol, lw) { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); if (col) { g.fillStyle = col; g.fill(); } if (strokeCol) { g.strokeStyle = strokeCol; g.lineWidth = lw || 1; g.stroke(); } }
  function rrect(g, x, y, w, h, r, col) { g.fillStyle = col; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); }
  function rgrad(g, x, y, r, c1, c2, ox, oy) { const gr = g.createRadialGradient(x + (ox || 0), y + (oy || 0), r * 0.1, x, y, r); gr.addColorStop(0, c1); gr.addColorStop(1, c2); return gr; }
  function lgrad(g, x0, y0, x1, y1, stops) { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach((s) => gr.addColorStop(s[0], s[1])); return gr; }
  function shadow(g, x, y, rx, ry, a) { ell(g, x, y, rx, ry, 'rgba(0,0,0,' + (a || 0.35) + ')'); }
  // Сфера със светлина от горе-ляво
  function sphere(g, x, y, r, col) { g.fillStyle = rgrad(g, x, y, r, shade(col, 1.35), shade(col, 0.6), -r * 0.35, -r * 0.35); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  // Кръгло дърво (широколистно)
  function leafTree(g, x, y, rad, col, dead) {
    shadow(g, x + rad * 0.2, y + rad * 0.15, rad * 1.1, rad * 0.35, 0.3);
    g.fillStyle = lgrad(g, x, y - rad, x, y + rad * 0.2, [[0, '#5a3e1e'], [1, '#2e1e0c']]); g.fillRect(x - rad * 0.12, y - rad * 0.6, rad * 0.24, rad * 0.9);
    if (dead) { g.strokeStyle = '#4a3a2a'; g.lineWidth = rad * 0.1; g.lineCap = 'round'; [[-0.7, -1.1], [0.6, -1.2], [-0.3, -1.5], [0.4, -0.6]].forEach(([dx, dy]) => { g.beginPath(); g.moveTo(x, y - rad * 0.5); g.quadraticCurveTo(x + dx * rad * 0.5, y - rad * 0.8, x + dx * rad, y + dy * rad); g.stroke(); }); return; }
    const c = [[0, -0.85, 0.75], [-0.55, -0.45, 0.62], [0.55, -0.5, 0.6], [0, -0.35, 0.7]];
    c.forEach(([dx, dy, k]) => sphere(g, x + dx * rad, y + dy * rad, rad * k, col));
    g.fillStyle = 'rgba(255,255,220,0.12)'; g.beginPath(); g.arc(x - rad * 0.25, y - rad * 1.05, rad * 0.35, 0, TAU); g.fill();
  }
  // Иглолистно дърво
  function pineTree(g, x, y, h, col, snow) {
    shadow(g, x + h * 0.1, y + h * 0.05, h * 0.4, h * 0.12, 0.3);
    g.fillStyle = '#3a2812'; g.fillRect(x - h * 0.05, y - h * 0.25, h * 0.1, h * 0.3);
    for (let i = 0; i < 3; i++) {
      const ty = y - h * (0.15 + i * 0.28), w = h * (0.42 - i * 0.1), hh = h * 0.42;
      g.fillStyle = lgrad(g, x - w, ty, x + w, ty, [[0, shade(col, 1.25)], [0.5, col], [1, shade(col, 0.55)]]);
      poly(g, [[x, ty - hh], [x + w, ty + hh * 0.1], [x - w, ty + hh * 0.1]], g.fillStyle);
      if (snow) poly(g, [[x, ty - hh], [x + w * 0.45, ty - hh * 0.35], [x - w * 0.45, ty - hh * 0.35]], 'rgba(255,255,255,0.85)');
    }
  }

  // ---------------------------------------------------------------- шум (периодичен, безшевен)
  const noiseA = MK.noise2(1234), noiseB = MK.noise2(777), noiseC = MK.noise2(4242), noiseD = MK.noise2(99), noiseE = MK.noise2(31337);
  // Периодичен стойностен шум: решетка от n клетки по период P — плочките се повтарят без шев
  function pnoise(seed, x, y, P, n) {
    const fx = x / P * n, fy = y / P * n;
    let x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    x0 = ((x0 % n) + n) % n; y0 = ((y0 % n) + n) % n;
    const x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
    const a = hashN(x0, y0, seed), b = hashN(x1, y0, seed), c = hashN(x0, y1, seed), d = hashN(x1, y1, seed);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  function pfbm(seed, x, y, P, n, oct) {
    let sum = 0, amp = 0.5, tot = 0;
    for (let i = 0; i < oct; i++) { sum += pnoise(seed + i * 101, x, y, P, n) * amp; tot += amp; amp *= 0.5; n *= 2; }
    return sum / tot;
  }
  // Периодичен клетъчен (Worley) шум: [разст. до най-близката точка, до втората, хеш на клетката]
  function pworley(x, y, P, n, seed) {
    const cell = P / n;
    let best = 1e9, second = 1e9, id = 0;
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const gx = ((cx + i) % n + n) % n, gy = ((cy + j) % n + n) % n;
      const px = (cx + i) * cell + hashN(gx, gy, seed) * cell, py = (cy + j) * cell + hashN(gy, gx, seed + 1) * cell;
      const d = (px - x) * (px - x) + (py - y) * (py - y);
      if (d < best) { second = best; best = d; id = hashN(gx, gy, seed + 2); } else if (d < second) second = d;
    }
    return [Math.sqrt(best) / cell, Math.sqrt(second) / cell, id];
  }
  const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
  // Палитри по височина/влажност — приглушени тонове като на аерофото
  const PAL = {
    1: ['#3b5a25', '#527a30', '#6d943b', '#93a752'],      // трева: сенчесто/влажно → слънчево → изсъхнало
    2: ['#54412c', '#735838', '#907046', '#ad8f62'],      // пръст
    3: ['#b39566', '#cfb07c', '#e3c993', '#f0dcb0'],      // пясък
    4: ['#c4d0de', '#dde5ee', '#eff4f9', '#ffffff'],      // сняг
    5: ['#37472c', '#4f6536', '#687c46', '#849556'],      // блато
    6: ['#665a4c', '#807262', '#9a8e7a', '#b8ac98'],      // пустош (камънак)
    7: ['#221819', '#382829', '#483838', '#584847'],      // лава (кора)
    8: ['#362d2f', '#4a3f41', '#5e5353', '#746767'],      // подземие
    9: ['#574b5b', '#766879', '#928495', '#aca0ac']       // пустиня (пустош)
  };
  function palColor(t, k) {
    const p = PAL[t] || PAL[1]; const n = p.length - 1; const f = Math.max(0, Math.min(0.9999, k)) * n; const i = Math.floor(f), r = f - i;
    const A = parse(p[i]), B = parse(p[Math.min(n, i + 1)]);
    return [A[0] + (B[0] - A[0]) * r, A[1] + (B[1] - A[1]) * r, A[2] + (B[2] - A[2]) * r];
  }
  const ATLAS_N = 4;   // атласът е ATLAS_N × ATLAS_N плочки — една голяма безшевна текстура
  /* Терен като заснет от въздуха: фрактален релеф, палитра по височина/влажност, релефно осветление
     от северозапад, петна суха трева, храсти със сенки, камъчета, дюни, снежни навеи, локви в блатото */
  function terrainAtlas(t, S) {
    return sprite('ta' + t + '_' + S, S * ATLAS_N, S * ATLAS_N, (g, P) => {
      P = Math.round(P);
      const img = g.createImageData(P, P); const d = img.data;
      const H = new Float32Array(P * P);
      const cobble = t === 6 || t === 8 || t === 9;
      for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) {
        let h = pfbm(11 + t, x, y, P, 6, 4);
        if (t === 3) {
          const warp = pfbm(61, x, y, P, 3, 2);
          const ph = (y + (warp - 0.5) * P * 0.22) / (P / 14) * TAU + x / (P / 2.5);
          h = 0.5 + 0.07 * Math.sin(ph) + (h - 0.5) * 0.9;
        } else if (cobble) { const [w1] = pworley(x, y, P, 18, 5 + t); h = h * 0.7 + (1 - Math.min(1, w1 * 1.35)) * 0.3; }
        else if (t === 7) { const [w1, w2] = pworley(x, y, P, 12, 71); h = h * 0.7 + Math.min(1, (w2 - w1) * 2) * 0.3; }
        else if (t === 4) { h = 0.45 + (h - 0.5) * 0.9 + (pnoise(15, x, y, P, 40) - 0.5) * 0.08; }
        H[y * P + x] = h;
      }
      const reliefK = t === 4 ? 5 : t === 3 ? 7 : cobble ? 5 : t === 7 ? 8 : t === 2 ? 4 : 2.2;
      for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) {
        const i = y * P + x;
        const h = H[i];
        const hx = H[y * P + ((x + 1) % P)] - H[y * P + ((x - 1 + P) % P)], hy = H[((y + 1) % P) * P + x] - H[((y - 1 + P) % P) * P + x];
        const light = Math.max(0.5, Math.min(1.5, 1 + (-hx - hy) * reliefK));
        const mid = pnoise(23 + t, x, y, P, 20), fine = pnoise(37 + t, x, y, P, 80), grain = pnoise(41, x, y, P, 220);
        let k = h * 0.6 + mid * 0.25 + fine * 0.15;
        let [r, gg, b] = palColor(t, k);
        let f = light * (0.9 + grain * 0.2);
        if (t === 1 || t === 5) {
          // сухи/пожълтели петна и по-влажни тъмни ивици
          const dry = pfbm(53 + t, x, y, P, 3, 2);
          if (dry > 0.58) { const w = Math.min(1, (dry - 0.58) * 3); r += 45 * w; gg += 18 * w; b -= 10 * w; }
          if (dry < 0.36) { const w = Math.min(1, (0.36 - dry) * 3); r -= 10 * w; gg -= 8 * w; f *= 1 - 0.06 * w; }
          // снопчета висока трева / тръстика
          if (fine > 0.74) { const w = (fine - 0.74) * 4; gg += t === 5 ? 6 : 10; r += t === 5 ? 18 * w : 0; f *= 0.94; }
          if (t === 5) {
            // локви застояла вода в ниските части
            if (h < 0.4) { const w = smooth((0.4 - h) / 0.1); const wr = 34, wg = 62, wb = 70; r = r * (1 - w) + wr * w; gg = gg * (1 - w) + wg * w; b = b * (1 - w) + wb * w; f = f * (1 - w) + (0.95 + (grain > 0.9 ? 0.5 : 0)) * w; }
          } else {
            // храсти: тъмнозелени куполи със сянка към югоизток
            const [w1, , id] = pworley(x, y, P, 14, 9);
            const [s1, , sid] = pworley(x - S * 0.05, y - S * 0.05, P, 14, 9);
            if (sid > 0.72 && s1 < 0.27 && !(id > 0.72 && w1 < 0.27)) f *= 0.72;
            if (id > 0.72 && w1 < 0.27) {
              const dome = 1 - w1 / 0.27; const lf = pnoise(19, x, y, P, 160);
              r = 46 + dome * 10; gg = 78 + dome * 22 + lf * 18; b = 30 + dome * 6;
              const [l1] = pworley(x + S * 0.02, y + S * 0.02, P, 14, 9);
              f = (l1 < w1 ? 1.15 : 0.78) * (0.9 + lf * 0.2);
            }
          }
        } else if (t === 2) {
          const [w1, , id] = pworley(x, y, P, 26, 17);
          if (id > 0.55 && w1 < 0.22) { const st = 0.9 + (0.22 - w1) * 2; r = 150 * st; gg = 138 * st; b = 122 * st; f *= (pworley(x + 1, y + 1, P, 26, 17)[0] < w1 ? 1.15 : 0.8); }
          if (fine > 0.8) f *= 0.9;
        } else if (t === 3) {
          if (grain > 0.93) f *= 1.12;
        } else if (t === 4) {
          if (grain > 0.86) { r = 255; gg = 255; b = 255; f = 1.05; }
          b += 22 * (1 - Math.min(1, light)); r -= 6 * (1 - Math.min(1, light));
          const [w1, , id] = pworley(x, y, P, 10, 33);
          if (id > 0.93 && w1 < 0.14) { const st = 0.9 + (0.14 - w1) * 1.5; r = 150 * st; gg = 146 * st; b = 150 * st; f *= (pworley(x + 1, y + 1, P, 10, 33)[0] < w1 ? 1.15 : 0.8); }
        } else if (t === 7) {
          const [w1, w2] = pworley(x, y, P, 12, 71); const crack = w2 - w1;
          if (crack < 0.05) { const glow = 1 - crack / 0.05; r = 190 + 65 * glow; gg = 60 + 100 * glow; b = 18; f = 1; }
          else if (crack < 0.1) { const w = 1 - (crack - 0.05) / 0.05; r += 50 * w; gg += 12 * w; }
        } else if (cobble) {
          const [w1, w2, id] = pworley(x, y, P, 18, 5 + t);
          const st = 0.9 + id * 0.2; r *= st; gg *= st; b *= st;
          if (w2 - w1 < 0.05) f *= 0.8;
          if (t === 9 && pworley(x, y, P, 7, 23)[1] - pworley(x, y, P, 7, 23)[0] < 0.04) f *= 0.7;
        }
        d[i * 4] = Math.max(0, Math.min(255, r * f)); d[i * 4 + 1] = Math.max(0, Math.min(255, gg * f)); d[i * 4 + 2] = Math.max(0, Math.min(255, b * f)); d[i * 4 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    });
  }
  // Изрязва клетка (S×S) от периодичен атлас с 1px рамка от съседните клетки (с превъртане) —
  // при мащабиране с изглаждане ръбовете вземат истинските съседни пиксели и няма шев
  function cutPadded(g, A, P, sx, sy, S) {
    const off = [-1, 0, S], len = [1, S, 1];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      const ax = ((sx + off[i]) % P + P) % P, ay = ((sy + off[j]) % P + P) % P;
      g.drawImage(A, ax, ay, len[i], len[j], off[i] + 1, off[j] + 1, len[i], len[j]);
    }
  }
  // Плочка = клетка (variant = col | row<<2) от атласа, с рамка: рисува се с drawImage(tile, 1, 1, S, S, …)
  function terrainTile(t, variant, S) {
    variant = variant & 15;
    return sprite('t' + t + '_' + variant + '_' + S, S + 2, S + 2, (g) => cutPadded(g, terrainAtlas(t, S), S * ATLAS_N, (variant & 3) * S, (variant >> 2) * S, S));
  }
  // Преход към съседен терен: текстурата на съседа, избледняваща от общия ръб с неравна граница (с рамка като плочките)
  function edgeBlend(nt, variant, dir, S) {
    return sprite('eb' + nt + '_' + (variant & 15) + '_' + dir + '_' + S, S + 2, S + 2, (g) => {
      g.drawImage(terrainTile(nt, variant, S), 0, 0);
      const img = g.getImageData(0, 0, S + 2, S + 2); const d = img.data;
      const [dx, dy] = MK.DIRS[dir];
      for (let y = 0; y < S + 2; y++) for (let x = 0; x < S + 2; x++) {
        const px = x - 1, py = y - 1;
        const e = dx ? (dx > 0 ? S - 1 - px : px) : (dy > 0 ? S - 1 - py : py);
        const along = dx ? py : px;
        const n = pnoise(77 + nt, along, 0, S, 5) * 0.7 + pnoise(79 + nt, along, 0, S, 13) * 0.3;
        const w = e / S + (n - 0.5) * 0.34;
        const a = smooth(1 - w / 0.5) * 0.92;
        d[(y * (S + 2) + x) * 4 + 3] = Math.round(255 * a);
      }
      g.putImageData(img, 0, 0);
    });
  }
  const WATER_N = 2;
  // Вода: дълбочинен цвят, вълни с нормали (светлина от северозапад), отблясъци; 8 кадъра в цикъл
  function waterAtlas(frame, S) {
    return sprite('wa' + frame + '_' + S, S * WATER_N, S * WATER_N, (g, P) => {
      P = Math.round(P);
      const img = g.createImageData(P, P); const d = img.data;
      const sh = frame / 8 * P;
      const W = new Float32Array(P * P);
      for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) {
        W[y * P + x] = pnoise(211, x + sh, y + sh * 0.3, P, 4) * 0.6 + pnoise(223, x - sh * 0.6, y + sh, P, 7) * 0.3 + pnoise(227, x + sh * 1.4, y - sh * 0.8, P, 13) * 0.1;
      }
      for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) {
        const i = y * P + x;
        const depth = pfbm(201, x, y, P, 5, 3) * 0.7 + 0.15;
        const wx = W[y * P + ((x + 1) % P)] - W[y * P + ((x - 1 + P) % P)], wy = W[((y + 1) % P) * P + x] - W[((y - 1 + P) % P) * P + x];
        const slope = (-wx - wy) * P * 0.028;
        let r = 14 + 24 * depth, gg = 62 + 56 * depth, b = 112 + 60 * depth;
        const f = 0.93 + slope * 0.45;
        const glint = Math.max(0, slope - 0.32) * 1.6;
        r = r * f + 190 * glint; gg = gg * f + 205 * glint; b = b * f + 215 * glint;
        d[i * 4] = Math.min(255, r); d[i * 4 + 1] = Math.min(255, gg); d[i * 4 + 2] = Math.min(255, b); d[i * 4 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    });
  }
  function waterTile(frame, variant, S) {
    variant = variant & 3;
    return sprite('w' + frame + '_' + variant + '_' + S, S + 2, S + 2, (g) => cutPadded(g, waterAtlas(frame, S), S * WATER_N, (variant & 1) * S, (variant >> 1) * S, S));
  }
  // Предварително изчисляване на атласите на фон (между кадрите), за да няма засичане при първо показване
  function warm(terrains, sizes) {
    const jobs = [];
    sizes.forEach((S) => terrains.forEach((t) => jobs.push(t === 0 ? () => { for (let f = 0; f < 8; f++) waterAtlas(f, 64); } : () => terrainAtlas(t, S))));
    const step = () => { const j = jobs.shift(); if (!j) return; j(); setTimeout(step, 30); };
    setTimeout(step, 50);
  }

  // Общо релефно осветление за пикселни спрайтове: нормала от височинна карта, светлина от северозапад
  const LX = -0.55, LY = -0.62, LZ = 0.56;
  function litFrom(nx, ny, kz) {
    const len = Math.hypot(nx * kz, ny * kz, 1);
    return Math.max(0, (nx * kz * LX + ny * kz * LY + LZ) / len);
  }
  /* Гора отгоре: корони като куполи с неравен ръб, листна текстура, светлина от северозапад,
     тъмни процепи между дърветата и сянка върху земята */
  function forest(g, S, W, Hh, crowns, conifer, colBase, seed) {
    const H = new Float32Array(W * Hh), own = new Int8Array(W * Hh).fill(-1);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      let h = 0, best = -1;
      for (let j = 0; j < crowns.length; j++) {
        const c = crowns[j];
        let d = Math.hypot(x - c.x, y - c.y) / c.r;
        d *= 1 + (noiseA((x + j * 37 + seed) / (S * 0.03), (y + j * 11) / (S * 0.03)) - 0.5) * 0.36;
        if (d >= 1) continue;
        const hh = conifer ? c.r * Math.pow(1 - d, 0.75) * 1.25 : c.r * Math.sqrt(1 - d * d) * (0.9 + 0.2 * noiseB((x + seed) / (S * 0.05), y / (S * 0.05)));
        if (hh > h) { h = hh; best = j; }
      }
      H[y * W + x] = h; own[y * W + x] = best;
    }
    const img = g.getImageData(0, 0, W, Hh); const d = img.data;
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, h = H[i];
      if (h <= 0) continue;
      const c = crowns[own[i]];
      const hl = x > 0 ? H[i - 1] : 0, hr = x < W - 1 ? H[i + 1] : 0, hu = y > 0 ? H[i - W] : 0, hd = y < Hh - 1 ? H[i + W] : 0;
      const lit = litFrom(hl - hr, hu - hd, 1.1);
      const leaf = noiseC((x + seed * 3) / (S * 0.017), y / (S * 0.017)), clump = noiseD((x + seed) / (S * 0.045), y / (S * 0.045));
      let f = 0.3 + lit * 0.95;
      f *= 0.82 + leaf * 0.3 + (clump - 0.5) * 0.2;
      if (h < c.r * 0.28) f *= 0.55 + (h / (c.r * 0.28)) * 0.45;   // процепи между короните
      const col = c.col;
      const a = Math.min(1, h / (S * 0.012));
      d[i * 4] = d[i * 4] * (1 - a) + Math.min(255, col[0] * f) * a; d[i * 4 + 1] = d[i * 4 + 1] * (1 - a) + Math.min(255, col[1] * f) * a; d[i * 4 + 2] = d[i * 4 + 2] * (1 - a) + Math.min(255, col[2] * f) * a;
      d[i * 4 + 3] = Math.max(d[i * 4 + 3], a * 255);
    }
    g.putImageData(img, 0, 0);
    // сянка върху земята (югоизток) под короните
    g.globalCompositeOperation = 'destination-over';
    crowns.forEach((c) => shadow(g, c.x + c.r * 0.5, c.y + c.r * 0.5, c.r * 1.05, c.r * 0.85, 0.4));
    g.globalCompositeOperation = 'source-over';
  }
  /* Планински масив отгоре: релефът е периодичен в световни координати (период 4×4 плочки), затова
     съседните планински плочки продължават хребетите си една в друга без шев; към свободните ръбове
     масивът завършва с неравен склон. Скални пластове, снежни шапки по полегатите върхове, сипеи в основата. */
  function mountain(g, S, W, Hh, base, terrain, variant, mask) {
    const rock = parse(terrain === 7 ? '#5a3a3a' : terrain === 4 ? '#8892a4' : terrain === 9 ? '#786a7e' : terrain === 8 ? '#665a62' : '#8a7c6c');
    const talus = parse(terrain === 7 ? '#3a2424' : terrain === 4 ? '#8a94a8' : terrain === 9 ? '#4a4050' : '#5a4e42');
    const nN = mask & 1, nE = mask & 2, nS = mask & 4, nW = mask & 8;
    const pr = (a, b) => a * b / Math.hypot(a, b);   // заоблен ъгъл между два свободни ръба
    const cx0 = variant & 3, cy0 = (variant >> 2) & 3;
    const H = new Float32Array(W * Hh);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const u = x / S, v = (y - base) / S;
      const gx = cx0 + u, gy = cy0 + v;
      const wx = gx + (pnoise(301, gx, gy, 4, 5) - 0.5) * 0.3, wy = gy + (pnoise(307, gx, gy, 4, 5) - 0.5) * 0.3;
      const big = pfbm(311, wx, wy, 4, 3, 2);
      const rg = (seed, n) => 1 - Math.abs(2 * pnoise(seed, wx, wy, 4, n) - 1);
      const rid = rg(317, 6) * 0.42 + rg(331, 14) * 0.3 + rg(337, 32) * 0.17 + rg(341, 70) * 0.11;
      let h = (0.45 + 0.55 * smooth((big - 0.3) / 0.45)) * (0.35 + 0.85 * Math.pow(rid, 1.3)) + (pnoise(347, gx, gy, 4, 120) - 0.5) * 0.03;
      // очертание
      const oz = pnoise(353, gx, gy, 4, 20) * 0.6 + pnoise(359, gx, gy, 4, 48) * 0.4;
      const dW = nW ? 1 : Math.max(0.001, u), dE = nE ? 1 : Math.max(0.001, 1 - u), dS = nS ? 1 : Math.max(0.001, 1 - v), dN = nN ? 1 : v + 0.14;
      let dd = Math.min(dW, dE, dS, dN);
      if (dN > 0) { if (!nW && !nN) dd = Math.min(dd, pr(dW, dN)); if (!nE && !nN) dd = Math.min(dd, pr(dE, dN)); }
      if (!nW && !nS) dd = Math.min(dd, pr(dW, dS)); if (!nE && !nS) dd = Math.min(dd, pr(dE, dS));
      let shape = smooth((dd - 0.05 + (oz - 0.5) * 0.24) / 0.14);
      if (nN && v < 0) shape *= smooth((v + 0.08) / 0.08);
      H[y * W + x] = h * shape;
    }
    const img = g.getImageData(0, 0, W, Hh); const d = img.data;
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, h = H[i];
      if (h < 0.025) continue;
      const u = x / S, v = (y - base) / S, gx = cx0 + u, gy = cy0 + v;
      const hl = x > 0 ? H[i - 1] : h, hr = x < W - 1 ? H[i + 1] : h, hu = y > 0 ? H[i - W] : h, hd = y < Hh - 1 ? H[i + W] : h;
      const nx = (hl - hr) * S * 1.0, ny = (hu - hd) * S * 1.0;
      const nlen = Math.hypot(nx, ny, 1);
      const lit = Math.max(0, (nx * -0.56 + ny * -0.62 + 0.55) / nlen);   // ниско слънце от северозапад: остри сенки
      const slope = Math.hypot(nx, ny);
      const rel = Math.min(1, h / 1.05);
      const strata = pnoise(367, gx, gy * 4, 4, 12);
      const grain = pnoise(373, gx, gy, 4, 260);
      let col = [rock[0], rock[1], rock[2]];
      const st = 0.78 + strata * 0.4;
      col = [col[0] * st, col[1] * st, col[2] * st];
      if (rel < 0.3) { const w = 1 - rel / 0.3; col = [col[0] * (1 - w) + talus[0] * w, col[1] * (1 - w) + talus[1] * w, col[2] * (1 - w) + talus[2] * w]; }
      const up = 0.8 + rel * 0.45; col = [col[0] * up, col[1] * up, col[2] * up];   // високото е по-светло (по-сухо, по-огряно)
      if (terrain !== 7) {
        const sn = smooth((rel - 0.55) / 0.14) * Math.max(0, 1 - slope * 0.14);
        if (sn > 0) col = [col[0] + (242 - col[0]) * sn, col[1] + (246 - col[1]) * sn, col[2] + (252 - col[2]) * sn];
      } else if (rel > 0.72) { const w = smooth((rel - 0.72) / 0.15); col = [col[0] + (235 - col[0]) * w, col[1] + (120 - col[1]) * w, col[2] * (1 - w) + 30 * w]; }
      let f = (0.34 + lit * 1.0) * (0.88 + grain * 0.24);
      const a = smooth((h - 0.025) / 0.05);
      d[i * 4] = d[i * 4] * (1 - a) + Math.min(255, col[0] * f) * a; d[i * 4 + 1] = d[i * 4 + 1] * (1 - a) + Math.min(255, col[1] * f) * a; d[i * 4 + 2] = d[i * 4 + 2] * (1 - a) + Math.min(255, col[2] * f) * a;
      d[i * 4 + 3] = Math.max(d[i * 4 + 3], a * 255);
    }
    g.putImageData(img, 0, 0);
    // сянка върху терена от югоизточните свободни склонове
    g.globalCompositeOperation = 'destination-over';
    if (!nS) shadow(g, S * 0.52, base + S * 0.98, S * 0.46, S * 0.11, 0.3);
    if (!nE) shadow(g, S * 0.99, base + S * 0.55, S * 0.1, S * 0.42, 0.3);
    g.globalCompositeOperation = 'source-over';
  }
  function decor(kind, variant, S, terrain, mask) {
    mask = mask || 0;
    return sprite('d' + kind + '_' + variant + '_' + S + '_' + terrain + '_' + mask, S, S * 1.25, (g) => {
      const r = (i) => hashN(i, variant, kind);
      const base = S * 0.25;
      const W = Math.ceil(S), Hh = Math.ceil(S * 1.25);
      if (kind === 1 || kind === 4) {
        const dead = kind === 4;
        const conifer = terrain === 4 || terrain === 6 || terrain === 9 || (terrain === 1 && r(30) > 0.55);
        const col = dead ? '#6a5a44' : terrain === 4 ? '#2f5a44' : terrain === 5 ? '#587a2c' : terrain === 8 ? '#5a4a7a' : conifer ? '#2d5c2c' : '#3d7a30';
        if (dead) {
          const n = 3 + Math.floor(r(1) * 3);
          for (let i = 0; i < n; i++) {
            const x = S * (0.2 + r(i) * 0.6), y = base + S * (0.2 + r(i + 5) * 0.6), k = 0.55 + r(i + 9) * 0.6;
            shadow(g, x + S * 0.04, y + S * 0.03, S * 0.1 * k, S * 0.06 * k, 0.3);
            g.strokeStyle = '#4e4034'; g.lineWidth = S * 0.022; g.lineCap = 'round';
            for (let b = 0; b < 6; b++) { const aa = b / 6 * TAU + r(b + i); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(aa) * S * 0.08 * k, y + Math.sin(aa) * S * 0.08 * k, x + Math.cos(aa + 0.4) * S * 0.17 * k, y + Math.sin(aa + 0.4) * S * 0.17 * k); g.stroke(); g.lineWidth = S * 0.012; g.beginPath(); g.moveTo(x + Math.cos(aa) * S * 0.08 * k, y + Math.sin(aa) * S * 0.08 * k); g.lineTo(x + Math.cos(aa - 0.5) * S * 0.14 * k, y + Math.sin(aa - 0.5) * S * 0.14 * k); g.stroke(); g.lineWidth = S * 0.022; }
            circ(g, x, y, S * 0.02 * k, '#3a2e24');
          }
          return;
        }
        const n = 4 + Math.floor(r(1) * 4);
        const crowns = [];
        const C = parse(col);
        for (let i = 0; i < n; i++) {
          const rad = S * (conifer ? 0.1 + r(i + 9) * 0.09 : 0.12 + r(i + 9) * 0.1);
          const hue = 0.82 + r(i + 20) * 0.36, yel = (r(i + 40) - 0.5) * 30;
          crowns.push({ x: S * (0.16 + r(i) * 0.68), y: base + S * (0.14 + r(i + 5) * 0.72), r: rad, col: [Math.max(0, C[0] * hue + yel), C[1] * hue + yel * 0.4, Math.max(0, C[2] * hue - yel * 0.3)] });
        }
        forest(g, S, W, Hh, crowns, conifer, col, variant * 13 + kind);
      } else if (kind === 2) {
        mountain(g, S, W, Hh, base, terrain, variant, mask);
      } else if (kind === 3) {
        for (let i = 0; i < 5; i++) {
          const x = S * (0.15 + r(i) * 0.7), y = base + S * (0.2 + r(i + 4) * 0.6), rad = S * (0.08 + r(i + 8) * 0.12);
          shadow(g, x + rad * 0.45, y + rad * 0.4, rad * 1.1, rad * 0.9, 0.35);
          const col = shade('#a08c74', 0.8 + r(i + 12) * 0.4);
          g.fillStyle = rgrad(g, x, y, rad, shade(col, 1.35), shade(col, 0.55), -rad * 0.4, -rad * 0.4);
          g.beginPath(); for (let s = 0; s < 8; s++) { const aa = s / 8 * TAU; const rq = rad * (0.8 + hashN(s, i, variant) * 0.35); g.lineTo(x + Math.cos(aa) * rq, y + Math.sin(aa) * rq); } g.closePath(); g.fill();
        }
      } else if (kind === 5) {
        g.fillStyle = '#231c20'; g.fillRect(0, base, S, S);
        for (let i = 0; i < 9; i++) { const x = r(i) * S, y = base + r(i + 6) * S, rad = S * (0.1 + r(i + 12) * 0.18); const col = shade('#3a3038', 0.8 + r(i + 3) * 0.5); g.fillStyle = rgrad(g, x, y, rad, shade(col, 1.5), shade(col, 0.5), -rad * 0.4, -rad * 0.4); g.beginPath(); for (let s = 0; s < 7; s++) { const aa = s / 7 * TAU; const rq = rad * (0.7 + hashN(s, i, variant) * 0.4); g.lineTo(x + Math.cos(aa) * rq, y + Math.sin(aa) * rq); } g.closePath(); g.fill(); }
        if (r(20) > 0.65) { const x = S * 0.5, y = base + S * 0.55; g.fillStyle = rgrad(g, x, y, S * 0.25, 'rgba(170,120,255,0.45)', 'rgba(170,120,255,0)'); g.fillRect(x - S * 0.25, y - S * 0.25, S * 0.5, S * 0.5); poly(g, [[x, y - S * 0.22], [x + S * 0.07, y], [x, y + S * 0.08], [x - S * 0.07, y]], lgrad(g, x - S * 0.07, y - S * 0.2, x + S * 0.07, y, [[0, '#e0c8ff'], [1, '#8050d0']])); }
      }
    });
  }

  // ---------------------------------------------------------------- обекти
  const RES_ICON = { gold: '●', wood: '≡', ore: '▲', mercury: '◉', sulfur: '✶', crystal: '◆', gems: '❖' };
  function house(g, x, y, w, h, wall, roof, roofK, windows) {
    // тяло
    g.fillStyle = lgrad(g, x - w / 2, y, x + w / 2, y, [[0, shade(wall, 1.15)], [1, shade(wall, 0.7)]]); g.fillRect(x - w / 2, y - h, w, h);
    // покрив
    poly(g, [[x - w * 0.6, y - h], [x, y - h - w * (roofK || 0.55)], [x + w * 0.6, y - h]], lgrad(g, x - w * 0.6, y - h - w * 0.5, x + w * 0.6, y - h, [[0, shade(roof, 1.3)], [1, shade(roof, 0.6)]]), 'rgba(0,0,0,0.35)', 1);
    // прозорци
    for (let i = 0; i < (windows || 0); i++) { const wx = x - w * 0.3 + (w * 0.6 / Math.max(1, windows - 1)) * i; g.fillStyle = 'rgba(255,220,120,0.95)'; g.fillRect(wx - w * 0.06, y - h * 0.65, w * 0.12, h * 0.22); g.fillStyle = 'rgba(255,240,180,0.35)'; g.fillRect(wx - w * 0.12, y - h * 0.72, w * 0.24, h * 0.34); }
    // врата
    g.fillStyle = '#2a1a10'; g.beginPath(); g.roundRect(x - w * 0.09, y - h * 0.32, w * 0.18, h * 0.32, [w * 0.09, w * 0.09, 0, 0]); g.fill();
  }
  function tower(g, x, y, w, h, wall, roof, spireK) {
    g.fillStyle = lgrad(g, x - w / 2, y, x + w / 2, y, [[0, shade(wall, 1.2)], [0.6, wall], [1, shade(wall, 0.6)]]); g.fillRect(x - w / 2, y - h, w, h);
    // зъбци или конус
    if (spireK) poly(g, [[x - w * 0.7, y - h], [x, y - h - w * spireK], [x + w * 0.7, y - h]], lgrad(g, x - w * 0.7, y - h - w, x + w * 0.7, y - h, [[0, shade(roof, 1.3)], [1, shade(roof, 0.55)]]), 'rgba(0,0,0,0.35)', 1);
    else { g.fillStyle = shade(wall, 1.1); for (let i = -1; i <= 1; i++) g.fillRect(x + i * w * 0.36 - w * 0.14, y - h - w * 0.2, w * 0.28, w * 0.22); }
    g.fillStyle = '#1a1410'; g.fillRect(x - w * 0.12, y - h * 0.62, w * 0.24, w * 0.3);
    g.fillStyle = 'rgba(255,220,120,0.9)'; g.fillRect(x - w * 0.08, y - h * 0.6, w * 0.16, w * 0.2);
  }
  const TOWN_STYLE = {
    kingdom: { wall: '#c8c0b0', roof: '#3f6fd0', ground: '#7a9a5a' }, grove: { wall: '#8a6a44', roof: '#4a9a44', ground: '#4e8a3a' }, necropolis: { wall: '#4a4056', roof: '#6a3f9a', ground: '#5a5058' },
    academy: { wall: '#e8eef8', roof: '#4a8ad0', ground: '#c8d8e8' }, inferno: { wall: '#3a2626', roof: '#e0602a', ground: '#4a3030' }, dungeon: { wall: '#3a3050', roof: '#8a5ab0', ground: '#3a3040' },
    horde: { wall: '#7a5a3a', roof: '#c08a3a', ground: '#8a7a5a' }, marsh: { wall: '#6a6a4a', roof: '#3a7a5a', ground: '#4a6a3a' }, elements: { wall: '#d8d0f0', roof: '#a080ff', ground: '#9ab070' },
    harbor: { wall: '#d8cfb8', roof: '#2a8aa0', ground: '#c0b088' }, workshop: { wall: '#8a7a68', roof: '#a06040', ground: '#8a7a80' }
  };
  function flagShape(g, x, y, S, color, wave) {
    g.fillStyle = '#3a2a1a'; g.fillRect(x - S * 0.012, y - S * 0.3, S * 0.024, S * 0.3);
    const w = wave || 0;
    g.fillStyle = lgrad(g, x, y, x + S * 0.2, y, [[0, shade(color, 1.2)], [1, shade(color, 0.8)]]);
    g.beginPath(); g.moveTo(x, y - S * 0.3); g.quadraticCurveTo(x + S * 0.1, y - S * 0.31 + w, x + S * 0.2, y - S * 0.27 + w * 1.5); g.quadraticCurveTo(x + S * 0.1, y - S * 0.2 + w * 0.5, x, y - S * 0.17); g.fill();
  }
  function objectSprite(o, S, world) {
    const owner = o.owner !== undefined ? o.owner : -2;
    const ownerCol = owner >= 0 && world && world.players[owner] ? world.players[owner].color : null;
    const key = 'o' + o.type + '_' + (o.res || '') + '_' + (o.faction || '') + '_' + (o.creature || '') + '_' + owner + '_' + S + '_' + (o.empty ? 'e' : '') + '_' + (o.art ? D.artById[o.art].cls : '');
    return sprite(key, S, S * 1.4, (g) => {
      const cx = S / 2, gy = S * 1.4 - S * 0.12; // линия на земята
      const top = S * 0.4;
      switch (o.type) {
        case 'town': {
          const st = TOWN_STYLE[o.faction] || TOWN_STYLE.kingdom;
          shadow(g, cx, gy, S * 0.5, S * 0.14, 0.35);
          ell(g, cx, gy - S * 0.02, S * 0.5, S * 0.16, st.ground);
          // стена с зъбци
          g.fillStyle = lgrad(g, 0, gy - S * 0.42, 0, gy, [[0, shade(st.wall, 1.05)], [1, shade(st.wall, 0.6)]]); g.fillRect(S * 0.1, gy - S * 0.4, S * 0.8, S * 0.38);
          g.fillStyle = shade(st.wall, 1.15); for (let i = 0; i < 7; i++) g.fillRect(S * 0.11 + i * S * 0.115, gy - S * 0.46, S * 0.07, S * 0.08);
          // сгради зад стената
          if (o.faction === 'necropolis' || o.faction === 'dungeon') { tower(g, cx - S * 0.26, gy - S * 0.3, S * 0.16, S * 0.6, st.wall, st.roof, 2.2); tower(g, cx + S * 0.26, gy - S * 0.3, S * 0.16, S * 0.5, st.wall, st.roof, 2.4); tower(g, cx, gy - S * 0.3, S * 0.2, S * 0.75, st.wall, st.roof, 2.6); }
          else if (o.faction === 'academy' || o.faction === 'elements') { tower(g, cx - S * 0.26, gy - S * 0.3, S * 0.16, S * 0.55, st.wall, st.roof, 0); sphere(g, cx - S * 0.26, gy - S * 0.9, S * 0.11, st.roof); tower(g, cx + S * 0.26, gy - S * 0.3, S * 0.16, S * 0.48, st.wall, st.roof, 0); sphere(g, cx + S * 0.26, gy - S * 0.82, S * 0.11, st.roof); tower(g, cx, gy - S * 0.3, S * 0.2, S * 0.7, st.wall, st.roof, 1.8); }
          else if (o.faction === 'horde' || o.faction === 'marsh') { house(g, cx - S * 0.25, gy - S * 0.3, S * 0.26, S * 0.3, st.wall, st.roof, 0.7, 1); house(g, cx + S * 0.25, gy - S * 0.3, S * 0.24, S * 0.28, st.wall, st.roof, 0.7, 1); tower(g, cx, gy - S * 0.3, S * 0.22, S * 0.6, st.wall, st.roof, 0); }
          else if (o.faction === 'workshop') { house(g, cx - S * 0.24, gy - S * 0.3, S * 0.28, S * 0.34, st.wall, st.roof, 0.3, 2); g.fillStyle = '#4a4040'; g.fillRect(cx + S * 0.18, gy - S * 0.95, S * 0.08, S * 0.65); g.fillRect(cx + S * 0.3, gy - S * 0.85, S * 0.06, S * 0.55); tower(g, cx, gy - S * 0.3, S * 0.2, S * 0.5, st.wall, st.roof, 0); }
          else if (o.faction === 'inferno') { tower(g, cx - S * 0.26, gy - S * 0.3, S * 0.16, S * 0.5, st.wall, st.roof, 3); tower(g, cx + S * 0.26, gy - S * 0.3, S * 0.16, S * 0.55, st.wall, st.roof, 2.6); tower(g, cx, gy - S * 0.3, S * 0.22, S * 0.6, st.wall, st.roof, 3.2); g.fillStyle = rgrad(g, cx, gy - S * 0.5, S * 0.45, 'rgba(255,90,20,0.35)', 'rgba(255,90,20,0)'); g.fillRect(0, gy - S * 1.0, S, S * 0.7); }
          else if (o.faction === 'harbor') { house(g, cx - S * 0.26, gy - S * 0.3, S * 0.24, S * 0.28, st.wall, st.roof, 0.5, 2); tower(g, cx + S * 0.28, gy - S * 0.3, S * 0.13, S * 0.75, '#e8e0d0', '#d23c3c', 0.6); g.fillStyle = '#d23c3c'; g.fillRect(cx + S * 0.215, gy - S * 0.75, S * 0.13, S * 0.08); tower(g, cx, gy - S * 0.3, S * 0.2, S * 0.55, st.wall, st.roof, 1.2); }
          else { tower(g, cx - S * 0.27, gy - S * 0.3, S * 0.16, S * 0.5, st.wall, st.roof, 1.4); tower(g, cx + S * 0.27, gy - S * 0.3, S * 0.16, S * 0.56, st.wall, st.roof, 1.4); house(g, cx, gy - S * 0.36, S * 0.3, S * 0.3, st.wall, st.roof, 0.5, 2); tower(g, cx, gy - S * 0.3, S * 0.18, S * 0.78, st.wall, st.roof, 1.6); }
          // порта
          g.fillStyle = '#2a1a10'; g.beginPath(); g.roundRect(cx - S * 0.09, gy - S * 0.24, S * 0.18, S * 0.22, [S * 0.09, S * 0.09, 0, 0]); g.fill();
          g.strokeStyle = '#8a6a3a'; g.lineWidth = Math.max(1, S * 0.01); g.beginPath(); g.moveTo(cx, gy - S * 0.24); g.lineTo(cx, gy - S * 0.02); g.stroke();
          if (ownerCol) flagShape(g, cx, gy - S * 1.05, S, ownerCol, 0);
          break;
        }
        case 'mine': {
          const m = D.MINES.find((m) => m.res === o.res);
          shadow(g, cx, gy, S * 0.46, S * 0.13, 0.35);
          // хълм
          g.fillStyle = lgrad(g, 0, gy - S * 0.6, 0, gy, [[0, '#8a7a6a'], [1, '#4a3e34']]); g.beginPath(); g.moveTo(S * 0.06, gy); g.quadraticCurveTo(S * 0.3, gy - S * 0.75, cx, gy - S * 0.62); g.quadraticCurveTo(S * 0.72, gy - S * 0.72, S * 0.94, gy); g.fill();
          // дървена рамка на входа
          g.fillStyle = '#5a3e1e'; g.fillRect(cx - S * 0.2, gy - S * 0.36, S * 0.06, S * 0.36); g.fillRect(cx + S * 0.14, gy - S * 0.36, S * 0.06, S * 0.36); g.fillRect(cx - S * 0.22, gy - S * 0.38, S * 0.44, S * 0.06);
          g.fillStyle = lgrad(g, 0, gy - S * 0.32, 0, gy, [[0, '#0a0806'], [1, '#2a2018']]); g.fillRect(cx - S * 0.14, gy - S * 0.32, S * 0.28, S * 0.32);
          // релси и вагонетка
          g.strokeStyle = '#3a3030'; g.lineWidth = Math.max(1, S * 0.012); g.beginPath(); g.moveTo(cx - S * 0.06, gy); g.lineTo(cx - S * 0.02, gy + S * 0.08); g.moveTo(cx + S * 0.06, gy); g.lineTo(cx + S * 0.02, gy + S * 0.08); g.stroke();
          rrect(g, cx + S * 0.22, gy - S * 0.14, S * 0.2, S * 0.12, S * 0.02, '#4a3a2a'); circ(g, cx + S * 0.27, gy - S * 0.01, S * 0.03, '#222'); circ(g, cx + S * 0.37, gy - S * 0.01, S * 0.03, '#222');
          for (let i = 0; i < 4; i++) sphere(g, cx + S * 0.25 + hashN(i, 1, 2) * S * 0.14, gy - S * 0.16 - hashN(i, 3, 4) * S * 0.04, S * 0.03, D.RES_COLOR[o.res]);
          // табела
          rrect(g, cx - S * 0.12, gy - S * 0.62, S * 0.24, S * 0.18, S * 0.03, '#e8dcc0'); g.strokeStyle = '#5a3e1e'; g.lineWidth = 1; g.strokeRect(cx - S * 0.12, gy - S * 0.62, S * 0.24, S * 0.18);
          circ(g, cx, gy - S * 0.53, S * 0.06, D.RES_COLOR[o.res]);
          g.fillStyle = '#222'; g.font = 'bold ' + S * 0.09 + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(RES_ICON[o.res], cx, gy - S * 0.525);
          if (ownerCol) flagShape(g, cx + S * 0.34, gy - S * 0.42, S, ownerCol, 0);
          break;
        }
        case 'resource': {
          shadow(g, cx, gy, S * 0.3, S * 0.09, 0.3);
          const col = D.RES_COLOR[o.res];
          if (o.res === 'wood') { for (let i = 0; i < 3; i++) { const y = gy - S * 0.07 - i * S * 0.1, x = cx + (i === 2 ? 0 : (i ? 1 : -1)) * S * 0.0; g.fillStyle = lgrad(g, 0, y - S * 0.06, 0, y + S * 0.06, [[0, '#a8743e'], [1, '#5a3a1e']]); g.beginPath(); g.roundRect(cx - S * 0.28 + i * S * 0.02, y - S * 0.055, S * 0.5, S * 0.11, S * 0.05); g.fill(); circ(g, cx + S * 0.22 + i * S * 0.02, y, S * 0.05, '#d8b078'); } }
          else if (o.res === 'gold') { for (let i = 0; i < 7; i++) { const x = cx + (hashN(i, 3, 4) - 0.5) * S * 0.44, y = gy - S * 0.05 - hashN(i, 5, 6) * S * 0.16; ell(g, x, y, S * 0.085, S * 0.05, shade('#c8a030', 0.9 + hashN(i, 1, 2) * 0.3)); ell(g, x, y - S * 0.02, S * 0.07, S * 0.035, '#f0d060'); } }
          else if (o.res === 'ore') { for (let i = 0; i < 5; i++) { const x = cx + (hashN(i, 3, 4) - 0.5) * S * 0.4, y = gy - S * 0.05 - hashN(i, 5, 6) * S * 0.12, r = S * 0.08; poly(g, [[x - r, y + r * 0.5], [x - r * 0.5, y - r], [x + r * 0.5, y - r * 0.9], [x + r, y + r * 0.5]], lgrad(g, x - r, y - r, x + r, y + r, [[0, '#b0b0b8'], [1, '#505058']])); } }
          else { for (let i = 0; i < 4; i++) { const x = cx + (hashN(i, 2, 3) - 0.5) * S * 0.36, y = gy - S * 0.08 - hashN(i, 4, 5) * S * 0.1, h = S * (0.14 + hashN(i, 7, 8) * 0.1); poly(g, [[x, y - h], [x + S * 0.08, y - h * 0.3], [x + S * 0.05, y + S * 0.06], [x - S * 0.05, y + S * 0.06], [x - S * 0.08, y - h * 0.3]], lgrad(g, x - S * 0.08, y - h, x + S * 0.08, y, [[0, shade(col, 1.5)], [0.5, col], [1, shade(col, 0.5)]]), 'rgba(255,255,255,0.35)', 1); } g.fillStyle = rgrad(g, cx, gy - S * 0.15, S * 0.3, rgba(col, 0.35), rgba(col, 0)); g.fillRect(cx - S * 0.3, gy - S * 0.45, S * 0.6, S * 0.6); }
          break;
        }
        case 'chest': case 'sea_chest': {
          shadow(g, cx, gy, S * 0.3, S * 0.08, 0.35);
          g.fillStyle = lgrad(g, cx - S * 0.25, 0, cx + S * 0.25, 0, [[0, '#8a5a2a'], [1, '#4a2e12']]); g.fillRect(cx - S * 0.25, gy - S * 0.26, S * 0.5, S * 0.26);
          g.fillStyle = lgrad(g, 0, gy - S * 0.46, 0, gy - S * 0.26, [[0, '#b07a3a'], [1, '#6a4a22']]); g.beginPath(); g.moveTo(cx - S * 0.25, gy - S * 0.26); g.quadraticCurveTo(cx, gy - S * 0.5, cx + S * 0.25, gy - S * 0.26); g.fill();
          g.fillStyle = '#e8c040'; g.fillRect(cx - S * 0.25, gy - S * 0.27, S * 0.5, S * 0.03); g.fillRect(cx - S * 0.05, gy - S * 0.3, S * 0.1, S * 0.12); g.fillRect(cx - S * 0.25, gy - S * 0.05, S * 0.5, S * 0.03);
          g.fillStyle = rgrad(g, cx, gy - S * 0.3, S * 0.3, 'rgba(255,220,120,0.4)', 'rgba(255,220,120,0)'); g.fillRect(cx - S * 0.3, gy - S * 0.6, S * 0.6, S * 0.6);
          break;
        }
        case 'artifact': {
          const a = D.artById[o.art]; const col = ['', '#c8d8e8', '#f0c840', '#e070f0'][a ? a.cls : 1];
          shadow(g, cx, gy, S * 0.22, S * 0.07, 0.3);
          // пиедестал
          g.fillStyle = lgrad(g, 0, gy - S * 0.16, 0, gy, [[0, '#a0a0a8'], [1, '#505058']]); g.beginPath(); g.roundRect(cx - S * 0.16, gy - S * 0.14, S * 0.32, S * 0.14, S * 0.03); g.fill();
          g.fillStyle = rgrad(g, cx, gy - S * 0.42, S * 0.36, rgba(col, 0.5), rgba(col, 0)); g.fillRect(cx - S * 0.36, gy - S * 0.8, S * 0.72, S * 0.72);
          poly(g, [[cx, gy - S * 0.7], [cx + S * 0.16, gy - S * 0.42], [cx, gy - S * 0.16], [cx - S * 0.16, gy - S * 0.42]], lgrad(g, cx - S * 0.16, gy - S * 0.7, cx + S * 0.16, gy - S * 0.16, [[0, shade(col, 1.4)], [0.5, col], [1, shade(col, 0.55)]]), 'rgba(255,255,255,0.5)', 1);
          poly(g, [[cx, gy - S * 0.66], [cx + S * 0.06, gy - S * 0.5], [cx - S * 0.06, gy - S * 0.5]], 'rgba(255,255,255,0.7)');
          break;
        }
        case 'dwelling': {
          const c = D.creatureOf(o.creature); const f = D.factionById(c.faction); const st = TOWN_STYLE[c.faction] || TOWN_STYLE.kingdom;
          shadow(g, cx, gy, S * 0.4, S * 0.11, 0.35);
          house(g, cx, gy, S * 0.5, S * 0.34, st.wall, f ? f.color : '#888', 0.6, 2);
          g.strokeStyle = '#5a3e1e'; g.lineWidth = Math.max(1, S * 0.015); g.beginPath(); g.moveTo(cx - S * 0.36, gy); g.lineTo(cx - S * 0.36, gy - S * 0.16); g.moveTo(cx + S * 0.36, gy); g.lineTo(cx + S * 0.36, gy - S * 0.16); g.moveTo(cx - S * 0.4, gy - S * 0.1); g.lineTo(cx + S * 0.4, gy - S * 0.1); g.stroke();
          if (ownerCol) flagShape(g, cx + S * 0.3, gy - S * 0.36, S, ownerCol, 0);
          break;
        }
        case 'boat': {
          ell(g, cx, gy - S * 0.02, S * 0.46, S * 0.08, 'rgba(255,255,255,0.35)');
          g.fillStyle = lgrad(g, 0, gy - S * 0.26, 0, gy, [[0, '#8a5a2a'], [1, '#3a2210']]); g.beginPath(); g.moveTo(S * 0.06, gy - S * 0.24); g.quadraticCurveTo(cx, gy - S * 0.18, S * 0.94, gy - S * 0.26); g.lineTo(S * 0.8, gy); g.lineTo(S * 0.2, gy); g.closePath(); g.fill();
          g.fillStyle = '#c09050'; g.fillRect(S * 0.08, gy - S * 0.26, S * 0.84, S * 0.04);
          g.fillStyle = '#3a2a1a'; g.fillRect(cx - S * 0.02, gy - S * 0.85, S * 0.04, S * 0.62);
          g.fillStyle = lgrad(g, cx, 0, cx + S * 0.34, 0, [[0, '#f8f4ec'], [1, '#c8c0b0']]); g.beginPath(); g.moveTo(cx + S * 0.02, gy - S * 0.82); g.quadraticCurveTo(cx + S * 0.4, gy - S * 0.6, cx + S * 0.32, gy - S * 0.32); g.lineTo(cx + S * 0.02, gy - S * 0.32); g.fill();
          g.fillStyle = ownerCol ? lgrad(g, cx - S * 0.3, 0, cx, 0, [[0, shade(ownerCol, 0.8)], [1, shade(ownerCol, 1.2)]]) : '#e8e0d0'; g.beginPath(); g.moveTo(cx - S * 0.02, gy - S * 0.78); g.quadraticCurveTo(cx - S * 0.36, gy - S * 0.6, cx - S * 0.28, gy - S * 0.32); g.lineTo(cx - S * 0.02, gy - S * 0.32); g.fill();
          break;
        }
        case 'gate': {
          shadow(g, cx, gy, S * 0.42, S * 0.1, 0.35);
          g.fillStyle = lgrad(g, 0, gy - S * 0.7, 0, gy, [[0, '#6a6070'], [1, '#2a2430']]); g.beginPath(); g.moveTo(S * 0.12, gy); g.lineTo(S * 0.16, gy - S * 0.45); g.quadraticCurveTo(cx, gy - S * 0.95, S * 0.84, gy - S * 0.45); g.lineTo(S * 0.88, gy); g.fill();
          g.fillStyle = rgrad(g, cx, gy - S * 0.2, S * 0.3, '#3a1a70', '#08040f'); g.beginPath(); g.moveTo(S * 0.28, gy); g.lineTo(S * 0.3, gy - S * 0.4); g.quadraticCurveTo(cx, gy - S * 0.7, S * 0.7, gy - S * 0.4); g.lineTo(S * 0.72, gy); g.fill();
          g.fillStyle = rgrad(g, cx, gy - S * 0.15, S * 0.22, 'rgba(180,130,255,0.75)', 'rgba(180,130,255,0)'); g.fillRect(cx - S * 0.25, gy - S * 0.45, S * 0.5, S * 0.5);
          break;
        }
        case 'whirlpool': { for (let k = 0; k < 4; k++) { g.strokeStyle = 'rgba(255,255,255,' + (0.85 - k * 0.15) + ')'; g.lineWidth = S * 0.035; g.beginPath(); g.arc(cx, gy - S * 0.3, S * (0.08 + k * 0.1), k * 1.1, k * 1.1 + 4.4); g.stroke(); } break; }
        case 'lighthouse': {
          shadow(g, cx, gy, S * 0.25, S * 0.08, 0.35);
          g.fillStyle = lgrad(g, cx - S * 0.12, 0, cx + S * 0.12, 0, [[0, '#f4f0e8'], [1, '#a8a098']]); poly(g, [[cx - S * 0.13, gy], [cx - S * 0.09, gy - S * 0.72], [cx + S * 0.09, gy - S * 0.72], [cx + S * 0.13, gy]], g.fillStyle);
          g.fillStyle = '#d23c3c'; g.fillRect(cx - S * 0.11, gy - S * 0.45, S * 0.22, S * 0.1); g.fillRect(cx - S * 0.125, gy - S * 0.2, S * 0.25, S * 0.1);
          g.fillStyle = '#2a2a30'; g.fillRect(cx - S * 0.11, gy - S * 0.86, S * 0.22, S * 0.14); g.fillStyle = '#ffe070'; g.fillRect(cx - S * 0.08, gy - S * 0.84, S * 0.16, S * 0.1);
          g.fillStyle = rgrad(g, cx, gy - S * 0.8, S * 0.5, 'rgba(255,230,120,0.35)', 'rgba(255,230,120,0)'); g.fillRect(0, gy - S * 1.3, S, S);
          if (ownerCol) flagShape(g, cx + S * 0.2, gy - S * 0.5, S, ownerCol, 0);
          break;
        }
        case 'shipwreck': {
          if (o.empty) g.globalAlpha = 0.6;
          g.fillStyle = '#3a2a1a'; g.beginPath(); g.moveTo(S * 0.12, gy - S * 0.1); g.lineTo(S * 0.9, gy - S * 0.22); g.lineTo(S * 0.78, gy + S * 0.05); g.lineTo(S * 0.28, gy + S * 0.05); g.fill();
          g.save(); g.translate(cx, gy - S * 0.15); g.rotate(-0.5); g.fillStyle = '#2a1a10'; g.fillRect(-S * 0.02, -S * 0.5, S * 0.04, S * 0.5); g.fillStyle = 'rgba(200,190,170,0.6)'; g.beginPath(); g.moveTo(S * 0.02, -S * 0.48); g.lineTo(S * 0.22, -S * 0.2); g.lineTo(S * 0.02, -S * 0.15); g.fill(); g.restore();
          ell(g, cx, gy, S * 0.4, S * 0.07, 'rgba(255,255,255,0.3)');
          break;
        }
        default: {
          const glyph = { windmill: '🌬', watermill: '⚙', learning: '📜', rally: '🚩', mercenary: '⚔', tower_def: '🛡', star_axis: '✨', garden: '🌸', campfire: '🔥', shrine1: '⛩', shrine2: '⛩', shrine3: '⛩', tree_knowledge: '🌳', magic_well: '💧', wagon: '🛒', fountain: '⛲', idol: '🗿', obelisk: '🗼', stables: '🐎', sanctuary: '🏛', school_war: '🏫', school_magic: '🔮', library: '📚', monolith: '🌀' }[o.type] || '?';
          shadow(g, cx, gy, S * 0.3, S * 0.09, 0.3);
          // каменна плоча-основа
          ell(g, cx, gy - S * 0.03, S * 0.3, S * 0.1, '#7a7068'); ell(g, cx, gy - S * 0.06, S * 0.26, S * 0.08, '#a8a098');
          g.font = S * 0.62 + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
          if (o.empty) g.globalAlpha = 0.5;
          g.fillText(glyph, cx, gy - S * 0.42);
        }
      }
    });
  }

  // ---------------------------------------------------------------- герои: жив кон с рицар
  const COAT = { kingdom: '#6b3f1f', grove: '#b98a55', necropolis: '#1e1a22', academy: '#e9e6e0', inferno: '#3a1414', dungeon: '#2a2438', horde: '#8a6a4a', marsh: '#5c4a32', elements: '#d8d4e8', harbor: '#4a4a52', workshop: '#7a5a3a', neutral: '#6b3f1f' };
  // крак: бедро (мускулесто, стеснява се към коляното) → пищял → глезен → копито; ъглите са в радиани спрямо надолу (положително = напред)
  function horseLeg(g, hx, hy, a1, a2, L1, L2, th, col, back) {
    const kx = hx + Math.sin(a1) * L1, ky = hy + Math.cos(a1) * L1;
    const fx = kx + Math.sin(a1 + a2) * L2, fy = ky + Math.cos(a1 + a2) * L2;
    const dim = back ? 0.68 : 1;
    const seg = (x0, y0, x1, y1, w0, w1, c0, c1) => {
      const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, px = -dy / L, py = dx / L;
      g.fillStyle = lgrad(g, x0 + px * w0, y0 + py * w0, x0 - px * w0, y0 - py * w0, [[0, c0], [0.45, c1], [1, shade(c1, 0.55)]]);
      g.beginPath(); g.moveTo(x0 + px * w0, y0 + py * w0); g.lineTo(x1 + px * w1, y1 + py * w1); g.arc(x1, y1, w1, Math.atan2(py, px), Math.atan2(-py, -px), true); g.lineTo(x0 - px * w0, y0 - py * w0); g.arc(x0, y0, w0, Math.atan2(-py, -px), Math.atan2(py, px), true); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = Math.max(1, th * 0.08); g.stroke();
    };
    // бедро
    seg(hx, hy, kx, ky, th * 0.72, th * 0.42, shade(col, 1.3 * dim), shade(col, 1.0 * dim));
    // пищял (по-тъмен „чорап“ надолу)
    seg(kx, ky, fx, fy, th * 0.34, th * 0.26, shade(col, 0.85 * dim), shade(col, 0.5 * dim));
    // глезен и копито
    const ux = Math.sin(a1 + a2), uy = Math.cos(a1 + a2);
    ell(g, fx + ux * th * 0.1, fy + uy * th * 0.1, th * 0.36, th * 0.3, shade(col, 0.55 * dim));
    g.fillStyle = lgrad(g, fx - th * 0.4, fy, fx + th * 0.4, fy, [[0, '#2a221c'], [0.5, '#0f0c0a'], [1, '#2a221c']]);
    g.beginPath(); g.ellipse(fx + ux * th * 0.32, fy + uy * th * 0.32, th * 0.5, th * 0.34, (a1 + a2) * 0.6, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.16)'; g.beginPath(); g.ellipse(fx + ux * th * 0.22 - th * 0.12, fy + uy * th * 0.22 - th * 0.08, th * 0.18, th * 0.1, 0, 0, TAU); g.fill();
    return [fx, fy];
  }
  // Ключови пози на галоп: [заден-далечен, заден-близък, преден-далечен, преден-близък] × [a1, a2]
  const GAIT = [
    [[0.05, 0.02], [-0.05, 0.03], [0.02, 0.0], [-0.03, 0.02]],                 // покой
    [[-0.55, 0.35], [-0.35, 0.3], [0.55, -0.55], [0.75, -0.7]],                // отблъскване, предни напред
    [[-0.2, 0.55], [0.05, 0.4], [0.2, -0.2], [0.45, -0.5]],                    // полет
    [[0.35, 0.2], [0.55, 0.1], [-0.35, 0.05], [-0.15, -0.1]],                  // приземяване на предни
    [[0.6, -0.4], [0.35, -0.2], [-0.5, 0.35], [-0.35, 0.3]]                    // събиране
  ];
  function heroSprite(h, S, color, frame) {
    frame = frame || 0;
    if (h.boat) return sprite('hb' + color + '_' + S, S, S * 1.4, (g) => {
      const cx = S / 2, gy = S * 1.28;
      ell(g, cx, gy - S * 0.02, S * 0.48, S * 0.08, 'rgba(255,255,255,0.35)');
      g.fillStyle = lgrad(g, 0, gy - S * 0.28, 0, gy, [[0, '#8a5a2a'], [1, '#3a2210']]); g.beginPath(); g.moveTo(S * 0.04, gy - S * 0.26); g.quadraticCurveTo(cx, gy - S * 0.2, S * 0.96, gy - S * 0.28); g.lineTo(S * 0.82, gy); g.lineTo(S * 0.18, gy); g.closePath(); g.fill();
      g.fillStyle = '#c09050'; g.fillRect(S * 0.06, gy - S * 0.28, S * 0.88, S * 0.04);
      g.fillStyle = '#3a2a1a'; g.fillRect(cx - S * 0.02, gy - S * 0.92, S * 0.04, S * 0.66);
      g.fillStyle = lgrad(g, cx, 0, cx + S * 0.36, 0, [[0, '#f8f4ec'], [1, '#c0b8a8']]); g.beginPath(); g.moveTo(cx + S * 0.02, gy - S * 0.88); g.quadraticCurveTo(cx + S * 0.42, gy - S * 0.62, cx + S * 0.34, gy - S * 0.34); g.lineTo(cx + S * 0.02, gy - S * 0.34); g.fill();
      g.fillStyle = lgrad(g, cx - S * 0.32, 0, cx, 0, [[0, shade(color, 0.8)], [1, shade(color, 1.25)]]); g.beginPath(); g.moveTo(cx - S * 0.02, gy - S * 0.84); g.quadraticCurveTo(cx - S * 0.38, gy - S * 0.62, cx - S * 0.3, gy - S * 0.34); g.lineTo(cx - S * 0.02, gy - S * 0.34); g.fill();
      sphere(g, cx - S * 0.22, gy - S * 0.44, S * 0.06, '#e8c8a0'); g.fillStyle = color; g.fillRect(cx - S * 0.28, gy - S * 0.38, S * 0.12, S * 0.1);
    });
    return sprite('h' + h.faction + '_' + color + '_' + S + '_' + (h.portrait || 0) + '_' + frame, S, S * 1.4, (g) => {
      // цялата композиция е по-голяма от спрайта: свиваме я около точката на земята
      g.translate(S * 0.46, S * 1.28); g.scale(0.66, 0.66); g.translate(-S / 2, -S * 1.28);
      const cx = S / 2, gy = S * 1.28;
      const coat = COAT[h.faction] || COAT.kingdom;
      const lightCoat = h.faction === 'academy' || h.faction === 'elements';
      const mane = lightCoat ? '#c8c0b0' : shade(coat, 0.45);
      const pose = GAIT[frame % GAIT.length];
      const fly = frame === 2 ? -S * 0.05 : frame === 1 ? -S * 0.02 : 0; // във въздуха
      const by = gy + fly; // линия на корема
      // сянка
      shadow(g, cx + S * 0.02, gy, S * 0.42, S * 0.09, frame === 2 ? 0.22 : 0.4);
      // тяло: параметри
      const bodyY = by - S * 0.52, bodyL = S * 0.36, bodyH = S * 0.2;
      const L1 = S * 0.2, L2 = S * 0.2, th = S * 0.062;
      // далечни крака (по-тъмни, зад тялото)
      horseLeg(g, cx - S * 0.24, bodyY + bodyH * 0.55, pose[0][0], pose[0][1], L1, L2, th, coat, true);
      horseLeg(g, cx + S * 0.24, bodyY + bodyH * 0.5, pose[2][0], pose[2][1], L1, L2, th, coat, true);
      // опашка
      g.strokeStyle = mane; g.lineCap = 'round';
      for (let k = 0; k < 5; k++) { g.lineWidth = S * 0.02; g.globalAlpha = 0.9 - k * 0.12; g.beginPath(); g.moveTo(cx - bodyL * 0.95, bodyY - bodyH * 0.35); g.quadraticCurveTo(cx - bodyL * 1.25 - k * S * 0.012, bodyY + bodyH * (0.2 + k * 0.1) + (frame ? -S * 0.12 : 0), cx - bodyL * (1.05 + k * 0.05) - (frame ? S * 0.08 : 0), bodyY + bodyH * (1.3 + k * 0.15) - (frame ? S * 0.15 : 0)); g.stroke(); }
      g.globalAlpha = 1;
      // торс: гръб леко вдлъбнат, корем изпъкнал, мускулни градиенти
      const body = g.createRadialGradient(cx - bodyL * 0.1, bodyY - bodyH * 0.6, bodyH * 0.2, cx, bodyY, bodyL * 1.2);
      body.addColorStop(0, shade(coat, 1.45)); body.addColorStop(0.55, coat); body.addColorStop(1, shade(coat, 0.55));
      g.fillStyle = body;
      g.beginPath();
      g.moveTo(cx - bodyL * 0.95, bodyY - bodyH * 0.55);                                                // задница горе
      g.bezierCurveTo(cx - bodyL * 0.4, bodyY - bodyH * 1.05, cx + bodyL * 0.3, bodyY - bodyH * 1.0, cx + bodyL * 0.78, bodyY - bodyH * 0.85); // гръб
      g.bezierCurveTo(cx + bodyL * 1.05, bodyY - bodyH * 0.5, cx + bodyL * 1.0, bodyY + bodyH * 0.6, cx + bodyL * 0.6, bodyY + bodyH * 0.95);  // гърди
      g.bezierCurveTo(cx + bodyL * 0.2, bodyY + bodyH * 1.2, cx - bodyL * 0.4, bodyY + bodyH * 1.15, cx - bodyL * 0.85, bodyY + bodyH * 0.7);  // корем
      g.bezierCurveTo(cx - bodyL * 1.15, bodyY + bodyH * 0.3, cx - bodyL * 1.15, bodyY - bodyH * 0.3, cx - bodyL * 0.95, bodyY - bodyH * 0.55); // задница
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = Math.max(1, S * 0.008); g.stroke();
      // мускул на задницата и на рамото
      g.fillStyle = rgrad(g, cx - bodyL * 0.6, bodyY - bodyH * 0.1, bodyH * 0.8, rgba(shade(coat, 1.5), 0.55), rgba(coat, 0), -bodyH * 0.2, -bodyH * 0.3); g.beginPath(); g.ellipse(cx - bodyL * 0.6, bodyY - bodyH * 0.05, bodyH * 0.75, bodyH * 0.7, 0, 0, TAU); g.fill();
      g.fillStyle = rgrad(g, cx + bodyL * 0.6, bodyY + bodyH * 0.1, bodyH * 0.7, rgba(shade(coat, 1.5), 0.5), rgba(coat, 0), -bodyH * 0.2, -bodyH * 0.3); g.beginPath(); g.ellipse(cx + bodyL * 0.6, bodyY + bodyH * 0.1, bodyH * 0.6, bodyH * 0.6, 0, 0, TAU); g.fill();
      // корем светъл
      g.fillStyle = rgba(lightCoat ? '#ffffff' : shade(coat, 1.6), 0.25); g.beginPath(); g.ellipse(cx - bodyL * 0.1, bodyY + bodyH * 0.75, bodyL * 0.55, bodyH * 0.25, 0, 0, TAU); g.fill();
      // шия: от гръдта нагоре, извита
      const nx = cx + bodyL * 0.72, ny = bodyY - bodyH * 0.7; // основа на шията
      const hx0 = cx + bodyL * 1.28, hy0 = bodyY - bodyH * 2.15; // тил
      g.fillStyle = lgrad(g, nx, ny, hx0, hy0, [[0, coat], [1, shade(coat, 1.15)]]);
      g.beginPath(); g.moveTo(cx + bodyL * 0.45, bodyY - bodyH * 0.95); g.bezierCurveTo(cx + bodyL * 0.9, bodyY - bodyH * 1.8, hx0 - S * 0.04, hy0 - S * 0.03, hx0 + S * 0.02, hy0);
      g.bezierCurveTo(hx0 + S * 0.05, hy0 + S * 0.08, cx + bodyL * 1.05, bodyY - bodyH * 1.1, cx + bodyL * 0.95, bodyY - bodyH * 0.2); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.stroke();
      // грива
      g.strokeStyle = mane; g.lineWidth = S * 0.028; g.lineCap = 'round';
      for (let k = 0; k < 6; k++) { const t = k / 5; const mx = cx + bodyL * (0.5 + 0.75 * t), my = bodyY - bodyH * (1.0 + 1.1 * t); g.beginPath(); g.moveTo(mx, my); g.quadraticCurveTo(mx - S * 0.05 - (frame ? S * 0.04 : 0), my + S * 0.02, mx - S * 0.09 - (frame ? S * 0.06 : 0), my + S * 0.06 + (frame ? -S * 0.03 : 0)); g.stroke(); }
      // глава: череп + муцуна
      const hd = g.createRadialGradient(hx0 + S * 0.02, hy0 + S * 0.02, S * 0.01, hx0 + S * 0.06, hy0 + S * 0.06, S * 0.2); hd.addColorStop(0, shade(coat, 1.35)); hd.addColorStop(1, shade(coat, 0.7));
      g.fillStyle = hd;
      g.beginPath(); g.moveTo(hx0 - S * 0.04, hy0 - S * 0.02);
      g.bezierCurveTo(hx0 + S * 0.08, hy0 - S * 0.06, hx0 + S * 0.2, hy0 + S * 0.06, hx0 + S * 0.24, hy0 + S * 0.16);   // чело → муцуна
      g.bezierCurveTo(hx0 + S * 0.26, hy0 + S * 0.22, hx0 + S * 0.2, hy0 + S * 0.25, hx0 + S * 0.15, hy0 + S * 0.22);  // ноздра/устни
      g.bezierCurveTo(hx0 + S * 0.08, hy0 + S * 0.2, hx0 + S * 0.02, hy0 + S * 0.16, hx0 - S * 0.02, hy0 + S * 0.1);   // челюст
      g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.stroke();
      // уши
      poly(g, [[hx0 - S * 0.03, hy0 - S * 0.02], [hx0 - S * 0.02, hy0 - S * 0.1], [hx0 + S * 0.02, hy0 - S * 0.025]], shade(coat, 0.9), 'rgba(0,0,0,0.3)', 1);
      poly(g, [[hx0 + S * 0.02, hy0 - S * 0.02], [hx0 + S * 0.045, hy0 - S * 0.1], [hx0 + S * 0.065, hy0 - S * 0.015]], shade(coat, 1.05), 'rgba(0,0,0,0.3)', 1);
      // око, ноздра
      ell(g, hx0 + S * 0.075, hy0 + S * 0.035, S * 0.014, S * 0.011, '#120c08'); circ(g, hx0 + S * 0.08, hy0 + S * 0.03, S * 0.004, 'rgba(255,255,255,0.8)');
      ell(g, hx0 + S * 0.2, hy0 + S * 0.16, S * 0.01, S * 0.008, 'rgba(0,0,0,0.6)');
      // юзда и повод
      g.strokeStyle = '#3a2a1a'; g.lineWidth = S * 0.012; g.beginPath(); g.moveTo(hx0 + S * 0.06, hy0 + S * 0.07); g.lineTo(hx0 + S * 0.19, hy0 + S * 0.19); g.moveTo(hx0 + S * 0.06, hy0 + S * 0.07); g.lineTo(hx0 - S * 0.02, hy0 + S * 0.1); g.stroke();
      g.strokeStyle = '#4a3a2a'; g.lineWidth = S * 0.008; g.beginPath(); g.moveTo(hx0 + S * 0.17, hy0 + S * 0.19); g.quadraticCurveTo(cx + bodyL * 0.6, bodyY - bodyH * 1.6, cx + S * 0.08, bodyY - bodyH * 1.45); g.stroke();
      // близки крака (пред тялото)
      horseLeg(g, cx - S * 0.18, bodyY + bodyH * 0.6, pose[1][0], pose[1][1], L1, L2, th, coat, false);
      horseLeg(g, cx + S * 0.28, bodyY + bodyH * 0.55, pose[3][0], pose[3][1], L1, L2, th, coat, false);
      // седло и чул в цвета на играча
      g.fillStyle = lgrad(g, cx - S * 0.2, 0, cx + S * 0.2, 0, [[0, shade(color, 0.7)], [0.5, color], [1, shade(color, 0.7)]]); g.beginPath(); g.moveTo(cx - S * 0.2, bodyY - bodyH * 0.9); g.lineTo(cx + S * 0.18, bodyY - bodyH * 0.85); g.lineTo(cx + S * 0.14, bodyY + bodyH * 0.55); g.lineTo(cx - S * 0.18, bodyY + bodyH * 0.6); g.closePath(); g.fill();
      g.strokeStyle = '#e8c46a'; g.lineWidth = Math.max(1, S * 0.008); g.stroke();
      g.fillStyle = lgrad(g, 0, bodyY - bodyH * 1.05, 0, bodyY - bodyH * 0.6, [[0, '#7a4a20'], [1, '#3a2210']]); g.beginPath(); g.ellipse(cx - S * 0.01, bodyY - bodyH * 0.8, S * 0.15, S * 0.045, 0, 0, TAU); g.fill();
      g.strokeStyle = '#3a2a1a'; g.lineWidth = S * 0.012; g.beginPath(); g.moveTo(cx - S * 0.02, bodyY - bodyH * 0.6); g.lineTo(cx - S * 0.03, bodyY + bodyH * 1.0); g.stroke(); // ремък
      // --- рицар
      const rx = cx - S * 0.01, ry = bodyY - bodyH * 0.95; // седалка
      const steel = (x0, y0, x1, y1) => lgrad(g, x0, y0, x1, y1, [[0, '#f4f6f8'], [0.35, '#b8c0ca'], [0.7, '#6f7883'], [1, '#3a4149']]);
      // наметка с гънки
      g.fillStyle = lgrad(g, rx - S * 0.3, ry - S * 0.5, rx, ry, [[0, shade(color, 1.25)], [0.6, color], [1, shade(color, 0.5)]]);
      g.beginPath(); g.moveTo(rx - S * 0.02, ry - S * 0.42); g.bezierCurveTo(rx - S * 0.16, ry - S * 0.36, rx - S * 0.3 - (frame ? S * 0.08 : 0), ry - S * 0.1, rx - S * 0.24 - (frame ? S * 0.1 : 0), ry + S * 0.15); g.lineTo(rx - S * 0.1, ry + S * 0.02); g.lineTo(rx + S * 0.02, ry - S * 0.1); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = S * 0.006; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(rx - S * 0.05 - k * S * 0.04, ry - S * 0.36 + k * S * 0.03); g.quadraticCurveTo(rx - S * 0.15 - k * S * 0.05, ry - S * 0.15, rx - S * 0.2 - k * S * 0.03 - (frame ? S * 0.08 : 0), ry + S * 0.1); g.stroke(); }
      // крак в набедреник и стреме
      g.strokeStyle = steel(rx, ry, rx, ry + S * 0.3); g.lineWidth = S * 0.06; g.lineCap = 'round'; g.beginPath(); g.moveTo(rx + S * 0.02, ry); g.lineTo(rx + S * 0.06, ry + S * 0.18); g.lineTo(rx + S * 0.03, ry + S * 0.3); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = S * 0.008; g.beginPath(); g.moveTo(rx + S * 0.06, ry + S * 0.18); g.lineTo(rx + S * 0.03, ry + S * 0.3); g.stroke();
      g.fillStyle = '#2a2a30'; g.beginPath(); g.roundRect(rx - S * 0.01, ry + S * 0.29, S * 0.09, S * 0.035, S * 0.01); g.fill();
      // торс (нагръдник)
      g.fillStyle = steel(rx - S * 0.1, ry - S * 0.4, rx + S * 0.1, ry - S * 0.05); g.beginPath(); g.moveTo(rx - S * 0.09, ry - S * 0.42); g.lineTo(rx + S * 0.1, ry - S * 0.42); g.quadraticCurveTo(rx + S * 0.13, ry - S * 0.25, rx + S * 0.08, ry - S * 0.04); g.lineTo(rx - S * 0.07, ry - S * 0.04); g.quadraticCurveTo(rx - S * 0.12, ry - S * 0.25, rx - S * 0.09, ry - S * 0.42); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = Math.max(1, S * 0.006); g.stroke();
      // гербова табарда в цвета на играча
      g.fillStyle = lgrad(g, rx - S * 0.06, 0, rx + S * 0.06, 0, [[0, shade(color, 0.85)], [0.5, shade(color, 1.15)], [1, shade(color, 0.85)]]); g.beginPath(); g.moveTo(rx - S * 0.05, ry - S * 0.38); g.lineTo(rx + S * 0.06, ry - S * 0.38); g.lineTo(rx + S * 0.05, ry - S * 0.1); g.lineTo(rx - S * 0.04, ry - S * 0.1); g.closePath(); g.fill();
      g.fillStyle = '#e8c46a'; g.beginPath(); g.moveTo(rx + S * 0.005, ry - S * 0.33); g.lineTo(rx + S * 0.03, ry - S * 0.27); g.lineTo(rx + S * 0.005, ry - S * 0.17); g.lineTo(rx - S * 0.02, ry - S * 0.27); g.closePath(); g.fill();
      // колан
      g.fillStyle = '#3a2a1a'; g.fillRect(rx - S * 0.08, ry - S * 0.08, S * 0.17, S * 0.03); circ(g, rx + S * 0.01, ry - S * 0.065, S * 0.012, '#e8c46a');
      // наплечници
      g.fillStyle = steel(rx - S * 0.14, ry - S * 0.48, rx - S * 0.02, ry - S * 0.3); g.beginPath(); g.ellipse(rx - S * 0.08, ry - S * 0.4, S * 0.07, S * 0.05, -0.3, 0, TAU); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.4)'; g.stroke();
      g.fillStyle = steel(rx + S * 0.03, ry - S * 0.48, rx + S * 0.16, ry - S * 0.3); g.beginPath(); g.ellipse(rx + S * 0.1, ry - S * 0.4, S * 0.07, S * 0.05, 0.3, 0, TAU); g.fill(); g.stroke();
      // ръка с юзда (предна)
      g.strokeStyle = steel(rx, ry - S * 0.4, rx + S * 0.2, ry - S * 0.2); g.lineWidth = S * 0.05; g.beginPath(); g.moveTo(rx + S * 0.1, ry - S * 0.36); g.lineTo(rx + S * 0.2, ry - S * 0.22); g.lineTo(rx + S * 0.24, ry - S * 0.3); g.stroke();
      g.fillStyle = '#5a3a1a'; g.beginPath(); g.arc(rx + S * 0.245, ry - S * 0.31, S * 0.025, 0, TAU); g.fill();
      // копие с пряпорец
      g.strokeStyle = lgrad(g, rx, 0, rx + S * 0.05, 0, [[0, '#8a5a2a'], [1, '#4a2e12']]); g.lineWidth = S * 0.022; g.lineCap = 'round'; g.beginPath(); g.moveTo(rx + S * 0.12, ry + S * 0.05); g.lineTo(rx + S * 0.26, ry - S * 1.02); g.stroke();
      g.fillStyle = steel(rx + S * 0.2, ry - S * 1.12, rx + S * 0.3, ry - S * 1.0); poly(g, [[rx + S * 0.265, ry - S * 1.12], [rx + S * 0.3, ry - S * 1.0], [rx + S * 0.23, ry - S * 1.0]], g.fillStyle, 'rgba(0,0,0,0.4)', 1);
      g.fillStyle = lgrad(g, rx + S * 0.25, 0, rx + S * 0.5, 0, [[0, shade(color, 1.2)], [1, shade(color, 0.8)]]); g.beginPath(); g.moveTo(rx + S * 0.255, ry - S * 0.98); g.quadraticCurveTo(rx + S * 0.4, ry - S * 0.99 + (frame ? S * 0.02 : 0), rx + S * 0.5, ry - S * 0.93); g.lineTo(rx + S * 0.4, ry - S * 0.88); g.quadraticCurveTo(rx + S * 0.33, ry - S * 0.85, rx + S * 0.245, ry - S * 0.86); g.closePath(); g.fill();
      // шлем с визьор и перо
      const hy = ry - S * 0.53;
      g.fillStyle = steel(rx - S * 0.08, hy - S * 0.1, rx + S * 0.08, hy + S * 0.08); g.beginPath(); g.moveTo(rx - S * 0.075, hy + S * 0.09); g.lineTo(rx - S * 0.075, hy - S * 0.02); g.quadraticCurveTo(rx - S * 0.07, hy - S * 0.12, rx + S * 0.01, hy - S * 0.12); g.quadraticCurveTo(rx + S * 0.09, hy - S * 0.12, rx + S * 0.09, hy - S * 0.02); g.lineTo(rx + S * 0.085, hy + S * 0.09); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = Math.max(1, S * 0.006); g.stroke();
      g.fillStyle = '#0a0a10'; g.fillRect(rx + S * 0.0, hy - S * 0.005, S * 0.08, S * 0.02); // визьор
      g.strokeStyle = 'rgba(0,0,0,0.5)'; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(rx + S * 0.03 + k * S * 0.02, hy + S * 0.03); g.lineTo(rx + S * 0.03 + k * S * 0.02, hy + S * 0.08); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(rx - S * 0.02, hy - S * 0.07, S * 0.035, S * 0.015, -0.4, 0, TAU); g.fill();
      g.fillStyle = lgrad(g, rx, hy - S * 0.2, rx + S * 0.15, hy - S * 0.1, [[0, shade(color, 1.3)], [1, shade(color, 0.7)]]); g.beginPath(); g.moveTo(rx + S * 0.0, hy - S * 0.11); g.quadraticCurveTo(rx - S * 0.02, hy - S * 0.24, rx - S * 0.16 - (frame ? S * 0.05 : 0), hy - S * 0.2); g.quadraticCurveTo(rx - S * 0.08, hy - S * 0.17, rx - S * 0.05, hy - S * 0.1); g.closePath(); g.fill();
      // щит на хълбока
      g.fillStyle = lgrad(g, rx - S * 0.2, ry - S * 0.2, rx - S * 0.05, ry + S * 0.05, [[0, shade(color, 1.3)], [1, shade(color, 0.6)]]); g.beginPath(); g.moveTo(rx - S * 0.2, ry - S * 0.22); g.lineTo(rx - S * 0.06, ry - S * 0.22); g.lineTo(rx - S * 0.06, ry - S * 0.02); g.quadraticCurveTo(rx - S * 0.13, ry + S * 0.1, rx - S * 0.2, ry - S * 0.02); g.closePath(); g.fill(); g.strokeStyle = '#e8c46a'; g.lineWidth = Math.max(1, S * 0.01); g.stroke();
      g.fillStyle = '#f4f6f8'; g.beginPath(); g.moveTo(rx - S * 0.13, ry - S * 0.18); g.lineTo(rx - S * 0.1, ry - S * 0.12); g.lineTo(rx - S * 0.13, ry - S * 0.04); g.lineTo(rx - S * 0.16, ry - S * 0.12); g.closePath(); g.fill();
    });
  }

  // ---------------------------------------------------------------- същества
  const FAM_COLOR = { kingdom: '#6f9fe8', grove: '#6fc070', necropolis: '#a07fd0', neutral: '#c0a070', academy: '#a8d0f0', inferno: '#e07050', dungeon: '#9070b0', horde: '#c89050', marsh: '#70a070', elements: '#d0b8f8', harbor: '#50b0c8', workshop: '#c0a878' };
  const SKIN = { kingdom: '#e8c8a0', grove: '#e8d0b0', necropolis: '#d8d8c8', academy: '#e8d8c8', inferno: '#c05040', dungeon: '#8a70a0', horde: '#8aa060', marsh: '#7a9a50', elements: '#e8e0ff', harbor: '#e0c0a0', workshop: '#e8c8a0', neutral: '#d0b090' };
  function humanoid(g, cx, gy, S, opt) {
    // opt: skin, cloth, armor(0..3), weapon: 'sword'|'spear'|'bow'|'staff'|'axe'|'gun'|'club', shield, cape, hood, helmet, robe, big
    const k = opt.big ? 1.35 : 1;
    const skin = opt.skin, cloth = opt.cloth;
    shadow(g, cx, gy, S * 0.22 * k, S * 0.07 * k, 0.35);
    // крака
    g.fillStyle = shade(cloth, 0.55); [[-0.07, 0], [0.07, 0]].forEach(([dx]) => { g.beginPath(); g.roundRect(cx + dx * S * k - S * 0.05 * k, gy - S * 0.28 * k, S * 0.1 * k, S * 0.28 * k, S * 0.03); g.fill(); });
    g.fillStyle = '#2a2018'; [[-0.08, 0], [0.06, 0]].forEach(([dx]) => { g.beginPath(); g.roundRect(cx + dx * S * k - S * 0.055 * k, gy - S * 0.07 * k, S * 0.12 * k, S * 0.07 * k, S * 0.02); g.fill(); });
    // наметка
    if (opt.cape) { g.fillStyle = lgrad(g, cx - S * 0.2, gy - S * 0.6, cx, gy, [[0, shade(opt.cape, 1.15)], [1, shade(opt.cape, 0.5)]]); g.beginPath(); g.moveTo(cx - S * 0.1 * k, gy - S * 0.62 * k); g.quadraticCurveTo(cx - S * 0.34 * k, gy - S * 0.4 * k, cx - S * 0.26 * k, gy - S * 0.08 * k); g.lineTo(cx + S * 0.02 * k, gy - S * 0.3 * k); g.fill(); }
    // тяло / роба
    if (opt.robe) { g.fillStyle = lgrad(g, cx - S * 0.2, 0, cx + S * 0.2, 0, [[0, shade(cloth, 1.2)], [1, shade(cloth, 0.6)]]); g.beginPath(); g.moveTo(cx - S * 0.12 * k, gy - S * 0.62 * k); g.lineTo(cx + S * 0.12 * k, gy - S * 0.62 * k); g.lineTo(cx + S * 0.22 * k, gy - S * 0.02 * k); g.lineTo(cx - S * 0.22 * k, gy - S * 0.02 * k); g.closePath(); g.fill(); }
    else { g.fillStyle = lgrad(g, cx - S * 0.15, 0, cx + S * 0.15, 0, [[0, shade(cloth, 1.2)], [1, shade(cloth, 0.6)]]); g.beginPath(); g.roundRect(cx - S * 0.15 * k, gy - S * 0.62 * k, S * 0.3 * k, S * 0.36 * k, S * 0.05); g.fill(); }
    // броня
    if (opt.armor) { g.fillStyle = lgrad(g, cx - S * 0.15, gy - S * 0.62, cx + S * 0.15, gy - S * 0.3, [[0, '#e0e6ee'], [0.5, '#9aa4b0'], [1, '#5a6470']]); g.beginPath(); g.roundRect(cx - S * 0.14 * k, gy - S * 0.6 * k, S * 0.28 * k, S * 0.22 * k * (opt.armor >= 2 ? 1.3 : 1), S * 0.05); g.fill(); if (opt.armor >= 2) { ell(g, cx - S * 0.16 * k, gy - S * 0.6 * k, S * 0.07 * k, S * 0.05 * k, '#c0c8d0'); ell(g, cx + S * 0.16 * k, gy - S * 0.6 * k, S * 0.07 * k, S * 0.05 * k, '#c0c8d0'); } if (opt.armor >= 3) { g.strokeStyle = '#ffd870'; g.lineWidth = Math.max(1, S * 0.012); g.strokeRect(cx - S * 0.1 * k, gy - S * 0.56 * k, S * 0.2 * k, S * 0.16 * k); } }
    // колан
    g.fillStyle = '#3a2a1a'; g.fillRect(cx - S * 0.15 * k, gy - S * 0.3 * k, S * 0.3 * k, S * 0.04 * k);
    // ръце
    g.fillStyle = opt.armor ? '#9aa4b0' : skin; g.beginPath(); g.roundRect(cx - S * 0.22 * k, gy - S * 0.6 * k, S * 0.08 * k, S * 0.28 * k, S * 0.04); g.fill(); g.beginPath(); g.roundRect(cx + S * 0.14 * k, gy - S * 0.6 * k, S * 0.08 * k, S * 0.28 * k, S * 0.04); g.fill();
    // глава
    sphere(g, cx, gy - S * 0.72 * k, S * 0.1 * k, skin);
    g.fillStyle = '#2a1a10'; g.fillRect(cx - S * 0.045 * k, gy - S * 0.735 * k, S * 0.025 * k, S * 0.025 * k); g.fillRect(cx + S * 0.02 * k, gy - S * 0.735 * k, S * 0.025 * k, S * 0.025 * k);
    if (opt.helmet) { g.fillStyle = lgrad(g, cx - S * 0.11, gy - S * 0.85, cx + S * 0.11, gy - S * 0.7, [[0, '#e8ecf0'], [1, '#6a7480']]); g.beginPath(); g.arc(cx, gy - S * 0.74 * k, S * 0.11 * k, Math.PI, 0); g.fill(); if (opt.helmet >= 2) { g.fillStyle = opt.plume || '#d23c3c'; g.beginPath(); g.moveTo(cx - S * 0.02 * k, gy - S * 0.85 * k); g.quadraticCurveTo(cx + S * 0.02 * k, gy - S * 0.98 * k, cx + S * 0.14 * k, gy - S * 0.9 * k); g.lineTo(cx + S * 0.03 * k, gy - S * 0.84 * k); g.fill(); } }
    if (opt.hood) { g.fillStyle = shade(cloth, 0.7); g.beginPath(); g.moveTo(cx - S * 0.13 * k, gy - S * 0.66 * k); g.quadraticCurveTo(cx, gy - S * 0.98 * k, cx + S * 0.13 * k, gy - S * 0.66 * k); g.lineTo(cx + S * 0.1 * k, gy - S * 0.6 * k); g.lineTo(cx - S * 0.1 * k, gy - S * 0.6 * k); g.fill(); }
    if (opt.hat) { g.fillStyle = shade(cloth, 0.6); poly(g, [[cx - S * 0.16 * k, gy - S * 0.78 * k], [cx + S * 0.02 * k, gy - S * 1.12 * k], [cx + S * 0.16 * k, gy - S * 0.78 * k]], g.fillStyle); g.fillStyle = '#e8c040'; g.fillRect(cx - S * 0.14 * k, gy - S * 0.8 * k, S * 0.28 * k, S * 0.025 * k); }
    // оръжие
    const wx = cx + S * 0.2 * k;
    g.lineCap = 'round';
    if (opt.weapon === 'sword') { g.strokeStyle = '#e0e6ee'; g.lineWidth = S * 0.035 * k; g.beginPath(); g.moveTo(wx, gy - S * 0.36 * k); g.lineTo(wx + S * 0.06 * k, gy - S * 0.9 * k); g.stroke(); g.strokeStyle = '#c9a961'; g.lineWidth = S * 0.03 * k; g.beginPath(); g.moveTo(wx - S * 0.05 * k, gy - S * 0.45 * k); g.lineTo(wx + S * 0.07 * k, gy - S * 0.42 * k); g.stroke(); }
    if (opt.weapon === 'spear') { g.strokeStyle = '#6a4a2a'; g.lineWidth = S * 0.03 * k; g.beginPath(); g.moveTo(wx, gy - S * 0.05 * k); g.lineTo(wx + S * 0.02 * k, gy - S * 1.15 * k); g.stroke(); poly(g, [[wx + S * 0.02 * k, gy - S * 1.24 * k], [wx + S * 0.06 * k, gy - S * 1.12 * k], [wx - S * 0.02 * k, gy - S * 1.12 * k]], '#e0e6ee'); }
    if (opt.weapon === 'axe') { g.strokeStyle = '#6a4a2a'; g.lineWidth = S * 0.035 * k; g.beginPath(); g.moveTo(wx, gy - S * 0.2 * k); g.lineTo(wx + S * 0.04 * k, gy - S * 0.95 * k); g.stroke(); poly(g, [[wx + S * 0.04 * k, gy - S * 0.98 * k], [wx + S * 0.2 * k, gy - S * 0.92 * k], [wx + S * 0.18 * k, gy - S * 0.72 * k], [wx + S * 0.03 * k, gy - S * 0.78 * k]], lgrad(g, wx, gy - S, wx + S * 0.2, gy - S * 0.7, [[0, '#e0e6ee'], [1, '#6a7480']])); }
    if (opt.weapon === 'club') { g.strokeStyle = '#6a4a2a'; g.lineWidth = S * 0.05 * k; g.beginPath(); g.moveTo(wx, gy - S * 0.3 * k); g.lineTo(wx + S * 0.1 * k, gy - S * 0.85 * k); g.stroke(); sphere(g, wx + S * 0.12 * k, gy - S * 0.9 * k, S * 0.08 * k, '#5a4a3a'); }
    if (opt.weapon === 'bow') { g.strokeStyle = '#8a5a2a'; g.lineWidth = S * 0.035 * k; g.beginPath(); g.arc(wx + S * 0.02 * k, gy - S * 0.5 * k, S * 0.3 * k, -Math.PI / 2 - 0.35, Math.PI / 2 + 0.35); g.stroke(); g.strokeStyle = '#f0f0f0'; g.lineWidth = Math.max(1, S * 0.012); g.beginPath(); g.moveTo(wx - S * 0.06 * k, gy - S * 0.22 * k); g.lineTo(wx - S * 0.06 * k, gy - S * 0.78 * k); g.stroke(); g.strokeStyle = '#d8c090'; g.lineWidth = S * 0.02; g.beginPath(); g.moveTo(wx - S * 0.06 * k, gy - S * 0.5 * k); g.lineTo(wx + S * 0.28 * k, gy - S * 0.5 * k); g.stroke(); }
    if (opt.weapon === 'staff') { g.strokeStyle = '#5a3e1e'; g.lineWidth = S * 0.035 * k; g.beginPath(); g.moveTo(wx, gy - S * 0.02 * k); g.lineTo(wx + S * 0.02 * k, gy - S * 1.0 * k); g.stroke(); g.fillStyle = rgrad(g, wx + S * 0.02 * k, gy - S * 1.06 * k, S * 0.12 * k, opt.gem || '#c0a0ff', rgba(opt.gem || '#c0a0ff', 0)); g.fillRect(wx - S * 0.12 * k, gy - S * 1.2 * k, S * 0.28 * k, S * 0.28 * k); sphere(g, wx + S * 0.02 * k, gy - S * 1.06 * k, S * 0.05 * k, opt.gem || '#c0a0ff'); }
    if (opt.weapon === 'gun') { g.strokeStyle = '#3a3a40'; g.lineWidth = S * 0.04 * k; g.beginPath(); g.moveTo(wx - S * 0.02 * k, gy - S * 0.5 * k); g.lineTo(wx + S * 0.34 * k, gy - S * 0.56 * k); g.stroke(); g.fillStyle = '#6a4a2a'; g.fillRect(wx - S * 0.06 * k, gy - S * 0.52 * k, S * 0.1 * k, S * 0.1 * k); }
    if (opt.shield) { g.fillStyle = lgrad(g, cx - S * 0.32, gy - S * 0.6, cx - S * 0.1, gy - S * 0.3, [[0, shade(opt.shield, 1.3)], [1, shade(opt.shield, 0.6)]]); g.beginPath(); g.moveTo(cx - S * 0.3 * k, gy - S * 0.58 * k); g.lineTo(cx - S * 0.1 * k, gy - S * 0.58 * k); g.lineTo(cx - S * 0.1 * k, gy - S * 0.36 * k); g.quadraticCurveTo(cx - S * 0.2 * k, gy - S * 0.22 * k, cx - S * 0.3 * k, gy - S * 0.36 * k); g.fill(); g.strokeStyle = '#c9a961'; g.lineWidth = Math.max(1, S * 0.015); g.stroke(); circ(g, cx - S * 0.2 * k, gy - S * 0.45 * k, S * 0.03 * k, '#c9a961'); }
  }
  function quadruped(g, cx, gy, S, col, opt) {
    // opt: horn, wings, rider, mane, scales, tail, head:'wolf'|'horse'|'lizard'|'bull'
    shadow(g, cx, gy, S * 0.4, S * 0.1, 0.35);
    g.fillStyle = shade(col, 0.7); [[-0.3, 0], [-0.18, 0.01], [0.16, 0.01], [0.28, 0]].forEach(([dx]) => { g.beginPath(); g.roundRect(cx + dx * S - S * 0.04, gy - S * 0.3, S * 0.08, S * 0.3, S * 0.03); g.fill(); });
    if (opt.wings) { g.fillStyle = lgrad(g, cx - S * 0.1, gy - S * 1.0, cx - S * 0.5, gy - S * 0.5, [[0, shade(col, 1.4)], [1, shade(col, 0.7)]]); g.beginPath(); g.moveTo(cx - S * 0.05, gy - S * 0.55); g.quadraticCurveTo(cx - S * 0.35, gy - S * 1.05, cx - S * 0.55, gy - S * 0.75); g.quadraticCurveTo(cx - S * 0.35, gy - S * 0.7, cx - S * 0.15, gy - S * 0.5); g.fill(); }
    g.fillStyle = rgrad(g, cx, gy - S * 0.45, S * 0.4, shade(col, 1.3), shade(col, 0.65), -S * 0.12, -S * 0.12); g.beginPath(); g.ellipse(cx, gy - S * 0.42, S * 0.36, S * 0.18, 0, 0, TAU); g.fill();
    if (opt.scales) { g.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 12; i++) { const x = cx - S * 0.28 + (i % 4) * S * 0.18, y = gy - S * 0.55 + Math.floor(i / 4) * S * 0.1; g.beginPath(); g.arc(x, y, S * 0.05, 0, Math.PI); g.fill(); } }
    // опашка
    g.strokeStyle = shade(col, 0.6); g.lineWidth = S * 0.05; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - S * 0.34, gy - S * 0.46); g.quadraticCurveTo(cx - S * 0.5, gy - S * 0.55, cx - S * 0.48, gy - S * (opt.tail === 'up' ? 0.8 : 0.2)); g.stroke();
    // шия и глава
    g.fillStyle = shade(col, 1.05); g.beginPath(); g.moveTo(cx + S * 0.2, gy - S * 0.52); g.quadraticCurveTo(cx + S * 0.38, gy - S * 0.85, cx + S * 0.46, gy - S * 0.72); g.lineTo(cx + S * 0.34, gy - S * 0.44); g.fill();
    const hx = cx + S * 0.44, hy = gy - S * 0.72;
    if (opt.head === 'wolf') { poly(g, [[hx - S * 0.1, hy - S * 0.1], [hx + S * 0.18, hy - S * 0.02], [hx + S * 0.16, hy + S * 0.08], [hx - S * 0.1, hy + S * 0.1]], shade(col, 1.05)); poly(g, [[hx - S * 0.06, hy - S * 0.1], [hx - S * 0.02, hy - S * 0.22], [hx + S * 0.04, hy - S * 0.1]], shade(col, 1.05)); }
    else if (opt.head === 'lizard') { poly(g, [[hx - S * 0.1, hy - S * 0.08], [hx + S * 0.22, hy], [hx - S * 0.1, hy + S * 0.09]], shade(col, 1.1)); }
    else ell(g, hx, hy, S * 0.13, S * 0.085, shade(col, 1.05));
    circ(g, hx + S * 0.06, hy - S * 0.02, S * 0.016, opt.eye || '#000');
    if (opt.horn) { poly(g, [[hx - S * 0.02, hy - S * 0.08], [hx + S * 0.04, hy - S * 0.4], [hx + S * 0.03, hy - S * 0.08]], lgrad(g, hx, hy - S * 0.4, hx, hy, [[0, '#fff8e0'], [1, '#c9a961']])); }
    if (opt.mane) { g.strokeStyle = opt.mane; g.lineWidth = S * 0.05; g.beginPath(); g.moveTo(cx + S * 0.22, gy - S * 0.58); g.quadraticCurveTo(cx + S * 0.32, gy - S * 0.82, cx + S * 0.42, gy - S * 0.84); g.stroke(); }
    if (opt.rider) { humanoid(g, cx + S * 0.02, gy - S * 0.5, S * 0.75, Object.assign({ skin: '#e8c8a0', cloth: col }, opt.rider)); }
  }
  function creatureSprite(c, S, flip) {
    return sprite('c' + c.id + '_' + S + '_' + (flip ? 'f' : ''), S, S * 1.4, (g) => {
      const col = FAM_COLOR[c.faction] || '#aaa';
      const skin = SKIN[c.faction] || '#e8c8a0';
      const cx = S / 2, gy = S * 1.3;
      if (flip) { g.translate(S, 0); g.scale(-1, 1); }
      const upg = c.upg;
      const t = c.tier;
      const gold = upg ? '#ffd870' : null;
      switch (c.fam) {
        case 'infantry': humanoid(g, cx, gy, S, { skin, cloth: col, armor: t >= 4 ? 3 : t >= 2 ? 1 : 0, helmet: t >= 4 ? 2 : t >= 1 ? 1 : 0, plume: gold || '#d23c3c', weapon: t >= 4 ? 'sword' : c.faction === 'horde' ? 'club' : 'spear', shield: t >= 2 ? (gold || shade(col, 0.8)) : null, cape: t >= 4 ? shade(col, 1.1) : null }); break;
        case 'archer': humanoid(g, cx, gy, S, { skin, cloth: shade(col, 0.9), armor: t >= 5 ? 1 : 0, hood: t < 4, weapon: c.faction === 'workshop' ? 'gun' : 'bow', cape: upg ? shade(col, 1.2) : null }); break;
        case 'mage': humanoid(g, cx, gy, S, { skin, cloth: shade(col, 0.85), robe: true, hat: c.faction === 'academy' || c.faction === 'harbor', hood: !(c.faction === 'academy' || c.faction === 'harbor'), weapon: 'staff', gem: gold || '#c0a0ff', cape: upg ? shade(col, 1.2) : null }); break;
        case 'undead': humanoid(g, cx, gy, S, { skin: '#e8e8d8', cloth: t >= 2 ? '#5a6a5a' : '#8a8a80', armor: upg ? 1 : 0, helmet: upg ? 1 : 0, weapon: t >= 2 ? 'club' : 'sword', shield: upg ? '#6a5a7a' : null }); g.fillStyle = '#000'; g.fillRect(cx - S * 0.05, gy - S * 0.74, S * 0.035, S * 0.035); g.fillRect(cx + S * 0.02, gy - S * 0.74, S * 0.035, S * 0.035); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(cx - S * 0.04, gy - S * 0.66, S * 0.08, S * 0.02); break;
        case 'giant': humanoid(g, cx, gy, S, { skin: c.faction === 'academy' ? (upg ? '#9aa4b0' : '#a89880') : c.faction === 'workshop' ? '#9a9aa8' : skin, cloth: col, big: true, armor: t >= 6 ? 3 : t >= 4 ? 2 : 0, helmet: t >= 6 ? 2 : 0, plume: gold || '#e8e0ff', weapon: c.faction === 'horde' ? 'club' : t >= 7 ? 'axe' : c.faction === 'inferno' ? 'axe' : 'club', cape: t >= 7 ? shade(col, 1.15) : null }); if (c.faction === 'academy' && t >= 7) { g.fillStyle = rgrad(g, cx + S * 0.3, gy - S * 1.2, S * 0.2, 'rgba(160,220,255,0.8)', 'rgba(160,220,255,0)'); g.fillRect(cx, gy - S * 1.4, S * 0.6, S * 0.5); } break;
        case 'rider': quadruped(g, cx, gy, S, c.faction === 'horde' ? '#8a8078' : c.faction === 'necropolis' ? '#2a2230' : c.faction === 'grove' ? '#a07a50' : '#7a5a3a', { head: c.faction === 'horde' ? 'wolf' : 'horse', mane: c.faction === 'grove' ? '#e8d8a0' : '#3a2a1a', tail: 'down', eye: c.faction === 'necropolis' ? '#f04040' : '#000', rider: c.faction === 'grove' ? null : { armor: t >= 6 ? 3 : 1, helmet: t >= 6 ? 2 : 1, plume: gold || '#d23c3c', weapon: t >= 6 ? 'spear' : c.faction === 'horde' ? 'axe' : 'bow', shield: t >= 6 ? (gold || col) : null, cape: shade(col, 1.1) } }); if (c.faction === 'grove') { humanoid(g, cx + S * 0.08, gy - S * 0.5, S * 0.75, { skin, cloth: col, weapon: 'bow', armor: upg ? 1 : 0 }); } break;
        case 'beast': quadruped(g, cx, gy, S, c.faction === 'grove' ? '#f4f0f8' : c.faction === 'marsh' ? '#6a8a4a' : c.faction === 'academy' ? '#c0a0d0' : c.faction === 'workshop' ? '#8a7a68' : c.faction === 'inferno' ? '#8a2a20' : col, { head: c.faction === 'marsh' || c.faction === 'academy' ? 'lizard' : c.faction === 'inferno' ? 'wolf' : 'horse', horn: c.faction === 'grove', scales: c.faction === 'marsh' || c.faction === 'workshop' || c.faction === 'academy', mane: c.faction === 'grove' ? '#e8e0f0' : c.faction === 'horde' ? '#3a2a1a' : null, tail: 'up', eye: c.faction === 'inferno' || c.faction === 'marsh' ? '#f04040' : '#000' }); if (c.faction === 'horde') { g.fillStyle = '#6a4a30'; g.beginPath(); g.ellipse(cx, gy - S * 0.6, S * 0.34, S * 0.22, 0, 0, TAU); g.fill(); poly(g, [[cx + S * 0.34, gy - S * 0.7], [cx + S * 0.52, gy - S * 0.9], [cx + S * 0.4, gy - S * 0.58]], '#e8dcc0'); } break;
        case 'tree': { shadow(g, cx, gy, S * 0.3, S * 0.09, 0.35); g.fillStyle = lgrad(g, cx - S * 0.18, 0, cx + S * 0.18, 0, [[0, '#7a5a30'], [1, '#3a2812']]); g.beginPath(); g.roundRect(cx - S * 0.18, gy - S * 0.7, S * 0.36, S * 0.7, S * 0.06); g.fill(); g.strokeStyle = '#5a3e1e'; g.lineWidth = S * 0.05; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - S * 0.16, gy - S * 0.5); g.lineTo(cx - S * 0.38, gy - S * 0.3); g.moveTo(cx + S * 0.16, gy - S * 0.55); g.lineTo(cx + S * 0.4, gy - S * 0.75); g.stroke(); sphere(g, cx, gy - S * 0.92, S * 0.3, upg ? '#4a9a3a' : '#3a7a2a'); sphere(g, cx - S * 0.22, gy - S * 0.8, S * 0.18, upg ? '#4a9a3a' : '#3a7a2a'); sphere(g, cx + S * 0.24, gy - S * 0.82, S * 0.17, upg ? '#4a9a3a' : '#3a7a2a'); g.fillStyle = '#ffe070'; g.fillRect(cx - S * 0.1, gy - S * 0.5, S * 0.05, S * 0.05); g.fillRect(cx + S * 0.05, gy - S * 0.5, S * 0.05, S * 0.05); g.fillStyle = '#2a1a10'; g.fillRect(cx - S * 0.06, gy - S * 0.38, S * 0.12, S * 0.03); break; }
        case 'flyer': case 'angel': case 'spirit': {
          const wingCol = c.fam === 'angel' ? (c.faction === 'inferno' ? '#5a1a1a' : '#f8f8ff') : c.fam === 'spirit' ? rgba(shade(col, 1.2), 0.65) : c.faction === 'grove' && t >= 4 ? '#f4f4ff' : shade(col, 1.2);
          shadow(g, cx, gy, S * 0.25, S * 0.07, 0.25);
          [[-1, 0], [1, 0]].forEach(([dir]) => { g.fillStyle = lgrad(g, cx, gy - S * 0.9, cx + dir * S * 0.5, gy - S * 0.4, [[0, shade(typeof wingCol === 'string' && wingCol[0] === '#' ? wingCol : '#ccc', 1.2)], [1, wingCol]]); g.beginPath(); g.moveTo(cx + dir * S * 0.08, gy - S * 0.62); g.quadraticCurveTo(cx + dir * S * 0.45, gy - S * 1.1, cx + dir * S * 0.55, gy - S * 0.7); g.quadraticCurveTo(cx + dir * S * 0.42, gy - S * 0.62, cx + dir * S * 0.3, gy - S * 0.36); g.quadraticCurveTo(cx + dir * S * 0.2, gy - S * 0.5, cx + dir * S * 0.08, gy - S * 0.45); g.fill(); if (c.fam === 'angel') { g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(cx + dir * S * 0.1, gy - S * 0.55); g.quadraticCurveTo(cx + dir * S * (0.3 + i * 0.05), gy - S * (0.9 - i * 0.1), cx + dir * S * (0.5 - i * 0.04), gy - S * (0.72 - i * 0.08)); g.stroke(); } } });
          if (c.fam === 'spirit') { g.fillStyle = lgrad(g, 0, gy - S * 0.9, 0, gy, [[0, rgba(shade(col, 1.4), 0.95)], [1, rgba(col, 0)]]); g.beginPath(); g.moveTo(cx - S * 0.16, gy - S * 0.7); g.quadraticCurveTo(cx, gy - S * 0.1, cx + S * 0.16, gy - S * 0.7); g.fill(); sphere(g, cx, gy - S * 0.78, S * 0.1, c.faction === 'inferno' ? '#c05040' : '#f0f0ff'); g.fillStyle = c.faction === 'necropolis' || c.faction === 'inferno' ? '#ff4040' : '#4060ff'; g.fillRect(cx - S * 0.05, gy - S * 0.8, S * 0.03, S * 0.03); g.fillRect(cx + S * 0.02, gy - S * 0.8, S * 0.03, S * 0.03); if (c.faction === 'inferno') { poly(g, [[cx - S * 0.08, gy - S * 0.85], [cx - S * 0.12, gy - S * 0.98], [cx - S * 0.03, gy - S * 0.88]], '#3a1a1a'); poly(g, [[cx + S * 0.08, gy - S * 0.85], [cx + S * 0.12, gy - S * 0.98], [cx + S * 0.03, gy - S * 0.88]], '#3a1a1a'); } }
          else if (c.fam === 'angel') { humanoid(g, cx, gy, S, { skin: c.faction === 'inferno' ? '#c04030' : skin, cloth: c.faction === 'inferno' ? '#3a1a1a' : '#f0f0ff', robe: true, armor: upg ? 3 : 1, weapon: 'sword', cape: null }); if (c.faction === 'inferno') { poly(g, [[cx - S * 0.08, gy - S * 0.8], [cx - S * 0.14, gy - S * 0.98], [cx - S * 0.02, gy - S * 0.82]], '#2a1010'); poly(g, [[cx + S * 0.08, gy - S * 0.8], [cx + S * 0.14, gy - S * 0.98], [cx + S * 0.02, gy - S * 0.82]], '#2a1010'); } else { g.strokeStyle = gold || '#ffe070'; g.lineWidth = S * 0.02; g.beginPath(); g.ellipse(cx, gy - S * 0.9, S * 0.1, S * 0.03, 0, 0, TAU); g.stroke(); } }
          else { // птици, грифони, пегаси, гаргойли
            const body = c.faction === 'kingdom' ? '#c8a060' : c.faction === 'academy' ? '#7a7a88' : c.faction === 'grove' ? '#f4f4ff' : c.faction === 'harbor' ? '#7ab0c8' : c.faction === 'horde' ? '#8a6a3a' : c.faction === 'marsh' ? '#6aa050' : c.faction === 'dungeon' ? '#8a6aa0' : c.faction === 'elements' ? '#ffb040' : col;
            g.fillStyle = rgrad(g, cx, gy - S * 0.5, S * 0.28, shade(body, 1.3), shade(body, 0.6), -S * 0.08, -S * 0.08); g.beginPath(); g.ellipse(cx, gy - S * 0.48, S * 0.2, S * 0.26, 0, 0, TAU); g.fill();
            sphere(g, cx + S * 0.04, gy - S * 0.8, S * 0.11, body);
            poly(g, [[cx + S * 0.12, gy - S * 0.8], [cx + S * 0.26, gy - S * 0.78], [cx + S * 0.12, gy - S * 0.74]], '#e8c040');
            circ(g, cx + S * 0.08, gy - S * 0.83, S * 0.02, '#000');
            g.strokeStyle = shade(body, 0.6); g.lineWidth = S * 0.04; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - S * 0.06, gy - S * 0.24); g.lineTo(cx - S * 0.08, gy - S * 0.04); g.moveTo(cx + S * 0.06, gy - S * 0.24); g.lineTo(cx + S * 0.08, gy - S * 0.04); g.stroke();
            if (c.faction === 'kingdom') { g.fillStyle = '#e8dcc0'; g.beginPath(); g.ellipse(cx + S * 0.04, gy - S * 0.8, S * 0.12, S * 0.1, 0, 0, TAU); g.fill(); circ(g, cx + S * 0.08, gy - S * 0.83, S * 0.02, '#000'); poly(g, [[cx + S * 0.14, gy - S * 0.8], [cx + S * 0.28, gy - S * 0.78], [cx + S * 0.14, gy - S * 0.73]], '#e8c040'); }
            if (c.faction === 'grove') { g.strokeStyle = '#e8e0f0'; g.lineWidth = S * 0.05; g.beginPath(); g.moveTo(cx - S * 0.02, gy - S * 0.88); g.quadraticCurveTo(cx - S * 0.2, gy - S * 0.95, cx - S * 0.26, gy - S * 0.7); g.stroke(); }
          }
          break;
        }
        case 'dragon': {
          const body = c.faction === 'necropolis' ? (upg ? '#c8d8c8' : '#d8d0c0') : upg && c.faction === 'grove' ? '#e8c040' : c.faction === 'grove' ? '#3fa050' : c.faction === 'dungeon' ? (upg ? '#2a2030' : '#c03030') : c.faction === 'marsh' ? (upg ? '#7a3aa0' : '#5a8a3a') : c.faction === 'harbor' ? '#3a8aa0' : c.faction === 'workshop' ? (t >= 7 ? (upg ? '#c03060' : '#40a080') : '#c0a070') : c.faction === 'neutral' ? '#5a7a4a' : col;
          shadow(g, cx, gy, S * 0.46, S * 0.11, 0.35);
          if (!(c.faction === 'workshop' && t === 5) && !(c.faction === 'marsh' && t === 7) && c.id !== 'n_hydra' && !(c.faction === 'harbor')) [[-1], [1]].forEach(([dir]) => { g.fillStyle = lgrad(g, cx, gy - S * 0.8, cx + dir * S * 0.5, gy - S * 0.3, [[0, shade(body, 0.9)], [1, shade(body, 0.5)]]); g.beginPath(); g.moveTo(cx + dir * S * 0.1, gy - S * 0.62); g.lineTo(cx + dir * S * 0.55, gy - S * 1.15); g.lineTo(cx + dir * S * 0.5, gy - S * 0.85); g.lineTo(cx + dir * S * 0.42, gy - S * 0.5); g.lineTo(cx + dir * S * 0.3, gy - S * 0.36); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = Math.max(1, S * 0.012); g.beginPath(); g.moveTo(cx + dir * S * 0.1, gy - S * 0.62); g.lineTo(cx + dir * S * 0.5, gy - S * 0.85); g.moveTo(cx + dir * S * 0.1, gy - S * 0.62); g.lineTo(cx + dir * S * 0.42, gy - S * 0.5); g.stroke(); });
          // крака
          g.fillStyle = shade(body, 0.7); [[-0.22], [0.18]].forEach(([dx]) => { g.beginPath(); g.roundRect(cx + dx * S - S * 0.06, gy - S * 0.3, S * 0.12, S * 0.3, S * 0.04); g.fill(); });
          // тяло
          g.fillStyle = rgrad(g, cx, gy - S * 0.5, S * 0.42, shade(body, 1.3), shade(body, 0.6), -S * 0.1, -S * 0.12); g.beginPath(); g.ellipse(cx, gy - S * 0.48, S * 0.34, S * 0.22, 0, 0, TAU); g.fill();
          g.fillStyle = 'rgba(0,0,0,0.1)'; for (let i = 0; i < 9; i++) { const x = cx - S * 0.24 + (i % 3) * S * 0.24, y = gy - S * 0.6 + Math.floor(i / 3) * S * 0.12; g.beginPath(); g.arc(x, y, S * 0.06, 0, Math.PI); g.fill(); }
          // опашка
          g.strokeStyle = shade(body, 0.8); g.lineWidth = S * 0.09; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - S * 0.3, gy - S * 0.42); g.quadraticCurveTo(cx - S * 0.6, gy - S * 0.55, cx - S * 0.56, gy - S * 0.15); g.stroke();
          // шия и глава (хидрата има три)
          const heads = c.id === 'n_hydra' || (c.faction === 'marsh' && t === 7) ? 3 : 1;
          for (let k = 0; k < heads; k++) {
            const off = heads === 1 ? 0 : (k - 1) * 0.22;
            g.fillStyle = shade(body, 1.0); g.beginPath(); g.moveTo(cx + S * 0.18, gy - S * 0.6); g.quadraticCurveTo(cx + S * (0.4 + off * 0.3), gy - S * (1.0 + off), cx + S * (0.5 + off * 0.4), gy - S * (0.88 + off * 1.2)); g.lineTo(cx + S * 0.34, gy - S * 0.44); g.fill();
            const hx = cx + S * (0.52 + off * 0.4), hy = gy - S * (0.9 + off * 1.2);
            poly(g, [[hx - S * 0.12, hy - S * 0.1], [hx + S * 0.22, hy - S * 0.02], [hx + S * 0.2, hy + S * 0.08], [hx - S * 0.1, hy + S * 0.1]], lgrad(g, hx, hy - S * 0.1, hx, hy + S * 0.1, [[0, shade(body, 1.2)], [1, shade(body, 0.7)]]));
            poly(g, [[hx - S * 0.06, hy - S * 0.1], [hx - S * 0.02, hy - S * 0.3], [hx + S * 0.05, hy - S * 0.1]], shade(body, 0.7));
            circ(g, hx + S * 0.06, hy - S * 0.02, S * 0.02, c.faction === 'necropolis' ? '#40ff80' : '#ffcc20');
            if (c.faction === 'inferno' || (c.faction === 'dungeon' && !upg)) { g.fillStyle = rgrad(g, hx + S * 0.3, hy + S * 0.02, S * 0.14, 'rgba(255,140,40,0.8)', 'rgba(255,140,40,0)'); g.fillRect(hx + S * 0.15, hy - S * 0.15, S * 0.35, S * 0.3); }
          }
          if (c.faction === 'workshop' && t === 5) { g.fillStyle = '#e0c8a0'; g.beginPath(); g.arc(cx + S * 0.52, gy - S * 0.9, S * 0.12, 0, TAU); g.fill(); g.fillStyle = '#3a1a10'; g.beginPath(); g.arc(cx + S * 0.52, gy - S * 0.9, S * 0.07, 0, TAU); g.fill(); }
          break;
        }
      }
      if (gold) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = rgrad(g, S * 0.14, S * 0.5, S * 0.07, '#fff0a0', '#e0a020'); g.beginPath(); g.moveTo(S * 0.14, S * 0.43); g.lineTo(S * 0.16, S * 0.48); g.lineTo(S * 0.21, S * 0.485); g.lineTo(S * 0.17, S * 0.52); g.lineTo(S * 0.185, S * 0.57); g.lineTo(S * 0.14, S * 0.545); g.lineTo(S * 0.095, S * 0.57); g.lineTo(S * 0.11, S * 0.52); g.lineTo(S * 0.07, S * 0.485); g.lineTo(S * 0.12, S * 0.48); g.closePath(); g.fill(); }
    });
  }

  // ---------------------------------------------------------------- портрет
  function portrait(h, S, color) {
    return sprite('p' + h.cls + '_' + h.portrait + '_' + S + '_' + color + '_' + (h.faction || ''), S, S, (g) => {
      const cls = D.CLASSES[h.cls];
      g.fillStyle = rgrad(g, S * 0.5, S * 0.35, S * 0.8, shade(color, 0.9), shade(color, 0.3)); g.fillRect(0, 0, S, S);
      // светлина зад героя
      g.fillStyle = rgrad(g, S * 0.5, S * 0.45, S * 0.45, 'rgba(255,240,200,0.35)', 'rgba(255,240,200,0)'); g.fillRect(0, 0, S, S);
      const skin = SKIN[h.faction] || ['#e8c8a0', '#d8b090', '#c89a70', '#f0d8b8', '#b88a60', '#e0c0a0'][h.portrait % 6];
      const hair = ['#3a2a1a', '#e8d080', '#8a3a1a', '#222', '#c0c0c0', '#6a3a2a'][(h.portrait + 2) % 6];
      // рамене
      g.fillStyle = lgrad(g, 0, S * 0.62, 0, S, [[0, cls.magic ? '#6a5a9a' : '#9aa4b0'], [1, cls.magic ? '#3a2a5a' : '#4a5460']]); g.beginPath(); g.moveTo(S * 0.1, S); g.quadraticCurveTo(S * 0.5, S * 0.55, S * 0.9, S); g.fill();
      g.fillStyle = color; g.beginPath(); g.moveTo(S * 0.32, S); g.quadraticCurveTo(S * 0.5, S * 0.7, S * 0.68, S); g.fill();
      // шия и лице
      g.fillStyle = shade(skin, 0.85); g.fillRect(S * 0.42, S * 0.58, S * 0.16, S * 0.14);
      g.fillStyle = rgrad(g, S * 0.5, S * 0.42, S * 0.28, shade(skin, 1.15), shade(skin, 0.75), -S * 0.08, -S * 0.08); g.beginPath(); g.ellipse(S * 0.5, S * 0.44, S * 0.19, S * 0.24, 0, 0, TAU); g.fill();
      // коса
      g.fillStyle = hair; g.beginPath(); g.ellipse(S * 0.5, S * 0.3, S * 0.2, S * 0.13, 0, Math.PI, 0); g.fill();
      if (h.portrait % 3 === 0) { g.beginPath(); g.moveTo(S * 0.3, S * 0.32); g.quadraticCurveTo(S * 0.28, S * 0.6, S * 0.34, S * 0.7); g.lineTo(S * 0.36, S * 0.34); g.fill(); g.beginPath(); g.moveTo(S * 0.7, S * 0.32); g.quadraticCurveTo(S * 0.72, S * 0.6, S * 0.66, S * 0.7); g.lineTo(S * 0.64, S * 0.34); g.fill(); }
      // очи, вежди, уста
      ell(g, S * 0.43, S * 0.45, S * 0.035, S * 0.022, '#fff'); ell(g, S * 0.57, S * 0.45, S * 0.035, S * 0.022, '#fff');
      circ(g, S * 0.435, S * 0.45, S * 0.016, '#2a3a5a'); circ(g, S * 0.565, S * 0.45, S * 0.016, '#2a3a5a');
      g.strokeStyle = shade(hair, 0.7); g.lineWidth = S * 0.02; g.beginPath(); g.moveTo(S * 0.38, S * 0.4); g.lineTo(S * 0.47, S * 0.39); g.moveTo(S * 0.53, S * 0.39); g.lineTo(S * 0.62, S * 0.4); g.stroke();
      g.strokeStyle = shade(skin, 0.55); g.lineWidth = S * 0.015; g.beginPath(); g.moveTo(S * 0.45, S * 0.57); g.quadraticCurveTo(S * 0.5, S * 0.6, S * 0.55, S * 0.57); g.stroke();
      // шлем / шапка
      if (cls.magic) { g.fillStyle = lgrad(g, S * 0.3, S * 0.05, S * 0.7, S * 0.3, [[0, '#7a6ab0'], [1, '#3a2a5a']]); poly(g, [[S * 0.24, S * 0.3], [S * 0.5, -S * 0.02], [S * 0.76, S * 0.3]], g.fillStyle); g.fillStyle = '#e8c040'; g.fillRect(S * 0.26, S * 0.28, S * 0.48, S * 0.03); }
      else { g.fillStyle = lgrad(g, S * 0.3, S * 0.1, S * 0.7, S * 0.35, [[0, '#e8ecf0'], [1, '#6a7480']]); g.beginPath(); g.ellipse(S * 0.5, S * 0.28, S * 0.22, S * 0.15, 0, Math.PI, 0); g.fill(); g.fillStyle = color; g.beginPath(); g.moveTo(S * 0.5, S * 0.13); g.quadraticCurveTo(S * 0.6, S * 0.02, S * 0.74, S * 0.1); g.lineTo(S * 0.58, S * 0.16); g.fill(); }
      // винетка и рамка
      g.fillStyle = rgrad(g, S * 0.5, S * 0.5, S * 0.75, 'rgba(0,0,0,0)', 'rgba(0,0,0,0.45)'); g.fillRect(0, 0, S, S);
    });
  }

  MK.Gfx = { terrainTile, terrainAtlas, edgeBlend, waterTile, warm, decor, objectSprite, heroSprite, creatureSprite, portrait, flagShape, hashN, shade, mix, rgba, FAM_COLOR, RES_ICON, TOWN_STYLE, clear: () => cache.clear() };
})();
