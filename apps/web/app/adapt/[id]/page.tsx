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
function skorEtiketi(skor: number): { metin: string; sinif: string } {
  if (skor >= 70) return { metin: "Yüksek uyum", sinif: "text-yesil" }
  if (skor >= 40) return { metin: "Orta uyum", sinif: "text-kehribar" }
  return { metin: "Düşük uyum", sinif: "text-kirmizi" }
}

function Fark({ original, rewritten }: { original: string; rewritten: string }) {
  return (
    <p className="my-1.5">
      {diffWords(original, rewritten).map((parca, i) =>
        parca.kind === "same" ? (
          <span key={i}>{parca.text} </span>
        ) : (
          <span
            key={i}
            className={
              parca.kind === "added"
                ? "rounded bg-yesil/20 px-0.5"
                : "text-gri line-through dark:text-gri-koyu"
            }
          >
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

  if (!durum) return <p className="text-sm text-gri dark:text-gri-koyu">Yükleniyor…</p>
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

      {/* Skor ekranın en büyük öğesi (rehber §9.5). */}
      <div className="my-5 flex flex-wrap items-baseline gap-3">
        <span className="font-baslik text-6xl font-extrabold leading-none text-gri dark:text-gri-koyu">
          {once}
        </span>
        <span className="text-3xl text-gri dark:text-gri-koyu">→</span>
        <span
          className={`font-baslik text-6xl font-extrabold leading-none ${etiket.sinif}`}
        >
          {sonra}
        </span>
        <span className={`text-sm font-bold ${etiket.sinif}`}>{etiket.metin}</span>
      </div>
      {sonra === once && (
        <p className="text-sm text-gri dark:text-gri-koyu">
          Skor değişmedi. Yeniden ifade her zaman eşleşme kazandırmaz; eksik
          olan şey ilanda aranıp CV&apos;nde gerçekten bulunmayan deneyim olabilir.
        </p>
      )}

      {draft.summary.original && (
        <>
          <h2>Özet</h2>
          <section className="mb-3 rounded-kart border border-cizgi bg-white p-4 dark:border-cizgi-koyu dark:bg-kart-koyu">
            <Fark original={draft.summary.original} rewritten={draft.summary.rewritten} />
            <button
              className="rounded-buton border border-cizgi px-5 py-2.5 font-semibold disabled:cursor-not-allowed disabled:opacity-45 dark:border-cizgi-koyu"
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
        <section className="mb-3 rounded-kart border border-cizgi bg-white p-4 dark:border-cizgi-koyu dark:bg-kart-koyu" key={madde.id}>
          {madde.verification.status === "flagged" && (
            <>
              <span className="mb-1.5 inline-block rounded-full bg-kehribar/20 px-2 py-0.5 text-xs font-bold text-kehribar">
                Kontrol et
              </span>
              {madde.verification.issues.map((sorun, i) => (
                <p className="mt-1.5 text-sm text-kehribar" key={i}>
                  {sorun.detail}
                </p>
              ))}
            </>
          )}
          <Fark original={madde.original} rewritten={madde.rewritten} />
          <button
            className="rounded-buton border border-cizgi px-5 py-2.5 font-semibold disabled:cursor-not-allowed disabled:opacity-45 dark:border-cizgi-koyu"
            disabled={mesgul || madde.decision === "accepted"}
            onClick={() => karar(madde.id, "accepted")}
          >
            {madde.decision === "accepted" ? "Yeni hâli kullanılıyor" : "Yeni hâlini kullan"}
          </button>{" "}
          <button
            className="rounded-buton border border-cizgi px-5 py-2.5 font-semibold disabled:cursor-not-allowed disabled:opacity-45 dark:border-cizgi-koyu"
            disabled={mesgul || madde.decision === "rejected"}
            onClick={() => karar(madde.id, "rejected")}
          >
            {madde.decision === "rejected" ? "Eski hâli kullanılıyor" : "Eski hâlini kullan"}
          </button>
        </section>
      ))}

      <h2>Beceriler</h2>
      <p className="mb-3 rounded-kart border border-cizgi bg-white p-4 dark:border-cizgi-koyu dark:bg-kart-koyu text-sm text-gri dark:text-gri-koyu">
        İlana en çok uyanlar başa alındı. Hiçbir beceri eklenmedi veya silinmedi.
        <br />
        <span className="text-gece dark:text-metin-koyu">{draft.skillOrder.join(" · ")}</span>
      </p>

      {bekleyen > 0 && (
        <p className="mt-1.5 text-sm text-kehribar">
          {bekleyen} madde için karar bekliyoruz. Karar verince indirme açılır.
        </p>
      )}
      {hata && <p className="mt-1.5 text-sm text-kehribar">{hata}</p>}

      <p className="mt-5">
        <button
          className="rounded-buton bg-mavi px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
          disabled={mesgul || bekleyen > 0}
          onClick={() => indir("pdf")}
        >
          PDF indir
        </button>{" "}
        <button
          className="rounded-buton border border-cizgi px-5 py-2.5 font-semibold disabled:cursor-not-allowed disabled:opacity-45 dark:border-cizgi-koyu"
          disabled={mesgul || bekleyen > 0}
          onClick={() => indir("docx")}
        >
          Word indir
        </button>
      </p>

      {/* Marka rehberi §11: yapay zekâ şeffaflığı ve uydurmama ilkesi. */}
      <p className="mt-8 text-sm text-gri dark:text-gri-koyu">
        Metinler yapay zekâ ile yeniden yazıldı. Hiçbir deneyim, beceri veya
        sertifika eklenmedi; eğitim ve sertifikalarına hiç dokunulmadı.
      </p>
    </main>
  )
}
