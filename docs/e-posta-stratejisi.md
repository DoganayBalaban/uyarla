# E-posta stratejisi

19 Ekim 2026. Taslak; kararlar kullanıcıyla verilecek.

## 1. Bugün ne gönderiyoruz

| E-posta | Ne zaman | Kimden | Kapatılabilir mi |
|---|---|---|---|
| Giriş bağlantısı | Kullanıcı e-postasını girince | `server/mail.ts`, web | Hayır (işlem) |
| Başvuru takip hatırlatması (DOG-98) | "Başvuruldu"dan 7 gün sonra aşama değişmemişse, başvuru başına bir kez; 21 günden eski başvurular hariç | `server/applicationReminders.ts`, Railway cron | Evet, Hesabım'dan |
| Ödeme makbuzu | Ödeme alınınca | Polar (bizim değil) | — |

Anonim kullanıcıya hiçbir şey gitmiyor; e-postası yer tutucu.

### Bu incelemede bulunan sorunlar

1. **Hatırlatmalar sabah 06:00'da gidiyor.** Cron `0 3 * * *` UTC; Türkiye saatiyle 06:00. Temizlikle aynı işte çalışıyor.
2. **Cron servisi hatırlatma kodu değişince güncellenmiyor.** Railway'deki `anonim-temizlik` servisinin izlediği yollar yalnızca temizlik dosyalarını, `packages/core` ve `packages/db`'yi kapsıyor. `applicationReminders.ts`, `mail.ts` ve `scripts/application-reminders.ts` listede yok. PR 143'ün bu serviste "atlanmasının" sebebi buydu. Yalnızca hatırlatma kodu değişen bir commit cron'u eski kodla bırakır.
3. **Gizlilik metni eksik.** "Resend giriş bağlantısını gönderir" yazıyor; hatırlatma e-postasından söz etmiyor.
4. **Tek tıkla abonelikten çıkış yok.** Hatırlatmanın altındaki bağlantı Hesabım'a gidiyor ve giriş istiyor. `List-Unsubscribe` başlığı da yok. Gmail ve Yahoo toplu gönderenlerden tek tıkla çıkış istiyor (RFC 8058); bizim hacmimizde zorunlu değil, ama spam şikâyetini azaltır.
5. **Yanıtlar boşa gidiyor.** Gönderen `noreply@`; hatırlatmaya "cevap geldi, ne yapayım" diye yanıt veren kullanıcıyı kimse okumuyor.
6. **DMARC raporu yok.** Kayıt `p=none` ve `rua` adresi tanımlı değil; sahte gönderim ya da DKIM bozulması görülmüyor. SPF ve DKIM gönderim alt alanında (`send.uyarla.com.tr`) doğru.

## 2. İlkeler

- **Kullanıcının işine yarayan an.** E-posta yalnızca kullanıcının başlattığı bir iş için gidiyor: başvurusu, mülakatı, erişim dönemi. "Seni özledik" yok.
- **Her e-postada tek iş, tek düğme.** Hatırlatma "panoyu aç", mülakat "hazırlığını aç".
- **Topla, sıklığı sınırla.** Aynı gün birden çok hatırlatma tek e-postada toplanıyor (bugünkü hatırlatma bunu yapıyor). İşlem dışı e-postalar kullanıcı başına günde en fazla 1, haftada en fazla 3.
- **Saat.** Hafta içi ve hafta sonu 10:00, Türkiye saati. Giriş bağlantısı gibi işlem e-postaları anında gidiyor.
- **Ton:** marka rehberi §6. Sen dili, suçlamayan ve yol gösteren bir ses. Ünlem ve aciliyet baskısı yok ("son şans!" yok).
- **Dürüstlük:** e-posta üründe olmayan bir şeyi vaat etmiyor. Örneğin "CV'n %90 uyumlu" diye bir konu satırı yazmıyoruz; skor ilana göre değişir.
- **Ölçüm davranışla.** Açılma takibi yok: KVKK açısından gereksiz bir izleme, Apple Mail de sonucunu bozuyor. Başarı, e-postadan sonra kullanıcının yaptığı şeyle ölçülüyor (bkz. §6).

## 3. Kategoriler ve hukuki çerçeve

Türk hukukunda ticari elektronik ileti 6563 sayılı Kanun ve Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik'e tabi:

