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

---

## K-18 · Anahtar kelime hizalaması sıraya değil metne dayanıyor

**Tarih:** 24 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 1, Görev 7

İlan çıkarımının ikinci çağrısı artık her anahtar kelime listesiyle birlikte
ait olduğu gereksinimin metnini de döndürüyor; hizalama bu metinle
doğrulanıyor. Eşleşme bulunamayan gereksinim anahtar kelimesiz bırakılıyor.

**Bulgu:** Değerlendirme seti genişletilirken saçma skorlar çıktı — bir AI
mühendisi CV'si bir AI mühendisi ilanına **5** puan aldı, aynı ilana bir
yazılım test mühendisi CV'si **20** aldı.

Sebep, anahtar kelimelerin bir gereksinim kaymış olmasıydı:

```
Gereksinim: "2+ years building LLM or agent systems"
   kw:      ["API", "arayüz programlama"]      ← 1. gereksinime ait

Gereksinim: "At least 5 hours overlap with PST timezone"
   kw:      ["LangGraph", "langgraph"]         ← 3. gereksinime ait
```

Model, ilk gereksinimin içindeki iki nokta üst üsteden sonraki listeyi
("APIs, services, data infrastructure, testing, CI/CD, on-call") ayrı
gereksinimler sayıp her birine anahtar kelime üretmişti. **Sayı tesadüfen
tuttuğu için** K-11'deki uzunluk kontrolü devreye girmedi.

Hata koşulluydu: beş ilandan yalnızca birinde, bileşik ve düzyazı üsluplu
gereksinimler olan İngilizce ilanda görüldü. Diğer dördünde hizalama
doğruydu.

**Düzeltme:** Şema `keywords: string[][]` yerine
`items: [{ text, keywords }]`. Eşleştirme önce tam metin, bulunamazsa
kapsama yoluyla (asgari 15 karakter sınırıyla, kısa metinlerin yanlış
eşleşmesini önlemek için) yapılıyor. Prompt'a ayrıca "iki nokta üst üsteden
sonraki listeyi parçalama, tek gereksinimdir" kuralı eklendi.

Ölçüldü: kırılan ilanda **12/12 gereksinim doğru hizalandı**, anahtar
kelimesiz kalan yok. Bileşik gereksinim artık tek parça kalıyor ve alt
maddeleri kendi anahtar kelimeleri oluyor.

**K-11'deki karar hatalıydı ve gerekçesi de kayıtlıydı.** O zaman iki biçim
ölçülmüş, `items[{text, keywords}]` 200 token harcadığı ve daha gürültülü
kelimeler ürettiği için reddedilmiş, düz dizi seçilmişti. Yanlış olan,
**token maliyeti için doğrulanabilirliği feda etmekti**: düz biçimde
hizalamanın doğru olduğunu kontrol etmenin hiçbir yolu yoktu, sessizce
kırıldığında da kimse fark etmedi.

**Ders:** Bir sıra varsayımına dayanan her yerde, o sıranın doğruluğunu
kontrol edecek bir alan taşımak gerekir. Maliyeti birkaç yüz token; yokluğun
maliyeti, ürünün ana çıktısının sessizce anlamsızlaşması.

Bu hatayı **değerlendirme seti yakaladı** — tam da kurulma amacı buydu.
Sentetik iki çiftlik sette görünmüyordu ve üretimde ancak kullanıcı
şikâyetiyle öğrenilirdi.

---

## K-19 · Beceri çıkarımı: model transkribe eder, yorumu kod yapar

**Tarih:** 24 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 1, Görev 6

Beceri çıkarımı artık modelden "beceri listesi" istemiyor; **satır satır
transkripsiyon** istiyor. Hangi parçanın beceri olduğu kararı kodda,
`flattenSkillLines` içinde veriliyor.

```
model döndürür:  { label: "Programming Languages", items: ["Java", "SQL"] }
                 { label: "Manual Testing", items: ["Performing regression testing."] }

kod karar verir: items kısa ve noktasız terimlerse → onlar beceridir
                 değilse → label beceridir
                 label bir bölüm başlığıysa → hiçbiri
```

