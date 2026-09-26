"use client"

import { use, useCallback, useEffect, useState } from "react"
import { diffWords } from "@/lib/diff"

/** Marka rehberi §10.2 tonunda yükleme metinleri. */
const STAGE_TEXT: Record<string, string> = {
  yeniden_yaziliyor: "CV'ni ilana göre yeniden yazıyoruz…",
  kontrol_ediliyor: "Hiçbir şeyin uydurulmadığını kontrol ediyoruz…",
}

interface Verification {
  status: "ok" | "flagged"
  issues: Array<{ kind: string; detail: string }>
}

interface Bullet {
  id: string
  original: string
  rewritten: string
  verification: Verification
  decision: "accepted" | "rejected" | "pending"
}

interface Draft {
  summary: {
    original: string | null
    rewritten: string
    verification: Verification
    decision: string
  }
  bullets: Bullet[]
  skillOrder: string[]
}

interface Durum {
  status: "running" | "draft" | "ready" | "failed"
  draft: Draft | null
  scoreBefore: number | null
  scoreAfter: number | null
}

/**
 * Skor yalnızca renkle değil etiketle de anlatılıyor — renk körlüğü gereği
 * (rehber §9.2).
 */
function skorEtiketi(skor: number): { metin: string; renk: string } {
  if (skor >= 70) return { metin: "Yüksek uyum", renk: "var(--yesil)" }
  if (skor >= 40) return { metin: "Orta uyum", renk: "var(--kehribar)" }
  return { metin: "Düşük uyum", renk: "var(--kirmizi)" }
}

function Fark({ original, rewritten }: { original: string; rewritten: string }) {
  return (
    <p style={{ margin: "0.4rem 0" }}>
      {diffWords(original, rewritten).map((parca, i) =>
        parca.kind === "same" ? (
          <span key={i}>{parca.text} </span>
        ) : (
          <span key={i} className={parca.kind === "added" ? "eklenen" : "cikarilan"}>
            {parca.text}{" "}
          </span>
        ),
      )}
    </p>
  )
}

