import { randomUUID } from "node:crypto"
import { AdaptationDraftSchema, hasPendingDecisions, type CoverLetterRecord } from "@uyarla/core"
import { prisma } from "@uyarla/db"
import { ADAPT_JOB_OPTIONS, CONTRIBUTION_JOB, COVER_LETTER_JOB } from "@uyarla/worker/adapt-queue"
import { NextResponse } from "next/server"
import { adaptQueue } from "@/server/adaptQueue"
import { loadAdaptation } from "@/server/adaptationDecision"
import { authErrorResponse, ensureOwner, ensureRegistered, getSession } from "@/server/authz"
import { CONTRIBUTION_ERROR_MESSAGE, addContribution, type ContributionInput } from "@/server/contribution"
import { RATE_LIMITS, enforceRateLimit, redisStore } from "@/server/rateLimit"

export const runtime = "nodejs"

/**
 * Ön yazı üretimini başlatır. Sonuç GET /api/adapt/[id] cevabındaki
 * `coverLetter` alanından yoklanıyor; ayrı bir durum ucu yok.
 *
 * Aynı uyarlama için yeniden çağrılırsa ön yazı yeniden üretiliyor
 * ("Yeniden yaz"); zaten hazırlanıyorsa ikinci iş kuyruğa atılmıyor.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  // Gövdede `contribution` varsa bu bir "AI ile yaz" isteği (DOG-94). Ayrı
  // route değil: bu dosya kuyruğa zaten iş koyuyor ve Vercel Hobby'de deploy
  // başına 12 fonksiyon var; yeni bağımlılıklı bir route sınırı aşıyor.
  const body = (await request.json().catch(() => null)) as { contribution?: ContributionInput } | null
  if (body?.contribution) return startContribution(id, body.contribution)
  try {
    // Kayıt kontrolü kaynağı aramadan önce (bkz. POST /api/adapt).
    const session = ensureRegistered(await getSession())

    const payload = await loadAdaptation(id)
    if (!payload) return NextResponse.json({ error: "Uyarlama bulunamadı." }, { status: 404 })
    ensureOwner(payload.ownerId, session)

    if (payload.adaptation.status !== "draft" && payload.adaptation.status !== "ready") {
      return NextResponse.json(
        { error: "Uyarlama tamamlanınca ön yazı hazırlayabilirsin.", code: "adaptation_not_ready" },
        { status: 400 },
      )
    }

    const existing = payload.adaptation.coverLetter as CoverLetterRecord | null
    if (existing?.status === "running") {
      return NextResponse.json({ coverLetter: existing }, { status: 202 })
    }

    // Pahalı uç: her çağrı bir LLM üretimi (spec §9).
    await enforceRateLimit(redisStore, `onyazi:${session.user.id}`, RATE_LIMITS.registered)

    const record: CoverLetterRecord = { status: "running" }
    await prisma.adaptation.update({ where: { id }, data: { coverLetter: record } })
    await adaptQueue.add(COVER_LETTER_JOB, { adaptationId: id }, ADAPT_JOB_OPTIONS)

    return NextResponse.json({ coverLetter: record }, { status: 202 })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    console.error("[api/adapt/[id]/cover-letter]", error)
    return NextResponse.json(
      { error: "Bir şeyler ters gitti. Birazdan tekrar dener misin?" },
      { status: 500 },
    )
  }
}

/**
 * Kullanıcının bir eksik gereksinim için anlattığı deneyimden madde yazımını
 * başlatır (DOG-94). Katkı taslağa "running" olarak ekleniyor, worker
 * dolduruyor; sonuç GET /api/adapt/[id]'deki taslaktan yoklanıyor.
 */
async function startContribution(id: string, input: ContributionInput) {
  try {
    const session = ensureRegistered(await getSession())
    const payload = await loadAdaptation(id)
    if (!payload?.draft || !payload.profile) {
      return NextResponse.json({ error: "Uyarlama bulunamadı." }, { status: 404 })
    }
    ensureOwner(payload.ownerId, session)
    if (payload.adaptation.status !== "draft" && payload.adaptation.status !== "ready") {
      return NextResponse.json({ error: "Uyarlama tamamlanınca madde ekleyebilirsin." }, { status: 400 })
    }

    // Pahalı uç: her çağrı bir LLM üretimi.
    await enforceRateLimit(redisStore, `katki:${session.user.id}`, RATE_LIMITS.registered)

    const contributionId = randomUUID()
    const outcome = await prisma.$transaction(async (tx) => {
      // Worker ve karar ucu da taslağı okuyup yazıyor; satır kilidiyle
      // birbirlerinin değişikliğini ezmiyorlar.
      await tx.$queryRaw`SELECT id FROM "Adaptation" WHERE id = ${id} FOR UPDATE`
      const row = await tx.adaptation.findUnique({ where: { id }, select: { draft: true } })
      const draft = AdaptationDraftSchema.parse(row!.draft)
      const added = addContribution(draft, payload.profile!, payload.posting, input, contributionId)
      if ("error" in added) return added
      await tx.adaptation.update({
        where: { id },
        data: { draft: added.draft as unknown as object, status: hasPendingDecisions(added.draft) ? "draft" : "ready" },
      })
      return added
    })
    if ("error" in outcome) {
      return NextResponse.json({ error: CONTRIBUTION_ERROR_MESSAGE[outcome.error], code: outcome.error }, { status: 400 })
    }

    await adaptQueue.add(CONTRIBUTION_JOB, { adaptationId: id, contributionId }, ADAPT_JOB_OPTIONS)
    return NextResponse.json({ contribution: outcome.contribution }, { status: 202 })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    console.error("[api/adapt/[id]/cover-letter] contribution", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti. Birazdan tekrar dener misin?" }, { status: 500 })
  }
}
