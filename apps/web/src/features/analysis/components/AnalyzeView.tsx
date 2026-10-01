"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import {
  ArrowRight,
  FileCheck2,
  Gauge,
  Link2,
  LoaderCircle,
  RotateCcw,
  SearchCheck,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react"
import { loginPath } from "@/lib/returnPath"
import { deriveStageStates } from "@/features/analysis/stageStates"
import {
  startActiveAnalysis,
  updateActiveAnalysis,
  readActiveAnalysis,
  clearActiveAnalysis,
  handleResponse,
} from "@/features/analysis/activeAnalysis"
import { resultPath } from "@/features/analysis/paths"
import { PageHeader } from "@/components/layout/PageShell"
import { StageTimeline } from "@/features/analysis/components/StageTimeline"
import { ResumeUpload } from "@/features/analysis/components/ResumeUpload"
import { ScoreResult } from "@/features/analysis/components/ScoreResult"
import {
  analysisQueryKey,
  fetchPostingFromUrl,
  getAnalysis,
  startAnalysis,
  useAnalysisJob,
  type AnalysisResponse,
} from "@/features/analysis/api"
import { startAdaptation } from "@/features/adaptation/api"
import { apiErrorBody, apiErrorMessage, apiStatus } from "@/lib/api"

/** Marka rehberi §10.2'deki yükleme metinleri; aşama çizelgesinin satırları. */
const STAGES = [
  { id: "reading_resume", title: "CV'ni okuyoruz", description: "Deneyim, eğitim ve becerilerin ayrıştırılıyor." },
  { id: "reading_posting", title: "İlanı okuyoruz", description: "Gereksinimler ve aranan kavramlar çıkarılıyor." },
  { id: "comparing", title: "İlanla karşılaştırıyoruz", description: "Her gereksinim CV'nde kanıtıyla aranıyor." },
]

const inputClass =
  "w-full rounded-button border border-border bg-card px-3.5 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted/70 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/15"

function StepHeading({ number, heading, hint }: { number: number; heading: string; hint: string }) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-blue text-sm font-bold text-white">
        {number}
      </span>
      <div>
        <p className="m-0 font-semibold">{heading}</p>
        <p className="m-0 text-sm text-muted">{hint}</p>
      </div>
    </div>
  )
}

