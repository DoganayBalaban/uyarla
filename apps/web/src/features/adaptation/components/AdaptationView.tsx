"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { motion, useReducedMotion } from "motion/react"
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  Download,
  FileText,
  LayoutGrid,
  Link2,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react"
import { diffWords } from "@/features/adaptation/diff"
import { cn } from "@/lib/cn"
import { deriveStageStates } from "@/features/analysis/stageStates"
import { OnYaziBolumu, type CoverLetterView } from "@/features/adaptation/components/CoverLetterSection"
import { AsamaCizelgesi } from "@/features/analysis/components/StageTimeline"
import { SkorHalkasi, skorDurumu } from "@/features/analysis/components/ScoreRing"

/** Marka rehberi §10.2 tonunda yükleme metinleri. */
const ASAMALAR = [
  {
    id: "rewriting",
    title: "CV'ni ilana göre yeniden yazıyoruz",
    description: "Özetini ve deneyim maddelerini ilanın diline yaklaştırıyoruz.",
  },
  {
    id: "verifying",
    title: "Hiçbir şeyin uydurulmadığını kontrol ediyoruz",
    description: "Her yeni cümleyi CV'ndeki gerçek bilgilerle karşılaştırıyoruz.",
  },
]

interface Verification {
  status: "ok" | "flagged"
  issues: Array<{ kind: string; detail: string }>
}

interface Bullet {
  id: string
  original: string
  rewritten: string
  verification: Verification
  /** İlanın terimine çevrilen ifade ve dayanağı; eski taslaklarda yok. */
  alignments?: Array<{ term: string; basis: string }>
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
  /** CV'nin maddelerinden beceri listesine eklenenler; eski taslaklarda yok. */
  addedSkills?: string[]
}

interface Durum {
  status: "running" | "draft" | "ready" | "failed"
  /** API şimdilik göndermiyor; gelirse çizelge onu izler. */
  stage?: string | null
  draft: Draft | null
  scoreBefore: number | null
  scoreAfter: number | null
  coverLetter: CoverLetterView | null
}

function Fark({ original, rewritten }: { original: string; rewritten: string }) {
  return (
    <p className="m-0 leading-relaxed">
      {diffWords(original, rewritten).map((parca, i) =>
        parca.kind === "same" ? (
          <span key={i}>{parca.text} </span>
        ) : (
          <span
            key={i}
            className={
              parca.kind === "added"
                ? "rounded bg-yesil/15 px-0.5 text-metin decoration-yesil/60 underline-offset-2"
                : "text-gri line-through decoration-gri/60"
            }
          >
            {parca.text}{" "}
          </span>
        ),
      )}
    </p>
  )
}

/**
 * Yeni/eski hâl seçimi. 21st.dev'deki "segmented control" desenleri gibi
 * iki seçenekli bir radyo grubu: ekran okuyucu için de tek bir soru.
 */
function Secim({
  deger,
  yeniSecilebilir = true,
  mesgul,
  onSec,
}: {
  deger: string
  yeniSecilebilir?: boolean
  mesgul: boolean
  onSec: (d: "accepted" | "rejected") => void
}) {
  const secenekler = [
    ...(yeniSecilebilir ? [{ d: "accepted" as const, etiket: "Yeni hâli" }] : []),
    { d: "rejected" as const, etiket: "Eski hâli" },
  ]
  return (
    <div role="radiogroup" aria-label="Hangi hâli kullanılsın?" className="inline-flex rounded-buton bg-zemin p-1 text-sm">
      {secenekler.map((s) => {
        const secili = deger === s.d
        return (
          <button
            key={s.d}
            type="button"
            role="radio"
            aria-checked={secili}
            disabled={mesgul || secili}
            onClick={() => onSec(s.d)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 font-semibold transition disabled:cursor-default",
              secili ? "bg-kart text-mavi shadow-sm" : "text-gri hover:text-metin",
            )}
          >
            {secili && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
            {s.etiket}
          </button>
        )
      })}
    </div>
  )
}

