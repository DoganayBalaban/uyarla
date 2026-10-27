# Abonelik: Ücretsiz, 1 Ay ve 3 Ay; 7 günlük deneme

**Tarih:** 28 Ekim 2026 · **Issue:** DOG-158 (DOG-76 ile birleşiyor) · **Durum:** Tasarım onaylandı, plan bekliyor
**Yerine geçtiği:** `2026-10-16-odeme-polar-design.md` içindeki tek seferlik paket modeli (DOG-34). Polar, merchant of record ve TL kararı aynen geçerli.

## 1. Amaç

Tek seferlik erişim dönemlerinden (1 hafta, 1 ay, 3 ay) Jobscan tarzı aboneliğe geçmek. Ücretsiz katman her ay yenilenen bir kotayla geri dönme sebebi veriyor. Abonelik 7 günlük ücretsiz denemeyle başlıyor.

**Başarı ölçütü:**
1. Ücretsiz bir kullanıcı ayın 6. analizinde ya da 2. uyarlamasında paket ekranına yönleniyor.
2. "7 gün ücretsiz başla" ile Polar'da kartını giriyor ve hiç ücret ödemeden her şeyi açıyor.
3. Kaldığı işe dönüyor.
4. Denemede iptal ederse hiç ücret çekilmiyor. İptal etmezse 7. gün ilk ücret çekiliyor ve abonelik dönem dönem yenileniyor.

## 2. Kararlar

| Konu | Karar | Gerekçe |
|---|---|---|
| Model | **Abonelik**, otomatik yenileme, her an iptal | Kullanıcı Jobscan modelini istedi (28 Ekim). Tek seferlik modelin "otomatik yenileme yok" kararı (DOG-34) bununla kalkıyor; K-107. |
| Paketler | Ücretsiz · 1 Ay · 3 Ay | Haftalık paket kalkıyor. Üretimde hiç satın alım yok (28 Ekim, okuma sayımı), taşınacak abone yok. |
| Fiyat | 1 Ay **299 ₺/ay**; 3 Ay **599 ₺ / 3 ay** (200 ₺/ay, %33 tasarruf) | Kullanıcı seçti. Gösterim fiyatı yapılandırmada, çekilen tutar Polar'da. |
| 1 Ay ve 3 Ay | **Aynı özellikler**; fark fiyat ve fatura dönemi | Basit karşılaştırma; 3 Ay ucuzluğuyla seçiliyor. |
| Deneme | **7 gün**, iki pakette de; kart alınıyor; **denemede her şey açık**; hesap başına bir kez | Değerin tamamı görülsün. Kart olduğu için kötüye kullanım düşük. Polar'ın tekrar deneme engeli (e-posta ve kart parmak izi) açık; bizde de daha önce aboneliği olmayana "deneme" deniyor. |
| Ücretsiz katman | **Ayda 5 analiz**, **ayda 1 uyarlama** (ön yazı ve PDF/DOCX dahil); pano, takip ve teşekkür notu, eklenti, LinkedIn teşhisi ücretsiz | Kullanıcı seçti (Jobscan gibi aylık kota). |
| Kota dönemi | **Takvim ayı**, İstanbul saati; ayın 1'inde yenileniyor | "1 Kasım'da yenilenir" anlaşılır. Sayaç tutulmuyor, o ayki kayıtlar sayılıyor. |
| Abonelikte | Sınırsız analiz (mevcut hız sınırı), sınırsız uyarlama (24 saatte 30), mülakat hazırlığı, yazılı pratik, form yanıtları, LinkedIn hakkında ve deneyim yazımı | Bugün ücretsiz olan mülakat hazırlığı, pratik ve form yanıtı ücretliye geçiyor. |
| İptal | Polar müşteri portalından; erişim ödenen dönemin sonuna kadar | İptal ekranını kendimiz yazmıyoruz; 6502 md. 51'deki "dilediği zaman fesih" karşılanıyor. |
| Ödeme alınamadı | `past_due`: erişim dönem sonuna kadar sürüyor, Polar kartı yeniden deniyor | Kartı bir günlüğüne reddedilen kullanıcı işinin ortasında kesilmesin. |
| Hatırlatma ve makbuz e-postaları | Polar gönderiyor | Deneme bitişinden 3 gün önce hatırlatma Polar'da yerleşik. Tek seferlik dönemin "bitmesine 2 gün kaldı" e-postası (DOG-129) kalkıyor. |
| Tanıtım sayfası | Değişmiyor | Kullanıcının kararı: "landinge dokunmuyoruz". |

