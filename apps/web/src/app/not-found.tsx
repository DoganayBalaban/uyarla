import Link from "next/link"
import { PageShell } from "@/components/layout/PageShell"

export const metadata = { title: "Sayfa bulunamadı · uyarla" }

/** Next'in varsayılan İngilizce 404'ü yerine. */
export default function NotFound() {
  return (
    <PageShell width="narrow" className="sm:pt-20">
      <p className="font-heading text-sm font-bold tracking-wide text-brand-blue">404</p>
      <h1 className="mt-3 font-heading text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
        Aradığın sayfa burada değil.
      </h1>
      <p className="mt-4 max-w-xl text-muted">
        Bağlantı eskimiş ya da adres yanlış yazılmış olabilir. Analizlerin ve başvuruların yerinde duruyor.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/analyze"
          className="rounded-button bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue/90"
        >
          CV'ni analiz et
        </Link>
        <Link
          href="/"
          className="rounded-button border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-card"
        >
          Ana sayfaya dön
        </Link>
      </div>
    </PageShell>
  )
}
