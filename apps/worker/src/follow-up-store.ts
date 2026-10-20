import {
  AdaptationDraftSchema,
  PermanentError,
  analysisProfile,
  applyAdaptation,
  readFollowUps,
  type CoverLetterRecord,
  type FollowUpRecord,
  type JobPostingData,
  type ResumeProfile,
} from "@uyarla/core"
import { prisma } from "@uyarla/db"

export interface FollowUpContext {
  /** Gönderilen CV: uyarlama varsa kabul edilenlerle, yoksa analizdeki profil. */
  profile: ResumeProfile
  coverLetter: string[]
  posting: JobPostingData
  record: FollowUpRecord
  /** "YYYY-AA-GG"; takipte başvuru günü, teşekkürde mülakat günü. */
  date: string | null
}

export interface FollowUpStore {
  getContext(analysisId: string, followUpId: string): Promise<FollowUpContext | null>
  update(analysisId: string, followUpId: string, patch: Partial<FollowUpRecord>): Promise<void>
}

const day = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null

/** FollowUpStore'un Prisma uygulaması (DOG-117). */
export const prismaFollowUpStore: FollowUpStore = {
  async getContext(analysisId, followUpId) {
    const analysis = await prisma.analysis.findUnique({
      where: { id: analysisId },
      select: {
        followUps: true,
        result: true,
        stageChangedAt: true,
        interviewAt: true,
        resumeVersion: { select: { profile: true } },
        jobPosting: true,
        adaptation: { select: { status: true, draft: true, coverLetter: true } },
      },
    })
    if (!analysis?.resumeVersion) throw new PermanentError("Analiz bulunamadı", "analysis_not_found")
    const record = readFollowUps(analysis.followUps).find((f) => f.id === followUpId)
    if (!record) return null

    // Gönderilen CV: kullanıcının uyarlamada kabul ettikleri (DOG-117).
    let profile = analysisProfile(analysis.resumeVersion.profile as unknown as ResumeProfile, analysis.result)
    const adaptation = analysis.adaptation
    if (adaptation && (adaptation.status === "draft" || adaptation.status === "ready")) {
      const draft = AdaptationDraftSchema.safeParse(adaptation.draft)
      if (draft.success) profile = applyAdaptation(profile, draft.data)
    }
    const letter = adaptation?.coverLetter as CoverLetterRecord | null | undefined
    const posting = analysis.jobPosting
    return {
      profile,
      coverLetter: letter?.status === "done" ? letter.paragraphs.map((p) => p.text) : [],
      posting: {
        position: posting.position,
        company: posting.company,
        seniority: posting.seniority as never,
        language: posting.language as never,
        requirements: posting.requirements as never,
      },
      record,
      date: record.kind === "thanks" ? day(analysis.interviewAt) : day(analysis.stageChangedAt),
    }
  },

  async update(analysisId, followUpId, patch) {
    await prisma.$transaction(async (tx) => {
      // Web ucu da diziye ekliyor; satır kilidiyle birbirini ezmiyorlar.
      await tx.$queryRaw`SELECT id FROM "Analysis" WHERE id = ${analysisId} FOR UPDATE`
      const row = await tx.analysis.findUnique({ where: { id: analysisId }, select: { followUps: true } })
      const list = readFollowUps(row?.followUps).map((f) => (f.id === followUpId ? { ...f, ...patch } : f))
      await tx.analysis.update({ where: { id: analysisId }, data: { followUps: list as unknown as object } })
    })
  },
}