function KontrolUyarisi({ v }: { v: Verification }) {
  if (v.status !== "flagged") return null
  return (
    <div className="mb-3 flex gap-2.5 rounded-buton bg-kehribar/10 p-3 text-sm">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-kehribar" aria-hidden />
      <div>
        <p className="m-0 font-semibold text-kehribar">Kontrol et</p>
        {v.issues.map((sorun, i) => (
          <p className="m-0 mt-0.5 text-metin/80" key={i}>
            {sorun.detail}
          </p>
        ))}
      </div>
    </div>
  )
}

export function AdaptationView({ id }: { id: string }) {
  const azHareket = useReducedMotion() ?? false
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

  if (!durum || durum.status === "running") {
    return (
      <div className="mx-auto max-w-2xl">
        <AsamaCizelgesi
          baslik="Uyarlaman hazırlanıyor"
          altBaslik="Genelde bir dakikadan kısa sürüyor. Sayfadan ayrılma."
          asamalar={deriveStageStates(ASAMALAR, durum?.stage ?? null)}
        />
      </div>
    )
  }

  if (durum.status === "failed" || !durum.draft) {
    return (
      <div className="mx-auto max-w-md rounded-kart border border-cizgi bg-kart p-8 text-center shadow-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-kirmizi/10 text-kirmizi dark:text-[#f87171]">
          <CircleAlert className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl">Uyarlama tamamlanamadı</h1>
        <p className="mt-2 text-sm text-gri">Birazdan tekrar dener misin? CV&apos;n ve ilanın kayıtlı.</p>
        <Link
          href="/analyze"
          className="mt-6 inline-flex items-center gap-2 rounded-buton bg-mavi px-5 py-3 font-semibold text-white no-underline"
        >
          Yeni analiz
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    )
  }

  const { draft } = durum
  const bekleyen = draft.bullets.filter((b) => b.decision === "pending").length
  // Hedefi olmayan maddeler hiç yazılmıyor (K-38); onlar ayrı, katlanmış
  // listede duruyor ki kullanıcı yalnızca gerçekten değişenlere baksın.
  const sirali = draft.bullets.map((madde, i) => ({ madde, sira: i + 1 }))
  const degisenler = sirali.filter(({ madde }) => madde.rewritten !== madde.original)
  const degismeyenler = sirali.filter(({ madde }) => madde.rewritten === madde.original)
  const kararVerilen = degisenler.length - bekleyen
  const eklenenler = new Set(draft.addedSkills ?? [])
  const onayBekleyenUyum = degisenler.filter(
    ({ madde }) => madde.decision === "pending" && (madde.alignments?.length ?? 0) > 0,
  ).length
  const once = durum.scoreBefore ?? 0
  const sonra = durum.scoreAfter ?? 0
  const fark = sonra - once
  const giris = (gecikme: number) =>
    azHareket
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.4, delay: gecikme, ease: [0.22, 1, 0.36, 1] as const },
        }

  return (
    <div className="space-y-6">
      {/* Skor kartı: önce → sonra. Skor ekranın en büyük öğesi (§9.5). */}
      <motion.div
        {...giris(0)}
        className="relative overflow-hidden rounded-kart border border-cizgi bg-kart p-6 shadow-sm sm:p-8"
      >
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-mavi/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-md">
            <p className="text-xs font-semibold tracking-wider text-gri uppercase">Uyarlama</p>
            <h1 className="mt-1 text-3xl">CV&apos;n hazır</h1>
            <p className="mt-2 text-sm text-gri">
              {fark > 0
                ? `Deneyimini ilanın terimleriyle anlattık; skorun ${fark} puan arttı. Her değişikliği aşağıda görebilir, istemediğini eski hâline döndürebilirsin.`
                : onayBekleyenUyum > 0
                  ? `${onayBekleyenUyum} maddede deneyimini ilanın terimiyle anlattık. Doğru bulduklarını onayladığında skorun güncellenir.`
                  : sonra === once
                  ? "Skor değişmedi. İlanın aradığı şeylerin CV'nde bir karşılığını bulamadık; olmayan bir deneyimi eklemiyoruz."
                  : "Değişiklikleri aşağıda tek tek görebilir, istemediğini eski hâline döndürebilirsin."}
            </p>
          </div>

          <div className="flex items-center gap-4 self-center md:self-auto">
            <div className="text-center">
              <SkorHalkasi skor={once} boyut={92} className="opacity-60 grayscale" />
              <p className="mt-1 text-xs font-semibold text-gri">Önce</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ArrowRight className="size-5 text-gri" aria-hidden />
              {fark !== 0 && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-bold",
                    fark > 0 ? "bg-yesil/15 text-yesil dark:text-[#4ade80]" : "bg-kirmizi/10 text-kirmizi dark:text-[#f87171]",
                  )}
                >
                  {fark > 0 ? `+${fark}` : fark}
                </span>
              )}
            </div>
            <div className="text-center">
              <SkorHalkasi skor={sonra} boyut={132} />
              <p className={cn("mt-1 text-xs font-semibold", skorDurumu(sonra).textClass)}>Sonra</p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="space-y-6">
          {draft.summary.original && (
            <motion.section {...giris(0.06)} className="rounded-kart border border-cizgi bg-kart p-5 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="m-0 text-lg">Özet</h2>
                <Secim
                  deger={draft.summary.decision === "rejected" ? "rejected" : "accepted"}
                  mesgul={mesgul}
                  onSec={(d) => void karar("summary", d)}
                />
              </div>
              <KontrolUyarisi v={draft.summary.verification} />
              <Fark original={draft.summary.original} rewritten={draft.summary.rewritten} />
            </motion.section>
          )}

          <motion.section {...giris(0.1)} className="rounded-kart border border-cizgi bg-kart p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="m-0 text-lg">Deneyim maddeleri</h2>
              {degisenler.length > 0 && (
                <p className="m-0 text-sm text-gri">
                  {kararVerilen}/{degisenler.length} karar verildi
                </p>
              )}
            </div>
            {degisenler.length > 0 ? (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zemin">
                <div
                  className="h-full rounded-full bg-mavi transition-[width] duration-500"
                  style={{ width: `${(kararVerilen / degisenler.length) * 100}%` }}
                />
              </div>
            ) : (
              <p className="mt-2 text-sm text-gri">
                Maddelerinde ilanın terimleriyle anlatılabilecek bir şey bulamadık, o yüzden olduğu gibi bıraktık.
              </p>
            )}

            {degisenler.length > 0 && (
              <ol className="mt-5 space-y-3">
                {degisenler.map(({ madde, sira }) => (
                  <li
                    key={madde.id}
                    className={cn(
                      "rounded-buton border p-4 transition",
                      madde.decision === "pending" ? "border-mavi/30 bg-mavi/[0.03]" : "border-cizgi",
                    )}
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-gri">
                        Madde {sira}
                        {madde.decision === "pending" && <span className="ml-2 text-mavi">· Karar bekliyor</span>}
                      </span>
                      <Secim deger={madde.decision} mesgul={mesgul} onSec={(d) => void karar(madde.id, d)} />
                    </div>
                    <KontrolUyarisi v={madde.verification} />
                    <Fark original={madde.original} rewritten={madde.rewritten} />
                    {(madde.alignments?.length ?? 0) > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {madde.alignments!.map((a) => (
                          <li key={a.term} className="flex gap-2 text-sm text-gri">
                            <Link2 className="mt-0.5 size-3.5 shrink-0 text-mavi" aria-hidden />
                            <span>
                              <span className="font-semibold text-metin">{a.term}</span>, senin{" "}
                              <span className="text-metin">&ldquo;{a.basis}&rdquo;</span> ifadene dayanıyor.
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {madde.decision === "pending" &&
                      madde.verification.status === "ok" &&
                      (madde.alignments?.length ?? 0) > 0 && (
                        <p className="mt-3 text-sm font-medium text-metin">
                          Bu terim deneyimini doğru anlatıyorsa yeni hâlini seç; anlatmıyorsa eski hâli kalsın.
                        </p>
                      )}
                  </li>
                ))}
              </ol>
            )}

            {degismeyenler.length > 0 && (
              <details className="group mt-4">
                <summary className="flex cursor-pointer list-none items-center gap-1 text-sm text-gri">
                  Olduğu gibi kalan maddeler ({degismeyenler.length})
                  <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
                </summary>
                <ul className="mt-3 space-y-2">
                  {degismeyenler.map(({ madde }) => (
                    <li key={madde.id} className="rounded-buton bg-zemin px-3 py-2 text-sm">
                      {madde.original}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </motion.section>

          <motion.section {...giris(0.14)} className="rounded-kart border border-cizgi bg-kart p-5 sm:p-6">
            <h2 className="m-0 text-lg">Beceriler</h2>
            <p className="mt-1 text-sm text-gri">
              {eklenenler.size > 0
                ? "İlanın aradığı ve deneyim maddelerinde geçen beceriler listeye eklendi; ilana en çok uyanlar başa alındı. Hiçbir beceri silinmedi."
                : "İlana en çok uyanlar başa alındı. Hiçbir beceri eklenmedi veya silinmedi."}
            </p>
            <ol className="mt-4 flex flex-wrap gap-2">
              {draft.skillOrder.map((b, i) => (
                <li
                  key={b}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm",
                    eklenenler.has(b) ? "border-mavi/40 bg-mavi/10" : "border-cizgi bg-zemin",
                  )}
                >
                  <span className="text-xs font-semibold text-gri tabular-nums">{i + 1}</span>
                  {b}
                  {eklenenler.has(b) && (
                    <span className="text-[11px] font-semibold text-mavi dark:text-[#8ea2ff]">CV&apos;nden</span>
                  )}
                </li>
              ))}
            </ol>
          </motion.section>

          <OnYaziBolumu adaptationId={id} baslangic={durum.coverLetter} />
        </div>

        {/* İndirme paneli: masaüstünde yapışkan. */}
        <motion.aside {...giris(0.08)} className="space-y-4 lg:sticky lg:top-24">
          <div className="rounded-kart border border-cizgi bg-kart p-5">
            <h2 className="m-0 flex items-center gap-2 text-base">
              <Download className="size-4 text-mavi" aria-hidden />
              İndir
            </h2>
            {bekleyen > 0 ? (
              <p className="mt-2 text-sm text-gri">
                <span className="font-semibold text-metin">{bekleyen} madde</span> için karar bekliyoruz. Karar
                verince indirme açılır.
              </p>
            ) : (
              <p className="mt-2 text-sm text-gri">Seçtiğin hâllerle CV&apos;ni indirebilirsin.</p>
            )}
            {hata && (
              <p role="alert" className="mt-2 text-sm text-kirmizi dark:text-[#f87171]">
                {hata}
              </p>
            )}
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-buton bg-mavi px-5 py-3 font-semibold text-white shadow-sm shadow-mavi/30 transition hover:bg-mavi/90 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={mesgul || bekleyen > 0}
                onClick={() => void indir("pdf")}
              >
                <FileText className="size-4" aria-hidden />
                PDF indir
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-buton border border-cizgi px-5 py-2.5 font-semibold transition hover:border-mavi/40 hover:text-mavi disabled:cursor-not-allowed disabled:opacity-50"
                disabled={mesgul || bekleyen > 0}
                onClick={() => void indir("docx")}
              >
                Word indir
              </button>
            </div>
          </div>

          <Link
            href="/applications"
            className="flex items-center gap-3 rounded-kart border border-cizgi bg-kart p-4 text-sm no-underline transition hover:border-mavi/40"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-buton bg-mavi/10 text-mavi">
              <LayoutGrid className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-metin">Başvuru panosu</span>
              <span className="block text-gri">Bu başvuruyu takip et</span>
            </span>
            <ArrowRight className="size-4 text-gri" aria-hidden />
          </Link>

          {/* Marka rehberi §11: yapay zekâ şeffaflığı ve uydurmama ilkesi. */}
          <p className="flex gap-2 px-1 text-xs text-gri">
            <ShieldCheck className="size-4 shrink-0 text-yesil dark:text-[#4ade80]" aria-hidden />
            Metinler yapay zekâ ile yeniden yazıldı. Hiçbir deneyim, beceri veya sertifika eklenmedi; eğitim ve
            sertifikalarına hiç dokunulmadı.
          </p>
        </motion.aside>
      </div>
    </div>
  )
}
