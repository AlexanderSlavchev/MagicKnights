# -*- coding: utf-8 -*-
"""v2 монтаж по актуалните TikTok практики: python3 build2.py <lang> <long|short>
   - кука с движение още на 0-та секунда (без лого/арт интро), бързи срезове 2–3 с
   - субтитри на целия войсоувър + кратък headline; всичко в безопасната зона (горни 15% / долни 30% / десни 12% свободни)
   - 15-секунден вариант за тест срещу 28-секундния"""
import sys, os, json, subprocess, wave, textwrap
from PIL import Image, ImageDraw, ImageFont
L, VAR = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else 'long')
V = '$PROMO_DIR'
CAP = os.path.join(V, 'cap_' + L); M = json.load(open(os.path.join(CAP, 'marks.json')))
AUDIO = '/home/claude/MagicKnights/web/audio'
F_HEAD = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
F_SUB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
OUT = os.path.join(V, 'MagicKnights_promo_%s_%s.mp4' % (L, VAR))
W, H, FPS = 1080, 1920, 30
STILL = lambda n: os.path.join(V, 'stills', n)
clip = lambda f, t: ('clip', os.path.join(CAP, f), t)
still = lambda n: ('still', STILL(n), 0)

# (продължителност, източник, headline, войсоувър)
if VAR == 'long':
    SEG = {
     'en': [
      (2.6, clip('map.mp4', M['gold_reward'] + 0.55), 'TURN-BASED. HAND-PAINTED.', 'Remember when every turn was an adventure?'),
      (3.2, clip('map.mp4', M['map_start'] + 1.2), 'EXPLORE', 'MagicKnights brings it back. Explore a hand-painted world,'),
      (2.6, clip('map.mp4', M['town'] + 0.8), 'BUILD YOUR CASTLE', 'build your castle,'),
      (2.2, clip('battle.mp4', M['prebattle'] - 2.1), 'RAISE AN ARMY', 'raise an army,'),
      (2.4, clip('battle.mp4', M['cast'] + 0.35), 'CAST SPELLS', 'cast spells,'),
      (2.4, clip('battle.mp4', M['cast'] + 2.6), 'COMMAND EVERY HEX', 'and command every hex,'),
      (2.4, clip('battle.mp4', M['cast'] + 5.6), 'EVERY STRIKE, EVERY CHARGE', 'every strike, every charge.'),
      (3.4, clip('victory.mp4', M['victory'] + 2.4), '11 FACTIONS · 7 CAMPAIGNS', 'Eleven factions, seven campaigns, hundreds of creatures.'),
      (2.6, still('01_hero_over_valley.jpg'), 'YOUR LEGEND STARTS NOW', 'Your legend starts now.'),
      (3.8, still('07_logo_end_card.jpg'), 'PLAY FREE', 'Free, in your browser or on Android.'),
     ],
     'bg': [
      (2.6, clip('map.mp4', M['gold_reward'] + 0.55), 'ПОХОДОВА. РИСУВАНА.', 'Помниш ли, когато всеки ход беше приключение?'),
      (3.2, clip('map.mp4', M['map_start'] + 1.2), 'ИЗСЛЕДВАЙ', 'Маджик Найтс го връща. Изследвай рисуван свят,'),
      (2.6, clip('map.mp4', M['town'] + 0.8), 'ИЗГРАДИ ЗАМЪК', 'изгради своя замък,'),
      (2.2, clip('battle.mp4', M['prebattle'] - 2.1), 'СЪБЕРИ АРМИЯ', 'събери армия,'),
      (2.4, clip('battle.mp4', M['cast'] + 0.35), 'ХВЪРЛЯЙ МАГИИ', 'хвърляй магии,'),
      (2.4, clip('battle.mp4', M['cast'] + 2.6), 'КОМАНДВАЙ ВСЕКИ ХЕКС', 'и командвай всеки хекс,'),
      (2.4, clip('battle.mp4', M['cast'] + 5.6), 'ВСЕКИ УДАР, ВСЯКА АТАКА', 'всеки удар, всяка атака.'),
      (3.4, clip('victory.mp4', M['victory'] + 2.4), '11 ФРАКЦИИ · 7 КАМПАНИИ', 'Единайсет фракции, седем кампании, стотици създания.'),
      (2.6, still('01_hero_over_valley.jpg'), 'ТВОЯТА ЛЕГЕНДА ЗАПОЧВА', 'Твоята легенда започва сега.'),
      (3.8, still('07_logo_end_card.jpg'), 'ИГРАЙ БЕЗПЛАТНО', 'Безплатно, в браузъра или на Андроид.'),
     ]}[L]
