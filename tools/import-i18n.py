#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Слива преводи в web/i18n/<език>.json.
   python3 tools/import-i18n.py ru path/to/ru_part1.json [part2.json ...]
Всеки входен файл е JSON обект { "български ключ": "превод" }; ключове, които ги няма в bg.json, се пропускат.
Отчита колко ключа остават непреведени."""
import sys, os, json
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
lang = sys.argv[1]; files = sys.argv[2:]
keys = json.load(open(os.path.join(ROOT, 'web', 'i18n', 'bg.json'), encoding='utf-8'))
dst = os.path.join(ROOT, 'web', 'i18n', lang + '.json')
cur = json.load(open(dst, encoding='utf-8')) if os.path.exists(dst) else {}
added = skipped = 0
for f in files:
    data = json.load(open(f, encoding='utf-8'))
    for k, v in data.items():
        if k in keys and isinstance(v, str) and v.strip(): cur[k] = v; added += 1
        else: skipped += 1
json.dump(cur, open(dst, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
missing = [k for k in keys if k not in cur]
print('%s: добавени %d, пропуснати %d, общо %d/%d, липсват %d' % (lang, added, skipped, len(cur), len(keys), len(missing)))
json.dump(missing, open(os.path.join(ROOT, 'web', 'i18n', lang + '.missing.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