- **Önceden onay gerekiyor**, onaylar İleti Yönetim Sistemi'ne (İYS) kaydediliyor.
- **Mevcut hizmetle ilgili bilgilendirme ve hatırlatma** ticari ileti sayılmıyor, onay gerektirmiyor.
- Hangi e-postanın hangi tarafa düştüğü, İYS kayıt yükümlülüğü ve olası muafiyetler **bir avukatla teyit edilmeli**. Aşağıdaki sınıflama bir öneri.

| Kategori | Örnek | Onay | Kapatılabilir | Hesabım anahtarı |
|---|---|---|---|---|
| **İşlem** | Giriş bağlantısı, ödeme onayı, hesap silindi | Gerekmez | Hayır | — |
| **Başvuru hatırlatmaları** | Takip, mülakat, son başvuru tarihi | Gerekmez (kullanıcının kendi başvurusu) | Evet | "Başvuru hatırlatmaları" (var) |
| **Erişim bilgisi** | Dönemin bitmesine 2 gün kaldı | Gerekmez görünüyor; satış etkisi var, teyit edilmeli | Evet | "Erişim dönemi bilgileri" |
| **Ürün haberleri ve öneriler** | Aylık "neler yeni", aktivasyon dürtüsü, iş önerileri | **Gerekir** (açık onay ve İYS) | Evet | "Ürün haberleri", varsayılan **kapalı** |

KVKK açısından işlem ve hatırlatma e-postaları sözleşmenin ifası kapsamında. Ürün haberleri açık rızaya dayanıyor: onayın zamanı, kaynağı ve onay metninin sürümü saklanmalı.

## 4. E-posta kataloğu

Öncelik, kullanıcıya faydası ve iş yüküne göre.

### Faz 0: hijyen (küçük, hemen)

- **Cron saati 07:00 UTC (10:00 TR).** E-posta işi temizlikten ayrı bir komut olarak çalışmalı (`emails:daily`); temizlik gece kalabilir.
- **Watch patterns.** Cron servisinin izlediği yollara e-posta kodu eklenecek (`apps/web/src/server/**`, `apps/web/scripts/**`). Bu Railway ayarı ve bir üretim değişikliği.
- **Tek tıkla çıkış.** İmzalı, giriş istemeyen bir bağlantı (`/email/unsubscribe?t=…`, kullanıcı ve kategori HMAC ile imzalı). Yanında `List-Unsubscribe` ve `List-Unsubscribe-Post` başlıkları.
- **Reply-To:** hatırlatmalarda destek adresi. Yanıt Gmail'e düşsün.
- **Gizlilik metni.** Gönderilen e-postalar ve kategorileri yazılacak.
- **DMARC.** `rua` raporu (Cloudflare DMARC Management ücretsiz). Birkaç hafta temiz rapordan sonra `p=quarantine`.

### Faz 1: mülakat hatırlatması (veri hazır)

`Analysis.interviewAt` panoda zaten tutuluyor.

- **Ne zaman:** mülakattan bir gün önce, 10:00. Mülakat aynı gün ya da geçmişse gönderilmiyor.
- **İçerik:** "Yarın Acme'de mülakatın var." Uyarladığın CV, ön yazı ve ilan tek tıkla açılıyor. DOG-118 (mülakat hazırlığı) gelince hazırlık paketine bağlanacak.
- **Kategori:** başvuru hatırlatmaları.
- **Altyapı:** `EmailLog` tablosu (`userId`, `kind`, `refId`, `sentAt`, `providerId`). Aynı e-postanın iki kez gitmemesi ve sıklık sınırı için. Bugünkü `reminderSentAt` gibi özellik başına alanların yerini zamanla alır. Veritabanı göçü gerekir.

### Faz 2: işlem e-postaları

- **Hesap silindi:** silmeden hemen önce, "verilerin silindi; Polar'daki fatura kaydı yasal süre boyunca kalır" bilgisiyle. KVKK güveni için. E-posta adresi silindiği için gönderim silmeden önce yapılmalı.
- **Erişimin açıldı:** ödeme bildirimi işlenince, dönemin bitiş tarihiyle ve kaldığı yere dönüş bağlantısıyla. Polar'ın makbuzu ayrı geliyor; bizimki ürünün dilinde.
- **Dönemin bitmesine 2 gün kaldı:** yalnızca dönem içinde en az bir uyarlama yapmış kullanıcıya, bir kez. Otomatik yenileme olmadığı için bilgilendirme; satış dili kullanılmayacak. Kategori: erişim bilgisi.