export default function AdaptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [durum, setDurum] = useState<Durum | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [mesgul, setMesgul] = useState(false)

  const yokla = useCallback(async (): Promise<Durum | null> => {
    const cevap = await fetch(`/api/adapt/${id}`)
    if (!cevap.ok) return null
    const yeni = (await cevap.json()) as Durum
    setDurum(yeni)
    return yeni
  }, [id])

  // Çalışırken yokluyor, bitince duruyor. Zamanlayıcı setDurum içinden değil
  // bu döngüden yönetiliyor: durum güncelleyicisinin yan etkisi olması
  // React'in çift çağırmasıyla iki döngü başlatırdı.
  useEffect(() => {
    let durduruldu = false
    void (async () => {
      while (!durduruldu) {
        const son = await yokla()
        if (!son || son.status !== "running") return
        await new Promise((r) => setTimeout(r, 1500))
      }
    })()
    return () => {
      durduruldu = true
    }
  }, [yokla])

  async function karar(itemId: string, decision: "accepted" | "rejected") {
    setMesgul(true)
    const cevap = await fetch(`/api/adapt/${id}/decision`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemId, decision }),
    })
    if (cevap.ok) {
      const govde = (await cevap.json()) as Partial<Durum>
      setDurum((d) => (d ? { ...d, ...govde } : d))
    }
    setMesgul(false)
  }

  async function indir(format: "pdf" | "docx") {
    setHata(null)
    setMesgul(true)
    try {
      const cevap = await fetch(`/api/adapt/${id}/download?format=${format}`)
      if (!cevap.ok) {
        setHata(((await cevap.json()) as { error?: string }).error ?? "İndirilemedi.")
        return
      }
      const url = URL.createObjectURL(await cevap.blob())
      const a = document.createElement("a")
      a.href = url
      a.download = `uyarla-cv.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setMesgul(false)
    }
  }

  if (!durum) return <p className="meta">Yükleniyor…</p>
  if (durum.status === "running") return <p>{STAGE_TEXT.yeniden_yaziliyor}</p>
  if (durum.status === "failed" || !durum.draft) {
    return <p>Uyarlama tamamlanamadı. Birazdan tekrar dener misin?</p>
  }

  const { draft } = durum
  const bekleyen = draft.bullets.filter((b) => b.decision === "pending").length
  const once = durum.scoreBefore ?? 0
  const sonra = durum.scoreAfter ?? 0
  const etiket = skorEtiketi(sonra)

  return (
    <main>
      <h1>CV&apos;n hazır</h1>

      <div className="skor-blok">
        <span className="skor-rakam" style={{ color: "var(--gri)" }}>
          {once}
        </span>
        <span className="skor-ok">→</span>
        <span className="skor-rakam" style={{ color: etiket.renk }}>
          {sonra}
        </span>
        <span className="skor-etiket" style={{ color: etiket.renk }}>
          {etiket.metin}
        </span>
      </div>
      {sonra === once && (
        <p className="meta">
          Skor değişmedi. Yeniden ifade her zaman eşleşme kazandırmaz; eksik
          olan şey ilanda aranıp CV&apos;nde gerçekten bulunmayan deneyim olabilir.
        </p>
      )}

      {draft.summary.original && (
        <>
          <h2>Özet</h2>
          <section className="kart">
            <Fark original={draft.summary.original} rewritten={draft.summary.rewritten} />
            <button
              className="btn-ikincil"
              disabled={mesgul || draft.summary.decision === "rejected"}
              onClick={() => karar("summary", "rejected")}
            >
              {draft.summary.decision === "rejected"
                ? "Eski hâli kullanılıyor"
                : "Eski hâlini kullan"}
            </button>
          </section>
        </>
      )}

      <h2>Deneyim maddeleri</h2>
      {draft.bullets.map((madde) => (
        <section className="kart" key={madde.id}>
          {madde.verification.status === "flagged" && (
            <>
              <span className="rozet">Kontrol et</span>
              {madde.verification.issues.map((sorun, i) => (
                <p className="gerekce" key={i}>
                  {sorun.detail}
                </p>
              ))}
            </>
          )}
          <Fark original={madde.original} rewritten={madde.rewritten} />
          <button
            className="btn-ikincil"
            disabled={mesgul || madde.decision === "accepted"}
            onClick={() => karar(madde.id, "accepted")}
          >
            {madde.decision === "accepted" ? "Yeni hâli kullanılıyor" : "Yeni hâlini kullan"}
          </button>{" "}
          <button
            className="btn-ikincil"
            disabled={mesgul || madde.decision === "rejected"}
            onClick={() => karar(madde.id, "rejected")}
          >
            {madde.decision === "rejected" ? "Eski hâli kullanılıyor" : "Eski hâlini kullan"}
          </button>
        </section>
      ))}

      <h2>Beceriler</h2>
      <p className="kart meta">
        İlana en çok uyanlar başa alındı. Hiçbir beceri eklenmedi veya silinmedi.
        <br />
        <span style={{ color: "var(--metin)" }}>{draft.skillOrder.join(" · ")}</span>
      </p>

      {bekleyen > 0 && (
        <p className="gerekce">
          {bekleyen} madde için karar bekliyoruz. Karar verince indirme açılır.
        </p>
      )}
      {hata && <p className="gerekce">{hata}</p>}

      <p style={{ marginTop: "1.25rem" }}>
        <button
          className="btn-birincil"
          disabled={mesgul || bekleyen > 0}
          onClick={() => indir("pdf")}
        >
          PDF indir
        </button>{" "}
        <button
          className="btn-ikincil"
          disabled={mesgul || bekleyen > 0}
          onClick={() => indir("docx")}
        >
          Word indir
        </button>
      </p>

      {/* Marka rehberi §11: yapay zekâ şeffaflığı ve uydurmama ilkesi. */}
      <p className="meta" style={{ marginTop: "2rem" }}>
        Metinler yapay zekâ ile yeniden yazıldı. Hiçbir deneyim, beceri veya
        sertifika eklenmedi; eğitim ve sertifikalarına hiç dokunulmadı.
      </p>
    </main>
  )
}
