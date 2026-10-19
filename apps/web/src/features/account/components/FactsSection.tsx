"use client"

import { LoaderCircle } from "lucide-react"
import { useFacts, useForgetFact } from "@/features/account/api"

/**
 * Anlattığın deneyimler (DOG-116). Uyarlamada "AI ile yaz"la eklediğin ve
 * kabul ettiğin maddeler sonraki analizlerde anlatıldığı işin altında kanıt
 * sayılıyor. Unutmak eski analizleri ve o uyarlamanın belgesini değiştirmiyor.
 */
export function FactsSection() {
  const list = useFacts()
  const forget = useForgetFact()
  const facts = list.data ?? []

  return (
    <section className="rounded-card border border-border bg-card p-6">
      <h2 className="m-0 text-lg">Anlattığın deneyimler</h2>
      <p className="m-0 mt-1 text-sm text-muted">
        Uyarlamada eksik bir gereksinim için anlatıp kabul ettiğin maddeler. Sonraki analizlerde, CV&apos;nde aynı iş
        varsa onun altında kanıt sayılır ve uyarladığın CV&apos;ye eklenir. Unuttuğun madde yeni analizlerde
        kullanılmaz.
      </p>
      {list.isPending ? (
        <LoaderCircle className="mt-4 size-5 text-muted motion-safe:animate-spin" aria-hidden />
      ) : facts.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Henüz yok.</p>
      ) : (
        <ul className="mt-4 list-none space-y-3 p-0">
          {facts.map((fact) => (
            <li key={fact.id} className="rounded-button border border-border bg-background p-3 text-sm">
              <p className="m-0">{fact.text}</p>
              <p className="m-0 mt-1 text-muted">
                {fact.title} · {fact.company}
                {fact.requirement && <> · &quot;{fact.requirement}&quot; için</>}
              </p>
              <button
                type="button"
                disabled={forget.isPending}
                onClick={() => forget.mutate(fact.id)}
                className="mt-2 text-sm font-medium text-muted underline-offset-2 transition hover:text-foreground hover:underline disabled:opacity-50"
              >
                Unut
              </button>
            </li>
          ))}
        </ul>
      )}
      {forget.isError && (
        <p role="alert" className="mt-3 text-sm text-brand-red">
          Unutamadık. Birazdan tekrar dener misin?
        </p>
      )}
    </section>
  )
}
