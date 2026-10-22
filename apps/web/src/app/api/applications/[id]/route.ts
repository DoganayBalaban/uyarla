import { type Prisma, prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { authErrorResponse, ensureOwner, ensureRegistered, getSession } from "@/server/authz"
import { BOARD_SELECT, positionName, toBoardCard } from "@/features/applications/board"
import {
  applicationPatchSchema,
  followUpRequestSchema,
  interviewPrepRequestSchema,
  practiceRequestSchema,
  formAnswerRequestSchema,
  type FormAnswerRequest,
  type PracticeRequest,
} from "@/features/applications/schema"
import { firstIssue } from "@/lib/validation"
import { randomUUID } from "node:crypto"
import { ADAPT_JOB_OPTIONS, FOLLOW_UP_JOB, FORM_ANSWER_JOB, INTERVIEW_PREP_JOB, PRACTICE_JOB } from "@uyarla/worker/adapt-queue"
import { MAX_PREP_ATTEMPTS, type InterviewPrepRecord } from "@uyarla/core/interview/prep"
import type { ResumeProfile } from "@uyarla/core/schemas/resume"
import { prepWaitingPreview } from "@/features/applications/prepWaiting"
import { addPractice, PRACTICE_ERROR_MESSAGE } from "@/server/practice"
import { addFormAnswer, FORM_ANSWER_ERROR_MESSAGE } from "@/server/formAnswers"
import { adaptQueue } from "@/server/adaptQueue"
import { FOLLOW_UP_ERROR_MESSAGE, addFollowUp } from "@/server/followUps"
import { RATE_LIMITS, enforceRateLimit, redisStore } from "@/server/rateLimit"

export const runtime = "nodejs"

/** Kartın aşamasını, notunu ve/veya mülakat gününü günceller. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const session = ensureRegistered(await getSession())

    const parsed = applicationPatchSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssue(parsed.error).message }, { status: 400 })
    }
    const body = parsed.data
    const patchData: Prisma.AnalysisUpdateInput = {}

    if (body.stage !== undefined) {
      patchData.stage = body.stage
      patchData.stageChangedAt = new Date()
      // Yeniden "Başvuruldu"ya alınan kart için takip hatırlatması yeniden
      // kurulsun (DOG-98).
      if (body.stage === "applied") patchData.reminderSentAt = null
    }
    if (body.interviewAt !== undefined) {
      patchData.interviewAt = body.interviewAt ? new Date(`${body.interviewAt}T00:00:00Z`) : null
    }
    if (body.note !== undefined) {
      patchData.note = body.note || null
    }

    const existing = await prisma.analysis.findUnique({ where: { id }, select: { userId: true } })
    // Başkasının kaydı da "yok" gibi görünüyor (404), 403 değil: var olduğunu
    // sızdırmamak için (Sprint 3A kararı).
    ensureOwner(existing?.userId ?? null, session)

    const current = await prisma.analysis.update({
      where: { id },
      data: patchData,
      select: BOARD_SELECT,
    })
    return NextResponse.json({ card: toBoardCard(current) })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    console.error("[api/applications/[id]]", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}

/**
 * Takip mesajı ya da teşekkür notu taslağı ister (DOG-117). Taslak analizin
 * `followUps` dizisine "running" olarak ekleniyor, worker dolduruyor; sonuç
 * pano sorgusundan yoklanıyor. Biz göndermiyoruz; kullanıcı kopyalıyor.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const session = ensureRegistered(await getSession())
    const body = await request.json().catch(() => ({}))
    if (interviewPrepRequestSchema.safeParse(body).success) return startInterviewPrep(id, session)
    if ((body as { type?: unknown })?.type === "practice") {
      const practice = practiceRequestSchema.safeParse(body)
      if (!practice.success) return NextResponse.json({ error: firstIssue(practice.error).message }, { status: 400 })
      return startPractice(id, session, practice.data)
    }
    if ((body as { type?: unknown })?.type === "form-answer") {
      const form = formAnswerRequestSchema.safeParse(body)
      if (!form.success) return NextResponse.json({ error: firstIssue(form.error).message }, { status: 400 })
      return startFormAnswer(id, session, form.data)
    }
    const parsed = followUpRequestSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error).message }, { status: 400 })

    const existing = await prisma.analysis.findUnique({ where: { id }, select: { userId: true, status: true, stage: true } })
    ensureOwner(existing?.userId ?? null, session)
    if (existing!.status !== "done") return NextResponse.json({ error: "Bu analiz henüz tamamlanmadı." }, { status: 409 })

    // Her taslak bir LLM çağrısı.
    await enforceRateLimit(redisStore, `takip:${session.user.id}`, RATE_LIMITS.registered)

    const followUpId = randomUUID()
    const outcome = await prisma.$transaction(async (tx) => {
      // Worker da diziye yazıyor; satır kilidiyle birbirini ezmiyorlar.
      await tx.$queryRaw`SELECT id FROM "Analysis" WHERE id = ${id} FOR UPDATE`
      const row = await tx.analysis.findUnique({ where: { id }, select: { followUps: true } })
      const added = addFollowUp(row?.followUps, { ...parsed.data, applied: existing!.stage !== "saved" }, followUpId, new Date())
      if ("error" in added) return added
      await tx.analysis.update({ where: { id }, data: { followUps: added.list as unknown as object } })
      return added
    })
    if ("error" in outcome) {
      return NextResponse.json({ error: FOLLOW_UP_ERROR_MESSAGE[outcome.error], code: outcome.error }, { status: 400 })
    }

    await adaptQueue.add(FOLLOW_UP_JOB, { analysisId: id, followUpId }, ADAPT_JOB_OPTIONS)
    return NextResponse.json({ followUp: outcome.record }, { status: 202 })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    console.error("[api/applications/[id]] POST", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}

/**
 * Mülakat hazırlık paketi (DOG-118). Kayıt "running" olarak yazılıyor, worker
 * dolduruyor; sayfa GET ile yokluyor. Yeniden yazma bir kez; yazılırken
 * önceki paket görünmeye devam ediyor.
 */
async function startInterviewPrep(id: string, session: Awaited<ReturnType<typeof getSession>> & object) {
  const existing = await prisma.analysis.findUnique({ where: { id }, select: { userId: true, status: true } })
  ensureOwner(existing?.userId ?? null, session)
  if (existing!.status !== "done") return NextResponse.json({ error: "Bu analiz henüz tamamlanmadı." }, { status: 409 })
  await enforceRateLimit(redisStore, `mulakat:${session.user.id}`, RATE_LIMITS.registered)

  const outcome = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Analysis" WHERE id = ${id} FOR UPDATE`
    const row = await tx.analysis.findUnique({ where: { id }, select: { interviewPrep: true } })
    const prev = (row?.interviewPrep ?? null) as InterviewPrepRecord | null
    if (prev?.status === "running") return { error: "Hazırlık paketin hâlâ hazırlanıyor." }
    if ((prev?.attempts ?? 0) >= MAX_PREP_ATTEMPTS) return { error: "Bu başvuru için hazırlık paketini en fazla iki kez oluşturabiliyoruz." }
    const record: InterviewPrepRecord = {
      status: "running",
      createdAt: new Date().toISOString(),
      attempts: (prev?.attempts ?? 0) + 1,
      ...(prev?.prep ? { prep: prev.prep } : {}),
    }
    await tx.analysis.update({ where: { id }, data: { interviewPrep: record as unknown as object } })
    return { record }
  })
  if ("error" in outcome) return NextResponse.json({ error: outcome.error }, { status: 400 })

  await adaptQueue.add(INTERVIEW_PREP_JOB, { analysisId: id }, ADAPT_JOB_OPTIONS)
  return NextResponse.json({ interviewPrep: outcome.record }, { status: 202 })
}

