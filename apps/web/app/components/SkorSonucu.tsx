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

/**
 * Skor yalnızca renkle değil etiketle de anlatılıyor — renk körlüğü gereği
 * (marka rehberi §9.2).
 */
function skorEtiketi(skor: number): { metin: string; sinif: string } {
  if (skor >= 70) return { metin: "Yüksek uyum", sinif: "text-yesil" }
  if (skor >= 40) return { metin: "Orta uyum", sinif: "text-kehribar" }
  return { metin: "Düşük uyum", sinif: "text-kirmizi" }
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
      {/* Skor ekranın en büyük öğesi (rehber §9.5). */}
      <div className="my-5 flex flex-wrap items-baseline gap-3">
        <span className={`font-baslik text-6xl font-extrabold leading-none ${etiket.sinif}`}>
          {sonuc.score}
        </span>
        <span className={`text-sm font-bold ${etiket.sinif}`}>{etiket.metin}</span>
      </div>

      <p className="text-sm text-gri">
        {sonuc.requirements.length} gereksinimin {karsilanan} tanesi karşılanıyor
      </p>

      {onUyarla && (
        <p className="mt-5">
          <button
            className="rounded-buton bg-mavi px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
            disabled={uyarlaniyor}
            onClick={onUyarla}
          >
            {uyarlaniyor ? "Hazırlanıyor…" : "CV'mi bu ilana uyarla"}
          </button>
        </p>
      )}

      <h2 className="mt-9 mb-2 text-lg">Gereksinimler</h2>
      <ul className="list-none p-0">
        {sonuc.requirements.map((item, i) => (
          <li key={i} className="border-b border-cizgi py-2.5">
            <span className={item.status === "matched" ? "text-yesil" : "text-kirmizi"}>
              {item.status === "matched" ? "✓" : "✗"} {item.requirement.text}
            </span>{" "}
            <span className="text-sm text-gri">
              ({item.requirement.importance})
            </span>
            {item.evidence && (
              <div className="text-sm text-gri">
                CV&apos;nde bunu karşılayan: {item.evidence.text}
              </div>
            )}
          </li>
        ))}
      </ul>

      <h2 className="mt-9 mb-2 text-lg">Eksik kavramlar</h2>
      <p>{sonuc.missingKeywords.join(" · ") || "Yok"}</p>

      <details className="mt-8">
        <summary className="cursor-pointer text-sm text-gri">
          Teknik ayrıntı
        </summary>
        <p className="mt-2 text-sm text-gri">
          {durationMs} ms · {tokenUsage} token · {modelId}
        </p>
        <pre className="mt-2 max-h-[32rem] overflow-x-auto rounded-buton border border-cizgi bg-white p-4 text-xs">
          {JSON.stringify(sonuc, null, 2)}
        </pre>
      </details>
    </section>
  )
}
