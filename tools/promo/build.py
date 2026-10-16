# -*- coding: utf-8 -*-
"""Монтаж: python3 build.py <lang>  → MagicKnights_promo_<lang>.mp4 (1080x1920, 30 fps, ~28 s)"""
import sys, os, json, subprocess, wave
L = sys.argv[1]
V = '$PROMO_DIR'
CAP = os.path.join(V, 'cap_' + L); M = json.load(open(os.path.join(CAP, 'marks.json')))
AUDIO = '/home/claude/MagicKnights/web/audio'
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
OUT = os.path.join(V, 'MagicKnights_promo_%s.mp4' % L)
W, H, FPS = 1080, 1920, 30

# ---- сценарий: (начало, дължина, източник, текст на войсоувъра, надпис)
VO = {
 'en': ["Remember when every turn was an adventure?",
        "MagicKnights brings it back. Explore a hand-painted world,",
        "gather treasure,",
        "build your castle,",
        "raise an army,",
        "and in battle, every hex, every spell, every charge is yours to command.",
        "Eleven factions. Seven campaigns. Hundreds of creatures.",
        "Free, in your browser or on Android. Your legend starts now."],
 'bg': ["Помниш ли, когато всеки ход беше приключение?",
        "Маджик Найтс го връща. Изследвай рисуван свят,",
        "събирай съкровища,",
        "изгради своя замък,",
        "събери армия,",
        "а в битка всеки хекс, всяка магия и всяка атака са в твоите ръце.",
        "Единайсет фракции. Седем кампании. Стотици създания.",
        "Безплатно, в браузъра или на Андроид. Твоята легенда започва сега."],
}[L]
CAP_TXT = {
 'en': ["", "EXPLORE", "GATHER TREASURE", "BUILD YOUR CASTLE", "RAISE AN ARMY", "COMMAND THE BATTLE", "11 FACTIONS · 7 CAMPAIGNS", "PLAY FREE"],
 'bg': ["", "ИЗСЛЕДВАЙ", "СЪБИРАЙ СЪКРОВИЩА", "ИЗГРАДИ ЗАМЪК", "СЪБЕРИ АРМИЯ", "КОМАНДВАЙ БИТКАТА", "11 ФРАКЦИИ · 7 КАМПАНИИ", "ИГРАЙ БЕЗПЛАТНО"],
}[L]
SUB = {'en': 'alexanderslavchev.github.io/MagicKnights', 'bg': 'alexanderslavchev.github.io/MagicKnights'}[L]

SEG = [  # (dur, kind, src, offset)
 (3.0, 'still', os.path.join(V, 'stills/01_hero_over_valley.jpg'), 0),
 (4.0, 'clip', os.path.join(CAP, 'map.mp4'), M['map_start'] + 0.9),
 (2.5, 'clip', os.path.join(CAP, 'map.mp4'), M['gold_reward'] + 0.15),
 (3.0, 'clip', os.path.join(CAP, 'map.mp4'), M['town'] + 0.7),
 (2.0, 'clip', os.path.join(CAP, 'battle.mp4'), M['prebattle'] + 0.3),
 (7.0, 'clip', os.path.join(CAP, 'battle.mp4'), M['cast'] + 0.35),
 (4.2, 'clip', os.path.join(CAP, 'victory.mp4'), M['victory'] + 2.4),
 (4.6, 'still', os.path.join(V, 'stills/07_logo_end_card.jpg'), 0),
]
starts = []; t = 0
for d, *_ in SEG: starts.append(t); t += d
TOTAL = t

# ---- войсоувър: по едно изречение за сегмент, поставено на старта му
tts = os.path.join(V, 'tts_' + L); os.makedirs(tts, exist_ok=True)
def wav_len(p):
    with wave.open(p) as w: return w.getnframes() / w.getframerate()
vo_files = []
for i, line in enumerate(VO):
    p = os.path.join(tts, '%d.wav' % i)
    if not os.path.exists(p):
        if L == 'en':
            subprocess.run(['python3', '-m', 'piper', '-m', os.path.join(V, 'en/en-us-ryan-high.onnx'), '-f', p, '--length-scale', '0.95', '--sentence-silence', '0.15'], input=line.encode(), check=True)
        else:
            subprocess.run(['python3', os.path.join(V, 'tts_bg.py'), line, p, '1.05'], check=True)
    vo_files.append(p); print(' vo', i, round(wav_len(p), 2), 's / slot', SEG[i][0])

