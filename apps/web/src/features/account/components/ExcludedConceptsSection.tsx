"use client"

import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
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
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle className="text-base">Hariç tuttuğun kavramlar</CardTitle>
        <CardDescription>
          Bir gereksinimi &quot;bundan sonraki ilanlarda da hariç tut&quot; diye işaretlediğinde kavramları buraya eklenir;
          sonraki analizlerde o gereksinim skora katılmaz. Kaldırdığın kavram yeni analizlerde yeniden sayılır.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {list.isPending ? (
          <Skeleton className="h-8 w-48 rounded-full" />
        ) : concepts.length === 0 ? (
          <p className="m-0 text-sm text-muted-foreground">Listen boş.</p>
        ) : (
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {concepts.map((c) => (
              <li key={c.key}>
                <Badge variant="outline" className="gap-1 py-0.5 pr-0.5 pl-2.5 text-sm font-normal">
                  {c.term}
                  <button
                    type="button"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(c.key)}
                    aria-label={`${c.term} kavramını listeden kaldır`}
                    className="grid size-5 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </Badge>
              </li>
            ))}
          </ul>
        )}
        {remove.isError && (
          <p role="alert" className="m-0 mt-3 text-sm text-destructive">
            Kaldıramadık. Birazdan tekrar dener misin?
          </p>
        )}
      </CardContent>
    </Card>
  )
}
