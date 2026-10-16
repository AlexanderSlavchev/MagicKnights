# -*- coding: utf-8 -*-
"""Записва портретни клипове от истинския геймплей на MagicKnights (headless Chromium, 1080x1920).
   python3 capture.py <lang> <outdir>"""
import sys, os, time, shutil, glob, subprocess
os.environ['DISPLAY'] = ':99'
from playwright.sync_api import sync_playwright
REC = None; T0 = 0; MARKS = {}
def mark(name):
    MARKS[name] = round(time.time() - T0, 2); print('  mark', name, MARKS[name])
def rec_start(path):
    global REC, T0
    T0 = time.time() + 0.35
    REC = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'x11grab', '-draw_mouse', '0', '-video_size', '1080x1920', '-framerate', '30', '-i', ':99.0', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', path], stdin=subprocess.PIPE)
def rec_stop():
    global REC
    if REC: REC.stdin.write(b'q'); REC.stdin.flush(); REC.wait(); REC = None

LANG, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
URL = 'http://127.0.0.1:8765/index.html'
W, H = 540, 960
DSF = 2
SEED = int(sys.argv[3]) if len(sys.argv) > 3 else 20261017

def new_ctx(p, b, name):
    ctx = b.new_context(no_viewport=True, has_touch=True)
    ctx.add_init_script("try{localStorage.setItem('mk_lang','%s');localStorage.setItem('mk_tutorial_done','1');}catch(e){}" % LANG)
    page = ctx.new_page()
    cdp = ctx.new_cdp_session(page)
    wid = cdp.send('Browser.getWindowForTarget')
    cdp.send('Browser.setWindowBounds', {'windowId': wid['windowId'], 'bounds': {'windowState': 'fullscreen'}})
    page.on('console', lambda m: print('  [js]', m.text) if m.type in ('error',) else None)
    page.goto(URL)
    page.wait_for_function("() => window.MK && MK.game && MK.Img && MK.UI")
    page.wait_for_timeout(2500)  # менюто да зареди арта
    rec_start(os.path.join(OUT, name + '.mp4'))
    return ctx, page, None

def finish(ctx, page, d, name):
    rec_stop()
    ctx.close()
    print('saved', name)

NEWGAME = """async (seed) => {
  const D = MK.data;
  await MK.game.newGame({ size: 36, difficulty: 0, players: [{ faction: 'kingdom', human: true }, { faction: 'necropolis' }, { faction: 'inferno' }], template: D.TEMPLATE('rich'), seed });
  const g = MK.game, w = g.world, p = w.players[g.human], h = w.heroes[p.heroes[0]];
  // силна и красива армия за кадрите
  MK.Army.add(h.army, 'kingdom7u', 2); MK.Army.add(h.army, 'kingdom6u', 8); MK.Army.add(h.army, 'kingdom2u', 25); MK.Army.add(h.army, 'kingdom3u', 10); MK.Army.add(h.army, 'kingdom5u', 12);
  ['fireball', 'lightning', 'chain_lightning', 'meteor_shower', 'haste', 'bless'].forEach((s) => { if (!h.spells.includes(s)) h.spells.push(s); });
  h.know = 20; h.pow = 12; h.mana = 200; h.movement = 2400; h.maxMovement = 2400;
  // разкриваме картата около героя за по-жив кадър
  w.revealAround(g.human, h.x, h.y, 0, 14);
  g.selectHero(h, true); g.updateHUD();
  return { x: h.x, y: h.y };
}"""

