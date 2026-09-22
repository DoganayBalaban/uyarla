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
