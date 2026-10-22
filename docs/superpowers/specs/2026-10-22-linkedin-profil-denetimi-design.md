# LinkedIn profil denetimi: bölüm bölüm teşhis ve yeniden yazım

**Tarih:** 22 Ekim 2026 · **Durum:** Tasarım sohbette onaylandı, spec incelemede ·
**İlgili:** DOG-69 (bugünkü LinkedIn raporu), DOG-67 (kazıma yok kararı),
DOG-136 (aşamalar), K-104 (bekleme ekranları). Linear kaydı plan aşamasında açılacak.

## 1. Amaç

Kullanıcı LinkedIn profilini verir. Biz profili bölüm bölüm değerlendiririz: başlık,
hakkında, deneyimler ve açıklamaları, eğitim, sertifikalar, beceriler. Her bölüm
için nedenli bir teşhis ve LinkedIn'e doğrudan yapıştırılabilecek somut
öneriler sunarız.

Bugünkü LinkedIn raporu yalnızca seçilen ilanlara göre başlık ve hakkında
önerisi veriyor. Bu özellik onun yerini alıyor; ilan karşılaştırması
sayfada isteğe bağlı bir bölüm olarak kalıyor.

**Başarı ölçütü:** Kullanıcı her bölüm için net bir durum ve kopyalanacak
metinlerle ayrılır. Önerileri uygulayıp yeniden taradığında farkı görür.

## 2. Kararlar

| Konu | Karar | Gerekçe |
|---|---|---|
| Profil verisi nereden | **Eklenti (ana yol) + LinkedIn PDF'i (yedek).** Sunucu LinkedIn'e istek atmıyor. | "LinkedIn ile giriş" yalnızca ad, e-posta ve fotoğraf veriyor; profil verisi iş ortaklarına açık. URL'den çekmek giriş duvarına takılıyor ve kazıma yasağına giriyor (DOG-67; Proxycurl 2025'te davayla kapandı). Kullanıcı kararı. |
| Eklenti neyi okuyor | Yalnızca kullanıcının tıkladığı, **kendi** profil sayfası. Başka sayfa gezmiyor, arka planda istek atmıyor. | Kişinin kendi verisi, kendi oturumunda, kendi isteğiyle. Başkasının profili kişisel veri; işlenmiyor. |
| Fotoğraf | **İlk sürümde yok.** Eklenti fotoğrafın adresini de okumuyor. | Kullanıcı kararı. KVKK ve görsel model işi sonraya. |
| Motor | **Teşhis kodla** (kurallar, testli). **Yazım yapay zekâyla**, bölüm başına; çıktı profile karşı doğrulanıyor. | Kararlı ve ucuz teşhis ücretsiz verilebiliyor; uydurma riski düşük. Kullanıcı kararı (yaklaşım A). |
| Hedef | Profildeki hedef rol (onboarding), sayfada değiştirilebilir. İsteğe bağlı 1–3 analiz edilmiş ilan. | İlan seçmeden de çalışsın; ilanlar anahtar kelimeyi güçlendirsin. |
| Dil | Öneriler profilin dilinde (`resumeLanguage`). | LinkedIn profilleri çoğunlukla İngilizce. |
| Ücret | **Teşhis, başlık yazımı ve beceri önerileri ücretsiz** (kayıtlı kullanıcı). **Hakkında ve deneyim yazımları pakette.** Kilitli metin sunucudan hiç gönderilmiyor. | Kullanıcı kararı. Değeri gösterip ödemeye bağlıyor. |
| Yazım ne zaman üretiliyor | Herkes için, her taramada. | Maliyet rapor başına birkaç kuruş; paket alınınca yazım beklemeden açılıyor. |
| Sınır | Kullanıcı başına günde 5 tarama, ayrıca mevcut hız sınırı. | Yapay zekâ maliyetinin üst sınırı. |
| Saklama | Kullanıcı başına son 5 tarama. Hesap silme ve dışa aktarma kapsıyor. | Önce/sonra karşılaştırması için. |
| Bugünkü rapor | `/linkedin` yeni sayfaya geçiyor. `Resume.linkedinReport` artık yazılmıyor; sütun ayrı bir göçte silinecek. | İki ayrı LinkedIn özelliği olmasın. |

## 3. Veri

### 3.1 Profil yapısı

