# Sprint 2 — Uyarlama Akışı ve Çıktı · Tasarım Belgesi

**Tarih:** 25 Eylül 2026 · **Kapsam:** Faz 1 / Sprint 2 (Hafta 5–6, 26 Ekim – 8 Kasım 2026)
**İlgili belgeler:** `docs/kararlar.md` (K-26 … K-29), planlama raporu §5.1, marka rehberi §9.5 ve §11, yol haritası §6.2

---

## 1. Amaç

Kullanıcının CV'sini, ilana göre **yeniden ifade etmek** ve ATS dostu bir
belge olarak indirilebilir hâle getirmek — hiçbir şey uydurmadan.

Sprint 1 "bu CV bu ilana ne kadar uyuyor" sorusunu cevapladı. Sprint 2
"peki ne yapmalıyım" sorusunu cevaplıyor. Ürünün ödeme duvarı da burada:
skor ücretsiz, uyarlanmış çıktı ücretli (planlama raporu §5.3).

**Karar kapısı K2 (8 Kasım):** 5 test kullanıcısından en az 4'ü uyarlanmış
CV'yi gerçek bir başvuruda kullanmak istiyor. Kriter tutmazsa uyarlama
kalitesine odaklanılır, ödeme işi bir hafta ertelenir.

## 2. Kapsam

### Dahil

- Özet yeniden yazımı
- Deneyim maddelerinin yeniden ifade edilmesi (madde başına ayrı çağrı)
- Becerilerin ilana göre sıralanması (kodda)
- Uydurma kontrolü: üç deterministik kontrol
- Madde bazında kabul / ret akışı
- Uyarlama sonrası skorun yeniden hesaplanması
- Tek ATS dostu şablon, PDF ve DOCX çıktısı
- Marka rehberine göre arayüz
- Değerlendirme setinin uyarlamayı da ölçecek şekilde genişletilmesi
- 5 kişiyle kullanılabilirlik testi

### Hariç — açıkça

Kimlik doğrulama · ödeme · başvuru panosu · ön yazı · ikinci şablon ·
Türkçe↔İngilizce uyarlama (Faz 3) · LinkedIn profil optimizasyonu

### Yol haritasından iki sapma

**İkinci şablon kesildi, DOCX korundu.** Yol haritası §12.2'deki kapsam kesme
sırası tersine çevrildi. Gerekçe: hiç çıktı üretmemiş durumdayız ve birinci
şablonun gerçek ATS'lerden geçtiğini bilmiyoruz; ikinci şablon doğrulanmamış
bir tasarımın kopyası olur. DOCX ise Türkiye'deki kurumsal İK süreçlerinde
hâlâ yaygın ve maliyeti düşük — aynı ara yapıdan ikinci bir üretici (K-29).

**Beceriler yeniden yazılmıyor, sıralanıyor.** Yol haritası "yetenekleri
yeniden yazma" diyor. Bir beceri adını yeniden yazmanın kazancı yok
(`React` → `React.js`), eklemenin ise doğrudan uydurma riski var. Sıralamanın
kazancı ise gerçek: ATS tarayıcıları listenin başını daha çok tartıyor.
Üstelik sıralama kodda yapılabiliyor — skor servisi hangi becerinin hangi
gereksinimi karşıladığını zaten biliyor (K-27).

## 3. Görevler ve tahminler

| # | Görev | Çıktı | Süre |
|---|---|---|---|
| 1 | `Adaptation` veri modeli ve migration | Prisma şeması | 2 sa |
| 2 | Özet yeniden yazımı | Prompt + çıkarıcı | 3 sa |
| 3 | Madde yeniden ifadesi (paralel) | Yeniden yazma servisi | 5 sa |
| 4 | Beceri sıralaması (kod) | Sıralama fonksiyonu | 2 sa |
| 5 | Uydurma kontrolü: üç kontrol | Doğrulama servisi | 5 sa |
| 6 | Uyarlama hattı ve kuyruk işi | `adapt` işi | 3 sa |
| 7 | Belge modeli + PDF üreteci | `renderPdf` | 4 sa |
| 8 | DOCX üreteci | `renderDocx` | 2 sa |
| 9 | Kabul/ret API'leri ve indirme kapısı | Route'lar | 3 sa |
| 10 | Marka giydirmesi ve uyarlama ekranı | Arayüz | 6 sa |
| 11 | Uyarlama sonrası skor | Yeniden hesaplama | 1 sa |
| 12 | Değerlendirme setinin genişletilmesi | Uydurma oranı ölçümü | 3 sa |
| 13 | 5 kişiyle kullanılabilirlik testi | Test notları (K2) | 3 sa |
| | | **Toplam** | **42 sa** |