else:
    SEG = {
     'en': [
      (2.4, clip('map.mp4', M['gold_reward'] + 0.55), 'TURN-BASED. HAND-PAINTED.', 'Remember when every turn was an adventure?'),
      (2.4, clip('battle.mp4', M['cast'] + 0.35), 'CAST SPELLS', 'MagicKnights brings it back:'),
      (2.2, clip('map.mp4', M['town'] + 0.8), 'BUILD YOUR CASTLE', 'castles, armies,'),
      (2.6, clip('battle.mp4', M['cast'] + 2.6), 'COMMAND EVERY HEX', 'and battles you command hex by hex.'),
      (2.2, clip('victory.mp4', M['victory'] + 2.4), '11 FACTIONS · 7 CAMPAIGNS', 'Eleven factions, seven campaigns.'),
      (3.4, still('07_logo_end_card.jpg'), 'PLAY FREE', 'Free on Android and in your browser.'),
     ],
     'bg': [
      (2.4, clip('map.mp4', M['gold_reward'] + 0.55), 'ПОХОДОВА. РИСУВАНА.', 'Помниш ли, когато всеки ход беше приключение?'),
      (2.4, clip('battle.mp4', M['cast'] + 0.35), 'ХВЪРЛЯЙ МАГИИ', 'Маджик Найтс го връща:'),
      (2.2, clip('map.mp4', M['town'] + 0.8), 'ИЗГРАДИ ЗАМЪК', 'замъци, армии'),
      (2.6, clip('battle.mp4', M['cast'] + 2.6), 'КОМАНДВАЙ ВСЕКИ ХЕКС', 'и битки, които командваш хекс по хекс.'),
      (2.2, clip('victory.mp4', M['victory'] + 2.4), '11 ФРАКЦИИ · 7 КАМПАНИИ', 'Единайсет фракции, седем кампании.'),
      (3.4, still('07_logo_end_card.jpg'), 'ИГРАЙ БЕЗПЛАТНО', 'Безплатно на Андроид и в браузъра.'),
     ]}[L]
LINK = 'alexanderslavchev.github.io/MagicKnights'
PLAT = 'Android · Browser' if L == 'en' else 'Android · Браузър'

work = os.path.join(V, 'w2_%s_%s' % (L, VAR)); os.makedirs(work, exist_ok=True)
tts = os.path.join(V, 'tts2_' + L); os.makedirs(tts, exist_ok=True)
def wav_len(p):
    with wave.open(p) as w: return w.getnframes() / w.getframerate()

# ---- войсоувър (кеш по текст)
import hashlib
vo_files = []
for i, (d, src, head, line) in enumerate(SEG):
    p = os.path.join(tts, hashlib.md5(line.encode()).hexdigest()[:10] + '.wav')
    if not os.path.exists(p):
        if L == 'en':
            subprocess.run(['python3', '-m', 'piper', '-m', os.path.join(V, 'en/en-us-ryan-high.onnx'), '-f', p, '--length-scale', '0.92', '--sentence-silence', '0.1'], input=line.encode(), check=True)
        else:
            subprocess.run(['python3', os.path.join(V, 'tts_bg.py'), line, p, '1.08'], check=True)
    vo_files.append(p); print(' vo %d %.2fs / slot %.1f  %s' % (i, wav_len(p), d, line[:40]))