**Bulgu:** K-17'deki düzeltmeden sonra bile beceri çıkarımı kırılmaya devam
etti. Değerlendirme setindeki bir test mühendisi CV'si üç ilanda da **0**
aldı; CV'de `Java`, `SQL`, `Selenium`, `JIRA`, `Postman` yazılı olmasına
rağmen hiçbiri çıkarılmamıştı.

Sebep, o CV'nin **iki ayrı beceri bölümü** olmasıydı:

```
Core Skills          → Test Case Design, Manual Testing…   (isim: açıklama)
Technical Skills     → Programming Languages: Java, SQL     (kategori: a, b, c)
```

Bölümleme doğru çalışıyordu — iki bölüm de `skillsBlock` içindeydi. Model,
bloğu tek bir liste sanıp **gruplardan yalnızca birini** döndürüyordu.

**Prompt ile çözülemedi.** İki farklı prompt denendi ve ikisi de yalnızca bir
grubu aldı — üstelik farklı grupları: mevcut prompt teknik becerileri alıp
anlatı becerilerini attı, yeni prompt tam tersini yaptı. Sorun ifade değil,
modelden **tek çağrıda hem yapıyı çözmesinin hem yorumlamasının** istenmesiydi.

Gruplu şema (`groups: [{ heading, skills }]`) denendi: iki grup da geldi ama
bu sefer iç kategorilerin adları beceri yerine geçti — yapı aslında üç
katmanlıydı (bölüm → kategori → beceri), şema iki katmanlıydı.

**Çözüm satır transkripsiyonu oldu.** Model satırları kusursuz kopyalıyor:
etiketler doğru, terimler doğru, hiçbir satır düşmüyor. Yorum kodda yapılınca
deterministik ve test edilebilir hâle geliyor — sekiz birim testi kuralı
kilitliyor.

**Ölçüm:**

| CV biçimi | Önce | Sonra |
|---|---|---|
| İki bölümlü (Core + Technical) | bir grup, 6 beceri | **8 beceri, iki grup da** |
| Kategorili (AI/LLM, Backend, …) | 4–21 arası oynak | **23 beceri, kategori sızmıyor** |

Prompt'a üç satır biçimi de öğretildi: `"Kategori: a, b, c"`,
`"Beceri: açıklama"` ve kategorinin kendi satırında olup terimlerin alt
satırda geldiği biçim. Sonuncusu eklenmeden kategori adları beceri olarak
sızıyordu — K-13'te uğraştığımız yanlış pozitif kaynağının aynısı.

**Genel ders — K-18'in devamı:** Modelden yorum istenirse hata sessiz olur;
transkripsiyon istenip yorum kodda yapılırsa hata testle yakalanır. Bu
projede aynı desen üç kez çıktı: gereksinim listesinin erken kapanması
(K-11), anahtar kelime hizalaması (K-18), beceri çıkarımı (K-19).

---

## K-20 · Dil ve sertifikalar beceri sayılmıyor

**Tarih:** 24 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 1, Görev 6

`flattenSkillLines` artık üç şeyi eliyor: bölüm başlıklarını (etiketin yanı
sıra **öğe** olarak geldiklerinde de), dil listesinde geçen değerleri ve
sertifika listesinde geçen değerleri.

**Bulgu:** Değerlendirme setindeki yeni mezun CV'sinin becerileri şöyleydi:

```
['DİLLER', 'B1 seviye İngilizce', 'SERTİFİKALAR / BELGELER',
 'Siber Güvenlik Programı Katılım Belgesi',
 'Bir Yazılım Etkinliği – Modern Yazılım Mühendisliği (2026)', ...]
```

O CV'de beceri bölümü **yok**. Bölümleme, diller ve sertifikalar bloklarını
`skillsBlock`'a koymuş, düzleştirme de hepsini beceriye çevirmişti.

**Doğrudan sonucu bir uydurma eşleşmeydi:** "Bilgisayar Mühendisliği veya
ilgili bölümlerden mezun" gereksinimi, `"Bir Yazılım Etkinliği – Modern
Yazılım Mühendisliği (2026)"` **katılım belgesiyle** eşleşti. Bir etkinlik
belgesi diploma değildir; bu tam olarak ürünün dürüstlük ilkesini çiğneyen
davranış.