Bağımlılık sırası: `1 → (2, 3, 4 paralel) → 5 → 6 → 11 → (7, 8 paralel) → 9 → 10 → 12 → 13`

Tahmin, yol haritasındaki 37 saatin üzerinde. Gecikirse kesme sırası
Bölüm 12'de.

## 4. Akış

```
Analiz (Sprint 1)  →  Uyarlama  →  Kullanıcı kararları  →  Belge
skor, kanıtlar        yeniden        kabul / ret            PDF
eksik kavramlar       yazma                                 DOCX
```

Uyarlama bir **çalışma belgesi** olarak yaşıyor. Kullanıcı kararlarını
verdikçe güncelleniyor; indirme anında kabul edilen içerikten nihai bir
`ResumeVersion` (`source: adapted`) üretiliyor.

Bu ayrım bilinçli: çalışma hâli ile nihai eser farklı şeyler. Kullanıcı
kararını değiştirebilmeli, ve indirilen belge tam olarak onayladığı hâl
olmalı.

## 5. Veri modeli

Yeni model:

```prisma
model Adaptation {
  id         String           @id @default(cuid())
  analysisId String           @unique
  analysis   Analysis         @relation(fields: [analysisId], references: [id])

  /** Çalışma hâli: madde bazında özgün, yeniden yazım, doğrulama, karar. */
  draft      Json

  /** Kabul edilenlerden üretilen nihai sürüm; indirme anında doluyor. */
  resumeVersionId String?
  resumeVersion   ResumeVersion? @relation(fields: [resumeVersionId], references: [id])

  status     AdaptationStatus @default(draft)
  modelId    String
  durationMs Int?
  tokenUsage Int?
  errorClass String?
  createdAt  DateTime         @default(now())
  updatedAt  DateTime         @updatedAt
}

enum AdaptationStatus {
  running
  draft      // yeniden yazım bitti, kullanıcı kararları bekleniyor
  ready      // uyarı taşıyan maddelerin hepsi karara bağlandı
  failed
}
```

`draft` alanının şekli (Zod ile tanımlı, `AdaptationDraftSchema`):

```ts
{
  summary: {
    original: string | null
    rewritten: string
    verification: Verification
    decision: "accepted" | "rejected"
  }
  bullets: Array<{
    id: string              // kararların adreslenmesi için
    experienceIndex: number // hangi işin maddesi
    original: string
    sourceRef: string       // ham CV'deki karşılık (Sprint 1'den gelir)
    rewritten: string
    verification: Verification
    decision: "accepted" | "rejected" | "pending"
  }>
  skillOrder: string[]      // ilana göre sıralanmış beceri listesi
}

type Verification = {
  status: "ok" | "flagged"
  issues: Array<{
    kind: "number_mismatch" | "posting_term_injected" | "semantic_drift"
    detail: string          // kullanıcıya gösterilecek gerekçe
  }>
}
```

`Analysis` modeline `adaptation Adaptation?` ters ilişkisi eklenir.

`analysisId` benzersizdir: bir analizin tek bir uyarlaması olur. Kullanıcı
farklı bir sonuç istiyorsa analizi yeniden çalıştırır. Aynı analiz için
birden çok uyarlama tutmak, hangisinin indirildiğini izlemeyi gerektirir ve
Sprint 2'de bunun bir karşılığı yok.

**Neden `draft` tek bir Json:** Madde kararları sık güncelleniyor ve hepsi
birlikte okunuyor. Ayrı tabloya bölmek, her okumada birleştirme maliyeti
getirirdi ve kazandıracağı sorgulanabilirlik Sprint 2'de kullanılmıyor.
Sprint 3'te pano geldiğinde yeniden değerlendirilir.

## 6. Yeniden yazma hattı

### 6.1 Özet

Tek çağrı. Girdi: mevcut özet, ilanın pozisyonu ve `must` gereksinimlerinin
kavramları. Çıktı: yeniden yazılmış özet.

Özet serbest metindir ve kullanıcının kendini tanıttığı yerdir; vurguyu role
göre değiştirmek meşrudur. Yine de uydurma kontrolüne tabidir: özet, CV'de
olmayan bir teknoloji ya da sayı içeremez.

### 6.2 Deneyim maddeleri