### Faz 3: süreç e-postaları (ilgili özellikle birlikte)

- **Son başvuru tarihi (DOG-120):** uyarlanmış ama "başvuruldu"ya alınmamış ilan için tarihten 2 gün önce.
- **Teşekkür notu (DOG-117):** mülakatın ertesi günü, "teşekkür mesajı taslağın hazır". Aynı gün mülakat hatırlatmasıyla çakışırsa tek e-postada toplanıyor.

### Faz 4: onay ve İYS'den sonra

- **Aktivasyon:** kayıt olup CV yükleyen ama 2 gün içinde analiz yapmayan kullanıcıya bir kez, "örnek bir ilanla dene". Ücretsiz uyarlamasını kullanmayana bir kez.
- **Aylık ürün haberleri:** yalnızca anlamlı bir değişiklik varsa.
- **İş önerileri:** `jobSuggest` denemesi (DOG-67) ürüne girerse. Kaynakların kullanım koşulları ayrıca bakılmalı (Careerjet kullanıcı IP'si istiyor).

### Bilinçli olarak yok

- Hoş geldin e-postası: giriş bağlantısıyla gelen kullanıcı zaten üründe; ikinci bir e-posta gürültü.
- "Uyarlaman hazır": uyarlama bir dakika sürüyor ve kullanıcı ekranın başında.
- "Seni özledik", haftalık özet, indirim duyurusu.

## 5. Hesabım'daki tercihler

Bugün tek bir anahtar var (`User.applicationReminders`). Önerilen:

| Anahtar | Varsayılan | Not |
|---|---|---|
| Başvuru hatırlatmaları | Açık | Takip, mülakat, son tarih |
| Erişim dönemi bilgileri | Açık | Yalnızca paket alanlarda görünür |
| Ürün haberleri | **Kapalı** | Açılınca onay zamanı, kaynağı ve metin sürümü kaydedilir; İYS'ye bildirilir |

İşlem e-postaları anahtar olmadan gidiyor; listede yazılı olarak gösteriliyor ki kullanıcı neyin neden geldiğini bilsin.

## 6. Ölçüm

- **Teslim:** Resend webhook'ları (delivered, bounced, complained). Geri dönen ya da şikâyet edilen adrese işlem dışı e-posta gönderilmiyor (bastırma listesi).
- **Etki, davranışla ölçülüyor:**
  - Takip hatırlatması: 3 gün içinde aşaması güncellenen başvuru oranı.
  - Mülakat hatırlatması: mülakattan önce uyarlama ya da ön yazının açılma oranı.
- **Hedef sinyaller:** şikâyet oranı < %0,1 (Gmail eşiği %0,3), çıkış oranı < %2.
- **Tıklama ölçümü için not:** Vercel Analytics adresin sorgu kısmını bilerek atıyor (DOG-111, `stripQuery`). E-posta bağlantılarına UTM eklemek işe yaramaz; tıklama gerekiyorsa yol tabanlı bir işaret ya da sunucu tarafı sayaç gerekir.

## 7. Teknik düzen

- **Tek modül.** E-postalar `apps/web/src/server/email/` altında toplanacak. Her biri bir şablon fonksiyonu (konu, HTML, düz metin) ve bir seçici (kime, ne zaman). `emailShell` ve `emailButton` ortak kalıyor.
- **Tek günlük iş.** Railway cron 07:00 UTC'de `emails:daily` komutunu çalıştırıyor. Her tür için seçici çalışıyor; sonuçlar kullanıcı başına birleştiriliyor; sıklık sınırı uygulanıyor; `EmailLog`'a yazılıyor.
- **Test.** Şablonlar birim testli (bugünkü `reminderEmail` gibi). Seçiciler entegrasyon testli. `--dry-run` ile kime ne gideceği gönderilmeden listeleniyor (bugünkü betikte var).

## 8. Kararını bekleyenler

1. **Ürün haberleri ve aktivasyon e-postaları istiyor muyuz?** İstiyorsak İYS kaydı ve onay akışı gerekiyor; istemiyorsak Faz 4 düşer, gerisi onaysız yürür.
2. **"Dönemin bitmesine 2 gün kaldı" e-postası.** Kullanıcıya faydalı mı, satış baskısı gibi mi durur?
3. **Gönderim saati.** 10:00 uygun mu?
4. **Faz 0'daki Railway ayarları:** cron saati ve izlenen yollar üretim değişikliği. Ben mi yapayım, sen mi?
