/* Генерира иконите на приложението (процедурно, с canvas в Chromium) */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const draw = `(size, fg) => {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  const S = size; const cx = S / 2;
  if (!fg) { const grd = g.createRadialGradient(cx, S * 0.4, S * 0.1, cx, cx, S * 0.75); grd.addColorStop(0, '#2a3a6a'); grd.addColorStop(1, '#0a0a18'); g.fillStyle = grd; g.fillRect(0, 0, S, S); }
  const k = fg ? 0.66 : 0.86; // безопасна зона за адаптивната икона
  g.save(); g.translate(cx, cx); g.scale(k, k); g.translate(-cx, -cx);
  // щит
  g.beginPath(); g.moveTo(cx, S * 0.08); g.lineTo(S * 0.86, S * 0.2); g.lineTo(S * 0.82, S * 0.55); g.quadraticCurveTo(S * 0.75, S * 0.82, cx, S * 0.95); g.quadraticCurveTo(S * 0.25, S * 0.82, S * 0.18, S * 0.55); g.lineTo(S * 0.14, S * 0.2); g.closePath();
  g.fillStyle = '#c9a961'; g.fill();
  g.lineWidth = S * 0.02; g.strokeStyle = '#5a4416'; g.stroke();
  g.save(); g.clip();
  g.fillStyle = '#7a1f2a'; g.fillRect(0, 0, cx, S); g.fillStyle = '#1f3a7a'; g.fillRect(cx, 0, cx, S);
  g.restore();
  // меч
  g.fillStyle = '#e8ecf0'; g.beginPath(); g.moveTo(cx - S * 0.035, S * 0.2); g.lineTo(cx + S * 0.035, S * 0.2); g.lineTo(cx + S * 0.03, S * 0.72); g.lineTo(cx, S * 0.8); g.lineTo(cx - S * 0.03, S * 0.72); g.closePath(); g.fill();
  g.fillStyle = '#ffd870'; g.fillRect(cx - S * 0.14, S * 0.2, S * 0.28, S * 0.045); g.fillRect(cx - S * 0.03, S * 0.1, S * 0.06, S * 0.1);
  // корона
  g.fillStyle = '#ffd870'; g.beginPath(); g.moveTo(cx - S * 0.2, S * 0.5); g.lineTo(cx - S * 0.2, S * 0.36); g.lineTo(cx - S * 0.1, S * 0.44); g.lineTo(cx, S * 0.32); g.lineTo(cx + S * 0.1, S * 0.44); g.lineTo(cx + S * 0.2, S * 0.36); g.lineTo(cx + S * 0.2, S * 0.5); g.closePath(); g.fill();
  g.fillStyle = '#d23c3c'; g.beginPath(); g.arc(cx, S * 0.44, S * 0.03, 0, Math.PI * 2); g.fill();
  g.restore();
  return c.toDataURL('image/png');
}`;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');
  const save = async (file, size, fg) => { const url = await page.evaluate(`(${draw})(${size}, ${fg})`); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64')); };
  const res = path.join(root, 'android/app/src/main/res');
  for (const [d, s] of [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]) await save(path.join(res, 'mipmap-' + d, 'ic_launcher.png'), s, false);
  await save(path.join(res, 'mipmap-xxxhdpi', 'ic_launcher_fg.png'), 432, true);
  await save(path.join(root, 'web/favicon.png'), 64, false);
  await save(path.join(root, 'web/apple-touch-icon.png'), 180, false);
  await save(path.join(root, 'web/icon-512.png'), 512, false);
  await browser.close();
  console.log('icons ok');
})();
