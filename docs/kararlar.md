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

---

## K-26 · Onay zorunluluğu riske göre: uyarı varsa zorunlu, yoksa değil

**Tarih:** 25 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 2

Uyarlamada doğrulamayı geçen maddeler **kabul edilmiş** gelir; uyarı taşıyan
maddeler **karar bekler** ve karara bağlanmadan indirme açılmaz.

**Gerilim:** Marka rehberi §11 şunu diyor:

> *"Yapay zekâ şeffaflığı: Metinlerin yapay zekâ ile yeniden yazıldığı açıkça
> belirtilir ve kullanıcı her değişikliği onaylar."*

Harfi harfine uygulanırsa her madde için tek tek onay gerekir. Tipik bir CV'de
8–10 madde var; bu, marka rehberi §4'teki **Hız** değeriyle ve ürünün "başvuru
başına saniyeler" vaadiyle çelişiyor.

**Gerekçe:** Rehberin asıl derdi, kullanıcının bilmediği bir şeyin CV'sine
girmemesi. Doğrulamayı geçen bir madde, kullanıcının kendi cümlesinin yeniden
ifade edilmiş hâlidir ve farkı ekranda görünür; orada zorunlu onay gerçek bir
koruma sağlamaz, yalnızca sürtünme ekler. Uyarı taşıyan maddede ise onay
zorunludur ve **atlanamaz** — yani koruma rehberin öngördüğünden güçlüdür.

**Sonuç:** Marka rehberi §11 bu karara göre güncellenecek. Lafzından sapıyoruz
ama amacını daha iyi koruyoruz; sapma gerekçesiyle birlikte kayıtlı.

---

## K-27 · Beceriler yeniden yazılmaz, kodda sıralanır

**Tarih:** 25 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 2

Yol haritası §6.2 "özet, deneyim maddeleri ve **yetenekleri** yeniden yazma"
diyor. Beceriler yeniden yazılmayacak; ilana göre sıralanacak ve bu sıralama
kodda yapılacak.

**Gerekçe:** Bir beceri adını yeniden yazmanın kazancı yok — `React` →
`React.js` kimseye bir şey kazandırmıyor. Beceri **eklemek** ise doğrudan
uydurma, yani ürünün ana vaadinin ihlali. Buna karşılık sıralamanın kazancı
gerçek: ATS tarayıcıları listenin başındaki terimleri daha çok tartıyor.

Sıralama LLM gerektirmiyor: skor servisi hangi becerinin hangi gereksinimi
karşıladığını zaten biliyor (`RequirementResult.evidence`). Kural — önce
`must` karşılayanlar, sonra `nice` karşılayanlar, sonra kalanlar özgün
sırasıyla. Küme değişmediği için uydurma riski sıfır.

Sprint 1'in dersinin doğrudan uygulaması: deterministik bir işi modele vermek,
ücretsiz olmayan bir kolaylık (K-18, K-19, K-22, K-23).

---

## K-28 · Uydurma kontrolü üç deterministik kontrolle yapılıyor

**Tarih:** 25 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 2

Yeniden yazılmış her madde üç kontrolden geçer:

1. **Sayı kontrolü** — yazımdaki her sayı kaynakta da bulunmalı
   (`%40` → `%60` yakalanır)
2. **İlan terimi enjeksiyonu** — yazımda geçip kaynakta geçmeyen bir ilan
   kavramı varsa işaretlenir (`Kubernetes` eklenmesi yakalanır)
3. **Anlamsal sapma** (ikincil) — `cosine(yazım, kaynak)` eşiğin altındaysa
   işaretlenir (`katkı sağladım` → `liderlik ettim` yakalanır)

**Değerlendirilen ve reddedilen alternatifler:**

*Yalnızca anlamsal benzerlik:* Kör. "React ile panel geliştirdim" →
"Kubernetes ile panel geliştirdim" benzerlik olarak çok yakın ama teknoloji
değişmiş — tam da yakalanması gereken şeyi kaçırıyor.

*LLM hakem:* Modele "bu yazım kaynakta olmayan bilgi ekliyor mu" diye sormak.
Esnek, ama Sprint 1'de beş kez görülen sessiz hata riskini taşıyor: hakem
yanıldığında kimse fark etmez. Ürünün ana güvencesini doğrulanamayan bir
mekanizmaya bağlamak kabul edilemez.

**Neden ilk ikisi yeterli:** Uydurmanın zararlı biçimi somut. Kimse
"geliştirdim" yerine "hayata geçirdim" yazıldığı için işe alım sürecinde
yanmaz; olmayan bir teknoloji, şişirilmiş bir sayı ya da uydurulmuş bir unvan
yüzünden yanar. İlk iki kontrol tam olarak bunları yakalıyor ve **kullanıcıya
gösterilebilir gerekçe** üretiyor: *"Bu maddede Kubernetes geçiyor ama CV'nde
yok."*

İki kontrol de Sprint 1'in makinesini yeniden kullanıyor: `sourceRef` (ham
metindeki birebir karşılık), `containsKeyword` (Türkçe normalleştirme ve
çapraz dilli sözlükle birlikte) ve ilanın kavram listesi.

---

## K-29 · Tek şablon, PDF ve DOCX

**Tarih:** 25 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 2

Yol haritası "2 ATS dostu şablon, PDF ve DOCX" diyor; kapsam kesme sırası
(§12.2) ise gecikme hâlinde önce DOCX'in kesilmesini öngörüyor. **Sıra
tersine çevrildi:** tek şablon yapılacak, DOCX korunacak.

**Neden ikinci şablon değil:** Henüz hiç çıktı üretmiş değiliz ve birinci
şablonun gerçek ATS'lerden geçtiğini bilmiyoruz. İkinci şablon, doğrulanmamış
bir tasarımın kopyası olur. Sprint 1'in dersi: ölçülmeyen kalite, olmayan
kalitedir. Önce bir şablonu doğru yapıp gerçek bir tarayıcıya sokmak gerekir.

