import sys, sherpa_onnx, soundfile as sf
d='$PROMO_DIR/bg/vits-coqui-bg-cv/'
cfg = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=d+'model.onnx', tokens=d+'tokens.txt'), num_threads=2))
tts = sherpa_onnx.OfflineTts(cfg)
a = tts.generate(sys.argv[1], sid=0, speed=float(sys.argv[3]) if len(sys.argv)>3 else 1.0)
sf.write(sys.argv[2], a.samples, a.sample_rate)
print(len(a.samples)/a.sample_rate)
