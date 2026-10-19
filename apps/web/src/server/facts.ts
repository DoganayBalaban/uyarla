import { analysisProfile, factsFromAdaptations, type RememberedFact } from "@uyarla/core/adapt/facts"
import { AdaptationDraftSchema, type AdaptationDraft } from "@uyarla/core/schemas/adaptation"
import type { Requirement } from "@uyarla/core/schemas/job"
import type { ResumeProfile } from "@uyarla/core/schemas/resume"
import type { prisma } from "@uyarla/db"

type Db = typeof prisma

/**
 * Olgu hafızası (DOG-116): kullanıcının "AI ile yaz"da anlatıp kabul ettiği
 * deneyimler. Kayıt uyarlamaların taslağında; liste oradan türetiliyor (core
 * adapt/facts.ts). Worker analizde aynı sorguyla okuyor (apps/worker store.ts).
 */
export async function listFacts(db: Db, userId: string): Promise<RememberedFact[]> {
  const rows = await db.adaptation.findMany({
    where: { analysis: { userId }, status: { in: ["draft", "ready"] } },
    select: {
      id: true,
      createdAt: true,
      draft: true,
      analysis: { select: { result: true, resumeVersion: { select: { profile: true } }, jobPosting: { select: { requirements: true } } } },
    },
  })
  return factsFromAdaptations(
    rows.map((row) => ({
      adaptationId: row.id,
      createdAt: row.createdAt,
      draft: row.draft,
      profile: row.analysis.resumeVersion
        ? analysisProfile(row.analysis.resumeVersion.profile as unknown as ResumeProfile, row.analysis.result)
        : null,
      requirements: (row.analysis.jobPosting.requirements ?? []) as unknown as Requirement[],
    })),
  )
}

/** Katkıyı "unutuldu" işaretler; yoksa ya da zaten unutulduysa null. */
export function forgetInDraft(draft: AdaptationDraft, contributionId: string): AdaptationDraft | null {
  const contributions = draft.contributions ?? []
  if (!contributions.some((c) => c.id === contributionId && !c.forgotten)) return null
  return { ...draft, contributions: contributions.map((c) => (c.id === contributionId ? { ...c, forgotten: true } : c)) }
}

/**
 * "Unut": olgu sonraki analizlerde kanıt sayılmıyor. Anlatıldığı uyarlamanın
 * belgesi değişmiyor; kullanıcı o maddeyi orada ayrıca reddedebilir. Başka
 * kullanıcının uyarlamasına dokunulmuyor: sahiplik sorgunun içinde.
 */
export async function forgetFact(db: Db, userId: string, factId: string): Promise<boolean> {
  const [adaptationId, contributionId] = factId.split(":")
  if (!adaptationId || !contributionId) return false
  return db.$transaction(async (tx) => {
    // Worker ve karar ucu da taslağı yazıyor; satır kilidi (katkı ucu gibi).
    await tx.$queryRaw`SELECT id FROM "Adaptation" WHERE id = ${adaptationId} FOR UPDATE`
    const row = await tx.adaptation.findFirst({
      where: { id: adaptationId, analysis: { userId } },
      select: { draft: true },
    })
    if (!row) return false
    const parsed = AdaptationDraftSchema.safeParse(row.draft)
    const next = parsed.success ? forgetInDraft(parsed.data, contributionId) : null
    if (!next) return false
    await tx.adaptation.update({ where: { id: adaptationId }, data: { draft: next as unknown as object } })
    return true
  })
}