/**
 * Yazılı mülakat pratiği (DOG-97): cevap hazırlık kaydına "running" olarak
 * ekleniyor, worker geri bildirimi yazıyor; sayfa GET ile yokluyor.
 */
async function startPractice(id: string, session: Awaited<ReturnType<typeof getSession>> & object, body: PracticeRequest) {
  const existing = await prisma.analysis.findUnique({ where: { id }, select: { userId: true } })
  ensureOwner(existing?.userId ?? null, session)
  await enforceRateLimit(redisStore, `pratik:${session.user.id}`, RATE_LIMITS.registered)

  const practiceId = randomUUID()
  const outcome = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Analysis" WHERE id = ${id} FOR UPDATE`
    const row = await tx.analysis.findUnique({ where: { id }, select: { interviewPrep: true } })
    const added = addPractice((row?.interviewPrep ?? null) as InterviewPrepRecord | null, body, practiceId, new Date())
    if ("error" in added) return added
    await tx.analysis.update({ where: { id }, data: { interviewPrep: added.record as unknown as object } })
    return added
  })
  if ("error" in outcome) return NextResponse.json({ error: PRACTICE_ERROR_MESSAGE[outcome.error], code: outcome.error }, { status: 400 })

  await adaptQueue.add(PRACTICE_JOB, { analysisId: id, practiceId }, ADAPT_JOB_OPTIONS)
  return NextResponse.json({ practice: outcome.entry }, { status: 202 })
}

