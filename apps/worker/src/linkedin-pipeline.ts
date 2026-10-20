import { extractResumeProfile, linkedinReport, linkedinStrengths, resumeParserKey, suggestLinkedInText, type ScoredPosting } from "@uyarla/core"
import type { EmbeddingProvider, JobPostingData, LinkedInReportRecord, LlmProvider, ResumeProfile } from "@uyarla/core"
import { scoreProfile } from "@uyarla/core/score/live"
import { prisma } from "@uyarla/db"
import type { LinkedInReportJobData } from "./adapt-queue.js"
import { prismaStore } from "./store.js"

export interface LinkedInReportContext {
  record: LinkedInReportRecord | null
  targetRole: string | null
  postings: Array<{ analysisId: string; position: string; company: string | null; posting: JobPostingData; excluded: number[] }>
}

export interface LinkedInReportStore {
  getContext(resumeId: string): Promise<LinkedInReportContext | null>
  /** CV'nin ayrıştırılmış profili; aynı model ve istemle ayrıştırıldıysa o sürüm (DOG-59). */
  profile(resumeId: string, parse: (text: string) => Promise<ResumeProfile>, parserKey: string): Promise<ResumeProfile>
  save(resumeId: string, record: LinkedInReportRecord): Promise<void>
}

/**
 * LinkedIn profil raporu (DOG-69): profil PDF'i ayrıştırılıyor (gerekirse),
 * seçilen ilanlara karşı tek tek skorlanıyor, rapor kodda kuruluyor. Yeniden
 * denenen iş bitmiş bir raporu bir daha yazmıyor.
 */
export async function runLinkedInReport(
  deps: { llm: LlmProvider; embedding: EmbeddingProvider; modelId: string; store: LinkedInReportStore },
  input: LinkedInReportJobData,
): Promise<void> {
  const context = await deps.store.getContext(input.resumeId)
  if (!context?.record || context.record.status !== "running") return
  const profile = await deps.store.profile(
    input.resumeId,
    async (text) => (await extractResumeProfile(deps.llm, text)).data,
    resumeParserKey(deps.modelId),
  )
  const scored: ScoredPosting[] = []
  for (const p of context.postings) {
    const result = await scoreProfile({ profile, posting: p.posting }, deps.embedding)
    scored.push({ analysisId: p.analysisId, position: p.position, company: p.company, result, excluded: p.excluded })
  }
  const report = linkedinReport(profile, scored, { targetRole: context.targetRole })
  // Başlık ve "Hakkında" önerisi (LLM). Patlarsa rapor yine kaydediliyor.
  let suggestions = null
  try {
    suggestions = (
      await suggestLinkedInText(deps.llm, {
        profile,
        scored,
        postings: context.postings.map((p) => p.posting),
        targetRole: context.targetRole,
      })
    ).data
  } catch (error) {
    console.error("[linkedin-report] öneri üretilemedi", error)
  }
  await deps.store.save(input.resumeId, {
    ...context.record,
    status: "done",
    report: { ...report, strengths: linkedinStrengths(scored, profile), suggestions },
  })
}

/** LinkedInReportStore'un Prisma uygulaması. */
export const prismaLinkedInStore: LinkedInReportStore = {
  async getContext(resumeId) {
    const resume = await prisma.resume.findUnique({
      where: { id: resumeId },
      select: { linkedinReport: true, user: { select: { id: true, targetRole: true } } },
    })
    if (!resume) return null
    const record = (resume.linkedinReport ?? null) as LinkedInReportRecord | null
    const ids = record?.analysisIds ?? []
    const analyses = await prisma.analysis.findMany({
      // Sahiplik: yalnızca CV sahibinin analizleri.
      where: { id: { in: ids }, userId: resume.user.id, status: "done" },
      select: { id: true, result: true, jobPosting: true },
    })
    return {
      record,
      targetRole: resume.user.targetRole,
      postings: analyses.map((a) => ({
        analysisId: a.id,
        position: a.jobPosting.position,
        company: a.jobPosting.company,
        posting: {
          position: a.jobPosting.position,
          company: a.jobPosting.company,
          seniority: a.jobPosting.seniority as never,
          language: a.jobPosting.language as never,
          requirements: a.jobPosting.requirements as never,
        },
        excluded: (a.result as { excluded?: number[] } | null)?.excluded ?? [],
      })),
    }
  },

  async profile(resumeId, parse, parserKey) {
    const parsed = await prismaStore.findParsedVersion(resumeId, parserKey)
    if (parsed) return parsed.profile
    const profile = await parse(await prismaStore.getResumeText(resumeId))
    await prismaStore.saveResumeVersion(resumeId, profile, parserKey)
    return profile
  },

  async save(resumeId, record) {
    await prisma.resume.update({ where: { id: resumeId }, data: { linkedinReport: record as unknown as object } })
  },
}
