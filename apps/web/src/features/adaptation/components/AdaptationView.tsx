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
  Link2,
  RotateCcw,
  ShieldCheck,
  SquareKanban,
} from "lucide-react"
import { AppPage } from "@/components/layout/app-shell/AppPage"
import { PageActions } from "@/components/layout/app-shell/PageActions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { DiffText } from "@/features/adaptation/components/DiffText"
import { DocumentView } from "@/features/adaptation/components/DocumentView"
import { DecisionToggle, VerificationWarning } from "@/features/adaptation/components/DecisionControls"
import { EditText } from "@/features/adaptation/components/EditText"
import { PlatformTips } from "@/features/analysis/components/PlatformTips"
import { FormAnswersSection } from "@/features/adaptation/components/FormAnswersSection"
import { ContributionsSection } from "@/features/adaptation/components/ContributionsSection"
import { apiErrorMessage } from "@/lib/api"
import { cn } from "@/lib/cn"
import {
  adaptationQueryKey,
  decide,
  decideAll,
  downloadAdaptation,
  editItem,
  previewEdit,
  restoreBullet,
  changeBullet,
  changeSection,
  type BulletOp,
  type SectionOp,
  setLayout,
  useAdaptation,
} from "@/features/adaptation/api"
import { CoverLetterSection } from "@/features/adaptation/components/CoverLetterSection"
import type { AdaptationState } from "@/features/adaptation/types"
import { AdaptationWaiting } from "@/features/adaptation/components/AdaptationWaiting"
import { ScoreRing } from "@/features/analysis/components/ScoreRing"
import { scoreStatus } from "@/lib/scoreStatus"


type View = "changes" | "document" | "letter" | "answers"

