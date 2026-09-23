# Karar Günlüğü

Uyarla projesinde alınan teknik ve ürün kararlarının yaşayan kaydı. Planlama
raporu "ne ve neden", marka rehberi "nasıl görünür", yol haritası "ne zaman"
sorularını cevaplar; bu dosya **"neden böyle kararlaştırdık"** sorusunu cevaplar.

Kural: bir karar değişirse eski satır silinmez, durumu `Değişti` yapılır ve
yerine geçen kararın numarası yazılır. Böyle bir karara neden varıldığını altı
ay sonra hatırlamak, kararın kendisinden daha değerli olur.

| Alan | Anlamı |
|---|---|
| Durum | `Geçerli` · `Değişti` · `Geri alındı` |
| Kapsam | Kararın etkilediği sprint veya faz |

---

## K-01 · Sprint 1'de sade test arayüzü

**Tarih:** 22 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 1

Sprint 1'de API'nin yanında tek sayfalık, markasız bir test formu olacak: CV
yükle, ilan yapıştır, skoru ve eksik kelimeleri gör. Marka rehberine uygun
gerçek skor ekranı Sprint 2'de bunun üstüne giydirilecek.

**Gerekçe:** K1 (teknik) ve K2 (değer) karar kapıları elle kontrol ve
kullanılabilirlik testi gerektiriyor; ikisi de bir ekran ister. Ama tasarıma
harcanan her saat Sprint 2'den çalınmış saattir.