Ayrıca `TECHNICAL SKILLS` başlığı beceri olarak sızıyordu — başlık filtresi
yalnızca `label` alanına bakıyordu, `items` içinde geldiğinde kaçırıyordu.

---

## K-21 · normalizeText "ı" harfini "i"ye katlıyor

**Tarih:** 24 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 1+

`normalizeText` Türkçe küçültmeden sonra "ı" harfini "i"ye katlıyor.
Ek listesi ve unvan sözlüğünün anahtarları da aynı katlamadan geçiyor.

**Bulgu:** K-20'yi düzeltirken `TECHNICAL SKILLS` başlığının filtreye
takılmadığı görüldü. Sebebi beklenmedikti:

```
"TECHNICAL SKILLS".toLocaleLowerCase("tr")  →  "technıcal skılls"
```

Türkçe küçültme "I"yı noktasız "ı" yapıyor. Türkçe için doğru davranış, ama
**CV'lerdeki büyük harfli İngilizce terimleri bozuyor.** CV'ler başlıkları ve
sık sık terimleri büyük harfle yazar; ilanlar küçük harfle. İki taraf
buluşamıyordu:

| CV'deki | İlandaki | Eşleşiyor muydu |
|---|---|---|
| `API VALIDATION` → `apı valıdatıon` | `api validation` | ✗ |
| `MANUAL TESTING` → `manual testıng` | `manual testing` | ✗ |
| `MICROSERVICES` → `mıcroservıces` | `microservices` | ✗ |
| `JIRA` → `jıra` | `jira` | ✗ |
| `CI/CD` → `cı cd` | `ci cd` | ✗ |
| `BİLGİSAYAR MÜHENDİSLİĞİ` | `bilgisayar mühendisliği` | ✓ |

Altı örnekten beşi kaçıyordu — ve bu hata **her CV'de** çalışıyordu, yalnızca
belirli biçimlerde değil.

