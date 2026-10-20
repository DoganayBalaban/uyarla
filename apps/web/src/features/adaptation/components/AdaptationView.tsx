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
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react"
import { DiffText } from "@/features/adaptation/components/DiffText"
import { DocumentView } from "@/features/adaptation/components/DocumentView"
import { DecisionToggle, VerificationWarning } from "@/features/adaptation/components/DecisionControls"
import { EditText } from "@/features/adaptation/components/EditText"
import { PlatformTips } from "@/features/analysis/components/PlatformTips"
import { ContributionsSection } from "@/features/adaptation/components/ContributionsSection"
import { apiErrorMessage } from "@/lib/api"
import { cn } from "@/lib/cn"
import {
  adaptationQueryKey,
  decide,
  decideAll,
  downloadAdaptation,
  editItem,
  restoreBullet,
  setLayout,
  useAdaptation,
} from "@/features/adaptation/api"
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

export function AdaptationView({ id }: { id: string }) {
  const reducedMotion = useReducedMotion() ?? false
  const queryClient = useQueryClient()
  const { data: state } = useAdaptation(id)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [busy, setIsBusy] = useState(false)
  // Değişiklikler: madde madde karar. Belge: CV'nin tamamı (DOG-93).
  const [view, setView] = useState<"changes" | "document">("changes")

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

  /** Metni elle düzenleme (DOG-92); hata metni ya da null döner. */
  async function saveEdit(itemId: string, text: string): Promise<string | null> {
    setIsBusy(true)
    try {
      const parsed = await editItem(id, itemId, text)
      queryClient.setQueryData<AdaptationState>(adaptationQueryKey(id), (d) => (d ? { ...d, ...parsed } : d))
      return null
    } catch (error) {
      return apiErrorMessage(error, "Düzenlemeyi kaydedemedik. Tekrar dener misin?")
    } finally {
      setIsBusy(false)
    }
  }

  async function bulkDecision(action: "accept_verified" | "reject_all") {
    setIsBusy(true)
    try {
      const parsed = await decideAll(id, action)
      queryClient.setQueryData<AdaptationState>(adaptationQueryKey(id), (d) => (d ? { ...d, ...parsed } : d))
    } catch {
      // Tek karardaki gibi: kaydedilemediyse ekran eski hâlinde kalıyor.
    } finally {
      setIsBusy(false)
    }
  }

  // Tek sayfa planının son sonucu (DOG-93); yalnızca seçim yapılan oturumda.
  const [onePage, setOnePage] = useState<{ fits: boolean; pages: number } | null>(null)

  async function changeLayout(layout: "full" | "onePage") {
    setErrorMessage(null)
    setIsBusy(true)
    try {
      const { onePage: plan, ...parsed } = await setLayout(id, layout)
      setOnePage(plan ?? null)
      queryClient.setQueryData<AdaptationState>(adaptationQueryKey(id), (d) => (d ? { ...d, ...parsed } : d))
    } catch (error) {
      setErrorMessage(await apiErrorMessage(error, "Belge düzeni değiştirilemedi."))
    } finally {
      setIsBusy(false)
    }
  }

  async function restore(bulletId: string) {
    setIsBusy(true)
    try {
      const parsed = await restoreBullet(id, bulletId)
      // Geri alınan madde belgeyi yeniden bir sayfanın üstüne taşıyabilir.
      setOnePage(null)
      queryClient.setQueryData<AdaptationState>(adaptationQueryKey(id), (d) => (d ? { ...d, ...parsed } : d))
    } catch {
      // Kaydedilemediyse madde çıkarılmış olarak kalıyor; tekrar denenebilir.
    } finally {
      setIsBusy(false)
    }
  }

  async function downloadFile(format: "pdf" | "docx") {
    setErrorMessage(null)
    setIsBusy(true)
    try {
      const { blob, fileName } = await downloadAdaptation(id, format)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = fileName
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
  // Yazımı bitmiş katkılar da maddeler gibi karar bekleyebilir (DOG-94).
  const writtenContributions = (draft.contributions ?? []).filter((c) => c.status === "done" && c.text)
  const pendingCount =
    draft.bullets.filter((b) => b.decision === "pending").length +
    writtenContributions.filter((c) => c.decision === "pending").length
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
  // Toplu karar (DOG-93). Yalnızca uydurma kontrolünden temiz geçenler toplu
  // kabul edilebiliyor; uyarılı maddeler tek tek okunmalı (K-26).
  const summaryChanged = !!draft.summary.original && draft.summary.original !== draft.summary.rewritten
  const acceptable =
    changedBullets.filter(({ bullet }) => bullet.verification.status === "ok" && bullet.decision !== "accepted").length +
    (summaryChanged && draft.summary.verification.status === "ok" && draft.summary.decision !== "accepted" ? 1 : 0) +
    writtenContributions.filter((c) => c.verification?.status !== "flagged" && c.decision !== "accepted").length
  const alignmentTerms = [
    ...new Set([
      ...changedBullets
        .filter(({ bullet }) => bullet.verification.status === "ok" && bullet.decision === "pending")
        .flatMap(({ bullet }) => (bullet.alignments ?? []).map((a) => a.term)),
      ...writtenContributions
        .filter((c) => c.verification?.status !== "flagged" && c.decision === "pending")
        .flatMap((c) => (c.alignments ?? []).map((a) => a.term)),
    ]),
  ]
  const flaggedPending =
    changedBullets.filter(({ bullet }) => bullet.decision === "pending" && bullet.verification.status === "flagged").length +
    writtenContributions.filter((c) => c.decision === "pending" && c.verification?.status === "flagged").length
  const anyNew =
    changedBullets.some(({ bullet }) => bullet.decision !== "rejected") ||
    (summaryChanged && draft.summary.decision !== "rejected") ||
    writtenContributions.some((c) => c.decision !== "rejected")
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
          {(acceptable > 0 || anyNew) && (
            <motion.section
              {...entrance(0.04)}
              aria-label="Toplu karar"
              className="flex flex-col gap-3 rounded-card border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="text-sm">
                {acceptable > 0 ? (
                  <>
                    <p className="m-0 font-semibold">
                      Uyarısız {acceptable} değişikliği tek seferde yeni hâline alabilirsin.
                    </p>
                    {alignmentTerms.length > 0 && (
                      <p className="m-0 mt-0.5 text-muted">
                        Bunlarda şu terimleri kullandık: {alignmentTerms.join(", ")}. Hepsi deneyimini doğru anlatıyorsa onayla.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="m-0 font-semibold">Değişikliklerin hepsi seçili.</p>
                )}
                {flaggedPending > 0 && (
                  <p className="m-0 mt-0.5 text-muted">
                    Uyarılı {flaggedPending} madde bu işleme dahil değil; onlara tek tek bakman gerekiyor.
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {acceptable > 0 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void bulkDecision("accept_verified")}
                    className="inline-flex items-center gap-1.5 rounded-button bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-blue/90 disabled:opacity-50"
                  >
                    <Check className="size-4" strokeWidth={3} aria-hidden />
                    Hepsini yeni hâline al
                  </button>
                )}
                {anyNew && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void bulkDecision("reject_all")}
                    className="inline-flex items-center gap-1.5 rounded-button border border-border px-4 py-2 text-sm font-semibold transition hover:border-brand-blue/40 hover:text-brand-blue disabled:opacity-50"
                  >
                    <RotateCcw className="size-4" aria-hidden />
                    Hepsini eski hâline döndür
                  </button>
                )}
              </div>
            </motion.section>
          )}

          {state.document && (
            <div role="tablist" aria-label="Görünüm" className="inline-flex rounded-button bg-card p-1 text-sm shadow-sm">
              {(
                [
                  ["changes", "Değişiklikler"],
                  ["document", "Belge"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={cn(
                    "rounded-[8px] px-4 py-1.5 font-semibold transition",
                    view === v ? "bg-brand-blue text-white" : "text-muted hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {view === "document" && state.document ? (
            <DocumentView document={state.document} draft={draft} onRestore={(b) => void restore(b)} />
          ) : (
            <>
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
                  <EditText
                    text={draft.summary.rewritten}
                    edited={draft.summary.edited}
                    busy={busy}
                    onSave={(text) => saveEdit("summary", text)}
                  />
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
                        <EditText
                          text={bullet.rewritten}
                          edited={bullet.edited}
                          busy={busy}
                          onSave={(text) => saveEdit(bullet.id, text)}
                        />
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

              {state.document && (
                <ContributionsSection
                  adaptationId={id}
                  missing={state.missingRequirements ?? []}
                  contributions={draft.contributions ?? []}
                  experience={state.document.before.experience}
                  busy={busy}
                  onDecide={(itemId, d) => void decisionValue(itemId, d)}
                />
              )}

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
                        <span className="text-[11px] font-semibold text-brand-blue dark:text-brand-blue-light">CV&apos;nden</span>
                      )}
                    </li>
                  ))}
                </ol>
              </motion.section>
            </>
          )}

          <CoverLetterSection adaptationId={id} letter={state.coverLetter} checks={state.coverLetterChecks ?? null} />
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
            <LayoutChoice
              layout={draft.layout ?? "full"}
              omittedCount={draft.omitted?.length ?? 0}
              onePage={onePage}
              busy={busy}
              onChange={(l) => void changeLayout(l)}
              onShow={() => setView("document")}
            />
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

          <PlatformTips platform={state.platform} />

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

/**
 * Belge stratejisi (DOG-93): tam ya da tek sayfa. Tek sayfada önce sıkı
 * yerleşim deneniyor; yetmezse ilana en az ilgili maddeler çıkarılıyor, skor
 * düşmüyor. Çıkarılanlar belge görünümünde, geri alınabilir.
 */
function LayoutChoice({
  layout,
  omittedCount,
  onePage,
  busy,
  onChange,
  onShow,
}: {
  layout: "full" | "onePage"
  omittedCount: number
  onePage: { fits: boolean; pages: number } | null
  busy: boolean
  onChange: (layout: "full" | "onePage") => void
  onShow: () => void
}) {
  return (
    <div className="mt-4">
      <p className="m-0 text-xs font-semibold tracking-wider text-muted uppercase">Belge düzeni</p>
      <div role="radiogroup" aria-label="Belge düzeni" className="mt-1.5 inline-flex rounded-button bg-background p-1 text-sm">
        {(
          [
            ["full", "Tam"],
            ["onePage", "Tek sayfa"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={layout === value}
            disabled={busy}
            onClick={() => layout !== value && onChange(value)}
            className={cn(
              "rounded-[8px] px-3 py-1.5 font-semibold transition disabled:opacity-50",
              layout === value ? "bg-card text-brand-blue shadow-sm" : "text-muted hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {layout === "onePage" && (
        <p className="mt-2 text-sm text-muted">
          {omittedCount === 0
            ? "Sıkı yerleşimle tek sayfaya sığıyor; içerikten bir şey çıkmadı."
            : (
                <>
                  Tek sayfaya sığması için ilana en az ilgili {omittedCount} madde çıkarıldı; skor düşmedi.{" "}
                  <button type="button" onClick={onShow} className="font-semibold text-brand-blue underline-offset-2 hover:underline">
                    Belgede gör
                  </button>
                </>
              )}
          {onePage && !onePage.fits && (
            <span className="mt-1 block">
              Yine de {onePage.pages} sayfa: kalan maddeler ilanın gereksinimlerine kanıt, onları çıkarmadık.
            </span>
          )}
        </p>
      )}
    </div>
  )
}
