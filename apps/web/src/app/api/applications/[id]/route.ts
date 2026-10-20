import { type Prisma, prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { authErrorResponse, ensureOwner, ensureRegistered, getSession } from "@/server/authz"
import { BOARD_SELECT, toBoardCard } from "@/features/applications/board"
import { applicationPatchSchema, followUpRequestSchema } from "@/features/applications/schema"
import { firstIssue } from "@/lib/validation"
import { randomUUID } from "node:crypto"
import { ADAPT_JOB_OPTIONS, FOLLOW_UP_JOB } from "@uyarla/worker/adapt-queue"
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
    const parsed = followUpRequestSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error).message }, { status: 400 })

    const existing = await prisma.analysis.findUnique({ where: { id }, select: { userId: true, status: true } })
    ensureOwner(existing?.userId ?? null, session)
    if (existing!.status !== "done") return NextResponse.json({ error: "Bu analiz henüz tamamlanmadı." }, { status: 409 })

    // Her taslak bir LLM çağrısı.
    await enforceRateLimit(redisStore, `takip:${session.user.id}`, RATE_LIMITS.registered)

    const followUpId = randomUUID()
    const outcome = await prisma.$transaction(async (tx) => {
      // Worker da diziye yazıyor; satır kilidiyle birbirini ezmiyorlar.
      await tx.$queryRaw`SELECT id FROM "Analysis" WHERE id = ${id} FOR UPDATE`
      const row = await tx.analysis.findUnique({ where: { id }, select: { followUps: true } })
      const added = addFollowUp(row?.followUps, parsed.data, followUpId, new Date())
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
