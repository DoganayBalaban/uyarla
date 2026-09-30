import { YasalSayfa } from "@/features/legal/LegalPage"
import { LEGAL } from "@/features/legal/company"

export const metadata = { title: "KVKK aydınlatma metni · uyarla" }

/**
 * 6698 sayılı KVKK md. 10 kapsamında aydınlatma metni. İçerik uygulamanın
 * bugün gerçekten işlediği verilere göre yazıldı (packages/db şeması,
 * src/server/auth.ts, src/server/mail.ts). Yeni bir veri ya da hizmet sağlayıcı eklenirse
 * bu sayfa da güncellenmeli.
 */
export default function PrivacyPage() {
  return (
    <YasalSayfa
      baslik="KVKK aydınlatma metni"
      ozet="CV'n kişisel veri. Hangisini neden işlediğimizi, kimlerle paylaştığımızı ve nasıl silebileceğini burada sade Türkçeyle anlatıyoruz."
    >
      <section>
        <h2>Kısaca</h2>
        <ul>
          <li>CV'ni ve ilan metnini yalnızca skorunu hesaplamak ve CV'ni uyarlamak için işliyoruz.</li>
          <li>CV'n izinsiz kimseyle paylaşılmaz, satılmaz, reklam için kullanılmaz.</li>
          <li>Başka bir kullanıcı senin analizine ya da uyarlamana erişemez.</li>
          <li>Verilerinin silinmesini istediğin an isteyebilirsin.</li>
        </ul>
      </section>

      <section>
        <h2>1. Veri sorumlusu</h2>
        <p>
          6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) kapsamında veri sorumlusu{" "}
          {LEGAL.dataController}&apos;dır ({LEGAL.address}). Bize {LEGAL.contact} adresinden
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
            <strong>Barındırma ve veritabanı:</strong> uygulamanın ve verilerin tutulduğu sunucu
            sağlayıcıları.
          </li>
          <li>
            <strong>Yapay zekâ modeli:</strong> CV'ni ve ilanı analiz eden, uyarlanmış metni üreten
            dil modeli sağlayıcısı.
          </li>
          <li>
            <strong>E-posta:</strong> giriş bağlantısını gönderen e-posta hizmeti (Resend).
          </li>
          <li>
            <strong>Sosyal giriş:</strong> Google, LinkedIn veya GitHub ile giriş yaparsan ilgili
            sağlayıcı.
          </li>
        </ul>
        <p>
          Bu sağlayıcıların bir kısmının sunucuları yurt dışında olabilir. Yurt dışına aktarım
          KVKK md. 9&apos;daki şartlara uygun olarak yapılır. Kullandığımız sağlayıcıların güncel
          listesini {LEGAL.contact} adresinden isteyebilirsin.
        </p>
      </section>

      <section>
        <h2>5. Nasıl topluyoruz</h2>
        <p>
          Verilerini, CV yüklediğinde, ilan yapıştırdığında, e-postanı girdiğinde ya da sosyal
          girişle bağlandığında elektronik ortamda, otomatik yollarla topluyoruz.
        </p>
      </section>

      <section>
        <h2>6. Ne kadar saklıyoruz</h2>
        <p>
          Verilerini hesabın açık olduğu sürece saklarız. Hesabını ya da verilerini silmemizi
          istersen, yasal saklama yükümlülüğü olan kayıtlar dışında siler ya da anonim hâle
          getiririz.
        </p>
      </section>

      <section>
        <h2>7. Hakların</h2>
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
          Başvurunu {LEGAL.contact} adresine iletebilirsin. En geç 30 gün içinde ücretsiz olarak
          cevaplarız.
        </p>
      </section>

      <section>
        <h2>8. Çerezler</h2>
        <p>
          Yalnızca oturumunu açık tutmak için zorunlu bir oturum çerezi kullanıyoruz. Reklam ya da
          izleme çerezi kullanmıyoruz.
        </p>
      </section>
    </YasalSayfa>
  )
}
