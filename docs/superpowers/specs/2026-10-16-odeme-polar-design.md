# Ödeme ve erişim dönemi: Polar ile tek seferlik paketler

**Tarih:** 16 Ekim 2026 · **Issue:** DOG-34 · **Durum:** Tasarım onaylandı, plan bekliyor

## 1. Amaç

uyarla'dan gelir elde etmek. Analiz herkese ücretsiz kalıyor; uyarlama ücretsiz
denemeden sonra bir erişim dönemi satın almayı gerektiriyor.

**Başarı ölçütü:** Kayıtlı bir kullanıcı ilk uyarlamasını ücretsiz yapıyor.
İkincisinde paket ekranına yönleniyor, Polar'da TL ile ödüyor, dönemi açılıyor ve
uyarlamaya kaldığı yerden devam ediyor. İade edilen ödeme dönemi kapatıyor.

## 2. Kararlar

| Konu | Karar | Gerekçe |
|---|---|---|
| Ödeme sağlayıcısı | **Polar** (merchant of record) | Şirket ve vergi kaydı yok. Polar bireysel hesabı kabul ediyor, ödemeyi Türk banka hesabına TL yapıyor, müşteriye TL fiyat gösteriyor. Düşük hacimde Paddle'dan ucuz ($15 SWIFT ücreti yok). |
| Model | **Tek seferlik erişim dönemi** (1 hafta / 1 ay / 3 ay), otomatik yenileme yok | İş arama geçici (planlama raporu §7). Unutulan yenileme, iade talebi, tüketici şikâyeti yok. |
| Ücretsiz plan | Sınırsız analiz (mevcut hız limitiyle) + **ömür boyu 1 uyarlama**; o uyarlamanın PDF/Word'ü ve ön yazısı, **filigransız** | İlk uyarlamanın tam olması değeri gösteriyor. Filigranlı CV gerçek başvuruda kullanılamaz; K2'nin "gerçek başvuruda kullanır mıydın" ölçütünü bozar. |
| Ödeme duvarı | **İkinci uyarlamada** | Analiz her zaman ücretsiz; maliyet ihmal edilebilir (K-54, tam akış ≈ $0,005). |
| Pano, CV kütüphanesi | Herkese açık | Elde tutmayı artırıyor, maliyeti yok. |
| Paketler ve fiyatlar | Yapılandırmada; fiyatlar K2'den sonra Polar panelinde | K2'deki "ne kadar öderdin" cevapları belirleyecek. |
| Dönem uzatma | Aktif dönem varken yeni paket alınırsa süre üstüne eklenir | Kalan gün kaybolmamalı. |
| Adil kullanım | Dönem içinde günde en çok 30 uyarlama | Kötüye kullanım koruması; maliyet değil. |

**Kapsam dışı:** kupon/indirim, ekip ve kurumsal plan, abonelik, global USD
fiyatlandırma, birden çok sağlayıcıyı aynı anda çalıştırmak.

## 3. Mimari

```
Uyarla düğmesi ─► POST /api/adapt
                    │ canAdapt(kullanıcı)
                    ├─ izin var ─► mevcut akış (Adaptation, kuyruk)
                    └─ izin yok ─► 402 { code: "payment_required" }
                                    │
             arayüz: /plans?donus=<analiz>
                                    │ paket seçimi
                    POST /api/billing/checkout
                    │ provider.createCheckout(kullanıcı, paket, dönüş adresi)
                    ▼
            Polar ödeme sayfası (Türkçe, TL)
                    │ ödeme
                    ├─► tarayıcı: /plans/tesekkurler?donus=…  (dönem açılana kadar yoklar)
                    └─► Polar webhook: POST /api/billing/webhook
                          │ imza doğrulama (Standard Webhooks)
                          │ order.paid     ─► AccessPass oluştur / uzat (sipariş kimliği tekil)
                          └ order.refunded ─► AccessPass iptal
```

### 3.1 Veri modeli

Yeni tablo `AccessPass`:

