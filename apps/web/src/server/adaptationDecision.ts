import { AdaptationDraftSchema, hasPendingDecisions, type AdaptationDraft } from "@uyarla/core/schemas/adaptation"
import { applyAdaptation } from "@uyarla/core/adapt/profile"
import {
  addUserBullet,
  addUserSection,
  groupBullets,
  moveBullet,
  moveSection,
  removeBullet,
  removeUserSection,
  restoreBullet as restoreDraftBullet,
} from "@uyarla/core/adapt/bullets"
import { sectionOrder, type DocumentOptions } from "@uyarla/core/document/model"
import type { StructuredSection } from "@uyarla/core/schemas/resume"
import { analysisProfile } from "@uyarla/core/adapt/facts"
import { CachedEmbeddingProvider, redisVectorStore } from "@uyarla/core/llm/embeddingCache"
import { OpenAiCompatibleEmbeddingProvider, embeddingConfigFromEnv } from "@uyarla/core/llm/embedding"
import { rescore } from "@uyarla/core/adapt/rescore"
import { correctPosting, type RequirementCorrection } from "@uyarla/core/score/exclusions"
import type { JobPostingData } from "@uyarla/core/schemas/job"
import type { ResumeProfile } from "@uyarla/core/schemas/resume"
import { prisma } from "@uyarla/db"
import { documentModelFor } from "@/server/documentModel"
import { redis } from "@/server/redis"

/**
 * Tek bir maddenin (ya da özetin) kararını değiştirir.
 *
 * Taslağı yerinde değiştirmiyor: aynı nesne hem okunup hem yazılırsa
 * eşzamanlı iki karar birbirini ezer.
 */
export function applyDecision(
  draft: AdaptationDraft,
  itemId: string,
  decision: "accepted" | "rejected",
): AdaptationDraft {
  if (itemId === "summary") {
    return { ...draft, summary: { ...draft.summary, decision } }
  }

  // Kullanıcı katkıları kendi kimlikleriyle (DOG-94). Yazımı bitmemiş katkıya
  // karar verilemez; ortada seçilecek bir metin yok.
  const contribution = draft.contributions?.find((c) => c.id === itemId)
  if (contribution) {
    if (contribution.status !== "done" || !contribution.text) throw new Error(`Madde bulunamadı: ${itemId}`)
    return {
      ...draft,
      contributions: draft.contributions!.map((c) => (c.id === itemId ? { ...c, decision } : c)),
    }
  }

  if (!draft.bullets.some((b) => b.id === itemId)) {
    // Sessizce yok saymak, kullanıcının tıkladığı kararın kaybolması olurdu.
    throw new Error(`Madde bulunamadı: ${itemId}`)
  }

  return {
    ...draft,
    bullets: draft.bullets.map((b) => (b.id === itemId ? { ...b, decision } : b)),
  }
}

/**
 * Toplu karar (DOG-93).
 *
 * - "accept_verified": uydurma kontrolünden temiz geçen her değişikliği yeni
 *   hâline alır; terim uyumu yüzünden onay bekleyenler de dahil, arayüz onay
 *   öncesinde terimleri listeliyor. Uyarı taşıyan maddelere dokunmaz: onlar
 *   tek tek okunmadan kabul edilmemeli (K-26).
 * - "reject_all": özet dahil her şeyi eski hâline döndürür. Uyarlamanın
 *   tamamını geri almanın karşılığı; tek tek yeniden kabul edilebilir.
 *
 * Değişmeyen maddelerin kararı anlamsız (eski ve yeni hâl aynı); dokunulmuyor.
 */
export type BulkDecision = "accept_verified" | "reject_all"

