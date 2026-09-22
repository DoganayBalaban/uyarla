# Sprint 1 — Temel ve Çekirdek AI · Tasarım Belgesi

**Tarih:** 22 Eylül 2026 · **Kapsam:** Faz 1 / Sprint 1 (Hafta 3–4, 12–25 Ekim 2026)
**İlgili belgeler:** `docs/kararlar.md` (K-01 … K-08), planlama raporu §6, yol haritası §6.1

---

## 1. Amaç

Bir CV ve bir ilan metni sisteme girdiğinde, 30 saniyenin altında **açıklanabilir
bir ATS uyum skoru** ve **gereksinim bazlı eksik listesi** üretmek.

Bu sprintin çıktısı bir ürün değil, ürünün kalbinin çalıştığının kanıtı. Başarı
ölçütü kullanıcı sayısı değil, değerlendirme setindeki eşleştirme isabeti.

**Karar kapısı K1 (25 Ekim):** 10 test CV–ilan çiftinde çıkarım doğruluğu elle
kontrolde tatmin edici, uydurma içerik yok. Kriter tutmazsa pipeline sadeleştirilir,
model veya prompt değiştirilir; 1 hafta ek süre.

## 2. Kapsam

### Dahil

- Yerel geliştirme ortamı (Next.js + worker + Postgres + Redis, Docker Compose)
- Veri modeli ve ilk migration
- CV yükleme, PDF/DOCX metin çıkarma
- Kuyruk altyapısı ve işçi süreci
- LLM ile CV çıkarımı (yapılandırılmış JSON)
- LLM ile ilan çıkarımı (gereksinim listesi)
- Deterministik + anlamsal hibrit skor servisi
- Markasız test arayüzü
- 10 çiftlik değerlendirme seti ve ölçüm betiği

### Hariç — açıkça

Kimlik doğrulama · ödeme · başvuru panosu · ön yazı · uyarlama/yeniden yazma ·
uydurma kontrolü · PDF/DOCX **çıktı** üretimi · çift dil · SEO sayfaları · marka
arayüzü · staging dağıtımı (K-06).