**Kapsam dışı:** yıllık paket, kupon/indirim, ekip/kurum planı, paket yükseltme ve düşürme ekranı (Polar portalı yeterli), kendi deneme hatırlatma e-postamız.

## 3. Paketler ve özellikler

| | Ücretsiz | 1 Ay | 3 Ay · En popüler |
|---|---|---|---|
| Fiyat | 0 ₺ | 299 ₺ / ay | 200 ₺ / ay (3 ayda bir 599 ₺) · %33 tasarruf |
| 7 gün ücretsiz deneme | — | ✓ | ✓ |
| İlan analizi ve uyum skoru | Ayda 5 | Sınırsız | Sınırsız |
| CV uyarlama (ön yazı ve PDF/DOCX dahil) | Ayda 1 | Sınırsız (24 saatte 30) | Sınırsız (24 saatte 30) |
| Mülakat hazırlık paketi | — | ✓ | ✓ |
| Yazılı mülakat pratiği | — | ✓ | ✓ |
| Başvuru formu yanıtları | — | ✓ | ✓ |
| LinkedIn hakkında ve deneyim yazımı | — | ✓ | ✓ |
| LinkedIn teşhisi ve başlık önerileri | ✓ | ✓ | ✓ |
| Başvuru panosu, takip mesajı ve teşekkür notu | ✓ | ✓ | ✓ |
| CV kütüphanesi, hatırlatmalar, Chrome eklentisi | ✓ | ✓ | ✓ |

- **Anonim ziyaretçi:** Analizde aynı kotaya tabi (kendi anonim kullanıcı satırı üzerinden). Kayıt olunca analizleri hesaba taşınıyor ve kotadan düşüyor.
- **Başarısız kayıtlar** (`failed` analiz ya da uyarlama) kotadan düşmüyor.
- **Aynı analizin uyarlamasını yeniden açmak** hak harcamıyor (bugünkü gibi).

## 4. Mimari

```
Analiz / Uyarla / Mülakat / Pratik / Form / LinkedIn yazımı
        │ requireEntitlement(kullanıcı, özellik)
        ├─ izin var ─► mevcut akış
        └─ izin yok ─► 402 { code: analysis_quota | adaptation_quota | subscription_required | daily_cap }
                         │
          arayüz: /plans?donus=<kaldığı yer>
                         │ "7 gün ücretsiz başla" / "Abone ol"
          POST /api/billing/checkout ─► Polar abonelik ödeme sayfası (deneme üründe tanımlı)
                         │
                         ├─► tarayıcı: /plans/thanks?donus=… (abonelik görünene kadar yoklar)
                         └─► Polar webhook: POST /api/billing/webhook
                               │ imza doğrulama
                               └ subscription.* ─► Subscription satırını Polar'daki son hâle getir
```

### 4.1 Veri modeli

`AccessPass` ve `AccessPassStatus` kalkıyor (üretimde boş). Yeni tablo `Subscription`:

| Alan | Tür | Not |
|---|---|---|
| `id` | String | cuid |
| `userId` | String | User ilişkisi; hesap silinince siliniyor (cascade) |
| `providerSubscriptionId` | String, **tekil** | Polar abonelik kimliği |
| `plan` | String | `month` \| `quarter` (Polar ürününden) |
| `status` | String | Polar'daki gibi: `incomplete`, `trialing`, `active`, `past_due`, `canceled`, `unpaid`, `revoked`… Bilinmeyen değer saklanıyor, erişim vermiyor |
| `currentPeriodEnd` | DateTime? | Sonraki ödeme ya da erişim bitişi |
| `cancelAtPeriodEnd` | Boolean | İptal edildi, dönem sonunda bitecek |
| `trialEnd` | DateTime? | Denemedeyse bitiş |
| `providerUpdatedAt` | DateTime | Polar'ın `modified_at`'ı; eski bildirim yeniyi ezmesin |
| `createdAt`, `updatedAt` | DateTime | |

Kullanıcı başına birden çok satır olabiliyor: iptal edip yeniden abone olan kullanıcı. Erişim, satırlardan herhangi biri erişim veriyorsa açık.

### 4.2 Saf mantık (`apps/web/src/features/billing/`)

- `hasAccess(subs, now)` → boolean. Bir satır şu durumlarda erişim veriyor:
  - `trialing` ya da `active`;
  - `past_due` ve `now < currentPeriodEnd`;
  - `canceled`, `cancelAtPeriodEnd` ve `now < currentPeriodEnd`.

  Geri kalan her durum (`revoked`, `unpaid`, `incomplete`, bilinmeyen, süresi geçmiş) erişim vermiyor.