export function applyBulkDecision(draft: AdaptationDraft, action: BulkDecision): AdaptationDraft {
  const decide = (verification: { status: string }): "accepted" | "rejected" | null => {
    if (action === "reject_all") return "rejected"
    return verification.status === "ok" ? "accepted" : null
  }
  const summaryDecision = draft.summary.original ? decide(draft.summary.verification) : null
  return {
    ...draft,
    summary: summaryDecision ? { ...draft.summary, decision: summaryDecision } : draft.summary,
    bullets: draft.bullets.map((b) => {
      if (b.rewritten === b.original) return b
      const d = decide(b.verification)
      return d ? { ...b, decision: d } : b
    }),
    // Katkılar da aynı kurala tabi: uyarılı katkı toplu kabul edilmez.
    contributions: draft.contributions?.map((c) => {
      if (c.status !== "done" || !c.text) return c
      const d = decide(c.verification ?? { status: "ok" })
      return d ? { ...c, decision: d } : c
    }),
  }
}

/**
 * Analizde karşılanmayan zorunlu gereksinimler (DOG-94): "AI ile yaz" bunlar
 * için açılıyor. Kural "başvuruya hazır mı" ölçütüyle ortak (DOG-91).
 */
export { missingMustRequirements } from "@/features/analysis/readiness"

/** Uyarı taşıyan madde kaldıysa `draft`, kalmadıysa `ready` (K-26). */
export function nextStatus(draft: AdaptationDraft): "draft" | "ready" {
  return hasPendingDecisions(draft) ? "draft" : "ready"
}

/** Uyarlama kaydı ve dayandığı Sprint 1 verisi. */
export async function loadAdaptation(id: string) {
  const adaptation = await prisma.adaptation.findUnique({
    where: { id },
    include: { analysis: { include: { resumeVersion: true, jobPosting: true, user: { select: { goal: true } } } } },
  })
  if (!adaptation) return null

  const { analysis } = adaptation
  const stored = (analysis.resumeVersion?.profile ?? null) as ResumeProfile | null
  // Analize katılan olgularla (DOG-116): uyarlama, indirme ve önce/sonra skoru
  // analizin gördüğü profille.
  const profile = stored ? analysisProfile(stored, analysis.result) : null
  const posting: JobPostingData = {
    position: analysis.jobPosting.position,
    company: analysis.jobPosting.company,
    seniority: analysis.jobPosting.seniority as never,
    language: analysis.jobPosting.language as never,
    requirements: analysis.jobPosting.requirements as never,
  }
  // Önce skoru (Analysis.score) şart ve unvan düzeltmeleriyle (DOG-90,
  // DOG-134); sonra skoru da aynı ilanla hesaplanmalı, yoksa düzeltilen
  // şart sonra skorunda eksik sayılıp farkı yanlış gösterir.
  const fixes = (analysis.result ?? {}) as { corrections?: Record<number, RequirementCorrection>; positionCorrection?: string }
  const scoringPosting = correctPosting(posting, fixes.corrections ?? {}, fixes.positionCorrection)

  // Kayıt henüz yazılmamışken draft boş bir nesne; parse etmeye çalışmıyoruz.
  const draft: AdaptationDraft | null =
    adaptation.status === "running" || adaptation.status === "failed"
      ? null
      : AdaptationDraftSchema.parse(adaptation.draft)

  return {
    adaptation,
    profile,
    posting,
    /** Skor hesapları için düzeltmeleri uygulanmış ilan. */
    scoringPosting,
    /** Belge seçenekleri: ilk işini arayanda eğitim önde (DOG-55); bölüm sırası buna bağlı. */
    documentOptions: { educationFirst: analysis.user.goal === "first_job" },
    draft,
    scoreBefore: analysis.score,
    /** Skor formülünün sürümü (DOG-103); eski analizlerde 1. */
    scoringRevision: (analysis.result as { scoringRevision?: number } | null)?.scoringRevision ?? 1,
    /** "İlanda yok" işaretleri (DOG-90); önce/sonra skoru bunlar olmadan. */
    excluded: (analysis.result as { excluded?: number[] } | null)?.excluded ?? [],
    /** Yetki kontrolü için; Adaptation'ın kendi userId'si yok (spec §5). */
    ownerId: analysis.userId,
    /** Nihai ResumeVersion'ın bağlanacağı CV; indirme route'u kullanıyor. */
    resumeId: analysis.resumeVersion?.resumeId ?? null,
  }
}

