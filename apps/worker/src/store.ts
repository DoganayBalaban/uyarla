import { PermanentError, analysisProfile, extractText, factsFromAdaptations, fileStoreFromEnv } from "@uyarla/core"
import type { Requirement, ResumeProfile } from "@uyarla/core"
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

  async findParsedVersion(resumeId, parserKey) {
    const version = await prisma.resumeVersion.findFirst({
      where: { resumeId, source: "parsed", parserKey },
      orderBy: { versionNo: "desc" },
      select: { id: true, profile: true },
    })
    return version ? { id: version.id, profile: version.profile as never } : null
  },

  async saveResumeVersion(resumeId, profile, parserKey) {
    const existing = await prisma.resumeVersion.count({ where: { resumeId } })
    const version = await prisma.resumeVersion.create({
      data: {
        resumeId,
        profile: profile as unknown as object,
        source: "parsed",
        parserKey,
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
        company: data.company,
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

  async getExcludedConceptKeys(userId) {
    const rows = await prisma.excludedConcept.findMany({ where: { userId }, select: { key: true } })
    return rows.map((r) => r.key)
  },

  /**
   * Olgular kullanıcının uyarlamalarındaki kabul edilmiş katkılardan
   * türetiliyor (DOG-116, core adapt/facts.ts). Web'deki Hesabım listesi aynı
   * sorguyu kullanıyor (apps/web server/facts.ts).
   */
  async getRememberedFacts(userId) {
    const rows = await prisma.adaptation.findMany({
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
  },

  async failAnalysis(analysisId, errorClass) {
    await prisma.analysis.update({
      where: { id: analysisId },
      data: { status: "failed", errorClass },
    })
  },
}
