"use client"

import { useEffect, useState } from "react"
import { CircleHelp, X } from "lucide-react"
import { cn } from "@/lib/cn"
import type { ScoreImpacts } from "@/features/analysis/scoreImpact"

/**
 * "Sonucu nasıl okuyacağım?" turu (DOG-139). Zorla açılmıyor; bağlantıyla
 * açılan dört adım. K2'de iki katılımcı düşük skoru "işe uygun değilim" diye
 * okudu: ilk adım bunu söylüyor. Ağırlıklar formülden (scoreImpacts), elle
 * yazılmış oran yok. Görüldü bilgisi yalnızca tarayıcıda.
 */
const SEEN_KEY = "uyarla:sonuc-turu"

export interface GuideStep {
  title: string
  body: string
  /** Adımın anlattığı bölüm; "Bölüme git" oraya kaydırıyor. */
  target: string
}

export function guideSteps(impacts: ScoreImpacts): GuideStep[] {
  return [
    {
      title: "Skor neyi ölçer?",
      body: `CV'nin bu ilanla ne kadar örtüştüğünü; işe uygunluğunu değil. ${impacts.requirements.hint}${impacts.title ? ` ${impacts.title.hint}` : ""}`,
      target: "skor",
    },
    {
      title: "Başvuruya hazır mısın?",
      body: "Bir skor eşiğine bakmıyoruz: zorunlu gereksinimlerin hepsi ve ilandaki unvan CV'nde görünüyorsa hazır sayıyoruz. Eksik zorunlular \"Eksik\" süzgecinde.",
      target: "gereksinimler",
    },
    {
      title: "Şartı yanlış mı okuduk?",
      body: "İlanda olmayan bir şart gördüysen satırdaki \"Bu şartta sorun var\" ile işaretle; yıl, bölüm ve unvanı da düzeltebilirsin. Skor yeniden hesaplanır.",
      target: "gereksinimler",
    },
    {
      title: "Uyarlama ne yapar?",
      // Maddeler onay bekliyor (pending); özet doğrulamadan geçerse kabul,
      // geçmezse ret (adapt/draft.ts). "Her değişiklik" denmiyor.
      body: "CV'ndeki deneyimi ilanın diliyle yeniden yazar; olmayan bir deneyim ya da sayı eklemez. Yeniden yazılan maddeleri önce sen onaylarsın; doğrulamadan geçmeyen değişiklik kendiliğinden alınmaz.",
      target: "skor",
    },
  ]
}

function readSeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1"
  } catch {
    return false
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, "1")
  } catch {
    // Gizli pencere ya da engellenmiş depolama: tur yine çalışıyor.
  }
}

export function ResultGuide({ impacts, onGo }: { impacts: ScoreImpacts; onGo: (target: string) => void }) {
  const steps = guideSteps(impacts)
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState(0)
  // İlk render sunucuyla aynı olsun diye görüldü bilgisi sonradan okunuyor.
  const [seen, setSeen] = useState(true)
  useEffect(() => setSeen(readSeen()), [])

  function close() {
    setOpen(false)
    markSeen()
    setSeen(true)
  }

  const step = steps[at]!
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAt(0)
          setOpen(true)
        }}
        className={cn(
          "inline-flex items-center gap-1.5 text-sm font-medium transition",
          seen ? "text-muted hover:text-foreground" : "text-brand-blue",
        )}
      >
        <CircleHelp className="size-4" aria-hidden />
        Sonucu nasıl okuyacağım?
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="result-guide-title"
            className="w-full max-w-md rounded-card border border-border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === "Escape" && close()}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="m-0 text-xs font-semibold text-muted tabular-nums">
                {at + 1} / {steps.length}
              </p>
              <button type="button" onClick={close} aria-label="Kapat" className="text-muted hover:text-foreground">
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <h2 id="result-guide-title" className="m-0 mt-1 text-lg">
              {step.title}
            </h2>
            <p className="mt-2 text-sm text-muted">{step.body}</p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {at < steps.length - 1 ? (
                <button
                  type="button"
                  autoFocus
                  onClick={() => setAt(at + 1)}
                  className="rounded-button bg-brand-blue px-4 py-2 text-sm font-semibold text-white"
                >
                  Sonraki
                </button>
              ) : (
                <button type="button" autoFocus onClick={close} className="rounded-button bg-brand-blue px-4 py-2 text-sm font-semibold text-white">
                  Anladım
                </button>
              )}
              {at > 0 && (
                <button type="button" onClick={() => setAt(at - 1)} className="px-3 py-2 text-sm font-semibold text-muted">
                  Önceki
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  close()
                  onGo(step.target)
                }}
                className="ml-auto text-sm font-semibold text-brand-blue"
              >
                Bölüme git
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
