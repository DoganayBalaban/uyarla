import { withAdaptation } from "@uyarla/core/score/adapted"
import {
  AdaptationDraftSchema,
  PermanentError,
  analysisProfile,
  applyAdaptation,
  readFollowUps,
  readFormAnswers,
  type CoverLetterRecord,
  type FormAnswerRecord,
  type FollowUpRecord,
  type InterviewPrepRecord,
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

/** Mülakat hazırlığının bağlamı (DOG-118): gönderilen belgeler ve eksikler. */
export interface InterviewPrepContext {
  profile: ResumeProfile
  coverLetter: string[]
  posting: JobPostingData
  missingMust: string[]
  rewritten: string[]
  record: InterviewPrepRecord | null
}

export interface InterviewPrepStore {
  getPrepContext(analysisId: string): Promise<InterviewPrepContext>
  /**
   * Kaydı kilit altında okuyup günceller (DOG-97): paket ve pratik aynı
   * JSON'da; web ucu da ekliyor, birbirini ezmesinler.
   */
  updatePrep(analysisId: string, change: (current: InterviewPrepRecord | null) => InterviewPrepRecord | null): Promise<void>
}

/** Başvuru formu yanıtının bağlamı (DOG-123): gönderilen belgeler ve soru. */
export interface FormAnswerContext {
  profile: ResumeProfile
  coverLetter: string[]
  posting: JobPostingData
  record: FormAnswerRecord
}

export interface FormAnswerStore {
  getContext(analysisId: string, answerId: string): Promise<FormAnswerContext | null>
  update(analysisId: string, answerId: string, patch: Partial<FormAnswerRecord>): Promise<void>
}

/** JSON dizisini olduğu gibi okur; dizi değilse boş. */
const rawList = (value: unknown): Array<{ id?: unknown } & Record<string, unknown>> =>
  Array.isArray(value) ? (value.filter((x) => x && typeof x === "object") as Array<{ id?: unknown } & Record<string, unknown>>) : []

const day = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null

const SENT_SELECT = {
  followUps: true,
  formAnswers: true,
  interviewPrep: true,
  result: true,
  stageChangedAt: true,
  interviewAt: true,
  resumeVersion: { select: { profile: true } },
  jobPosting: true,
  adaptation: { select: { status: true, draft: true, coverLetter: true } },
} as const

/**
 * Başvurunun gönderilen hâli (DOG-117, DOG-118): uyarlama varsa kabul
 * edilenlerle CV ve ön yazı, yoksa analizdeki profil. Uyarlamada yeniden
 * yazılıp kabul edilen maddeler de (tutarlılık özeti için).
 */
async function sentDocuments(analysisId: string) {
  const analysis = await prisma.analysis.findUnique({ where: { id: analysisId }, select: SENT_SELECT })
  if (!analysis?.resumeVersion) throw new PermanentError("Analiz bulunamadı", "analysis_not_found")
  const baseProfile = analysisProfile(analysis.resumeVersion.profile as unknown as ResumeProfile, analysis.result)
  let profile = baseProfile
  let rewritten: string[] = []
  const adaptation = analysis.adaptation
  if (adaptation && (adaptation.status === "draft" || adaptation.status === "ready")) {
    const draft = AdaptationDraftSchema.safeParse(adaptation.draft)
    if (draft.success) {
      profile = applyAdaptation(profile, draft.data)
      rewritten = draft.data.bullets.filter((b) => b.decision === "accepted" && b.rewritten.trim() && b.rewritten !== b.original).map((b) => b.rewritten)
    }
  }
  const letter = adaptation?.coverLetter as CoverLetterRecord | null | undefined
  const posting = analysis.jobPosting
  return {
    analysis,
    profile,
    /** Taslak uygulandı: gönderilen CV uyarlanmış hâli. */
    adapted: profile !== baseProfile,
    rewritten,
    coverLetter: letter?.status === "done" ? letter.paragraphs.map((p) => p.text) : [],
    posting: {
      position: posting.position,
      company: posting.company,
      seniority: posting.seniority as never,
      language: posting.language as never,
      requirements: posting.requirements as never,
    } satisfies JobPostingData,
  }
}

/**
 * CV'de karşılığı olmayan zorunlu gereksinimler; şart, kişisel nitelik ve
 * işaretliler hariç. Uyarlama varsa uyarlanmış CV'ye göre (DOG-166): paket
 * gönderilen CV'nin eksiklerini sormalı, uyarlamada kapananları değil.
 */
export function missingMustRequirements(analysisResult: unknown, adapted: boolean): string[] {
  const result = adapted ? withAdaptation((analysisResult ?? null) as Parameters<typeof withAdaptation>[0]) : analysisResult
  const r = result as { requirements?: Array<{ status: string; requirement: { text: string; importance: string; type: string } }>; excluded?: number[] } | null
  const excluded = new Set(r?.excluded ?? [])
  return (r?.requirements ?? [])
    .filter((x, i) => !excluded.has(i) && x.status === "missing" && x.requirement.importance === "must" && !["soft", "condition"].includes(x.requirement.type))
    .map((x) => x.requirement.text)
}

/** InterviewPrepStore'un Prisma uygulaması (DOG-118). */
export const prismaInterviewPrepStore: InterviewPrepStore = {
  async getPrepContext(analysisId) {
    const sent = await sentDocuments(analysisId)
    return {
      profile: sent.profile,
      coverLetter: sent.coverLetter,
      posting: sent.posting,
      missingMust: missingMustRequirements(sent.analysis.result, sent.adapted),
      rewritten: sent.rewritten,
      record: (sent.analysis.interviewPrep ?? null) as InterviewPrepRecord | null,
    }
  },
  async updatePrep(analysisId, change) {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Analysis" WHERE id = ${analysisId} FOR UPDATE`
      const row = await tx.analysis.findUnique({ where: { id: analysisId }, select: { interviewPrep: true } })
      const next = change((row?.interviewPrep ?? null) as InterviewPrepRecord | null)
      if (next) await tx.analysis.update({ where: { id: analysisId }, data: { interviewPrep: next as unknown as object } })
    })
  },
}

