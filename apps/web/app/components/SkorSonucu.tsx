"use client"

import { useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react"
import { cn } from "@/lib/cn"
import { BicimRaporu, type FormatRaporuView } from "./BicimRaporu"
import { SkorHalkasi, skorDurumu } from "./ui/SkorHalkasi"

export interface RequirementResult {
  requirement: { text: string; importance: string; type: string }
  status: "matched" | "missing"
  confidence: number
  method: string | null
  evidence: { text: string; kind: string } | null
}

export interface ScoreResultView {
  score: number
  requirements: RequirementResult[]
  missingKeywords: string[]
  /** Biçim kontrolü; eski analizlerde ve kontrol patladığında yok. */
  format?: FormatRaporuView | null
}

type Suzgec = "hepsi" | "eksik" | "karsilanan"

const ONEM: Record<string, string> = {
  must: "Zorunlu",
  nice: "Tercih sebebi",
}

/**
 * Analiz sonucunun gösterimi.
 *
 * Üstte skor kartı (rehber §9.5: skor ekranın en büyük öğesi), altında
 * biçim raporu, süzülebilir gereksinim listesi ve eksik kavramlar.
 * Gereksinim satırları 21st.dev'deki akordeon/liste bileşenlerinin
 * desenini izliyor: kanıt yalnızca açılınca görünüyor, ekran sakin kalıyor.
 */
export function SkorSonucu({
  sonuc,
  durationMs,
  tokenUsage,
  modelId,
  uyarlaniyor,
  hata,
  onUyarla,
  onYeniAnaliz,
}: {
  sonuc: ScoreResultView
  durationMs?: number | null
  tokenUsage?: number | null
  modelId?: string | null
  uyarlaniyor: boolean
  hata?: string | null
  onUyarla?: () => void
  onYeniAnaliz?: () => void
}) {
  const azHareket = useReducedMotion() ?? false
  const [suzgec, setSuzgec] = useState<Suzgec>("hepsi")
  const durum = skorDurumu(sonuc.score)
  const karsilanan = sonuc.requirements.filter((r) => r.status === "matched").length
  const eksik = sonuc.requirements.length - karsilanan
  const gorunen = sonuc.requirements.filter((r) =>
    suzgec === "hepsi" ? true : suzgec === "eksik" ? r.status === "missing" : r.status === "matched",
  )

  const giris = (gecikme: number) =>
    azHareket
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.4, delay: gecikme, ease: [0.22, 1, 0.36, 1] as const },
        }

  return (
    <section className="space-y-6">
      {/* Skor kartı. */}
      <motion.div
        {...giris(0)}
        className="relative overflow-hidden rounded-kart border border-cizgi bg-kart p-6 shadow-sm sm:p-8"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-mavi/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <SkorHalkasi skor={sonuc.score} boyut={148} className="shrink-0 self-center sm:self-auto" />

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wider text-gri uppercase">Uyum skoru</p>
            <h1 className="mt-1 text-2xl sm:text-3xl">
              {sonuc.requirements.length} gereksinimin{" "}
              <span className={durum.renk}>{karsilanan} tanesi</span> karşılanıyor
            </h1>
            <p className="mt-2 text-sm text-gri">
              {eksik > 0
                ? "Uyarladığımızda eksikleri deneyiminin izin verdiği ölçüde kapatıyoruz; olmayan bir şeyi eklemiyoruz."
                : "CV'n bu ilanın istediklerini karşılıyor. Yine de anlatımı ilanın diline yaklaştırabilirsin."}
            </p>

            <div className="mt-5 flex flex-wrap gap-2.5">
              {onUyarla && (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-buton bg-mavi px-5 py-3 font-semibold text-white shadow-sm shadow-mavi/30 transition hover:bg-mavi/90 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={uyarlaniyor}
                  onClick={onUyarla}
                >
                  {uyarlaniyor ? (
                    <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="size-4" aria-hidden />
                  )}
                  {uyarlaniyor ? "Hazırlanıyor…" : "CV'mi bu ilana uyarla"}
                  {!uyarlaniyor && <ArrowRight className="size-4" aria-hidden />}
                </button>
              )}
              {onYeniAnaliz && (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-buton border border-cizgi bg-kart px-4 py-3 text-sm font-semibold transition hover:border-mavi/40 hover:text-mavi"
                  onClick={onYeniAnaliz}
                >
                  <RotateCcw className="size-4" aria-hidden />
                  Yeni analiz
                </button>
              )}
            </div>

            {hata && (
              <p
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-buton bg-kirmizi/10 px-3 py-2 text-sm text-kirmizi dark:text-[#f87171]"
              >
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {hata}
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {sonuc.format && (
        <motion.div {...giris(0.08)}>
          <BicimRaporu rapor={sonuc.format} />
        </motion.div>
      )}

      {/* Gereksinimler. */}
      <motion.div {...giris(0.14)} className="rounded-kart border border-cizgi bg-kart p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 text-lg">Gereksinimler</h2>
          <div role="tablist" aria-label="Gereksinimleri süz" className="inline-flex rounded-buton bg-zemin p-1 text-sm">
            {(
              [
                ["hepsi", `Hepsi · ${sonuc.requirements.length}`],
                ["eksik", `Eksik · ${eksik}`],
                ["karsilanan", `Karşılanan · ${karsilanan}`],
              ] as const
            ).map(([deger, etiket]) => (
              <button
                key={deger}
                type="button"
                role="tab"
                aria-selected={suzgec === deger}
                onClick={() => setSuzgec(deger)}
                className={cn(
                  "rounded-[8px] px-3 py-1.5 font-medium transition",
                  suzgec === deger ? "bg-kart text-metin shadow-sm" : "text-gri hover:text-metin",
                )}
              >
                {etiket}
              </button>
            ))}
          </div>
        </div>

        {gorunen.length === 0 ? (
          <p className="mt-4 text-sm text-gri">Bu süzgeçte gereksinim yok.</p>
        ) : (
          <ul className="mt-4 divide-y divide-cizgi">
            {gorunen.map((item, i) => (
              <GereksinimSatiri key={`${suzgec}-${i}`} item={item} />
            ))}
          </ul>
        )}
      </motion.div>

      {/* Eksik kavramlar. */}
      <motion.div {...giris(0.2)} className="rounded-kart border border-cizgi bg-kart p-5 sm:p-6">
        <h2 className="m-0 text-lg">Eksik kavramlar</h2>
        <p className="mt-1 text-sm text-gri">İlanda geçen ama CV&apos;nde karşılığını bulamadığımız kavramlar.</p>
        {sonuc.missingKeywords.length === 0 ? (
          <p className="mt-3 text-sm text-gri">Eksik kavram yok.</p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2">
            {sonuc.missingKeywords.map((k) => (
              <li
                key={k}
                className="inline-flex items-center gap-1.5 rounded-full border border-cizgi bg-zemin px-3 py-1 text-sm"
              >
                <span aria-hidden className="size-1.5 rounded-full bg-mercan" />
                {k}
              </li>
            ))}
          </ul>
        )}
      </motion.div>

      <details className="group rounded-kart border border-cizgi bg-kart px-5 py-4">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm text-gri">
          Teknik ayrıntı
          <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
        </summary>
        <p className="mt-3 text-sm text-gri">
          {durationMs} ms · {tokenUsage} token · {modelId}
        </p>
        <pre className="mt-2 max-h-[32rem] overflow-x-auto rounded-buton border border-cizgi bg-zemin p-4 text-xs">
          {JSON.stringify(sonuc, null, 2)}
        </pre>
      </details>
    </section>
  )
}

function GereksinimSatiri({ item }: { item: RequirementResult }) {
  const [acik, setAcik] = useState(false)
  const tamam = item.status === "matched"
  const onem = ONEM[item.requirement.importance] ?? item.requirement.importance

  return (
    <li className="py-3">
      <button
        type="button"
        className="flex w-full items-start gap-3 text-left"
        aria-expanded={item.evidence ? acik : undefined}
        onClick={() => item.evidence && setAcik((a) => !a)}
        disabled={!item.evidence}
      >
        <span
          className={cn(
            "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
            tamam
              ? "bg-yesil/15 text-yesil dark:text-[#4ade80]"
              : "bg-kirmizi/10 text-kirmizi dark:text-[#f87171]",
          )}
        >
          {tamam ? <Check className="size-3" strokeWidth={3} aria-hidden /> : <X className="size-3" strokeWidth={3} aria-hidden />}
          <span className="sr-only">{tamam ? "Karşılanıyor" : "Eksik"}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-medium">{item.requirement.text}</span>
          <span className="ml-2 inline-block rounded-full bg-zemin px-2 py-0.5 align-middle text-[11px] font-semibold text-gri">
            {onem}
          </span>
        </span>
        {item.evidence && (
          <ChevronDown
            className={cn("mt-1 size-4 shrink-0 text-gri transition", acik && "rotate-180")}
            aria-hidden
          />
        )}
      </button>
      {item.evidence && acik && (
        <p className="mt-2 ml-8 rounded-buton border-l-2 border-yesil/60 bg-zemin px-3 py-2 text-sm text-gri">
          <span className="font-semibold text-metin">CV&apos;nde bunu karşılayan:</span> {item.evidence.text}
        </p>
      )}
    </li>
  )
}
