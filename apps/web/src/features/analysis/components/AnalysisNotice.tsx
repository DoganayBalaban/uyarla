"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ArrowRight, BellRing, CircleAlert, CircleCheck, LoaderCircle, X } from "lucide-react"
import {
  ACTIVE_ANALYSIS_EVENT,
  STAGE_SHORT_LABEL,
  updateActiveAnalysis,
  readActiveAnalysis,
  clearActiveAnalysis,
  resultPath,
  handleResponse,
  type ActiveAnalysis,
} from "@/features/analysis/activeAnalysis"
import { skorDurumu } from "@/features/analysis/components/ScoreRing"

const YOKLAMA_MS = 3000
const BITTI_BASLIGI = "✓ Analizin hazır · uyarla"

/**
 * Sağ alttaki analiz bildirimi.
 *
 * Analiz sürerken kullanıcı başka sayfalara geçebiliyor; bu kart her sayfada
 * analizi izliyor, "Analize dön" ile geri götürüyor ve bitince haber veriyor.
 * Sekme arka plandaysa sekme başlığı değişiyor, kullanıcı izin verdiyse
 * tarayıcı bildirimi de gidiyor.
 *
 * Analiz sayfasında gösterilmiyor: orada aşama çizelgesi zaten açık.
 */
export function AnalizBildirimi() {
  const pathname = usePathname()
  const router = useRouter()
  const azHareket = useReducedMotion() ?? false
  const [kayit, setKayit] = useState<ActiveAnalysis | null>(null)
  const [izin, setIzin] = useState<NotificationPermission | "yok">("yok")
  const ozgunBaslik = useRef<string | null>(null)

  const analizSayfasinda = pathname === "/analyze"

  // Kayıt localStorage'da; aynı sekmedeki değişiklikler özel olayla, diğer
  // sekmelerdekiler `storage` olayıyla geliyor.
  useEffect(() => {
    const yenile = () => setKayit(readActiveAnalysis())
    yenile()
    setIzin(typeof Notification === "undefined" ? "yok" : Notification.permission)
    window.addEventListener(ACTIVE_ANALYSIS_EVENT, yenile)
    window.addEventListener("storage", yenile)
    return () => {
      window.removeEventListener(ACTIVE_ANALYSIS_EVENT, yenile)
      window.removeEventListener("storage", yenile)
    }
  }, [])

  const bitti = useCallback(
    (sonuc: ActiveAnalysis) => {
      if (!document.hidden) return
      // Sekme arka planda: başlıkla ve (izin varsa) tarayıcı bildirimiyle haber ver.
      ozgunBaslik.current ??= document.title
      document.title = sonuc.status === "completed" ? BITTI_BASLIGI : "Analiz tamamlanamadı · uyarla"
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        const bildirim = new Notification(
          sonuc.status === "completed" ? "Analizin hazır" : "Analiz tamamlanamadı",
          {
            body:
              sonuc.status === "completed" && sonuc.score != null
                ? `Uyum skorun ${sonuc.score} · ${skorDurumu(sonuc.score).label}`
                : "Ayrıntı için uyarla'ya dön.",
            tag: `uyarla-analiz-${sonuc.jobId}`,
          },
        )
        bildirim.onclick = () => {
          window.focus()
          if (sonuc.analysisId) router.push(resultPath(sonuc.analysisId))
          bildirim.close()
        }
      }
    },
    [router],
  )

  // Sekme öne gelince özgün başlık geri geliyor.
  useEffect(() => {
    const gorunur = () => {
      if (!document.hidden && ozgunBaslik.current) {
        document.title = ozgunBaslik.current
        ozgunBaslik.current = null
      }
    }
    document.addEventListener("visibilitychange", gorunur)
    return () => document.removeEventListener("visibilitychange", gorunur)
  }, [])

  // Yoklama. Analiz sayfası kendi yoklamasını yapıyor; iki kez sormamak için
  // orada durmuş oluyoruz.
  const jobId = kayit?.status === "running" ? kayit.jobId : null
  useEffect(() => {
    if (!jobId || analizSayfasinda) return
    let durdu = false
    const sor = async () => {
      try {
        const cevap = await fetch(`/api/analyze/${jobId}`)
        if (cevap.status === 404 || cevap.status === 401) {
          // İş bulunamıyor (kuyruk temizlendi ya da oturum değişti): izleme bitti.
          clearActiveAnalysis()
          return
        }
        const yanit = (await cevap.json()) as Parameters<typeof handleResponse>[1]
        if (durdu) return
        handleResponse(jobId, yanit)
        if (yanit.status === "completed" || yanit.status === "failed") {
          const son = readActiveAnalysis()
          if (son) bitti(son)
          return
        }
      } catch {
        // Ağ kesintisi: bir sonraki turda tekrar dene.
      }
      if (!durdu) zamanlayici = setTimeout(sor, YOKLAMA_MS)
    }
    let zamanlayici = setTimeout(sor, 500)
    return () => {
      durdu = true
      clearTimeout(zamanlayici)
    }
  }, [jobId, analizSayfasinda, bitti])

  async function izinIste() {
    if (typeof Notification === "undefined") return
    setIzin(await Notification.requestPermission())
  }

  const gorunur = !!kayit && !analizSayfasinda && !kayit.seen

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-end sm:inset-x-auto sm:right-6 sm:bottom-6"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <AnimatePresence>
        {gorunur && kayit && (
          <motion.div
            key={`${kayit.jobId}-${kayit.status}`}
            initial={azHareket ? false : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={azHareket ? undefined : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto w-full max-w-sm rounded-kart border border-cizgi bg-kart p-4 shadow-xl shadow-gece/10"
          >
            {kayit.status === "running" && (
              <Calisiyor
                kayit={kayit}
                izin={izin}
                onIzin={() => void izinIste()}
              />
            )}
            {kayit.status === "completed" && (
              <Bitti kayit={kayit} onKapat={() => updateActiveAnalysis(kayit.jobId, { seen: true })} />
            )}
            {kayit.status === "failed" && <Basarisiz kayit={kayit} onKapat={clearActiveAnalysis} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Calisiyor({
  kayit,
  izin,
  onIzin,
}: {
  kayit: ActiveAnalysis
  izin: NotificationPermission | "yok"
  onIzin: () => void
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-mavi/10 text-mavi">
        <LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 font-semibold">Analizin hazırlanıyor</p>
        <p className="m-0 mt-0.5 text-sm text-gri">
          {(kayit.stage && STAGE_SHORT_LABEL[kayit.stage]) ?? "Sıraya alındı"} · bitince haber vereceğiz
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href="/analyze"
            className="inline-flex items-center gap-1.5 rounded-buton bg-mavi px-3 py-1.5 text-sm font-semibold text-white no-underline transition hover:bg-mavi/90"
          >
            Analize dön
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
          {izin === "default" && (
            <button
              type="button"
              onClick={onIzin}
              className="inline-flex items-center gap-1.5 rounded-buton border border-cizgi px-3 py-1.5 text-sm font-medium text-metin transition hover:border-mavi/40 hover:text-mavi"
            >
              <BellRing className="size-3.5" aria-hidden />
              Tarayıcıdan da haber ver
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Bitti({ kayit, onKapat }: { kayit: ActiveAnalysis; onKapat: () => void }) {
  const durum = kayit.score != null ? skorDurumu(kayit.score) : null
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-yesil/10 text-yesil dark:text-[#4ade80]">
        <CircleCheck className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 font-semibold">Analizin hazır</p>
        {durum && kayit.score != null && (
          <p className="m-0 mt-0.5 text-sm text-gri">
            Uyum skorun <span className={`font-semibold ${durum.textClass}`}>{kayit.score} · {durum.label}</span>
          </p>
        )}
        {kayit.analysisId && (
          <Link
            href={resultPath(kayit.analysisId)}
            onClick={onKapat}
            className="mt-3 inline-flex items-center gap-1.5 rounded-buton bg-mavi px-3 py-1.5 text-sm font-semibold text-white no-underline transition hover:bg-mavi/90"
          >
            Sonucu gör
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
      <KapatDugmesi onKapat={onKapat} />
    </div>
  )
}

function Basarisiz({ kayit, onKapat }: { kayit: ActiveAnalysis; onKapat: () => void }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-kirmizi/10 text-kirmizi dark:text-[#f87171]">
        <CircleAlert className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 font-semibold">Analiz tamamlanamadı</p>
        <p className="m-0 mt-0.5 text-sm text-gri">{kayit.error ?? "Birkaç dakika sonra tekrar dener misin?"}</p>
        <Link
          href="/analyze"
          onClick={onKapat}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-mavi no-underline dark:text-[#8ea2ff]"
        >
          Tekrar dene
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      <KapatDugmesi onKapat={onKapat} />
    </div>
  )
}

function KapatDugmesi({ onKapat }: { onKapat: () => void }) {
  return (
    <button
      type="button"
      onClick={onKapat}
      aria-label="Bildirimi kapat"
      className="-m-1 grid size-7 shrink-0 place-items-center rounded-full text-gri transition hover:bg-zemin hover:text-metin"
    >
      <X className="size-4" aria-hidden />
    </button>
  )
}