# ---- видео: всеки сегмент → 1080x1920 30fps; стиловете: Ken Burns за кадрите
parts = []
for i, (d, kind, src, off) in enumerate(SEG):
    out = os.path.join(tts, 'seg%d.mp4' % i); parts.append(out)
    if kind == 'still':
        n = int(d * FPS)
        z = "zoompan=z='1+0.12*on/%d':x='iw/2-(iw/zoom/2)':y='ih*0.35-(ih/zoom*0.35)':d=%d:s=%dx%d:fps=%d" % (n, n, W, H, FPS)
        vf = z
        cmd = ['ffmpeg', '-v', 'error', '-y', '-loop', '1', '-framerate', str(FPS), '-i', src, '-t', str(d), '-vf', vf, '-r', str(FPS), '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-an', out]
    else:
        cmd = ['ffmpeg', '-v', 'error', '-y', '-ss', str(off), '-i', src, '-t', str(d), '-vf', 'scale=%d:%d,fps=%d' % (W, H, FPS), '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-an', out]
    subprocess.run(cmd, check=True)

# ---- слепване с кратки преходи и надписи
inputs = []; filt = []; prev = None
for i, p in enumerate(parts): inputs += ['-i', p]
# concat with xfade (0.3 s), compensating durations
offs = 0; cur = '[0:v]'; acc = 0
xf = 0.3
for i in range(1, len(parts)):
    acc = sum(SEG[k][0] for k in range(i)) - i * xf
    o = '[v%d]' % i
    filt.append('%s[%d:v]xfade=transition=fade:duration=%g:offset=%g%s' % (cur, i, xf, acc, o))
    cur = o
# надписи
def esc(s): return s.replace(':', r'\:').replace("'", r"\'")
draw = []
tt = 0
seg_starts = []
for i, s in enumerate(SEG):
    seg_starts.append(tt); tt += s[0] - (xf if i < len(SEG) - 1 else 0)
for i, txt in enumerate(CAP_TXT):
    if not txt: continue
    a = seg_starts[i] + 0.15; b = seg_starts[i] + SEG[i][0] - 0.2
    big = i == len(CAP_TXT) - 1
    y = 'h*0.16' if not big else 'h*0.66'
    size = (72 if len(txt) <= 18 else 54) if not big else 84
    draw.append("drawtext=fontfile=%s:text='%s':fontsize=%d:fontcolor=0xF6D77A:borderw=5:bordercolor=0x2A1A05:shadowx=0:shadowy=6:shadowcolor=0x00000099:x=(w-text_w)/2:y=%s:enable='between(t,%g,%g)':alpha='if(lt(t,%g),(t-%g)/0.25,if(gt(t,%g),(%g-t)/0.25,1))'" % (FONT, esc(txt), size, y, a, b, a + 0.25, a, b - 0.25, b))
    if big:
        draw.append("drawtext=fontfile=%s:text='%s':fontsize=40:fontcolor=white:borderw=3:bordercolor=0x2A1A05:x=(w-text_w)/2:y=h*0.66+110:enable='between(t,%g,%g)'" % (FONT, esc(SUB), a + 0.3, b))
        draw.append("drawtext=fontfile=%s:text='%s':fontsize=40:fontcolor=white:borderw=3:bordercolor=0x2A1A05:x=(w-text_w)/2:y=h*0.66+170:enable='between(t,%g,%g)'" % (FONT, esc('Android · Browser' if L == 'en' else 'Android · Браузър'), a + 0.3, b))
# заглавие на първия кадър
draw.append("drawtext=fontfile=%s:text='MagicKnights':fontsize=110:fontcolor=0xF6D77A:borderw=6:bordercolor=0x2A1A05:shadowx=0:shadowy=8:shadowcolor=0x00000099:x=(w-text_w)/2:y=h*0.13:enable='between(t,0.3,2.9)':alpha='if(lt(t,0.8),(t-0.3)/0.5,if(gt(t,2.5),(2.9-t)/0.4,1))'" % FONT)
filt.append(cur + ','.join(draw) + ',fade=t=out:st=%g:d=0.6[vout]' % (tt - 0.6))

# ---- аудио: войсоувър по сегменти + музика (приглушена, затихваща)
n = len(parts)
inputs += ['-i', os.path.join(AUDIO, 'main_theme.mp3')]
for i, p in enumerate(vo_files): inputs += ['-i', p]
af = ['[%d:a]volume=0.26,afade=t=in:st=0:d=1,afade=t=out:st=%g:d=2.5,atrim=0:%g[music]' % (n, tt - 2.5, tt)]
mix = '[music]'
for i, p in enumerate(vo_files):
    delay = int((seg_starts[i] + 0.25) * 1000)
    af.append('[%d:a]aformat=sample_rates=48000:channel_layouts=mono,loudnorm=I=-15:TP=-1.5:LRA=9,adelay=%d|%d[vo%d]' % (n + 1 + i, delay, delay, i))
    mix += '[vo%d]' % i
af.append(mix + 'amix=inputs=%d:duration=first:normalize=0,alimiter=limit=0.95[aout]' % (len(vo_files) + 1))
cmd = ['ffmpeg', '-v', 'error', '-y'] + inputs + ['-filter_complex', ';'.join(filt + af), '-map', '[vout]', '-map', '[aout]', '-r', str(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', str(tt), OUT]
subprocess.run(cmd, check=True)
print('OK', OUT, 'duration', round(tt, 2))
