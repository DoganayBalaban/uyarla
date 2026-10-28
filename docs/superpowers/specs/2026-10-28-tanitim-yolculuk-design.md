# Tanıtım sayfası: başvuru yolculuğu ve yeni özellik sahneleri

**Tarih:** 28 Ekim 2026 · **Issue:** DOG-160 · **Durum:** Tasarım onaylandı, plan bekliyor

## 1. Amaç

Tanıtım sayfası yalnızca CV skorunu ve uyarlamayı anlatıyor. Sonradan gelen özellikler ya hiç görünmüyor ya da bento listesinde tek satır:

- iş arama (DOG-150),
- form yanıtları (DOG-123) ve ön yazı,
- başvuru panosu ve takip mesajları (DOG-91, DOG-99, DOG-117),
- mülakat hazırlığı ve yazılı pratik (DOG-97, DOG-118),
- LinkedIn denetimi (DOG-157).

Sayfa artık başvurunun tamamını anlatıyor. Her adımda, ürünün ekranlarını taklit eden ve motion ile tarayıcıda oynayan bir sahne var.

**Başarı ölçütü:**
1. Ziyaretçi sayfayı kaydırırken altı adımın her birinde ne yapıldığını bir sahnede görüyor.
2. Her adımın ücretsiz mi abonelikte mi olduğu, fiyat tablosuyla aynı kaynaktan yazılı.
3. Sahnelerdeki örnek veri ürünün "uydurma yok" kuralına uyuyor ve bu kodla denetleniyor.
4. Sayfa 390 px'te yatay kaymıyor. Hareket azaltma açıkken sahneler durgun ama anlaşılır.

## 2. Kararlar

