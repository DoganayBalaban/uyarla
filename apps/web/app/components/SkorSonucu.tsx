"use client"

export interface RequirementResult {
  requirement: { text: string; importance: string; type: string }
  status: "matched" | "missing"
  confidence: number
  method: string | null
  evidence: { text: string; kind: string } | null
}

export interface ScoreResultView {
  score: number
  requirements: RequirementResult[]
  missingKeywords: string[]
}

/** Skor yalnızca renkle değil etiketle de anlatılıyor (marka rehberi §9.2). */
function skorEtiketi(skor: number): { metin: string; renk: string } {
  if (skor >= 70) return { metin: "Yüksek uyum", renk: "var(--yesil)" }
  if (skor >= 40) return { metin: "Orta uyum", renk: "var(--kehribar)" }
  return { metin: "Düşük uyum", renk: "var(--kirmizi)" }
}

/**
 * Analiz sonucunun gösterimi.
 *
 * Sayfadan ayrıldı: `/analyze` hem formu, hem yoklamayı, hem sonucu tek
 * dosyada tutuyordu ve okunması zorlaşmıştı.
 */
export function SkorSonucu({
  sonuc,
  durationMs,
  tokenUsage,
  modelId,
  uyarlaniyor,
  onUyarla,
}: {
  sonuc: ScoreResultView
  durationMs?: number | null
  tokenUsage?: number | null
  modelId?: string | null
  uyarlaniyor: boolean
  onUyarla?: () => void
}) {
  const etiket = skorEtiketi(sonuc.score)
  const karsilanan = sonuc.requirements.filter((r) => r.status === "matched").length

  return (
    <section>
      <div className="skor-blok">
        <span className="skor-rakam" style={{ color: etiket.renk }}>
          {sonuc.score}
        </span>
        <span className="skor-etiket" style={{ color: etiket.renk }}>
          {etiket.metin}
        </span>
      </div>

      <p className="meta">
        {sonuc.requirements.length} gereksinimin {karsilanan} tanesi karşılanıyor
      </p>

      {onUyarla && (
        <p style={{ marginTop: "1.25rem" }}>
          <button className="btn-birincil" disabled={uyarlaniyor} onClick={onUyarla}>
            {uyarlaniyor ? "Hazırlanıyor…" : "CV'mi bu ilana uyarla"}
          </button>
        </p>
      )}

      <h2>Gereksinimler</h2>
      <ul className="requirements">
        {sonuc.requirements.map((item, i) => (
          <li key={i}>
            <span className={item.status}>
              {item.status === "matched" ? "✓" : "✗"} {item.requirement.text}
            </span>{" "}
            <span className="meta">({item.requirement.importance})</span>
            {item.evidence && (
              <div className="meta">
                CV&apos;nde bunu karşılayan: {item.evidence.text}
              </div>
            )}
          </li>
        ))}
      </ul>

      <h2>Eksik kavramlar</h2>
      <p>{sonuc.missingKeywords.join(" · ") || "Yok"}</p>

      <details>
        <summary className="meta">Teknik ayrıntı</summary>
        <p className="meta">
          {durationMs} ms · {tokenUsage} token · {modelId}
        </p>
        <pre>{JSON.stringify(sonuc, null, 2)}</pre>
      </details>
    </section>
  )
}
