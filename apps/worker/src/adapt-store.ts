import { PermanentError } from "@uyarla/core"
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
      profile: analysis.resumeVersion.profile as never,
      posting: {
        position: analysis.jobPosting.position,
        company: null,
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

  async failAdaptation(adaptationId, errorClass) {
    await prisma.adaptation.update({
      where: { id: adaptationId },
      data: { status: "failed", errorClass },
    })
  },
}