Core'da `linkedin/profileData.ts`:

```ts
interface LinkedInProfileData {
  name: string | null
  headline: string | null
  about: string | null
  experience: Array<{ title: string; company: string | null; dateRange: string | null; location: string | null; description: string | null }>
  education: Array<{ school: string; degree: string | null; dateRange: string | null; description: string | null }>
  certifications: Array<{ name: string; issuer: string | null; date: string | null }>
  skills: string[]
  languages: string[]
  /** Ana profil sayfası bölümü kısalttıysa: gösterilen ve toplam sayı. */
  truncated: Partial<Record<"experience" | "education" | "certifications" | "skills", { shown: number; total: number | null }>>
}
```

- **Eklenti yolu:** Eklenti bu yapıyı doğrudan üretiyor (yapay zekâ yok).
- **PDF yolu:** Mevcut CV okuyucusunun çıkardığı `ResumeProfile`'dan çevriliyor. Deneyim maddeleri açıklama olarak satır satır birleşiyor; `truncated` boş.
- **Tek motor:** Yapı, `toResumeProfile()` ile mevcut `ResumeProfile` biçimine deterministik olarak çevriliyor. Böylece `resumeFacts`, `headlineTitles`, `linkedinStrengths`, `resumeLanguage` ve `verifyCoverLetter` aynen kullanılıyor.

### 3.2 Tablo

```prisma
model LinkedInAudit {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  source      LinkedInAuditSource      // extension | pdf
  resumeId    String?                  // PDF yolunda kütüphanedeki CV
  profile     Json                     // LinkedInProfileData
  targetRole  String?
  analysisIds String[]                 // seçilen ilanlar (0–3)
  status      LinkedInAuditStatus      // running | done | failed
  stage       String?                  // reading | checking | writing
  report      Json?                    // teşhis (bölüm 4.2)
  rewrites    Json?                    // yazımlar (bölüm 4.3)
  createdAt   DateTime @default(now())
  @@index([userId, createdAt])
}
```

Yeni tarama açılınca kullanıcının 5'ten eski kayıtları siliniyor. Hesap silme
(`deleteAccount.ts`) ve dışa aktarma (`dataExport.ts`) bu tabloyu ekliyor.

## 4. Analiz

### 4.1 Akış

1. `POST /api/linkedin/audits` isteği geliyor. Gövdede ya `{ source: "extension", profile }` ya da `{ source: "pdf", resumeId }` var; ayrıca `targetRole?` ve `analysisIds?`. Uç sırasıyla:
   - Kayıtlı kullanıcıyı, hız sınırını ve günlük 5 tarama sınırını kontrol ediyor.
   - Eklenti verisini şemayla doğruluyor: gövde en çok 64 KB, her metin alanı en çok 3.000 karakter, en çok 30 deneyim, 15 eğitim, 50 sertifika, 100 beceri.
   - Kaydı `running` olarak açıp kuyruğa `linkedin-audit` işini ekliyor.
2. Worker aşamaları:
   - `reading`: PDF yolunda profil kütüphanedeki CV'den çevriliyor.
   - `checking`: teşhis üretiliyor.
   - `writing`: yazımlar üretiliyor.

   Aşama kayda yazılıyor (DOG-136 düzeni).
3. `GET /api/linkedin/audits` en son taramayı ve bir önceki taramanın özetini döndürüyor (önce/sonra için). **Kilitli yazımlar yanıttan çıkarılıyor.**

### 4.2 Teşhis (kodla, ücretsiz)

Her bölüm `strong` (Güçlü), `improve` (Geliştirilebilir) ya da `missing` (Eksik)
alıyor. Her kontrolün kimliği, durumu ve nedenini söyleyen bir satırı var.
Eşikler yön gösterir, LinkedIn kuralı değildir; ekranda da böyle yazıyor.

