# Birikmiş İşler

Bilinen, ölçülmüş, ama şimdilik ertelenmiş işler. Her madde bir kararın ya da
bir değerlendirme koşusunun bıraktığı açıktan geliyor; hiçbiri tahmin değil.

Sıra önem değil kayıt sırası. Önceliklendirme her sprint başında yapılır.

---

## 1. Kalan 3 uydurma eşleşme

**Kaynak:** K-24, K-25 · değerlendirme taban çizgisi (25 Eylül 2026)

Üçü de yeni mezun CV'sinde ve anlamsal eşleşmeden geliyor:

```
Gereksinim: "Generative AI Yetkinlikleri, OpenAI, Azure OpenAI, Anthropic Claude"
Kanıt     : "YAPAY ZEKA EĞİTMENİ · Bir Eğitim Vakfı – Teknoloji Atölyesi"
```

Öğrencilere yapay zekâ temelleri anlatmak, üretken yapay zekâ API'leriyle
profesyonel yetkinlik değil. Ama anlamsal olarak yakın düşüyorlar.

**Neden eşik ayarıyla çözülmez:** Eşik taraması (K-24) gösterdi ki eşiği
yükseltmek bu üçünü elerken doğru eşleşmeleri de eliyor. Sorun benzerlik
değerinde değil, gereksinimin **profesyonel deneyim** boyutunun hiç
değerlendirilmemesinde.

**Olası yön:** Gereksinimin `type` alanı zaten var (`skill` / `experience` /
`education` / `soft`). `experience` türü gereksinimlerde kanıtın `role` veya
`bullet` olması aranabilir, `skill` kanıtı yeterli sayılmayabilir.
Değerlendirme setinde ölçülmeli.

---

## 2. Süre: 30 saniye ölçütü açık

**Kaynak:** K-09, K-16

Yerel modelle uçtan uca analiz 45–55 saniye. Spec §13'teki 30 saniye ölçütü
bu modelle ölçülemez; ölçüt üretim modeline taşındı.

Bugün iki LLM çağrısı eksildi (K-22, K-23) ve ilan çıkarımı 29–85 saniyeden
13–29 saniyeye indi, ama darboğaz modelin ham hızı (~61 token/saniye).

**Kapanma koşulu:** Üretim modeliyle bir değerlendirme koşusu.

---

## 3. Üretim modeli seçimi

**Kaynak:** K-03, K-16

Sağlayıcı soyutlaması hazır, geçiş bir env değişikliği. Karar ölçümle
verilecek: `.env`'de model değiştir → `pnpm eval:prepare --refresh` →
`pnpm eval` → aynı 56 iddiada isabet, kaçırma, uydurma, süre ve token
karşılaştır.

En az üç aday karşılaştırılmalı. Karar kriteri yalnızca isabet değil; birim
ekonomisi de (planlama raporu §7.1, %80 brüt marj hedefi) hesaba katılmalı.

---

## 4. Değerlendirme seti meslek çeşitliliği

**Kaynak:** K1 değerlendirmesi

Set 10 çift ama beş ilanın hepsi yazılım/AI. Planda pazarlama, finans, satış,
insan kaynakları gibi mesleklerden de çift olması isteniyordu.

**Neden önemli:** Bir muhasebe ilanının gereksinim dili bir AI ilanınınkinden
tamamen farklı yazılıyor. Kavram bölme kuralları (K-23) yalnızca teknik
ilanlarda sınandı.

---

## 5. CV biçim çeşitliliği

**Kaynak:** K-22, K-19, K-17

Üç CV de yazılım alanından. Kod bölümlemesi (K-22) tanınmayan başlıklı ya da
hiç başlıksız CV'lerde geri çekilme yoluna düşüyor; bu yol hiç gerçek veriyle
sınanmadı.

Özellikle değerli olacak biçimler: iki sütunlu tasarım şablonları, Europass,
LinkedIn PDF çıktısı, tablo ağırlıklı Word şablonları.

---

## 6. `main` geçmişinde kimlik bilgisi şeklinde dize

**Kaynak:** 23 Eylül 2026, PR #1 öncesi

Plan belgesi ilk sürümünde `postgresql://kullanici:parola@localhost` biçiminde
bir örnek içeriyordu ve doğrudan `main`'e push edilmişti. Sonradan temizlendi
ve geçmiş yeniden yazıldı; şu anki `main` temiz.

Gerçek bir kimlik bilgisi değildi (yerel geliştirme yer tutucusu), rotasyon
gerekmiyor. Kayda geçiyor ki ileride bir denetimde şaşırtmasın.

---

## 7. Anlamsal katmanın kapsamı

**Kaynak:** K-15, K-23, K-24

Anlamsal eşleştirme kavram düzeyine indikten sonra 9 eşleşme üretiyor (önce
sıfırdı). Ama 3 uydurmanın da kaynağı o.

Denenmemiş bir daraltma: anlamsal eşleşmeyi yalnızca `soft` türü
gereksinimlerde kullanmak. Teknik terimleri zaten kelime eşleşmesi yakalıyor;
anlamsal katmanın asıl katkısı "takım çalışmasına yatkın" gibi ifadelerde.
Değerlendirme setinde ölçülebilir.

## 8 · İki sütunlu CV'lerde metin sırası bozuluyor

