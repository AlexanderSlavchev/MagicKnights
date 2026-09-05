/* Снимки на новата графика */
const { chromium } = require('playwright');
const path = require('path'); const http = require('http'); const fs = require('fs');
const root = path.join(__dirname, '..', 'web');
const out = process.argv[2] || '/tmp/shots'; fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(root, p); if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); });
let errors = [];
(async () => {
  await new Promise((r) => server.listen(8768, r));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 560 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('http://localhost:8768/'); await page.waitForTimeout(400);
  await page.screenshot({ path: out + '/n01-menu.png' });
  await page.evaluate(() => { MK.game.newGame({ size: 54, difficulty: 1, players: [{ faction: 'kingdom', human: true }, { faction: 'necropolis' }, { faction: 'harbor' }], template: MK.data.TEMPLATE('balanced'), seed: 4321 }); });
  await page.waitForTimeout(900);
  await page.evaluate(() => { const g = MK.game; const p = g.world.players[0]; g.world.map.levels.forEach((L, z) => p.fog[z].fill(1)); g.renderer.cam.zoom = 64; g.renderer.clamp(); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: out + '/n02-map.png' });
  await page.evaluate(() => { const g = MK.game; const w = g.world; const water = []; for (let y = 0; y < w.map.h; y++) for (let x = 0; x < w.map.w; x++) if (w.isWater(x, y, 0)) water.push([x, y]); if (water.length) { const [x, y] = water[Math.floor(water.length / 2)]; g.renderer.center(x, y); } });
  await page.waitForTimeout(300);
  await page.screenshot({ path: out + '/n03-water.png' });
  await page.evaluate(() => { const g = MK.game; g.renderer.cam.zoom = 40; g.renderer.clamp(); const t = Object.values(g.world.towns).find((t) => t.faction === 'necropolis'); g.renderer.center(t.x, t.y); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: out + '/n04-necro.png' });
  // град и герой
  await page.evaluate(() => { const g = MK.game; MK.UI.showTown(g, g.world.towns[g.world.players[0].towns[0]]); });
  await page.waitForTimeout(300); await page.screenshot({ path: out + '/n05-town.png' });
  await page.evaluate(() => { document.querySelector('.tabs button:nth-child(2)').click(); }); await page.waitForTimeout(200); await page.screenshot({ path: out + '/n06-recruit.png' });
  await page.evaluate(() => { const g = MK.game; MK.UI.closeScreens(); MK.UI.showHero(g, g.selected); }); await page.waitForTimeout(300); await page.screenshot({ path: out + '/n07-hero.png' });
  await page.evaluate(() => MK.UI.closeScreens());
  // битка
  await page.evaluate(() => {
    const g = MK.game, w = g.world, h = g.selected;
    MK.Army.add(h.army, 'kingdom7u', 3); MK.Army.add(h.army, 'kingdom6u', 6); MK.Army.add(h.army, 'kingdom2u', 20); h.spells = ['fireball', 'haste', 'lightning']; h.mana = 60; h.pow = 4;
    const mon = w.map.objects.filter((o) => o.type === 'monster' && o.z === 0).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
    mon.creature = 'inferno7'; mon.count = 4;
    const ctx = w.startBattle(h, { type: 'monster', obj: mon }); g._bp = g.fight(ctx);
  });
  await page.waitForTimeout(400); await page.click('text=В бой!'); await page.waitForTimeout(2500);
  await page.screenshot({ path: out + '/n08-battle.png' });
  await page.click('text=Авто'); await page.waitForTimeout(2200);
  await page.screenshot({ path: out + '/n09-battle-action.png' });
  await page.waitForTimeout(8000);
  const dlg = await page.$('.modal button'); if (dlg) await dlg.click();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors');
  await browser.close(); server.close();
})().catch((e) => { console.error(e); console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors'); process.exit(1); });