| Alan | Tür | Not |
|---|---|---|
| `id` | String | cuid |
| `userId` | String | User ile ilişki; hesap silinince silinir (cascade) |
| `plan` | String | Paket anahtarı: `week`, `month`, `quarter` |
| `startsAt` | DateTime | Dönem başlangıcı |
| `endsAt` | DateTime | Dönem sonu |
| `providerOrderId` | String, **tekil** | Polar sipariş kimliği; aynı bildirim iki kez işlenmez |
| `status` | `active` \| `refunded` | İade edilince `refunded` |
| `createdAt` | DateTime | |

**Ücretsiz hak ayrı bir sayaç değil:** kullanıcının analizlerine bağlı ve durumu
`failed` olmayan `Adaptation` kayıtları sayılıyor. Aynı analizin uyarlamasını
yeniden açmak hak harcamıyor (mevcut kayıt döndürülüyor).

### 3.2 Saf mantık (`apps/web/src/features/billing/`)

- `canAdapt({ adaptationsUsed, adaptationsToday, passes, now })` →
  `{ allowed: true, via: "free" | "pass" } | { allowed: false, reason: "free_used" | "daily_cap" }`.
  Ücretsiz hak: `adaptationsUsed < 1`. Dönem: `status === "active"` ve
  `startsAt <= now < endsAt`. Günlük tavan yalnızca dönemdeyken.
- `extendPass(passes, plan, now)` → yeni dönemin `{ startsAt, endsAt }`'i. Aktif
  dönem varsa en geç bitişin üstüne eklenir.
