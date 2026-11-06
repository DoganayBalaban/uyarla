# "Bende var": analizde eksik gereksinimi ekleme

**Tarih:** 6 Kasım 2026 · **Durum:** Onay bekliyor

## Amaç

Aday bir şeyi biliyor ama basit bulduğu için CV'ye yazmamış (örnek: HTML). Sırf
bu yüzden puanı düşmesin. Analiz ekranında eksik gereksinimi eklesin, skor
güncellensin, uyarlanan CV'de eklenmiş hali çıksın.

Bugün en yakın şey "CV'mde var ama bulunamamış" bildirimi. O yalnızca kayıt
tutuyor; skoru ve uyarlamayı değiştirmiyor (K-69).

## Hedefler

- Eksik ya da kısmi satırda "Bende var" düğmesi (`ScoreBreakdown`).
- Beceride tek tık; deneyim ve eğitimde kısa bir form (kullanıcının seçtiği C).
- Skor aynı formülle yeniden hesaplanıyor.
- Uyarlanan CV beyanları içeriyor.
- Kullanıcı eklediğini görüyor ve geri alabiliyor.

## Hedef dışı

- **Kalıcılık yok (kullanıcının kararı).** Beyan yalnızca o analizde kalıyor.
  Sonraki analize, CV sürümüne ve olgu hafızasına (K-75) gitmiyor. Hesabım'da
  liste yok.
- Veritabanı göçü yok: beyanlar `Analysis.result` içinde.
- LLM çağrısı yok: analiz aşamasında cümle olduğu gibi kullanılıyor.
- "CV'mde var ama bulunamamış" bildirimi değişmiyor. Anlamı farklı: CV'de yazıyor
  ama okunamamış. "Bende var" ise CV'de yazmıyor demek.

## Başarısızlık sayılacak durumlar

- Modelin beyan dışında bir şey eklemesi. K-28 kontrolleri aynen çalışmalı.
- Puanın elle verilmesi ya da formülü atlaması.
- Eklenen şeyin kullanıcıya görünmeden CV'ye girmesi.

## Kullanıcı deneyimi

Kararlar kullanıcının: gösterim C seçeneği, kalıcılık yok. Ayrıntılar Claude'un
önerisi (aşağıda "Claude'un kararları").

| Satır türü | Davranış |
|---|---|
| `skill` | Tek tık. Eklenebilecek terim birden çoksa önce hangileri seçiliyor. Temiz terim yoksa düğme yok |
| `experience` | Form: hangi iş ya da proje (seçim) + bir cümle |
| `education` | Form: okul + bölüm |
| Unvan | Düğme yok: unvan CV'de yazan bir gerçek |

- Düğme yalnızca `onRequirementChange` geldiğinde görünüyor; örnek raporda yok.
- Satırın kendisi bugün düğme (listeye götürüyor). "Bende var" iç içe düğme
  olamaz; satır iki ayrı etkileşimli öğeye ayrılıyor.
- Beyan eklenince satır "sen ekledin · geri al" etiketi alıyor.
- Beyan skoru değiştirmezse satır "CV'nde görünmüyor" grubunda kalıyor, etiket
  yine görünüyor ve "Eklendi, CV'ne girecek; bu şart skoru değiştirmedi" diyor.
  Süre şartları ("en az 3 yıl") CV'deki işlerin süresinden hesaplandığı için bu
  beklenen bir durum. Puan garantisi veren metin yazılmıyor.
- Aşağıdaki gereksinim listesinde beyandan gelen kanıt "Sen ekledin" diye
  görünüyor (olgu kanıtındaki `fact: true` gibi bir işaretle).
- Uyarlama başladıktan sonra düğme ve "geri al" kalkıyor; etiket kalıyor. Satırda
  "Uyarlama ekranından madde ekleyebilirsin" notu var. Gerekçe: analiz başına tek
  uyarlama var (`Adaptation.analysisId` benzersiz), yenisi başlatılamıyor; geri
  alma da taslaktaki madde kimliklerini bozardı. Uyarlamadaki "AI ile yaz" ve
  kullanıcı maddesi bu ihtiyacı zaten karşılıyor.

## Teknik tasarım

### Veri

`result.declarations`, isteğe bağlı; eski analizlerde yok.

```ts
type Declaration =
  | { requirementIndex: number; kind: "skill"; terms: string[]; at: string }
  | { requirementIndex: number; kind: "experience"; target: { section: "experience" | "projects"; index: number }; text: string; at: string }
  | { requirementIndex: number; kind: "education"; school: string; field: string; at: string }
```

Şema ve uygulama `packages/core/src/adapt/` altında, olgular gibi. Gereksinim
başına en çok bir beyan var; aynı gereksinime yenisi eskisinin yerine geçiyor.

### Profile uygulama

Tek giriş noktası `analysisProfile` (`core adapt/facts.ts`). Olgulardan sonra
beyanları da uyguluyor. Route, worker uyarlama, karar, takip ve indirme onu
kullandığı için hepsi beyanları kendiliğinden görüyor.

