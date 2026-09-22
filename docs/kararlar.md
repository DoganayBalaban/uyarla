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
