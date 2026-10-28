# TikTok videoları (DOG-162)

Dikey videolar `apps/web/src/features/landing/reels/reels.ts`'ten üretiliyor: açılış cümlesi, sahne aralığı, seslendirme cümleleri.

1. **Metinleri çıkar:**
   `cd apps/web && node --input-type=module -e "const m = await import('./src/features/landing/reels/reels.ts'); console.log(JSON.stringify({ cta: m.VOICE_CTA, reels: m.REELS.map(r => ({ n: r.n, voice: r.voice })) }))" > voice.json`
2. **Seslendir:** Kizagan-TTS v1.0, Apple Silicon. Ortam: `uv venv -p 3.12 && uv pip install voxcpm soundfile`.
   `PYTORCH_ENABLE_MPS_FALLBACK=1 python speak.py out voice.json [1,2,...]`
   - Çıktı: `out/reel_NN.wav` ve `out/timings.json` (`body` = kapanış kartına kadar, `end` = kart, ms).
   - Var olan cümle dosyaları yeniden üretilmez; değişen cümlenin `.wav`'ını sil.
   - `SEEDS='{"01_0":7}'` o cümleyi başka seed'le üretir.
3. **Kontrol et:** `check.py out/reel_NN.wav` (faster-whisper) sesi yazıya döker. Rakam ve cümle başında "CV'nde" yanlış okunuyor; sayıları yazıyla ver (testi var).
4. **Kaydet:**
   - Yerelde `pnpm dev:web`.
   - Playwright 540×960, `deviceScaleFactor: 2` ile `/ui/reels?n=N&capture=1&body=…&end=…` aç.
   - 30 kare/sn için her karede `await window.__reel.setMs(ms)` çağır, ardından ekran görüntüsü al.
5. **Birleştir:** `ffmpeg -framerate 30 -i %05d.jpg -i reel_NN.wav -c:v libx264 -crf 18 -pix_fmt yuv420p -af loudnorm=I=-16:TP=-1.5:LRA=11 -c:a aac -b:a 192k -shortest out.mp4`
