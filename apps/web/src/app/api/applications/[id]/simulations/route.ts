import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { readSimulations, type SimulationRecord } from "@uyarla/core/interview/simulationRecord"
import { ADAPT_JOB_OPTIONS, SIMULATION_JOB, simulationJobId } from "@uyarla/worker/adapt-queue"
import { authErrorResponse, ensureOwner, ensureRegistered, getSession } from "@/server/authz"
import { positionName } from "@/features/applications/board"
import { simulationRequestSchema } from "@/features/applications/schema"
import { firstIssue } from "@/lib/validation"
import { isAdmin } from "@/server/admin"
import { PaymentRequiredError, requireEntitlement } from "@/server/billing/entitlement"
import { interviewQueue } from "@/server/interviewQueue"
import { RATE_LIMITS, enforceRateLimit, redisStore } from "@/server/rateLimit"
import {
  SIMULATION_ERROR_MESSAGE,
  addAnswer,
  endSimulation,
  retrySimulation,
  simulationsLeft,
  startSimulation,
} from "@/server/simulations"

export const runtime = "nodejs"

/** Simülasyon sayfasının verisi (DOG-172): ilan, görüşmeler, kalan hak. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const session = ensureRegistered(await getSession())
    const row = await prisma.analysis.findUnique({
      where: { id },
      select: {
        userId: true,
        status: true,
        interviewSimulations: true,
        jobPosting: { select: { position: true, company: true, rawText: true, language: true } },
      },
    })
    ensureOwner(row?.userId ?? null, session)
    const simulations = readSimulations(row!.interviewSimulations)
    return NextResponse.json({
      position: positionName(row!.jobPosting.position, row!.jobPosting.rawText),
      company: row!.jobPosting.company,
      language: row!.jobPosting.language,
      ready: row!.status === "done",
      simulations,
      simulationsLeft: simulationsLeft(simulations),
    })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    console.error("[api/applications/[id]/simulations] GET", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}

/**
 * Görüşmeyi başlatır, adayın cevabını ekler, bitirir ya da düşen adımı
 * yeniden dener. Kayıt kilit altında değişiyor (worker da yazıyor); görüşmeci
 * mesajını ve raporu worker yazıyor, sayfa GET ile yokluyor.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const session = ensureRegistered(await getSession())
    const parsed = simulationRequestSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error).message }, { status: 400 })
    const body = parsed.data

    const existing = await prisma.analysis.findUnique({ where: { id }, select: { userId: true, status: true } })
    ensureOwner(existing?.userId ?? null, session)
    // Abonelikte; ücretsizde 402 subscription_required.
    await requireEntitlement(prisma, { userId: session.user.id, feature: "interview_simulation", now: new Date(), unlimited: isAdmin(session.user) })
    if (existing!.status !== "done") return NextResponse.json({ error: "Bu analiz henüz tamamlanmadı." }, { status: 409 })
    // Bitirmek yeni bir görüşmeci mesajı istemiyor; yalnızca rapor (o da tek sefer).
    if (body.type !== "end") await enforceRateLimit(redisStore, `simulasyon:${session.user.id}`, RATE_LIMITS.interviewSimulation)

    const now = new Date()
    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Analysis" WHERE id = ${id} FOR UPDATE`
      const row = await tx.analysis.findUnique({ where: { id }, select: { interviewSimulations: true } })
      const list = readSimulations(row?.interviewSimulations)
      const result =
        body.type === "start"
          ? startSimulation(list, randomUUID(), now)
          : body.type === "answer"
            ? addAnswer(list, body.simulationId, body.text, now)
            : body.type === "end"
              ? endSimulation(list, body.simulationId)
              : retrySimulation(list, body.simulationId)
      if ("error" in result) return result
      await tx.analysis.update({ where: { id }, data: { interviewSimulations: result.list as unknown as object } })
      return result
    })
    if ("error" in outcome) {
      return NextResponse.json({ error: SIMULATION_ERROR_MESSAGE[outcome.error], code: outcome.error }, { status: 400 })
    }

    await enqueue(id, outcome.simulation, body.type === "end" ? "end" : body.type === "retry" ? `retry${now.getTime()}` : "turn")
    return NextResponse.json({ simulation: outcome.simulation }, { status: 202 })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    if (error instanceof PaymentRequiredError) return NextResponse.json({ error: error.message, code: error.code }, { status: 402 })
    console.error("[api/applications/[id]/simulations] POST", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}

function enqueue(analysisId: string, simulation: SimulationRecord, tag: string) {
  return interviewQueue.add(
    SIMULATION_JOB,
    { analysisId, simulationId: simulation.id },
    { ...ADAPT_JOB_OPTIONS, jobId: simulationJobId(simulation.id, simulation.messages.length, tag) },
  )
}