PICKUP = """() => {
  const g = MK.game, w = g.world, h = g.selected;
  const cands = [];
  for (const o of w.map.objects) {
    if ((o.z || 0) !== 0 || o.guard) continue;
    if (!['chest', 'resource', 'artifact', 'campfire'].includes(o.type)) continue;
    const path = MK.Path.findPath(w, h, o.x, o.y);
    if (!path || path.path.length < 2 || path.path.length > 9) continue;
    cands.push({ o, path, v: (o.type === 'chest' ? 3 : o.type === 'artifact' ? 4 : o.type === 'campfire' ? 2 : 1) * 100 - path.path.length });
  }
  cands.sort((a, b) => b.v - a.v);
  if (!cands.length) return null;
  const c = cands[0];
  g.renderer.pathPreview = c.path; g.updateHUD();
  setTimeout(() => g.moveSelected(c.path), 700);
  return { type: c.o.type, steps: c.path.path.length };
}"""

GOTO_MONSTER = """(want) => {
  const g = MK.game, w = g.world, h = g.selected;
  const cands = [];
  for (const o of w.map.objects) {
    if ((o.z || 0) !== 0) continue;
    const isMon = o.type === 'monster', isGuard = !!o.guard;
    if (!isMon && !isGuard) continue;
    const path = MK.Path.findPath(w, h, o.x, o.y);
    if (!path || path.path.length < 2 || path.path.length > 16) continue;
    const cre = MK.data.creatureOf(isMon ? o.creature : o.guard.creature), n = isMon ? o.count : o.guard.count;
    const v = MK.data.fightValue(cre) * n;
    cands.push({ o, path, v, name: cre.name, n, id: cre.id, pref: want && cre.id === want ? 0 : 1 });
  }
  cands.sort((a, b) => (a.pref - b.pref) || (b.n * b.v - a.n * a.v));
  if (!cands.length) return null;
  const c = cands[0];
  g.renderer.pathPreview = c.path; g.updateHUD();
  setTimeout(() => g.moveSelected(c.path), 600);
  return { name: c.name, n: c.n, steps: c.path.path.length };
}"""

CLICK_FIGHT = """() => {
  const bs = [...document.querySelectorAll('#overlay .modal .buttons button')];
  const b = bs.find((x) => /В бой|battle|Fight|战|戦|लड़/i.test(x.textContent)) || bs.find((x) => x.classList.contains('primary'));
  if (b) { b.click(); return b.textContent; } return null;
}"""

CAST = """(spell) => {
  const ui = MK.BattleUI.current; if (!ui || ui.state !== 'input') return 'not-input';
  const b = ui.b, cur = b.current; if (!cur || cur.side !== 0) return 'not-our-turn';
  const sd = b.sides[0]; if (!sd.spells.includes(spell)) return 'no-spell';
  // най-голямата жива вражеска купчина
  const en = b.stacks.filter((s) => s.alive && s.side === 1).sort((a, c) => c.n * c.maxHp - a.n * a.maxHp)[0];
  if (!en) return 'no-enemy';
  ui.reach = null; ui.attackOpts = []; ui.hoverAttack = null;
  const r = b.doCast(0, spell, en.x, en.y);
  if (!r.ok) return 'fail:' + r.why;
  ui.castSpell = null;
  ui.playEvents().then(() => { if (b.finished) ui.resolveInput({}); else { ui.auto = true; ui.prepareInput(cur); ui.renderBar(); ui.resolveInput({ auto: true }); } });
  return 'ok';
}"""

AUTO = """() => { const ui = MK.BattleUI.current; if (!ui) return false; ui.auto = true; if (ui.state === 'input' && ui.b.current) ui.resolveInput({ auto: true }); ui.renderBar(); return true; }"""

