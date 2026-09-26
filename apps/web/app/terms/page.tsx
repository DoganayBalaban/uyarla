import { YasalSayfa } from "../components/YasalSayfa"
import { YASAL } from "@/lib/yasal"

export const metadata = { title: "Kullanım koşulları · uyarla" }

/**
 * Kullanım koşulları. Marka rehberi §11'deki ilkeler (garanti yok,
 * uydurmama, yapay zekâ şeffaflığı) burada da bağlayıcı olarak yazıyor.
 */
export default function TermsPage() {
  return (
    <YasalSayfa
      baslik="Kullanım koşulları"
      ozet="Uyarla'yı kullanırken neye söz verdiğimizi, neye söz vermediğimizi ve senden ne beklediğimizi anlatıyoruz."
    >
      <section>
        <h2>1. Hizmet</h2>
        <p>
          Uyarla ({YASAL.veriSorumlusu}), CV'ni bir iş ilanıyla karşılaştırıp ATS uyum skoru
          üreten ve CV'ni ilana göre yeniden düzenlemene yardım eden bir web uygulamasıdır. Bu
          koşulları kabul ederek hizmeti kullanabilirsin.
        </p>
      </section>

      <section>
        <h2>2. Hesap</h2>
        <ul>
          <li>Skor almak için hesap gerekmez; uyarlama için e-postanla ya da sosyal girişle giriş yaparsın.</li>
          <li>Hesabının güvenliğinden ve giriş bağlantılarının başkasının eline geçmemesinden sen sorumlusun.</li>
          <li>Hizmeti kullanmak için en az 16 yaşında olmalısın.</li>
        </ul>
      </section>

      <section>
        <h2>3. Neye söz veriyoruz, neye vermiyoruz</h2>
        <ul>
          <li>
            <strong>İşe alınmayı garanti etmiyoruz.</strong> Skor ve uyarlama, başvurunu güçlendirmek
            için bir yardımdır; mülakat daveti ya da iş teklifi vaadi değildir.
          </li>
          <li>
            <strong>Skorun yükseleceğini garanti etmiyoruz.</strong> Skor, CV'nde gerçekten olan
            deneyimi ölçer. Olmayan bir yetkinliği dürüst bir metin ekleyemez.
          </li>
          <li>
            <strong>Deneyim uydurmayız.</strong> Uyarlama, olmayan deneyim, beceri ya da sertifika
            eklemez. Riskli görünen değişiklikleri işaretler ve kararı sana bırakır.
          </li>
          <li>
            <strong>Metinler yapay zekâyla üretilir.</strong> Hata yapabilir. Uyarlanmış CV'ni
            kullanmadan önce her değişikliği okuyup onaylaman gerekir.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Senin sorumlulukların</h2>
        <ul>
          <li>Yüklediğin CV'deki bilgilerin doğru ve sana ait olması,</li>
          <li>Başkasına ait bir CV'yi o kişinin izni olmadan yüklememek,</li>
          <li>Uyarlanmış CV'yi başvuruda kullanmadan önce doğruluğunu kontrol etmek,</li>
          <li>Hizmeti otomatik araçlarla aşırı yüklememek, güvenliğini aşmaya çalışmamak.</li>
        </ul>
      </section>

      <section>
        <h2>5. İçeriğin sahibi</h2>
        <p>
          Yüklediğin CV ve uyarlanmış hâli senindir. Bunları yalnızca sana hizmeti sunmak için
          işleriz; ayrıntılar{" "}
          <a href="/privacy">KVKK aydınlatma metninde</a>.
        </p>
      </section>

      <section>
        <h2>6. Ücretler</h2>
        <p>
          Skor ücretsizdir. Ücretli bir plan sunulduğunda fiyatı, kapsamı ve iptal koşulları satın
          almadan önce açıkça gösterilir.
        </p>
      </section>

      <section>
        <h2>7. Sorumluluğun sınırı</h2>
        <p>
          Hizmet &quot;olduğu gibi&quot; sunulur. Yürürlükteki mevzuatın izin verdiği ölçüde, uyarlanmış
          CV'nin kullanımından ya da başvuru sonuçlarından doğan dolaylı zararlardan sorumlu
          değiliz.
        </p>
      </section>

      <section>
        <h2>8. Değişiklikler ve fesih</h2>
        <p>
          Bu koşulları güncelleyebiliriz; önemli değişiklikleri sana bildiririz. Hesabını
          istediğin an kapatabilirsin. Koşulları ihlal eden hesapları askıya alabiliriz.
        </p>
      </section>

      <section>
        <h2>9. Uygulanacak hukuk ve iletişim</h2>
        <p>
          Bu koşullara Türkiye Cumhuriyeti hukuku uygulanır. Sorun ve soruların için{" "}
          {YASAL.iletisim}.
        </p>
      </section>
    </YasalSayfa>
  )
}
