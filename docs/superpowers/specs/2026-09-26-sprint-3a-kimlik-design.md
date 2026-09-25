# Sprint 3A — Kimlik, Huni ve Sahiplik · Tasarım Belgesi

**Tarih:** 26 Eylül 2026 · **Kapsam:** Faz 1 / Sprint 3'ün K2'den bağımsız yarısı
**İlgili belgeler:** `docs/kararlar.md`, yol haritası §6.3, marka rehberi §6 ve §11, planlama raporu §5.3

---

## 1. Amaç

Ürüne kimlik kazandırmak ve kaynakları sahibine bağlamak — ödeme tasarımını
beklemeden.

Yol haritası Sprint 3'ü tek parça planlamıştı (hesap + ödeme + pano, 32 saat).
İkiye bölündü. Bu belge **K2'den bağımsız** yarıyı tanımlıyor: kimlik
doğrulama, kayıtsız→kayıtlı huni, sahiplik ve hız limiti.

### Neden bölündü

Yol haritası K2'yi Sprint 3'ün önüne koyuyor ve kriter tutmazsa "ödeme işini
bir hafta ertele" diyor. K2 henüz geçilmedi: beş kişilik kullanılabilirlik
testi yapılmadı. Üstelik Görev 14'ün ölçümü (K-32) ödeme duvarının
dayandığı vaadi sarstı — dürüst skor kazancı sıfır çıktı. "Neye para
ödeniyor" sorusu cevaplanmadan plan, kota ve fiyatlandırma tasarlamak,
kullanıcının istemediği bir şeye ödeme duvarı koymak olurdu.

Kimlik katmanı ise her senaryoda gerekli. Bu yarı beklemeden ilerleyebilir.

## 2. Kapsam

### Dahil

- Better Auth ile magic link girişi
- Anonim oturum ve kayıt anında işin devralınması
- Sahiplik zinciri: `Analysis` ve `JobPosting` için `userId`
- Tek noktadan yetkilendirme
- Kimlik uçlarında ve pahalı uçlarda hız limiti
- Giriş ekranı ve oturum durumunu gösteren arayüz

### Hariç — açıkça

Plan ve kota mantığı · iyzico ödeme · fatura ve iptal · başvuru panosu ·
Google ile giriş (kod sağlayıcı eklenebilir yazılır, kimlik bilgileri
gelince açılır) · hesap silme (KVKK) · parola ile giriş

### Yol haritasından sapma

Yol haritası "e-posta (magic link) **+ Google ile giriş**" diyor. Google bu
yarıda yapılmıyor: Google Cloud Console'da OAuth istemcisi oluşturulması
gerekiyor ve bu kullanıcının işi. Kod tarafı sağlayıcı eklenebilir yazılıyor;
kimlik bilgileri geldiğinde tek yapılandırma bloğuyla açılır.

## 3. Görevler ve tahminler

| # | Görev | Çıktı | Süre |
|---|---|---|---|
| 1 | Şema: CLI ile üretim, sahiplik alanları, göç | Prisma şeması | 3 sa |
| 2 | Kimlik katmanı ve magic link | `lib/auth.ts`, route | 4 sa |
| 3 | Sahiplik alanları ve yetkilendirme yardımcısı | `lib/authz.ts` | 3 sa |
| 4 | Route'lara yetki kontrolü | Korunan uçlar | 2 sa |
| 5 | Anonim oturum ve devralma | `onLinkAccount` | 3 sa |
| 6 | Hız limiti | `lib/rateLimit.ts` | 2 sa |
| 7 | Giriş ekranı ve oturum arayüzü | Arayüz | 3 sa |
| | | **Toplam** | **20 sa** |

Bağımlılık sırası: `1 → 2 → 3 → 4 → 5 → 6 → 7`. Sıra doğrusal çünkü her görev
bir öncekinin kurduğu yüzeye dayanıyor.

## 4. Mimari

Better Auth `apps/web/lib/auth.ts`'te yapılandırılıyor. `packages/core`
framework'süz kalmaya devam ediyor (Sprint 1'den beri geçerli kural):
kimlik, HTTP katmanının işi ve alan mantığı onu bilmiyor.