/**
 * Kabul edilen içerikten yeni skoru hesaplar; taslak yoksa null.
 *
 * Veritabanında saklanmıyor: her karar değişikliğinde bayatlar ve maliyeti
 * tek bir toplu gömme çağrısı — LLM yok (spec §10). Gömmeler worker'la ortak
 * önbellekten geliyor; değişmeyen kanıtlar analizdeki vektörünü koruyor ve
 * sayfa her yüklendiğinde skor oynamıyor (DOG-57).
 */
export async function computeScoreAfter(
  profile: ResumeProfile | null,
  posting: JobPostingData,
  draft: AdaptationDraft | null,
  excluded: readonly number[] = [],
): Promise<number | null> {
  if (!profile || !draft) return null
  return rescore({ profile, posting, draft, excluded }, cachedEmbedding())
}

/** Worker'la ortak önbellekli gömme sağlayıcısı (DOG-57). */
export function cachedEmbedding(): CachedEmbeddingProvider {
  const config = embeddingConfigFromEnv()
  return new CachedEmbeddingProvider(new OpenAiCompatibleEmbeddingProvider(config), redisVectorStore(redis), config.model)
}

/**
 * Belge stratejisi (DOG-93). "onePage": sıkı yerleşim ve gerekirse ilana en az
 * ilgili maddelerin çıkarılması; plan skoru düşürmüyor (core adapt/onePage).
 * "full": çıkarılanlar geri geliyor. Plan her seçimde baştan kuruluyor: önceki
 * kararlarla maddelerin uzunluğu değişmiş olabilir.
 */
export async function applyLayout(
  input: {
    profile: ResumeProfile
    posting: JobPostingData
    draft: AdaptationDraft
    ownerId: string
    excluded?: readonly number[]
  },
  layout: "full" | "onePage",
): Promise<{ draft: AdaptationDraft; onePage: { fits: boolean; pages: number } | null }> {
  if (layout === "full") return { draft: { ...input.draft, layout: "full", omitted: [] }, onePage: null }
  // Tembel import: plan pdfkit'le sayfa ölçüyor (indirme route'u gibi).
  const { planOnePage } = await import("@uyarla/core/adapt/onePage")
  const plan = await planOnePage(
    {
      profile: input.profile,
      posting: input.posting,
      draft: { ...input.draft, omitted: [] },
      toModel: await documentModelFor(input.ownerId),
      excluded: input.excluded,
    },
    cachedEmbedding(),
  )
  return {
    draft: { ...input.draft, layout: "onePage", omitted: plan.omitted },
    onePage: { fits: plan.fits, pages: plan.pages },
  }
}

/** Kullanıcı tek sayfa için çıkarılan bir maddeyi geri alıyor (DOG-93). */
export function restoreBullet(draft: AdaptationDraft, bulletId: string): AdaptationDraft {
  // Tek sayfa için çıkarılan (DOG-93) ya da kullanıcının kaldırdığı (DOG-92).
  if (!(draft.omitted ?? []).includes(bulletId) && !(draft.removed ?? []).includes(bulletId)) {
    throw new Error(`Çıkarılmış madde yok: ${bulletId}`)
  }
  return restoreDraftBullet(draft, bulletId)
}

/**
 * Madde düzenleyici işlemi (DOG-92): ekle, kaldır, taşı. Grup bir iş
 * (`experienceIndex`) ya da proje (`projectIndex`).
 */
type Where = { experienceIndex: number } | { projectIndex: number }
export type BulletOp =
  | ({ op: "add"; text: string } & Where)
  | { op: "remove"; id: string }
  | ({ op: "move"; id: string; direction: "up" | "down" } & Where)

/** Bölüm işlemi (DOG-92): sırayı değiştir, kendi bölümünü ekle ya da sil. */
export type SectionOp =
  | { op: "move"; section: StructuredSection; direction: "up" | "down" }
  | { op: "add"; heading: string; text: string }
  | { op: "remove"; id: string }