**Neden DOCX kesilmemeli:** Türkiye'de kurumsal İK süreçlerinin ve bazı ilan
sitelerinin hâlâ DOCX istediği biliniyor. "PDF indirdim ama sistem kabul
etmedi" yaşayan kullanıcı ürünü bırakır. Maliyeti de düşük: aynı ara yapıdan
(`DocumentModel`) ikinci bir üreteç yazmak, ikinci bir şablon tasarlamaktan
çok daha ucuz.

**Tarayıcı kullanılmıyor.** Puppeteer worker'a yüzlerce megabaytlık bağımlılık
ekler. ATS dostu çıktı zaten tek sütunlu ve sade bir yerleşim istiyor;
`pdfkit` ile doğrudan yazmak hem hafif hem metnin seçilebilir olmasını
garantiliyor. Marka rehberi §9.3 CV çıktılarında sistem fontu şart koştuğu
için tipografi özgürlüğüne de ihtiyaç yok.

## K-30 · CV çıktısında gömülü font

**Tarih:** 25 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 2

**Karar:** PDF çıktısında DejaVu Sans gömülüyor ve font dosyaları depoda
duruyor (`packages/fonts/ttf/`), modül çözümlemesiyle değil dosya sisteminden
bulunuyor.

**Ölçüm — neden gömülü font:** `pdfkit`'in gömülü Helvetica'sı WinAnsi
kodlaması kullanıyor ve `ş ğ ı İ` bu kodlamada yok.

```
Helvetica   → "æPyma Ça öÆ  1 ÿÏa_ 5@ANBUL Geli ÷F— ici"
DejaVu Sans → "Şeyma Çağlar ığüöş İSTANBUL Geliştirici"
```

Türkçe bir CV Helvetica ile okunaksız çıkıyor. Marka rehberi §9.3'e aykırı
değil: kural **marka fontunu** yasaklıyor, DejaVu sıradan bir sans-serif ve
serbest lisanslı.

**Neden dosya sisteminden:** Modül çözümlemesinin üç varyantı da Next'in
bundler'ında kırıldı.

| Yaklaşım | Sonuç |
|---|---|
| `require.resolve("…/X.ttf")` | webpack .ttf'i paketlemeye çalıştı, derleme düştü |
| Hesaplanmış specifier | çağrı `webpackEmptyContext` ile susturuldu, çalışma anında MODULE_NOT_FOUND |
| Ayrı paket + `serverExternalPackages` | monorepo paketinde uygulanmadı, göreli modül kimliği döndü |

İkincisi en tehlikelisiydi: **derleme geçiyor, indirme çalışma anında 500
veriyordu.** Derlemeyi susturan bir "düzeltme" hatayı gizlemişti; uçtan uca
deneme olmasa fark edilmezdi. Ders, Sprint 1'inkinin aynısı: derlemenin
geçmesi çalıştığı anlamına gelmiyor.

**Bilinen sınır:** Yol, `process.cwd()`'den yukarı yürünüp
`pnpm-workspace.yaml` aranarak bulunuyor; depo ağacının diskte durmasını
varsayıyor. Vercel'e standalone dağıtımda font dizini pakete girmeyebilir.
Seçenekler `docs/birikmis-isler.md` #9'da.

## K-31 · Ad ve başlık çıkarımı kodda

**Tarih:** 25 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 2

**Karar:** CV'nin ad, unvan ve iletişim satırı kodda çıkarılıyor; LLM çağrısı
eklenmedi.

**Sorun:** Sprint 1 bu alanları bilerek boş bırakmıştı — skor onları
kullanmıyordu ve kod bunu söyleyen bir yorum bile taşıyordu. Sprint 2'de
indirilen belgenin başlığı oldular ve **üretilen her CV'nin tepesinde
"İsimsiz" yazıyordu.** Hiçbir test kırmızıya dönmedi çünkü hiçbir test
belgenin başlığına bakmıyordu.

**Neden kodda:** "Hangi satır ad" sorusu deterministik kurallarla
cevaplanabiliyor. Modele sormak Sprint 1'in dört kez öğrenilen dersine
(K-11, K-18, K-19, K-22) aykırı olurdu: modelden yorum istendiğinde hatalar
sessiz oluyor ve şema doğrulamasından geçiyor.

**Kural dışlayıcı:** e-posta, bağlantı, rakam içeren veya 50 karakterden uzun
satır ad sayılmıyor. Yanlış ad, CV'nin en görünür yerinde yanlış bilgi demek;
şüphedeyken `null` daha dürüst ve satır atılmıyor, başlık satırına giriyor.

**Ölçüm iki düzeltme daha çıkardı:** "Professional Summary" başlık olarak
tanınmıyordu, ve özet metni `"PROFILE"` satırıyla başlıyordu (başlıklar
bloklara bilerek dahil — K-10 — ama özet belgeye olduğu gibi yazılıyor).

## K-32 · Madde yeniden yazımına ilan kavramları verilmiyor

**Tarih:** 26 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 2

**Karar:** `BULLET_PROMPT` modele yalnızca maddenin kendisini veriyor. İlanın
aradığı kavramlar prompt'a girmiyor.

**Ölçüm:** 10 çift, 93 madde.

| | Kavram verilerek | Kavram verilmeden |
|---|---|---|
| İşaretlenen madde | %63,4 (59/93) | **%4,3 (4/93)** |
| `posting_term_injected` | 165 | **1** |
| `semantic_drift` | 32 | 3 |
| `number_mismatch` | 7 | **0** |
| Skor değişimi (dürüst) | +0,0 | −0,1 |
| Skor değişimi (üst sınır) | +18,8 | +0,1 |

Kavramları vermek uydurmayı besliyordu ve karşılığında hiçbir dürüst kazanç
üretmiyordu.

**Daha büyük bulgu — dürüst skor kazancı sıfır.** Kavramlar verilirken bile,
doğrulamayı geçen maddelerin skora katkısı 10 çiftin 10'unda +0,0. Görünen
+18,8'in tamamı işaretli maddelerden, yani kullanıcının reddedeceği
içerikten geliyordu.

