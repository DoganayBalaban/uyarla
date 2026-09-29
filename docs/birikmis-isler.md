# Birikmiş İşler

Bilinen, ölçülmüş, ama şimdilik ertelenmiş işler. Her madde bir kararın ya da
bir değerlendirme koşusunun bıraktığı açıktan geliyor; hiçbiri tahmin değil.

Sıra önem değil kayıt sırası. Önceliklendirme her sprint başında yapılır.

---

## 1. Kalan 3 uydurma eşleşme — KISMEN KAPANDI (K-37)

**Kaynak:** K-24, K-25 · değerlendirme taban çizgisi (25 Eylül 2026)

**Durum:** Üçten biri kapandı. `experience` türü gereksinimler artık yalnızca
anlatı kanıtıyla (`role`, `bullet`) karşılanabiliyor; beceri listesi onlar için
kanıt sayılmıyor. Ölçüm: isabet %91,1 → **%92,9**, uydurma 3 → **2**, kaçırma
2'de sabit (K-37).

**Kalan 2 uydurma** ikisi de `skill` türü gereksinim ve ikisi de yeni mezunun
beceri listesindeki `Yapay Zeka Araçları` satırına düşüyor (0,7056 ve 0,6687).
Tür kısıtı bunları eleyemiyor: gereksinim gerçekten bir beceri gereksinimi,
kanıt gerçekten bir beceri kaydı. Eşik de eleyemiyor — uydurmaların benzerliği
meşru eşleşmelerin bandının tam içinde, en yakın iki komşu arasında 0,0007 var
(K-37).

**Sonraki aday:** madde #15'teki güven tabanı, ya da beceri satırlarının
"şemsiye terim mi, somut teknoloji mi" ayrımı. İkincisi henüz formüle
edilmedi.

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

## 7. Anlamsal katmanın kapsamı — KAPANDI (K-37, reddedildi)

**Kaynak:** K-15, K-23, K-24 · **Kapanış:** 27 Eylül 2026

Hipotez şuydu: anlamsal eşleşmeyi yalnızca `soft` türü gereksinimlerde
kullanmak. K-15 bu kapıyı açık bırakmıştı.

**Ölçüm kapattı.** `pnpm eval:kapsam`: isabet %91,1'den **%85,7'ye** düşüyor,
kaçırma 2'den 8'e çıkıyor. Sebebi verinin kendisinde — değerlendirme setindeki
beş ilanda **hiç `soft` türü gereksinim yok**, yani kapsam `soft`'a
daraltılınca anlamsal katman tümüyle susuyor.

Bulgu, katmanın ne işe yaradığını da söylüyor: yumuşak beceriler değil,
çapraz dilli ve eş anlamlı teknik eşleşmeler (`Yazılım Mühendisliği` ↔
`Yazılım Geliştirme`).