| Bölüm | Kontroller |
|---|---|
| Başlık | `headline_empty` (boş → Eksik) · `headline_default` (yalnızca mevcut rolün unvanı ya da "unvan · şirket") · `headline_target` (hedef rol ya da ilan unvanı geçmiyor; hedef yoksa atlanır) · `headline_short` (60 karakterden kısa) · `headline_keywords` (ilan seçildiyse: ortak eksik zorunlu kavramlardan hiçbiri yok) |
| Hakkında | `about_missing` (→ Eksik) · `about_short` (`ABOUT_MIN_WORDS` = 40 kelimeden az) · `about_hook` (ilk 200 karakterde hedef rol ya da profilin güçlü kavramlarından biri yok) · `about_cliche` (CV biçim kontrolündeki klişe listesi) |
| Deneyim | `experience_missing` (hiç deneyim yok → Eksik). Her rol için: `exp_description_missing` · `exp_no_measurable` (açıklamada sayı ya da ölçü yok; CV kontrolündeki kural) · `exp_dates_missing`. Bölümün durumu rollerin en kötüsü; mevcut rolün açıklaması yoksa bölüm en az Geliştirilebilir. |
| Eğitim | `education_missing` (→ Eksik) · `education_first_job` (amacı ilk iş olan kullanıcıda açıklama yoksa proje ya da ders ekleme önerisi) |
| Sertifikalar | Kontrol yok, bilgi kartı: liste ve ipucu. |
| Beceriler | `skills_few` (`SKILLS_MIN` = 5'ten az) · `skills_evidenced_missing` (hedefin ya da ilanların istediği, deneyim açıklamalarında geçen ama beceri listesinde olmayan kavramlar). **Beceri önerisi** de burada ve ücretsiz: "Ekle" listesi (kanıt cümlesiyle) ve "Öne al" listesi (hedefle ilgili olanlar başa). |
| İlanlarına göre | İlan seçildiyse bugünkü rapordaki ortak eksik kavramlar (`linkedinReport` mantığı). |

- **Bölüm durumu:** Bir `missing` kontrolü düştüyse Eksik; herhangi bir uyarı varsa Geliştirilebilir; hiçbiri yoksa Güçlü.
- **Özet:** "N kontrolden M'si geçti". Yüzde ya da kıyas yok.
- **Atlanan kontroller:** Hedef rol olmadığı için atlanan kontroller sayılmıyor. Ekranda "Hedef rolünü yazarsan başlığa da bakarız" yazıyor.

### 4.3 Yazım (yapay zekâ)

| Yazım | Erişim | Kural |
|---|---|---|
| Başlık: 3 alternatif | Ücretsiz | En fazla `HEADLINE_MAX_CHARS` (120) karakter. Profildeki unvanlar, hedef rol ve kanıtı olan kavramlarla. |
| Hakkında | Paket | `ABOUT_TARGET_WORDS` (60–200 kelime). Birinci tekil şahıs, profilin dilinde. İlk iki satır rol ve değer önerisi. |
| Her deneyimin açıklaması (en çok 8 rol) | Paket | Yalnızca o rolde ve profilde yazanlarla. Maddeli yazım; sayılar aynen korunuyor. **Açıklaması boş rolde yazım yok.** Onun yerine köşeli parantezli bir şablon var ("• [ne yaptın] ile [sonuç]"), mülakat hazırlığındaki gibi. |

- **Doğrulama:** Her yazım `verifyCoverLetter`'dan geçiyor. Dayanağı zayıf cümle `flagged` olarak, "kontrol et" uyarısıyla gösteriliyor.
- **Hata:** Yazım çağrısı düşerse teşhis yine geçerli; o bölümün yazımı `failed` oluyor ve tekrar denenebiliyor (`PATCH`, bölüm 6).

`rewrites` biçimi:

```ts
{
  headline: { status: "done"; options: LinkedInSuggestion[] } | { status: "failed" }
  about: { status: "done"; suggestion: LinkedInSuggestion } | { status: "failed" }
  experience: Array<{ index: number } & ({ status: "done"; suggestion: LinkedInSuggestion } | { status: "failed" } | { status: "template"; text: string })>
}
```

### 4.4 Ücret kapısı

`GET` yanıtında kilit kararı şöyle: kullanıcının etkin paketi var mı (`activePassEnd`), ya da admin mi?

- **Paket yoksa:** `rewrites.about` ve `rewrites.experience[].suggestion` yanıttan çıkarılıyor. Yerine `locked: { about: true, experience: <sayı> }` dönüyor.
- **Testle güvence:** Kilitli metin yanıtın hiçbir yerinde geçmiyor.
- **Paket bitince:** Metinler yeniden kilitleniyor. Kayıtta duruyorlar.

## 5. Arayüz

### 5.1 `/linkedin` sayfası

**a) Başlangıç (tarama yok):**
- **Üstte hedef:** "Hedef rolün: … · değiştir" ve isteğe bağlı "İlanlarıma göre de bak" (en çok 3 ilan).
- **İki seçenek kartı:**
  - **Eklentiyle tek tıkla (Önerilen):** Adımlar "profilini aç → eklentiye tıkla". "Profilimi aç" düğmesi `linkedin.com/in/me`'yi yeni sekmede açıyor. Eklenti yoksa (mesajla yoklanıyor) "Eklentiyi kur" çıkıyor.
  - **PDF yükle:** Kütüphaneden seçme ya da yükleme; "LinkedIn'den PDF nasıl indirilir?" açılır yardımı.