const SECTIONS: readonly StructuredSection[] = ["experience", "projects", "education", "skills"]
const isIndex = (x: unknown): x is number => typeof x === "number" && Number.isInteger(x) && x >= 0
const isDirection = (x: unknown): x is "up" | "down" => x === "up" || x === "down"

function whereOf(v: Record<string, unknown>): Where | null {
  if (isIndex(v.experienceIndex)) return { experienceIndex: v.experienceIndex }
  if (isIndex(v.projectIndex)) return { projectIndex: v.projectIndex }
  return null
}

/** Gövdedeki madde işlemini doğrular; geçersizse null. */
export function parseBulletOp(value: unknown): BulletOp | null {
  if (!value || typeof value !== "object") return null
  const v = value as Record<string, unknown>
  if (v.op === "remove") return typeof v.id === "string" && v.id ? { op: "remove", id: v.id } : null
  const where = whereOf(v)
  if (!where) return null
  if (v.op === "add" && typeof v.text === "string") return { op: "add", text: v.text, ...where }
  if (v.op === "move" && typeof v.id === "string" && isDirection(v.direction)) return { op: "move", id: v.id, direction: v.direction, ...where }
  return null
}

/** Gövdedeki bölüm işlemini doğrular; geçersizse null. */
export function parseSectionOp(value: unknown): SectionOp | null {
  if (!value || typeof value !== "object") return null
  const v = value as Record<string, unknown>
  if (v.op === "move" && SECTIONS.includes(v.section as StructuredSection) && isDirection(v.direction)) {
    return { op: "move", section: v.section as StructuredSection, direction: v.direction }
  }
  if (v.op === "add" && typeof v.heading === "string" && typeof v.text === "string") return { op: "add", heading: v.heading, text: v.text }
  if (v.op === "remove" && typeof v.id === "string" && v.id) return { op: "remove", id: v.id }
  return null
}

const groupOf = (w: Where) =>
  "experienceIndex" in w ? { kind: "experience" as const, index: w.experienceIndex } : { kind: "project" as const, index: w.projectIndex }

export function applyBulletOp(
  draft: AdaptationDraft,
  op: BulletOp,
  context: { profile: ResumeProfile; posting: JobPostingData },
): AdaptationDraft {
  if (op.op === "remove") return removeBullet(draft, op.id)
  if (op.op === "add") return addUserBullet(draft, groupOf(op), op.text, context)
  return moveBullet(draft, context.profile, groupOf(op), op.id, op.direction)
}

export function applySectionOp(
  draft: AdaptationDraft,
  op: SectionOp,
  context: { profile: ResumeProfile; posting: JobPostingData; options: DocumentOptions },
): AdaptationDraft {
  if (op.op === "add") return addUserSection(draft, op.heading, op.text, context)
  if (op.op === "remove") return removeUserSection(draft, op.id)
  // Taşıma belgede şu an görünen sıradan: CV'nin sırası ya da varsayılan.
  const applied = applyAdaptation(context.profile, draft)
  const present = new Set<StructuredSection>(
    (
      [
        ["experience", applied.experience.length],
        ["projects", applied.projects?.length ?? 0],
        ["education", applied.education.length],
        ["skills", applied.skills.length],
      ] as const
    )
      .filter(([, n]) => n > 0)
      .map(([k]) => k),
  )
  return moveSection(draft, sectionOrder(applied, context.options), op.section, op.direction, present)
}

/**
 * Uyarlama öncesi skor, bugünkü formülle (DOG-103). Formül değişmeden önce
 * kaydedilmiş analizlerin skoru eski formülle; "sonra" yenisiyle
 * hesaplandığı için fark şişkin ya da eksik görünürdü. Hiçbir kararın kabul
 * edilmediği taslakla yeniden puanlanıyor; gömmeler önbellekten.
 */