- **skill:** `terms`, `profile.skills` sonuna ekleniyor; büyük küçük harf ve Türkçe
  normalleştirmeyle aynısı varsa eklenmiyor. `skillGroups`'a dokunulmuyor: belge
  modeli gruba girmeyen becerileri sonda başlıksız bir satırda gösteriyor
  (`document/model.ts`), yani CV kategorili olsa da beceri belgede çıkıyor.
- **experience:** Seçilen iş ya da projenin maddelerinin sonuna
  `{ text, sourceRef: text }`. Mevcut madde kimlikleri değişmiyor (K-75'teki gibi).
- **education:** `profile.education` sonuna `{ school, degree: null, field,
  startDate: null, endDate: null }`.

### Skor

`PATCH /api/analysis/[id]` iki yeni eylem alıyor: `declare` ve `undeclare`. İkisi
de `correct` dalındaki yeniden hesabı kullanıyor (`scoreProfile` +
`markFactEvidence`). Beyanlar güncellenmiş `result`, sonra `analysisProfile`.

Girdi denetimi `parseAnalysisPatch` içinde:
- `skill`: `terms` 1–10 terim, her biri en çok 60 karakter. Terimler core
  `declarableTerms`'ten olmalı, serbest metin kabul edilmiyor: eksik kalan
  kavramlar, seçenek grubu ("Jest / Cypress") üyelerine açılmış halde. Süre notu
  ve cümle gibi okunan kavram giremez. Temiz terim yoksa düğme çıkmıyor;
  gereksinim metni beceri olarak yazılmıyor.
- `experience`: `text` 10–200 karakter, `target` profilde var olmalı.
- `education`: `school` ve `field` 2–120 karakter.
- Türü uymayan beyan 422.
- Analizin uyarlaması varsa 409.

Skor kapıları genişletilmeli, yoksa yeni skor görünmez:
- `scoreWithExclusions` (`server/requirementExclusion.ts`)
- `applyExclusions` (`features/analysis/exclusion.ts`)

İkisi de bugün yalnızca `corrections` ve `positionCorrection` varsa yeniden
hesaplıyor; `declarations` dolu olduğunda da hesaplamalı. `result.score` ilk
skor olarak kalıyor (K-69).

### Uyarlama

Ek iş yok denecek kadar az: worker `analysisProfile` ile okuyor.
- Beceri `addedSkills` değil, profilin kendi becerisi olarak geliyor;
  `orderSkillsForPosting` onu ilana göre sıralıyor.
- Deneyim cümlesi sıradan bir madde; `sourceRef` kullanıcının cümlesi olduğu için
  K-28 kontrolleri ona karşı çalışıyor. Model başka maddeye terim taşırsa
  işaretleniyor; bu doğru davranış.
- Önce/sonra skoru `adaptationDecision` içinde aynı profilden hesaplanıyor.

### Metin ve kararlar

- Rapordaki cümle: "Uyarladığımızda eksikleri deneyiminin izin verdiği ölçüde
  görünür kılıyoruz; senin eklediklerin dışında olmayan bir şey eklemiyoruz."
- Aynı vaat şu dosyalarda da geçiyor, gözden geçirilecek: `ApplyCheck.tsx`,
  `FollowUpPanel.tsx`, `InterviewSimulation.tsx`, `email/templates.ts`, `reels.ts`.
- `docs/kararlar.md`: yeni K-114. K-69'a ("CV hakkında beyan alınmıyor") ve
  K-27'ye ("küme değişmez") K-114'e giden not.

## Claude'un kararları

Kullanıcı bunları onaylamadı, belgeyi okurken kontrol edebilir:
- Unvanda düğme yok.
- Birden çok eksik kavramda tek tık yerine seçim.
- Eğitim formu okul + bölüm (C seçeneği "hangi iş" diyordu; eğitime uymuyor).
- Uyarlama başlayınca ekleme ve geri alma kilitleniyor.
- Hiç iş ya da proje yoksa deneyim satırında düğme yok.
- Cümle analizde LLM'den geçmiyor.
- Karakter sınırları.

## Doğrulama

- Core birim testleri: beyanların profile uygulanışı, tekrar eklememe, kimliklerin
  değişmemesi.
- Route ve parse testleri: geçersiz girdi, tür uyumsuzluğu, uyarlama varken 409,
  undo sonrası skorun geri dönmesi.
- Uçtan uca: HTML eklenince skorun arttığı, uyarlanan belgede HTML'in göründüğü.
- `pnpm eval:facts` benzeri ölçüm yok; beyan kullanıcının kendi metni, uydurma
  ölçümünü değiştirmemeli. Uyarlama değerlendirmesi beyansız analizde aynı sonucu
  vermeli.

## Geliştiriciye bırakılanlar

Bileşen bölünmesi, form görünümü, hata mesajlarının metni.
