"use client"

import { useEffect } from "react"
import { Logo } from "./components/Logo"

/**
 * Bir sayfa çizilirken beklenmeyen bir hata olursa. Yığın izi kullanıcıya
 * gösterilmiyor; `digest` sunucu günlüğündeki kaydı bulmaya yetiyor.
 */
export default function Hata({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-dvh flex-col bg-zemin">
      <header className="mx-auto w-full max-w-3xl px-6 py-5">
        <Logo />
      </header>
      <main role="alert" className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 pb-24">
        <h1 className="font-baslik text-3xl font-extrabold tracking-tight text-metin sm:text-4xl">
          Bir şeyler ters gitti.
        </h1>
        <p className="mt-4 max-w-xl text-gri">
          Sorun bizde, senin yaptığın bir şeyden değil. Tekrar denemek çoğu zaman yetiyor; olmazsa birkaç dakika sonra
          yeniden gel.
        </p>
        {error.digest && <p className="mt-3 text-xs text-gri">Hata kodu: {error.digest}</p>}
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-buton bg-mavi px-5 py-2.5 text-sm font-semibold text-white hover:bg-mavi/90"
          >
            Tekrar dene
          </button>
          <a
            href="/"
            className="rounded-buton border border-cizgi px-5 py-2.5 text-sm font-semibold text-metin hover:bg-kart"
          >
            Ana sayfaya dön
          </a>
        </div>
      </main>
    </div>
  )
}
