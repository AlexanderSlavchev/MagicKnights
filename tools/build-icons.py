#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Прави всички икони от img/ui/app_icon.png: Android mipmap (legacy + adaptive foreground),
уеб icon-512 / favicon / apple-touch-icon."""
import os
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = Image.open(os.path.join(ROOT, 'img', 'ui', 'app_icon.png')).convert('RGBA')
res = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
# legacy квадратни икони
for d, px in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
    src.resize((px, px), Image.LANCZOS).save(os.path.join(res, 'mipmap-' + d, 'ic_launcher.png'))
# adaptive foreground: 108dp платно, съдържанието в централните 72dp (66%) — иконата се смалява, фонът е цветът на ръба
bg = src.getpixel((4, 4))
for d, px in [('mdpi', 108), ('hdpi', 162), ('xhdpi', 216), ('xxhdpi', 324), ('xxxhdpi', 432)]:
    canvas = Image.new('RGBA', (px, px), bg)
    inner = round(px * 0.72)
    canvas.alpha_composite(src.resize((inner, inner), Image.LANCZOS), ((px - inner) // 2, (px - inner) // 2))
    canvas.save(os.path.join(res, 'mipmap-' + d, 'ic_launcher_fg.png'))
with open(os.path.join(res, 'drawable', 'ic_launcher_bg.xml'), 'w', encoding='utf-8') as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">\n    <solid android:color="#%02x%02x%02x" />\n</shape>\n' % bg[:3])
# уеб
web = os.path.join(ROOT, 'web')
src.resize((512, 512), Image.LANCZOS).save(os.path.join(web, 'icon-512.png'))
src.resize((180, 180), Image.LANCZOS).save(os.path.join(web, 'apple-touch-icon.png'))
src.resize((64, 64), Image.LANCZOS).save(os.path.join(web, 'favicon.png'))
print('икони: готово, фон', bg[:3])