`semanticTypes` yapılandırması yerinde duruyor: set büyüdüğünde (#4) tarama
tekrarlanabilsin diye. `soft` gereksinim içeren bir ilan eklendiğinde bu
hipotez yeniden ölçülmeye değer.

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

**Kısmi hafifletme (27 Eylül 2026):** Biçim kontrolü (`format/check.ts`)
arada içerik olmadan art arda gelen başlıkları "metin sırası karışmış
olabilir" uyarısıyla kullanıcıya gösteriyor; DOCX'te `w:cols` ile tanımlı
çok sütunlu düzen doğrudan "sorun" olarak işaretleniyor. Çıkarım sırası
hâlâ düzeltilmiyor.

## 9 · Font yolu depo köküne bağlı · KAPANDI (K-42, 29 Eylül 2026)

**Nasıl kapandı:** `next.config.mjs` font dizinini indirme route'unun izine
elle ekliyor (`outputFileTracingIncludes`) ve `@uyarla/fonts` artık depo
işareti değil hedefin kendisini arıyor. Negatif kontrolle doğrulandı: depodaki
fontlar gizliyken, standalone çıktısındaki kopyalarla Türkçe karakterleri
doğru bir PDF üretildi.

**Aşağıdaki metin kapanmadan önceki durumu anlatıyor; kayıt için duruyor.**

### Önceki durum

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

## 10 · Yeniden yazım eşleşen terimi düşürebiliyor · KAPANDI (K-38)

**Kapanış (28 Eylül 2026):** `verify/preserve.ts` kaynakta geçen ilan
kavramlarının, sayıların ve terim uyumu dayanağının yazımda korunmasını
şart koşuyor; tutmazsa yazım önerilmiyor. Uyarı eklemek yerine yazımı
hiç göstermemek, aşağıdaki yanlış alarm kaygısını da ortadan kaldırıyor.

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

## 12 · Gerçek e-posta hiç denenmedi

**Ne:** Magic link akışı yalnızca konsol modunda doğrulandı
(`RESEND_API_KEY` yok → bağlantı terminale yazılıyor). Resend üzerinden
gerçek bir e-posta gönderilip gelip gelmediği, spam'e düşüp düşmediği
bilinmiyor.

**Neden şimdi değil:** Resend hesabı ve alan adı doğrulaması gerekiyor; ikisi
de kullanıcının işi.

**Ne zaman gerekli:** K3'ten (22 Kasım) önce. Ödeme alan bir ürünün giriş
e-postası spam klasörüne düşerse kullanıcı hiç giremez.

## 13 · Anonim kullanıcı kayıtları birikiyor · KAPANDI (27 Eylül 2026)

**Ne:** Kayıt olmadan giden ziyaretçilerin `User`, `Resume`, `JobPosting` ve
`Analysis` kayıtları veritabanında kalıyor. Kayıt olanların anonim kaydı
`onLinkAccount` sonrası siliniyor, ama olmayanların kalıyor.

**Nasıl kapandı:** `apps/web/lib/temizlik.ts` 30 günden eski, `isAnonymous`
alanı tam `true` olan kullanıcıları bulup `lib/silme.ts`'e devrediyor — hesap
silme akışıyla (#14) aynı kod, iki kopya yok. Çağıran betik:
`pnpm --filter @uyarla/web temizlik` (öntanımlı DENEME kipi, silmek için
`--sil`). Tümleşik test kayıtlı kullanıcının, `isAnonymous` NULL olanın ve
30 günden yeni ziyaretçinin verisine dokunulmadığını gerçek veritabanında
doğruluyor. Saklama süresi ve deneme kipi kararı K-41'de.

**Kalan açık — cron yok.** Betik elle çalıştırılıyor. Zamanlanmış görev
altyapısı dağıtım kararına bağlı (K-02: worker ayrı sunucuda, Vercel'in
fonksiyonları sürekli çalışamıyor). Dağıtım netleştiğinde tek satırlık iş.

**AÇIK KALAN — cron kurulumu dağıtım kararına bağlı.** Betik var, onu günde
bir çalıştıracak bir şey yok. Seçenekler dağıtım topolojisine göre (K-02):

- **Vercel Cron** → `/api/temizlik` gibi bir uç açıp `CRON_SECRET` ile
  korumak. Tek dezavantaj: silme işi web katmanının fonksiyon süresine bağlı
  kalıyor.
- **Worker sunucusunda `node-cron` ya da sistem `crontab`** → süre sınırı
  yok, ama worker şu anda kimlik ve kullanıcı verisi bilmiyor (spec §4) ve o
  sınırı aşmak gerekir.
- **`crontab` + `pnpm --filter @uyarla/web temizlik --sil`** → en az kod,
  worker'ın sınırını da bozmuyor; sunucuda depo ağacının durmasını istiyor.

**Ne zaman gerekli:** Trafik başladığında. Dağıtım kararı verilirken bu üç
seçenekten biri seçilmeli; kod tarafında yapılacak iş yalnızca tetikleme.

## 14 · Hesap silme akışı yok · KAPANDI (27 Eylül 2026)

**Ne:** Marka rehberi "istediğin an silebilirsin" diyor. Sahiplik alanları
(`Analysis.userId`, `JobPosting.userId`) bunu artık mümkün kılıyor — bir
kullanıcının tüm verisi tek sorguyla bulunabiliyor — ama akış yazılmadı.

**Nasıl kapandı:** `apps/web/lib/silme.ts` sekiz tabloyu tek `$transaction`
içinde siliyor, diskteki CV dosyaları işlemden sonra kaldırılıyor (K-36).
`DELETE /api/account` yalnızca oturum sahibinin kimliğini kullanıyor;
`/account` ekranı marka rehberi §10.2'deki onay metnini soruyor. Tümleşik
test (`lib/silme.integration.test.ts`) başka kullanıcıların verisine
dokunulmadığını ve işlem düşerse hiçbir şeyin gitmediğini gerçek
veritabanında doğruluyor.

**Kalan açık — `Verification` satırları:** Magic link doğrulama satırı
kullanıcının e-postasını JSON `value` alanında taşıyor ve `userId` ile
bağlanmıyor; silme kapsamına alınamadı. Satır 15 dakikada geçersiz oluyor ve
bağlantı kullanıldığında siliniyor, yani pencere küçük. Kapatmak için
`value` üzerinde metin eşleşmesi gerekir — geri alınamaz bir silme işleminde
bulanık eşleşme istemedik. Bekleyen bağlantıları süresi geçince toplayan ayrı
bir temizlik adımı doğru yol.

## 15 · Kalan 2 uydurma: şemsiye beceri terimi · KISMEN (K-38)

**Güncelleme (28 Eylül 2026):** 3. seçenek (kavram özgüllüğü) uygulandı:
özel adlarda anlamsal eşleşme kapalı. Uçtan uca testte "GraphQL" ↔
"Next.js" ve "CI/CD" ↔ "Git" sahte eşleşmelerini kapattı. Değerlendirme
setiyle ölçülmedi; "Yapay Zeka Araçları" vakası (şemsiye terim) için 2.
seçenek hâlâ açık.

**Kaynak:** K-37 · 27 Eylül 2026

K-37 üç uydurmadan birini kapattı. Kalan ikisi de `cv-c__ilan-1` çiftinde,
ikisi de `skill` türü ve ikisi de yeni mezunun beceri listesindeki tek bir
satıra düşüyor: **`Yapay Zeka Araçları`**.

```
"Yapay Zeka Araçları"  ↔  "Generative AI"                 0,7056
"Yapay Zeka Araçları"  ↔  "Otonom karar mekanizmaları"     0,6687
```

**Neden K-37'nin tür kısıtı bunları elemiyor:** Gereksinim gerçekten bir
beceri gereksinimi ve kanıt gerçekten bir beceri kaydı. Tür uyuşuyor; sorun
kanıtın **belirsizliğinde**. "Yapay Zeka Araçları" bir şemsiye terim ve gömme
uzayında altındaki her şeye yakın duruyor.

**Neden eşik ayarı da çözmüyor:** K-37'nin ölçtüğü üzere uydurmaların
benzerliği meşru eşleşmelerin bandının tam içinde — en düşük uydurma (0,6687)
ile en düşük meşru eşleşme (0,6694) arasında 0,0007 var.

**Aday yönler — hiçbiri ölçülmedi:**

1. **Güven tabanı.** Anlamsal eşleşmenin `confidence` katkısına alt sınır
   koymak. Bu fikir bu turda gündeme geldi ama ölçümü kayda geçmeden oturum
   kesildi; **rakamı yok, benimsenmeden önce ölçülmeli.**
2. **Şemsiye terim tespiti.** Çok sayıda kavrama eşit yakınlıkta duran kanıtı
   ayırt edici saymamak — bir kanıt her şeye yakınsa hiçbir şeyin kanıtı
   değildir.
3. **Kavram özgüllüğü.** İlan kavramı bir ürün/marka adıysa (OpenAI, Azure
   OpenAI, Anthropic Claude) anlamsal eşleşmeyi kapatmak; marka adları
   lafzen ya geçer ya geçmez.

Üçü de `pnpm eval:kapsam`'a varyant olarak eklenip ölçülebilir. Altyapı hazır.

**Uyarı:** Bu iki uydurma tek bir CV'deki tek bir satırdan geliyor. Set
büyümeden (#4, #5) bu kadar dar bir vakaya kural yazmak, o kuralın yalnızca
bu satır için doğru olması riskini taşıyor.

---

## 16 · CSP satır içi betiğe izin veriyor

**Durum:** Açık · **Öncelik:** Düşük

Güvenlik başlıkları `next.config.mjs`'te. CSP dış kaynaktan betiği, çerçeve
içine alınmayı, başka adrese form gönderimini ve `<base>` kaçırmayı
kapatıyor; ama `script-src 'unsafe-inline'` içeriyor, çünkü Next'in hidrasyon
betikleri satır içi. Tam koruma nonce ister: her istek middleware'den geçer ve
statik sayfalar dinamik olur. XSS'e karşı asıl savunma şu an React'in
kaçışlaması; `dangerouslySetInnerHTML` kullanılmıyor.

**Dağıtım notu:** `sitemap.xml`, `robots.txt` ve OG görseli statik üretiliyor
ve kök adresi `BETTER_AUTH_URL`'den derleme anında alıyor. Üretim derlemesi bu
değişken doğru adrese ayarlıyken alınmalı; aksi hâlde sitemap
`localhost:3000`'i gösterir.

## 17 · Prisma sorgu motoru standalone çıktısında yok

**Kaynak:** K-42'nin negatif kontrolü · 29 Eylül 2026

**Ne:** `UYARLA_STANDALONE=1` ile üretilen çıktıda sunucu ayağa kalkıyor ve
tanıtım sayfası 200 dönüyor, ama veritabanına giden her istek düşüyor: Prisma
sorgu motoru ikilisi izlemeye girmemiş.

```
Prisma Client could not locate the Query Engine
  …/apps/web/.next/standalone/apps/web/.prisma/client
```

**Nasıl bulundu:** Font düzeltmesinin negatif kontrolünü standalone sunucu
üzerinden yapmaya çalışırken. Font kontrolü sonunda motora ihtiyaç duymayan
bir yoldan yapıldı, ama bu ayrı sorun ortaya çıktı.

**Neden şimdi değil:** Font sorunuyla aynı aileden (dosya izlemesi ikili
dosyaları görmüyor) ama ayrı bir düzeltme: `outputFileTracingIncludes`'a
motor dosyalarının eklenmesi, ya da Prisma'nın `binaryTargets`
yapılandırması. Tek bir PR'a iki dağıtım sorununu sıkıştırmak ikisini de
doğrulanamaz kılardı.

**Ne zaman gerekli:** Dağıtımdan önce. Vercel `output: "standalone"`
kullanmıyor ve kendi izini kuruyor, yani orada sorun çıkmayabilir — ama
bilinmiyor ve ilk dağıtımda ölçülmeli.