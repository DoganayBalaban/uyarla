"use client"

import { motion, useReducedMotion } from "motion/react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/cn"
import type { ScorePart } from "@/features/analysis/scoreParts"

const KIND_LABEL: Record<ScorePart["kind"], string> = {
  must: "Zorunlu",
  nice: "Tercih sebebi",
  generic: "Genel şart",
  title: "Unvan",
}

/**
 * Skor şeridi: skor, parçalarının toplamı. Her parça formüldeki ağırlığı
 * kadar geniş, karşılanma oranı kadar dolu; boş kalan yer, o gereksinim
 * karşılanırsa skora eklenecek puan. Sayfadaki tek kendiliğinden hareket
 * burada: açılışta parçalar soldan sağa bir kez doluyor.
 */
export function ScoreStrip({
  parts,
  hint,
  onSelect,
}: {
  parts: ScorePart[]
  /** Ağırlıkların açıklaması; formülden türüyor (scoreImpacts). */
  hint: string
  onSelect?: (part: ScorePart) => void
}) {
  const reducedMotion = useReducedMotion() ?? false
  if (parts.length === 0) return null
  // Kendi sağlayıcısıyla: kabuğun dışında (örnek rapor, testler) da çalışsın.
  return (
    <TooltipProvider delayDuration={150}>
      <ol aria-label="Skorun parçaları" className="m-0 flex h-12 list-none gap-1 p-0">
        {parts.map((part, i) => {
          const state = part.credit >= 1 ? "met" : part.credit > 0 ? "partial" : "missing"
          const status = state === "met" ? "karşılanıyor" : state === "partial" ? "kısmen karşılanıyor" : "CV'nde görünmüyor"
          return (
            <li key={part.index ?? "title"} className="flex min-w-2" style={{ flexGrow: part.weight, flexBasis: 0 }}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onSelect?.(part)}
                    aria-label={`${part.label}: ${status}${part.gain > 0 ? `, karşılanırsa ${part.gain} puan` : ""}`}
                    className={cn(
                      "relative h-full w-full overflow-hidden rounded-[3px] bg-muted outline-none",
                      "transition-[filter] hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:brightness-125",
                      state === "missing" && "bg-transparent shadow-[inset_0_0_0_1px_var(--border)]",
                    )}
                  >
                    {part.credit > 0 && (
                      <motion.span
                        aria-hidden
                        className="absolute inset-y-0 left-0 bg-foreground"
                        style={{ width: `${part.credit * 100}%`, originX: 0 }}
                        initial={reducedMotion ? false : { scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.45, delay: 0.15 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                      />
                    )}
                    {/* Eksik: altta ince amber çizgi; kapatılabilecek bir şey, hata değil. */}
                    {state !== "met" && <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-brand-amber" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-72 text-left">
                  <span className="block font-medium">{part.label}</span>
                  <span className="block opacity-80">
                    {KIND_LABEL[part.kind]} · {status}
                    {part.gain > 0 && ` · karşılanırsa +${part.gain} puan`}
                  </span>
                </TooltipContent>
              </Tooltip>
            </li>
          )
        })}
      </ol>
      <p className="m-0 mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[2px] bg-foreground" />
          CV&apos;nde var
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[2px] border-b-2 border-brand-amber shadow-[inset_0_0_0_1px_var(--border)]" />
          CV&apos;nde görünmüyor
        </span>
        <span>Genişlik skordaki payı. {hint}</span>
      </p>
    </TooltipProvider>
  )
}
