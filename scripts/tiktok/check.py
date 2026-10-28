import subprocess, sys
import numpy as np
from faster_whisper import WhisperModel
m = WhisperModel("small", device="cpu", compute_type="int8")
for f in sys.argv[1:]:
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", f, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
    segs, _ = m.transcribe(np.frombuffer(raw, dtype=np.float32), language="tr", beam_size=5)
    print(f.split("/")[-1], "→", " ".join(s.text.strip() for s in segs), flush=True)
