# ai-job-search tersine mühendislik analizi

**Tarih:** 19 Ekim 2026 · **Kaynak:** [MadsLorentzen/ai-job-search](https://github.com/MadsLorentzen/ai-job-search) (MIT, ~52 bin yıldız, son commit 18 Ekim 2026) · **Araç:** [REA](https://github.com/morluto/rea) (`rea-agents` 6.7.0) ve kaynak okuma

## 1. Ne bu?

Claude Code üzerine kurulmuş, kullanıcının kendi bilgisayarında çalışan bir iş arama çerçevesi. Bir web ürünü değil: kullanıcı depoyu kopyalıyor, profilini dolduruyor ve Claude Code içinde `/setup`, `/scrape`, `/apply`, `/interview`, `/outcome` gibi komutlar çalıştırıyor. Yazarı (Danimarkalı bir jeofizikçi) kendi iş aramasında kullanmış: 69 başvuru, 20 ilk görüşme, 1 iş.

Ürünün "kodu" büyük ölçüde **Markdown istemlerinden** oluşuyor:

| Katman | Ne | Boyut |
|---|---|---|
| `.claude/commands/*.md` | 12 komutun adım adım akışı | ~2.900 satır |
| `.claude/skills/job-application-assistant/` | Profil, üslup, uyum çerçevesi, CV/ön yazı şablonları, mülakat, form alanları, web araştırması | ~1.500 satır |
| `.agents/skills/*-search/cli` | 6 iş portalı için TypeScript (Bun) komut satırı araçları | 92 `.ts` dosyası |
| `tools/*.py`, `salary_lookup.py` | PDF ve sayfa düzeni doğrulama, kopya ilan anahtarı, robots.txt kontrolü, CI korumaları, maaş karşılaştırması | 12 araç |
| `tests/` | Python araçlarının ve istem bütünlüğünün testleri | ~50 dosya |

Durum dosyaları düz metin: `job_search_tracker.csv` (başvuru takibi), `job_scraper/seen_jobs.json` (görülen ilanlar), `documents/applications/<şirket>_<rol>/` (gönderilen CV, ön yazı, ilan metni, sonuç), `company_research/*.json` (şirket araştırması önbelleği).

## 2. Yöntem ve REA bulguları

Depo açık kaynak olduğu için istemler ve Python araçları doğrudan okundu. REA'nın `analyze-javascript-application` komutu altı portal aracına uygulandı: bu araçlar statik olarak çözümlendi, dış uçlar ve komut yapısı çıkarıldı.

| Portal aracı | Çözümlenen dosya | REA bulgusu | Dış uç |
|---|---|---|---|
| linkedin-search | 12 | 111 | `linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search`, `…/jobPosting/<id>` (girişsiz "guest" API) |
| jobindex-search | 15 | 126 | `jobindex.dk`, `jobindex.dk/jobannonce/<id>`, `candidate.hr-manager.net` |
| jobnet-search | 18 | 166 | `jobnet.dk/bff` (sitenin kendi ön yüz API'si) |
| jobdanmark-search | 20 | 181 | `jobdanmark.dk`, schema.org JSON-LD |
| jobbank-search | 16 | 141 | `jobbank.dk` (RSS ve JSON-LD) |
| freehire-search | 11 | 103 | `freehire.me` (REST) |

Ortak desen: her portal için `search` ve `detail` komutları var. İlan sayfasının JSON-LD (`JobPosting`) ya da RSS verisi okunuyor. HTML kazınmıyor; girişsiz uçlar kullanılıyor. Testler bayrak doğrulamayı, yeniden deneme ve beklemeyi, zaman aşımını ve URL normalleştirmeyi kapsıyor. `/add-portal` yeni bir pazarın portalı için aynı iskeleti üretiyor. `robots_check.py`, tarayıcı başlıklarıyla yeniden denemeden önce robots.txt'e bakıyor.

## 3. Akışlar

- **`/setup`:** Profili üç yoldan kuruyor: `documents/` klasörü (CV, LinkedIn dışa aktarımı, diplomalar, referanslar, eski başvurular), yapıştırılan tek bir CV ya da mülakat. Sonuçlanmış başvurular varsa uyum çerçevesini onlardan **kalibre ediyor**.
- **`/scrape` → `/rank`:** Portallarda arıyor, kopyaları eliyor. `/rank` her ilanı paralel ajanlarla getirip beş boyutta puanlıyor ve kısa liste çıkarıyor.
  - Konum ve dil kapıları elerse ilan ayrı listeleniyor.
  - Son başvuru tarihi 7 günden azsa 🔥 ile işaretleniyor.
  - Kapanmış ilan "süresi doldu", getirilemeyen ilan "ulaşılamadı" sayılıyor; ikisi ayrı tutuluyor.
- **`/apply`:** Yazan ve eleştiren iki ajanla çalışıyor.
  1. İlanı ayrıştırma ve kaynağını doğrulama.
  2. Uyum değerlendirmesi; kullanıcı onay verirse devam.
  3. CV ve ön yazının LaTeX taslağı.
  4. Ayrı bir eleştirmen ajan şirketi araştırıp taslakları eleştiriyor.
  5. Taslaklar düzeltiliyor.
  6. PDF derleniyor ve ölçülüyor: sayfa sayısı, boşluklar, yetim başlıklar.
  7. ATS kontrolü: PDF'in metin katmanında iletişim bilgisi, okuma sırası, tarihler ve anahtar kelime kapsamı.
  8. Takip tablosuna kayıt ve ilan metninin aynen arşivlenmesi.
- **`/outcome`:** Başvurunun sonucunu kaydediyor ve gönderilen belgeleri arşivliyor.
  - `followup`: 10 gün ses çıkmayan başvurular için kısa bir takip mesajı **taslağı** yazıyor. Göndermiyor; başvuru başına en çok iki kez.
  - Görüşme aşaması kaydedilince teşekkür notu öneriyor.
  - `stale`: 60 günü geçen başvuruları toplu kapatıyor.
  - 3+ başvuru sonuçlanınca kalibrasyonu öneriyor.
- **`/interview`:** Aşamaya özel hazırlık paketi hazırlıyor:
  - olası sorular,
  - STAR örnekleriyle eşleme,
  - "tutarlılık özeti" (CV'de görüşmecinin üstüne gideceği iddialar),
  - şirkete özel zor sorular,
  - sorulacak sorular.
  İsteğe bağlı olarak sahte mülakat da yapıyor.
- **`/upskill`:** Takip edilen ve sıralanan ilanlar üzerinden beceri açığı ısı haritası ve süre tahminli öğrenme planı çıkarıyor. Raporlar arası fark da raporlanıyor ("kapanan açıklar / yeni açıklar").
- **`/expand`:** Profilde verilmiş açık kaynaklardan (GitHub, portföy, Kaggle, ders izlenceleri) yetkinlik çıkarıyor ve kaynağıyla birlikte profile ekliyor.
- **`/gmail-sync`:** Gmail'deki mülakat davetlerini, retleri ve teklifleri sınıflandırıp toplu öneri olarak sunuyor. Kullanıcı onaylamadan hiçbir şey yazmıyor.
- **`/html-report`, `/notion-sync`:** Başvuru panosunu çevrimdışı HTML'e ya da Notion'a tek yönlü aktarıyor.
- **`/add-template`, `/add-portal`:** Kullanıcının kendi CV şablonunu ve kendi pazarının portalını ekliyor.

## 4. Nasıl yapıyorlar: dikkat çeken teknik kararlar

1. **Kapılar puandan önce geliyor.** Uygunluk kapısı (vatandaşlık, oturum, güvenlik izni) ve dil kapısı FAIL / FLAG / PASS veriyor. FAIL olan ilan puanlanmıyor, CV de yazılmıyor. Dil kapısı ilanın yazıldığı dile değil, **işin istediği dile** bakıyor. Seviye belirsizse "sessiz geçiş" yerine FLAG verip kararı kullanıcıya bırakıyor.
2. **Beş boyutlu uyum puanı:** teknik %30, deneyim %25, davranış/kültür %15, kariyer uyumu %30. Konum geçti/kaldı olarak değerlendiriliyor. Eşikler 75/60/45/30. "Kariyer uyumu" boyutu yalnızca "yapabilir mi"ye değil, "bu iş onu besler mi"ye de bakıyor.
3. **Olgu temelli denetim.** CV'deki her tarih, unvan ve sayı üç kaynağın birleşimine karşı denetleniyor: aday profili, ana CV ve CLAUDE.md. Kaynaklar birbiriyle çelişirse bu, taslak hatası değil "profil tutarlılığı uyarısı" olarak raporlanıyor.
4. **Olguyu profile geri yaz.** Kullanıcı sohbette yeni bir olgu verirse aynı turda profile yazılıyor. Gerekçeleri: yazılmayan olgu bir sonraki oturumda "dayanaksız" sayılır ve uydurma diye silinir, yani gerçek bir başarı sessizce kaybolur.
5. **İlan güvenilmez veri.** İlan içindeki talimatlara uyulmuyor ve ilan gövdesindeki bağlantılar açılmıyor. Kural her ajan istemine taşınıyor (istem enjeksiyonuna karşı).
6. **Kaynak alan adı doğrulaması.** İlan bağlantısının alan adı üç sınıfa ayrılıyor:
   - kurulu bir portal,
   - bilinen bir ATS (greenhouse, lever, workday, ashby, smartrecruiters, workable),
   - doğrulanmamış.

   Doğrulanmamış alan adında açık uyarı veriliyor. Benzer görünen alan adı hileleri (`evil-greenhouse.io`, `greenhouse.io@evil.com`) reddediliyor.
7. **Eleştirmen ajan yapılandırılmış düzeltme döndürüyor.** Düzeltmeler `{old_string, new_string, reason}` biçiminde ve gerekçesi "anahtar kelime / şirket açısı / yeniden çerçeveleme / üslup / olgu" türlerinden biri. Yazan ajan bunları doğrudan uyguluyor; uydurma gerektirenleri atlıyor.
8. **Gereksinim kapsamı.** İlanın her gereksinimi ya karşılanıyor ya da dürüst bir "köprü" cümlesiyle anılıyor ("günlük araç setimde değil; X'in doğal uzantısı"). Sessizce atlanan gereksinim mülakatta saklama gibi okunuyor. Doğruysa ilanın kendi terimi eş anlamlısına tercih ediliyor, CV başlıklarında bile.
9. **Anahtar kelime tablosu dört durumlu:**
   - kapsanmış,
   - yalnız eş anlamlısıyla geçen,
   - eksik ama adayda var (eklenir),
   - eksik ve açık (doldurulmaz, ön yazıda dürüstçe çerçevelenir).
10. **PDF metin katmanı ATS denetimi.**
    - İkon fontları, `(cid:NNN)` çöpü ve okuma sırası kontrol ediliyor.
    - **Tarih aralığında Unicode tire:** LaTeX `--`'i en-dash'e çeviriyor. Gerçek bir Workday içe aktarımında bu, kısa bir işin bitiş tarihini ve *bütün* eğitim girdilerini düşürmüş. Kural: tarih aralığı ASCII kısa çizgiyle yazılmalı.
11. **Sayfa düzeni ölçümü** (`verify_layout.py`): 100 pt'den büyük boşluk, %25'ten erken biten sayfa, son sayfanın %35'ten fazla boş kalması ve sayfa sonunda kalan başlık hata sayılıyor.
12. **İlgiye göre kesme.** CV taşınca en eski bölümden değil, en düşük puanlı satırdan kesiliyor. Puan üç şeye bakıyor: ilana ilgi, belgede tekillik ve ön yazının o satıra dayanıp dayanmadığı.
13. **Şirket araştırması önbelleği:** 30 gün geçerli, kaynak URL'leriyle saklanıyor. Önbellekteki bilgi bir "ipucu" sayılıyor; son belgeye girecek her iddia yeniden doğrulanıyor.
14. **Kopya ilan anahtarı** (`job_key.py`): şirket ve unvandan deterministik bir anahtar üretiyor. Uzun başlıklar kesilip karmayla ayrıştırılıyor; Latin dışı başlıklarda portalın ilan numarasına düşülüyor.
15. **Üslup kuralları:** uzun tire yok, klişe yok ("hit the ground running", "leverage"), özür dileyen dil yok. Doğrulanmamış şirket iddiası da yok. "Mülakatta geri adım testi" uygulanıyor: aday bir cümleyi "aslında demek istediğim…" demeden savunamıyorsa o cümle fazla abartılı.

## 5. uyarla ile karşılaştırma

| Konu | ai-job-search | uyarla |
|---|---|---|
| Teslim biçimi | Yerel, Claude Code, kullanıcının kendi aboneliği | Web ürünü; LLM ve gömme maliyeti bizde |
| Uyum puanı | LLM'in verdiği 5 boyut, tahmin | Kanıt temelli gereksinim eşleşmesi, ölçülen eval (K-64) |
| Uydurma koruması | İstem kuralları ve eleştirmen ajan | Kodda doğrulama: sayı, ilan terimi, dayanak, anlam kayması (K-38) |
| CV çıktısı | LaTeX ile 2 sayfa, kullanıcı derliyor | PDF/DOCX, tek sayfa stratejisi (K-66), gidiş-dönüş ATS testi (K-60) |
| Takip | CSV, `/outcome`, takip mesajı taslağı | Başvuru panosu, mülakat günü, hatırlatma e-postası (K-71) |
| Mülakat | Aşamaya özel paket, sahte mülakat | Yok |
| Kalibrasyon | Sonuçlardan uyum çerçevesine | Yok |
| Beceri açığı raporu | `/upskill` ısı haritası ve plan | Yok (analiz başına eksik kavram var) |
| Pazar | Danimarka portalları, genel akış | Türkiye, Türkçe/İngilizce |

Özet: Onlar istem mühendisliğinde ve iş arama sürecinin genişliğinde (takip, mülakat, kalibrasyon) güçlü. Biz ölçülebilir eşleşme kalitesinde ve kodda uygulanan uydurma korumasında güçlüyüz. Alınacak fikirler çoğunlukla sürecin uyarlamadan **sonraki** adımlarında.

## 6. uyarla için öneriler

Öncelik: **Y** yüksek, **O** orta, **D** düşük. Her öneri DOG-113'ün altında bir Linear kaydı.

| # | Öneri | Neden | Öncelik | Kayıt |
|---|---|---|---|---|
| 1 | **Tarih aralıklarında ASCII kısa çizgi.** İndirilen CV "2022 – 2024" yerine "2022 - 2024" yazsın. | Workday'de tarih ve eğitim girdisi düşmesi belgelenmiş; bizim PDF/DOCX'imiz en-dash kullanıyor. Küçük ve somut bir iş. | Y | DOG-114 |
| 2 | **Uygunluk ve dil kapıları (Türkiye'ye uyarlanmış).** Vatandaşlık, askerlik durumu, ehliyet, şehir veya taşınma ve "akıcı Almanca şart" gibi şartlar ayrı bir kapı olarak gösterilsin: FAIL / FLAG / PASS. | Bu şartlar puana karışınca "orta uyum" okunuyor; oysa kullanıcı için evet/hayır sorusu. Seviye belirsizse kararı kullanıcıya bırakıyor. | Y | DOG-115 |
| 3 | **Olgu hafızası.** "AI ile yaz"da (DOG-94) kullanıcının anlattığı deneyim profile kaydedilsin ve sonraki uyarlamalarda kanıt sayılsın. | Bugün her uyarlamada kayboluyor; kullanıcı aynı şeyi yeniden anlatıyor. Onların en çok vurguladığı kural. | Y | DOG-116 |
| 4 | **Takip ve teşekkür mesajı taslağı.** Hatırlatma e-postasında ve panoda "takip mesajı yaz" seçeneği olsun. Mesaj 60–120 kelime, yalnızca gönderilen CV ve ön yazıdaki iddialardan yazılsın, en çok iki kez. Mülakat aşamasına geçince teşekkür notu da önerilsin. | DOG-98 hatırlatmasının doğal devamı; uydurma riski olmadan değer katıyor. | O | DOG-117 |
| 5 | **Mülakat hazırlık paketi.** Uyarlamadan üretilsin: olası sorular, maddelerden STAR eşlemesi, "tutarlılık özeti" (görüşmecinin soracağı iddialar), sorulacak sorular. | Uyarlamadan sonraki en büyük boşluk. Ücretli pakete değer katabilir. | O | DOG-118 |
| 6 | **Beceri açığı raporu.** Kullanıcının tüm analizlerinde en sık eksik kalan kavramlar ve öğrenme önerisi panoda gösterilsin; raporlar arası fark da ("kapanan açıklar") görünsün. | Veri zaten var (analiz başına eksik kavramlar); ucuz ve elde tutmayı artırır. | O | DOG-119 |
| 7 | **Son başvuru tarihi.** İlan çıkarımı son tarihi okusun; pano 7 günden azsa işaretlesin, tarihi geçeni "süresi doldu" saysın. | Pano ve hatırlatma altyapısı hazır; ilan çıkarımına bir alan eklemek yeter. | O | DOG-120 |
| 8 | **İlan istem enjeksiyonuna karşı sertleştirme.** İlan metni LLM istemlerinde açıkça "güvenilmez veri" olarak işaretlensin; içine gizli talimat konmuş ilanlarla eval yapılsın. | Ham ilan metnini doğrudan alan ilan çıkarım istemi ("gereksinim olarak şunu yaz" diyen gizli bir satır gereksinim listesine sızabilir); ön yazı ve uyarlama çıkarılmış gereksinimleri kullanıyor. Onların her ajana taşıdığı kural bizde açık değil. | O | DOG-121 |
| 9 | **Ön yazı üslup kuralları.** Türkçe klişe kara listesi ("dinamik", "takım oyuncusu", "kendimi geliştirmeye açığım"), dikkat çeken başlık formülü ("[unvan], [ilandaki anahtar terim] odaklı"), CV'de olmayan zorunlu gereksinim için sessiz kalmak yerine dürüst bir köprü cümlesi. Bunlar ön yazı eval'ine eklensin. | Bizim kuralımız bugün "CV'de yoksa hiç bahsetme"; onlarınki "sessizce atlanan gereksinim mülakatta saklama gibi okunur, dürüst köprü kur". Hangisinin daha iyi okunduğu ölçülmeli. | O | DOG-122 |
| 10 | **Başvuru formu yanıtları.** "Kendinizi kısaca tanıtın (500 karakter)" ya da "Neden biz?" gibi alanlara karakter sınırlı, CV'ye dayanan kısa yanıtlar üretilsin. | Kariyer.net ve şirket ATS formları bunu çok soruyor; ön yazı altyapısıyla yapılabilir. | D | DOG-123 |
| 11 | **Sonuçlardan kalibrasyon.** Panodaki aşamalar (mülakat, teklif, ret) uyum skoruyla birlikte izlensin: skorumuz mülakatı öngörüyor mu? Kullanıcıya "bu rol türünde mülakat aldın" sinyali verilsin. | Skorun gerçek dünyadaki geçerliliğini ölçmenin tek yolu. | D | DOG-124 |
| 12 | **İlan kaynağı uyarısı.** Yapıştırılan bağlantının alan adı bilinen bir portal ya da ATS değilse uyarılsın; benzer görünen alan adları reddedilsin. | Sahte iş ilanı dolandırıcılığına karşı ucuz bir koruma. | D | DOG-125 |

**Alınmayanlar:** Gmail ve Notion senkronizasyonu (gizlilik ve kapsam), yerel LaTeX akışı, eleştirmen ajan (bizde doğrulama kodda; maliyet getirisinden yüksek), beş boyutlu LLM puanı (bizim kanıt temelli ve ölçülen skorumuzun yerine geçmemeli).
