"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
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
import { ResumePicker } from "@/features/analysis/components/ResumePicker"
import { resumesQueryKey, useLibrary } from "@/features/resumes/api"
import { initialResumeId, isLibraryFull } from "@/features/resumes/library"
import { LIBRARY_MAX } from "@/features/resumes/schema"
import { useSession } from "@/lib/authClient"
import { ScoreResult } from "@/features/analysis/components/ScoreResult"
import {
  analysisQueryKey,
  fetchPostingFromUrl,
  getAnalysis,
  startAnalysis,
  useAnalysisJob,
  type AnalysisResponse,
} from "@/features/analysis/api"
import { analyzeFormSchema, jobUrlSchema, type AnalyzeFormValues } from "@/features/analysis/schema"
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
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    watch,
    clearErrors,
    formState: { errors },
  } = useForm<AnalyzeFormValues>({
    resolver: zodResolver(analyzeFormSchema),
    defaultValues: { jobText: "", postingUrl: "", saveToLibrary: false },
  })
  const resumeFile = watch("cv") as File | undefined
  const postingUrl = watch("postingUrl") ?? ""

  // Kayıtlı kullanıcının CV kütüphanesi (DOG-50). Anonimde istek gitmiyor.
  const { data: sessionData } = useSession()
  const registered = !!sessionData?.user && !(sessionData.user as { isAnonymous?: boolean | null }).isAnonymous
  const library = useLibrary(registered)
  const resumes = library.data ?? []
  const libraryFull = isLibraryFull(resumes)
  const selectedResumeId = watch("resumeId") ?? null
  const [libraryNote, setLibraryNote] = useState<string | null>(null)

  // Kütüphane gelince varsayılan CV ön seçili; kullanıcı kendisi seçtiyse dokunma.
  const [pickedMode, setPickedMode] = useState(false)
  useEffect(() => {
    if (pickedMode || resumes.length === 0) return
    const initial = initialResumeId(resumes)
    if (initial) setValue("resumeId", initial)
  }, [resumes, pickedMode, setValue])
  const [postingState, setPostingState] = useState<
    { kind: "loading" } | { kind: "done"; text: string } | { kind: "error"; text: string } | null
  >(null)

  /**
   * İlan bağlantısından metni alıp kutuya doldurur. Kutu düzenlenebilir
   * kalıyor: çekilen metinde gereksiz kısım varsa kullanıcı silebilir.
   */
  async function fetchPosting() {
    const link = jobUrlSchema.safeParse({ url: getValues("postingUrl") })
    if (!link.success) return
    setPostingState({ kind: "loading" })
    try {
      const parsed = await fetchPostingFromUrl(link.data.url)
      if (!parsed.text) {
        setPostingState({ kind: "error", text: "İlanı alamadık." })
        return
      }
      setValue("jobText", parsed.text, { shouldValidate: true })
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

  /** Şemadan geçmiş değerlerle çağrılıyor; sunucu aynı şemayla bir kez daha doğruluyor. */
  async function onSubmit(values: AnalyzeFormValues) {
    setError(null)
    setState(null)
    setBusy(true)
    setLibraryNote(null)

    const body = new FormData()
    if (values.resumeId) {
      body.append("resumeId", values.resumeId)
    } else {
      body.append("cv", values.cv as File)
      if (registered && values.saveToLibrary) body.append("saveToLibrary", "true")
    }
    body.append("jobText", values.jobText)

    try {
      const { jobId, savedToLibrary } = await startAnalysis(body)
      if (savedToLibrary === false) {
        setLibraryNote(`Kütüphanende ${LIBRARY_MAX} CV olduğu için bu dosyayı kaydetmedik; analiz yine başladı.`)
      }
      if (savedToLibrary) void queryClient.invalidateQueries({ queryKey: resumesQueryKey })
      // Çizelge hemen görünsün. Kayıt, kullanıcı başka sayfaya geçerse sağ
      // alttaki bildirimin izlemesi için.
      startActiveAnalysis(jobId)
      setState({ status: "running" })
      setPollJobId(jobId)
    } catch (error) {
      // Seçili CV başka sekmede kaldırılmış olabilir (K-35: 404).
      if (values.resumeId && apiStatus(error) === 404) {
        setError("Bu CV artık kütüphanende değil. Listeyi yeniledik; başka bir CV seçebilirsin.")
        setPickedMode(false)
        setValue("resumeId", undefined)
        await queryClient.invalidateQueries({ queryKey: resumesQueryKey })
        setBusy(false)
        return
      }
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
        {libraryNote && <p className="mb-4 text-sm text-muted">{libraryNote}</p>}
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
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="rounded-card border border-border bg-card p-5 shadow-sm sm:p-7">
          <StepHeading number={1} heading="CV'n" hint="Başvuracağın CV'nin güncel hâli." />
          {registered && resumes.length > 0 && (
            <ResumePicker
              resumes={resumes}
              selectedId={selectedResumeId}
              onSelect={(id) => {
                setPickedMode(true)
                setValue("resumeId", id, { shouldValidate: !!errors.cv })
                setValue("cv", undefined)
              }}
              onUploadNew={() => {
                setPickedMode(true)
                setValue("resumeId", undefined)
              }}
            />
          )}
          {(!registered || resumes.length === 0 || selectedResumeId === null) && (
            <div className={registered && resumes.length > 0 ? "mt-3" : undefined}>
              <ResumeUpload
                value={resumeFile ?? null}
                error={errors.cv?.message}
                onChange={(file) => {
                  // Kaldırınca hata gösterilmesin; eksik dosyayı gönderimde şema söylüyor.
                  setValue("cv", (file ?? undefined) as File | undefined, { shouldValidate: file !== null })
                  if (!file) clearErrors("cv")
                }}
              />
              {registered &&
                (libraryFull ? (
                  <p className="mt-2 text-sm text-muted">Kütüphanende {LIBRARY_MAX} CV var; bu dosya kaydedilmeyecek.</p>
                ) : (
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <input type="checkbox" {...register("saveToLibrary")} className="size-4 accent-brand-blue" />
                    Kütüphaneme kaydet, sonraki ilanlarda seçeyim
                  </label>
                ))}
            </div>
          )}
          {registered && resumes.length > 0 && selectedResumeId !== null && errors.cv && (
            <p role="alert" className="mt-2 text-sm text-brand-amber">
              {errors.cv.message}
            </p>
          )}

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
                {...register("postingUrl")}
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
            {...register("jobText")}
            rows={10}
            aria-invalid={errors.jobText ? true : undefined}
            aria-describedby={errors.jobText ? "jobText-error" : undefined}
            placeholder="İlanın tamamını yapıştır — gereksinimler bölümü dahil. Bağlantıyı yukarıya yapıştırırsan buraya kendiliğinden gelir."
            className={`${inputClass} resize-y leading-relaxed`}
          />
          {errors.jobText && (
            <p id="jobText-error" role="alert" className="mt-2 text-sm text-brand-amber">
              {errors.jobText.message}
            </p>
          )}

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
              CV&apos;n analiz için OpenAI&apos;a gönderilir; satılmaz, model eğitiminde kullanılmaz.{" "}
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
