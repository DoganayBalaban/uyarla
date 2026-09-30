"use client"

import Link from "next/link"
import { useEffect } from "react"
import { PageShell } from "@/components/layout/PageShell"

/**
 * Bir sayfa çizilirken beklenmeyen bir hata olursa. Yığın izi kullanıcıya
 * gösterilmiyor; `digest` sunucu günlüğündeki kaydı bulmaya yetiyor.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <PageShell width="narrow" className="sm:pt-20">
      <div role="alert">
        <h1 className="font-heading text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Bir şeyler ters gitti.
        </h1>
        <p className="mt-4 max-w-xl text-muted">
          Sorun bizde, senin yaptığın bir şeyden değil. Tekrar denemek çoğu zaman yetiyor; olmazsa birkaç dakika sonra
          yeniden gel.
        </p>
        {error.digest && <p className="mt-3 text-xs text-muted">Hata kodu: {error.digest}</p>}
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-button bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue/90"
          >
            Tekrar dene
          </button>
          <Link
            href="/"
            className="rounded-button border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-card"
          >
            Ana sayfaya dön
          </Link>
        </div>
      </div>
    </PageShell>
  )
}
