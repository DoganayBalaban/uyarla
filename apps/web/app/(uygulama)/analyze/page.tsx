"use client"

import { useState } from "react"
import { SkorSonucu, type ScoreResultView } from "../../components/SkorSonucu"

/** Marka rehberi §10.2'deki yükleme metinleri. */
const STAGE_TEXT: Record<string, string> = {
  cv_okunuyor: "CV'ni okuyoruz…",
  ilan_okunuyor: "İlanı okuyoruz…",
  karsilastiriliyor: "İlanla karşılaştırıyoruz…",
  tamamlandi: "Hazır.",
}

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

export default function AnalyzePage() {
  const [state, setState] = useState<AnalysisResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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
    if (govde.code === "kayit_gerekli") {
      window.location.href = "/login"
      return
    }
    setError(govde.error ?? "Uyarlama başlatılamadı.")
    setBusy(false)
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
      poll(body.jobId)
    } catch {
      setError("Sunucuya ulaşamadık. Bağlantını kontrol edip tekrar dener misin?")
      setBusy(false)
    }
  }

  function poll(jobId: string) {
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/analyze/${jobId}`)
        const body: AnalysisResponse = await response.json()
        setState(body)

        if (body.status === "completed" || body.status === "failed") {
          clearInterval(timer)
          setBusy(false)
        }
      } catch {
        clearInterval(timer)
        setError("Sonucu alamadık. Sayfayı yenileyip tekrar dener misin?")
        setBusy(false)
      }
    }, 1000)
  }

  // Sonuç geldiğinde form gizleniyor: ekranda tek iş olsun.
  const sonucVar = state?.status === "completed" && state.result

  return (
    <main>
      {!sonucVar && (
        <>
          <h1 className="text-3xl">CV&apos;ni ilanla karşılaştır</h1>
          <p className="mt-2 text-sm text-gri">
            CV&apos;ni yükle → ilanı yapıştır → skorunu gör. Kayıt gerekmez.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="cv" className="mb-1 block font-semibold">
                CV&apos;n (PDF veya Word)
              </label>
              <input id="cv" type="file" name="cv" accept=".pdf,.docx" required />
            </div>
            <div>
              <label htmlFor="jobText" className="mb-1 block font-semibold">
                İlan metni
              </label>
              <textarea
                id="jobText"
                name="jobText"
                rows={12}
                required
                placeholder="İlanın tamamını yapıştır — gereksinimler bölümü dahil."
                className="w-full rounded-buton border border-cizgi bg-white p-2.5 font-govde text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="rounded-buton bg-mavi px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busy ? "Çalışıyor…" : "Skorumu gör"}
            </button>
          </form>
        </>
      )}

      {error && <p className="mt-4 text-kirmizi">{error}</p>}

      {state?.status === "running" && (
        <p className="mt-4">{STAGE_TEXT[state.stage ?? ""] ?? "Çalışıyor…"}</p>
      )}

      {state?.status === "failed" && <p className="mt-4 text-kirmizi">{state.error}</p>}

      {sonucVar && state.result && (
        <>
          <h1 className="text-3xl">Skorun</h1>
          <SkorSonucu
            sonuc={state.result}
            durationMs={state.durationMs}
            tokenUsage={state.tokenUsage}
            modelId={state.modelId}
            uyarlaniyor={busy}
            onUyarla={state.analysisId ? () => uyarla(state.analysisId!) : undefined}
          />
        </>
      )}
    </main>
  )
}
