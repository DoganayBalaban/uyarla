import { PermanentError } from "@uyarla/core"
import { prisma } from "@uyarla/db"
import type { AnalysisStore } from "./types.js"

/**
 * AnalysisStore'un Prisma uygulaması. Hattın kendisi bu dosyayı bilmiyor;
 * arayüz üzerinden çağırıyor (bkz. types.ts).
 */
export const prismaStore: AnalysisStore = {
  async getResumeText(resumeId) {
    const resume = await prisma.resume.findUnique({ where: { id: resumeId } })
    if (!resume) throw new PermanentError("CV bulunamadı", "resume_not_found")
    return resume.rawText
  },

  async getJobPostingText(jobPostingId) {
    const posting = await prisma.jobPosting.findUnique({ where: { id: jobPostingId } })
    if (!posting) throw new PermanentError("İlan bulunamadı", "posting_not_found")
    return posting.rawText
  },

  async saveResumeVersion(resumeId, profile) {
    const mevcut = await prisma.resumeVersion.count({ where: { resumeId } })
    const version = await prisma.resumeVersion.create({
      data: {
        resumeId,
        profile: profile as unknown as object,
        source: "parsed",
        versionNo: mevcut + 1,
      },
    })
    await prisma.resume.update({ where: { id: resumeId }, data: { status: "parsed" } })
    return version.id
  },

  async saveJobPostingData(jobPostingId, data) {
    await prisma.jobPosting.update({
      where: { id: jobPostingId },
      data: {
        requirements: data.requirements as unknown as object,
        language: data.language,
        seniority: data.seniority,
      },
    })
  },

  async createAnalysis({ jobPostingId, modelId }) {
    const analysis = await prisma.analysis.create({
      data: { jobPostingId, modelId, status: "running" },
    })
    return analysis.id
  },

  async attachResumeVersion(analysisId, resumeVersionId) {
    await prisma.analysis.update({ where: { id: analysisId }, data: { resumeVersionId } })
  },

  async completeAnalysis({ analysisId, score, result, durationMs, tokenUsage }) {
    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        score,
        result: result as unknown as object,
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