with sync_playwright() as p:
    b = p.chromium.launch(headless=False, args=['--force-device-scale-factor=%d' % DSF, '--window-size=%d,%d' % (W, H), '--window-position=0,0', '--kiosk', '--no-first-run', '--autoplay-policy=no-user-gesture-required', '--disable-gpu', '--hide-scrollbars'])

    # 1) Главно меню
    ctx, page, d = new_ctx(p, b, 'menu')
    page.wait_for_timeout(4000)
    finish(ctx, page, d, 'menu')

    # 2) Карта: движение и награда, после градът
    ctx, page, d = new_ctx(p, b, 'map')
    pos = page.evaluate(NEWGAME, SEED)
    page.wait_for_function("() => !document.querySelector('.loading-art')", timeout=60000)
    page.wait_for_timeout(1500)
    mark('map_start')
    r = page.evaluate(PICKUP); print('pickup', r)
    try:
        page.wait_for_selector('#overlay .modal .buttons button', timeout=20000)
    except Exception as e:
        print('no chest dialog', e)
    page.wait_for_timeout(1300)
    mark('chest_dialog')
    page.evaluate("""() => { const bs=[...document.querySelectorAll('#overlay .modal .buttons button')]; const b=bs.find(x=>/злато|gold|золот|金|गोल्ड|स्वर्ण|सोना/i.test(x.textContent))||bs[0]; if(b) b.click(); }""")
    mark('gold_reward')
    page.wait_for_timeout(3200)
    r = page.evaluate(PICKUP); print('pickup2', r)
    page.wait_for_timeout(4500)
    page.evaluate("""() => { const bs=[...document.querySelectorAll('#overlay .modal .buttons button')]; const b=bs.find(x=>/злато|gold|золот|金|गोल्ड|स्वर्ण|सोना/i.test(x.textContent))||bs[0]; if(b) b.click(); }""")
    page.wait_for_timeout(1500)
    mark('town')
    print('town at', page.evaluate("() => { const g=MK.game, w=g.world, t=w.towns[w.players[g.human].towns[0]]; MK.UI.showTown(g, t); return t.name; }"))
    page.wait_for_timeout(5000)
    finish(ctx, page, d, 'map_town')

    # 3) Битка: магия + авто
    ctx, page, d = new_ctx(p, b, 'battle')
    page.evaluate(NEWGAME, SEED + 21)
    page.wait_for_function("() => !document.querySelector('.loading-art')", timeout=60000)
    page.wait_for_timeout(1200)
    r = page.evaluate(GOTO_MONSTER, 'horde1'); print('monster', r)
    try:
        page.wait_for_selector('#overlay .modal .buttons button', timeout=40000)
    except Exception as e:
        print('no prebattle dialog', e)
    page.wait_for_timeout(2300)
    mark('prebattle')
    print('fight btn', page.evaluate(CLICK_FIGHT))
    mark('battle_start')
    # изчакваме нашия вход
    try:
        page.wait_for_function("() => MK.BattleUI.current && MK.BattleUI.current.state === 'input' && MK.BattleUI.current.b.current && MK.BattleUI.current.b.current.side === 0", timeout=20000)
    except Exception as e:
        print('no input state', e)
    print('zoom', page.evaluate("() => { const ui = MK.BattleUI.current; if (!ui) return false; const W = ui.fieldW || ui.canvas.width; ui.view = { s: 1, x: 0, y: 0 }; ui.clampView(); return [W, ui.canvas.height, ui.barH]; }"))
    page.wait_for_timeout(1500)
    mark('cast')
    print('cast', page.evaluate(CAST, 'fireball'))
    page.wait_for_timeout(1700)
    try:
        page.wait_for_function("() => MK.BattleUI.current && MK.BattleUI.current.state === 'input'", timeout=20000)
    except Exception as e:
        print('no input 2', e)
    mark('auto')
    print('auto', page.evaluate(AUTO))
    page.wait_for_timeout(20000)
    finish(ctx, page, d, 'battle')

    # 4) Победа
    ctx, page, d = new_ctx(p, b, 'victory')
    page.evaluate(NEWGAME, SEED + 3)
    page.wait_for_function("() => !document.querySelector('.loading-art')", timeout=60000)
    page.wait_for_timeout(800)
    mark('victory')
    page.evaluate("() => { MK.game.victory(MK.game.human); }")
    page.wait_for_timeout(5000)
    finish(ctx, page, d, 'victory')
    b.close()
import json; json.dump(MARKS, open(os.path.join(OUT, 'marks.json'), 'w'), indent=1)
print('done')
