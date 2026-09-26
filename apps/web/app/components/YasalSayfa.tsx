import { YASAL } from "@/lib/yasal"

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
    <div className="min-h-dvh bg-white dark:bg-gece">
      <header className="border-b border-cizgi">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <a href="/" className="inline-flex items-center gap-2.5 font-baslik text-xl font-extrabold tracking-tight text-metin">
            <span aria-hidden="true" className="relative h-6 w-5">
              <span className="absolute inset-0 -translate-x-0.5 -rotate-12 rounded-[5px] bg-mavi/30" />
              <span className="absolute inset-0 rounded-[5px] bg-mavi" />
            </span>
            uyarla
          </a>
          <a href="/" className="text-sm font-medium text-gri hover:text-metin">
            ← Ana sayfa
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-14">
        {YASAL.taslak && (
          <p className="mb-10 rounded-kart border border-kehribar/40 bg-kehribar/10 px-5 py-4 text-sm text-metin">
            <strong className="font-semibold">Taslak.</strong> Bu metin henüz hukuki olarak gözden
            geçirilmedi ve köşeli parantezli bilgiler doldurulmadı.
          </p>
        )}
        <p className="text-sm text-gri">Son güncelleme: {YASAL.sonGuncelleme}</p>
        <h1 className="mt-2 font-baslik text-4xl font-extrabold tracking-tight sm:text-5xl">{baslik}</h1>
        <p className="mt-5 text-lg leading-relaxed text-gri">{ozet}</p>

        <div className="mt-12 space-y-10 leading-relaxed text-metin/90 [&_h2]:font-baslik [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:tracking-tight [&_h2]:text-metin [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:font-medium [&_a]:text-mavi dark:[&_a]:text-[#8ea2ff]">
          {children}
        </div>
      </main>

      <footer className="border-t border-cizgi">
        <div className="mx-auto flex max-w-3xl flex-wrap justify-between gap-3 px-6 py-6 text-sm text-gri">
          <span>© 2026 uyarla</span>
          <span className="flex gap-5">
            <a href="/privacy" className="hover:text-metin">KVKK aydınlatma metni</a>
            <a href="/terms" className="hover:text-metin">Kullanım koşulları</a>
          </span>
        </div>
      </footer>
    </div>
  )
}
