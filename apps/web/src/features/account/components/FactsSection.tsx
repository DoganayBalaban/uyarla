"use client"

import { BookOpenCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
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
    <Card className="gap-4 shadow-xs">
      <CardHeader>
        <CardTitle className="text-base">Anlattığın deneyimler</CardTitle>
        <CardDescription>
          Uyarlamada eksik bir gereksinim için anlatıp kabul ettiğin maddeler. Sonraki analizlerde, CV&apos;nde aynı iş
          varsa onun altında kanıt sayılır ve uyarladığın CV&apos;ye eklenir. Unuttuğun madde yeni analizlerde
          kullanılmaz.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {list.isPending ? (
          <Skeleton className="h-16 rounded-lg" />
        ) : facts.length === 0 ? (
          <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground">
            <BookOpenCheck className="size-4" aria-hidden />
            Henüz yok. Uyarlamada &quot;Bu konuda deneyimim var&quot; dediğin şeyler burada birikir.
          </p>
        ) : (
          <ul className="m-0 list-none divide-y p-0">
            {facts.map((fact) => (
              <li key={fact.id} className="flex items-start gap-3 py-3 text-sm first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="m-0">{fact.text}</p>
                  <p className="m-0 mt-1 text-xs text-muted-foreground">
                    {fact.title} · {fact.company}
                    {fact.requirement && <> · &quot;{fact.requirement}&quot; için</>}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={forget.isPending}
                  onClick={() => forget.mutate(fact.id)}
                  className="shrink-0 text-muted-foreground"
                >
                  Unut
                </Button>
              </li>
            ))}
          </ul>
        )}
        {forget.isError && (
          <p role="alert" className="m-0 mt-3 text-sm text-destructive">
            Unutamadık. Birazdan tekrar dener misin?
          </p>
        )}
      </CardContent>
    </Card>
  )
}
