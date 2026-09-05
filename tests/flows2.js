/* Playwright: фаза 2/3 — настройка с шаблон и няколко играча, подземие, кораби, двухексова битка с тактика, кампания, hot-seat */
const { chromium } = require('playwright');
const path = require('path'); const http = require('http'); const fs = require('fs');
const root = path.join(__dirname, '..', 'web');
const out = process.argv[2] || '/tmp/shots'; fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(root, p); if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); });
let errors = [];
(async () => {
  await new Promise((r) => server.listen(8766, r));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 480 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('http://localhost:8766/');
  await page.waitForTimeout(400);
  await page.click('text=Нова игра'); await page.waitForTimeout(300);
  await page.screenshot({ path: out + '/g01-setup.png' });
  // подземен шаблон, средна карта, 2 противника, второ човешко място
  await page.click('text=Подземен свят'); await page.click('text=Средна (54)');
  await page.evaluate(() => { const panels = document.querySelectorAll('.panel'); panels[2].querySelector('button').click(); }); // трети играч → Компютър? първият бутон е 'Човек' — hot-seat
  await page.waitForTimeout(200);
  await page.screenshot({ path: out + '/g02-setup-players.png' });
  await page.click('text=Започни'); await page.waitForTimeout(1200);
  await page.screenshot({ path: out + '/g03-map.png' });
  let info = await page.evaluate(() => { const g = MK.game; return { players: g.world.players.map((p) => (p.human ? 'H' : 'A') + ':' + p.faction), levels: g.world.map.levels.length, human: g.human }; });
  console.log('game', JSON.stringify(info));
  // превключване на ниво
  await page.click('#btn-level'); await page.waitForTimeout(300);
  await page.evaluate(() => { const g = MK.game; const gate = g.world.map.objects.find((o) => o.type === 'gate' && o.z === 1); g.world.revealAround(g.human, gate.x, gate.y, 1, 10); g.renderer.center(gate.x, gate.y); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: out + '/g04-underground.png' });
  await page.click('#btn-level'); await page.waitForTimeout(200);
  // двухексова битка с тактика: даваме тактика и дракони
  await page.evaluate(() => {
    const g = MK.game, w = g.world, h = g.selected;
    h.skills.tactics = 2; MK.Army.add(h.army, 'dungeon7u', 4); MK.Army.add(h.army, 'horde7', 3); h.spells = ['fireball', 'haste']; h.mana = 40;
    const mon = w.map.objects.filter((o) => o.type === 'monster' && o.z === 0).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
    mon.creature = 'marsh7u'; mon.count = 3;
    const ctx = w.startBattle(h, { type: 'monster', obj: mon });
    g._bp = g.fight(ctx);
  });
  await page.waitForTimeout(400);
  await page.click('text=В бой!'); await page.waitForTimeout(700);
  await page.screenshot({ path: out + '/g05-tactics.png' });
  // местим стек по тактика: тап на стек, тап на хекс
  const canvasBox = await page.$eval('#battle', (c) => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.click('text=Готово'); await page.waitForTimeout(1500);
  await page.screenshot({ path: out + '/g06-battle-wide.png' });
  await page.click('text=Авто'); await page.waitForTimeout(9000);
  await page.screenshot({ path: out + '/g07-battle-end.png' });
  const dlg = await page.$('.modal button'); if (dlg) await dlg.click(); await page.waitForTimeout(400);
  // hot-seat: край на хода → подаване на устройството на втория човек
  await page.click('#btn-end'); await page.waitForTimeout(4000);
  await page.screenshot({ path: out + '/g08-hotseat.png' });
  const pass = await page.$('text=Готов съм'); console.log('hot-seat dialog:', !!pass);
  if (pass) { await pass.click(); await page.waitForTimeout(500); }
  info = await page.evaluate(() => { const g = MK.game; return { human: g.human, cur: g.world.curPlayer, day: g.world.day }; });
  console.log('after pass', JSON.stringify(info));
  // затваряме останали диалози
  for (let k = 0; k < 4; k++) { const m = await page.$('.modal-wrap button'); if (!m) break; await m.click(); await page.waitForTimeout(200); }
  // кампания
  await page.evaluate(() => { MK.UI.showCampaign(MK.game); }); await page.waitForTimeout(300);
  await page.screenshot({ path: out + '/g09-campaign.png' });
  await page.click('text=Играй'); await page.waitForTimeout(1500);
  await page.screenshot({ path: out + '/g10-campaign-start.png' });
  const dlg2 = await page.$('.modal button'); if (dlg2) await dlg2.click();
  info = await page.evaluate(() => { const g = MK.game; return { campaign: g.campaign && g.campaign.index, players: g.world.players.length, template: g.world.template }; });
  console.log('campaign', JSON.stringify(info));
  // острови: кораб до града
  await page.evaluate(() => { MK.game.newGame({ size: 54, difficulty: 1, players: [{ faction: 'harbor', human: true }, { faction: 'kingdom' }], template: MK.data.TEMPLATE('islands'), seed: 77 }); });
  await page.waitForTimeout(800);
  await page.evaluate(() => { const g = MK.game; g.renderer.cam.zoom = 36; const b = g.world.map.objects.find((o) => o.type === 'boat' && o.owner === 0); g.renderer.center(b.x - 3, b.y); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: out + '/g11-islands.png' });
  // качване на кораб през UI: намираме кораба и правим два тапа
  const boat = await page.evaluate(() => { const g = MK.game; const b = g.world.map.objects.find((o) => o.type === 'boat' && o.owner === 0); const [sx, sy] = g.renderer.toScreen(b.x, b.y); const S = g.renderer.tileSize(); return { x: (sx + S / 2) / g.renderer.dpr, y: (sy + S / 2) / g.renderer.dpr }; });
  await page.mouse.click(boat.x, boat.y); await page.waitForTimeout(200); await page.mouse.click(boat.x, boat.y); await page.waitForTimeout(2500);
  info = await page.evaluate(() => { const g = MK.game; const h = g.world.heroes[g.world.players[0].heroes[0]]; return { boat: h.boat, mv: h.movement }; });
  console.log('boat', JSON.stringify(info));
  await page.screenshot({ path: out + '/g12-onboat.png' });
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors');
  await browser.close(); server.close();
})().catch((e) => { console.error(e); console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors'); process.exit(1); });
