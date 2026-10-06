import { PermanentError, extractText, fileStoreFromEnv } from "@uyarla/core"
import { prisma } from "@uyarla/db"
import type { AnalysisStore } from "./types.js"

/**
 * AnalysisStore'un Prisma uygulaması. Hattın kendisi bu dosyayı bilmiyor;
 * arayüz üzerinden çağırıyor (bkz. types.ts).
 */
export const prismaStore: AnalysisStore = {
  /**
   * CV'nin ham metnini döndürür; henüz çıkarılmamışsa dosyadan çıkarıp
   * kaydeder.
   *
   * Çıkarma web katmanında değil burada yapılıyor: route'ların tek işi
   * doğrulama ve kuyruğa devretmek (spec §4.2). Teknik zorunluluk da var —
   * pdf-parse'ın kullandığı pdfjs Next'in sunucu katmanında yüklenemiyor.
   */
  async getResumeText(resumeId) {
    const resume = await prisma.resume.findUnique({ where: { id: resumeId } })
    if (!resume) throw new PermanentError("CV bulunamadı", "resume_not_found")
    if (resume.rawText.trim()) return resume.rawText

    const store = fileStoreFromEnv()
    const buffer = await store.read(resume.filePath)
    const rawText = await extractText(buffer, resume.filePath)

    await prisma.resume.update({ where: { id: resumeId }, data: { rawText } })
    return rawText
  },

  async getResumeFile(resumeId) {
    const resume = await prisma.resume.findUnique({ where: { id: resumeId } })
    if (!resume) throw new PermanentError("CV bulunamadı", "resume_not_found")
    const store = fileStoreFromEnv()
    return { buffer: await store.read(resume.filePath), filename: resume.filePath }
  },

  async getJobPostingText(jobPostingId) {
    const posting = await prisma.jobPosting.findUnique({ where: { id: jobPostingId } })
    if (!posting) throw new PermanentError("İlan bulunamadı", "posting_not_found")
    return posting.rawText
  },

  async saveResumeVersion(resumeId, profile) {
    const existing = await prisma.resumeVersion.count({ where: { resumeId } })
    const version = await prisma.resumeVersion.create({
      data: {
        resumeId,
        profile: profile as unknown as object,
        source: "parsed",
        versionNo: existing + 1,
      },
    })
    await prisma.resume.update({ where: { id: resumeId }, data: { status: "parsed" } })
    return version.id
  },

  async saveJobPostingData(jobPostingId, data) {
    await prisma.jobPosting.update({
      where: { id: jobPostingId },
      data: {
        position: data.position,
        requirements: data.requirements as unknown as object,
        language: data.language,
        seniority: data.seniority,
      },
    })
  },

  async createAnalysis({ jobPostingId, modelId, userId }) {
    const analysis = await prisma.analysis.create({
      data: { jobPostingId, modelId, userId, status: "running" },
    })
    return analysis.id
  },

  async attachResumeVersion(analysisId, resumeVersionId) {
    await prisma.analysis.update({ where: { id: analysisId }, data: { resumeVersionId } })
  },

  async completeAnalysis({ analysisId, score, result, format, durationMs, tokenUsage }) {
    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        score,
        // Biçim raporu skor sonucunun yanında aynı JSON'da duruyor; ayrı bir
        // sütun açmak şema değişikliği gerektirirdi, okuyan tek yer arayüz.
        result: { ...result, format } as unknown as object,
        durationMs,
        tokenUsage,
        status: "done",
      },
    })
  },

  async failAnalysis(analysisId, errorClass) {
    await prisma.analysis.update({
      where: { id: analysisId },
      data: { status: "failed", errorClass },
    })
  },
}
