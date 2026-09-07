#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Обработва AI-генерираните оригинали от img/ (PNG, ~1250px) в web/img/ (WebP, малки)
и пише web/img/manifest.json, по който играта знае кои картинки съществуват.

    python3 tools/build-assets.py            # само променените/новите
    python3 tools/build-assets.py --force    # всичко наново
"""
import os, sys, json, hashlib
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, DST = os.path.join(ROOT, 'img'), os.path.join(ROOT, 'web', 'img')
FORCE = '--force' in sys.argv

# папка → (макс. размер по дългата страна, изрязване по алфа, качество)
RULES = {
    'creatures': (448, True, 85), 'heroes': (448, True, 85), 'towns': (640, True, 85), 'buildings': (320, True, 85),
    'objects': (320, True, 85), 'decor': (512, True, 85), 'terrain': (512, False, 88), 'battle': (768, True, 85),
    'artifacts': (128, True, 85), 'spells': (128, False, 85), 'ui': (128, True, 90),
}
SPECIAL = {  # конкретни файлове с друг размер (w, h) или само дълга страна
    'heroes/*_portrait': (256, False, 85), 'towns/*_screen': (1600, False, 80), 'battle/bg_*': (1600, False, 80),
    'battle/obstacles': (1024, True, 85), 'terrain/water_frames': (1024, False, 88), 'terrain/road': (512, False, 88),
    'decor/mountain_*': (768, True, 85), 'objects/mine_*': (384, True, 85), 'ui/frame_wood': (512, True, 90),
    'ui/panel_dark': (512, False, 85), 'ui/logo': (768, True, 90), 'ui/button': (384, True, 90),
}

def rule(rel):
    import fnmatch
    for pat, r in SPECIAL.items():
        if fnmatch.fnmatch(rel, pat): return r
    return RULES[rel.split('/')[0]]

def unkey_magenta(im):
    """Ако фонът е запечен като плътно магента (#FF00FF), го превръща в прозрачност."""
    rgb = im.convert('RGB')
    corners = [rgb.getpixel(p) for p in [(2, 2), (im.width - 3, 2), (2, im.height - 3), (im.width - 3, im.height - 3)]]
    if sum(1 for r, g, b in corners if r > 200 and g < 90 and b > 200) < 3: return im
    import numpy as np
    a = np.asarray(rgb).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # разстояние до чисто магента; близо → прозрачно, с мека граница
    dist = np.sqrt((255 - r) ** 2 + g ** 2 + (255 - b) ** 2)
    alpha = np.clip((dist - 60) / 70.0, 0, 1)
    # премахване на магента ореол по ръбовете: приближаваме червено/синьо към зеленото
    fringe = (alpha < 1) & (alpha > 0)
    r2 = np.where(fringe, np.minimum(r, g + 40), r); b2 = np.where(fringe, np.minimum(b, g + 40), b)
    out = np.dstack([r2, g, b2, (alpha * 255)]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')

def process(rel):
    src = os.path.join(SRC, rel + '.png'); dst = os.path.join(DST, rel + '.webp')
    maxs, trim, q = rule(rel)
    im = Image.open(src)
    im = im.convert('RGBA') if im.mode != 'RGB' else im
    im = unkey_magenta(im)
    if trim and im.mode == 'RGBA':
        bbox = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
        if bbox:
            m = 2
            im = im.crop((max(0, bbox[0] - m), max(0, bbox[1] - m), min(im.width, bbox[2] + m), min(im.height, bbox[3] + m)))
    s = maxs / max(im.width, im.height)
    if s < 1: im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, 'WEBP', quality=q, method=4)
    return im.width, im.height

def make_seamless(im):
    """Прави текстура безшевна: измества с половин размер (шевовете отиват в средата) и
    налага оригинала с мека маска, която е плътна в центъра и изчезва към ръбовете."""
    import numpy as np
    w, h = im.size
    im = im.convert('RGB')
    shifted = Image.new('RGB', (w, h))
    shifted.paste(im.crop((w // 2, 0, w, h)), (0, 0)); shifted.paste(im.crop((0, 0, w // 2, h)), (w // 2, 0))
    tmp = shifted.copy(); shifted.paste(tmp.crop((0, h // 2, w, h)), (0, 0)); shifted.paste(tmp.crop((0, 0, w, h // 2)), (0, h // 2))
    yy, xx = np.mgrid[0:h, 0:w]
    fx = np.minimum(xx, w - 1 - xx) / (w * 0.5); fy = np.minimum(yy, h - 1 - yy) / (h * 0.5)
    m = np.clip(np.minimum(fx, fy) * 2.2, 0, 1); m = m * m * (3 - 2 * m)
    a = np.asarray(im).astype(np.float32); b = np.asarray(shifted).astype(np.float32)
    out = b * (1 - m[..., None]) + a * m[..., None]
    return Image.fromarray(out.astype(np.uint8), 'RGB')

def build_water():
    """terrain/water.webp — безшевна водна плочка от първия кадър на water_frames."""
    src = os.path.join(SRC, 'terrain', 'water_frames.png'); dst = os.path.join(DST, 'terrain', 'water.webp')
    if not os.path.exists(src): return None
    im = Image.open(src).convert('RGB'); fw = im.width // 4
    frame = im.crop((0, 0, fw, im.height)).resize((512, 512), Image.LANCZOS)
    tile = make_seamless(frame)
    os.makedirs(os.path.dirname(dst), exist_ok=True); tile.save(dst, 'WEBP', quality=88, method=4)
    return tile.size

def main():
    manifest = {}
    old = {}
    mpath = os.path.join(DST, 'manifest.json')
    if os.path.exists(mpath) and not FORCE:
        old = json.load(open(mpath, encoding='utf-8')).get('files', {})
    total = 0
    for d, _, files in os.walk(SRC):
        for f in sorted(files):
            if not f.endswith('.png'): continue
            rel = os.path.relpath(os.path.join(d, f), SRC)[:-4].replace(os.sep, '/')
            src = os.path.join(SRC, rel + '.png')
            sig = str(os.path.getsize(src)) + ':' + str(int(os.path.getmtime(src)))
            dst = os.path.join(DST, rel + '.webp')
            if rel in old and old[rel].get('sig') == sig and os.path.exists(dst):
                manifest[rel] = old[rel]
            else:
                w, h = process(rel)
                manifest[rel] = {'w': w, 'h': h, 'sig': sig}
                print('  ', rel, w, h)
            total += os.path.getsize(dst)
    wsz = build_water()
    if wsz: manifest['terrain/water'] = {'w': wsz[0], 'h': wsz[1], 'sig': 'derived'}
    json.dump({'files': manifest}, open(mpath, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('%d файла, %.1f MB' % (len(manifest), total / 1e6))

if __name__ == '__main__':
    main()