/** FollowUpStore'un Prisma uygulaması (DOG-117). */
export const prismaFollowUpStore: FollowUpStore = {
  async getContext(analysisId, followUpId) {
    const sent = await sentDocuments(analysisId)
    const record = readFollowUps(sent.analysis.followUps).find((f) => f.id === followUpId)
    if (!record) return null
    return {
      profile: sent.profile,
      coverLetter: sent.coverLetter,
      posting: sent.posting,
      record,
      date: record.kind === "thanks" ? day(sent.analysis.interviewAt) : day(sent.analysis.stageChangedAt),
    }
  },

  async update(analysisId, followUpId, patch) {
    await prisma.$transaction(async (tx) => {
      // Web ucu da diziye ekliyor; satır kilidiyle birbirini ezmiyorlar.
      await tx.$queryRaw`SELECT id FROM "Analysis" WHERE id = ${analysisId} FOR UPDATE`
      const row = await tx.analysis.findUnique({ where: { id: analysisId }, select: { followUps: true } })
      // Ham dizi korunuyor: bu sürümün tanımadığı kayıtlar silinmesin.
      const list = rawList(row?.followUps).map((f) => (f.id === followUpId ? { ...f, ...patch } : f))
      await tx.analysis.update({ where: { id: analysisId }, data: { followUps: list as unknown as object } })
    })
  },
}

/** FormAnswerStore'un Prisma uygulaması (DOG-123). */
export const prismaFormAnswerStore: FormAnswerStore = {
  async getContext(analysisId, answerId) {
    const sent = await sentDocuments(analysisId)
    const record = readFormAnswers(sent.analysis.formAnswers).find((a) => a.id === answerId)
    if (!record) return null
    return { profile: sent.profile, coverLetter: sent.coverLetter, posting: sent.posting, record }
  },

  async update(analysisId, answerId, patch) {
    await prisma.$transaction(async (tx) => {
      // Web ucu da diziye ekliyor; satır kilidiyle birbirini ezmiyorlar.
      await tx.$queryRaw`SELECT id FROM "Analysis" WHERE id = ${analysisId} FOR UPDATE`
      const row = await tx.analysis.findUnique({ where: { id: analysisId }, select: { formAnswers: true } })
      const list = rawList(row?.formAnswers).map((a) => (a.id === answerId ? { ...a, ...patch } : a))
      await tx.analysis.update({ where: { id: analysisId }, data: { formAnswers: list as unknown as object } })
    })
  },
}