export function AnalyzeView() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [state, setState] = useState<AnalysisResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const postingBox = useRef<HTMLTextAreaElement>(null)
  const [postingUrl, setPostingUrl] = useState("")
  const [postingState, setPostingState] = useState<
    { kind: "loading" } | { kind: "done"; text: string } | { kind: "error"; text: string } | null
  >(null)

  /**
   * İlan bağlantısından metni alıp kutuya doldurur. Kutu düzenlenebilir
   * kalıyor: çekilen metinde gereksiz kısım varsa kullanıcı silebilir.
   */
  async function fetchPosting() {
    if (!postingUrl.trim()) return
    setPostingState({ kind: "loading" })
    try {
      const parsed = await fetchPostingFromUrl(postingUrl)
      if (!parsed.text) {
        setPostingState({ kind: "error", text: "İlanı alamadık." })
        return
      }
      if (postingBox.current) postingBox.current.value = parsed.text
      setPostingState({
        kind: "done",
        text: `${parsed.position ? `“${parsed.position}” ilanı` : "İlan metni"} aşağıya eklendi. Göndermeden önce göz atabilirsin.`,
      })
    } catch (error) {
      setPostingState({
        kind: "error",
        text:
          apiStatus(error) === null
            ? "Sunucuya ulaşamadık. Metni kopyalayıp yapıştırır mısın?"
            : await apiErrorMessage(error, "İlanı alamadık."),
      })
    }
  }
  const [resuming, setResuming] = useState(false)
  const resumeStarted = useRef(false)

  // Girişten dönüş: `?uyarla=<analiz>` varsa uyarlamayı başlat. Ref, React'in
  // geliştirme modunda efekti iki kez çalıştırmasına karşı: iki uyarlama
  // isteği gitmesin.
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const analysisId = urlParams.get("uyarla")
    if (analysisId && !resumeStarted.current) {
      resumeStarted.current = true
      setResuming(true)
      void adapt(analysisId)
      return
    }

    // Kalıcı sonuç adresi: `?analiz=<id>`. Sayfa yenilense de, panodan ya da
    // sağ alttaki bildirimden gelinse de sonuç buradan açılıyor (K3).
    const permanent = urlParams.get("analiz")
    if (permanent) {
      void loadResult(permanent)
      return
    }

    // Başka sayfaya geçip "Analize dön" ile gelindi: süren analiz kaldığı
    // yerden izleniyor, bitmiş ama görülmemiş sonuç gösteriliyor.
    const activeRecord = readActiveAnalysis()
    if (activeRecord?.status === "running") {
      setState({ status: "running", stage: activeRecord.stage })
      setBusy(true)
      setPollJobId(activeRecord.jobId)
    } else if (activeRecord?.status === "completed" && activeRecord.analysisId && !activeRecord.seen) {
      void loadResult(activeRecord.analysisId)
    } else if (activeRecord?.status === "failed" && !activeRecord.seen) {
      setError(activeRecord.error ?? "Analiz tamamlanamadı.")
      clearActiveAnalysis()
    }
    // adapt ve loadResult her çizimde yeniden tanımlanıyor; efekt yalnızca ilk açılışta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Süren analizin yoklaması. Sayfadan ayrılınca duruyor; izlemeyi aynı
  // sorgu anahtarıyla sağ alttaki bildirim devralıyor.
  const [pollJobId, setPollJobId] = useState<string | null>(null)
  const job = useAnalysisJob(pollJobId, 1000)
  const jobErrorStatus = apiStatus(job.error)
  useEffect(() => {
    if (!pollJobId) return
    if (jobErrorStatus !== null) {
      // İş artık yok (kuyruk temizlendi) ya da başkasına ait.
      setPollJobId(null)
      clearActiveAnalysis()
      setState(null)
      setError("Bu analizi artık bulamıyoruz. Yeni bir analiz başlatabilirsin.")
      setBusy(false)
      return
    }
    const body = job.data
    if (!body) return
    setState(body)
    handleResponse(pollJobId, body)

    if (body.status === "completed" || body.status === "failed") {
      setPollJobId(null)
      setBusy(false)
      // Kullanıcı sonucu bu sayfada görüyor: bildirim gösterilmesin.
      updateActiveAnalysis(pollJobId, { seen: true })
      // Adres kalıcı sonuca dönüyor; yenilenirse sonuç kaybolmaz (K3).
      if (body.status === "completed" && body.analysisId) {
        window.history.replaceState(null, "", resultPath(body.analysisId))
      }
    }
  }, [pollJobId, job.data, jobErrorStatus])

  async function loadResult(analysisId: string) {
    setState({ status: "running" })
    try {
      const parsed = await queryClient.fetchQuery({
        queryKey: analysisQueryKey(analysisId),
        queryFn: () => getAnalysis(analysisId),
      })
      setState(parsed)
      const activeRecord = readActiveAnalysis()
      if (activeRecord?.analysisId === analysisId) updateActiveAnalysis(activeRecord.jobId, { seen: true })
    } catch (error) {
      setState(null)
      setError(
        apiStatus(error) === null
          ? "Sonucu alamadık. Sayfayı yenileyip tekrar dener misin?"
          : "Bu analizi bulamadık. Yeni bir analiz başlatabilirsin.",
      )
    }
  }

  /** Uyarlamayı başlatır ve uyarlama ekranına geçer. */
  async function adapt(analysisId: string) {
    setBusy(true)
    let parsed: { error?: string; code?: string }
    try {
      const { adaptationId } = await startAdaptation(analysisId)
      router.push(`/adapt/${adaptationId}`)
      return
    } catch (error) {
      parsed = await apiErrorBody(error)
    }
    // Anonim kullanıcı uyarlama isteyince kayıt gerekiyor (spec §7). Hata
    // göstermek yerine doğrudan giriş ekranına alıyoruz: huninin tasarımı bu.
    // Dönüş adresi `?uyarla=` taşıyor: girişten sonra bu sayfa açılınca
    // uyarlama kendiliğinden başlıyor ve kullanıcı işine kaldığı yerden
    // devam ediyor. Analiz kimliği kayıtta değişmiyor, yalnızca sahibi
    // anonim kullanıcıdan yeni hesaba geçiyor (src/server/claimAnonymousData.ts).
    if (parsed.code === "registration_required") {
      router.push(loginPath(`/analyze?uyarla=${encodeURIComponent(analysisId)}`))
      return
    }
    setError(parsed.error ?? "Uyarlama başlatılamadı.")
    setBusy(false)
    setResuming(false)
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setError(null)
    setState(null)
    setBusy(true)

    try {
      const { jobId } = await startAnalysis(new FormData(form))
      // Çizelge hemen görünsün. Kayıt, kullanıcı başka sayfaya geçerse sağ
      // alttaki bildirimin izlemesi için.
      startActiveAnalysis(jobId)
      setState({ status: "running" })
      setPollJobId(jobId)
    } catch (error) {
      setError(
        apiStatus(error) === null
          ? "Sunucuya ulaşamadık. Bağlantını kontrol edip tekrar dener misin?"
          : await apiErrorMessage(error, "Analiz başlatılamadı."),
      )
      setBusy(false)
    }
  }

  function startOver() {
    setPollJobId(null)
    clearActiveAnalysis()
    window.history.replaceState(null, "", "/analyze")
    setState(null)
    setError(null)
    setBusy(false)
  }

  // Sonuç geldiğinde form gizleniyor: ekranda tek iş olsun.
  const hasResult = state?.status === "completed" && state.result
  const running = state?.status === "running"

  // Girişten dönüşte form bir an bile görünmesin; başarılıysa sayfa
  // uyarlama ekranına geçiyor, değilse hata ile birlikte form geri geliyor.
  if (resuming) {
    return (
      <div className="mx-auto max-w-md rounded-card border border-border bg-card p-10 text-center shadow-sm">
        <LoaderCircle className="mx-auto size-8 text-brand-blue motion-safe:animate-spin" aria-hidden />
        <h1 className="mt-5 text-2xl">Uyarlaman hazırlanıyor…</h1>
        <p className="mt-2 text-sm text-muted">Kaldığın yerden devam ediyoruz.</p>
      </div>
    )
  }

  if (hasResult && state.result) {
    return (
      <ScoreResult
        result={state.result}
        durationMs={state.durationMs}
        tokenUsage={state.tokenUsage}
        modelId={state.modelId}
        adapting={busy}
        error={error}
        onAdapt={state.analysisId ? () => adapt(state.analysisId!) : undefined}
        onYeniAnaliz={startOver}
      />
    )
  }

  if (running) {
    return (
      <div className="mx-auto max-w-2xl">
        <StageTimeline
          heading="Analizin hazırlanıyor"
          subtitle="Genelde bir dakika kadar sürüyor. Sayfadan ayrılma."
          stages={deriveStageStates(STAGES, state?.stage ?? null)}
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="CV'ni ilanla karşılaştır"
        description="CV'ni yükle, ilanı yapıştır. Uyumunu ve eksik anahtar kelimeleri hemen gör. Ücretsiz, kayıt gerekmez."
      />

      {(error || state?.status === "failed") && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-card border border-brand-red/30 bg-brand-red/5 p-4 text-sm"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-brand-red" aria-hidden />
          <p className="m-0 text-foreground">{error ?? state?.error}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <form onSubmit={onSubmit} className="rounded-card border border-border bg-card p-5 shadow-sm sm:p-7">
          <StepHeading number={1} heading="CV'n" hint="Başvuracağın CV'nin güncel hâli." />
          <ResumeUpload />

          <div className="my-7 h-px bg-border" />

          <StepHeading number={2} heading="İlan" hint="Bağlantıyı yapıştır ya da metni kutuya ekle." />
          <label htmlFor="ilanUrl" className="sr-only">
            İlan bağlantısı
          </label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                id="ilanUrl"
                type="url"
                inputMode="url"
                value={postingUrl}
                onChange={(e) => setPostingUrl(e.target.value)}
                onKeyDown={(e) => {
                  // Enter formu (analizi) göndermesin; bağlantıyı getirsin.
                  if (e.key === "Enter") {
                    e.preventDefault()
                    void fetchPosting()
                  }
                }}
                placeholder="https://www.kariyer.net/is-ilani/…"
                className={`${inputClass} pl-9`}
              />
            </div>
            <button
              type="button"
              onClick={() => void fetchPosting()}
              disabled={!postingUrl.trim() || postingState?.kind === "loading"}
              className="inline-flex shrink-0 items-center gap-2 rounded-button border border-border bg-card px-4 text-sm font-semibold transition-colors hover:border-foreground/25 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {postingState?.kind === "loading" && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />}
              {postingState?.kind === "loading" ? "Getiriliyor…" : "İlanı getir"}
            </button>
          </div>
          {postingState?.kind === "done" && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-brand-green dark:text-[#4ade80]">
              <FileCheck2 className="size-4" aria-hidden />
              {postingState.text}
            </p>
          )}
          {postingState?.kind === "error" && <p className="mt-2 text-sm text-brand-amber">{postingState.text}</p>}

          <label htmlFor="jobText" className="mt-4 mb-1.5 block text-sm font-medium">
            İlan metni
          </label>
          <textarea
            id="jobText"
            name="jobText"
            ref={postingBox}
            rows={10}
            required
            placeholder="İlanın tamamını yapıştır — gereksinimler bölümü dahil. Bağlantıyı yukarıya yapıştırırsan buraya kendiliğinden gelir."
            className={`${inputClass} resize-y leading-relaxed`}
          />

          <button
            type="submit"
            disabled={busy}
            className="group mt-6 flex w-full items-center justify-center gap-2 rounded-button bg-brand-blue px-6 py-3.5 font-semibold text-white shadow-[0_10px_24px_-12px_rgb(43_78_255/0.8)] transition hover:-translate-y-px hover:bg-[#2442e0] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <>
                <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />
                Gönderiliyor…
              </>
            ) : (
              <>
                Skorumu gör
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </>
            )}
          </button>
        </form>

        <aside className="space-y-4">
          <div className="rounded-card border border-border bg-card p-5 shadow-sm">
            <p className="m-0 text-sm font-semibold">Ne göreceksin</p>
            <ul className="mt-3 list-none space-y-3 p-0 text-sm">
              {[
                { Icon: Gauge, b: "ATS uyum skoru", m: "CV'nin bu ilana ne kadar uyduğu." },
                { Icon: SearchCheck, b: "Eksik anahtar kelimeler", m: "Her gereksinim, CV'ndeki kanıtıyla." },
                { Icon: FileCheck2, b: "Biçim kontrolü", m: "ATS CV'ni doğru okuyabiliyor mu." },
              ].map(({ Icon, b, m }) => (
                <li key={b} className="flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-button bg-brand-blue/10 text-brand-blue dark:text-[#8ea2ff]">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span>
                    <span className="block font-medium">{b}</span>
                    <span className="text-muted">{m}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-3 rounded-card border border-border bg-card/60 p-4 text-sm text-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-green dark:text-[#4ade80]" aria-hidden />
            <p className="m-0">
              CV&apos;n izinsiz kimseyle paylaşılmaz.{" "}
              <Link href="/privacy" className="font-medium text-foreground underline underline-offset-2">
                KVKK metni
              </Link>
            </p>
          </div>
          {state?.status === "failed" && (
            <button
              onClick={startOver}
              className="inline-flex w-full items-center justify-center gap-2 rounded-button border border-border bg-card px-4 py-2.5 text-sm font-semibold"
            >
              <RotateCcw className="size-4" aria-hidden /> Baştan başla
            </button>
          )}
        </aside>
      </div>
    </div>
  )
}
