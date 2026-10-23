import {
  auditProfile,
  extractResumeProfile,
  fromResumeProfile,
  mergeRetried,
  resumeParserKey,
  toResumeProfile,
  writeLinkedInRewrites,
  type ScoredPosting,
} from "@uyarla/core"
import type { EmbeddingProvider, JobPostingData, LinkedInAuditReport, LinkedInProfileData, LinkedInRewrites, LlmProvider, ResumeProfile } from "@uyarla/core"
import { scoreProfile } from "@uyarla/core/score/live"
import { prisma } from "@uyarla/db"
import type { LinkedInAuditJobData } from "./adapt-queue.js"
import { prismaStore } from "./store.js"

export interface LinkedInAuditContext {
  audit: {
    id: string
    status: "running" | "done" | "failed"
    source: "extension" | "pdf"
    resumeId: string | null
    profile: LinkedInProfileData | null
    targetRole: string | null
    analysisIds: string[]
    report: LinkedInAuditReport | null
    rewrites: LinkedInRewrites | null
  }
  goal: string | null
  postings: Array<{ analysisId: string; position: string; company: string | null; posting: JobPostingData; excluded: number[] }>
}

export interface LinkedInAuditStore {
  getContext(auditId: string): Promise<LinkedInAuditContext | null>
  /** PDF yolu: CV'nin ayrıştırılmış profili; aynı model ve istemle ayrıştırıldıysa o sürüm (DOG-59). */
  resumeProfile(resumeId: string, parse: (text: string) => Promise<ResumeProfile>, parserKey: string): Promise<ResumeProfile>
  update(
    auditId: string,
    data: Partial<{ status: "running" | "done" | "failed"; stage: string | null; profile: LinkedInProfileData; report: LinkedInAuditReport; rewrites: LinkedInRewrites }>,
  ): Promise<void>
}

/**
 * LinkedIn profil denetimi (DOG-157, spec §4.1). Aşamalar kayda yazılıyor
 * (DOG-136); ekran yalnızca bunu gösteriyor. Yeniden denemede yalnızca düşen
 * yazımlar değişiyor, teşhis aynen kalıyor.
 */
export async function runLinkedInAudit(
  deps: { llm: LlmProvider; embedding: EmbeddingProvider; modelId: string; store: LinkedInAuditStore },
  input: LinkedInAuditJobData,
): Promise<void> {
  const context = await deps.store.getContext(input.auditId)
  if (!context || context.audit.status !== "running") return
  const { audit } = context
  const postings = context.postings.map((p) => p.posting)

  if (input.retry) {
    if (!audit.profile || !audit.report || !audit.rewrites) return
    const { rewrites } = await writeLinkedInRewrites(deps.llm, { profile: audit.profile, targetRole: audit.targetRole, strengths: audit.report.skills.pinFirst, postings })
    await deps.store.update(audit.id, { status: "done", stage: null, rewrites: mergeRetried(audit.rewrites, rewrites) })
    return
  }

  await deps.store.update(audit.id, { stage: "reading" })
  let profile = audit.profile
  if (audit.source === "pdf") {
    if (!audit.resumeId) throw new Error("PDF denetiminde CV yok")
    const resume = await deps.store.resumeProfile(audit.resumeId, async (text) => (await extractResumeProfile(deps.llm, text)).data, resumeParserKey(deps.modelId))
    profile = fromResumeProfile(resume)
    await deps.store.update(audit.id, { profile })
  }
  if (!profile) throw new Error("Denetimde profil yok")

  await deps.store.update(audit.id, { stage: "checking" })
  const resume = toResumeProfile(profile)
  const scored: ScoredPosting[] = []
  for (const p of context.postings) {
    const result = await scoreProfile({ profile: resume, posting: p.posting }, deps.embedding)
    scored.push({ analysisId: p.analysisId, position: p.position, company: p.company, result, excluded: p.excluded })
  }
  const report = auditProfile(profile, { targetRole: audit.targetRole, goal: context.goal, scored })

  await deps.store.update(audit.id, { stage: "writing", report })
  const { rewrites } = await writeLinkedInRewrites(deps.llm, { profile, targetRole: audit.targetRole, strengths: report.skills.pinFirst, postings })
  await deps.store.update(audit.id, { status: "done", stage: null, rewrites })
}

/** LinkedInAuditStore'un Prisma uygulaması. */
export const prismaLinkedInAuditStore: LinkedInAuditStore = {
  async getContext(auditId) {
    const row = await prisma.linkedInAudit.findUnique({ where: { id: auditId }, include: { user: { select: { id: true, goal: true } } } })
    if (!row) return null
    const analyses = await prisma.analysis.findMany({
      // Sahiplik: yalnızca denetim sahibinin analizleri.
      where: { id: { in: row.analysisIds }, userId: row.user.id, status: "done" },
      select: { id: true, result: true, jobPosting: true },
    })
    return {
      audit: {
        id: row.id,
        status: row.status,
        source: row.source,
        resumeId: row.resumeId,
        profile: (row.profile ?? null) as LinkedInProfileData | null,
        targetRole: row.targetRole,
        analysisIds: row.analysisIds,
        report: (row.report ?? null) as LinkedInAuditReport | null,
        rewrites: (row.rewrites ?? null) as LinkedInRewrites | null,
      },
      goal: row.user.goal,
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

  async resumeProfile(resumeId, parse, parserKey) {
    const parsed = await prismaStore.findParsedVersion(resumeId, parserKey)
    if (parsed) return parsed.profile
    const profile = await parse(await prismaStore.getResumeText(resumeId))
    await prismaStore.saveResumeVersion(resumeId, profile, parserKey)
    return profile
  },

  async update(auditId, data) {
    await prisma.linkedInAudit.update({ where: { id: auditId }, data: data as never })
  },
}