**b) Tarama sürerken:**
- K-104 bekleme çerçevesi, aşamalar okuma, kontrol, yazım.
- Sahnede LinkedIn kartına benzeyen bir kâğıt var: gerçek ad, başlık ve deneyim unvanları. Okumada tarama ışığı, kontrolde bölüm kartları sırayla işaretleniyor, yazımda imleç geziyor.

**c) Sonuç: "Profil denetimi".**
- **Profil kartı:**
  - LinkedIn'e benzeyen bir başlık (bant, baş harfli avatar, ad, şu anki başlık).
  - "N kontrolden M'si geçti" halkası ve bölüm durum çipleri.
  - "Son tarama … · Yeniden tara" ve önceki taramaya göre fark ("+3 kontrol").
  - Kısaltılmış bölüm varsa "Deneyimlerinden 5'i okundu; tamamı için PDF yükleyebilirsin".
- **Gövde:**
  - Masaüstünde solda yapışkan bölüm menüsü (durum noktalarıyla), sağda bölüm kartları.
  - Telefonda menü yatay kaydırılan çiplere dönüşüyor.
- **Bölüm kartı:**
  - Durum rozeti ve nedenli kontrol satırları.
  - "Şu anki" ve "Önerimiz" alt alta duruyor; değişen kelimeler `diffWords` ile vurgulanıyor.
  - Karakter sayacı, "Kopyala" düğmesi ("Kopyalandı, LinkedIn'de yapıştır") ve "LinkedIn'de aç" bağlantısı (`linkedin.com/in/me`).
- **Başlık:** 3 alternatif kart, her biri karakter sayısı ve kopyala düğmesiyle.
- **Deneyim:** Her rol katlanır bir satır: unvan, şirket, tarih, kontroller ve yazım ya da şablon.
- **Beceriler:** "Ekle" ve "Öne al" çipleri; üzerine gelince kanıt cümlesi.
- **Kilitli yazım:** Bulanık iskelet satırlar ve kilit simgesi. Gerçek metin yok. "Önerin hazır; paketle açılır" ve "Paketleri gör" (`/plans?donus=/linkedin`).

### 5.2 Eklenti (0.3.0)

- **Kendi profil sayfasında:** Kullanıcı `linkedin.com/in/*` sayfasında eklenti simgesine tıklıyor. İçerik betiği profili okuyor. Kendi profili olduğu, yalnızca sahibine görünen "Profil bölümü ekle" / "Add profile section" düğmesinden anlaşılıyor.
- **Başkasının profilinde:** Bildirim "Yalnızca kendi profilini gönderebilirsin"; hiçbir şey okunmuyor ya da gönderilmiyor.
- **Okunamazsa:** Bildirim "Profilini okuyamadık; sayfayı yenileyip tekrar dene ya da PDF yükle".
- **Aktarım:** Mevcut güvenli aktarım (DOG-71) kullanılıyor. `/linkedin#profil=<base64url JSON>&jeton=…` açılıyor. Sayfa jetonu eklentiye doğrulatıp `POST` atıyor; adres kısmı hemen siliniyor.
- **İlan sayfaları:** Bugünkü davranış aynen kalıyor.

## 6. API

Üç uç da kayıtlı kullanıcı istiyor; anonim ziyaretçi `/linkedin`'de bugünkü gibi girişe yönleniyor.