# ---- надписи: PIL → PNG с прозрачност (headline горе на 20 %, субтитри на ~60 %)
def text_png(path, head, sub, cta=False):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); dr = ImageDraw.Draw(im)
    def outlined(xy, t, font, fill, ow):
        x, y = xy
        for dx in range(-ow, ow + 1):
            for dy in range(-ow, ow + 1):
                if dx * dx + dy * dy <= ow * ow: dr.text((x + dx, y + dy), t, font=font, fill=(42, 26, 5, 255))
        dr.text((x, y), t, font=font, fill=fill)
    if head:
        size = 74 if len(head) <= 18 else 56
        fh = ImageFont.truetype(F_HEAD, size)
        tw = dr.textlength(head, font=fh)
        y = int(H * 0.20)
        outlined(((W - tw) / 2, y), head, fh, (246, 215, 122, 255), 6)
    if sub:
        fs = ImageFont.truetype(F_SUB, 46)
        lines = textwrap.wrap(sub, width=30)
        lh = 62; bw = max(dr.textlength(l, font=fs) for l in lines) + 60; bh = lh * len(lines) + 30
        y0 = int(H * 0.60) if not cta else int(H * 0.285)
        x0 = (W - bw) / 2
        box = Image.new('RGBA', (int(bw), int(bh)), (10, 8, 6, 150)); im.alpha_composite(box, (int(x0), y0))
        dr = ImageDraw.Draw(im)
        for k, l in enumerate(lines):
            tw = dr.textlength(l, font=fs)
            dr.text(((W - tw) / 2, y0 + 15 + k * lh), l, font=fs, fill=(255, 255, 255, 255))
    if cta:
        fl = ImageFont.truetype(F_SUB, 38)
        for k, t in enumerate([LINK, PLAT]):
            tw = dr.textlength(t, font=fl)
            outlined(((W - tw) / 2, int(H * 0.285) + (len(textwrap.wrap(sub, 30)) * 62 + 50) + k * 56), t, fl, (255, 255, 255, 255), 3)
    im.save(path)

parts = []
for i, (d, (kind, src, off), head, line) in enumerate(SEG):
    out = os.path.join(work, 'seg%d.mp4' % i); parts.append(out)
    png = os.path.join(work, 'cap%d.png' % i); text_png(png, head, line, cta=(i == len(SEG) - 1))
    # слаб скок при всеки срез (zoom 1.0→1.04) — усещане за ритъм без „fancy“ преходи
    n = int(d * FPS)
    if kind == 'still':
        vf = "zoompan=z='1+0.10*on/%d':x='iw/2-(iw/zoom/2)':y='ih*0.35-(ih/zoom*0.35)':d=%d:s=%dx%d:fps=%d" % (n, n, W, H, FPS)
        base = ['ffmpeg', '-v', 'error', '-y', '-loop', '1', '-framerate', str(FPS), '-i', src, '-i', png, '-t', str(d), '-filter_complex', vf + '[b];[b][1:v]overlay=0:0:format=auto,fade=t=in:st=0:d=0.12[v]', '-map', '[v]']
    else:
        base = ['ffmpeg', '-v', 'error', '-y', '-ss', str(off), '-i', src, '-i', png, '-t', str(d), '-filter_complex', "[0:v]scale=%d:%d,fps=%d,scale=w=iw*1.04:h=ih*1.04:eval=frame,crop=%d:%d:(iw-%d)/2:(ih-%d)/2[b];[b][1:v]overlay=0:0:format=auto[v]" % (W, H, FPS, W, H, W, H), '-map', '[v]']
    subprocess.run(base + ['-r', str(FPS), '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-an', out], check=True)

# ---- слепване: твърди срезове (concat), последният кадър с fade out
lst = os.path.join(work, 'list.txt'); open(lst, 'w').write(''.join("file '%s'\n" % p for p in parts))
total = sum(s[0] for s in SEG)
starts = [sum(s[0] for s in SEG[:i]) for i in range(len(SEG))]
n = len(parts)
inputs = ['-f', 'concat', '-safe', '0', '-i', lst, '-i', os.path.join(AUDIO, 'main_theme.mp3')]
for p in vo_files: inputs += ['-i', p]
af = ['[1:a]volume=0.26,afade=t=in:st=0:d=0.8,afade=t=out:st=%g:d=2.2,atrim=0:%g[music]' % (total - 2.2, total)]
mix = '[music]'
for i, p in enumerate(vo_files):
    delay = int((starts[i] + 0.2) * 1000)
    af.append('[%d:a]aformat=sample_rates=48000:channel_layouts=mono,loudnorm=I=-15:TP=-1.5:LRA=9,adelay=%d|%d[vo%d]' % (2 + i, delay, delay, i))
    mix += '[vo%d]' % i
af.append(mix + 'amix=inputs=%d:duration=first:normalize=0,alimiter=limit=0.95[aout]' % (len(vo_files) + 1))
vf = '[0:v]fade=t=out:st=%g:d=0.5[vout]' % (total - 0.5)
cmd = ['ffmpeg', '-v', 'error', '-y'] + inputs + ['-filter_complex', ';'.join([vf] + af), '-map', '[vout]', '-map', '[aout]', '-r', str(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', str(total), OUT]
subprocess.run(cmd, check=True)
print('OK', OUT, 'duration', round(total, 2))
