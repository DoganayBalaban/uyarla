"use client"

import { LoaderCircle, X } from "lucide-react"
import { useExcludedConcepts, useRemoveExcludedConcept } from "@/features/account/api"

/**
 * "Tüm ilanlarda hariç tut" listesi (DOG-90). Listeden kaldırmak eski
 * analizleri değiştirmiyor; sonraki analizlerde kavram yeniden skora katılıyor.
 */
export function ExcludedConceptsSection() {
  const list = useExcludedConcepts()
  const remove = useRemoveExcludedConcept()
  const concepts = list.data ?? []

  return (
    <section className="rounded-card border border-border bg-card p-6">
      <h2 className="m-0 text-lg">Hariç tuttuğun kavramlar</h2>
      <p className="m-0 mt-1 text-sm text-muted-foreground">
        Bir gereksinimi &quot;bundan sonraki ilanlarda da hariç tut&quot; diye işaretlediğinde kavramları buraya
        eklenir; sonraki analizlerde o gereksinim skora katılmaz. Kaldırdığın kavram yeni analizlerde yeniden sayılır.
      </p>
      {list.isPending ? (
        <LoaderCircle className="mt-4 size-5 text-muted-foreground motion-safe:animate-spin" aria-hidden />
      ) : concepts.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Listen boş.</p>
      ) : (
        <ul className="mt-4 flex list-none flex-wrap gap-2 p-0">
          {concepts.map((c) => (
            <li
              key={c.key}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background py-1 pr-1 pl-3 text-sm"
            >
              {c.term}
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => remove.mutate(c.key)}
                aria-label={`${c.term} kavramını listeden kaldır`}
                className="grid size-6 place-items-center rounded-full text-muted-foreground transition hover:bg-card hover:text-foreground disabled:opacity-50"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {remove.isError && (
        <p role="alert" className="mt-3 text-sm text-brand-red">
          Kaldıramadık. Birazdan tekrar dener misin?
        </p>
      )}
    </section>
  )
}