**Her deneyim maddesi yeniden yazılır**, madde başına bir çağrıyla. Girdi
yalnızca o maddenin kendisi, artı ilanın `must` gereksinimlerinin kavramları.
Çıktı yeniden ifade edilmiş madde.

Seçici davranmıyoruz — "bu madde zaten iyi" kararını sistem vermiyor, kullanıcı
veriyor. Her madde için önce/sonra gösterilip kabul/ret kullanıcıya bırakılıyor.
Maliyeti madde sayısı kadar çağrı; bu, Bölüm 15'teki birinci risk.

Bu, Sprint 1'in en pahalı dersinin doğrudan uygulaması: modele tek seferde
çok parçalı iş verildiğinde sessizce eksik veya yanlış üretiyor (K-11, K-18,
K-19, K-22, K-23). Girdi tek madde olunca hem uydurma kaynağı daralıyor hem
de hata izole oluyor — bir madde bozulursa diğerleri etkilenmiyor.

Çağrılar paralel yapılır. Kazanç ölçülmeli: Sprint 1'de üç eşzamanlı çağrı
yalnızca 1,29x kazandırmıştı (K-16), ama o çağrılar büyüktü; madde çağrıları
küçük ve davranış farklı olabilir.

**Prompt ilkesi:** "Bu maddeyi şu ilanın diliyle yeniden ifade et. Yeni bilgi
ekleme, sayı değiştirme, teknoloji ekleme. Yalnızca ifadeyi değiştir."

### 6.3 Beceriler

**Kodda sıralanır, yeniden yazılmaz.** Skor servisi hangi becerinin hangi
gereksinimi karşıladığını zaten biliyor (`RequirementResult.evidence`).
Sıralama kuralı:

1. `must` gereksinimi karşılayan beceriler
2. `nice` gereksinimi karşılayan beceriler
3. Kalanlar, özgün sıralarıyla

Küme değişmez: hiçbir beceri eklenmez, hiçbiri silinmez. Bu yüzden uydurma
riski sıfırdır ve doğrulamaya tabi değildir.

### 6.4 Dokunulmayan bölümler

Eğitim, diller ve sertifikalar **hiç değiştirilmez** — ne yeniden yazılır ne
sıralanır. Bunlar olgudur; ilana göre değişecek bir ifade payı yok. Çıktı
belgesine özgün hâlleriyle geçerler.

## 7. Uydurma kontrolü

Üç kontrol, üçü de deterministik. Kaynak olarak maddenin `sourceRef`'i
kullanılır — ham CV metnindeki birebir karşılık (Sprint 1'de tam bu amaç
için konmuştu).

### 7.1 Sayı kontrolü

Yeniden yazımdaki her sayı kaynakta da bulunmalı. Yüzde, yıl, adet, para
birimi — hepsi.

```
kaynak:  "Sayfa yüklenme süresini %40 düşürdüm"
yazım:   "Sayfa yüklenme süresini %60 düşürdüm"    → number_mismatch
```

### 7.2 İlan terimi enjeksiyonu

Yeniden yazımda geçen ama kaynakta geçmeyen bir **ilan kavramı** varsa
işaretlenir.

```
kaynak:  "React ile müşteri panelini geliştirdim"
yazım:   "React ve Kubernetes ile müşteri panelini geliştirdim"
ilan:    Kubernetes bir gereksinim kavramı                → posting_term_injected
```

Uydurmanın en tehlikeli biçimi budur: model, ilanın istediği şeyi CV'ye
yazıverir. Ve tam olarak tespit edilebilir — ilanın kavram listesi elimizde
(K-23).

Karşılaştırma `containsKeyword` ile yapılır; Türkçe normalleştirme ve çapraz
dilli sözlük (K-21, K-25) böylece kendiliğinden devrede olur.

### 7.3 Anlamsal sapma (ikincil)

`cosine(yeniden yazım, kaynak)` eşiğin altındaysa işaretlenir. Terim eklemeden
anlamı abartmayı yakalar:

```
kaynak:  "Kod inceleme sürecine katkı sağladım"
yazım:   "Kod inceleme sürecini kurdum ve ekibe liderlik ettim"  → semantic_drift
```

İkincil çünkü eşik bir tahmindir ve ilk iki kontrol gibi kesin gerekçe
üretmez. Eşik başlangıç değeri `0.75`; değerlendirme setinde ayarlanacak.

### 7.4 Kullanıcıya gösterim

