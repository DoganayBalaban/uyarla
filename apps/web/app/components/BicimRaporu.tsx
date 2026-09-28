"use client"

import { ChevronDown, CircleCheck, OctagonAlert, ScanText, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/cn"

export interface FormatBulguView {
  kod: string
  seviye: "sorun" | "uyari"
  baslik: string
  aciklama: string
}

export interface FormatRaporuView {
  bulgular: FormatBulguView[]
  gecenler: string[]
}

/**
 * CV'nin ATS okunabilirliği. Skordan ayrı bir soru: skor "ilana uyuyor mu",
 * bu bölüm "ATS doğru okuyabilir mi". Durum renkleri yalnızca durumu
 * anlatıyor ve her zaman bir etiketle birlikte (rehber §9.2).
 *
 * Bulgular 21st.dev'deki "alert" bileşenlerinin desenini izliyor: ikon,
 * başlık, açıklama; seviye sol kenar rengi ve etiketle birlikte.
 */
export function BicimRaporu({ rapor }: { rapor: FormatRaporuView }) {
  const sorun = rapor.bulgular.filter((b) => b.seviye === "sorun").length
  const uyari = rapor.bulgular.length - sorun

  return (
    <section className="rounded-kart border border-cizgi bg-kart p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-buton bg-mavi/10 text-mavi">
            <ScanText className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="m-0 text-lg">ATS okunabilirliği</h2>
            <p className="m-0 text-sm text-gri">Başvuru sistemleri CV&apos;ni doğru okuyabilir mi?</p>
          </div>
        </div>
        <ul className="flex flex-wrap gap-1.5 text-xs font-semibold">
          {sorun > 0 && (
            <li className="rounded-full bg-kirmizi/10 px-2.5 py-1 text-kirmizi dark:text-[#f87171]">{sorun} sorun</li>
          )}
          {uyari > 0 && <li className="rounded-full bg-kehribar/15 px-2.5 py-1 text-kehribar">{uyari} uyarı</li>}
          <li className="rounded-full bg-yesil/10 px-2.5 py-1 text-yesil dark:text-[#4ade80]">
            {rapor.gecenler.length} kontrol geçti
          </li>
        </ul>
      </div>

      {rapor.bulgular.length === 0 ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-gri">
          <CircleCheck className="size-4 text-yesil dark:text-[#4ade80]" aria-hidden />
          CV&apos;nde ATS&apos;in okumasını zorlaştıracak bir biçim sorunu bulmadık.
        </p>
      ) : (
        <ul className="mt-5 space-y-2.5">
          {rapor.bulgular.map((b) => {
            const sorunMu = b.seviye === "sorun"
            const Ikon = sorunMu ? OctagonAlert : TriangleAlert
            return (
              <li
                key={b.kod}
                className={cn(
                  "flex gap-3 rounded-buton border border-cizgi border-l-4 bg-zemin/60 p-3.5",
                  sorunMu ? "border-l-kirmizi" : "border-l-kehribar",
                )}
              >
                <Ikon
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    sorunMu ? "text-kirmizi dark:text-[#f87171]" : "text-kehribar",
                  )}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="m-0 font-semibold">
                    <span className="sr-only">{sorunMu ? "Sorun: " : "Uyarı: "}</span>
                    {b.baslik}
                  </p>
                  <p className="m-0 mt-0.5 text-sm text-gri">{b.aciklama}</p>
                </div>
                <span
                  aria-hidden
                  className={cn(
                    "ml-auto h-fit shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase",
                    sorunMu ? "bg-kirmizi/10 text-kirmizi dark:text-[#f87171]" : "bg-kehribar/15 text-kehribar",
                  )}
                >
                  {sorunMu ? "Sorun" : "Uyarı"}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {rapor.gecenler.length > 0 && (
        <details className="group mt-4">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-sm text-gri">
            Geçen kontroller
            <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="mt-3 flex flex-wrap gap-2">
            {rapor.gecenler.map((g) => (
              <li key={g} className="inline-flex items-center gap-1.5 rounded-full bg-zemin px-2.5 py-1 text-xs text-gri">
                <CircleCheck className="size-3.5 text-yesil dark:text-[#4ade80]" aria-hidden />
                {g}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
