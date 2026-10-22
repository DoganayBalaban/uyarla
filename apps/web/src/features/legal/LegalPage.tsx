import Link from "next/link"
import { LEGAL } from "@/features/legal/company"
import { CONTAINER } from "@/components/layout/PageShell"
import { LegalToc } from "@/features/legal/LegalToc"

/**
 * KVKK aydınlatma metni ve kullanım koşulları için ortak okuma düzeni:
 * dar sütun, rahat satır aralığı, başlıkta son güncelleme tarihi; geniş
 * ekranda sağda "Bu sayfada" (DOG-156).
 */
export function YasalSayfa({
  title: title,
  summary: summary,
  children,
}: {
  title: string
  summary: string
  children: React.ReactNode
}) {
  return (
    <>
      <main className={`${CONTAINER} max-w-[75rem] pt-10 pb-20 sm:pt-12`}>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,44rem)_14rem] lg:justify-between">
          <article>
            <p className="m-0 text-sm text-muted-foreground">Son güncelleme: {LEGAL.lastUpdated}</p>
            <h1 className="m-0 mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
            <p className="m-0 mt-4 text-lg leading-relaxed text-muted-foreground">{summary}</p>

            <div
              id="yasal-metin"
              className="mt-10 space-y-10 leading-relaxed text-foreground/90 [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5"
            >
              {children}
            </div>
          </article>
          <aside>
            <LegalToc containerId="yasal-metin" />
          </aside>
        </div>
      </main>

      <footer className="border-t">
        <div className={`${CONTAINER} flex max-w-[75rem] flex-wrap justify-between gap-3 py-6 text-sm text-muted-foreground`}>
          <span>© 2026 uyarla</span>
          <span className="flex flex-wrap gap-5">
            <Link href="/privacy" className="hover:text-foreground">KVKK aydınlatma metni</Link>
            <Link href="/terms" className="hover:text-foreground">Kullanım koşulları</Link>
            <Link href="/refund" className="hover:text-foreground">İade ve cayma</Link>
          </span>
        </div>
      </footer>
    </>
  )
}
