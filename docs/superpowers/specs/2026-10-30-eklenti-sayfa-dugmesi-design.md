# Eklenti 0.4.0: ilan sayfasında uyarla düğmesi ve simge menüsü

**Tarih:** 30 Ekim 2026 · **Linear:** DOG-169 · **Durum:** Uygulanıyor. Kullanıcı "sen planla yap, sonra inceleyip düzeltiriz" dedi; aşağıdaki "benim kararım" işaretli maddeler onun incelemesine açık.

## Neden

Eklenti 0.3.0 aktarmayı zaten yapıyor. Simgeye basınca açık sekmedeki ilan okunuyor ve uyarla ilan alanı dolu açılıyor; kendi LinkedIn profilinde de profil gönderiliyor. Ancak kullanıcı bunu bilmiyor:
- simgeye basması gerektiği görünmüyor;
- basınca bir menü çıkmıyor, doğrudan bir şey oluyor.

Kullanıcının istediği:
- **İlan sayfasında düğme:** ilan açıkken, ilanın kendi düğmelerinin yanında bir uyarla düğmesi (taslaklarda A seçildi). Basınca bugün simgenin yaptığı olur.
- **Profilde düğme:** kendi LinkedIn profilinde aynısı.
- **Simge menüsü:** simgeye basınca neyin ne yaptığı anlaşılır olsun.

Siteler: LinkedIn, Kariyer.net ve benzerleri.

## Hedefler

1. **Sayfa düğmesi (içerik betiği).** Desteklenen sitelerde ilan sayfası açılınca düğme ilanın başvuru düğmesinin yanında çıkar: "CV'mi bu ilana uyarla".
   - Basınca ilan metni sayfadan okunur ve bugünkü jetonlu yolla uyarla açılır. Kayıtlı ve Temel CV'si olan kullanıcıda analiz kendiliğinden başlar.
2. **Profil düğmesi.** Kişinin kendi LinkedIn profilinde "Profilimi uyarla ile denetle" düğmesi çıkar.
   - Bugünkü profil gönderimi kullanılır; başkasının profilinde düğme çıkmaz.
3. **Simge menüsü (popup).** Simgeye basınca açılan küçük pencere:
   - **Sayfaya göre ana eylem:**
     - ilan algılandıysa ilanın başlığı ve şirketiyle "Bu ilanı ölç";
     - kendi profilindeyse "Profilimi denetle";
     - hiçbiri değilse kısa yol tarifi.
   - **uyarla'daki sayfalara kısayollar:** Yeni analiz, Başvurularım, CV'lerim, LinkedIn denetimi.
   - **Ayar:** "İlan sayfalarında düğme göster" açma/kapama.

## Hedef dışı

- **Sunucuya istek:** Eklenti hiçbir sunucuya istek atmıyor. Skor eklentide, sayfanın içinde gösterilmiyor; uyarla sekmesinde görülüyor.
- **Otomatik gönderim:** Kullanıcı basmadan hiçbir şey gönderilmiyor. Düğme yalnızca görünür, sayfa okunmaz.
- **Arama listesi:** Liste ekranındaki her ilana ayrı düğme konmuyor; yalnızca açık ilan.

## Kısıtlar

- **İzinler:** Sayfa düğmesi için eklentinin bu siteleri kendiliğinden okuması gerekiyor (`content_scripts.matches`). Kurulumda Chrome "verilerinizi okuyabilir" uyarısı gösterir. README'deki "kalıcı erişim yok" sözü ve mağaza gerekçeleri buna göre güncellenir.
  - Liste kısa tutuluyor: yalnızca iş siteleri.
  - Diğer sitelerde bugünkü yol kalıyor: simge ve sağ tık; izni `activeTab`.
- **Gizlilik:** İlan ve profil metni yalnızca kullanıcının açtığı uyarla sekmesine, adresin `#` kısmında gidiyor; bugünkü gibi.
- **Mesaj güvenliği:** İçerik betiğinden gelen mesajlar yalnızca eklentinin kendi betiklerinden kabul edilir.
  - Arka plan `sender.id` ve `sender.tab`'ı denetler.
  - Metni yeniden doğrular: ilan için en az 50 karakter; profil için şema.

