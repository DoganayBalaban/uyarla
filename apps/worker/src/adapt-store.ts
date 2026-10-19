import { AdaptationDraftSchema, PermanentError, analysisProfile, hasPendingDecisions } from "@uyarla/core"
import { prisma } from "@uyarla/db"
import type { AdaptationStore } from "./adapt-types.js"

/**
 * AdaptationStore'un Prisma uygulaması. Hat bu dosyayı bilmiyor;
 * arayüz üzerinden çağırıyor (bkz. adapt-types.ts).
 */
export const prismaAdaptationStore: AdaptationStore = {
  async getAdaptationContext(adaptationId) {
    const adaptation = await prisma.adaptation.findUnique({
      where: { id: adaptationId },
      include: {
        analysis: {
          include: {
            resumeVersion: true,
            jobPosting: true,
            user: { select: { goal: true, targetRole: true } },
          },
        },
      },
    })

    if (!adaptation) {
      throw new PermanentError("Uyarlama bulunamadı", "adaptation_not_found")
    }

    const { analysis } = adaptation
    if (!analysis.resumeVersion || !analysis.result) {
      // Analiz başarısız bittiyse uyarlanacak bir şey yok; tekrar denemek
      // aynı sonucu verir.
      throw new PermanentError("Analiz tamamlanmamış", "analysis_incomplete")
    }

    return {
      // Analize katılan olgularla (DOG-116): madde kimlikleri analizdekiyle aynı kalsın.
      profile: analysisProfile(analysis.resumeVersion.profile as never, analysis.result),
      posting: {
        position: analysis.jobPosting.position,
        company: analysis.jobPosting.company,
        seniority: analysis.jobPosting.seniority as never,
        language: analysis.jobPosting.language as never,
        requirements: analysis.jobPosting.requirements as never,
      },
      result: analysis.result as never,
      intent: { goal: analysis.user.goal, targetRole: analysis.user.targetRole },
    }
  },

  async saveDraft({ adaptationId, draft, status, durationMs, tokenUsage }) {
    await prisma.adaptation.update({
      where: { id: adaptationId },
      data: { draft: draft as unknown as object, status, durationMs, tokenUsage },
    })
  },

  async saveCoverLetter(adaptationId, value) {
    await prisma.adaptation.update({
      where: { id: adaptationId },
      data: { coverLetter: value as unknown as object },
    })
  },

  async getDraft(adaptationId) {
    const adaptation = await prisma.adaptation.findUnique({ where: { id: adaptationId }, select: { draft: true } })
    if (!adaptation) throw new PermanentError("Uyarlama bulunamadı", "adaptation_not_found")
    return AdaptationDraftSchema.parse(adaptation.draft)
  },

  async updateContribution(adaptationId, contributionId, patch) {
    await prisma.$transaction(async (tx) => {
      // Satır kilidi: aynı anda bir karar (PATCH /decision) yazılıyorsa biri
      // ötekini beklesin; okuma-değiştirme-yazma arasına giremesin.
      await tx.$queryRaw`SELECT id FROM "Adaptation" WHERE id = ${adaptationId} FOR UPDATE`
      const row = await tx.adaptation.findUnique({ where: { id: adaptationId }, select: { draft: true, status: true } })
      if (!row) return
      const draft = AdaptationDraftSchema.parse(row.draft)
      const next = {
        ...draft,
        contributions: (draft.contributions ?? []).map((c) => (c.id === contributionId ? { ...c, ...patch } : c)),
      }
      // Bekleyen katkı indirmeyi bloklıyor; durum taslakla birlikte değişmeli.
      const status = row.status === "draft" || row.status === "ready" ? (hasPendingDecisions(next) ? "draft" : "ready") : row.status
      await tx.adaptation.update({ where: { id: adaptationId }, data: { draft: next as unknown as object, status } })
    })
  },

  async failAdaptation(adaptationId, errorClass) {
    await prisma.adaptation.update({
      where: { id: adaptationId },
      data: { status: "failed", errorClass },
    })
  },
}
