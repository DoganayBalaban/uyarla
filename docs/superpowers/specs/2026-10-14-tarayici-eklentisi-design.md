# Tarayıcı eklentisi: ilan sayfasından tek tıkla uyum analizi

**Tarih:** 14 Ekim 2026 · **Issue:** DOG-70 · **Durum:** Tasarım onaylandı, plan bekliyor

## 1. Amaç

Kullanıcı Kariyer.net, LinkedIn, yenibiris gibi bir sitede ilana bakarken tek
tıkla o ilana uyumunu görsün: ilan metnini kopyalayıp yapıştırmadan.

DOG-67'de ilanın tam metni sunucudan alınamadı. Jooble Cloudflare doğrulaması,
Careerjet doğrulama sayfası istiyor; LinkedIn ve Kariyer.net'i kazımak hukuken
riskli. Eklenti ilanı **kullanıcının kendi tarayıcısında, kendi açtığı ve
tıkladığı sayfadan** okuyor; sunucudan toplu çekme yok.

**Başarı ölçütü:** Desteklenen sitelerde ilan açıkken eklenti simgesine
tıklayınca uyarla, ilanın tam metniyle açılıyor. Kütüphanesinde varsayılan CV'si
olan kayıtlı kullanıcıda analiz kendiliğinden başlıyor.

## 2. Kapsam ve kararlar

| Konu | Karar |
|---|---|
| Dağıtım | İlk sürüm geliştirici modunda (zip) senin ve K2 katılımcılarının tarayıcısında. Mağaza kurallarına baştan uyuluyor; yayın K2 sonrası tek adım. |
| uyarla ile bağlantı | Eklenti uyarla'nın analiz sayfasını yeni sekmede ilan metni dolu açıyor. Eklentide oturum, çerez, CORS ve yeni API ucu yok. |
| Tetikleyici | Araç çubuğu simgesi ve seçili metinde sağ tık menüsü. Sayfaya buton eklenmiyor. |
| Yapı | Yalın TypeScript, esbuild, Manifest V3. Popup arayüzü yok. |
| İlan çıkarma | Web'deki saf `extractPostingText` core'a taşınıyor; eklenti ve web aynı kodu kullanıyor. |

**Kapsam dışı:** skoru eklenti içinde göstermek, sayfaya buton eklemek,
Firefox ve Safari, mağaza yayını.

## 3. Mimari

```
[ilan sayfası]
   │  simgeye tıkla (activeTab)          ya da   seçili metin → sağ tık
   ▼                                                  │
background.ts ── scripting: sayfanın HTML'i ve adresi │
   │  extractPostingText(html, host)   (core)         │
   ▼                                                  ▼
 ilan metni ─────────────────────────────────────────┘
   │  yeterli değilse → rozet "!" ve bildirim, uyarla açılmaz
   ▼
yeni sekme: UYARLA_URL/analyze#ilan=<metin>&kaynak=<sayfa adresi>
   │
AnalyzeView: #ilan → ilan alanı, kaynak → ilan bağlantısı alanı, # silinir
   │  varsayılan CV ön seçili ve kayıtlı kullanıcı → analiz kendiliğinden başlar
   ▼
sonuç sayfası
```

### 3.1 `packages/core/src/jobPosting/extract.ts`

`apps/web/src/server/jobPostingFromUrl.ts` içindeki saf kısım buraya taşınır:

- `extractPostingText(html, host)`: önce JSON-LD (`JobPosting`), sonra site
  kuralları, sonra ana metin yedeği.
- `htmlToText` ve site kuralları (`SITE_RULES`) da taşınıyor.

Ağa çıkan kısım (izinli alan listesi, `fetch`, yönlendirme kontrolü) web'de
kalır. Web davranışı değişmez: mevcut testler aynı sonuçla geçer.

### 3.2 `apps/extension` (yeni çalışma alanı paketi `@uyarla/extension`)

- **`manifest.json` (MV3):**
  - İzinler: `activeTab`, `scripting`, `contextMenus`, `notifications`.
  - `host_permissions` yok. `action` (simge) ve `background.service_worker`.
