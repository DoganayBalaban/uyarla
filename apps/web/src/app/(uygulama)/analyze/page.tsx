"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
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
  resultPath,
  handleResponse,
} from "@/features/analysis/activeAnalysis"
import { SayfaBasligi } from "../../components/Sayfa"
import { AsamaCizelgesi } from "../../components/ui/AsamaCizelgesi"
import { CvYukleme } from "../../components/ui/CvYukleme"
import { SkorSonucu, type ScoreResultView } from "../../components/SkorSonucu"

/** Marka rehberi §10.2'deki yükleme metinleri; aşama çizelgesinin satırları. */
const ASAMALAR = [
  { id: "reading_resume", title: "CV'ni okuyoruz", description: "Deneyim, eğitim ve becerilerin ayrıştırılıyor." },
  { id: "reading_posting", title: "İlanı okuyoruz", description: "Gereksinimler ve aranan kavramlar çıkarılıyor." },
  { id: "comparing", title: "İlanla karşılaştırıyoruz", description: "Her gereksinim CV'nde kanıtıyla aranıyor." },
]

interface AnalysisResponse {
  status: "running" | "completed" | "failed"
  stage?: string
  analysisId?: string | null
  durationMs?: number | null
  tokenUsage?: number | null
  modelId?: string | null
  error?: string
  result?: ScoreResultView | null
}

const girdiSinifi =
  "w-full rounded-buton border border-cizgi bg-kart px-3.5 py-2.5 text-sm text-metin outline-none transition placeholder:text-gri/70 focus:border-mavi focus:ring-4 focus:ring-mavi/15"

function AdimBasligi({ no, baslik, aciklama }: { no: number; baslik: string; aciklama: string }) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-mavi text-sm font-bold text-white">
        {no}
      </span>
      <div>
        <p className="m-0 font-semibold">{baslik}</p>
        <p className="m-0 text-sm text-gri">{aciklama}</p>
      </div>
    </div>
  )
}

