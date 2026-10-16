# Промо видео (TikTok, 1080×1920)
1. `cd web && python3 -m http.server 8765` и `Xvfb :99 -screen 0 1080x1920x24 &`
2. `python3 capture.py en cap_en` — записва истински геймплей (меню, карта + награда, град, битка с магия, победа) с маркери `marks.json`
3. `python3 build.py en` — монтаж: арт кадри (Ken Burns), геймплей, надписи, музика и войсоувър (EN: piper `en-us-ryan-high`; BG: sherpa-onnx `vits-coqui-bg-cv`)
Пътищата са през `$PROMO_DIR` (папка с `stills/`, `en/`, `bg/`) — смени ги за своята машина.
