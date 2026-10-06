# Onboarding ve CV Kütüphanesi · Tasarım Belgesi

**Tarih:** 6 Ekim 2026 · **Linear:** DOG-50 (alt işleri aşağıda)
**İlgili:** DOG-41 (react-hook-form + zod düzeni), Sprint 3A kimlik tasarımı (K-35 sahiplik kuralı)

---

## 1. Amaç

Kayıtlı kullanıcıyı "tam kullanıcı" yapmak: adını, amacını ve hedef rolünü
öğrenmek, CV'sini bir kez yükleyip her ilanda seçebilmesini sağlamak.

Bugün her analizde CV yeniden yükleniyor ve navbar'da e-posta görünüyor.

### Kullanıcının söyledikleri

- Girişten sonra yeni kullanıcı kısa bir onboarding'den geçsin: ad, amaç.
- Kendi CV'sini yüklemek isterse yüklesin; her ilana yeniden yüklemesin, kayıtlılardan seçsin.
- Ad selamlamada ve navbar'da (e-posta yerine) kullanılsın.
- Amaç ileride uyarlamayı yönlendirmek ve hedef rol için de kullanılacak.
- Mevcut kayıtlı kullanıcılar da onboarding'i bir kez görsün.

### Kapsam dışı

- **Amacın uyarlamaya etkisi.** Prompt değişikliği eval ile ölçülmeden yayına girmez; ayrı iş (DOG-50'ye ilişkili).
- **Kayıtlı CV'nin profilini yeniden kullanmak** (LLM ayrıştırmayı atlamak). Eval davranışını etkileyebilir; ayrı iyileştirme.

## 2. Veri modeli

`User`:

| Alan | Tip | Not |
|---|---|---|
| `onboardedAt` | `DateTime?` | Tamamlanınca ya da atlanınca dolar. Boşsa onboarding gösterilir. |
| `goal` | `Goal?` | `career_change`, `first_job`, `promotion`, `exploring`. İsteğe bağlı. |
| `targetRole` | `String?` | En fazla 80 karakter, isteğe bağlı. |
| `name` | (mevcut) | E-posta girişinde boş, sosyal girişte dolu. Onboarding önceden doldurur. |

`Resume`:

| Alan | Tip | Not |
|---|---|---|
| `label` | `String?` | Kütüphanedeki ad; boşsa dosya adı gösterilir. En fazla 60 karakter. |
| `savedAt` | `DateTime?` | Doluysa kütüphanede. Kaldırma yalnızca bunu temizler; eski analizler bozulmaz. |
| `isDefault` | `Boolean @default(false)` | Kullanıcı başına en fazla bir; sunucu transaction'da korur. |

**Kurallar**

- Kütüphanede en fazla 5 CV olur.
- Kütüphane yalnızca kayıtlı kullanıcılara açık.
- Varsayılan CV kaldırılırsa en yeni kayıtlı CV varsayılan olur; kayıtlı CV kalmadıysa varsayılan da kalmaz.
- İlk kaydedilen CV kendiliğinden varsayılan olur.
- Hesap silme zaten tüm `Resume` kayıtlarını ve R2 dosyalarını siliyor; ek iş gerekmez.
- Migration yalnızca boş bırakılabilir ya da varsayılan değerli alan ekliyor, veri taşıma yok. Prod'a `prisma migrate deploy` ile uygulanır.

## 3. Onboarding

### Kapı (giriş dönüşü)

- Giriş bağlantısının ve sosyal girişin `callbackURL`'i `/onboarding?donus=<asıl hedef>` olur.
- `/onboarding` sunucu bileşeni şu kontrolleri yapar:
  - Oturum yoksa `/login`'e gönderir.
  - Kullanıcı anonimse ya da `onboardedAt` doluysa, ekranı göstermeden `donus` adresine gönderir. Adres `safeReturnPath` ile doğrulanır.
  - Bunlar dışındaki durumda onboarding ekranını çizer.
- **Zaten girişli olanlar:** `(app)` layout sunucuda `needsOnboarding` bilgisini hesaplar. Bir istemci bileşeni, gerekiyorsa kullanıcıyı mevcut adresle bir kez `/onboarding?donus=...`'e `router.replace` ile yönlendirir. `/onboarding` bu kontrolün dışında tutulur.
- `needsOnboarding(user)` saf bir fonksiyon ve testli: kayıtlı kullanıcı **ve** `onboardedAt` boş.

### Ekran

Odaklı layout'ta üç adım; üstte ilerleme göstergesi ("1/3"):

1. **Adın:** "Sana nasıl hitap edelim?" Zorunlu, 1-60 karakter.
2. **Hedefin:** Dört amaç kartından biri ve serbest metin olarak hedef rol. İkisi de isteğe bağlı.
3. **CV'n:** Mevcut `ResumeUpload` bileşeni ve etiket alanı. İsteğe bağlı; "Sonra eklerim" seçeneği var. Yüklenen CV kütüphaneye varsayılan olarak girer.

Her adımda "Şimdilik geç" seçeneği var.

**Bitiş:** Son adımda ya da "Şimdilik geç"e basılınca:
- O ana kadar girilenler kaydedilir.
- `onboardedAt` doldurulur.
- Kullanıcı `donus` adresine yönlendirilir. Örneğin `/analyze?uyarla=…` ise uyarlama kaldığı yerden başlar.

Formlar react-hook-form ile çalışır. Zod şemaları `features/onboarding/schema.ts` ve `features/resumes/schema.ts` dosyalarında; aynı şemalar API'de de kullanılır.

## 4. API

Bu bölümdeki bütün uçlar kayıtlı kullanıcı istiyor (`ensureRegistered`). Kaynak sahiplik ihlalinde 404 döner (K-35).

| Uç | İş |
|---|---|
| `PATCH /api/profile` | `name`, `goal`, `targetRole`, `completeOnboarding`; hepsi isteğe bağlı |
| `GET /api/resumes` | Kütüphane listesi: id, etiket, dosya adı, tarih, varsayılan mı |
| `POST /api/resumes` | Çok parçalı istek: `cv` ve isteğe bağlı `label`. Doluysa 400 `library_full` |
| `PATCH /api/resumes/[id]` | `label`, `isDefault: true` |
| `DELETE /api/resumes/[id]` | Kütüphaneden kaldırır (`savedAt = null`), varsayılanı devreder |
| `POST /api/analyze` (değişiyor) | `resumeId` **ya da** `cv`; `cv` ile birlikte isteğe bağlı `saveToLibrary` |

**`POST /api/analyze` ayrıntıları**

- `resumeId` ile gelen istek:
  - Yalnızca kayıtlı kullanıcı için geçerli.
  - CV kullanıcıya ait olmalı ve `savedAt` dolu olmalı; değilse 404.
  - Sunucu yeni `Resume` açmaz, aynı kaydı kuyruğa verir. Worker `rawText` önbelleğini kullandığı için CV metni dosyadan yeniden çıkarılmaz.
- `saveToLibrary` ile gelen istek:
  - Yeni `Resume` kaydı `savedAt` ile açılır.
  - Kütüphane doluysa CV kaydedilmez ama analiz yine başlar. Yanıtta `savedToLibrary: false` döner; arayüz bunu not olarak gösterir.

Kütüphane kuralları (sınır, varsayılan devri) `server/resumeLibrary.ts`'te toplanır ve testli olur. Route'lar bu modülü çağırır.

## 5. Arayüz

- **Analiz formu, "1. CV'n" adımı**
  - Kayıtlı kullanıcının kütüphanesi doluysa CV'ler seçilebilir kartlar olarak görünür, varsayılan seçili gelir. Altında "Yeni dosya yükle" seçeneği var.
  - Yeni dosya seçilirse "Kütüphaneme kaydet" kutusu çıkar. Kütüphane doluysa kutu yerine kısa bir not görünür.
  - Anonim kullanıcıda ya da kütüphane boşsa bugünkü yükleme alanı kalır; kayıtlı kullanıcıda kaydet kutusu yine görünür.
  - Şema `resumeId` ile `cv`'den tam birini ister.
- **Hesabım sayfası (`/account`)**
  - "Profilin" bölümü: ad, amaç ve hedef rol düzenlenebilir.
  - "CV'lerim" bölümü: listeleme, yeniden adlandırma, varsayılan yapma, kaldırma (onaylı) ve "CV ekle". 5 CV dolunca "CV ekle" devre dışı kalır ve nedenini söyler.
- **Navbar**
  - `AccountMenu` ad varsa adı, yoksa e-postayı gösterir.
  - Menünün içinde e-posta küçük yazıyla durur.
  - `displayName(user)` saf bir fonksiyon ve testli.
- **Pano**
  - Ad varsa "Merhaba <ad>", yoksa bugünkü başlık görünür.
  - Hedef rol varsa altında "Hedefin: <rol>" satırı çıkar.
- **Veri kaynağı:** Sunucu bileşenleri profil bilgisini `server/profile.ts` → `getProfile(userId)` ile tek sorguda okur. Better Auth oturumuna ek alan eklenmez.

## 6. Hata durumları

- **Kütüphane dolu:** `POST /api/resumes` 400 döner: "En fazla 5 CV kaydedebilirsin. Birini kaldırıp tekrar dener misin?" Analizde ise kayıt yapılmaz, analiz yine başlar.
- **Silinmiş ya da başkasına ait `resumeId`:** 404. Analiz formu "Bu CV artık kütüphanende değil" der ve listeyi yeniler.
- **Onboarding kaydı başarısız olursa:** Hata gösterilir ve kullanıcı aynı adımda kalır. "Şimdilik geç" yine çalışır; ağ hatasında bile kullanıcı yönlendirilir, onboarding de bir sonraki açılışta yeniden çıkar.
- **Geçersiz `donus`:** `safeReturnPath` varsayılan adrese (`/analyze`) düşer.

## 7. Testler

- **Birim:**
  - `needsOnboarding`,
  - `displayName`,
  - kütüphane kuralları (sınır, ilk CV varsayılan, varsayılan devri),
  - analiz şeması (`resumeId` ile `cv`'den tam biri),
  - onboarding ve profil şemaları.
- **Tümleşik (Postgres):**
  - kayıtlı CV ile analiz yeni `Resume` açmıyor,
  - başkasının `resumeId`'si 404 dönüyor,
  - kütüphaneden kaldırmak eski analizleri bozmuyor,
  - hesap silme kütüphaneyi de siliyor,
  - tek varsayılan kuralı transaction altında korunuyor.
- **Uçtan uca:** Yerelde HTTP ile denenecek. Tarayıcıyla tıklayarak deneme Chrome gerektiriyor (makinede yok); kullanıcıya bırakılır.

## 8. İş bölümü (Linear, DOG-50 alt işleri)

Her alt iş ayrı PR olacak. Sıra önemli; her iş bir öncekine bağlı.

1. **Veri modeli ve API:** migration, `server/resumeLibrary.ts`, `server/profile.ts`, profil ve kütüphane uçları, `POST /api/analyze`'da `resumeId` ve `saveToLibrary`.
2. **Onboarding:** `/onboarding` ekranı, giriş dönüşündeki kapı, `(app)` layout'taki yönlendirme.
3. **Kütüphane arayüzü:** hesabım sayfasında Profilin ve CV'lerim, analiz formunda CV seçimi ve "Kütüphaneme kaydet".
4. **Kişiselleştirme:** navbar ve pano selamlaması.

DOG-41'in (PR 67) önce merge edilmesi gerekiyor; formlar o düzene dayanıyor.
