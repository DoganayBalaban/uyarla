import type { CoverLetterRecord } from "@uyarla/core"
import { prisma } from "@uyarla/db"
import { ADAPT_JOB_OPTIONS, COVER_LETTER_JOB } from "@uyarla/worker/adapt-queue"
import { NextResponse } from "next/server"
import { adaptQueue } from "@/server/adaptQueue"
import { loadAdaptation } from "@/server/adaptationDecision"
import { authErrorResponse, ensureOwner, ensureRegistered, getSession } from "@/server/authz"
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
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
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
