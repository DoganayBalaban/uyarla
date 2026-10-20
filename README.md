# Uyarla

CV'ni bir iş ilanına göre ölçen ve uyarlayan, **uydurmayan** bir başvuru
yardımcısı. Canlıda: [uyarla.com.tr](https://uyarla.com.tr)

Temel ilke: CV'de olmayan bir deneyim, beceri ya da sayı hiçbir çıktıya
girmez. Uydurma kontrolü LLM'e bırakılmaz; kodda, deterministik olarak
yapılır (sayılar, ilan terimleri, anlamsal sapma). Gerekçeler
[`docs/kararlar.md`](docs/kararlar.md)'de (K-28, K-38 ve sonrası).

## Ne yapıyor

| Adım | Özellik |
|---|---|
| **Ölç** | CV ile ilanı karşılaştırır: uyum skoru, zorunlu gereksinimler, eksik kavramlar, biçim sorunları, "başvuruya hazır mı". Kayıt gerektirmez. |
| **İlanı al** | Bağlantıdan ilan metni (Kariyer.net, LinkedIn, Greenhouse, Lever, Workday…), tarayıcı eklentisi ya da örnek ilan. İlanın platformuna göre kaynaklı ipuçları ve taklit alan adı uyarısı. |
| **Uyarla** | Maddeleri ilanın diliyle yeniden yazar; her öneri kabul, ret ya da elle düzenleme. Tek sayfa düzeni, PDF ve DOCX indirme, ilan terimlerini vurgulama. |
| **Eksikleri kapat** | "AI ile yaz": kullanıcının anlattığı deneyimden yeni madde. Hatırlanan olgular sonraki ilanlarda kanıt sayılır. |
| **Başvur** | Ön yazı ve kontrol listesi; başvuru formu sorularına karakter ya da kelime sınırlı yanıtlar. |
| **Takip et** | Başvuru panosu (aşama, not, mülakat günü, son başvuru tarihi), takip mesajı ve teşekkür notu taslakları, e-posta hatırlatmaları. |
| **Mülakat** | Olası sorular, CV'den birebir kanıt, STAR iskeleti, savunulacak iddialar, eksiklere dürüst köprü; yazılı pratik ve geri bildirim. |

## Mimari

```
            ┌──────────────────────┐       ┌──────────────────────────┐
tarayıcı ──▶│ apps/web  (Next.js)  │──────▶│ Redis (BullMQ kuyrukları) │
eklenti  ──▶│ Vercel               │       └────────────┬─────────────┘
            └──────────┬───────────┘                    │
                       │                     ┌──────────▼───────────┐
                       │                     │ apps/worker (Node)    │──▶ LLM ve gömme
                       │                     │ Railway               │    (OpenAI uyumlu)
                       │                     └──────────┬───────────┘
                       ▼                                ▼
            ┌───────────────────────────────────────────────────────┐
            │ Postgres (Neon, Prisma) · dosyalar: Cloudflare R2     │
            └───────────────────────────────────────────────────────┘
```

- **Web isteği LLM beklemez.** Analiz, uyarlama, ön yazı, takip mesajı,
  mülakat hazırlığı, pratik ve form yanıtı worker'da çalışır. Arayüz sonucu
  yoklar (K-02).
- **Zamanlanmış görev** (Railway, her gün 07:00 UTC): 30 günlük anonim
  kullanıcı temizliği ve günlük e-postalar (`cleanup:cron`).
- **Diğer servisler:**
  - Better Auth: e-posta bağlantısı, Google, LinkedIn, GitHub ve anonim oturum.
  - Polar: ödeme.
  - Resend: e-posta.
  - Sentry: hata izleme.
  - Vercel Web Analytics: çerezsiz sayfa sayımı.

## Depo düzeni

pnpm çalışma alanı (Node ≥ 22, pnpm 11).

| Yol | İçerik |
|---|---|
| `apps/web` | Next.js uygulaması. Arayüz özellik bazlı klasörlerde (`src/features/*`), API uçları `src/app/api`, sunucu kodu `src/server`, bakım betikleri `scripts/`. |
| `apps/worker` | BullMQ worker'ı: `analyze` ve `adapt` kuyrukları, iş türü başına bir akış (`*-pipeline.ts`). |
| `apps/extension` | Chrome eklentisi: açık ilan sayfasını uyarla'ya gönderir. Ayrıntı: [`apps/extension/README.md`](apps/extension/README.md). |
| `packages/core` | Alan mantığı, çerçeveden bağımsız: çıkarım, skorlama, uyarlama, doğrulama, ön yazı, mülakat, belge üretimi. Değerlendirme betikleri `eval/` altında. |
| `packages/db` | Prisma şeması ve göçler. |
| `packages/fonts` | PDF üretimi için gömülü yazı tipleri. |
| `docs/` | Kararlar (K-xx), yol haritası, marka rehberi, e-posta stratejisi, sprint kapanışları. |

## Yerelde çalıştırma

```bash
pnpm install
cp .env.example .env        # değerleri doldur, açıklamalar dosyada
pnpm db:up                  # Postgres ve Redis (docker compose)
pnpm --filter @uyarla/db migrate
pnpm dev                    # web http://localhost:3001 ve worker birlikte
```

- **LLM:** OpenAI uyumlu herhangi bir uç (`LLM_BASE_URL`, `LLM_MODEL`).
  Yerelde LM Studio, üretimde `gpt-4.1-mini`. Gömme modeli ayrı
  (`EMBEDDING_*`).
- **Dosyalar:** `S3_BUCKET` boşsa yerel diske (`STORAGE_DIR`) yazılır.
- **E-posta:** `RESEND_API_KEY` boşsa giriş bağlantısı terminale yazılır.
- **Opsiyonel servisler:** Polar, Sentry ve OAuth sağlayıcıları boş
  bırakılabilir; ilgili özellik kapalı kalır.

## Test ve ölçüm

```bash
pnpm typecheck
pnpm test                                    # tüm paketlerin birim testleri
pnpm --filter @uyarla/web test:integration   # gerçek veritabanıyla
pnpm --filter @uyarla/core eval:adapt        # örnek: uyarlama değerlendirmesi
```

LLM'e dokunan her özellik bir değerlendirme betiğiyle ölçülür
(`packages/core/eval`, `eval:*` betikleri). Değerlendirme CV-ilan
çiftleriyle çalışır ve uydurma işareti, kapsam, uzunluk, klişe gibi
ölçüleri raporlar. Sonuçlar ilgili kararda tablo olarak durur. Koşu çıktıları
`eval/runs/` altına yazılır. Bunlar commit'lenmez; `.gitignore`'da olmadıkları
için `git add`'e dizin değil, açık dosya yolu ver.

## Dağıtım

- **Web → Vercel:** `main`'e merge edilince otomatik dağıtılır.
  - Hobby planda dağıtım başına 12 fonksiyon sınırı var. Web, core'u yalnızca
    alt yollardan içe aktarır (`@uyarla/core/score/live` gibi; K-68).
  - Yeni iş türleri mevcut uçlara `type` alanıyla eklenir, yeni uç açılmaz.
- **Worker ve zamanlanmış görev → Railway:** `main`'e merge edilince, izlenen
  yollar değiştiyse dağıtılır. Worker 512 MB bellekle çalışır; üretimde `tsx`
  yok, worker `esbuild` ile derlenir.
- **Göçler:**
  - Elle uygulanır:
    `DATABASE_URL=<doğrudan bağlantı> pnpm --filter @uyarla/db exec prisma migrate deploy`.
  - Yeni kod alanı okuyorsa göç merge'den **önce** uygulanır.
  - Göçler yalnızca ekleyici (boş bırakılabilir sütun) tutulur ki eski kod
    bozulmasın.
- **Merge kuralı:** Vercel kontrolü SUCCESS olmadan PR merge edilmez.

## Çalışma düzeni

- **İş takibi Linear'da:** DOG takımı, uyarla projesi. Dal adı
  `dbalaban1907/dog-<n>-…`. PR başlığında issue numarası olur.
- **Kararlar** [`docs/kararlar.md`](docs/kararlar.md)'de K-numarasıyla
  yazılır: bağlam, karar ve varsa ölçüm.
- **Kod kuralları:**
  - İsimler İngilizce, yorumlar Türkçe.
  - HTTP için axios, sunucu durumu için TanStack Query, istemci durumu için
    zustand, formlar için React Hook Form ve zod.
  - Arayüz özellik bazlı klasörlerde (`src/features/<özellik>`).
- **Kişisel veri:**
  - Kullanıcı verisi Hesabım'dan dışa aktarılır ve silinir.
  - Anonim hesaplar 30 gün sonra temizlenir.
  - Ürün e-postaları onaysız gönderilmez (`PRODUCT_EMAILS_ENABLED`, DOG-130).