| Konu | Karar | Gerekçe |
|---|---|---|
| "Video" | **Sayfada canlı sahne** (motion), video dosyası yok | Kullanıcı seçti. Hafif, keskin, metin değişince güncel, hareket azaltmaya uyuyor. Mevcut demolar zaten böyle. |
| Anlatı | **Tek başvuru hikâyesi (A):** Bul → Uyarla → Başvur → Takip et → Hazırlan → Görünür ol | Kullanıcı seçti. Ürünün farkı her adımda aynı ilke (kanıt CV'den, uydurma yok); bu ancak yolculuk olarak görünüyor. Sekmeli vitrin (B) ve mevcut listeye ekleme (C) reddedildi. |
| Örnek kişi | Mevcut demolardaki **Elif Yılmaz**, **Frontend Geliştirici** ilanı; şirket kurgusal **"Kuzey Yazılım"** | Hero ve üç demo ile süreklilik. Gerçek şirket adı yok. |
| Sayı | Yüzde, kalan süre, sonuç sayısı, istatistik yok | Marka rehberi §11 ve bekleme ekranlarındaki yaklaşım (K-104): kanıtsız sayı yok. Skor sayıları (28 → 41) mevcut demo senaryosuyla aynı. |
| Erişim etiketi | Her adımın altında satır başına çip; metin `FEATURE_ROWS`'tan türetiliyor | Bir adımda ücretsiz ve abonelikli satırlar karışık (LinkedIn: teşhis ücretsiz, yazım abonelikte). Tek etiket yanıltırdı; elle yazılan etiket fiyat tablosundan kopardı. |
| İş arama satırı | `FEATURE_ROWS`'a **"İş arama bağlantıları"** satırı ekleniyor (ücretsiz/ücretsiz) | Etiketin tek kaynağı olsun. `/plans` tablosuna da bir satır ekleniyor; doğru bilgi. |
| Eklenti | "Yakında" rozetiyle | Chrome mağazası yayını ertelendi (DOG-159). |
| Kalkanlar | "Nasıl çalışır: 3 adım" ve bento listesi kalkıyor | Yolculuk özeti ve altı bölüm aynı işi daha iyi yapıyor. |
| Hero | Başlık ve film kalıyor; rozet ve alt metin güncelleniyor | Ücretsiz skor en güçlü giriş kancası. |

## 3. Sayfa yapısı

1. **Hero.** Başlık "Her ilana, doğru CV." ve hero filmi aynı kalıyor. Rozet "Yeni: Mülakat hazırlığı ve LinkedIn denetimi" oluyor. Alt metin başvurunun tamamını söylüyor: "İlanı yapıştır, CV'nin ne kadar uyduğunu gör, ilana özel hâle getir; başvur, takip et, mülakata hazırlan. Deneyimini uydurmadan."
2. **İlan siteleri şeridi** ve **Sorun** bölümleri değişmiyor.
3. **Yolculuk şeridi** (yeni, `#yolculuk`). Altı adımın numarası ve adı, her biri kendi bölümüne bağlantı. Sayfa kaydırıldıkça görünen bölümün adımı vurgulanıyor. Masaüstünde bölümlerin üstünde yapışkan. Dar ekranda yatay kaydırılan tek satır; sayfa kaymıyor, şerit kendi içinde kayıyor.
4. **Altı bölüm** (`#bul`, `#uyarla`, `#basvur`, `#takip`, `#hazirlan`, `#gorunur`). Her bölümde:
   - etiket (`01 · Bul`),
   - başlık, kısa metin, üç madde,
   - erişim çipleri,
   - sahne.

   Metin ve sahne zikzak dizilir. "Uyarla" bölümünde mevcut üç demo (gereksinim, uyarlama, uydurma kontrolü) ve PDF/DOCX çıktı bloğu alt alta durur.
5. **Dürüstlük** bölümü kalıyor. Metni "her adımda aynı kural" diye güçleniyor: kanıt CV'den, uydurma yok, gönderimi sen yaparsın.
6. **Kimler için**, **Fiyat**, **SSS** ve **son çağrı** kalıyor. SSS'ye üç soru ekleniyor:
   - "Mülakat hazırlığında sorular nereden geliyor?"
   - "LinkedIn profilimi nasıl denetliyorsunuz?"
   - "Başvuru formlarını siz mi dolduruyorsunuz?" Cevap: hayır, sen kopyalarsın.

## 4. Sahneler

Ortak kurallar:
- Her sahne 10–14 saniyelik bir döngü. Ekrana girince (%30 görünür) başlıyor, çıkınca duruyor.
- Hareket azaltma açıksa son kare duruk gösteriliyor.
- Kapsayıcıda `role="img"` yok. Sahnenin bir cümlelik açıklaması `aria-label`'lı bölge olarak var, içindeki hareketli metin `aria-hidden`.
- Ekran etiketleri ürünün kendi metinleri: `STAGE_LABEL`, `SECTION_LABELS`, `STATUS_LABELS`. Elle yazılmıyor.

### 4.1 Bul: iş arama
1. Profil satırı gelir: "Frontend Geliştirici · İstanbul · hibrit".
2. Arama sorgusu yazılarak oluşur.
3. Sorgu dört site kartına dağılır. Her kartta sitenin notu var, `JobSearch`'teki `SITE_NOTE` kuralıyla:
   - Kariyer.net: "Şehri sitede seçersin"
   - LinkedIn: "İstanbul, Türkiye"
   - Jooble: "İstanbul"
   - Careerjet: "İstanbul"
4. İmleç bir kartta "Aç ↗"a basar.

Sonuç sayısı gösterilmiyor; uyarla ilan getirmiyor, siteyi doğru sorguyla açıyor.

### 4.2 Uyarla
Mevcut `RequirementDemo`, `AdaptDemo`, `CheckDemo` ve çıktı bloğu aynen.

### 4.3 Başvur: form yanıtları ve ön yazı
1. Form sorusu gelir: "140 karakterde neden sen?".
2. Cevap yazılır; sayaç 0'dan nihai uzunluğa çıkar (en çok 140). Biter bitmez "Sınır içinde ✓" görünür.
3. Altta ön yazıdan bir paragraf belirir. Bir ifadesinin yanında kaynak çipi var: "CV'nden: Kod incelemelerine katıldım".
4. "Kopyala" → "Kopyalandı".

### 4.4 Takip et: başvuru panosu
1. Pano beş sütun: Kaydedildi, Başvuruldu, Mülakat, Teklif, Olmadı.
2. Skor 28'deki kart Başvuruldu'ya sürüklenirken kapı açılır: "2 zorunlu gereksinim CV'nde görünmüyor. Önce uyarlamak ister misin?" Bu metin `ApplyCheck`'teki kalıptan.
3. "Uyarla" seçilir; kart 41 skorla Başvuruldu'ya yerleşir, sonra Mülakat'a kayar.
4. Teşekkür notu taslağı yazılır: "Merhaba [ad], bugünkü görüşme için…". `[ad]` vurgulu kalır; alıcının adı uydurulmaz.

### 4.5 Hazırlan: mülakat
1. Soru gelir: "Bir kod incelemesinde görüş ayrılığını nasıl çözdün?" Yanında kanıt çipi var: "CV: Kod incelemelerine katıldım".
2. Pratik cevabı yazılır; içinde "12 geliştiricilik ekipte" geçiyor.
3. Geri bildirim gelir:
   - STAR satırları: Durum ✓, Görev ✓, Eylem ✓, Sonuç eksik.
   - "Kâğıtta yok: '12 geliştirici' CV'nde geçmiyor."

### 4.6 Görünür ol: LinkedIn
1. Profil kartında başlık "Yazılım Geliştirici".
2. Denetim satırı gelir: Başlık · Geliştirilebilir · "Hedef rolünü ve öne çıkan becerini söylemiyor".
3. Yeni başlık yazılır: "Frontend Geliştirici · React, TypeScript · Kod incelemesi". Her parçanın altında CV'den kanıt çipi var.
4. Köşede "Eklentiyle profilini aktar · Yakında".

## 5. Yapı

Bütün dosyalar `apps/web/src/features/landing` altında:

- **`journey.ts`:** `JOURNEY` dizisi. Her adımda şunlar var:
  - `id`, `number`, `name`;
  - `title`, `text`, `bullets`;
  - `rows`: `FEATURE_ROWS` etiketlerine başvuru ve her biri için kısa ad.

  `accessChips(step)` her satır için kısa adı ve erişimi döndürüyor. Erişim metni `free` değerinden çıkıyor:
  - `true` → "Ücretsiz"
  - string → "{değer} ücretsiz" (ör. "Ayda 1 ücretsiz")
  - `false` → "Abonelikte"
- **`demos/scenes.ts`:** beş sahnenin örnek verisi ve zaman çizelgeleri. `ELIF_CV` örnek CV metni de burada. Mevcut demo verisi `demoScript.ts`'te kalıyor.
- **`demos/demoScript.ts`:** `heroPhaseAt` genel bir `phaseAt(phases, ms)` üstüne kuruluyor. Davranış aynı, mevcut testler geçiyor.
- **`demos/useScenePlayer.ts`:** `useScenePlayer(phases)` → `{ ref, phase, progress }`. Ekranda görünürlüğü, döngüyü (`useAnimationFrame`) ve hareket azaltmayı (son aşama, progress 1) yönetiyor.
- **`demos/JobSearchDemo.tsx`, `ApplyDemo.tsx`, `BoardDemo.tsx`, `InterviewDemo.tsx`, `LinkedInDemo.tsx`:** her biri `{phase, progress}` ile çizen bir `…Film` bileşeni ve oynatıcıya bağlayan dış bileşen. Vitrin `…Film`'i kare seçerek kullanıyor.
- **`components/JourneyRail.tsx`:** şerit. Görünen bölüm `IntersectionObserver` ile bulunuyor.
- **`LandingPage.tsx`:** `STEPS` ve `BENTO_ITEMS` kalkıyor; yolculuk ve bölümler `JOURNEY`'den çiziliyor.
- **`faq.ts`:** üç yeni soru.
- **`apps/web/src/app/ui/landing/page.tsx`:** yerel vitrin. Sahne ve aşama seçiliyor, kare kare bakılıyor. `/ui/waiting` gibi.
- **`features/billing/plans.ts`:** `FEATURE_ROWS`'a "İş arama bağlantıları" satırı.

## 6. Test

- **Senaryo tutarlılığı** (`scenes.test.ts`):
  - Her kanıt alıntısı `ELIF_CV` içinde birebir geçiyor.
  - "Kâğıtta yok" ifadesi `ELIF_CV`'de geçmiyor.
  - Form cevabı 140 karakteri aşmıyor.
  - LinkedIn başlığındaki her parçanın kanıtı `ELIF_CV`'de.
  - Pano kapısındaki eksik zorunlu sayısı, demo gereksinimlerindeki kanıtsız zorunlu sayısıyla aynı.
- **Zaman çizelgesi:** `phaseAt` sınırlarda doğru aşamayı veriyor; döngü toplamı tutuyor; `heroPhaseAt` eskisiyle aynı.
- **Etiketler** (`journey.test.ts`):
  - Her adımın `rows`'u `FEATURE_ROWS`'ta var.
  - `accessChips` "Ücretsiz", "Ayda 1 ücretsiz" ve "Abonelikte" üretiyor.
  - LinkedIn adımında hem ücretsiz hem abonelikli çip var.
- **Çizim** (`demos.render.test.tsx`): her yeni sahne son karede beklenen metni gösteriyor (ör. "Kâğıtta yok", "Kopyalandı", "Yakında") ve bir `aria-label` taşıyor.
- **Elle kontrol:**
  - Tarayıcıda 1440 ve 390 px, açık ve koyu temada bakılıyor.
  - Hareket azaltma açıkken bakılıyor.
  - Ekran dışındaki sahnenin durduğu doğrulanıyor.
  - Konsolda hata olmamalı.

## 7. Teslim

test dalına dört PR. Her PR'dan sonra yerelde gösterilecek.

1. **Altyapı:** `phaseAt`, `useScenePlayer`, `journey.ts` (ve `FEATURE_ROWS` satırı), `JourneyRail`, yeni sayfa düzeni. Mevcut demolar "Uyarla"da. Sahnesi henüz gelmemiş bölümler yalnızca metinle duruyor; main'e ancak dört PR bitince geçildiği için canlıda bu ara hâl görünmüyor.
2. **Sahneler:** Bul ve Başvur.
3. **Sahneler:** Takip et ve Hazırlan.
4. LinkedIn sahnesi, SSS, dürüstlük metni, hero rozeti ve alt metni.

Hepsi bitince test → main.

## 8. Kapsam dışı

- Video dosyası dışa aktarımı (sosyal medya, mağaza).
- Fotoğraf yerleri (`Photo`) ve kimler için bölümü.
- İngilizce sayfa.
- A/B testi ve ölçüm. Huni ölçümü DOG-101 ile ayrı.