| Uç | İş |
|---|---|
| `POST /api/linkedin/audits` | Tarama aç (bölüm 4.1). |
| `GET /api/linkedin/audits` | En son tarama, önceki taramanın özeti, kilit bilgisi. |
| `PATCH /api/linkedin/audits` | `{ id, action: "retry" }`: yalnızca düşen yazımları yeniden kuyruğa al. Kullanıcının kendi kaydı olmalı. Günlük tarama hakkından düşmüyor; tarama başına en çok 3 kez. |

Mevcut `POST /api/resumes/[id]` içindeki `linkedin-report` türü 3. adımda
kaldırılıyor.

## 7. Hata durumları

| Durum | Davranış |
|---|---|
| Eklenti okuyamıyor (yapı değişti, sayfa yüklenmedi) | Bildirim; hiçbir şey gönderilmiyor. |
| Bölüm kısaltılmış ya da boş | Hata değil: kısaltma ekranda yazıyor; boş bölüm teşhiste "Eksik". |
| Yazım çağrısı düştü | Teşhis gösteriliyor; o yazım "Şu an yazamadık · tekrar dene". |
| Takılan tarama | 10 dakikadan eski `running` takılmış sayılıyor (bugünkü kural); yeni tarama açılabiliyor. |
| Günlük sınır | "Bugünkü 5 taramanı yaptın; yarın tekrar deneyebilirsin." |
| Paket bitti | Yazımlar yeniden kilitleniyor; kayıtta duruyor. |
| Eklenti verisi geçersiz ya da çok büyük | 400; sayfa "Profil okunamadı, PDF ile dene" diyor. |

## 8. KVKK

Gizlilik metnine bir satır ekleniyor: "LinkedIn profil bilgilerin (eklentiyle
senin isteğinle ya da yüklediğin PDF'ten) analiz için OpenAI'a gönderilir;
son 5 taraman saklanır, hesabını silince silinir." `company.ts` içindeki
`lastUpdated` güncelleniyor.

## 9. Test

- **Core, birim:**
  - Her kontrol kimliği (geçen ve düşen örnek).
  - Bölüm durumu ve özet.
  - `toResumeProfile`.
  - PDF profilinden `LinkedInProfileData`'ya çeviri.
  - Önce/sonra farkı.
- **Web, birim:**
  - Ücret kapısı: kilitli metin yanıtta hiçbir yerde geçmiyor.
  - Eklenti verisi şeması (uzunluk sınırları).
  - Günlük sınır.
- **Eklenti:** Profil okuyucu üç örnek HTML'le test ediliyor: kurgusal kendi profili, başkasının profili, kısaltılmış bölümlü profil (bugünkü ilan okuyucu testleri gibi).
- **Çizim:** Başlangıç, bekleme, sonuç, kilitli ve açık hâller.
- **Yerelde:**
  - `/ui/linkedin` vitrininde her hâl; 1440 ve 390 px, açık ve koyu tema.
  - Kurgusal profil sayfası kopyasıyla uçtan uca deneme.

## 10. Teslim sırası

Her adım ayrı PR olarak `test` dalına.

1. **Veri ve teşhis:**
   - `LinkedInProfileData`, `toResumeProfile`, PDF çevirisi.
   - Kontroller ve özet (core, testli).
   - `LinkedInAudit` göçü.
2. **İş ve yazım:**
   - Uçlar (`POST`, `GET`, `PATCH`), worker `linkedin-audit` işi, yazım ve doğrulama.
   - Ücret kapısı, günlük sınır, saklama, hesap silme ve dışa aktarma.
3. **Arayüz:** Yeni `/linkedin` sayfası (PDF yoluyla tam çalışır), bekleme sahnesi, `/ui/linkedin`. Bugünkü rapor kaldırılıyor.
4. **Eklenti 0.3.0:** Profil okuyucu, kendi profili kontrolü, aktarım. Sayfada eklenti yoklaması.
5. **KVKK metni.**

## 11. Kapsam dışı

- Profil fotoğrafı değerlendirmesi (sonraki sürüm; KVKK ve görsel model ayrı karar).
- "LinkedIn ile giriş" ve profil URL'sinden veri çekme.
- LinkedIn'e yazmak ya da önerileri otomatik uygulamak.
- Eklentinin "Tümünü göster" sayfalarını gezmesi (kısaltma ekranda söyleniyor, PDF tamamlıyor).
- Sertifika ve eğitim için yeniden yazım.
- CV ile LinkedIn arasında tutarlılık karşılaştırması.