**Ne:** `cv-c-yeni-mezun` iki sütunlu bir PDF ve metin çıkarımı sütunları iç
içe geçiriyor. `HAKKIMDA` başlığının hemen ardından `PROFESYONEL DENEYİM`
geliyor; başlığa ait metin ise deneyim bloğuna düşüyor.

**Nasıl bulundu:** Sprint 2'de CV başlık bilgisi çıkarımı eklenirken, üç
değerlendirme CV'sinden birinin özeti boş çıktı.

**Neden şimdi değil:** Sorun bölümlemede değil, `pdf-parse`'ın sütunları
okuma sırasında. Düzeltmek metin bloklarının sayfa üzerindeki konumuna
bakmayı gerektiriyor — kendi başına bir görev.

**Etkisi:** Bu CV'de özet boş kalıyor (belgede özet bölümü hiç çıkmıyor) ve
hakkımda metni deneyim maddesi gibi işleniyor. Skor bundan zarar görmüyor;
kanıt olarak hâlâ sayılıyor.

## 9 · Font yolu depo köküne bağlı

**Ne:** `@uyarla/fonts` font dosyalarını, `process.cwd()`'den yukarı yürüyüp
`pnpm-workspace.yaml` arayarak buluyor. Yani depo ağacının çalışma anında
diskte durmasını varsayıyor.

**Neden böyle:** Modül çözümlemesinin üç varyantı da Next'in bundler'ında
kırıldı — düz specifier derlemeyi düşürdü, hesaplanmış specifier
`webpackEmptyContext` ile susturuldu, ayrı pakete taşımak
`serverExternalPackages` monorepo paketinde uygulanmadığı için göreli modül
kimliği döndürdü. Dosya sisteminden okumak bundler'ın tümüyle dışında kalan
tek yol.

**Ne zaman sorun olur:** Vercel'e standalone çıktı olarak dağıtımda
`packages/fonts/ttf` pakete girmeyebilir. Worker kendi sunucusunda çalıştığı
için orada sorun yok.

**Seçenekler:** (a) Next `outputFileTracingIncludes` ile font dizinini
dağıtıma dahil etmek, (b) fontu alt kümeye indirip base64 olarak bir .ts
dosyasına gömmek (~40 KB), (c) belge üretimini tümüyle worker'a taşımak.
Dağıtım kararı verildiğinde seçilecek.

## 10 · Yeniden yazım eşleşen terimi düşürebiliyor

**Ne:** Dürüst bir yeniden ifade, kaynakta geçen ve ilanla eşleşen bir terimi
düşürebiliyor. Ölçülen örnek:

```
kaynak: … Python, FastAPI, LLM gateways, vector search, SSE, background tasks, Docker …
yazım : Python ve FastAPI kullanarak, LLM ağ geçitleri, vektör araması, SSE ve arka plan …
        ("Docker" düştü — ilan onu istiyor)
```

**Oran:** 3/93 (%3,2). Üçünden biri çapraz dilli yanlış alarm
("backend services" → "arka uç servisleri"), yani gerçek oran ~%2.

**Neden şimdi düzeltilmedi:** Enjeksiyon kontrolünün aynası olarak bir
`matched_term_dropped` kontrolü yazılabilir. Ama %2'lik bir olaya, üçte biri
yanlış olan bir uyarı eklemek, K-32 sonrası artık hassas olan işaretleri
(93 maddede 4) güvenilmez kılardı.

**Ne zaman ele alınmalı:** Çapraz dilli sözlük güçlendiğinde yanlış alarm
oranı düşer; o zaman kontrol eklenebilir. Ya da prompt'a "kaynakta geçen
teknoloji adlarının hepsini koru" kuralı eklenip ölçülebilir.

## 11 · Çeviri, meşru kazanç yolu ama uydurma sanılıyor

**Ne:** İngilizce bir CV Türkçe bir ilana uyarlandığında, sadık çeviri
ilanın Türkçe terimini maddeye getiriyor ve skor **meşru olarak** artıyor.
Ama `checkPostingTermInjection` bunu uydurma sanıyor: karşılaştırma
`sourceRef` ile yapılıyor ve İngilizce kaynak Türkçe terimi lafzen taşımıyor.

**Ölçülen örnek** (uçtan uca, 26 Eylül):

```
kaynak: … authentication and app infrastructure with JWT/AuthGuard …
yazım : JWT/AuthGuard kullanarak kimlik doğrulama ve uygulama altyapısına …
uyarı : "kimlik" geçiyor ama senin yazdığın hâlinde yok        ← YANLIŞ
karar : kabul → skor 28 → 30                                   ← meşru kazanç
```

**Neden önemli:** K-32'nin "dürüst kazanç sıfır" bulgusu bu yüzden bir miktar
olduğundan düşük ölçülmüş olabilir. Çapraz dilli sözlük güçlendirilirse hem
yanlış alarm düşer hem çeviri kazancı sayılabilir hâle gelir.

**Ne yapılabilir:** `TITLE_SYNONYMS`'e ilan/CV sözlüğünden çapraz dilli
çiftler eklemek (K-25'in yöntemi: ölçülen kaçırmalardan türetmek).
Örneğin `authentication ↔ kimlik doğrulama`, `AI ↔ yapay zeka`.
