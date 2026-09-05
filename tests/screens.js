/* Playwright: зарежда играта, минава през менюто, картата, града, героя и битка; прави снимки */
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const fs = require('fs');
const root = path.join(__dirname, '..', 'web');
const out = process.argv[2] || '/tmp/shots';
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
(async () => {
  await new Promise((r) => server.listen(8765, r));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 480 }, deviceScaleFactor: 1 });
  errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('http://localhost:8765/');
  await page.waitForTimeout(500);
  await page.screenshot({ path: out + '/01-menu.png' });
  await page.click('text=Нова игра');
  await page.waitForTimeout(300);
  await page.screenshot({ path: out + '/02-setup.png' });
  await page.click('text=Започни');
  await page.waitForTimeout(800);
  await page.screenshot({ path: out + '/03-map.png' });
  // Град
  await page.evaluate(() => { const g = MK.game; const t = g.world.towns[g.world.players[0].towns[0]]; MK.UI.showTown(g, t); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: out + '/04-town.png' });
  await page.evaluate(() => { document.querySelector('.tabs button:nth-child(2)').click(); });
  await page.waitForTimeout(200);
  await page.screenshot({ path: out + '/05-recruit.png' });
  // Герой
  await page.evaluate(() => { const g = MK.game; MK.UI.closeScreens(); MK.UI.showHero(g, g.selected); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: out + '/06-hero.png' });
  await page.evaluate(() => MK.UI.closeScreens());
  // Битка: намираме най-близко чудовище и стартираме битка директно
  await page.evaluate(() => {
    const g = MK.game, w = g.world, h = g.selected;
    h.spells = ['magic_arrow', 'haste', 'slow', 'fireball']; h.mana = 30; h.pow = 3;
    const mon = w.map.objects.filter((o) => o.type === 'monster').sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
    const ctx = w.startBattle(h, { type: 'monster', obj: mon });
    g._battlePromise = g.fight(ctx);
  });
  await page.waitForTimeout(500);
  await page.click('text=В бой!');
  await page.waitForTimeout(1200);
  console.log('battle hidden:', await page.evaluate(() => document.getElementById('battle').hidden), 'errors so far:', errors.join(' | '));
  await page.screenshot({ path: out + '/07-battle.png' });
  // магьосническа книга
  const spellBtn = await page.$('text=Магия');
  if (spellBtn && !(await spellBtn.isDisabled())) { await spellBtn.click(); await page.waitForTimeout(300); await page.screenshot({ path: out + '/08-spellbook.png' }); await page.click('text=Затвори'); }
  // авто до края
  await page.click('text=Авто');
  await page.waitForTimeout(6000);
  await page.screenshot({ path: out + '/09-battle-end.png' });
  const dlg = await page.$('.modal button');
  if (dlg) await dlg.click();
  await page.waitForTimeout(500);
  // Край на хода
  await page.click('#btn-end');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: out + '/10-day2.png' });
  const info = await page.evaluate(() => { const g = MK.game; return { day: g.world.day, heroes: Object.keys(g.world.heroes).length, gold: g.world.players[0].res.gold, events: g.world.events.length, save: !!localStorage.getItem('mk_save') }; });
  console.log(JSON.stringify(info));
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors');
  await browser.close(); server.close();
})().catch((e) => { console.error(e); console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors'); process.exit(1); });
let errors = [];