- `trialEligible(subs)` → hiç satır yoksa `true`.
- `monthStart(now)` → İstanbul saatine göre ayın ilk anı (UTC). `nextMonthStart(now)` ekrandaki "yenilenir" tarihi için.
- `FREE_QUOTA = { analyses: 5, adaptations: 1 }`, `DAILY_CAP = 30` (mevcut).
- `decide(feature, { subs, analysesThisMonth, adaptationsThisMonth, adaptationsLast24h, now, unlimited })` → `{ allowed: true, via: "free" | "subscription" | "admin" } | { allowed: false, code }`.
  - `feature` değerleri: `analysis`, `adaptation`, `interview_prep`, `practice`, `form_answer`, `linkedin_rewrite`.
  - Yönetici (`isAdmin`) her şeyi sınırsız kullanıyor (bugünkü gibi).
- Mevcut `canAdapt`, `extendPass`, `activePassEnd`, `PLAN_DAYS.week` ve `PASS_FEATURES` kalkıyor; `accessSnapshot` abonelik ve kota durumunu döndürecek biçimde değişiyor.

### 4.3 Sunucu (`apps/web/src/server/billing/`)

- `loadEntitlement(db, userId, now)`: abonelik satırları, bu ayki analiz ve uyarlama sayıları, son 24 saatteki uyarlamalar.
- `requireEntitlement(db, user, feature, now)`: `decide` reddederse `PaymentRequiredError(code)` fırlatıyor.
  - Uyarlama ve analiz kotası için kullanıcının satırını kilitleyen mevcut `lockUser` deseni kullanılıyor (DOG-77): iki sekmeden gelen istek iki ücretsiz hak açmasın.
- **Kapılar:**

| Uç | Özellik |
|---|---|
| `POST /api/analyze` | `analysis` |
| `POST /api/adapt` | `adaptation` |
| `PATCH /api/applications/[id]` (aşama "Mülakat" olunca hazırlık işi) | `interview_prep`. Erişim yoksa aşama değişiyor ama iş kuyruğa girmiyor; kart kilitli görünüyor |
| `POST /api/applications/[id]` `type: "practice"` | `practice` |
| `POST /api/applications/[id]` `type: "form-answer"` | `form_answer` |
| `GET /api/linkedin/audits` ve dışa aktarım (`lockRewrites`) | `linkedin_rewrite` (`hasAccess`) |

  Takip mesajı ve teşekkür notu (`POST /api/applications/[id]` varsayılan) ücretsiz kalıyor.
- **Sağlayıcı arayüzü** (`provider.ts`):

```ts
type BillingEvent = {
  type: "subscription"
  subscriptionId: string
  userId: string            // externalCustomerId
  plan: "month" | "quarter" // ürün kimliğinden
  status: string
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  trialEnd: Date | null
  modifiedAt: Date
}
interface BillingProvider {
  createCheckout(input: { userId: string; email: string; productId: string; successUrl: string }): Promise<{ url: string }>
  createPortalSession(input: { userId: string }): Promise<{ url: string }>
  cancelSubscription(subscriptionId: string): Promise<void> // hesap silinince, dönem sonu beklenmeden
  parseWebhook(rawBody: string, headers: Record<string, string>): Promise<BillingEvent | null>
}
```

- **Bildirim işleyicisi:** `subscription.created`, `updated`, `active`, `canceled`, `uncanceled` ve `revoked` aynı yere gidiyor. `providerSubscriptionId`'ye göre ekle-ya da-güncelle; gelen `modifiedAt` kayıttakinden eskiyse yok sayılıyor. Kullanıcı bulunamazsa (hesap silinmiş) yazılmıyor ve aboneliği iptal etme isteği gönderiliyor.
- **Hesap silme:** Önce açık abonelikler `cancelSubscription` ile Polar'da iptal ediliyor, sonra satırlar siliniyor. Polar'a ulaşılamazsa silme durmuyor; Sentry'ye uyarı gidiyor, iptal elle yapılıyor.

### 4.4 API (`/api/billing/[action]`, tek dosya; Vercel 12 fonksiyon sınırı)

- `POST checkout`: kayıtlı kullanıcı, gövde `{ plan: "month" | "quarter", returnTo }`. Aktif aboneliği varsa ödeme sayfası yerine portal adresi dönüyor.
- `POST portal`: kayıtlı kullanıcı; Polar müşteri portalı adresi.
- `GET status`: `{ subscription: { plan, status, currentPeriodEnd, cancelAtPeriodEnd, trialEnd } | null, trialEligible, quota: { analyses: { used, limit }, adaptations: { used, limit }, resetsAt } | null, dailyCap }`. Abonelikte `quota` null.
- `POST webhook`: Polar bildirimi; imza geçersizse 403.