- `PLANS`: paket anahtarı → gün sayısı (`week` 7, `month` 30, `quarter` 90) ve
  Polar ürün kimliği (env'den).

### 3.3 Ödeme sağlayıcısı katmanı (`apps/web/src/server/billing/`)

```ts
interface BillingProvider {
  createCheckout(input: { userId: string; email: string; plan: PlanKey; successUrl: string }): Promise<{ url: string }>
  parseWebhook(rawBody: string, headers: Headers): Promise<BillingEvent | null> // imza geçersizse hata
}
type BillingEvent =
  | { type: "paid"; orderId: string; userId: string; plan: PlanKey }
  | { type: "refunded"; orderId: string }
```

İlk uygulama `polarProvider` (`@polar-sh/sdk`). Ödeme oturumunda
`externalCustomerId = userId` ve `metadata.plan` gönderiliyor; bildirimde bunlar
geri okunuyor. İleride iyzico, PayTR ya da Paddle yalnızca bu arayüzü uygular.

### 3.4 API

**Vercel Hobby 12 fonksiyon sınırı:** mevcut 16 route dosyası sınırın
kenarında. Ödeme için **tek** yeni dosya: `app/api/billing/[action]/route.ts`.

- `POST /api/billing/checkout`: kayıtlı kullanıcı, gövde `{ plan, returnTo }`. Polar
  ödeme adresini döndürüyor.
- `POST /api/billing/webhook`: Polar bildirimi. Ham gövde imzayla doğrulanıyor;
  geçersizse 403. İşlem idempotent (`providerOrderId` tekil).
- `GET /api/billing/status`: aktif dönem (`endsAt`) ve ücretsiz hakkın kullanılıp
  kullanılmadığı. Paket ekranı ve teşekkür sayfasının yoklaması bunu kullanıyor.

Deploy 12'yi aşarsa önce route birleştirme, sonra Vercel Pro ($20/ay) konuşulur.

`POST /api/adapt` başına `canAdapt` ekleniyor. İzin yoksa **402** ve
`{ code: "payment_required" | "daily_cap" }`.

### 3.5 Arayüz

- **Uyarla düğmesi:** 402 `payment_required` gelirse `/plans?donus=/analyze?uyarla=<analiz>`.
- **`/plans`:** paketler (ad, süre, fiyat, "en iyi birim fiyat" etiketi), ücretsiz
  hakkın durumu, cayma hakkı onay kutusu, "Öde" düğmesi.
- **`/plans/tesekkurler`:** dönem açılana kadar `GET /api/billing/status`'u yokluyor
  (bildirim birkaç saniye gecikebilir), sonra `donus` adresine götürüyor.
- **Hesabım:** aktif dönem, bitiş tarihi, "Paket al / uzat". Fatura Polar'ın
  e-postasında.
- **Fiyat gösterimi:** fiyatlar Polar'da tanımlı. Paket ekranı için fiyatlar
  yapılandırmada da tutuluyor (`PLANS`), ödeme sayfasındaki tutar Polar'dan.

## 4. Hata durumları

| Durum | Davranış |
|---|---|
| Ücretsiz hak kullanılmış, dönem yok | 402 `payment_required` → paket ekranı |
| Dönemde günlük 30 tavanı | 402 `daily_cap` → "Bugünlük sınırına ulaştın, yarın devam edebilirsin" |
| Webhook imzası geçersiz | 403, hiçbir şey yazılmıyor |
| Aynı sipariş bildirimi iki kez | İkincisi yok sayılıyor (tekil kısıt) |
| Bildirim gecikti | Teşekkür sayfası 60 sn yokluyor; sonra "Ödemen alındıysa birkaç dakika içinde açılır" ve destek e-postası |
| Bildirimdeki kullanıcı bulunamadı (hesap silinmiş) | Kayıt yazılmıyor, Sentry'ye uyarı; iade Polar panelinden elle |
| İade | `order.refunded` → dönem `refunded`, erişim hemen kapanıyor |
| Polar'a ulaşılamıyor (checkout) | "Ödeme sayfasını açamadık, birazdan tekrar dene" |

## 5. Hukuki ve metinler

- **Yeni sayfalar:** `/terms` (Kullanım Koşulları), `/refund` (İade ve Cayma).
  Polar hesap onayı bunları istiyor.
- **Gizlilik metni:** Polar, ödeme işleyeni olarak ekleniyor. Kart bilgisi uyarla'ya
  hiç gelmiyor.
- **Cayma hakkı:** dijital içerikte, tüketicinin açık onayıyla ifaya başlandıktan
  sonra cayma hakkı kullanılamıyor (Mesafeli Sözleşmeler Yönetmeliği md. 15).
  Paket ekranında ödeme öncesi onay kutusu: "Erişimin hemen başlamasını ve bu
  nedenle cayma hakkımı kaybedeceğimi kabul ediyorum."
- Metinler taslak; **yayından önce bir hukukçu ya da mali müşavir baksın.**

## 6. Yapılandırma

| Değişken | Not |
|---|---|
| `POLAR_ACCESS_TOKEN` | Polar organizasyon erişim anahtarı |
| `POLAR_WEBHOOK_SECRET` | Bildirim imza anahtarı |
| `POLAR_SERVER` | `sandbox` (varsayılan) ya da `production` |
| `POLAR_PRODUCT_WEEK`, `POLAR_PRODUCT_MONTH`, `POLAR_PRODUCT_QUARTER` | Polar ürün kimlikleri; boş olan paket gösterilmiyor |

**Önce sandbox:** her şey Polar'ın test ortamında denenir; üretime geçiş
değişkenleri değiştirmek.

## 7. Test

- **Saf mantık:**
  - `canAdapt`: ücretsiz hak, aktif / bitmiş / iade dönem, günlük tavan.
  - `extendPass`: dönem yok, aktif dönem üstüne ekleme, bitmiş dönemden sonra.
- **Webhook işleyicisi:** imza geçersiz → 403; `order.paid` → dönem; aynı sipariş
  iki kez → tek dönem; `order.refunded` → iptal. Polar SDK'sı sahte sağlayıcıyla
  değiştiriliyor.
- **Tümleşik:** `POST /api/adapt` ikinci uyarlamada 402; dönem varken 200.
- **Uçtan uca (sandbox):** gerçek Polar test kartıyla ödeme → bildirim → dönem →
  uyarlama devam ediyor; iade → erişim kapanıyor.

## 8. Senden gerekenler

1. Polar hesabı (bireysel), Türk banka hesabı ve kimlik doğrulaması. Doğrulamanın
   gerçekten geçtiğini görmek kod yazmadan önceki ilk adım.
2. Sandbox organizasyonunda üç ürün (tek seferlik, TL) ve erişim anahtarı.
3. K2 sonrası fiyatlar.
4. Yayından önce hukuki metinlerin kontrolü.
