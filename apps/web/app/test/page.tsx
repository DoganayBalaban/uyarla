"use client"

import { useState } from "react"

/** Marka rehberi §10.2'deki yükleme metinleri. */
const STAGE_TEXT: Record<string, string> = {
  cv_okunuyor: "CV'ni okuyoruz…",
  ilan_okunuyor: "İlanı okuyoruz…",
  karsilastiriliyor: "İlanla karşılaştırıyoruz…",
  tamamlandi: "Hazır.",
}

interface RequirementResult {
  requirement: { text: string; importance: string; type: string }
  status: "matched" | "missing"
  confidence: number
  method: string | null
  evidence: { text: string; kind: string } | null
}

interface AnalysisResponse {
  status: "running" | "completed" | "failed"
  stage?: string
  analysisId?: string | null
  score?: number | null
  durationMs?: number | null
  tokenUsage?: number | null
  modelId?: string | null
  error?: string
  result?: {
    score: number
    requirements: RequirementResult[]
    missingKeywords: string[]
  } | null
}

export default function TestPage() {
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
      window.location.href = "/giris"
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

  return (
    <main>
      <h1>Uyarla · Sprint 1 test arayüzü</h1>
      <p className="meta">
        Markasız. Marka giydirmesi Sprint 2&apos;de (K-01).
      </p>

      <form onSubmit={onSubmit}>
        <p>
          <label htmlFor="cv">CV (PDF veya DOCX)</label>
          <input id="cv" type="file" name="cv" accept=".pdf,.docx" required />
        </p>
        <p>
          <label htmlFor="jobText">İlan metni</label>
          <textarea id="jobText" name="jobText" rows={14} required />
        </p>
        <button type="submit" disabled={busy}>
          {busy ? "Çalışıyor…" : "Skoru hesapla"}
        </button>
      </form>

      {error && <p className="missing">{error}</p>}

      {state?.status === "running" && (
        <p>{STAGE_TEXT[state.stage ?? ""] ?? "Çalışıyor…"}</p>
      )}

      {state?.status === "failed" && <p className="missing">{state.error}</p>}

      {state?.status === "completed" && state.result && (
        <section>
          <div className="skor-blok">
            <span className="skor-rakam">{state.result.score}</span>
          </div>
          <p className="meta">
            {state.durationMs} ms · {state.tokenUsage} token · {state.modelId}
          </p>

          {state.analysisId && (
            <p>
              <button
                className="btn-birincil"
                disabled={busy}
                onClick={() => uyarla(state.analysisId!)}
              >
                CV&apos;mi bu ilana uyarla
              </button>
            </p>
          )}

          <h2>Gereksinimler</h2>
          <ul className="requirements">
            {state.result.requirements.map((item, i) => (
              <li key={i}>
                <span className={item.status}>
                  {item.status === "matched" ? "✓" : "✗"} {item.requirement.text}
                </span>{" "}
                <span className="meta">
                  ({item.requirement.importance}
                  {item.method ? ` · ${item.method} · ${item.confidence.toFixed(2)}` : ""})
                </span>
                {item.evidence && (
                  <div className="meta">
                    kanıt ({item.evidence.kind}): {item.evidence.text}
                  </div>
                )}
              </li>
            ))}
          </ul>

          <h2>Eksik anahtar kelimeler</h2>
          <p>{state.result.missingKeywords.join(", ") || "Yok"}</p>

          <details>
            <summary>Ham sonuç (K1 elle kontrolü için)</summary>
            <pre>{JSON.stringify(state.result, null, 2)}</pre>
          </details>
        </section>
      )}
    </main>
  )
}