Bunun yapısal bir sebebi var: skorlama zaten Türkçe normalleştirme, çapraz
dilli sözlük ve anlamsal eşleşme kullanıyor. Adayda o yetkinlik varsa
**zaten eşleşiyor**; yoksa dürüst bir yeniden ifade onu ekleyemez. Skoru
artıran tek mekanizma uydurma.

**Sonucu:** Marka rehberi §6.2'deki "%41'den %83'e" örneği ve spec §10'un
"skor yükselir" beklentisi bu veriyle desteklenmiyor. Uyarlamanın sattığı
şey skor artışı değil: ilanın diliyle hizalanmış anlatım, ATS dostu belge ve
eksik kavram listesi. Arayüz skoru dürüstçe gösteriyor ve değişmediğinde
bunu söylüyor. Vaadin kendisi ürün kararı olarak K2'de ele alınmalı.

## K-33 · Anlamsal sapma eşiği 0.70

**Tarih:** 26 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 2

**Karar:** `driftThreshold = 0.70`.

**Tarama** (93 madde, K-32 sonrası prompt):

| Eşik | İşaretlenen | Sapma | Enjeksiyon |
|---|---|---|---|
| 0.65 | %1,1 | 0 | 1 |
| 0.70 | %1,1 | 0 | 1 |
| 0.75 | %4,3 | 3 | 1 |
| 0.80 | %15,1 | 13 | 1 |
| 0.85 | %37,6 | 35 | 1 |

**Gerekçe:** 0.75'te tetiklenen üç maddenin **üçü de yanlış alarmdı** —
sadık İngilizce→Türkçe çeviri. En düşük benzerlikler 0,749 / 0,779 / 0,787
ve hepsi kaynakla aynı işi anlatıyor. BGE-M3 çapraz dilli, ama çevrilmiş bir
cümle yine 0,75–0,79 bandında kalıyor.

0.70 bu veride hiç tetiklenmiyor ve gerçekten savrulmuş bir yeniden yazım
için emniyet supabı olarak duruyor.

**Uyarı:** Kontrol bu sette hiç gerçek pozitif üretmedi. Değeri
kanıtlanmadı; spec §16'daki kesme sırasında hâlâ ikinci sırada.

**Reddedilen:** 0.85 — işaretlenen oranı %37,6'ya çıkıyor ve hepsi çeviri
kaynaklı yanlış alarm. Her işaretli madde kullanıcıyı durdurduğu için bu
akışı kullanılamaz kılardı.

## K-34 · Kimlik katmanı Better Auth ile, magic link tek yöntem

**Tarih:** 26 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 3A

**Karar:** Better Auth 1.7.x, `magic-link` + `anonymous` + `prisma-adapter`
eklentileriyle. Tek giriş yöntemi magic link.

**Neden Auth.js değil:** `next-auth` v5 iki yıldır beta (`5.0.0-beta.32`) ve
beta'lar arası kırıcı değişiklik yapıyor; stabil v4 ise App Router öncesi.
Ödeme alacak bir ürünün kimlik katmanını beta'ya bağlamak istemedik.

**Neden Better Auth:** `anonymous` eklentisi huninin en riskli parçasını hazır
veriyor — `onLinkAccount` kayıt anında tetikleniyor ve anonim kullanıcının
işini devralmayı sağlıyor. Paket içeriği açılıp doğrulandı, tahmine
dayanmadı.

**Neden parola yok:** Unutulacak bir şey yok, sızacak bir şey yok, ve tek
seferlik CV uyarlaması için parola kurmak gereksiz sürtünme.

**Reddedilen:** Kendi yazmak — oturum güvenliği, CSRF, token hash'leme,
zamanlama saldırıları sessizce yanlış yapılabilir; üstelik Google'ı sonra
eklemek OAuth'u da kendimiz yazmak demekti.

**Şema elle yazılmadı**, `@better-auth/cli generate` ile üretildi. CLI iki
yerde plandaki tahminden ayrıldı (`isAnonymous` nullable çıktı, `@@map`
direktifleri eklendi) — bu yüzden plan baştan "CLI doğrudur" kuralını
taşıyordu.

## K-35 · Yetkisiz erişimde 404, 403 değil

**Tarih:** 26 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 3A

**Karar:** Başkasının kaynağına erişim denemesi 404 döner. Sahipsiz kaynak da
404.

**Gerekçe:** 403 "bu kaynak var ama senin değil" demek, yani varlık bilgisi
sızdırır. Uyarlama kimlikleri cuid ve tahmin edilmesi zor, ama bilgiyi
vermenin hiçbir faydası yok.

**Aynı ilkenin ikinci uygulaması:** Uyarlama başlatma ucunda kayıt kontrolü
kaynağı **aramadan önce** yapılıyor. İlk yazılan sırada varlık kontrolü
öndeydi ve anonim kullanıcı geçersiz kimlikte 400, geçerlide 401 alıyordu —
yanıt kodundan "bu analiz var" okunabiliyordu. Canlı deneme gösterdi.

**Sahiplik `Analysis` ve `JobPosting`'e ayrı alan olarak eklendi.** Zincirden
türetmek çalışmıyor: `Analysis.resumeVersionId` nullable ve çıkarım patlayan
analizler sahipsiz kalırdı. `Adaptation`'a eklenmedi — `analysisId` benzersiz
ve `loadAdaptation` analizi zaten `include` ediyor.

**Analiz durumu ucundaki kontrol özellikle kritik:** BullMQ iş kimliği artan
tam sayı, yani `/api/analyze/7` tahmin edilebilir.

## K-36 · Silme tek işlemde, dosyalar işlemden sonra

**Tarih:** 27 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 3B / KVKK

**Karar:** Kullanıcı verisi silinirken sıra şu: (1) `Resume.filePath` yolları
okunur, (2) sekiz tablo tek `$transaction` içinde silinir, (3) dosyalar
diskten işlemin DIŞINDA ve sonrasında silinir.

