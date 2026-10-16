import Link from "next/link"
import { YasalSayfa as LegalPage } from "@/features/legal/LegalPage"
import { LEGAL } from "@/features/legal/company"

export const metadata = { title: "İade ve cayma · uyarla" }

/**
 * İade ve cayma koşulları (DOG-34). Polar hesap onayı bu sayfayı istiyor.
 * Taslak: yayından önce bir hukukçu ya da mali müşavir gözden geçirmeli.
 */
export default function RefundPage() {
  return (
    <LegalPage
      title="İade ve cayma"
      summary="Paket satın aldığında neyi aldığını, cayma hakkının nasıl işlediğini ve iade isteyebileceğin durumları anlatıyoruz."
    >
      <section>
        <h2>1. Ne satın alıyorsun</h2>
        <p>
          1 hafta, 1 ay ya da 3 aylık bir erişim dönemi. Dönem boyunca istediğin kadar CV uyarlayabilir ve ön
          yazı oluşturabilirsin. Ödeme tek seferliktir; otomatik yenileme yoktur, dönem bitince ücret alınmaz.
        </p>
      </section>

      <section>
        <h2>2. Cayma hakkı</h2>
        <p>
          Ödeme öncesinde, erişimin hemen başlamasını ve bu nedenle cayma hakkını kaybedeceğini açıkça kabul
          edersin. Dijital içerikte, tüketicinin onayıyla ifaya başlandıktan sonra cayma hakkı kullanılamaz
          (Mesafeli Sözleşmeler Yönetmeliği md. 15).
        </p>
      </section>

      <section>
        <h2>3. Yine de iade</h2>
        <p>
          Teknik bir sorun nedeniyle hizmeti kullanamadıysan, satın alma tarihinden itibaren 14 gün içinde{" "}
          {LEGAL.support} adresine yaz. Durumu değerlendirip ödemeni Polar üzerinden iade ederiz. İade
          edilen dönemin erişimi hemen kapanır.
        </p>
      </section>

      <section>
        <h2>4. Ödeme ve fatura</h2>
        <p>
          Ödemeyi satıcı (merchant of record) olarak Polar alır; faturan e-posta adresine gönderilir. Kart
          bilgin uyarla&apos;ya hiç gelmez. Ayrıntılar için <Link href="/terms">kullanım koşulları</Link> ve{" "}
          <Link href="/privacy">gizlilik</Link> sayfalarına bakabilirsin.
        </p>
      </section>
    </LegalPage>
  )
}
