import type { prisma } from "@uyarla/db"

type Db = typeof prisma

/** Başvuru yok ya da başkasının; 404 (K-35: 403 varlığını sızdırır). */
export class ApplicationNotFoundError extends Error {
  constructor() {
    super("Başvuru bulunamadı.")
    this.name = "ApplicationNotFoundError"
  }
}

/**
 * Bir başvuruyu tamamen siler (DOG-171): analiz (not, aşama, takip
 * mesajları, form yanıtları, mülakat paketi aynı satırda), ilan, uyarlama ve
 * uyarlanmış CV sürümü. Yalnızca bu başvuru için yüklenmiş, kütüphanede
 * olmayan ve başka başvuruda kullanılmayan CV de gidiyor; dosyası döndürülüyor,
 * çağıran işlem bittikten sonra depodan siliyor. Kütüphanedeki CV'lere,
 * "ilanda yok" listesine ve anlatılan deneyimlere dokunulmuyor.
 *
 * Harcanan hak kalıyor: kota o ayın kayıtlarından sayılıyor; analiz ve
 * uyarlama başarılıysa asıl tarihleriyle DeletedUsage'a yazılıyor. Yoksa
 * "analiz et, sil, yeniden analiz et" ücretsiz sınırı aşardı.
 *
 * Tek işlem: yarısı silinmiş başvuru (ilanı duran, analizi giden) olmasın.
 */
export async function deleteApplication(db: Db, userId: string, analysisId: string): Promise<{ files: string[] }> {
  return db.$transaction(async (tx) => {
    const analysis = await tx.analysis.findFirst({
      where: { id: analysisId, userId },
      select: {
        id: true,
        status: true,
        jobPostingId: true,
        jobPosting: { select: { createdAt: true } },
        resumeVersion: { select: { resume: { select: { id: true, savedAt: true, filePath: true } } } },
        adaptation: { select: { id: true, status: true, createdAt: true, resumeVersionId: true } },
      },
    })
    if (!analysis) throw new ApplicationNotFoundError()

    const usage: Array<{ userId: string; feature: string; usedAt: Date }> = []
    // Analiz kotası ilandan sayılıyor, başarısız analizin ilanı sayılmıyor (billing/entitlement).
    if (analysis.status !== "failed") usage.push({ userId, feature: "analysis", usedAt: analysis.jobPosting.createdAt })
    if (analysis.adaptation && analysis.adaptation.status !== "failed") {
      usage.push({ userId, feature: "adaptation", usedAt: analysis.adaptation.createdAt })
    }
    if (usage.length > 0) await tx.deletedUsage.createMany({ data: usage })

    if (analysis.adaptation) {
      await tx.adaptation.delete({ where: { id: analysis.adaptation.id } })
      const adapted = analysis.adaptation.resumeVersionId
      // Uyarlanmış sürüm yalnızca bu uyarlamanın; başka bir analiz ona bakmıyorsa siliniyor.
      if (adapted && (await tx.analysis.count({ where: { resumeVersionId: adapted } })) === 0) {
        await tx.resumeVersion.delete({ where: { id: adapted } })
      }
    }
    await tx.analysis.delete({ where: { id: analysis.id } })
    if ((await tx.analysis.count({ where: { jobPostingId: analysis.jobPostingId } })) === 0) {
      await tx.jobPosting.delete({ where: { id: analysis.jobPostingId } })
    }

    const files: string[] = []
    const resume = analysis.resumeVersion?.resume
    if (resume && !resume.savedAt) {
      const stillUsed = await tx.analysis.count({ where: { resumeVersion: { resumeId: resume.id } } })
      const adaptedFrom = await tx.adaptation.count({ where: { resumeVersion: { resumeId: resume.id } } })
      const audits = await tx.linkedInAudit.count({ where: { resumeId: resume.id } })
      if (stillUsed === 0 && adaptedFrom === 0 && audits === 0) {
        await tx.resumeVersion.deleteMany({ where: { resumeId: resume.id } })
        await tx.resume.delete({ where: { id: resume.id } })
        files.push(resume.filePath)
      }
    }
    return { files }
  })
}
