import Link from "next/link"
import { LEGAL } from "@/features/legal/company"
import { CONTAINER, PageShell } from "@/components/layout/PageShell"

/**
 * KVKK aydınlatma metni ve kullanım koşulları için ortak okuma düzeni:
 * dar sütun, rahat satır aralığı, başlıkta son güncelleme tarihi.
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
      <PageShell width="narrow">
        {LEGAL.draftData && (
          <p className="mb-10 rounded-card border border-brand-amber/40 bg-brand-amber/10 px-5 py-4 text-sm text-foreground">
            <strong className="font-semibold">Taslak.</strong> Bu metin henüz hukuki olarak gözden
            geçirilmedi ve köşeli parantezli bilgiler doldurulmadı.
          </p>
        )}
        <p className="text-sm text-muted">Son güncelleme: {LEGAL.lastUpdated}</p>
        <h1 className="mt-2 font-heading text-4xl font-extrabold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-5 text-lg leading-relaxed text-muted">{summary}</p>

        <div className="mt-12 space-y-10 leading-relaxed text-foreground/90 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:tracking-tight [&_h2]:text-foreground [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:font-medium [&_a]:text-brand-blue">
          {children}
        </div>
      </PageShell>

      <footer className="border-t border-border">
        <div className={`${CONTAINER} flex max-w-[75rem] flex-wrap justify-between gap-3 py-6 text-sm text-muted`}>
          <span>© 2026 uyarla</span>
          <span className="flex gap-5">
            <Link href="/privacy" className="hover:text-foreground">KVKK aydınlatma metni</Link>
            <Link href="/terms" className="hover:text-foreground">Kullanım koşulları</Link>
          </span>
        </div>
      </footer>
    </>
  )
}
