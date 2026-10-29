"""Kizagan-TTS v1.0 ile dikey videoların seslendirmesi (DOG-162), Apple Silicon (MPS).

Modelin kendi inference.py ayarları: cfg 2.0, 16 adım, seed 42, gürültü giderme
kapalı, her cümle ayrı üretiliyor (uzun metinde sona doğru bozulma var).
Referans: modelin örnek sesi (examples/quickstart.wav).
"""
import json, os, sys, time
from pathlib import Path
import numpy as np
import soundfile as sf
import torch
from huggingface_hub import snapshot_download
from voxcpm import VoxCPM

SR = 48000
model_dir = Path(snapshot_download("AlicanKiraz0/Kizagan-TTS-v1.0"))
ref = str(model_dir / "examples" / "quickstart.wav")
out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
plan = json.loads(Path(sys.argv[2]).read_text())
only = set(int(x) for x in sys.argv[3].split(",")) if len(sys.argv) > 3 else None

t0 = time.time()
model = VoxCPM.from_pretrained(str(model_dir), device="mps", load_denoiser=False, optimize=False)
print(f"model {time.time()-t0:.1f}s", flush=True)

SEEDS = json.loads(os.environ.get("SEEDS", "{}"))  # ör. {"01_0": 7}: o cümle başka seed'le

def say(text: str, path: Path) -> np.ndarray:
    if path.exists():
        return sf.read(str(path), dtype="float32")[0]
    torch.manual_seed(SEEDS.get(path.stem, 42))
    t = time.time()
    wav = model.generate(text=text, reference_wav_path=ref, cfg_value=2.0, inference_timesteps=16,
                         min_len=2, max_len=1024, normalize=False, denoise=False, retry_badcase=False)
    wav = np.asarray(wav, dtype="float32").reshape(-1)
    sf.write(str(path), wav, SR, subtype="FLOAT")
    print(f"  {len(wav)/SR:.1f}s ses, {time.time()-t:.1f}s üretim: {text}", flush=True)
    return wav

def silence(sec): return np.zeros(int(SR * sec), dtype="float32")

cta = say(plan["cta"], out / "cta.wav")
timings = json.loads((out / "timings.json").read_text()) if (out / "timings.json").exists() else {}
for reel in plan["reels"]:
    n = reel["n"]
    if only and n not in only: continue
    parts = [silence(0.25)]
    for i, s in enumerate(reel["voice"]):
        if i: parts.append(silence(0.30))
        parts.append(say(s, out / f"{n:02d}_{i}.wav"))
    parts.append(silence(0.35))
    body = sum(len(p) for p in parts) / SR
    full = np.concatenate(parts + [cta, silence(0.6)])
    sf.write(str(out / f"reel_{n:02d}.wav"), full, SR, subtype="PCM_24")
    timings[str(n)] = {"body": round(body * 1000), "end": round((len(cta) / SR + 0.6) * 1000)}
    (out / "timings.json").write_text(json.dumps(timings, indent=1))
    print(f"video {n}: {len(full)/SR:.1f}s (kart {body:.1f}s'de)", flush=True)
print(f"bitti {time.time()-t0:.0f}s")