## Kararlar

### Kullanıcının verdiği

- Düğme yerleşimi A: ilanın kendi düğmelerinin yanında.
- Siteler: LinkedIn, Kariyer.net ve benzerleri.

### Benim kararım (incelemeye açık)

**Site listesi.** Hepsi `https://` ve alt alan adlarıyla:
- linkedin.com
- kariyer.net
- yenibiris.com
- secretcv.com
- eleman.net
- tr.indeed.com
- greenhouse.io, lever.co ve myworkdayjobs.com (yabancı ilan sistemleri)

**İlan algılama URL'ye değil içeriğe bakıyor.** Sayfada bir ilan olduğunu çekirdekteki çıkarıcı söylüyor (`extractPostingText`): JSON-LD JobPosting ya da site kuralı. Metin en az 50 karakter olmalı.
- İş sitelerinin adres kalıpları değişiyor, JSON-LD ise Google for Jobs için hep var.
- Algılama ucuz tutuluyor: sayfa değişince 800 ms bekleyip bir kez.
- LinkedIn tek sayfa uygulaması; adres değişimi izleniyor.

**Yerleşim ve yedek.**
- Düğme, görünen başvuru düğmesinin hemen arkasına konuyor. Başvuru düğmesi metniyle aranıyor: "Kolay Başvuru", "Easy Apply", "Başvur", "Hemen Başvur", "Apply" ve benzerleri.
- Başvuru düğmesi bulunamazsa (site tasarımı değişti, düğme yok) düğme sağ altta yüzen rozet olarak çıkıyor. Böylece hiçbir sitede kaybolmuyor.

**Görünüm.**
- Düğme Shadow DOM içinde; site CSS'i bozmuyor, düğme de siteyi bozmuyor.
- uyarla mor/indigo rengi ve küçük "u" işareti.

**Profil.**
- Profil düğmesi yalnızca kendi profilde çıkıyor; kendi profil olduğunu bugünkü okuyucu söylüyor (`snapshot.own`).
- Yeri profil düğmeleri dizisi ("Profili düzenle", "Daha fazla"); yoksa yüzen rozet.

**Simge menüsü.**
- Menü açılınca simge `activeTab` izni veriyor. Menü açık sekmeyi o anda okuyup duruma karar veriyor.
- Simgenin "basınca doğrudan gönder" davranışı menüye taşınıyor: tek tık yerine iki tık, ama ne olacağı görünür.

**Ayar.** "İlan sayfalarında düğme göster" `chrome.storage.local`'da, varsayılan açık.

**Sürüm.** 0.4.0. DOG-159 (mağazaya yükleme) bu sürümle yapılmalı.

## Kurucunun sonradan bakacağı yerler

- Gerçek LinkedIn, Kariyer.net ve Indeed sayfalarında düğmenin yeri ve görünümü. Yerel taslak testleri jsdom fikstürleriyle; gerçek sayfa yapısı değişebilir.
- Menü metinleri ve kısayolların sırası.
- Site listesi: eklemek ya da çıkarmak.

## Uygulama sırası

1. **Saf mantık ve testleri:**
   - ilan sayfası mı;
   - yerleşim çapası;
   - menünün durumu;
   - arka plan mesaj doğrulaması.
2. **İçerik betiği:** düğme, Shadow DOM, adres izleme, ayar.
3. **Arka plan:** içerik betiği mesajları; simge menüye geçince `onClicked` kalkıyor.
4. **Menü:** HTML, CSS ve betik.
5. **Derleme ve paket:**
   - build.mjs'e yeni giriş noktaları ve zip içeriği;
   - manifest 0.4.0;
   - README izin gerekçeleri.
6. **Yerelde Chrome'da paketlenmemiş eklentiyle deneme:** LinkedIn ve Kariyer.net.