**Çözüm:** Karşılaştırma amacıyla "ı" → "i". Katlama her iki tarafa da
uygulandığı için eşleştirme simetrisi korunuyor (K-08'deki simetri ilkesi).
Kaybedilen tek şey Türkçe'de ı/i ayrımı; iş ilanı ve CV sözlüğünde bu ayrımın
anlam değiştirdiği bir çift pratikte görülmüyor.

Ek listesi de katlanmak zorundaydı: aksi hâlde "sına" eki, katlanmış
"çalişmasina" köküyle eşleşmiyordu. Kaynakta okunabilir Türkçe biçimde
duruyor, karşılaştırma biçimine modül yüklenirken çevriliyor.

**Ders:** Yerel duyarlı küçültme, tek dilli bir varsayımdır. İki dilli veri
işleyen her yerde — ki bu ürünün tamamı öyle — her iki dilin kurallarının
birbirini nasıl bozduğu ayrıca düşünülmeli.

---

## K-22 · Bölümleme kodda yapılıyor; LLM bölümlemesi bırakıldı

**Tarih:** 24 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 1+
**K-10'un yerine geçer.**

CV'yi bölümlerine ayırma işi `segmentResume` ile kodda yapılıyor: başlıklar
düzenli ifadeyle tanınıyor, bölümler dört bloğa dağıtılıyor. LLM bölümlemesi
`{ segmenter: "llm" }` seçeneğiyle duruyor ama varsayılan değil.

**K-10'daki risk gerçekleşti.** Orada şöyle yazmıştık:

> *"Kabul edilen risk: Çözüm modelin talimatı izlemesine bağlı kalıyor. Başka
> bir CV'de başka bir bilginin düşmesi mümkün ve bunu ancak Görev 13'teki
> değerlendirme setinde fark ederiz."*

Fark edildi. Gerçek bir CV'de bölümleme şunu yaptı:

```
CV'deki bölüm          LLM'in koyduğu yer
─────────────────────  ────────────────────────
PROFILE            →   summaryBlock      ✓
EXPERIENCE         →   experienceBlock   ✓
EDUCATION          →   educationBlock    ✓
TECHNICAL SKILLS   →   experienceBlock   ✗
ADDITIONAL         →   skillsBlock       ✗
```

Son bölümü beceri sandı, asıl beceri bölümünü deneyimin içine gömdü. Sonuç:
CV'de açıkça yazan `MCP`, `tool calling`, `Python`, `Docker` hiç beceri
olarak çıkmadı ve "agent mimarileri" gereksinimi kaçırıldı.

### Ölçüm

Üç gerçek CV, iki yöntem, aynı çıkarıcılar:

| CV | Yöntem | Beceri | Süre | Token |
|---|---|---|---|---|
| cv-a | **kod** | **33** | **39s** | **1973** |
| cv-a | llm | 6 | 60s | 3233 |
| cv-b | kod | 18 | **41s** | **2260** |
| cv-b | llm | 19 | 74s | 3890 |
| cv-c | kod | 14 | **66s** | **2788** |
| cv-c | llm | 15 | 101s | 4499 |

Kod yolu her CV'de **%35–40 daha hızlı** ve **%40 daha az token** harcıyor —
bir LLM çağrısı eksildiği için. Beceri kalitesinde cv-a'da fark uçurum
(33'e 6: tüm TECHNICAL SKILLS bölümü geri geldi), diğer ikisinde başa baş.

### Deterministiklik

Sayılardan daha önemli olan bu: LLM bölümlemesi aynı CV'de her çalıştırmada
farklı sonuç veriyordu. Bugün aynı çıkarım üç kez yapıldı, üçünde de farklı
çıktı. Bu tek başına değerlendirme setini güvenilmez kılıyor — bir
değişikliğin etkisini mi yoksa modelin o seferki hâlini mi ölçtüğün ayırt
edilemiyor.

### Yan bulgu: cümle sızıntısı

Kod bölümlemesi, okuma sırası bozuk CV'lerde (iki sütunlu tasarımlar) deneyim
maddelerini beceri bloğuna taşıyabiliyor. Bu maddeler `flattenSkillLines`
içinde etiket olarak geliyordu ve terim ölçütü yalnızca öğelere
uygulanıyordu. Ölçüt artık etikete de uygulanıyor: kırk karakterden uzun ya
da nokta içeren metin terim değil cümledir.

### Sınır

Kod bölümlemesi de yanılabilir — tanınmayan başlıklı ya da hiç başlıksız
CV'lerde. Geri çekilme yolu var: başlık bulunamazsa ham metnin tamamı her
çıkarıcıya veriliyor, yani bugünkü davranıştan kötü değil. Ama fark şu:
**kod yanıldığında test kırmızı yanıyor, model yanıldığında sessizce yanlış
veri üretiyor.** Bugün beş kez ikincisini yaşadık.

**Genel ders — üçüncü kez doğrulandı:** deterministik bir işi dil modeline
vermek, ücretsiz olmayan bir kolaylık. Bölümleme metni başlığına göre kesmek
demek; yorum gerektirmiyor, o yüzden modele ait değil.

---

## K-23 · Kavram tabanlı skorlama; ikinci LLM çağrısı kaldırıldı

**Tarih:** 24 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 1+
**K-11 ve K-18'in yerine geçer.**

Gereksinimler artık **kavramlara** bölünüyor ve güven, karşılanan kavram
oranından hesaplanıyor. Bölme işi kodda (`splitIntoConcepts`), eşleştirme
kavram düzeyinde. İlan çıkarımının ikinci LLM çağrısı tümüyle kaldırıldı.

### Sorun: bileşik gereksinimler tam puan alıyordu

Değerlendirme setinde iki CV'yi yan yana koyunca görüldü:

```
Gereksinim: "Git ve CI/CD, Microservices, Docker ve Container teknolojileri"

AI mühendisi → Docker ✓ Git ✓            güven 1.00
yeni mezun   → yalnızca "Git & GitHub"    güven 1.00   ← aynı puan
```

Dört şey isteyen bir gereksinim, bir tanesini bilen adaya tam puan veriyordu.
İlanlar sık sık böyle yazılıyor; yeni mezunun 43 alması büyük ölçüde bundan.

### Neden düz anahtar kelime listesi yetmiyordu

Listeden "eş anlamlı" ile "ayrı bileşen" ayırt edilemiyor:

```
["react", "react.js", "reactjs"]              → aynı şey, biri yeter
["git", "ci/cd", "microservices", "docker"]   → dört ayrı şey
```

### Kavramlara bölme neden kodda

Model bu işte üç farklı biçimde üç farklı şekilde başarısız oldu:

| Şema biçimi | Sonuç |
|---|---|
| İç içe (`items → concepts → synonyms`) | Tüm gereksinimler var, **kavramlar eksik** (5 yerine 2) |
| Düz satır, sade prompt | **Tüm kavramlar var**, eş anlamlılar boş, terimler cümle gibi |
| Düz satır, sıkı prompt | **2 kavram**, liste ikinci gereksinimde kapandı |

Aynı ilanda kod bölmesi 5 kavram bulurken model 1 buluyordu:

```
"Generative AI Yetkinlikleri, OpenAI, Azure OpenAI, Anthropic Claude ve Gemini API"
  model → ["generative ai"]
  kod   → ["Generative AI","OpenAI","Azure OpenAI","Anthropic Claude","Gemini API"]
```

Bileşik bir gereksinimi parçalamak metin işlemedir: virgül, "ve", "and", iki
nokta üst üste. Yorum gerektirmiyor.

### Anlamsal eşleştirme kavram düzeyine indi

Eskiden koca bir gereksinim cümlesi bir CV maddesiyle karşılaştırılıyordu; bu
fazla kabaydı ve anlamsal katman hiçbir katkı yapmıyordu (K-15). Artık her
kavram ayrı gömülüyor ve ayrı aranıyor. Beklenen iki kazanç:

1. Karşılaştırma keskinleşiyor — `"version control"` ile `"Git ile versiyon
   kontrolü kullandım"` buluşabiliyor.
2. Çapraz dilli eşleşme sözlüğe elle yazmak yerine BGE-M3'e kalıyor; K-05'te
   modeli seçme gerekçemiz buydu ve ilk kez gerçekten kullanılıyor.

### Ağırlıklı katkı

Tam kelime eşleşmesi kesindir ve 1.0 katkı verir; anlamsal eşleşme bir
tahmindir ve benzerlik değeri kadar katkı verir. İkisine aynı ağırlığı vermek,
tahmini kesinlik gibi göstermek olurdu.

### Yan kazanç: bir LLM çağrısı daha eksildi

İlan çıkarımı iki çağrıdan tek çağrıya indi. Ayrıca K-18'deki hizalama
doğrulaması tümüyle gereksizleşti — iki çağrı olmayınca hizalanacak bir şey
de yok. O hata sınıfı tasarımdan kalktı.

Bugün toplam iki LLM çağrısı eksildi: bölümleme (K-22) ve anahtar kelime
üretimi (K-23).

**Genel ders — dördüncü kez:** Deterministik bir işi dil modeline vermek,
ücretsiz olmayan bir kolaylık. Bugün dört yerde aynı sonuca varıldı: hizalama
(K-18), beceri yorumu (K-19), bölümleme (K-22), kavramlara ayırma (K-23).

---

## K-24 · Eşik 0.65'te kalıyor — 10 çiftle doğrulandı

**Tarih:** 25 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 1+
**K-15'i doğrular ve genişletir.**

`semanticThreshold` 0.65. K-15'te 2 çift ve 14 iddiayla alınan geçici karar,
10 çift ve 56 iddiayla tekrarlandı ve aynı sonuç çıktı.

### Tarama

| Eşik | İsabet % | Kaçırma | Uydurma | Anlamsal eşleşme |
|---|---|---|---|---|
| 0.30 | 37.5 | 0 | **35** | 45 |
| 0.45 | 42.9 | 0 | 32 | 42 |
| 0.50 | 48.2 | 0 | 29 | 39 |
| 0.55 | 64.3 | 0 | 20 | 30 |
| 0.60 | 75.0 | 3 | 11 | 18 |
| **0.65** | **87.5** | 4 | **3** | 9 |
| 0.70 | 87.5 | 5 | 2 | 7 |

Eşiği düşürmek kaçırmayı sıfıra indiriyor ama uydurmayı 35'e çıkarıyor — yani
her şeyi eşleştirip hiçbir şey söylememiş oluyor.

**0.70 da düşünüldü:** aynı isabet, bir eksik uydurma, bir fazla kaçırma.
"Uydurma kaçırmadan zararlıdır" ilkesine göre marjinal olarak daha iyi, ama 56
iddiada bir birimlik fark gürültü sayılır. 0.65 tercih edildi çünkü skor
ayrışması daha geniş ve ürün açısından skorun ayırt edici olması önemli:

```
0.65 →  AI mühendisi CV'si: 32 · 25 · 15 · 32
        test mühendisi CV'si: 5 · 1 · 0
        yeni mezun CV'si: 20 · 6 · 18

0.30 →  hepsi 50–66 arası, ayrışma yok
```

### Anlamsal katman artık hak ettiği yeri kazanıyor

K-15'te şöyle yazmıştık:

> *"Rahatsız edici sonuç: Anlamsal katman bu veriyle hiçbir katkı yapmıyor —
> 0.65'te sıfır eşleşme üretiyor."*

Kavram düzeyine inince (K-23) aynı eşikte **9 eşleşme** üretiyor. Sorun
katmanda değil, karşılaştırmanın kabalığındaymış: koca bir gereksinim
cümlesini bir CV maddesiyle karşılaştırmak yerine kavramı karşılaştırınca
sinyal ortaya çıkıyor.

### Taban çizgisi

```
10 çift · 56 iddia
İsabet oranı   : 87.5%
Kaçırma        : 4
Uydurma        : 3
Çıkarılmayan   : 0
Eşleşme kaynağı: kelime 11 · anlamsal 9
```

Kalan 3 uydurmanın üçü de yeni mezun CV'sinde ve anlamsal eşleşmeden geliyor:
yapay zekâ eğitmenliği deneyimi, üretken yapay zekâ yetkinliği gereksinimine
yakın düşüyor. Sonraki iyileştirme turunun ilk adayı bu.

---

## K-25 · Çapraz dilli bölüm ve alan adları sözlüğe eklendi

**Tarih:** 25 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 1+

`TITLE_SYNONYMS` sözlüğüne bölüm ve alan adlarının çapraz dilli karşılıkları
eklendi: `software ↔ yazılım`, `engineering ↔ mühendislik`,
`computer ↔ bilgisayar`, `machine learning ↔ makine öğrenmesi`,
`data science ↔ veri bilimi`, `agent ↔ ajan`, `architecture ↔ mimari`.

**Gerekçe:** Değerlendirme setindeki **dört kaçırmanın üçü** aynı sebepten
geliyordu — ilan Türkçe "Yazılım Mühendisliği" derken CV İngilizce "B.Sc.
Software Engineering" yazıyor ve iki taraf buluşamıyordu. Ek soyma bu köprüyü
kuramaz; iki dilin kelimeleri arasında morfolojik ilişki yok.

K-08'de sözlük için şu kuralı koymuştuk:

> *"Başlangıç hâlidir ve tahminle şişirilmez: her ekleme, değerlendirme
> setinde görülmüş gerçek bir kaçırmayı kapatmalı."*

Bu ekleme o kuralın ilk uygulaması: eklenen her terim, ölçülmüş bir kaçırmayı
kapatıyor.

**Ölçüm:**

| | Önce | Sonra |
|---|---|---|
| İsabet oranı | 87.5% | **91.1%** |
| Kaçırma | 4 | **2** |
| Uydurma | 3 | 3 |
| Kelime eşleşmesi | 11 | 13 |

Uydurma sayısı değişmedi — yani sözlük yanlış pozitif üretmedi. Testler ayrıca
alakasız bölümlerin eşleşmediğini doğruluyor (`Endüstri Mühendisliği` ≠
`Bilgisayar Mühendisliği`, `Graphic Design` ≠ `Software Engineering`).

**Kalan 2 kaçırma ve 3 uydurma:** Üçü de yeni mezun CV'sinde ve anlamsal
eşleşmeden geliyor — yapay zekâ eğitmenliği deneyimi, üretken yapay zekâ
yetkinliği gereksinimine yakın düşüyor. Bu, eşik ayarıyla çözülecek bir şey
değil; gereksinimin "profesyonel deneyim" boyutunu değerlendirmek gerekiyor ve
sistem şu an bunu yapmıyor. Sonraki iyileştirme turunun konusu.