**Neden tek işlem:** Yarısı silinmiş bir hesap hiç silinmemişten kötü — CV'si
gitmiş ama analizleri duran bir kullanıcı ne silinmiş ne duruyor sayılır ve
hangi durumda olduğu kullanıcıya anlatılamaz. Silme sırası koda gömülü bir
diziden (`SILME_SIRASI`) üretiliyor, yorumdan değil; sıra yorum olarak
yazılırsa kodla ayrışır.

**Neden dosyalar işlemin dışında:** İki yanlıştan hangisini seçtiğimizin
kaydı. Dosya silinip işlem geri alınırsa kayıt dosyasız kalır — kullanıcı
CV'sini göremez, ürün kırılır. Tersi durumda diskte sahipsiz bir dosya kalır —
temizlik işiyle toplanabilir, kullanıcıya hiçbir şey kırılmaz. İkincisi
zararsız olduğu için o seçildi.

**Silinecek kimlik yalnızca oturumdan okunuyor,** istek gövdesinden değil.
Böylece "başkasının hesabını sil" diye bir istek biçimi hiç var olmuyor:
sızıntı bir kontrolle değil, yüzey hiç açılmayarak kapatılıyor. Gövde yine de
kimlik taşıyorsa `ensureOwner` ile oturumla karşılaştırılıyor ve uymazsa 404
dönüyor (K-35).

**Diskte yol kontrolü:** `Resume.filePath` veritabanından geliyor ve doğrudan
`unlink`'e gidiyor. `depoIcindeMi` yolu `STORAGE_DIR` altında olmaya zorluyor.
Düz `startsWith` yetmedi: `/veri/storage-yedek` dizesi `/veri/storage` ile
başlıyor ama onun altında değil; `path.relative` bu tuzağı ve `..` geçişlerini
birlikte kapatıyor.

