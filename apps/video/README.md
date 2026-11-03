# @uyarla/video

Remotion videoları, 9:16, 1080×1920, 30 kare/sn:

- `Tanitim`: "uyarla nedir" (DOG-164), seslendirmeli, ~47 sn.
- `Simulasyon`: mülakat simülasyonu (DOG-173), sessiz, ~20 sn. Sahne tanıtım sayfasının "Hazırlan" adımındaki film (`SimulationDemo.tsx`); filmin altındaki satır o anki aşamayı anlatıyor.

Sahneler tanıtım sayfasındaki filmlerin kendisi (`apps/web/src/features/landing/demos`).
Kare numarası ms'ye çevrilip filme veriliyor; sayfa değişince video da değişir.

- `src/script.ts`: bölümler (giriş, altı adım, Chrome eklentisi, kapanış) ve her sahnenin aralığı.
- `src/voice.json`: seslendirme cümleleri. TTS rakamı yanlış okuyor, sayılar yazıyla.
- `src/narration.json`: her cümlenin süresi (sn); bölüm süreleri buradan.
- `public/tanitim/<id>.wav`: seslendirme (git'te yok, Kizagan-TTS ile üretiliyor; `scripts/tiktok/README.md`).

## Çizmek

```bash
# Remotion'ın indirdiği headless shell bu makinede kök bileşeni yüklemiyor; Playwright'ınkini ver.
export REMOTION_BROWSER="$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell"
pnpm --filter @uyarla/video studio          # önizleme
pnpm --filter @uyarla/video render -- --scale=2
pnpm --filter @uyarla/video render:simulasyon -- --scale=2   # sessiz; loudnorm gerekmez
# Ses -16 LUFS:
ffmpeg -i out/tanitim.mp4 -c:v copy -af loudnorm=I=-16:TP=-1.5:LRA=11 -c:a aac -b:a 192k -movflags +faststart out/tanitim-son.mp4
```

Cümle değişirse: `voice.json` → TTS → whisper medium ile kontrol → wav'ı `public/tanitim/`e koy → `narration.json`'a süresini yaz → çiz.