- **`src/background.ts`** (ince katman, Chrome API'leri):
  - **Simgeye tıklanınca:** `chrome.scripting.executeScript` ile o sekmede
    `document.documentElement.outerHTML` ve `location.href` alınır →
    `pickPosting` → `openUyarla`.
  - **Sağ tık menüsü:** "Seçili metni uyarla ile ölç". Seçili metin doğrudan
    `openUyarla`'ya gider.
- **`src/posting.ts`** (saf, testli):
  - `pickPosting({ html, url })`: `extractPostingText` sonucunu döndürür ya da
    `null` (metin `MIN_JOB_TEXT_LENGTH`'ten kısaysa).
  - `uyarlaUrl(base, text, sourceUrl)`: hedef adresi kurar.
    `#ilan=<encodeURIComponent(metin)>&kaynak=<adres>`; metin
    `MAX_EXTENSION_TEXT` (20.000 karakter) sınırında kırpılır.
- **`UYARLA_URL`:** build sırasında esbuild `define` ile verilir. Varsayılan
  `https://uyarla.vercel.app`; `pnpm dev` için `http://localhost:3000`.

### 3.3 Web: `AnalyzeView`

- **Saf fonksiyon** `readExtensionHandoff(hash)`: `{ jobText, sourceUrl } | null`.
  Yalnızca `#ilan=` ile başlayan ve en az 50 karakter metin taşıyan değeri kabul
  ediyor.
- **Sayfa açılırken:**
  - Değer varsa: ilan alanı doldurulur, kaynak adres ilan bağlantısı alanına
    yazılır, `history.replaceState` ile `#` kısmı silinir (geri tuşunda ya da
    yenilemede tekrar dolmasın).
  - Kayıtlı kullanıcı, kütüphaneden ön seçili bir CV var ve ilan geçerliyse →
    form bir kez kendiliğinden gönderilir.
  - Aksi hâlde form dolu bekler; kullanıcı CV seçip başlatır.
- **Anonim ziyaretçi:** CV yükleme adımı gerektiği için kendiliğinden başlama
  yok.

## 4. Hata durumları

| Durum | Davranış |
|---|---|
| Sayfada ilan bulunamadı ya da metin 50 karakterden kısa | uyarla açılmaz. Simgede "!" rozeti ve bildirim: "Bu sayfada ilan bulamadık. İlan metnini seçip sağ tıkla 'uyarla ile ölç' de." |
| Betik çalıştırılamayan sayfa (`chrome://`, Web Mağazası) | Aynı bildirim. |
| Metin 20.000 karakteri aşıyor | Kırpılır. Analiz yine başlar; ilanların büyük çoğunluğu bu sınırın altında. |
| `#ilan` bozuk ya da kısa | Yok sayılır, form boş açılır. |
| Ön seçili CV silinmiş (404) | Mevcut akış: seçim temizlenir, kullanıcı yeniden seçer. |

## 5. Gizlilik ve mağaza hazırlığı

- Eklenti kendi başına hiçbir sunucuya istek atmaz, depolama ve izleme yapmaz.
  İlan metni, kullanıcının bugün yapıştırdığı metinle aynı yoldan gider.
  URL'nin `#` kısmı sunucuya ve günlüklere düşmez.
- **Gizlilik metnine eklenecek satır:** "Tarayıcı eklentisi, yalnızca sen
  tıkladığında açık sayfadaki ilan metnini uyarla'ya aktarır; başka bir veri
  toplamaz."
- **Simgeler:** mevcut logo ikonundan 16, 32, 48 ve 128 piksel.
- **Mağaza için bu sürümde hazırlananlar:** kısa ve uzun açıklama, izin
  gerekçeleri, gizlilik politikası adresi (`/privacy`).

## 6. Dağıtım (K2)

- `pnpm --filter @uyarla/extension build` komutu `dist/` ve
  `uyarla-eklenti-<sürüm>.zip` üretir.
- **README'de kurulum:** zip'i aç → `chrome://extensions` → Geliştirici modu →
  "Paketlenmemiş öğe yükle" → klasörü seç.

## 7. Test

- **Core:** `extractPostingText` testleri taşınır. Yeni durumlar: LinkedIn
  sayfası (JSON-LD), Kariyer.net sayfası, JSON-LD olmayan sayfada ana metin
  yedeği.
- **Eklenti:** `pickPosting` (kısa metin → `null`), `uyarlaUrl` (Türkçe
  karakter kodlama, kırpma, kaynak adres).
- **Web:** `readExtensionHandoff` (geçerli, kısa, bozuk, `#ilan` yok);
  kendiliğinden başlama koşulu saf bir yardımcıda.
- **Elle doğrulama:** eklenti Chrome'a yüklenir. Kariyer.net, LinkedIn,
  yenibiris ve Jooble'ın gerçek ilan sayfalarında simge ve sağ tık yolu
  denenir, ekran görüntüleriyle raporlanır.

## 8. Kısıtlar

- **Vercel Hobby 12 fonksiyon sınırı:** yeni bir API route eklenmiyor (bu
  tasarım hiç eklemiyor).
- **Kod kuralları:** isimler İngilizce, yorumlar ve arayüz metinleri Türkçe.
  `git add` açık yollarla yapılır.
- **Merge:** Vercel kontrolü SUCCESS olmadan yapılmaz.
