/* Playwright: по-дълбоки сценарии — строеж, набор, ниво нагоре, пазар, жилище, обсада, сейв/лоуд */
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const fs = require('fs');
const root = path.join(__dirname, '..', 'web');
const out = process.argv[2] || '/tmp/shots';
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(root, p); if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); });
let errors = [];
(async () => {
  await new Promise((r) => server.listen(8766, r));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 400 }, deviceScaleFactor: 1 }); // телефон в пейзаж
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('http://localhost:8766/');
  await page.waitForTimeout(400);
  await page.evaluate(() => MK.game.newGame({ size: 36, difficulty: 1, players: [{ faction: 'grove', human: true }, { faction: 'necropolis' }], seed: 4242 }));
  await page.waitForTimeout(400);
  await page.screenshot({ path: out + '/f01-map-phone.png' });
  // Строеж + набор
  await page.evaluate(() => { const g = MK.game; g.world.players[0].res.gold = 50000; MK.UI.showTown(g, g.world.towns[g.world.players[0].towns[0]]); });
  await page.waitForTimeout(200);
  await page.click('.row button:has-text("Строй")');
  await page.waitForTimeout(200);
  await page.click('.tabs button:nth-child(2)');
  await page.waitForTimeout(200);
  const all = await page.$('button:has-text("Всички")'); if (all) await all.click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: out + '/f02-recruit.png' });
  await page.click('.tabs button:nth-child(4)'); await page.waitForTimeout(200); await page.screenshot({ path: out + '/f03-tavern.png' });
  const hire = await page.$('button:has-text("Наеми")'); if (hire && !(await hire.isDisabled())) await hire.click();
  await page.waitForTimeout(200);
  await page.evaluate(() => { const g = MK.game; g.world.towns[g.world.players[0].towns[0]].buildings.market = true; });
  await page.click('.tabs button:nth-child(1)'); await page.waitForTimeout(100);
  await page.click('.tabs button:nth-child(5)'); await page.waitForTimeout(200); await page.screenshot({ path: out + '/f04-market.png' });
  await page.click('button:has-text("× 5")'); await page.waitForTimeout(100);
  // Гарнизон: тап-тап размяна
  await page.click('.tabs button:nth-child(1)');
  let slots = await page.$$('.slot'); if (slots.length >= 8) { await slots[7].click(); await page.waitForTimeout(150); slots = await page.$$('.slot'); await slots[0].click(); }
  await page.waitForTimeout(200);
  await page.screenshot({ path: out + '/f05-garrison.png' });
  await page.click('header button');
  // Ниво нагоре
  await page.evaluate(() => { const g = MK.game; const h = g.selected; g.world.gainXp(h, 2500); g.processLevelUps(h); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: out + '/f06-levelup.png' });
  for (let i = 0; i < 3; i++) { const b = await page.$('.modal .row button'); if (b) { await b.click(); await page.waitForTimeout(200); } }
  // Жилище
  await page.evaluate(() => { const g = MK.game; const o = g.world.map.objects.find((o) => o.type === 'dwelling'); o.available = 5; MK.UI.dwellingDialog(g, g.selected, o); });
  await page.waitForTimeout(200);
  await page.screenshot({ path: out + '/f07-dwelling.png' });
  await page.click('button:has-text("Наеми")');
  await page.waitForTimeout(200);
  // Обсада на неутрален/вражески град — човекът напада, авто
  await page.evaluate(() => { const g = MK.game, w = g.world, h = g.selected; MK.Army.add(h.army, 'grove7u', 20); const t = w.towns[w.players[1].towns[0]]; t.buildings.fort2 = true; MK.Army.add(t.garrison, 'necropolis3', 15); const ctx = w.startBattle(h, { type: 'town', town: t }); g._bp = g.handleEvent(ctx); });
  await page.waitForTimeout(400);
  await page.click('text=В бой!');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out + '/f08-siege.png' });
  await page.click('button:has-text("Авто")');
  await page.waitForTimeout(8000);
  await page.screenshot({ path: out + '/f09-siege-end.png' });
  let dlg = await page.$('.modal button'); if (dlg) { await dlg.click(); await page.waitForTimeout(400); }
  dlg = await page.$('.modal button'); if (dlg) { await dlg.click(); await page.waitForTimeout(400); }
  await page.screenshot({ path: out + '/f10-after-siege.png' });
  const st = await page.evaluate(() => { const g = MK.game; return { towns: g.world.players[0].towns.length, alive: g.world.players.map((p) => p.alive), screens: document.querySelectorAll('.screen').length, events: g.world.events.length }; });
  console.log('after siege', JSON.stringify(st));
  // Сейв/лоуд
  await page.evaluate(() => MK.UI.closeScreens());
  await page.evaluate(() => { MK.game.save(); MK.game.load(); });
  await page.waitForTimeout(300);
  const st2 = await page.evaluate(() => ({ day: MK.game.world.day, heroes: Object.keys(MK.game.world.heroes).length }));
  console.log('loaded', JSON.stringify(st2));
  // Няколко хода с ИИ
  for (let i = 0; i < 3; i++) { await page.evaluate(() => MK.game.endTurn()); await page.waitForTimeout(1500); let d = await page.$('.modal button'); while (d) { await d.click(); await page.waitForTimeout(200); d = await page.$('.modal button'); } }
  const st3 = await page.evaluate(() => ({ day: MK.game.world.day, cur: MK.game.world.curPlayer }));
  console.log('turns', JSON.stringify(st3));
  await page.screenshot({ path: out + '/f11-day4.png' });
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors');
  await browser.close(); server.close();
})().catch((e) => { console.error(e.message); console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors'); process.exit(1); });
