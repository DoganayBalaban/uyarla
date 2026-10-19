import { YasalSayfa as LegalPage } from "@/features/legal/LegalPage"
import { LEGAL } from "@/features/legal/company"

export const metadata = { title: "KVKK aydınlatma metni · uyarla" }

/**
 * 6698 sayılı KVKK md. 10 kapsamında aydınlatma metni. İçerik uygulamanın
 * bugün gerçekten işlediği verilere göre yazıldı (packages/db şeması,
 * src/server/auth.ts, src/server/mail.ts). Sağlayıcı listesi üretim topolojisinden
 * (K-02, Prod 1-6): web Vercel, worker ve Redis Railway, veritabanı Neon, dosya
 * Cloudflare R2, LLM ve gömme OpenAI, giden e-posta Resend, gelen e-posta Cloudflare Email
 * Routing → Gmail, hata izleme Sentry (DOG-62), ödeme Polar (DOG-34). Yeni bir veri ya da hizmet
 * sağlayıcı eklenirse bu sayfa da güncellenmeli.
 */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="KVKK aydınlatma metni"
      summary="CV'n kişisel veri. Hangisini neden işlediğimizi, kimlerle paylaştığımızı ve nasıl silebileceğini burada sade Türkçeyle anlatıyoruz."
    >
      <section>
        <h2>Kısaca</h2>
        <ul>
          <li>CV'ni ve ilan metnini yalnızca skorunu hesaplamak ve CV'ni uyarlamak için işliyoruz.</li>
          <li>
            Analiz ve uyarlama için CV'n ve ilan, OpenAI'ın dil modeline (ABD) gönderilir. OpenAI bu
            veriyi model eğitiminde kullanmaz.
          </li>
          <li>
            CV'n satılmaz, reklam için kullanılmaz; yalnızca hizmeti çalıştıran ve aşağıda adıyla
            yazdığımız sağlayıcılarla paylaşılır.
          </li>
          <li>Başka bir kullanıcı senin analizine ya da uyarlamana erişemez.</li>
          <li>Verilerinin silinmesini istediğin an isteyebilirsin.</li>
        </ul>
      </section>

      <section>
        <h2>1. Veri sorumlusu</h2>
        <p>
          6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) kapsamında veri sorumlusu{" "}
          {LEGAL.dataController}&apos;dır. Bize {LEGAL.contact} adresinden
          ulaşabilirsin.
        </p>
      </section>

      <section>
        <h2>2. Hangi verileri işliyoruz</h2>
        <ul>
          <li>
            <strong>Kimlik ve iletişim:</strong> e-posta adresin; sosyal girişle geldiysen
            sağlayıcının paylaştığı ad ve profil bilgisi.
          </li>
          <li>
            <strong>CV içeriği:</strong> yüklediğin dosya ve içindeki bilgiler (deneyim, eğitim,
            beceriler, iletişim bilgileri ve CV'nde yer alan diğer her şey).
          </li>
          <li>
            <strong>İlan metni:</strong> karşılaştırma için yapıştırdığın iş ilanı.
          </li>
          <li>
            <strong>Sonuçlar:</strong> ATS uyum skoru, eksik anahtar kelimeler, uyarlanmış CV, ön
            yazı ve maddelere verdiğin kararlar.
          </li>
          <li>
            <strong>Anlattığın deneyimler:</strong> uyarlamada eksik bir gereksinim için kendi
            sözlerinle yazdığın metin ve ondan yazılan madde. Maddeyi kabul ettiysen sonraki
            analizlerinde, CV&apos;nde aynı iş varsa kanıt olarak kullanılır; Hesabım&apos;dan görebilir ve
            unutabilirsin.
          </li>
          <li>
            <strong>Oturum ve güvenlik:</strong> oturum çerezi, IP adresi ve tarayıcı bilgisi
            (kötüye kullanımı ve aşırı istekleri engellemek için).
          </li>
        </ul>
        <p>
          Kayıt olmadan skor aldığında da CV'n ve ilan işlenir; bu durumda anonim bir oturuma
          bağlanır. Sonradan kayıt olursan bu veriler hesabına taşınır.
        </p>
      </section>

      <section>
        <h2>3. Neden işliyoruz ve hukuki sebep</h2>
        <ul>
          <li>
            CV'ni ilanla karşılaştırmak, skor üretmek ve uyarlamak — hizmetin kendisi; sözleşmenin
            kurulması ve ifası (KVKK md. 5/2-c).
          </li>
          <li>Giriş bağlantısı göndermek ve hesabını yönetmek — sözleşmenin ifası (md. 5/2-c).</li>
          <li>
            Güvenliği sağlamak, kötüye kullanımı ve aşırı istekleri engellemek — meşru menfaat
            (md. 5/2-f).
          </li>
          <li>Yasal yükümlülüklerimizi yerine getirmek — md. 5/2-ç.</li>
        </ul>
        <p>
          CV'nde sağlık, din ya da benzeri özel nitelikli kişisel veri olmamasını öneririz. Böyle
          bir veri paylaşırsan yalnızca hizmeti sağlamak için ve açık rızana dayanarak işlenir.
        </p>
      </section>

      <section>
        <h2>4. Kimlerle paylaşıyoruz</h2>
        <p>
          Verilerini satmayız. Hizmeti çalıştırmak için aşağıdaki hizmet sağlayıcılarla, yalnızca
          gerektiği kadar paylaşırız:
        </p>
        <ul>
          <li>
            <strong>OpenAI (ABD), yapay zekâ modeli:</strong> CV'nin ve ilanın metni analiz, skor,
            uyarlama ve ön yazı için OpenAI API'sine gönderilir. OpenAI, API üzerinden gelen veriyi
            model eğitiminde kullanmaz. Kötüye kullanımı denetlemek için en fazla 30 gün saklayabilir,
            sonra siler.
          </li>
          <li>
            <strong>Vercel (ABD), web uygulaması:</strong> siteyi ve sunucu tarafındaki istekleri
            çalıştırır. Ayrıca çerez kullanmadan sayfa görüntülemelerini sayar (Web Analytics): hangi
            sayfanın açıldığı, yönlendiren site, ülke, cihaz ve tarayıcı türü. Sorgu parametreleri ve
            kişisel veri gönderilmez; ziyaretçi günlük olarak değişen, geri çevrilemeyen bir özetle
            sayılır.
          </li>
          <li>
            <strong>Railway (AB, Hollanda), arka plan işleri:</strong> analiz ve uyarlama işlerini
            yürüten sunucu ve iş kuyruğu.
          </li>
          <li>
            <strong>Neon (AB, Almanya), veritabanı:</strong> hesabın, CV metnin, ilan, analiz ve
            uyarlama sonuçların burada tutulur.
          </li>
          <li>
            <strong>Cloudflare R2, dosya deposu:</strong> yüklediğin CV dosyasının kendisi burada
            tutulur.
          </li>
          <li>
            <strong>Resend (ABD), e-posta gönderimi:</strong> giriş bağlantısını
            noreply@uyarla.com.tr adresinden gönderir; yalnızca e-posta adresini görür. Bu adrese
            gelen yanıtlar okunmaz.
          </li>
          <li>
            <strong>Cloudflare Email Routing ve Google (ABD), gelen e-posta:</strong>{" "}
            {LEGAL.support} ve {LEGAL.contact} adreslerine yazdığın e-postalar Cloudflare üzerinden
            Google&apos;ın e-posta hizmetindeki (Gmail) hesabımıza iletilir ve orada saklanır.
          </li>
          <li>
            <strong>Sentry, hata izleme:</strong> uygulamada bir hata olduğunda teknik hata kaydını
            (hangi sayfada, hangi kod satırında) alır. CV metni, e-posta adresi, IP adresi ve çerezler bu
            kayda eklenmez.
          </li>
          <li>
            <strong>Polar (ABD), ödeme:</strong> paket satın alırken ödemeyi alır ve faturanı gönderir. Kart
            bilgin uyarla&apos;ya hiç gelmez; Polar&apos;a yalnızca e-posta adresin ve hesap kimliğin iletilir.
          </li>
          <li>
            <strong>Tarayıcı eklentisi:</strong> yalnızca sen tıkladığında açık sayfadaki ilan metnini
            uyarla&apos;ya aktarır; başka bir veri toplamaz, kendi başına hiçbir sunucuya bağlanmaz.
          </li>
          <li>
            <strong>Sosyal giriş:</strong> Google, LinkedIn veya GitHub ile giriş yaparsan ilgili
            sağlayıcı.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Yurt dışına aktarım</h2>
        <p>
          Yukarıdaki sağlayıcıların bir kısmı (OpenAI, Vercel, Resend, Cloudflare, Google, Polar) yurt dışında,
          ağırlıklı olarak ABD&apos;de bulunuyor. En önemlisi: skorunu hesaplamak için CV&apos;nin ve
          ilanın metni OpenAI&apos;ın ABD&apos;deki sunucularına gönderilir. Bu aktarım olmadan hizmeti
          sunamıyoruz.
        </p>
        <p>
          Yurt dışına aktarım KVKK md. 9&apos;da öngörülen uygun güvencelere, sağlayıcılarla yapılan
          veri işleme sözleşmelerine dayanılarak yapılır. Sağlayıcılar veriyi yalnızca bizim
          adımıza, hizmeti sunmak için işler. Aktarım hakkında soruların için {LEGAL.contact}.
        </p>
      </section>

      <section>
        <h2>6. Nasıl topluyoruz</h2>
        <p>
          Verilerini, CV yüklediğinde, ilan yapıştırdığında, e-postanı girdiğinde ya da sosyal
          girişle bağlandığında elektronik ortamda, otomatik yollarla topluyoruz.
        </p>
      </section>

      <section>
        <h2>7. Ne kadar saklıyoruz</h2>
        <ul>
          <li>
            Verilerini hesabın açık olduğu sürece saklarız. Hesabını sildiğinde CV dosyan depodan,
            CV metnin, analizlerin ve uyarlamaların veritabanından silinir.
          </li>
          <li>
            OpenAI&apos;a gönderilen metinler OpenAI tarafında en fazla 30 gün tutulur ve sonra
            silinir; bu süreyi biz kısaltamıyoruz.
          </li>
          <li>
            Yasal saklama yükümlülüğü olan kayıtlar, o yükümlülük süresince saklanır ve sonra
            silinir ya da anonim hâle getirilir.
          </li>
        </ul>
      </section>

      <section>
        <h2>8. Hakların</h2>
        <p>KVKK md. 11 uyarınca şunları isteyebilirsin:</p>
        <ul>
          <li>Kişisel verinin işlenip işlenmediğini öğrenmek, işlendiyse bilgi istemek,</li>
          <li>İşlenme amacını ve amaca uygun kullanılıp kullanılmadığını öğrenmek,</li>
          <li>Yurt içinde ya da yurt dışında aktarıldığı üçüncü kişileri bilmek,</li>
          <li>Eksik ya da yanlış işlendiyse düzeltilmesini istemek,</li>
          <li>Silinmesini ya da yok edilmesini istemek,</li>
          <li>Düzeltme ve silme işlemlerinin aktarılan üçüncü kişilere bildirilmesini istemek,</li>
          <li>
            Yalnızca otomatik sistemlerle analiz edilmesi sonucu aleyhine bir sonuç çıkmasına itiraz
            etmek,
          </li>
          <li>Kanuna aykırı işleme nedeniyle zarara uğradıysan zararın giderilmesini istemek.</li>
        </ul>
        <p>
          Bunların ikisini beklemeden kendin yapabilirsin: Hesabım sayfasındaki &quot;Verilerimi
          indir&quot; ile bütün verini (CV dosyaların, analizlerin, uyarlamaların) tek bir dosya olarak
          alırsın; &quot;Hesabımı ve verilerimi sil&quot; ile hepsini silersin.
        </p>
        <p>
          Diğer başvurularını {LEGAL.contact} adresine iletebilirsin. En geç 30 gün içinde ücretsiz
          olarak cevaplarız.
        </p>
      </section>

      <section>
        <h2>9. Çerezler</h2>
        <p>
          Yalnızca oturumunu açık tutmak için zorunlu bir oturum çerezi kullanıyoruz. Reklam ya da
          izleme çerezi kullanmıyoruz; sayfa görüntüleme sayımı (Vercel Web Analytics) çerezsiz
          çalışıyor.
        </p>
      </section>
    </LegalPage>
  )
}
