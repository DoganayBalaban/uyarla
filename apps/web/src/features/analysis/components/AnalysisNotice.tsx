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
import { scoreStatus } from "@/lib/scoreStatus"

const POLL_MS = 3000
const DONE_TITLE = "✓ Analizin hazır · uyarla"

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
export function AnalysisNotice() {
  const pathname = usePathname()
  const router = useRouter()
  const reducedMotion = useReducedMotion() ?? false
  const [record, setRecord] = useState<ActiveAnalysis | null>(null)
  const [notificationPermission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported")
  const originalTitle = useRef<string | null>(null)

  const onAnalyzePage = pathname === "/analyze"

  // Kayıt localStorage'da; aynı sekmedeki değişiklikler özel olayla, diğer
  // sekmelerdekiler `storage` olayıyla geliyor.
  useEffect(() => {
    const reload = () => setRecord(readActiveAnalysis())
    reload()
    setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission)
    window.addEventListener(ACTIVE_ANALYSIS_EVENT, reload)
    window.addEventListener("storage", reload)
    return () => {
      window.removeEventListener(ACTIVE_ANALYSIS_EVENT, reload)
      window.removeEventListener("storage", reload)
    }
  }, [])

  const finished = useCallback(
    (result: ActiveAnalysis) => {
      if (!document.hidden) return
      // Sekme arka planda: başlıkla ve (izin varsa) tarayıcı bildirimiyle haber ver.
      originalTitle.current ??= document.title
      document.title = result.status === "completed" ? DONE_TITLE : "Analiz tamamlanamadı · uyarla"
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        const notification = new Notification(
          result.status === "completed" ? "Analizin hazır" : "Analiz tamamlanamadı",
          {
            body:
              result.status === "completed" && result.score != null
                ? `Uyum skorun ${result.score} · ${scoreStatus(result.score).label}`
                : "Ayrıntı için uyarla'ya dön.",
            tag: `uyarla-analiz-${result.jobId}`,
          },
        )
        notification.onclick = () => {
          window.focus()
          if (result.analysisId) router.push(resultPath(result.analysisId))
          notification.close()
        }
      }
    },
    [router],
  )

  // Sekme öne gelince özgün başlık geri geliyor.
  useEffect(() => {
    const shown = () => {
      if (!document.hidden && originalTitle.current) {
        document.title = originalTitle.current
        originalTitle.current = null
      }
    }
    document.addEventListener("visibilitychange", shown)
    return () => document.removeEventListener("visibilitychange", shown)
  }, [])

  // Yoklama. Analiz sayfası kendi yoklamasını yapıyor; iki kez sormamak için
  // orada durmuş oluyoruz.
  const jobId = record?.status === "running" ? record.jobId : null
  useEffect(() => {
    if (!jobId || onAnalyzePage) return
    let stopped = false
    const ask = async () => {
      try {
        const response = await fetch(`/api/analyze/${jobId}`)
        if (response.status === 404 || response.status === 401) {
          // İş bulunamıyor (kuyruk temizlendi ya da oturum değişti): izleme bitti.
          clearActiveAnalysis()
          return
        }
        const reply = (await response.json()) as Parameters<typeof handleResponse>[1]
        if (stopped) return
        handleResponse(jobId, reply)
        if (reply.status === "completed" || reply.status === "failed") {
          const last = readActiveAnalysis()
          if (last) finished(last)
          return
        }
      } catch {
        // Ağ kesintisi: bir sonraki turda tekrar dene.
      }
      if (!stopped) timerRef = setTimeout(ask, POLL_MS)
    }
    let timerRef = setTimeout(ask, 500)
    return () => {
      stopped = true
      clearTimeout(timerRef)
    }
  }, [jobId, onAnalyzePage, finished])

  async function askPermission() {
    if (typeof Notification === "undefined") return
    setPermission(await Notification.requestPermission())
  }

  const shown = !!record && !onAnalyzePage && !record.seen

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-end sm:inset-x-auto sm:right-6 sm:bottom-6"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <AnimatePresence>
        {shown && record && (
          <motion.div
            key={`${record.jobId}-${record.status}`}
            initial={reducedMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto w-full max-w-sm rounded-card border border-border bg-card p-4 shadow-xl shadow-brand-night/10"
          >
            {record.status === "running" && (
              <RunningNotice
                record={record}
                notificationPermission={notificationPermission}
                onAskPermission={() => void askPermission()}
              />
            )}
            {record.status === "completed" && (
              <DoneNotice record={record} onClose={() => updateActiveAnalysis(record.jobId, { seen: true })} />
            )}
            {record.status === "failed" && <FailedNotice record={record} onClose={clearActiveAnalysis} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function RunningNotice({
  record,
  notificationPermission,
  onAskPermission,
}: {
  record: ActiveAnalysis
  notificationPermission: NotificationPermission | "unsupported"
  onAskPermission: () => void
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-blue/10 text-brand-blue">
        <LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 font-semibold">Analizin hazırlanıyor</p>
        <p className="m-0 mt-0.5 text-sm text-muted">
          {(record.stage && STAGE_SHORT_LABEL[record.stage]) ?? "Sıraya alındı"} · bitince haber vereceğiz
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href="/analyze"
            className="inline-flex items-center gap-1.5 rounded-button bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white no-underline transition hover:bg-brand-blue/90"
          >
            Analize dön
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
          {notificationPermission === "default" && (
            <button
              type="button"
              onClick={onAskPermission}
              className="inline-flex items-center gap-1.5 rounded-button border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:border-brand-blue/40 hover:text-brand-blue"
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

function DoneNotice({ record, onClose }: { record: ActiveAnalysis; onClose: () => void }) {
  const state = record.score != null ? scoreStatus(record.score) : null
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-green/10 text-brand-green dark:text-[#4ade80]">
        <CircleCheck className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 font-semibold">Analizin hazır</p>
        {state && record.score != null && (
          <p className="m-0 mt-0.5 text-sm text-muted">
            Uyum skorun <span className={`font-semibold ${state.textClass}`}>{record.score} · {state.label}</span>
          </p>
        )}
        {record.analysisId && (
          <Link
            href={resultPath(record.analysisId)}
            onClick={onClose}
            className="mt-3 inline-flex items-center gap-1.5 rounded-button bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white no-underline transition hover:bg-brand-blue/90"
          >
            Sonucu gör
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
      <CloseButton onClose={onClose} />
    </div>
  )
}

function FailedNotice({ record, onClose }: { record: ActiveAnalysis; onClose: () => void }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-red/10 text-brand-red dark:text-[#f87171]">
        <CircleAlert className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 font-semibold">Analiz tamamlanamadı</p>
        <p className="m-0 mt-0.5 text-sm text-muted">{record.error ?? "Birkaç dakika sonra tekrar dener misin?"}</p>
        <Link
          href="/analyze"
          onClick={onClose}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-blue no-underline dark:text-[#8ea2ff]"
        >
          Tekrar dene
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      <CloseButton onClose={onClose} />
    </div>
  )
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Bildirimi kapat"
      className="-m-1 grid size-7 shrink-0 place-items-center rounded-full text-muted transition hover:bg-background hover:text-foreground"
    >
      <X className="size-4" aria-hidden />
    </button>
  )
}
