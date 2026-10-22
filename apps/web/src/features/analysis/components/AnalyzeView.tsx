"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { applicationsQueryKey } from "@/features/applications/api"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  ArrowRight,
  ClipboardPaste,
  Compass,
  Eye,
  FileCheck2,
  Gauge,
  Info,
  Link2,
  LoaderCircle,
  RotateCcw,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  SquareKanban,
  TriangleAlert,
  Upload,
} from "lucide-react"
import { AppPage } from "@/components/layout/app-shell/AppPage"
import { PageActions } from "@/components/layout/app-shell/PageActions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { loginPath } from "@/lib/returnPath"
import { plansPath } from "@/features/billing/paywall"
import { billingStatusKey, useBillingStatus } from "@/features/billing/api"
import { adaptHint } from "@/features/billing/format"
import {
  startActiveAnalysis,
  updateActiveAnalysis,
  readActiveAnalysis,
  clearActiveAnalysis,
  handleResponse,
} from "@/features/analysis/activeAnalysis"
import { resultPath, resumeRequest } from "@/features/analysis/paths"
import { SAMPLE_POSTINGS } from "@/features/analysis/samplePostings"
import {
  browserSendMessage,
  createAutoSubmitGate,
  extensionIdsFromEnv,
  readExtensionHandoff,
  shouldAutoSubmit,
  verifyHandoff,
  type ExtensionHandoff,
} from "@/features/analysis/extensionHandoff"

/** Jetonu doğrulayabilecek eklentiler (geliştirme ve mağaza kimlikleri, DOG-71). */
const EXTENSION_IDS = extensionIdsFromEnv(process.env.NEXT_PUBLIC_EXTENSION_IDS)
import { AnalysisWaiting, type AnalysisInput } from "@/features/analysis/components/AnalysisWaiting"
import { previewLines } from "@/components/waiting/text"
import { ResumeUpload } from "@/features/analysis/components/ResumeUpload"
import { ResumePicker } from "@/features/analysis/components/ResumePicker"
import { resumesQueryKey, useLibrary } from "@/features/resumes/api"
import { isLibraryFull, preselectResumeId, resumeTitle } from "@/features/resumes/library"
import { LIBRARY_MAX } from "@/features/resumes/schema"
import { useSession } from "@/lib/authClient"
import { ScoreResult } from "@/features/analysis/components/ScoreResult"
import {
  analysisQueryKey,
  fetchPostingFromUrl,
  getAnalysis,
  updatePosition,
  updateRequirement,
  type RequirementAction,
  startAnalysis,
  useAnalysisJob,
  type AnalysisResponse,
} from "@/features/analysis/api"
import { analyzeFormSchema, jobUrlSchema, type AnalyzeFormValues } from "@/features/analysis/schema"
import { startAdaptation } from "@/features/adaptation/api"
import { apiErrorBody, apiErrorMessage, apiStatus } from "@/lib/api"


type PostingTab = "text" | "link" | "sample"
/** CV'nin nasıl verileceği: dosya ya da yapıştırılan metin (DOG-101). */
type ResumeInput = "file" | "text"

function StepHeading({ number, heading, hint }: { number: number; heading: string; hint: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {number}
      </span>
      <div>
        <p className="m-0 font-semibold">{heading}</p>
        <p className="m-0 text-sm text-muted-foreground">{hint}</p>
      </div>
    </div>
  )
}

