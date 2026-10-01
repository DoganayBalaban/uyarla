"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
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
import { apiErrorMessage } from "@/lib/api"
import { cn } from "@/lib/cn"
import { adaptationQueryKey, decide, downloadAdaptation, useAdaptation } from "@/features/adaptation/api"
import { deriveStageStates } from "@/features/analysis/stageStates"
import { CoverLetterSection } from "@/features/adaptation/components/CoverLetterSection"
import type { AdaptationState, Verification } from "@/features/adaptation/types"
import { StageTimeline } from "@/features/analysis/components/StageTimeline"
import { ScoreRing } from "@/features/analysis/components/ScoreRing"
import { scoreStatus } from "@/lib/scoreStatus"

/** Marka rehberi §10.2 tonunda yükleme metinleri. */
const STAGES = [
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

function DiffText({ original, rewritten }: { original: string; rewritten: string }) {
  return (
    <p className="m-0 leading-relaxed">
      {diffWords(original, rewritten).map((part, i) =>
        part.kind === "same" ? (
          <span key={i}>{part.text} </span>
        ) : (
          <span
            key={i}
            className={
              part.kind === "added"
                ? "rounded bg-brand-green/15 px-0.5 text-foreground decoration-brand-green/60 underline-offset-2"
                : "text-muted line-through decoration-muted/60"
            }
          >
            {part.text}{" "}
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
function DecisionToggle({
  val,
  canPickNew = true,
  busy,
  onSelect,
}: {
  val: string
  canPickNew?: boolean
  busy: boolean
  onSelect: (d: "accepted" | "rejected") => void
}) {
  const options = [
    ...(canPickNew ? [{ d: "accepted" as const, label: "Yeni hâli" }] : []),
    { d: "rejected" as const, label: "Eski hâli" },
  ]
  return (
    <div role="radiogroup" aria-label="Hangi hâli kullanılsın?" className="inline-flex rounded-button bg-background p-1 text-sm">
      {options.map((s) => {
        const selected = val === s.d
        return (
          <button
            key={s.d}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={busy || selected}
            onClick={() => onSelect(s.d)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 font-semibold transition disabled:cursor-default",
              selected ? "bg-card text-brand-blue shadow-sm" : "text-muted hover:text-foreground",
            )}
          >
            {selected && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
            {s.label}
          </button>
        )
      })}
    </div>
  )
}

function VerificationWarning({ v }: { v: Verification }) {
  if (v.status !== "flagged") return null
  return (
    <div className="mb-3 flex gap-2.5 rounded-button bg-brand-amber/10 p-3 text-sm">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-brand-amber" aria-hidden />
      <div>
        <p className="m-0 font-semibold text-brand-amber">Kontrol et</p>
        {v.issues.map((problemCount, i) => (
          <p className="m-0 mt-0.5 text-foreground/80" key={i}>
            {problemCount.detail}
          </p>
        ))}
      </div>
    </div>
  )
}

export function AdaptationView({ id }: { id: string }) {
  const reducedMotion = useReducedMotion() ?? false
  const queryClient = useQueryClient()
  const { data: state } = useAdaptation(id)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [busy, setIsBusy] = useState(false)

  async function decisionValue(itemId: string, decision: "accepted" | "rejected") {
    setIsBusy(true)
    try {
      const parsed = await decide(id, itemId, decision)
      queryClient.setQueryData<AdaptationState>(adaptationQueryKey(id), (d) => (d ? { ...d, ...parsed } : d))
    } catch {
      // Karar kaydedilemedi: madde olduğu gibi kalıyor, kullanıcı tekrar deneyebilir.
    } finally {
      setIsBusy(false)
    }
  }

  async function downloadFile(format: "pdf" | "docx") {
    setErrorMessage(null)
    setIsBusy(true)
    try {
      const url = URL.createObjectURL(await downloadAdaptation(id, format))
      const a = document.createElement("a")
      a.href = url
      a.download = `uyarla-cv.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setErrorMessage(await apiErrorMessage(error, "İndirilemedi."))
    } finally {
      setIsBusy(false)
    }
  }

  if (!state || state.status === "running") {
    return (
      <div className="mx-auto max-w-2xl">
        <StageTimeline
          heading="Uyarlaman hazırlanıyor"
          subtitle="Genelde bir dakikadan kısa sürüyor. Sayfadan ayrılma."
          stages={deriveStageStates(STAGES, state?.stage ?? null)}
        />
      </div>
    )
  }

  if (state.status === "failed" || !state.draft) {
    return (
      <div className="mx-auto max-w-md rounded-card border border-border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand-red/10 text-brand-red dark:text-[#f87171]">
          <CircleAlert className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl">Uyarlama tamamlanamadı</h1>
        <p className="mt-2 text-sm text-muted">Birazdan tekrar dener misin? CV&apos;n ve ilanın kayıtlı.</p>
        <Link
          href="/analyze"
          className="mt-6 inline-flex items-center gap-2 rounded-button bg-brand-blue px-5 py-3 font-semibold text-white no-underline"
        >
          Yeni analiz
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    )
  }

  const { draft } = state
  const pendingCount = draft.bullets.filter((b) => b.decision === "pending").length
  // Hedefi olmayan maddeler hiç yazılmıyor (K-38); onlar ayrı, katlanmış
  // listede duruyor ki kullanıcı yalnızca gerçekten değişenlere baksın.
  const ordered = draft.bullets.map((bullet, i) => ({ bullet, order: i + 1 }))
  const changedBullets = ordered.filter(({ bullet }) => bullet.rewritten !== bullet.original)
  const unchangedBullets = ordered.filter(({ bullet }) => bullet.rewritten === bullet.original)
  const decided = changedBullets.length - pendingCount
  const added = new Set(draft.addedSkills ?? [])
  const pendingAlignment = changedBullets.filter(
    ({ bullet }) => bullet.decision === "pending" && (bullet.alignments?.length ?? 0) > 0,
  ).length
  const before = state.scoreBefore ?? 0
  const after = state.scoreAfter ?? 0
  const diff = after - before
  const entrance = (delayMs: number) =>
    reducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.4, delay: delayMs, ease: [0.22, 1, 0.36, 1] as const },
        }

  return (
    <div className="space-y-6">
      {/* Skor kartı: önce → sonra. Skor ekranın en büyük öğesi (§9.5). */}
      <motion.div
        {...entrance(0)}
        className="relative overflow-hidden rounded-card border border-border bg-card p-6 shadow-sm sm:p-8"
      >
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-brand-blue/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-md">
            <p className="text-xs font-semibold tracking-wider text-muted uppercase">Uyarlama</p>
            <h1 className="mt-1 text-3xl">CV&apos;n hazır</h1>
            <p className="mt-2 text-sm text-muted">
              {diff > 0
                ? `Deneyimini ilanın terimleriyle anlattık; skorun ${diff} puan arttı. Her değişikliği aşağıda görebilir, istemediğini eski hâline döndürebilirsin.`
                : pendingAlignment > 0
                  ? `${pendingAlignment} maddede deneyimini ilanın terimiyle anlattık. Doğru bulduklarını onayladığında skorun güncellenir.`
                  : after === before
                  ? "Skor değişmedi. İlanın aradığı şeylerin CV'nde bir karşılığını bulamadık; olmayan bir deneyimi eklemiyoruz."
                  : "Değişiklikleri aşağıda tek tek görebilir, istemediğini eski hâline döndürebilirsin."}
            </p>
          </div>

          <div className="flex items-center gap-4 self-center md:self-auto">
            <div className="text-center">
              <ScoreRing score={before} size={92} className="opacity-60 grayscale" />
              <p className="mt-1 text-xs font-semibold text-muted">Önce</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ArrowRight className="size-5 text-muted" aria-hidden />
              {diff !== 0 && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-bold",
                    diff > 0 ? "bg-brand-green/15 text-brand-green dark:text-[#4ade80]" : "bg-brand-red/10 text-brand-red dark:text-[#f87171]",
                  )}
                >
                  {diff > 0 ? `+${diff}` : diff}
                </span>
              )}
            </div>
            <div className="text-center">
              <ScoreRing score={after} size={132} />
              <p className={cn("mt-1 text-xs font-semibold", scoreStatus(after).textClass)}>Sonra</p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="space-y-6">
          {draft.summary.original && (
            <motion.section {...entrance(0.06)} className="rounded-card border border-border bg-card p-5 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="m-0 text-lg">Özet</h2>
                <DecisionToggle
                  val={draft.summary.decision === "rejected" ? "rejected" : "accepted"}
                  busy={busy}
                  onSelect={(d) => void decisionValue("summary", d)}
                />
              </div>
              <VerificationWarning v={draft.summary.verification} />
              <DiffText original={draft.summary.original} rewritten={draft.summary.rewritten} />
            </motion.section>
          )}

          <motion.section {...entrance(0.1)} className="rounded-card border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="m-0 text-lg">Deneyim maddeleri</h2>
              {changedBullets.length > 0 && (
                <p className="m-0 text-sm text-muted">
                  {decided}/{changedBullets.length} karar verildi
                </p>
              )}
            </div>
            {changedBullets.length > 0 ? (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-brand-blue transition-[width] duration-500"
                  style={{ width: `${(decided / changedBullets.length) * 100}%` }}
                />
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">
                Maddelerinde ilanın terimleriyle anlatılabilecek bir şey bulamadık, o yüzden olduğu gibi bıraktık.
              </p>
            )}

            {changedBullets.length > 0 && (
              <ol className="mt-5 space-y-3">
                {changedBullets.map(({ bullet, order }) => (
                  <li
                    key={bullet.id}
                    className={cn(
                      "rounded-button border p-4 transition",
                      bullet.decision === "pending" ? "border-brand-blue/30 bg-brand-blue/[0.03]" : "border-border",
                    )}
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-muted">
                        Madde {order}
                        {bullet.decision === "pending" && <span className="ml-2 text-brand-blue">· Karar bekliyor</span>}
                      </span>
                      <DecisionToggle val={bullet.decision} busy={busy} onSelect={(d) => void decisionValue(bullet.id, d)} />
                    </div>
                    <VerificationWarning v={bullet.verification} />
                    <DiffText original={bullet.original} rewritten={bullet.rewritten} />
                    {(bullet.alignments?.length ?? 0) > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {bullet.alignments!.map((a) => (
                          <li key={a.term} className="flex gap-2 text-sm text-muted">
                            <Link2 className="mt-0.5 size-3.5 shrink-0 text-brand-blue" aria-hidden />
                            <span>
                              <span className="font-semibold text-foreground">{a.term}</span>, senin{" "}
                              <span className="text-foreground">&ldquo;{a.basis}&rdquo;</span> ifadene dayanıyor.
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {bullet.decision === "pending" &&
                      bullet.verification.status === "ok" &&
                      (bullet.alignments?.length ?? 0) > 0 && (
                        <p className="mt-3 text-sm font-medium text-foreground">
                          Bu terim deneyimini doğru anlatıyorsa yeni hâlini seç; anlatmıyorsa eski hâli kalsın.
                        </p>
                      )}
                  </li>
                ))}
              </ol>
            )}

            {unchangedBullets.length > 0 && (
              <details className="group mt-4">
                <summary className="flex cursor-pointer list-none items-center gap-1 text-sm text-muted">
                  Olduğu gibi kalan maddeler ({unchangedBullets.length})
                  <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
                </summary>
                <ul className="mt-3 space-y-2">
                  {unchangedBullets.map(({ bullet }) => (
                    <li key={bullet.id} className="rounded-button bg-background px-3 py-2 text-sm">
                      {bullet.original}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </motion.section>

          <motion.section {...entrance(0.14)} className="rounded-card border border-border bg-card p-5 sm:p-6">
            <h2 className="m-0 text-lg">Beceriler</h2>
            <p className="mt-1 text-sm text-muted">
              {added.size > 0
                ? "İlanın aradığı ve deneyim maddelerinde geçen beceriler listeye eklendi; ilana en çok uyanlar başa alındı. Hiçbir beceri silinmedi."
                : "İlana en çok uyanlar başa alındı. Hiçbir beceri eklenmedi veya silinmedi."}
            </p>
            <ol className="mt-4 flex flex-wrap gap-2">
              {draft.skillOrder.map((b, i) => (
                <li
                  key={b}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm",
                    added.has(b) ? "border-brand-blue/40 bg-brand-blue/10" : "border-border bg-background",
                  )}
                >
                  <span className="text-xs font-semibold text-muted tabular-nums">{i + 1}</span>
                  {b}
                  {added.has(b) && (
                    <span className="text-[11px] font-semibold text-brand-blue dark:text-[#8ea2ff]">CV&apos;nden</span>
                  )}
                </li>
              ))}
            </ol>
          </motion.section>

          <CoverLetterSection adaptationId={id} letter={state.coverLetter} />
        </div>

        {/* İndirme paneli: masaüstünde yapışkan. */}
        <motion.aside {...entrance(0.08)} className="space-y-4 lg:sticky lg:top-24">
          <div className="rounded-card border border-border bg-card p-5">
            <h2 className="m-0 flex items-center gap-2 text-base">
              <Download className="size-4 text-brand-blue" aria-hidden />
              İndir
            </h2>
            {pendingCount > 0 ? (
              <p className="mt-2 text-sm text-muted">
                <span className="font-semibold text-foreground">{pendingCount} madde</span> için karar bekliyoruz. Karar
                verince indirme açılır.
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted">Seçtiğin hâllerle CV&apos;ni indirebilirsin.</p>
            )}
            {errorMessage && (
              <p role="alert" className="mt-2 text-sm text-brand-red dark:text-[#f87171]">
                {errorMessage}
              </p>
            )}
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-button bg-brand-blue px-5 py-3 font-semibold text-white shadow-sm shadow-brand-blue/30 transition hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={busy || pendingCount > 0}
                onClick={() => void downloadFile("pdf")}
              >
                <FileText className="size-4" aria-hidden />
                PDF indir
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-button border border-border px-5 py-2.5 font-semibold transition hover:border-brand-blue/40 hover:text-brand-blue disabled:cursor-not-allowed disabled:opacity-50"
                disabled={busy || pendingCount > 0}
                onClick={() => void downloadFile("docx")}
              >
                Word indir
              </button>
            </div>
          </div>

          <Link
            href="/applications"
            className="flex items-center gap-3 rounded-card border border-border bg-card p-4 text-sm no-underline transition hover:border-brand-blue/40"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-button bg-brand-blue/10 text-brand-blue">
              <LayoutGrid className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-foreground">Başvuru panosu</span>
              <span className="block text-muted">Bu başvuruyu takip et</span>
            </span>
            <ArrowRight className="size-4 text-muted" aria-hidden />
          </Link>

          {/* Marka rehberi §11: yapay zekâ şeffaflığı ve uydurmama ilkesi. */}
          <p className="flex gap-2 px-1 text-xs text-muted">
            <ShieldCheck className="size-4 shrink-0 text-brand-green dark:text-[#4ade80]" aria-hidden />
            Metinler yapay zekâ ile yeniden yazıldı. Hiçbir deneyim, beceri veya sertifika eklenmedi; eğitim ve
            sertifikalarına hiç dokunulmadı.
          </p>
        </motion.aside>
      </div>
    </div>
  )
}