**Ölçülen şema davranışı:** `Analysis.resumeVersionId` ve
`Adaptation.resumeVersionId` yabancı anahtarları `ON DELETE SET NULL` taşıyor
(nullable oldukları için Prisma'nın öntanımlısı). Yani bir CV sürümü
silindiğinde ona bağlı başka bir satır silinmez, alanı NULL olur. Uygulama
akışında çapraz kullanıcı bağı kurulamıyor, ama sıraya tablo eklenirken bu
varsayım yeniden sınanmalı. Atomiklik testi bu yüzden `jobPostingId`
üzerinden kuruldu: o yabancı anahtar `RESTRICT` taşıyor ve işlemi gerçekten
düşürüyor.

**Değerlendirilen alternatifler:** Şemaya `onDelete: Cascade` yaymak (silme
sırası kaybolur, ama kapsam da görünmez olur — geri alınamaz bir işlemin
kapsamı okunabilir kalmalı) · dosyaları işlem içinde silmek (geri alma diski
geri getirmiyor, yani işlem yalancı olurdu).
## K-37 · Deneyim gereksinimini beceri listesi karşılamaz

**Tarih:** 27 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 1+
**Birikmiş işler #1 ve #7'yi kapatır.**

**Karar:** Gereksinimin türü, onu karşılayabilecek kanıtın türünü sınırlıyor.
`experience` türü gereksinimler yalnızca **anlatı kanıtıyla** (`role`,
`bullet`) karşılanabiliyor; beceri listesi ve diploma satırı onlar için kanıt
sayılmıyor. Diğer türlerde kısıt yok.

Kısıt her iki eşleştirme aşamasına da uygulanıyor. Yalnızca anlamsal katmana
konsaydı aynı uydurma kelime eşleşmesiyle geri gelirdi; ayrım yapan şey
gereksinimin türü, eşleşmenin hangi aşamada bulunduğu değil.

### Neden eşik ayarı değil

K-24 eşiği taramış ve kalan üç uydurmanın eşikle elenemeyeceğini söylemişti.
Sebebi bu turda sayıyla görüldü — uydurmaların benzerliği meşru eşleşmelerin
bandının **tam içinde**:

| | Benzerlik |
|---|---|
| Meşru anlamsal eşleşmeler | 0,6694 · 0,6828 · 0,6941 · 0,7235 · 0,7285 · 0,8972 |
| Uydurmalar | **0,6687 · 0,7056 · 0,7056** |

En düşük uydurma (0,6687) ile en düşük meşru eşleşme (0,6694) arasında 0,0007
var. Hiçbir eşik bu ikisini ayırmaz. Ayrım sayıda değil, **türde**.

### Kapsam taraması (`pnpm eval:kapsam`, 10 çift · 56 iddia)

| Varyant | İsabet % | Kaçırma | Uydurma | Anlamsal |
|---|---|---|---|---|
| taban (kısıt yok) | 91,1 | 2 | 3 | 9 |
| **#1 · experience → anlatı** | **92,9** | **2** | **2** | **8** |
| #7 · anlamsal yalnız `soft` | 85,7 | 8 | 0 | 0 |
| her tür → anlatı | 76,8 | 13 | 0 | 0 |
| `education` → yalnız diploma | 89,3 | 4 | 2 | 6 |

**#1 kazandı:** bir uydurma eksildi, hiçbir meşru eşleşme düşmedi. Ölçüm
setinde `experience` türü hiçbir gereksinim beceri kanıtıyla *meşru* olarak
eşleşmiyordu — yani kısıtın bedeli sıfır.

### #7 reddedildi — ve K-15'in tahminini çürüttü

K-15 "belki yalnızca `soft` türü gereksinimlerde devreye girmesi" diye bir
kapı açık bırakmıştı. Ölçüm kapattı: isabet %91,1'den %85,7'ye düşüyor.
Sebebi basit ve verinin kendisinde — **değerlendirme setindeki beş ilanda hiç
`soft` türü gereksinim yok.** Kapsam `soft`'a daraltılınca anlamsal katman
tümüyle susuyor ve altı meşru eşleşme kaçırmaya dönüyor.

Bu, K-24'ün "anlamsal katman artık hak ettiği yeri kazanıyor" bulgusunun
ikinci kanıtı: katmanın asıl işi yumuşak beceriler değil, çapraz dilli ve
eş anlamlı teknik eşleşmeler (`Yazılım Mühendisliği` ↔ `Yazılım Geliştirme`,
`Python ile ileri seviye geliştirme` ↔ `Python`).

### Denenen iki fikir daha, ikisi de reddedildi

**Anlamsal katman yalnızca anlatı kanıtına baksın.** Gerekçesi şuydu: beceri
satırı kanonik bir terimdir, ya lafzen eşleşir ya da benzerliği sözlüksel
gürültüdür. Ölçüm tersini gösterdi — isabet %76,8'e düşüyor. Sebebi ölçülebilir:
dokuz anlamsal eşleşmenin dokuzu da beceri kanıtından geliyor ve anlatı
kanıtındaki en iyi alternatifleri 0,4072–0,5949 bandında, yani eşiğin çok
altında. Kısa ve kanonik metinler gömme uzayında birbirine yakın duruyor;
uzun anlatı cümleleri kavramdan uzaklaşıyor. Beceri listesini anlamsal
katmandan çıkarmak, katmanı kapatmakla aynı şey.

**Eğitim gereksinimini yalnızca diploma kanıtı karşılasın.** Kulağa #1 kadar
mantıklı geliyor, ama iki meşru eşleşme düşüyor (%89,3): ilan "Yazılım
Mühendisliği" derken yeni mezunun diploma satırı "Yönetim Bilişim Sistemleri"
diyor ve köprüyü beceri satırındaki "Yazılım Geliştirme" kuruyor. Simetrik
görünen bir kısıt simetrik sonuç vermiyor — her tür ayrı ölçülmek zorunda.

### Yeni taban çizgisi

```
10 çift · 56 iddia
İsabet oranı   : 92.9%   (önce 91.1%)
Kaçırma        : 2       (değişmedi)
Uydurma        : 2       (önce 3)
Çıkarılmayan   : 0
Eşleşme kaynağı: kelime 13 · anlamsal 8
```

**Kalan 2 uydurma** ikisi de `cv-c__ilan-1`'de, ikisi de `skill` türü ve ikisi
de yeni mezunun beceri listesindeki `Yapay Zeka Araçları` satırına düşüyor.
Bu satır bir şemsiye terim ve gömme uzayında hem "Generative AI"ye (0,7056) hem
"Otonom karar mekanizmaları"na (0,6687) yakın. Tür kısıtı bunları eleyemiyor
çünkü gereksinim gerçekten bir beceri gereksinimi ve kanıt gerçekten bir
beceri kaydı. Sonraki adayı birikmiş işler #15'te duruyor.

**Yapılandırma ölçüm yüzeyi olarak kaldı:** `semanticTypes` ve
`evidenceKindsByType` yapılandırmada duruyor ki set büyüdüğünde (birikmiş
işler #4) tarama tekrarlanabilsin — `semanticThreshold`'un `eval:sweep` için
durmasıyla aynı gerekçe.

---

## K-38 · Uçtan uca testin bulguları: kavram bölme, kanıt, terim uyumu

**Tarih:** 28 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 3+
**Birikmiş işler #10'u kapatır, #15'in 3. seçeneğini uygular.**

**Bağlam:** Uygulama gerçek bileşenlerle (Postgres, Redis, worker, Gemma 4
E4B) iki kurgusal adayla baştan sona kullanıldı. Değerlendirme seti bu
ortamda yoktu; bulgular iki ilan ve iki CV'den geliyor ve setle yeniden
ölçülmeli. Embedding olarak BGE-M3 yerine qwen3-embedding kullanıldı
(BGE-M3 ortama indirilemedi), yani anlamsal eşikler birebir aynı değil.

### Bulgular ve kararlar

| # | Bulgu | Karar |
|---|---|---|
| 1 | Kavram bölücü Türkçe yapıları ayıramıyordu: "TypeScript ile en az 4 yıl profesyonel", "Cypress)" | "ile", "veya" (seçenek), parantez (eş anlamlı ya da örnek listesi), ortak baş, fiil kalıpları ve dolgular tanınıyor |
| 2 | Noktalı beceriler (Next.js, Vue.js) cümle sanılıp düşüyordu; indirilen CV'de de yoktu | Yalnızca sondaki ya da boşluktan önceki nokta cümle işareti |
| 3 | Diller bölümü ve özet kanıt sayılmıyordu | İkisi de kanıt; özet 0,75 çarpanlı |
| 4 | Genel eğitim gereksinimi hiçbir diplomayla eşleşmiyordu | "Üniversite mezunu" kavramına çevriliyor |
| 5 | Madde yazımı ilansızdı; skor hiç değişmiyordu (25 → 25) | Terim uyumu: maddeye yakın, açık ve betimleyici kavramlar veriliyor; model dayanak gösteriyor, dayanak kodda doğrulanıyor |
| 6 | Özel adlar anlamca eşleşiyordu: "GraphQL" ↔ "Next.js" 0,74, "CI/CD" ↔ "Git" 0,71 | Özel adlarda anlamsal eşleşme kapalı (#15, 3. seçenek) |
| 7 | Gömme benzerliği dürüst uyumu zorlamadan ayıramıyor: "GraphQL" ↔ "REST API'lerle entegrasyon" 0,64, "SSR" ↔ "sunucu tarafı render" 0,54 | Özel adlar uyum hedefi olamıyor; terim uyumu taşıyan madde kullanıcı onayı bekliyor |
| 8 | Model anlamı ters çevirdi ("web performansı %40 azalttım"), özet deneyim yılını düşürdü | Bilgi kaybeden yazım önerilmiyor (#10): dayanak, kaynak kavramları ve sayılar korunmalı |
| 9 | Uyarılı yazımlar kullanıcıya reddedilmesi kesin cümleler olarak gidiyordu | K-26 değişti: uyarılı madde yazımı önerilmiyor, madde olduğu gibi kalıyor |

### Ölçüm (iki çift, gerçek model)

| | Önce | Sonra |
|---|---|---|
| Frontend adayı · analiz | 25 · 4/11 · 2 kaçırma, sahte "eksik" kavramlar | 53 · 6/11 · sahte eşleşme yok |
| Frontend adayı · uyarlama | 25 → 25 | 53 → 56 (özet + maddelerden eklenen beceri) |
| Pazarlama adayı · analiz | 25 · 2/7 | 54 · 6/7 |
| Pazarlama adayı · uyarlama | — | 54 → 54 (özet yıl ve unvanı koruyor) |

Uyarlamanın kazancı küçük kaldı. Sebebi ölçülebilir: Gemma E4B'nin terim uyumu
denemelerinin çoğu (anlam kaydırma, dayanağı silme) yeni koruma kontrollerine
takıldı ve gösterilmedi. Bu doğru davranış; kazanç üretim modeliyle yeniden
ölçülmeli (birikmiş işler #3).

### Açık kalanlar

- Eşikler (`semanticThreshold`, hedef için 0,45, uyum için 0,5) BGE-M3 ile
  `pnpm eval` ve `pnpm eval:adapt` üzerinden yeniden ölçülmeli.
- Özel ad sezgisi başlık düzenindeki İngilizce genel ifadelerde ("Project
  Management") anlamsal köprüyü kapatıyor; setle ölçülmeli.

---

## K-39 · CV'nin dili korunur; dil kodda belirlenir

**Tarih:** 28 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 3+

**Bağlam:** İngilizce CV uyarlanırken Türkçeye çevriliyordu. Sebep prompt'larda:
madde prompt'u hem "Türkçe yaz" hem "maddenin dilinde yaz" diyordu, özet
prompt'u doğrudan "Türkçe yaz" diyordu. Belge başlıkları (DENEYİM, BECERİLER)
ve çıkarımın "halen" zorlaması da İngilizce CV'ye Türkçe sızdırıyordu.

**Karar:** Dil kararı modele bırakılmıyor. `detectLanguage` CV'nin dilini
kodda belirliyor, prompt girdisine açıkça yazılıyor ("Dil: İngilizce") ve
belge başlıkları ona göre seçiliyor. Çıkarım prompt'ları hiçbir alanı
çevirmiyor. CV ile ilan farklı dildeyse madde terim uyumu kapalı: Türkçe ilan
terimini İngilizce maddeye yazdırmak çeviridir ve kelime düzeyinde
doğrulanamaz. Ön yazı ilanın dilinde kalıyor; o metin şirkete gidiyor.

**Ölçüm:** İngilizce CV + Türkçe ilan, gerçek model. Profil, uyarlanmış özet ve
indirilen PDF'in tamamı İngilizce kaldı (başlıklar, "Present", "English
(fluent)", "2017 – 2021").

**Açık:** Çapraz dilli eşleşme zayıf: "Takım içinde mentorluk ve kod
incelemesi" İngilizce CV'deki "Reviewed code… mentored new hires" ile
eşleşmedi. Birikmiş işler #11'deki çapraz dilli sözlük bu açığı kapatır.

---

## K-40 · Eşikler BGE-M3 ile ölçüldü; uyarlama ölçümü ürünün yolundan geçiyor

**Tarih:** 28 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 3+

**Eşik taraması** (`pnpm eval:sweep`, 10 çift, BGE-M3):

| Eşik | İsabet | Kaçırma | Uydurma |
|---|---|---|---|
| 0,60 | %87,5 | 2 | 5 |
| **0,65** | **%94,6** | **2** | **1** |
| 0,70 | %92,9 | 4 | 0 |

`semanticThreshold` 0,65'te kalıyor. 0,70 son uydurmayı da siliyor ama iki
doğru eşleşmeyi kaybettiriyor; CV'de olan bir becerinin "yok" görünmesi daha
zararlı.

**Uyarlama ölçümü:** `eval:adapt` yazımları kendi yolundan doğruluyordu ve
ürünün attığı yazımları (bilgi kaybı, uyarı, uyumsuz değişiklik) kabul
sayıyordu. Artık `buildAdaptationDraft` kullanıyor, model yanıtlarını istek
özetine göre önbellekliyor ve atılan her yazımı gerekçesiyle raporluyor
(`--ayrinti`).

**Gerekçe çıktısının bulduğu üç kusur** (Türkçe CV'de 7 yazımın 7'si
atılıyordu):

- Düzeltme işareti katlanmıyordu: "yapay zekâ" ≠ "yapay zeka".
  `normalizeText` â/î/û'yu katlıyor.
- Eğitim şartı madde hedefi olabiliyordu; model deneyim maddesine bölüm adı
  yazıyordu. `openConcepts` eğitim türünü atlıyor.
- Dayanağın son fiilinin bağlaca çevrilmesi ("sağladım" → "sağlayarak") ifade
  kaybı sayılıyordu. Aynı kökten olumlu çekim kabul; kök değişirse ya da fiil
  olumsuzlanırsa kayıp.

**Ölçüm (Gemma E4B):** önerilen yazım %40 → %58 (Türkçe CV 0/7 → 3/6),
ortalama skor +1,0 → +1,2, puanlama isabeti %94,6'da kaldı. Kalan 8 atmanın
hepsi gerçek uydurma (ilandan sayı kopyalama, anlamsız ek, kelime değiştirme);
kod tarafında kapatılacak bir şey kalmadı, üretim modeliyle yeniden ölçülmeli.


## K-41 · Anonim temizlik saklama süresi 30 gün, betik öntanımlı deneme kipinde

**Tarih:** 27 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** KVKK / Sprint 3B

**Karar:** Kayıt olmadan giden ziyaretçinin verisi 30 gün sonra siliniyor.
Temizlik mantığı `apps/web/lib/temizlik.ts`'te saf ve test edilebilir duruyor;
onu çağıran betik `pnpm --filter @uyarla/web temizlik` ve **öntanımlı olarak
hiçbir şey silmiyor** — silmek `--sil` bayrağı istiyor.

**Neden 30 gün — ve bu değer ÖLÇÜLMEDİ, TAHMİN.** Üst sınırı KVKK koyuyor:
kullanılmayan bir CV'nin süresiz saklanması savunulabilir değil. Alt sınırı
huni koyuyor: ziyaretçi bir ay içinde dönüp kayıt olabilir ve devralma (K-34)
o kaydın durmasına bağlı. 30 gün ikisinin arasında seçilmiş bir sayı, ölçülmüş
bir eşik değil. Hız limiti değerlerinde olduğu gibi (spec §9) yapılandırmada
duruyor; gerçek rakam, kayıt olan ziyaretçilerin ilk analizden kaç gün sonra
döndüğü verisi biriktiğinde ölçülecek.

**Neden öntanımlı deneme kipi:** Geri alınamaz bir işi çalıştırmak açık bir
niyet istemeli. Yanlışlıkla çalıştırılan bir silme betiği, hiç yazılmamış bir
betikten kötü.

**Koşulun iki kritik ayrıntısı:**

- `isAnonymous: true` tam eşitlik, doğruluk değeri değil. Alan şemada nullable
  (`Boolean?`, K-34) ve `not: false` yazılsaydı NULL taşıyan kayıtlı hesaplar
  da eşleşirdi.
- Kesim `lt`, `lte` değil. Sınırda duran kaydı bırakıyoruz: geri alınamaz bir
  işlemde eşitlik hâlinde silmemek doğru taraf.

**Silme mantığı paylaşılıyor, kopyalanmıyor.** Temizlik işi kendi silme kodunu
yazmıyor, `lib/silme.ts`'e devrediyor (K-36). İki kopya tutmak, biri
düzeltilip öteki unutulduğunda veri sızdırırdı.

**Zamanlama henüz bağlanmadı.** Betik var, onu günde bir çalıştıran bir şey
yok; seçenekler ve gerekçeleri `docs/birikmis-isler.md` madde 13'te. Tetikleme
dağıtım topolojisine (K-02) bağlı bir karar ve kodda yapılacak iş yalnızca o.

**Değerlendirilen alternatifler:** Postgres'te `pg_cron` (yönetilen
sağlayıcıda açık olmayabilir ve silme sırasını SQL'de ikinci kez yazmak
gerekirdi) · BullMQ tekrarlayan işi (worker kimlik ve kullanıcı verisi
bilmiyor, spec §4 sınırını bozardı).

## K-42 · Font dosyaları dağıtıma elle dahil ediliyor; arama hedefi değişti

**Tarih:** 29 Eylül 2026 · **Durum:** Geçerli · **Kapsam:** Sprint 2+
**Birikmiş işler #9'u kapatır.**

**Karar:** `next.config.mjs` font dizinini indirme route'unun izine elle
ekliyor, ve `@uyarla/fonts` artık depo kökünü değil **hedefin kendisini**
arıyor.

**Sorun:** K-30 fontları çalışma anında dosya sisteminden okumaya karar
vermişti (bundler'ın üç yolu da kırılmıştı) ama arama `pnpm-workspace.yaml`
üzerinden gidiyordu — yani depo ağacının diskte durmasını şart koşuyordu.
Dağıtımda depo ağacı yok.

**Ölçüm:** `next build` dosya izlemesi yalnızca **statik** bağımlılıkları
görüyor. Hiçbir yerde `import "….ttf"` olmadığı için izlemede **sıfır** font
dosyası çıkıyordu; PDF indirme üretimde çalışma anında patlardı.

```js
outputFileTracingRoot: depoKoku,               // tahmin apps/web'de kalabiliyor
outputFileTracingIncludes: {
  "/api/adapt/[id]/download": ["../../packages/fonts/ttf/**"],
}
```

LICENSE de dahil: DejaVu yeniden dağıtılıyor, lisansı yanında gitmeli.

**Arama iki adaya indi ve ikisi de işaret dosyasıyla doğrulanıyor:**

1. `__dirname/ttf` — gerçek bir CJS modülü olarak yüklendiğinde (worker,
   testler, `tsx`) kesin cevap ve cwd'den bağımsız.
2. cwd'den yukarı yürüyüp `packages/fonts/ttf` aramak — paketlenmiş kod için
   kalan tek yol. Aranan artık hedefin kendisi, depo işareti değil.

### Negatif kontrol — bu kararın tek gerçek kanıtı

K-30 pahalı bir ders bırakmıştı: bir yaklaşım derlemeyi geçmiş ama çalışma
anında 500 vermişti. "Derleme geçti" bu işte kanıt sayılmıyor.

Yordam: `UYARLA_STANDALONE=1` ile derle, **depodaki `packages/fonts/ttf`
dizinini geçici olarak gizle**, cwd'yi standalone köküne al ve PDF üret.

```
standalone çıktısında : packages/fonts/ttf/{DejaVuSans.ttf, DejaVuSans-Bold.ttf, LICENSE}
depo fontları gizli   : çözümleme standalone kopyasını buldu
üretilen PDF          : 17 132 bayt
metin katmanı         : "Şeyma Çağlar / AI Mühendisi · İstanbul / Yapay zekâ ve yazılım…"
```

Depo ağacı olmadan, yalnızca izlemenin kopyaladığı dosyalarla Türkçe
karakterler doğru çıkıyor.

**`output: "standalone"` bir kapının arkasında.** Vercel onu kullanmıyor,
kendi işlevlerini `.nft.json` izlerinden kuruyor; ama izin ne kopyaladığını
dosya sisteminde görmenin tek yerel yolu standalone çıktısı. Her derlemeye
~70 MB kopyalama bindirmesin diye `UYARLA_STANDALONE` ile açılıyor.

**Yan bulgu:** `serverExternalPackages` yalnızca uygulamanın KENDİ kodundan
gelen import'lara uygulanıyor. `transpilePackages` içindeki bir paketten
gelen import'ta uygulanmıyor — `pdfkit`, `docx`, `@prisma/client` ve
`@uyarla/fonts` derleme çıktısında paketlenmiş hâlde duruyor; yalnızca
`bullmq` ve `ioredis` (doğrudan `apps/web/lib`'den import ediliyorlar)
gerçekten dışarıda kalıyor.


## K-43 · Üretimde OpenAI; skor eşiği gömme modeline göre yeniden ölçüldü

**Tarih:** 6 Ekim 2026 · **Durum:** Geçerli · **Kapsam:** Dağıtım (DOG-42)

**Karar:** Üretken model `gpt-4.1-mini`, gömme `text-embedding-3-small`.
Sağlayıcılar `LLM_API_KEY` / `EMBEDDING_API_KEY` okuyor; boşsa yerel sunucu
davranışı aynı. Anahtarlar ayrı: gömme, üretken modelin anahtarına düşmüyor
(K-12).

**Hata sınıflandırması:** Yerelde her hata "erişilemedi" demekti. Barındırılan
API'de 401/400/404 kalıcı (`*_rejected`), `429 insufficient_quota` kalıcı
(`*_quota_exceeded`), diğer 429 ve 5xx geçici. Yanlış anahtar ya da olmayan
model artık üç deneme boyunca kullanıcıyı bekletmiyor.

**Eşik taraması** (`pnpm eval:sweep`, 10 çift, text-embedding-3-small):

| Eşik | İsabet | Kaçırma | Uydurma |
|---|---|---|---|
| 0,45 | %90,6 | 2 | 3 |
| **0,50** | **%92,5** | **3** | **1** |
| 0,65 | %88,7 | 6 | 0 |

`semanticThreshold` 0,65 → 0,50. OpenAI gömmelerinde benzerlik BGE-M3'ten
belirgin düşük; 0,65'te anlamsal katman hiç eşleşme üretmiyordu, bütün
isabet kelime eşleşmesindendi. **Eşik gömme modeline bağlı bir değer:**
gömme modeli değişirse tarama tekrarlanmalı.

**Uyarlama** (`pnpm eval:adapt`, gpt-4.1-mini): hedefli 6 yazımın 5'i
önerildi (%83), atılan tek yazım gerçek bir ilan terimi enjeksiyonu. Sapma
kontrolü (`driftThreshold` 0,70) hiçbir yazımı atmadı. Örnek küçük; sapma
eşiği BGE-M3 ile ayarlanmıştı (K-33) ve çeviri yazımlarında yeniden
ölçülmeli.

## K-44 · Şemsiye terim uydurmaları gömme değişikliğiyle kapandı; kalan uydurmaya kural yazılmadı

**Tarih:** 9 Ekim 2026 · **Durum:** Geçerli · **Kapsam:** Skor (DOG-27, birikmiş işler #1 ve #15)

**Ölçüm** (`pnpm eval:coverage`, 10 çift, text-embedding-3-small, eşik 0,50):
öntanımlı yapılandırmada isabet %92,9, kaçırma 3, uydurma **1**.

- `Yapay Zeka Araçları` ↔ `Generative AI` / `Otonom karar mekanizmaları`
  uydurmaları artık oluşmuyor. BGE-M3'e özgüydüler; OpenAI gömmeleriyle
  (K-43) iki eşleşme de eşiğin altında kalıyor.
- Kalan tek uydurma başka sınıftan: `cv-c__ilan-2` çiftinde `Proje Yönetimi`
  (beceri satırı) ↔ `Kurumsal veri güvenliği, kimlik ve erişim yönetimi`.
  Ortak bir baş ismin ("yönetimi") sözlüksel yakınlığı.

**Şemsiye terim tespiti uygulanmadı.** Kalan uydurmanın kanıtı ilanın 48
kavramından yalnızca 1'ine 0,50'nin üstünde yakın. Yani şemsiye terimin
tersi: "her şeye yakın kanıt" kuralı bu vakayı yakalamazdı.

**Güven tabanı uygulanmadı.** Uydurmanın katkısı 0,205; en düşük meşru
anlamsal eşleşmeninki 0,241. Aradaki 0,036'lık boşluğa bir taban koymak
tek CV'nin tek satırına göre ayar yapmak olur. Ayrıca beklentisi
tanımlanmamış altı eşleşmeyi (0,108–0,175 arası) etkisi ölçülmeden düşürürdü.
Set büyüyünce (birikmiş işler #4, #5) yeniden ölçülmeli.

## K-45 · Çok kelimeli çapraz dilli karşılıklar sözlüğe girdi

**Tarih:** 9 Ekim 2026 · **Durum:** Geçerli · **Kapsam:** Normalleştirme (DOG-32, birikmiş işler #11)

**Sorun:** `TITLE_SYNONYMS` kelime kelime eşliyor; "yapay zeka" ↔ "AI" gibi
iki kelimenin tek kelimeye karşılık geldiği çiftler sığmıyordu. Ön yazı
ilanın dilinde yazıldığı için (bkz. `COVER_LETTER_PROMPT`) İngilizce CV'nin
sadık çevirisi uydurma sayılıyordu. eval:cover'da en sık iki uyarı
"yapay zekâ" (19) ve "üretken yapay zekâ" (17) idi; CV'de "AI Engineer" ve
"Generative AI" yazıyordu.

**Karar:** `PHRASE_SYNONYMS` (kök dizisi → kanonik kök):
`yapay zeka`/`artificial intelligence` → `ai`, `kimlik doğrulama` →
`authentication`. Kelime sözlüğüne `üretken` → `generative`. Eşleme
`normalizeTokens` içinde yapıldığı için skor, uydurma kontrolü ve hedef
seçimi aynı anda yararlanıyor.

**Ölçüm** (aynı model yanıtlarıyla, önce → sonra):

| | Önce | Sonra |
|---|---|---|
| eval:coverage isabet | %92,9 | **%94,6** |
| eval:coverage kaçırma / uydurma | 3 / 1 | **2 / 1** |
| eval:cover sorun (amaçsız / kariyer / ilk iş) | 9 / 6 / 6 | **6 / 3 / 5** |
| eval:adapt tam skor değişimi | +0,4 (artan 2) | **+0,7 (artan 3)**, düşen 0 |

Bilinen sınır: kök bulma "zekayı", "zekanın" gibi çekimleri "zeka"ya
indirmiyor; bu biçimler eşleşmiyor. Mevcut ek soymanın sınırı, yeni değil.