```
apps/web
  lib/auth.ts          Better Auth yapılandırması
  lib/authClient.ts    istemci tarafı (React)
  lib/authz.ts         yetkilendirme yardımcıları
  lib/rateLimit.ts     Redis tabanlı sayaç
  app/api/auth/[...all]/route.ts   kütüphanenin uçları
  app/giris/page.tsx   giriş ekranı
```

Worker kimlik bilmiyor ve bilmemeli: kuyruğa yalnızca kayıt kimlikleri
giriyor, yetki kontrolü işi kuyruğa koyan route'ta yapılıyor.

## 5. Veri modeli

Better Auth dört model bekliyor: `User`, `Session`, `Account`, `Verification`.
Mevcut `User` genişliyor, üçü yeni.

**Şema elle yazılmıyor, üretiliyor.** `npx @better-auth/cli generate` yüklü
sürüme ve etkin eklentilere göre doğru Prisma şemasını çıkarıyor. Alan adları
sürümler arasında değişiyor (`Account`'ta `issuer` mi `providerId` mi gibi) ve
elle yazılan bir şema göçü baştan bozar.

Aşağıdaki şema **beklenen sonucu** gösteriyor; çelişki çıkarsa CLI'ın ürettiği
doğrudur ve bu belge ona göre güncellenir.

```prisma
model User {
  id            String    @id @default(cuid())
  name          String
  email         String    @unique
  emailVerified Boolean   @default(false)
  image         String?
  /// anonymous eklentisi: kayıtsız oturumlar bu bayrakla işaretli.
  isAnonymous   Boolean   @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  sessions     Session[]
  accounts     Account[]
  resumes      Resume[]
  analyses     Analysis[]
  jobPostings  JobPosting[]
}

model Session {
  id        String   @id @default(cuid())
  token     String   @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Account {
  id                    String    @id @default(cuid())
  accountId             String
  providerId            String
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@unique([providerId, accountId])
}

model Verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

Sahiplik alanları:

```prisma
model Analysis {
  userId String
  user   User   @relation(fields: [userId], references: [id])
  // …mevcut alanlar
  @@index([userId])
}

model JobPosting {
  userId String
  user   User   @relation(fields: [userId], references: [id])
  // …mevcut alanlar
  @@index([userId])
}
```

**Neden `Analysis`'e ayrı alan:** Zincirden türetmek çalışmıyor.
`Analysis.resumeVersionId` nullable — çıkarım patlayan analizler
`ResumeVersion` üretmiyor ve sahipsiz kalırdı. Ayrıca yetki kontrolü tek
indeksli karşılaştırmaya iniyor, join gerekmiyor.

**Neden `JobPosting`'e:** Kullanıcının yapıştırdığı metni tutuyor ve marka
rehberi "istediğin an silebilirsin" diyor. Sahipsiz satır bırakmak o sözü
tutulamaz kılar.

**Neden `Adaptation`'a değil:** `analysisId` zaten benzersiz ve
`loadAdaptation` analizi zaten `include` ediyor. Kontrol `adaptation.analysis.userId`
ile bedava geliyor; alan eklemek veriyi iki yerde tutmak olurdu.

### Göç: geliştirme verisi siliniyor

`User.name` zorunlu bir alan ve elimizdeki tek kullanıcı (`test@uyarla.local`)
adsız. Ona bağlı tüm `Resume`, `Analysis`, `Adaptation` kayıtları Sprint 1–2
test artığı.

Göç bu veriyi siliyor. Alternatif — mevcut kullanıcıya `name = "Test"` verip
korumak — göçe kalıcı bir özel durum yazdırırdı ve korunan şey tek sahte
kullanıcıya ait test verisi. Üretimde henüz kullanıcı yok.

## 6. Kimlik doğrulama

### Magic link

Tek yöntem. Kullanıcı e-postasını girer, bağlantı gelir, tıklar, girer.
Parola yok: unutulacak bir şey yok, sızacak bir şey yok ve tek kullanımlık
CV uyarlaması için parola kurmak gereksiz sürtünme.

Bağlantı süresi 15 dakika, tek kullanımlık.

### E-posta gönderimi

Üretimde Resend. Geliştirmede `RESEND_API_KEY` tanımlı değilse bağlantı
terminale yazılıyor ve e-posta gönderilmiyor — hesap açmadan da geliştirme
yapılabilsin diye. Bu bir hata durumu değil, bilinçli bir geliştirme modu ve
başlangıçta konsola açıkça bildiriliyor.

### Google — sonraya

`socialProviders` bloğu kodda yerinde duruyor ama boş. Kimlik bilgileri
`.env`'ye eklendiğinde açılıyor. Arayüzde Google butonu, sağlayıcı
yapılandırılmamışsa hiç görünmüyor.

## 7. Huni: kayıtsız skor → kayıt → uyarlama

```
ziyaretçi
   │ CV yükle + ilan yapıştır
   ▼
anonim oturum açılır (yoksa)
   │
   ▼
analiz çalışır, SKOR GÖRÜNÜR            ← ücretsiz, kayıtsız
   │
   │ "CV'mi bu ilana uyarla"
   ▼
kayıt istenir: e-posta → magic link
   │
   ▼
onLinkAccount: Resume, Analysis, JobPosting
   anonim kullanıcıdan yeni kullanıcıya geçer
   anonim kullanıcı silinir
   │
   ▼
uyarlama başlar                          ← kayıtlı
```

**Anonim oturum nerede açılıyor:** `/api/analyze` route'unda, iş kuyruğa
girmeden önce. Sayfa yüklenince değil — her ziyaretçiye kullanıcı kaydı
açmanın anlamı yok, sadece iş üretenlere gerekiyor.

**Devralma neden kritik:** Kayıt ekranı kullanıcının zaten gördüğü skorun
üstüne geliyor. Emeğini kaybeden kullanıcı kayıt olmaz; huninin bütün
mantığı buna dayanıyor.

**Bu yarıda kota yok.** "İlk ücretsiz uyarlama" burada şu demek: kayıtsız
skor görür, kayıtlı uyarlar. Sayma ve limit, plan tasarımına bağlı.

## 8. Yetkilendirme

Tek yerde, `lib/authz.ts`:

```ts
/** Oturumu okur; yoksa 401 fırlatır. */
requireSession(): Promise<Session>

/** Kaynağın sahibi oturum sahibi mi; değilse 404 fırlatır. */
requireOwner(ownerId: string): Promise<Session>
```

**Neden 404, 403 değil:** 403 kaynağın var olduğunu sızdırır. Uyarlama
kimlikleri cuid ve tahmin edilmesi zor, ama "bu kimlik geçerli ama senin
değil" bilgisini vermenin hiçbir faydası yok.

Korunan uçlar:

| Uç | Kontrol |
|---|---|
| `POST /api/analyze` | oturum (anonim yeterli) |
| `GET /api/analyze/[id]` | `analysis.userId` |
| `POST /api/adapt` | `analysis.userId` + kayıtlı olma |
| `GET /api/adapt/[id]` | `adaptation.analysis.userId` |
| `PATCH /api/adapt/[id]/decision` | aynı |
| `GET /api/adapt/[id]/download` | aynı |

`POST /api/adapt` tek istisna: yalnızca oturum değil, **kayıtlı** oturum
istiyor. Anonim kullanıcı buraya geldiğinde 401 ve kayıt çağrısı alıyor.

## 9. Hız limiti

İki ayrı katman.

**Kimlik uçları:** Better Auth'un kendi limiti. Magic link gönderimi
dakikada 3 istekle sınırlı; aksi hâlde bir e-posta adresine bağlantı yağmuru
yapılabilir.

**Pahalı uçlar:** `/api/analyze` ve `/api/adapt` her çağrıda ~60 saniyelik
LLM işi başlatıyor. Redis'te sabit pencereli sayaç — BullMQ zaten Redis
kullanıyor, yeni altyapı yok.

Anahtar kayıtlıysa `userId`, anonimse IP. Başlangıç değerleri:

| Kim | Limit |
|---|---|
| Anonim | 3 / saat |
| Kayıtlı | 10 / saat |

Bu değerler **tahmindir** ve yapılandırmada duruyor. Gerçek rakam kullanım
verisiyle ayarlanacak — Sprint 2'deki eşik taramasında olduğu gibi, karar
ölçümle verilir.

## 10. Hata yönetimi

Marka rehberi §6 tonunda: "sen" diliyle, kısa cümle, suçlamayan.

| Durum | Kod | Mesaj |
|---|---|---|
| Oturum yok | 401 | "Devam etmek için giriş yapman gerekiyor." |
| Kayıt gerekiyor (anonim) | 401 | "CV'ni uyarlamak için e-postanı bırakman yeterli." |
| Başkasının kaynağı | 404 | "Bulunamadı." |
| Limit aşıldı | 429 | "Çok hızlı gidiyoruz. Bir saat sonra tekrar dener misin?" |
| Link süresi geçmiş | 400 | "Bu bağlantının süresi dolmuş. Yenisini gönderelim mi?" |
| E-posta gönderilemedi | 500 | "Bağlantıyı gönderemedik. Birazdan tekrar dener misin?" |

## 11. Test stratejisi

**Birim testleri.** Yetkilendirme yardımcısı ve hız sayacı saf mantık; sahte
oturum ve sahte Redis ile test edilir. Hız sayacının pencere sınırındaki
davranışı ayrıca sınanır — sayaç sıfırlanmazsa kullanıcı kalıcı olarak
kilitlenir.

**Tümleşik test: devralma.** Asıl risk burada. `onLinkAccount` yanlış
çalışırsa kullanıcı emeğini kaybeder, ya da daha kötüsü, bir kullanıcının
CV'si başkasının hesabına bağlanır. Gerçek veritabanına karşı:

1. Anonim oturum açılır, CV ve analiz üretilir
2. Kayıt olunur
3. `Resume`, `Analysis`, `JobPosting` yeni kullanıcıda mı
4. Anonim kullanıcı silinmiş mi

**Tümleşik test: yetki sızıntısı.** İki kullanıcı oluşturulur, ikincisi
birincinin uyarlamasını indirmeye çalışır ve 404 almalı. Bu test olmadan
sahiplik zincirinin çalıştığını iddia edemeyiz.

## 12. Tamamlanma tanımı

- [ ] Kullanıcı e-postasıyla giriş yapabiliyor (magic link)
- [ ] Kayıtsız ziyaretçi skor alabiliyor
- [ ] Kayıt olunca CV, analiz ve ilan yeni hesaba geçiyor; anonim kullanıcı siliniyor
- [ ] Anonim kullanıcı uyarlama başlatamıyor, kayıt çağrısı alıyor
- [ ] Başkasının analizi veya uyarlaması 404 dönüyor (tümleşik testle doğrulanmış)
- [ ] Hız limiti çalışıyor ve aşıldığında 429 dönüyor
- [ ] Arayüzde oturum durumu ve çıkış görünüyor
- [ ] `RESEND_API_KEY` olmadan geliştirme yapılabiliyor (link konsola düşüyor)

## 13. Açık riskler

| Risk | Etki | Önlem |
|---|---|---|
| Devralma yanlış hesaba bağlar | **Çok yüksek** — kişisel veri sızıntısı | Tümleşik test; `onLinkAccount` içinde kimlik karşılaştırması |
| Better Auth şeması mevcut modellerle çakışır | Orta | Şema CLI ile üretiliyor, elle yazılmıyor; göç önce boş veritabanında denenir |
| Magic link e-postası spam'e düşer | Orta | Resend alan adı doğrulaması; K3'ten önce gerçek e-posta ile denenmeli |
| Anonim kullanıcı birikmesi | Düşük | İş üretmeyen ziyaretçiye kayıt açılmıyor; temizlik işi sonraki sprintte |
| Hız limiti gerçek kullanımı engeller | Düşük | Değerler yapılandırmada; ilk kullanıcı verisiyle ayarlanacak |

## 14. Kapsam kesme sırası

Gecikme olursa şu sırayla ertelenir:

1. Giriş ekranının cilası → sade form yeterli (arayüz zaten geçici)
2. Hız limiti → tek kullanıcılı geliştirmede acil değil
3. Anonim oturum ve devralma → kayıt önce istenir, huni zayıflar ama çalışır

**Asla kesilmeyecekler:** Sahiplik zinciri ve yetki kontrolü. Kimlik
doğrulaması olmadan çalışan bir ürün, bugünkü hâliyle her kullanıcının
CV'sini herkese açık tutuyor.
