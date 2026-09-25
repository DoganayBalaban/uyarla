# Sprint 2 Kapanış — Uyarlama Akışı ve Çıktı

**Tarih:** 26 Eylül 2026 · **Spec:** `docs/superpowers/specs/2026-09-25-sprint-2-uyarlama-design.md`

## Tamamlanma tanımı (spec §14)

| | Madde | Durum |
|---|---|---|
| 1 | Kullanıcı bir analiz sonucundan uyarlama başlatabiliyor | ✅ uçtan uca doğrulandı |
| 2 | Özet, maddeler ve beceri sıralaması üretiliyor | ✅ 9 madde · 33 beceri |
| 3 | Üç uydurma kontrolü çalışıyor ve gerekçe üretiyor | ✅ 29 birim testi |
| 4 | Uyarı taşıyan maddeler karara bağlanmadan indirme açılmıyor | ✅ HTTP 409 doğrulandı |
| 5 | PDF ve DOCX indiriliyor; PDF metni seçilebilir | ✅ kendi `extractText`'imizle okundu |
| 6 | Uyarlama sonrası skor gösteriliyor | ✅ 28 → 30 |
| 7 | Arayüz marka rehberine uygun | ⚠️ token'lar doğrulandı, **görsel kontrol yapılmadı** |
| 8 | İşaretlenen madde oranı ölçülmüş ve kaydedilmiş | ✅ %1,1 · K-32, K-33 |
| 9 | 5 kullanıcıyla test, K2 kararı yazılmış | ❌ **yapılamadı** |

### 7 neden eksik

Ekran görüntüsü alınamadı: makinede Chrome yok ve Playwright'ın tarayıcı
indirmeleri zaman aşımına düştü. Servis edilen CSS'te marka token'larının
(`#2B4EFF`, `#0F172A`, `#F5F7FF`, Manrope, `prefers-color-scheme`, önce/sonra
sınıfları) varlığı doğrulandı, ekranın mantığı canlı veriyle sınandı — ama
kontrast, yerleşim ve koyu tema görünümü gözle bakılmadan onaylanamaz.

### 9 neden eksik

Beş gerçek kişiyle oturum gerektiriyor. Materyal hazır:
`docs/kullanilabilirlik-testi.md` — görevler, her katılımcı için not tablosu
ve K2 ölçütü.

## K2 kapısına giderken bilinmesi gerekenler

**Dürüst skor kazancı sıfır ölçüldü** (K-32). 10 çiftin 10'unda, doğrulamayı
geçen yeniden yazımların skora katkısı +0,0. Bunun yapısal bir sebebi var:
skorlama zaten normalleştirme, çapraz dilli sözlük ve anlamsal eşleşme
kullanıyor; adayda yetkinlik varsa zaten eşleşiyor, yoksa dürüst bir ifade
onu ekleyemez.

Bu, marka rehberi §6.2'deki "%41'den %83'e" örneğini ve spec §10'un
beklentisini doğrudan etkiliyor. **Kullanılabilirlik testi bunu sınamalı:**
kullanıcı, skor değişmezken de uyarlanmış CV'yi kullanmak istiyor mu? K2'nin
asıl sorusu bu hâle geldi.

Tek istisna çapraz dilli durum: İngilizce CV Türkçe ilana çevrilince skor
meşru olarak artabiliyor (28 → 30 ölçüldü). Ama enjeksiyon kontrolü bunu
uydurma sanıyor — `birikmis-isler.md` #11.

## Sprint boyunca alınan kararlar

| # | Karar |
|---|---|
| K-30 | CV çıktısında gömülü font (DejaVu Sans), dosya sisteminden bulunuyor |
| K-31 | Ad ve başlık çıkarımı kodda, LLM'e sorulmuyor |
| K-32 | Madde yeniden yazımına ilan kavramları verilmiyor |
| K-33 | Anlamsal sapma eşiği 0,70 |

## Sprint boyunca bulunan sessiz hatalar

Üçü de testlerden geçiyordu çünkü hiçbir test oraya bakmıyordu.

1. **`.gitignore` kaynak dizinini yutuyordu.** `storage/` kuralı
   `packages/core/src/storage/` dizinini de kapsıyordu; `fileStore.ts` hiç
   depoya girmemişti ve temiz bir klonda `@uyarla/core` derlenmiyordu.
2. **Üretilen her CV'nin tepesinde "İsimsiz" yazıyordu.** Sprint 1 `fullName`
   ve `headline` alanlarını hiç doldurmuyordu; skor onları kullanmadığı için
   fark edilmemişti (K-31).
3. **İngilizce çoğul eşleşmiyordu.** `MIN_STEM_LENGTH = 4` yüzünden "APIs"
   soyulamıyor, "REST API" ile buluşamıyordu. Uydurma kontrolünü yanlış
   alarm ürettiriyor, Sprint 1 skorlamasında sessizce eşleşme
   kaybettiriyordu.

Ayrıca bir "düzeltme" hatayı gizledi: PDF fontu için webpack'i susturan bir
numara derlemeyi geçirdi ama indirme çalışma anında 500 verdi. Uçtan uca
deneme olmasa fark edilmezdi (K-30).

## Sayılar

```
336 test (core 287 · worker 22 · web 27)
typecheck temiz · next build uyarısız
eşleştirme isabeti      : %91,1  (Sprint 1 taban çizgisiyle aynı)
işaretlenen madde oranı : %1,1   (93 maddede 1)
dürüst skor kazancı     : +0,0
```

## Sıradaki adımlar

1. Arayüzü gözle kontrol et (madde 7).
2. Beş kişiyle kullanılabilirlik testini yap, K2 kararını `kararlar.md`'ye
   **K-34** olarak yaz (madde 9).
3. Çıktıyı gerçek bir ATS tarayıcısına sok (spec §15'in son riski).
4. Skor vaadi hakkında ürün kararı ver (K-32).