Her uyarı, gerekçesiyle birlikte gösterilir: *"Bu maddede `Kubernetes`
geçiyor ama CV'nde yok."* Marka rehberi §11'in "uydurmama ilkesi" ancak
kullanıcı **neyin** neden işaretlendiğini görebildiğinde anlamlı.

## 8. Kabul / ret

| Doğrulama | Varsayılan | Davranış |
|---|---|---|
| `ok` | `accepted` | Fark görünür, tek tıkla geri alınır |
| `flagged` | `pending` | Karar verilmeden indirme açılmaz |

Marka rehberi §11 "kullanıcı her değişikliği onaylar" diyor. Bu tasarım
lafzından sapıyor ve gerekçesi K-26'da: rehberin asıl derdi kullanıcının
bilmediği bir şeyin CV'sine girmemesi. Doğrulamayı geçen madde, kendi
cümlesinin yeniden ifade edilmiş hâlidir; orada zorunlu onay gerçek bir
koruma sağlamaz, yalnızca sürtünme ekler — ve marka rehberi §4'te **Hız** da
bir değerdir. Uyarı taşıyan maddede ise onay zorunludur ve atlanamaz, yani
koruma rehberin öngördüğünden **güçlüdür**.

Marka rehberi §11 bu karara göre güncellenecek.

## 9. Belge üretimi

Tek ara yapı, iki üreteç:

```
ResumeProfile → DocumentModel → renderPdf()   (pdfkit)
                              → renderDocx()  (docx)
```

`DocumentModel` basit bir yapı: başlık, iletişim satırı, bölümler, her bölümde
başlık ve madde listesi. Yerleşim kararları burada verilir, üreteçler yalnızca
çizer.

**Tarayıcı kullanılmıyor.** Puppeteer worker'a yüzlerce megabaytlık bir
bağımlılık ekler. ATS dostu çıktı zaten tek sütunlu ve sade bir yerleşim
istiyor; `pdfkit` ile doğrudan yazmak hem hafif hem metnin seçilebilir
olmasını garantiliyor — taranmış PDF'e benzer bir sonuç riski yok.

**Font:** Marka rehberi §9.3 CV çıktılarında marka fontu değil sistem fontu
şart koşuyor (ATS uyumu için). `pdfkit`'in gömülü Helvetica'sı ve DOCX'te
Calibri kullanılır. Tipografi özgürlüğüne ihtiyaç olmaması, tarayıcısız
yaklaşımı ayrıca destekliyor.

**ATS kuralları** (şablona uygulanır): tek sütun, tablo yok, metin kutusu yok,
başlık/altbilgi yok, grafik yok, standart bölüm başlıkları, metin katmanı
seçilebilir.

## 10. Uyarlama sonrası skor

Kabul edilen içerikten oluşturulan profil, Sprint 1'in skor servisine
yeniden verilir. Yeni LLM çağrısı yok — çıkarım zaten yapılmış, yalnızca
kanıt kümesi değişmiş oluyor.

Kullanıcıya "%41'den %83'e" biçiminde gösterilir (marka rehberi §6.2).
Skorun yükselmesi garanti değildir ve bu dürüstçe yansıtılır: yeniden ifade
gerçekten eşleşme kazandırmadıysa skor da değişmez.

## 11. Arayüz

Marka giydirmesi bu sprintte yapılır (Sprint 1'de bilinçli olarak
ertelenmişti, K-01). Gerekçe: kullanılabilirlik testi bu sprintte ve stilsiz
bir arayüzle test etmek yanıltıcı geri bildirim üretir.

**Uygulanacak marka öğeleri:** Uyarla Mavisi `#2B4EFF`, Gece `#0F172A`,
Buz `#F5F7FF`, durum renkleri; Manrope (başlık) / Inter (metin); buton 10px,
kart 16px yarıçap; skor ekranın en büyük öğesi.

**Uyarlama ekranı:** Madde bazında önce/sonra. Eklenen metin yeşil vurgu,
çıkarılan üstü çizili gri (rehber §9.5). Uyarı taşıyan maddeler rozetli ve
gerekçeli. Üstte skor önce/sonra. Altta indirme butonları — uyarılar
karara bağlanmadan kapalı.

Yeni bileşen kütüphanesi kurulmuyor; mevcut sayfalara marka değişkenleri ve
gerekli bileşenler ekleniyor.

## 12. Test stratejisi