export async function computeScoreBefore(
  profile: ResumeProfile | null,
  posting: JobPostingData,
  draft: AdaptationDraft | null,
  excluded: readonly number[] = [],
): Promise<number | null> {
  if (!draft) return null
  const untouched: AdaptationDraft = {
    ...draft,
    bullets: draft.bullets.map((b) => ({ ...b, decision: "rejected" })),
    summary: { ...draft.summary, decision: "rejected" },
    addedSkills: [],
    contributions: [],
  }
  return computeScoreAfter(profile, posting, untouched, excluded)
}

/** Belge görünümünün bir hâli (DOG-93): yalnızca ekranın gösterdiği alanlar. */
export interface DocumentOutline {
  headline: string | null
  summary: string | null
  experience: Array<{
    company: string
    title: string
    startDate: string
    endDate: string
    bullets: string[]
    /** `bullets` ile aynı sırada kimlikler (DOG-92); sıra değişince ekran kimlikle eşliyor. */
    bulletIds?: string[]
  }>
  /** Projeler ve diğer bölümler (DOG-105); indirilen belgede de var. */
  projects: Array<{ name: string; role: string | null; dates: string | null; bullets: string[]; bulletIds?: string[] }>
  /** Kullanıcının eklediği bölümün kimliği var (DOG-92); silinebiliyor. */
  otherSections: Array<{ heading: string; lines: string[]; id?: string }>
  /** Belgedeki bölüm sırası (DOG-92), indirmeyle aynı kuralla. */
  sectionOrder?: StructuredSection[]
  skills: string[]
}

/**
 * Belge görünümü için CV'nin önceki ve sonraki hâli (DOG-93).
 *
 * "Sonra" indirmenin kullandığı applyAdaptation'dan geliyor; ekranda görünen
 * ile indirilen belge ayrışamaz. Karar bekleyen maddeler indirmede olduğu
 * gibi eski hâliyle duruyor.
 */
export function adaptationDocument(
  profile: ResumeProfile | null,
  draft: AdaptationDraft | null,
  options: DocumentOptions = {},
): { before: DocumentOutline; after: DocumentOutline } | null {
  if (!profile || !draft) return null
  // Tek sayfa için çıkarılanlar (DOG-93) ve kullanıcının kaldırdıkları
  // (DOG-92) burada düşmüyor: ekran onları üstü çizili, geri alınabilir
  // gösteriyor. Maddeler indirmeyle aynı listeden (groupBullets).
  const applied = applyAdaptation(profile, { ...draft, omitted: [], removed: [] })
  const after = outline(applied)
  const own = (profile.otherSections ?? []).length
  return {
    before: { ...outline(profile), sectionOrder: sectionOrder(profile, options) },
    after: {
      ...after,
      experience: after.experience.map((job, i) => {
        const list = groupBullets(profile, draft, { kind: "experience", index: i })
        return { ...job, bullets: list.map((b) => b.text), bulletIds: list.map((b) => b.id) }
      }),
      projects: after.projects.map((project, i) => {
        const list = groupBullets(profile, draft, { kind: "project", index: i })
        return { ...project, bullets: list.map((b) => b.text), bulletIds: list.map((b) => b.id) }
      }),
      // CV'nin kendi bölümlerinden sonra kullanıcınınkiler, aynı sırayla.
      otherSections: after.otherSections.map((o, k) => (k >= own ? { ...o, id: draft.userSections?.[k - own]?.id } : o)),
      sectionOrder: sectionOrder(applied, options),
    },
  }
}

function outline(p: ResumeProfile): DocumentOutline {
  return {
    headline: p.headline,
    summary: p.summary,
    experience: p.experience.map((e) => ({
      company: e.company,
      title: e.title,
      startDate: e.startDate,
      endDate: e.endDate,
      bullets: e.bullets.map((b) => b.text),
    })),
    projects: (p.projects ?? []).map((x) => ({
      name: x.name,
      role: x.role,
      dates: [x.startDate, x.endDate].filter(Boolean).join(" – ") || null,
      bullets: x.bullets.map((b) => b.text),
    })),
    otherSections: p.otherSections ?? [],
    skills: p.skills,
  }
}