export function AnalyzeView() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [state, setState] = useState<AnalysisResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Aynı ilan daha önce analiz edilmiş (DOG-98); "yine de" için son değerler.
  const [duplicate, setDuplicate] = useState<{ analysisId: string; createdAt: string; values: AnalyzeFormValues } | null>(null)
  const [busy, setBusy] = useState(false)
  const [opening, setOpening] = useState(false)
  // Bekleme ekranına taşınan form bilgisi ve başlangıç anı; yenilemede yalnızca an.
  const [waiting, setWaiting] = useState<{ input: AnalysisInput | null; startedAt: number | null }>({ input: null, startedAt: null })
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
  const saveToLibrary = watch("saveToLibrary") ?? false
  const [resumeInput, setResumeInput] = useState<ResumeInput>("file")
  /** Dosya ile metin arasında geçiş; diğerinin değeri formdan çıkıyor (şema tam birini istiyor). */
  function switchResumeInput(next: ResumeInput) {
    setResumeInput(next)
    clearErrors(["cv", "cvText"])
    if (next === "text") {
      setPickedMode(true)
      setValue("cv", undefined)
      setValue("cvText", getValues("cvText") ?? "")
    } else {
      setValue("cvText", undefined)
    }
  }
  // İlanın nasıl ekleneceği (DOG-146). Genel bakışın "Örnek ilanla dene"si
  // #ornek-ilanlar ile örnek sekmesini açıyor.
  const [postingTab, setPostingTab] = useState<PostingTab>("text")
  useEffect(() => {
    if (window.location.hash === "#ornek-ilanlar") setPostingTab("sample")
  }, [])
  // İş ara'daki "İlanı getir ve analiz et" (DOG-150): `?ilan=<bağlantı>`.
  // Bağlantı kutuya giriyor, ilan bir kez kendiliğinden getiriliyor.
  const postingFromSearch = useRef(false)
  useEffect(() => {
    if (postingFromSearch.current) return
    const url = new URL(window.location.href)
    const link = url.searchParams.get("ilan")
    if (!link) return
    postingFromSearch.current = true
    url.searchParams.delete("ilan")
    window.history.replaceState(null, "", url.pathname + url.search + url.hash)
    setValue("postingUrl", link)
    setPostingTab("link")
    void fetchPosting()
    // fetchPosting her çizimde yeniden tanımlanıyor; efekt yalnızca ilk açılışta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Kayıtlı kullanıcının CV kütüphanesi (DOG-50). Anonimde istek gitmiyor.
  const { data: sessionData } = useSession()
  // İlk çizim sunucuyla aynı olsun: sunucu oturumu bilmiyor. İstemcide oturum
  // hazır gelince formun CV bölümü değişiyor ve sonraki Radix kimlikleri
  // (sekmeler) kayıyordu (DOG-146).
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  const registered =
    hydrated && !!sessionData?.user && !(sessionData.user as { isAnonymous?: boolean | null }).isAnonymous
  const library = useLibrary(registered)
  // Uyarlamadan önce neyin harcanacağı (DOG-81); anonimde uyarlama zaten girişe gidiyor.
  const billing = useBillingStatus({ enabled: registered })
  const adaptNote = registered && billing.data ? adaptHint(billing.data) : null
  const resumes = library.data ?? []
  const libraryFull = isLibraryFull(resumes)
  const selectedResumeId = watch("resumeId") ?? null
  const [libraryNote, setLibraryNote] = useState<string | null>(null)

  // CV'lerim'deki "Bu CV'yle analiz et" (DOG-149): `?cv=<id>`. Adresten
  // siliniyor; kütüphane gelince o CV seçiliyor.
  const requestedResume = useRef<string | null>(null)
  useEffect(() => {
    const url = new URL(window.location.href)
    const id = url.searchParams.get("cv")
    if (!id) return
    requestedResume.current = id
    url.searchParams.delete("cv")
    window.history.replaceState(null, "", url.pathname + url.search + url.hash)
  }, [])

  // Kütüphane gelince varsayılan CV ön seçili; kullanıcı seçtiyse ya da dosya
  // yüklediyse dokunulmuyor (kurallar preselectResumeId'de, testli).
  const [pickedMode, setPickedMode] = useState(false)
  useEffect(() => {
    const requested = requestedResume.current
    if (requested && resumes.some((r) => r.id === requested)) {
      requestedResume.current = null
      setPickedMode(true)
      setValue("resumeId", requested)
      return
    }
    const next = preselectResumeId({
      resumes,
      current: getValues("resumeId"),
      hasFile: getValues("cv") !== undefined || getValues("cvText") !== undefined,
      picked: pickedMode,
    })
    if (next !== undefined) setValue("resumeId", next ?? undefined)
  }, [resumes, pickedMode, getValues, setValue])

  // Tarayıcı eklentisinden gelen ilan (DOG-70): formu doldur, # kısmını sil.
  const [handoff, setHandoff] = useState<ExtensionHandoff | null>(null)
  const [handoffVerified, setHandoffVerified] = useState(false)
  const autoSubmitGate = useRef(createAutoSubmitGate())
  useEffect(() => {
    const incoming = readExtensionHandoff(window.location.hash, window.location.search)
    if (!incoming) return
    setValue("jobText", incoming.jobText, { shouldValidate: true })
    if (incoming.sourceUrl) setValue("postingUrl", incoming.sourceUrl)
    // Geri tuşunda ya da yenilemede form yeniden dolmasın.
    window.history.replaceState(null, "", window.location.pathname + window.location.search)
    setHandoff(incoming)
    // Bağlantıyı eklenti mi açtı? Jeton tek kullanımlık; # silindiği için
    // Strict Mode'un ikinci çalıştırması buraya gelmiyor (DOG-71).
    void verifyHandoff(incoming.token, EXTENSION_IDS, browserSendMessage()).then(setHandoffVerified)
  }, [setValue])

  // Kayıtlı ve varsayılan CV'si ön seçili kullanıcıda analiz bir kez kendiliğinden başlar.
  useEffect(() => {
    if (!handoff || busy) return
    if (
      !shouldAutoSubmit({
        registered,
        resumeId: selectedResumeId ?? undefined,
        jobText: handoff.jobText,
        verified: handoffVerified,
      })
    )
      return
    if (!autoSubmitGate.current()) return
    void handleSubmit(onSubmit)()
    // onSubmit her çizimde yeniden tanımlanıyor; kapı tek gönderimi garanti ediyor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoff, handoffVerified, registered, selectedResumeId, busy, handleSubmit])
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
      setPostingTab("text")
      setPostingState({
        kind: "done",
        text: `${parsed.position ? `“${parsed.position}” ilanı` : "İlan metni"} eklendi. Göndermeden önce göz atabilirsin.`,
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
    // Adres aşağıda değiştiği için ikinci çalışma `?analiz=` görüp sonucu da
    // yüklemeye kalkmasın.
    if (resumeStarted.current) return
    const urlParams = new URLSearchParams(window.location.search)
    const resume = resumeRequest(window.location.search)
    if (resume) {
      resumeStarted.current = true
      window.history.replaceState(null, "", resume.address)
      setResuming(true)
      void adapt(resume.analysisId)
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
      setWaiting({ input: null, startedAt: activeRecord.startedAt })
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
    // Kayıtlı sonucu açmak bekleme ekranı değil: analiz zaten bitmiş.
    setOpening(true)
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
    } finally {
      setOpening(false)
    }
  }

  /** Gereksinimi işaretler ya da şartını düzeltir (DOG-90). */
  async function changeRequirement(analysisId: string, index: number, change: RequirementAction) {
    try {
      const { result } = await updateRequirement(analysisId, index, change)
      setState((s) => (s ? { ...s, result } : s))
      queryClient.setQueryData<AnalysisResponse>(analysisQueryKey(analysisId), (d) => (d ? { ...d, result } : d))
      // Pano skoru değişti.
      void queryClient.invalidateQueries({ queryKey: applicationsQueryKey })
    } catch {
      setError(change.action === "correct" ? "Yeniden hesaplayamadık. Birazdan tekrar dener misin?" : "İşaretleyemedik. Birazdan tekrar dener misin?")
      throw new Error("requirement change failed")
    }
  }

  /** İlan unvanını düzeltir (DOG-134); hata mesajıyla reddeder, form gösteriyor. */
  async function changePosition(analysisId: string, position: string | null) {
    try {
      const { result } = await updatePosition(analysisId, position)
      setState((s) => (s ? { ...s, result } : s))
      queryClient.setQueryData<AnalysisResponse>(analysisQueryKey(analysisId), (d) => (d ? { ...d, result } : d))
      void queryClient.invalidateQueries({ queryKey: applicationsQueryKey })
    } catch (error) {
      throw new Error(await apiErrorMessage(error, "Yeniden hesaplayamadık. Birazdan tekrar dener misin?"))
    }
  }

  /** Uyarlamayı başlatır ve uyarlama ekranına geçer. */
  async function adapt(analysisId: string) {
    setBusy(true)
    let parsed: { error?: string; code?: string }
    try {
      const { adaptationId } = await startAdaptation(analysisId)
      // Hak harcandı: üst menüdeki rozet ve Hesabım güncellensin.
      void queryClient.invalidateQueries({ queryKey: billingStatusKey })
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
    // Ücretsiz hak bitti (DOG-34): paket ekranına, ödemeden sonra uyarlamaya dönüş.
    if (parsed.code === "payment_required") {
      router.push(plansPath(`/analyze?uyarla=${encodeURIComponent(analysisId)}`))
      return
    }
    setError(parsed.error ?? "Uyarlama başlatılamadı.")
    setBusy(false)
    setResuming(false)
  }

  /** Şemadan geçmiş değerlerle çağrılıyor; sunucu aynı şemayla bir kez daha doğruluyor. */
  /** Form gönderimi. handleSubmit ikinci argüman olarak olayı geçtiği için ayrı. */
  function onSubmit(values: AnalyzeFormValues) {
    return submitAnalysis(values, false)
  }

  async function submitAnalysis(values: AnalyzeFormValues, allowDuplicate: boolean) {
    setError(null)
    setDuplicate(null)
    setState(null)
    setBusy(true)
    setLibraryNote(null)

    const body = new FormData()
    if (values.resumeId) {
      body.append("resumeId", values.resumeId)
    } else if (values.cvText !== undefined) {
      body.append("cvText", values.cvText)
      if (registered && values.saveToLibrary) body.append("saveToLibrary", "true")
    } else {
      body.append("cv", values.cv as File)
      if (registered && values.saveToLibrary) body.append("saveToLibrary", "true")
    }
    body.append("jobText", values.jobText)
    // Platforma özel ipucu için (DOG-95); sunucu sorgu kısmını atıyor.
    if (values.postingUrl?.trim()) body.append("postingUrl", values.postingUrl.trim())
    if (allowDuplicate) body.append("allowDuplicate", "true")

    try {
      const { jobId, savedToLibrary } = await startAnalysis(body)
      if (savedToLibrary === false) {
        setLibraryNote(`Kütüphanende ${LIBRARY_MAX} CV olduğu için bu dosyayı kaydetmedik; analiz yine başladı.`)
      }
      if (savedToLibrary) void queryClient.invalidateQueries({ queryKey: resumesQueryKey })
      // Çizelge hemen görünsün. Kayıt, kullanıcı başka sayfaya geçerse sağ
      // alttaki bildirimin izlemesi için.
      startActiveAnalysis(jobId)
      setWaiting({ input: waitingInput(values), startedAt: Date.now() })
      setState({ status: "running" })
      setPollJobId(jobId)
    } catch (error) {
      const parsed = (await apiErrorBody(error)) as { code?: string; analysisId?: string; createdAt?: string }
      if (parsed.code === "duplicate_posting" && parsed.analysisId && parsed.createdAt) {
        setDuplicate({ analysisId: parsed.analysisId, createdAt: parsed.createdAt, values })
        setBusy(false)
        return
      }
      // Seçili CV başka sekmede kaldırılmış olabilir (K-35: 404).
      if (values.resumeId && apiStatus(error) === 404) {
        setError("Bu CV artık kütüphanende değil. Listeyi yeniledik; başka bir CV seçebilirsin.")
        setValue("resumeId", undefined)
        // Önce liste yenilensin; yoksa ön seçim eski listeden kaldırılan CV'yi yeniden seçebilir.
        await queryClient.invalidateQueries({ queryKey: resumesQueryKey })
        setPickedMode(false)
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

  /** Gönderilen formdan bekleme ekranının malzemesi; CV dosyası tarayıcıda okunmuyor. */
  function waitingInput(values: AnalyzeFormValues): AnalysisInput {
    const library = values.resumeId ? resumes.find((r) => r.id === values.resumeId) : undefined
    return {
      resumeLabel: library ? resumeTitle(library) : values.cvText !== undefined ? "Yapıştırılan CV" : ((values.cv as File | undefined)?.name ?? null),
      resumeLines: values.cvText !== undefined ? previewLines(values.cvText) : null,
      postingLines: previewLines(values.jobText, 12),
    }
  }

  function startOver() {
    // Yeni analizde CV seçimi baştan: az önce kütüphaneye kaydedilen dosya
    // artık bir kart olarak seçilebiliyor.
    setValue("cv", undefined)
    setValue("cvText", undefined)
    setResumeInput("file")
    setValue("resumeId", undefined)
    setPickedMode(false)
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
      <AppPage width="narrow">
        <Card className="mx-auto max-w-md items-center py-10 text-center">
          <CardContent className="flex flex-col items-center">
            <LoaderCircle className="size-8 text-primary motion-safe:animate-spin" aria-hidden />
            <h1 className="m-0 mt-5 text-xl font-semibold">Uyarlaman hazırlanıyor…</h1>
            <p className="m-0 mt-2 text-sm text-muted-foreground">Kaldığın yerden devam ediyoruz.</p>
          </CardContent>
        </Card>
      </AppPage>
    )
  }

  if (hasResult && state.result) {
    return (
      <AppPage>
        <PageActions>
          <Button variant="outline" size="sm" onClick={startOver} aria-label="Yeni analiz">
            <RotateCcw aria-hidden />
            <span className="hidden sm:inline">Yeni analiz</span>
          </Button>
          {/* Her analiz panoda bir kart; anonimin panosu yok. */}
          {registered && state.analysisId && (
            <Button asChild size="sm">
              <Link href={`/applications/${state.analysisId}`}>
                <SquareKanban aria-hidden />
                <span className="hidden sm:inline">Başvuruyu aç</span>
                <span className="sr-only sm:hidden">Başvuruyu aç</span>
              </Link>
            </Button>
          )}
        </PageActions>
        <ScoreResult
          result={state.result}
          platform={state.platform}
          sourceWarning={state.sourceWarning}
          postingText={state.postingText}
          durationMs={state.durationMs}
          tokenUsage={state.tokenUsage}
          modelId={state.modelId}
          adapting={busy}
          error={error}
          onAdapt={state.analysisId ? () => adapt(state.analysisId!) : undefined}
          adaptNote={adaptNote}
          onRequirementChange={state.analysisId ? (index, change) => changeRequirement(state.analysisId!, index, change) : undefined}
          onPositionChange={state.analysisId ? (position) => changePosition(state.analysisId!, position) : undefined}
        />
      </AppPage>
    )
  }

  if (opening) {
    return (
      <AppPage width="narrow">
        <Card className="mx-auto max-w-md items-center py-10 text-center" role="status">
          <CardContent className="flex flex-col items-center">
            <LoaderCircle className="size-7 text-primary motion-safe:animate-spin" aria-hidden />
            <p className="m-0 mt-4 font-medium">Sonuç açılıyor…</p>
          </CardContent>
        </Card>
      </AppPage>
    )
  }

  if (running) {
    return (
      <AppPage width="narrow">
        {libraryNote && <p className="m-0 mb-4 text-sm text-muted-foreground">{libraryNote}</p>}
        <AnalysisWaiting stage={state?.stage ?? null} startedAt={waiting.startedAt} input={waiting.input} />
      </AppPage>
    )
  }

  const jobError = errors.jobText?.message
  const cvTextError = errors.cvText?.message
  return (
    <AppPage
      title="CV'ni ilanla karşılaştır"
      description="CV'ni yükle, ilanı ekle. Uyumunu ve eksik anahtar kelimeleri hemen gör."
    >
      {duplicate && (
        <Alert role="status" className="mb-6 border-primary/30 bg-primary/5">
          <Info className="text-primary" aria-hidden />
          <AlertTitle>
            Bu ilanı {new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long" }).format(new Date(duplicate.createdAt))}{" "}
            tarihinde analiz ettin.
          </AlertTitle>
          <AlertDescription>
            <p className="m-0">Önceki sonuç panonda duruyor; yeniden analiz panoya ikinci bir kart ekler.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href={resultPath(duplicate.analysisId)}>Önceki sonucu aç</Link>
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void submitAnalysis(duplicate.values, true)}>
                Yine de yeniden analiz et
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {(error || state?.status === "failed") && (
        <Alert variant="destructive" className="mb-6 border-destructive/30 bg-destructive/5">
          <TriangleAlert aria-hidden />
          <AlertDescription className="text-foreground">
            <p className="m-0">{error ?? state?.error}</p>
            {state?.status === "failed" && (
              <Button type="button" variant="outline" size="sm" onClick={startOver} className="mt-2">
                <RotateCcw aria-hidden /> Baştan başla
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card className="py-0 shadow-xs">
          <form
            onSubmit={handleSubmit(onSubmit, (invalid) => {
              // Hata gizli bir sekmede kalmasın.
              if (invalid.jobText) setPostingTab("text")
            })}
            noValidate
            className="p-5 sm:p-7"
          >
            <StepHeading number={1} heading="CV'n" hint="Başvuracağın CV'nin güncel hâli." />
            {registered && resumes.length > 0 && (
              <ResumePicker
                resumes={resumes}
                selectedId={selectedResumeId}
                onSelect={(id) => {
                  setPickedMode(true)
                  setValue("resumeId", id, { shouldValidate: !!errors.cv })
                  setValue("cv", undefined)
                  setValue("cvText", undefined)
                  setResumeInput("file")
                }}
                onUploadNew={() => {
                  setPickedMode(true)
                  setValue("resumeId", undefined)
                }}
              />
            )}
            {(!registered || resumes.length === 0 || selectedResumeId === null) && (
              <div className={registered && resumes.length > 0 ? "mt-3" : undefined}>
                <Tabs value={resumeInput} onValueChange={(v) => switchResumeInput(v as ResumeInput)} className="gap-3">
                  <TabsList className="w-full sm:w-fit">
                    <TabsTrigger value="file">
                      <Upload aria-hidden /> Dosya
                    </TabsTrigger>
                    <TabsTrigger value="text">
                      <ClipboardPaste aria-hidden /> Metni yapıştır
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="file">
                    <ResumeUpload
                      value={resumeFile ?? null}
                      error={errors.cv?.message}
                      onChange={(file) => {
                        // Dosya seçen kullanıcının seçimi korunuyor: kütüphane sonradan
                        // yenilense de varsayılan CV dosyanın yerine geçmiyor.
                        if (file) setPickedMode(true)
                        // Kaldırınca hata gösterilmesin; eksik dosyayı gönderimde şema söylüyor.
                        setValue("cv", (file ?? undefined) as File | undefined, { shouldValidate: file !== null })
                        if (!file) clearErrors("cv")
                      }}
                    />
                  </TabsContent>
                  <TabsContent value="text">
                    {/* Dosyası elinde olmayan ya da telefondan gelen için (DOG-101). */}
                    <Label htmlFor="cvText" className="sr-only">
                      CV metni
                    </Label>
                    <Textarea
                      id="cvText"
                      {...register("cvText")}
                      rows={10}
                      aria-invalid={cvTextError ? true : undefined}
                      aria-describedby={cvTextError ? "cvText-error" : "cvText-hint"}
                      placeholder="CV'nin tamamını yapıştır: iletişim, deneyim, eğitim ve beceriler."
                      className="min-h-56 resize-y leading-relaxed"
                    />
                    {cvTextError ? (
                      <p id="cvText-error" role="alert" className="m-0 mt-2 text-sm text-brand-amber">
                        {cvTextError}
                      </p>
                    ) : (
                      <p id="cvText-hint" className="m-0 mt-2 text-xs text-muted-foreground">
                        Uyum skoru ve eksikler metinden çıkıyor. Biçim kontrolü dosyanın kendisine baktığı için metinde yapılmıyor.
                      </p>
                    )}
                  </TabsContent>
                </Tabs>
                {registered &&
                  (libraryFull ? (
                    <p className="m-0 mt-2 text-sm text-muted-foreground">Kütüphanende {LIBRARY_MAX} CV var; bu dosya kaydedilmeyecek.</p>
                  ) : (
                    <Label className="mt-3 flex items-center gap-2 font-normal">
                      <Checkbox
                        checked={saveToLibrary}
                        onCheckedChange={(v) => setValue("saveToLibrary", v === true)}
                      />
                      Kütüphaneme kaydet, sonraki ilanlarda seçeyim
                    </Label>
                  ))}
              </div>
            )}
            {registered && resumes.length > 0 && selectedResumeId !== null && errors.cv && (
              <p role="alert" className="m-0 mt-2 text-sm text-brand-amber">
                {errors.cv.message}
              </p>
            )}

            <Separator className="my-7" />

            <StepHeading number={2} heading="İlan" hint="Metni yapıştır, bağlantıdan getir ya da örnek bir ilanla dene." />
            <Tabs id="ornek-ilanlar" value={postingTab} onValueChange={(v) => setPostingTab(v as PostingTab)} className="scroll-mt-20 gap-3">
              <TabsList className="w-full sm:w-fit">
                <TabsTrigger value="text">
                  <ClipboardPaste aria-hidden /> Metin
                </TabsTrigger>
                <TabsTrigger value="link">
                  <Link2 aria-hidden /> Bağlantı
                </TabsTrigger>
                <TabsTrigger value="sample">
                  <Sparkles aria-hidden /> Örnek ilan
                </TabsTrigger>
              </TabsList>

              {/* Kutu sekme değişince de yerinde kalsın; RHF değeri ve
                  kullanıcının imleci kaybolmasın. */}
              <TabsContent value="text" forceMount className="data-[state=inactive]:hidden">
                <Label htmlFor="jobText" className="sr-only">
                  İlan metni
                </Label>
                <Textarea
                  id="jobText"
                  {...register("jobText")}
                  rows={10}
                  aria-invalid={jobError ? true : undefined}
                  aria-describedby={jobError ? "jobText-error" : undefined}
                  placeholder="İlanın tamamını yapıştır, gereksinimler bölümü dahil."
                  className="min-h-56 resize-y leading-relaxed"
                />
              </TabsContent>

              <TabsContent value="link">
                <Label htmlFor="ilanUrl" className="sr-only">
                  İlan bağlantısı
                </Label>
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input
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
                      className="pl-9"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void fetchPosting()}
                    disabled={!postingUrl.trim() || postingState?.kind === "loading"}
                  >
                    {postingState?.kind === "loading" && <LoaderCircle className="motion-safe:animate-spin" aria-hidden />}
                    {postingState?.kind === "loading" ? "Getiriliyor…" : "İlanı getir"}
                  </Button>
                </div>
                <p className="m-0 mt-2 text-xs text-muted-foreground">
                  Kariyer.net, LinkedIn ve şirketlerin kariyer sayfaları. Getirilen metni göndermeden önce düzenleyebilirsin.
                </p>
              </TabsContent>

              <TabsContent value="sample">
                {/* Elinde ilan olmayan ilk denemeyi engellemesin (DOG-101). */}
                <p className="m-0 mb-2 text-sm text-muted-foreground">Kurgusal ilanlar; gerçek bir şirkete ait değil.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SAMPLE_POSTINGS.map((sample) => (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => {
                        setValue("jobText", sample.text, { shouldValidate: true })
                        setPostingState({ kind: "done", text: "Örnek ilan eklendi; kurgusal bir ilan, gerçek bir şirkete ait değil." })
                        setPostingTab("text")
                      }}
                      className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3.5 py-3 text-left text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {sample.label}
                      <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                    </button>
                  ))}
                </div>
              </TabsContent>
            </Tabs>

            {postingState?.kind === "done" && (
              <p className="m-0 mt-2 flex items-center gap-1.5 text-sm text-brand-green dark:text-[#4ade80]">
                <FileCheck2 className="size-4 shrink-0" aria-hidden />
                {postingState.text}
              </p>
            )}
            {postingState?.kind === "error" && <p className="m-0 mt-2 text-sm text-brand-amber">{postingState.text}</p>}
            {jobError && (
              <p id="jobText-error" role="alert" className="m-0 mt-2 text-sm text-brand-amber">
                {jobError}
              </p>
            )}

            <Button type="submit" size="lg" disabled={busy} className="group mt-6 h-12 w-full text-base">
              {busy ? (
                <>
                  <LoaderCircle className="motion-safe:animate-spin" aria-hidden />
                  Gönderiliyor…
                </>
              ) : (
                <>
                  Skorumu gör
                  <ArrowRight className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                </>
              )}
            </Button>
            {!registered && (
              <p className="m-0 mt-3 text-center text-xs text-muted-foreground">
                Skor için kayıt gerekmez. CV&apos;ni ilana uyarlamak için ücretsiz hesap açman yeterli.
              </p>
            )}
          </form>
        </Card>

        <aside className="space-y-4">
          <Card className="gap-3 py-5 shadow-xs">
            <CardHeader className="px-5">
              <CardTitle className="text-sm">Ne göreceksin</CardTitle>
            </CardHeader>
            <CardContent className="px-5">
              <ul className="m-0 list-none space-y-3 p-0 text-sm">
                {[
                  { Icon: Gauge, b: "ATS uyum skoru", m: "CV'nin bu ilana ne kadar uyduğu." },
                  { Icon: SearchCheck, b: "Eksik anahtar kelimeler", m: "Her gereksinim, CV'ndeki kanıtıyla." },
                  { Icon: FileCheck2, b: "Biçim kontrolü", m: "ATS CV'ni doğru okuyabiliyor mu." },
                ].map(({ Icon, b, m }) => (
                  <li key={b} className="flex gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span>
                      <span className="block font-medium">{b}</span>
                      <span className="text-muted-foreground">{m}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {/* Yüklemeden önce raporu görmek isteyen için (DOG-101). */}
              <Button asChild variant="outline" size="sm" className="mt-4 w-full">
                <Link href="/sample-report">
                  <Eye aria-hidden /> Örnek raporu gör
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Link
            href="/get-started"
            className="flex items-center gap-3 rounded-xl border bg-card p-4 text-sm transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Compass className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Nereden başlayacağını bilmiyor musun?</span>
              <span className="text-muted-foreground">Dört soruyla ilk adımını bulalım.</span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
          <div className="flex gap-3 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-green dark:text-[#4ade80]" aria-hidden />
            <p className="m-0">
              CV&apos;n analiz için OpenAI&apos;a gönderilir; satılmaz, model eğitiminde kullanılmaz.{" "}
              <Link href="/privacy" className="font-medium text-foreground underline underline-offset-2">
                KVKK metni
              </Link>
            </p>
          </div>
        </aside>
      </div>
    </AppPage>
  )
}