## 5. Arayüz

- **`/plans`:** Karşılaştırma tablosu (§3); 3 Ay vurgulu, "En popüler · %33 tasarruf" rozeti.
  - Fiyat satırı aylık tutar; 3 Ay'da altında "3 ayda bir 599 ₺".
  - Düğmeler: deneme hakkı varsa "7 gün ücretsiz başla", yoksa "Abone ol"; abonenin kendi paketinde "Mevcut paketin" ve "Aboneliği yönet"; Ücretsiz'de "Ücretsiz kullan" ya da "Mevcut paketin".
  - Altta: "Deneme bitmeden iptal edersen ücret alınmaz. Bitişten 3 gün önce e-postayla hatırlatırız. İstediğin an iptal edebilirsin."
  - Cayma hakkı onay kutusu (§6).
  - 390 px'te paketler alt alta kart, 3 Ay en üstte.
  - `?donus=` korunuyor.
- **Sayaçlar** (ücretsiz kullanıcı):
  - Analiz ekranında "Bu ay 3/5 analiz · 1 Kasım'da yenilenir".
  - Uyarla düğmesinin yanında bu ayki uyarlama durumu.
  - Kota bitince yerinde kısa kart ve "7 gün ücretsiz dene" (`/plans?donus=…`).
- **Kilitli özellikler:** Mülakat hazırlığı, pratik ve form yanıtları gizlenmiyor; tek cümlelik açıklama ve "7 gün ücretsiz dene" kartı. LinkedIn'deki kilitli yazım kartı aynı, yalnızca metni değişiyor.
- **Deneme şeridi:** Uygulama kabuğunun üstünde "Deneme: 5 gün kaldı · 3 Kasım'da 599 ₺ çekilecek · Yönet". Son 2 günde vurgulu. İptal edilmişse "Deneme 3 Kasım'da bitiyor, ücret çekilmeyecek".
- **Hesabım:** Paket, durum (deneme, aktif, iptal edildi, ödeme alınamadı), sonraki ödeme tarihi ve tutarı, "Aboneliği yönet". Ödeme alınamadıysa "Kartını güncelle". Ücretsizde bu ayki kota ve "Paketleri gör".
- **`/plans/thanks`:** Abonelik görünene kadar yoklama (bugünkü gibi, 60 sn). Metin "Denemen başladı; 7 gün boyunca her şey açık" ya da "Aboneliğin başladı".
- Ekran metni Türkçe; yüzde ve kalan süre yalnızca gerçek veriden (deneme bitişi Polar'dan).

## 6. Yasal metinler

- **`/terms`:** Abonelik maddesi: otomatik yenileme, yenileme tutarı ve dönemi; Hesabım'dan her an ücretsiz iptal (6502 md. 51); iptalde erişimin dönem sonuna kadar sürmesi; 7 günlük deneme ve hatırlatma.
- **`/refund`:** Deneme bitmeden iptalde ücret yok. İade Polar üzerinden; iade edilen abonelik erişimi kapatıyor.
- **Cayma hakkı onayı** (Mesafeli Sözleşmeler Yönetmeliği md. 15): "Erişimin hemen (denemede deneme sonunda ücretli olarak) başlamasını ve bu nedenle cayma hakkımı kaybedeceğimi kabul ediyorum." Kutu işaretlenmeden ödeme sayfasına gidilmiyor.
- **Gizlilik:** Polar ödeme ve abonelik işleyeni (mevcut madde); abonelik durumunun tutulduğu yazılıyor.
- **Hukuk incelemesi:** Metinler taslak. Yayından önce bir hukukçu ya da mali müşavir bakmalı (DOG-34'teki not geçerli; kurucunun sorumluluğunda).

## 7. Hata durumları

| Durum | Davranış |
|---|---|
| Ücretsiz kota bitti | 402 `analysis_quota` / `adaptation_quota` → paket ekranı, kaldığı yere dönüş |
| Abonelik gerektiren özellik | 402 `subscription_required` → kilitli kart, paket ekranı |
| Abone, 24 saatte 30 uyarlama | 402 `daily_cap` (bugünkü metin) |
| Bildirim gecikti | Teşekkür sayfası 60 sn yokluyor; sonra "Ödemen alındıysa birkaç dakika içinde açılır" ve destek e-postası |
| Bildirimler sırasız geldi | `modifiedAt` eskiyse yok sayılıyor |
| Aynı bildirim iki kez | Ekle-ya da-güncelle; ikincisi değişiklik yapmıyor |
| Webhook imzası geçersiz | 403, hiçbir şey yazılmıyor |
| Kart reddedildi (`past_due`) | Erişim dönem sonuna kadar; Hesabım'da "Kartını güncelle" |
| İade (`revoked`) | Erişim hemen kapanıyor |
| Aktif abone yeniden abone olmak istiyor | Portal açılıyor |
| Hesap silindi | Polar'da abonelik iptal, satırlar siliniyor; Polar'a ulaşılamazsa uyarı ve elle iptal |
| Polar'a ulaşılamıyor (checkout, portal) | "Ödeme sayfasını açamadık, birazdan tekrar dene" |

## 8. Yapılandırma

| Değişken | Not |
|---|---|
| `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `POLAR_SERVER` | Mevcut |
| `POLAR_PRODUCT_MONTH`, `POLAR_PRODUCT_QUARTER` | Artık **abonelik** ürünlerinin kimlikleri; boş olan paket gösterilmiyor |
| `POLAR_PRODUCT_WEEK` | Kalkıyor |
| `PLAN_PRICES_TRY` | `month:299, quarter:599` (gösterim; çekilen tutar Polar'da) |

Polar'da: iki abonelik ürünü; ikisinde 7 günlük deneme (`trial_interval: day`, `trial_interval_count: 7`); kuruluş ayarlarında tekrar deneme engeli açık; webhook olayları `subscription.*`.

## 9. Test

- **Saf mantık:**
  - `hasAccess`: her durum için ve dönem sınırında.
  - `trialEligible`.
  - `monthStart`: İstanbul gece yarısı ve ay sonu.
  - `decide`: her özellik ve kod için; yönetici dahil.
- **Bildirim işleyicisi:** Ekle-ya da-güncelle, sırasız bildirim, kullanıcı yok, bilinmeyen durum (entegrasyon testi, gerçek veritabanı).
- **Kapılar:** Her uçta kota ve abonelik reddi. İki sekmeden aynı anda gelen ücretsiz uyarlama yalnızca bir hak açıyor (entegrasyon).
- **Polar sağlayıcısı:** Olay ayrıştırma (örnek yükler), imza.
- **Hesap silme ve dışa aktarma:** `Subscription` kapsamda; silmede Polar iptali çağrılıyor.
- **Arayüz:**
  - Tablo, sayaçlar, kilitli kartlar ve deneme şeridi (render testleri; yüzde ve uydurma süre yok).
  - 1440 ve 390 px, açık ve koyu temada elle deneniyor.
- **Polar sandbox'ında uçtan uca:** deneme başlat → her şey açık → iptal → şerit "ücret çekilmeyecek" → denemeyi "End trial" ile bitir → `active` → iade → `revoked`, erişim kapalı.

## 10. Teslim ve geçiş

**Teslim** (her biri test dalına ayrı PR):
1. **Erişim kuralı ve kotalar:** `Subscription` (ekleyen göç), `hasAccess`, `decide`, kotalar, bütün kapılar, hesap silme ve dışa aktarma.
2. **Polar aboneliği:** checkout, portal, bildirimler, hesap silinince iptal; sandbox'ta uçtan uca.
3. **Arayüz:** `/plans` tablosu, sayaçlar, kilitli kartlar, deneme şeridi, Hesabım, teşekkür sayfası.
4. **Metinler ve temizlik:** koşullar, iade, gizlilik, cayma onayı; haftalık paket, tek seferlik dönem kodu ve DOG-129 dönem bitiş e-postası kaldırılıyor.

**Canlıya geçiş:**
1. `Subscription`'ı ekleyen göç üretimde, kod main'e girmeden önce (yalnızca ekleme).
2. Kod main'e; Vercel ve Railway dağıtımı commit kimliğiyle doğrulanıyor.
3. `AccessPass`'i silen göç (tablo boş).
4. Polar üretimi (DOG-76, kurucu): hesap doğrulaması, iki abonelik ürünü ve deneme, tekrar deneme engeli, bildirim adresi.
5. Vercel değişkenleri (`POLAR_SERVER=production`, ürün kimlikleri, `PLAN_PRICES_TRY`); `POLAR_PRODUCT_WEEK` siliniyor.
6. Kurucu gerçek kartla denemeyi başlatıp iptal ediyor: ücret çekilmiyor, erişim deneme sonuna kadar açık.
