import type { OnYaziKaydi } from "@uyarla/core"
import { prisma } from "@uyarla/db"
import { ADAPT_JOB_OPTIONS, COVER_LETTER_JOB } from "@uyarla/worker/adapt-queue"
import { NextResponse } from "next/server"
import { adaptQueue } from "@/lib/adaptQueue"
import { loadAdaptation } from "@/lib/adaptation"
import { authErrorResponse, ensureOwner, ensureRegistered, getSession } from "@/lib/authz"
import { RATE_LIMITS, enforceRateLimit, redisStore } from "@/lib/rateLimit"

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
    const oturum = ensureRegistered(await getSession())

    const yuk = await loadAdaptation(id)
    if (!yuk) return NextResponse.json({ error: "Uyarlama bulunamadı." }, { status: 404 })
    ensureOwner(yuk.ownerId, oturum)

    if (yuk.adaptation.status !== "draft" && yuk.adaptation.status !== "ready") {
      return NextResponse.json(
        { error: "Uyarlama tamamlanınca ön yazı hazırlayabilirsin.", code: "uyarlama_hazir_degil" },
        { status: 400 },
      )
    }

    const mevcut = yuk.adaptation.coverLetter as OnYaziKaydi | null
    if (mevcut?.durum === "running") {
      return NextResponse.json({ coverLetter: mevcut }, { status: 202 })
    }

    // Pahalı uç: her çağrı bir LLM üretimi (spec §9).
    await enforceRateLimit(redisStore, `onyazi:${oturum.user.id}`, RATE_LIMITS.kayitli)

    const kayit: OnYaziKaydi = { durum: "running" }
    await prisma.adaptation.update({ where: { id }, data: { coverLetter: kayit } })
    await adaptQueue.add(COVER_LETTER_JOB, { adaptationId: id }, ADAPT_JOB_OPTIONS)

    return NextResponse.json({ coverLetter: kayit }, { status: 202 })
  } catch (error) {
    const yanit = authErrorResponse(error)
    if (yanit) return yanit
    console.error("[api/adapt/[id]/cover-letter]", error)
    return NextResponse.json(
      { error: "Bir şeyler ters gitti. Birazdan tekrar dener misin?" },
      { status: 500 },
    )
  }
}
