import Link from "next/link"
import { LEGAL } from "@/features/legal/company"
import { CONTAINER, PageShell } from "@/components/layout/PageShell"

/**
 * KVKK aydınlatma metni ve kullanım koşulları için ortak okuma düzeni:
 * dar sütun, rahat satır aralığı, başlıkta son güncelleme tarihi.
 */
export function YasalSayfa({
  baslik,
  ozet,
  children,
}: {
  baslik: string
  ozet: string
  children: React.ReactNode
}) {
  return (
    <>
      <PageShell width="narrow">
        {LEGAL.draftData && (
          <p className="mb-10 rounded-kart border border-kehribar/40 bg-kehribar/10 px-5 py-4 text-sm text-metin">
            <strong className="font-semibold">Taslak.</strong> Bu metin henüz hukuki olarak gözden
            geçirilmedi ve köşeli parantezli bilgiler doldurulmadı.
          </p>
        )}
        <p className="text-sm text-gri">Son güncelleme: {LEGAL.lastUpdated}</p>
        <h1 className="mt-2 font-baslik text-4xl font-extrabold tracking-tight sm:text-5xl">{baslik}</h1>
        <p className="mt-5 text-lg leading-relaxed text-gri">{ozet}</p>

        <div className="mt-12 space-y-10 leading-relaxed text-metin/90 [&_h2]:font-baslik [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:tracking-tight [&_h2]:text-metin [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:font-medium [&_a]:text-mavi">
          {children}
        </div>
      </PageShell>

      <footer className="border-t border-cizgi">
        <div className={`${CONTAINER} flex max-w-[75rem] flex-wrap justify-between gap-3 py-6 text-sm text-gri`}>
          <span>© 2026 uyarla</span>
          <span className="flex gap-5">
            <Link href="/privacy" className="hover:text-metin">KVKK aydınlatma metni</Link>
            <Link href="/terms" className="hover:text-metin">Kullanım koşulları</Link>
          </span>
        </div>
      </footer>
    </>
  )
}