/**
 * Başvuru formu yanıtı (DOG-123): soru `formAnswers` dizisine "running"
 * olarak ekleniyor, worker yazıyor; uyarlama sayfası yokluyor.
 */
async function startFormAnswer(id: string, session: Awaited<ReturnType<typeof getSession>> & object, body: FormAnswerRequest) {
  const existing = await prisma.analysis.findUnique({ where: { id }, select: { userId: true, status: true } })
  ensureOwner(existing?.userId ?? null, session)
  if (existing!.status !== "done") return NextResponse.json({ error: "Bu analiz henüz tamamlanmadı." }, { status: 409 })
  await enforceRateLimit(redisStore, `form:${session.user.id}`, RATE_LIMITS.registered)

  const answerId = randomUUID()
  const outcome = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Analysis" WHERE id = ${id} FOR UPDATE`
    const row = await tx.analysis.findUnique({ where: { id }, select: { formAnswers: true } })
    const added = addFormAnswer(row?.formAnswers, { question: body.question, limit: body.limit ?? null }, answerId, new Date())
    if ("error" in added) return added
    await tx.analysis.update({ where: { id }, data: { formAnswers: added.list as unknown as object } })
    return added
  })
  if ("error" in outcome) {
    return NextResponse.json({ error: FORM_ANSWER_ERROR_MESSAGE[outcome.error], code: outcome.error }, { status: 400 })
  }

  await adaptQueue.add(FORM_ANSWER_JOB, { analysisId: id, answerId }, ADAPT_JOB_OPTIONS)
  return NextResponse.json({ formAnswer: outcome.record }, { status: 202 })
}

/** Hazırlık sayfasının verisi (DOG-118): ilan, aşama ve paket. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const session = ensureRegistered(await getSession())
    const row = await prisma.analysis.findUnique({
      where: { id },
      select: {
        userId: true,
        stage: true,
        interviewAt: true,
        interviewPrep: true,
        jobPosting: { select: { position: true, company: true, rawText: true } },
        adaptation: { select: { id: true, status: true } },
      },
    })
    ensureOwner(row?.userId ?? null, session)
    const prep = (row!.interviewPrep ?? null) as InterviewPrepRecord | null
    return NextResponse.json({
      // Hazırlık sürerken bekleme ekranının malzemesi (K-104); bitince yok.
      prepPreview: prep?.status === "running" ? await runningPrepPreview(id) : null,
      position: positionName(row!.jobPosting.position, row!.jobPosting.rawText),
      company: row!.jobPosting.company,
      stage: row!.stage,
      interviewAt: row!.interviewAt?.toISOString().slice(0, 10) ?? null,
      adaptationId: row!.adaptation && row!.adaptation.status !== "failed" ? row!.adaptation.id : null,
      interviewPrep: row!.interviewPrep ?? null,
      prepAttemptsLeft: MAX_PREP_ATTEMPTS - (((row!.interviewPrep ?? null) as InterviewPrepRecord | null)?.attempts ?? 0),
    })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    console.error("[api/applications/[id]] GET", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}

/** CV kesiti ve karşılanmayan şartlar; yalnızca hazırlık sürerken okunuyor. */
async function runningPrepPreview(analysisId: string) {
  const analysis = await prisma.analysis.findUnique({
    where: { id: analysisId },
    select: { result: true, resumeVersion: { select: { profile: true } } },
  })
  return prepWaitingPreview((analysis?.resumeVersion?.profile ?? null) as ResumeProfile | null, analysis?.result ?? null)
}