**Değerlendirilen alternatifler:** Sadece API + CLI eval betiği (ekran yok,
kullanılabilirlik testi yapılamaz) · Marka rehberine uygun tam ekran (Sprint
2'nin işini öne çeker).

---

## K-02 · Topoloji: Vercel (web) + ayrı worker

**Tarih:** 22 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Tüm fazlar

Next.js uygulaması Vercel'de, BullMQ işçisi ve Redis ayrı bir VPS'te, Postgres
yönetilen bir sağlayıcıda (Neon/Supabase) çalışacak.

**Gerekçe:** Programatik SEO ürünün ana edinim kanalı; Next.js'i Vercel'de
tutmak SSR/SSG, önizleme deploy'ları ve indeksleme tarafını kolaylaştırıyor.
Buna karşılık Vercel'in serverless fonksiyonları sürekli çalışan bir kuyruk
işçisini barındıramaz — worker'ın ayrı olması bir uzlaşma değil, doğru mimari
sınır. Bu sınıra baştan uyulursa sonradan taşıma acısı olmaz.

**Değerlendirilen alternatifler:** Her şey tek VPS'te Docker Compose ile
(dev/staging birebir aynı olur, ama TLS, deploy, yedekleme, izleme tümüyle
bize kalır) · Kuyruğu hiç kurmayıp uyarlamayı senkron API route'ta çalıştırmak
(3 saat kazandırır, ama 30 saniyelik LLM zinciri serverless zaman aşımına
dayanır ve Sprint 2'de kuyruk yine de gerekir).

---

## K-03 · LLM: yerel LM Studio, `google/gemma-4-e4b`

**Tarih:** 22 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 1+

Geliştirme sırasında tüm LLM çağrıları yerel LM Studio üzerinden
`google/gemma-4-e4b` modeline gidecek. Erişim OpenAI uyumlu endpoint
(`http://localhost:1234/v1`) üzerinden `openai` paketiyle yapılacak.

Model kimliği ve endpoint **tek bir sağlayıcı soyutlaması** arkasında duracak;
üretimde barındırılan bir API'ye (Anthropic, OpenAI veya kendi sunucumuzdaki
model) geçmek konfigürasyon değişikliği olmalı, kod değişikliği değil.

**Gerekçe:** Geliştirme aşamasında model kalitesi henüz bilinmiyor ve prompt
iterasyonu çok sayıda çağrı demek. Yerel model bu iterasyonu sıfır maliyetle ve
oran sınırı olmadan yapmayı sağlıyor. Hangi görevin hangi model sınıfını
gerektirdiğine, tahminle değil, Sprint 1'de kurulacak değerlendirme setinin verisiyle
karar verilecek.

**Sonuçları:** Üretim model maliyeti Sprint 1'de ölçülemez; planlama raporu
§7.1'deki birim ekonomisi hesabı model kararı verildikten sonra yapılacak.
Ayrıca yerel model geliştirme makinesine bağlı olduğu için staging ertelendi
(bkz. K-06).

---

## K-04 · Yapılandırılmış çıkarım şema kısıtıyla

**Tarih:** 22 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 1+

CV ve ilan çıkarımı, serbest metinden JSON ayıklamaya çalışmak yerine
`response_format: json_schema` ile yapılacak. LM Studio bu kısıtı gramer
seviyesinde uyguluyor, yani model şema dışı bir çıktı üretemiyor.

**Gerekçe:** "Model bazen JSON'u bozdu" hata sınıfını tamamen ortadan
kaldırıyor. Küçük modellerle çalışırken bu sınıf hataların sıklığı yüksektir;
onarım/yeniden deneme mantığı yazmaktansa baştan imkânsız kılmak daha ucuz.
Şema ayrıca CV ve ilan veri modelinin sözleşmesi hâline geliyor.

---

## K-05 · Embedding modeli: BGE-M3

**Tarih:** 22 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 1+

Anlamsal eşleştirmede BGE-M3 kullanılacak.

**Gerekçe:** Çok dilli eğitilmiş olması Türkçe–İngilizce çift dil hedefiyle
doğrudan örtüşüyor; 8k bağlam penceresi CV ve ilan metinlerini parçalamadan
gömmeye yetiyor. LM Studio'da hâlihazırda yüklü olan
`nomic-embed-text-v1.5` esasen İngilizce odaklı, Türkçe'de belirgin şekilde
zayıf kalıyor.

**Açık soru:** Skor servisinin (Sprint 1, görev 7) ne kadarının anlamsal
benzerliğe, ne kadarının deterministik anahtar kelime eşleşmesine dayanacağı
henüz kararlaştırılmadı. Skorun açıklanabilir olması ürün gereksinimi; salt
kosinüs benzerliği "neden %41?" sorusunu cevaplayamaz.

---

## K-06 · Sprint 1'de staging dağıtımı yok

**Tarih:** 22 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 1

Sprint 1 tamamen yerel Docker Compose ortamında çalışacak. Yol haritasındaki
"Staging ortamına ilk dağıtım" görevi (2 sa) Sprint 1'den çıkarıldı; sprint
tahmini 36 saatten 34 saate indi. K1 karar kapısı yerel ortamda değerlendirilecek.

**Gerekçe:** K-03 gereği LLM yerel makinede çalışıyor; uzak bir worker ona
erişemez. Staging'in asıl işlevi (SEO indeksleme, beta davetleri) Sprint 3–4'te
başlıyor. Sprint 1'in tamamlanma tanımı — "30 saniye altında skor dönüyor, eval
seti elle kontrol edildi" — canlı URL gerektirmiyor. Staging'i o zamana
ertelemek, VPS'i model kararı netleştikten sonra doğru boyutlandırmayı da
mümkün kılıyor.

**Değerlendirilen alternatifler:** Staging'i kurup worker'ı geliştirme
makinesinde çalıştırmak (laptop kapanınca ölen yarı-çalışan bir demo) · VPS'e
de küçük bir model koymak (ucuz VPS'te CPU çıkarımı 30 saniye hedefiyle
çelişir).

---

## K-07 · Kod deposu

**Tarih:** 22 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Tüm fazlar

Proje `github.com/DoganayBalaban/uyarla` deposunda geliştirilecek. Planlama
raporu, marka rehberi ve bu karar günlüğü `docs/` altında kodla birlikte
sürümlenecek.

**Gerekçe:** Dokümanların koddan ayrı yaşaması, ikisinin birbirinden sessizce
uzaklaşmasının en yaygın sebebi. Aynı depoda olmaları, bir kararı değiştiren
commit'in dokümanı da güncellemesini doğal kılıyor.

---

## K-08 · Tek dil: TypeScript; ayrı backend servisi yok

**Tarih:** 22 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Tüm fazlar

Backend ayrı bir servis (FastAPI, NestJS vb.) olarak yazılmayacak. HTTP katmanı
Next.js route handler'ları, ağır iş ise ayrı bir Node süreci olan BullMQ
işçisi; ikisi de `packages/core`'daki framework'süz alan mantığını kullanıyor.
Proje tek dilde, TypeScript'te kalıyor.

**Gerekçe:** Python'ın bu projedeki tek gerçek üstünlüğü Türkçe morfoloji
araçları (`zeyrek`, `zemberek`). Embedding avantajı yok — BGE-M3 zaten HTTP
üzerinden servis ediliyor, çağıran dilin önemi yok. Belge ayrıştırmada fark
marjinal. Buna karşılık ikinci bir dil; ikinci paket yöneticisi, test kurulumu
ve deploy hattı demek — ve K-04'teki şemanın hem Zod hem Pydantic'te
tanımlanması, yani iki tanımın sessizce ayrışma riski. Haftalık 20 saatlik
kapasitede bağlam değiştirme vergisi gerçek bir maliyet.

Programatik SEO sayfalarının (Faz 3, ana edinim kanalı) veriye doğrudan
erişebilmesi de Next.js'i API katmanı olarak tutmayı destekliyor; araya bir
HTTP backend girmesi her sayfa için ağ turu ve ek önbellek katmanı demek.

**Açık bırakılan kapı:** Değerlendirme setinde Türkçe eşleştirme kalitesi
yetersiz çıkarsa çözüm backend'i taşımak değil, yalnızca morfoloji için tek
uçlu küçük bir Python servisi eklemek olur — `core`'daki normalleştirme
arayüzünün arkasına takılır, çağıran kod değişmez. Dar ve geri alınabilir.

**Değerlendirilen alternatifler:** FastAPI backend + Next.js yalnızca frontend
(Türkçe NLP ekosistemi kazandırır, iki dilin maliyetini getirir) · NestJS/Fastify
ile ayrı TypeScript backend servisi (tek dil korunur ama bir servis, bir
Dockerfile ve bir API sözleşmesi daha; `core` framework'süz olduğu için
ileride mobil/üçüncü taraf API gerekirse etrafına sarmak birkaç saatlik iş).

---

## K-09 · Çıkarım çağrıları şimdilik sıralı kalıyor

**Tarih:** 23 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 1, Görev 6–13

CV çıkarımının dört çağrısı (bölümleme, deneyim, eğitim, beceri) ve ilan
çıkarımı sırayla çalışacak. Paralelleştirme Görev 13'te, değerlendirme
setinin süre verisine bakılarak yeniden değerlendirilecek.

**Bağlam:** Görev 4'te gerçek modelle iki ölçüm yapıldı — 3 alanlık basit bir
çıkarım 10,0 sn, gerçek bir CV'nin deneyim bloğu 17,6 sn (610 token). Bu
hızla beş ardışık çağrının toplamı kabaca 50 saniye; spec §13'teki
tamamlanma tanımı 30 saniye diyor.

**Gerekçe:** İki noktalı elle ölçümle optimizasyon kararı vermek erken.
Değerlendirme seti (Görev 13) zaten çift başına süre ölçüyor ve 10 gerçek
çiftte çalışacak; karar o veriyle verilecek. Erken paralelleştirme, kazancı
doğrulanmadan hatta eşzamanlılık karmaşıklığı ekler.

**Bilinen risk:** K1 karar kapısına (25 Ekim) 30 saniyenin üzerinde bir
süreyle gidilebilir. Bu durumda kapı "düzelt ve tekrar dene" verir ve
aşağıdaki sıradaki önlemler uygulanır.

**Hazır duran çözümler, sırasıyla:**

1. **Blok çağrılarını paralelleştir.** Bölümlemeden sonra deneyim, eğitim ve
   beceri çağrıları birbirini beklemiyor → `Promise.all`.
2. **CV ve ilan çıkarımını paralelleştir.** İkisi birbirinden tamamen
   bağımsız; hat ikisini aynı anda başlatabilir.
3. **Çağrı sayısını azalt.** Eğitim ve beceri tek çağrıda birleştirilebilir;
   ikisi de kısa bloklar.
4. **Model değiştir.** Sağlayıcı soyutlaması (K-03) bunu ucuz kılıyor.

Birinci ve ikinci maddeyle tahmin ~28 saniyeye iniyor. Ancak bu, LM Studio'nun
eşzamanlı istekleri gerçekten paralel işlemesine bağlı — tek modelli bir
örnekte istekler kuyruğa alınıyorsa kazanç gerçekleşmez. Paralelleştirmeye
geçilirse sıralı ve paralel hâl bir kez karşılaştırılmalı, kazanç
varsayılmamalı.

---

## K-10 · Bölümleme LLM'de kalıyor, prompt sıkılaştırıldı

**Tarih:** 23 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 1, Görev 6

CV'yi bölümlere ayırma işi LLM'de kalacak. Bölümleme prompt'u, başlık
satırlarının da bölüme ait olduğunu açıkça söyleyecek şekilde sıkılaştırıldı.

**Bulgu:** Görev 6'nın ilk tümleşik testinde model, ilk işin kurumunu
`"Kurum bilgisi yok"` olarak döndürdü — oysa CV'de "Acme Teknoloji" açıkça
yazılıydı. Katman katman tanı, sorunun çıkarımda değil **bölümlemede**
olduğunu gösterdi: `experienceBlock` yalnızca madde satırlarını içeriyordu,
kurum/unvan/tarih başlık satırı bloğa hiç girmemişti. İkinci aşama aslında
dürüst davranmıştı — olmayan bilgiyi uydurmak yerine yokluğunu bildirmişti
(şema `string` istediği için `null` yerine yer tutucu metin yazarak).

Kontrol deneyi kesindi: aynı prompt'a ham CV verildiğinde çıktı kusursuzdu
(`"Acme Teknoloji"`, `"Frontend Geliştirici"`, `"Ocak 2022"`, `"halen"`).
Yani model yetersiz değildi; spec §6.3'ün "bölme kayıpsızdır" varsayımı
tutmuyordu.

**Gerekçe:** En küçük müdahale seçildi. Prompt artık işin bir *kesme* işi
olduğunu, seçme işi olmadığını ve başlık satırlarının bölüme dahil olduğunu
örnekle söylüyor. Tümleşik test kurumun "Acme" olduğunu doğruluyor; bu bir
gerileme koruması olarak duruyor.

**Kabul edilen risk:** Çözüm modelin talimatı izlemesine bağlı kalıyor. Başka
bir CV'de başka bir bilginin düşmesi mümkün ve bunu ancak Görev 13'teki
değerlendirme setinde fark ederiz — 10 çiftin çeşitliliği bu yüzden önemli.

**Değerlendirilen ve saklanan alternatif (A):** Bölümlemeyi kodla yapmak.
CV bölüm başlıkları sayılabilir bir küme (`DENEYİM / TECRÜBE / EXPERIENCE`,
`EĞİTİM / EDUCATION`, `BECERİLER / YETKİNLİKLER / SKILLS`); düzenli ifadeyle
bölmek kayıpsız, bedava ve anlık olurdu. Bir LLM çağrısı eksilirdi: yaklaşık
10 saniye kazanç (bkz. K-09) ve bir uydurma kaynağının tümden ortadan
kalkması. Eval'de bölümleme kaynaklı kayıp tekrar görülürse ilk başvurulacak
çözüm budur. Onun da tutmadığı yerde (başlıksız CV'ler) geri çekilme yolu,
bölümlemeyi tümüyle bırakıp her çıkarıcıya ham CV'yi vermektir.

---

## K-11 · İlan çıkarımı iki çağrı: gereksinimler, sonra anahtar kelimeler

**Tarih:** 23 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 1, Görev 7

İlan çıkarımı tek çağrı değil iki çağrı olacak. Birincisi gereksinim listesini
çıkarır (`text`, `type`, `importance`), ikincisi o listeye hizalı anahtar
kelime listeleri üretir.

**Bulgu:** Tek çağrılı tasarımda model altı gereksinimin yalnızca dördünü
döndürüyordu ve düşenler **her seferinde "Tercihen" bölümündekiler**, yani
tüm `nice` gereksinimlerdi. Hem skor yanlış hesaplanır hem eksik anahtar
kelime listesi eksik kalırdı.

**Kök neden izolasyonu:** İlk hipotez ("model tercihen bölümünü gereksinim
saymıyor") çürüdü — prompt'a açık talimat eklemek hiçbir şeyi değiştirmedi ve
yalnızca "Tercihen" bölümü verildiğinde model ikisini de doğru `nice` olarak
çıkardı. İkinci hipotez (`max_tokens` sınırı) de çürüdü: `finish_reason: stop`
geliyordu ve açık `max_tokens` sonucu değiştirmedi. Şema karmaşıklığını
değiştirerek ölçüldü:

| Deneme | Sonuç |
|---|---|
| Basit şema + kısa prompt | 6/6 |
| Basit şema + uzun prompt | 6/6 |
| Ara şema, `keywords` çıkarılmış + uzun prompt | 6/6 |
| Tam şema + kısa prompt | 4/6, hiç `nice` yok |
| Tam şema + uzun prompt | 4/6, hiç `nice` yok |

Prompt uzunluğu alakasızdı. Kırılma noktası tek bir alandı: **gereksinim
nesnesinin içindeki `keywords` dizisi.** Dizi içinde dizi, küçük model için
fazla geliyor ve dış liste erken kapanıyor. Spec §11'in öngördüğü durum:
"şemanın küçük model için fazla karmaşık olduğunun sinyali."

**İkinci çağrının biçimi de ölçülerek seçildi.** İki aday karşılaştırıldı:
`items[{text, keywords}]` 200 token harcadı ve gürültü üretti (`"3 yıl
deneyim"`, `"strong typescript knowledge"`, `"typesript"`); düz
`keywords: string[][]` 83 token harcadı, terimler daha temiz çıktı ve Türkçe
karşılıklar korundu. Düz biçim seçildi.

**Hizalama:** İkinci çağrının sıra ve sayıyı koruması garanti değil. Eksik
kalan gereksinim anahtar kelimesiz bırakılıyor; skorlamada anlamsal
eşleşmeye düşüyor, sessizce yanlış eşleşmiyor. Birim testi bunu kapsıyor.

**Değerlendirilen alternatif (B):** Anahtar kelimeleri LLM'den hiç almayıp
gereksinim metnini Türkçe normalleştirmeden geçirerek kodla türetmek. Ek
çağrı gerekmezdi, ama `"En az 3 yıl React deneyimi"` → `[react, deneyim, yıl]`
gibi bir liste çıkar ve "deneyim" hemen her CV'de geçtiği için yanlış pozitif
üretirdi — uydurma eşleşme, kaçırmadan zararlıdır. Ayrıca modelin ürettiği
çapraz dilli varyantlar (`versiyon kontrol` ↔ `version control`) ürünün çift
dil vaadine doğrudan hizmet ediyor; kodla türetilen köklerle elde edilemezdi.

**Süre etkisi:** İlan çıkarımı 10,8 sn → 21,1 sn. K-09'daki süre baskısını
artırıyor; oradaki ikinci önlem (CV ve ilan çıkarımını paralelleştirmek) bu
ek çağrıyı toplama hiç eklemeyeceği için etkisi telafi edilebilir.

---

## K-12 · Embedding ayrı sunucuda: Ollama + BGE-M3

**Tarih:** 23 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 1+

Embedding modeli üretken modelden ayrı bir sunucuda çalışacak: BGE-M3,
Ollama üzerinden (`http://localhost:11434/v1`). Üretken model LM Studio'da
kalıyor. Yapılandırmada `EMBEDDING_BASE_URL` ayrı bir değişken olarak duruyor.

**Bağlam:** K-05 embedding modeli olarak BGE-M3'e karar vermişti, ama LM
Studio'nun model aramasında "bge-m3" terimiyle çıkmıyor (GGUF sürümleri
HuggingFace'te `gpustack/bge-m3-GGUF` gibi depolarda mevcut ve `lms get`
doğrudan URL ile indirebiliyor). Ollama'nın kütüphanesinde ise tek komutla
duruyor.

**Gerekçe:**

1. **Kuantizasyon tuzağı ortadan kalkıyor.** LM Studio yolunda Q2'den FP16'ya
   altı varyant arasından seçim yapmak gerekiyordu. Embedding modellerinde
   kuantizasyon üretken modellere göre çok daha fazla zarar verir — vektör
   uzayı bozulur ve benzerlik eşiği yanıltıcı hâle gelir. `ollama pull bge-m3`
   doğru varyantı getiriyor.
2. **İki sunucuyu ayırmak doğru mimari.** Önceki hâlde
   `embeddingConfigFromEnv()` `LLM_BASE_URL`'i yeniden kullanıyordu; bu sessiz
   bir kuplajdı. K-09'daki süre baskısı nedeniyle üretken modeli değiştirmemiz
   gayet olası ve o değişikliğin embedding tarafına dokunmaması gerekiyor.

**Bedeli:** Geliştirirken iki süreç ayakta olmalı (LM Studio + Ollama).
Dağıtım açısından fark yok; ikisi de yalnızca geliştirme ortamında.

**Reddedilen alternatif:** HuggingFace + sentence-transformers ile ayrı bir
Python servisi. K-08 tam olarak bunu dışlıyor ve burada hiçbir kazancı yok —
embedding zaten HTTP üzerinden servis edilen bir şey, çağıran dilin önemi yok.

### Ölçüm: eşik 0.65 büyük ihtimalle yüksek

Gerçek BGE-M3 ile ölçülen gereksinim ↔ kanıt benzerlikleri:

| Çift | Benzerlik | Beklenen |
|---|---|---|
| "React deneyimi" ↔ "React ve TypeScript ile panel geliştirdim" | 0.6383 | eşleşme |
| "Takım çalışmasına yatkın" ↔ "4 kişilik ekipte kod inceleme sürecini kurdum" | 0.5049 | eşleşme |
| "Bilgisayar mühendisliği mezunu" ↔ "İTÜ, Bilgisayar Mühendisliği" | 0.6716 | eşleşme |
| "Kubernetes ile konteyner yönetimi" ↔ "React ile arayüz geliştirdim" | 0.4445 | eşleşmeme |
| "SAP deneyimi" ↔ "Sayfa yüklenme süresini düşürdüm" | 0.4585 | eşleşmeme |

Ayrım mevcut (eşleşenler 0.50–0.67, eşleşmeyenler 0.44–0.46) ama marj ince
(0.046) ve eşik 0.65 gerçek eşleşmelerin çoğunun üstünde kalıyor. Değer
**şimdilik değiştirilmedi**: beş elle üretilmiş çifte göre ayar yapmak, Görev
13'teki 10 gerçek çifte göre ayar yapmanın yerini tutmaz ve aşırı uyum
riski taşır. Eşiğin düşürülmesi (muhtemelen 0.50 civarına) Görev 13'ün işi.

Not: "React deneyimi" gibi vakalar zaten birinci aşamada — tam kelime
eşleşmesinde — yakalanıyor. Anlamsal katman esas olarak kişisel özellik
(soft) gereksinimlerinde devreye giriyor ve marjın en ince olduğu yer de
orası.

### Ek ölçüm

- Embedding çağrıları hızlı: üç testin tamamı 761 ms. LLM çağrılarının
  yanında ihmal edilebilir; K-09'daki süre sorununa katkısı yok.
- Çapraz dilli eşleşme çalışıyor: "experience with version control systems"
  ↔ "Git ile versiyon kontrolü kullandım" = 0.6840. Ürünün çift dil vaadi
  bu davranışa dayanıyor.

---

## K-13 · Kanıt metni ikiye ayrıldı; anahtar kelimeler daraltıldı

**Tarih:** 23 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 1, Görev 7 ve 10

`Evidence` artık iki metin taşıyor: `text` (gömme ve kullanıcıya gösterim,
bağlamlı) ve `matchText` (tam kelime eşleşmesi, bağlamsız). Ayrıca her iş için
unvan kendi kanıt kaydına sahip (`kind: "role"`). Anahtar kelime üretimi
prompt'u, üst kategori ve ekosistem sızıntısını yasaklayacak şekilde
daraltıldı.

**Bulgu:** İlk uçtan uca çalıştırmada "Next.js deneyimi" gereksinimi
eşleşmişti ama kanıt olarak Next.js'ten hiç bahsetmeyen bir madde
gösteriliyordu:

```
✓ [nice] Next.js deneyimi  (keyword 1.00)
    kanıt: Frontend Geliştirici · Acme Teknoloji: React ve TypeScript ile
           müşteri self servis panelini sıfırdan geliştirdim
```

**İki ayrı sorun üst üste binmişti.**

*Birincisi, modelin ürettiği anahtar kelimeler:*
`["next.js","nextjs","fullstack","frontend","backend"]`. `frontend`, Next.js'in
eş anlamlısı değil üst kategorisi; bu liste "frontend geliştiricisi olan
herkes Next.js biliyor" demeye geliyor.

*İkincisi, bizim kanıt yapımız:* Deneyim maddelerine anlamsal eşleşme kalitesi
için unvan ön eki ekliyorduk (`"Frontend Geliştirici · Acme: ..."`). Ön ek her
maddenin başında tekrarlandığı için, unvana denk gelen bir anahtar kelime
CV'deki TÜM maddelerle eşleşiyor ve kanıt olarak ilki — yani rastgele biri —
gösteriliyordu.

**İkisi de düzeltildi, çünkü biri tek başına yetmiyordu.** Yalnızca prompt
düzeltilseydi, model yarın başka bir geniş kelime ürettiğinde aynı
rastgele-kanıt davranışı tekrarlardı. Yalnızca yapı düzeltilseydi, `frontend`
anahtar kelimesi bu sefer CV'deki "frontend" becerisiyle eşleşir ve yine
yanlış pozitif üretirdi.

**Prompt iki turda daraltıldı.** İlk tur üst kategorileri yasakladı; Next.js
düzeldi ama React için `["react","javascript","js"]` üretmeye devam etti —
yani ekosistem sızıntısı sürüyordu. İkinci tur bunu da yasakladı ("React için
javascript yazma, Django için python yazma, Spring için java yazma: o dili
bilen herkes o teknolojiyi biliyor sayılamaz"). Sonuç temiz.

**Gerileme koruması:** Üç birim testi bu davranışı kilitliyor — unvanın ayrı
kanıt olduğu, madde kanıtının eşleşme metninin ön ek taşımadığı, ve bağlam
ön ekindeki bir kelimeyle eşleşen gereksinimin kanıt olarak rol kaydını
göstermesi.

**Ölçüm:** Düzeltme sonrası uçtan uca skor 75; "Next.js deneyimi" artık kanıt
olarak CV'deki `Next.js` becerisini gösteriyor. Kalan tek kaçırma "Takım
çalışmasına yatkın" ve sebebi bilinen eşik sorunu (K-12).

---

## K-14 · Metin çıkarma worker'da, web katmanında değil

**Tarih:** 24 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 1, Görev 12

PDF/DOCX metin çıkarma işi worker'da yapılıyor. API route dosyayı kaydedip
kuyruğa devrediyor; `Resume.rawText` boş oluşturuluyor ve worker ilk
ihtiyaç duyduğunda dosyadan çıkarıp kaydediyor.

**Gerekçe:** Spec §4.2 zaten bunu söylüyordu — "İş mantığı API route'larında
bulunmaz; route'ların tek işi doğrulama ve kuyruğa devretmektir." İlk
uygulamada çıkarmayı route'a koymuştum, gerekçem kullanıcı deneyimiydi:
okunamayan dosyayı kuyruğa atmadan bildirmek. Gerekçe makuldü ama ilkeden
sapmaydı ve teknik bir duvara çarptı.

**Teknik zorunluluk:** `pdf-parse`'ın kullandığı `pdfjs-dist`, Next'in RSC
sunucu katmanında yüklenemiyor — `Object.defineProperty called on non-object`
ile düşüyor. İzole edilerek doğrulandı: aynı katmanda `mammoth` sorunsuz
yükleniyor, `pdf-parse` yüklenmiyor. `serverExternalPackages` listesine
eklemek de çözmüyor.

**İki değişiklik yapıldı:**

1. `extractText` içinde `pdf-parse` artık tembel yükleniyor
   (`await import("pdf-parse")` fonksiyon gövdesinde). Üst seviyede import
   edilirse `@uyarla/core`'un barrel export'unu import eden HER Next dosyası
   bu hatayı alır — yalnızca PDF işleyenler değil. Yan fayda: pdfjs ağır bir
   bağımlılık, yalnızca gerektiğinde yükleniyor.
2. Çıkarma `prismaStore.getResumeText` içine taşındı: metin boşsa dosyadan
   çıkarılıp kaydediliyor. Hat (pipeline) değişmedi — metnin nereden geldiği
   zaten port'un arkasında.

**Kabul edilen değişim:** Okunamayan dosya artık anında değil, iş başarısız
olduğunda bildiriliyor. Kullanıcı birkaç saniye daha bekliyor ama mesaj aynı
ve arayüz `failed` durumunu zaten gösteriyor.

### Yan bulgu: dosya yolları mutlak olmalı

İlk denemede worker dosyayı bulamadı: `ENOENT: no such file or directory,
open 'storage/6e01f0b9-....pdf'`. `STORAGE_DIR=./storage` göreli bir yol ve
iki süreç farklı çalışma dizinlerinde çalışıyor — web `apps/web/` altına
yazıyor, worker `apps/worker/` altında arıyordu.

`LocalFileStore.save` artık `resolve()` kullanıp mutlak yol döndürüyor;
`Resume.filePath` mutlak saklanıyor ve hangi dizinden okunduğu fark etmiyor.
Testi var. Bu, K-02'deki iki süreçli mimarinin ortaya çıkardığı türden bir
hata: tek süreçte hiç görünmezdi.

### Yan bulgu: Next yapılandırması

- `transpilePackages`: `@uyarla/core`, `@uyarla/db`, `@uyarla/worker` kaynak
  TypeScript olarak yayımlanıyor.
- `webpack.resolve.extensionAlias`: TypeScript ESM'de kaynak dosyalar
  birbirine `.js` uzantısıyla import edilir (`./errors.js` aslında
  `errors.ts`). `tsx` ve `vitest` bunu kendiliğinden çözüyor, webpack
  çözmüyor.
- `serverExternalPackages`: `@prisma/client`, `bullmq`, `ioredis`.
  Paketlenmeleri hâlinde yerel eklenti ve CJS/ESM karışımı yüzünden
  düşüyorlar. `mammoth` bu listede değil — saf JavaScript ve dışarıda
  bırakılınca ara katman bozuluyor.

---

## K-15 · Anlamsal eşleşme eşiği 0.65'te kalıyor

**Tarih:** 24 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 1+

`semanticThreshold` 0.65 olarak kalıyor. K-12'deki "muhtemelen yüksek,
düşürülmeli" beklentisi **değerlendirme verisiyle çürüdü**.

**Ölçüm:** Eşik taraması (`pnpm eval:sweep`) — çıkarım ve gömme her çift için
bir kez yapılıp skor fonksiyonu farklı eşiklerle tekrar çalıştırıldı.

| Eşik | İsabet % | Kaçırma | Uydurma | Anlamsal eşleşme |
|---|---|---|---|---|
| 0.35 | 71.4 | 0 | **4** | 6 |
| 0.45 | 78.6 | 0 | **3** | 5 |
| 0.50 | 71.4 | 1 | **3** | 4 |
| 0.55 | 85.7 | 1 | **1** | 2 |
| 0.60 | 78.6 | 2 | 1 | 1 |
| **0.65** | **85.7** | 2 | **0** | 0 |
| 0.70 | 85.7 | 2 | 0 | 0 |

Eşiği düşürmek anlamsal eşleşme kazandırıyor ama **uydurma ödetiyor** ve net
isabet artmıyor. 0.65 en iyi isabeti sıfır uydurmayla veriyor.

K-12'deki hata tek yönlü bakmaktı: kaçırılan eşleşmeler görülüyordu ("Takım
çalışmasına yatkın" 0.5049), kazanılan yanlış eşleşmeler görülmüyordu.
Değerlendirme seti ikisini birden saydığı için tabloyu tersine çevirdi.

**Rahatsız edici sonuç:** Anlamsal katman bu veriyle **hiçbir katkı
yapmıyor** — 0.65'te sıfır eşleşme üretiyor. Skorun tamamı şu an kelime
eşleşmesinden geliyor. Katmanın hak ettiği yeri kazanması için ya daha iyi
bir sinyale ya da farklı bir kullanıma ihtiyacı var; örneğin yalnızca `soft`
türü gereksinimlerde devreye girmesi. Karar daha fazla çiftle verilmeli.

**Örneklem uyarısı:** 2 çift, 14 beklenti. Bu sayıyla eşik kararı geçicidir.
Set 10 çifte çıktığında tarama tekrarlanmalı.

---

## K-16 · 30 saniye hedefi yerel modelle ölçülemez

**Tarih:** 24 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 1, K1

Spec §13'teki "30 saniyenin altında skor dönüyor" ölçütü, geliştirme
ortamındaki yerel modelle değerlendirilemez. Ölçüt üretim modeline taşınıyor.

**Ölçüm:** Gerçek bir CV (3144 karakter) ve gerçek bir ilan (10.293 karakter)
için:

```
CV çıkarımı   : 68,5 sn (53%)  3270 token
ilan çıkarımı : 59,3 sn (46%)  4520 token · 15 gereksinim
embedding     :  1,0 sn  (1%)
TOPLAM        : 128,9 sn
```

**Darboğaz çağrı sayısı değil, modelin ham hızı:** ~7800 token / 129 saniye
≈ **61 token/saniye**. Bu, `google/gemma-4-e4b`'nin bu makinedeki hızı.

**K-09'daki paralelleştirme çözümü ölçüldü ve yetersiz çıktı.** Üç eşzamanlı
çağrı sıralıya göre yalnızca **1,29x** kazandırıyor — LM Studio istekleri
büyük ölçüde kuyruğa alıyor. K-09'da bu belirsizlik kayıtlıydı ("kazanç
gerçekleşmeyebilir"); gerçekleşmiyor. 30 saniyeye inmek için ~4x gerekiyor.

**Gerekçe:** Yerel model K-03 gereği *iterasyon* için seçildi, performans
doğrulaması için değil. Üretimde barındırılan bir model bu token hacmini
saniyeler içinde işler. Yerel hızı ürün ölçütü saymak, ölçütü yanlış yerde
ölçmek olur.

**Sonuç:** 30 saniye ölçütü üretim modeline geçildiğinde ölçülecek, o zamana
kadar açık kalıyor. Değerlendirme betiği süreyi raporlamaya devam ediyor;
asıl işlevi mutlak hedef değil, **model ve prompt değişikliklerinin göreli
etkisini** göstermek.

**Yine de uygulanabilir iyileştirmeler (üretim modelinde de değerli):**

1. Eğitim ve beceri çıkarımını tek çağrıda birleştirmek — ikisi de kısa
   bloklar; 5 çağrı 4'e iner.
2. İlan çıkarımına ilanın tamamı yerine gereksinim bölümlerini vermek —
   10.293 karakterin önemli kısmı şirket tanıtımı ve yan haklar.
3. Prompt'ları kısaltmak; her çağrıda sistem yönergesi de token harcıyor.

---

## K-17 · Beceri çıkarımı kategorili CV'lerde kırılıyordu

**Tarih:** 24 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 1, Görev 6

`SKILLS_PROMPT` kategori başlıklarını değil, altlarındaki becerileri
çıkaracak şekilde düzeltildi.

**Bulgu:** Gerçek bir CV ilk kez test edildiğinde skor **14** çıktı. Sebebi
çıkarımdı: CV'nin beceri bölümü kategorilere ayrılmıştı ve model yalnızca
başlıkları döndürüyordu.

```
CV'de:    AI / LLM
          LLMs, Generative AI, RAG, AI Agents, MCP, prompt engineering, tool calling
          Backend
          Python, FastAPI, REST APIs, SSE, PostgreSQL

Çıkarılan: ["AI / LLM", "Backend", "Frontend", "DevOps / Tools"]
```

İlan tam olarak `RAG`, `MCP` ve `tool calling` arıyordu; üçü de CV'de vardı ve
üçü de atılmıştı.

**Düzeltme:** Prompt artık kategori başlıklarını yazmamayı örnekle söylüyor.
Ölçüldü: aynı blokta **4 beceri → 21 beceri**. Gerileme koruması olarak
gerçek CV bloğuyla bir tümleşik test eklendi.

**Ders:** Sentetik test verisi bu hatayı hiç göstermemişti; benim yazdığım
örnek CV'lerin beceri bölümü düz listeydi. Gerçek CV'ler biçim olarak çok
daha çeşitli ve değerlendirme setinin gerçek veriden kurulması bu yüzden
şart.

---

## K1 · Karar kapısı değerlendirmesi

**Tarih:** 24 Eylül 2026 · **Karar: DÜZELT VE TEKRAR DENE**

Yol haritası §4'teki geçiş ölçütü: *"10 test CV–ilan çiftinde çıkarım
doğruluğu elle kontrolde tatmin edici, uydurma içerik yok."*

### Ölçüt karşılandı mı

| Ölçüt | Durum | Kanıt |
|---|---|---|
| Uydurma içerik yok | **✓ Karşılandı** | Eval'de uydurma **0**; eşik taraması uydurmayı sıfırda tutan değeri seçti |
| Çıkarım doğruluğu tatmin edici | **Kısmen** | İsabet %85,7 — ama 14 beklenti üzerinden |
| 10 çift | **✗ Karşılanmadı** | Elde **2** çift var |
| 30 saniye altı | **✗ Ölçülemedi** | Yerel modelle 129 sn; ölçüt üretim modeline taşındı (K-16) |
| Birim testleri geçiyor | **✓** | 139 birim + 11 tümleşik test |

### Karar

**Devam değil, "düzelt ve tekrar dene".** Sprintin teknik iskeleti ayakta ve
uçtan uca çalışıyor; eksik olan **veri**. İki çiftle alınan kalite kararları
(özellikle eşik) istatistiksel olarak anlamsız ve bunu K-15'te kayda geçtik.

Sprint 1'in asıl çıktısı hedeflenen "kalite doğrulandı" değil, şu oldu:
**ölçüm altyapısı kuruldu ve ilk gerçek veri dört hata ortaya çıkardı.** Bu
kötü bir sonuç değil; sentetik veriyle hiçbiri görünmüyordu.

### Sonraki adımlar, öncelik sırasıyla

1. **Değerlendirme setini 10 çifte çıkar.** Gerçek, izinli ve anonimleştirilmiş
   CV–ilan çiftleri. Meslek çeşitliliği şart: sentetik verinin gösteremediği
   biçim çeşitliliği (kategorili beceri bölümleri, düzyazı üsluplu ilanlar,
   iki sütunlu şablonlar) asıl risk kaynağı.
2. **Eşik taramasını tekrarla.** 10 çiftle K-15 yeniden değerlendirilmeli.
3. **Anlamsal katmanın kaderine karar ver.** Şu an sıfır katkı yapıyor.
   Ya kapsamı daralacak (yalnızca `soft` gereksinimler) ya sinyali değişecek
   ya da kaldırılacak — üçü de veriyle kararlaştırılmalı.
4. **Üretim modeliyle bir ölçüm al.** 30 saniye ölçütü ancak orada anlamlı
   (K-16). Sağlayıcı soyutlaması (K-03) bunu ucuz kılıyor.

### K1'de öğrenilen

Sentetik test verisi biçim çeşitliliğini göstermiyor. Dört hatanın üçü
(K-13 yanlış kanıt, K-17 beceri çıkarımı, K-11 eksik gereksinimler) ancak
gerçek veriyle ortaya çıktı. Değerlendirme setinin gerçek veriden kurulması
bir tercih değil, ön koşul.