export function AdaptationView({ id }: { id: string }) {
  const reducedMotion = useReducedMotion() ?? false
  const queryClient = useQueryClient()
  const { data: state } = useAdaptation(id)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [busy, setIsBusy] = useState(false)
  // Değişiklikler: madde madde karar. Belge: CV'nin tamamı (DOG-93). Ön yazı
  // ve form yanıtları da sekmede (DOG-147).
  const [view, setView] = useState<View>("changes")

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

  /** Madde ekle, kaldır, taşı (DOG-92); hata mesajını döndürüyor. */
  async function bulletChange(op: BulletOp): Promise<string | null> {
    setIsBusy(true)
    try {
      const parsed = await changeBullet(id, op)
      // Madde sayısı değişince tek sayfa sonucu bayatlıyor.
      setOnePage(null)
      queryClient.setQueryData<AdaptationState>(adaptationQueryKey(id), (d) => (d ? { ...d, ...parsed } : d))
      return null
    } catch (error) {
      return apiErrorMessage(error, "Kaydedemedik. Tekrar dener misin?")
    } finally {
      setIsBusy(false)
    }
  }

  /** Bölüm sırası, bölüm ekle ya da sil (DOG-92); hata mesajını döndürüyor. */
  async function sectionChange(op: SectionOp): Promise<string | null> {
    setIsBusy(true)
    try {
      const parsed = await changeSection(id, op)
      setOnePage(null)
      queryClient.setQueryData<AdaptationState>(adaptationQueryKey(id), (d) => (d ? { ...d, ...parsed } : d))
      return null
    } catch (error) {
      return apiErrorMessage(error, "Kaydedemedik. Tekrar dener misin?")
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
      <AppPage width="narrow">
        <AdaptationWaiting stage={state?.stage ?? null} scoreBefore={state?.scoreBefore ?? null} preview={state?.preview ?? null} />
      </AppPage>
    )
  }

  if (state.status === "failed" || !state.draft) {
    return (
      <AppPage width="narrow">
        <Card className="mx-auto max-w-md items-center py-10 text-center">
          <CardContent className="flex flex-col items-center">
            <span className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
              <CircleAlert className="size-6" aria-hidden />
            </span>
            <h1 className="m-0 mt-4 text-xl font-semibold">Uyarlama tamamlanamadı</h1>
            <p className="m-0 mt-2 text-sm text-muted-foreground">Birazdan tekrar dener misin? CV&apos;n ve ilanın kayıtlı.</p>
            <Button asChild className="mt-6">
              <Link href="/analyze">
                Yeni analiz
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </AppPage>
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
  const decided = changedBullets.length - draft.bullets.filter((b) => b.decision === "pending" && b.rewritten !== b.original).length
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

  // Kullanıcı kendisi düzenlediyse (DOG-92) artışı uyarlamaya mal etmiyoruz.
  const userEdited =
    !!draft?.headline ||
    !!draft?.summary.edited ||
    !!draft?.bullets.some((b) => b.edited) ||
    !!draft?.userBullets?.length ||
    !!draft?.userSections?.length ||
    Object.keys(draft?.bulletPlacement ?? {}).length > 0 ||
    !!draft?.removed?.length ||
    !!draft?.sectionEdits?.hidden?.length

  const terms = state.postingTerms ?? []
  const changes = (
    <div className="space-y-6">
      {(acceptable > 0 || anyNew) && (
        <motion.section
          {...entrance(0.04)}
          aria-label="Toplu karar"
          className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="text-sm">
            {acceptable > 0 ? (
              <>
                <p className="m-0 font-semibold">Uyarısız {acceptable} değişikliği tek seferde yeni hâline alabilirsin.</p>
                {alignmentTerms.length > 0 && (
                  <p className="m-0 mt-0.5 text-muted-foreground">
                    Bunlarda şu terimleri kullandık: {alignmentTerms.join(", ")}. Hepsi deneyimini doğru anlatıyorsa onayla.
                  </p>
                )}
              </>
            ) : (
              <p className="m-0 font-semibold">Değişikliklerin hepsi seçili.</p>
            )}
            {flaggedPending > 0 && (
              <p className="m-0 mt-0.5 text-muted-foreground">
                Uyarılı {flaggedPending} madde bu işleme dahil değil; onlara tek tek bakman gerekiyor.
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {acceptable > 0 && (
              <Button type="button" size="sm" disabled={busy} onClick={() => void bulkDecision("accept_verified")}>
                <Check strokeWidth={3} aria-hidden />
                Hepsini yeni hâline al
              </Button>
            )}
            {anyNew && (
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void bulkDecision("reject_all")}>
                <RotateCcw aria-hidden />
                Hepsini eski hâline döndür
              </Button>
            )}
          </div>
        </motion.section>
      )}

      {/* Başlık satırı (DOG-92): uyarlama değiştirmiyor, yalnızca kullanıcı. */}
      {state.document && (
        <motion.div {...entrance(0.04)}>
          <Card className="gap-3 shadow-xs">
            <CardHeader>
              <CardTitle className="text-base">Başlık satırı</CardTitle>
              <CardDescription>
                Adının altındaki satır. İşe alımcılar çoğu zaman unvanla arıyor; deneyimin uyuyorsa ilandaki unvanı buraya
                yazabilirsin. Konumun ve bağlantıların da bu satırdaysa silme: indirilen CV&apos;den de çıkar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {draft.headline && <VerificationWarning v={draft.headline.verification} />}
              <p className="m-0 font-semibold">
                {state.document.after.headline ?? <span className="font-normal text-muted-foreground">CV&apos;nde başlık satırı yok.</span>}
              </p>
              <EditText
                text={state.document.after.headline ?? ""}
                edited={!!draft.headline}
                busy={busy}
                onSave={(text) => saveEdit("headline", text)}
                terms={terms}
                onPreview={(text, signal) => previewEdit(id, "headline", text, signal)}
                currentScore={state.scoreAfter ?? null}
              />
            </CardContent>
          </Card>
        </motion.div>
      )}
      {draft.summary.original && (
        <motion.div {...entrance(0.06)}>
          <Card className="gap-3 shadow-xs">
            <CardHeader>
              <CardTitle className="text-base">Özet</CardTitle>
              <CardAction>
                <DecisionToggle
                  val={draft.summary.decision === "rejected" ? "rejected" : "accepted"}
                  busy={busy}
                  onSelect={(d) => void decisionValue("summary", d)}
                />
              </CardAction>
            </CardHeader>
            <CardContent>
              <VerificationWarning v={draft.summary.verification} />
              <DiffText original={draft.summary.original} rewritten={draft.summary.rewritten} />
              <EditText
                text={draft.summary.rewritten}
                edited={draft.summary.edited}
                busy={busy}
                onSave={(text) => saveEdit("summary", text)}
                terms={terms}
                onPreview={(text, signal) => previewEdit(id, "summary", text, signal)}
                currentScore={state.scoreAfter ?? null}
              />
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div {...entrance(0.1)}>
        <Card className="gap-4 shadow-xs">
          <CardHeader>
            <CardTitle className="text-base">Deneyim maddeleri</CardTitle>
            {changedBullets.length > 0 ? (
              <div className="col-span-full mt-2 flex items-center gap-3">
                <Progress value={(decided / changedBullets.length) * 100} aria-label="Karar verilen maddeler" className="h-1.5" />
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {decided}/{changedBullets.length} karar verildi
                </span>
              </div>
            ) : (
              <CardDescription>
                Maddelerinde ilanın terimleriyle anlatılabilecek bir şey bulamadık, o yüzden olduğu gibi bıraktık.
              </CardDescription>
            )}
          </CardHeader>
          {(changedBullets.length > 0 || unchangedBullets.length > 0) && (
            <CardContent>
              {changedBullets.length > 0 && (
                <ol className="m-0 list-none space-y-3 p-0">
                  {changedBullets.map(({ bullet, order }) => (
                    <li
                      key={bullet.id}
                      className={cn(
                        "rounded-lg border p-4 transition-colors",
                        bullet.decision === "pending" ? "border-primary/30 bg-primary/[0.03]" : "bg-card",
                      )}
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Madde {order}
                          {bullet.decision === "pending" && (
                            <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary">
                              Karar bekliyor
                            </Badge>
                          )}
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
                        terms={terms}
                        onPreview={(text, signal) => previewEdit(id, bullet.id, text, signal)}
                        currentScore={state.scoreAfter ?? null}
                      />
                      {(bullet.alignments?.length ?? 0) > 0 && (
                        <ul className="m-0 mt-3 list-none space-y-1.5 p-0">
                          {bullet.alignments!.map((a) => (
                            <li key={a.term} className="flex gap-2 text-sm text-muted-foreground">
                              <Link2 className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                              <span>
                                <span className="font-semibold text-foreground">{a.term}</span>, senin{" "}
                                <span className="text-foreground">&ldquo;{a.basis}&rdquo;</span> ifadene dayanıyor.
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {bullet.decision === "pending" && bullet.verification.status === "ok" && (bullet.alignments?.length ?? 0) > 0 && (
                        <p className="m-0 mt-3 text-sm font-medium text-foreground">
                          Bu terim deneyimini doğru anlatıyorsa yeni hâlini seç; anlatmıyorsa eski hâli kalsın.
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              )}

              {unchangedBullets.length > 0 && (
                <details className="group mt-4">
                  <summary className="flex cursor-pointer list-none items-center gap-1 text-sm text-muted-foreground">
                    Olduğu gibi kalan maddeler ({unchangedBullets.length})
                    <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
                  </summary>
                  <ul className="m-0 mt-3 list-none space-y-2 p-0">
                    {unchangedBullets.map(({ bullet }) => (
                      <li key={bullet.id} className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                        {bullet.original}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </CardContent>
          )}
        </Card>
      </motion.div>

      <motion.div {...entrance(0.14)}>
        <Card className="gap-3 shadow-xs">
          <CardHeader>
            <CardTitle className="text-base">Beceriler</CardTitle>
            <CardDescription>
              {added.size > 0
                ? "İlanın aradığı ve deneyim maddelerinde geçen beceriler listeye eklendi; ilana en çok uyanlar başa alındı. Hiçbir beceri silinmedi."
                : "İlana en çok uyanlar başa alındı. Hiçbir beceri eklenmedi veya silinmedi."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="m-0 flex list-none flex-wrap gap-2 p-0">
              {draft.skillOrder.map((b, i) => (
                <li key={b}>
                  <Badge
                    variant="outline"
                    className={cn("gap-1.5 px-2.5 py-1 text-sm font-normal", added.has(b) && "border-primary/40 bg-primary/10")}
                  >
                    <span className="text-xs font-semibold text-muted-foreground tabular-nums">{i + 1}</span>
                    {b}
                    {added.has(b) && <span className="text-[11px] font-semibold text-primary">CV&apos;nden</span>}
                  </Badge>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )

  return (
    <AppPage>
      {state.analysisId && (
        <PageActions>
          <Button asChild variant="outline" size="sm">
            <Link href={`/applications/${state.analysisId}`}>
              <SquareKanban aria-hidden />
              <span className="hidden sm:inline">Başvuruyu aç</span>
              <span className="sr-only sm:hidden">Başvuruyu aç</span>
            </Link>
          </Button>
        </PageActions>
      )}
      <div className="space-y-6">
        {/* Skor kartı: önce → sonra, indirme yanında. Skor ekranın en büyük öğesi (§9.5). */}
        <motion.div {...entrance(0)}>
          <Card className="relative overflow-hidden py-0 shadow-xs">
            <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-primary/10 blur-3xl" />
            <CardContent className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto_18rem] lg:items-center">
              <div className="max-w-md">
                <p className="m-0 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Uyarlama</p>
                <h1 className="m-0 mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">CV&apos;n hazır</h1>
                <p className="m-0 mt-2 text-sm text-muted-foreground">
                  {diff > 0
                    ? userEdited
                      ? `Seçimlerin ve düzenlemelerinle skorun ${diff} puan arttı. Her değişikliği aşağıda görebilir, istemediğini eski hâline döndürebilirsin.`
                      : `Deneyimini ilanın terimleriyle anlattık; skorun ${diff} puan arttı. Her değişikliği aşağıda görebilir, istemediğini eski hâline döndürebilirsin.`
                    : pendingAlignment > 0
                      ? `${pendingAlignment} maddede deneyimini ilanın terimiyle anlattık. Doğru bulduklarını onayladığında skorun güncellenir.`
                      : after === before
                        ? "Skor değişmedi. İlanın aradığı şeylerin CV'nde bir karşılığını bulamadık; olmayan bir deneyimi eklemiyoruz."
                        : "Değişiklikleri aşağıda tek tek görebilir, istemediğini eski hâline döndürebilirsin."}
                </p>
              </div>

              <div className="flex items-center gap-4 justify-self-center">
                <div className="text-center">
                  <ScoreRing score={before} size={84} className="opacity-60 grayscale" />
                  <p className="m-0 mt-1 text-xs font-semibold text-muted-foreground">Önce</p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <ArrowRight className="size-5 text-muted-foreground" aria-hidden />
                  {diff !== 0 && (
                    <Badge
                      className={cn(
                        "font-bold",
                        diff > 0 ? "bg-brand-green/15 text-brand-green dark:text-[#4ade80]" : "bg-destructive/10 text-destructive",
                      )}
                    >
                      {diff > 0 ? `+${diff}` : diff}
                    </Badge>
                  )}
                </div>
                <div className="text-center">
                  <ScoreRing score={after} size={120} />
                  <p className={cn("m-0 mt-1 text-xs font-semibold", scoreStatus(after).textClass)}>Sonra</p>
                </div>
              </div>

              {/* İndirme (DOG-147): karar bekleyen madde varken kapalı. */}
              <div className="rounded-lg border bg-background/70 p-4">
                <p className="m-0 flex items-center gap-2 text-sm font-semibold">
                  <Download className="size-4 text-primary" aria-hidden />
                  İndir
                </p>
                <p className="m-0 mt-1 text-sm text-muted-foreground">
                  {pendingCount > 0 ? (
                    <>
                      <span className="font-semibold text-foreground">{pendingCount} madde</span> için karar bekliyoruz. Karar
                      verince indirme açılır.
                    </>
                  ) : (
                    "Seçtiğin hâllerle CV'ni indirebilirsin."
                  )}
                </p>
                <LayoutChoice
                  layout={draft.layout ?? "full"}
                  omittedCount={draft.omitted?.length ?? 0}
                  onePage={onePage}
                  busy={busy}
                  onChange={(l) => void changeLayout(l)}
                  onShow={() => setView("document")}
                />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button type="button" disabled={busy || pendingCount > 0} onClick={() => void downloadFile("pdf")}>
                    <FileText aria-hidden />
                    PDF
                  </Button>
                  <Button type="button" variant="outline" disabled={busy || pendingCount > 0} onClick={() => void downloadFile("docx")}>
                    Word
                  </Button>
                </div>
                {errorMessage && (
                  <p role="alert" className="m-0 mt-2 text-sm text-destructive">
                    {errorMessage}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
          <Tabs value={view} onValueChange={(v) => setView(v as View)} className="min-w-0 gap-4">
            <TabsList className="w-full justify-start overflow-x-auto [scrollbar-width:none] sm:w-fit [&::-webkit-scrollbar]:hidden">
              <TabsTrigger value="changes">
                Değişiklikler
                {pendingCount > 0 && (
                  <Badge className="ml-1 h-5 min-w-5 rounded-full px-1.5 tabular-nums" aria-label={`${pendingCount} karar bekliyor`}>
                    {pendingCount}
                  </Badge>
                )}
              </TabsTrigger>
              {state.document && <TabsTrigger value="document">Belge</TabsTrigger>}
              <TabsTrigger value="letter">Ön yazı</TabsTrigger>
              {state.analysisId && <TabsTrigger value="answers">Form yanıtları</TabsTrigger>}
            </TabsList>
            <TabsContent value="changes">{changes}</TabsContent>
            {state.document && (
              <TabsContent value="document">
                <DocumentView
                  document={state.document}
                  draft={draft}
                  onRestore={(b) => void restore(b)}
                  onBullet={bulletChange}
                  onSection={sectionChange}
                  busy={busy}
                  terms={terms}
                />
              </TabsContent>
            )}
            <TabsContent value="letter">
              <CoverLetterSection adaptationId={id} letter={state.coverLetter} checks={state.coverLetterChecks ?? null} />
            </TabsContent>
            {state.analysisId && (
              <TabsContent value="answers">
                <FormAnswersSection adaptationId={id} analysisId={state.analysisId} answers={state.formAnswers ?? []} />
              </TabsContent>
            )}
          </Tabs>

          {/* Yan kolon: eksik zorunlular ve "AI ile yaz" (DOG-94), platform ipuçları. */}
          <motion.aside {...entrance(0.08)} className="space-y-4 lg:sticky lg:top-20">
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
            <PlatformTips platform={state.platform} />
            {/* Marka rehberi §11: yapay zekâ şeffaflığı ve uydurmama ilkesi. */}
            <p className="m-0 flex gap-2 rounded-xl border bg-muted/40 p-4 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 shrink-0 text-brand-green dark:text-[#4ade80]" aria-hidden />
              Metinler yapay zekâ ile yeniden yazıldı. Hiçbir deneyim, beceri veya sertifika eklenmedi; eğitim ve
              sertifikalarına hiç dokunulmadı.
            </p>
          </motion.aside>
        </div>
      </div>
    </AppPage>
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
    <div className="mt-3">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={layout}
        disabled={busy}
        onValueChange={(v) => (v === "full" || v === "onePage") && v !== layout && onChange(v)}
        aria-label="Belge düzeni"
        className="w-full"
      >
        <ToggleGroupItem value="full" className="flex-1">
          Tam belge
        </ToggleGroupItem>
        <ToggleGroupItem value="onePage" className="flex-1">
          Tek sayfa
        </ToggleGroupItem>
      </ToggleGroup>
      {layout === "onePage" && (
        <p className="m-0 mt-2 text-xs text-muted-foreground">
          {omittedCount === 0 ? (
            "Sıkı yerleşimle tek sayfaya sığıyor; içerikten bir şey çıkmadı."
          ) : (
            <>
              Tek sayfaya sığması için ilana en az ilgili {omittedCount} madde çıkarıldı; skor düşmedi.{" "}
              <Button type="button" variant="link" size="sm" onClick={onShow} className="h-auto px-0 text-xs">
                Belgede gör
              </Button>
            </>
          )}
          {onePage && !onePage.fits && (
            <span className="mt-1 block">Yine de {onePage.pages} sayfa: kalan maddeler ilanın gereksinimlerine kanıt, onları çıkarmadık.</span>
          )}
        </p>
      )}
    </div>
  )
}