Yalnızca sonradan eklenmesi pahalı olacak kancalar bırakılır: çıkarımdaki
`sourceRef` alanı (Sprint 2 uydurma kontrolünün temeli) ve `FileStore` arayüzü
(Sprint 3'te S3 uygulaması).

## 3. Görevler ve tahminler

| # | Görev | Çıktı | Süre |
|---|---|---|---|
| 1 | Repo, Next.js iskeleti, TypeScript, lint, Docker Compose | Çalışan geliştirme ortamı | 4 sa |
| 2 | Veri modeli ve migration | Prisma şeması | 4 sa |
| 3 | CV yükleme ve metin çıkarma (PDF, DOCX) | Yükleme uç noktası | 5 sa |
| 4 | BullMQ kuyruğu ve işçi süreci | Arka plan iş altyapısı | 3 sa |
| 5 | LLM ile CV çıkarımı | CV parser | 6 sa |
| 6 | LLM ile ilan çıkarımı | İlan parser | 4 sa |
| 7 | Eşleştirme ve skor algoritması | Skor servisi | 6 sa |
| 8 | Değerlendirme seti ve ölçüm betiği | Eval altyapısı | 4 sa |
| | | **Toplam** | **32 sa** |

Bağımlılık sırası: `1 → 2 → (3, 4 paralel) → 5 → 6 → 7 → 8`.

## 4. Mimari

### 4.1 Depo yapısı

```
uyarla/
├── apps/
│   ├── web/              Next.js (App Router) — API route'ları + test arayüzü
│   └── worker/           BullMQ işçi süreci
├── packages/
│   ├── core/             alan mantığı: şemalar, çıkarım, skor, LLM soyutlaması
│   └── db/               Prisma şeması + üretilen client
├── docs/
├── docker-compose.yml    Postgres + Redis
└── pnpm-workspace.yaml
```

`packages/core` hiçbir framework'e bağlı değildir: Next, Redis veya Prisma
client'ı doğrudan import etmez. Girdi alır, çıktı verir. Böylece skor algoritması
ve çıkarım şemaları Docker ayağa kaldırmadan test edilebilir; eval betiği de
HTTP katmanına hiç girmeden doğrudan `core`'u çağırır.

`web` ve `worker`'ın ayrı uygulamalar olması K-02'nin kod karşılığıdır: Sprint
3'te worker VPS'e taşınırken Next.js sürüklenmez.

### 4.2 Çalışma topolojisi

| Parça | Sorumluluk | Sprint 1'de | Üretimde (K-02) |
|---|---|---|---|
| `apps/web/app/api/*` | İnce HTTP katmanı: dosya alır, doğrular, iş kuyruğa atar, durum döner | Yerel | Vercel |
| `apps/worker` | Ağır iş: ayrıştırma, LLM, embedding, skor, DB yazımı | Yerel | VPS |
| `packages/core` | Alan mantığı | Kütüphane | Kütüphane |
| Postgres / Redis | Kalıcılık / kuyruk | Docker Compose | Yönetilen / VPS |

İş mantığı API route'larında **bulunmaz**. Route'ların tek işi doğrulama ve
kuyruğa devretmektir; 30 saniyelik LLM zinciri worker'da çalışır.

## 5. Veri modeli

| Model | Alanlar | Not |
|---|---|---|
| `User` | id, email, createdAt | İskelet; Sprint 1'de tek yerel test kullanıcısı. Auth Sprint 3'te üstüne gelir |
| `Resume` | userId, filePath, rawText, status, createdAt | Yüklenen belge |
| `ResumeVersion` | resumeId, profile (Json), source (`parsed` \| `adapted`), versionNo | Çıkarım çıktısı. Sprint 2'de uyarlanmış sürümler aynı tabloya `adapted` olarak düşer |
| `JobPosting` | rawText, requirements (Json), language, seniority, createdAt | |
| `Analysis` | resumeVersionId, jobPostingId, score, result (Json), modelId, durationMs, tokenUsage, status, errorClass | |

**Ertelenenler:** `Application` (Sprint 3, pano), `Subscription` (Sprint 3, ödeme).
Kullanılmadan önce iki kez değişecek şema yazılmaz.

### `Analysis` neden ayrı bir model

Yol haritası bu tabloyu saymıyor ama iki işi birden görüyor: ürün tarafında
"bu CV bu ilana %41 uyuyor" kaydı, geliştirme tarafında **değerlendirme
verisinin tabanı**. `modelId`, `durationMs` ve `tokenUsage` baştan konur; model
değiştiğinde (K-03) "önceki model ne veriyordu" sorusunu bu tablo cevaplar.
Başarısız işler de yazılır (`status: failed`, `errorClass`) — hangi çiftte ne
patlıyor bilgisi K1 değerlendirmesinin parçası.

### JSON sütunları

Yapılandırılmış profil ve gereksinimler normalize tablolar yerine `Json`
sütunlarında durur. Şema zaten kodda tanımlı (K-04) ve prompt iterasyonu hızlı
olacak; her değişiklikte migration yazmak istenmez. Sprint 2 sonunda şema
oturduğunda sorgulanması gereken alanlar ayrı sütuna çıkarılabilir.

### Dosya depolama

Sprint 1'de S3 yok; dosyalar yerel `storage/` klasöründe, yol `Resume.filePath`'te.
`packages/core` tek bir `FileStore` sözleşmesi tanımlar; Sprint 3'te S3 uygulaması
yazılır, çağıran kod değişmez.

## 6. AI hattı

### 6.1 Sağlayıcı soyutlaması

```ts
interface LlmProvider {
  extract<T>(opts: { prompt: string; schema: JsonSchema; input: string }): Promise<T>
}
interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>
}
```

Tek uygulama: `LmStudioProvider` — `openai` paketi, `baseURL` yapılandırmadan,
`response_format: { type: "json_schema" }`. Model kimliği, endpoint ve zaman
aşımı ortam değişkeninde; kodun hiçbir yerinde model adı geçmez. Üretim modeline
geçiş yeni bir sınıf ve env değişikliğidir (K-03).

Her çağrı `Analysis` kaydına `modelId`, süre ve token sayısını yazar.

### 6.2 Şemalar

Tek kaynak: **Zod ile tanım → `zod-to-json-schema` ile JSON Schema**. Modeli
kısıtlayan şema, TypeScript tipleri ve çalışma zamanı doğrulaması aynı yerden
gelir; ayrışma imkânsızdır.

**CV profili:** kimlik, özet, `experience[]` (kurum, unvan, tarih aralığı,
`bullets[]`), `education[]`, `skills[]`, `languages[]`, `certifications[]`.

Her deneyim maddesi, ham CV metnindeki karşılığına bir `sourceRef` taşır. Bu alan
Sprint 2'deki uydurma kontrolünün temelidir; sonradan eklemek tüm çıkarımı
yeniden çalıştırmak demek olacağı için şimdiden konur.

**İlan:** pozisyon, şirket, kıdem, dil ve `requirements[]`. Her gereksinim:

| Alan | İçerik |
|---|---|
| `text` | Gereksinimin ilandaki hâli |
| `type` | `skill` \| `experience` \| `education` \| `soft` |
| `importance` | `must` \| `nice` |
| `keywords[]` | Eşleştirme için normalleştirilmiş biçimler |

### 6.3 İki aşamalı çıkarım

Çıkarım tek büyük çağrı değil, iki aşamadır: önce kaba bölümleme
(deneyim / eğitim / beceri blokları), sonra her blok için ayrı çağrı.

Küçük modellerde uzun tek çağrının kalitesi hızla düşer; kısa ve odaklı çağrılar
hem daha doğru hem paralelleştirilebilir. Bu, K-03'ün doğrudan sonucudur — üretim
modeline geçildiğinde tek çağrıya dönmek değerlendirilebilir.

## 7. Skor servisi

Saf fonksiyon: `score(profile, posting, embeddings) → ScoreResult`. LLM çağırmaz,
veritabanına dokunmaz. Birim testi ucuzdur ve eval betiği doğrudan çağırır.

### Üç aşamalı kanıt arama

Her gereksinim için sırayla:

1. **Tam eşleşme** — normalleştirilmiş anahtar kelime CV metninde geçiyor mu?
   (küçültme, Türkçe ek soyma, unvan eş anlamlı sözlüğü). Bulunursa `matched`,
   güven `1.0`.
2. **Anlamsal eşleşme** — gereksinim metni ile CV maddeleri arasında kosinüs
   benzerliği; en yakın madde eşiği geçerse `matched`, güven = benzerlik değeri.
3. Hiçbiri değilse `missing`.

Gömülen birimler: her deneyim maddesi (`bullets[]` içindeki her satır) ve her
beceri ayrı ayrı vektörlenir; CV bir bütün olarak gömülmez. Kanıt olarak
gösterilecek şey tek bir madde olduğu için eşleştirme de madde düzeyinde olmalı.
Gereksinim tarafında `text` alanı gömülür. Tüm gömme işi tek bir toplu çağrıda
yapılır.

### Skor

```
skor = Σ(ağırlık × güven) / Σ(ağırlık)
```

`must` gereksinimleri `nice`'ın iki katı ağırlıkta. Eşik ve ağırlıklar tek bir
yapılandırma nesnesinde toplanır — değerlendirme setinde ayarlanacak sabitler
kodun içine dağılmaz.

Başlangıç değerleri: `must` ağırlığı `2.0`, `nice` ağırlığı `1.0`, anlamsal
eşleşme eşiği `0.65`. Üçü de hipotezdir; eval setinin ilk çalıştırmasından sonra
ayarlanır. Eşiğin ilk turda yüksek tutulması bilinçli — uydurma eşleşme
(yanlış pozitif), kaçırmadan daha zararlıdır, çünkü kullanıcıya olmayan bir
yetkinliği varmış gibi gösterir ve ürünün dürüstlük ilkesini doğrudan çiğner.

### Neden hibrit

Salt anahtar kelime eşleşmesi "Frontend developer" ilanına "React geliştirici"
CV'sini kaçırır (yanlış negatif). Salt embedding ise bir sayı üretir ama
**eksik listesi üretemez** — oysa ürünün sattığı şey skor değil o listedir:
huninin ilk adımı ("5 anahtar kelime eksik") ve Sprint 2'deki yeniden yazmanın
girdisi odur. Hibrit yaklaşımda embedding **skoru belirlemez, kanıt bulmaya
yardım eder**; açıklanabilirlik korunur.

Çıktı her zaman gereksinim bazlıdır: hangi gereksinim karşılandı, hangi CV
maddesi kanıt gösterildi, hangisi eksik.

### Türkçe normalleştirme

Türkçe sondan eklemeli: "yazılım geliştirici" arayan ilana karşı CV'de
"yazılımcıyım", "geliştiriciliği" geçebilir. Normalleştirme katmanı küçültme,
yaygın ek soyma ve unvan eş anlamlı sözlüğünden oluşur. BGE-M3 çok dilli olduğu
için bu vakaların önemli kısmını zaten anlamsal katmanda yakalar (K-05).

Katman `core` içinde tek bir arayüzün arkasındadır; K-08'in açık bıraktığı kapı
budur — eval'de yetersiz çıkarsa arkasına küçük bir Python morfoloji servisi
takılabilir, çağıran kod değişmez.

## 8. Kuyruk akışı

Tek iş türü: `analyze`. CV metni + ilan metni → çıkarım → embedding → skor →
`Analysis` kaydı. Arayüz iş kimliğini alır, durumu yoklar; her aşama ilerleme
bildirir (marka rehberi §10.2: *"CV'ni okuyoruz… İlanla karşılaştırıyoruz…"*).

Aşamalar ayrı kuyruk işlerine bölünmez: veri akışı doğrusal ve tek kullanıcının
tek isteği; bölmek görünürlük kazandırmadan karmaşıklık ekler.

## 9. Test arayüzü

`apps/web/app/test/page.tsx` — tek sayfa. Solda CV dosya seçici ve ilan metni
için textarea, altında tek buton.

Sonuç ekranı üç parça:

1. Skor rakamı
2. Gereksinim listesi — her satır: gereksinim metni, ✓/✗, karşılandıysa kanıt
   gösterilen CV maddesi ve güven değeri
3. Ham çıkarım JSON'ları, katlanabilir blokta

Üçüncü kısım kullanıcıya asla gösterilmeyecek, ama K1'deki elle kontrolün asıl
yapıldığı yer orasıdır: modelin CV'yi doğru okuyup okumadığını, yoksa skorun
tesadüfen mi tuttuğunu ancak orada görürsün.

Stil yok: düz HTML, birkaç satır CSS. Marka giydirmesi Sprint 2'de (K-01).

## 10. Değerlendirme seti

`packages/core/eval/` altında 10 CV–ilan çifti, her biri bir JSON dosyası: CV
metni, ilan metni ve beklentiler.

### Beklenti biçimi

Beklenti olarak **skor rakamı yazılmaz** — "bu çift 72 almalı" diye bir gerçek
yoktur ve ağırlıklar her ayarlandığında dosyaları güncellemek gerekirdi. Bunun
yerine gereksinim bazında iddia: bu gereksinim karşılanmış sayılmalı (kanıt: şu
CV maddesi), bu gereksinim gerçekten eksik.

Ölçülen şey böylece **eşleştirme isabetidir**:

| Metrik | Anlamı |
|---|---|
| Kaçırma (yanlış negatif) | CV'de kanıt var, sistem `missing` dedi |
| Uydurma (yanlış pozitif) | CV'de kanıt yok, sistem `matched` dedi |
| İsabet | Doğru sınıflandırılan gereksinim oranı |
| Süre | Çift başına uçtan uca saniye |

Skor bunlardan türeyen bir sayıdır; kalite sinyali eşleştirmenin kendisindedir.

### Çalıştırma

`pnpm eval` → çift başına isabet/kaçırma/uydurma tablosu, toplam, ortalama süre,
kullanılan model. Sonuçlar tarih damgasıyla `eval/runs/` altına yazılır; model
veya prompt değiştiğinde iki çalıştırma yan yana konabilir. **K1 kapısının kanıtı
bu çıktıdır.**

### Veri kaynağı ve KVKK

Gerçek CV'ler izinle alınır ve sete girmeden önce anonimleştirilir: isim,
telefon, e-posta, adres çıkarılır; okul ve şirket isimleri gerekiyorsa korunur
ama kişi kimliği kaldırılır. Anonimleştirme elle yapılır, dosyalar repoya girer.

İlk iki çift kurucunun kendi CV'si ve tanıdıklarından; kalanı Faz 0
görüşmelerinden izin alınarak toplanır. İlan metinleri kamuya açıktır.

## 11. Hata yönetimi

| Durum | Sınıf | Davranış |
|---|---|---|
| Dosya okunamadı (bozuk PDF, taranmış görüntü) | Kalıcı | Tekrar deneme yok. Marka tonunda mesaj: *"Dosyanı okuyamadık. PDF veya DOCX olarak tekrar yüklemeyi dener misin?"* Taranmış PDF ayrıca tespit edilip ayrı mesaj verilir — metin katmanı yoksa kullanıcı aynı dosyayı tekrar yükler ve aynı hatayı alır |
| LM Studio erişilemiyor / zaman aşımı | Geçici | BullMQ üstel geri çekilme, 3 deneme, sonra başarısız. Geliştirmede en sık görülecek hata; mesaj açık olmalı |
| Model şema dışı çıktı verdi | Beklenmeyen | K-04 sayesinde olmamalı; Zod doğrulaması son savunma. Ham çıktı loglanır, tekrar denenir. İki kez üst üste olması şemanın küçük model için fazla karmaşık olduğunun sinyalidir |
| Skor hesabı çöktü | Kod hatası | Tekrar deneme anlamsız; doğrudan başarısız, tam yığın izi |

Başarısız işler de `Analysis` kaydı yazar (`status: failed` + `errorClass`).

## 12. Test stratejisi

TDD uygulanır. Üç katman:

**Birim testleri (çoğunluk).** Skor servisi saf fonksiyon olduğu için asıl test
yükü buradadır: sabit profil ve ilan girdileriyle, LLM olmadan. Türkçe
normalleştirme ("yazılımcıyım" → "yazılım"), ağırlıklandırma, eşik davranışı,
boş ve eksik alan durumları. Embedding sağlayıcısı sahtelenir — önceden
hesaplanmış vektörler.

**Çıkarım testleri.** Gerçek LLM çağrısı yavaş ve deterministik değildir, birim
testine girmez. Bir kez gerçek çağrı yapılır, yanıtlar `fixtures/` altına
kaydedilir; testler bunları oynatır. Şema değişince `pnpm fixtures:refresh`.

**Tümleşik test (az sayıda).** LM Studio gerçekten ayakta, uçtan uca tek çift.
`pnpm test:integration` ile ayrı çalışır, normal koşuyu yavaşlatmaz.

## 13. Tamamlanma tanımı

- [ ] Bir CV ve ilan yapıştırıldığında 30 saniyenin altında skor ve gereksinim
      bazlı eksik listesi dönüyor
- [ ] Değerlendirme setindeki 10 çift `pnpm eval` ile çalışıyor, sonuç tablosu üretiliyor
- [ ] Sonuçlar elle kontrol edildi; çıkarım doğruluğu tatmin edici, uydurma eşleşme yok
- [ ] Birim testleri geçiyor, skor servisi kapsanmış
- [ ] Kontrol yerel ortamda yapıldı (K-06); staging yok
- [ ] K1 kararı `docs/kararlar.md`'ye yazıldı

## 14. Açık riskler

| Risk | Etki | Önlem |
|---|---|---|
| `google/gemma-4-e4b` Türkçe CV çıkarımında yetersiz kalır | Yüksek — sprintin çıktısı K1'de kalır | Sağlayıcı soyutlaması (K-03) model değişimini ucuz kılıyor; iki aşamalı çıkarım küçük model için zaten optimize |
| Şema küçük model için fazla karmaşık | Orta | Tekrarlayan doğrulama hatası sinyal sayılır; şema sadeleştirilir |
| Türkçe morfoloji embedding + basit normalleştirmeyle çözülmez | Orta | K-08'in açık kapısı: dar kapsamlı Python morfoloji servisi |
| Eşik ve ağırlık ayarı beklenenden uzun sürer | Orta | Sabitler tek yapılandırma nesnesinde; eval betiği hızlı geri bildirim veriyor |
| Anonim CV toplamak gecikir | Orta | İlk iki çift kurucunun kendi verisinden; sprint onlarla başlayabilir |