**Birim testleri (çoğunluk).** Üç uydurma kontrolü, beceri sıralaması ve
belge modeli saf fonksiyonlar; asıl test yükü burada. Sayı kontrolü ve terim
enjeksiyonu için gerçek vakalardan türetilmiş sabit girdiler kullanılır.

**Tümleşik testler (az sayıda).** Gerçek modelle bir maddenin yeniden
yazılması ve doğrulamadan geçmesi. Ayrıca üretilen PDF'in metin katmanının
okunabilir olduğu — Sprint 1'deki `extractText` ile kendi çıktımızı okuyup
doğrularız.

**Değerlendirme seti genişletilir.** Mevcut 10 çiftin her birinde yeniden
yazma çalıştırılır ve şu ölçülür:

| Metrik | Anlamı |
|---|---|
| İşaretlenen madde oranı | Uydurma kontrolünün ne sıklıkla devreye girdiği |
| Kontrol türü dağılımı | Hangi kontrolün ne yakaladığı |
| Skor değişimi | Uyarlamanın gerçekten eşleşme kazandırıp kazandırmadığı |

Bu, Sprint 2'nin ana vaadinin taban çizgisidir. Sprint 1'in dersi buydu:
ölçülmeyen kalite, olmayan kalitedir.

## 13. Hata yönetimi

| Durum | Sınıf | Davranış |
|---|---|---|
| Bir maddenin yeniden yazımı başarısız | Kısmi | O madde özgün hâliyle kalır, `rewritten = original`, uyarı yok. Diğer maddeler etkilenmez |
| LLM erişilemez | Geçici | BullMQ üstel geri çekilme, 3 deneme |
| Belge üretimi çöktü | Kod hatası | Tekrar deneme anlamsız; tam yığın izi |
| Kabul edilen madde kalmadı | Geçerli durum | Özgün CV indirilebilir; uyarlama bir zorunluluk değil |

Madde başına izolasyon, madde başına çağrının ikinci faydası: bir çağrı
patlarsa tüm uyarlama değil yalnızca o madde kaybedilir.

## 14. Tamamlanma tanımı

- [ ] Kullanıcı bir analiz sonucundan uyarlama başlatabiliyor
- [ ] Özet, maddeler ve beceri sıralaması üretiliyor
- [ ] Üç uydurma kontrolü çalışıyor ve gerekçe üretiyor
- [ ] Uyarı taşıyan maddeler karara bağlanmadan indirme açılmıyor
- [ ] PDF ve DOCX indiriliyor; PDF'in metni seçilebilir (kendi `extractText`'imizle doğrulanmış)
- [ ] Uyarlama sonrası skor gösteriliyor
- [ ] Arayüz marka rehberine uygun
- [ ] Değerlendirme setinde işaretlenen madde oranı ölçülmüş ve kaydedilmiş
- [ ] 5 kullanıcıyla test yapılmış, K2 kararı `docs/kararlar.md`'ye yazılmış

## 15. Açık riskler

| Risk | Etki | Önlem |
|---|---|---|
| Madde başına çağrı süreyi patlatır | Yüksek | Paralelleştirme; kazanç ölçülmeli. Yetmezse yalnızca eşleşmeye katkı sağlayabilecek maddeler yeniden yazılır |
| Yeniden yazım skoru artırmıyor | Yüksek | Değerlendirme setinde ölçülür. Artırmıyorsa prompt ilana özel kavramları daha doğrudan hedeflemeli |
| Uydurma kontrolü fazla hassas | Orta | Her işaretlenen madde kullanıcıyı durduruyor; yanlış alarm oranı eval'de ölçülmeli |
| `pdfkit` ile yerleşim beklenenden uzun sürer | Orta | Tek şablon; karmaşık yerleşim yok. Gerekirse şablon sadeleştirilir |
| Gerçek ATS'ten geçmeme | Yüksek | Sprint sonunda çıktı en az bir gerçek ATS'e (ör. ücretsiz bir tarayıcı) sokulmalı |

## 16. Kapsam kesme sırası

Gecikme bir haftayı aşarsa şu sırayla ertelenir:

1. DOCX çıktı → yalnızca PDF
2. Anlamsal sapma kontrolü (7.3) → yalnızca iki kesin kontrol
3. Özet yeniden yazımı → yalnızca maddeler
4. Marka giydirmesi → Sprint 1'in sade arayüzüyle test edilir

**Asla kesilmeyecekler:** Sayı kontrolü, ilan terimi enjeksiyonu kontrolü,
uyarı taşıyan maddede zorunlu onay, ATS dostu PDF çıktı.