export default function AnalyzePage() {
  const [state, setState] = useState<AnalysisResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const ilanKutusu = useRef<HTMLTextAreaElement>(null)
  const [ilanUrl, setIlanUrl] = useState("")
  const [ilanDurumu, setIlanDurumu] = useState<
    { tur: "yukleniyor" } | { tur: "tamam"; metin: string } | { tur: "hata"; metin: string } | null
  >(null)

  /**
   * İlan bağlantısından metni alıp kutuya doldurur. Kutu düzenlenebilir
   * kalıyor: çekilen metinde gereksiz kısım varsa kullanıcı silebilir.
   */
  async function ilaniGetir() {
    if (!ilanUrl.trim()) return
    setIlanDurumu({ tur: "yukleniyor" })
    try {
      const cevap = await fetch("/api/job-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: ilanUrl }),
      })
      const govde = (await cevap.json()) as { metin?: string; pozisyon?: string | null; error?: string }
      if (!cevap.ok || !govde.metin) {
        setIlanDurumu({ tur: "hata", metin: govde.error ?? "İlanı alamadık." })
        return
      }
      if (ilanKutusu.current) ilanKutusu.current.value = govde.metin
      setIlanDurumu({
        tur: "tamam",
        metin: `${govde.pozisyon ? `“${govde.pozisyon}” ilanı` : "İlan metni"} aşağıya eklendi. Göndermeden önce göz atabilirsin.`,
      })
    } catch {
      setIlanDurumu({ tur: "hata", metin: "Sunucuya ulaşamadık. Metni kopyalayıp yapıştırır mısın?" })
    }
  }
  const [devamEdiliyor, setDevamEdiliyor] = useState(false)
  const devamBasladi = useRef(false)

  // Girişten dönüş: `?uyarla=<analiz>` varsa uyarlamayı başlat. Ref, React'in
  // geliştirme modunda efekti iki kez çalıştırmasına karşı: iki uyarlama
  // isteği gitmesin.
  useEffect(() => {
    const parametreler = new URLSearchParams(window.location.search)
    const analysisId = parametreler.get("uyarla")
    if (analysisId && !devamBasladi.current) {
      devamBasladi.current = true
      setDevamEdiliyor(true)
      void uyarla(analysisId)
      return
    }

    // Kalıcı sonuç adresi: `?analiz=<id>`. Sayfa yenilense de, panodan ya da
    // sağ alttaki bildirimden gelinse de sonuç buradan açılıyor (K3).
    const kalici = parametreler.get("analiz")
    if (kalici) {
      void sonucuYukle(kalici)
      return
    }

    // Başka sayfaya geçip "Analize dön" ile gelindi: süren analiz kaldığı
    // yerden izleniyor, bitmiş ama görülmemiş sonuç gösteriliyor.
    const aktif = readActiveAnalysis()
    if (aktif?.status === "running") {
      setState({ status: "running", stage: aktif.stage })
      setBusy(true)
      poll(aktif.jobId)
    } else if (aktif?.status === "completed" && aktif.analysisId && !aktif.seen) {
      void sonucuYukle(aktif.analysisId)
    } else if (aktif?.status === "failed" && !aktif.seen) {
      setError(aktif.error ?? "Analiz tamamlanamadı.")
      clearActiveAnalysis()
    }
    // uyarla ve poll her çizimde yeniden tanımlanıyor; efekt yalnızca ilk açılışta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sayfadan ayrılınca yoklama duruyor; izlemeyi sağ alttaki bildirim devralıyor.
  const yoklama = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => () => {
    if (yoklama.current) clearInterval(yoklama.current)
  }, [])

  async function sonucuYukle(analysisId: string) {
    setState({ status: "running" })
    try {
      const cevap = await fetch(`/api/analysis/${encodeURIComponent(analysisId)}`)
      if (!cevap.ok) {
        setState(null)
        setError("Bu analizi bulamadık. Yeni bir analiz başlatabilirsin.")
        return
      }
      const govde = (await cevap.json()) as AnalysisResponse
      setState(govde)
      const aktif = readActiveAnalysis()
      if (aktif?.analysisId === analysisId) updateActiveAnalysis(aktif.jobId, { seen: true })
    } catch {
      setState(null)
      setError("Sonucu alamadık. Sayfayı yenileyip tekrar dener misin?")
    }
  }

  /** Uyarlamayı başlatır ve uyarlama ekranına geçer. */
  async function uyarla(analysisId: string) {
    setBusy(true)
    const cevap = await fetch("/api/adapt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ analysisId }),
    })
    const govde = (await cevap.json()) as {
      adaptationId?: string
      error?: string
      code?: string
    }
    if (cevap.ok && govde.adaptationId) {
      window.location.href = `/adapt/${govde.adaptationId}`
      return
    }
    // Anonim kullanıcı uyarlama isteyince kayıt gerekiyor (spec §7). Hata
    // göstermek yerine doğrudan giriş ekranına alıyoruz: huninin tasarımı bu.
    // Dönüş adresi `?uyarla=` taşıyor: girişten sonra bu sayfa açılınca
    // uyarlama kendiliğinden başlıyor ve kullanıcı işine kaldığı yerden
    // devam ediyor. Analiz kimliği kayıtta değişmiyor, yalnızca sahibi
    // anonim kullanıcıdan yeni hesaba geçiyor (src/server/claimAnonymousData.ts).
    if (govde.code === "kayit_gerekli") {
      window.location.href = loginPath(`/analyze?uyarla=${encodeURIComponent(analysisId)}`)
      return
    }
    setError(govde.error ?? "Uyarlama başlatılamadı.")
    setBusy(false)
    setDevamEdiliyor(false)
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setError(null)
    setState(null)
    setBusy(true)

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: new FormData(form),
      })
      const body = await response.json()

      if (!response.ok) {
        setError(body.error)
        setBusy(false)
        return
      }
      // Çizelge hemen görünsün; ilk yoklama bir saniye sonra geliyor. Kayıt,
      // kullanıcı başka sayfaya geçerse sağ alttaki bildirimin izlemesi için.
      startActiveAnalysis(body.jobId)
      setState({ status: "running" })
      poll(body.jobId)
    } catch {
      setError("Sunucuya ulaşamadık. Bağlantını kontrol edip tekrar dener misin?")
      setBusy(false)
    }
  }

  function poll(jobId: string) {
    if (yoklama.current) clearInterval(yoklama.current)
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/analyze/${jobId}`)
        const body: AnalysisResponse & { score?: number | null } = await response.json()
        if (!response.ok) {
          // İş artık yok (kuyruk temizlendi) ya da başkasına ait.
          clearInterval(timer)
          clearActiveAnalysis()
          setState(null)
          setError("Bu analizi artık bulamıyoruz. Yeni bir analiz başlatabilirsin.")
          setBusy(false)
          return
        }
        setState(body)
        handleResponse(jobId, body)

        if (body.status === "completed" || body.status === "failed") {
          clearInterval(timer)
          setBusy(false)
          // Kullanıcı sonucu bu sayfada görüyor: bildirim gösterilmesin.
          updateActiveAnalysis(jobId, { seen: true })
          // Adres kalıcı sonuca dönüyor; yenilenirse sonuç kaybolmaz (K3).
          if (body.status === "completed" && body.analysisId) {
            window.history.replaceState(null, "", resultPath(body.analysisId))
          }
        }
      } catch {
        // Ağ kesintisi: bir sonraki turda tekrar denenir.
      }
    }, 1000)
    yoklama.current = timer
  }

  function basaDon() {
    if (yoklama.current) clearInterval(yoklama.current)
    clearActiveAnalysis()
    window.history.replaceState(null, "", "/analyze")
    setState(null)
    setError(null)
    setBusy(false)
  }

  // Sonuç geldiğinde form gizleniyor: ekranda tek iş olsun.
  const sonucVar = state?.status === "completed" && state.result
  const calisiyor = state?.status === "running"

  // Girişten dönüşte form bir an bile görünmesin; başarılıysa sayfa
  // uyarlama ekranına geçiyor, değilse hata ile birlikte form geri geliyor.
  if (devamEdiliyor) {
    return (
      <div className="mx-auto max-w-md rounded-kart border border-cizgi bg-kart p-10 text-center shadow-sm">
        <LoaderCircle className="mx-auto size-8 text-mavi motion-safe:animate-spin" aria-hidden />
        <h1 className="mt-5 text-2xl">Uyarlaman hazırlanıyor…</h1>
        <p className="mt-2 text-sm text-gri">Kaldığın yerden devam ediyoruz.</p>
      </div>
    )
  }

  if (sonucVar && state.result) {
    return (
      <SkorSonucu
        sonuc={state.result}
        durationMs={state.durationMs}
        tokenUsage={state.tokenUsage}
        modelId={state.modelId}
        uyarlaniyor={busy}
        hata={error}
        onUyarla={state.analysisId ? () => uyarla(state.analysisId!) : undefined}
        onYeniAnaliz={basaDon}
      />
    )
  }

  if (calisiyor) {
    return (
      <div className="mx-auto max-w-2xl">
        <AsamaCizelgesi
          baslik="Analizin hazırlanıyor"
          altBaslik="Genelde bir dakika kadar sürüyor. Sayfadan ayrılma."
          asamalar={deriveStageStates(ASAMALAR, state?.stage ?? null)}
        />
      </div>
    )
  }

  return (
    <div>
      <SayfaBasligi
        baslik="CV'ni ilanla karşılaştır"
        aciklama="CV'ni yükle, ilanı yapıştır. Uyumunu ve eksik anahtar kelimeleri hemen gör. Ücretsiz, kayıt gerekmez."
      />

      {(error || state?.status === "failed") && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-kart border border-kirmizi/30 bg-kirmizi/5 p-4 text-sm"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-kirmizi" aria-hidden />
          <p className="m-0 text-metin">{error ?? state?.error}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <form onSubmit={onSubmit} className="rounded-kart border border-cizgi bg-kart p-5 shadow-sm sm:p-7">
          <AdimBasligi no={1} baslik="CV'n" aciklama="Başvuracağın CV'nin güncel hâli." />
          <CvYukleme />

          <div className="my-7 h-px bg-cizgi" />

          <AdimBasligi no={2} baslik="İlan" aciklama="Bağlantıyı yapıştır ya da metni kutuya ekle." />
          <label htmlFor="ilanUrl" className="sr-only">
            İlan bağlantısı
          </label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gri" aria-hidden />
              <input
                id="ilanUrl"
                type="url"
                inputMode="url"
                value={ilanUrl}
                onChange={(e) => setIlanUrl(e.target.value)}
                onKeyDown={(e) => {
                  // Enter formu (analizi) göndermesin; bağlantıyı getirsin.
                  if (e.key === "Enter") {
                    e.preventDefault()
                    void ilaniGetir()
                  }
                }}
                placeholder="https://www.kariyer.net/is-ilani/…"
                className={`${girdiSinifi} pl-9`}
              />
            </div>
            <button
              type="button"
              onClick={() => void ilaniGetir()}
              disabled={!ilanUrl.trim() || ilanDurumu?.tur === "yukleniyor"}
              className="inline-flex shrink-0 items-center gap-2 rounded-buton border border-cizgi bg-kart px-4 text-sm font-semibold transition-colors hover:border-metin/25 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {ilanDurumu?.tur === "yukleniyor" && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />}
              {ilanDurumu?.tur === "yukleniyor" ? "Getiriliyor…" : "İlanı getir"}
            </button>
          </div>
          {ilanDurumu?.tur === "tamam" && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-yesil dark:text-[#4ade80]">
              <FileCheck2 className="size-4" aria-hidden />
              {ilanDurumu.metin}
            </p>
          )}
          {ilanDurumu?.tur === "hata" && <p className="mt-2 text-sm text-kehribar">{ilanDurumu.metin}</p>}

          <label htmlFor="jobText" className="mt-4 mb-1.5 block text-sm font-medium">
            İlan metni
          </label>
          <textarea
            id="jobText"
            name="jobText"
            ref={ilanKutusu}
            rows={10}
            required
            placeholder="İlanın tamamını yapıştır — gereksinimler bölümü dahil. Bağlantıyı yukarıya yapıştırırsan buraya kendiliğinden gelir."
            className={`${girdiSinifi} resize-y leading-relaxed`}
          />

          <button
            type="submit"
            disabled={busy}
            className="group mt-6 flex w-full items-center justify-center gap-2 rounded-buton bg-mavi px-6 py-3.5 font-semibold text-white shadow-[0_10px_24px_-12px_rgb(43_78_255/0.8)] transition hover:-translate-y-px hover:bg-[#2442e0] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
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
          <div className="rounded-kart border border-cizgi bg-kart p-5 shadow-sm">
            <p className="m-0 text-sm font-semibold">Ne göreceksin</p>
            <ul className="mt-3 list-none space-y-3 p-0 text-sm">
              {[
                { Ikon: Gauge, b: "ATS uyum skoru", m: "CV'nin bu ilana ne kadar uyduğu." },
                { Ikon: SearchCheck, b: "Eksik anahtar kelimeler", m: "Her gereksinim, CV'ndeki kanıtıyla." },
                { Ikon: FileCheck2, b: "Biçim kontrolü", m: "ATS CV'ni doğru okuyabiliyor mu." },
              ].map(({ Ikon, b, m }) => (
                <li key={b} className="flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-buton bg-mavi/10 text-mavi dark:text-[#8ea2ff]">
                    <Ikon className="size-4" aria-hidden />
                  </span>
                  <span>
                    <span className="block font-medium">{b}</span>
                    <span className="text-gri">{m}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-3 rounded-kart border border-cizgi bg-kart/60 p-4 text-sm text-gri">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-yesil dark:text-[#4ade80]" aria-hidden />
            <p className="m-0">
              CV&apos;n izinsiz kimseyle paylaşılmaz.{" "}
              <Link href="/privacy" className="font-medium text-metin underline underline-offset-2">
                KVKK metni
              </Link>
            </p>
          </div>
          {state?.status === "failed" && (
            <button
              onClick={basaDon}
              className="inline-flex w-full items-center justify-center gap-2 rounded-buton border border-cizgi bg-kart px-4 py-2.5 text-sm font-semibold"
            >
              <RotateCcw className="size-4" aria-hidden /> Baştan başla
            </button>
          )}
        </aside>
      </div>
    </div>
  )
}
