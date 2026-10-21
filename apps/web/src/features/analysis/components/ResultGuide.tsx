"use client"

import { useEffect, useState } from "react"
import { CircleHelp } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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

  function change(next: boolean) {
    setOpen(next)
    if (next) return
    markSeen()
    setSeen(true)
  }

  const step = steps[at]!
  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setAt(0)}
          className={cn(seen ? "text-muted-foreground" : "text-primary")}
        >
          <CircleHelp aria-hidden />
          Sonucu nasıl okuyacağım?
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <p className="m-0 text-xs font-semibold text-muted-foreground tabular-nums">
            {at + 1} / {steps.length}
          </p>
          <DialogTitle>{step.title}</DialogTitle>
          <DialogDescription>{step.body}</DialogDescription>
        </DialogHeader>
        {/* Adım göstergesi; sayı yukarıda yazılı. */}
        <div aria-hidden className="flex gap-1.5">
          {steps.map((s, i) => (
            <span key={s.title} className={cn("h-1 flex-1 rounded-full transition-colors", i <= at ? "bg-primary" : "bg-muted")} />
          ))}
        </div>
        <DialogFooter className="items-center gap-2 sm:justify-between">
          <Button
            type="button"
            variant="link"
            className="px-0"
            onClick={() => {
              change(false)
              onGo(step.target)
            }}
          >
            Bölüme git
          </Button>
          <div className="flex gap-2">
            {at > 0 && (
              <Button type="button" variant="ghost" onClick={() => setAt(at - 1)}>
                Önceki
              </Button>
            )}
            {at < steps.length - 1 ? (
              <Button type="button" autoFocus onClick={() => setAt(at + 1)}>
                Sonraki
              </Button>
            ) : (
              <Button type="button" autoFocus onClick={() => change(false)}>
                Anladım
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
